/* node web/nobells.test.js — the app rings no bells: not at a sit, not during a talk. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const loader = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert.strictEqual(fs.existsSync(path.join(__dirname, "bell.js")), false, "the bell engine is gone");
assert.strictEqual(loader.includes("bell.js"), false);
assert.strictEqual(/YantraBell|beginSit|pick-bell/.test(page), false, "nothing on the page starts or offers a bell");
fs.readdirSync(__dirname).filter((f) => f.endsWith(".js") && !f.endsWith(".test.js")).forEach((f) => {
  assert.strictEqual(fs.readFileSync(path.join(__dirname, f), "utf8").includes("YantraBell"), false, f + " calls no bell");
});
// Leaving a talk pauses it, as ending a sit stops the music.
assert.ok(page.includes("if (view && !view.audio.paused) view.audio.pause();"));
console.log("nobells.test.js ok");
