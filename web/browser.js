/* Which browser opened a practice link.
 *
 * Pure: pass a navigator-like object (userAgent, platform, maxTouchPoints,
 * brave, standalone, displayMode). Nothing here reads the network or the key.
 *
 * Apple includes iPhone, iPod, iPad, iPadOS (Macintosh with a touch screen),
 * and macOS. Safari is the browser that can Add to Home Screen. Other browsers
 * on Apple keep the key out of their own storage until the person asks.
 */
(function (root) {
  /* Tokens that mean this is not Safari, even when the UA also says Safari
     (every iOS browser and Chrome do). In-app webviews are included where
     they identify themselves. */
  const OTHER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|Ddg\/|GSA\/|Instagram|FBAN|FBAV|FB_IAB|Twitter|LinkedInApp|Line\/|MicroMessenger|Snapchat|Pinterest|TikTok|musical_ly|Bytedance|WhatsApp|Slack\/|Chrome\/|Chromium\/|Firefox\/|Edg\/|EdgA\/|OPR\/|Opera Mini|SamsungBrowser|UCBrowser|YaBrowser|QQBrowser/i;

  function detect(input) {
    const nav = input || {};
    const ua = String(nav.userAgent || "");
    const platform = String(nav.platform || "");
    const touch = Number(nav.maxTouchPoints) || 0;
    const macLike = /Macintosh|Mac OS X/.test(ua) || platform === "MacIntel" || platform === "MacPPC";
    const iphone = /iPhone/.test(ua);
    const ipod = /iPod/.test(ua);
    const ipados = (/iPad/.test(ua) || (macLike && touch > 1)) && !iphone && !ipod;
    const ios = iphone || ipod || ipados;
    const macos = macLike && !ios;
    const apple = ios || macos;
    const brave = !!nav.brave;
    const displayMode = String(nav.displayMode || "");
    const standalone = nav.standalone === true || displayMode === "standalone" || displayMode === "fullscreen";
    const other = brave || OTHER.test(ua);
    const safari = apple && /Safari\//.test(ua) && /Version\//.test(ua) && !other;
    return {
      apple: apple,
      ios: ios,
      ipados: ipados,
      macos: macos,
      safari: safari,
      standalone: standalone,
      brave: brave,
    };
  }

  /* A calm name for this device, taken from the UA. An explicit rename wins;
     this is only the default. */
  function deviceName(input) {
    const info = detect(input);
    const ua = String((input && input.userAgent) || "");
    if (info.ipados || /iPad/.test(ua)) return "iPad";
    if (/iPhone/.test(ua)) return "iPhone";
    if (/iPod/.test(ua)) return "iPod";
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
    if (info.macos) return "Mac";
    if (/Windows/.test(ua)) return "Windows computer";
    if (/CrOS/.test(ua)) return "Chromebook";
    if (/Linux|X11/.test(ua)) return "Linux computer";
    return "This device";
  }

  /* iOS 17+ opens Safari without sending the fragment to a server.
     The fragment is copied through unchanged. */
  function safariHref(pageUrl) {
    const raw = String(pageUrl || "").trim();
    const match = /^(https?):\/\/([^/?#]+)([^#]*)(#.*)?$/i.exec(raw);
    if (!match) return "";
    const scheme = match[1].toLowerCase() === "http" ? "x-safari-http" : "x-safari-https";
    const path = match[3] || "/";
    return scheme + "://" + match[2] + path + (match[4] || "");
  }

  /* Hold the key (do not import it) on Apple when this is not Safari and not
     the Home Screen app. iOS and iPadOS can offer Open in Safari. macOS cannot. */
  function handoff(input, pageUrl) {
    const info = detect(input);
    const hold = !!(info.apple && !info.safari && !info.standalone);
    const open = !!(hold && info.ios);
    return {
      hold: hold,
      open: open,
      info: info,
      safariUrl: open ? safariHref(pageUrl) : "",
      copyUrl: hold ? String(pageUrl || "") : "",
    };
  }

  const api = {
    detect: detect,
    deviceName: deviceName,
    safariHref: safariHref,
    handoff: handoff,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraBrowser = api;
})(typeof window !== "undefined" ? window : null);
