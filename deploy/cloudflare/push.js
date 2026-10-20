/* Web Push (RFC 8291 aes128gcm + VAPID) using Web Crypto, so the Worker can send it. */

const encoder = new TextEncoder();

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

function b64urlToBytes(text) {
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const bin = atob(String(text).replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

/* Encrypt for one subscription. uaPublic and asPublic are uncompressed P-256 points. */
export async function encryptPush(uaPublic, authSecret, payload) {
  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, shared, concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);
  const recordSize = 4096;
  const padded = new Uint8Array(recordSize - 16);
  padded.set(payload);
  padded[payload.length] = 2;
  const key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, padded));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, recordSize);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

async function vapidJwt(endpoint, publicKey, privateJwk) {
  const header = bytesToB64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64url(encoder.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "mailto:reminders@yantramedi.app",
  })));
  const key = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(privateJwk),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signed = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(header + "." + body)
  ));
  return header + "." + body + "." + bytesToB64url(signed);
}

/* Returns the push service status, or 0 when the network itself failed. */
export async function sendPush(env, subscription, payload) {
  try {
    const uaPublic = b64urlToBytes(subscription.keys.p256dh);
    const auth = b64urlToBytes(subscription.keys.auth);
    const body = await encryptPush(uaPublic, auth, encoder.encode(JSON.stringify(payload)));
    const jwt = await vapidJwt(subscription.endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        TTL: "10800",
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        Authorization: "vapid t=" + jwt + ", k=" + env.VAPID_PUBLIC_KEY,
        Topic: "yantra-" + (payload.theme || "sit"),
      },
      body,
    });
    return response.status;
  } catch (e) {
    return 0;
  }
}

export { b64urlToBytes, bytesToB64url };
