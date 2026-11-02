/* node web/immersive.test.js */
const assert = require("assert");
const Immersive = require("./immersive.js");

function state(extra) {
  return Object.assign({
    want: true,
    pending: false,
    canRequest: true,
    fullscreenElement: false,
    displayMode: "",
    appleMobile: false,
    owned: false,
  }, extra || {});
}

assert.strictEqual(Immersive.options().navigationUI, "hide");
assert.deepStrictEqual(Object.keys(Immersive.options()), ["navigationUI"]);

const iphone = {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
  maxTouchPoints: 5,
};
const ipad = {
  userAgent: "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
  platform: "iPad",
  maxTouchPoints: 5,
};
const ipadosDesktop = {
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15",
  platform: "MacIntel",
  maxTouchPoints: 5,
};
const mac = {
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15",
  platform: "MacIntel",
  maxTouchPoints: 0,
};
const android = {
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36",
  platform: "Linux armv8l",
  maxTouchPoints: 5,
};

assert.strictEqual(Immersive.appleMobile(iphone), true);
assert.strictEqual(Immersive.appleMobile(ipad), true);
assert.strictEqual(Immersive.appleMobile(ipadosDesktop), true, "iPadOS reports a Mac with a touch screen");
assert.strictEqual(Immersive.appleMobile(mac), false);
assert.strictEqual(Immersive.appleMobile(android), false);
assert.strictEqual(Immersive.appleMobile({ standalone: true, userAgent: "", platform: "", maxTouchPoints: 0 }), true);
assert.strictEqual(Immersive.appleMobile({}), false);

assert.strictEqual(Immersive.shouldRequest(state()), true, "a browser tab asks on sit");
assert.strictEqual(Immersive.shouldRequest(state({ displayMode: "standalone" })), true);
assert.strictEqual(Immersive.shouldRequest(state({ displayMode: "minimal-ui" })), true);
assert.strictEqual(Immersive.shouldRequest(state({ displayMode: "window-controls-overlay" })), true);
assert.strictEqual(
  Immersive.shouldRequest(state({ displayMode: "fullscreen" })),
  false,
  "an Android or desktop window that is already fullscreen stays as it is"
);
assert.strictEqual(
  Immersive.shouldRequest(state({ displayMode: "fullscreen", appleMobile: true })),
  true,
  "iPad reports fullscreen while the status bar is still up, so a sit still asks"
);
assert.strictEqual(Immersive.shouldRequest(state({ canRequest: false, appleMobile: true })), false, "iPhone has no element fullscreen");
assert.strictEqual(Immersive.shouldRequest(state({ fullscreenElement: true })), false);
assert.strictEqual(Immersive.shouldRequest(state({ pending: true })), false);
assert.strictEqual(Immersive.shouldRequest(state({ want: false })), false, "opening the page does not ask");

assert.strictEqual(Immersive.shouldExit(state({ want: false, owned: true, fullscreenElement: true })), true);
assert.strictEqual(Immersive.shouldExit(state({ want: true, owned: true, fullscreenElement: true })), false, "a running sit keeps the screen");
assert.strictEqual(Immersive.shouldExit(state({ want: false, owned: false, fullscreenElement: true })), false, "a window we did not open stays fullscreen");
assert.strictEqual(Immersive.shouldExit(state({ want: false, owned: true, fullscreenElement: false })), false);

console.log("immersive.test.js ok");
