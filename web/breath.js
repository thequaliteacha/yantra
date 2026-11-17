/* One breath for interface motion.
 *
 * Ten seconds, six a minute. This is the same pace as the bindu.
 * index.html names it --breath: 10s. Change both together.
 */
(function (root) {
  const BREATH_MS = 10000;

  const api = { BREATH_MS: BREATH_MS };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraBreath = api;
})(typeof window !== "undefined" ? window : globalThis);
