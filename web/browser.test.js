/* node web/browser.test.js */
const assert = require("assert");
const Browser = require("./browser.js");

const KEY = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLmnopqr";
const FRAGMENT = "#link=" + KEY + "&kept=1";
const PAGE = "https://yantramedi.app/web/" + FRAGMENT;

function ua(userAgent, extra) {
  return Object.assign({ userAgent: userAgent, platform: "", maxTouchPoints: 0 }, extra || {});
}

const iphoneSafari = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  { platform: "iPhone", maxTouchPoints: 5 }
);
const iphoneChrome = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.6613.98 Mobile/15E148 Safari/604.1",
  { platform: "iPhone", maxTouchPoints: 5 }
);
const iphoneFirefox = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/129.0 Mobile/15E148 Safari/605.1.15",
  { platform: "iPhone", maxTouchPoints: 5 }
);
const iphoneEdge = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/128.0.2739.42 Mobile/15E148 Safari/604.1",
  { platform: "iPhone", maxTouchPoints: 5 }
);
const iphoneOpera = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 OPiOS/4.5.0.141420 Mobile/15E148 Safari/604.1",
  { platform: "iPhone", maxTouchPoints: 5 }
);
const iphoneGsa = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/300.0.598994205 Mobile/15E148 Safari/604.1",
  { platform: "iPhone", maxTouchPoints: 5 }
);
const iphoneDuck = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15",
  { platform: "iPhone", maxTouchPoints: 5 }
);
const iphoneBrave = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  { platform: "iPhone", maxTouchPoints: 5, brave: { isBrave: function () {} } }
);
const iphoneWebview = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  { platform: "iPhone", maxTouchPoints: 5 }
);
const iphoneInstagram = ua(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 312.0.0.0.0",
  { platform: "iPhone", maxTouchPoints: 5 }
);
const ipadSafari = ua(
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  { platform: "iPad", maxTouchPoints: 5 }
);
const ipadOsSafari = ua(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  { platform: "MacIntel", maxTouchPoints: 5 }
);
const ipadOsChrome = ua(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.6613.98 Safari/604.1",
  { platform: "MacIntel", maxTouchPoints: 5 }
);
const macSafari = ua(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  { platform: "MacIntel", maxTouchPoints: 0 }
);
const macChrome = ua(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  { platform: "MacIntel", maxTouchPoints: 0 }
);
const macFirefox = ua(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0",
  { platform: "MacIntel", maxTouchPoints: 0 }
);
const macBrave = ua(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  { platform: "MacIntel", brave: {} }
);
const android = ua(
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  { platform: "Linux armv8l", maxTouchPoints: 5 }
);
const windows = ua(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
);
const linux = ua(
  "Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0",
  { platform: "Linux x86_64" }
);

assert.strictEqual(Browser.detect(iphoneSafari).safari, true);
assert.strictEqual(Browser.detect(iphoneSafari).ios, true);
assert.strictEqual(Browser.handoff(iphoneSafari, PAGE).hold, false);

[iphoneChrome, iphoneFirefox, iphoneEdge, iphoneOpera, iphoneGsa, iphoneDuck, iphoneBrave, iphoneWebview, iphoneInstagram].forEach((env) => {
  const decision = Browser.handoff(env, PAGE);
  assert.strictEqual(decision.info.safari, false, env.userAgent.slice(0, 80));
  assert.strictEqual(decision.hold, true);
  assert.strictEqual(decision.open, true);
  assert.strictEqual(decision.safariUrl, "x-safari-https://yantramedi.app/web/" + FRAGMENT);
  assert.strictEqual(decision.copyUrl, PAGE);
});

assert.strictEqual(Browser.detect(iphoneBrave).brave, true);
assert.strictEqual(Browser.detect(ipadSafari).ipados, true);
assert.strictEqual(Browser.detect(ipadSafari).safari, true);
assert.strictEqual(Browser.handoff(ipadSafari, PAGE).hold, false);

assert.strictEqual(Browser.detect(ipadOsSafari).ipados, true, "iPadOS reports Macintosh with a touch screen");
assert.strictEqual(Browser.detect(ipadOsSafari).macos, false);
assert.strictEqual(Browser.detect(ipadOsSafari).safari, true);
assert.strictEqual(Browser.deviceName(ipadOsSafari), "iPad");

const ipadOsHold = Browser.handoff(ipadOsChrome, PAGE);
assert.strictEqual(ipadOsHold.info.ipados, true);
assert.strictEqual(ipadOsHold.info.macos, false);
assert.strictEqual(ipadOsHold.hold, true);
assert.strictEqual(ipadOsHold.open, true);
assert.strictEqual(Browser.deviceName(ipadOsChrome), "iPad");

assert.strictEqual(Browser.detect(macSafari).macos, true);
assert.strictEqual(Browser.detect(macSafari).safari, true);
assert.strictEqual(Browser.handoff(macSafari, PAGE).hold, false);
assert.strictEqual(Browser.deviceName(macSafari), "Mac");

[macChrome, macFirefox, macBrave].forEach((env) => {
  const decision = Browser.handoff(env, PAGE);
  assert.strictEqual(decision.hold, true);
  assert.strictEqual(decision.open, false, "macOS has no Open in Safari scheme");
  assert.strictEqual(decision.safariUrl, "");
  assert.strictEqual(decision.copyUrl, PAGE);
});

const home = Browser.handoff(Object.assign({}, iphoneChrome, { standalone: true }), PAGE);
assert.strictEqual(home.hold, false, "the Home Screen app keeps today's import");
const display = Browser.handoff(Object.assign({}, iphoneChrome, { displayMode: "standalone" }), PAGE);
assert.strictEqual(display.info.standalone, true);
assert.strictEqual(display.hold, false);
const fullscreen = Browser.handoff(Object.assign({}, iphoneChrome, { displayMode: "fullscreen" }), PAGE);
assert.strictEqual(fullscreen.info.standalone, true, "fullscreen is the installed app, not a browser tab");
assert.strictEqual(fullscreen.hold, false);

assert.strictEqual(Browser.handoff(android, PAGE).hold, false);
assert.strictEqual(Browser.handoff(windows, PAGE).hold, false);
assert.strictEqual(Browser.handoff(linux, PAGE).hold, false);
assert.strictEqual(Browser.deviceName(android), "Android phone");
assert.strictEqual(Browser.deviceName(ua("Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")), "Android tablet");
assert.strictEqual(Browser.deviceName(windows), "Windows computer");
assert.strictEqual(Browser.deviceName(linux), "Linux computer");
assert.strictEqual(Browser.deviceName(iphoneSafari), "iPhone");
assert.strictEqual(Browser.deviceName(ipadSafari), "iPad");

const withQuery = "https://yantramedi.app/web/?ready=morning" + FRAGMENT;
assert.strictEqual(
  Browser.safariHref(withQuery),
  "x-safari-https://yantramedi.app/web/?ready=morning" + FRAGMENT
);
assert.strictEqual(Browser.safariHref(withQuery).endsWith(FRAGMENT), true, "the fragment is preserved exactly");
assert.strictEqual(Browser.safariHref("http://127.0.0.1:8787/web/#link=abc"), "x-safari-http://127.0.0.1:8787/web/#link=abc");
assert.strictEqual(Browser.safariHref("not a url"), "");

const odd = "https://yantramedi.app/web/#link=" + KEY + "&plus=a+b";
assert.strictEqual(Browser.safariHref(odd), "x-safari-https://yantramedi.app/web/#link=" + KEY + "&plus=a+b");

console.log("browser.test.js ok");
