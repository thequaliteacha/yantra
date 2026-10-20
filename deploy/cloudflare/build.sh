#!/usr/bin/env bash
# Assemble the sangha site into dist/ (page, shelf, web edition; never the mp3s).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
rm -rf "$here/dist"
mkdir -p "$here/dist/web"
cp "$repo/index.html" "$repo/discs.json" "$here/dist/"
rsync -a --exclude audio-stage --exclude talks-stage --exclude audio --exclude __pycache__ --exclude '*.py' "$repo/web/" "$here/dist/web/"
echo "built $(find "$here/dist" -type f | wc -l) files into dist/"
