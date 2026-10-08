(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const WALK_Y = 818;
  const UFO_Y = 290;
  const PAD_X = 1288;
  const LEVELS = [
    { target: 3,  animals: [["duck", 470], ["frog", 780], ["turtle", 1000]],                                                    banner: "Level 1 â€” Abduct duck, frog & tortoise!" },
    { target: 5,  animals: [["duck", 300], ["duck", 700], ["frog", 500], ["frog", 950], ["turtle", 1100]],                      banner: "Level 2 â€” Abduct 2 ducks, 2 frogs & a tortoise!" },
    { target: 5,  animals: [["duck", 400], ["duckling", 650], ["turtle", 900], ["frog", 280], ["frog", 1050]], frogHopScale: 3.0, banner: "Level 3 â€” Watch out, the frogs jump higher!" },
    { target: 3,  animals: [["frog", 300], ["frog", 700], ["frog", 1050]],                                      frogHopScale: 6.0, frogFlee: true, banner: "Level 4 â€” 3 frogs. They flee. Good luck!" },
    { target: 4,  animals: [["duck", 400], ["frog", 650], ["turtle", 900], ["duckling", 300]], bird: true,        banner: "Level 5 â€” Watch the skies! A bird is flying!" },
    { target: 3,  animals: [["frog", 300], ["frog", 700], ["frog", 1050]],                      frogHopScale: 6.0, frogFlee: true, birds: [{ y: 260, speed: 180, waitT: 0, min: 3, max: 6 }, { y: 340, speed: 260, waitT: 2.5, min: 3, max: 6 }], banner: "Level 6 â€” 2 birds, 3 hyper frogs. Survive!" },
    { target: 10, animals: [["duck", 300], ["duck", 750], ["frog", 450], ["frog", 850], ["frog", 1050], ["turtle", 200], ["turtle", 600], ["duckling", 400], ["duckling", 900], ["croc", 700]], frogHopScale: 4.0, birds: [{ y: 230, speed: 420, waitT: 0, min: 1, max: 2 }, { y: 290, speed: 480, waitT: 1.0, min: 1, max: 2 }, { y: 350, speed: 380, waitT: 2.0, min: 1, max: 2 }], banner: "Level 7 â€” 10 animals, 3 fast birds. Chaos!" },
    { target: 10, animals: [["duck", 400], ["frog", 700], ["duckling", 1000], ["duck", 250], ["frog", 550], ["duckling", 850], ["turtle", 150], ["turtle", 950], ["croc", 650], ["frog", 1100]], frogHopScale: 3.0, animalFlee: true, banner: "Level 8 â€” They sense you coming. Sneak up!" },
    { target: 4,  animals: [["frog", 300], ["frog", 600], ["frog", 900], ["frog", 1100]], frogHopScale: 5.0, frogAttack: true, banner: "Level 9 â€” Frogs attack! Watch out!" },
    { target: 6,  animals: [["duck", 200], ["duck", 700], ["duckling", 450], ["turtle", 900], ["croc", 600], ["frog", 1050]], frogHopScale: 4.0, animalSpeedMult: 2.2, animalBounce: true, frogAttackCount: 1, birds: [{ y: 500, speed: 620, waitT: 0, min: 1, max: 3 }, { y: 290, speed: 700, waitT: 1.2, min: 1, max: 3 }, { y: 360, speed: 560, waitT: 2.4, min: 1, max: 3 }], banner: "Level 10 â€” Maximum chaos. Good luck!" },
  ];
  let currentLevel = 0;
  const UFO_W = 186;
  const UFO_H = 128;

  const fuelBar = document.getElementById("fuel-bar");
  const energyBar = document.getElementById("energy-bar");
  const scoreStat = document.getElementById("score-stat");
  const goalStat = document.getElementById("goal-stat");
  const bannerEl = document.getElementById("banner");
  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ov-title");
  const ovSub = document.getElementById("ov-sub");
  const ovBtn = document.getElementById("ov-btn");
  const pauseBtn = document.getElementById("pause-btn");

  const beamBtn = document.getElementById("beam-btn");
  const joyPad  = document.getElementById("joy-pad");
  const joyKnob = document.getElementById("joy-knob");
  const stage   = document.getElementById("stage");
  const levelLabel   = document.getElementById("level-label");
  const levelMission = document.getElementById("level-mission");
  const ovLevel = document.getElementById("ov-level");
  const isTouchDevice = navigator.maxTouchPoints > 0;

  const keys = Object.create(null);
  let pointerBeam = false;
  let beamPid = -1;
  let beamLock = 0;

  // virtual joystick state
  const joy = { active: false, pid: -1, dx: 0, dy: 0 };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  let audioCtx = null;
  function ensureAudio() {
    if (!(window._ytAudioEnabled !== false)) return null; // respect YT audio state
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      window._gameAudioCtx = audioCtx; // expose for YT audio mute/unmute
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function beep({ freq = 440, dur = 0.12, type = "sine", gain = 0.08, slide = 0 }) {
    const ac = ensureAudio();
    if (!ac) return; // audio disabled
    const t0 = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  const sfxAbduct = () => {
    beep({ freq: 280, dur: 0.18, type: "triangle", gain: 0.07, slide: 420 });
    setTimeout(() => beep({ freq: 640, dur: 0.12, type: "sine", gain: 0.06 }), 80);
  };
  const sfxScore = () => {
    beep({ freq: 880, dur: 0.1, type: "square", gain: 0.04 });
    beep({ freq: 1320, dur: 0.16, type: "sine", gain: 0.035 });
  };
  const sfxLand = () => {
    beep({ freq: 180, dur: 0.28, type: "sawtooth", gain: 0.05, slide: -80 });
    setTimeout(() => beep({ freq: 520, dur: 0.4, type: "triangle", gain: 0.07, slide: 260 }), 180);
  };
  const sfxBump = () => beep({ freq: 140, dur: 0.16, type: "square", gain: 0.06, slide: -70 });
  function noiseBurst({ dur = 0.16, gain = 0.07, freq = 400, q = 2.5, type = "bandpass" }) {
    const ac = ensureAudio();
    if (!ac) return; // audio disabled
    const n = ac.createBuffer(1, Math.max(1, (ac.sampleRate * dur) | 0), ac.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = n;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    const t0 = ac.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
  }

  function sfxAnimal(type) {
    if (type === "duck") {
      beep({ freq: 290, dur: 0.11, type: "sawtooth", gain: 0.055, slide: -90 });
      noiseBurst({ dur: 0.13, gain: 0.07, freq: 480, q: 5 });
      setTimeout(() => beep({ freq: 250, dur: 0.1, type: "sawtooth", gain: 0.04, slide: -50 }), 120);
    } else if (type === "duckling") {
      beep({ freq: 430, dur: 0.09, type: "sawtooth", gain: 0.05, slide: -70 });
      noiseBurst({ dur: 0.1, gain: 0.05, freq: 700, q: 6 });
    } else if (type === "croc") {
      beep({ freq: 78, dur: 0.32, type: "sawtooth", gain: 0.07, slide: -18 });
      noiseBurst({ dur: 0.28, gain: 0.06, freq: 140, q: 0.9, type: "lowpass" });
    } else if (type === "turtle") {
      beep({ freq: 760, dur: 0.09, type: "sine", gain: 0.05, slide: -220 });
      beep({ freq: 520, dur: 0.14, type: "triangle", gain: 0.04, slide: -80 });
    } else {
      beep({ freq: 205, dur: 0.07, type: "square", gain: 0.05, slide: -35 });
      setTimeout(() => beep({ freq: 155, dur: 0.16, type: "square", gain: 0.055, slide: -25 }), 85);
    }
  }

  let engine = null;
  function setEngine(on, intensity = 1) {
    if (!on) {
      if (engine) {
        const ac = audioCtx;
        if (ac) engine.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.1);
      }
      return;
    }
    const ac = ensureAudio();
    if (!ac) return; // audio disabled
    if (!ac) return; // audio disabled
    if (!engine) {
      const osc = ac.createOscillator();
      const osc2 = ac.createOscillator();
      const filter = ac.createBiquadFilter();
      const gain = ac.createGain();
      osc.type = "sawtooth";
      osc2.type = "sine";
      osc.frequency.value = 88;
      osc2.frequency.value = 176;
      filter.type = "lowpass";
      filter.frequency.value = 420;
      gain.gain.value = 0.0001;
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc2.start();
      engine = { osc, osc2, filter, gain };
    }
    const t = ac.currentTime;
    const i = clamp(intensity, 0, 1);
    engine.gain.gain.setTargetAtTime(0.028 + i * 0.03, t, 0.08);
    engine.osc.frequency.setTargetAtTime(72 + i * 70, t, 0.1);
    engine.osc2.frequency.setTargetAtTime(144 + i * 90, t, 0.1);
    engine.filter.frequency.setTargetAtTime(280 + i * 220, t, 0.1);
  }

  function movePressed() {
    return !!(keys.ArrowLeft || keys.a || keys.A || keys.ArrowRight || keys.d || keys.D ||
      keys.ArrowUp || keys.w || keys.W || keys.ArrowDown || keys.s || keys.S ||
      (joy.active && (Math.abs(joy.dx) > 0.1 || Math.abs(joy.dy) > 0.1)));
  }

  const ANIMAL_DEFS = {
    croc: { score: 150, speed: 34, w: 210, h: 108, img: "croc", pick: "largest" },
    duck: { score: 100, speed: 72, w: 108, h: 102, img: "duck", pick: "center" },
    duckling: { score: 80, speed: 98, w: 72, h: 70, img: "duckling", pick: "right" },
    turtle: { score: 120, speed: 24, w: 118, h: 96, img: "turtle", pick: "largest" },
    frog: { score: 110, speed: 56, w: 92, h: 84, img: "frog", pick: "largest" },
  };

  const SPRITE_SRC = {
    bg: SPRITE_B64.bg,
    ufo: SPRITE_B64.ufo,
    croc: SPRITE_B64.croc,
    duck: SPRITE_B64.duck,
    duckling: SPRITE_B64.duckling,
    turtle: SPRITE_B64.turtle,
    frog: SPRITE_B64.frog,
  };

  const sprites = Object.create(null);

  function chromaOf(r, g, b) {
    return {
      cb: 128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
      cr: 128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
    };
  }

  function processSprite(img, mode) {
    const src = document.createElement("canvas");
    src.width = img.width;
    src.height = img.height;
    const sctx = src.getContext("2d");
    sctx.drawImage(img, 0, 0);
    const data = sctx.getImageData(0, 0, src.width, src.height);
    const d = data.data;
    const w = src.width;
    const h = src.height;
    const n = w * h;
    const samples = [];
    const inset = Math.max(2, Math.min(w, h) * 0.04);
    [[inset, inset], [w - 1 - inset, inset], [inset, h - 1 - inset], [w - 1 - inset, h - 1 - inset],
     [w * 0.5, inset], [inset, h * 0.5]].forEach(([x, y]) => {
      const i = (((y | 0) * w) + (x | 0)) * 4;
      samples.push([d[i], d[i + 1], d[i + 2]]);
    });
    const key = samples.reduce((a, s) => [a[0] + s[0], a[1] + s[1], a[2] + s[2]], [0, 0, 0]).map((v) => v / samples.length);
    const keyCh = chromaOf(key[0], key[1], key[2]);
    const nearKey = (r, g, b) => {
      const rgb = Math.hypot(r - key[0], g - key[1], b - key[2]);
      const ch = chromaOf(r, g, b);
      const cd = Math.hypot(ch.cb - keyCh.cb, ch.cr - keyCh.cr);
      const pink = r > 130 && g < 110 && b > 40 && r > g + 50;
      const white = r > 245 && g > 245 && b > 245;
      return rgb < 95 || cd < 42 || pink || white;
    };

    const keyed = new Uint8Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      if (nearKey(d[i], d[i + 1], d[i + 2])) keyed[p] = 1;
    }
    const stack = [];
    for (let x = 0; x < w; x++) stack.push(x, n - w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    const flood = new Uint8Array(n);
    while (stack.length) {
      const q = stack.pop();
      if (q < 0 || q >= n || flood[q]) continue;
      flood[q] = 1;
      const i = q * 4;
      if (!nearKey(d[i], d[i + 1], d[i + 2]) && !keyed[q]) continue;
      keyed[q] = 1;
      const qx = q % w;
      if (qx > 0) stack.push(q - 1);
      if (qx < w - 1) stack.push(q + 1);
      if (q >= w) stack.push(q - w);
      if (q < n - w) stack.push(q + w);
    }
    for (let pass = 0; pass < 2; pass++) {
      const copy = keyed.slice();
      for (let p = 0; p < n; p++) {
        if (copy[p]) continue;
        const qx = p % w;
        let nKey = 0;
        if (qx > 0 && copy[p - 1]) nKey++;
        if (qx < w - 1 && copy[p + 1]) nKey++;
        if (p >= w && copy[p - w]) nKey++;
        if (p < n - w && copy[p + w]) nKey++;
        if (nKey >= 3) keyed[p] = 1;
      }
    }
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      if (keyed[p]) d[i + 3] = 0;
    }
    const mask = new Uint8Array(n);
    for (let p = 0; p < n; p++) mask[p] = keyed[p] ? 0 : 1;

    const visited = new Uint8Array(n);
    const blobs = [];
    for (let p = 0; p < n; p++) {
      if (!mask[p] || visited[p]) continue;
      const cells = [];
      const queue = [p];
      visited[p] = 1;
      let sx = 0;
      let sy = 0;
      while (queue.length) {
        const q = queue.pop();
        cells.push(q);
        const qx = q % w;
        const qy = (q / w) | 0;
        sx += qx;
        sy += qy;
        const neigh = [q - 1, q + 1, q - w, q + w];
        for (let k = 0; k < 4; k++) {
          const t = neigh[k];
          if (t < 0 || t >= n) continue;
          if (k === 0 && qx === 0) continue;
          if (k === 1 && qx === w - 1) continue;
          if (!mask[t] || visited[t]) continue;
          visited[t] = 1;
          queue.push(t);
        }
      }
      blobs.push({
        cells,
        size: cells.length,
        cx: sx / cells.length,
        cy: sy / cells.length,
      });
    }

    blobs.sort((a, b) => b.size - a.size);
    let chosen = blobs[0];
    if (mode === "center") {
      let best = Infinity;
      blobs.forEach((b) => {
        if (b.size < n * 0.01) return;
        const dist = Math.hypot(b.cx - w / 2, b.cy - h / 2);
        if (dist < best) {
          best = dist;
          chosen = b;
        }
      });
    } else if (mode === "right") {
      chosen = blobs.filter((b) => b.size > n * 0.008).sort((a, b) => b.cx - a.cx)[0] || chosen;
    }

    const keep = new Uint8Array(n);
    if (chosen) chosen.cells.forEach((p) => { keep[p] = 1; });
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      if (!keep[p]) d[i + 3] = 0;
      else {
        const x = p % w;
        const y = (p / w) | 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    sctx.putImageData(data, 0, 0);
    if (!chosen) return src;

    const pad = 6;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d").drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load " + src));
      img.src = src;
    });
  }

  async function loadSprites() {
    const entries = Object.entries(SPRITE_SRC);
    const imgs = await Promise.all(entries.map(([, src]) => loadImage(src)));
    entries.forEach(([key], i) => {
      if (key === "bg") sprites.bg = imgs[i];
      else {
        const mode = key === "duck" ? "center" : key === "duckling" ? "right" : "largest";
        sprites[key] = processSprite(imgs[i], mode);
      }
    });
    const ic = document.getElementById("icon-ufo");
    const ictx = ic.getContext("2d");
    ictx.clearRect(0, 0, ic.width, ic.height);
    const u = sprites.ufo;
    const scale = Math.min(ic.width / u.width, ic.height / u.height);
    const dw = u.width * scale;
    const dh = u.height * scale;
    ictx.drawImage(u, (ic.width - dw) / 2, (ic.height - dh) / 2, dw, dh);

    const ovUfo = document.getElementById("ov-ufo");
    const ovUctx = ovUfo.getContext("2d");
    let ovBobT = 0;
    function drawOvUfo() {
      ovBobT += 0.03;
      const bob = Math.sin(ovBobT * 3.1) * 5;
      ovUctx.clearRect(0, 0, ovUfo.width, ovUfo.height);
      const uscale = Math.min(ovUfo.width / u.width, ovUfo.height / u.height) * 0.92;
      const udw = u.width * uscale;
      const udh = u.height * uscale;
      ovUctx.drawImage(u, (ovUfo.width - udw) / 2, (ovUfo.height - udh) / 2 + bob, udw, udh);
      requestAnimationFrame(drawOvUfo);
    }
    drawOvUfo();
  }

  function makeGame() {
    return {
      state: "title",
      t: 0,
      last: 0,
      score: 0,
      collected: 0,
      fuel: 100,
      energy: 100,
      ufo: { x: 620, y: UFO_Y, vx: 0, vy: 0, bob: 0, beam: false, landing: false, flash: 0, tilt: 0, grounded: false, armed: false },
      animals: [],
      birds: [],
      particles: [],
      floaters: [],
      sparkles: [],
      message: "",
      messageT: 0,
      completeT: 0,
      hitCD: 0,
    };
  }

  let G = makeGame();

  function spawnAnimal(type, x) {
    const def = ANIMAL_DEFS[type];
    G.animals.push({
      type,
      x: x ?? rand(220, 1120),
      y: WALK_Y,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: def.speed * rand(0.88, 1.12) * (LEVELS[currentLevel].animalSpeedMult ?? 1.0),
      canAttack: type === "frog" && ((LEVELS[currentLevel].frogAttackCount ?? 0) > 0 ? frogAttackSpawned++ < LEVELS[currentLevel].frogAttackCount : (LEVELS[currentLevel].frogAttack ?? false)),
      hopScale: type === "frog" ? frogHopScale() : 1.0,
      phase: rand(0, Math.PI * 2),
      walk: rand(0, 1),
      state: "walk",
      lift: 0,
      wiggle: 0,
      hop: 0,
      scare: 0,
      scareHold: 0,
      cried: false,
      attacking: false,
      attackCD: rand(1, 3),
      attackVx: 0,
      attackVy: 0,
    });
  }

  let frogAttackSpawned = 0;

  const BIRD_Y = UFO_Y;
  const BIRD_SPEED = 210;

  function fillLevel() {
    G.animals = [];
    frogAttackSpawned = 0;
    LEVELS[currentLevel].animals.forEach(([t, x]) => spawnAnimal(t, x));
    const lvl = LEVELS[currentLevel];
    if (lvl.birds) {
      G.birds = lvl.birds.map((b) => ({ x: -60, y: b.y, speed: b.speed, waiting: b.waitT > 0, waitT: b.waitT, minWait: b.min ?? 3, maxWait: b.max ?? 6 }));
    } else if (lvl.bird) {
      G.birds = [{ x: -60, y: BIRD_Y, speed: BIRD_SPEED, waiting: false, waitT: 0, minWait: 3, maxWait: 6 }];
    } else {
      G.birds = [];
    }
  }

  function levelTarget() { return LEVELS[currentLevel].target; }
  function frogHopScale() { return LEVELS[currentLevel].frogHopScale ?? 1.0; }
  function frogFlee() { return LEVELS[currentLevel].frogFlee ?? false; }
  function animalFlee() { return LEVELS[currentLevel].animalFlee ?? false; }
  function frogAttack() { return LEVELS[currentLevel].frogAttack ?? false; }

  function banner(text) {
    G.message = text;
    G.messageT = 2.4;
    bannerEl.textContent = text;
    bannerEl.classList.remove("hidden");
  }

  function addFloater(x, y, text) {
    G.floaters.push({ x, y, text, life: 1.2, vy: -70 });
  }

  function burst(x, y, color, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(50, 240);
      G.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: rand(0.4, 0.9),
        max: 0.9,
        r: rand(2, 5.5),
        color,
      });
    }
  }

  function beamRect() {
    const u = G.ufo;
    const top = u.y + 4;
    const bot = Math.max(top + 24, WALK_Y + 8);
    return {
      x: u.x,
      top,
      bot,
      topW: 48,
      botW: 120,
    };
  }

  function inBeam(px, py, halfW) {
    if (!G.ufo.beam) return false;
    const b = beamRect();
    if (py < b.top - 10 || py > b.bot + 12) return false;
    const t = clamp((py - b.top) / (b.bot - b.top), 0, 1);
    const w = lerp(b.topW, b.botW, t);
    return Math.abs(px - b.x) < w * 0.5 + halfW;
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function ufoHitbox() {
    const u = G.ufo;
    return { x: u.x - 70, y: u.y - 108, w: 140, h: 100 };
  }

  function sceneryBoxes() {
    const boxes = [
      { x: 28, y: WALK_Y - 168, w: 210, h: 168, name: "lab" },
      { x: 1488, y: WALK_Y - 175, w: 110, h: 175, name: "tree" },
      { x: 0, y: WALK_Y + 2, w: W, h: 120, name: "ground" },
    ];
    if (!(G.collected >= levelTarget() && G.state !== "play")) {
      boxes.push({ x: 1228, y: WALK_Y - 62, w: 128, h: 62, name: "pad" });
    }
    return boxes;
  }

  function separateUFO(box) {
    const u = G.ufo;
    if (box.name === "ground") {
      u.y = WALK_Y + 6;
      u.vy = 0;
      u.grounded = true;
      return;
    }
    const h = ufoHitbox();
    const overlapX = Math.min(h.x + h.w, box.x + box.w) - Math.max(h.x, box.x);
    const overlapY = Math.min(h.y + h.h, box.y + box.h) - Math.max(h.y, box.y);
    if (overlapX < overlapY) {
      const left = (h.x + h.w / 2) < (box.x + box.w / 2);
      u.x += left ? -overlapX : overlapX;
      u.vx = left ? -Math.abs(u.vx) * 0.4 - 90 : Math.abs(u.vx) * 0.4 + 90;
    } else {
      const up = (h.y + h.h / 2) < (box.y + box.h / 2);
      u.y += up ? -overlapY : overlapY;
      u.vy = up ? -Math.abs(u.vy) * 0.25 : Math.abs(u.vy) * 0.2;
    }
  }

  function energyOut() {
    if (G.state === "fail" || G.state === "complete" || G.state === "landing") return;
    G.state = "fail";
    G.ufo.beam = false;
    banner("Out of energy!");
    showOverlay("GAME OVER", "Energy hit 0. Keep the UFO in the air and don't crash.", "TRY AGAIN");
  }

  function bumpEnergy(amount, x, y) {
    if (G.hitCD > 0 || G.state === "fail") return;
    G.hitCD = 0.4;
    G.energy = clamp(G.energy - amount, 0, 100);
    G.ufo.flash = 0.22;
    sfxBump();
    burst(x, y, "#ff8a4a", 14);
    if (G.energy <= 0) energyOut();
  }

  function resolveCollisions() {
    if (G.state === "landing" || G.state === "fail") return;
    const u = G.ufo;
    const fallSpeed = u.vy;
    sceneryBoxes().forEach((box) => {
      if (!aabb(ufoHitbox(), box)) return;
      if (box.name === "ground") {
        separateUFO(box);
        if (fallSpeed > 70) bumpEnergy(14, u.x, u.y - 20);
        return;
      }
      separateUFO(box);
      bumpEnergy(16, u.x, u.y - 40);
    });
    G.animals.forEach((a) => {
      if (a.state !== "walk") return;
      const def = ANIMAL_DEFS[a.type];
      const box = { x: a.x - def.w * 0.38, y: a.y - def.h * 0.85, w: def.w * 0.76, h: def.h * 0.8 };
      if (!aabb(ufoHitbox(), box)) return;
      separateUFO(box);
      a.dir *= -1;
      a.x += a.dir * 18;
      bumpEnergy(18, a.x, a.y - 30);
    });
  }

  function flyUFO(dt) {
    const u = G.ufo;
    const beaming = (keys[" "] || keys.Space || pointerBeam) && G.energy > 0 && G.collected < levelTarget() && G.state === "play" && !u.landing;
    if (!u.armed) {
      if (movePressed() || joy.active) u.armed = true;
      else {
        u.vx = 0;
        u.vy = 0;
        u.tilt = lerp(u.tilt, 0, clamp(dt * 8, 0, 1));
        setEngine(false);
        return;
      }
    }

    const up = keys.ArrowUp || keys.w || keys.W;
    const down = keys.ArrowDown || keys.s || keys.S;
    let ax = 0;
    if (keys.ArrowLeft || keys.a || keys.A) ax -= 1;
    if (keys.ArrowRight || keys.d || keys.D) ax += 1;
    u.grounded = false;

    // blend keyboard + joystick
    ax = clamp(ax + joy.dx, -1, 1);
    const pUp   = joy.dy < 0 ? -joy.dy : 0;
    const pDown = joy.dy > 0 ?  joy.dy : 0;

    const joyMoving = joy.active && (Math.abs(joy.dx) > 0.08 || Math.abs(joy.dy) > 0.08);

    if (beaming) {
      u.vx = lerp(u.vx, 0, clamp(dt * 10, 0, 1));
      u.vy = lerp(u.vy, 0, clamp(dt * 10, 0, 1));
      if (Math.abs(u.vx) < 8) u.vx = 0;
      if (Math.abs(u.vy) < 8) u.vy = 0;
      setEngine(true, 0.22);
    } else if (joyMoving && !up && !down && !(keys.ArrowLeft || keys.a || keys.A) && !(keys.ArrowRight || keys.d || keys.D)) {
      // joystick-only: move directly in joystick direction, no gravity
      u.vx = lerp(u.vx, joy.dx * 320, clamp(dt * 7, 0, 1));
      u.vy = lerp(u.vy, joy.dy * 240, clamp(dt * 7, 0, 1));
      const spd = Math.hypot(u.vx, u.vy);
      setEngine(true, clamp(spd / 280, 0.25, 1));
    } else if (!joyMoving && !up && !down && !(keys.ArrowLeft || keys.a || keys.A) && !(keys.ArrowRight || keys.d || keys.D)) {
      // no input at all â€” hover in place
      u.vx = lerp(u.vx, 0, clamp(dt * 8, 0, 1));
      u.vy = lerp(u.vy, 0, clamp(dt * 8, 0, 1));
      if (Math.abs(u.vx) < 4) u.vx = 0;
      if (Math.abs(u.vy) < 4) u.vy = 0;
      setEngine(false);
    } else {
      u.vx = lerp(u.vx, ax * 220, clamp(dt * 6, 0, 1));
      if (up || pUp > 0) u.vy -= 900 * (up ? 1 : pUp) * dt;
      else if (down || pDown > 0) u.vy += 400 * (down ? 1 : pDown) * dt;
      else u.vy = lerp(u.vy, 0, clamp(dt * 8, 0, 1));
      u.vy = clamp(u.vy, -280, 280);
      const spd = Math.hypot(u.vx, u.vy);
      setEngine(spd > 12 || movePressed(), clamp(spd / 280, 0.25, 1));
    }

    const newX = u.x + u.vx * dt;
    const newY = u.y + u.vy * dt;
    u.x = clamp(newX, 120, 1480);
    u.y = clamp(newY, 140, WALK_Y + 24);
    u.tilt = lerp(u.tilt, ax * 0.12, clamp(dt * 8, 0, 1));
    const thrusting = up || pUp > 0 || Math.abs(ax) > 0.05;
    G.fuel = clamp(G.fuel - (thrusting ? 1.6 : 0.1) * dt, 0, 100);
    resolveCollisions();
    if (newX < 120 || newX > 1480) { bumpEnergy(12, u.x, u.y); u.vx *= -0.3; }
    if (newY < 140) { bumpEnergy(12, u.x, u.y); u.vy *= -0.3; }
  }

  let totalScore = 0;

  function showOverlay(title, sub, action, isComplete, fuelSnapshot, nextLvl, lvlBadge) {
    ovTitle.textContent = title;
    ovLevel.textContent = lvlBadge || "";
    const panel = overlay.querySelector(".panel");
    panel.classList.remove("panel-complete", "panel-gameover");
    if (isComplete) panel.classList.add("panel-complete");
    if (isComplete) {
      ovSub.innerHTML = `
        <div class="panel-stars">â­â­â­</div>
        <div class="panel-stats">
          <div class="stat-card"><span class="sc-icon">ðŸ¾</span><span class="sc-val">${G.collected}</span><span class="sc-lbl">Animals</span></div>
          <div class="stat-card"><span class="sc-icon">â­</span><span class="sc-val">${G.score}</span><span class="sc-lbl">Score</span></div>
          <div class="stat-card"><span class="sc-icon">â›½</span><span class="sc-val">${Math.round(fuelSnapshot ?? G.fuel)}%</span><span class="sc-lbl">Fuel Left</span></div>
        </div>`;
    } else {
      ovSub.textContent = sub;
    }
    ovBtn.textContent = action;
    ovBtn.dataset.nextLvl = nextLvl ?? "";
    ovBtn.dataset.mode = "";
    overlay.classList.add("show");
  }

  function showGameComplete(fuelSnapshot) {
    totalScore += G.score;
    G.state = "gameover";
    ovTitle.textContent = "YOU WIN!";
    const panel = overlay.querySelector(".panel");
    panel.classList.remove("panel-complete");
    panel.classList.add("panel-gameover");
    ovSub.innerHTML = `
      <div class="panel-stars">ðŸ†ðŸ›¸ðŸ†</div>
      <div class="gc-msg">All 10 levels conquered!</div>
      <div class="panel-stats">
        <div class="stat-card"><span class="sc-icon">â­</span><span class="sc-val">${totalScore}</span><span class="sc-lbl">Total Score</span></div>
        <div class="stat-card"><span class="sc-icon">ðŸ¾</span><span class="sc-val">10</span><span class="sc-lbl">Levels Done</span></div>
        <div class="stat-card"><span class="sc-icon">â›½</span><span class="sc-val">${Math.round(fuelSnapshot ?? G.fuel)}%</span><span class="sc-lbl">Fuel Left</span></div>
      </div>`;
    ovBtn.textContent = "PLAY AGAIN";
    ovBtn.dataset.nextLvl = "0";
    ovBtn.dataset.mode = "restart";
    overlay.classList.add("show");
  }

  function hideOverlay() {
    overlay.classList.remove("show");
  }

  function startLevel(lvl) {
    if (lvl === 0) totalScore = 0;
    currentLevel = lvl ?? 0;
    G = makeGame();
    G.state = "play";
    G.last = performance.now();
    fillLevel();
    beamLock = 0.4;
    pointerBeam = false;
    hideOverlay();
    stage.classList.add("playing");
    const lvlData = LEVELS[currentLevel];
    levelLabel.textContent = "LEVEL " + (currentLevel + 1);
    levelMission.textContent = lvlData.banner;
    beep({ freq: 660, dur: 0.1, type: "sine", gain: 0.07 });
  }

  function togglePause() {
    if (G.state === "play" || G.state === "toPad") {
      G.state = "paused";
      showOverlay("PAUSED", "Hover until you press a move key. Hold Space to beam â€” the UFO almost stops.", "RESUME");
    } else if (G.state === "paused") {
      hideOverlay();
      G.state = G.collected >= levelTarget() ? "toPad" : "play";
      G.last = performance.now();
    }
  }



  // YouTube-controlled pause (separate from in-game pause button)
  let _ytForcePaused = false;
  window._ytPauseGame = function () {
    if (_ytForcePaused) return;
    _ytForcePaused = true;
    setEngine(false);
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
  };
  window._ytResumeGame = function () {
    if (!_ytForcePaused) return;
    _ytForcePaused = false;
    G.last = performance.now();
    if (window._ytAudioEnabled !== false && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  function updateHUD() {
    fuelBar.style.width = G.fuel + "%";
    energyBar.style.width = G.energy + "%";
    fuelBar.className = G.fuel < 22 ? "crit" : G.fuel < 40 ? "low" : "";
    energyBar.className = G.energy < 18 ? "low" : "";
    scoreStat.textContent = String(G.score);
    goalStat.textContent = G.collected + " / " + levelTarget();
    if (G.messageT <= 0) bannerEl.classList.add("hidden");
  }

  function update(dt) {
    G.t += dt;
    G.ufo.bob += dt;
    if (G.messageT > 0) G.messageT -= dt;
    if (beamLock > 0) beamLock -= dt;

    if (G.state === "title" || G.state === "complete" || G.state === "paused" || G.state === "fail" || G.state === "gameover") {
      setEngine(false);
      updateHUD();
      return;
    }

    if (G.state === "birdHit") {
      const u = G.ufo;
      if (!G.birdHitGrounded) {
        u.vy = clamp(u.vy + 520 * dt, 0, 520);
        u.y += u.vy * dt;
        u.tilt = lerp(u.tilt, 0.35, clamp(dt * 6, 0, 1));
        if (u.y >= WALK_Y + 6) {
          u.y = WALK_Y + 6;
          G.birdHitGrounded = true;
          G.birdHitPauseT = 2.0;
          burst(u.x, u.y - 20, "#ff4444", 28);
        }
      } else {
        G.birdHitPauseT -= dt;
        if (G.birdHitPauseT <= 0) {
          G.state = "fail";
          showOverlay("GAME OVER", "A bird crashed into your UFO!", "TRY AGAIN");
        }
      }
      updateHUD();
      return;
    }

    if (G.hitCD > 0) G.hitCD -= dt;
    if (G.ufo.flash > 0) G.ufo.flash -= dt;

    const u = G.ufo;
    const wantBeam = beamLock <= 0 && (keys[" "] || keys.Space || pointerBeam) && G.energy > 0 && G.collected < levelTarget() && !u.landing;

    if (G.state === "play" || G.state === "toPad") {
      flyUFO(dt);
      u.beam = G.state === "play" && !!wantBeam;
      if (u.beam) {
        G.energy = clamp(G.energy - 13 * dt, 0, 100);
        if (G.energy <= 0) {
          u.beam = false;
          energyOut();
        }
      }
      if (G.fuel <= 0) {
        G.state = "fail";
        u.beam = false;
        banner("Out of fuel!");
        showOverlay("GAME OVER", "You ran out of fuel.", "TRY AGAIN");
      }
      if (G.energy <= 0 && G.state !== "fail") energyOut();
      if (G.state === "toPad" && Math.abs(u.x - PAD_X) < 64 && u.y > WALK_Y - 120) {
        G.state = "landing";
        G.fuelAtLanding = G.fuel;
        u.landing = true;
        u.beam = false;
        setEngine(false);
        sfxLand();
      }
    }

    if (G.state === "landing") {
      u.y = lerp(u.y, WALK_Y - 78, clamp(dt * 1.5, 0, 1));
      u.x = lerp(u.x, PAD_X, clamp(dt * 3, 0, 1));
      if (u.y > WALK_Y - 88) {
        G.completeT += dt;
        burst(u.x, u.y + 20, "#ffe56a", 6);
        if (G.completeT > 0.9) {
          G.state = "complete";
          const nextLvl = currentLevel + 1;
          const hasNext = nextLvl < LEVELS.length;
          // Cloud save: persist highest reached level
          if (window._ytSaveData) {
            window._ytSaveData({ highestLevel: nextLvl, totalScore: totalScore + G.score });
          }
          if (hasNext) {
            showOverlay("LEVEL COMPLETE!", "", "NEXT LEVEL", true, G.fuelAtLanding, nextLvl, "LEVEL " + (nextLvl + 1));
          } else {
            showGameComplete(G.fuelAtLanding);
          }
        }
      }
    }

    G.sparkles = G.sparkles.filter((s) => {
      s.life -= dt;
      s.y += s.vy * dt;
      s.x += s.vx * dt;
      return s.life > 0;
    });

    if (u.beam) {
      const b = beamRect();
      for (let i = 0; i < 4; i++) {
        G.sparkles.push({
          x: b.x + rand(-58, 58),
          y: rand(b.top, b.bot),
          vx: rand(-18, 18),
          vy: rand(-90, -24),
          life: rand(0.25, 0.65),
          r: rand(1.6, 3.8),
        });
      }
    }

    G.animals.forEach((a) => {
      a.phase += dt * 8;
      const def = ANIMAL_DEFS[a.type];
      const caught = inBeam(a.x, a.y - def.h * 0.35, def.w * 0.28);

      if (a.state === "walk") {
        if (a.canAttack) {
          const inLight = G.ufo.beam && inBeam(a.x, a.y - ANIMAL_DEFS.frog.h * 0.35, ANIMAL_DEFS.frog.w * 0.28);
          if (inLight && !a.attacking) {
            a.scare = 1;
            a.scareHold += dt;
            if (!a.cried) { a.cried = true; sfxAnimal("frog"); }
            if (a.scareHold > 0.28) { a.state = "lift"; sfxAbduct(); }
          } else {
            a.scare = lerp(a.scare, 0, clamp(dt * 7, 0, 1));
            a.scareHold = 0;
            a.cried = false;
            if (a.attacking) {
              a.x += a.attackVx * dt;
              a.y += a.attackVy * dt;
              a.attackVy += 900 * dt;
              a.hop = 0;
              const ubox = ufoHitbox();
              if (a.x > ubox.x && a.x < ubox.x + ubox.w && a.y > ubox.y && a.y < ubox.y + ubox.h) {
                bumpEnergy(18, a.x, a.y);
                a.attacking = false;
                a.y = WALK_Y;
                a.attackCD = rand(2, 4);
              } else if (a.y >= WALK_Y) {
                a.y = WALK_Y;
                a.attacking = false;
                a.attackCD = rand(2, 4);
              }
              a.walk += dt * (a.speed / 26);
            } else {
              if (a.attackCD > 0) a.attackCD -= dt;
              const hs = a.hopScale;
              a.walk += dt * (a.speed / 26);
              const hopT = a.walk % 1;
              const airEnd = Math.min(0.28 + 0.44 * hs, 0.95);
              const airborne = hopT > 0.28 && hopT < airEnd;
              const hopSpeed = airborne ? 1.35 * hs : 0.35;
              a.hop = airborne ? Math.sin((hopT - 0.28) / (airEnd - 0.28) * Math.PI) : 0;
              a.x += a.dir * a.speed * hopSpeed * dt;
              if (a.attackCD <= 0) {
                const dx = u.x - a.x;
                const anyAttacking = G.animals.some((o) => o !== a && o.type === "frog" && o.attacking);
                if (Math.abs(dx) < 500 && !anyAttacking) {
                  a.attacking = true;
                  a.dir = dx > 0 ? 1 : -1;
                  const dist = Math.hypot(dx, u.y - a.y);
                  const t = Math.max(0.5, dist / 600);
                  a.attackVx = dx / t;
                  a.attackVy = (u.y - a.y) / t - 0.5 * 900 * t;
                }
              }
              if (LEVELS[currentLevel].animalBounce) {
                if (a.x < 150) { a.x = 150; a.dir = 1; }
                if (a.x > W - 150) { a.x = W - 150; a.dir = -1; }
              } else {
                if (a.x < -80) a.x = W + 80;
                if (a.x > W + 80) a.x = -80;
              }
            }
          }
          return;
        }
        const inLight = G.ufo.beam && caught;
        if (inLight && G.state === "play") {
          if (a.type === "frog" && a.hopScale > 1.0) {
            a.hopScale = 1.0;
            a.scareHold = 0;
            a.cried = false;
            a.walk = 0;
            a.hop = 0;
            a.scare = lerp(a.scare, 0, clamp(dt * 7, 0, 1));
          } else {
            a.scare = 1;
            a.scareHold += dt;
            if (!a.cried) {
              a.cried = true;
              sfxAnimal(a.type);
            }
            if (a.scareHold > 0.28) {
              a.state = "lift";
              sfxAbduct();
            }
          }
        } else {
          a.scare = lerp(a.scare, 0, clamp(dt * 7, 0, 1));
          a.scareHold = 0;
          a.cried = false;
          const beamNearby = G.ufo.beam && Math.abs(u.x - a.x) < 80 && a.dir === (u.x > a.x ? 1 : -1);
          a.walk += dt * (a.speed / 26);
          if (a.type === "frog") {
            const hs = a.hopScale;
            const hopT = a.walk % 1;
            const airEnd = Math.min(0.28 + 0.44 * hs, 0.95);
            const airborne = hopT > 0.28 && hopT < airEnd;
            const hopSpeed = airborne ? 1.35 * hs : 0.35;
            a.hop = airborne ? Math.sin((hopT - 0.28) / (airEnd - 0.28) * Math.PI) : 0;
            if (a.hopScale > 1.0 && frogFlee()) {
              const fleeRange = 320;
              const dx = u.x - a.x;
              const leftSpace = a.x - 150;
              const rightSpace = 1160 - a.x;
              const totalSpace = 1160 - 150;
              const cornered = (a.dir === -1 && leftSpace < totalSpace * 0.2) ||
                               (a.dir === 1  && rightSpace < totalSpace * 0.2);
              if (!airborne) {
                if (cornered) {
                  a.dir *= -1;
                } else if (Math.abs(dx) < fleeRange) {
                  a.dir = dx > 0 ? -1 : 1;
                }
              }
            }
            a.x += a.dir * a.speed * hopSpeed * dt;
          } else {
            if (!beamNearby) a.x += a.dir * a.speed * dt;
          }
          if (animalFlee()) {
            if (u.beam) {
              const dx = u.x - a.x;
              if (Math.abs(dx) < 400 && !beamNearby) {
                a.dir = dx > 0 ? -1 : 1;
                a.x += a.dir * a.speed * 3.0 * dt;
              }
            }
          }
          if (LEVELS[currentLevel].animalBounce) {
            if (a.x < 150) { a.x = 150; a.dir = 1; }
            if (a.x > W - 150) { a.x = W - 150; a.dir = -1; }
          } else {
            if (a.x < -80) { a.x = W + 80; }
            if (a.x > W + 80) { a.x = -80; }
          }
          if (Math.random() < dt * 0.035) a.dir *= -1;
        }
      } else if (a.state === "lift") {
        a.scare = 1;
        if (!a.cried) {
          a.cried = true;
          sfxAnimal(a.type);
        }
        a.lift += dt * 1.35;
        a.y -= 220 * dt;
        a.x = lerp(a.x, u.x, clamp(dt * 5, 0, 1));
        a.wiggle += dt * 18;
        if (a.y < u.y - 40 || a.lift > 1.15) {
          a.state = "gone";
          G.collected += 1;
          G.score += def.score;
          addFloater(u.x + 86, u.y + 8, `+${def.score}`);
          burst(u.x, u.y + 24, "#9be7ff", 22);
          sfxScore();
          if (G.collected >= levelTarget()) {
            banner("Fly to the landing pad!");
            G.state = "toPad";
            u.beam = false;
          }
        }
      }
    });
    G.animals = G.animals.filter((a) => a.state !== "gone");

    if (G.birds.length && (G.state === "play" || G.state === "toPad")) {
      G.birds.forEach((bird) => {
        if (bird.waiting) {
          bird.waitT -= dt;
          if (bird.waitT <= 0) { bird.waiting = false; bird.x = -60; }
        } else {
          bird.x += bird.speed * dt;
          if (bird.x > W + 60) { bird.waiting = true; bird.waitT = rand(bird.minWait, bird.maxWait); }
          else {
            const birdBox = { x: bird.x - 28, y: bird.y - 18, w: 56, h: 36 };
            if (aabb(ufoHitbox(), birdBox)) {
              G.state = "birdHit";
              u.beam = false;
              u.vx = 0;
              u.vy = 0;
              sfxBump();
              banner("A bird hit you!");
            }
          }
        }
      });
    }

    G.particles = G.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      return p.life > 0;
    });
    G.floaters = G.floaters.filter((f) => {
      f.life -= dt;
      f.y += f.vy * dt;
      return f.life > 0;
    });

    updateHUD();
  }

  function drawSprite(img, x, y, w, h, dir, rot) {
    if (!img) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(dir < 0 ? -1 : 1, 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  function drawSpriteCrop(img, x, y, w, h, dir, rot, cropBottom) {
    if (!img) return;
    const sy = 0;
    const sh = img.height * (1 - cropBottom);
    const dh = h * (1 - cropBottom);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(dir < 0 ? -1 : 1, 1);
    ctx.drawImage(img, 0, sy, img.width, sh, -w / 2, -h, w, dh);
    ctx.restore();
  }

  function strokeFillEllipse(x, y, rx, ry, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  function drawLeg(hipX, hipY, phase, length, color, footColor, footW, footH) {
    const swing = Math.sin(phase);
    const lift = Math.max(0, Math.sin(phase)) * (length * 0.42);
    const footX = hipX + swing * (length * 0.55);
    const footY = hipY + length - lift;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(7, footW * 0.7);
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(hipX + swing * 6, hipY + length * 0.45, footX, footY - 3);
    ctx.stroke();
    strokeFillEllipse(footX, footY, footW, footH, footColor, "#1b2430");
  }

  function drawWalkingAnimal(a) {
    const def = ANIMAL_DEFS[a.type];
    const img = sprites[def.img];
    const cycle = (a.walk % 1) * Math.PI * 2;
    const contact = Math.abs(Math.sin(cycle));
    const bob = a.type === "frog" ? (a.hop || 0) * 38 * a.hopScale : contact * 5;
    const tilt = a.type === "frog" ? (a.hop || 0) * -0.18 : Math.sin(cycle) * 0.07;
    const y = a.y - bob;

    ctx.save();
    ctx.translate(a.x, y);
    ctx.scale(a.dir < 0 ? -1 : 1, 1);

    if (a.type === "croc") {
      drawLeg(-46, -28, cycle, 28, "#2f9a3a", "#247a2c", 14, 7);
      drawLeg(22, -26, cycle + Math.PI, 30, "#2f9a3a", "#247a2c", 15, 7);
      drawLeg(-18, -24, cycle + Math.PI, 26, "#3aaa32", "#2f8f28", 13, 6);
      drawLeg(50, -24, cycle, 27, "#3aaa32", "#2f8f28", 14, 6);
    ctx.restore();
    drawSpriteCrop(img, a.x, y + 10, def.w, def.h, a.dir, tilt, 0.22);
    drawWorriedFace(a, def, y + 10);
    return;
    }

    if (a.type === "duck" || a.type === "duckling") {
      const s = a.type === "duckling" ? 0.72 : 1;
      drawLeg(-6 * s, -18 * s, cycle, 16 * s, "#ff9a2a", "#ff9a2a", 8 * s, 4 * s);
      drawLeg(10 * s, -18 * s, cycle + Math.PI, 16 * s, "#ff9a2a", "#ff9a2a", 8 * s, 4 * s);
      ctx.restore();
      drawSpriteCrop(img, a.x, y + 8 * s, def.w, def.h, a.dir, tilt, 0.2);
      drawWorriedFace(a, def, y + 8 * s);
      return;
    }

    if (a.type === "turtle") {
      drawLeg(-22, -16, cycle, 16, "#3aaa32", "#2f8f28", 10, 5);
      drawLeg(10, -16, cycle + Math.PI, 16, "#3aaa32", "#2f8f28", 10, 5);
      drawLeg(-6, -14, cycle + Math.PI, 14, "#4ec44a", "#2f8f28", 9, 5);
      drawLeg(24, -14, cycle, 14, "#4ec44a", "#2f8f28", 9, 5);
      ctx.restore();
      drawSpriteCrop(img, a.x, y + 8, def.w, def.h, a.dir, tilt * 0.6, 0.18);
      drawWorriedFace(a, def, y + 8);
      return;
    }

    if (a.type === "frog") {
      const kick = (a.hop || 0);
      ctx.strokeStyle = "#2f8f28";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-10, -18);
      ctx.lineTo(-22 - kick * 10, -4 + kick * 8);
      ctx.moveTo(10, -18);
      ctx.lineTo(22 + kick * 10, -4 + kick * 8);
      ctx.stroke();
      strokeFillEllipse(-22 - kick * 10, -2 + kick * 8, 11, 6, "#3aaa32", "#1b2430");
      strokeFillEllipse(22 + kick * 10, -2 + kick * 8, 11, 6, "#3aaa32", "#1b2430");
      ctx.restore();
      drawSpriteCrop(img, a.x, y + 6, def.w, def.h, a.dir, tilt, 0.16);
      drawWorriedFace(a, def, y + 6);
      return;
    }

    ctx.restore();
    drawSprite(img, a.x, y, def.w, def.h, a.dir, tilt);
    drawWorriedFace(a, def, y);
  }

  function drawWorriedFace(a, def, y) {
    if (!a.scare || a.scare < 0.15) return;
    const s = a.scare;
    const head = {
      croc: { x: 48, y: -def.h + 36, r: 13, gap: 22 },
      duck: { x: 28, y: -def.h + 28, r: 11, gap: 16 },
      duckling: { x: 18, y: -def.h + 22, r: 8, gap: 12 },
      turtle: { x: 32, y: -def.h + 34, r: 10, gap: 16 },
      frog: { x: 0, y: -def.h + 26, r: 13, gap: 22 },
    }[a.type] || { x: 20, y: -def.h + 28, r: 10, gap: 16 };
    ctx.save();
    ctx.translate(a.x, y);
    ctx.scale(a.dir < 0 ? -1 : 1, 1);
    ctx.globalAlpha = s;
    const shake = Math.sin(G.t * 28) * 1.2;
    [-1, 1].forEach((side) => {
      const ex = head.x + side * head.gap * 0.5 + (a.type === "frog" ? side * head.gap * 0.5 : 0);
      const ey = head.y + shake;
      const rr = head.r * (1.15 + s * 0.45);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(ex, ey, rr, rr * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1b2430";
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = "#1b2430";
      ctx.beginPath();
      ctx.arc(ex + 1, ey - rr * 0.35, rr * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1b2430";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey - rr * 1.15, rr * 0.55, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    });
    ctx.strokeStyle = "#1b2430";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(head.x + (a.type === "frog" ? 0 : 4), head.y + head.r + 14, 6, Math.PI + 0.25, -0.25);
    ctx.stroke();
    ctx.restore();
  }

  function drawNaturalGround() {
    const gy = WALK_Y;
    for (let x = -8; x < W + 20; x += 7) {
      const h = 10 + ((x * 13) % 11);
      const lean = ((x * 7) % 5) - 2;
      ctx.strokeStyle = (x * 3) % 2 === 0 ? "#7ed14a" : "#5aaa32";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, gy + 3);
      ctx.quadraticCurveTo(x + lean, gy - h * 0.45, x + lean * 0.4, gy - h);
      ctx.stroke();
    }
    ctx.fillStyle = "#6fbf3a";
    ctx.beginPath();
    ctx.moveTo(0, gy + 8);
    for (let x = 0; x <= W; x += 18) {
      ctx.quadraticCurveTo(x + 9, gy - 6 - ((x * 5) % 7), x + 18, gy + 6);
    }
    ctx.lineTo(W, gy + 18);
    ctx.lineTo(0, gy + 18);
    ctx.closePath();
    ctx.fill();

    const pebbles = [
      [70, 28, 16, 9], [190, 42, 11, 7], [340, 22, 14, 8],
      [520, 48, 18, 10], [710, 30, 12, 7], [880, 44, 15, 8],
      [1040, 24, 13, 7], [1210, 40, 17, 9], [1380, 32, 12, 7], [1510, 50, 14, 8],
    ];
    pebbles.forEach(([x, oy, rx, ry], i) => {
      ctx.fillStyle = i % 2 ? "#7a6a62" : "#8b7d74";
      ctx.beginPath();
      ctx.ellipse(x, gy + oy, rx, ry, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.3, gy + oy - ry * 0.25, rx * 0.35, ry * 0.28, -0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(90, 40, 16, 0.22)";
    for (let i = 0; i < 18; i++) {
      const x = (i * 97 + 40) % W;
      const y = gy + 18 + (i * 17) % 46;
      ctx.beginPath();
      ctx.ellipse(x, y, 22, 6, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(90, 42, 18, 0.28)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const x = 80 + i * 190;
      ctx.beginPath();
      ctx.moveTo(x, gy + 14);
      ctx.quadraticCurveTo(x + 18, gy + 34, x - 8, gy + 58);
      ctx.stroke();
    }
  }

  function drawBeam() {
    if (!G.ufo.beam) return;
    const b = beamRect();
    const pulse = 0.82 + Math.sin(G.t * 16) * 0.1;
    const g = ctx.createLinearGradient(b.x, b.top, b.x, b.bot);
    g.addColorStop(0, `rgba(220,255,255,${0.88 * pulse})`);
    g.addColorStop(0.22, `rgba(80,220,255,${0.42 * pulse})`);
    g.addColorStop(1, `rgba(170,250,255,${0.14 * pulse})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x - b.topW / 2, b.top);
    ctx.lineTo(b.x + b.topW / 2, b.top);
    ctx.lineTo(b.x + b.botW / 2, b.bot);
    ctx.lineTo(b.x - b.botW / 2, b.bot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(b.x - b.topW / 2, b.top);
    ctx.lineTo(b.x - b.botW / 2, b.bot);
    ctx.moveTo(b.x + b.topW / 2, b.top);
    ctx.lineTo(b.x + b.botW / 2, b.bot);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.beginPath();
    ctx.ellipse(b.x, b.bot - 2, 62, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const lifting = G.animals.some((a) => a.state === "lift");
    if (!lifting && sprites.duckling) {
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.sin(G.t * 10) * 0.08;
      ctx.filter = "brightness(2.2) saturate(0.2)";
      drawSprite(sprites.duckling, b.x, b.bot - 6, 54, 52, 1, 0);
      ctx.restore();
      ctx.filter = "none";
    }
  }

  function render() {
    if (sprites.bg) {
      const img = sprites.bg;
      const cut = img.height * 0.735;
      ctx.drawImage(img, 0, 0, img.width, cut, 0, 0, W, WALK_Y + 4);
      ctx.drawImage(img, 0, cut, img.width, img.height - cut, 0, WALK_Y + 2, W, H - WALK_Y);
    } else {
      ctx.fillStyle = "#5ec8ff";
      ctx.fillRect(0, 0, W, H);
    }
    drawNaturalGround();

    G.birds.forEach((bird) => {
      if (bird.waiting) return;
      const bx = bird.x;
      const by = bird.y;
      const wing = Math.sin(G.t * 14) * 10;
      ctx.save();
      ctx.translate(bx, by);
      // body
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // wing
      ctx.fillStyle = "#922b21";
      ctx.beginPath();
      ctx.ellipse(-4, -wing, 18, 7, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // beak
      ctx.fillStyle = "#f39c12";
      ctx.beginPath();
      ctx.moveTo(22, -2);
      ctx.lineTo(34, 0);
      ctx.lineTo(22, 4);
      ctx.closePath();
      ctx.fill();
      // eye
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(12, -3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(13, -3, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    const walking = G.animals.filter((a) => a.state === "walk");
    const lifting = G.animals.filter((a) => a.state === "lift");
    walking.forEach((a) => drawWalkingAnimal(a));

    drawBeam();

    lifting.forEach((a) => {
      const def = ANIMAL_DEFS[a.type];
      drawSprite(sprites[def.img], a.x, a.y, def.w * 0.92, def.h * 0.92, a.dir, 0);
      // oscillation
      // drawSprite(sprites[def.img], a.x, a.y, def.w * 0.92, def.h * 0.92, a.dir, -0.45 + Math.sin(a.wiggle) * 0.25);
      drawWorriedFace(a, def, a.y);
    });

    const bob = Math.sin(G.ufo.bob * 3.1) * 8;
    if (G.ufo.flash > 0) {
      ctx.save();
      ctx.filter = "brightness(1.7) saturate(1.4) hue-rotate(-25deg)";
    }
    drawSprite(sprites.ufo, G.ufo.x, G.ufo.y + bob, UFO_W, UFO_H, 1, G.ufo.tilt || 0);
    if (G.ufo.flash > 0) ctx.restore();

    G.particles.forEach((p) => {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    G.sparkles.forEach((s) => {
      ctx.globalAlpha = clamp(s.life * 2, 0, 1);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    G.floaters.forEach((f) => {
      ctx.save();
      ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
      ctx.font = "900 36px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#8a4a00";
      ctx.lineWidth = 8;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = "#ffd23a";
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
  }
  function loop(now) {
    if (window._ytPaused || window._ytForcePaused) { G.last = now; requestAnimationFrame(loop); return; }
    const dt = G.last ? clamp((now - G.last) / 1000, 0, 0.05) : 0;
    G.last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.code === "Space") keys.Space = true;
    if (e.code === "Space" || e.key.startsWith("Arrow")) e.preventDefault();
    if (e.key === "p" || e.key === "P") togglePause();
    if (e.key === "Enter" && (G.state === "title" || G.state === "complete" || G.state === "fail" || G.state === "paused" || G.state === "gameover")) {
      if (G.state === "paused") togglePause();
      else startLevel(G.state === "gameover" ? 0 : undefined);
    }
    ensureAudio();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
    if (e.code === "Space") keys.Space = false;
  });

  // joystick â€” permanent HTML pad, bottom-left
  function updateKnob() {
    const maxPct = 27; // % of pad radius the knob travels
    const tx = joy.dx * maxPct;
    const ty = joy.dy * maxPct;
    joyKnob.style.transform = `translate(calc(-50% + ${tx}%), calc(-50% + ${ty}%))`;
  }

  joyPad.addEventListener("pointerdown", (e) => {
    ensureAudio();
    if (G.state !== "play" && G.state !== "toPad" && G.state !== "birdHit") return;
    joy.active = true;
    joy.pid = e.pointerId;
    joy.dx = 0;
    joy.dy = 0;
    if (!G.ufo.armed) G.ufo.armed = true;
    joyPad.setPointerCapture(e.pointerId);
    joyPad.style.cursor = "grabbing";
  });
  function isCSSRotated() {
    return window.innerWidth < window.innerHeight && window.innerWidth <= 768;
  }

  joyPad.addEventListener("pointermove", (e) => {
    if (!joy.active || e.pointerId !== joy.pid) return;
    const r = joyPad.getBoundingClientRect();
    const cx = r.left + r.width  * 0.5;
    const cy = r.top  + r.height * 0.5;
    const rawDx = e.clientX - cx;
    const rawDy = e.clientY - cy;
    const dist  = Math.hypot(rawDx, rawDy);
    const maxR  = r.width * 0.5;
    const scale = dist > maxR ? maxR / dist : 1;
    if (isCSSRotated()) {
      // Frame is rotated 90deg CW: touch X -> game -Y, touch Y -> game X
      joy.dx = clamp((rawDy * scale) / maxR, -1, 1);
      joy.dy = clamp((-rawDx * scale) / maxR, -1, 1);
    } else {
      joy.dx = clamp((rawDx * scale) / maxR, -1, 1);
      joy.dy = clamp((rawDy * scale) / maxR, -1, 1);
    }
    updateKnob();
  });
  function joyRelease() {
    joy.active = false; joy.dx = 0; joy.dy = 0;
    updateKnob();
    joyPad.style.cursor = "grab";
  }
  joyPad.addEventListener("pointerup",     joyRelease);
  joyPad.addEventListener("pointercancel", joyRelease);

  beamBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    ensureAudio();
    if (G.state !== "play" && G.state !== "toPad" && G.state !== "birdHit") return;
    pointerBeam = true;
    beamPid = e.pointerId;
    beamBtn.setPointerCapture(e.pointerId);
    if (!G.ufo.armed) G.ufo.armed = true;
  });
  beamBtn.addEventListener("pointerup",     (e) => { if (e.pointerId === beamPid) { pointerBeam = false; beamPid = -1; } });
  beamBtn.addEventListener("pointercancel", (e) => { if (e.pointerId === beamPid) { pointerBeam = false; beamPid = -1; } });



  pauseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    ensureAudio();
    togglePause();
  });

  ovBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    ensureAudio();
    if (G.state === "paused") {
      togglePause();
    } else if (G.state === "gameover" || ovBtn.dataset.mode === "restart") {
      startLevel(0);
    } else if (G.state === "complete") {
      startLevel(Number(ovBtn.dataset.nextLvl));
    } else if (G.state === "fail" || G.state === "birdHit") {
      startLevel(currentLevel);
    } else {
      startLevel(0);
    }
  });

  // accumulate score across levels (not on fail/restart)
  // totalScore is reset in startLevel when lvl === 0

  const startLabel = navigator.maxTouchPoints > 0 ? "TAP TO START" : "CLICK TO START";

  function _initGame(savedData) {
    if (savedData && typeof savedData.highestLevel === "number" && savedData.highestLevel > 0) {
      // Restore highest unlocked level for display; game still starts at level 0
      window._ytHighestLevel = savedData.highestLevel;
    }
    fillLevel();
    updateHUD();
    ovTitle.textContent = "UFO RANCH";
    ovLevel.textContent = "LEVEL 1";
    ovSub.textContent = LEVELS[0].banner;
    ovBtn.textContent = startLabel;
    if (window._ytSignalFirstFrame) window._ytSignalFirstFrame();
    requestAnimationFrame(function (now) {
      loop(now);
      if (window._ytSignalGameReady) window._ytSignalGameReady();
    });
  }

  loadSprites()
    .then(() => { window._ytLoadData ? window._ytLoadData(_initGame) : _initGame(null); })
    .catch((err) => { console.error(err); window._ytLoadData ? window._ytLoadData(_initGame) : _initGame(null); });
})();
