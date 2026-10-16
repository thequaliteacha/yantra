#!/usr/bin/env python3
"""Write web/tracks.json: a direct Spotify and Apple Music link for every song
on the shelf, so the web edition can open a form one song at a time.

Run from the repo root after discs.json changes:  python3 web/build_tracks.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import yantra  # (loads discs.json; the server does not start)

links = {}
missing = []
for disc in yantra.COLLECTION["discs"]:
    rows = {}
    for track in disc["tracks"]:
        n = track["n"]
        spotify = yantra.spotify_track_uri(disc, n)
        apple = yantra.apple_track_url(disc, n)
        row = {}
        if spotify:
            row["spotify"] = "https://open.spotify.com/track/" + spotify.rsplit(":", 1)[-1]
        if apple:
            row["apple"] = apple
        if row:
            rows[str(n)] = row
        elif disc.get("spotifyAlbum") or yantra.apple_id(disc):
            missing.append(disc["title"] + " #" + str(n) + " " + track["title"])
    if rows:
        links[disc["id"]] = rows

(ROOT / "web" / "tracks.json").write_text(json.dumps(links, indent=1, sort_keys=True) + "\n")
print(sum(len(v) for v in links.values()), "songs linked across", len(links), "discs")
for line in missing:
    print("no direct link:", line)
