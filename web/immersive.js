/* When a sit may hide browser and system chrome.
 *
 * Pure: pass a plain state object. Nothing here reads the document.
 *
 *   want               the sit wants the whole screen
 *   pending            a fullscreen request is already in flight
 *   canRequest         this browser exposes a fullscreen method
 *   fullscreenElement  element fullscreen is already active
 *   displayMode        "fullscreen", "standalone", "minimal-ui",
 *                      "window-controls-overlay", or ""
 *   appleMobile        iPhone, iPad, or an iOS Home Screen web app
 *   owned              this sit opened element fullscreen
 *
 * Android and a desktop install that launch in display-mode fullscreen
 * already cover the status and navigation bars. A sit must not stack
 * another fullscreen on that window, and must not exit it afterwards.
 *
 * iPhone and iPad are different. WebKit can report display-mode fullscreen
 * (manifest display_override, or the fullscreen display mode) while the
 * system status bar — time, date, Wi-Fi, battery — stays painted above the
 * page, in Safari and in a Home Screen web app. Those glyphs are system UI.
 * A stylesheet, a black bar, and black-translucent cannot cover them; the
 * bar is chosen so the glyphs stay readable. A sit still requests element
 * fullscreen there, with navigationUI "hide". That is what asks iPadOS to
 * hide the home indicator. The status glyphs remain (WebKit bugs 264220
 * and 272392, both still open). There is no setting: a sit always asks.
 */
(function (root) {
  function appleMobile(nav) {
    const input = nav || {};
    if (input.standalone === true) return true;
    const ua = String(input.userAgent || "");
    const platform = String(input.platform || "");
    const touch = Number(input.maxTouchPoints) || 0;
    if (/iPhone|iPod|iPad/.test(ua)) return true;
    const mac = /Macintosh|Mac OS X/.test(ua) || platform === "MacIntel";
    return !!(mac && touch > 1);
  }

  function options() {
    return { navigationUI: "hide" };
  }

  function shouldRequest(state) {
    const sit = state || {};
    if (!sit.want || sit.pending || sit.fullscreenElement || !sit.canRequest) return false;
    if (sit.displayMode === "fullscreen" && !sit.appleMobile) return false;
    return true;
  }

  function shouldExit(state) {
    const sit = state || {};
    if (sit.want) return false;
    return !!(sit.owned && sit.fullscreenElement);
  }

  const api = {
    appleMobile: appleMobile,
    options: options,
    shouldRequest: shouldRequest,
    shouldExit: shouldExit,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraImmersive = api;
})(typeof window !== "undefined" ? window : null);
