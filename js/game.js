(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const WALK_Y = 818;
  const UFO_Y = 290;
  const PAD_X = 1288;
  const TARGET = 10;
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

  const keys = Object.create(null);
  let pointerBeam = false;
  let beamLock = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function beep({ freq = 440, dur = 0.12, type = "sine", gain = 0.08, slide = 0 }) {
    const ac = ensureAudio();
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
  const sfxCapsule = () => {
    beep({ freq: 520, dur: 0.1, type: "sine", gain: 0.06, slide: 200 });
    setTimeout(() => beep({ freq: 880, dur: 0.16, type: "triangle", gain: 0.07 }), 70);
  };

  function noiseBurst({ dur = 0.16, gain = 0.07, freq = 400, q = 2.5, type = "bandpass" }) {
    const ac = ensureAudio();
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
      keys.ArrowUp || keys.w || keys.W || keys.ArrowDown || keys.s || keys.S);
  }

  const ANIMAL_DEFS = {
    croc: { score: 150, speed: 34, w: 210, h: 108, img: "croc", pick: "largest" },
    duck: { score: 100, speed: 72, w: 108, h: 102, img: "duck", pick: "center" },
    duckling: { score: 80, speed: 98, w: 72, h: 70, img: "duckling", pick: "right" },
    turtle: { score: 120, speed: 24, w: 118, h: 96, img: "turtle", pick: "largest" },
    frog: { score: 110, speed: 56, w: 92, h: 84, img: "frog", pick: "largest" },
  };

  const SPRITE_SRC = {
    bg: "assets/bg.jpg",
    ufo: "assets/ufo.jpg",
    croc: "assets/croc.jpg",
    duck: "assets/duck.jpg",
    duckling: "assets/duckling.jpg",
    turtle: "assets/turtle.jpg",
    frog: "assets/frog.jpg",
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
      particles: [],
      floaters: [],
      sparkles: [],
      capsule: null,
      capsuleWait: rand(1.4, 3.2),
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
      speed: def.speed * rand(0.88, 1.12),
      phase: rand(0, Math.PI * 2),
      walk: rand(0, 1),
      state: "walk",
      lift: 0,
      wiggle: 0,
      hop: 0,
      scare: 0,
      scareHold: 0,
      cried: false,
    });
  }

  function fillLevel() {
    G.animals = [];
    [
      ["croc", 280],
      ["duck", 470],
      ["duckling", 545],
      ["turtle", 780],
      ["frog", 930],
      ["duck", 1080],
      ["turtle", 360],
    ].forEach(([t, x]) => spawnAnimal(t, x));
  }

  function spawnCapsule() {
    const spots = [
      { x: rand(380, 520), y: rand(200, 280) },
      { x: rand(700, 900), y: rand(220, 340) },
      { x: rand(980, 1180), y: rand(195, 270) },
      { x: rand(430, 620), y: rand(360, 470) },
      { x: 1100 + rand(-40, 40), y: 230 + rand(-20, 30) },
    ];
    const p = pick(spots);
    G.capsule = { x: p.x, y: p.y, bob: rand(0, Math.PI * 2) };
  }

  function updateCapsules(dt) {
    if (G.state !== "play") return;
    const lowFuel = G.fuel <= 20 && G.fuel >= 5;
    if (!lowFuel) {
      if (G.fuel < 5) G.capsule = null;
      return;
    }
    if (G.capsule) return;
    G.capsuleWait -= dt;
    if (G.capsuleWait <= 0) {
      spawnCapsule();
      G.capsuleWait = rand(4, 9);
      banner("Energy capsule incoming!");
    }
  }

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
    if (!(G.collected >= TARGET && G.state !== "play")) {
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
    const beaming = (keys[" "] || keys.Space || pointerBeam) && G.energy > 0 && G.collected < TARGET && G.state === "play" && !u.landing;
    if (!u.armed) {
      if (movePressed()) u.armed = true;
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

    if (beaming) {
      u.vx = lerp(u.vx, 0, clamp(dt * 10, 0, 1));
      u.vy = lerp(u.vy, 0, clamp(dt * 10, 0, 1));
      if (Math.abs(u.vx) < 8) u.vx = 0;
      if (Math.abs(u.vy) < 8) u.vy = 0;
      setEngine(true, 0.22);
    } else {
      u.vx = lerp(u.vx, ax * 150, clamp(dt * 6, 0, 1));
      u.vy += 420 * dt;
      if (up) u.vy -= 780 * dt;
      if (down) u.vy += 260 * dt;
      u.vy = clamp(u.vy, -240, 380);
      const spd = Math.hypot(u.vx, u.vy);
      setEngine(spd > 12 || movePressed(), clamp(spd / 280, 0.25, 1));
    }

    u.x = clamp(u.x + u.vx * dt, 120, 1480);
    u.y = clamp(u.y + u.vy * dt, 140, WALK_Y + 24);
    u.tilt = lerp(u.tilt, ax * 0.12, clamp(dt * 8, 0, 1));
    const thrusting = up || Math.abs(ax) > 0;
    G.fuel = clamp(G.fuel - (thrusting ? 1.6 : 0.1) * dt, 0, 100);
    resolveCollisions();
    u.x = clamp(u.x, 120, 1480);
    u.y = clamp(u.y, 140, WALK_Y + 24);
  }

  function showOverlay(title, sub, action) {
    ovTitle.textContent = title;
    ovSub.textContent = sub;
    ovBtn.textContent = action;
    overlay.classList.add("show");
  }

  function hideOverlay() {
    overlay.classList.remove("show");
  }

  function startLevel() {
    G = makeGame();
    G.state = "play";
    G.last = performance.now();
    fillLevel();
    beamLock = 0.4;
    pointerBeam = false;
    hideOverlay();
    banner("Abduct 10 animals!");
    sfxClick();
  }

  function togglePause() {
    if (G.state === "play" || G.state === "toPad") {
      G.state = "paused";
      showOverlay("PAUSED", "Hover until you press a move key. Hold Space to beam — the UFO almost stops.", "RESUME");
    } else if (G.state === "paused") {
      hideOverlay();
      G.state = G.collected >= TARGET ? "toPad" : "play";
      G.last = performance.now();
    }
  }

  function updateHUD() {
    fuelBar.style.width = G.fuel + "%";
    energyBar.style.width = G.energy + "%";
    fuelBar.className = G.fuel < 22 ? "crit" : G.fuel < 40 ? "low" : "";
    energyBar.className = G.energy < 18 ? "low" : "";
    scoreStat.textContent = String(G.score);
    goalStat.textContent = G.collected + " / " + TARGET;
    if (G.messageT <= 0) bannerEl.classList.add("hidden");
  }

  function update(dt) {
    G.t += dt;
    G.ufo.bob += dt;
    if (G.messageT > 0) G.messageT -= dt;
    if (beamLock > 0) beamLock -= dt;

    if (G.state === "title" || G.state === "complete" || G.state === "paused" || G.state === "fail") {
      setEngine(false);
      updateHUD();
      return;
    }

    if (G.hitCD > 0) G.hitCD -= dt;
    if (G.ufo.flash > 0) G.ufo.flash -= dt;

    const u = G.ufo;
    const wantBeam = beamLock <= 0 && (keys[" "] || keys.Space || pointerBeam) && G.energy > 0 && G.collected < TARGET && !u.landing;

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
          showOverlay("LEVEL COMPLETE!", `Score ${G.score}  ·  Animals ${G.collected}`, "PLAY AGAIN");
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
        const inLight = G.ufo.beam && caught;
        if (inLight && G.state === "play") {
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
        } else {
          a.scare = lerp(a.scare, 0, clamp(dt * 7, 0, 1));
          a.scareHold = 0;
          a.cried = false;
          a.walk += dt * (a.speed / 26);
          if (a.type === "frog") {
            const hopT = a.walk % 1;
            const airborne = hopT > 0.28 && hopT < 0.72;
            const hopSpeed = airborne ? 1.35 : 0.35;
            a.hop = airborne ? Math.sin((hopT - 0.28) / 0.44 * Math.PI) : 0;
            a.x += a.dir * a.speed * hopSpeed * dt;
          } else {
            a.x += a.dir * a.speed * dt;
          }
          if (a.x < 150) { a.x = 150; a.dir = 1; }
          if (a.x > 1160) { a.x = 1160; a.dir = -1; }
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
          if (G.collected >= TARGET) {
            banner("Fly to the landing pad!");
            G.state = "toPad";
            u.beam = false;
          } else {
            spawnAnimal(pick(Object.keys(ANIMAL_DEFS)), a.dir > 0 ? 160 : 1140);
          }
        }
      }
    });
    G.animals = G.animals.filter((a) => a.state !== "gone");

    updateCapsules(dt);

    if (G.capsule) {
      G.capsule.bob += dt * 3.2;
      const box = { x: G.capsule.x - 24, y: G.capsule.y - 30, w: 48, h: 52 };
      if (aabb(ufoHitbox(), box)) {
        G.energy = 100;
        addFloater(G.capsule.x, G.capsule.y - 36, "ENERGY FULL");
        burst(G.capsule.x, G.capsule.y, "#7CFF6A", 22);
        sfxCapsule();
        G.capsule = null;
        G.capsuleWait = rand(3.5, 8);
      }
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
    const bob = a.type === "frog" ? (a.hop || 0) * 38 : contact * 5;
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

  function drawCapsule(c) {
    const y = c.y + Math.sin(c.bob) * 8;
    ctx.save();
    ctx.translate(c.x, y);
    const glow = 0.35 + Math.sin(G.t * 8) * 0.12;
    ctx.fillStyle = `rgba(80, 255, 160, ${glow})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8fff4";
    ctx.beginPath();
    ctx.roundRect(-12, -20, 24, 40, 10);
    ctx.fill();
    ctx.strokeStyle = "#2fb86a";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#7CFF4A";
    ctx.beginPath();
    ctx.roundRect(-8, -14, 16, 28, 7);
    ctx.fill();
    ctx.fillStyle = "#fff64a";
    ctx.font = "900 16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚡", 0, 1);
    ctx.restore();
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

    if (G.capsule) drawCapsule(G.capsule);

    const walking = G.animals.filter((a) => a.state === "walk");
    const lifting = G.animals.filter((a) => a.state === "lift");
    walking.forEach((a) => drawWalkingAnimal(a));

    drawBeam();

    lifting.forEach((a) => {
      const def = ANIMAL_DEFS[a.type];
      drawSprite(sprites[def.img], a.x, a.y, def.w * 0.92, def.h * 0.92, a.dir, -0.45 + Math.sin(a.wiggle) * 0.25);
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
    if (e.key === "Enter" && (G.state === "title" || G.state === "complete" || G.state === "fail" || G.state === "paused")) {
      if (G.state === "paused") togglePause();
      else startLevel();
    }
    ensureAudio();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
    if (e.code === "Space") keys.Space = false;
  });

  canvas.addEventListener("pointerdown", (e) => {
    ensureAudio();
    if (G.state === "title" || G.state === "complete" || G.state === "fail") {
      startLevel();
      return;
    }
    if (G.state === "paused") {
      togglePause();
      return;
    }
    pointerBeam = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", () => { pointerBeam = false; });
  canvas.addEventListener("pointercancel", () => { pointerBeam = false; });
  pauseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    ensureAudio();
    if (G.state === "title" || G.state === "complete" || G.state === "fail") startLevel();
    else togglePause();
  });
  ovBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    ensureAudio();
    if (G.state === "paused") togglePause();
    else startLevel();
  });

  loadSprites()
    .then(() => {
      fillLevel();
      updateHUD();
      requestAnimationFrame(loop);
    })
    .catch((err) => {
      console.error(err);
      fillLevel();
      updateHUD();
      requestAnimationFrame(loop);
    });
})();
