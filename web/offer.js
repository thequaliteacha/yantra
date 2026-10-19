/* What to say, and which albums to offer, when Spotify cannot play a sit.
   The page never starts the yantra until some hosted album is actually playing. */
(function (root) {
  function classify(status, reason, message) {
    const text = ((reason || "") + " " + (message || "")).toLowerCase();
    if (/premium/.test(text)) return "premium";
    // Development Mode answers 403 for every account that is not allowlisted.
    if (status === 403 || /not registered/.test(text)) return "unlisted";
    return "failed";
  }

  /* One calm sentence. The album list and Connect button sit underneath it. */
  function line(offer) {
    const albums = (offer && offer.albums) || [];
    let tail;
    if (offer && offer.playing) {
      tail = offer.playing + (offer.mix ? " are playing." : " is playing.");
    } else if (albums.length) {
      tail = "Choose a hosted album to begin.";
    } else {
      tail = "A hosted album isn't available for this sit.";
    }
    const asked = (offer && offer.asked) || "";
    const reason = (offer && offer.reason) || "";
    if (reason === "unlisted") {
      return "This Spotify account isn't on Yantra's listener list, so Spotify can't play here. " + tail;
    }
    if (reason === "premium") {
      return "Spotify Premium is needed to play in Yantra. " + tail;
    }
    if (reason === "sdk") {
      return "Spotify isn't ready on this device. " + tail;
    }
    if (reason === "offline") {
      const head = asked
        ? asked + " plays on Spotify, which isn't connected. "
        : "Spotify isn't connected. ";
      return head + tail;
    }
    const head = asked
      ? asked + " plays on Spotify, which didn't start. "
      : "Spotify didn't start. ";
    return head + tail;
  }

  function hostedAlbums(discs, count, isHosted, fits) {
    return (discs || []).filter((disc) => {
      if (!isHosted(disc)) return false;
      return count ? fits(disc, count) : true;
    }).map((disc) => ({ id: disc.id, title: disc.title, circle: disc.circle || "" }));
  }

  const api = { classify: classify, line: line, hostedAlbums: hostedAlbums };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraOffer = api;
})(typeof window !== "undefined" ? window : null);
