/* node deploy/cloudflare/access.test.mjs */
import assert from "assert";
import { readFileSync } from "fs";
import { mintCookie, ramaDenied, route, visibleShelf } from "./worker.js";

const discsText = readFileSync(new URL("../../discs.json", import.meta.url), "utf8");
const quotesText = readFileSync(new URL("../../web/quotes.json", import.meta.url), "utf8");
const discs = JSON.parse(discsText);
const links = {
  "awake-in-anza-borrego": { "2": { spotify: "https://open.spotify.com/track/0Ky6ZKrevXPFJH2iZZBjC7" } },
  samurai: { "1": { spotify: "https://open.spotify.com/track/hosted" } },
  "india-dream": { "3": { spotify: "https://open.spotify.com/track/0RI5N9YrgI8HdDUrPTRTlO" } },
};

const gets = [];
function audioObject(request) {
  const range = request.headers.has("range") ? { offset: 0, length: 4 } : undefined;
  return {
    body: "mpeg-bytes",
    size: 11,
    httpEtag: '"etag"',
    writeHttpMetadata() {},
    range,
  };
}

const env = {
  COOKIE_KEY: "test-cookie-key",
  SANGHA_WORD: "sangha-word",
  ZAZEN_WORD: "zazen-word",
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/discs.json") {
        return new Response(discsText, { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/web/quotes.json") {
        return new Response(quotesText, { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/web/tracks.json" || url.pathname === "/web/audio.json") {
        return new Response(JSON.stringify(links), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("missing", { status: 404 });
    },
  },
  AUDIO: {
    async get(key, options) {
      gets.push(key);
      if (key === "talks/balance.mp3" || key === "samurai/01.mp3" || key === "india-dream/03.mp3") {
        return audioObject(options.range ? { headers: options.range } : { headers: new Headers() });
      }
      return null;
    },
  },
};

function withCookie(url, cookie, headers) {
  return new Request(url, { headers: Object.assign({ cookie: "yantra=" + cookie }, headers || {}) });
}

const sangha = await mintCookie(env, "sangha");
const zazen = await mintCookie(env, "zazen");

assert.strictEqual(ramaDenied("sangha", "/web/quotes.json"), true);
assert.strictEqual(ramaDenied("sangha", "/talks/balance.mp3"), true);
assert.strictEqual(ramaDenied("zazen", "/web/quotes.json"), false);
assert.strictEqual(ramaDenied("zazen", "/talks/balance.mp3"), false);

const anon = await route(new Request("https://yantramedi.app/web/quotes.json"), env);
assert.strictEqual(anon.status, 401);

const sanghaQuotes = await route(withCookie("https://yantramedi.app/web/quotes.json", sangha), env);
assert.strictEqual(sanghaQuotes.status, 403);
const sanghaBody = await sanghaQuotes.text();
assert.ok(!sanghaBody.includes("You decide to be happy"));
assert.ok(!sanghaBody.includes("ramameditationsociety.org"));

const zazenQuotes = await route(withCookie("https://yantramedi.app/web/quotes.json", zazen), env);
assert.strictEqual(zazenQuotes.status, 200);
assert.strictEqual(zazenQuotes.headers.get("cache-control"), "private, no-store");
const quoteRows = await zazenQuotes.json();
assert.ok(quoteRows.some((row) => row.text.includes("You decide to be happy") && row.href.includes("/free-resource/balance/")));

gets.length = 0;
const sanghaTalk = await route(withCookie("https://yantramedi.app/talks/balance.mp3", sangha), env);
assert.strictEqual(sanghaTalk.status, 403);
assert.deepStrictEqual(gets, []);

const zazenTalk = await route(withCookie("https://yantramedi.app/talks/balance.mp3", zazen, { range: "bytes=0-3" }), env);
assert.strictEqual(zazenTalk.status, 206);
assert.strictEqual(zazenTalk.headers.get("content-type"), "audio/mpeg");
assert.strictEqual(zazenTalk.headers.get("accept-ranges"), "bytes");
assert.strictEqual(zazenTalk.headers.get("content-range"), "bytes 0-3/11");
assert.ok(gets.includes("talks/balance.mp3"));

const sanghaShelf = await (await route(withCookie("https://yantramedi.app/discs.json", sangha), env)).json();
assert.ok(sanghaShelf.discs.every((disc) => disc.circle === "vayu"));
assert.ok(sanghaShelf.discs.some((disc) => disc.id === "india-dream"));
assert.ok(!sanghaShelf.discs.some((disc) => disc.circle === "lumikara" || disc.circle === "zazen"));
assert.ok(!JSON.stringify(sanghaShelf).includes("Stream of Gems"));

const zazenShelf = await (await route(withCookie("https://yantramedi.app/discs.json", zazen), env)).json();
assert.ok(zazenShelf.discs.some((disc) => disc.circle === "zazen"));
assert.ok(zazenShelf.discs.some((disc) => disc.circle === "vayu"));
assert.ok(zazenShelf.discs.some((disc) => disc.circle === "lineage"));
assert.ok(!zazenShelf.discs.some((disc) => disc.circle === "lumikara"));
assert.ok(zazenShelf.circles.every((circle) => circle.id !== "lumikara"));
assert.ok(!zazenShelf.discs.some((disc) => disc.id === "awake-in-anza-borrego"));

const shown = visibleShelf(discs, "zazen");
assert.ok(shown.discs.some((disc) => disc.id === "samurai"));
assert.strictEqual(shown.discs.some((disc) => disc.circle === "lumikara"), false);

const sanghaLinks = await (await route(withCookie("https://yantramedi.app/web/tracks.json", sangha), env)).json();
assert.strictEqual(sanghaLinks["awake-in-anza-borrego"], undefined);
assert.strictEqual(sanghaLinks.samurai, undefined);
assert.ok(sanghaLinks["india-dream"]);

const zazenLinks = await (await route(withCookie("https://yantramedi.app/web/tracks.json", zazen), env)).json();
assert.strictEqual(zazenLinks["awake-in-anza-borrego"], undefined);
assert.ok(zazenLinks.samurai);
assert.ok(zazenLinks["india-dream"]);

gets.length = 0;
const hiddenAlbum = await route(withCookie("https://yantramedi.app/web/audio/awake-in-anza-borrego/02.mp3", zazen), env);
assert.strictEqual(hiddenAlbum.status, 404);
assert.ok(!gets.includes("awake-in-anza-borrego/02.mp3"));

const sanghaZazenAudio = await route(withCookie("https://yantramedi.app/web/audio/samurai/01.mp3", sangha), env);
assert.strictEqual(sanghaZazenAudio.status, 404);
assert.ok(!gets.includes("samurai/01.mp3"));

const hosted = await route(withCookie("https://yantramedi.app/web/audio/samurai/01.mp3", zazen, { range: "bytes=0-3" }), env);
assert.strictEqual(hosted.status, 206);
assert.strictEqual(hosted.headers.get("content-type"), "audio/mpeg");
assert.strictEqual(hosted.headers.get("content-range"), "bytes 0-3/11");
assert.ok(gets.includes("samurai/01.mp3"));

const access = await (await route(withCookie("https://yantramedi.app/access", sangha), env)).json();
assert.strictEqual(access.level, "sangha");
const accessZazen = await (await route(withCookie("https://yantramedi.app/access", zazen), env)).json();
assert.strictEqual(accessZazen.level, "zazen");

console.log("access.test.mjs ok");
