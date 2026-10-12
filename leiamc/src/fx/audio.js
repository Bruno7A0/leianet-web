// Sonidos sintetizados con WebAudio (sin archivos) + una música de fondo que nunca termina. M = silenciar.
import { B } from '../blocks/blocks.js';

// Material sonoro de cada bloque (lo que no figura acá suena a piedra: minerales, ladrillos, bedrock...).
const MATERIAL = {
  [B.GRASS]: 'grass', [B.DIRT]: 'dirt', [B.SAND]: 'sand', [B.GRAVEL]: 'gravel', [B.SNOW]: 'snow', [B.CACTUS]: 'cactus',
  [B.LOG]: 'wood', [B.PLANKS]: 'wood', [B.CRAFTING]: 'wood', [B.BOOKSHELF]: 'wood',
  [B.LEAVES]: 'leaf', [B.GLASS]: 'glass', [B.LEIA]: 'glass', [B.TNT]: 'grass', [B.WATER]: 'water',
  [B.WOOL_WHITE]: 'cloth', [B.WOOL_BLACK]: 'cloth', [B.WOOL_PINK]: 'cloth', [B.WOOL_GREEN]: 'cloth', [B.WOOL_BROWN]: 'cloth', [B.COLLIE]: 'cloth',
};
export const materialOf = (id) => MATERIAL[id] || 'stone';

// Un filtro angosto deja pasar muy poca energía del ruido blanco: sin compensar, un "paso" sale casi mudo.
// Con esto, `vol` significa aproximadamente el mismo nivel sin importar qué tan angosto sea el filtro.
export function makeup(type, f, q) {
  const NY = 22050;
  let bw;
  if (type === 'bandpass') bw = (f / Math.max(0.3, q)) * 1.57;
  else if (type === 'lowpass') bw = f * 1.1;
  else bw = NY - f;
  return Math.max(1, Math.min(8, Math.sqrt(NY / Math.max(50, bw))));
}

// Una "voz" es un sonido elemental: ruido filtrado (n) o tono (o).
const n = (f, q, dur, vol, type = 'bandpass', to = null, d = 0) => ({ t: 'n', f, q, dur, vol, type, to, d });
const o = (f, dur, vol, w = 'sine', to = null, d = 0) => ({ t: 'o', f, dur, vol, w, to, d });

// Cómo suena UN paso sobre cada superficie. Todo lo demás (romper, colocar, picar, saltar, caer) sale de acá.
export const STEP = {
  grass:  [n(1500, 0.5, 0.10, 0.20, 'bandpass', 900), n(220, 0.8, 0.07, 0.18, 'lowpass')],                                   // roce suave + golpe sordo
  dirt:   [n(750, 0.7, 0.09, 0.30, 'lowpass', 350), n(160, 0.8, 0.07, 0.20, 'lowpass')],                                      // golpe grave y seco
  sand:   [n(3400, 0.4, 0.14, 0.17, 'bandpass', 1700), n(900, 0.3, 0.10, 0.08, 'highpass')],                                  // siseo arenoso
  gravel: [n(2300, 1.2, 0.035, 0.22, 'bandpass'), n(2000, 1.3, 0.035, 0.20, 'bandpass', null, 0.03),
           n(2600, 1.2, 0.03, 0.16, 'bandpass', null, 0.06), n(380, 0.8, 0.08, 0.18, 'lowpass')],                             // crujido en 3 granos
  stone:  [n(1700, 1.6, 0.05, 0.28, 'bandpass'), n(300, 0.8, 0.06, 0.22, 'lowpass'), o(720, 0.035, 0.05, 'sine', 380)],        // golpe duro y seco
  wood:   [o(200, 0.10, 0.26, 'triangle', 110), n(750, 3, 0.05, 0.22, 'bandpass')],                                           // toc hueco
  snow:   [n(2700, 2.2, 0.05, 0.20, 'bandpass', 1900), n(2300, 2, 0.05, 0.16, 'bandpass', 1700, 0.035), n(250, 0.8, 0.07, 0.12, 'lowpass')], // crujido apretado
  leaf:   [n(3600, 0.5, 0.09, 0.13, 'bandpass', 2200), n(3000, 0.5, 0.09, 0.10, 'bandpass', 2000, 0.05)],                     // frufrú
  cloth:  [n(900, 0.5, 0.09, 0.20, 'lowpass', 400), n(1800, 0.4, 0.06, 0.06, 'bandpass')],                                    // almohadón
  glass:  [o(3300, 0.09, 0.07, 'sine', 3000), n(5200, 5, 0.10, 0.14, 'bandpass'), o(4400, 0.07, 0.04, 'sine', 4200, 0.02)],   // tintineo
  cactus: [n(900, 0.7, 0.09, 0.25, 'lowpass', 400), n(4800, 2, 0.03, 0.14, 'highpass', null, 0.01)],                          // golpe con pinchitos
  water:  [n(950, 0.6, 0.20, 0.22, 'bandpass', 420), n(2200, 0.8, 0.10, 0.10, 'bandpass', 900, 0.04)],                        // chapoteo
};

// Cómo se transforma la receta del paso según la acción. `vol`/`f`/`dur` multiplican; `thud` agrega un golpe grave.
const KIND = {
  step:  { vol: 1.20, f: 1.00, dur: 1.0 },
  hit:   { vol: 0.88, f: 0.95, dur: 0.9 },          // golpeando mientras se rompe
  jump:  { vol: 0.42, f: 1.05, dur: 0.8 },
  land:  { vol: 1.45, f: 0.85, dur: 1.2, thud: [150, 0.09, 0.45] },
  place: { vol: 1.35, f: 0.85, dur: 1.0, thud: [200, 0.06, 0.35] },
  break: { vol: 2.00, f: 0.90, dur: 1.5, reps: [[0, 1], [0.045, 0.75], [0.09, 0.5]] }, // crujido en 3 golpes que se apagan
};

// Ajuste fino de volumen por superficie (medido renderizando cada paso): que ninguna sea mucho más fuerte o floja.
const GAIN = { grass: 1.05, dirt: 0.85, stone: 0.9, sand: 1.5, wood: 0.45, leaf: 1.6, water: 1.25, glass: 1.05, gravel: 0.92, cloth: 1.1, snow: 1.35, cactus: 0.88 };

// Remates por material al ROMPER: vidrio que se hace trizas, madera que cruje.
function breakExtras(mat, rnd) {
  const out = [];
  if (mat === 'glass') for (let i = 0; i < 7; i++) out.push(o(2500 + rnd() * 4500, 0.08 + rnd() * 0.08, 0.05 + rnd() * 0.04, 'sine', null, rnd() * 0.2));
  if (mat === 'wood') out.push(n(2800, 2, 0.04, 0.2, 'highpass'), n(1200, 4, 0.06, 0.12, 'bandpass', null, 0.03));
  if (mat === 'stone') out.push(n(4200, 3, 0.03, 0.12, 'bandpass', null, 0.02));
  if (mat === 'leaf' || mat === 'cloth') out.push(n(2600, 0.5, 0.18, 0.1, 'bandpass', 1500, 0.08));
  return out;
}

// Lista de voces para (material, acción). `rnd` se puede fijar para tests. Cada reproducción varía un poco el
// tono y el volumen, así dos pasos seguidos nunca suenan idénticos.
export function voicesFor(mat, kind, rnd = Math.random) {
  const base = STEP[mat] || STEP.stone, k = KIND[kind] || KIND.step;
  const fj = 0.92 + rnd() * 0.16, vj = (0.85 + rnd() * 0.15) * (GAIN[mat] || 1);
  const out = [];
  for (const [rd, rv] of k.reps || [[0, 1]]) {
    for (const v of base) out.push({ ...v, f: v.f * k.f * fj, to: v.to ? v.to * k.f * fj : null, dur: v.dur * k.dur, vol: v.vol * k.vol * vj * rv, d: v.d + rd });
  }
  if (k.thud) out.push(n(k.thud[0], 0.8, k.thud[1], k.thud[2] * vj, 'lowpass'));
  if (kind === 'break') out.push(...breakExtras(mat, rnd));
  return out;
}

// Música de fondo "infinita": dos copias del mismo archivo que se solapan. Antes de que termine la que suena
// empieza la otra desde el principio y se hace un fundido cruzado (potencia constante), así nunca hay corte ni silencio.
// El volumen se calcula a partir de la posición de reproducción, sin depender de WebAudio (sirve también si el
// archivo viene de otro dominio) ni de temporizadores precisos.
const MUSIC_VOLUME = 0.3;
const MUSIC_FADE = 8;     // segundos de solape entre el final y el principio
const MUSIC_FADE_IN = 3;  // fundido de entrada al empezar

class EndlessMusic {
  constructor(url, muted) {
    this.muted = muted;
    this.tracks = [0, 1].map(() => {
      const a = new Audio(url);
      a.preload = 'auto'; a.loop = false; a.volume = 0; a.muted = muted;
      return a;
    });
    this.cur = 0;          // pista que suena ahora
    this.fading = false;   // ¿la otra ya está entrando?
    this.started = false;
    this.timer = null;
  }

  start() {
    if (this.started) { this._resume(); return; }
    this.started = true;
    this.tracks[0].play().catch(() => { this.started = false; });
    this.timer = setInterval(() => this._tick(), 100);
  }

  _resume() { for (const a of this.tracks) if (a.volume > 0 && a.paused) a.play().catch(() => {}); }

  setMuted(m) { this.muted = m; for (const a of this.tracks) a.muted = m; }

  _tick() {
    const a = this.tracks[this.cur], b = this.tracks[1 - this.cur];
    const d = a.duration;
    if (!isFinite(d) || d <= 0) return;
    const fade = Math.min(MUSIC_FADE, d / 3);
    const t = a.currentTime;
    let ga = Math.min(1, t / MUSIC_FADE_IN); // sólo afecta a la primera vuelta
    if (this.firstDone) ga = 1;
    if (t >= MUSIC_FADE_IN) this.firstDone = true;
    if (t >= d - fade) {
      if (!this.fading) { this.fading = true; b.currentTime = 0; b.play().catch(() => {}); }
      const p = Math.max(0, Math.min(1, (t - (d - fade)) / fade));
      a.volume = MUSIC_VOLUME * Math.cos(p * Math.PI / 2);
      b.volume = MUSIC_VOLUME * Math.sin(p * Math.PI / 2);
    } else {
      a.volume = MUSIC_VOLUME * ga;
    }
    if (this.fading && (a.ended || t >= d - 0.05)) { // b toma el relevo
      a.pause(); a.currentTime = 0; a.volume = 0;
      this.cur = 1 - this.cur; this.fading = false;
    }
  }
}

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.master = null; this.noiseBuf = null; this.music = null; this.musicURL = null; }

  // URL de la música de fondo (null = sin música). Se carga recién al jugar.
  setMusic(url) { this.musicURL = url || null; }

  // Hay que llamarlo desde un gesto del usuario (clic).
  start() {
    this._startMusic();
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    if (this.music) this.music.setMuted(this.muted);
    return this.muted;
  }

  _out(node, pan) {
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(this.master); }
    else node.connect(this.master);
  }

  _noise(freq, q, dur, vol, type = 'bandpass', sweepTo = null, delay = 0, pan = 0, norm = false) {
    if (!this.ctx) return;
    if (norm) vol *= makeup(type, freq, q);
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); this._out(g, pan);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  _tone(freq, dur, vol, type = 'square', slideTo = null, delay = 0, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); this._out(g, pan); o.start(t); o.stop(t + dur + 0.02);
  }

  _voices(list, pan = 0) {
    for (const v of list) {
      if (v.t === 'n') this._noise(v.f, v.q, v.dur, v.vol, v.type, v.to, v.d, pan, true);
      else this._tone(v.f, v.dur, v.vol * 2, v.w, v.to, v.d, pan);
    }
  }

  // Sonido de un bloque. kind: 'step' | 'hit' | 'jump' | 'land' | 'place' | 'break'.
  // Los pasos alternan un poquito de izquierda a derecha, como los pies.
  block(id, kind) {
    if (!this.ctx) return;
    let pan = 0;
    if (kind === 'step') { this.side = -(this.side || 1); pan = this.side * 0.12; }
    this._voices(voicesFor(materialOf(id), kind), pan);
  }

  // --- interfaz y acciones ---
  open(mode) { // inventario (papel / cuero) o mesa de crafteo (madera que cruje)
    if (mode === 'table') {
      this._voices(voicesFor('wood', 'place'));
      this._voices(voicesFor('wood', 'hit').map((v) => ({ ...v, d: v.d + 0.07 })));
      this._tone(140, 0.16, 0.05, 'sawtooth', 190, 0.04);
    } else {
      this._noise(600, 0.8, 0.14, 0.16, 'bandpass', 2400, 0, 0, true);
      this._tone(320, 0.08, 0.07, 'sine', 520);
    }
  }
  close() { this._noise(2200, 0.8, 0.12, 0.14, 'bandpass', 500, 0, 0, true); this._tone(480, 0.07, 0.08, 'sine', 300); }
  click() { this._tone(900, 0.03, 0.10, 'square'); this._noise(3000, 1, 0.02, 0.08, 'bandpass', null, 0, 0, true); }
  select() { this._tone(1400, 0.025, 0.11, 'sine'); }
  craft() { this._tone(660, 0.12, 0.18, 'triangle'); this._tone(990, 0.2, 0.14, 'triangle', null, 0.07); this._noise(4200, 3, 0.05, 0.05, 'bandpass', null, 0, 0, true); }
  pickup(delay = 0) { this._tone(700 + Math.random() * 120, 0.07, 0.16, 'sine', 1300, delay); }
  fly(on) { this._noise(on ? 800 : 2600, 0.6, 0.35, 0.10, 'highpass', on ? 3200 : 700, 0, 0, true); }
  swim() { this._noise(1000, 0.6, 0.28, 0.16, 'bandpass', 400, 0, (Math.random() - 0.5) * 0.3, true); this._noise(300, 0.6, 0.2, 0.10, 'lowpass', 150, 0.05, 0, true); }
  death() { this._tone(300, 0.9, 0.3, 'sawtooth', 55); this._noise(500, 1, 0.5, 0.12, 'lowpass', 80, 0, 0, true); }

  _startMusic() {
    if (!this.musicURL) return;
    if (!this.music) {
      try { this.music = new EndlessMusic(this.musicURL, this.muted); } catch (e) { return; }
    }
    this.music.start();
  }

  hurt() { this._tone(220, 0.18, 0.35, 'sawtooth', 110); this._noise(400, 1, 0.12, 0.3); }
  hiss() { this._noise(5500, 0.6, 1.4, 0.45, 'highpass', 2500); }
  tick() { this._tone(880, 0.05, 0.12, 'square'); }
  pop() { this._tone(520, 0.12, 0.3, 'triangle', 160); }
  splash() { this._noise(1200, 0.5, 0.25, 0.4, 'lowpass', 300); }
  explode() {
    this._noise(900, 0.6, 1.1, 1.0, 'lowpass', 60);
    this._noise(250, 0.8, 1.4, 0.9, 'lowpass', 40, 0.02);
    this._tone(70, 0.7, 0.6, 'sawtooth', 28);
  }
}
