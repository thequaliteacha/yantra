/* The background field behind the yantra.
   Night stays dark and takes a little of the song's color while a sit is playing.
   Cream stays on warm eggshell and takes a soft wash of that same color.
   A reduced-motion setting holds either field still. */
(function (root) {
  // Eggshell cream, golden at the edges.
  const PAPER = {
    mid: [238, 226, 202],
    edge: [229, 214, 190],
  };
  const NIGHT = {
    mid: [12, 8, 22],
    edge: [5, 4, 10],
  };
  const WASH = [255, 244, 230];

  function byte(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function mix(from, to, amount) {
    const t = Math.max(0, Math.min(1, amount || 0));
    return from.map((channel, i) => byte(channel * (1 - t) + to[i] * t));
  }

  /* The song color, pulled toward warm white so day stays pastel. */
  function pastel(glow) {
    const source = glow && glow.length === 3 ? glow : [214, 164, 72];
    return mix(source, WASH, 0.62);
  }

  function brightnessDefault(light, night) {
    if (light) return 90;
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
    const sitting = !!source.sitting;
    if (source.light) {
      const paper = [247 - breath * 8, 239 - breath * 7, 221 - breath * 6];
      const wash = pastel(glow);
      const lean = reduce ? 0 : (sitting ? 0.34 : 0.12);
      const midLean = reduce ? 0 : (sitting ? 0.28 : 0.08);
      return {
        center: mix(paper, wash, lean),
        mid: mix(PAPER.mid, wash, midLean),
        edge: PAPER.edge.slice(),
      };
    }
    const lean = sitting ? 0.1 : 0;
    const base = [22 + breath * 10, 12 + breath * 6, 36 + breath * 8];
    return {
      center: base.map((channel, i) => byte(channel * (1 - lean) + glow[i] * lean * 0.45)),
      mid: NIGHT.mid.slice(),
      edge: NIGHT.edge.slice(),
    };
  }

  const api = {
    PAPER: PAPER,
    NIGHT: NIGHT,
    pastel: pastel,
    brightnessDefault: brightnessDefault,
    goldBlur: goldBlur,
    stops: stops,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraField = api;
})(typeof window !== "undefined" ? window : null);
