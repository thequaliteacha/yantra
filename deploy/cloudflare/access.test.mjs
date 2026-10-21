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
      if (url.pathname === "/web/talks.json") {
        return new Response(JSON.stringify({ sets: [{ id: "rama-live-la", talks: [] }] }), { status: 200, headers: { "content-type": "application/json" } });
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
      if (key === "talks/balance.json") return { body: '{"v":1,"segments":[]}' };
      if (["talks/balance.mp3", "talks/rama-live-la/rama-live-la-02-cosmic-awareness.mp3", "samurai/01.mp3", "india-dream/03.mp3", "awake-in-anza-borrego/02.mp3", "ambient/rain-light.mp3", "ambient/rain-thunder.mp3"].includes(key)) {
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
assert.strictEqual(ramaDenied("sangha", "/ambient/rain-light.mp3"), false);
assert.strictEqual(ramaDenied("zazen", "/ambient/rain-light.mp3"), false);

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
const quoteFile = await zazenQuotes.json();
const quoteRows = Array.isArray(quoteFile) ? quoteFile : quoteFile.quotes;
assert.ok(Array.isArray(quoteRows));
assert.ok(quoteRows.some((row) => row.text.includes("You decide to be happy") && row.href.includes("/free-resource/balance/")));
assert.ok(quoteFile.albums && quoteFile.albums["canyons-of-light"]);

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

// Each talk's timed words follow the same gate as its audio.
gets.length = 0;
const sanghaWords = await route(withCookie("https://yantramedi.app/talks/balance.json", sangha), env);
assert.strictEqual(sanghaWords.status, 403);
assert.deepStrictEqual(gets, []);
const zazenWords = await route(withCookie("https://yantramedi.app/talks/balance.json", zazen), env);
assert.strictEqual(zazenWords.status, 200);
assert.ok(zazenWords.headers.get("content-type").startsWith("application/json"));
assert.deepStrictEqual(await zazenWords.json(), { v: 1, segments: [] });
assert.strictEqual((await route(withCookie("https://yantramedi.app/talks/balance.txt", zazen), env)).status, 404);

const sanghaShelf = await (await route(withCookie("https://yantramedi.app/discs.json", sangha), env)).json();
assert.ok(sanghaShelf.discs.every((disc) => disc.circle === "vayu"));
assert.ok(sanghaShelf.discs.some((disc) => disc.id === "india-dream"));
assert.ok(!sanghaShelf.discs.some((disc) => disc.circle === "lumikara" || disc.circle === "zazen"));
assert.ok(!JSON.stringify(sanghaShelf).includes("Stream of Gems"));

const zazenShelf = await (await route(withCookie("https://yantramedi.app/discs.json", zazen), env)).json();
assert.ok(zazenShelf.discs.some((disc) => disc.circle === "zazen"));
assert.ok(zazenShelf.discs.some((disc) => disc.circle === "vayu"));
assert.ok(zazenShelf.discs.some((disc) => disc.circle === "lineage"));
assert.ok(zazenShelf.discs.some((disc) => disc.circle === "lumikara"), "Lumikara is on the Zazen shelf");
assert.ok(zazenShelf.circles.some((circle) => circle.id === "lumikara"));
for (const id of ["awake-in-anza-borrego", "mandala-of-light-lumikara", "night-vortex-in-shasta"]) {
  assert.ok(zazenShelf.discs.some((disc) => disc.id === id), id + " for the Zazen word");
}
assert.ok(JSON.stringify(zazenShelf).includes("Stream of Gems"));
assert.ok(sanghaShelf.circles.every((circle) => circle.id === "vayu"), "the Sangha word sees only the Vayu circle");

const shown = visibleShelf(discs, "zazen");
assert.ok(shown.discs.some((disc) => disc.id === "samurai"));
assert.strictEqual(shown.discs.length, discs.discs.length, "the Zazen word opens every circle");
const sanghaShown = visibleShelf(discs, "sangha");
assert.ok(sanghaShown.discs.length > 0 && sanghaShown.discs.every((disc) => disc.circle === "vayu"));
assert.ok(visibleShelf(discs, "").discs.every((disc) => disc.circle === "vayu"), "no level falls back to Vayu only");

const sanghaLinks = await (await route(withCookie("https://yantramedi.app/web/tracks.json", sangha), env)).json();
assert.strictEqual(sanghaLinks["awake-in-anza-borrego"], undefined);
assert.strictEqual(sanghaLinks.samurai, undefined);
assert.ok(sanghaLinks["india-dream"]);

const zazenLinks = await (await route(withCookie("https://yantramedi.app/web/tracks.json", zazen), env)).json();
assert.ok(zazenLinks["awake-in-anza-borrego"], "Lumikara links for the Zazen word");
assert.ok(zazenLinks.samurai);
assert.ok(zazenLinks["india-dream"]);

gets.length = 0;
const sanghaLumikara = await route(withCookie("https://yantramedi.app/web/audio/awake-in-anza-borrego/02.mp3", sangha), env);
assert.strictEqual(sanghaLumikara.status, 403, "Lumikara audio is refused to the Sangha word");
assert.ok(!gets.includes("awake-in-anza-borrego/02.mp3"));

const zazenLumikara = await route(withCookie("https://yantramedi.app/web/audio/awake-in-anza-borrego/02.mp3", zazen, { range: "bytes=0-3" }), env);
assert.strictEqual(zazenLumikara.status, 206, "Lumikara audio plays for the Zazen word");
assert.ok(gets.includes("awake-in-anza-borrego/02.mp3"));

gets.length = 0;
const sanghaZazenAudio = await route(withCookie("https://yantramedi.app/web/audio/samurai/01.mp3", sangha), env);
assert.strictEqual(sanghaZazenAudio.status, 403);
assert.ok(!gets.includes("samurai/01.mp3"));
const sanghaVayuAudio = await route(withCookie("https://yantramedi.app/web/audio/india-dream/03.mp3", sangha), env);
assert.strictEqual(sanghaVayuAudio.status, 200, "Vayu audio plays for the Sangha word");

gets.length = 0;
const sanghaTalkList = await route(withCookie("https://yantramedi.app/web/talks.json", sangha), env);
assert.strictEqual(sanghaTalkList.status, 403, "the talk list is refused to the Sangha word");
const sanghaLiveLa = await route(withCookie("https://yantramedi.app/talks/rama-live-la/rama-live-la-02-cosmic-awareness.mp3", sangha), env);
assert.strictEqual(sanghaLiveLa.status, 403);
assert.deepStrictEqual(gets, []);
const zazenTalkList = await route(withCookie("https://yantramedi.app/web/talks.json", zazen), env);
assert.strictEqual(zazenTalkList.status, 200);
const zazenLiveLa = await route(withCookie("https://yantramedi.app/talks/rama-live-la/rama-live-la-02-cosmic-awareness.mp3", zazen), env);
assert.strictEqual(zazenLiveLa.status, 200);

const hosted = await route(withCookie("https://yantramedi.app/web/audio/samurai/01.mp3", zazen, { range: "bytes=0-3" }), env);
assert.strictEqual(hosted.status, 206);
assert.strictEqual(hosted.headers.get("content-type"), "audio/mpeg");
assert.strictEqual(hosted.headers.get("content-range"), "bytes 0-3/11");
assert.ok(gets.includes("samurai/01.mp3"));

gets.length = 0;
const sanghaRain = await route(withCookie("https://yantramedi.app/ambient/rain-light.mp3", sangha), env);
assert.strictEqual(sanghaRain.status, 200);
assert.strictEqual(sanghaRain.headers.get("content-type"), "audio/mpeg");
assert.ok(gets.includes("ambient/rain-light.mp3"));
const zazenRain = await route(withCookie("https://yantramedi.app/ambient/rain-thunder.mp3", zazen), env);
assert.strictEqual(zazenRain.status, 200);
const rainPost = await route(new Request("https://yantramedi.app/ambient/rain-light.mp3", {
  method: "POST",
  headers: { cookie: "yantra=" + sangha },
}), env);
assert.strictEqual(rainPost.status, 405);
gets.length = 0;
const slipped = await route(new Request("https://yantramedi.app/ambient/%2e%2e%2Ftalks%2Fbalance.mp3", { headers: { cookie: "yantra=" + sangha } }), env);
assert.strictEqual(slipped.status, 404);
assert.deepStrictEqual(gets, []);
const oddName = await route(withCookie("https://yantramedi.app/ambient/Rain.mp3", sangha), env);
assert.strictEqual(oddName.status, 404);

const access = await (await route(withCookie("https://yantramedi.app/access", sangha), env)).json();
assert.strictEqual(access.level, "sangha");
const accessZazen = await (await route(withCookie("https://yantramedi.app/access", zazen), env)).json();
assert.strictEqual(accessZazen.level, "zazen");

console.log("access.test.mjs ok");
