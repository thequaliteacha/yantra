#!/usr/bin/env python3
"""Stage the sangha's own mp3s for the web edition and write web/audio.json.

  python3 web/build_audio.py ~/Music/vayu-sangha            # check and stage
  python3 web/build_audio.py ~/Music/vayu-sangha --add-discs  # also add albums missing from discs.json

Each album folder is matched to a disc by title; each file to a track by its
leading number ("01 - Long Mountain.mp3"). Matched files are copied to
web/audio-stage/<disc id>/<NN>.mp3, the layout the Worker serves from R2, and
web/audio.json lists them. The mp3s themselves never go into git.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DISCS_FILE = ROOT / "discs.json"
STAGE = ROOT / "web" / "audio-stage"
MANIFEST = ROOT / "web" / "audio.json"


def norm(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def slug(text):
    return norm(text).replace(" ", "-")


def seconds(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=False,
    ).stdout.strip()
    try:
        return round(float(out))
    except ValueError:
        return 0


def numbered(folder):
    """{track number: (path, title from the file name)} for real audio files."""
    rows = {}
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() != ".mp3" or path.name.startswith(".") or path.stat().st_size < 100_000:
            continue
        match = re.match(r"\s*(\d{1,2})\s*[-.]?\s*(.+)$", path.stem)
        if match:
            rows[int(match.group(1))] = (path, match.group(2).replace("_", "'").strip())
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--add-discs", action="store_true")
    args = parser.parse_args()

    collection = json.loads(DISCS_FILE.read_text())
    by_title = {}
    for disc in collection["discs"]:
        for name in [disc["title"], *disc.get("aliases", [])]:
            by_title.setdefault(norm(name), disc)

    manifest = {}
    added = []
    for folder in sorted(p for p in args.source.expanduser().iterdir() if p.is_dir()):
        tracks = numbered(folder)
        if not tracks:
            print(f"skip   {folder.name}: no playable mp3s (iCloud placeholders?)")
            continue
        disc = by_title.get(norm(folder.name))
        if disc is None:
            if not args.add_discs:
                print(f"new    {folder.name}: not in discs.json ({len(tracks)} tracks); rerun with --add-discs")
                continue
            disc = {
                "id": slug(folder.name), "circle": "vayu", "title": folder.name,
                "artist": "Vayu Meditation", "aliases": [folder.name], "artistKeys": ["vayu"],
                "tracks": [{"n": n, "title": title, "length": seconds(path)} for n, (path, title) in sorted(tracks.items())],
            }
            collection["discs"].append(disc)
            by_title[norm(folder.name)] = disc
            added.append(disc["title"])
        known = {track["n"]: track for track in disc["tracks"]}
        rows = {}
        for n, (path, title) in sorted(tracks.items()):
            track = known.get(n)
            if track is None:
                print(f"  ?    {disc['title']} #{n} {title}: no such track number on the disc")
                continue
            if norm(title)[:6] != norm(track["title"])[:6]:
                print(f"  note {disc['title']} #{n}: file says '{title}', disc says '{track['title']}'")
            target = STAGE / disc["id"] / f"{n:02d}.mp3"
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists() or target.stat().st_size != path.stat().st_size:
                shutil.copy2(path, target)
            rows[str(n)] = f"{disc['id']}/{n:02d}.mp3"
        missing = sorted(set(known) - {int(n) for n in rows})
        print(f"ok     {disc['title']}: {len(rows)}/{len(known)} tracks" + (f" (missing {missing})" if missing else ""))
        if rows:
            manifest[disc["id"]] = rows

    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n")
    if added:
        DISCS_FILE.write_text(json.dumps(collection, indent=2, ensure_ascii=False) + "\n")
        print("added to discs.json:", ", ".join(added))
    print(sum(len(v) for v in manifest.values()), "recordings across", len(manifest), "discs ->", MANIFEST.relative_to(ROOT))


if __name__ == "__main__":
    sys.exit(main())
