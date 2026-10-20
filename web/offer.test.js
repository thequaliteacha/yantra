/* node web/offer.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const O = require("./offer.js");

assert.strictEqual(O.classify(403, "", "User not registered in the Developer Dashboard"), "unlisted");
assert.strictEqual(O.classify(403, "", "Check settings on developer.spotify.com, the user is not registered"), "unlisted");
assert.strictEqual(O.classify(403, "PREMIUM_REQUIRED", "Player command failed: Premium required"), "premium");
assert.strictEqual(O.classify(403, "", ""), "unlisted");
assert.strictEqual(O.classify(0, "", "This account does not have Spotify Premium"), "premium");
assert.strictEqual(O.classify(404, "", "Device not found"), "failed");
assert.strictEqual(O.classify(401, "", ""), "failed");

const unlisted = O.line({ reason: "unlisted", playing: "Canyons of Light", albums: [{ id: "canyons-of-light" }] });
assert.ok(unlisted.includes("listener list"));
assert.ok(unlisted.includes("Canyons of Light is playing."));

const offline = O.line({
  reason: "offline",
  asked: "Awake in Anza Borrego",
  playing: "Canyons of Light",
  albums: [{ id: "canyons-of-light" }],
});
assert.ok(offline.includes("Awake in Anza Borrego"));
assert.ok(offline.includes("isn't connected"));
assert.ok(offline.includes("Canyons of Light is playing."));

const premium = O.line({ reason: "premium", playing: "Canyons of Light", albums: [{ id: "a" }] });
assert.ok(premium.includes("Premium"));

const waiting = O.line({ reason: "sdk", playing: "", albums: [{ id: "a" }] });
assert.ok(waiting.includes("Choose a hosted album to begin."));
assert.ok(waiting.includes("isn't ready"));

const none = O.line({ reason: "failed", asked: "Awake in Anza Borrego", playing: "", albums: [] });
assert.ok(none.includes("didn't start"));
assert.ok(none.includes("isn't available"));

const discs = [
  { id: "hosted", title: "Hosted", circle: "zazen" },
  { id: "short", title: "Short", circle: "zazen" },
  { id: "spotify-only", title: "Awake in Anza Borrego", circle: "lumikara" },
];
const list = O.hostedAlbums(discs, 3, (disc) => disc.id !== "spotify-only", (disc) => disc.id === "hosted");
assert.deepStrictEqual(list, [{ id: "hosted", title: "Hosted", circle: "zazen" }]);
const allHosted = O.hostedAlbums(discs, 0, (disc) => disc.id !== "spotify-only", () => false);
assert.strictEqual(allHosted.length, 2);

const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert.ok(web.includes("const ok = await started"));
assert.ok(web.includes("yantraMusicOffer"));
assert.ok(web.includes("noteUnlisted"));
assert.strictEqual(web.includes("The music did not start here"), false);
assert.ok(page.includes("offer.js"));
assert.ok(fs.readFileSync(path.join(__dirname, "sw.js"), "utf8").includes("yantra-v5"));

console.log("offer.test.js ok");
