#!/usr/bin/env bash
#
# Asks each camera whether it is alive, and tells the API which ones answered.
#
# Runs ON THE VPS, on a timer. Not from the API: this machine already holds the credentials and
# already talks to the cameras, and probing a hundred devices from the production box is exactly the
# traffic the whole design keeps off it.
#
# Two rules that are not optimisations:
#
#   1. A camera somebody is watching is NOT probed. go2rtc already has a live connection to it, which
#      is better evidence than any probe, and a site has room for exactly one puller — so probing a
#      watched camera would be the second one. go2rtc's consumers count is how we tell.
#
#   2. The probe is DESCRIBE, never PLAY. It asks "is the stream there" and costs about a kilobyte.
#      Pulling video to check whether video can be pulled would spend the thing being measured.
#
# Only success is reported as success; a failure leaves LastSeenUtc alone, so the UI shows the gap
# growing rather than a fresh timestamp on a dead camera.

set -euo pipefail

VMS_DIR="${VMS_DIR:-/srv/vms}"
CREDS="$VMS_DIR/credentials.env"
API_URL="${VMS_API_URL:-}"          # .../api/VmsGateway  (the group, not a route)
TOKEN_FILE="${VMS_TOKEN_FILE:-$VMS_DIR/gateway.token}"
GO2RTC="${VMS_GO2RTC_URL:-http://vms-go2rtc:1984}"
DOCKER_USER="${VMS_DOCKER_USER:-amirserver}"
TIMEOUT="${VMS_PROBE_TIMEOUT:-6}"

die() { echo "vms-health: $*" >&2; exit 1; }
log() { echo "vms-health: $*"; }

[ -f "$CREDS" ]      || die "missing $CREDS"
[ -f "$TOKEN_FILE" ] || die "missing $TOKEN_FILE"
[ -n "$API_URL" ]    || die "set VMS_API_URL"

TOKEN=$(tr -d '\r\n' < "$TOKEN_FILE")
[ -n "$TOKEN" ] || die "empty gateway token"

work=$(mktemp -d); trap 'rm -rf "$work"' EXIT

# ── what the API thinks exists ───────────────────────────────────────────────
curl -sS --fail-with-body -m 30 -o "$work/config.json" \
  -H "X-Vms-Gateway-Token: $TOKEN" "$API_URL/config" \
  || die "the API refused the config request — nothing probed"

# ── which cameras go2rtc is already streaming ────────────────────────────────
# Reached as the docker user: go2rtc publishes no host port, so the only way in is the container
# network. A failure here is not fatal — it just means nothing is skipped.
runuser -l "$DOCKER_USER" -c \
  "docker run --rm --network traefik curlimages/curl:latest -s -m 8 $GO2RTC/api/streams" \
  > "$work/streams.json" 2>/dev/null || echo '{}' > "$work/streams.json"

python3 - "$work" "$CREDS" "$TIMEOUT" <<'PYEOF' > "$work/report.json"
import json, os, re, socket, sys, base64, urllib.parse
from concurrent.futures import ThreadPoolExecutor

work, creds_path, timeout = sys.argv[1], sys.argv[2], float(sys.argv[3])

config = json.load(open(os.path.join(work, "config.json"), encoding="utf-8"))
try:
    streams = json.load(open(os.path.join(work, "streams.json"), encoding="utf-8"))
except Exception:
    streams = {}

creds = {}
for raw in open(creds_path, encoding="utf-8"):
    line = raw.strip()
    if line and not line.startswith("#") and "=" in line:
        key, _, value = line.partition("=")
        user, _, password = value.partition(":")
        creds[key.strip()] = (user, password)

# The streams block is the single source of truth for how to reach each camera — it is what go2rtc
# itself uses, so a probe built from it cannot drift from what is actually being served.
targets = {}
for m in re.finditer(r"^\s{2}([A-Za-z0-9_-]+):\s*'([^']+)'\s*$", config["streamsYaml"], re.M):
    name, url = m.group(1), m.group(2)
    if name.endswith("-main"):
        continue                      # the same device as its substream; probing both is two probes
    cred = re.search(r"\{\{cred:([^}]+)\}\}", url)
    rest = re.sub(r"^rtsp://\{\{cred:[^}]+\}\}@", "", url)
    hostport, _, path = rest.partition("/")
    host, _, port = hostport.partition(":")
    targets[name] = (host, int(port or 554), "/" + path, cred.group(1) if cred else None)

def already_live(name):
    s = streams.get(name) or {}
    return bool(s.get("consumers"))

def describe(host, port, path, cred):
    """One RTSP DESCRIBE. No SETUP, no PLAY — about a kilobyte on the wire."""
    if cred not in creds:
        return False
    user, password = creds[cred]
    enc = urllib.parse.quote(password, safe="")
    uri = "rtsp://%s:%s@%s:%d%s" % (urllib.parse.quote(user, safe=""), enc, host, port, path)
    auth = "Basic " + base64.b64encode(("%s:%s" % (user, password)).encode()).decode()
    req = ("DESCRIBE %s RTSP/1.0\r\nCSeq: 1\r\nAccept: application/sdp\r\n"
           "Authorization: %s\r\nUser-Agent: vms-health\r\n\r\n" % (uri, auth))
    try:
        s = socket.create_connection((host, port), timeout)
    except OSError:
        return False
    try:
        s.settimeout(timeout)
        s.sendall(req.encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = s.recv(4096)
            if not chunk:
                break
            head += chunk
        return head.startswith(b"RTSP/1.0 200")
    except OSError:
        return False
    finally:
        s.close()

def check(item):
    name, (host, port, path, cred) = item
    if already_live(name):
        return {"streamKey": name, "online": True, "how": "watched"}
    return {"streamKey": name, "online": describe(host, port, path, cred), "how": "probe"}

# Modest fan-out: these are separate sites, so they are independent, but a hundred at once would be
# a hundred outbound connections in one breath.
with ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(check, targets.items()))

sys.stderr.write("vms-health: %d camera(s): %d up, %d down, %d skipped as already watched\n" % (
    len(results),
    sum(1 for r in results if r["online"]),
    sum(1 for r in results if not r["online"]),
    sum(1 for r in results if r["how"] == "watched")))

json.dump({"cameras": [{"streamKey": r["streamKey"], "online": r["online"]} for r in results]},
          sys.stdout)
PYEOF

# ── tell the API ─────────────────────────────────────────────────────────────
curl -sS --fail-with-body -m 30 -X POST \
  -H "X-Vms-Gateway-Token: $TOKEN" -H 'Content-Type: application/json' \
  --data-binary "@$work/report.json" \
  "$API_URL/health" \
  || die "the API refused the health report"
echo
log "reported"
