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
phone then remembers it for a year. The sangha word opens Vayu Meditation only.
The Zazen word, given after the Rama talk, also opens Zazen and the lineage,
plus Rama quotes and talks. Lumikara is not part of the meditation.

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
Big Island is hosted except for one track. Where every offered song is hosted,
the page plays those copies; otherwise that album still plays from Spotify,
along with the albums that are not recorded yet. Where a mixed set calls for a song that isn't recorded, a
recorded song for the same chakra takes its place. Albums without recordings play from
the listener's own Spotify. A hosted recording moves the yantra; a Spotify sit
uses a slow breath instead. The page never asks for the microphone. The yantra draws
itself once per song in the song's chakra: the navel's ten petals in sun gold, the
heart's twelve in green, the third eye's open ring in violet, in the dark and in
cream alike. Once the petals open, in the song's last third, the outer wheel
quivers and turns clockwise, an opening wheel that spins up to a turn in about
half a minute as the song closes.
*Meditation Complete* closes the sit. For the Zazen word, the line there is still a verbatim Rama quote. `web/quotes.json` tags albums, tracks, and those lines by theme, and the screen prefers a line that fits what just played, then falls back to any of the lines. When that talk is in the talks on the practice page, the credit is *From:* that talk. The Sangha word does not see the quotes. *Albums and
forms* opens the full shelf. *Getting Started* explains the practice and how to
install the app on a phone.

The link above opens the web edition on any computer or phone. For albums
that aren't recorded, press *Connect* beside *Listen on Spotify* once. After that,
*Begin sitting* and a form's *Sit* play every song right in the page, in order,
and the caption follows the whole sit. There are no other windows and nothing
to press until the sit ends. Spotify needs Premium, and its in-page player only
runs where that player is supported and the account is connected. On a phone or
tablet the player does not run, so albums and songs that can only play there
are not shown. A sit uses the hosted recordings. A song that never starts is
skipped after a few seconds, and that song is left off the lists for the rest
of the visit. The next song that can play starts on its own. When a section or
the mix has nothing left that can play, that section or mix is not shown.

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

Practice time and days in a row stay in the browser, under *Your practice*.
A sit counts after one minute of listening; paused time
does not. A perfect day holds a Morning Meditation (sunrise) and an Evening
Meditation (sunset); perfect days in a row are the main streak, and the page
nudges toward the next one. Morning and evening also keep their own runs. The
day is the device's own date. On its own, a device keeps that record to itself.
*Link my devices* makes a private practice key. The QR code stays hidden until
you ask to see it, drawn in muted gold on deep indigo, and the link is there too.
Its key sits in the fragment (`https://yantramedi.app/web/#link=…`),
so the key never reaches the server. Another device opens the link or pastes
the key. Each device encrypts its own days (HKDF for a lookup id and an
AES-GCM key) and uploads only the lookup id and the ciphertext. The shared
streak is the sum of those days, once per device. Offline sits stay on the
device and upload when it can. *Unlink this device*, *Remove a device*, and
*Forget this practice key everywhere* are on the same page. Tap a linked device
to give it a short name; that name travels with the shared list. No account, no
email, and nothing tracked.

Morning and evening reminders are on that same page, each one on or off by
itself. A reminder can follow sunrise or sunset (a few minutes before or after,
if you like) or a time you set. The sun is calculated on the device. A place
stays there too: a city chosen from the app's own list of about four hundred
(typed as "Austin", "austin tx" or "Texas"; the list is in the app, so nothing
typed leaves the device), rounded coordinates, or read only when you ask. What leaves the device is an anonymous id, the push subscription, and
either a clock time or coordinates rounded to a tenth of a degree. Delete my
reminder data removes that record. On iPhone and iPad the note arrives only
from the Home Screen app.

The home screen holds only the two sits and the week: seven circles whose left
half fills with the sunrise sit and right half with the sunset sit, and one line
toward the next perfect day. Everything else is under *You*, the mark at the top
right (titled with your name once you give one). *Mindfulness Material* comes first:
Dharma Talks (the Zazen word only), Sit Guidance, and Albums + Playlists, in one row.
Practice, Reminders, Profile, and Settings fold shut except Practice, and this device
remembers which are open. Practice holds the week, time, sits, perfect days, export,
erase, and Link my devices. Profile holds the name, initial, altar, and log out.
Reminders hold the morning and evening times. Settings holds Spotify, privacy, and install.
*Before you
sit*, on the song-count screen, holds the album, Mix It Up, and the bell (on or
off, and its volume); each song count shows its minutes. A first visit on a
device with no sits gets three welcome steps (the perfect day, reminders, Add
to Home Screen), once. Talks remember where they were left, mark the ones
heard, and show on the lock screen.

*Altar*: up to three photos — a teacher, an amakua, or a place of power — rest
softly, and at the same size, above the yantra and on the home screen, the sits
menu, and the profile. Each is shrunk on the device to a small JPEG and kept
with the other settings; nothing is uploaded. The theme toggle at the top left
of home switches between dark and cream (a warm eggshell with brown-gold ink).

Playing a talk opens *Watch*: the glowing Sri Yantra forms over the talk's
opening minutes with the navel lotus's ten petals, and the
words being spoken embellish it. Words of light send soft rays out; heart,
power, and awareness words lean the colour toward that chakra; stillness hushes
the figure; enlightenment lets it bloom. Concepts (the sun, a mountain, the
ocean, a lotus, a path, a door, the wheel of rebirth, and others in
`web/sketches.js`) draw themselves as small line sketches beside the figure. The
phrase being spoken can show below. Closing the visualizer pauses the talk, as
ending a sit stops the music; it picks up there next time. The, each word brightening as it is said (Words
on or off). The timed words are made locally with
`tools/transcribe_talks.py` (faster-whisper) and kept in the private bucket
next to each talk as `talks/<name>.json`, served only to the Zazen word.
Name, reminder choices, theme, glow, and saved talks are in one store,
`yantra.settings.v1`. The practice record stays separate, and its time, sits,
and days in a row are shown on that page. An optional name can greet you on
the home screen and when a sit ends. It is not uploaded. **Log out** posts to
`/logout`, which clears the word-gate cookie and returns the word prompt,
including from an iPhone or iPad home-screen app. **Sign out** is reserved for
a later account and stays hidden. The page never names the access level, so new
students are not shown what lies past their word; to use a different word,
log out and enter it. The Linux
desktop app does not ask for a word and does not store one. Export and erase
cover the practice record, every setting, and saved talks. Erase everything on
this device also clears Spotify and the cookie.

*Dharma Talks*, on the home screen for the Zazen word only, plays the Rama
talks listed in `web/talks.json` (downloaded from the Rama Meditation Society
site and served from R2 under `/talks/`).

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
during a sitting, and a tap shows *End sitting*. The in-page Spotify player
cannot play on a phone, so sits use the hosted recordings. Spotify plays only
when the Spotify app is already available. A song that never starts is skipped.

### Hosting (yantramedi.app)

`deploy/cloudflare/` holds the Cloudflare Worker that serves the site. The
recordings live in a private R2 bucket and stream through the Worker with byte
ranges. The Worker checks the signed cookie. The sangha word leaves every circle
but Vayu off the shelf, and is refused Rama quotes and talk audio. The Zazen
word also opens Zazen, the lineage, Rama quotes, and Rama talk audio. Lumikara
is left off for both. The words and the cookie key are Worker secrets, never in
this repo.

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
Practice sync reuses that same REMINDERS namespace (ciphertext under a
`practice:` prefix). It needs no new binding and no new secret.

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
