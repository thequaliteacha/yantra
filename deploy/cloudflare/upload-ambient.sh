#!/usr/bin/env bash
# Stage the public-domain rain in web/ambient/sources.json as mono mp3, then upload
# new files to the private R2 bucket under ambient/. See web/ambient/SOURCES.md.
# Without CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID this only stages.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
stage="$repo/web/ambient-stage"
mkdir -p "$stage/src" "$stage/ambient"
REPO="$repo" STAGE="$stage" python3 - <<'PY'
import json, os, pathlib, subprocess, urllib.request
repo = pathlib.Path(os.environ["REPO"])
stage = pathlib.Path(os.environ["STAGE"])
rows = json.loads((repo / "web/ambient/sources.json").read_text())
for row in rows:
    ogg = stage / "src" / (row["id"] + ".ogg")
    mp3 = stage / "ambient" / row["file"]
    if not ogg.exists() or ogg.stat().st_size == 0:
        request = urllib.request.Request(row["download"], headers={"User-Agent": "YantraAmbient/1.0"})
        with urllib.request.urlopen(request, timeout=90) as response:
            ogg.write_bytes(response.read())
        print("downloaded", row["id"])
    if not mp3.exists() or mp3.stat().st_size == 0:
        subprocess.check_call([
            "ffmpeg", "-y", "-i", str(ogg),
            "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "96k",
            str(mp3),
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("encoded", row["file"])
PY
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "staged rain under web/ambient-stage; set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to upload"
  exit 0
fi
bucket=yantra-sangha-audio
wrangler="${WRANGLER:-$HOME/.local/share/wrangler-cli/node_modules/.bin/wrangler}"
existing=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/$bucket/objects?prefix=ambient/&per_page=1000" \
  | jq -r '.result[].key')
cd "$here"
find "$stage/ambient" -name '*.mp3' | sort | while read -r file; do
  key="ambient/$(basename "$file")"
  if grep -qxF "$key" <<<"$existing"; then continue; fi
  "$wrangler" r2 object put "$bucket/$key" --file "$file" --content-type audio/mpeg --remote >/dev/null
  echo "uploaded $key"
done
echo "ambient bucket up to date"
