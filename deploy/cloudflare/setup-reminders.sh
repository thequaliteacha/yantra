#!/bin/sh
# One-time reminder setup. Run from anywhere; it moves into this directory.
# Creates the REMINDERS KV namespace, writes its id into wrangler.jsonc, and
# stores the VAPID keys as Worker secrets. Existing keys are left alone unless
# you pass --rotate (rotating them makes phones subscribe again).
set -eu
cd "$(dirname "$0")"
WRANGLER="npx -y wrangler@4.151.0"
ROTATE=0
if [ "${1:-}" = "--rotate" ]; then ROTATE=1; fi

if grep -q 'REPLACE_WITH_setup-reminders' wrangler.jsonc; then
  echo "Creating the REMINDERS KV namespace…"
  OUT=$($WRANGLER kv namespace create REMINDERS)
  printf '%s\n' "$OUT"
  ID=$(printf '%s\n' "$OUT" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
  if [ -z "$ID" ]; then
    ID=$(printf '%s\n' "$OUT" | sed -n 's/.*id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
  fi
  if [ -z "$ID" ]; then
    echo "Could not read the namespace id. Put it in wrangler.jsonc in place of REPLACE_WITH_setup-reminders."
    exit 1
  fi
  python3 - "$ID" <<'PY'
import pathlib, sys
path = pathlib.Path("wrangler.jsonc")
text = path.read_text()
old = "REPLACE_WITH_setup-reminders"
if old not in text:
    raise SystemExit("placeholder missing")
path.write_text(text.replace(old, sys.argv[1], 1))
PY
  echo "Wrote the namespace id into wrangler.jsonc."
else
  echo "wrangler.jsonc already names a REMINDERS namespace."
fi

SECRETS=$($WRANGLER secret list || true)
NEED=0
if [ "$ROTATE" = "1" ]; then NEED=1; fi
printf '%s\n' "$SECRETS" | grep -q 'VAPID_PUBLIC_KEY' || NEED=1
printf '%s\n' "$SECRETS" | grep -q 'VAPID_PRIVATE_KEY' || NEED=1
if [ "$NEED" = "1" ]; then
  if [ "$ROTATE" = "1" ]; then
    echo "Replacing VAPID keys. Phones that already subscribed will need to save reminders again."
  fi
  DIR=$(mktemp -d)
  trap 'rm -rf "$DIR"' EXIT
  node generate-vapid.mjs "$DIR" >/dev/null
  $WRANGLER secret put VAPID_PUBLIC_KEY < "$DIR/vapid-public"
  $WRANGLER secret put VAPID_PRIVATE_KEY < "$DIR/vapid-private"
  echo "VAPID secrets stored."
else
  echo "VAPID secrets are already set. Pass --rotate only if you mean to replace them."
fi

echo "Done. Publish with: ./build.sh && npx -y wrangler@4.151.0 deploy"
