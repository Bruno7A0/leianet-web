import { CHUNK_SIZE as S, CHUNK_HEIGHT as H } from './constants.js';

// Un chunk guarda sus bloques en un único Uint8Array (1 byte por bloque).
// Índice = x | (z << 4) | (y << 8)  (capas horizontales contiguas).
export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(S * S * H);
    this.maxY = 0;      // altura máxima con bloques (acelera el meshing)
    this.gpu = null;    // buffers de GPU (los gestiona el Renderer)
    this.base = null;   // copia del terreno generado, hecha al primer cambio: sirve para guardar sólo lo editado y para no descargar chunks editados
  }
  static index(x, y, z) { return x | (z << 4) | (y << 8); }
  get(x, y, z) { return this.blocks[x | (z << 4) | (y << 8)]; }
  set(x, y, z, id) {
    this.blocks[x | (z << 4) | (y << 8)] = id;
    if (id !== 0 && y > this.maxY) this.maxY = y;
  }
  recomputeMaxY() {
    const b = this.blocks;
    for (let y = H - 1; y >= 0; y--) {
      const base = y << 8;
      for (let i = 0; i < 256; i++) {
        if (b[base + i] !== 0) { this.maxY = y; return; }
      }
    }
    this.maxY = 0;
  }
}
