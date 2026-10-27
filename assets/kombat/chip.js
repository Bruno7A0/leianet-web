/* LeiaKOMBAT · chip.js — sintetizador chiptune de 8 bits
   Canales como una consola vieja: 2 ondas de pulso (ancho 12.5 / 25 / 50 %), 1 triángulo (bajo) y 1 ruido (batería).
   Las canciones NO son archivos: se componen por código con una semilla fija (melodía, bajo, arpegio y batería),
   así que suenan igual cada vez, pesan 0 KB y se pueden acelerar / intensificar en vivo. Todas son originales. */
(function (root) {
'use strict';
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11] };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* prog = grados del acorde por compás (8 compases) · B = segunda parte · bass/drums = estilos */
const SONGS = {
  menu:   { bpm: 116, root: 57, mode: 'minor',    prog: [0, 5, 2, 6, 0, 5, 3, 4], B: [3, 4, 0, 5, 3, 4, 6, 6], seed: 11, bass: 'walk',  drums: 'soft',  duty: .25, oct: 0 },
  core:   { bpm: 146, root: 52, mode: 'minor',    prog: [0, 0, 5, 6, 0, 0, 3, 4], B: [5, 6, 0, 0, 5, 6, 4, 4], seed: 23, bass: 'drive', drums: 'drive', duty: .125, oct: 0 },
  marte:  { bpm: 136, root: 50, mode: 'phrygian', prog: [0, 1, 0, 6, 0, 1, 5, 4], B: [3, 3, 1, 1, 5, 5, 6, 4], seed: 37, bass: 'drive', drums: 'rock',  duty: .25, oct: 0 },
  hielo:  { bpm: 126, root: 59, mode: 'dorian',   prog: [0, 4, 5, 3, 0, 4, 1, 3], B: [5, 3, 0, 4, 5, 3, 1, 4], seed: 41, bass: 'walk',  drums: 'rock',  duty: .5, oct: 0 },
  neon:   { bpm: 110, root: 55, mode: 'minor',    prog: [0, 5, 2, 6, 0, 5, 3, 6], B: [5, 6, 0, 0, 3, 4, 5, 6], seed: 53, bass: 'pump',  drums: 'four',  duty: .25, oct: 0 },
  arcade: { bpm: 158, root: 60, mode: 'major',    prog: [0, 4, 5, 3, 0, 4, 1, 4], B: [3, 4, 2, 5, 3, 4, 0, 0], seed: 67, bass: 'walk',  drums: 'drive', duty: .125, oct: 0 },
  win95:  { bpm: 124, root: 60, mode: 'major',    prog: [0, 3, 4, 0, 0, 3, 4, 4], B: [5, 3, 0, 4, 5, 3, 4, 0], seed: 91, bass: 'walk',  drums: 'rock',  duty: .5,   oct: 0 },
  pixel:  { bpm: 138, root: 62, mode: 'lydian',   prog: [0, 4, 5, 3, 0, 4, 1, 4], B: [3, 4, 2, 5, 3, 4, 0, 0], seed: 83, bass: 'walk',  drums: 'drive', duty: .25,  oct: 0 },
  void:   { bpm: 98,  root: 45, mode: 'phrygian', prog: [0, 0, 1, 0, 0, 0, 5, 1], B: [3, 3, 1, 1, 0, 0, 6, 5], seed: 79, bass: 'drive', drums: 'half',  duty: .5, oct: 12 }
};
const RH = [ // ritmos de melodía en semicorcheas [inicio, largo]
  [[0, 3], [3, 3], [6, 2], [8, 4], [12, 4]], [[0, 4], [4, 2], [6, 2], [8, 2], [10, 2], [12, 4]], [[0, 2], [2, 2], [4, 4], [8, 3], [11, 1], [12, 4]],
  [[0, 6], [6, 2], [8, 4], [12, 2], [14, 2]], [[2, 2], [4, 2], [6, 2], [8, 6], [14, 2]], [[0, 2], [2, 1], [3, 1], [4, 4], [8, 2], [10, 2], [12, 2], [14, 2]]
];
const DRUMS = {
  soft:  { k: [0, 8], s: [12], h: [4, 12] },
  rock:  { k: [0, 8, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  drive: { k: [0, 3, 8, 11], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  four:  { k: [0, 4, 8, 12], s: [4, 12], h: [2, 6, 10, 14] },
  half:  { k: [0, 10], s: [8], h: [0, 4, 8, 12] }
};

function compose(def) {
  const R = rng(def.seed), SC = SCALES[def.mode], cache = [];
  const deg = d => def.root + SC[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const motif = () => { // 2 compases de notas expresadas como grados relativos a la raíz del acorde
    const m = []; let cur = [0, 2, 4, 7][Math.floor(R() * 4)];
    for (let b = 0; b < 2; b++) {
      const rh = RH[Math.floor(R() * RH.length)], notes = [];
      for (const [st, ln] of rh) {
        if (st % 4 === 0) { // tiempos fuertes: notas del acorde cercanas
          const c = [0, 2, 4, 7].sort((a, b2) => Math.abs(a - cur) - Math.abs(b2 - cur));
          cur = c[R() < .7 ? 0 : 1];
        } else cur += [-2, -1, -1, 1, 1, 2][Math.floor(R() * 6)];
        cur = Math.max(-2, Math.min(7, cur)); notes.push({ st, ln, off: cur });
      }
      m.push(notes);
    }
    return m;
  };
  const cadence = [{ st: 0, ln: 8, off: 0 }, { st: 8, ln: 4, off: 2 }, { st: 12, ln: 4, off: 0 }];
  const section = (prog, A, B, finalBar) => {
    for (let b = 0; b < 8; b++) {
      const c = prog[b], cc = c > 3 ? c - 7 : c;   // acordes agudos se transportan abajo: la melodía queda en un registro cómodo
      const mel = b < 2 ? A[b] : b < 4 ? A[b - 2] : b < 6 ? B[b - 4] : b === 6 ? A[0] : cadence;
      const bar = { lead: Array(16).fill(null), arp: Array(16).fill(0), bass: Array(16).fill(null), k: [], s: [], h: [], fill: b === 7 && finalBar };
      for (const n of mel) bar.lead[n.st] = { ln: n.ln, midi: deg(Math.max(5, Math.min(15, cc + n.off + 7))) + (def.oct || 0) };
      const tn = [deg(cc) + 12, deg(cc + 2) + 12, deg(cc + 4) + 12], alt = R() < .4;
      for (let i = 0; i < 16; i++) bar.arp[i] = tn[alt ? [0, 2, 1, 2][i % 4] : [0, 1, 2, 1][i % 4]];
      const r = deg(c) - 12;
      if (def.bass === 'drive') for (let i = 0; i < 16; i += 2) bar.bass[i] = { ln: 2, midi: (i === 6 || i === 14) ? r + 12 : r };
      else if (def.bass === 'walk') [[0, r], [4, deg(c + 4) - 12], [8, r + 12], [12, deg(c + 4) - 12]].forEach(([i, m]) => { bar.bass[i] = { ln: 4, midi: m }; });
      else for (const i of [2, 6, 10, 14]) bar.bass[i] = { ln: 2, midi: r };
      const D = DRUMS[def.drums]; bar.k = D.k.slice(); bar.s = D.s.slice(); bar.h = D.h.slice();
      if (bar.fill) { bar.s = bar.s.concat([10, 12, 13, 14, 15]); bar.k = bar.k.filter(x => x < 10); }
      cache.push(bar);
    }
  };
  const A1 = motif(), B1 = motif(); section(def.prog, A1, B1, true);
  const A2 = motif(), B2 = motif(); section(def.B, A2, B2, true);
  return cache;
}

class Chip {
  constructor(ac, dest) {
    this.ac = ac; this.out = ac.createGain();
    const cp = ac.createDynamicsCompressor(); cp.threshold.value = -16; cp.knee.value = 12; cp.ratio.value = 10; cp.attack.value = .003; cp.release.value = .14; // limitador: evita que el choque kick+snare+lead sature
    const mg = ac.createGain(); mg.gain.value = .72; this.out.connect(cp); cp.connect(mg); mg.connect(dest);
    this.waves = {}; for (const d of [.125, .25, .5]) this.waves[d] = this._pulse(d);
    const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), c = b.getChannelData(0);
    // ruido de 15 bits tipo NES (LFSR) en vez de ruido blanco puro
    let sr = 1; for (let i = 0; i < n; i++) { const bit = (sr ^ (sr >> 1)) & 1; sr = (sr >> 1) | (bit << 14); c[i] = (sr & 1) ? .9 : -.9; if (i % 3) c[i] = c[i - 1]; }
    this.noise = b; this.def = null; this.name = ''; this.bars = null; this.bus = null; this.timer = null;
    this.step = 0; this.next = 0; this.level = 0; this.tempo = 1; this.ring = new Float64Array(64); this.ringI = new Int32Array(64).fill(-1); this.count = 0; this.lastDur = .12;
  }
  _pulse(d) {
    const N = 40, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) { re[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * d); im[n] = 2 / (n * Math.PI) * (1 - Math.cos(n * Math.PI * d)); }
    return this.ac.createPeriodicWave(re, im);
  }
  /* ---- instrumentos ---- */
  tone(t, wave, midi, dur, vol, slide, dest) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    if (wave === 'tri') o.type = 'triangle'; else o.setPeriodicWave(this.waves[wave]);
    o.frequency.setValueAtTime(hz(midi), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(hz(midi + slide), t + dur * .9);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .004);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol * (wave === 'tri' ? .55 : .25)), t + Math.max(.01, dur * .9));
    g.gain.exponentialRampToValueAtTime(.0001, t + dur + .02);
    o.connect(g); g.connect(dest || this.bus || this.out); o.start(t); o.stop(t + dur + .05);
  }
  hit(t, dur, vol, hp, lp) {
    const ac = this.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noise; s.loop = true; f.type = lp ? 'lowpass' : 'highpass'; f.frequency.value = lp || hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus || this.out); s.start(t, (t * 7.13) % 1.5); s.stop(t + dur + .02);
  }
  kick(t, v) { const ac = this.ac, o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16); o.connect(g); g.connect(this.bus || this.out); o.start(t); o.stop(t + .18); }
  snare(t, v) { this.hit(t, .13, v, 1500); this.tone(t, 'tri', 55, .08, v * .5, -12); }
  /* ---- secuenciador ---- */
  get sd() { return 60 / this.def.bpm / 4 / (this.tempo * (1 + .09 * this.level)); }
  sched(i, t) {
    const bar = this.bars[Math.floor(i / 16) % this.bars.length], s = i % 16, d = this.sd, lv = this.level;
    const L = bar.lead[s];
    if (L) { this.tone(t, this.def.duty, L.midi, L.ln * d * .94, .1); if (lv >= 1) this.tone(t, .5, L.midi + 12, L.ln * d * .9, .035); }
    const a = bar.arp[s]; if (a) this.tone(t, .25, a, d * .8, lv >= 1 ? .06 : .04);
    const B = bar.bass[s]; if (B) this.tone(t, 'tri', B.midi, B.ln * d * .92, .24);
    if (bar.k.includes(s)) this.kick(t, .34);
    if (bar.s.includes(s)) this.snare(t, .17);
    if (bar.h.includes(s)) this.hit(t, .03, .07, 7500);
    if (lv >= 1 && s % 2 === 1) this.hit(t, .02, .04, 9000);
    this.ring[this.count & 63] = t; this.ringI[this.count & 63] = i; this.count++; this.lastDur = d;
  }
  play(name) {
    if (this.name === name && this.timer) return; const def = SONGS[name]; if (!def) return;
    this.stop(.5); const ac = this.ac;
    this.def = def; this.name = name; this.bars = def._bars || (def._bars = compose(def)); this.step = 0; this.next = ac.currentTime + .08; this.count = 0; this.ringI.fill(-1);
    const bus = this.bus = ac.createGain(); bus.gain.setValueAtTime(0, ac.currentTime); bus.gain.linearRampToValueAtTime(.82, ac.currentTime + .5); bus.connect(this.out);
    this.timer = setInterval(() => this.pump(), 25); this.pump();
  }
  pump() {
    const ac = this.ac; if (!this.def) return;
    let guard = 0; while (this.next < ac.currentTime + .16 && guard++ < 16) { this.sched(this.step, this.next); this.next += this.sd; this.step++; }
  }
  stop(fade) {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const b = this.bus; this.name = ''; this.def = null;
    if (b) { const ac = this.ac, f = fade || .3; b.gain.cancelScheduledValues(ac.currentTime); b.gain.setValueAtTime(b.gain.value, ac.currentTime); b.gain.linearRampToValueAtTime(0, ac.currentTime + f); setTimeout(() => { try { b.disconnect(); } catch (e) {} }, f * 1000 + 300); }
    this.bus = null;
  }
  setLevel(n) { this.level = n; }
  duck(sec, to) { const ac = this.ac, g = this.out.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to == null ? .18 : to, t + .05); g.linearRampToValueAtTime(1, t + sec); }
  setPaused(p) { const g = this.out.gain, t = this.ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(p ? .3 : 1, t + .12); }
  /* fase del pulso (0..1 dentro del tiempo) y número de tiempo — para sincronizar los fondos con la música */
  beat() {
    if (!this.def) return { phase: 0, n: 0, on: false };
    const now = this.ac.currentTime; let best = -1, bt = 0;
    for (let k = 0; k < 64; k++) { const i = this.ringI[k]; if (i >= 0 && this.ring[k] <= now && i > best) { best = i; bt = this.ring[k]; } }
    if (best < 0) return { phase: 0, n: 0, on: true };
    const st = best % 4 + Math.min(1, (now - bt) / this.lastDur); return { phase: (st / 4) % 1, n: Math.floor(best / 4), on: true };
  }
  /* jingles cortos (victoria, derrota, pickup…) sobre el bus principal */
  jingle(kind) {
    const t = this.ac.currentTime + .02, o = this.out;
    const seq = { win: [72, 76, 79, 84, 79, 84], lose: [67, 64, 60, 55], pick: [79, 84, 88], power: [60, 67, 72, 79, 84, 91], round: [69, 72, 76] }[kind]; if (!seq) return;
    const sp = kind === 'lose' ? .17 : kind === 'win' ? .1 : .055;
    seq.forEach((m, i) => this.tone(t + i * sp, kind === 'lose' ? 'tri' : .25, m, sp * (kind === 'lose' ? 1.6 : 1.3), kind === 'lose' ? .2 : .1, 0, o));
    if (kind === 'win') this.tone(t + seq.length * sp, .5, 84, .5, .1, 0, o);
  }
  /* render fijo (OfflineAudioContext) para pruebas */
  renderStatic(name, seconds) {
    const def = SONGS[name], bars = def._bars || (def._bars = compose(def)); this.def = def; this.bars = bars; this.bus = this.out; this.level = 0;
    let t = .02, i = 0; while (t < seconds) { this.sched(i, t); t += this.sd; i++; } this.def = null;
  }
}
root.KChip = { Chip, SONGS, compose, names: Object.keys(SONGS) };
})(typeof window !== 'undefined' ? window : globalThis);