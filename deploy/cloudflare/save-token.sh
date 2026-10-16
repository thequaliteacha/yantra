#!/usr/bin/env bash
# Save the Cloudflare API token from the clipboard to ~/.config/yantra-cloudflare.env
# (mode 600), then clear the clipboard. Copy the token first, then run this.
set -euo pipefail
account=3c753d724719c5780ec8377ce5520240
t=$(wl-paste -n | tr -d '[:space:]')
if [ "${#t}" -lt 40 ]; then
  echo "The clipboard doesn't look like a token (${#t} characters). Copy it and try again."
  exit 1
fi
umask 077
printf 'CLOUDFLARE_API_TOKEN=%s\nCLOUDFLARE_ACCOUNT_ID=%s\n' "$t" "$account" > ~/.config/yantra-cloudflare.env
wl-copy --clear
api=https://api.cloudflare.com/client/v4
# User tokens and account tokens verify at different addresses.
if { curl -sS -H "Authorization: Bearer $t" "$api/user/tokens/verify"
     curl -sS -H "Authorization: Bearer $t" "$api/accounts/$account/tokens/verify"; } | grep -q '"status":"active"'; then
  echo "Saved, and Cloudflare says the token is active."
else
  echo "Saved, but Cloudflare did not accept the token. Check it was copied whole."
fi
