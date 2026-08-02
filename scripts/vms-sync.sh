#!/usr/bin/env bash
#
# Rebuilds go2rtc's configuration on the media VPS from the camera list in CeoDb.
#
# Runs ON THE VPS, and pulls rather than being pushed to. That direction is the whole point: the
# camera passwords live only on this machine, so nothing sensitive travels and the API never needs a
# way in here.
#
#   /srv/vms/base.yaml          listen addresses, logging      — owned by this machine
#   /srv/vms/credentials.env    key=user:password, chmod 600   — owned by this machine, never in git
#   the API's /api/VmsGateway   the streams block              — owned by the database
#
# The API sends credentials as {{cred:key}} placeholders; this script fills them in, URL-encoding the
# password so a character like @ or : cannot corrupt the RTSP URL or break out of the YAML scalar.
#
# It refuses to write a config it cannot complete. A camera whose credential key is missing here would
# otherwise become a stream that fails to authenticate, with nothing anywhere saying why.

set -euo pipefail

VMS_DIR="${VMS_DIR:-/srv/vms}"
BASE="$VMS_DIR/base.yaml"
CREDS="$VMS_DIR/credentials.env"
SERVICE="${VMS_SERVICE:-vms-go2rtc}"   # the container name, see deploy/vms/docker-compose.yml

# go2rtc runs as a container, and Docker on this machine is Docker Desktop, which only bind-mounts
# host paths it has been told to share. A path outside that list does not fail — it silently mounts
# as an EMPTY DIRECTORY, and go2rtc then starts on its defaults with no cameras and no error.
# So the generated config lives under the docker user's home, which is shared.
#
# Everything secret stays in $VMS_DIR, root-only. That is not weakened by this: the docker user
# controls the daemon and is therefore root-equivalent already, so hiding the generated file from
# them would buy nothing.
DOCKER_USER="${VMS_DOCKER_USER:-amirserver}"
TARGET="${VMS_TARGET:-/home/$DOCKER_USER/vms-config/go2rtc.yaml}"

# Where to get the streams block. A file instead of a URL is how this is tested without the API.
API_URL="${VMS_API_URL:-}"
FROM_FILE="${VMS_FROM_FILE:-}"
DRY_RUN="${VMS_DRY_RUN:-0}"

# The gateway token comes from a file, not the environment: an environment variable is visible in
# /proc to anyone who can read the process, and `sud env VMS_API_TOKEN=...` would put it in the
# command line for everybody.
TOKEN_FILE="${VMS_TOKEN_FILE:-$VMS_DIR/gateway.token}"
API_TOKEN=""
[ -f "$TOKEN_FILE" ] && API_TOKEN=$(tr -d '\r\n' < "$TOKEN_FILE")

die() { echo "vms-sync: $*" >&2; exit 1; }
log() { echo "vms-sync: $*"; }

[ -f "$BASE" ]  || die "missing $BASE"
[ -f "$CREDS" ] || die "missing $CREDS"

# ── fetch ────────────────────────────────────────────────────────────────────
payload=$(mktemp); trap 'rm -f "$payload" "${payload}.yaml"' EXIT

if [ -n "$FROM_FILE" ]; then
  cp "$FROM_FILE" "$payload"
  log "using $FROM_FILE"
else
  [ -n "$API_URL" ]   || die "set VMS_API_URL (or VMS_FROM_FILE)"
  [ -n "$API_TOKEN" ] || die "no gateway token in $TOKEN_FILE"

  # --fail so a 401 is an error rather than an HTML page written into the config.
  code=$(curl -sS --fail-with-body -m 30 -o "$payload" -w '%{http_code}' \
      -H "X-Vms-Gateway-Token: $API_TOKEN" \
      "$API_URL") || die "the API answered $code — config left untouched"
  log "fetched from the API (HTTP $code)"
fi

# ── render, with the credential check ────────────────────────────────────────
# Python rather than sed: the password has to be URL-encoded, and a missing key has to be a clean
# report rather than a half-substituted file.
python3 - "$payload" "$CREDS" "${payload}.yaml" <<'PYEOF'
import json, os, re, sys, urllib.parse

payload_path, creds_path, out_path = sys.argv[1:4]

with open(payload_path, encoding="utf-8") as f:
    data = json.load(f)

streams = data["streamsYaml"]
declared = data.get("credentialKeys") or []

creds = {}
with open(creds_path, encoding="utf-8") as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        user, _, password = value.partition(":")
        creds[key.strip()] = (user, password)

# Every key the config refers to, taken from the text itself rather than trusting the list — a
# placeholder the API forgot to declare would otherwise survive into go2rtc as a literal.
used = set(re.findall(r"\{\{cred:([^}]+)\}\}", streams))
missing = sorted((used | set(declared)) - set(creds))

if missing:
    sys.stderr.write(
        "vms-sync: no credential on this machine for: %s\n"
        "vms-sync: add them to %s as key=user:password, then run again.\n"
        "vms-sync: the existing go2rtc.yaml has NOT been touched.\n"
        % (", ".join(missing), creds_path))
    sys.exit(3)

unused = sorted(set(creds) - used)
if unused:
    sys.stderr.write("vms-sync: note - unused credential keys here: %s\n" % ", ".join(unused))

for key in used:
    user, password = creds[key]
    # quote() with an empty safe set: '@' and ':' inside the password must not be read as URL
    # syntax, and "'" must not close the single-quoted YAML scalar the API emitted.
    userinfo = "%s:%s" % (urllib.parse.quote(user, safe=""),
                          urllib.parse.quote(password, safe=""))
    streams = streams.replace("{{cred:%s}}" % key, userinfo)

with open(out_path, "w", encoding="utf-8", newline="\n") as f:
    f.write(streams)

sys.stderr.write("vms-sync: %d camera(s), %d credential(s)\n" % (data.get("cameraCount", 0), len(used)))
PYEOF

# ── assemble and install, only if something changed ──────────────────────────
new=$(mktemp); trap 'rm -f "$payload" "${payload}.yaml" "$new"' EXIT
{
  echo "# Generated by vms-sync. Do not edit — edit base.yaml, or the cameras in the admin panel."
  cat "$BASE"
  echo
  cat "${payload}.yaml"
} > "$new"

if [ "$DRY_RUN" = "1" ]; then
  log "dry run; rendered config follows"
  sed 's/^/    /' "$new"
  exit 0
fi

if [ -f "$TARGET" ] && cmp -s "$new" "$TARGET"; then
  log "no change"
  exit 0
fi

# 600, owned by the docker user — the only account that needs it. install() sets the mode as the
# content lands, so the file is never briefly world-readable with camera credentials in it.
install -d -m 700 -o "$DOCKER_USER" -g "$DOCKER_USER" "$(dirname "$TARGET")"
install -m 600 -o "$DOCKER_USER" -g "$DOCKER_USER" "$new" "$TARGET"
log "wrote $TARGET"

# go2rtc runs as a container so that Traefik's docker provider can route to it without the shared
# reverse proxy being reconfigured. Docker here is Docker Desktop under a user session, so root
# cannot reach the daemon — the restart has to be run as that user.
DOCKER_USER="${VMS_DOCKER_USER:-amirserver}"

if runuser -l "$DOCKER_USER" -c "docker inspect -f '{{.State.Running}}' $SERVICE" 2>/dev/null | grep -q true; then
  runuser -l "$DOCKER_USER" -c "docker restart $SERVICE" > /dev/null
  log "restarted $SERVICE"
else
  log "$SERVICE is not running; start it with: docker compose -f /srv/sites/vms/docker-compose.yml up -d"
fi
