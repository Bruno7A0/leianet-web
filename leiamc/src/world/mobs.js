// Zombis: aparecen de noche en la superficie, te persiguen y golpean. Se pueden matar con herramientas/espada.
import { TILES } from '../blocks/atlas.js';

const MAX_MOBS = 7, HW = 0.3, H = 1.8, SPEED = 2.7, REACH = 1.25;

export class Mobs {
  constructor() { this.list = []; this.spawnT = 2; }

  clear() { this.list.length = 0; }

  _solid(world, x, y, z) { return world.isSolid(Math.floor(x), Math.floor(y), Math.floor(z)); }

  _spawn(world, player) {
    const a = Math.random() * Math.PI * 2, d = 16 + Math.random() * 14;
    const x = player.pos[0] + Math.cos(a) * d, z = player.pos[2] + Math.sin(a) * d;
    for (let y = Math.floor(player.pos[1]) + 12; y > Math.floor(player.pos[1]) - 20; y--) {
      if (world.isSolid(Math.floor(x), y, Math.floor(z))) {
        if (!world.isSolid(Math.floor(x), y + 1, Math.floor(z)) && !world.isSolid(Math.floor(x), y + 2, Math.floor(z))
          && world.getBlock(Math.floor(x), y + 1, Math.floor(z)) === 0) {
          this.list.push({ pos: [x, y + 1, z], vel: [0, 0, 0], hp: 20, yaw: 0, hitCd: 0, flash: 0, kb: 0, onGround: false, dead: 0 });
        }
        return;
      }
    }
  }

  update(dt, world, player, night, hurtPlayer, particles, onKill) {
    this.spawnT -= dt;
    if (night && this.spawnT <= 0 && this.list.length < MAX_MOBS) { this.spawnT = 3 + Math.random() * 4; this._spawn(world, player); }
    else if (this.spawnT <= 0) this.spawnT = 3;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i], p = m.pos;
      const dx = player.pos[0] - p[0], dz = player.pos[2] - p[2], dy = player.pos[1] - p[1];
      const dist = Math.hypot(dx, dz);
      m.hitCd -= dt; m.flash -= dt; m.kb -= dt;
      // De día se queman; lejos o muertos desaparecen
      if (!night && !world.isSolid(Math.floor(p[0]), Math.floor(p[1] + 2.2), Math.floor(p[2]))) {
        m.hp -= 2.5 * dt; if (Math.random() < dt * 6) particles.puff(p[0], p[1] + 1.2, p[2], 2, 0.6);
      }
      if (m.hp <= 0 && m.byPlayer && onKill) onKill(m);
      if (m.hp <= 0 || dist > 60) { particles.puff(p[0], p[1] + 0.9, p[2], 10, 1.2); this.list.splice(i, 1); continue; }

      if (dist < 40 && m.kb <= 0) {
        const tx = dx / (dist || 1), tz = dz / (dist || 1);
        m.vel[0] += (tx * SPEED - m.vel[0]) * Math.min(1, dt * 8);
        m.vel[2] += (tz * SPEED - m.vel[2]) * Math.min(1, dt * 8);
        m.yaw = Math.atan2(tx, tz);
      } else if (m.kb > 0) { m.vel[0] *= 0.96; m.vel[2] *= 0.96; }
      m.vel[1] = Math.max(m.vel[1] - 32 * dt, -50);

      // Eje X / Z con salto automático si hay un escalón
      for (const ax of [0, 2]) {
        const nv = p[ax] + m.vel[ax] * dt, sgn = Math.sign(m.vel[ax]);
        const probe = nv + sgn * HW;
        const bx = ax === 0 ? probe : p[0], bz = ax === 2 ? probe : p[2];
        if (this._solid(world, bx, p[1] + 0.1, bz) || this._solid(world, bx, p[1] + 1.2, bz)) {
          if (m.onGround && !this._solid(world, bx, p[1] + 1.1, bz) && !this._solid(world, bx, p[1] + 2.1, bz)) m.vel[1] = 8.5;
          m.vel[ax] = 0;
        } else p[ax] = nv;
      }
      // Eje Y
      const ny = p[1] + m.vel[1] * dt;
      m.onGround = false;
      if (m.vel[1] <= 0 && this._solid(world, p[0], ny, p[2])) { p[1] = Math.floor(ny) + 1; m.vel[1] = 0; m.onGround = true; }
      else if (m.vel[1] > 0 && this._solid(world, p[0], ny + H, p[2])) m.vel[1] = 0;
      else p[1] = ny;
      if (p[1] < -10) { this.list.splice(i, 1); continue; }

      // Ataque cuerpo a cuerpo
      if (dist < REACH && Math.abs(dy) < 1.6 && m.hitCd <= 0) {
        m.hitCd = 1.0;
        hurtPlayer(3);
        const kx = dx / (dist || 1), kz = dz / (dist || 1);
        player.vel[0] += kx * 6; player.vel[2] += kz * 6; player.vel[1] = Math.max(player.vel[1], 4);
      }
    }
  }

  // Rayo contra las cajas de los zombis. Devuelve {mob, dist} del más cercano.
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const m of this.list) {
      const lo = [m.pos[0] - HW, m.pos[1], m.pos[2] - HW], hi = [m.pos[0] + HW, m.pos[1] + H, m.pos[2] + HW];
      let t0 = 0, t1 = maxDist, ok = true;
      for (let a = 0; a < 3 && ok; a++) {
        if (Math.abs(dir[a]) < 1e-9) { if (origin[a] < lo[a] || origin[a] > hi[a]) ok = false; continue; }
        let a0 = (lo[a] - origin[a]) / dir[a], a1 = (hi[a] - origin[a]) / dir[a];
        if (a0 > a1) [a0, a1] = [a1, a0];
        t0 = Math.max(t0, a0); t1 = Math.min(t1, a1);
        if (t0 > t1) ok = false;
      }
      if (ok && (!best || t0 < best.dist)) best = { mob: m, dist: t0 };
    }
    return best;
  }

  damage(m, dmg, fromX, fromZ) {
    m.hp -= dmg; m.byPlayer = true; m.flash = 0.25; m.kb = 0.35;
    const dx = m.pos[0] - fromX, dz = m.pos[2] - fromZ, d = Math.hypot(dx, dz) || 1;
    m.vel[0] = (dx / d) * 7; m.vel[2] = (dz / d) * 7; m.vel[1] = 5;
  }

  draw(batch) {
    for (const m of this.list) {
      const [x, y, z] = m.pos, o = { yaw: m.yaw, ox: x, oz: z, shade: m.flash > 0 ? 2.2 : 1 };
      const swing = Math.sin(performance.now() / 120) * Math.min(1, Math.hypot(m.vel[0], m.vel[2]) / 2) * 0.12;
      const g = TILES.WOOL_GREEN;
      batch.box(-0.14, y + 0.4, swing, 0.13, 0.4, 0.13, { ...o, tile: TILES.DOG_BLACK });   // piernas
      batch.box(0.14, y + 0.4, -swing, 0.13, 0.4, 0.13, { ...o, tile: TILES.DOG_BLACK });
      batch.box(0, y + 1.1, 0, 0.27, 0.35, 0.15, { ...o, tile: g });                          // torso
      batch.box(-0.4, y + 1.2, 0.2, 0.11, 0.11, 0.3, { ...o, tile: g });                      // brazos al frente
      batch.box(0.4, y + 1.2, 0.2, 0.11, 0.11, 0.3, { ...o, tile: g });
      batch.box(0, y + 1.65, 0, 0.25, 0.25, 0.25, { ...o, tile: { front: TILES.DOG_FACE, other: g } }); // cabeza
    }
  }
}
