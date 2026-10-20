/* Resources opens the Dharma Talks room on this site.
   The list is web/talks.json. Nothing here is a link off yantramedi.app. */
(function (root) {
  const api = {
    room: "talks",
    credit: "from the Rama Meditation Society",
    note: "Dharma talks, the meditations, and the quotes from the end of the sits.",
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraResources = api;
})(typeof window !== "undefined" ? window : null);
