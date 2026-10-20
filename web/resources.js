/* Dharma talks and related pages published on ramameditationsociety.org.
   Edit this list. Each address was checked to load a real page. */
(function (root) {
  const RESOURCES = [
    {
      label: "Free resources",
      note: "The library of talks, music, videos, and books.",
      url: "https://www.ramameditationsociety.org/resource-library/",
    },
    {
      label: "Free talks",
      note: "More than a hundred dharma talks, free to download.",
      url: "https://www.ramameditationsociety.org/resources/type/talk-sets/",
    },
    {
      label: "The Enlightenment Cycle",
      note: "Twelve talks from 1992, a short course in the practice.",
      url: "https://www.ramameditationsociety.org/set/enlightenment-cycle-talkset/",
    },
    {
      label: "Tantric Buddhism",
      note: "Twenty-seven talks from 1989 and 1990.",
      url: "https://www.ramameditationsociety.org/set/tantric-buddhism-talkset/",
    },
    {
      label: "Zen Tapes",
      note: "Eighteen talks on Zen as direct experience.",
      url: "https://www.ramameditationsociety.org/set/zen-tapes-talkset/",
    },
    {
      label: "The Lakshmi Series",
      note: "The earliest set of talks, from 1982 and 1983.",
      url: "https://www.ramameditationsociety.org/set/lakshmi-series-talkset/",
    },
    {
      label: "Insights",
      note: "Talks on the nature of existence, recorded in 1983.",
      url: "https://www.ramameditationsociety.org/set/insights-talks-nature-existence-talkset/",
    },
    {
      label: "On the Road with Rama",
      note: "Talks recorded in 1985 at places of power.",
      url: "https://www.ramameditationsociety.org/set/road-rama-talkset/",
    },
    {
      label: "Free videos",
      note: "Films and short teachings.",
      url: "https://www.ramameditationsociety.org/resources/type/videos/",
    },
    {
      label: "Free music",
      note: "Meditation albums designed by Rama.",
      url: "https://www.ramameditationsociety.org/resources/type/music/",
    },
    {
      label: "Books",
      note: "Transcripts, novels, and How to Meditate.",
      url: "https://www.ramameditationsociety.org/resources/type/books/",
    },
    {
      label: "Articles",
      note: "Short writings from the Rama Meditation Society.",
      url: "https://www.ramameditationsociety.org/blog/",
    },
    {
      label: "Rama, Dr. Frederick Lenz",
      note: "A short account of the teacher.",
      url: "https://www.ramameditationsociety.org/rama-dr-frederick-lenz/",
    },
  ];

  const api = { list: RESOURCES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraResources = api;
})(typeof window !== "undefined" ? window : null);
