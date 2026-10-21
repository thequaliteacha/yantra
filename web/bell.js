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

  /* Public-domain rain, listed in web/ambient/SOURCES.md. An older "rain" choice plays the steady bed. */
  const RAIN = {
    "rain-light": "/ambient/rain-light.mp3",
    "rain-steady": "/ambient/rain-steady.mp3",
    "rain-roof": "/ambient/rain-roof.mp3",
    "rain-thunder": "/ambient/rain-thunder.mp3",
  };
  const rainCache = new Map();
  const rainPending = new Map();

  function bedKind(kind) {
    if (kind === "rain") return "rain-steady";
    return kind || "silent";
  }

  /* Fade in and out. The edge stays inside the sit, and the ramp never targets zero. */
  function bedEnvelope(duration) {
    const span = Math.max(0.2, Number(duration) || 0);
    const fade = Math.min(3, span / 2, Math.max(0.35, span / 4));
    return { fade: fade, end: span };
  }

  function shapeBed(amp, when, duration, level) {
    const peak = Math.max(0.0001, level);
    const edge = bedEnvelope(duration);
    const end = when + edge.end;
    amp.gain.cancelScheduledValues(when);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(peak, when + edge.fade);
    const hold = end - edge.fade;
    if (hold > when + edge.fade + 0.02) amp.gain.setValueAtTime(peak, hold);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
  }

  /* Drop the duplicate tail so the first sample continues the one before it. */
  function seamSamples(data, n) {
    const fade = Math.min(n, Math.floor(data.length / 3));
    if (fade < 8) return data;
    const out = new Float32Array(data.length - fade);
    for (let i = 0; i < fade; i += 1) {
      const mix = i / fade;
      out[i] = data[i] * mix + data[data.length - fade + i] * (1 - mix);
    }
    out.set(data.subarray(fade, data.length - fade), fade);
    return out;
  }

  function seamBuffer(audio, buffer, seconds) {
    const data = buffer.getChannelData(0);
    const seamed = seamSamples(data, Math.floor(buffer.sampleRate * seconds));
    if (seamed === data) return buffer;
    const next = audio.createBuffer(1, seamed.length, buffer.sampleRate);
    next.getChannelData(0).set(seamed);
    return next;
  }

  function noiseBuffer(audio, kind) {
    const rate = audio.sampleRate;
    const length = rate * 2;
    const data = new Float32Array(length);
    let brown = 0;
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === "brown") {
        brown = (brown + 0.02 * white) * 0.996;
        data[i] = brown * 3.2;
      } else if (kind === "pink") {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        data[i] = white * 0.18;
      }
    }
    let mean = 0;
    for (let i = 0; i < length; i += 1) mean += data[i];
    mean /= length;
    for (let i = 0; i < length; i += 1) data[i] -= mean;
    const seamed = seamSamples(data, Math.floor(rate * 0.08));
    const buffer = audio.createBuffer(1, seamed.length, rate);
    buffer.getChannelData(0).set(seamed);
    return buffer;
  }

  function moveFilter(audio, when, filter, base, depth, rate) {
    filter.frequency.value = base;
    const lfo = audio.createOscillator();
    const amount = audio.createGain();
    lfo.frequency.value = rate;
    amount.gain.value = depth;
    lfo.connect(amount);
    amount.connect(filter.frequency);
    lfo.start(when);
    return lfo;
  }

  function loopSource(audio, buffer, when) {
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    source.start(Math.max(when, audio.currentTime));
    return source;
  }

  function loadRain(name) {
    if (!RAIN[name] || !ctx) return Promise.resolve(null);
    if (rainCache.has(name)) return Promise.resolve(rainCache.get(name));
    if (rainPending.has(name)) return rainPending.get(name);
    const audio = ctx;
    const job = fetch(RAIN[name]).then((response) => {
      if (!response.ok) throw new Error("missing");
      return response.arrayBuffer();
    }).then((bytes) => audio.decodeAudioData(bytes.slice(0))).then((decoded) => {
      const seamed = seamBuffer(audio, decoded, 0.35);
      rainCache.set(name, seamed);
      rainPending.delete(name);
      return seamed;
    }).catch(() => {
      rainPending.delete(name);
      return null;
    });
    rainPending.set(name, job);
    return job;
  }

  function attachRain(audio, bed, into, name, when) {
    const start = (buffer) => {
      if (!buffer || bed.closed) return;
      const source = loopSource(audio, buffer, when);
      const filter = audio.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 180;
      filter.Q.value = 0.7;
      source.connect(filter);
      filter.connect(into);
      bed.nodes.push(source);
    };
    const cached = rainCache.get(name);
    if (cached) {
      start(cached);
      return;
    }
    loadRain(name).then(start);
  }

  /* Noise and harmonics are synthesized here. Rain is a public-domain recording. */
  function startBed(audio, when, kind, duration) {
    const name = bedKind(kind);
    const noise = name === "white" || name === "pink" || name === "brown";
    const harmonic = name === "drone" || name === "bowl" || name === "pad";
    if (!noise && !harmonic && !RAIN[name]) return null;
    const level = Number(read("sit.bedVolume"));
    const gainValue = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0.35;
    const amp = audio.createGain();
    const nodes = [];
    const bed = { amp: amp, nodes: nodes, closed: false };
    shapeBed(amp, when, Number.isFinite(duration) && duration > 0 ? duration : 15 * 60, gainValue);
    amp.connect(audio.destination);
    if (RAIN[name]) {
      const trim = audio.createGain();
      trim.gain.value = 0.42;
      trim.connect(amp);
      attachRain(audio, bed, trim, name, when);
      return bed;
    }
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.6;
    if (name === "brown") nodes.push(moveFilter(audio, when, filter, 500, 70, 0.05));
    else if (name === "pink") nodes.push(moveFilter(audio, when, filter, 1400, 180, 0.06));
    else if (name === "white") nodes.push(moveFilter(audio, when, filter, 4000, 360, 0.07));
    else if (name === "bowl") nodes.push(moveFilter(audio, when, filter, 1400, 160, 0.06));
    else if (name === "pad") nodes.push(moveFilter(audio, when, filter, 900, 110, 0.07));
    else nodes.push(moveFilter(audio, when, filter, 480, 40, 0.05));
    filter.connect(amp);
    if (harmonic) {
      const voices = name === "bowl"
        ? [[174, 0.07], [287.4, 0.04], [349.2, 0.03], [521.5, 0.02]]
        : name === "pad"
          ? [[196, 0.05], [246.94, 0.045], [293.66, 0.04], [392, 0.03]]
          : [[110, 0.09], [164.7, 0.06]];
      voices.forEach((voice) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = name === "pad" ? "triangle" : "sine";
        osc.frequency.value = voice[0];
        gain.gain.value = voice[1];
        osc.connect(gain);
        gain.connect(filter);
        osc.start(when);
        nodes.push(osc);
      });
      return bed;
    }
    const source = loopSource(audio, noiseBuffer(audio, name), when);
    source.connect(filter);
    nodes.push(source);
    return bed;
  }

  function stopBed(bed, audio, fadeSeconds) {
    if (!bed || !audio || !bed.amp || !bed.amp.gain) return;
    bed.closed = true;
    const now = audio.currentTime;
    const fade = fadeSeconds === 0 ? 0 : (Number(fadeSeconds) > 0 ? Number(fadeSeconds) : 1.5);
    if (fade === 0) {
      stopNodes(bed.nodes, audio);
      try {
        bed.amp.gain.cancelScheduledValues(now);
        bed.amp.gain.setValueAtTime(0.0001, now);
      } catch (e) {}
      return;
    }
    try {
      bed.amp.gain.cancelScheduledValues(now);
      bed.amp.gain.setValueAtTime(Math.max(0.0001, bed.amp.gain.value || 0.0001), now);
      bed.amp.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    } catch (e) {}
    (bed.nodes || []).forEach((node) => {
      try { node.stop(now + fade + 0.05); } catch (e) {}
    });
  }

  /* The change is a gesture, so the context is resumed before the rain file is fetched. */
  function prepareBed(kind) {
    const name = bedKind(kind);
    if (!RAIN[name] || !root) return;
    unlock();
    const pending = loadRain(name);
    if (pending && pending.catch) pending.catch(() => {});
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
    const bed = timed ? startBed(audio, startAudio, read("sit.background"), plan.duration) : null;
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
    stopBed(session.bed, ctx, 0);
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
    const bed = startBed(audio, startAudio, read("sit.background"), Math.max(0.2, plan.duration - wall));
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

  const api = {
    beginSit: beginSit,
    endSit: endSit,
    unlock: unlock,
    preview: preview,
    prepareBed: prepareBed,
    PARTIALS: PARTIALS,
    strikeGap: strikeGap,
    onsets: onsets,
    bedKind: bedKind,
    bedEnvelope: bedEnvelope,
    seamSamples: seamSamples,
    shapeBed: shapeBed,
    RAIN: RAIN,
  };

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
    const storedBed = settings.get("sit.background") || "silent";
    bed.value = storedBed === "rain" ? "rain-steady" : storedBed;
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
    root.document.getElementById("sit-bed").addEventListener("change", (event) => {
      settings.set("sit.background", event.target.value);
      prepareBed(event.target.value);
    });
    root.document.getElementById("sit-bed-volume").addEventListener("input", (event) => {
      settings.set("sit.bedVolume", Number(event.target.value) / 100);
    });
    root.document.getElementById("sit-minutes").addEventListener("change", (event) => {
      const length = root.YantraSit.minutes(event.target.value);
      const note = root.document.getElementById("sit-minutes-note");
      if (length == null) {
        note.textContent = "Use a whole number of minutes, from 1 to " + root.YantraSit.MAX_MINUTES + ".";
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
