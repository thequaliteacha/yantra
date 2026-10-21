#!/usr/bin/env bash
# Upload the talks' timed words (tools/transcribe_talks.py output) to the private
# bucket, next to each talk: talks/<name>.json. Served only to the Zazen word.
#   deploy/cloudflare/upload-transcripts.sh [~/Music/Dharma/.transcripts]
set -euo pipefail
src=${1:-$HOME/Music/Dharma/.transcripts}
here=$(cd "$(dirname "$0")" && pwd)
set -a; . "$HOME/.config/yantra-cloudflare.env"; set +a
wrangler=$HOME/.local/share/wrangler-cli/node_modules/.bin/wrangler
cd "$src"
find talks -name '*.json' | sort | while read -r key; do
  (cd "$here" && "$wrangler" r2 object put "yantra-sangha-audio/$key" --file "$src/$key" \
    --content-type "application/json" --remote >/dev/null) && echo "uploaded $key"
done
