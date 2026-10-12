// Clima: lluvia (con tormentas eléctricas) y nevada en biomas fríos. Alterna ratos despejados y ratos de precipitación.
// La lluvia se dibuja como rayitas alrededor de la cámara; no cae donde hay techo (se mide la altura de cada columna,
// refrescando unas pocas por cuadro). Devuelve el nivel de lluvia para oscurecer cielo y niebla, y los relámpagos.
import { CHUNK_HEIGHT } from '../world/constants.js';
import { IS_OPAQUE } from '../blocks/blocks.js';
import { TILES } from '../blocks/atlas.js';

const MAXD = 220;
const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const DX = new Float32Array(MAXD), DZ = new Float32Array(MAXD), DO = new Float32Array(MAXD);
for (let i = 0; i < MAXD; i++) { // posiciones fijas en un disco alrededor del jugador
  const a = hash(i, 1) * 6.2832, r = Math.sqrt(hash(i, 2)) * 13;
  DX[i] = Math.cos(a) * r; DZ[i] = Math.sin(a) * r; DO[i] = hash(i, 3);
}
const U_RAIN = (TILES.WATER % 16 + 0.5) / 16, V_RAIN = (Math.floor(TILES.WATER / 16) + 0.5) / 16;
const U_SNOW = (TILES.SNOW % 16 + 0.5) / 16, V_SNOW = (Math.floor(TILES.SNOW / 16) + 0.5) / 16;

export class Weather {
  constructor() {
    this.raining = false; this.storm = false; this.snow = false;
    this.level = 0;          // 0..1 suavizado
    this.timer = 90 + Math.random() * 120; // segundos hasta el próximo cambio
    this.flash = 0;          // relámpago actual (0..1, decae rápido)
    this.nextBolt = 10; this.thunderIn = -1; this.thunderDist = 0;
    this.top = new Int16Array(MAXD).fill(-1);
    this.rr = 0; this.under = 0;
  }

  // dt en segundos de juego. cold: el jugador está en un bioma frío (nieva en vez de llover).
  update(dt, cold, sound) {
    this.snow = cold;
    if ((this.timer -= dt) <= 0) {
      this.raining = !this.raining;
      if (this.raining) { this.timer = 90 + Math.random() * 150; this.storm = Math.random() < 0.35; this.nextBolt = 6 + Math.random() * 10; }
      else { this.timer = 240 + Math.random() * 360; this.storm = false; }
    }
    const target = this.raining ? (this.storm ? 1 : 0.65) : 0;
    this.level += (target - this.level) * Math.min(1, dt * 0.35);
    if (this.level < 0.002 && target === 0) this.level = 0;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.storm && !this.snow && this.level > 0.6 && (this.nextBolt -= dt) <= 0) { // relámpago, y el trueno llega después
      this.nextBolt = 7 + Math.random() * 18; this.flash = 1;
      this.thunderDist = Math.random(); this.thunderIn = 0.3 + this.thunderDist * 2.6;
    }
    if (this.thunderIn >= 0 && (this.thunderIn -= dt) < 0) { this.thunderIn = -1; if (sound) sound.thunder(this.thunderDist); }
    if (sound) sound.setRain(this.snow ? this.level * 0.25 : this.level, this.under);
  }

  force(on, storm = false) { this.raining = on; this.storm = storm; this.timer = 120; }

  _top(world, x, z) { // y del bloque opaco más alto de la columna
    const c = world.getChunk(x >> 4, z >> 4);
    if (!c) return -1;
    const b = c.blocks, o = (x & 15) | ((z & 15) << 4);
    let y = Math.min(c.maxY + 1, CHUNK_HEIGHT - 1);
    while (y >= 0 && !IS_OPAQUE[b[o | (y << 8)]]) y--;
    return y;
  }

  // Agrega las gotas/copos al lote de entidades. `scale`: fracción de partículas según la calidad.
  draw(batch, world, eye, yaw, scale = 1) {
    if (this.level < 0.03) { this.under = 0; return; }
    const n = Math.max(20, Math.floor(MAXD * this.level * scale)), snow = this.snow, t = performance.now() / 1000;
    const Rx = Math.cos(yaw), Rz = -Math.sin(yaw); // derecha de la cámara (las rayitas se ven siempre de frente)
    // refrescar unas pocas columnas por cuadro
    for (let k = 0; k < 24; k++) {
      const i = (this.rr = (this.rr + 1) % MAXD);
      this.top[i] = this._top(world, Math.floor(eye[0] + DX[i]), Math.floor(eye[2] + DZ[i]));
    }
    const above = this._top(world, Math.floor(eye[0]), Math.floor(eye[2]));
    this.under = above > eye[1] ? 1 : 0;
    const fall = snow ? 2.4 : 26, span = 24, w = snow ? 0.045 : 0.012, hgt = snow ? 0.045 : 0.55 + this.level * 0.2;
    const p = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], p2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const sway = snow ? Math.sin(t * 1.3 + i) * 0.4 : 0;
      const y = eye[1] + span * 0.5 - (((t * fall * (0.85 + DO[i] * 0.3)) + DO[i] * span) % span);
      if (y < this.top[i] + 1.02 && this.top[i] >= 0) continue; // ya chocó contra el suelo o el techo
      const x = eye[0] + DX[i] + sway, z = eye[2] + DZ[i] + sway * 0.7;
      // quad vertical mirando a la cámara, y su cara trasera (el culling descarta una de las dos)
      p[0] = x - Rx * w; p[1] = y; p[2] = z - Rz * w;
      p[3] = x + Rx * w; p[4] = y; p[5] = z + Rz * w;
      p[6] = x + Rx * w; p[7] = y + hgt; p[8] = z + Rz * w;
      p[9] = x - Rx * w; p[10] = y + hgt; p[11] = z - Rz * w;
      batch.quad(p, snow ? U_SNOW : U_RAIN, snow ? V_SNOW : V_RAIN, snow ? 1.4 : 1.7);
      p2[0] = p[3]; p2[1] = p[4]; p2[2] = p[5]; p2[3] = p[0]; p2[4] = p[1]; p2[5] = p[2];
      p2[6] = p[9]; p2[7] = p[10]; p2[8] = p[11]; p2[9] = p[6]; p2[10] = p[7]; p2[11] = p[8];
      batch.quad(p2, snow ? U_SNOW : U_RAIN, snow ? V_SNOW : V_RAIN, snow ? 1.4 : 1.7);
    }
  }
}
