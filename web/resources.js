/* The Dharma Talks section on ramameditationsociety.org.
   The section is the link. Individual talks are not listed here.
   Each address was checked to load a real page. */
(function (root) {
  const GROUPS = [
    {
      heading: "Dharma talks",
      items: [
        {
          label: "Dharma talks",
          note: "The dharma talks, the meditations, and the quotes from the end of the sits.",
          url: "https://www.ramameditationsociety.org/meditation/",
        },
        {
          label: "Meditation practice",
          note: "Rama's steps for a sit, in this same section.",
          url: "https://www.ramameditationsociety.org/meditation/meditation-practice/",
        },
        {
          label: "Mindfulness",
          note: "Watching the mind through the day.",
          url: "https://www.ramameditationsociety.org/meditation/mindfulness/",
        },
        {
          label: "Spiritual experiences",
          note: "What carries a student along the path.",
          url: "https://www.ramameditationsociety.org/meditation/spiritual-path/",
        },
        {
          label: "Enlightenment",
          note: "The still point the practice is aimed at.",
          url: "https://www.ramameditationsociety.org/meditation/enlightenment/",
        },
      ],
    },
  ];

  const api = {
    groups: GROUPS,
    list: GROUPS.reduce((all, group) => all.concat(group.items), []),
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraResources = api;
})(typeof window !== "undefined" ? window : null);
