/* node deploy/cloudflare/push.test.mjs */
import assert from "assert";
import { encryptPush, b64urlToBytes, bytesToB64url } from "./push.js";

function concat(...parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

async function hkdf(salt, ikm, info, length) {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
const auth = crypto.getRandomValues(new Uint8Array(16));
const message = new TextEncoder().encode('{"title":"Morning","body":"The morning light is here. A few minutes of stillness?"}');
const body = await encryptPush(uaPublic, auth, message);

const salt = body.slice(0, 16);
const rs = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(16);
assert.strictEqual(rs, 4096);
const idlen = body[20];
assert.strictEqual(idlen, 65);
const asPublic = body.slice(21, 21 + idlen);
const cipher = body.slice(21 + idlen);
const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
const ikm = await hkdf(auth, shared, concat(new TextEncoder().encode("WebPush: info\0"), uaPublic, asPublic), 32);
const cek = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
const nonce = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
const key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["decrypt"]);
const padded = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, cipher));
let end = padded.length - 1;
while (end >= 0 && padded[end] === 0) end -= 1;
assert.strictEqual(padded[end], 2);
const plain = new TextDecoder().decode(padded.slice(0, end));
assert.strictEqual(plain, new TextDecoder().decode(message));

const round = bytesToB64url(uaPublic);
assert.deepStrictEqual(b64urlToBytes(round), uaPublic);

console.log("push.test.mjs ok");
