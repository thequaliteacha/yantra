/* The background field behind the yantra.
   Night stays dark and takes a little of the song's color while a sit is playing.
   A reduced-motion setting holds the field still. */
(function (root) {
  const NIGHT = {
    mid: [12, 8, 22],
    edge: [5, 4, 10],
  };

  function byte(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function brightnessDefault(night) {
    return night ? 80 : 100;
  }

  /* A full-screen iPad redraws the line shadow every frame. Past this the fringe
     costs a frame and does not read as a brighter line. */
  function goldBlur(blur, dpr, shortSide) {
    const ratio = Number(dpr) || 1;
    const side = Number(shortSide) || 0;
    if (ratio >= 2 && side >= 744) return Math.min(blur, 16);
    return blur;
  }

  function stops(options) {
    const source = options || {};
    const reduce = !!source.reduce;
    const breath = reduce ? 0.5 : (Number.isFinite(source.breath) ? source.breath : 0.5);
    const glow = source.glow && source.glow.length === 3 ? source.glow : [214, 164, 72];
    const lean = source.sitting ? 0.1 : 0;
    const base = [22 + breath * 10, 12 + breath * 6, 36 + breath * 8];
    return {
      center: base.map((channel, i) => byte(channel * (1 - lean) + glow[i] * lean * 0.45)),
      mid: NIGHT.mid.slice(),
      edge: NIGHT.edge.slice(),
    };
  }

  const api = {
    NIGHT: NIGHT,
    brightnessDefault: brightnessDefault,
    goldBlur: goldBlur,
    stops: stops,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraField = api;
})(typeof window !== "undefined" ? window : null);
