#!/usr/bin/env python3
"""Fullscreen sacred-geometry visual for this school's discs.

The shelf is the Zazen, Vayu Meditation, Lumikara, and lineage discs.
Spotify and Apple Music open only the albums from that shelf already in their catalogs.
Installed files play only when their names match those track lists.
Anything else is paused and does not move the yantra.
"""

import json
import math
import os
import random
import re
import shutil
import signal
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8765
# Apple Music is off for now. The Apple ids stay in discs.json; set True to bring it back.
APPLE_MUSIC = False
LEVEL = {"rms": 0.0}
COLLECTION = json.loads((ROOT / "discs.json").read_text())
DISCS = {disc["id"]: disc for disc in COLLECTION["discs"]}
NOW = {
    "connected": False,
    "status": "Stopped",
    "title": "",
    "artist": "",
    "album": "",
    "track": 0,
    "length": 0,
    "position": 0,
    "art": "",
    "discId": "",
    "onSamurai": False,
    "source": "",
    "allowed": False,
    "blocked": False,
    "blockedTitle": "",
    "blockedArtist": "",
    "installed": {},
    "form": "",
    "formIndex": 0,
    "formTotal": 0,
    "formPlan": [],
    "chakra": "",
}
_audio = None
ALLOWED = {"on": False}
PENDING = {"until": 0.0}
LOCK = threading.Lock()
INSTALL_ROOT = Path.home() / "Music" / "yantra"
SOCK = Path("/tmp/yantra-local.sock")
LOCAL = {"proc": None, "disc_id": "", "order": []}
MODE = {"value": ""}
# Back, restart and next during a sitting: the form runner reads JUMP between songs.
JUMP = {"to": None}
FORM_POS = {"index": 0, "total": 0}
_scan = {"at": 0.0, "data": {}}
AUDIO_EXT = {".mp3", ".flac", ".m4a", ".ogg", ".wav", ".aiff", ".aif", ".aac", ".opus"}


def fold(value):
    text = str(value or "").lower()
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"\[[^\]]*\]", " ", text)
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def same_name(heard, known):
    if not heard or not known:
        return False
    if heard == known:
        return True
    return len(known) >= 4 and heard.startswith(known)


def album_names(disc):
    return [fold(disc["title"]), *[fold(name) for name in disc.get("aliases", [])]]


def apple_id(disc):
    """Catalog id already stored on the disc as source apple:<id>.
    Empty while Apple Music is switched off, so every Apple path stays closed."""
    if not APPLE_MUSIC:
        return ""
    source = str(disc.get("source") or "")
    if not source.startswith("apple:"):
        return ""
    ident = source.split(":", 1)[1].strip()
    return ident if ident.isdigit() else ""


def apple_url(disc):
    ident = apple_id(disc)
    if not ident:
        return ""
    return "https://music.apple.com/us/album/" + ident


SPOTIFY_BUS = "org.mpris.MediaPlayer2.spotify"
ACTIVE = {"source": ""}


def match_disc(artist, album):
    """A recording is on the shelf only when both the album and the artist match.

    An album title alone is not enough. Other music that happens to share a
    title, and anything outside Zazen, Vayu Meditation, Lumikara, and lineage,
    stays outside.
    """
    heard_album = fold(album)
    heard_artist = fold(artist)
    if not heard_album or not heard_artist:
        return None
    hits = []
    for disc in COLLECTION["discs"]:
        names = album_names(disc)
        if heard_album not in names:
            continue
        if not any(key in heard_artist for key in disc.get("artistKeys", [])):
            continue
        # 2012 Vayu and Vayu Meditation share some titles. Each stays on its own disc.
        known_artist = fold(disc.get("artist") or "")
        if known_artist == "vayu" and "meditation" in heard_artist:
            continue
        if "meditation" in known_artist and "meditation" not in heard_artist:
            continue
        hits.append(disc)
    if len(hits) == 1:
        return hits[0]
    return None


def file_matches_track(path, disc):
    """A file matches only when a full track title from this disc is in its name."""
    name = fold(Path(path).stem)
    best = None
    best_len = 0
    for track in disc["tracks"]:
        title = fold(track["title"])
        if len(title) < 3 or title not in name:
            continue
        if len(title) > best_len:
            best = track
            best_len = len(title)
    return best


def disc_from_parts(parts):
    id_hits = []
    title_hits = []
    for part in parts:
        heard = fold(part)
        for disc in COLLECTION["discs"]:
            if heard == fold(disc["id"]):
                id_hits.append(disc["id"])
            elif heard in album_names(disc):
                title_hits.append(disc["id"])
    ids = list(dict.fromkeys(id_hits)) or list(dict.fromkeys(title_hits))
    if len(ids) == 1:
        return DISCS[ids[0]]
    if len(ids) > 1:
        text = fold(" ".join(parts))
        narrowed = [
            disc_id
            for disc_id in ids
            if any(key in text for key in DISCS[disc_id].get("artistKeys", []))
        ]
        if len(narrowed) == 1:
            return DISCS[narrowed[0]]
    return None


def candidate_dirs():
    music = Path.home() / "Music"
    yield INSTALL_ROOT
    for disc in COLLECTION["discs"]:
        yield INSTALL_ROOT / disc["id"]
        yield INSTALL_ROOT / disc["circle"] / disc["id"]
        yield music / disc["artist"] / disc["title"]
        yield music / disc["title"]


def scan_library():
    found = {}
    seen = set()
    for root in candidate_dirs():
        if not root.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            current = Path(dirpath)
            try:
                depth = len(current.relative_to(root).parts)
            except ValueError:
                depth = 99
            dirnames[:] = [name for name in dirnames if not name.startswith(".")]
            if depth >= 2:
                dirnames.clear()
            parts = current.parts
            disc = disc_from_parts(parts)
            if disc is None:
                continue
            for filename in filenames:
                path = current / filename
                if path.suffix.lower() not in AUDIO_EXT:
                    continue
                try:
                    if path.stat().st_size < 4096:
                        continue
                except OSError:
                    continue
                key = str(path.resolve())
                if key in seen:
                    continue
                track = file_matches_track(path, disc)
                if track is None:
                    continue
                seen.add(key)
                found.setdefault(disc["id"], {}).setdefault(track["n"], path)
    return found


def library():
    now = time.monotonic()
    if now - _scan["at"] < 5:
        return _scan["data"]
    data = scan_library()
    _scan["at"] = now
    _scan["data"] = data
    return data


def installed_counts():
    return {disc_id: len(tracks) for disc_id, tracks in library().items()}


CHAKRAS = ("naval", "heart", "eye")
CHAKRA_NAME = {
    "naval": "Navel",
    "heart": "Heart chakra",
    "eye": "Third eye chakra",
}
FORM_SIZES = (3, 6, 9, 12)
PLAYLIST_FILE = ROOT / "playlists.json"
PLAY = {"stop": False, "thread": None}
SERIES = {"lengths": []}
DIRECT = {}
SIT = {"client": False, "form": False, "held": False, "dnd": ""}
SEAT_FILE = Path("/tmp/yantra-seat.json")


def chakra_of(disc, number):
    """First third of a disc is naval, the middle third heart, the last third third eye."""
    count = len(disc["tracks"])
    first = count // 3
    second = (2 * count) // 3
    if number <= first:
        return "naval"
    if number <= second:
        return "heart"
    return "eye"


def track_ref(disc_id, number):
    disc = DISCS[disc_id]
    track = next(item for item in disc["tracks"] if item["n"] == number)
    installed = number in (library().get(disc_id) or {})
    return {
        "discId": disc_id,
        "n": number,
        "title": track["title"],
        "disc": disc["title"],
        "artist": disc["artist"],
        "chakra": chakra_of(disc, number),
        "onSpotify": bool(disc.get("spotifyAlbum")),
        "onApple": bool(apple_id(disc)),
        "installed": installed,
        "playable": bool(disc.get("spotifyAlbum")) or bool(apple_id(disc)) or installed,
    }


def playable_numbers(disc, have=None):
    """Track numbers this desktop can play: the whole disc when it is on Spotify
    or Apple Music, otherwise only the tracks installed from it."""
    if disc.get("spotifyAlbum") or apple_id(disc):
        return {track["n"] for track in disc["tracks"]}
    have = library() if have is None else have
    return set(have.get(disc["id"]) or {})


def shown_discs():
    """Discs on the shelf. One that is on neither catalog stays hidden until a
    track from it is installed."""
    have = library()
    return [disc for disc in COLLECTION["discs"] if playable_numbers(disc, have)]


def chakra_pool(chakra):
    """Random forms draw only from songs that can play."""
    pool = []
    have = library()
    for disc in COLLECTION["discs"]:
        ready = playable_numbers(disc, have)
        for track in disc["tracks"]:
            if track["n"] in ready and chakra_of(disc, track["n"]) == chakra:
                pool.append((disc["id"], track["n"]))
    return pool


def form_tracks(size):
    if size not in FORM_SIZES:
        return None
    per = size // 3
    chosen = []
    for chakra in CHAKRAS:
        pool = chakra_pool(chakra)
        if len(pool) < per:
            return None
        chosen.extend(random.sample(pool, per))
    return [track_ref(disc_id, number) for disc_id, number in chosen]


def shelf_song(item):
    if not isinstance(item, dict):
        return None
    disc = DISCS.get(item.get("discId"))
    number = item.get("n")
    if disc is None or not any(track["n"] == number for track in disc["tracks"]):
        return None
    return disc, number


def ordered_draft(tracks):
    """Navel, then heart, then third eye. A song is kept once."""
    buckets = {name: [] for name in CHAKRAS}
    seen = set()
    for item in tracks or []:
        found = shelf_song(item)
        if not found:
            continue
        disc, number = found
        key = (disc["id"], number)
        if key in seen:
            continue
        seen.add(key)
        buckets[chakra_of(disc, number)].append({"discId": disc["id"], "n": number})
    ordered = []
    for name in CHAKRAS:
        ordered.extend(buckets[name])
    return ordered


def draft_refs(tracks):
    return [track_ref(item["discId"], item["n"]) for item in ordered_draft(tracks)]


def playlist_error(tracks):
    if not isinstance(tracks, list):
        return "A form is 3, 6, 9, or 12 songs."
    seen = set()
    counts = {name: 0 for name in CHAKRAS}
    for item in tracks:
        found = shelf_song(item)
        if not found:
            return "A song in this form is not from the shelf."
        disc, number = found
        key = (disc["id"], number)
        if key in seen:
            return "Each song is used once in a form."
        seen.add(key)
        counts[chakra_of(disc, number)] += 1
    if any(counts[name] > 4 for name in CHAKRAS):
        return "Each chakra holds at most four songs."
    if len(set(counts.values())) != 1:
        return "Navel, heart, and third eye keep the same number of songs."
    if sum(counts.values()) not in FORM_SIZES:
        return "A form is 3, 6, 9, or 12 songs."
    per = sum(counts.values()) // 3
    for index, item in enumerate(ordered_draft(tracks)):
        disc, number = shelf_song(item)
        expected = CHAKRAS[index // per]
        if chakra_of(disc, number) != expected:
            return CHAKRA_NAME[expected] + " keeps the " + ("first", "middle", "last")[index // per] + " third of the form."
    return None


def take_song(tracks, disc_id, number):
    ordered = ordered_draft(tracks)
    disc = DISCS.get(disc_id)
    if disc is None or not any(track["n"] == number for track in disc["tracks"]):
        return None, "That song is not on the shelf."
    is_in = any(item["discId"] == disc["id"] and item["n"] == number for item in ordered)
    if not is_in and number not in playable_numbers(disc):
        return None, "That song is not on Spotify or Apple Music, and it is not installed."
    if is_in:
        ordered = [item for item in ordered if not (item["discId"] == disc["id"] and item["n"] == number)]
        return ordered, None
    chakra = chakra_of(disc, number)
    count = sum(1 for item in ordered if chakra_of(DISCS[item["discId"]], item["n"]) == chakra)
    if count >= 4:
        return None, CHAKRA_NAME[chakra] + " already has four songs."
    ordered.append({"discId": disc["id"], "n": number})
    return ordered_draft(ordered), None


def move_song(tracks, index, direction):
    ordered = ordered_draft(tracks)
    if direction not in (-1, 1) or index < 0 or index >= len(ordered):
        return ordered
    other = index + direction
    if other < 0 or other >= len(ordered):
        return ordered
    here = chakra_of(DISCS[ordered[index]["discId"]], ordered[index]["n"])
    there = chakra_of(DISCS[ordered[other]["discId"]], ordered[other]["n"])
    if here != there:
        return ordered
    ordered[index], ordered[other] = ordered[other], ordered[index]
    return ordered


def swap_song(tracks, index):
    ordered = ordered_draft(tracks)
    if index < 0 or index >= len(ordered):
        return None, "That place is not in the form."
    item = ordered[index]
    chakra = chakra_of(DISCS[item["discId"]], item["n"])
    used = {(row["discId"], row["n"]) for row in ordered}
    pool = [pair for pair in chakra_pool(chakra) if pair not in used]
    if not pool:
        pool = [pair for pair in chakra_pool(chakra) if pair != (item["discId"], item["n"])]
    if pool:
        disc_id, number = random.choice(pool)
        ordered[index] = {"discId": disc_id, "n": number}
    return ordered_draft(ordered), None


def read_playlists():
    if not PLAYLIST_FILE.exists():
        return []
    try:
        data = json.loads(PLAYLIST_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def write_playlists(items):
    PLAYLIST_FILE.write_text(json.dumps(items, indent=2) + "\n")


def public_playlists():
    result = []
    for item in read_playlists():
        tracks = item.get("tracks") or []
        if playlist_error(tracks):
            continue
        result.append(
            {
                "id": item.get("id"),
                "name": item.get("name") or "Untitled",
                "tracks": [track_ref(track["discId"], track["n"]) for track in tracks],
            }
        )
    return result


def collection_payload():
    counts = installed_counts()
    discs = []
    for disc in shown_discs():
        item = dict(disc)
        have = library().get(disc["id"]) or {}
        item["tracks"] = []
        for track in disc["tracks"]:
            row = dict(track)
            row["chakra"] = chakra_of(disc, track["n"])
            row["installed"] = track["n"] in have
            item["tracks"].append(row)
        item["onSpotify"] = bool(disc.get("spotifyAlbum"))
        item["onApple"] = bool(apple_id(disc))
        item["installed"] = counts.get(disc["id"], 0)
        item["installDir"] = str(INSTALL_ROOT / disc["id"])
        discs.append(item)
    payload = dict(COLLECTION)
    payload["discs"] = discs
    payload["installRoot"] = str(INSTALL_ROOT)
    payload["chakras"] = [
        {"id": "naval", "name": "Navel", "third": "first"},
        {"id": "heart", "name": "Heart chakra", "third": "middle"},
        {"id": "eye", "name": "Third eye chakra", "third": "last"},
    ]
    payload["forms"] = list(FORM_SIZES)
    return payload


def audio_loop():
    global _audio
    try:
        sink = subprocess.check_output(["pactl", "get-default-sink"], text=True).strip()
        _audio = subprocess.Popen(
            [
                "parec",
                "-d",
                f"{sink}.monitor",
                "--format=float32le",
                "--rate=22050",
                "--channels=1",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return
    smooth = 0.0
    while True:
        data = _audio.stdout.read(2048 * 4)
        if not data:
            break
        count = len(data) // 4
        if count == 0:
            continue
        samples = struct.unpack(f"<{count}f", data[: count * 4])
        energy = math.sqrt(sum(sample * sample for sample in samples) / count)
        # Meditation tracks are quiet. Lift them enough to breathe, then hold the peaks down.
        target = max(0.0, min(1.0, energy * 14.0))
        smooth = smooth * 0.9 + target * 0.1
        # Outside music stays in the room only if some other program plays it.
        # This sitting does not breathe with it.
        LEVEL["rms"] = smooth if ALLOWED["on"] else 0.0


def list_players():
    try:
        text = subprocess.check_output(["busctl", "--user", "list", "--no-legend"], text=True, timeout=2)
    except (subprocess.SubprocessError, OSError):
        return []
    names = []
    for line in text.splitlines():
        name = line.split(None, 1)[0] if line.strip() else ""
        if name.startswith("org.mpris.MediaPlayer2."):
            names.append(name)
    return names


def bus_get(bus, prop):
    raw = subprocess.check_output(
        [
            "busctl",
            "--user",
            "--json=short",
            "get-property",
            bus,
            "/org/mpris/MediaPlayer2",
            "org.mpris.MediaPlayer2.Player",
            prop,
        ],
        text=True,
        stderr=subprocess.DEVNULL,
        timeout=2,
    )
    return json.loads(raw).get("data")


def bus_call(bus, method, signature=None, argument=None):
    command = [
        "busctl",
        "--user",
        "call",
        bus,
        "/org/mpris/MediaPlayer2",
        "org.mpris.MediaPlayer2.Player",
        method,
    ]
    if signature is not None:
        command.extend([signature, "" if argument is None else str(argument)])
    try:
        return subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (subprocess.SubprocessError, OSError) as exc:
        return subprocess.CompletedProcess(command, 1, "", str(exc))


def bus_shuffle_off(bus):
    try:
        if bus_get(bus, "Shuffle") is not True:
            return
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError, TypeError):
        return
    try:
        subprocess.run(
            [
                "busctl",
                "--user",
                "set-property",
                bus,
                "/org/mpris/MediaPlayer2",
                "org.mpris.MediaPlayer2.Player",
                "Shuffle",
                "b",
                "false",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (subprocess.SubprocessError, OSError):
        return


def mpris(prop):
    return bus_get(SPOTIFY_BUS, prop)


def spotify_pause():
    bus_call(SPOTIFY_BUS, "Pause")


def player_kind(bus):
    lowered = bus.lower()
    if lowered.endswith(".spotify"):
        return "spotify"
    if "sidra" in lowered or "cider" in lowered:
        return "apple"
    if "chromium" in lowered or lowered.endswith(".chrome"):
        return "maybe"
    return ""


def apple_buses():
    return [bus for bus in list_players() if player_kind(bus) == "apple"]


def pause_apple():
    for bus in apple_buses():
        try:
            if bus_get(bus, "PlaybackStatus") == "Playing":
                bus_call(bus, "Pause")
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError, TypeError):
            continue


def mpv_get(prop):
    if not SOCK.exists():
        return None
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(0.3)
    try:
        sock.connect(str(SOCK))
        sock.sendall(json.dumps({"command": ["get_property", prop]}).encode() + b"\n")
        buf = b""
        while b"\n" not in buf:
            chunk = sock.recv(8192)
            if not chunk:
                break
            buf += chunk
    except OSError:
        return None
    finally:
        sock.close()
    for line in buf.split(b"\n"):
        if not line.strip():
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        if "data" in msg or "error" in msg:
            return msg.get("data")
    return None


def mpv_command(command):
    if not SOCK.exists():
        return False
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(0.3)
    try:
        sock.connect(str(SOCK))
        sock.sendall(json.dumps({"command": command}).encode() + b"\n")
        return True
    except OSError:
        return False
    finally:
        sock.close()


def stop_local():
    proc = LOCAL.get("proc")
    LOCAL["proc"] = None
    LOCAL["disc_id"] = ""
    LOCAL["order"] = []
    if MODE["value"] == "local":
        MODE["value"] = ""
    if proc is not None and proc.poll() is None:
        proc.terminate()
    try:
        SOCK.unlink()
    except OSError:
        pass


def read_local():
    proc = LOCAL.get("proc")
    order = LOCAL.get("order") or []
    disc_id = LOCAL.get("disc_id") or ""
    if proc is None or not disc_id or not order:
        return None
    if proc.poll() is not None:
        return None
    if not SOCK.exists():
        return {"starting": True, "disc_id": disc_id}
    if mpv_get("idle-active") is True:
        return None
    index = mpv_get("playlist-pos")
    if not isinstance(index, int) or index < 0 or index >= len(order):
        index = 0
    item = order[index]
    paused = mpv_get("pause") is True
    position = mpv_get("time-pos")
    length = mpv_get("duration")
    return {
        "starting": False,
        "disc_id": disc_id,
        "title": item["title"],
        "track": item["n"],
        "position": float(position) if isinstance(position, (int, float)) else 0,
        "length": float(length) if isinstance(length, (int, float)) else 0,
        "status": "Paused" if paused else "Playing",
    }


def publish_local(state):
    if MODE["value"] == "playlist":
        return
    disc = DISCS.get(state["disc_id"])
    with LOCK:
        if MODE["value"] == "playlist":
            return
        if state.get("starting"):
            NOW.update(
                connected=False,
                status="Playing",
                title=disc["title"] if disc else "",
                artist=disc["artist"] if disc else "",
                album=disc["title"] if disc else "",
                track=0,
                length=0,
                position=0,
                art="",
                discId=state["disc_id"],
                onSamurai=state["disc_id"] == "samurai",
                source="local",
                allowed=True,
                blocked=False,
                blockedTitle="",
                blockedArtist="",
                installed=installed_counts(),
                form="",
                formIndex=0,
                formTotal=0,
                formPlan=[],
                chakra="",
            )
        else:
            NOW.update(
                connected=False,
                status=state["status"],
                title=state["title"],
                artist=disc["artist"] if disc else "",
                album=disc["title"] if disc else "",
                track=state["track"],
                length=state["length"],
                position=state["position"],
                art="",
                discId=state["disc_id"],
                onSamurai=state["disc_id"] == "samurai",
                source="local",
                allowed=state["status"] == "Playing",
                blocked=False,
                blockedTitle="",
                blockedArtist="",
                installed=installed_counts(),
                form="",
                formIndex=0,
                formTotal=0,
                formPlan=[],
                chakra="",
            )
        ALLOWED["on"] = NOW["allowed"]


def spotify_shuffle_off():
    """Keep album playback in track order. Search playback was advancing at random."""
    bus_shuffle_off(SPOTIFY_BUS)


def publish_spotify(meta, status, position):
    publish_player(SPOTIFY_BUS, "spotify", meta, status, position)


# One pending stop for the last song of an album, keyed by album and track.
END_STOP = {"key": "", "timer": None}


def stop_at_album_end(bus, disc, number, length, position):
    """Pause just before the album's last song runs out, so Spotify never
    goes on to the first notes of a song from outside the sitting."""
    last = max((row["n"] for row in disc["tracks"]), default=0)
    remaining = length - position
    if not number or number != last or length <= 0 or remaining > 3:
        return
    key = disc["id"] + ":" + str(number)
    if END_STOP["key"] == key:
        return
    END_STOP["key"] = key
    timer = threading.Timer(max(0.0, remaining - 0.3), lambda: bus_call(bus, "Pause"))
    timer.daemon = True
    END_STOP["timer"] = timer
    timer.start()


def publish_player(bus, source, meta, status, position):
    if MODE["value"] == "playlist":
        return
    bus_shuffle_off(bus)
    counts = installed_counts()

    def field(key, default=""):
        item = meta.get(key) or {}
        if isinstance(item, dict):
            return item.get("data", default)
        return default

    def names(value):
        if isinstance(value, list):
            return " ".join(str(name) for name in value)
        return str(value or "")

    artists = field("xesam:artist", [])
    artist = artists[0] if isinstance(artists, list) and artists else names(artists)
    heard_artists = names(artists) + " " + names(field("xesam:albumArtist", []))
    album = field("xesam:album", "") or ""
    title = field("xesam:title", "") or ""
    length = field("mpris:length", 0) or 0
    playing = status == "Playing"
    disc = match_disc(heard_artists, album)
    blocked = False
    if playing and disc is None and time.monotonic() >= PENDING["until"]:
        bus_call(bus, "Pause")
        blocked = True
    allowed = bool(disc) and playing and not blocked
    if allowed and isinstance(position, (int, float)):
        stop_at_album_end(
            bus, disc, int(field("xesam:trackNumber", 0) or 0), int(length) / 1_000_000, int(position) / 1_000_000
        )
    elif not playing:
        END_STOP["key"] = ""
    with LOCK:
        if MODE["value"] == "playlist":
            return
        NOW.update(
            connected=True,
            status="Paused" if blocked else (status if isinstance(status, str) else "Unknown"),
            title="" if blocked or disc is None else title,
            artist="" if blocked or disc is None else artist,
            album="" if blocked or disc is None else album,
            track=0 if blocked or disc is None else int(field("xesam:trackNumber", 0) or 0),
            length=0 if blocked or disc is None else int(length) / 1_000_000,
            position=0
            if blocked or disc is None
            else (int(position) / 1_000_000 if isinstance(position, (int, float)) else 0),
            art="" if blocked or disc is None else (field("mpris:artUrl", "") or ""),
            discId="" if blocked or disc is None else disc["id"],
            onSamurai=bool(disc and disc["id"] == "samurai" and not blocked),
            source="" if blocked or disc is None else source,
            allowed=allowed,
            blocked=blocked or (NOW["blocked"] and disc is None and not playing),
            blockedTitle=title if blocked else ("" if disc else NOW["blockedTitle"]),
            blockedArtist=artist if blocked else ("" if disc else NOW["blockedArtist"]),
            installed=counts,
            form="",
            formIndex=0,
            formTotal=0,
            formPlan=[],
            chakra="",
        )
        if disc and playing:
            NOW["blocked"] = False
            NOW["blockedTitle"] = ""
            NOW["blockedArtist"] = ""
        ALLOWED["on"] = NOW["allowed"]


def spotify_call(method):
    bus_call(SPOTIFY_BUS, method)


def player_snapshot(bus):
    meta = bus_get(bus, "Metadata")
    status = bus_get(bus, "PlaybackStatus")
    position = bus_get(bus, "Position")
    if not isinstance(meta, dict) or not isinstance(status, str):
        return None

    def field(key, default=""):
        item = meta.get(key) or {}
        if isinstance(item, dict):
            return item.get("data", default)
        return default

    def names(value):
        if isinstance(value, list):
            return " ".join(str(name) for name in value)
        return str(value or "")

    artists = field("xesam:artist", [])
    artist = artists[0] if isinstance(artists, list) and artists else names(artists)
    album = field("xesam:album", "") or ""
    length = field("mpris:length", 0) or 0
    disc = match_disc(names(artists) + " " + names(field("xesam:albumArtist", [])), album)
    return {
        "status": status,
        "title": field("xesam:title", "") or "",
        "artist": artist,
        "album": album,
        "track": int(field("xesam:trackNumber", 0) or 0),
        "length": int(length) / 1_000_000 if isinstance(length, (int, float)) else 0,
        "position": int(position) / 1_000_000 if isinstance(position, (int, float)) else 0,
        "url": field("xesam:url", "") or "",
        "trackid": str(field("mpris:trackid", "") or ""),
        "disc": disc,
    }


def spotify_snapshot():
    return player_snapshot(SPOTIFY_BUS)


def http_bytes(url):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0", "Accept": "text/html,application/json"},
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        return response.read()


def named_row(rows, disc, number):
    """The shelf song, matched by title. A repeated title also has to sit at this number."""
    known = next((row for row in disc["tracks"] if row["n"] == number), None)
    title = fold(known["title"]) if known else ""
    if not title:
        return None
    found = [index for index, row in enumerate(rows) if fold(row.get("title")) == title]
    if not found:
        return None
    if len(found) == 1:
        return rows[found[0]]
    for index in found:
        row = rows[index]
        if row.get("n") == number or index == number - 1:
            return row
    return None


def spotify_album_tracks(album):
    key = ("spotify", album)
    if key in DIRECT:
        return DIRECT[key]
    try:
        text = http_bytes("https://open.spotify.com/embed/album/" + album).decode("utf-8", "replace")
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', text)
        raw = []
        if match:
            entity = json.loads(match.group(1))["props"]["pageProps"]["state"]["data"]["entity"]
            raw = entity.get("trackList") or []
    except (OSError, urllib.error.URLError, json.JSONDecodeError, KeyError, TypeError, ValueError):
        return []
    rows = []
    for item in raw:
        uri = str(item.get("uri") or "")
        if uri.startswith("spotify:track:"):
            rows.append({"title": item.get("title") or "", "uri": uri})
    if rows:
        DIRECT[key] = rows
    return rows


def spotify_track_uri(disc, number):
    album = disc.get("spotifyAlbum") or ""
    if not album:
        return ""
    row = named_row(spotify_album_tracks(album), disc, number)
    return row["uri"] if row else ""


def apple_album_tracks(album):
    key = ("apple", album)
    if key in DIRECT:
        return DIRECT[key]
    url = "https://itunes.apple.com/lookup?id=" + album + "&entity=song&country=us&limit=200"
    try:
        payload = json.loads(http_bytes(url).decode("utf-8", "replace"))
    except (OSError, urllib.error.URLError, json.JSONDecodeError, UnicodeError, ValueError):
        return []
    rows = []
    for item in payload.get("results") or []:
        if item.get("wrapperType") != "track" or item.get("kind") != "song":
            continue
        song = str(item.get("trackId") or "")
        view = str(item.get("trackViewUrl") or "")
        if not song or "music.apple.com" not in view:
            continue
        rows.append(
            {
                "title": item.get("trackName") or "",
                "n": int(item.get("trackNumber") or 0),
                "url": view,
                "id": song,
            }
        )
    if rows:
        DIRECT[key] = rows
    return rows


def apple_track_url(disc, number):
    album = apple_id(disc)
    if not album:
        return ""
    row = named_row(apple_album_tracks(album), disc, number)
    return row["url"] if row else ""


def token_in(snap, token, kind):
    if not snap or not token:
        return False
    ident = (str(snap.get("trackid") or "") + "\n" + str(snap.get("url") or "")).lower()
    token = str(token).lower()
    if kind == "spotify":
        return token in ident
    return ("i=" + token) in ident or ident.rstrip("/").endswith("/" + token)


def slot_open(snap, disc, number, title, token, kind):
    if token_in(snap, token, kind):
        return True
    if not snap or not snap.get("disc") or snap["disc"]["id"] != disc["id"]:
        return False
    heard = int(snap.get("track") or 0)
    if heard == number:
        return True
    if heard:
        return False
    return bool(title) and fold(snap.get("title")) == fold(title)


def wait_direct(bus, disc, number, title, token, kind):
    """Wait until this song itself is current. Never step to another song."""
    started = time.monotonic()
    deadline = started + 12
    while time.monotonic() < deadline and not PLAY["stop"]:
        try:
            snap = player_snapshot(bus)
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError, TypeError):
            time.sleep(0.3)
            continue
        if slot_open(snap, disc, number, title, token, kind):
            if snap.get("status") != "Playing":
                bus_call(bus, "Play")
            bus_shuffle_off(bus)
            return True
        if snap and snap.get("status") == "Playing":
            heard = int(snap.get("track") or 0)
            same = snap.get("disc") and snap["disc"]["id"] == disc["id"]
            other = same and heard not in (0, number)
            if other or time.monotonic() - started > 1.2:
                bus_call(bus, "Pause")
        time.sleep(0.3)
    return False


def hold_spotify_track(disc, number):
    """Open this one song. Earlier songs on the album are not played or skipped."""
    track = next((row for row in disc["tracks"] if row["n"] == number), None)
    uri = spotify_track_uri(disc, number)
    if not track or not uri:
        return False
    token = uri.rsplit(":", 1)[-1]
    pause_apple()
    PENDING["until"] = time.monotonic() + 20
    ACTIVE["source"] = "spotify"
    if not spotify_running() and not launch_spotify(uri):
        return False
    spotify_shuffle_off()
    bus_call(SPOTIFY_BUS, "Pause")
    bus_call(SPOTIFY_BUS, "OpenUri", "s", uri)
    spotify_shuffle_off()
    yank_back()
    return wait_direct(SPOTIFY_BUS, disc, number, track["title"], token, "spotify")


def publish_form(name, index, total, disc, track, status, position, length, source):
    with LOCK:
        NOW.update(
            connected=source in ("spotify", "apple"),
            status=status,
            title=track["title"],
            artist=disc["artist"],
            album=disc["title"],
            track=track["n"],
            length=length,
            position=position,
            art="",
            discId=disc["id"],
            onSamurai=disc["id"] == "samurai",
            source=source,
            allowed=status == "Playing",
            blocked=False,
            blockedTitle="",
            blockedArtist="",
            installed=installed_counts(),
            form=name,
            formIndex=index,
            formTotal=total,
            formPlan=list(SERIES["lengths"]),
            chakra=chakra_of(disc, track["n"]),
        )
        ALLOWED["on"] = NOW["allowed"]


def run_form(name, tracks):
    MODE["value"] = "playlist"
    JUMP["to"] = None
    index = 0
    try:
        while 0 <= index < len(tracks):
            item = tracks[index]
            FORM_POS["index"] = index
            FORM_POS["total"] = len(tracks)
            if PLAY["stop"]:
                break
            disc = DISCS[item["discId"]]
            track = next(row for row in disc["tracks"] if row["n"] == item["n"])
            local = (library().get(disc["id"]) or {}).get(track["n"])
            announce_form(name, tracks, index, "Opening")
            source = pick_source(disc)
            if source == "spotify":
                stop_local()
                pause_apple()
                uri = spotify_track_uri(disc, track["n"])
                token = uri.rsplit(":", 1)[-1] if uri else ""
                if not hold_spotify_track(disc, track["n"]):
                    publish_form(name, index, len(tracks), disc, track, "Stopped", 0, 0, "spotify")
                    break
                while not PLAY["stop"] and JUMP["to"] is None:
                    try:
                        snap = spotify_snapshot()
                    except (subprocess.SubprocessError, json.JSONDecodeError, OSError, TypeError):
                        time.sleep(0.4)
                        continue
                    if not snap:
                        time.sleep(0.4)
                        continue
                    on_track = slot_open(snap, disc, track["n"], track["title"], token, "spotify")
                    if not on_track:
                        spotify_call("Pause")
                        break
                    publish_form(
                        name,
                        index,
                        len(tracks),
                        disc,
                        track,
                        snap["status"],
                        snap["position"],
                        snap["length"],
                        "spotify",
                    )
                    remaining = (snap["length"] or 0) - (snap["position"] or 0)
                    if snap["length"] and remaining <= 0.45:
                        spotify_call("Pause")
                        break
                    spotify_shuffle_off()
                    time.sleep(0.2 if snap["length"] and remaining < 3 else 0.6)
            elif source == "apple":
                stop_local()
                if spotify_running():
                    spotify_pause()
                row = named_row(apple_album_tracks(apple_id(disc)), disc, track["n"])
                token = row["id"] if row else ""
                if not hold_apple_track(disc, track["n"]):
                    publish_form(name, index, len(tracks), disc, track, "Stopped", 0, 0, "apple")
                    break
                while not PLAY["stop"] and JUMP["to"] is None:
                    bus = next(iter(apple_buses()), "")
                    snap = None
                    if bus:
                        try:
                            snap = player_snapshot(bus)
                        except (subprocess.SubprocessError, json.JSONDecodeError, OSError, TypeError):
                            snap = None
                    if not snap or not bus:
                        time.sleep(0.4)
                        continue
                    on_track = slot_open(snap, disc, track["n"], track["title"], token, "apple")
                    if not on_track:
                        bus_call(bus, "Pause")
                        break
                    publish_form(
                        name,
                        index,
                        len(tracks),
                        disc,
                        track,
                        snap["status"],
                        snap["position"],
                        snap["length"],
                        "apple",
                    )
                    remaining = (snap["length"] or 0) - (snap["position"] or 0)
                    if snap["length"] and remaining <= 0.45:
                        bus_call(bus, "Pause")
                        break
                    bus_shuffle_off(bus)
                    time.sleep(0.2 if snap["length"] and remaining < 3 else 0.6)
            elif local:
                if spotify_running():
                    spotify_pause()
                pause_apple()
                stop_local()
                try:
                    SOCK.unlink()
                except OSError:
                    pass
                proc = subprocess.Popen(
                    [
                        "mpv",
                        "--no-video",
                        "--no-terminal",
                        "--force-window=no",
                        "--no-resume-playback",
                        "--start=0",
                        "--input-ipc-server=" + str(SOCK),
                        "--",
                        str(local),
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
                LOCAL["proc"] = proc
                LOCAL["disc_id"] = disc["id"]
                LOCAL["order"] = [{"n": track["n"], "title": track["title"], "path": str(local)}]
                while proc.poll() is None and not PLAY["stop"] and JUMP["to"] is None:
                    state = read_local()
                    position = 0 if not state or state.get("starting") else state["position"]
                    length = 0 if not state or state.get("starting") else state["length"]
                    status = "Playing" if not state or state.get("starting") else state["status"]
                    publish_form(name, index, len(tracks), disc, track, status, position, length, "local")
                    time.sleep(0.5)
                stop_local()
            else:
                publish_form(name, index, len(tracks), disc, track, "Stopped", 0, 0, "")
                break
            if JUMP["to"] is not None:
                index, JUMP["to"] = JUMP["to"], None
            else:
                index += 1
    finally:
        JUMP["to"] = None
        if MODE["value"] == "playlist":
            MODE["value"] = ""
        ALLOWED["on"] = False
        SIT["form"] = False
        refresh_seat()


def move_within(kind):
    """Back, restart or next, from the sitting controls."""
    if kind not in ("back", "restart", "next"):
        return False
    source = ACTIVE.get("source") or ""
    if MODE["value"] == "local":
        if kind == "restart":
            return mpv_command(["seek", 0, "absolute"])
        return mpv_command(["playlist-next" if kind == "next" else "playlist-prev"])
    proc = LOCAL.get("proc")
    if kind == "restart" and proc is not None and proc.poll() is None:
        # A form song playing from your own copy.
        return mpv_command(["seek", 0, "absolute"])
    bus = SPOTIFY_BUS if source == "spotify" else next(iter(apple_buses()), "")
    if MODE["value"] == "playlist" and kind != "restart":
        target = FORM_POS["index"] + (1 if kind == "next" else -1)
        if target >= FORM_POS["total"]:
            return False
        JUMP["to"] = max(0, target)
        return True
    if not bus:
        return False
    if kind == "restart":
        # Seeking far back lands at the start of the song.
        return bus_call(bus, "Seek", "x", -10**12).returncode == 0
    if kind == "back":
        # Previous only restarts a song that is a few seconds in; go back to its start
        # first so Previous then reaches the song before.
        bus_call(bus, "Seek", "x", -10**12)
        time.sleep(0.15)
    return bus_call(bus, "Next" if kind == "next" else "Previous").returncode == 0


def form_lengths(tracks):
    lengths = []
    for item in tracks:
        disc = DISCS.get(item.get("discId"))
        track = None
        if disc:
            track = next((row for row in disc["tracks"] if row["n"] == item.get("n")), None)
        lengths.append(int(track.get("length") or 0) if track else 0)
    return lengths


def direct_problem(tracks):
    """Each catalog song has to resolve to itself. An album open is not a substitute."""
    for item in tracks:
        disc = DISCS.get(item.get("discId"))
        number = item.get("n")
        track = None
        if disc:
            track = next((row for row in disc["tracks"] if row["n"] == number), None)
        if not disc or not track:
            return "A song in this form is not from the shelf."
        source = pick_source(disc)
        if source == "spotify":
            if not spotify_track_uri(disc, number):
                return track["title"] + " did not open as its own song."
        elif source == "apple":
            if not apple_track_url(disc, number):
                return track["title"] + " did not open as its own song."
        elif not (library().get(disc["id"]) or {}).get(number):
            return track["title"] + " is not in the catalog and is not installed yet."
    return None


def pick_source(disc):
    """The listener's chosen catalog when the disc is there, else the other one,
    else the installed copies."""
    order = ("apple", "spotify") if PLAY.get("prefer") == "apple" else ("spotify", "apple")
    for name in order:
        if name == "spotify" and disc.get("spotifyAlbum"):
            return "spotify"
        if name == "apple" and apple_id(disc):
            return "apple"
    return "local"


def announce_form(name, tracks, index, status):
    item = tracks[index]
    disc = DISCS[item["discId"]]
    track = next(row for row in disc["tracks"] if row["n"] == item["n"])
    source = pick_source(disc)
    publish_form(name, index, len(tracks), disc, track, status, 0, int(track.get("length") or 0), source)


def start_form(name, tracks, prefer="spotify"):
    missing = [track_ref(item["discId"], item["n"]) for item in tracks]
    missing = [item for item in missing if not item["playable"]]
    if missing:
        title = missing[0]["title"]
        return title + " is not in the catalog and is not installed yet."
    PLAY["stop"] = True
    thread = PLAY.get("thread")
    if thread is not None and thread.is_alive():
        thread.join(timeout=6)
    if thread is not None and thread.is_alive():
        return "The previous form is still closing."
    PLAY["stop"] = False
    PLAY["prefer"] = "apple" if prefer == "apple" else "spotify"
    problem = direct_problem(tracks)
    if problem:
        return problem
    SERIES["lengths"] = form_lengths(tracks)
    MODE["value"] = "playlist"
    SIT["form"] = True
    refresh_seat()
    announce_form(name, tracks, 0, "Opening")
    PLAY["thread"] = threading.Thread(target=run_form, args=(name, tracks), daemon=True)
    PLAY["thread"].start()
    return None


def blank_now():
    if MODE["value"] == "playlist":
        return
    with LOCK:
        if MODE["value"] == "playlist":
            return
        NOW.update(
            connected=False,
            status="Stopped",
            discId="",
            onSamurai=False,
            source="",
            allowed=False,
            installed=installed_counts(),
            form="",
            formIndex=0,
            formTotal=0,
            formPlan=[],
            chakra="",
        )
        ALLOWED["on"] = False


def apple_page(snap):
    url = str(snap.get("url") or "").lower()
    return "music.apple.com" in url or "itunes.apple.com" in url


def gather_players():
    found = []
    for bus in list_players():
        kind = player_kind(bus)
        if not kind:
            continue
        try:
            snap = player_snapshot(bus)
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError, TypeError):
            continue
        if not snap:
            continue
        source = kind
        if kind == "maybe":
            if apple_page(snap) or (ACTIVE["source"] == "apple" and snap.get("disc")):
                source = "apple"
            else:
                continue
        found.append({"bus": bus, "source": source, "snap": snap})
    return found


def choose_player(found):
    playing = [item for item in found if item["snap"]["status"] == "Playing" and item["snap"]["disc"]]
    if playing:
        preferred = [item for item in playing if item["source"] == ACTIVE["source"]]
        return (preferred or playing)[0]
    if ACTIVE["source"]:
        for item in found:
            if item["source"] == ACTIVE["source"] and item["snap"]["disc"]:
                return item
    for item in found:
        if item["snap"]["disc"]:
            return item
    for item in found:
        if item["snap"]["status"] == "Playing":
            return item
    return found[0] if found else None


def now_loop():
    while True:
        if MODE["value"] == "playlist":
            time.sleep(0.5)
            continue
        if MODE["value"] == "local":
            state = read_local()
            if state is not None:
                if spotify_running():
                    try:
                        if mpris("PlaybackStatus") == "Playing":
                            spotify_pause()
                    except (subprocess.SubprocessError, json.JSONDecodeError, OSError, TypeError):
                        pass
                pause_apple()
                publish_local(state)
                time.sleep(0.8)
                continue
            MODE["value"] = ""
        found = gather_players()
        if not found:
            blank_now()
            time.sleep(1)
            continue
        chosen = choose_player(found)
        for item in found:
            if item is chosen:
                continue
            snap = item["snap"]
            other_playing = (
                chosen
                and chosen["snap"]["status"] == "Playing"
                and chosen["snap"]["disc"]
                and snap["status"] == "Playing"
            )
            outside = snap["status"] == "Playing" and snap["disc"] is None and time.monotonic() >= PENDING["until"]
            if other_playing or outside:
                bus_call(item["bus"], "Pause")
        if not chosen:
            blank_now()
            time.sleep(0.8)
            continue
        try:
            meta = bus_get(chosen["bus"], "Metadata")
            status = bus_get(chosen["bus"], "PlaybackStatus")
            position = bus_get(chosen["bus"], "Position")
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError, TypeError):
            blank_now()
            time.sleep(1)
            continue
        if not isinstance(meta, dict) or not isinstance(status, str):
            blank_now()
            time.sleep(1)
            continue
        publish_player(chosen["bus"], chosen["source"], meta, status, position)
        time.sleep(0.8)


def spotify_running():
    try:
        names = subprocess.check_output(["busctl", "--user", "list", "--no-legend"], text=True, timeout=2)
    except (subprocess.SubprocessError, OSError):
        return False
    return "org.mpris.MediaPlayer2.spotify" in names


def launch_spotify(uri, wait=20.0):
    """Start Spotify with the URI and wait until it answers on D-Bus."""
    if not shutil.which("spotify"):
        return False
    subprocess.Popen(
        ["spotify", "--uri=" + uri],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    deadline = time.monotonic() + wait
    while time.monotonic() < deadline:
        if spotify_running():
            time.sleep(1.5)
            return True
        time.sleep(0.5)
    return False


def open_in_spotify(disc):
    album = disc.get("spotifyAlbum")
    if not album:
        return None
    stop_local()
    pause_apple()
    ACTIVE["source"] = "spotify"
    uri = "spotify:album:" + album
    PENDING["until"] = time.monotonic() + 12
    if not spotify_running() and not launch_spotify(uri):
        return subprocess.CompletedProcess([], 1, "", "Spotify did not start.")
    # Shuffle has to be off before the album opens, or Next walks a mixed queue.
    spotify_shuffle_off()
    result = subprocess.run(
        [
            "busctl",
            "--user",
            "call",
            "org.mpris.MediaPlayer2.spotify",
            "/org/mpris/MediaPlayer2",
            "org.mpris.MediaPlayer2.Player",
            "OpenUri",
            "s",
            uri,
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=5,
    )
    spotify_shuffle_off()
    return result


def sidra_argv():
    if shutil.which("sidra"):
        return ["sidra"]
    home = Path.home() / "Applications"
    for path in (home / "Sidra.AppImage", home / "sidra.AppImage"):
        if path.is_file():
            return [str(path)]
    if not shutil.which("flatpak"):
        return None
    try:
        text = subprocess.check_output(["flatpak", "list", "--app", "--columns=application"], text=True, timeout=5)
    except (subprocess.SubprocessError, OSError):
        return None
    for line in text.splitlines():
        name = line.strip()
        if "sidra" in name.lower() or "cider" in name.lower():
            return ["flatpak", "run", name]
    return None


def launch_apple(url, wait=12.0):
    """Open the album in Sidra when it is installed, otherwise in a browser window."""
    argv = sidra_argv()
    if argv:
        subprocess.Popen(argv, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        deadline = time.monotonic() + wait
        while time.monotonic() < deadline:
            if apple_buses():
                time.sleep(1.0)
                return True
            time.sleep(0.4)
    browser = shutil.which("chromium") or shutil.which("brave")
    if not browser:
        return False
    subprocess.Popen(
        [
            browser,
            "--ozone-platform=wayland",
            "--app=" + url,
            "--new-window",
            "--autoplay-policy=no-user-gesture-required",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return True


def hold_apple_track(disc, number):
    """Open this one song on Apple Music. The album page is not walked."""
    track = next((row for row in disc["tracks"] if row["n"] == number), None)
    url = apple_track_url(disc, number)
    row = named_row(apple_album_tracks(apple_id(disc)), disc, number) if apple_id(disc) else None
    if not track or not url or not row:
        return False
    PENDING["until"] = time.monotonic() + 20
    ACTIVE["source"] = "apple"
    if spotify_running():
        spotify_pause()
    bus = next(iter(apple_buses()), "")
    if not bus:
        return False
    bus_shuffle_off(bus)
    bus_call(bus, "Pause")
    bus_call(bus, "OpenUri", "s", url)
    bus_shuffle_off(bus)
    yank_back()
    return wait_direct(bus, disc, number, track["title"], row["id"], "apple")


def open_in_apple(disc):
    url = apple_url(disc)
    if not url:
        return None
    stop_local()
    if spotify_running():
        spotify_pause()
    PENDING["until"] = time.monotonic() + 20
    ACTIVE["source"] = "apple"
    if not apple_buses() and not launch_apple(url):
        return subprocess.CompletedProcess([], 1, "", "Apple Music did not open.")
    buses = apple_buses()
    if not buses:
        return subprocess.CompletedProcess([], 0, "", "")
    bus = buses[0]
    bus_shuffle_off(bus)
    result = bus_call(bus, "OpenUri", "s", url)
    bus_shuffle_off(bus)
    return result


def in_catalog(disc):
    return bool(disc.get("spotifyAlbum") or apple_id(disc))


def play_local(disc):
    if in_catalog(disc):
        return "in-catalog"
    _scan["at"] = 0.0
    tracks = library().get(disc["id"]) or {}
    order = []
    for track in disc["tracks"]:
        path = tracks.get(track["n"])
        if path is not None:
            order.append({"n": track["n"], "title": track["title"], "path": str(path)})
    if not order:
        return "none"
    stop_local()
    try:
        SOCK.unlink()
    except OSError:
        pass
    proc = subprocess.Popen(
        [
            "mpv",
            "--no-video",
            "--no-terminal",
            "--force-window=no",
            "--input-ipc-server=" + str(SOCK),
            "--",
            *[item["path"] for item in order],
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    LOCAL["proc"] = proc
    LOCAL["disc_id"] = disc["id"]
    LOCAL["order"] = order
    MODE["value"] = "local"
    if spotify_running():
        spotify_pause()
    pause_apple()
    return None


def install_track(disc, filename, data):
    if in_catalog(disc):
        return "This disc is already in the catalog."
    if len(data) < 4096:
        return "That file is too small to be a recording of this track."
    if len(data) > 200 * 1024 * 1024:
        return "That file is too large."
    suffix = Path(filename).suffix.lower()
    if suffix not in AUDIO_EXT:
        return "Use an audio file named with the track title."
    dummy = Path(filename)
    track = file_matches_track(dummy, disc)
    if track is None:
        return "Name the file with the track title from this disc, then install it again."
    folder = INSTALL_ROOT / disc["id"]
    folder.mkdir(parents=True, exist_ok=True)
    safe = track["title"].replace("/", "-").replace("\\", "-")
    dest = folder / f"{int(track['n']):02d} {safe}{suffix}"
    dest.write_bytes(data)
    _scan["at"] = 0.0
    return {"ok": True, "track": track["n"], "title": track["title"], "installed": len(library().get(disc["id"], {}))}


def parse_multipart(content_type, body):
    if "boundary=" not in content_type.lower():
        return {}, []
    boundary = content_type.split("boundary=", 1)[1].split(";", 1)[0].strip().strip('"')
    delim = b"--" + boundary.encode("utf-8", "replace")
    fields = {}
    files = []
    for part in body.split(delim):
        if part in (b"", b"--", b"--\r\n"):
            continue
        if part.startswith(b"\r\n"):
            part = part[2:]
        if part.endswith(b"\r\n"):
            part = part[:-2]
        if part.endswith(b"--"):
            part = part[:-2]
            if part.endswith(b"\r\n"):
                part = part[:-2]
        header, sep, data = part.partition(b"\r\n\r\n")
        if not sep:
            continue
        disposition = ""
        for line in header.decode("utf-8", "replace").split("\r\n"):
            if line.lower().startswith("content-disposition"):
                disposition = line
        name = ""
        filename = ""
        for piece in disposition.split(";"):
            piece = piece.strip()
            if piece.startswith("name="):
                name = piece.split("=", 1)[1].strip().strip('"')
            elif piece.startswith("filename="):
                filename = piece.split("=", 1)[1].strip().strip('"')
        if filename:
            files.append((filename, data))
        elif name:
            fields[name] = data.decode("utf-8", "replace").strip()
    return fields, files


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def json_response(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length") or 0)
        if length > 200 * 1024 * 1024:
            self.send_error(413)
            return
        raw = self.rfile.read(length) if length else b""
        if path == "/playlists":
            try:
                payload = json.loads(raw.decode() or "{}")
            except json.JSONDecodeError:
                self.send_error(400)
                return
            op = payload.get("op")
            if op == "form":
                try:
                    size = int(payload.get("size") or 0)
                except (TypeError, ValueError):
                    size = 0
                tracks = form_tracks(size)
                if tracks is None:
                    self.json_response({"ok": False, "error": "Choose 3, 6, 9, or 12 songs."}, 400)
                    return
                self.json_response({"ok": True, "tracks": tracks})
                return
            if op == "take":
                try:
                    number = int(payload.get("n") or 0)
                except (TypeError, ValueError):
                    number = 0
                tracks, error = take_song(payload.get("tracks") or [], payload.get("discId"), number)
                if error:
                    self.json_response({"ok": False, "error": error}, 400)
                    return
                self.json_response({"ok": True, "tracks": draft_refs(tracks)})
                return
            if op == "swap":
                try:
                    index = int(payload.get("index") or 0)
                except (TypeError, ValueError):
                    index = -1
                tracks, error = swap_song(payload.get("tracks") or [], index)
                if error:
                    self.json_response({"ok": False, "error": error}, 400)
                    return
                self.json_response({"ok": True, "tracks": draft_refs(tracks)})
                return
            if op == "move":
                try:
                    index = int(payload.get("index") or 0)
                    direction = int(payload.get("direction") or 0)
                except (TypeError, ValueError):
                    index, direction = -1, 0
                tracks = move_song(payload.get("tracks") or [], index, direction)
                self.json_response({"ok": True, "tracks": draft_refs(tracks)})
                return
            if op == "save":
                tracks = payload.get("tracks") or []
                error = playlist_error(tracks)
                if error:
                    self.json_response({"ok": False, "error": error}, 400)
                    return
                name = " ".join(str(payload.get("name") or "").split())[:80] or "Untitled"
                items = read_playlists()
                item_id = str(payload.get("id") or "")
                stored = [{"discId": item["discId"], "n": item["n"]} for item in tracks]
                found = False
                for item in items:
                    if item.get("id") == item_id:
                        item["name"] = name
                        item["tracks"] = stored
                        found = True
                        break
                if not found:
                    item_id = uuid.uuid4().hex[:12]
                    items.append({"id": item_id, "name": name, "tracks": stored})
                write_playlists(items)
                self.json_response({"ok": True, "id": item_id, "playlists": public_playlists()})
                return
            if op == "delete":
                item_id = str(payload.get("id") or "")
                write_playlists([item for item in read_playlists() if item.get("id") != item_id])
                self.json_response({"ok": True, "playlists": public_playlists()})
                return
            self.send_error(404)
            return
        if path == "/install":
            fields, files = parse_multipart(self.headers.get("Content-Type") or "", raw)
            disc = DISCS.get(fields.get("id"))
            if disc is None or not files:
                self.send_error(404)
                return
            filename, data = files[0]
            result = install_track(disc, filename, data)
            if isinstance(result, str):
                self.json_response({"ok": False, "error": result}, 403)
                return
            self.json_response(result)
            return
        if path == "/move":
            try:
                payload = json.loads(raw.decode() or "{}")
            except json.JSONDecodeError:
                self.send_error(400)
                return
            self.json_response({"ok": bool(move_within(str(payload.get("move", ""))))})
            return

        if path == "/sit":
            try:
                payload = json.loads(raw.decode() or "{}")
            except json.JSONDecodeError:
                self.send_error(400)
                return
            sitting = bool(payload.get("on"))
            SIT["client"] = sitting
            if not sitting:
                SIT["form"] = False
            refresh_seat()
            self.json_response({"ok": True, "sitting": SIT["held"]})
            return
        if path != "/play":
            self.send_error(404)
            return
        try:
            payload = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            self.send_error(400)
            return
        source = payload.get("source") or "spotify"
        if source == "playlist":
            tracks = payload.get("tracks") or []
            if payload.get("id") and not tracks:
                saved = next((item for item in read_playlists() if item.get("id") == payload.get("id")), None)
                tracks = saved.get("tracks") if saved else []
            error = playlist_error(tracks)
            if error:
                self.json_response({"ok": False, "error": error}, 400)
                return
            name = " ".join(str(payload.get("name") or "").split()) or "Form"
            problem = start_form(name, tracks, payload.get("prefer") or "spotify")
            if problem:
                self.json_response({"ok": False, "error": problem}, 409)
                return
            self.json_response({"ok": True, "source": "playlist"})
            return
        disc = DISCS.get(payload.get("id"))
        if disc is None:
            self.send_error(404)
            return
        if source == "apple":
            if not apple_id(disc):
                self.json_response({"ok": False, "error": "This disc is not on Apple Music."}, 403)
                return
            try:
                result = open_in_apple(disc)
            except (subprocess.SubprocessError, OSError):
                self.json_response({"ok": False, "error": "Apple Music is not answering."}, 502)
                return
            if result is None:
                self.json_response({"ok": False, "error": "This disc is not on Apple Music."}, 403)
                return
            if result.returncode != 0:
                detail = (result.stderr or result.stdout or "Apple Music did not open this disc.").strip()
                self.json_response({"ok": False, "error": detail[:240]}, 502)
                return
            self.json_response({"ok": True, "source": "apple"})
            return
        if source == "local":
            outcome = play_local(disc)
            if outcome == "in-catalog":
                self.json_response({"ok": False, "error": "This disc is already in the catalog."}, 403)
                return
            if outcome == "none":
                self.json_response(
                    {
                        "ok": False,
                        "error": "No installed tracks yet. Name each file with its track title and install it here.",
                    },
                    404,
                )
                return
            self.json_response({"ok": True, "source": "local"})
            return
        if source != "spotify":
            self.send_error(400)
            return
        if not disc.get("spotifyAlbum"):
            self.json_response(
                {
                    "ok": False,
                    "error": "Not on Spotify. Install the tracks here, named with the titles on this disc.",
                },
                403,
            )
            return
        try:
            result = open_in_spotify(disc)
        except (subprocess.SubprocessError, OSError):
            self.json_response({"ok": False, "error": "Spotify is not answering."}, 502)
            return
        if result is None:
            self.json_response({"ok": False, "error": "Not on Spotify."}, 403)
            return
        if result.returncode != 0 and "Spotify did not start" in (result.stderr or ""):
            self.json_response({"ok": False, "error": "Spotify is not installed or would not start."}, 502)
            return
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "Spotify did not open the disc.").strip()
            self.json_response({"ok": False, "error": detail[:240]}, 502)
            return
        self.json_response({"ok": True, "source": "spotify"})

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            body = (ROOT / "index.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path in ("/web/series.js", "/web/field.js", "/web/awakening.js"):
            file = ROOT / "web" / path.rsplit("/", 1)[-1]
            if not file.is_file():
                self.send_error(404)
                return
            body = file.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/collection":
            self.json_response(collection_payload())
            return
        if path == "/playlists":
            self.json_response({"playlists": public_playlists()})
            return
        if path == "/practice":
            disc = DISCS["samurai"]
            body = json.dumps(
                {
                    "id": disc["id"],
                    "title": disc["title"],
                    "artist": disc["artist"],
                    "year": disc["year"],
                    "line": COLLECTION["line"],
                    "tracks": disc["tracks"],
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/now":
            body = json.dumps(NOW).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/audio":
            body = json.dumps(LEVEL).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)


def open_window(url):
    browser = shutil.which("chromium") or shutil.which("brave")
    if not browser:
        print(f"Open this in a browser: {url}", flush=True)
        return None
    return subprocess.Popen(
        [
            browser,
            "--ozone-platform=wayland",
            "--app=" + url,
            "--new-window",
            "--start-fullscreen",
            "--autoplay-policy=no-user-gesture-required",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


SEAT_LUA = r"""
yantra_sit = yantra_sit or {}
local function interrupt(w)
  if w == nil then return false end
  local class = string.lower(tostring(w.class or ""))
  local title = string.lower(tostring(w.title or ""))
  return class == "spotify"
    or string.find(class, "sidra", 1, true) ~= nil
    or string.find(class, "cider", 1, true) ~= nil
    or string.find(title, "apple music", 1, true) ~= nil
    or string.find(title, "music.apple.com", 1, true) ~= nil
end
local function address_of(w)
  return "address:" .. tostring(w.address)
end
local function prop(address, name, value)
  pcall(function()
    hl.dispatch(hl.dsp.window.set_prop({ prop = name, value = value, window = address }))
  end)
end
local function rule(key, match)
  if yantra_sit[key] == nil then
    yantra_sit[key] = hl.window_rule({
      name = "yantra-sit-" .. key,
      match = match,
      focus_on_activate = false,
      no_focus = true,
    })
  end
  yantra_sit[key]:set_enabled(true)
end
"""

SEAT_ON = SEAT_LUA + r"""
rule("spotify", { class = "^Spotify$" })
rule("apple", { class = "(?i)(sidra|cider)" })
rule("appleweb", { title = "(?i)(apple music|music\\.apple\\.com)" })
if yantra_sit_rule ~= nil then
  pcall(function() yantra_sit_rule:set_enabled(false) end)
end
yantra_sit.muted = yantra_sit.muted or {}
for _, w in ipairs(hl.get_windows()) do
  if interrupt(w) then
    local address = address_of(w)
    prop(address, "no_focus", 1)
    prop(address, "focus_on_activate", 0)
    yantra_sit.muted[address] = true
  end
end
local active = hl.get_active_window()
if active ~= nil and active.title == "Yantra" then
  yantra_sit.seat = address_of(active)
end
if yantra_sit.seat ~= nil then
  prop(yantra_sit.seat, "stay_focused", 1)
  pcall(function()
    hl.dispatch(hl.dsp.focus({ window = yantra_sit.seat }))
  end)
end
yantra_sit.held = true
"""

SEAT_OFF = SEAT_LUA + r"""
yantra_sit.held = false
for _, key in ipairs({ "spotify", "apple", "appleweb" }) do
  if yantra_sit[key] ~= nil then
    pcall(function() yantra_sit[key]:set_enabled(false) end)
  end
end
if yantra_sit_rule ~= nil then
  pcall(function() yantra_sit_rule:set_enabled(false) end)
end
if yantra_sit.muted ~= nil then
  for address, _ in pairs(yantra_sit.muted) do
    prop(address, "no_focus", "unset")
    prop(address, "focus_on_activate", "unset")
  end
  yantra_sit.muted = {}
end
if yantra_sit.seat ~= nil then
  prop(yantra_sit.seat, "stay_focused", "unset")
end
"""

SEAT_YANK = SEAT_LUA + r"""
if yantra_sit.held ~= true or yantra_sit.seat == nil then return end
yantra_sit.muted = yantra_sit.muted or {}
prop(yantra_sit.seat, "stay_focused", 1)
for _, w in ipairs(hl.get_windows()) do
  if interrupt(w) then
    local address = address_of(w)
    prop(address, "no_focus", 1)
    prop(address, "focus_on_activate", 0)
    yantra_sit.muted[address] = true
  end
end
local active = hl.get_active_window()
if interrupt(active) then
  pcall(function()
    hl.dispatch(hl.dsp.focus({ window = yantra_sit.seat }))
  end)
end
"""


def hypr_eval(expr):
    try:
        subprocess.run(
            ["hyprctl", "eval", expr],
            check=False,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (subprocess.SubprocessError, OSError):
        return


def notification_call(method, argument=None):
    command = ["qs", "ipc", "--path", "/usr/share/omarchy/shell", "call", "notifications", method]
    if argument is not None:
        command.append(argument)
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=2)
    except (subprocess.SubprocessError, OSError):
        return ""
    return (result.stdout or "").strip().lower()


def remember_seat(dnd):
    try:
        SEAT_FILE.write_text(json.dumps({"dnd": dnd}))
    except OSError:
        return


def forget_seat():
    try:
        SEAT_FILE.unlink()
    except OSError:
        return


def recover_seat():
    """Drop a lock left behind if this process stopped mid-sit."""
    hypr_eval(SEAT_OFF)
    if not SEAT_FILE.exists():
        return
    try:
        data = json.loads(SEAT_FILE.read_text())
    except (OSError, json.JSONDecodeError):
        data = {}
    if str(data.get("dnd") or "") != "on":
        notification_call("setDnd", "off")
    forget_seat()


def refresh_seat():
    want = bool(SIT["client"] or SIT["form"])
    if want and not SIT["held"]:
        state = notification_call("isDnd")
        SIT["dnd"] = state
        remember_seat(state)
        if state != "on":
            notification_call("setDnd", "on")
        notification_call("dismissAll")
        hypr_eval(SEAT_ON)
        SIT["held"] = True
        return
    if not want and SIT["held"]:
        hypr_eval(SEAT_OFF)
        if SIT["dnd"] != "on":
            notification_call("setDnd", "off")
        SIT["dnd"] = ""
        SIT["held"] = False
        forget_seat()


def yank_back():
    if SIT["held"]:
        hypr_eval(SEAT_YANK)


def seat_guard():
    while True:
        if SIT["held"]:
            yank_back()
            notification_call("dismissAll")
        time.sleep(0.35)


def main():
    recover_seat()
    serve_only = "--serve-only" in sys.argv
    threading.Thread(target=audio_loop, daemon=True).start()
    threading.Thread(target=now_loop, daemon=True).start()
    threading.Thread(target=seat_guard, daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{PORT}"
    print(f"Yantra is at {url}", flush=True)
    window = None if serve_only else open_window(url)

    def stop(*_):
        PLAY["stop"] = True
        SIT["client"] = False
        SIT["form"] = False
        refresh_seat()
        stop_local()
        if _audio is not None:
            _audio.terminate()
        if window is not None and window.poll() is None:
            window.terminate()
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    if serve_only:
        thread.join()
        return
    # Chromium often hands the window to an existing process and exits.
    # Stay up until this process is stopped.
    print("The picture is open. Stop it with: kill", os.getpid(), flush=True)
    signal.pause()


if __name__ == "__main__":
    main()
