"""Timed transcripts of the Rama talks, made on this computer (faster-whisper).

    ~/.local/share/talk-stt-venv/bin/python tools/transcribe_talks.py SRC OUT [--model small.en]

SRC holds the talk mp3s under the same keys as R2 (talks/...mp3). Each becomes
OUT/<key>.json: {"v": 1, "segments": [[start, end, text, [[t, word], ...]], ...]}.
Finished talks are skipped, so the run can be stopped and started again.
The transcripts are Zazen-only, like the audio: upload them to the private bucket.
"""
import json
import pathlib
import subprocess
import sys
import time

import numpy as np

from faster_whisper import WhisperModel


def decode(path):
    """16 kHz mono float samples via ffmpeg (PyAV's decoder breaks on this Python)."""
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
        check=True, stdout=subprocess.PIPE,
    ).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def main():
    args = sys.argv[1:]
    model_name = "small.en"
    if "--model" in args:
        i = args.index("--model")
        model_name = args[i + 1]
        del args[i:i + 2]
    src, out = pathlib.Path(args[0]), pathlib.Path(args[1])
    model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=6)
    talks = sorted(src.rglob("*.mp3"))
    for n, mp3 in enumerate(talks, 1):
        key = mp3.relative_to(src)
        dest = out / key.with_suffix(".json")
        if dest.exists():
            continue
        began = time.time()
        segments, info = model.transcribe(
            decode(mp3), language="en", word_timestamps=True, vad_filter=True,
            condition_on_previous_text=False, beam_size=1,
        )
        rows = []
        for seg in segments:
            words = [[round(w.start, 1), w.word.strip()] for w in (seg.words or []) if w.word.strip()]
            rows.append([round(seg.start, 1), round(seg.end, 1), seg.text.strip(), words])
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(".part")
        tmp.write_text(json.dumps({"v": 1, "segments": rows}, separators=(",", ":")))
        tmp.rename(dest)
        took = time.time() - began
        print(f"[{n}/{len(talks)}] {key}  {info.duration/60:.0f} min audio in {took/60:.1f} min", flush=True)


if __name__ == "__main__":
    main()
