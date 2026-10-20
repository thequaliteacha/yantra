/* node web/mix.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const page = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const faceAt = page.indexOf("function mixFace");
const thirdsAt = page.indexOf("function thirdsOf");
assert.ok(faceAt > 0 && thirdsAt > faceAt);
const api = new Function(page.slice(faceAt, thirdsAt) + "\nreturn { mixFace: mixFace, mixStep: mixStep };")();

assert.deepStrictEqual(api.mixFace(false), { label: "Mix It Up", pressed: "false" });
assert.deepStrictEqual(api.mixFace(true), { label: "Back to albums", pressed: "true" });

const chosen = api.mixStep({ mix: false, album: "samurai", held: "" });
assert.deepStrictEqual(chosen, { mix: true, album: "samurai", held: "samurai" });
assert.deepStrictEqual(api.mixFace(chosen.mix).label, "Back to albums");
assert.deepStrictEqual(api.mixStep(chosen), { mix: false, album: "samurai", held: "" });

const fresh = api.mixStep({ mix: false, album: "", held: "" });
assert.deepStrictEqual(fresh, { mix: true, album: "", held: "" });
assert.deepStrictEqual(api.mixStep(fresh), { mix: false, album: "", held: "" });

const cleared = api.mixStep({ mix: true, album: "", held: "india-dream" });
assert.deepStrictEqual(cleared, { mix: false, album: "india-dream", held: "" });
assert.deepStrictEqual(api.mixFace(cleared.mix), { label: "Mix It Up", pressed: "false" });

let state = { mix: false, album: "napa", held: "" };
state = api.mixStep(state);
state = api.mixStep(state);
assert.deepStrictEqual(state, { mix: false, album: "napa", held: "" });

assert.ok(page.includes('id="pick-mix" aria-pressed="false">Mix It Up</button>'));
assert.ok(page.includes('class="quiet" type="button" id="pick-mix"'));
assert.ok(page.includes('#pick-mix[aria-pressed="true"]'));
assert.ok(page.includes("mixButton.textContent = face.label"));
assert.ok(page.includes('mixButton.setAttribute("aria-pressed", face.pressed)'));
assert.ok(page.includes("const next = mixStep({ mix: sitMix, album: pickAlbum, held: albumHeld })"));
assert.ok(page.includes("select.disabled = sitMix"));
assert.ok(page.includes("if (pickAlbum && discs.length && !discs.some((disc) => disc.id === pickAlbum)) pickAlbum = \"\""));
assert.ok(page.includes("z-index: 6"));

console.log("mix.test.js ok");
