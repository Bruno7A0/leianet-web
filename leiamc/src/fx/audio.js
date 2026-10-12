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
    this.mul = 1;          // multiplicador suave (baja bajo tierra / bajo el agua / durante una explosión)
    this.mulTarget = 1;
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
    this.mul += (this.mulTarget - this.mul) * 0.12; // suavizado (tick de 100 ms)
    const V = MUSIC_VOLUME * this.mul;
    const fade = Math.min(MUSIC_FADE, d / 3);
    const t = a.currentTime;
    let ga = Math.min(1, t / MUSIC_FADE_IN); // sólo afecta a la primera vuelta
    if (this.firstDone) ga = 1;
    if (t >= MUSIC_FADE_IN) this.firstDone = true;
    if (t >= d - fade) {
      if (!this.fading) { this.fading = true; b.currentTime = 0; b.play().catch(() => {}); }
      const p = Math.max(0, Math.min(1, (t - (d - fade)) / fade));
      a.volume = V * Math.cos(p * Math.PI / 2);
      b.volume = V * Math.sin(p * Math.PI / 2);
    } else {
      a.volume = V * ga;
    }
    if (this.fading && (a.ended || t >= d - 0.05)) { // b toma el relevo
      a.pause(); a.currentTime = 0; a.volume = 0;
      this.cur = 1 - this.cur; this.fading = false;
    }
  }
}

const MAX_VOICES = 56;      // tope de fuentes sonando a la vez (una cadena de TNT no satura el audio)
const HEAR_RANGE = 48;      // más allá de esto un sonido espacial no se escucha
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class Sound {
  constructor() {
    this.ctx = null; this.muted = false; this.master = null; this.noiseBuf = null; this.music = null; this.musicURL = null;
    this.bus = null; this.verb = null; this.lp = null;
    this.active = 0;
    this.L = { x: 0, y: 0, z: 0, yaw: 0 };       // oyente (para sonido espacial)
    this.cave = 0; this.water = false;
    this.amb = { drip: 4, bird: 6, cricket: 2, rumble: 40 };
  }

  // URL de la música de fondo (null = sin música). Se carga recién al jugar.
  setMusic(url) { this.musicURL = url || null; }

  // Hay que llamarlo desde un gesto del usuario (clic).
  start() {
    this._startMusic();
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    // Cadena: voces -> bus -> (reverb en paralelo) -> filtro de agua -> compresor/limitador -> master -> salida.
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 22000; this.lp.Q.value = 0.5;
    this.bus = ctx.createGain(); this.bus.gain.value = 1;
    this.verb = ctx.createConvolver();
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.14; // cuánto reverb recibe (sube en cuevas)
    this.verbOut = ctx.createGain(); this.verbOut.gain.value = 1;
    this.verb.buffer = this._impulse(1.9, 2.6);
    this.bus.connect(this.lp);
    this.bus.connect(this.verbIn); this.verbIn.connect(this.verb); this.verb.connect(this.verbOut); this.verbOut.connect(this.lp);
    this.lp.connect(comp); comp.connect(this.master); this.master.connect(ctx.destination);
    // Ruido blanco de 3 s (se reproduce desde un punto al azar); el rosa se obtiene filtrando.
    const len = ctx.sampleRate * 3;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  // Respuesta al impulso sintética: ruido estéreo que decae (reverb de sala/cueva).
  _impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.55 - 0.45 * t); // se va oscureciendo con el tiempo
        d[i] = lp * Math.pow(1 - t, decay) * (i < 90 ? i / 90 : 1);
      }
    }
    return buf;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    if (this.music) this.music.setMuted(this.muted);
    return this.muted;
  }

  // --- espacio ---------------------------------------------------------------------------------------------
  // Posición y dirección del oyente (cada cuadro). yaw: mismo que el del jugador.
  listen(x, y, z, yaw) { const L = this.L; L.x = x; L.y = y; L.z = z; L.yaw = yaw; }

  // Volumen y paneo de una fuente en el mundo, o null si no se oye.
  _spatial(pos) {
    if (!pos) return { g: 1, pan: 0, wet: 0 };
    const L = this.L, dx = pos[0] - L.x, dy = pos[1] - L.y, dz = pos[2] - L.z, d = Math.hypot(dx, dy, dz);
    if (d > HEAR_RANGE) return null;
    const g = 1 / (1 + d * d * 0.012);                              // caída cuadrática suave
    const pan = d < 0.5 ? 0 : clamp((dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / d, -1, 1) * 0.85;
    return { g, pan, wet: clamp(d / 30, 0, 1) };                    // lo lejano llega con más reverb
  }

  // Ambiente actual (cada cuadro): cave 0..1 (bajo tierra), water (cabeza bajo el agua).
  setEnv(cave, water) {
    this.cave = cave; this.water = water;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.verbIn.gain.setTargetAtTime(0.12 + 0.5 * cave, t, 0.25);
    this.lp.frequency.setTargetAtTime(water ? 650 : 22000, t, water ? 0.06 : 0.12);
    if (this.music) this.music.mulTarget = water ? 0.45 : 1 - 0.5 * cave;
  }

  // Un golpe fuerte (explosión cerca) agacha la música un instante.
  _duck(k) { if (this.music) { this.music.mul = Math.min(this.music.mul, 1 - k); } }

  // --- síntesis ---------------------------------------------------------------------------------------------
  _out(node, pan, wet = 0) {
    let out = node;
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); out = p; }
    out.connect(this.bus);
    if (wet > 0) { const w = this.ctx.createGain(); w.gain.value = wet; out.connect(w); w.connect(this.verbIn); }
  }

  _end(src, extra) {
    this.active++;
    src.onended = () => { this.active--; try { src.disconnect(); if (extra) extra.disconnect(); } catch { /* ya desconectado */ } };
  }

  _noise(freq, q, dur, vol, type = 'bandpass', sweepTo = null, delay = 0, pan = 0, norm = false, wet = 0) {
    if (!this.ctx || this.active > MAX_VOICES) return;
    if (norm) vol *= makeup(type, freq, q);
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    const g = this.ctx.createGain();
    // ataque de 2 ms: sin "clic" al arrancar; decaimiento exponencial
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); this._out(g, pan, wet);
    src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
    this._end(src, g);
  }

  _tone(freq, dur, vol, type = 'square', slideTo = null, delay = 0, pan = 0, wet = 0) {
    if (!this.ctx || this.active > MAX_VOICES) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); this._out(g, pan, wet); o.start(t); o.stop(t + dur + 0.02);
    this._end(o, g);
  }

  // `s` = { g, pan, wet } de _spatial; escala el volumen de toda la lista de voces.
  _voices(list, s = { g: 1, pan: 0, wet: 0 }) {
    const w = s.wet + this.cave * 0.15;
    for (const v of list) {
      if (v.t === 'n') this._noise(v.f, v.q, v.dur, v.vol * s.g, v.type, v.to, v.d, s.pan, true, w);
      else this._tone(v.f, v.dur, v.vol * 2 * s.g, v.w, v.to, v.d, s.pan, w);
    }
  }

  // Sonido de un bloque. kind: 'step' | 'hit' | 'jump' | 'land' | 'place' | 'break'.
  // `pos` = [x,y,z] de la fuente (por defecto es el propio jugador). Los pasos alternan de izquierda a derecha, como los pies.
  block(id, kind, pos = null) {
    if (!this.ctx) return;
    const s = this._spatial(pos);
    if (!s) return;
    if (kind === 'step' && !pos) { this.side = -(this.side || 1); s.pan = this.side * 0.14; }
    this._voices(voicesFor(materialOf(id), kind), s);
  }

  // --- interfaz y acciones ---
  open(mode) { // inventario (papel / cuero) o mesa de crafteo (madera que cruje)
    if (mode === 'table') {
      this._voices(voicesFor('wood', 'place'));
      this._voices(voicesFor('wood', 'hit').map((v) => ({ ...v, d: v.d + 0.07 })));
      this._tone(140, 0.16, 0.05, 'sawtooth', 190, 0.04);
    } else if (mode === 'chest') { // tapa que se abre: madera que cruje y un golpe sordo
      this._voices(voicesFor('wood', 'hit'));
      this._tone(130, 0.22, 0.05, 'sawtooth', 220, 0.02);
      this._noise(1800, 2, 0.12, 0.08, 'bandpass', 700, 0.06, 0, true);
    } else if (mode === 'furnace') {
      this._voices(voicesFor('stone', 'place'));
      this._noise(380, 0.8, 0.5, 0.12, 'lowpass', 160, 0.05, 0, true);   // el fuego
    } else {
      this._noise(600, 0.8, 0.14, 0.16, 'bandpass', 2400, 0, 0, true);
      this._tone(320, 0.08, 0.07, 'sine', 520);
    }
  }
  close() { this._noise(2200, 0.8, 0.12, 0.14, 'bandpass', 500, 0, 0, true); this._tone(480, 0.07, 0.08, 'sine', 300); }
  click() { this._tone(900, 0.03, 0.10, 'square'); this._noise(3000, 1, 0.02, 0.08, 'bandpass', null, 0, 0, true); }
  select() { this._tone(1400, 0.025, 0.11, 'sine'); }
  craft() {
    this._tone(660, 0.12, 0.18, 'triangle'); this._tone(990, 0.2, 0.14, 'triangle', null, 0.07);
    this._tone(1320, 0.3, 0.08, 'sine', null, 0.14, 0, 0.3);
    this._noise(4200, 3, 0.05, 0.05, 'bandpass', null, 0, 0, true);
  }
  // Recoger un ítem: "pop" burbujeante (el tono sube con cada recogida seguida, como un pequeño combo).
  pickup(delay = 0) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    this.combo = now - (this.lastPick || -9) < 0.6 ? Math.min(6, (this.combo || 0) + 1) : 0;
    this.lastPick = now;
    const f = 620 * Math.pow(1.0595, this.combo * 2) * (1 + Math.random() * 0.06);
    this._tone(f, 0.08, 0.15, 'sine', f * 1.9, delay);
    this._tone(f * 2, 0.05, 0.05, 'triangle', f * 3, delay + 0.012);
  }
  fly(on) { this._noise(on ? 800 : 2600, 0.6, 0.35, 0.10, 'highpass', on ? 3200 : 700, 0, 0, true); }
  swim() { this._noise(1000, 0.6, 0.28, 0.16, 'bandpass', 400, 0, (Math.random() - 0.5) * 0.3, true, 0.1); this._noise(300, 0.6, 0.2, 0.10, 'lowpass', 150, 0.05, 0, true); }
  death() {
    this._tone(300, 0.9, 0.3, 'sawtooth', 55, 0, 0, 0.4); this._noise(500, 1, 0.5, 0.12, 'lowpass', 80, 0, 0, true, 0.4);
    this._tone(180, 1.2, 0.12, 'triangle', 40, 0.15, 0, 0.5); this._duck(0.7);
  }

  _startMusic() {
    if (!this.musicURL) return;
    if (!this.music) {
      try { this.music = new EndlessMusic(this.musicURL, this.muted); } catch (e) { return; }
    }
    this.music.start();
  }

  hurt() {
    this._tone(220, 0.18, 0.35, 'sawtooth', 110); this._noise(400, 1, 0.12, 0.3, 'bandpass', null, 0, 0, true);
    this._noise(120, 0.8, 0.2, 0.3, 'lowpass', 60, 0, 0, true); // el golpe sordo en el cuerpo
  }
  hiss(pos = null) { const s = this._spatial(pos); if (s) this._noise(5500, 0.6, 1.4, 0.45 * s.g, 'highpass', 2500, 0, s.pan, true); }
  tick() { this._tone(880, 0.05, 0.12, 'square'); }
  // Golpe a un mob: "pop" seco con un poco de cuerpo.
  pop() { this._tone(520, 0.12, 0.3, 'triangle', 160); this._noise(900, 1.2, 0.05, 0.18, 'bandpass', 300, 0, 0, true); }
  splash() { this._noise(1200, 0.5, 0.25, 0.4, 'lowpass', 300, 0, 0, true, 0.15); this._noise(3200, 0.7, 0.18, 0.12, 'bandpass', 1400, 0.02, 0, true, 0.15); }
  // Comer: tres mordiscos crujientes.
  eat() {
    for (let i = 0; i < 4; i++) {
      const d = i * 0.17;
      this._noise(1800 + Math.random() * 600, 1.4, 0.05, 0.2, 'bandpass', 900, d, 0, true);
      this._noise(260, 0.8, 0.06, 0.18, 'lowpass', null, d, 0, true);
    }
  }
  // Voces de los mobs. type: zombie | skeleton | spider | pig | cow | chicken. kind: groan (idle) | hurt | die.
  _say(type, kind, pos) {
    const s = this._spatial(pos); if (!s) return;
    const g = s.g, pan = s.pan, w = 0.15 + s.wet, hurt = kind === 'hurt', die = kind === 'die', pm = hurt ? 1.25 : die ? 0.75 : 1;
    const r = 0.92 + Math.random() * 0.16;
    switch (type) {
      case 'pig': // oink: dos gruñidos nasales cortos
        for (let i = 0; i < (kind === 'groan' ? 2 : 1); i++) {
          const d = i * 0.19, f = 330 * pm * r;
          this._tone(f, 0.15, 0.13 * g, 'sawtooth', f * 0.6, d, pan, w);
          this._noise(1100, 3, 0.12, 0.2 * g, 'bandpass', 700, d, pan, true, w);
        }
        if (die) this._tone(260, 0.5, 0.12 * g, 'sawtooth', 70, 0.05, pan, w);
        break;
      case 'cow': { // muuu: tono grave largo con vibrato
        const f = 150 * pm * r, dur = die ? 1.0 : hurt ? 0.45 : 1.1;
        this._tone(f, dur, 0.17 * g, 'sawtooth', f * (die ? 0.5 : 0.78), 0, pan, w + 0.1);
        this._tone(f * 2.02, dur * 0.8, 0.05 * g, 'triangle', f * 1.5, 0.03, pan, w);
        this._noise(500, 2, dur * 0.8, 0.1 * g, 'bandpass', 320, 0, pan, true, w);
        break;
      }
      case 'chicken': // clo-clo-clo
        for (let i = 0; i < (hurt || die ? 4 : 3); i++) this._tone((1000 + i * 70) * pm * r, 0.06, 0.07 * g, 'square', 650 * pm, i * 0.075, pan, 0.1);
        break;
      case 'skeleton': // traqueteo de huesos
        for (let i = 0; i < (die ? 7 : 4); i++) this._noise(3000 + Math.random() * 2500, 4, 0.03, 0.22 * g, 'bandpass', null, i * 0.045, pan, true, w + 0.1);
        this._tone(420 * pm, 0.12, 0.05 * g, 'square', 280, 0, pan, w);
        break;
      case 'spider': // siseo y chasquidos
        this._noise(5200, 0.6, kind === 'groan' ? 0.5 : 0.35, 0.3 * g, 'highpass', 3000, 0, pan, true, w);
        for (let i = 0; i < 3; i++) this._tone(1800 * r, 0.025, 0.05 * g, 'square', null, 0.08 + i * 0.07, pan, w);
        if (die) this._tone(500, 0.5, 0.1 * g, 'sawtooth', 90, 0, pan, w);
        break;
      default: { // zombi: gruñido grave y ronco
        const f = (95 + Math.random() * 35) * (hurt ? 1.6 : die ? 0.8 : 1), dur = hurt ? 0.3 : die ? 0.9 : 0.7;
        this._tone(f, dur, 0.17 * g, 'sawtooth', f * 0.55, 0, pan, w + 0.05);
        this._tone(f * 1.5, dur * 0.8, 0.06 * g, 'square', f * 0.9, 0.04, pan, w);
        this._noise(420, 3, dur, 0.22 * g, 'bandpass', 180, 0, pan, true, w + 0.05);
      }
    }
  }
  mobGroan(pos = null, type = 'zombie') { this._say(type, 'groan', pos); }
  mobHurt(pos = null, type = 'zombie') { this._say(type, 'hurt', pos); }
  mobDie(pos = null, type = 'zombie') { this._say(type, 'die', pos); }
  // Disparo de arco: cuerda que vibra + silbido de la flecha.
  bow(pos = null) {
    const s = this._spatial(pos); if (!s) return;
    this._tone(220, 0.12, 0.12 * s.g, 'triangle', 110, 0, s.pan, 0.1);
    this._noise(2600, 1.5, 0.18, 0.12 * s.g, 'bandpass', 5000, 0.03, s.pan, true, 0.1);
  }
  // Lluvia continua: ruido filtrado en bucle; bajo techo se oye apagada y más suave.
  setRain(level, under) {
    if (!this.ctx) return;
    if (!this.rain && level < 0.01) return;
    if (!this.rain) {
      const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.35;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(hp); hp.connect(g); g.connect(this.bus); src.start(0, Math.random());
      this.rain = { g, f };
    }
    const t = this.ctx.currentTime, k = under ? 0.3 : 1;
    this.rain.g.gain.setTargetAtTime(level * 0.2 * k * (this.cave > 0.5 ? 0.2 : 1), t, 0.4);
    this.rain.f.frequency.setTargetAtTime(under ? 1500 : 3200, t, 0.3);
  }
  // Trueno: chasquido (si cae cerca) y un retumbo largo que se apaga. dist 0 = cerca, 1 = lejos.
  thunder(dist = 0.5) {
    const g = 1 - dist * 0.55;
    if (dist < 0.35) this._noise(2500, 0.6, 0.25, 0.7 * g, 'highpass', 800, 0, 0, true, 0.4);
    this._noise(260, 0.7, 3.2, 0.9 * g, 'lowpass', 45, 0.05, 0, true, 0.6);
    this._noise(120, 0.8, 2.6, 0.8 * g, 'lowpass', 35, 0.4, 0, true, 0.6);
    this._tone(52, 2.2, 0.5 * g, 'sine', 28, 0.1, 0, 0.5);
    this._duck(0.4 * g);
  }
  explode(pos = null, power = 1) {
    const s = this._spatial(pos); if (!s) return;
    const g = s.g * power, w = 0.35 + s.wet * 0.4, p = s.pan;
    this._noise(900, 0.6, 1.1, 1.0 * g, 'lowpass', 60, 0, p, true, w);          // estampido
    this._noise(250, 0.8, 1.4, 0.9 * g, 'lowpass', 40, 0.02, p, true, w);       // cuerpo grave
    this._tone(70, 0.7, 0.6 * g, 'sawtooth', 28, 0, p, w);                       // golpe de subgrave
    this._tone(46, 0.9, 0.5 * g, 'sine', 24, 0, p, w);
    this._noise(3400, 0.7, 0.18, 0.5 * g, 'highpass', 1500, 0, p, true, w);      // chasquido inicial
    for (let i = 0; i < 6; i++) {                                                // lluvia de escombros que cae después
      this._noise(1600 + Math.random() * 1800, 1.5, 0.05, 0.16 * g, 'bandpass', 800, 0.45 + Math.random() * 0.9, p, true, w);
    }
    this._duck(Math.min(0.75, 0.8 * s.g));
  }

  // --- ambiente -------------------------------------------------------------------------------------------
  // Se llama cada cuadro con `dt` en segundos. Gotas y retumbos en cuevas; pájaros de día y grillos de noche al aire libre.
  ambience(dt, { night = false } = {}) {
    if (!this.ctx || this.muted || this.water) return;
    const a = this.amb, caveK = this.cave;
    if (caveK > 0.6) {
      if ((a.drip -= dt) <= 0) {
        a.drip = 2.5 + Math.random() * 7;
        const f = 1100 + Math.random() * 900, pan = (Math.random() - 0.5) * 1.4;
        this._tone(f, 0.09, 0.07, 'sine', f * 0.55, 0, pan, 0.9);
        this._tone(f * 1.5, 0.05, 0.03, 'sine', f * 0.9, 0.012, pan, 0.9);
      }
      if ((a.rumble -= dt) <= 0) {
        a.rumble = 35 + Math.random() * 60;
        this._noise(140, 0.7, 2.2, 0.12, 'lowpass', 60, 0, 0, true, 0.6);
      }
    } else if (caveK < 0.15) {
      if (!night && (a.bird -= dt) <= 0) {
        a.bird = 5 + Math.random() * 11;
        const f = 2400 + Math.random() * 1700, pan = (Math.random() - 0.5) * 1.6, n = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < n; i++) {
          this._tone(f * (1 + i * 0.05), 0.07, 0.035, 'sine', f * (1.25 + 0.1 * (i & 1)), i * 0.11, pan, 0.35);
        }
      } else if (night && (a.cricket -= dt) <= 0) {
        a.cricket = 1.5 + Math.random() * 4;
        const pan = (Math.random() - 0.5) * 1.6, f = 4100 + Math.random() * 500;
        for (let i = 0; i < 4; i++) this._tone(f, 0.035, 0.018, 'triangle', null, i * 0.06, pan, 0.2);
      }
    }
  }
}
