/* node web/offline.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { test } = require("node:test");
const O = require("./offline.js");
const SW = require("./sw.js");

function memoryCache() {
  const map = new Map();
  return {
    async put(url, response) { map.set(String(url), response); },
    async match(url) {
      const hit = map.get(String(url));
      return hit ? hit.clone() : undefined;
    },
    async delete(url) { return map.delete(String(url)); },
    async keys() { return [...map.keys()].map((url) => ({ url: url })); },
  };
}

const origin = "https://yantramedi.app";
const two = {
  "occult-dancer": { "1": "occult-dancer/01.mp3", "2": "occult-dancer/02.mp3" },
  samurai: { "1": "samurai/01.mp3" },
};

assert.deepStrictEqual(O.albumPaths(two, "occult-dancer"), ["occult-dancer/01.mp3", "occult-dancer/02.mp3"]);
assert.deepStrictEqual(O.albumPaths({ bad: { "1": "../secret.mp3", "2": "bad/02.mp3" } }, "bad"), ["bad/02.mp3"]);
assert.strictEqual(O.audioUrl("samurai/01.mp3", origin), "https://yantramedi.app/web/audio/samurai/01.mp3");
assert.strictEqual(O.formatBytes(500), "500 B");
assert.strictEqual(O.formatBytes(2048), "2 KB");
assert.strictEqual(O.formatBytes(5.5 * 1024 * 1024), "5.5 MB");

assert.deepStrictEqual(
  O.keptAlbumIds(two, [O.audioUrl("occult-dancer/01.mp3", origin)], origin),
  [],
);
assert.deepStrictEqual(
  O.keptAlbumIds(two, [
    O.audioUrl("occult-dancer/01.mp3", origin),
    O.audioUrl("occult-dancer/02.mp3", origin),
  ], origin),
  ["occult-dancer"],
);

assert.strictEqual(O.packView({ have: 0, total: 6, bytes: 0 }, false).action, "Keep offline");
assert.strictEqual(O.packView({ have: 0, total: 6, bytes: 0 }, false).detail, "");
const partial = O.packView({ have: 2, total: 6, bytes: 3 * 1024 * 1024 }, false);
assert.strictEqual(partial.action, "Keep offline");
assert.strictEqual(partial.secondary, "Remove");
assert.ok(partial.detail.includes("2 of 6"));
assert.ok(partial.detail.includes("MB"));
const busy = O.packView({ busy: true, have: 2, total: 6, bytes: 1024 * 1024 }, false);
assert.strictEqual(busy.action, "Stop");
assert.strictEqual(busy.meter, 33);
assert.ok(busy.detail.startsWith("Keeping 2 of 6"));
const kept = O.packView({ complete: true, have: 6, total: 6, bytes: 12 * 1024 * 1024 }, true);
assert.strictEqual(kept.action, "Remove");
assert.ok(kept.detail.startsWith("On this device"));
assert.strictEqual(kept.meter, null);
const offlineEmpty = O.packView({ have: 0, total: 6 }, true);
assert.strictEqual(offlineEmpty.action, "");
assert.strictEqual(offlineEmpty.detail, "Connect to keep this album");
const failed = O.packView({ error: true, have: 1, total: 6, bytes: 1000 }, false);
assert.strictEqual(failed.action, "Try again");
assert.strictEqual(failed.secondary, "Remove");

assert.strictEqual(SW.SHELL, "yantra-v7");
assert.strictEqual(SW.AUDIO, O.AUDIO);
assert.notStrictEqual(SW.SHELL, SW.AUDIO);
assert.strictEqual(SW.retainCache("yantra-v7"), true);
assert.strictEqual(SW.retainCache("yantra-audio-v1"), true);
assert.strictEqual(SW.retainCache("yantra-v6"), false);
for (const file of ["/web/", "/web/index.html", "/index.html", "/discs.json", "/access", "/web/audio.json", "/web/config.json", "/web/sets.json", "/web/awakening.js", "/web/field.js", "/web/choose.js", "/web/sit.js", "/web/settings.js", "/web/practice.js", "/web/listening.js", "/web/offline.js", "/web/icons/icon-192.png"]) {
  assert.ok(SW.SHELL_FILES.includes(file), file);
}
assert.ok(!SW.SHELL_FILES.includes("/web/sw.js"));
assert.ok(!SW.SHELL_FILES.includes("/web/quotes.json"));
assert.ok(!SW.SHELL_FILES.includes("/web/talks.json"));

assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/web/audio/samurai/01.mp3")), "audio");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/web/audio.json")), "shell");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/access")), "shell");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/discs.json")), "shell");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/web/playback.js")), "shell");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/web/sw.js")), "skip");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/web/talks.json")), "skip");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/web/quotes.json")), "skip");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/talks/balance.mp3")), "skip");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/ambient/rain-light.mp3")), "skip");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/logout")), "skip");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/api/practice")), "skip");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/push")), "skip");
assert.strictEqual(SW.routeKind(new URL("https://yantramedi.app/web/audio/samurai/01.mp3"), "POST"), "skip");

const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
assert.strictEqual(SW.sliceBody(bytes, "").status, 200);
assert.strictEqual(SW.sliceBody(bytes, "").body.byteLength, 8);
const middle = SW.sliceBody(bytes, "bytes=2-4");
assert.strictEqual(middle.status, 206);
assert.deepStrictEqual(Array.from(middle.body), [2, 3, 4]);
assert.deepStrictEqual(Array.from(SW.sliceBody(bytes, "bytes=6-").body), [6, 7]);
assert.deepStrictEqual(Array.from(SW.sliceBody(bytes, "bytes=-2").body), [6, 7]);
assert.strictEqual(SW.sliceBody(bytes, "bytes=20-30").status, 416);
assert.strictEqual(SW.sliceBody(bytes, "bytes=0-1,2-3").status, 416);

const swText = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
assert.ok(swText.includes('"/talks.json"'));
assert.ok(swText.includes('url.pathname.startsWith("/ambient")'));
assert.ok(swText.includes('pathname === "/logout"'));
assert.ok(swText.includes("yantra-audio-v1"));
assert.ok(!swText.includes("cache.put(request, copy)"));

const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const loader = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(web.includes("cachedAlbums"));
assert.ok(web.includes("offline: offlineNow()"));
assert.ok(fs.readFileSync(path.join(__dirname, "offline.js"), "utf8").includes("Keep offline"));
assert.ok(web.includes('scope: "/"'));
assert.ok(web.includes("For a flight"));
assert.ok(loader.includes('src="offline.js"'));
assert.ok(loader.indexOf('src="offline.js"') < loader.indexOf('src="web.js"'));
assert.ok(page.includes("paintOfflineAlbum"));
assert.ok(fs.readFileSync(path.join(__dirname, "account.js"), "utf8").includes("clearKept"));

test("stores a complete album and skips it the next time", async () => {
  const cache = memoryCache();
  let fetches = 0;
  const fetchImpl = async (url, init) => {
    fetches += 1;
    assert.strictEqual(init.method, "GET");
    assert.ok(!init.headers || !init.headers.Range);
    assert.ok(String(url).startsWith(origin + "/web/audio/"));
    return new Response(new Uint8Array([9, 8, 7, 6]), { status: 200, headers: { "content-type": "audio/mpeg" } });
  };
  const progress = [];
  const stored = await O.storeAlbum("occult-dancer", two, {
    origin: origin,
    cache: cache,
    fetch: fetchImpl,
    onProgress: (row) => progress.push(row.done),
  });
  assert.strictEqual(stored.complete, true);
  assert.strictEqual(fetches, 2);
  assert.deepStrictEqual(progress, [1, 2]);
  const found = await O.inventory(two, { origin: origin, cache: cache });
  assert.deepStrictEqual(found.cachedAlbumIds, ["occult-dancer"]);
  assert.strictEqual(found.albums["occult-dancer"].bytes, 8);
  assert.strictEqual(found.albums.samurai.complete, false);
  fetches = 0;
  await O.storeAlbum("occult-dancer", two, { origin: origin, cache: cache, fetch: fetchImpl });
  assert.strictEqual(fetches, 0, "a complete copy is not downloaded again");
  await O.removeAlbum("occult-dancer", two, { origin: origin, cache: cache });
  const gone = await O.inventory(two, { origin: origin, cache: cache });
  assert.deepStrictEqual(gone.cachedAlbumIds, []);
});

test("a ranged response is not kept", async () => {
  const cache = memoryCache();
  await assert.rejects(
    () => O.storeAlbum("samurai", two, {
      origin: origin,
      cache: cache,
      fetch: async () => new Response(new Uint8Array([1, 2]), {
        status: 206,
        headers: { "content-type": "audio/mpeg", "content-range": "bytes 0-1/8" },
      }),
    }),
    (err) => err.name === "Incomplete",
  );
  assert.strictEqual((await cache.keys()).length, 0);
});
