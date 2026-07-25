#!/usr/bin/env bash
# Decrypt the SOPS-encrypted secrets (prod.enc.env) into the plaintext deploy/.env that
# `docker compose` reads. Run on the SERVER (where the age private key lives) before bringing
# the stack up. Idempotent — overwrites deploy/.env each time.
#
#   bash deploy/decrypt-env.sh
#   docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env up -d api web
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOPS="${SOPS:-/srv/mabhas19/bin/sops}"
KEY="${SOPS_AGE_KEY_FILE:-/srv/mabhas19/secrets/age.key}"
ENC="$HERE/prod.enc.env"
OUT="$HERE/.env"

[ -x "$SOPS" ] || { echo "ERROR: sops not found/executable at $SOPS"; exit 1; }
[ -f "$KEY" ]  || { echo "ERROR: age key not found at $KEY (restore it from your backup)"; exit 1; }
[ -f "$ENC" ]  || { echo "ERROR: encrypted secrets not found at $ENC"; exit 1; }

SOPS_AGE_KEY_FILE="$KEY" "$SOPS" --decrypt --input-type dotenv --output-type dotenv "$ENC" > "$OUT"
chmod 600 "$OUT"
echo "decrypted $ENC -> $OUT"
