/* node web/awakening.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const A = require("./awakening.js");
const S = require("./settings.js");

function mem(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

function signed(before, after) {
  let d = after - before;
  d = ((d + Math.PI) % A.TAU + A.TAU) % A.TAU - Math.PI;
  return d;
}

assert.deepStrictEqual(A.levelOf(0), 0);
assert.deepStrictEqual(A.levelOf("off"), 0);
assert.deepStrictEqual(A.levelOf(false), 0);
assert.deepStrictEqual(A.levelOf(undefined), 0);
assert.deepStrictEqual(A.levelOf(1), 1);
assert.deepStrictEqual(A.levelOf("2"), 2);
assert.deepStrictEqual(A.levelOf(3), 3);
assert.deepStrictEqual(A.levelOf(4), 0);

const base = A.outerRate(1, false, 1);
assert.strictEqual(base, A.TAU / A.OUTER_PERIOD, "level 1 is one turn in about thirty seconds");
assert.strictEqual(A.OUTER_PERIOD, 30);
assert.deepStrictEqual(A.SPIN_FACTOR, [0, 1, 2, 3]);
assert.strictEqual(A.INNER_RATIO, 1);
const full = A.outerRate(1, false, 2);
assert.ok(full > 0, "level 2 outer wheel stays clockwise");
assert.strictEqual(full, 2 * base, "level 2 is 2×");
assert.strictEqual(A.outerRate(1, false, 3), 3 * base, "level 3 is 3×");
assert.strictEqual(A.outerRate(1, true, 2), full * A.REDUCE_FACTOR);
assert.ok(A.outerRate(1, true, 2) > 0, "reduced motion slows the outer wheel and does not reverse it");
assert.strictEqual(A.outerRate(0, false, 2), 0);
assert.strictEqual(A.outerRate(2, false, 2), full);
assert.strictEqual(A.outerRate(1, false, 0), 0, "outer off is still");
assert.ok(A.outerRate(1, false, 1) > 0 && A.outerRate(1, false, 1) < full, "level 1 is gentler than level 2");
assert.ok(A.outerRate(1, false, 3) > full, "level 3 is faster than level 2");

const inner = A.innerRate(1, false, 2);
assert.ok(inner < 0, "the inner wheel turns counterclockwise");
assert.strictEqual(inner, -full, "the same level has the same absolute speed");
assert.strictEqual(A.innerRate(1, false, 1), -base);
assert.strictEqual(A.innerRate(1, false, 3), -A.outerRate(1, false, 3));
assert.strictEqual(A.innerRate(1, true, 2), -A.outerRate(1, true, 2));
assert.ok(A.innerRate(1, true, 2) < 0, "reduced motion keeps the inner wheel counterclockwise");
assert.ok(Math.abs(A.innerRate(1, true, 2)) < Math.abs(inner));
assert.strictEqual(A.innerRate(1, false, 0), 0, "inner off is still");
assert.strictEqual(A.innerRate(1, true, 0), 0);
assert.ok(Math.abs(A.innerRate(1, false, 1)) < Math.abs(inner), "level 1 inner is slower");
assert.ok(Math.abs(A.innerRate(1, false, 3)) > Math.abs(inner), "level 3 inner is faster");
[1, 2, 3].forEach((level) => {
  assert.strictEqual(
    Math.abs(A.innerRate(1, false, level)),
    A.outerRate(1, false, level),
    "level " + level + " matches on both wheels"
  );
});

const stepped = A.step({ outer: 0, inner: 0 }, 2, {
  drive: 1, reduce: false, inner: 2, outer: 2, now: 1000, energy: 0.4, lotus: "naval",
});
assert.ok(signed(0, stepped.outer) > 0, "a step of the outer wheel is clockwise");
assert.ok(signed(0, stepped.inner) < 0, "a step of the inner wheel is counterclockwise");
assert.ok(Math.abs(Math.abs(signed(0, stepped.inner)) / signed(0, stepped.outer) - A.INNER_RATIO) < 1e-9);
assert.strictEqual(stepped.wheels.outerSign, 1);
assert.strictEqual(stepped.wheels.innerSign, -1);
assert.strictEqual(stepped.wheels.innerTarget, "petals");
assert.strictEqual(stepped.innerLevel, 2);
assert.strictEqual(stepped.outerLevel, 2);

const gentle = A.step({ outer: 0, inner: 0 }, 2, {
  drive: 1, reduce: false, inner: 1, outer: 1, now: 1000, energy: 1, lotus: "naval",
});
assert.ok(gentle.outerRate > 0 && gentle.outerRate < stepped.outerRate);
assert.ok(gentle.innerRate < 0 && Math.abs(gentle.innerRate) < Math.abs(stepped.innerRate));
const quick = A.step({ outer: 0, inner: 0 }, 2, {
  drive: 1, reduce: false, inner: 3, outer: 3, now: 1000, energy: 1, lotus: "throat",
});
assert.ok(quick.outerRate > stepped.outerRate);
assert.ok(Math.abs(quick.innerRate) > Math.abs(stepped.innerRate));
assert.strictEqual(quick.wheels.innerTarget, "petals");

const slow = A.step({ outer: 0, inner: 0 }, 2, {
  drive: 1, reduce: true, inner: 2, outer: 2, now: 1000, energy: 1, lotus: "eye",
});
assert.ok(slow.outerRate > 0 && slow.outerRate < stepped.outerRate);
assert.ok(slow.innerRate < 0 && Math.abs(slow.innerRate) < Math.abs(stepped.innerRate));
assert.strictEqual(slow.breath.scale, 1, "reduced motion turns the vibration off");
assert.strictEqual(slow.breath.glow, 0);
assert.strictEqual(slow.breath.tremor, 0);
assert.strictEqual(slow.outerBreath.scale, 1);
assert.strictEqual(slow.wheels.innerTarget, "figure");
assert.strictEqual(slow.wheels.outerSign, 1);

const off = A.step({ outer: 0.4, inner: 0.4 }, 1, {
  drive: 1, reduce: false, inner: 0, outer: 0, lotus: "naval",
});
assert.strictEqual(off.outerRate, 0, "off leaves the outer petals still");
assert.strictEqual(off.innerRate, 0);
assert.strictEqual(off.breath.scale, 1);
assert.strictEqual(off.outerBreath.scale, 1);
assert.strictEqual(off.wheels.innerSign, 0);
assert.strictEqual(off.wheels.outerSign, 0);

const onlyInner = A.step({ outer: 0, inner: 0 }, 1, {
  drive: 1, reduce: false, inner: 2, outer: 0, lotus: "heart",
});
assert.strictEqual(onlyInner.outerRate, 0);
assert.ok(onlyInner.innerRate < 0);
assert.strictEqual(onlyInner.wheels.innerTarget, "figure", "Anahata's star is its inner wheel");

assert.deepStrictEqual(A.ORDER, ["root", "sacral", "naval", "heart", "throat", "eye", "crown"]);
A.ORDER.forEach((id) => {
  const on = A.wheels(id, 2, 2);
  const held = A.wheels(id, 0, 0);
  assert.strictEqual(on.outerSign, 1, id);
  assert.strictEqual(on.innerSign, -1, id);
  assert.strictEqual(held.outerSign, 0, id);
  assert.strictEqual(held.innerSign, 0, id);
  assert.strictEqual(on.innerTarget, id === "eye" || id === "heart" ? "figure" : "petals", id);
});
assert.strictEqual(A.wheels({ id: "eye", petals: 2 }, 3, 1).innerTarget, "figure");
assert.strictEqual(A.wheels({ petals: 12 }, 2, 2).innerTarget, "petals");
assert.strictEqual(A.wheels({ petals: 4, rings: 2 }, 2, 2).innerTarget, "petals");
assert.strictEqual(A.wheels({ id: "heart", petals: 12 }, 2, 2).innerTarget, "figure", "Anahata's star is its inner wheel");
assert.strictEqual(
  A.innerPetalAngle(0, 8, { petals: 12, innerTarget: "figure", turn: 0, spin: 2, inner: 1, tremor: 0.01 }),
  -Math.PI / 2,
  "Anahata's inner eight rest while the star turns"
);

const outerStill = A.outerPetalAngle(0, 12, 0, 0, 0);
const outerMoved = A.outerPetalAngle(0, 12, 0, stepped.outer, 0);
assert.ok(signed(outerStill, outerMoved) > 0, "outer petals take the clockwise spin");
assert.strictEqual(A.outerPetalAngle(3, 10, 0.2, 0.4, 1), -Math.PI / 2 + 0.2 + 0.4 + (3 * A.TAU) / 10 + 0.004);

const innerStill = A.innerPetalAngle(1, 8, { petals: 12, innerTarget: "petals", turn: 0, inner: 0, tremor: 0 });
const innerMoved = A.innerPetalAngle(1, 8, { petals: 12, innerTarget: "petals", turn: 0, inner: stepped.inner, tremor: 0 });
assert.ok(signed(innerStill, innerMoved) < 0, "inner petals take the counterclockwise spin");

const eyeStill = A.innerPetalAngle(0, 8, { petals: 2, innerTarget: "figure", turn: 0, spin: 0 });
const eyeMoved = A.innerPetalAngle(0, 8, { petals: 2, innerTarget: "figure", turn: 0, spin: slow.outer });
assert.ok(signed(eyeStill, eyeMoved) > 0, "Ajna's only petal ring keeps the clockwise outer pace");
assert.ok(signed(0, slow.inner) < 0, "Ajna's inner wheel still turns counterclockwise");

assert.strictEqual(A.innerPetalAngle(0, 8, { petals: 2, turn: 1.2 }), -Math.PI / 2, "undrawn wings do not drift the eight");
assert.ok(A.innerPetalAngle(0, 8, { petals: 10, turn: 1 }) < A.innerPetalAngle(0, 8, { petals: 10, turn: 0 }));

const quiet = A.breath(0, 0, 0, false);
assert.strictEqual(quiet.scale, 1);
assert.strictEqual(quiet.glow, 0);
assert.strictEqual(quiet.tremor, 0);
assert.deepStrictEqual(A.breath(500, 1, 2, true), quiet);
assert.deepStrictEqual(A.breath(500, 1, 0, false), quiet);

let prev = A.breath(0, 1, 2, false).scale;
let quietMin = Infinity;
let quietMax = -Infinity;
let loudMin = Infinity;
let loudMax = -Infinity;
let level3Min = Infinity;
let level3Max = -Infinity;
for (let t = 0; t <= 60000; t += 16) {
  const still = A.breath(t, 0, 2, false);
  const loud = A.breath(t, 1, 2, false);
  const fuller = A.breath(t, 1, 3, false);
  assert.ok(Math.abs(still.scale - 1) <= A.BREATH_LO + 1e-12, "quiet level 2 breath stays at the floor");
  assert.ok(Math.abs(loud.scale - 1) <= A.BREATH_HI + 1e-12, "level 2 breath stays inside 1.8 percent");
  assert.ok(Math.abs(fuller.scale - 1) <= A.BREATH_CAP + 1e-12, "level 3 breath stays inside its cap");
  assert.ok(Math.abs(loud.glow) <= 0.06);
  assert.ok(Math.abs(loud.tremor) <= 0.02);
  assert.ok(Math.abs(loud.scale - prev) < 0.002, "one frame does not jump");
  prev = loud.scale;
  quietMin = Math.min(quietMin, still.scale);
  quietMax = Math.max(quietMax, still.scale);
  loudMin = Math.min(loudMin, loud.scale);
  loudMax = Math.max(loudMax, loud.scale);
  level3Min = Math.min(level3Min, fuller.scale);
  level3Max = Math.max(level3Max, fuller.scale);
}
assert.ok(quietMax - quietMin > 0.008, "the breath moves when the music is quiet");
assert.ok(loudMax - loudMin > quietMax - quietMin, "the music widens the breath");
assert.ok(level3Max - level3Min > loudMax - loudMin, "level 3 breathes wider than level 2");
assert.strictEqual(A.innerScale({ scale: 4 }), 1 + A.BREATH_CAP);
assert.strictEqual(A.innerScale({ scale: 0 }), 1 - A.BREATH_CAP);
assert.strictEqual(A.innerScale(null), 1);
assert.strictEqual(A.innerGlow(quiet), 0);

assert.strictEqual(A.advance(0, full, 10), A.advance(0, full, 0.5), "a long gap does not fling the wheel");
assert.ok(A.advance(0, -0.2, 1) > Math.PI);

const store = mem();
assert.strictEqual(S.get("motion.inner", store), 0, "inner petals default to off");
assert.strictEqual(S.get("motion.outer", store), 0, "outer petals default to off");
assert.strictEqual(S.set("motion.inner", 2, store), 2);
assert.strictEqual(S.get("motion.inner", store), 2);
assert.strictEqual(S.set("motion.outer", "3", store), 3);
assert.strictEqual(S.set("motion.outer", "on", store), 0);
assert.strictEqual(S.set("motion.inner", false, store), 0);
assert.strictEqual(S.get("motion.outer", store), 0);
assert.strictEqual(S.get("motion.heart", mem()), "off", "the heart mark defaults to off");
assert.strictEqual(S.set("motion.heart", "triangles", store), "triangles");
assert.strictEqual(S.get("motion.heart", store), "triangles");
assert.strictEqual(S.set("motion.heart", "Pentagram", store), "pentagram");
assert.strictEqual(S.set("motion.heart", "star", store), "off");
assert.strictEqual(S.get("motion.heart", store), "off");
assert.ok(S.SHARED.indexOf("motion.heart") < 0, "the heart mark stays on this device");

const legacy = mem({
  "yantra.settings.v1": JSON.stringify({ "motion.awakening": { value: true, updatedAt: 5 } }),
  "yantra.awakening": "on",
});
S.migrate(legacy);
assert.strictEqual(legacy.getItem("yantra.awakening"), null, "the older key is dropped");
assert.strictEqual(JSON.parse(legacy.getItem(S.KEY))["motion.awakening"], undefined, "the old switch is not kept");
assert.strictEqual(S.get("motion.inner", legacy), 0, "an old on choice becomes off");
assert.strictEqual(S.get("motion.outer", legacy), 0);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(page.includes('src="/web/awakening.js"'));
assert.ok(page.includes('id="motion-inner"'));
assert.ok(page.includes('id="motion-outer"'));
assert.ok(page.includes('id="motion-heart"'));
assert.ok(page.includes(">Triangles<"));
assert.ok(page.includes(">Pentagram<"));
assert.ok(page.includes("Inner petals (counterclockwise)"));
assert.ok(page.includes("Outer petals (clockwise)"));
assert.ok(page.includes("For intermediate and advanced students."));
assert.ok(page.includes("keep gazing with eyes open at the center bindu"));
assert.ok(page.includes('YantraSettings.get("motion." + which)'), "a stored choice is kept");
assert.ok(page.includes('YantraSettings.set("motion." + which, clean)'));
assert.ok(page.includes('YantraSettings.get("motion.heart")'), "the heart mark is read with the other motion settings");
assert.ok(page.includes('YantraSettings.set("motion.heart", clean)'));
assert.ok(page.includes("window.motionHeart"));
assert.ok(page.includes('removeItem("yantra.awakening")'), "the older key is cleared");
assert.strictEqual(page.includes('id="awakening"'), false, "the single on/off switch is gone");
assert.strictEqual(page.includes("motion.awakening"), false, "the page does not read the old switch");
const settingsFold = page.slice(page.indexOf('id="account-settings"'), page.indexOf('id="account-logout"'));
assert.ok(settingsFold.includes('id="motion-inner"'), "inner petals live in Settings");
assert.ok(settingsFold.includes('id="motion-outer"'), "outer petals live in Settings");
assert.ok(settingsFold.includes('id="motion-heart"'), "the heart mark lives in Settings");
assert.ok(settingsFold.includes('data-heart="off"'), "the heart mark defaults to off");
assert.ok(settingsFold.includes("Level 1") && settingsFold.includes("Level 2") && settingsFold.includes("Level 3"));
assert.ok(settingsFold.indexOf('id="motion-inner"') < settingsFold.indexOf("<h3>Spotify</h3>"));
assert.strictEqual(page.includes("glowbar"), false, "it is not on the brightness bar");
assert.strictEqual(page.includes("window.awakeningOn"), false, "the old on flag is gone");
assert.ok(page.includes("YantraAwakening.step"));
assert.ok(page.includes("awake.outerPetalAngle"));
assert.ok(page.includes("awake.innerPetalAngle"));
assert.ok(page.includes("reduce: reduceMotion"));
assert.ok(page.includes("prefers-reduced-motion"));
assert.ok(page.includes('lotus.figure !== "fire"'), "Manipura's triangle is not drawn");
assert.strictEqual(page.includes('figure === "fire"'), false, "the fire triangle stroke is gone");
assert.ok(page.includes('figure === "air" && heart === "triangles"'), "Anahata's triangles stay behind the Triangles choice");
assert.ok(page.includes('heart === "pentagram"'), "a pentagram can take the heart's place");
assert.ok(page.includes('heart === "triangles" || heart === "pentagram"'), "off draws no heart mark");
assert.ok(page.includes("circle(ctx, cx, cy, r * 0.94)"), "Ajna's circle stays");
assert.ok(fs.readFileSync(path.join(__dirname, "../yantra.py"), "utf8").includes('"/web/awakening.js"'));

console.log("awakening.test.js ok");
