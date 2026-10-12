// Mobs: zombis, esqueletos (con arco) y arañas de noche; chanchos, vacas y pollos de día (sin cara, a propósito).
// Se pueden matar con herramientas/espada; los animales sueltan carne.
import { TILES } from '../blocks/atlas.js';
import { B } from '../blocks/blocks.js';
import { I } from '../items/items.js';

const MAX_HOSTILE = 8, MAX_ANIMALS = 10, REACH = 1.25, ARROW_G = 16;
// hw: semi-ancho de la caja de colisión; h: alto; speed: caminar; hostile: ataca; burns: se quema de día.
const TYPES = {
  zombie:   { hw: 0.3,  h: 1.8, hp: 20, speed: 2.7, hostile: true, burns: true },
  skeleton: { hw: 0.3,  h: 1.9, hp: 20, speed: 2.4, hostile: true, burns: true },
  spider:   { hw: 0.55, h: 0.9, hp: 16, speed: 3.6, hostile: true, burns: false },
  pig:      { hw: 0.42, h: 0.9, hp: 10, speed: 1.3, hostile: false },
  cow:      { hw: 0.5,  h: 1.4, hp: 10, speed: 1.1, hostile: false },
  chicken:  { hw: 0.22, h: 0.7, hp: 4,  speed: 1.2, hostile: false },
};
// Qué suelta cada mob al morir a manos del jugador: [ítem, mín, máx].
export const MOB_DROPS = {
  zombie: [[I.RAW_MEAT, 1, 2], [I.CARROT, 0, 1]], skeleton: [[I.BONE, 1, 2]], spider: [[I.STRING, 1, 2]],
  pig: [[I.RAW_MEAT, 1, 3]], cow: [[I.RAW_MEAT, 2, 3], [I.LEATHER, 0, 2]], chicken: [[I.RAW_MEAT, 1, 1], [I.SEEDS, 0, 2]],
};

export class Mobs {
  constructor() { this.list = []; this.arrows = []; this.spawnT = 2; this.animalT = 1; }

  clear() { this.list.length = 0; this.arrows.length = 0; }

  _solid(world, x, y, z) { return world.isSolid(Math.floor(x), Math.floor(y), Math.floor(z)); }

  _make(type, x, y, z) {
    const T = TYPES[type], animal = !T.hostile;
    return { type, hw: T.hw, h: T.h, pos: [x, y, z], vel: [0, 0, 0], hp: T.hp, yaw: Math.random() * 6.28, hitCd: 0, flash: 0, kb: 0, onGround: false, lunge: 0,
      walk: Math.random() * 6.28, born: animal ? 1 : 0, dying: 0, tilt: 0, groanT: 2 + Math.random() * 7, wob: Math.random() * 6.28,
      fleeT: 0, wanderT: 0, wdx: 0, wdz: 0, shootT: 2 + Math.random() * 2 };
  }

  // Busca suelo en una columna cercana al jugador. Animales: sólo sobre pasto, de día.
  _spawn(world, player, type) {
    const a = Math.random() * Math.PI * 2, d = (type === 'pig' || type === 'cow' || type === 'chicken' ? 14 : 16) + Math.random() * 14;
    const x = player.pos[0] + Math.cos(a) * d, z = player.pos[2] + Math.sin(a) * d, ix = Math.floor(x), iz = Math.floor(z);
    for (let y = Math.floor(player.pos[1]) + 12; y > Math.floor(player.pos[1]) - 20; y--) {
      if (world.isSolid(ix, y, iz)) {
        if (!world.isSolid(ix, y + 1, iz) && !world.isSolid(ix, y + 2, iz) && world.getBlock(ix, y + 1, iz) === 0
          && (TYPES[type].hostile || world.getBlock(ix, y, iz) === B.GRASS)) {
          const n = TYPES[type].hostile ? 1 : 1 + ((Math.random() * 3) | 0); // los animales aparecen en grupitos
          for (let i = 0; i < n; i++) this.list.push(this._make(type, x + i * 0.9, y + 1, z + (i & 1) * 0.9));
        }
        return;
      }
    }
  }

  update(dt, world, player, night, hurtPlayer, particles, onKill, sound = null) {
    this.spawnT -= dt; this.animalT -= dt;
    let hostile = 0, animals = 0;
    for (const m of this.list) { if (TYPES[m.type].hostile) hostile++; else animals++; }
    if (night && this.spawnT <= 0 && hostile < MAX_HOSTILE) {
      this.spawnT = 3 + Math.random() * 4;
      const r = Math.random();
      this._spawn(world, player, r < 0.5 ? 'zombie' : r < 0.78 ? 'skeleton' : 'spider');
    } else if (this.spawnT <= 0) this.spawnT = 3;
    if (!night && this.animalT <= 0 && animals < MAX_ANIMALS) {
      this.animalT = 2 + Math.random() * 3;
      const r = Math.random();
      this._spawn(world, player, r < 0.34 ? 'pig' : r < 0.67 ? 'cow' : 'chicken');
    } else if (this.animalT <= 0) this.animalT = 4;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i], p = m.pos, T = TYPES[m.type], HW = m.hw, H = m.h;
      const dx = player.pos[0] - p[0], dz = player.pos[2] - p[2], dy = player.pos[1] - p[1];
      const dist = Math.hypot(dx, dz);
      m.hitCd -= dt; m.flash -= dt; m.kb -= dt; m.fleeT -= dt; if (m.lunge > 0) m.lunge -= dt;
      m.born = Math.min(1, m.born + dt / 0.9);
      // De día los zombis y esqueletos se queman
      if (T.burns && !night && !world.isSolid(Math.floor(p[0]), Math.floor(p[1] + 2.2), Math.floor(p[2]))) {
        m.hp -= 2.5 * dt; m.flash = Math.max(m.flash, 0.05);
        if (Math.random() < dt * 6) particles.puff(p[0], p[1] + 1.2, p[2], 2, 0.6);
        if (Math.random() < dt * 9) particles.sparks(p[0] + (Math.random() - 0.5) * 0.5, p[1] + 0.6 + Math.random() * 1.2, p[2] + (Math.random() - 0.5) * 0.5, 2, 2);
      }
      if (m.hp <= 0 && !m.dying) {
        m.dying = 0.5; m.flash = 0.5;
        if (m.byPlayer && onKill) onKill(m);
        if (sound) sound.mobDie(p, m.type);
        particles.sparks(p[0], p[1] + H * 0.5, p[2], 10, 5, T.hostile ? TILES.WOOL_GREEN : TILES.WOOL_PINK);
      }
      if (m.dying) { m.dying -= dt; m.tilt = Math.min(1.5, m.tilt + dt * 4.5); m.vel[0] *= 0.9; m.vel[2] *= 0.9; }
      if (m.dying <= 0 && (m.hp <= 0 || dist > 70)) { particles.puff(p[0], p[1] + H * 0.5, p[2], 10, 1.2); this.list.splice(i, 1); continue; }
      if (m.hp > 0 && sound && dist < 26 && (m.groanT -= dt) <= 0) { m.groanT = (T.hostile ? 5 : 7) + Math.random() * 8; sound.mobGroan(p, m.type); }

      // ---- Intención de movimiento (tx, tz = dirección deseada; sp = velocidad) ----
      let tx = 0, tz = 0, sp = 0, canJump = true;
      const frozen = m.dying || m.born < 1 || m.kb > 0;
      if (!frozen) {
        if (T.hostile && m.type !== 'spider' || (m.type === 'spider' && night)) {
          if (dist < 40) {
            const ux = dx / (dist || 1), uz = dz / (dist || 1);
            if (m.type === 'skeleton') { // mantiene distancia y dispara
              m.yaw = Math.atan2(ux, uz);
              if (dist > 11) { tx = ux; tz = uz; sp = T.speed; }
              else if (dist < 6) { tx = -ux; tz = -uz; sp = T.speed; }
              else { tx = -uz * Math.sign(Math.sin(m.wob)); tz = ux * Math.sign(Math.sin(m.wob)); sp = T.speed * 0.5; } // da vueltas
              if ((m.shootT -= dt) <= 0 && dist < 20 && dist > 3) { m.shootT = 1.8 + Math.random() * 0.8; m.lunge = 0.25; this._shoot(m, player, sound); }
            } else { tx = ux; tz = uz; sp = T.speed; m.yaw = Math.atan2(tx, tz); }
          }
        } else if (m.fleeT > 0 && dist < 40) { // animal herido: huye
          tx = -dx / (dist || 1); tz = -dz / (dist || 1); sp = T.speed * 2.6; m.yaw = Math.atan2(tx, tz);
        } else { // vagar: caminar un rato, parar un rato
          if ((m.wanderT -= dt) <= 0) {
            m.wanderT = 2 + Math.random() * 5;
            if (Math.random() < 0.55) { const a = Math.random() * 6.28; m.wdx = Math.cos(a); m.wdz = Math.sin(a); } else { m.wdx = 0; m.wdz = 0; }
          }
          tx = m.wdx; tz = m.wdz; sp = T.speed * 0.6;
          if (tx || tz) m.yaw = Math.atan2(tx, tz);
        }
      }
      if (!m.dying && m.born >= 1 && m.kb <= 0) {
        m.vel[0] += (tx * sp - m.vel[0]) * Math.min(1, dt * 8);
        m.vel[2] += (tz * sp - m.vel[2]) * Math.min(1, dt * 8);
      } else if (m.kb > 0) { m.vel[0] *= 0.96; m.vel[2] *= 0.96; }
      else { m.vel[0] *= 0.8; m.vel[2] *= 0.8; }
      m.vel[1] = Math.max(m.vel[1] - 32 * dt, -50);

      // Eje X / Z con salto automático si hay un escalón (la araña trepa paredes)
      for (const ax of [0, 2]) {
        const nv = p[ax] + m.vel[ax] * dt, sgn = Math.sign(m.vel[ax]);
        const probe = nv + sgn * HW;
        const bx = ax === 0 ? probe : p[0], bz = ax === 2 ? probe : p[2];
        if (this._solid(world, bx, p[1] + 0.1, bz) || this._solid(world, bx, p[1] + Math.min(1.2, H * 0.65), bz)) {
          if (m.type === 'spider' && sp > 0) { m.vel[1] = Math.max(m.vel[1], 4.5); p[ax] = nv; m.vel[ax] *= 0.5; } // trepa
          else {
            if (m.onGround && canJump && !this._solid(world, bx, p[1] + 1.1, bz) && !this._solid(world, bx, p[1] + Math.min(2.1, H + 0.3), bz)) m.vel[1] = 8.5;
            m.vel[ax] = 0;
            if (!T.hostile) m.wanderT = 0; // el animal choca: elige otro rumbo
          }
        } else p[ax] = nv;
      }
      // Eje Y
      const ny = p[1] + m.vel[1] * dt;
      m.onGround = false;
      if (m.vel[1] <= 0 && this._solid(world, p[0], ny, p[2])) { p[1] = Math.floor(ny) + 1; m.vel[1] = 0; m.onGround = true; }
      else if (m.vel[1] > 0 && this._solid(world, p[0], ny + H, p[2])) m.vel[1] = 0;
      else p[1] = ny;
      if (p[1] < -10) { this.list.splice(i, 1); continue; }
      m.walk += Math.hypot(m.vel[0], m.vel[2]) * dt * (m.type === 'chicken' ? 5 : m.type === 'spider' ? 3.4 : 2.6);

      // Ataque cuerpo a cuerpo (zombi y araña; la araña de día no ataca)
      const reach = m.type === 'spider' ? 1.6 : REACH;
      if ((m.type === 'zombie' || (m.type === 'spider' && night)) && !m.dying && m.born >= 1 && dist < reach && Math.abs(dy) < 1.6 && m.hitCd <= 0) {
        m.hitCd = m.type === 'spider' ? 0.9 : 1.0; m.lunge = 0.25;
        hurtPlayer(m.type === 'spider' ? 2 : 3);
        const kx = dx / (dist || 1), kz = dz / (dist || 1);
        player.vel[0] += kx * 6; player.vel[2] += kz * 6; player.vel[1] = Math.max(player.vel[1], 4);
      }
    }

    // ---- Flechas ----
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      if (a.stuck) { if (a.life <= 0) this.arrows.splice(i, 1); continue; }
      a.vel[1] -= ARROW_G * dt;
      a.pos[0] += a.vel[0] * dt; a.pos[1] += a.vel[1] * dt; a.pos[2] += a.vel[2] * dt;
      const px = player.pos[0], py = player.pos[1], pz = player.pos[2];
      if (Math.abs(a.pos[0] - px) < 0.5 && Math.abs(a.pos[2] - pz) < 0.5 && a.pos[1] > py && a.pos[1] < py + 1.8) {
        hurtPlayer(2);
        player.vel[0] += a.vel[0] * 0.08; player.vel[2] += a.vel[2] * 0.08;
        this.arrows.splice(i, 1); continue;
      }
      if (this._solid(world, a.pos[0], a.pos[1], a.pos[2])) { a.stuck = true; a.life = 8; if (sound) sound.block(B.PLANKS, 'hit', a.pos); }
      else if (a.life <= 0) this.arrows.splice(i, 1);
    }
  }

  _shoot(m, player, sound) {
    const from = [m.pos[0], m.pos[1] + 1.5, m.pos[2]], to = [player.pos[0], player.pos[1] + 1.2, player.pos[2]];
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], d = Math.hypot(dx, dy, dz) || 1, v = 22;
    const t = d / v; // compensa la caída por gravedad durante el vuelo
    this.arrows.push({ pos: from, vel: [(dx / d) * v, (dy / d) * v + 0.5 * ARROW_G * t, (dz / d) * v], life: 4, stuck: false });
    if (sound) sound.bow(from);
  }

  // Rayo contra las cajas de los mobs. Devuelve {mob, dist} del más cercano.
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const m of this.list) {
      if (m.dying) continue;
      const lo = [m.pos[0] - m.hw, m.pos[1], m.pos[2] - m.hw], hi = [m.pos[0] + m.hw, m.pos[1] + m.h, m.pos[2] + m.hw];
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
    if (!TYPES[m.type].hostile) m.fleeT = 4;
    const dx = m.pos[0] - fromX, dz = m.pos[2] - fromZ, d = Math.hypot(dx, dz) || 1;
    m.vel[0] = (dx / d) * 7; m.vel[2] = (dz / d) * 7; m.vel[1] = 5;
  }

  draw(batch, now = performance.now()) {
    const t = now / 1000;
    for (const m of this.list) {
      const x = m.pos[0], z = m.pos[2], rise = 1 - m.born, y = m.pos[1] - rise * rise * 1.9;
      const speed = Math.min(1, Math.hypot(m.vel[0], m.vel[2]) / (m.type === 'spider' ? 3 : 2.2));
      const o = { yaw: m.yaw, ox: x, oz: z, shade: m.flash > 0 ? 2.2 : 1, tilt: -m.tilt, ty: y };
      const sw = Math.sin(m.walk) * 0.75 * speed, bob = Math.abs(Math.sin(m.walk)) * 0.04 * speed;
      const idle = Math.sin(t * 1.7 + m.wob) * 0.04, yy = y + bob;
      const lunge = m.lunge > 0 ? Math.sin((m.lunge / 0.25) * Math.PI) * 0.7 : 0;
      const bx = (cx, cy, cz, hx, hy, hz, tile, ex = null) => batch.box(cx, cy, cz, hx, hy, hz, ex ? { ...o, tile, ...ex } : { ...o, tile });
      const leg = (cx, cy, cz, hx, hy, hz, tile, ang, top) => bx(cx, cy, cz, hx, hy, hz, tile, { rx: ang, py: top, pz: cz });
      switch (m.type) {
        case 'zombie': {
          const g = TILES.WOOL_GREEN;
          leg(-0.14, yy + 0.4, 0, 0.13, 0.4, 0.13, TILES.DOG_BLACK, sw, yy + 0.8);
          leg(0.14, yy + 0.4, 0, 0.13, 0.4, 0.13, TILES.DOG_BLACK, -sw, yy + 0.8);
          bx(0, yy + 1.1 + idle * 0.2, 0, 0.27, 0.35, 0.15, g);
          const arm = -0.08 - sw * 0.25 + idle - lunge;
          bx(-0.4, yy + 1.2, 0.2, 0.11, 0.11, 0.3, g, { rx: arm, py: yy + 1.2, pz: 0 });
          bx(0.4, yy + 1.2, 0.2, 0.11, 0.11, 0.3, g, { rx: arm * 0.9 - 0.04, py: yy + 1.2, pz: 0 });
          const nod = Math.sin(m.walk * 2) * 0.05 * speed + (m.flash > 0 ? Math.sin(t * 60) * 0.12 : 0);
          bx(0, yy + 1.65, 0, 0.25, 0.25, 0.25, { front: TILES.DOG_FACE, other: g }, { rx: nod, py: yy + 1.4, pz: 0 });
          break;
        }
        case 'skeleton': {
          const K = TILES.BONE, aim = -1.45 + idle - lunge * 0.3; // brazos levantados apuntando el arco
          leg(-0.1, yy + 0.4, 0, 0.07, 0.4, 0.07, K, sw, yy + 0.8);
          leg(0.1, yy + 0.4, 0, 0.07, 0.4, 0.07, K, -sw, yy + 0.8);
          bx(0, yy + 1.1, 0, 0.2, 0.35, 0.1, K);
          bx(0, yy + 1.1, 0, 0.21, 0.04, 0.105, TILES.DOG_BLACK); bx(0, yy + 1.0, 0, 0.21, 0.04, 0.105, TILES.DOG_BLACK); // costillas
          bx(-0.28, yy + 1.35, 0.25, 0.06, 0.06, 0.3, K, { rx: aim * 0.1, py: yy + 1.35, pz: 0 });
          bx(0.28, yy + 1.35, 0.25, 0.06, 0.06, 0.3, K, { rx: aim * 0.1, py: yy + 1.35, pz: 0 });
          bx(0.28, yy + 1.35, 0.55, 0.015, 0.28, 0.015, TILES.PLANKS); // arco
          bx(0, yy + 1.65, 0, 0.22, 0.22, 0.22, K);
          bx(-0.09, yy + 1.7, 0.222, 0.05, 0.045, 0.01, TILES.DOG_BLACK); bx(0.09, yy + 1.7, 0.222, 0.05, 0.045, 0.01, TILES.DOG_BLACK);
          break;
        }
        case 'spider': {
          const S = TILES.SPIDER;
          bx(0, yy + 0.45, -0.05, 0.3, 0.2, 0.35, S);
          bx(0, yy + 0.5, 0.45, 0.2, 0.18, 0.18, S);
          bx(0, yy + 0.5, -0.6, 0.36, 0.25, 0.38, S, { shade: m.flash > 0 ? 2.2 : 0.85 });
          bx(-0.08, yy + 0.56, 0.64, 0.035, 0.035, 0.02, TILES.RED); bx(0.08, yy + 0.56, 0.64, 0.035, 0.035, 0.02, TILES.RED);
          bx(-0.17, yy + 0.4, 0.65, 0.03, 0.05, 0.04, S); bx(0.17, yy + 0.4, 0.65, 0.03, 0.05, 0.04, S); // colmillos
          for (let s = -1; s <= 1; s += 2) for (let k = 0; k < 4; k++) {
            const w = Math.sin(m.walk * 1.8 + k * 1.6 + (s > 0 ? 3.1 : 0)) * 0.09 * speed;
            bx(s * 0.62, yy + 0.3 + (k & 1) * 0.03, 0.3 - k * 0.22 + w, 0.34, 0.025, 0.025, S);
            bx(s * 0.98, yy + 0.17, 0.3 - k * 0.22 + w, 0.025, 0.14, 0.025, S); // punta de la pata
          }
          break;
        }
        case 'pig': {
          const P = TILES.WOOL_PINK, d = m.flash > 0 ? 2.2 : 0.85;
          bx(0, yy + 0.55, 0, 0.25, 0.2, 0.4, P);
          bx(0, yy + 0.62 + idle * 0.3, 0.5, 0.2, 0.19, 0.17, P);
          bx(0, yy + 0.56 + idle * 0.3, 0.68, 0.1, 0.07, 0.03, P, { shade: m.flash > 0 ? 2.2 : 0.78 }); // hocico (sin cara)
          for (const [lx, lz, a] of [[-0.14, 0.26, sw], [0.14, 0.26, -sw], [-0.14, -0.26, -sw], [0.14, -0.26, sw]]) leg(lx, yy + 0.17, lz, 0.07, 0.17, 0.07, P, a, yy + 0.34);
          void d;
          break;
        }
        case 'cow': {
          const W = TILES.WOOL_WHITE, K = TILES.WOOL_BLACK, Br = TILES.WOOL_BROWN;
          bx(0, yy + 0.92, 0, 0.3, 0.3, 0.5, W);
          bx(-0.305, yy + 1.0, -0.2, 0.012, 0.14, 0.18, K); bx(0.305, yy + 1.04, 0.15, 0.012, 0.16, 0.16, K); bx(0.0, yy + 1.225, -0.05, 0.14, 0.012, 0.2, K);
          bx(0, yy + 0.58, -0.22, 0.1, 0.05, 0.1, TILES.WOOL_PINK); // ubre
          bx(0, yy + 1.18 + idle * 0.3, 0.64, 0.2, 0.2, 0.17, Br);
          bx(-0.17, yy + 1.42 + idle * 0.3, 0.62, 0.03, 0.06, 0.03, TILES.BONE); bx(0.17, yy + 1.42 + idle * 0.3, 0.62, 0.03, 0.06, 0.03, TILES.BONE);
          for (const [lx, lz, a] of [[-0.17, 0.35, sw], [0.17, 0.35, -sw], [-0.17, -0.35, -sw], [0.17, -0.35, sw]]) leg(lx, yy + 0.3, lz, 0.08, 0.3, 0.08, W, a, yy + 0.6);
          break;
        }
        case 'chicken': {
          const W = TILES.WOOL_WHITE, Y = TILES.YELLOW, flap = Math.sin(m.walk * 3) * 0.5 * speed;
          bx(0, yy + 0.4, 0, 0.14, 0.14, 0.2, W);
          bx(0, yy + 0.62 + idle * 0.3, 0.19, 0.07, 0.1, 0.07, W);
          bx(0, yy + 0.6 + idle * 0.3, 0.28, 0.03, 0.02, 0.04, Y);
          bx(0, yy + 0.74 + idle * 0.3, 0.19, 0.015, 0.04, 0.04, TILES.RED);
          bx(-0.16, yy + 0.43, 0, 0.02, 0.09, 0.14, W, { shade: 0.9, rx: flap, py: yy + 0.5, pz: 0 }); bx(0.16, yy + 0.43, 0, 0.02, 0.09, 0.14, W, { shade: 0.9, rx: -flap, py: yy + 0.5, pz: 0 });
          leg(-0.06, yy + 0.13, 0, 0.012, 0.13, 0.012, Y, sw, yy + 0.26); leg(0.06, yy + 0.13, 0, 0.012, 0.13, 0.012, Y, -sw, yy + 0.26);
          break;
        }
      }
    }
    for (const a of this.arrows) { // flechas: palito orientado según su velocidad
      const yaw = Math.atan2(a.vel[0], a.vel[2]), pit = -Math.atan2(a.vel[1], Math.hypot(a.vel[0], a.vel[2]));
      batch.box(0, a.pos[1], 0, 0.02, 0.02, 0.28, { tile: TILES.PLANKS, yaw, ox: a.pos[0], oz: a.pos[2], rx: pit, py: a.pos[1], pz: 0 });
    }
  }
}
