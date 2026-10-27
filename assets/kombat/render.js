/* LeiaKOMBAT · render: escenarios, cámara, luchadores, efectos y HUD (todo en canvas 2D) */
(function (root) {
'use strict';
const { K, META, ANIM, frameOf } = KSim;
const { W, H, GROUND, SC } = K;
const FD = '"Silkscreen","Pixelify Sans",monospace', FM = '"Pixelify Sans",monospace';
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function ICO(x, n, cx, cy, sz) { const c = KIcon.canvas(n); if (!c) return; const sm = x.imageSmoothingEnabled; x.imageSmoothingEnabled = false; x.drawImage(c, Math.round(cx - sz / 2), Math.round(cy - sz / 2), sz, sz); x.imageSmoothingEnabled = sm; }
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = t => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/* escenarios: imagen base teñida + degradé (acá) y capas animadas procedurales (stages.js). La música lleva el id del escenario (chip.js) */
const STAGES = [
  { id: 'original', name: 'LeiaNET Original', sky: ['#0f0f11', '#0f0f11'], acc: '#c7c7cc', floor: ['#26262b', '#08080a'], music: 'core', stars: false },
  { id: 'matrix',   name: 'Matrix',           sky: ['#000a02', '#031c0b'], acc: '#00ff41', floor: ['#042a12', '#010a04'], music: 'marte', stars: false },
  { id: 'win95',    name: 'Windows 95',       sky: ['#007b7b', '#008e8e'], acc: '#ffffff', floor: ['#b8b8b8', '#707070'], music: 'win95', stars: false },
  { id: 'pixel',    name: 'Pixel Art',        sky: ['#4cb8f5', '#d8f6ff'], acc: '#ffe36b', floor: ['#4aa84a', '#16401d'], music: 'pixel', stars: false },
  { id: 'neon',     name: 'Neón Retrowave',   sky: ['#12002a', '#4a116f'], acc: '#ff5cc8', floor: ['#3b1257', '#0a0214'], music: 'neon' },
  { id: 'arcade',   name: 'Arcade 8-bit',     sky: ['#160d4f', '#e5607a'], acc: '#ffe36b', floor: ['#2a1670', '#0a0626'], music: 'arcade', stars: false },
  { id: 'void',     name: 'El Vacío',         sky: ['#020006', '#0c0524'], acc: '#b48cff', floor: ['#1d1040', '#030108'], music: 'void', stars: false }
];
/* poses de fin de ronda (ganadora / perdedora): imagen única animada por código */
/* escalera de calidad automática: [nivel de efectos, escala de resolución]. Nivel 2 = todo; 1 = sin reflejos; 0 = fondos simples, sin viñeta, sin blur */
const LADDER = [[2, 1], [1, 1], [1, .8], [0, .8], [0, .65], [0, .5]], PX_BUDGET = [.6e6, 1.25e6, 2.3e6];
const POSE = { win: { w: 232, h: 362, ax: 116 }, lose: { w: 154, h: 313, ax: 77 } };
const POW = {
  storm:  { n: 'TORMENTA', e: 'storm', c: '#7fe7ff' },
  meteor: { n: 'METEORO',  e: 'meteor', c: '#ff8a3d' },
  quake:  { n: 'TEMBLOR',  e: 'quake', c: '#d9b070' },
  bone:   { n: 'HUESO',    e: 'bone', c: '#fff1c9' },
  shield: { n: 'ESCUDO',   e: 'shield', c: '#8fb6ff' }
};
const EMO = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

class Renderer {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.S = 1;
    this.parts = []; this.texts = []; this.rings = []; this.waves = []; this.afters = []; this.impacts = []; this.swipes = []; this.sq = [0, 0, 0];
    this.shake = 0; this.flash = 0; this.flashCol = '#fff'; this.cam = { z: 1, x: W / 2 }; this.t = 0; this.stage = 0;
    this.stars = []; for (let i = 0; i < 110; i++) this.stars.push({ x: Math.random() * W * 1.2, y: Math.random() * 380, r: Math.random() * 1.5 + .3, s: Math.random() * .5 + .1, l: Math.random() });
    this.hpd = [100, 100, 100]; this.pop = [0, 0, 0]; this.bgs = []; this.img = {}; this.tc = document.createElement('canvas'); this.tc.width = 680; this.tc.height = 440; this.tx = this.tc.getContext('2d');
    this.q = 1; this.fps = .016; this.fpsT = 0; this.kick = 0; this.lean = [0, 0, 0]; this.beat = null; this.rot = [0, 0, 0]; this.portrait = null; this.names = ['LEIA', 'RIVAL']; this.tints = [null, '#7fb6ff']; this.ptag = ['', '']; this.hint = 0; this.prevBanner = '';
    this.tier = 2; this.rs = 1; this.lv = 0; this.auto = true; this.noUp = false; this.lastUp = -99; this.onTier = null; this.dirty = true;
    this.rm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const mark = () => { this.dirty = true; };
    addEventListener('resize', mark); addEventListener('orientationchange', mark);
    if (window.ResizeObserver) { try { new ResizeObserver(mark).observe(cv); } catch (e) {} }
  }
  /* calidad: 'auto' (se adapta sola al rendimiento) | 'high' | 'mid' | 'low' */
  setQuality(m) {
    this.auto = !m || m === 'auto';
    const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || !!(navigator.connection && navigator.connection.saveData);
    this.lv = this.auto ? (weak ? 2 : 0) : ({ high: 0, mid: 2, low: 5 }[m] || 0);
    this.noUp = false; this._applyLv();
  }
  _applyLv() {
    const L = LADDER[this.lv]; this.tier = L[0]; this.rs = L[1]; this.q = this.tier > 0 ? 1 : 0;
    this.dirty = true; this.fps = .0167; this.fpsT = 0; if (this.onTier) this.onTier(this.tier, this.lv);
  }
  load(base, onProgress) {
    // idle primero (es lo que se ve antes); cada sprite reintenta una vez con cache-bust si falla; avisa el progreso
    const names = ['idle', 'walk', 'blockwalk', 'block', 'kick', 'win', 'lose', 'punchR', 'punchL']; let done = 0;
    const one = (n, retry) => new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => { (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => { this.img[n] = i; res(); }); };
      i.onerror = () => { if (retry) res(one(n, false)); else rej(new Error('No cargó ' + n)); };
      i.src = base + n + '.webp' + (retry ? '' : '?r=' + Date.now());
    }).then(() => { done++; if (onProgress) onProgress(done, names.length); });
    { const lg = new Image(); lg.onload = () => { this.img.logo = lg; }; lg.src = base + '../logo_leiakombat.webp'; }   // opcional: si falta, simplemente no hay marca de agua
    return Promise.all(names.map(n => one(n, true))).then(() => { this._buildStages(); });
  }
  _buildStages() {
    this.bgs = STAGES.map(st => {
      const c = document.createElement('canvas'); c.width = 1500; c.height = 640; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, st.sky[0]); g.addColorStop(1, st.sky[1]); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      const vg = x.createLinearGradient(0, c.height * .55, 0, c.height); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = vg; x.fillRect(0, 0, c.width, c.height);
      return c;
    });
  }
  setStage(i) { this.stage = clamp(i | 0, 0, STAGES.length - 1); }
  setNames(a, b, c) { this.names = [a, b, c]; }
  resize() {
    if (!this.dirty) return; this.dirty = false;
    const cv = this.cv, r = cv.getBoundingClientRect();
    let dpr = Math.min(window.devicePixelRatio || 1, 2) * this.rs;
    const px = r.width * r.height * dpr * dpr, bud = PX_BUDGET[this.tier]; if (px > bud) dpr *= Math.sqrt(bud / px);
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    // pantallas chicas: HUD y efectos se agrandan (hasta x1,5) para que barras, textos y chispas sigan leyéndose
    const u = Math.max(.2, r.width / W); this.hudK = clamp(.85 / u, 1, 1.5); this.fk = clamp(.62 / u, 1, 1.5);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    this.S = cv.width / W;
  }
  /* portrait del perro: recorte de la cabeza del primer frame de idle */
  _portrait() {
    if (this.portrait || !this.img.idle) return;
    const c = document.createElement('canvas'); c.width = c.height = 120; const x = c.getContext('2d');
    x.fillStyle = '#1b1d2e'; x.fillRect(0, 0, 120, 120);
    x.drawImage(this.img.idle, 52, 0, 150, 150, 0, 4, 120, 120); this.portrait = c;
  }

  /* ---- eventos del sim → efectos visuales ---- */
  consume(s) {
    for (const e of s.events) {
      switch (e.k) {
        case 'hit': {
          const kd = e.kind || 'punch', cn = e.cn || 1, bl = !!e.blocked;
          const c = bl ? '#7cc8ff' : e.counter ? '#ff7a3d' : kd === 'wave' ? '#ff9ad8' : kd === 'kick' ? '#ffb347' : '#ffd84c';
          const pw = bl ? 0 : (kd === 'wave' || e.counter || e.fin) ? 3 : kd === 'kick' ? 2 : 1;      // fuerza del golpe 0..3
          this.rings.push({ x: e.x, y: e.y, t: 0, c, big: !bl });
          this.impacts.push({ x: e.x, y: e.y, t: 0, c, s: [.62, .95, 1.25, 1.6][pw], rot: rnd(0, 6.283) });
          if (bl) this.texts.push({ x: e.x, y: e.y - 40, t: 0, txt: e.shield ? '¡ESCUDO!' : 'BLOQUEO', c: e.shield ? '#8fb6ff' : '#7cc8ff', big: false });
          else this.texts.push({ x: e.x, y: e.y - 40, t: 0, txt: '-' + e.dmg, c, big: pw >= 2 || e.dmg > 8 });
          if (e.fin) { this.texts.push({ x: e.x, y: e.y - 92, t: 0, txt: '¡COMBO!', c: '#ff5ad0', big: true }); this.flash = Math.max(this.flash, .14); this.flashCol = '#ffd6f5'; }
          if (e.counter) this.texts.push({ x: e.x, y: e.y - 92, t: 0, txt: '¡CONTRA!', c: '#ff7a3d', big: true });
          // chispas: la mayoría salen en la dirección del golpe, algunas en todas direcciones
          const n = bl ? 9 : 10 + pw * 7, base = e.dir > 0 ? 0 : Math.PI;
          for (let i = 0; i < n; i++) {
            const dirn = i % 3 === 0, a = dirn ? rnd(0, 6.283) : base + rnd(-.85, .85), sp = rnd(150, 300 + pw * 130) * (dirn ? .6 : 1);
            this.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, life: rnd(.22, .5 + pw * .06), t: 0, c: i % 4 === 0 ? '#fff' : c, r: rnd(2, 3.5 + pw * .7), g: 650 });
          }
          if (pw >= 2) for (let i = 0; i < 5; i++) this.parts.push({ x: e.x, y: GROUND, vx: rnd(-90, 90) + e.dir * 90, vy: rnd(-120, -40), life: rnd(.3, .5), t: 0, c: 'rgba(200,210,255,.7)', r: rnd(3, 6), g: 120 });
          this.shake = Math.max(this.shake, bl ? 3 : [0, 5, 9, 12][pw] + Math.min(cn - 1, 5) * .7 + (e.counter ? 3 : 0));
          this.kick = Math.max(this.kick, [0, .25, .55, .85][pw]);
          if (pw >= 2) { this.flash = Math.max(this.flash, .08 + .05 * pw); this.flashCol = '#fff'; }
          this.sq[e.to] = bl ? .35 : .5 + .17 * pw;
          if (!bl) { this.pop[e.by ? 1 : 0] = 1; this.hpPulse = 1; }
          break; }
        case 'chain': {
          if (e.n >= 2) this.texts.push({ x: e.x, y: GROUND - 300, t: 0, txt: e.n + ' GOLPES', c: '#ffd84c', big: false });
          break; }
        case 'swing': {
          this.swipes.push({ x: e.x, y: e.y, dir: e.dir, t: 0, kick: e.kick, miss: e.miss });
          if (e.miss) this.texts.push({ x: e.x + e.dir * 150, y: e.y - 30, t: 0, txt: 'FALLÓ', c: '#9aa0b4', big: false });
          break; }
        case 'cast': { const P = POW[e.kind]; if (!P) break;
          this.texts.push({ x: e.x, y: GROUND - 250, t: 0, txt: P.n + '!', c: P.c, big: true }); this.rings.push({ x: e.x, y: GROUND - 110, t: 0, c: P.c, big: true });
          this.flash = Math.max(this.flash, .3); this.flashCol = P.c; this.kick = 1; this.shake = Math.max(this.shake, 8);
          for (let i = 0; i < 26; i++) { const a = rnd(0, 6.283), sp = rnd(120, 420); this.parts.push({ x: e.x, y: GROUND - 110, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(.3, .6), t: 0, c: P.c, r: rnd(2, 5), g: 200 }); }
          break; }
        case 'pick': { const P = POW[e.kind]; if (!P) break;
          this.texts.push({ x: e.x, y: GROUND - 130, t: 0, txt: P.n, c: P.c, big: false }); this.rings.push({ x: e.x, y: GROUND - 60, t: 0, c: P.c, big: false });
          for (let i = 0; i < 18; i++) this.parts.push({ x: e.x, y: GROUND - 50, vx: rnd(-160, 160), vy: rnd(-380, -80), life: rnd(.4, .8), t: 0, c: P.c, r: rnd(2, 4), g: 600 });
          break; }
        case 'drop': for (let i = 0; i < 10; i++) this.parts.push({ x: e.x + rnd(-20, 20), y: rnd(0, 120), vx: rnd(-30, 30), vy: rnd(60, 220), life: rnd(.3, .6), t: 0, c: '#fff', r: rnd(1.5, 3), g: 0 }); break;
        case 'boom': {
          this.rings.push({ x: e.x, y: GROUND - 10, t: 0, c: '#ffb347', big: true }); this.rings.push({ x: e.x, y: GROUND - 40, t: 0, c: '#fff', big: true });
          this.flash = Math.max(this.flash, .55); this.flashCol = '#ffb347'; this.shake = Math.max(this.shake, 20); this.kick = 1.4;
          for (let i = 0; i < 36; i++) { const a = rnd(-3.14, 0), sp = rnd(160, 560); this.parts.push({ x: e.x, y: GROUND - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(.4, .9), t: 0, c: Math.random() < .5 ? '#ff8a3d' : '#ffe08a', r: rnd(3, 7), g: 900 }); }
          break; }
        case 'dodge': this.texts.push({ x: e.x, y: e.y, t: 0, txt: '¡ESQUIVÓ!', c: '#9ff', big: false }); break;
        case 'dust': for (let i = 0; i < e.n; i++) this.parts.push({ x: e.x + rnd(-25, 25), y: GROUND, vx: rnd(-70, 70), vy: rnd(-70, -30), life: rnd(.35, .55), t: 0, c: 'rgba(200,210,255,.7)', r: rnd(3, 6), g: 120 }); break;
        case 'ko': this.flash = 1; this.flashCol = '#fff'; this.shake = Math.max(this.shake, 18); break;
        case 'wave': this.waves.push({ owner: e.owner }); break;
        case 'clash': this.rings.push({ x: e.x, y: e.y, t: 0, c: '#fff', big: true }); this.shake = Math.max(this.shake, 6); break;
        case 'end': if (e.reason === 'time') this.texts.push({ x: W / 2, y: 200, t: 0, txt: '¡TIEMPO!', c: '#fff', big: true }); break;
      }
    }
    s.events.length = 0;
  }

  /* tecla dibujada (para que el juego se entienda sin leer) */
  _cap(x, lbl, cx, cy, sz, down) {
    const w = Math.max(sz, sz * .62 * String(lbl).length + sz * .5), h = sz, y0 = cy - h / 2 + (down ? 2 : 0), rect = (yy) => { x.beginPath(); if (x.roundRect) x.roundRect(cx - w / 2, yy, w, h, 4); else x.rect(cx - w / 2, yy, w, h); };
    x.save(); x.fillStyle = '#5d6180'; rect(cy - h / 2 + 3); x.fill();
    x.fillStyle = '#f2f3ff'; rect(y0); x.fill(); x.lineWidth = 1.5; x.strokeStyle = '#2b2e4a'; x.stroke();
    x.fillStyle = '#1b1d33'; x.font = '700 ' + Math.round(sz * .62) + 'px ' + FM; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lbl, cx, y0 + h / 2 + 1); x.restore();
  }
  _rows(rows, al) {
    const x = this.ctx, S = 22; x.save(); x.globalAlpha = al * .95;
    rows.forEach((row, ri) => {
      const y = H - 30 - (rows.length - 1 - ri) * 42;
      const items = row.map(it => { if (it.tag) return { tag: it.tag, w: 34 }; const ws = it.k.map(k => Math.max(S, S * .62 * k.length + S * .5)); return { it, ws, w: ws.reduce((a, b) => a + b + 4, 0) + 30 }; });
      const total = items.reduce((a, b) => a + b.w + 14, 0); let px = W / 2 - total / 2;
      x.fillStyle = 'rgba(8,9,16,.6)'; x.fillRect(px - 10, y - 20, total + 6, 40);
      for (const o of items) {
        if (o.tag) { x.font = '700 14px ' + FD; x.fillStyle = '#ffd84c'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(o.tag, px, y); }
        else { let cx = px; o.it.k.forEach((k, i) => { this._cap(x, k, cx + o.ws[i] / 2, y, S, false); cx += o.ws[i] + 4; }); ICO(x, o.it.e, cx + 17, y + 1, 24); }
        px += o.w + 14;
      }
    });
    x.restore();
  }

  /* ---- escena ---- */
  _bg(dt, camL, z) {
    const x = this.ctx, st = STAGES[this.stage], bg = this.bgs[this.stage];
    if (bg) { const par = (camL - (W - W / z) / 2) * -.05; x.drawImage(bg, -110 + par, -30 + (1 - z) * -30, 1500, 640); }
    else { x.fillStyle = st.sky[0]; x.fillRect(-60, -60, W + 120, H + 120); }
    if (st.stars === false) return;
    x.fillStyle = '#fff';
    for (const s of this.stars) { x.globalAlpha = (.25 + .45 * Math.sin(this.t * s.s * 3 + s.x)) * (.5 + s.l * .5); x.beginPath(); x.arc((s.x - camL * .03 * (.4 + s.l) + 1280) % (W * 1.2) - 40, s.y, s.r, 0, 7); x.fill(); }
    x.globalAlpha = 1;
  }
  _floor(camL, z) {
    const x = this.ctx, st = STAGES[this.stage], top = GROUND - 6;
    const g = x.createLinearGradient(0, top, 0, H); g.addColorStop(0, st.floor[0]); g.addColorStop(1, st.floor[1]);
    x.fillStyle = g; x.fillRect(-120, top, W + 240, H - top + 120);
    // grilla en perspectiva
    x.save(); x.beginPath(); x.rect(-120, top, W + 240, H - top + 120); x.clip();
    x.strokeStyle = st.acc; x.globalAlpha = .16; x.lineWidth = 1;
    const vx = W / 2, vy = top - 160;
    const sc = KStages.scroll(st.id), ph = (this.t * sc) % 1;
    for (let i = -14; i <= 14; i++) { const u = i + (sc ? ph : 0); x.beginPath(); x.moveTo(vx + u * 40, top); x.lineTo(vx + u * 40 * 3.2 + (u * 8), H + 60); x.stroke(); }
    for (let i = 0; i < 6; i++) { const yy = top + Math.pow(((i + (sc ? ph : 0)) % 6) / 5, 1.8) * (H - top + 40); x.beginPath(); x.moveTo(-120, yy); x.lineTo(W + 120, yy); x.stroke(); }
    x.restore(); x.globalAlpha = 1;
    // borde luminoso
    const lg = x.createLinearGradient(-60, 0, W + 60, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, st.acc); lg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = lg; x.fillRect(-120, top, W + 240, 2.5);
    x.globalAlpha = .18; x.fillRect(-120, top + 2.5, W + 240, 9); x.globalAlpha = 1;
    KStages.floor(st.id, x, this._so(camL, z));
  }
  _so(camL, z) { const st = STAGES[this.stage]; return { t: this.t, q: this.q, acc: st.acc, beat: this.beat, camL, vw: W / z, sky: st.sky, top: GROUND - 6 }; }
  _sheetDraw(x, f, tint, flash) {
    const a = ANIM[f.anim], m = META[a[0]], fr = frameOf(f);
    const sx = (fr % m.cols) * m.w, sy = Math.floor(fr / m.cols) * m.h, img = this.img[a[0]];
    if (!tint && !(flash > 0)) { x.drawImage(img, sx, sy, m.w, m.h, -m.ax, -m.fy, m.w, m.h); return; }
    // versión teñida / en flash: se arma en un canvas auxiliar (sin ctx.filter, que Safari no soporta)
    const tc = this.tc, t = this.tx; t.clearRect(0, 0, tc.width, tc.height);
    const ox = 20, oy = 30; t.globalCompositeOperation = 'source-over';
    t.drawImage(img, sx, sy, m.w, m.h, ox, oy, m.w, m.h);
    if (tint) { t.globalCompositeOperation = 'multiply'; t.fillStyle = tint; t.fillRect(0, 0, tc.width, tc.height); t.globalCompositeOperation = 'destination-in'; t.drawImage(img, sx, sy, m.w, m.h, ox, oy, m.w, m.h); }
    if (flash > 0) { t.globalCompositeOperation = 'source-atop'; t.fillStyle = 'rgba(255,90,70,' + clamp(flash * 5, 0, .75) + ')'; t.fillRect(0, 0, tc.width, tc.height); t.fillStyle = 'rgba(255,255,255,' + clamp(flash * 3, 0, .5) + ')'; t.fillRect(0, 0, tc.width, tc.height); }
    t.globalCompositeOperation = 'source-over';
    x.drawImage(tc, -m.ax - ox, -m.fy - oy);
  }
  _poseDraw(x, name, tint) {
    const img = this.img[name], m = POSE[name];
    if (!tint) { x.drawImage(img, -m.ax, -m.h, m.w, m.h); return; }
    const tc = this.tc, t = this.tx, ox = 20, oy = 30; t.clearRect(0, 0, tc.width, tc.height); t.globalCompositeOperation = 'source-over';
    t.drawImage(img, ox, oy, m.w, m.h); t.globalCompositeOperation = 'multiply'; t.fillStyle = tint; t.fillRect(0, 0, tc.width, tc.height);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(img, ox, oy, m.w, m.h); t.globalCompositeOperation = 'source-over';
    x.drawImage(tc, -m.ax - ox, -m.h - oy);
  }
  _fighter(s, i, al, dt) {
    const f = s.f[i], x = this.ctx;
    // pose de fin de ronda: la ganadora festeja y la perdedora llora (animadas por código)
    let pose = null, pa = { dy: 0, dx: 0, rot: 0, sx: 1, sy: 1 };
    if ((s.phase === 'roundend' || s.phase === 'matchend') && s.res && s.res.winner >= 0) {
      const win = i === s.res.winner, k = clamp((s.phaseT - (win ? .15 : .55)) / .3, 0, 1);
      if (k > 0) {
        pose = win ? 'win' : 'lose'; const T = this.t, pop = easeBack(k);
        if (win) { const j = Math.abs(Math.sin(T * 6.5)); pa = { dy: j * 30 * k, dx: 0, rot: Math.sin(T * 3.2) * .05, sx: pop * (1 - .04 * j + .03 * (1 - j)), sy: pop * (1 + .05 * j - .03 * (1 - j)) };
          if (Math.random() < dt * 10) this.parts.push({ x: f.x + rnd(-90, 90), y: GROUND - rnd(60, 230), vx: rnd(-30, 30), vy: rnd(-90, -30), life: rnd(.4, .8), t: 0, c: '#ffe36b', r: rnd(2, 4), g: 0 }); }
        else { pa = { dy: 0, dx: Math.sin(T * 31) * 2.4 * k, rot: Math.sin(T * 2.1) * .018, sx: pop, sy: pop * (1 + .02 * Math.sin(T * 15)) };
          if (Math.random() < dt * 16) this.parts.push({ x: f.x + rnd(-26, 26), y: GROUND - rnd(150, 175), vx: rnd(-40, 40), vy: rnd(0, 60), life: rnd(.35, .6), t: 0, c: '#8fd0ff', r: rnd(2, 3.5), g: 500 }); }
      }
    }
    { const q = this.sq[i]; if (q > .01) { pa = { dy: pa.dy, dx: pa.dx, rot: pa.rot, sx: pa.sx * (1 - .15 * q), sy: pa.sy * (1 + .12 * q) }; this.sq[i] *= Math.pow(.0006, dt); } else this.sq[i] = 0; }
    const fx = lerp(f.px, f.x, al), fy = lerp(f.py, f.y, al);
    if (f.ko && pose) this.rot[i] *= Math.max(0, 1 - dt * 14); else if (f.ko) { let away = -f.dir; if (f.x + away * 240 < 10 || f.x + away * 240 > W - 10) away = -away; const target = away * (Math.PI / 2 - .12); this.rot[i] += (target - this.rot[i]) * Math.min(1, dt * 7); } else this.rot[i] *= Math.max(0, 1 - dt * 12);
    // sombra
    const shk = Math.max(.4, 1 - fy / 300);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(fx, GROUND + 2, 95 * SC * shk, 14 * SC * shk, 0, 0, 7); x.fill();
    // estela de voltereta
    if (f.cross && f.y > 0 && this.t % .04 < dt * 1.5) this.afters.push({ x: fx, y: fy, dir: f.dir, anim: f.anim, fr: frameOf(f), life: .25 });
    let lean = 0; if (f.state === 'hurt') lean = -f.dir * (.13 + .06 * Math.min(1, f.stun * 2)) * Math.min(1, f.stun * 6);
    const vf = (f.x - f.px) * 60 * f.dir; this.lean[i] += (clamp(vf * .00028, -.09, .09) - this.lean[i]) * Math.min(1, dt * 10); lean += this.lean[i] * f.dir;
    const bob = f.state === 'walk' && f.y === 0 ? Math.abs(Math.sin(this.t * 17)) * 5 : 0;
    const tint = i === 0 ? this.tints[0] : ((i === 2 && this.tints[2]) || this.tints[1]);
    const draw = (reflect) => {
      x.save();
      if (reflect) { x.translate(fx, GROUND + 6 + fy); x.scale((pose ? 1 : f.dir) * f.sx * SC * pa.sx, -f.sy * SC * .6 * pa.sy); x.globalAlpha = .16; }
      else { x.translate(fx + pa.dx + (f.shake > 0 ? (Math.random() - .5) * 8 : 0), GROUND - fy - bob - pa.dy); x.rotate(this.rot[i] + lean + pa.rot); x.scale((pose ? 1 : f.dir) * f.sx * SC * pa.sx, f.sy * SC * pa.sy); if (f.inv > .15 && f.cross) x.globalAlpha = .7; }
      if (pose) this._poseDraw(x, pose, tint); else this._sheetDraw(x, f, tint, f.flash);
      x.restore();
    };
    if (this.tier >= 2) { x.save(); x.beginPath(); x.rect(-200, GROUND + 4, W + 400, H); x.clip(); draw(true); x.restore(); }
    draw(false);
    if (f.stun > .24 && !f.ko && !pose) {  // aturdido: estrellitas girando sobre la cabeza
      for (let k = 0; k < 3; k++) { const an = this.t * 7 + k * 2.094, sx2 = fx + Math.cos(an) * 34, sy2 = GROUND - fy - 226 + Math.sin(an) * 9; x.save(); x.translate(sx2, sy2); x.rotate(an); x.fillStyle = '#ffe36b'; x.strokeStyle = '#7a5a10'; x.lineWidth = 2; x.globalAlpha = Math.min(1, f.stun * 5);
        x.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? 4 : 10, a2 = j * Math.PI / 5; x.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); } x.closePath(); x.fill(); x.stroke(); x.restore(); }
    }
    if (f.shield > 0) {
      const cy = GROUND - fy - 112, a = f.shield < 1 ? (Math.sin(this.t * 30) > 0 ? 1 : .35) : 1;
      x.save(); x.translate(fx, cy); x.globalAlpha = a;
      const g = x.createRadialGradient(0, 0, 40, 0, 0, 128); g.addColorStop(0, 'rgba(143,182,255,0)'); g.addColorStop(1, 'rgba(143,182,255,.38)');
      x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 104, 132, 0, 0, 7); x.fill();
      x.strokeStyle = '#cfe0ff'; x.lineWidth = 3; x.stroke();
      x.lineWidth = 6; x.strokeStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.ellipse(0, 0, 104, 132, 0, this.t * 3, this.t * 3 + 1.1); x.stroke();
      x.restore();
    }
    if (!f.ko) { // avisos sobre la cabeza: qué ítem tenés y qué tecla tocar
      const pk = this.pk && this.pk[i], lk = this.lk && this.lk[i], rows = [];
      if (f.power) rows.push({ e: POW[f.power].e, c: POW[f.power].c, k: pk });
      if (f.meter >= K.METER_MAX && lk) rows.push({ e: 'bark', c: '#9ff', k: lk });
      let ry = GROUND - fy - 250 + Math.sin(this.t * 5) * 4; const down = Math.sin(this.t * 9) > .3;
      for (const r of rows) {
        const ox = r.k ? -24 : 0;
        x.save(); x.translate(fx + ox, ry); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(0, 0, 2, 0, 0, 30); g.addColorStop(0, r.c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = .55; x.fillStyle = g; x.fillRect(-30, -30, 60, 60);
        x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; ICO(x, r.e, 0, 0, 26); x.restore();
        if (r.k) this._cap(x, r.k, fx + 26, ry, 24 + 3 * Math.sin(this.t * 9), down);
        ry -= 44;
      }
    }
  }
  /* poderes que caen del cielo */
  _items(s) {
    const x = this.ctx;
    for (const it of s.items) {
      if (it.y <= 0 && it.life < 3 && Math.sin(this.t * 22) > 0) continue;
      const P = POW[it.kind], fl = it.y > 0 ? 0 : Math.sin(this.t * 4 + it.x) * 6, y = GROUND - 56 - it.y - fl;
      x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = (it.y > 0 ? .3 : .16) + .08 * Math.sin(this.t * 7); x.fillStyle = P.c; x.fillRect(it.x - 16, -60, 32, y + 60);
      const g = x.createRadialGradient(it.x, y, 4, it.x, y, 46); g.addColorStop(0, P.c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = .7; x.fillStyle = g; x.fillRect(it.x - 46, y - 46, 92, 92);
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.fillStyle = 'rgba(10,10,24,.85)'; x.beginPath(); x.arc(it.x, y, 24, 0, 7); x.fill(); x.lineWidth = 3; x.strokeStyle = P.c; x.stroke();
      ICO(x, P.e, it.x, y + 1, 36); x.restore();
      if (it.y <= 0 && Math.random() < .25) this.parts.push({ x: it.x + rnd(-20, 20), y: y + rnd(-20, 20), vx: 0, vy: rnd(-60, -20), life: .5, t: 0, c: P.c, r: rnd(1.5, 3), g: 0 });
    }
  }
  /* meteoros y temblores */
  _hz(s) {
    const x = this.ctx;
    for (const h of s.hz) {
      if (h.k === 'meteor') {
        const k = clamp(h.t / h.delay, 0, 1);
        x.save(); x.translate(h.x, GROUND + 4); x.scale(1, .22); x.strokeStyle = '#ff5a3d'; x.globalAlpha = .45 + .4 * Math.sin(this.t * 24); x.lineWidth = 6;
        x.beginPath(); x.arc(0, 0, 92, 0, 7); x.stroke(); x.beginPath(); x.arc(0, 0, 92 * (1 - k), 0, 7); x.stroke(); x.restore();
        const mx = h.x + 380 * (1 - k), my = -90 + (GROUND - 60) * k * k;
        x.save(); x.globalCompositeOperation = 'lighter';
        const tg = x.createLinearGradient(mx, my, mx + 380 * (1 - k) * .45 + 60, my - (GROUND - 60) * .4 * k - 60); tg.addColorStop(0, 'rgba(255,170,60,.9)'); tg.addColorStop(1, 'rgba(255,60,20,0)');
        x.strokeStyle = tg; x.lineWidth = 34; x.lineCap = 'round'; x.beginPath(); x.moveTo(mx, my); x.lineTo(mx + 190 * (1 - k) + 60, my - 160 * Math.max(.3, k)); x.stroke();
        const g = x.createRadialGradient(mx, my, 4, mx, my, 54); g.addColorStop(0, '#fff'); g.addColorStop(.35, '#ffb347'); g.addColorStop(1, 'rgba(255,80,20,0)'); x.fillStyle = g; x.fillRect(mx - 54, my - 54, 108, 108);
        x.restore();
        if (Math.random() < .8) this.parts.push({ x: mx, y: my, vx: rnd(-40, 80), vy: rnd(-40, 40), life: .4, t: 0, c: '#ffb347', r: rnd(3, 6), g: 0 });
      } else if (h.k === 'quake') {
        const r = h.t * K.QUAKE_V, fade = clamp(1 - h.t / 1.5, 0, 1);
        for (const d of [-1, 1]) {
          const px = h.x + d * r; if (px < -80 || px > W + 80) continue;
          x.save(); x.globalAlpha = fade;
          for (let k = 0; k < 6; k++) { const bx = px - d * k * 20, hh = (58 - k * 8) * (.7 + .3 * Math.sin(this.t * 40 + k * 2)); x.fillStyle = k % 2 ? '#8a6a44' : '#c9a36a'; x.beginPath(); x.moveTo(bx - 12, GROUND + 6); x.lineTo(bx, GROUND + 6 - hh); x.lineTo(bx + 12, GROUND + 6); x.fill(); }
          x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,200,120,.8)'; x.lineWidth = 3; x.beginPath(); x.moveTo(px - d * 120, GROUND + 8); for (let k = 1; k <= 6; k++) x.lineTo(px - d * (120 - k * 20), GROUND + 8 + (k % 2 ? -7 : 7)); x.stroke();
          x.restore();
          if (Math.random() < .9) this.parts.push({ x: px, y: GROUND, vx: rnd(-50, 50), vy: rnd(-260, -80), life: rnd(.3, .6), t: 0, c: 'rgba(210,170,110,.8)', r: rnd(3, 6), g: 700 });
        }
        this.shake = Math.max(this.shake, 4 * fade);
      }
    }
  }
  _afters(dt) {
    const x = this.ctx;
    for (const a of this.afters) {
      a.life -= dt; if (a.life <= 0) continue;
      x.save(); x.globalAlpha = a.life * 1.2; x.translate(a.x, GROUND - a.y); x.scale(a.dir * SC, SC);
      const m = META[ANIM[a.anim][0]], fr = a.fr, img = this.img[ANIM[a.anim][0]];
      x.drawImage(img, (fr % m.cols) * m.w, Math.floor(fr / m.cols) * m.h, m.w, m.h, -m.ax, -m.fy, m.w, m.h); x.restore();
    }
    this.afters = this.afters.filter(a => a.life > 0);
  }
  _waves(s, dt) {
    const x = this.ctx;
    for (const p of s.proj) {
      if (p.kind === 'bone') {
        const by = GROUND - 120; x.save(); x.translate(p.x, by); x.rotate(this.t * 18 * (p.back ? -1 : 1)); ICO(x, 'bone', 0, 0, 48); x.restore();
        if (Math.random() < .7) this.parts.push({ x: p.x, y: by + rnd(-14, 14), vx: -p.dir * rnd(20, 90), vy: rnd(-20, 20), life: .3, t: 0, c: '#fff1c9', r: rnd(2, 3.5), g: 0 });
        continue;
      }
      const y = GROUND - 120, c = p.owner === 0 ? '125,200,255' : '255,150,215';
      if (Math.random() < .8) this.parts.push({ x: p.x - p.dir * 20, y: y + rnd(-30, 30), vx: -p.dir * rnd(40, 120), vy: rnd(-30, 30), life: .3, t: 0, c: 'rgb(' + c + ')', r: rnd(2, 4), g: 0 });
      x.save(); x.translate(p.x, y); x.scale(p.dir, 1);
      const g = x.createRadialGradient(0, 0, 4, 0, 0, 90); g.addColorStop(0, 'rgba(' + c + ',.5)'); g.addColorStop(1, 'rgba(' + c + ',0)'); x.fillStyle = g; x.fillRect(-90, -90, 180, 180);
      x.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const r = 20 + k * 17 + (this.t * 40 % 17); x.strokeStyle = 'rgba(' + c + ',' + (.95 - k * .25) + ')'; x.lineWidth = 7 - k * 1.6; x.beginPath(); x.arc(-26, 0, r, -.9, .9); x.stroke(); }
      x.restore();
    }
  }
  _fx(dt) {
    const x = this.ctx;
    for (const m of this.swipes) {  // estela del golpe (también cuando falla)
      m.t += dt; const k = m.t / .17; if (k > 1) continue;
      x.save(); x.translate(m.x + m.dir * 80, m.y + (m.kick ? 56 : 0)); x.scale(m.dir, 1); x.lineCap = 'round';
      x.strokeStyle = 'rgba(255,255,255,' + ((1 - k) * (m.miss ? .4 : .75)) + ')'; x.lineWidth = (m.kick ? 11 : 6) * (1 - k) + 1.5;
      x.beginPath();
      if (m.kick) x.arc(-34, 0, 118, -1.05 + k * .5, .95 + k * .5);
      else for (let i = -1; i <= 1; i++) { x.moveTo(-6 + k * 34, i * 19); x.lineTo(78 + k * 56 - Math.abs(i) * 14, i * 19); }
      x.stroke(); x.restore();
    }
    this.swipes = this.swipes.filter(m => m.t < .17);
    for (const m of this.impacts) {  // estallido del impacto: blanco un instante y luego del color del golpe
      m.t += dt; const k = m.t / .2; if (k > 1) continue;
      x.save(); x.translate(m.x, m.y); x.rotate(m.rot); const sc = m.s * (.45 + easeOut(k) * 1.15); x.globalAlpha = 1 - k * k; x.fillStyle = k < .3 ? '#fff' : m.c;
      x.beginPath(); for (let i = 0; i < 16; i++) { const r = (i % 2 ? 13 : 48) * sc, an = i * Math.PI / 8; x.lineTo(Math.cos(an) * r, Math.sin(an) * r); } x.closePath(); x.fill(); x.restore();
    }
    this.impacts = this.impacts.filter(m => m.t < .2);
    for (const r of this.rings) {
      r.t += dt; const k = r.t / .32; if (k > 1) continue;
      x.save(); x.translate(r.x, r.y); x.globalAlpha = 1 - k; x.strokeStyle = r.c; x.lineWidth = (5 * (1 - k) + 1.5) * (this.fk || 1);
      const rad = 12 + easeOut(k) * (r.big ? 52 : 34);
      x.beginPath(); x.arc(0, 0, rad, 0, 7); x.stroke();
      x.lineWidth = 4; for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + .2; x.beginPath(); x.moveTo(Math.cos(an) * rad * .6, Math.sin(an) * rad * .6); x.lineTo(Math.cos(an) * rad * 1.15, Math.sin(an) * rad * 1.15); x.stroke(); }
      x.restore();
    }
    this.rings = this.rings.filter(r => r.t < .32);
    for (const p of this.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t < p.life) { x.globalAlpha = 1 - p.t / p.life; x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, p.r * (this.fk || 1), 0, 7); x.fill(); } }
    x.globalAlpha = 1; this.parts = this.parts.filter(p => p.t < p.life);
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
    for (const h of this.texts) {
      h.t += dt; const k = h.t / .75; if (k > 1) continue;
      x.save(); x.globalAlpha = 1 - k * k; x.fillStyle = h.c; x.textAlign = 'center'; x.lineWidth = 5 * (this.fk || 1); x.strokeStyle = 'rgba(0,0,0,.65)';
      const sz = (h.big ? 40 : 28) * (this.fk || 1) * (1 + .35 * (1 - easeOut(h.t / .12))); x.font = '700 ' + sz + 'px ' + FD;
      x.strokeText(h.txt, h.x, h.y - k * 42, 320); x.fillText(h.txt, h.x, h.y - k * 42, 320); x.restore();
    }
    this.texts = this.texts.filter(h => h.t < .75);
  }

  /* ---- frame completo ---- */
  draw(s, al, dt, ui) {
    const x = this.ctx; this.t += dt; this._portrait(); this.pk = ui && ui.pk; this.lk = ui && ui.lk;
    const S = this.S; x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#000'; x.fillRect(0, 0, this.cv.width, this.cv.height);
    // cámara: zoom según la distancia entre luchadores
    const xs = s.f.filter((q, n) => n < 2 || !q.ko || s.f.every(w => w.ko || w === q)).map(q => lerp(q.px, q.x, al)), lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs), dist = hi - lo, mid = (lo + hi) / 2;
    this.kick *= Math.pow(.015, dt); let tz = clamp(1.2 - (dist - 150) / 900, 1, 1.2) + this.kick * .07, cmid = mid;
    // final del combate: la cámara se acerca a quien ganó y llueve confeti (sin zoom ni confeti con "reducir movimiento")
    const fin = s.phase === 'matchend' && s.res && s.res.winner >= 0 && s.phaseT > .5 && !this.rm;
    if (fin) {
      const w = s.f[s.res.winner]; tz = 1.28; cmid = lerp(w.px, w.x, al);
      if (this.tier >= 1 && this.parts.length < [40, 90, 200][this.tier] * .85 && Math.random() < dt * 28) this.parts.push({ x: this.cam.x + rnd(-420, 420), y: rnd(-30, 20), vx: rnd(-40, 40), vy: rnd(70, 170), life: rnd(1.6, 2.6), t: 0, c: ['#ffd84c', '#ff7aa8', '#7fe0ff', '#9dff9a', '#fff'][(Math.random() * 5) | 0], r: rnd(2, 4), g: 30 });
    }
    this.cam.z += (tz - this.cam.z) * Math.min(1, dt * 4); this.cam.x += (cmid - this.cam.x) * Math.min(1, dt * 5);
    this.beat = root.KAudio && root.KAudio.beat ? root.KAudio.beat() : null;
    if (this.auto && dt < .09) {
      this.fpsT += dt; this.fps += (dt - this.fps) * .06;
      if (this.fpsT > 1.6 && this.fps > .0245 && this.lv < LADDER.length - 1) { this.noUp = this.noUp || (this.t - this.lastUp < 25); this.lv++; this._applyLv(); }
      else if (this.fpsT > 12 && this.lv > 0 && !this.noUp && this.fps < .0185) { this.lastUp = this.t; this.lv--; this._applyLv(); }
    }
    const pcap = [40, 90, 200][this.tier]; if (this.parts.length > pcap) this.parts.splice(0, this.parts.length - pcap);
    const z = this.cam.z, vw = W / z, camL = clamp(this.cam.x - vw / 2, 0, W - vw), camT = (H - H / z) * .92;
    let sx = 0, sy = 0; if (this.shake > .3) { const km = this.rm ? .25 : 1; sx = (Math.random() - .5) * this.shake * km; sy = (Math.random() - .5) * this.shake * km; this.shake *= Math.pow(.02, dt); } else this.shake = 0;
    x.setTransform(S * z, 0, 0, S * z, (-camL + sx) * S * z, (-camT + sy) * S * z);
    this._bg(dt, camL, z); KStages.draw(STAGES[this.stage].id, x, this._so(camL, z)); this._floor(camL, z);
    this._items(s); this._hz(s); this._afters(dt);
    for (let i = s.f.length - 1; i >= 0; i--) this._fighter(s, i, al, dt);
    this._waves(s, dt); this._fx(dt);
    // pantalla
    x.setTransform(S, 0, 0, S, 0, 0);
    if (this.tier >= 1) { const vg = x.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, W * .62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); x.fillStyle = vg; x.fillRect(0, 0, W, H); }
    if (this.flash > .01) { x.globalAlpha = this.flash * (this.rm ? .25 : .85); x.fillStyle = this.flashCol; x.fillRect(0, 0, W, H); x.globalAlpha = 1; this.flash *= Math.pow(.003, dt); }
    if (ui && ui.hud) { this._hud(s, dt, ui); this._banner(s, ui); }
  }

  /* ---- HUD ---- */
  _bar(side, hp, disp, meter, wins, winsNeed, name, col, power, stam, tired) {
    const x = this.ctx, right = side === 1, bw = this.hudBw || 470, bh = 26, by = 26, sk = 16;
    const x0 = right ? W - 104 - bw : 104;
    const path = (xx, w, y, h) => { x.beginPath(); if (!right) { x.moveTo(xx, y); x.lineTo(xx + w, y); x.lineTo(xx + w - sk, y + h); x.lineTo(xx - sk * 0, y + h); } else { x.moveTo(xx, y); x.lineTo(xx + w, y); x.lineTo(xx + w, y + h); x.lineTo(xx + sk, y + h); } x.closePath(); };
    x.save();
    x.fillStyle = 'rgba(8,9,16,.78)'; path(x0 - 4, bw + 8, by - 4, bh + 8); x.fill();
    x.strokeStyle = col; x.globalAlpha = .8; x.lineWidth = 2; x.stroke(); x.globalAlpha = 1;
    path(x0, bw, by, bh); x.save(); x.clip();
    x.fillStyle = '#1a0d14'; x.fillRect(x0 - 5, by, bw + 10, bh);
    const wDisp = bw * clamp(disp, 0, 100) / 100, wHp = bw * clamp(hp, 0, 100) / 100;
    x.fillStyle = '#ffe6b0'; x.fillRect(right ? x0 + bw - wDisp : x0, by, wDisp, bh);
    const low = hp <= 30, g = x.createLinearGradient(0, by, 0, by + bh);
    if (low) { g.addColorStop(0, '#ff7a86'); g.addColorStop(1, '#d4243b'); } else { g.addColorStop(0, '#8dffb4'); g.addColorStop(1, '#1fbf5f'); }
    x.fillStyle = g; x.fillRect(right ? x0 + bw - wHp : x0, by, wHp, bh);
    x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(x0 - 5, by, bw + 10, bh * .38);
    if (low && Math.sin(this.t * 14) > 0) { x.fillStyle = 'rgba(255,60,80,.22)'; x.fillRect(x0 - 5, by, bw + 10, bh); }
    x.restore();
    // medidor de ladrido
    const my = by + bh + 7, mw = bw * .62, full = meter >= K.METER_MAX, mx = right ? x0 + bw - mw : x0;
    x.fillStyle = 'rgba(8,9,16,.75)'; x.fillRect(mx - 2, my - 2, mw + 4, 11); x.fillStyle = '#233';
    x.fillRect(mx, my, mw, 7);
    const mg = x.createLinearGradient(mx, 0, mx + mw, 0); mg.addColorStop(0, '#2bb5ff'); mg.addColorStop(1, full ? '#fff' : '#7fe7ff');
    x.fillStyle = mg; const ww = mw * meter / K.METER_MAX; x.fillRect(right ? mx + mw - ww : mx, my, ww, 7);
    if (full) { x.globalAlpha = .5 + .5 * Math.sin(this.t * 10); x.fillStyle = '#9ff'; x.fillRect(mx - 2, my - 2, mw + 4, 11); x.globalAlpha = 1; }
    x.font = '700 13px ' + FM; x.textAlign = right ? 'right' : 'left'; x.lineWidth = 4; x.strokeStyle = '#000'; const lt = full ? 'LADRIDO LISTO' : 'LADRIDO ' + Math.floor(meter) + '%'; x.strokeText(lt, right ? mx + mw : mx, my + 25); x.fillStyle = full ? '#9ff' : '#d8e0ff'; x.fillText(lt, right ? mx + mw : mx, my + 25);
    if (full && this.lk && this.lk[side]) this._cap(x, this.lk[side], right ? mx + mw - 120 : mx + 120, my + 19, 16, Math.sin(this.t * 9) > .3);
    // estamina (correr)
    { const sy = my + 29, sw = mw - 60, sxx = right ? mx : mx + 60, v = clamp((stam == null ? 100 : stam) / K.STAM_MAX, 0, 1);
      x.fillStyle = 'rgba(8,9,16,.75)'; x.fillRect(sxx - 2, sy - 2, sw + 4, 9); x.fillStyle = '#2a2a14'; x.fillRect(sxx, sy, sw, 5);
      x.fillStyle = tired ? (Math.sin(this.t * 18) > 0 ? '#ff6b7a' : '#a33') : (v < .3 ? '#ffb347' : '#ffe36b'); const w2 = sw * v; x.fillRect(right ? sxx + sw - w2 : sxx, sy, w2, 5); }
    // poder en mano
    { const cw = 150, cx0 = right ? x0 : mx + mw + 10, cy0 = my - 6, P = power && POW[power];
      x.save(); x.fillStyle = 'rgba(8,9,16,.7)'; x.beginPath(); x.roundRect ? x.roundRect(cx0, cy0, cw, 20, 6) : x.rect(cx0, cy0, cw, 20); x.fill();
      x.lineWidth = 1.5; x.strokeStyle = P ? P.c : 'rgba(255,255,255,.18)'; if (P) { x.shadowColor = P.c; x.shadowBlur = this.tier >= 1 ? (6 + 6 * Math.sin(this.t * 8)) : 0; } x.stroke(); x.shadowBlur = 0;
      x.textBaseline = 'middle'; x.textAlign = 'left';
      if (P) { ICO(x, P.e, cx0 + 12, cy0 + 7, 16); x.font = '700 11px ' + FM; x.fillStyle = P.c; x.fillText(P.n, cx0 + 28, cy0 + 11, 90); }
      else { x.font = '600 10px ' + FM; x.fillStyle = 'rgba(200,210,255,.35)'; x.fillText('SIN PODER', cx0 + 8, cy0 + 11); }
      if (P && this.pk && this.pk[side]) this._cap(x, this.pk[side], cx0 + cw - 18, cy0 + 10, 16, Math.sin(this.t * 9) > .3);
      x.restore(); }
    // nombre + rondas
    x.font = '700 22px ' + FD; x.textAlign = right ? 'right' : 'left'; x.lineJoin = 'round'; x.lineWidth = 5; x.strokeStyle = '#000'; x.strokeText(name, right ? x0 + bw : x0, by - 8, 300); x.fillStyle = '#fff'; x.fillText(name, right ? x0 + bw : x0, by - 8, 300);
    for (let i = 0; i < winsNeed; i++) {
      const cx = right ? x0 + bw - 8 - i * 22 : x0 + 8 + i * 22, cy = my + 38 - 2;
      x.beginPath(); x.arc(cx, cy, 7, 0, 7);
      if (i < wins) { x.fillStyle = '#ffd84c'; x.shadowColor = '#ffd84c'; x.shadowBlur = this.tier >= 1 ? (8) : 0; x.fill(); x.shadowBlur = 0; } else { x.strokeStyle = 'rgba(180,190,255,.55)'; x.lineWidth = 2; x.stroke(); }
    }
    // retrato
    if (this.portrait) {
      const px = right ? W - 56 : 56, py = 50;
      x.save(); x.beginPath(); x.arc(px, py, 34, 0, 7); x.clip();
      if (this.tints[right ? 1 : 0]) { x.drawImage(this.portrait, px - 34, py - 34, 68, 68); x.globalCompositeOperation = 'multiply'; x.fillStyle = this.tints[right ? 1 : 0]; x.fillRect(px - 34, py - 34, 68, 68); }
      else x.drawImage(this.portrait, px - 34, py - 34, 68, 68);
      x.restore();
      x.beginPath(); x.arc(px, py, 34, 0, 7); x.lineWidth = 3; x.strokeStyle = right ? '#8fb6ff' : '#fff'; x.stroke();
      x.beginPath(); x.arc(px, py, 38, 0, 7); x.lineWidth = 1.5; x.strokeStyle = 'rgba(255,255,255,.25)'; x.stroke();
    }
    x.restore();
  }
  _hud(s, dt, ui) {
    const x = this.ctx, st = STAGES[this.stage];
    for (let i = 0; i < s.f.length; i++) this.hpd[i] += (s.f[i].hp - this.hpd[i]) * Math.min(1, dt * (s.f[i].hp < this.hpd[i] ? 1.6 : 8));
    const f = this.hudK || 1; this.hudBw = clamp(590 / f - 104, 260, 470);   // el bloque entero ocupa lo mismo: más alto y con letra más grande, un poco más angosto
    x.save(); x.scale(f, f); this._bar(0, s.f[0].hp, this.hpd[0], s.f[0].meter, s.wins[0], s.opt.wins, this.names[0], st.acc, s.f[0].power, s.f[0].stam, s.f[0].tired); x.restore();
    x.save(); x.translate(W, 0); x.scale(f, f); x.translate(-W, 0); this._bar(1, s.f[1].hp, this.hpd[1], s.f[1].meter, s.wins[1], s.opt.wins, this.names[1], st.acc, s.f[1].power, s.f[1].stam, s.f[1].tired); x.restore();
    if (s.f[2]) { // perro enemigo nº 2: barra compacta debajo de la del primero
      const q = s.f[2], bw = Math.min(300, this.hudBw), x1 = W - 104, y1 = 128, w1 = bw * clamp(this.hpd[2], 0, 100) / 100, w2 = bw * clamp(q.hp, 0, 100) / 100;
      x.save(); x.translate(W, 0); x.scale(f, f); x.translate(-W, 0); x.fillStyle = 'rgba(8,9,16,.78)'; x.fillRect(x1 - bw - 3, y1 - 3, bw + 6, 16); x.fillStyle = '#1a0d14'; x.fillRect(x1 - bw, y1, bw, 10);
      x.fillStyle = '#ffe6b0'; x.fillRect(x1 - w1, y1, w1, 10); x.fillStyle = q.hp <= 30 ? '#d4243b' : '#1fbf5f'; x.fillRect(x1 - w2, y1, w2, 10);
      x.font = '700 18px ' + FD; x.textAlign = 'right'; x.lineWidth = 5; x.strokeStyle = '#000'; const nt = (this.names[2] || 'ALIADO') + (q.ko ? ' ✖' : ''); x.strokeText(nt, x1, y1 + 32, 300); x.fillStyle = q.ko ? 'rgba(255,255,255,.5)' : '#fff'; x.fillText(nt, x1, y1 + 32, 300); x.restore();
    }
    // reloj
    const cx = W / 2, cy = 44, inf = s.opt.time <= 0 || s.opt.mode === 'practice', t = Math.max(0, Math.ceil(s.timeLeft));
    x.save(); x.translate(cx, cy); x.scale(Math.min(f, 1.15), Math.min(f, 1.15)); x.translate(-cx, -cy); x.beginPath(); for (let i = 0; i < 6; i++) { const an = Math.PI / 6 + i * Math.PI / 3; x.lineTo(cx + Math.cos(an) * 42, cy + Math.sin(an) * 36); } x.closePath();
    x.fillStyle = 'rgba(8,9,16,.82)'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = (!inf && t <= 10 && s.phase === 'fight') ? '#ff6b7a' : st.acc; x.stroke();
    x.textAlign = 'center'; x.font = '700 ' + (inf ? 34 : 34) + 'px ' + FD; x.fillStyle = (!inf && t <= 10 && s.phase === 'fight') ? '#ff6b7a' : '#fff'; x.fillText(inf ? '∞' : String(t), cx, cy + 12);
    x.font = '600 11px ' + FM; x.fillStyle = st.acc; x.fillText(s.opt.mode === 'practice' ? 'PRÁCTICA' : 'RONDA ' + s.round, cx, cy + 56);
    x.restore();
    // combo
    for (let i = 0; i < 2; i++) {
      const c = s.combo[i]; if (c.n < 2 || c.t <= 0) continue;
      const right = i === 1, k = Math.min(1, c.t * 2), sc = 1 + .3 * this.pop[i];
      x.save(); x.globalAlpha = k; x.translate(right ? W - 60 : 60, 235); x.scale(sc * f, sc * f); x.textAlign = right ? 'right' : 'left';
      x.font = '700 18px ' + FM; x.fillStyle = '#ffd84c'; x.fillText('COMBO', 0, -34); x.font = '700 52px ' + FD; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.6)'; x.strokeText('x' + c.n, 0, 6); x.fillStyle = '#fff'; x.fillText('x' + c.n, 0, 6); x.restore();
    }
    for (let i = 0; i < 3; i++) this.pop[i] *= Math.pow(.01, dt);
    // teclas (primeros segundos): dibujadas, sin texto
    if (ui.hint && ui.rows) this._rows(ui.rows, clamp(ui.hint, 0, 1));
    if (ui.badge) { x.textAlign = 'right'; x.font = '600 11px ' + FM; x.fillStyle = 'rgba(200,210,255,.6)'; x.fillText(ui.badge, W - 14, H - 12, 520); }
  }
  /* marca de agua: logo LeiaKOMBAT chico y tenue sobre el piso, para que cualquier captura se reconozca */
  _mark() {
    const im = this.img.logo; if (!im || !im.complete || !im.naturalWidth) return;
    const x = this.ctx, w = 150 * Math.min(1.3, this.hudK || 1), h = w * im.naturalHeight / im.naturalWidth;
    x.save(); x.globalAlpha = .6; x.drawImage(im, W / 2 - w / 2, H - h - 8, w, h); x.restore();
  }
  _banner(s, ui) {
    const x = this.ctx; let big = '', small = '', col = '#fff', k = 0;
    if (s.phase === 'intro') {
      if (s.phaseT < .9) { big = 'RONDA ' + s.round; if (s.opt.mode === 'practice') big = 'PRÁCTICA'; k = s.phaseT / .9; }
      else { big = '¡PELEA!'; col = '#ffd84c'; k = (s.phaseT - .9) / .6; }
    } else if (s.phase === 'roundend' || s.phase === 'matchend') {
      const r = s.res; if (!r) return; k = s.phaseT / .5;
      if (r.reason === 'ko') { big = 'K.O.'; col = '#ff4c5e'; } else if (r.reason === 'forfeit') { big = 'ABANDONO'; col = '#ffd84c'; } else big = 'TIEMPO';
      if (r.winner < 0) small = 'EMPATE';
      else if (r.perfect) small = 'PERFECTO · ' + this.names[r.winner];
      else small = (s.opt.mode === 'versus' ? this.names[r.winner] : this.names[r.winner]) + ' GANA LA RONDA';
      if (s.phase === 'matchend' && r.winner >= 0 && s.phaseT > 1.1) {   // 2.º tiempo del final: el nombre de quien ganó el combate
        k = (s.phaseT - 1.1) / .45; big = String(this.names[r.winner] || '').slice(0, 12) || 'GANADOR'; col = '#ffd84c'; small = r.perfect ? '★ PERFECTO ★' : 'GANA EL COMBATE';
      }
      if (s.phase === 'matchend' && ui.hideResult) return;
    } else return;
    const sc = .7 + .3 * easeBack(k), a = clamp(k * 3, 0, 1) * (s.phase === 'intro' ? clamp(2 - k * 1.6, 0, 1) : 1);
    x.save(); x.globalAlpha = a; x.translate(W / 2, H / 2 - 40); x.scale(sc, sc);
    const bh = small ? 150 : 110; const g = x.createLinearGradient(-W / 2, 0, W / 2, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.18, 'rgba(0,0,0,.7)'); g.addColorStop(.82, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(-W / 2, -bh / 2 - 6, W, bh);
    x.textAlign = 'center'; x.font = '700 ' + (big.length > 6 ? 78 : 96) + 'px ' + FD; x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.7)'; x.strokeText(big, 0, small ? 6 : 30, 1000); x.fillStyle = col; x.shadowColor = col; x.shadowBlur = this.tier >= 1 ? (24) : 0; x.fillText(big, 0, small ? 6 : 30, 1000); x.shadowBlur = 0;
    if (small) { x.font = '600 26px ' + FD; x.fillStyle = '#fff'; x.fillText(small, 0, 52, 1000); }
    x.restore();
  }
}
root.KRender = { Renderer, STAGES, POW };
})(window);
