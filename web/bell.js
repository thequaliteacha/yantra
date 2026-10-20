/* A small set of struck bells, synthesized here. Nothing is copied from another app.
   Times come from sit.js. The clock is the audio context, checked against the wall
   when the page wakes, because a backgrounded iPad can suspend the context. */
(function (root) {
  const PARTIALS = {
    small: { hz: 880, parts: [[1, 1, 1.4], [2.76, 0.28, 0.9], [5.4, 0.12, 0.45]] },
    medium: { hz: 432, parts: [[1, 1, 2.4], [2.01, 0.4, 1.5], [2.98, 0.22, 1.1], [5.16, 0.08, 0.6]] },
    deep: { hz: 174, parts: [[1, 1, 4.2], [2.0, 0.45, 2.6], [2.74, 0.28, 1.8], [5.4, 0.1, 1.1]] },
  };

  let ctx = null;
  let session = null;

  /* The gap is the longest partial of that bell, so the next strike starts after the ring has decayed. */
  function strikeGap(tone) {
    const spec = PARTIALS[tone] || PARTIALS.medium;
    let decay = 0;
    spec.parts.forEach((part) => {
      if (part[2] > decay) decay = part[2];
    });
    return decay;
  }

  function onsets(start, tone, count) {
    const strikes = count === 0 || count === 1 || count === 2 || count === 3 || count === 4 ? count : 0;
    const gap = strikeGap(tone);
    const times = [];
    for (let i = 0; i < strikes; i += 1) times.push(start + i * gap);
    return times;
  }

  function ring(audio, start, tone, count, gain) {
    const nodes = [];
    onsets(start, tone, count).forEach((when) => {
      strike(audio, when, tone, gain).forEach((node) => nodes.push(node));
    });
    return nodes;
  }

  function context() {
    if (!root) return null;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") {
      const pending = ctx.resume();
      if (pending && pending.catch) pending.catch(() => {});
    }
    return ctx;
  }

  /* iPad Safari, including a Home Screen app, only starts audio inside the tap.
     Call this before any await. The bell uses its own context and does not pause
     Spotify or the sangha recording. */
  function unlock() {
    const audio = context();
    if (!audio || audio.__yantraPrimed) return !!audio;
    try {
      const buffer = audio.createBuffer(1, 1, audio.sampleRate || 44100);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      source.start(audio.currentTime);
      audio.__yantraPrimed = true;
    } catch (e) {}
    return true;
  }

  function read(key) {
    const settings = root && root.YantraSettings;
    return settings ? settings.get(key) : undefined;
  }

  function volume() {
    const level = Number(read("bell.volume"));
    return Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0.7;
  }

  function strike(audio, when, tone, gain) {
    const spec = PARTIALS[tone] || PARTIALS.medium;
    const master = audio.createGain();
    const nodes = [];
    master.gain.setValueAtTime(0.0001, when);
    master.connect(audio.destination);
    spec.parts.forEach((part) => {
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = spec.hz * part[0];
      const peak = Math.max(0.0001, gain * part[1]);
      amp.gain.setValueAtTime(peak, when);
      amp.gain.exponentialRampToValueAtTime(0.0001, when + part[2]);
      osc.connect(amp);
      amp.connect(master);
      osc.start(when);
      osc.stop(when + part[2] + 0.05);
      nodes.push(osc);
    });
    master.gain.setValueAtTime(1, when);
    return nodes;
  }

  function noiseBuffer(audio, kind) {
    const length = audio.sampleRate * 2;
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let hold = 0;
    let brown = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === "brown") {
        brown = (brown + 0.02 * white) / 1.02;
        data[i] = brown * 3.5;
      } else if (kind === "pink") {
        hold = 0.98 * hold + 0.02 * white;
        data[i] = hold * 2;
      } else if (kind === "rain") {
        const drop = Math.random() < 0.004 ? (Math.random() * 2 - 1) : 0;
        hold = 0.96 * hold + 0.04 * white;
        data[i] = hold * 0.8 + drop * 0.7;
      } else {
        data[i] = white * 0.4;
      }
    }
    return buffer;
  }

  function startBed(audio, when, kind) {
    if (!kind || kind === "silent") return null;
    const level = Number(read("sit.bedVolume"));
    const gainValue = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0.35;
    const amp = audio.createGain();
    const nodes = [];
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), when + 1.5);
    amp.connect(audio.destination);
    if (kind === "drone" || kind === "bowl" || kind === "pad") {
      const tones = kind === "bowl" ? [174, 261] : kind === "pad" ? [196, 246, 293] : [196, 294];
      tones.forEach((hz, index) => {
        const osc = audio.createOscillator();
        const voice = audio.createGain();
        osc.type = kind === "pad" ? "triangle" : "sine";
        osc.frequency.value = hz;
        voice.gain.value = kind === "pad" ? 0.08 : 0.12 / (index + 1);
        osc.connect(voice);
        voice.connect(amp);
        osc.start(when);
        nodes.push(osc);
      });
      return { amp: amp, nodes: nodes };
    }
    const source = audio.createBufferSource();
    source.buffer = noiseBuffer(audio, kind === "rain" ? "rain" : kind);
    source.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = kind === "rain" ? "bandpass" : "lowpass";
    filter.frequency.value = kind === "brown" ? 400 : kind === "rain" ? 1800 : 1200;
    source.connect(filter);
    filter.connect(amp);
    source.start(when);
    nodes.push(source);
    return { amp: amp, nodes: nodes };
  }

  function stopBed(bed, audio) {
    const amp = bed && bed.amp ? bed.amp : bed;
    if (!amp || !audio || !amp.gain) return;
    const now = audio.currentTime;
    try {
      amp.gain.cancelScheduledValues(now);
      amp.gain.setValueAtTime(Math.max(0.0001, amp.gain.value), now);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    } catch (e) {}
  }

  function stopNodes(nodes, audio) {
    if (!audio || !nodes) return;
    const now = audio.currentTime;
    nodes.forEach((node) => {
      try { node.stop(now); } catch (e) {}
    });
  }

  /* Closes the sit on the audio clock, after the ending pattern, not on a drifting interval. */
  function armEnd(audio, when) {
    let marker = null;
    try {
      marker = audio.createBufferSource();
      marker.buffer = audio.createBuffer(1, 1, audio.sampleRate || 44100);
      marker.connect(audio.destination);
      marker.onended = () => {
        if (!session || session.marker !== marker) return;
        if (typeof root.endSitting === "function") root.endSitting();
        else endSit();
      };
      marker.start(Math.max(when, audio.currentTime + 0.02));
    } catch (e) {}
    return marker;
  }

  function closeAt(events, duration) {
    const endEvent = events.filter((event) => event.position === "end").pop();
    const tail = endEvent ? strikeGap(endEvent.tone) * endEvent.strikes : 0;
    return duration + tail;
  }

  function place(audio, plan, timed) {
    const events = timed ? plan.events : plan.events.filter((event) => event.position === "start");
    const startAudio = audio.currentTime + 0.06;
    const nodes = [];
    events.forEach((event) => {
      ring(audio, startAudio + event.at, event.tone, event.strikes, event.gain * volume()).forEach((node) => nodes.push(node));
    });
    const bed = timed ? startBed(audio, startAudio, read("sit.background")) : null;
    if (bed) bed.nodes.forEach((node) => nodes.push(node));
    const marker = timed ? armEnd(audio, startAudio + closeAt(events, plan.duration)) : null;
    session = { plan: plan, timed: !!timed, startWall: Date.now(), startAudio: startAudio, bed: bed, nodes: nodes, marker: marker };
  }

  function beginSit(timed) {
    const audio = unlock() ? ctx : null;
    if (!audio || !root || !root.YantraSit) return;
    endSit();
    const plan = root.YantraSit.fromSettings(read);
    place(audio, plan, !!timed);
  }

  function endSit() {
    const current = session;
    session = null;
    if (!current) return;
    if (current.marker) current.marker.onended = null;
    if (ctx) {
      stopNodes(current.nodes, ctx);
      stopBed(current.bed, ctx);
    }
  }

  function preview(tone, count) {
    const audio = unlock() ? ctx : null;
    if (!audio) return;
    const strikes = count === 0 || count === 1 || count === 2 || count === 3 || count === 4 ? count : 1;
    ring(audio, audio.currentTime + 0.02, tone, strikes, volume());
  }

  /* The audio clock keeps the bells while the screen is only dim. A full suspend
     freezes that clock, so on wake the wall clock decides what is still ahead. */
  function wake() {
    if (!session || !session.timed || !ctx) return;
    if (root.document && root.document.visibilityState === "hidden") return;
    const wall = (Date.now() - session.startWall) / 1000;
    const audioElapsed = ctx.currentTime - session.startAudio;
    if (wall - audioElapsed < 0.75) return;
    const plan = session.plan;
    const startWall = session.startWall;
    stopNodes(session.nodes, ctx);
    stopBed(session.bed, ctx);
    if (session.marker) {
      session.marker.onended = null;
      try { session.marker.stop(ctx.currentTime); } catch (e) {}
    }
    session = null;
    const audio = context();
    if (!audio) return;
    const nodes = [];
    const startAudio = audio.currentTime + 0.05;
    if (wall >= plan.duration) {
      plan.events.filter((event) => event.position === "end").forEach((event) => {
        ring(audio, startAudio, event.tone, event.strikes, event.gain * volume()).forEach((node) => nodes.push(node));
      });
      const marker = armEnd(audio, startAudio + closeAt(plan.events.filter((event) => event.position === "end"), 0));
      session = { plan: plan, timed: true, startWall: startWall, startAudio: audio.currentTime - wall, bed: null, nodes: nodes, marker: marker };
      return;
    }
    plan.events.forEach((event) => {
      onsets(event.at, event.tone, event.strikes).forEach((at) => {
        if (at < wall - 0.05) return;
        strike(audio, startAudio + (at - wall), event.tone, event.gain * volume()).forEach((node) => nodes.push(node));
      });
    });
    const bed = startBed(audio, startAudio, read("sit.background"));
    if (bed) bed.nodes.forEach((node) => nodes.push(node));
    const marker = armEnd(audio, startAudio + Math.max(0, closeAt(plan.events, plan.duration) - wall));
    session = { plan: plan, timed: true, startWall: startWall, startAudio: startAudio - wall, bed: bed, nodes: nodes, marker: marker };
  }

  function onWake() {
    if (root.document && root.document.visibilityState === "hidden") return;
    wake();
  }

  if (root && root.document) {
    root.document.addEventListener("visibilitychange", onWake);
    root.addEventListener("pageshow", onWake);
  }

  const api = { beginSit: beginSit, endSit: endSit, unlock: unlock, preview: preview, PARTIALS: PARTIALS, strikeGap: strikeGap, onsets: onsets };

  function paintBell() {
    const sit = root.YantraSit;
    const settings = root.YantraSettings;
    if (!sit || !settings || !root.document.getElementById("account-bell")) return;
    const same = root.document.getElementById("bell-same");
    const volumeInput = root.document.getElementById("bell-volume");
    const minutesInput = root.document.getElementById("sit-minutes");
    const note = root.document.getElementById("sit-minutes-note");
    const midway = root.document.getElementById("sit-midway");
    const bed = root.document.getElementById("sit-bed");
    const bedVolume = root.document.getElementById("sit-bed-volume");
    const startCount = sit.strikes(settings.get("bell.startStrikes"), settings.get("bell.on") !== false ? 1 : 0);
    const midCount = sit.strikes(settings.get("bell.midStrikes"), 1);
    const endCount = sit.strikes(settings.get("bell.endStrikes"), settings.get("bell.ending") !== false ? 3 : 0);
    root.document.getElementById("bell-start-strikes").value = String(startCount);
    root.document.getElementById("bell-mid-strikes").value = String(midCount);
    root.document.getElementById("bell-end-strikes").value = String(endCount);
    const sameOn = settings.get("bell.sameTone") !== false;
    const startTone = settings.get("bell.startTone") || "medium";
    same.setAttribute("aria-pressed", String(sameOn));
    const bellVol = Number(settings.get("bell.volume"));
    volumeInput.value = String(Math.round((Number.isFinite(bellVol) ? bellVol : 0.7) * 100));
    const length = sit.minutes(settings.get("sit.minutes"));
    minutesInput.value = String(length == null ? sit.DEFAULT_MINUTES : length);
    note.textContent = "";
    midway.value = settings.get("sit.midway") || "none";
    bed.value = settings.get("sit.background") || "silent";
    const bedVol = Number(settings.get("sit.bedVolume"));
    bedVolume.value = String(Math.round((Number.isFinite(bedVol) ? bedVol : 0.35) * 100));
    const previewRow = root.document.getElementById("bell-preview");
    if (!previewRow.childElementCount) {
      sit.TONES.forEach((name) => {
        const button = root.document.createElement("button");
        button.className = "quiet";
        button.type = "button";
        button.textContent = name === "small" ? "Small bowl" : name === "deep" ? "Deep bell" : "Temple bell";
        button.addEventListener("click", () => {
          const count = sit.strikes(settings.get("bell.startStrikes"), settings.get("bell.on") !== false ? 1 : 0);
          preview(name, count > 0 ? count : 1);
        });
        previewRow.append(button);
      });
    }
    const positions = root.document.getElementById("bell-positions");
    const mode = settings.get("sit.midway") || "none";
    const rows = [["bell.startTone", "Start"]];
    if (mode === "half") rows.push(["bell.halfTone", "Halfway"]);
    if (mode === "two") {
      rows.push(["bell.quarterTone", "25%"]);
      rows.push(["bell.threeQuarterTone", "75%"]);
    }
    rows.push(["bell.endTone", "End"]);
    while (positions.firstChild) positions.removeChild(positions.firstChild);
    rows.forEach((row) => {
      const field = root.document.createElement("div");
      field.className = "bell-tone";
      const label = root.document.createElement("label");
      label.className = "account-field";
      label.append(row[1]);
      const select = root.document.createElement("select");
      select.dataset.tone = row[0];
      sit.TONES.forEach((name) => {
        const option = root.document.createElement("option");
        option.value = name;
        option.textContent = name === "small" ? "Small bowl" : name === "deep" ? "Deep bell" : "Temple bell";
        select.append(option);
      });
      const stored = settings.get(row[0]) || startTone;
      select.value = sameOn ? startTone : stored;
      select.addEventListener("change", () => {
        if (settings.get("bell.sameTone") !== false) {
          ["bell.startTone", "bell.endTone", "bell.halfTone", "bell.quarterTone", "bell.threeQuarterTone"].forEach((key) => {
            settings.set(key, select.value);
          });
        } else {
          settings.set(row[0], select.value);
        }
        paintBell();
      });
      const hear = root.document.createElement("button");
      hear.className = "quiet";
      hear.type = "button";
      hear.textContent = "Preview";
      hear.setAttribute("aria-label", "Preview " + row[1] + " tone");
      hear.addEventListener("click", () => preview(select.value, 1));
      label.append(select);
      field.append(label, hear);
      positions.append(field);
    });
    const presets = root.document.getElementById("sit-presets");
    if (!presets.childElementCount) {
      sit.PRESETS.forEach((value) => {
        const button = root.document.createElement("button");
        button.className = "quiet";
        button.type = "button";
        button.textContent = String(value);
        button.addEventListener("click", () => {
          settings.set("sit.minutes", value);
          minutesInput.value = String(value);
          note.textContent = "";
        });
        presets.append(button);
      });
    }
  }

  function bootBell() {
    if (!root.YANTRA_WEB || !root.document.getElementById("account-bell")) return;
    const settings = root.YantraSettings;
    paintBell();
    function bindStrikes(id, key, flag) {
      root.document.getElementById(id).addEventListener("change", (event) => {
        const count = root.YantraSit.strikes(event.target.value, null);
        settings.set(key, count);
        if (flag) settings.set(flag, count > 0);
        paintBell();
      });
    }
    bindStrikes("bell-start-strikes", "bell.startStrikes", "bell.on");
    bindStrikes("bell-mid-strikes", "bell.midStrikes");
    bindStrikes("bell-end-strikes", "bell.endStrikes", "bell.ending");
    function toneKey(key) {
      const linked = settings.get("bell.sameTone") !== false;
      const shared = settings.get("bell.startTone") || "medium";
      return linked ? shared : (settings.get(key) || shared);
    }
    function previewPlace(place) {
      const count = root.YantraSit.strikes(settings.get(place.key), place.fallback());
      preview(toneKey(place.tone), count);
    }
    root.document.getElementById("bell-preview-start").addEventListener("click", () => {
      previewPlace({ key: "bell.startStrikes", tone: "bell.startTone", fallback: () => (settings.get("bell.on") !== false ? 1 : 0) });
    });
    root.document.getElementById("bell-preview-mid").addEventListener("click", () => {
      const mode = settings.get("sit.midway");
      previewPlace({ key: "bell.midStrikes", tone: mode === "two" ? "bell.quarterTone" : "bell.halfTone", fallback: () => 1 });
    });
    root.document.getElementById("bell-preview-end").addEventListener("click", () => {
      previewPlace({ key: "bell.endStrikes", tone: "bell.endTone", fallback: () => (settings.get("bell.ending") !== false ? 3 : 0) });
    });
    root.document.getElementById("bell-same").addEventListener("click", () => {
      const next = root.document.getElementById("bell-same").getAttribute("aria-pressed") !== "true";
      settings.set("bell.sameTone", next);
      if (next) {
        const shared = settings.get("bell.startTone") || "medium";
        ["bell.endTone", "bell.halfTone", "bell.quarterTone", "bell.threeQuarterTone"].forEach((key) => settings.set(key, shared));
      }
      paintBell();
    });
    root.document.getElementById("bell-volume").addEventListener("input", (event) => {
      settings.set("bell.volume", Number(event.target.value) / 100);
    });
    root.document.getElementById("sit-midway").addEventListener("change", (event) => {
      settings.set("sit.midway", event.target.value);
      paintBell();
    });
    root.document.getElementById("sit-bed").addEventListener("change", (event) => settings.set("sit.background", event.target.value));
    root.document.getElementById("sit-bed-volume").addEventListener("input", (event) => {
      settings.set("sit.bedVolume", Number(event.target.value) / 100);
    });
    root.document.getElementById("sit-minutes").addEventListener("change", (event) => {
      const length = root.YantraSit.minutes(event.target.value);
      const note = root.document.getElementById("sit-minutes-note");
      if (length == null) {
        note.textContent = "Use a whole number of minutes, from 1 to 90.";
        event.target.value = String(settings.get("sit.minutes") || 15);
        return;
      }
      settings.set("sit.minutes", length);
      note.textContent = "";
    });
    root.document.getElementById("sit-silent").addEventListener("click", () => {
      root.yantraTimedSit = true;
      beginSit(true);
      if (typeof root.begin === "function") root.begin();
    });
  }

  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", bootBell);
    else bootBell();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraBell = api;
})(typeof window !== "undefined" ? window : null);
