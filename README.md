# Yantra

**[Open Yantra at yantramedi.app →](https://yantramedi.app)**

A sitting companion for the sangha. It draws a slow, sacred-geometry
yantra that breathes with the music, and the music is limited to the
meditation discs of the lineage: Zazen, Vayu Meditation, Lumikara, and the
lineage recordings. `discs.json` lists 36 albums. The shelf shows the 24 of
them on Spotify; the rest stay hidden until they reach Spotify or you install
your own copies. (Apple Music
support is switched off for now: set `APPLE_MUSIC` in `yantra.py`, `index.html`
and `web/web.js` to bring it back.)

## What it does

- **The shelf.** Pick an album, or a form you've saved. Nothing outside the
  shelf plays. If anything else plays, the yantra
  pauses and stays still.
- **Two ways to listen.** It plays albums from Spotify, or your own copies
  from `~/Music/yantra`. A file plays only when its name matches a track title
  from that album.
- **The sitting.** Press *Begin sitting* and the album starts on Spotify while the shelf fades. The yantra fills the screen and moves with the
  sound. Notifications go silent until you press
  *End sitting*.
- **Forms.** Build a sitting of 3, 6, 9, or 12 songs from the discs, kept
  equal across navel, heart, and third eye. Random forms draw only from songs
  that can play. Name a form and save it to use again.

On the desktop no music is copied or uploaded. It listens to the speakers on
your own computer, and everything stays on that machine.

## In the browser

The web edition lives at [yantramedi.app](https://yantramedi.app). The first
visit asks for the sangha word, which Chitananda shares with the group; the
phone then remembers it for a year. The sangha word opens Vayu Meditation, and
the Zazen word, given after the Rama talk, opens every circle.

It opens like the Heart School meditation app: **Morning
Meditation** or **Evening Meditation**, then 1, 3, 6 or 12 songs. A sit keeps
to one album, as the sangha listens. Each album runs from navel songs through
heart songs to third eye songs, so the sit takes the same number from each
third, in album order. One song is a heart song; three, six and twelve go
navel, heart, third eye in equal parts. The listener can choose the album, or
let each sit bring a new one. **Mix It Up** goes across albums instead,
following the Heart School app's curation of Vayu Meditation songs
(`web/sets.json`). The sangha's own recordings play right in the page with no
account needed. Twenty albums are hosted in full (of the 36) and play that way.
Big Island is hosted except for one track, so that album still plays from Spotify,
along with the albums that are not recorded yet. Where a mixed set calls for a song that isn't recorded, a
recorded song for the same chakra takes its place. Albums without recordings play from
the listener's own Spotify. A hosted recording moves the yantra; a Spotify sit
uses a slow breath instead. The page never asks for the microphone. The yantra draws
itself once per song, and *Meditation Complete* closes the sit. *Albums and
forms* opens the full shelf. *Getting Started* explains the practice and how to
install the app on a phone.

The link above opens the web edition on any computer or phone. For albums
that aren't recorded, press *Connect* beside *Listen on Spotify* once. After that,
*Begin sitting* and a form's *Sit* play every song right in the page, in order,
and the caption follows the whole sit. There are no other windows and nothing
to press until the sit ends. Spotify needs Premium. On a phone, Spotify plays through the Spotify app that is open on
it.

Each listener's forms are their own. On the web they are kept in that browser
under the listener's Spotify account, and every saved form also becomes a
private playlist in the listener's own Spotify library, named "Yantra · " and
the form's name. A sit plays from that playlist, so the songs keep going in
order even if the page closes or the phone sleeps. Nobody else sees them.

If Spotify is not connected yet, pressing *Sit* or *Begin sitting* connects
first and brings you straight back with the sit ready to begin.

Without Spotify set up at all the web edition still works: the album or song opens in a
second tab, and a form waits on *Next* at the bottom of the yantra. The yantra
breathes slowly on its own. Forms you save stay in that browser.

Practice time and days in a row stay in the browser too, under *Your practice*.
Nothing is uploaded. A sit counts after one minute of listening; paused time
does not. Morning and evening each keep their own run of days, and either one
keeps the daily run. The day is the device's own date.

Morning and evening reminders are on that same page, each one on or off by
itself. A reminder can follow sunrise or sunset (a few minutes before or after,
if you like) or a time you set. The sun is calculated on the device. A place
stays there too: typed as a city or rounded coordinates, or read only when you
ask. What leaves the device is an anonymous id, the push subscription, and
either a clock time or coordinates rounded to a tenth of a degree. Delete my
reminder data removes that record. On iPhone and iPad the note arrives only
from the Home Screen app.

*Settings*, beside *Your practice* and from the small mark at the top right, is
this device only. Name, reminder choices, theme, glow, and saved talks live in
one store, `yantra.settings.v1`. The practice record stays separate. An optional
name can greet you on the home screen and when a sit ends. It is not uploaded.
**Leave Yantra on this device** clears the word-gate cookie through `/logout`
and returns to the word prompt, including from an iPhone or iPad home-screen
app. **Sign out** is reserved for a later account and stays hidden. A Zazen
access switch asks for the Zazen word through the existing gate, and can return
to the sangha shelf without keeping that word. Export and erase cover the
practice record, every setting, and saved talks. Erase everything on this
device also clears Spotify and the cookie. Resources links to Rama's published
talks, guided meditations, the lines that can close a sit, and the music, video,
and books on the Rama Meditation Society site.

### Setting up the connections (once, by the site owner)

`web/config.json` holds one public value:

- **`spotifyClientId`**: create an app at developer.spotify.com (the owner needs
  Premium). Add `https://yantramedi.app/web/` as a Redirect URI,
  and choose Web API and Web Playback SDK. In Development Mode the app serves up
  to five listeners, each added by email under User Management. Your own
audio files and the silenced notifications belong to the desktop app.

### On a phone (Android or iPhone)

Open the link and add Yantra to the home screen: on Android, Chrome's menu ›
*Add to Home screen* (or *Install app*); on iPhone, Safari's Share › *Add to
Home Screen*. It then opens full screen like an app, keeps the screen awake
during a sitting, and a tap shows *End sitting*. Spotify plays through the
Spotify app on the phone, so open Spotify once before the first sit.

### Hosting (yantramedi.app)

`deploy/cloudflare/` holds the Cloudflare Worker that serves the site. The
recordings live in a private R2 bucket and stream through the Worker with byte
ranges. The Worker checks the sangha word's signed cookie and leaves circles off
the shelf that the word doesn't open. The words and the cookie key are Worker
secrets, never in this repo.

```sh
python3 web/build_audio.py ~/Music/vayu-sangha ~/Music/zazen-sangha   # stage recordings, write web/audio.json
deploy/cloudflare/upload.sh                      # send new recordings to R2
deploy/cloudflare/build.sh && wrangler deploy    # build and publish the site
```

Reminders need a one-time setup before the first deploy that includes them.
From `deploy/cloudflare`:

```sh
./setup-reminders.sh
./build.sh && npx -y wrangler@4.151.0 deploy
```

The script creates a KV namespace named REMINDERS, writes its id into
`wrangler.jsonc`, and stores `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. It
does not replace keys that are already set. `./setup-reminders.sh --rotate`
makes a new pair, and phones then save their reminders again. The usual build
and deploy is enough after that. The Worker checks for a reminder once a minute.

The old GitHub Pages address now forwards to yantramedi.app.

## Running the desktop app

It currently runs on Linux (built on Omarchy / Hyprland, with PipeWire audio).

```sh
python3 yantra.py
```

This opens the yantra in a Chromium window at `http://127.0.0.1:8765`. It needs
Python 3 and Chromium, plus the Spotify desktop app, or `mpv` for
your own files. There are no Python packages to install.

## Files

| File | What it holds |
| --- | --- |
| `yantra.py` | The local server: the shelf, the players, and the sitting |
| `index.html` | The yantra itself and the shelf screen |
| `discs.json` | All 36 albums, their track lists, and where to find each one |
| `playlists.json` | The desktop app's saved forms (kept on your computer, not in this repo) |
| `web/` | The browser edition: loads `index.html` and answers in place of `yantra.py`; `tracks.json` holds each song's direct link (rebuild with `python3 web/build_tracks.py`), and `audio.json` lists the recordings |
| `deploy/cloudflare/` | The Worker behind yantramedi.app, plus scripts to build, upload recordings and save the API token |
