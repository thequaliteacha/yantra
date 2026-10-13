#!/usr/bin/env python3
"""Make the MusicKit developer token for web/config.json.

Needs an Apple Developer account, a Media ID and a MusicKit key (.p8) from
developer.apple.com > Certificates, Identifiers & Profiles > Keys.

    python3 web/make_apple_token.py --key AuthKey_ABC123.p8 --key-id ABC123 --team-id TEAM123

The token lasts up to about six months and only works from the origin below.
Keep the .p8 file private and out of this repo; the token itself is meant to sit in the page.
Signs with the openssl command line, so no Python packages are needed.
"""

import argparse
import base64
import json
import subprocess
import time

ORIGIN = "https://thequaliteacha.github.io"
SIX_MONTHS = 15777000


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_to_raw(der):
    """openssl writes an ECDSA signature as DER; a JWT wants r and s, 32 bytes each."""
    assert der[0] == 0x30
    i = 2 if der[1] < 0x80 else 3
    parts = []
    for _ in range(2):
        assert der[i] == 0x02
        length = der[i + 1]
        value = der[i + 2 : i + 2 + length].lstrip(b"\x00")
        parts.append(value.rjust(32, b"\x00"))
        i += 2 + length
    return parts[0] + parts[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", required=True, help="path to the AuthKey_*.p8 file")
    ap.add_argument("--key-id", required=True)
    ap.add_argument("--team-id", required=True)
    ap.add_argument("--days", type=int, default=180)
    args = ap.parse_args()
    now = int(time.time())
    header = {"alg": "ES256", "kid": args.key_id, "typ": "JWT"}
    claims = {"iss": args.team_id, "iat": now, "exp": now + min(args.days * 86400, SIX_MONTHS), "origin": [ORIGIN]}
    signing_input = (b64(json.dumps(header, separators=(",", ":")).encode()) + "." +
                     b64(json.dumps(claims, separators=(",", ":")).encode()))
    der = subprocess.run(["openssl", "dgst", "-sha256", "-sign", args.key],
                         input=signing_input.encode(), capture_output=True, check=True).stdout
    print(signing_input + "." + b64(der_to_raw(der)))


if __name__ == "__main__":
    main()
