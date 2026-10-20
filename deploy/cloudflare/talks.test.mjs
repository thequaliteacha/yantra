/* node deploy/cloudflare/talks.test.mjs */
import assert from "assert";
import worker, { downgradeResponse, talk, talkKey } from "./worker.js";

assert.strictEqual(talkKey("/talks/example-meditation.mp3"), "talks/example-meditation.mp3");
assert.strictEqual(talkKey("/talks/rama-live-la/example-live.mp3"), "talks/rama-live-la/example-live.mp3");
assert.strictEqual(talkKey("/talks/example-talk.m4a"), "talks/example-talk.m4a");
assert.strictEqual(talkKey("/talks/Not_Valid.mp3"), "");
assert.strictEqual(talkKey("/talks/../secret.mp3"), "");
assert.strictEqual(talkKey("/web/audio/vayu/01.mp3"), "");
assert.strictEqual(talkKey("/talks/%2e%2e%2fsecret.mp3"), "");

const down = await downgradeResponse({ COOKIE_KEY: "test-secret" });
const issued = down.headers.get("set-cookie").split(";")[0].slice("yantra=".length);
const calls = [];
const env = {
  COOKIE_KEY: "test-secret",
  AUDIO: {
    async get(key, opts) {
      calls.push(key);
      const header = opts && opts.range && opts.range.get ? opts.range.get("range") : "";
      const ranged = Boolean(header);
      return {
        body: ranged ? "ab" : "abcdef",
        size: 6,
        httpEtag: '"tag"',
        range: ranged ? { offset: 0, length: 2 } : undefined,
        writeHttpMetadata() {},
      };
    },
  },
};

const denied = await worker.fetch(new Request("https://yantramedi.app/talks/example-meditation.mp3"), env);
assert.strictEqual(denied.status, 401);
assert.strictEqual(calls.length, 0);
assert.strictEqual(denied.headers.get("location"), null);

const headers = { cookie: "yantra=" + issued };
const ranged = await worker.fetch(new Request("https://yantramedi.app/talks/example-meditation.mp3", {
  headers: Object.assign({ range: "bytes=0-1" }, headers),
}), env);
assert.strictEqual(ranged.status, 206);
assert.strictEqual(ranged.headers.get("content-range"), "bytes 0-1/6");
assert.strictEqual(ranged.headers.get("accept-ranges"), "bytes");
assert.strictEqual(ranged.headers.get("content-type"), "audio/mpeg");
assert.strictEqual(ranged.headers.get("content-length"), "2");
assert.strictEqual(calls[0], "talks/example-meditation.mp3");

const nested = await worker.fetch(new Request("https://yantramedi.app/talks/rama-live-la/example-live.mp3", { headers }), env);
assert.strictEqual(nested.status, 200);
assert.strictEqual(nested.headers.get("content-type"), "audio/mpeg");
assert.ok(calls.includes("talks/rama-live-la/example-live.mp3"));

const whole = await worker.fetch(new Request("https://yantramedi.app/talks/example-talk.m4a", { headers }), env);
assert.strictEqual(whole.status, 200);
assert.strictEqual(whole.headers.get("content-type"), "audio/mp4");
assert.strictEqual(whole.headers.get("accept-ranges"), "bytes");
assert.strictEqual(await whole.text(), "abcdef");

const missing = await worker.fetch(new Request("https://yantramedi.app/talks/nope", { headers }), env);
assert.strictEqual(missing.status, 404);

const posted = await talk(
  new Request("https://yantramedi.app/talks/example-talk.mp3", { method: "POST" }),
  env,
  new URL("https://yantramedi.app/talks/example-talk.mp3"),
);
assert.strictEqual(posted.status, 405);

console.log("talks.test.mjs ok");
