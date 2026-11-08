/* Quiet practice marks for the web edition.
 *
 * After a Zazen sit, one invitation can open a talk that is actually playable.
 * On the home screen, the live formal run draws a small trail of circles.
 * The shape shifts at 7, 30, 90, 180, and 365 days. The glow deepens with that
 * run and with time already kept in the practice record. Nothing here is a
 * score, a badge, or a claim of attainment. Listening never moves the run.
 *
 * The variation is chosen on this device. A linked practice key is hashed
 * locally so the same account draws the same marks. That hash is not the
 * sync lookup id, and this file never sends it anywhere.
 */
(function (root) {
  const SEED_KEY = "yantra.quiet.seed";
  const HERO_CAP = 14;
  const MILESTONES = [
    { days: 7, form: "enso" },
    { days: 30, form: "lotus" },
    { days: 90, form: "moon" },
    { days: 180, form: "mandala" },
    { days: 365, form: "year" },
  ];
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  function hashSeed(str) {
    const text = String(str || "");
    let h = 1779033703 ^ text.length;
    for (let i = 0; i < text.length; i += 1) {
      h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0) || 1;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rnd() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  /* Local only. Not the lookup id the sync code derives for the server. */
  function accountMark(practiceKey) {
    const key = String(practiceKey || "");
    if (!key) return "";
    return "m" + hashSeed("yantra.quiet:" + key).toString(16);
  }

  function seedFor(storage, account) {
    const linked = typeof account === "string" ? account : "";
    if (/^m[0-9a-f]{1,12}$/.test(linked)) return linked;
    let existing = "";
    try { existing = storage && storage.getItem(SEED_KEY) || ""; } catch (e) { existing = ""; }
    if (/^l[0-9a-z]{6,40}$/.test(existing)) return existing;
    const next = "l" + hashSeed("local:" + Math.random() + ":" + Date.now()).toString(36);
    try { if (storage) storage.setItem(SEED_KEY, next); } catch (e) {}
    return next;
  }

  function auraFor(days, formalMs) {
    const depth = Math.log10(Math.max(Number(days) || 0, 1) + 1) / Math.log10(366);
    const minutes = Math.max(0, Number(formalMs) || 0) / 60000;
    const practice = Math.log10(minutes + 1) / Math.log10(10000);
    return clamp(0.12 + depth * 0.45 + practice * 0.12, 0.12, 0.72);
  }

  function activeMilestone(days) {
    const n = Math.max(0, Math.floor(Number(days) || 0));
    let active = null;
    MILESTONES.forEach((mark) => {
      if (n >= mark.days) active = mark;
    });
    return active;
  }

  function formForDays(days) {
    const mark = activeMilestone(days);
    return mark ? mark.form : "plain";
  }

  function heroDays(continuous) {
    const n = Math.max(0, Math.floor(Number(continuous) || 0));
    if (!n) return [];
    const start = Math.max(1, n - HERO_CAP + 1);
    const out = [];
    for (let day = start; day <= n; day += 1) out.push(day);
    return out;
  }

  function continuousLabel(days) {
    const n = Math.max(0, Math.floor(Number(days) || 0));
    return n === 1 ? "1 day" : n + " days";
  }

  function weeklyLabel(days) {
    const n = Math.max(0, Math.min(7, Math.floor(Number(days) || 0)));
    if (n === 1) return "1 / 7 day";
    return n + " / 7 days";
  }

  function svgShell(inner, opts) {
    const size = opts.size || 36;
    const aura = opts.aura != null ? opts.aura : 0.28;
    /* A flat wash, not a gradient id. At the home size a hairline stroke
       disappears, so the glow is a quiet disc the ring can sit on. */
    const wash = (0.08 + aura * 0.16).toFixed(3);
    return (
      '<svg class="circle-svg" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' +
        '<circle cx="50" cy="50" r="46" fill="rgba(230,201,138,' + wash + ')"/>' +
        inner +
      "</svg>"
    );
  }

  function point(angle, radius) {
    return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  }

  function formEnso(rnd, aura, size) {
    const gap = 18 + rnd() * 22;
    const start = rnd() * 360;
    const thick = 5.2 + rnd() * 2.4;
    const wobble = 0.6 + rnd() * 1.4;
    rnd(); /* spare roll so this account's shape stays put */
    const r = 30 + rnd() * 2;
    const a0 = (start * Math.PI) / 180;
    const a1 = ((start + 360 - gap) * Math.PI) / 180;
    const p0 = point(a0, r);
    const p1 = point(a1, r);
    const large = (360 - gap) > 180 ? 1 : 0;
    const d = "M " + p0[0].toFixed(2) + " " + p0[1].toFixed(2) +
      " A " + r.toFixed(2) + " " + (r + wobble * 0.3).toFixed(2) + " 0 " + large + " 1 " +
      p1[0].toFixed(2) + " " + p1[1].toFixed(2);
    const tip = point(a1, r - 1);
    const inner =
      '<path d="' + d + '" fill="none" stroke="#e6c98a" stroke-width="' + thick.toFixed(2) +
      '" stroke-linecap="round" opacity="0.9"/>' +
      '<circle cx="' + tip[0].toFixed(2) + '" cy="' + tip[1].toFixed(2) + '" r="' + (2.2 + rnd()).toFixed(2) +
      '" fill="#f3e6c8" opacity="0.85"/>';
    return svgShell(inner, { aura: aura, size: size });
  }

  function formLotus(rnd, aura, size) {
    rnd(); /* spare roll so this account's shape stays put */
    const petals = 5 + Math.floor(rnd() * 2);
    const rot = rnd() * 40;
    const petalLen = 26 + rnd() * 4;
    let paths = "";
    for (let i = 0; i < petals; i += 1) {
      const ang = ((360 / petals) * i + rot) * Math.PI / 180;
      const ex = 50 + Math.cos(ang) * petalLen;
      const ey = 50 + Math.sin(ang) * petalLen;
      const px = 50 + Math.cos(ang + 0.55) * (petalLen * 0.45);
      const py = 50 + Math.sin(ang + 0.55) * (petalLen * 0.45);
      const qx = 50 + Math.cos(ang - 0.55) * (petalLen * 0.45);
      const qy = 50 + Math.sin(ang - 0.55) * (petalLen * 0.45);
      paths += '<path d="M50 50 Q ' + px.toFixed(1) + " " + py.toFixed(1) + " " + ex.toFixed(1) + " " + ey.toFixed(1) +
        " Q " + qx.toFixed(1) + " " + qy.toFixed(1) + ' 50 50" fill="rgba(243,230,200,' + (0.08 + rnd() * 0.06).toFixed(3) +
        ')" stroke="#e6c98a" stroke-width="2.4" opacity="0.85"/>';
    }
    paths += '<circle cx="50" cy="50" r="' + (5 + rnd() * 2).toFixed(1) + '" fill="none" stroke="#e6c98a" stroke-width="2.6" opacity="0.9"/>';
    return svgShell(paths, { aura: aura, size: size });
  }

  function formMoon(rnd, aura, size) {
    rnd(); /* spare roll so this account's shape stays put */
    const phase = 0.35 + rnd() * 0.35;
    const tilt = -25 + rnd() * 50;
    const outerR = 28 + rnd() * 3;
    const inner =
      '<circle cx="50" cy="50" r="' + outerR.toFixed(1) + '" fill="none" stroke="rgba(243,230,200,0.4)" stroke-width="2.2"/>' +
      '<g transform="rotate(' + tilt.toFixed(1) + ' 50 50)">' +
        '<path d="M ' + (50 - outerR * 0.15).toFixed(1) + " 50 a " + (outerR * 0.72).toFixed(1) + " " + (outerR * 0.72).toFixed(1) +
        " 0 1 0 0.01 0 a " + (outerR * phase).toFixed(1) + " " + (outerR * 0.72).toFixed(1) +
        ' 0 1 1 -0.01 0" fill="#e6c98a" opacity="0.7"/>' +
      "</g>" +
      '<circle cx="50" cy="50" r="3.2" fill="#f3e6c8" opacity="0.8"/>';
    return svgShell(inner, { aura: aura, size: size });
  }

  function formMandala(rnd, aura, size) {
    rnd(); /* spare roll so this account's shape stays put */
    const rot = rnd() * 20;
    const r1 = 14 + rnd() * 3;
    const r2 = 26 + rnd() * 3;
    const r3 = 34 + rnd() * 2;
    let inner = '<circle cx="50" cy="50" r="' + r3.toFixed(1) + '" fill="none" stroke="#e6c98a" stroke-width="2.4" opacity="0.8"/>' +
      '<circle cx="50" cy="50" r="' + r2.toFixed(1) + '" fill="none" stroke="rgba(230,201,138,0.55)" stroke-width="1.8"/>' +
      '<circle cx="50" cy="50" r="' + r1.toFixed(1) + '" fill="none" stroke="#f3e6c8" stroke-width="2.2" opacity="0.85"/>';
    for (let i = 0; i < 4; i += 1) {
      const ang = ((90 * i + rot) * Math.PI) / 180;
      const x2 = 50 + Math.cos(ang) * r3;
      const y2 = 50 + Math.sin(ang) * r3;
      inner += '<line x1="50" y1="50" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) +
        '" stroke="rgba(243,230,200,0.55)" stroke-width="1.6"/>';
      inner += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="2.4" fill="#e6c98a" opacity="0.85"/>';
    }
    inner += '<circle cx="50" cy="50" r="3.2" fill="#f3e6c8" opacity="0.9"/>';
    return svgShell(inner, { aura: aura, size: size });
  }

  function formYear(rnd, aura, size) {
    rnd(); /* spare roll so this account's shape stays put */
    const gap = 8 + rnd() * 10;
    const start = 200 + rnd() * 40;
    const r = 31 + rnd() * 2;
    const a0 = (start * Math.PI) / 180;
    const a1 = ((start + 360 - gap) * Math.PI) / 180;
    const p0 = point(a0, r);
    const p1 = point(a1, r);
    const d = "M " + p0[0].toFixed(2) + " " + p0[1].toFixed(2) +
      " A " + r.toFixed(2) + " " + r.toFixed(2) + " 0 1 1 " + p1[0].toFixed(2) + " " + p1[1].toFixed(2);
    let rings = '<circle cx="50" cy="50" r="' + (r - 8).toFixed(1) + '" fill="none" stroke="rgba(230,201,138,0.45)" stroke-width="1.8"/>';
    rings += '<path d="' + d + '" fill="none" stroke="#e6c98a" stroke-width="5" stroke-linecap="round" opacity="0.95"/>';
    rings += '<circle cx="50" cy="50" r="' + (3.6 + rnd()).toFixed(1) + '" fill="#f3e6c8" opacity="0.9"/>';
    rings += '<circle cx="50" cy="50" r="' + (8 + rnd() * 2).toFixed(1) + '" fill="none" stroke="rgba(243,230,200,0.45)" stroke-width="1.6"/>';
    return svgShell(rings, { aura: Math.min(0.8, aura * 1.08), size: size });
  }

  function formPlain(rnd, aura, size) {
    rnd(); /* spare roll so this account's shape stays put */
    const r = 28 + rnd() * 2;
    const inner = '<circle cx="50" cy="50" r="' + r.toFixed(1) + '" fill="none" stroke="rgba(243,230,200,0.55)" stroke-width="3.2"/>' +
      '<circle cx="50" cy="50" r="3" fill="rgba(243,230,200,0.55)"/>';
    return svgShell(inner, { aura: aura * 0.7, size: size });
  }

  function renderForm(formKey, dayIndex, seed, opts) {
    const options = opts || {};
    const day = Math.max(0, Math.floor(Number(dayIndex) || 0));
    const key = formKey || formForDays(day);
    const rnd = mulberry32(hashSeed(String(seed || "local") + "::" + key + ":" + day));
    const auraDays = options.auraDays != null ? options.auraDays : day;
    let aura = auraFor(auraDays, options.formalMs || 0);
    aura = clamp(aura + (rnd() - 0.5) * 0.08, 0.1, 0.78);
    const size = options.size || 36;
    if (key === "enso") return formEnso(rnd, aura, size);
    if (key === "lotus") return formLotus(rnd, aura, size);
    if (key === "moon") return formMoon(rnd, aura, size);
    if (key === "mandala") return formMandala(rnd, aura, size);
    if (key === "year") return formYear(rnd, aura, size);
    return formPlain(rnd, aura, size);
  }

  /* One invitation, or nothing. The quote has to be on screen, the word has
     to be Zazen, and the talk has to be one this device can play. Offline,
     that means a talk already kept here. The quote's own talk wins when it
     can play. There is no timer and nothing starts by itself. */
  function segueOffer(input) {
    const o = input || {};
    if (o.level !== "zazen" || !o.quoteShown) return null;
    const can = typeof o.canPlay === "function" ? o.canPlay : function () { return false; };
    const play = { offline: !!o.offline, kept: o.kept };
    const preferred = o.preferred;
    if (preferred && preferred.src && can(preferred.src, play)) {
      return {
        title: String(preferred.title || ""),
        src: preferred.src,
        setTitle: String(preferred.setTitle || ""),
      };
    }
    const sections = Array.isArray(o.sections) ? o.sections : [];
    for (let i = 0; i < sections.length; i += 1) {
      const set = sections[i] || {};
      const talks = Array.isArray(set.talks) ? set.talks : [];
      for (let j = 0; j < talks.length; j += 1) {
        const talk = talks[j];
        if (talk && talk.src && can(talk.src, play)) {
          return {
            title: String(talk.title || ""),
            src: talk.src,
            setTitle: String(set.title || ""),
          };
        }
      }
    }
    return null;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function monthLabel(year, month) {
    const name = MONTHS[(Number(month) || 1) - 1] || "";
    return name + " " + year;
  }

  /* Formal morning and evening only. A day with neither is empty. Listening
     is not in this map. */
  function monthCells(year, month, days) {
    const y = Math.floor(Number(year) || 0);
    const m = Math.floor(Number(month) || 0);
    const first = new Date(y, m - 1, 1);
    const count = new Date(y, m, 0).getDate();
    const cells = [];
    const blanks = first.getDay();
    for (let i = 0; i < blanks; i += 1) cells.push({ empty: true });
    const book = days && typeof days === "object" ? days : {};
    for (let day = 1; day <= count; day += 1) {
      const date = y + "-" + pad(m) + "-" + pad(day);
      const src = book[date] || {};
      const morning = (Number(src.morning) || 0) > 0;
      const evening = (Number(src.evening) || 0) > 0;
      cells.push({
        date: date,
        day: day,
        morning: morning,
        evening: evening,
        formal: morning || evening,
      });
    }
    return { year: y, month: m, label: monthLabel(y, m), cells: cells };
  }

  const api = {
    SEED_KEY: SEED_KEY,
    HERO_CAP: HERO_CAP,
    MILESTONES: MILESTONES,
    hashSeed: hashSeed,
    accountMark: accountMark,
    seedFor: seedFor,
    auraFor: auraFor,
    activeMilestone: activeMilestone,
    formForDays: formForDays,
    heroDays: heroDays,
    continuousLabel: continuousLabel,
    weeklyLabel: weeklyLabel,
    renderForm: renderForm,
    segueOffer: segueOffer,
    monthCells: monthCells,
    monthLabel: monthLabel,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraQuiet = api;
})(typeof window !== "undefined" ? window : globalThis);
