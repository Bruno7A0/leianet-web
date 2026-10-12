// Partículas de bloque (escombros), humo y chispas. Se dibujan como cubitos con un trozo de la textura.
// Anillo de objetos reutilizados (sin crear ni destruir objetos por partícula) y baja por intercambio:
// una explosión con cientos de partículas ya no genera basura ni cuesta O(n²).
import { TILE_OF } from '../blocks/blocks.js';
import { TILES } from '../blocks/atlas.js';

const mk = () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.05, tile: 0, gravity: 18, u: 0, v: 0, us: 0.25, shade: 1, kind: 0, bounce: 0 });
const KIND_BLOCK = 0, KIND_SMOKE = 1, KIND_SPARK = 2;

export class Particles {
  constructor(max = 600) {
    this.max = max; this.scale = 1;
    this.pool = []; this.n = 0;
  }

  _alloc() {
    if (this.n >= this.max) { // lleno: se recicla la más vieja (la de menor vida restante)
      let k = 0, best = Infinity;
      for (let i = 0; i < this.n; i += 3) if (this.pool[i].life < best) { best = this.pool[i].life; k = i; }
      return this.pool[k];
    }
    let p = this.pool[this.n];
    if (!p) p = this.pool[this.n] = mk();
    this.n++;
    return p;
  }

  burst(x, y, z, blockId, count = 14, power = 3) {
    const tile = TILE_OF[blockId * 3 + 2];
    count = Math.max(1, Math.round(count * this.scale));
    for (let i = 0; i < count; i++) {
      const p = this._alloc();
      p.x = x + Math.random(); p.y = y + Math.random(); p.z = z + Math.random();
      p.vx = (Math.random() - 0.5) * power; p.vy = Math.random() * power * 0.9 + 1; p.vz = (Math.random() - 0.5) * power;
      p.max = p.life = 0.55 + Math.random() * 0.8; p.size = 0.045 + Math.random() * 0.055; p.tile = tile; p.gravity = 18;
      p.u = Math.floor(Math.random() * 3) / 4; p.v = Math.floor(Math.random() * 3) / 4; p.us = 0.25;
      p.shade = 0.8 + Math.random() * 0.25; p.kind = KIND_BLOCK; p.bounce = 0.35;
    }
  }

  // Humo / polvo de explosión
  puff(x, y, z, count = 20, spread = 3) {
    count = Math.max(1, Math.round(count * this.scale));
    for (let i = 0; i < count; i++) {
      const p = this._alloc();
      p.x = x + (Math.random() - 0.5) * spread; p.y = y + (Math.random() - 0.5) * spread; p.z = z + (Math.random() - 0.5) * spread;
      p.vx = (Math.random() - 0.5) * 2; p.vy = Math.random() * 2 + 0.5; p.vz = (Math.random() - 0.5) * 2;
      p.max = p.life = 0.8 + Math.random() * 0.9; p.size = 0.18 + Math.random() * 0.22; p.tile = TILES.SMOKE; p.gravity = -1.5;
      p.u = 0; p.v = 0; p.us = 1; p.shade = 0.6 + Math.random() * 0.35; p.kind = KIND_SMOKE; p.bounce = 0;
    }
  }

  // Chispas calientes (golpes, antorchas que se rompen, explosiones): pequeñas, rápidas y brillantes.
  sparks(x, y, z, count = 8, power = 4, tile = TILES.GLOWSTONE) {
    count = Math.max(1, Math.round(count * this.scale));
    for (let i = 0; i < count; i++) {
      const p = this._alloc();
      p.x = x; p.y = y; p.z = z;
      p.vx = (Math.random() - 0.5) * power; p.vy = Math.random() * power * 0.7 + 0.5; p.vz = (Math.random() - 0.5) * power;
      p.max = p.life = 0.3 + Math.random() * 0.4; p.size = 0.025 + Math.random() * 0.025; p.tile = tile; p.gravity = 14;
      p.u = 0; p.v = 0; p.us = 1; p.shade = 2.4; p.kind = KIND_SPARK; p.bounce = 0.3; // shade > 1: brilla más que el entorno
    }
  }

  update(dt, world) {
    const pool = this.pool;
    for (let i = this.n - 1; i >= 0; i--) {
      const p = pool[i];
      p.life -= dt;
      if (p.life <= 0) { const last = pool[--this.n]; pool[this.n] = p; pool[i] = last; continue; } // baja por intercambio
      p.vy -= p.gravity * dt;
      if (p.kind === KIND_SMOKE) { const d = Math.max(0, 1 - dt * 1.2); p.vx *= d; p.vz *= d; } // el humo se frena
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      if (p.gravity > 0 && world.isSolid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
        // rebota contra el suelo y se frena por rozamiento
        if (world.isSolid(Math.floor(p.x), Math.floor(ny), Math.floor(p.z))) {
          p.vy = Math.abs(p.vy) > 2 ? -p.vy * p.bounce : 0;
          p.vx *= 0.6; p.vz *= 0.6;
        } else { p.vx *= -0.3; p.vz *= -0.3; }
        continue;
      }
      p.x = nx; p.y = ny; p.z = nz;
    }
  }

  draw(batch) {
    const pool = this.pool;
    for (let i = 0; i < this.n; i++) {
      const p = pool[i], k = p.life / p.max;
      let s = p.size;
      if (p.kind === KIND_SMOKE) s *= Math.min(1, p.life * 1.5) * (1.4 - 0.4 * k); // crece un poco al disiparse
      else s *= k < 0.25 ? 0.4 + k * 2.4 : 1;                                       // se achica al final
      batch.box(p.x, p.y, p.z, s, s, s, { tile: p.tile, uvSub: p.us === 1 ? null : [p.u, p.v, p.us], shade: p.shade });
    }
  }
}
