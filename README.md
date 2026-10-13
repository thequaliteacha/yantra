# Yantra

**[Open Yantra in your browser →](https://thequaliteacha.github.io/yantra/web/)**

A sitting companion for students of Rama. It draws a slow, sacred-geometry
yantra that breathes with the music, and the music is limited to the
meditation discs of the lineage: Zazen, Vayu Meditation, Lumikara, and the
lineage recordings. The shelf shows the 24 albums on Spotify; the rest stay
hidden until they reach Spotify or you install your own copies. (Apple Music
support is switched off for now: set `APPLE_MUSIC` in `yantra.py`, `index.html`
and `web/web.js` to bring it back.)

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

The link above opens the web edition on any computer or phone. Press
*Connect* beside *Listen on Spotify* once. After that,
*Begin sitting* and a form's *Sit* play every song right in the page, in order,
and the caption follows the whole sit. There are no other windows and nothing
to press until the sit ends. Spotify needs Premium. On a phone, Spotify plays through the Spotify app that is open on
it.

Without a connection the web edition still works: the album or song opens in a
second tab, and a form waits on *Next* at the bottom of the yantra. The yantra
moves with the room through the microphone, or breathes slowly on its own.
Forms you save stay in that browser.

### Setting up the connections (once, by the site owner)

`web/config.json` holds one public value:

- **`spotifyClientId`**: create an app at developer.spotify.com (the owner needs
  Premium). Add `https://thequaliteacha.github.io/yantra/web/` as a Redirect URI,
  and choose Web API and Web Playback SDK. In Development Mode the app serves up
  to five listeners, each added by email under User Management. Your own
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
