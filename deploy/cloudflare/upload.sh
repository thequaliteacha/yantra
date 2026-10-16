#!/usr/bin/env bash
# Upload staged recordings (web/audio-stage/<disc>/<NN>.mp3) to the private R2 bucket,
# skipping keys already there. Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
stage="$here/../../web/audio-stage"
bucket=yantra-sangha-audio
wrangler="${WRANGLER:-$HOME/.local/share/wrangler-cli/node_modules/.bin/wrangler}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}" "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
existing=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/$bucket/objects?per_page=1000" \
  | jq -r '.result[].key')
cd "$here"
find "$stage" -name '*.mp3' | sort | while read -r file; do
  key=${file#"$stage/"}
  if grep -qxF "$key" <<<"$existing"; then continue; fi
  "$wrangler" r2 object put "$bucket/$key" --file "$file" --content-type audio/mpeg --remote >/dev/null
  echo "uploaded $key"
done
echo "bucket up to date"
