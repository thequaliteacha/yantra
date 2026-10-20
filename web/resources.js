/* Pages published on ramameditationsociety.org.
   Edit this list. Each address was checked to load a real page. */
(function (root) {
  const GROUPS = [
    {
      heading: "Talks",
      items: [
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
      ],
    },
    {
      heading: "Meditations",
      items: [
        {
          label: "Meditation practice",
          note: "Rama's own steps for a sit: mantra, concentration, then a chakra.",
          url: "https://www.ramameditationsociety.org/meditation/meditation-practice/",
        },
        {
          label: "Learn meditation",
          note: "The society's short guide, with the meditation talks and music.",
          url: "https://www.ramameditationsociety.org/meditation/",
        },
        {
          label: "Introductory and intermediate",
          note: "How to begin a practice. Lakshmi Series, with the recording.",
          url: "https://www.ramameditationsociety.org/free-resource/introductory-and-intermediate-meditation/",
        },
        {
          label: "Meditation",
          note: "Sitting with enlightened music. The Enlightenment Cycle, with the recording.",
          url: "https://www.ramameditationsociety.org/free-resource/meditation-enlightenment-cycle/",
        },
        {
          label: "Intermediate meditation",
          note: "From concentration to a deepening. The Enlightenment Cycle, with the recording.",
          url: "https://www.ramameditationsociety.org/free-resource/intermediate-meditation/",
        },
        {
          label: "Advanced meditation",
          note: "Passing through other planes of awareness. Lakshmi Series.",
          url: "https://www.ramameditationsociety.org/free-resource/advanced-meditation/",
        },
        {
          label: "Awareness of meditation",
          note: "Stopping thought until only clear mind remains. Tantric Buddhism.",
          url: "https://www.ramameditationsociety.org/free-resource/awareness-meditation/",
        },
        {
          label: "Fusion meditation",
          note: "Short films of Rama's words, Zazen music, and nature.",
          url: "https://www.ramameditationsociety.org/free-resource/fusion-meditation-videos/",
        },
        {
          label: "Meditation music",
          note: "Albums Rama designed for morning and evening sits.",
          url: "https://www.ramameditationsociety.org/resources/type/music/",
        },
      ],
    },
    {
      heading: "Quotes",
      items: [
        {
          label: "Balance",
          note: "A line from this talk can close a sit: you decide to be happy.",
          url: "https://www.ramameditationsociety.org/free-resource/balance/",
        },
        {
          label: "Enlightenment",
          note: "Each time you meditate, you take the journey.",
          url: "https://www.ramameditationsociety.org/free-resource/enlightenment-cycle-talk/",
        },
        {
          label: "Personal Happiness",
          note: "What makes us happy is contact with Light.",
          url: "https://www.ramameditationsociety.org/free-resource/personal-happiness/",
        },
        {
          label: "Miracles",
          note: "The real miracle is the transformation of consciousness.",
          url: "https://www.ramameditationsociety.org/free-resource/miracles/",
        },
        {
          label: "Intermediate meditation",
          note: "In intermediate meditation, you touch light more deeply.",
          url: "https://www.ramameditationsociety.org/free-resource/intermediate-meditation/",
        },
        {
          label: "The Enlightenment Cycle",
          note: "Welcome to the pathway to enlightenment.",
          url: "https://www.ramameditationsociety.org/free-resource/enlightenment-cycle/",
        },
      ],
    },
    {
      heading: "Also published",
      items: [
        {
          label: "Free videos",
          note: "Films and short teachings.",
          url: "https://www.ramameditationsociety.org/resources/type/videos/",
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
