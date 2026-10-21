/* node web/field.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const F = require("./field.js");

const naval = [228, 170, 50];
const eye = [108, 96, 200];

const nightSit = F.stops({ light: false, sitting: true, breath: 0.5, glow: naval });
assert.deepStrictEqual(nightSit.center, [35, 21, 38]);
assert.deepStrictEqual(nightSit.mid, [12, 8, 22]);
assert.deepStrictEqual(nightSit.edge, [5, 4, 10]);

const nightStill = F.stops({ light: false, sitting: false, breath: 0, glow: eye });
assert.deepStrictEqual(nightStill.center, [22, 12, 36], "night at rest does not take the song color");

const dayNaval = F.stops({ light: true, sitting: true, breath: 0.5, glow: naval });
const dayEye = F.stops({ light: true, sitting: true, breath: 0.5, glow: eye });
const dayRest = F.stops({ light: true, sitting: false, breath: 0.5, glow: naval });
[dayNaval, dayEye, dayRest].forEach((row) => {
  [row.center, row.mid, row.edge].forEach((rgb) => {
    rgb.forEach((channel) => {
      assert.ok(channel >= 190 && channel <= 255, "day stays a soft light color, got " + channel);
    });
  });
});
assert.deepStrictEqual(dayNaval.edge, F.PAPER.edge);
assert.deepStrictEqual(dayEye.edge, dayNaval.edge, "the day edge stays paper while the center shifts");
assert.ok(dayNaval.center.some((channel, i) => Math.abs(channel - dayEye.center[i]) >= 8), "two songs read as different washes");
assert.ok(dayNaval.center.some((channel, i) => Math.abs(channel - dayRest.center[i]) >= 4), "a sit warms the center more than the rest");
assert.ok(dayNaval.mid.some((channel, i) => Math.abs(channel - dayEye.mid[i]) >= 8), "the open field carries the song wash");
[dayNaval, dayEye].forEach((row) => {
  row.center.concat(row.mid).forEach((channel, i) => {
    const edge = row.edge[i % 3];
    assert.ok(Math.abs(channel - edge) < 50, "the day wash stays low contrast");
  });
});

const heldA = F.stops({ light: true, sitting: true, reduce: true, breath: 0, glow: naval });
const heldB = F.stops({ light: true, sitting: true, reduce: true, breath: 1, glow: eye });
assert.deepStrictEqual(heldA, heldB, "reduced motion holds the day field still");
assert.deepStrictEqual(heldA.edge, F.PAPER.edge);

assert.strictEqual(F.brightnessDefault(true, true), 90);
assert.strictEqual(F.brightnessDefault(true, false), 90);
assert.strictEqual(F.brightnessDefault(false, true), 80);
assert.strictEqual(F.brightnessDefault(false, false), 100);

assert.strictEqual(F.goldBlur(30, 2, 834), 16);
assert.strictEqual(F.goldBlur(12, 2, 1024), 12);
assert.strictEqual(F.goldBlur(30, 2, 743), 30);
assert.strictEqual(F.goldBlur(30, 1, 1024), 30);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(page.includes('src="/web/field.js"'));
assert.ok(page.includes("YantraField.stops"));
assert.ok(page.includes("YantraField.goldBlur"));
assert.ok(page.includes("YantraSeries.holdSeries"), "a playback blip still does not restart the figure");
assert.ok(page.includes('id="account-glow"'));
assert.ok(page.includes('id="glow-level"'));
assert.ok(page.includes('id="glow-theme"'));
assert.ok(page.includes("prefers-reduced-motion"));
assert.ok(page.includes('min="35"'));
assert.ok(page.includes('max="125"'));

console.log("field.test.js ok");
