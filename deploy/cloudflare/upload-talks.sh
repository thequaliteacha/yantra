#!/usr/bin/env bash
# Upload staged talks into talks/ on the private R2 bucket, skipping keys already
# there. A key may include a folder, so talks/rama-live-la/<id>.mp3 is staged at
# web/talks-stage/rama-live-la/<id>.mp3. The names come from web/talks.json.
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Does not deploy.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
stage="$here/../../web/talks-stage"
manifest="$here/../../web/talks.json"
bucket=yantra-sangha-audio
wrangler="${WRANGLER:-$HOME/.local/share/wrangler-cli/node_modules/.bin/wrangler}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}" "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"

ctype() {
  case "${1##*.}" in
    mp3) echo audio/mpeg ;;
    m4a|mp4) echo audio/mp4 ;;
    aac) echo audio/aac ;;
    ogg|opus) echo audio/ogg ;;
    wav) echo audio/wav ;;
    flac) echo audio/flac ;;
    *) echo application/octet-stream ;;
  esac
}

existing=""
cursor=""
while true; do
  url="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/$bucket/objects?prefix=talks/&per_page=1000"
  if [[ -n "$cursor" ]]; then
    url="$url&cursor=$(jq -nr --arg c "$cursor" '$c|@uri')"
  fi
  page=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$url")
  if [[ $(jq -r '.success' <<<"$page") != "true" ]]; then
    echo "could not list talks/ in the bucket" >&2
    exit 1
  fi
  existing+=$'\n'$(jq -r '.result[]?.key' <<<"$page")
  if [[ $(jq -r '.result_info.is_truncated // false' <<<"$page") != "true" ]]; then break; fi
  cursor=$(jq -r '.result_info.cursor // empty' <<<"$page")
  [[ -n "$cursor" ]] || break
done

cd "$here"
jq -r '.[] | .r2Key // empty | select(test("^talks/(?:[a-z0-9][a-z0-9-]*/)*[a-z0-9][a-z0-9-]*\\.[a-z0-9]+$"))' "$manifest" | while read -r key; do
  if grep -qxF "$key" <<<"$existing"; then continue; fi
  file="$stage/${key#talks/}"
  if [[ ! -f "$file" ]]; then
    echo "skip $key (no file in web/talks-stage)"
    continue
  fi
  "$wrangler" r2 object put "$bucket/$key" --file "$file" --content-type "$(ctype "$file")" --remote >/dev/null
  echo "uploaded $key"
done
echo "bucket up to date"
