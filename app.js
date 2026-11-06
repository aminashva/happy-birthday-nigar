(() => {
  const D = window.BDAY;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = ["#ff2d95", "#ff4fd8", "#00f0ff", "#a855ff", "#ffffff", "#ff85c8"];
  const ACCENTS = { pink: "#ff2d95", cyan: "#00f0ff", violet: "#a855ff", magenta: "#ff4fd8" };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ================= BIRTHDAY MATH ================= */
  const bd = D.birthday;
  // the birthday being celebrated: this year's, unless it was more than ~2 months ago
  const now = new Date();
  let bYear = now.getFullYear();
  if (now - new Date(bYear, bd.month - 1, bd.day) > 60 * 864e5) bYear++;
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  const C = { age: bYear - bd.year };

  /* ================= STATIC TEXT ================= */
  $$("[data-name]").forEach((el) => (el.textContent = D.name));
  document.title = `Happy ${ordinal(C.age)} Birthday, ${D.name}`;
  $("#ordinal").textContent = ordinal(C.age);
  $("#tagline").textContent = D.heroTagline;
  $("#finalWish").textContent = D.finalWish;
  $("#fromName").textContent = D.from;
  $("#candleCount").textContent = C.age;
  $("#giftTitle").textContent = D.gift.title;
  $("#giftText").textContent = D.gift.text;
  $("#datePill").textContent = [bd.day, bd.month].map((n) => String(n).padStart(2, "0")).concat(bYear).join(" · ");

  /* ================= AUDIO ================= */
  let actx = null;
  const audio = () => (actx ||= new (window.AudioContext || window.webkitAudioContext)());
  const NOTE = (n) => {
    const m = n.match(/^([A-G])([#b]?)(\d)$/);
    const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + ({ "#": 1, b: -1 }[m[2]] || 0) + (m[3] - 4) * 12;
    return 440 * Math.pow(2, semis / 12);
  };
  function tone(freq, t, dur, { type = "triangle", vol = 0.12 } = {}) {
    const a = audio();
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function pop() {
    const a = audio(), t = a.currentTime;
    const buf = a.createBuffer(1, a.sampleRate * 0.12, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    const s = a.createBufferSource(), g = a.createGain();
    s.buffer = buf; g.gain.value = 0.35;
    s.connect(g).connect(a.destination); s.start(t);
    tone(rand(700, 1100), t, 0.12, { type: "sine", vol: 0.06 });
  }
  function chime() {
    const t = audio().currentTime;
    ["C5", "E5", "G5", "C6"].forEach((n, i) => tone(NOTE(n), t + i * 0.08, 0.6, { type: "sine", vol: 0.08 }));
  }

  /* ---------- MUSIC ----------
     1) If data.js `music` points to an mp3 that exists, play that.
     2) Otherwise: a built-in original track, picked by data.js `beat` ("club" or "diva"). */
  let musicOn = false, track = null;
  if (D.music) {
    track = new Audio();
    track.loop = true; track.volume = 0.7; track.preload = "auto";
    track.addEventListener("error", () => { track = null; if (musicOn) beat.start(); });
    track.src = D.music;
  }

  const beat = (() => {
    let master, echo, pump, noiseBuf, timer, step, phraseN, nextT, song;

    /* ---------- instruments ---------- */
    const env = (g, t, peak, a, d) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    };
    function kick(t, vol = 0.9, decay = 0.32) {
      const a = audio(), o = a.createOscillator(), g = a.createGain();
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      env(g, t, vol, 0.003, decay);
      o.connect(g).connect(master); o.start(t); o.stop(t + decay + 0.1);
    }
    function noise(t, { freq, type = "highpass", vol, dur, q = 0.8, attack = 0.002, sweepTo, dest = master }) {
      const a = audio(), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(freq, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      env(g, t, vol, attack, Math.max(0.01, dur - attack));
      s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + dur + 0.05);
    }
    function clap(t, vol = 0.35) {
      [0, 0.012, 0.024].forEach((o) => noise(t + o, { freq: 1400, type: "bandpass", vol, dur: 0.05, q: 1.2 }));
      noise(t + 0.03, { freq: 1200, type: "bandpass", vol: vol * 0.7, dur: 0.22, q: 0.9 });
    }
    function synth(freqs, t, dur, { type = "sawtooth", vol = 0.05, cutoff = 1800, cutoffTo, attack = 0.01, send = 0, detunes = [-7, 7], dest = master } = {}) {
      const a = audio(), f = a.createBiquadFilter(), g = a.createGain();
      f.type = "lowpass"; f.Q.value = 0.7;
      f.frequency.setValueAtTime(cutoff, t);
      if (cutoffTo) f.frequency.exponentialRampToValueAtTime(cutoffTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.08));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
      f.connect(g).connect(dest);
      if (send) { const s = a.createGain(); s.gain.value = send; g.connect(s).connect(echo); }
      freqs.forEach((fr) => detunes.forEach((dt) => {
        const o = a.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = dt;
        o.connect(f); o.start(t); o.stop(t + dur + 0.2);
      }));
    }
    // sidechain: everything on the `pump` bus ducks under each kick
    function duck(t) {
      pump.gain.cancelScheduledValues(t);
      pump.gain.setValueAtTime(0.2, t);
      pump.gain.linearRampToValueAtTime(1, t + 0.2);
    }

    /* ---------- songs (one phrase = 4 bars = 64 sixteenths) ---------- */
    const SONGS = {
      // Original diva-pop beat — Fm, Db, Ab, Eb · 102 bpm, swung
      diva: (() => {
        const CHORDS = [
          { bass: "F2", notes: ["F4", "Ab4", "C5", "Eb5"] },
          { bass: "Db2", notes: ["Db4", "F4", "Ab4", "C5"] },
          { bass: "Ab1", notes: ["C4", "Eb4", "G4", "Ab4"] },
          { bass: "Eb2", notes: ["Eb4", "G4", "Bb4", "Db5"] },
        ];
        const BASS_STEPS = { 0: 1, 3: 1, 6: 1, 10: 2, 11: 1, 14: 1 }; // 2 = octave up
        const HOOK = [ // [bar, step, note, length in 16ths]
          [0, 0, "C5", 3], [0, 3, "Ab4", 3], [0, 6, "C5", 2], [0, 8, "Eb5", 4], [0, 12, "F5", 2], [0, 14, "Eb5", 2],
          [1, 0, "F5", 3], [1, 3, "Eb5", 3], [1, 6, "Db5", 2], [1, 8, "C5", 6], [1, 14, "Ab4", 2],
          [2, 0, "C5", 3], [2, 3, "Eb5", 3], [2, 6, "Ab5", 2], [2, 8, "G5", 4], [2, 12, "Eb5", 4],
          [3, 0, "G5", 3], [3, 3, "F5", 3], [3, 6, "Eb5", 2], [3, 8, "Bb4", 4], [3, 12, "G4", 2], [3, 14, "Bb4", 2],
        ];
        return {
          bpm: 102, swing: 0.06,
          part: (n) => (n === 0 ? "intro" : "full"),
          play(st, t, part, S16) {
            const bar = Math.floor(st / 16), s = st % 16, ch = CHORDS[bar];
            const full = part === "full";
            if (full && (s === 0 || s === 8 || s === 10)) kick(t);
            if (full && (s === 4 || s === 12)) clap(t);
            if (s % 2 === 0) noise(t, { freq: 8000, vol: s % 4 === 2 ? 0.12 : 0.06, dur: 0.03 });
            if (full && bar === 3 && s >= 12) noise(t, { freq: 9000, vol: 0.07, dur: 0.02 });
            if (full && s === 14) noise(t, { freq: 6000, vol: 0.08, dur: 0.18 });
            if (BASS_STEPS[s]) {
              const f = NOTE(ch.bass) * BASS_STEPS[s];
              synth([f], t, S16 * 1.6, { vol: 0.12, cutoff: 420, detunes: [-3, 3] });
              synth([f / 2], t, S16 * 1.6, { type: "sine", vol: 0.16, cutoff: 200, detunes: [0] });
            }
            if (s === 0) synth(ch.notes.map(NOTE), t, S16 * 15, { vol: 0.018, cutoff: 1300, attack: 0.25, send: 0.4 });
            if (full && (s === 3 || s === 7 || s === 11)) synth(ch.notes.map(NOTE), t, S16 * 0.8, { type: "square", vol: 0.014, cutoff: 2600, send: 0.3 });
            if (full) HOOK.forEach(([b, hs, n, len]) => {
              if (b !== bar || hs !== s) return;
              const f = NOTE(n);
              synth([f], t, S16 * len * 0.9, { type: "square", vol: 0.035, cutoff: 3200, send: 0.55, detunes: [-9, 9] });
              synth([f * 2], t, S16 * len * 0.6, { type: "sine", vol: 0.02, cutoff: 6000, detunes: [0] });
            });
          },
        };
      })(),

      // Original club/house track — Am, F, C, G · 124 bpm, sidechained
      club: (() => {
        const CHORDS = [
          { bass: "A1", pad: ["A3", "C4", "E4", "G4"], arp: ["A4", "C5", "E5", "A5"] },
          { bass: "F1", pad: ["F3", "A3", "C4", "E4"], arp: ["F4", "A4", "C5", "F5"] },
          { bass: "C2", pad: ["G3", "C4", "E4", "G4"], arp: ["E4", "G4", "C5", "E5"] },
          { bass: "G1", pad: ["G3", "B3", "D4", "F#4"], arp: ["D4", "G4", "B4", "D5"] },
        ];
        const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 3, 2, 1, 3, 2, 1];
        const STABS = { 0: 1, 3: 1, 6: 1, 10: 1, 13: 1 };
        const ORDER = ["intro", "groove", "build", "drop", "drop", "groove", "build", "drop"];
        return {
          bpm: 124, swing: 0,
          part: (n) => ORDER[n < 4 ? n : 4 + ((n - 4) % 4)],
          play(st, t, part, S16) {
            const bar = Math.floor(st / 16), s = st % 16, ch = CHORDS[bar];
            const intro = part === "intro", build = part === "build", drop = part === "drop";
            const pad = ch.pad.map(NOTE);
            // kick: four on the floor (cuts out for the last half bar of the build)
            if (s % 4 === 0 && !(build && bar === 3 && s >= 8)) { kick(t, drop ? 1 : 0.85, 0.26); duck(t); }
            // crash on the downbeat of the drop
            if (drop && st === 0) noise(t, { freq: 4000, vol: 0.18, dur: 1.6 });
            // clap on 2 & 4
            if (!intro && !build && (s === 4 || s === 12)) clap(t, drop ? 0.4 : 0.3);
            // offbeat open hat + 16th ticks
            if (s % 4 === 2) noise(t, { freq: 7000, vol: intro ? 0.07 : 0.13, dur: 0.1 });
            if (!intro && s % 2 === 1) noise(t, { freq: 10000, vol: 0.035, dur: 0.02 });
            // build: accelerating snare roll + noise riser + opening filter
            if (build) {
              const every = bar < 2 ? 4 : bar === 2 ? 2 : 1;
              if (s % every === 0) noise(t, { freq: 1800, type: "bandpass", vol: 0.05 + 0.12 * (st / 64), dur: 0.08, q: 1 });
              if (st === 0) noise(t, { freq: 300, sweepTo: 9000, type: "bandpass", vol: 0.13, dur: S16 * 62, attack: S16 * 56, q: 2.5 });
            }
            // rolling offbeat house bass
            if (!intro && (s % 4 === 2 || (drop && s % 4 === 3))) {
              const f = NOTE(ch.bass);
              synth([f * 2], t, S16 * 0.9, { vol: 0.1, cutoff: drop ? 1100 : 600, detunes: [0, 6], dest: pump });
              synth([f], t, S16 * 0.9, { type: "sine", vol: 0.2, cutoff: 300, detunes: [0], dest: pump });
            }
            // chords: filtered pad (intro / rising through the build), supersaw stabs (groove / drop)
            if ((intro || build) && s === 0) {
              synth(pad, t, S16 * 16, {
                vol: 0.022, attack: 0.15, send: 0.3, dest: pump, detunes: [-12, 0, 12],
                cutoff: intro ? 500 : 500 + bar * 900, cutoffTo: intro ? 900 : 1400 + bar * 900,
              });
            }
            if ((part === "groove" || drop) && STABS[s]) {
              synth(pad.map((f) => f * 2), t, S16 * 1.2, { vol: drop ? 0.02 : 0.015, cutoff: drop ? 4200 : 2200, send: 0.35, dest: pump, detunes: [-14, 0, 14] });
            }
            // drop: plucked arpeggio lead
            if (drop) {
              const f = NOTE(ch.arp[ARP[s]]) * 2;
              synth([f], t, S16 * 0.8, { type: "square", vol: 0.028, cutoff: 5000, cutoffTo: 700, send: 0.5, detunes: [-5, 5] });
            }
          },
        };
      })(),
    };

    function scheduler() {
      const a = audio(), S16 = 60 / song.bpm / 4;
      while (nextT < a.currentTime + 0.15) {
        song.play(step, nextT, song.part(phraseN), S16);
        nextT += S16 * (1 + (step % 2 ? -song.swing : song.swing));
        if (++step === 64) { step = 0; phraseN++; }
      }
    }
    return {
      start() {
        const a = audio(); a.resume();
        if (timer) return;
        song = SONGS[D.beat] || SONGS.club;
        if (!noiseBuf) {
          noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        master = a.createGain(); master.gain.value = 0.55;
        const comp = a.createDynamicsCompressor();
        master.connect(comp).connect(a.destination);
        pump = a.createGain(); pump.connect(master);
        // dotted-8th echo for that glossy sheen
        echo = a.createDelay(1); echo.delayTime.value = (60 / song.bpm / 4) * 3;
        const fb = a.createGain(); fb.gain.value = 0.38;
        const damp = a.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 2400;
        echo.connect(damp).connect(fb).connect(echo);
        damp.connect(master);
        step = 0; phraseN = 0; nextT = a.currentTime + 0.1;
        timer = setInterval(scheduler, 25);
      },
      stop() {
        clearInterval(timer); timer = null;
        if (!master) return;
        const m = master, t = audio().currentTime;
        m.gain.setTargetAtTime(0.0001, t, 0.08);
        setTimeout(() => m.disconnect(), 600);
        master = null;
      },
    };
  })();

  function setMusic(on) {
    musicOn = on;
    $("#musicBtn").setAttribute("aria-pressed", on);
    if (on) {
      if (track) track.play().catch(() => { track = null; beat.start(); });
      else beat.start();
    } else {
      track?.pause();
      beat.stop();
    }
  }
  let musicTouched = false;
  $("#musicBtn").addEventListener("click", () => { musicTouched = true; setMusic(!musicOn); });

  /* ================= FX CANVAS (confetti + sparkles) ================= */
  const cv = $("#fx"), cx = cv.getContext("2d");
  let W, H, DPR;
  const parts = [];
  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize(); addEventListener("resize", resize);

  function confetti(x = W / 2, y = H / 2, n = 140, spread = 1) {
    if (reduced) n = Math.min(n, 30);
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2), sp = rand(4, 14) * spread;
      parts.push({ kind: "c", x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - rand(3, 8), rot: rand(0, 6), vr: rand(-.3, .3),
        w: rand(6, 11), h: rand(3, 6), color: pick(COLORS), life: 1, decay: rand(.004, .009), shape: Math.random() < .3 ? "o" : "r" });
    }
  }
  function confettiRain(n = 200) {
    for (let i = 0; i < n; i++) {
      parts.push({ kind: "c", x: rand(0, W), y: rand(-H * .6, -10), vx: rand(-1.5, 1.5), vy: rand(2, 5), rot: rand(0, 6), vr: rand(-.2, .2),
        w: rand(6, 11), h: rand(3, 6), color: pick(COLORS), life: 1, decay: rand(.003, .006), shape: Math.random() < .3 ? "o" : "r" });
    }
  }
  function sparkle(x, y) {
    parts.push({ kind: "s", x, y, vx: rand(-.6, .6), vy: rand(-.6, .4), r: rand(1.2, 3), color: pick(COLORS), life: 1, decay: rand(.025, .05) });
  }
  let lastSpark = 0;
  addEventListener("pointermove", (e) => {
    if (reduced || e.pointerType === "touch") return;
    const now = performance.now();
    if (now - lastSpark < 22) return;
    lastSpark = now; sparkle(e.clientX, e.clientY);
  });

  (function loop() {
    cx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= p.decay;
      if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
      cx.globalAlpha = Math.min(1, p.life * 1.5);
      if (p.kind === "c") {
        p.vx *= .985; p.vy = p.vy * .985 + .22; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.color;
        if (p.shape === "o") { cx.beginPath(); cx.arc(0, 0, p.h, 0, 7); cx.fill(); }
        else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
        cx.restore();
      } else {
        p.x += p.vx; p.y += p.vy;
        cx.shadowBlur = 12; cx.shadowColor = p.color; cx.fillStyle = p.color;
        cx.beginPath(); cx.arc(p.x, p.y, p.r * p.life, 0, 7); cx.fill(); cx.shadowBlur = 0;
      }
    }
    cx.globalAlpha = 1;
    requestAnimationFrame(loop);
  })();

  /* ================= GATE ================= */
  document.body.classList.add("locked");
  $("#gateBtn").addEventListener("click", () => {
    audio().resume();
    $("#gate").classList.add("gone");
    document.body.classList.remove("locked");
    document.body.classList.add("entered");
    setTimeout(() => { confetti(W / 2, H * .45, 220, 1.2); chime(); }, 500);
    setTimeout(() => musicTouched || setMusic(true), 1200);
    startBalloons();
  });

  /* ================= BALLOONS ================= */
  const balloonsEl = $("#balloons");
  let balloonTimer;
  function spawnBalloon() {
    if (document.hidden || balloonsEl.childElementCount > 9) return;
    const b = document.createElement("button");
    b.className = "balloon"; b.tabIndex = -1;
    b.style.left = rand(3, 90) + "%";
    b.style.setProperty("--c", pick(["#ff2d95", "#ff4fd8", "#00f0ff", "#a855ff", "#ff7cc6"]));
    b.style.setProperty("--dur", rand(9, 15) + "s");
    b.style.setProperty("--sway", rand(-60, 60) + "px");
    b.addEventListener("animationend", () => b.remove());
    b.addEventListener("pointerdown", (e) => {
      const r = b.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 40, .6);
      pop(); b.remove(); e.stopPropagation();
    });
    balloonsEl.appendChild(b);
  }
  function startBalloons() {
    if (reduced) return;
    for (let i = 0; i < 4; i++) setTimeout(spawnBalloon, i * 600);
    balloonTimer = setInterval(spawnBalloon, 1800);
  }

  /* ================= CAKE ================= */
  const candlesEl = $("#candles"), cakeEl = $("#cakeEl");
  const N = C.age, PER_ROW = 12;
  const rows = Math.ceil(N / PER_ROW);
  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / PER_ROW), col = i % PER_ROW;
    const inRow = row === rows - 1 ? N - row * PER_ROW : PER_ROW;
    const span = 216, step = span / PER_ROW;
    const offset = (span - inRow * step) / 2 + (row % 2 ? step / 2 : 0);
    const c = document.createElement("button");
    c.className = "candle";
    c.setAttribute("aria-label", `Candle ${i + 1}`);
    c.style.left = Math.min(span - 9, offset + col * step) + "px";
    c.style.bottom = (rows - 1 - row) * 24 + "px";
    c.style.zIndex = row + 1;
    c.style.height = rand(38, 48) + "px";
    c.innerHTML = `<span class="flame"></span>`;
    c.addEventListener("click", () => blowOut(c));
    candlesEl.appendChild(c);
  }
  const lit = () => $$(".candle:not(.out)", candlesEl);
  function blowOut(c) {
    if (c.classList.contains("out")) return;
    c.classList.add("out");
    if (actx) tone(rand(180, 260), audio().currentTime, .15, { type: "sine", vol: .03 });
    const left = lit().length;
    const msg = $("#wishMsg");
    if (left === 0) allOut();
    else if (left <= 3) msg.textContent = "almost there…";
    else if (left < N) msg.textContent = `${left} to go`;
  }
  function allOut() {
    stopMic();
    cakeEl.classList.add("blown");
    $("#wishMsg").textContent = `Wish made. Happy ${ordinal(N)}, ${D.name}! 💖`;
    $("#relightBtn").hidden = false;
    $("#micBtn").hidden = true;
    const r = cakeEl.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + 60, 260, 1.3);
    setTimeout(() => confettiRain(160), 400);
    chime();
  }
  $("#relightBtn").addEventListener("click", () => {
    $$(".candle", candlesEl).forEach((c) => c.classList.remove("out"));
    cakeEl.classList.remove("blown");
    $("#wishMsg").textContent = "";
    $("#relightBtn").hidden = true;
    $("#micBtn").hidden = false;
  });

  // mic blowing
  let mic = null;
  async function startMic() {
    const btn = $("#micBtn");
    if (!navigator.mediaDevices?.getUserMedia) { $("#wishMsg").textContent = "No mic here — tap the candles instead!"; return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const a = new (window.AudioContext || window.webkitAudioContext)();
      const an = a.createAnalyser(); an.fftSize = 1024;
      a.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const meter = document.createElement("div");
      meter.className = "mic-meter"; meter.innerHTML = "<i></i>";
      btn.after(meter);
      mic = { stream, a, meter, raf: 0 };
      btn.textContent = "Listening… blow! 💨"; btn.disabled = true;
      $("#wishMsg").textContent = "Close your eyes, make a wish, and blow";
      let acc = 0;
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / buf.length);
        meter.firstChild.style.width = Math.min(100, rms * 400) + "%";
        if (rms > 0.13) {
          acc += rms;
          if (acc > 0.35) {
            acc = 0;
            const l = lit();
            for (let k = 0; k < Math.ceil(rms * 8) && l.length; k++) blowOut(l.splice(Math.floor(Math.random() * l.length), 1)[0]);
          }
        }
        if (mic) mic.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      $("#wishMsg").textContent = "Mic blocked — tap the candles instead!";
    }
  }
  function stopMic() {
    if (!mic) return;
    cancelAnimationFrame(mic.raf);
    mic.stream.getTracks().forEach((t) => t.stop());
    mic.a.close(); mic.meter.remove(); mic = null;
    const btn = $("#micBtn"); btn.textContent = "🎤 Blow with mic"; btn.disabled = false;
  }
  $("#micBtn").addEventListener("click", startMic);

  /* ================= MODAL ================= */
  const modal = $("#modal"), modalBody = $("#modalBody");
  let onModalClose = null;
  function openModal(node, onClose) {
    modalBody.replaceChildren(node);
    modal.hidden = false;
    document.body.classList.add("locked");
    onModalClose = onClose;
  }
  function closeModal() {
    modal.hidden = true;
    modalBody.replaceChildren();
    document.body.classList.remove("locked");
    onModalClose?.(); onModalClose = null;
  }
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", (e) => {
    if (modal.hidden) return;
    if (e.key === "Escape") closeModal();
    if (lightboxIdx !== null && (e.key === "ArrowRight" || e.key === "ArrowLeft")) showPhoto(lightboxIdx + (e.key === "ArrowRight" ? 1 : -1));
  });

  /* ================= LETTERS ================= */
  // Every visit starts with all letters sealed (nothing is remembered between visits).
  const envWrap = $("#envelopes");
  D.letters.forEach((L, i) => {
    const accent = ACCENTS[L.accent] || ACCENTS.pink;
    const b = document.createElement("button");
    b.className = "envelope reveal";
    b.style.setProperty("--a", accent);
    b.style.transitionDelay = (i % 4) * 0.08 + "s";
    b.innerHTML = `
      <span class="env-badge">sealed</span>
      <span class="seal">♥</span>
      <span class="env-from"><b></b><span></span></span>`;
    $(".env-from b", b).textContent = "from " + L.from;
    $(".env-from span", b).textContent = L.relation || "";
    b.addEventListener("click", () => openLetter(i, b));
    envWrap.appendChild(b);
  });

  function openLetter(i, card) {
    const L = D.letters[i];
    const accent = ACCENTS[L.accent] || ACCENTS.pink;
    const wrap = document.createElement("div");
    wrap.className = "letter-wrap";
    wrap.style.setProperty("--a", accent);
    wrap.innerHTML = `<div class="env-anim"><div class="back"></div><div class="paper"></div><div class="front"></div><div class="flap"></div></div>`;
    let typing = null;
    openModal(wrap, () => clearInterval(typing));
    pop();
    requestAnimationFrame(() => requestAnimationFrame(() => $(".env-anim", wrap).classList.add("open")));

    setTimeout(() => {
      if (!wrap.isConnected) return;
      wrap.innerHTML = `
        <article class="letter">
          <button class="skip">skip ›</button>
          <p class="to"></p>
          <div class="body"></div>
        </article>`;
      $(".to", wrap).textContent = `from ${L.from} · to ${D.name}`;
      const body = $(".body", wrap), text = L.text.trim();
      const caret = document.createElement("span"); caret.className = "caret";
      const textNode = document.createTextNode("");
      body.append(textNode, caret);
      let k = 0;
      const step = Math.max(1, Math.ceil(text.length / 400)); // long letters type faster
      const finish = () => { clearInterval(typing); textNode.data = text; caret.remove(); $(".skip", wrap)?.remove(); };
      typing = setInterval(() => {
        k += step; textNode.data = text.slice(0, k);
        body.scrollTop = body.scrollHeight;
        if (k >= text.length) finish();
      }, reduced ? 0 : 22);
      $(".skip", wrap).addEventListener("click", finish);
    }, reduced ? 50 : 1500);

    $(".env-badge", card).textContent = "opened"; // heart seal stays
  }

  /* ================= GALLERY ================= */
  const board = $("#board");
  let z = 10, lightboxIdx = null;
  const photoNode = (P, cls = "") => {
    const ph = document.createElement("div");
    ph.className = "ph " + cls;
    const img = new Image();
    img.alt = P.caption || "";
    img.draggable = false;
    img.loading = "lazy";
    img.onerror = () => { ph.classList.add("placeholder"); ph.textContent = "add photo ✦"; };
    img.src = P.src;
    ph.appendChild(img);
    return ph;
  };
  const polaroids = D.photos.map((P, i) => {
    const f = document.createElement("figure");
    f.className = "polaroid";
    f.style.margin = 0;
    f.innerHTML = `<span class="tape"></span>`;
    f.append(photoNode(P));
    const cap = document.createElement("figcaption"); cap.textContent = P.caption || "";
    f.append(cap);
    board.appendChild(f);
    makeDraggable(f, i);
    return f;
  });
  function scatter() {
    const bw = board.clientWidth, bh = board.clientHeight;
    polaroids.forEach((f) => {
      const fw = f.offsetWidth, fh = f.offsetHeight;
      f.style.left = rand(8, Math.max(9, bw - fw - 8)) + "px";
      f.style.top = rand(12, Math.max(13, bh - fh - 8)) + "px";
      f.style.transform = `rotate(${rand(-14, 14)}deg)`;
      f.style.zIndex = ++z;
    });
  }
  function makeDraggable(f, i) {
    let sx, sy, ox, oy, moved = false, active = false;
    f.addEventListener("pointerdown", (e) => {
      active = true; moved = false;
      f.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY; ox = f.offsetLeft; oy = f.offsetTop;
      f.style.zIndex = ++z;
    });
    f.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) { moved = true; f.classList.add("dragging"); }
      const maxX = board.clientWidth - f.offsetWidth, maxY = board.clientHeight - f.offsetHeight;
      f.style.left = Math.max(0, Math.min(maxX, ox + dx)) + "px";
      f.style.top = Math.max(0, Math.min(maxY, oy + dy)) + "px";
    });
    const end = () => {
      if (!active) return;
      active = false; f.classList.remove("dragging");
      if (!moved) showPhoto(i);
      else f.style.transform = `rotate(${rand(-12, 12)}deg)`;
    };
    f.addEventListener("pointerup", end);
    f.addEventListener("pointercancel", () => { active = false; f.classList.remove("dragging"); });
  }
  function showPhoto(i) {
    const n = D.photos.length;
    i = (i + n) % n; lightboxIdx = i;
    const P = D.photos[i];
    const box = document.createElement("div");
    box.style.width = "min(760px, 100%)";
    const lb = document.createElement("div"); lb.className = "lightbox";
    const ph = photoNode(P); ph.className = ""; // let lightbox styles size it
    ph.querySelector("img").onerror = () => { ph.className = "placeholder"; ph.textContent = "add photo ✦"; };
    const cap = document.createElement("p"); cap.textContent = P.caption || "";
    lb.append(ph, cap);
    const nav = document.createElement("div"); nav.className = "lb-nav";
    nav.innerHTML = `<button class="btn btn-ghost">‹ prev</button><button class="btn btn-ghost">next ›</button>`;
    nav.children[0].onclick = () => showPhoto(i - 1);
    nav.children[1].onclick = () => showPhoto(i + 1);
    box.append(lb, nav);
    if (modal.hidden) openModal(box, () => (lightboxIdx = null));
    else modalBody.replaceChildren(box);
  }
  $("#shuffleBtn").addEventListener("click", scatter);
  // scatter once layout is ready
  requestAnimationFrame(scatter);
  let rT; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(scatter, 200); });

  /* ================= REASONS ================= */
  const reasons = D.reasons;
  let order = [], rIdx = 0;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  $("#reasonProgress").textContent = `${reasons.length} reasons loaded`;
  $("#reasonBtn").addEventListener("click", (e) => {
    if (rIdx >= order.length) { order = shuffle(reasons.map((_, i) => i)); rIdx = 0; }
    const n = rIdx + 1;
    const card = $("#reasonCard");
    card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
    $("#reasonNum").textContent = "#" + String(n).padStart(2, "0");
    $("#reasonText").textContent = reasons[order[rIdx++]];
    $("#reasonProgress").textContent = `${n} / ${reasons.length}`;
    e.currentTarget.textContent = n === reasons.length ? "Start over ↺" : "Another one";
    const r = card.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + 20, 30, .5);
    if (actx) tone(NOTE(pick(["C5", "E5", "G5", "A5"])), audio().currentTime, .3, { type: "sine", vol: .06 });
  });

  /* ================= QUIZ ================= */
  const quizCard = $("#quizCard");
  let qi = 0, score = 0;
  function renderQ() {
    const Q = D.quiz[qi];
    quizCard.innerHTML = `
      <div class="q-progress">${D.quiz.map((_, i) => `<i class="${i < qi ? "done" : i === qi ? "now" : ""}"></i>`).join("")}</div>
      <p class="kicker">question ${qi + 1} of ${D.quiz.length}</p>
      <h3></h3>
      <div class="options"></div>
      <p class="q-reveal" aria-live="polite"></p>
      <div class="q-foot"></div>`;
    $("h3", quizCard).textContent = Q.q;
    const opts = $(".options", quizCard);
    Q.options.forEach((o, i) => {
      const b = document.createElement("button");
      b.className = "opt"; b.textContent = o;
      b.onclick = () => answer(i, b);
      opts.appendChild(b);
    });
  }
  function answer(i, btn) {
    const Q = D.quiz[qi];
    const all = $$(".opt", quizCard);
    all.forEach((b) => (b.disabled = true));
    all[Q.answer].classList.add("right");
    if (i === Q.answer) {
      score++;
      const r = btn.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top, 50, .6);
      chime();
    } else {
      btn.classList.add("wrong");
      if (actx) tone(140, audio().currentTime, .3, { type: "sawtooth", vol: .04 });
    }
    $(".q-reveal", quizCard).textContent =
      (i === Q.answer ? "Correct! " : `Hmm… the squad voted "${Q.options[Q.answer]}". `) + (Q.reveal || "");
    const next = document.createElement("button");
    next.className = "btn";
    next.textContent = qi === D.quiz.length - 1 ? "See my score" : "Next →";
    next.onclick = () => { qi++; qi < D.quiz.length ? renderQ() : renderResult(); };
    $(".q-foot", quizCard).appendChild(next);
  }
  function renderResult() {
    const n = D.quiz.length, pct = score / n;
    const verdict = pct === 1 ? `Flawless. You know yourself as well as we do, ${D.name}.` :
      pct >= .7 ? "So close! We might know you slightly better than you do. 😌" :
      pct >= .4 ? "Interesting… we have notes. Let's discuss over cake." :
      "Wow. Clearly we're the experts on you now. 💅";
    quizCard.innerHTML = `<div class="q-result"><p class="kicker">final score</p><div class="score">${score}/${n}</div><p>${verdict}</p><button class="btn btn-ghost">Play again</button></div>`;
    $("button", quizCard).onclick = () => { qi = 0; score = 0; renderQ(); };
    if (pct >= .5) { const r = quizCard.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + 80, 160); }
  }
  renderQ();

  /* ================= GIFT + SCRATCH ================= */
  const giftBox = $("#giftBox");
  let taps = 0;
  const tapHint = document.createElement("span");
  tapHint.className = "gift-tap"; tapHint.textContent = "tap me ×3";
  giftBox.appendChild(tapHint);
  giftBox.addEventListener("click", () => {
    taps++;
    giftBox.classList.remove("shake"); void giftBox.offsetWidth; giftBox.classList.add("shake");
    if (actx) tone(NOTE(["C5", "E5", "G5"][Math.min(taps - 1, 2)]), audio().currentTime, .2, { type: "sine", vol: .07 });
    tapHint.textContent = taps === 1 ? "harder!" : taps === 2 ? "one more…" : "";
    if (taps >= 3) {
      giftBox.classList.add("open");
      const r = giftBox.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 200, 1.1);
      chime();
      setTimeout(() => { giftBox.remove(); $("#scratch").hidden = false; initScratch(); }, 800);
    }
  });

  function initScratch() {
    const c = $("#scratchCanvas"), wrap = $("#scratch");
    const w = wrap.clientWidth, h = wrap.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.scale(dpr, dpr);
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#ff0a78"); grad.addColorStop(.5, "#ff4fd8"); grad.addColorStop(1, "#a855ff");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // glitter
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${rand(.1, .6)})`; g.fillRect(rand(0, w), rand(0, h), 1.5, 1.5); }
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `900 ${Math.max(18, w / 16)}px Unbounded, sans-serif`;
    g.shadowColor = "#ff2d95"; g.shadowBlur = 20;
    g.fillText("SCRATCH ME ✦", w / 2, h / 2);
    g.shadowBlur = 0;
    g.globalCompositeOperation = "destination-out";

    let down = false, last = null, strokes = 0, done = false;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const scratch = (p) => {
      g.lineWidth = 46; g.lineCap = "round";
      g.beginPath(); g.moveTo((last || p).x, (last || p).y); g.lineTo(p.x, p.y); g.stroke();
      last = p;
      if (++strokes % 12 === 0) check();
    };
    const check = () => {
      if (done) return;
      const data = g.getImageData(0, 0, c.width, c.height).data;
      let clear = 0, total = 0;
      for (let i = 3; i < data.length; i += 4 * 40) { total++; if (data[i] === 0) clear++; }
      if (clear / total > 0.5) {
        done = true; c.classList.add("cleared");
        const r = wrap.getBoundingClientRect();
        confetti(r.left + r.width / 2, r.top + r.height / 2, 260, 1.3);
        confettiRain(220);
        chime();
      }
    };
    c.addEventListener("pointerdown", (e) => { down = true; last = null; c.setPointerCapture(e.pointerId); scratch(pos(e)); });
    c.addEventListener("pointermove", (e) => down && scratch(pos(e)));
    c.addEventListener("pointerup", () => { down = false; check(); });
  }

  /* ================= FOOTER ================= */
  $("#partyBtn").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top, 200, 1.2);
    confettiRain(120);
    chime();
  });

  /* ================= SCROLL REVEAL + NAV ================= */
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: 0.15 });
  $$(".reveal").forEach((el) => io.observe(el));

  const navLinks = $$(".dots a");
  const spy = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
  }), { rootMargin: "-45% 0px -45% 0px" });
  $$("main section").forEach((s) => spy.observe(s));

  // pause balloons when hero is off screen
  new IntersectionObserver(([en]) => { balloonsEl.style.display = en.isIntersecting ? "" : "none"; }).observe($("#hero"));
})();
