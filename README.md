# Yantra

A sitting companion for students of Rama. It draws a slow, sacred-geometry
yantra that breathes with the music, and the music is limited to the
meditation discs of the lineage: Zazen, Vayu Meditation, Lumikara, and the
lineage recordings. There are 34 albums on the shelf.

## What it does

- **The shelf.** Pick an album or one of your own playlists built from the
  discs. Nothing outside the shelf plays. If anything else plays, the yantra
  pauses and stays still.
- **Three ways to listen.** It opens albums already in the Spotify or Apple
  Music catalogs, or it plays your own copies from `~/Music/yantra`. A file
  plays only when its name matches a track title from that album.
- **The sitting.** Press *Begin sitting* and the shelf fades. The yantra fills
  the screen and moves with the sound. Notifications go silent until you press
  *End sitting*.
- **Points of focus.** You can set the form and its focal points (navel,
  heart, third eye) for the sitting.

No music is copied or uploaded. It listens to the speakers on your own
computer, and everything stays on that machine.

## Running it

It currently runs on Linux (built on Omarchy / Hyprland, with PipeWire audio).

```sh
python3 yantra.py
```

This opens the yantra in a Chromium window at `http://127.0.0.1:8765`. It needs
Python 3 and Chromium, plus the Spotify desktop app, Apple Music, or `mpv` for
your own files. There are no Python packages to install.

## Files

| File | What it holds |
| --- | --- |
| `yantra.py` | The local server: the shelf, the players, and the sitting |
| `index.html` | The yantra itself and the shelf screen |
| `discs.json` | The 34 albums, their track lists, and where to find each one |
| `playlists.json` | Saved playlists built from the discs |

Made by Stephen Fisher.
