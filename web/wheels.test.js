const assert = require("assert");
const fs = require("fs");
const path = require("path");
const W = require("./wheels.js");
const B = require("./breath.js");

assert.strictEqual(W.WHEELS.naval.petals, 10);
assert.strictEqual(W.WHEELS.heart.petals, 12);
assert.strictEqual(W.WHEELS.eye.petals, 2);
assert.strictEqual(Object.keys(W.WHEELS).length, 3, "the three wheels are the only counts");

const born = W.grow(0, B.BREATH_MS, false);
assert.ok(born.ring < 0.02 && born.lobes === 0, "a wheel starts as a point");
const ring = W.grow(B.BREATH_MS * 0.42, B.BREATH_MS, false);
assert.ok(ring.ring > 0.95, "the ring is open before the breath is half over");
assert.ok(ring.lobes < ring.ring, "lobes follow the ring");
const full = W.grow(B.BREATH_MS, B.BREATH_MS, false);
assert.ok(full.ring === 1 && full.lobes === 1, "one breath finishes the lobes");
const held = W.grow(0, B.BREATH_MS, true);
assert.deepStrictEqual({ ring: held.ring, lobes: held.lobes }, { ring: 1, lobes: 1 }, "reduced motion is the finished wheel");

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(page.includes("YantraWheels.WHEELS"), "the page reads the one petal config");
assert.ok(page.includes("YantraWheels.grow"), "the wheels grow from that breath");
assert.ok(page.includes("--breath: 10s"));
assert.strictEqual(B.BREATH_MS, 10000);

console.log("wheels.test.js ok");
