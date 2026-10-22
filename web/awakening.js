/* Awakening motion for the yantra's wheels.
   Canvas angles grow clockwise, because y points down. The outer lotus already
   turns that way, and this module does not change its direction or its pace.
   The inner wheel turns counterclockwise, at half that pace: one calm turn
   while the outer wheel makes two.

   The shapes run from root to crown. This page draws the navel, the heart, and
   the third eye. Ajna is the single ring: its two wings are left undrawn, so
   the eight-petal lotus is the outer wheel and keeps the clockwise pace. The
   downward triangle turns counterclockwise in its place. A circle has no
   corners, so the mind's circle does not appear to turn; it shares the inner
   breath instead. Anahata keeps its twelve petals as the outer wheel, and its
   six-pointed star is the inner wheel, so the inner eight rest. Every other
   chakra has an outer lotus and the inner eight, and the eight is the inner
   wheel. */
(function (root) {
  const TAU = Math.PI * 2;
  // One clockwise turn of the outer wheel at full quiver, in seconds.
  const OUTER_PERIOD = 30;
  // Counterclockwise, and slower: an octave under the outer wheel.
  const INNER_RATIO = 0.5;
  // prefers-reduced-motion slows both wheels. It does not reverse them.
  const REDUCE_FACTOR = 0.25;
  // Radial breath stays inside 1.2% to 1.8%, widening a little with the music.
  const BREATH_LO = 0.012;
  const BREATH_HI = 0.018;
  const ORDER = ["root", "sacral", "naval", "heart", "throat", "eye", "crown"];
  const SHAPES = {
    root: { petals: 4, rings: 2 },
    sacral: { petals: 6, rings: 2 },
    naval: { petals: 10, rings: 2 },
    heart: { petals: 12, rings: 2, figureWheel: true },
    throat: { petals: 16, rings: 2 },
    eye: { petals: 2, rings: 1 },
    crown: { petals: 1000, rings: 2 },
  };

  function clamp01(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }

  function shapeOf(lotus) {
    if (!lotus) return null;
    if (typeof lotus === "string") return SHAPES[lotus] || null;
    if (lotus.id && SHAPES[lotus.id]) return SHAPES[lotus.id];
    return lotus;
  }

  /* Positive is clockwise, the outer wheel's existing direction. */
  function outerRate(drive, reduce) {
    return clamp01(drive) * (TAU / OUTER_PERIOD) * (reduce ? REDUCE_FACTOR : 1);
  }

  /* Negative is counterclockwise. Off when awakening motion is switched off. */
  function innerRate(drive, reduce, enabled) {
    if (!enabled) return 0;
    return -INNER_RATIO * outerRate(drive, reduce);
  }

  function wrap(angle) {
    const x = Number(angle);
    if (!Number.isFinite(x)) return 0;
    return ((x % TAU) + TAU) % TAU;
  }

  function advance(angle, rate, dt) {
    let step = Number(dt);
    if (!Number.isFinite(step) || step <= 0) return wrap(angle);
    // A hidden tab must not fling the wheel when the next frame arrives.
    if (step > 0.5) step = 0.5;
    const speed = Number(rate);
    if (!Number.isFinite(speed)) return wrap(angle);
    return wrap((Number(angle) || 0) + speed * step);
  }

  function wheels(lotus, enabled) {
    const shape = shapeOf(lotus);
    const petals = Number(shape && shape.petals);
    const oneRing = !!shape && (shape.rings === 1 || petals === 2);
    return {
      outerSign: 1,
      innerSign: enabled && shape ? -1 : 0,
      innerTarget: oneRing || (shape && shape.figureWheel) ? "figure" : "petals",
    };
  }

  /* Two slow sines that do not share a period, so the breath never ticks.
     The music only widens it, from the quiet floor toward the top of the range.
     Reduced motion, and a switched-off awakening, leave the figure still. */
  function breath(now, energy, enabled, reduce) {
    if (!enabled || reduce) return { scale: 1, glow: 0, tremor: 0 };
    const t = Number(now) || 0;
    const e = clamp01(energy);
    const amp = BREATH_LO + (BREATH_HI - BREATH_LO) * e;
    const wave = Math.sin(t * 0.00052) * 0.62 + Math.sin(t * 0.00031 + 1.7) * 0.38;
    return {
      scale: 1 + amp * wave,
      glow: 0.04 * wave * (0.45 + 0.55 * e),
      tremor: 0.01 * Math.sin(t * 0.00041 + 0.6) * (0.35 + 0.65 * e),
    };
  }

  function innerScale(pulse) {
    const scale = pulse && Number(pulse.scale);
    if (!Number.isFinite(scale)) return 1;
    return Math.max(1 - BREATH_HI, Math.min(1 + BREATH_HI, scale));
  }

  function innerGlow(pulse) {
    const glow = pulse && Number(pulse.glow);
    if (!Number.isFinite(glow)) return 0;
    return Math.max(-0.06, Math.min(0.06, glow));
  }

  /* The outer lotus, unchanged: clockwise drift, clockwise waking spin, quiver. */
  function outerPetalAngle(index, count, turn, spin, quiverA) {
    const n = count > 0 ? count : 1;
    return -Math.PI / 2 + (Number(turn) || 0) + (Number(spin) || 0) + (index * TAU) / n + 0.004 * (Number(quiverA) || 0);
  }

  /* The inner eight. A single ring (Ajna) is the outer wheel, so it takes the
     clockwise spin. Where the figure is the inner wheel (Anahata) the eight only
     drift. Two rings otherwise turn the eight counterclockwise. */
  function innerPetalAngle(index, count, options) {
    const opt = options || {};
    const n = count > 0 ? count : 8;
    const base = -Math.PI / 2 + (index * TAU) / n;
    const turn = Number(opt.turn) || 0;
    const spin = Number(opt.spin) || 0;
    const inner = Number(opt.inner) || 0;
    const tremor = Number(opt.tremor) || 0;
    if (opt.innerTarget === "figure" && opt.petals === 2) return base + turn + spin;
    const drift = opt.petals === 2 ? 0 : turn * 0.6;
    let angle = base - drift;
    if (opt.innerTarget === "petals") angle += inner + tremor * Math.sin(index * 1.7 + 0.9);
    return angle;
  }

  function enabledFrom(value) {
    return value !== false && value !== "off";
  }

  function step(state, dt, options) {
    const opt = options || {};
    const drive = clamp01(opt.drive);
    const reduce = !!opt.reduce;
    const enabled = !!opt.enabled;
    const outerSpeed = outerRate(drive, reduce);
    const innerSpeed = innerRate(drive, reduce, enabled);
    const held = state || {};
    return {
      outer: advance(held.outer, outerSpeed, dt),
      inner: advance(held.inner, innerSpeed, dt),
      outerRate: outerSpeed,
      innerRate: innerSpeed,
      breath: breath(opt.now, opt.energy, enabled, reduce),
      wheels: wheels(opt.lotus, enabled),
    };
  }

  const api = {
    TAU: TAU,
    OUTER_PERIOD: OUTER_PERIOD,
    INNER_RATIO: INNER_RATIO,
    REDUCE_FACTOR: REDUCE_FACTOR,
    BREATH_LO: BREATH_LO,
    BREATH_HI: BREATH_HI,
    ORDER: ORDER,
    SHAPES: SHAPES,
    outerRate: outerRate,
    innerRate: innerRate,
    advance: advance,
    wheels: wheels,
    breath: breath,
    innerScale: innerScale,
    innerGlow: innerGlow,
    outerPetalAngle: outerPetalAngle,
    innerPetalAngle: innerPetalAngle,
    enabledFrom: enabledFrom,
    step: step,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraAwakening = api;
})(typeof window !== "undefined" ? window : null);
