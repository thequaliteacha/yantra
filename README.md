# Yantra

**[Open Yantra in your browser →](https://thequaliteacha.github.io/yantra/web/)**

A sitting companion for students of Rama. It draws a slow, sacred-geometry
yantra that breathes with the music, and the music is limited to the
meditation discs of the lineage: Zazen, Vayu Meditation, Lumikara, and the
lineage recordings. The shelf shows the 25 albums on Spotify or Apple Music;
the other nine Zazen discs stay hidden until they reach a catalog or you
install your own copies.

## What it does

- **The shelf.** Pick an album, or a form you've saved. Nothing outside the
  shelf plays. If anything else plays, the yantra
  pauses and stays still.
- **Three ways to listen.** It opens albums already in the Spotify or Apple
  Music catalogs, or it plays your own copies from `~/Music/yantra`. A file
  plays only when its name matches a track title from that album.
- **Listen on.** Choose Spotify or Apple Music at the top of the shelf; the
  choice is remembered. An album that is only on the other catalog plays there.
- **The sitting.** Press *Begin sitting* and the album starts on your chosen
  source while the shelf fades. The yantra fills the screen and moves with the
  sound. Notifications go silent until you press
  *End sitting*.
- **Forms.** Build a sitting of 3, 6, 9, or 12 songs from the discs, kept
  equal across navel, heart, and third eye. Random forms draw only from songs
  that can play. Name a form and save it to use again.

No music is copied or uploaded. It listens to the speakers on your own
computer, and everything stays on that machine.

## In the browser

The link above opens the web edition on any computer or phone. *Begin
sitting* opens the album in Spotify or Apple Music in a second tab, and the
yantra moves with the room through
the microphone while the music plays nearby. Without the microphone it
breathes slowly on its own. A form opens one song at a time in that same tab; when a song ends, tap
*Next* at the bottom of the yantra. Forms you save stay in that browser. Your own
audio files and the silenced notifications belong to the desktop app.

## Running the desktop app

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
| `discs.json` | All 34 albums, their track lists, and where to find each one |
| `playlists.json` | Saved forms |
| `web/` | The browser edition: loads `index.html` and answers in place of `yantra.py`; `tracks.json` holds each song's direct link (rebuild with `python3 web/build_tracks.py`) |

Made by Stephen Fisher.
