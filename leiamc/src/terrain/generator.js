import { Perlin2D, Perlin3D } from './noise.js';
import { hash3 } from '../utils/random.js';
import { B } from '../blocks/blocks.js';
import { CHUNK_SIZE as S, CHUNK_HEIGHT as H, SEA_LEVEL } from '../world/constants.js';

// Versión del generador: va dentro de la clave del guardado. Si cambia el terreno, los guardados viejos
// (que son "diferencias contra el terreno") dejan de aplicarse en vez de dibujar bloques en cualquier lado.
export const GEN_VERSION = 2;

export const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, SNOW: 3, MOUNTAIN: 4, BEACH: 5, OCEAN: 6 };
export const BIOME_NAMES = ['Pradera', 'Bosque', 'Desierto', 'Nieve', 'Montañas', 'Playa', 'Océano'];

// Probabilidad de árbol por columna según el bioma.
const TREE_CHANCE = [0.004, 0.05, 0, 0.009, 0.002, 0, 0];
const MOUNTAIN_H = 72;   // desde esta altura (en tierra) el bioma es montaña
const SNOWCAP_H = 90;    // y por encima de esta, cubierta de nieve
const PAD = 2;           // margen de columnas vecinas (las hojas de un árbol invaden hasta 2 bloques)

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Generador de terreno: continentes y montañas con ruido, 5 biomas (clima = temperatura + humedad),
// cuevas con ruido 3D, menas, grava, bedrock, árboles y cactus. Todo determinista por la seed.
export class TerrainGenerator {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.noise = new Perlin2D(this.seed);
    this.nCont = new Perlin2D(this.seed ^ 0x9e3779b9);
    this.nTemp = new Perlin2D(this.seed ^ 0x85ebca6b);
    this.nHum = new Perlin2D(this.seed ^ 0xc2b2ae35);
    this.cave1 = new Perlin3D(this.seed ^ 0x27d4eb2f);
    this.cave2 = new Perlin3D(this.seed ^ 0x165667b1);
    this.cave3 = new Perlin3D(this.seed ^ 0xd3a2646c);
    // Estructuras fijas (mural, galería): se "estampan" al generar cada chunk, así sobreviven a descargarlo y volverlo a crear.
    this.boxes = [];
    this.cells = new Map(); // clave de chunk -> [[x, y, z, id], ...]
    this.noTrees = [];      // rectángulos { x0, z0, x1, z1 } sin árboles ni cactus
    this.noCaves = [];      // rectángulos donde las cuevas no llegan cerca de la superficie
  }

  // ---- estructuras ----
  addBox(x0, y0, z0, x1, y1, z1, id) { this.boxes.push({ x0, y0, z0, x1, y1, z1, id }); }
  addCell(x, y, z, id) {
    const k = `${x >> 4},${z >> 4}`;
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k).push([x, y, z, id]);
  }
  addNoTrees(x0, z0, x1, z1) { this.noTrees.push({ x0, z0, x1, z1 }); }
  addNoCaves(x0, z0, x1, z1) { this.noCaves.push({ x0, z0, x1, z1 }); }
  _in(rects, x, z) { for (const r of rects) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true; return false; }

  // ---- relieve y clima ----
  heightAt(wx, wz) {
    const c = this.nCont.fbm(wx * 0.0028, wz * 0.0028, 4);                 // continentalidad: océanos <-> tierra firme
    let base = 37 + c * 30;
    const m = Math.min(0.55, Math.max(0, this.noise.fbm(wx * 0.006 + 300, wz * 0.006 + 300, 4) + 0.04)); // relieve de montaña
    base += m * 175 * smooth(-0.1, 0.2, c);                                 // sólo se levanta tierra adentro
    base += this.noise.fbm(wx * 0.03 + 100, wz * 0.03 + 100, 3) * (3 + m * 16);
    return Math.max(2, Math.min(H - 14, Math.floor(base)));
  }

  _biome(wx, wz, h) {
    if (h <= SEA_LEVEL) return BIOME.OCEAN;
    if (h <= SEA_LEVEL + 1) return BIOME.BEACH;
    if (h >= MOUNTAIN_H) return BIOME.MOUNTAIN;
    const t = this.nTemp.fbm(wx * 0.0042, wz * 0.0042, 3);
    const u = this.nHum.fbm(wx * 0.0042, wz * 0.0042, 3);
    if (t > 0.13 && u < 0.07) return BIOME.DESERT;
    if (t < -0.13) return BIOME.SNOW;
    if (u > 0.04) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  biomeAt(wx, wz) { return this._biome(wx, wz, this.heightAt(wx, wz)); }

  // Altura del tronco si hay un árbol enraizado en esta columna; 0 si no hay.
  treeAt(wx, wz, h, biome) {
    const chance = TREE_CHANCE[biome];
    if (!chance || h <= SEA_LEVEL + 1 || h > H - 14) return 0;
    if (this._in(this.noTrees, wx, wz)) return 0;
    if (hash3(this.seed ^ 0x7ee, wx, 3, wz) >= chance) return 0;
    return 4 + Math.floor(hash3(this.seed ^ 0x7ef, wx, 5, wz) * 3);
  }

  // ¿Esta posición es parte de una cueva? Túneles ("espagueti": dos campos de ruido cerca de 0 a la vez)
  // y, más abajo, cavernas amplias.
  isCave(wx, y, wz) {
    const a = this.cave1.noise(wx * 0.05, y * 0.085, wz * 0.05);
    if (Math.abs(a) < 0.09 && Math.abs(this.cave2.noise(wx * 0.05 + 97, y * 0.085 + 31, wz * 0.05 + 53)) < 0.09) return true;
    return y < 38 && this.cave3.noise(wx * 0.021, y * 0.042, wz * 0.021) > 0.5;
  }

  // Punto de aparición: tierra cómoda (pradera/bosque primero), sin agua ni montaña. `fits(x, z, y0)` permite
  // pedir condiciones extra (que entre el mural). Devuelve [x, z] o null.
  findSpawn(fits = null, maxR = 200) {
    const passes = [
      (b, h) => (b === BIOME.PLAINS || b === BIOME.FOREST) && h <= SEA_LEVEL + 14,
      (b, h) => b !== BIOME.OCEAN && b !== BIOME.MOUNTAIN && h <= SEA_LEVEL + 18,
      (b, h) => h > SEA_LEVEL + 1,
    ];
    for (const ok of passes) {
      for (let r = 0; r <= maxR; r += 3) {
        const pts = [];
        if (r === 0) pts.push([0, 0]);
        else for (let i = -r; i <= r; i += 3) pts.push([i, -r], [i, r], [-r, i], [r, i]);
        for (const [x, z] of pts) {
          const h = this.heightAt(x, z);
          if (!ok(this._biome(x, z, h), h)) continue;
          if (fits && !fits(x, z, h + 1)) continue;
          return [x, z];
        }
      }
    }
    return null; // nada cumple las condiciones
  }

  generateChunk(chunk) {
    const ox = chunk.cx * S, oz = chunk.cz * S, W = S + PAD * 2;
    // Altura y bioma de cada columna del chunk + 2 de margen (los árboles vecinos invaden con sus hojas).
    const hs = new Int16Array(W * W), bs = new Uint8Array(W * W);
    for (let j = 0; j < W; j++) {
      for (let i = 0; i < W; i++) {
        const wx = ox - PAD + i, wz = oz - PAD + j, h = this.heightAt(wx, wz);
        hs[j * W + i] = h; bs[j * W + i] = this._biome(wx, wz, h);
      }
    }
    const seed = this.seed;
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const wx = ox + x, wz = oz + z, k = (z + PAD) * W + (x + PAD);
        const h = hs[k], bi = bs[k];
        const shore = bi === BIOME.OCEAN || bi === BIOME.BEACH;
        const gravelFloor = bi === BIOME.OCEAN && hash3(seed ^ 0x9a, wx >> 2, 1, wz >> 2) < 0.25;
        let top, fill, depth = 3;
        switch (bi) {
          case BIOME.OCEAN: top = gravelFloor ? B.GRAVEL : B.SAND; fill = B.SAND; break;
          case BIOME.BEACH: top = B.SAND; fill = B.SAND; break;
          case BIOME.DESERT: top = B.SAND; fill = B.SAND; depth = 4; break;
          case BIOME.SNOW: top = B.SNOW; fill = B.DIRT; break;
          case BIOME.MOUNTAIN: top = h >= SNOWCAP_H ? B.SNOW : B.STONE; fill = B.STONE; break;
          default: top = B.GRASS; fill = B.DIRT;
        }
        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = B.BEDROCK;
          else if (y === 1 && hash3(seed, wx, 99, wz) < 0.5) id = B.BEDROCK;
          else if (y === h) id = top;
          else if (y >= h - depth) id = fill;
          else {
            id = B.STONE;
            const r = hash3(seed, wx, y, wz);
            if (r < 0.012) id = B.COAL;
            else if (y < 14 && r > 0.9993) id = B.DIAMOND;
            else if (y < 20 && r > 0.998) id = B.GOLD;
            else if (y < 35 && r > 0.995) id = B.IRON;
            else if (y < 9 && r > 0.9935 && r <= 0.995) id = B.OBSIDIAN;
            else if (y > 12 && y < h - 4 && this.noise.fbm((wx + y * 5) * 0.09, (wz - y * 3) * 0.09, 2) > 0.38) id = B.GRAVEL;
          }
          chunk.set(x, y, z, id);
        }
        // Cuevas: no atraviesan el fondo de lagos/océanos ni la playa (el agua quedaría colgando).
        let carveTop = shore ? h - 4 : h > SEA_LEVEL + 3 ? h : h - 3;
        if (this._in(this.noCaves, wx, wz)) carveTop = Math.min(carveTop, h - 7);
        for (let y = 3; y <= carveTop; y++) if (this.isCave(wx, y, wz)) chunk.set(x, y, z, B.AIR);
        for (let y = h + 1; y <= SEA_LEVEL; y++) chunk.set(x, y, z, B.WATER);
        // Cactus (sólo desierto, columnas sueltas).
        if (bi === BIOME.DESERT && h > SEA_LEVEL + 1 && !this._in(this.noTrees, wx, wz) && hash3(seed ^ 0xcac, wx, 7, wz) < 0.006) {
          const ch = 2 + Math.floor(hash3(seed ^ 0xcad, wx, 8, wz) * 3);
          for (let y = h + 1; y <= h + ch; y++) chunk.set(x, y, z, B.CACTUS);
        }
      }
    }
    this._trees(chunk, hs, bs, W);
    this._stamp(chunk);
    chunk.recomputeMaxY();
  }

  // Los árboles de columnas vecinas (hasta 2 bloques) pueden invadir este chunk con sus hojas.
  _trees(chunk, hs, bs, W) {
    const ox = chunk.cx * S, oz = chunk.cz * S;
    for (let j = 0; j < W; j++) {
      for (let i = 0; i < W; i++) {
        const wx = ox - PAD + i, wz = oz - PAD + j, h = hs[j * W + i], bi = bs[j * W + i];
        const th = this.treeAt(wx, wz, h, bi);
        if (!th) continue;
        const put = (x, y, z, id, onlyAir) => {
          const lx = x - ox, lz = z - oz;
          if (lx < 0 || lx >= S || lz < 0 || lz >= S || y < 0 || y >= H) return;
          if (onlyAir && chunk.get(lx, y, lz) !== B.AIR) return;
          chunk.set(lx, y, lz, id);
        };
        const top = h + th;
        for (let y = top - 2; y <= top + 1; y++) {
          const r = y >= top ? 1 : 2;
          for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
              if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && hash3(this.seed, wx + dx, y, wz + dz) < 0.5) continue;
              if (y === top + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
              // en la nieve la copa lleva un gorro de nieve
              put(wx + dx, y, wz + dz, bi === BIOME.SNOW && y === top + 1 ? B.SNOW : B.LEAVES, true);
            }
          }
        }
        for (let y = h + 1; y <= top; y++) put(wx, y, wz, B.LOG, false);
        put(wx, h, wz, B.DIRT, false);
      }
    }
  }

  _stamp(chunk) {
    const ox = chunk.cx * S, oz = chunk.cz * S;
    for (const b of this.boxes) {
      if (b.x1 < ox || b.x0 >= ox + S || b.z1 < oz || b.z0 >= oz + S) continue;
      for (let y = Math.max(0, b.y0); y <= Math.min(H - 1, b.y1); y++) {
        for (let z = Math.max(b.z0, oz); z <= Math.min(b.z1, oz + S - 1); z++) {
          for (let x = Math.max(b.x0, ox); x <= Math.min(b.x1, ox + S - 1); x++) chunk.set(x - ox, y, z - oz, b.id);
        }
      }
    }
    const list = this.cells.get(`${chunk.cx},${chunk.cz}`);
    if (list) for (const [x, y, z, id] of list) if (y >= 0 && y < H) chunk.set(x - ox, y, z - oz, id);
  }
}
