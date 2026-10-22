/* node web/field.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const F = require("./field.js");

const naval = [228, 170, 50];
const eye = [108, 96, 200];

const nightSit = F.stops({ sitting: true, breath: 0.5, glow: naval });
assert.deepStrictEqual(nightSit.center, [35, 21, 38]);
assert.deepStrictEqual(nightSit.mid, [12, 8, 22]);
assert.deepStrictEqual(nightSit.edge, [5, 4, 10]);

const nightStill = F.stops({ sitting: false, breath: 0, glow: eye });
assert.deepStrictEqual(nightStill.center, [22, 12, 36], "night at rest does not take the song color");

const heldA = F.stops({ sitting: true, reduce: true, breath: 0, glow: naval });
const heldB = F.stops({ sitting: true, reduce: true, breath: 1, glow: naval });
assert.deepStrictEqual(heldA, heldB, "reduced motion holds the field still");

assert.strictEqual(F.brightnessDefault(true), 80);
assert.strictEqual(F.brightnessDefault(false), 100);

assert.strictEqual(F.goldBlur(30, 2, 834), 16);
assert.strictEqual(F.goldBlur(12, 2, 1024), 12);
assert.strictEqual(F.goldBlur(30, 2, 743), 30);
assert.strictEqual(F.goldBlur(30, 1, 1024), 30);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(page.includes('src="/web/field.js"'));
assert.ok(page.includes("YantraField.stops"));
assert.ok(page.includes("YantraField.goldBlur"));
assert.ok(page.includes("YantraSeries.holdSeries"), "a playback blip still does not restart the figure");
assert.strictEqual(page.includes('id="account-glow"'), false);
assert.strictEqual(page.includes('id="theme"'), false, "there is no light mode toggle");
assert.strictEqual(page.includes("body.light"), false, "there is no light mode");
assert.strictEqual(page.includes("isLight"), false);
assert.ok(page.includes('id="glow" type="range"'), "the brightness slider stays");
assert.ok(page.includes("prefers-reduced-motion"));
assert.ok(page.includes('min="35"'));
assert.ok(page.includes('max="125"'));

console.log("field.test.js ok");
