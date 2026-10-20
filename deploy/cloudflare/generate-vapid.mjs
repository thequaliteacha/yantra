/* One-time VAPID key pair for Web Push. Prints nothing secret.
   Writes the public key and the private JWK into the directory given as argv. */
import { writeFileSync } from "fs";
import { join } from "path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node generate-vapid.mjs <directory>");
  process.exit(1);
}

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
let bin = "";
for (const byte of raw) bin += String.fromCharCode(byte);
const pub = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
writeFileSync(join(dir, "vapid-public"), pub, { mode: 0o600 });
writeFileSync(join(dir, "vapid-private"), JSON.stringify(jwk), { mode: 0o600 });
console.log(pub);
