/* Petal counts for the three cymatic wheels.
 *
 * Change a count here. The visualizer reads this object and does not
 * keep a second copy. Navel 10, heart 12, third eye 2, while those
 * counts are being checked against the tradition.
 *
 * A wheel grows as a standing wave: a point, then a ring, then petal
 * lobes, over one breath. Reduced motion draws the whole wheel at once.
 */
(function (root) {
  const WHEELS = {
    naval: { id: "naval", petals: 10 },
    heart: { id: "heart", petals: 12 },
    eye: { id: "eye", petals: 2 },
  };

  function ease(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
  }

  /* elapsed is milliseconds since this wheel began. breathMs is the
     shared breath. reduce draws the finished wheel with no travel. */
  function grow(elapsed, breathMs, reduce) {
    if (reduce) return { ring: 1, lobes: 1, phase: 1 };
    const span = breathMs > 0 ? breathMs : 10000;
    const phase = Math.max(0, Math.min(1, (Number(elapsed) || 0) / span));
    return {
      ring: ease(Math.min(1, phase / 0.42)),
      lobes: ease(Math.max(0, (phase - 0.28) / 0.72)),
      phase: phase,
    };
  }

  const api = { WHEELS: WHEELS, grow: grow, ease: ease };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraWheels = api;
})(typeof window !== "undefined" ? window : globalThis);
