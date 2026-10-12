import { CHUNK_SIZE as S, CHUNK_HEIGHT as H } from './constants.js';
import { IS_SOLID } from '../blocks/blocks.js';

export class World {
  constructor() {
    this.chunks = new Map();
    this.dirty = new Set(); // chunks que necesitan (re)generar su malla
    this.urgent = new Set(); // subconjunto de `dirty` por ediciones del jugador: se malla primero (sin lag al picar/poner)
    this.edits = 0;         // cuenta de bloques cambiados (el guardado lo usa para saber si hay algo nuevo)
  }

  static key(cx, cz) { return ((cx & 0xffff) << 16) | (cz & 0xffff); }

  getChunk(cx, cz) { return this.chunks.get(World.key(cx, cz)); }

  addChunk(chunk) {
    this.chunks.set(World.key(chunk.cx, chunk.cz), chunk);
    this.dirty.add(chunk);
    // Los vecinos ya cargados deben rehacer su malla (caras del borde / AO).
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const n = this.getChunk(chunk.cx + dx, chunk.cz + dz);
      if (n) this.dirty.add(n);
    }
  }

  // Saca un chunk del mundo (el llamador libera su GPU). Sólo se descargan los que nadie editó: se regeneran iguales.
  removeChunk(chunk) {
    this.chunks.delete(World.key(chunk.cx, chunk.cz));
    this.dirty.delete(chunk);
    this.urgent.delete(chunk);
  }

  // Bloque en coordenadas de mundo. Fuera de altura o en chunk no cargado => aire.
  getBlock(x, y, z) {
    if (y < 0 || y >= H) return 0;
    const c = this.chunks.get(World.key(x >> 4, z >> 4));
    return c ? c.blocks[(x & 15) | ((z & 15) << 4) | (y << 8)] : 0;
  }

  // Para colisiones: el suelo del mundo (y<0) y los chunks no cargados son sólidos.
  isSolid(x, y, z) {
    if (y < 0) return true;
    if (y >= H) return false;
    const c = this.chunks.get(World.key(x >> 4, z >> 4));
    if (!c) return true;
    return IS_SOLID[c.blocks[(x & 15) | ((z & 15) << 4) | (y << 8)]] === 1;
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= H) return false;
    const cx = x >> 4, cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (!c) return false;
    const lx = x & 15, lz = z & 15;
    if (c.get(lx, y, lz) === id) return false;
    if (!c.base) c.base = c.blocks.slice();
    c.set(lx, y, lz, id);
    this.edits++;
    if (id === 0 && y === c.maxY) c.recomputeMaxY();
    this.dirty.add(c); this.urgent.add(c);
    // Si toca el borde, el chunk vecino también debe actualizarse.
    if (lx === 0) this._mark(cx - 1, cz);
    if (lx === S - 1) this._mark(cx + 1, cz);
    if (lz === 0) this._mark(cx, cz - 1);
    if (lz === S - 1) this._mark(cx, cz + 1);
    return true;
  }

  _mark(cx, cz) {
    const n = this.getChunk(cx, cz);
    if (n) { this.dirty.add(n); this.urgent.add(n); }
  }
}
