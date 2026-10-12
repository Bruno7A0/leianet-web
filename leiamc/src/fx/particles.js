// Partículas de bloque (escombros) y humo. Se dibujan como cubitos con un trozo de la textura.
import { TILE_OF } from '../blocks/blocks.js';
import { TILES } from '../blocks/atlas.js';

export class Particles {
  constructor(max = 600) { this.max = max; this.list = []; this.scale = 1; }

  _push(p) { if (this.list.length >= this.max) this.list.shift(); this.list.push(p); }

  burst(x, y, z, blockId, count = 14, power = 3) {
    const tile = TILE_OF[blockId * 3 + 2];
    count = Math.max(1, Math.round(count * this.scale));
    for (let i = 0; i < count; i++) {
      this._push({
        pos: [x + Math.random(), y + Math.random(), z + Math.random()],
        vel: [(Math.random() - 0.5) * power, Math.random() * power * 0.9 + 1, (Math.random() - 0.5) * power],
        life: 0.5 + Math.random() * 0.7, size: 0.05 + Math.random() * 0.05, tile, gravity: 18,
        uv: [Math.floor(Math.random() * 3) / 4, Math.floor(Math.random() * 3) / 4, 0.25], shade: 1,
      });
    }
  }

  // Humo / chispas de explosión
  puff(x, y, z, count = 20, spread = 3) {
    count = Math.max(1, Math.round(count * this.scale));
    for (let i = 0; i < count; i++) {
      this._push({
        pos: [x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread],
        vel: [(Math.random() - 0.5) * 2, Math.random() * 2 + 0.5, (Math.random() - 0.5) * 2],
        life: 0.8 + Math.random() * 0.9, size: 0.18 + Math.random() * 0.22, tile: TILES.SMOKE, gravity: -1.5,
        uv: [0, 0, 1], shade: 0.7 + Math.random() * 0.3,
      });
    }
  }

  update(dt, world) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vel[1] -= p.gravity * dt;
      const nx = p.pos[0] + p.vel[0] * dt, ny = p.pos[1] + p.vel[1] * dt, nz = p.pos[2] + p.vel[2] * dt;
      if (p.gravity > 0 && world.isSolid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
        p.vel[0] *= 0.4; p.vel[2] *= 0.4; p.vel[1] = 0;
        continue;
      }
      p.pos[0] = nx; p.pos[1] = ny; p.pos[2] = nz;
    }
  }

  draw(batch) {
    for (const p of this.list) {
      const s = p.size * (p.tile === TILES.SMOKE ? Math.min(1, p.life * 1.5) : 1);
      batch.box(p.pos[0], p.pos[1], p.pos[2], s, s, s, { tile: p.tile, uvSub: p.uv, shade: p.shade });
    }
  }
}
