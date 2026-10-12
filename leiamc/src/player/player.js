import { B } from '../blocks/blocks.js';

// Jugador en primera persona: movimiento, gravedad, salto, agacharse, sprint y colisiones AABB.
const EPS = 1e-4;
const TOL = 1e-6;
const MAX_STEP = 0.4; // desplazamiento máximo por subpaso (evita atravesar bloques)

export class Player {
  constructor(cfg) {
    this.cfg = cfg;
    this.pos = [0, 0, 0];  // centro de los pies
    this.vel = [0, 0, 0];
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.crouching = false;
    this.sprinting = false;
    this.eyeHeight = cfg.eyeHeight;
    this.flying = false;
    this.inWater = false;
    this.peakY = 0;
    this.fallImpact = 0; // distancia de la última caída (se lee y se limpia en main)
  }

  get height() { return this.crouching ? this.cfg.crouchHeight : this.cfg.height; }

  spawn(x, y, z) {
    this.pos = [x, y, z];
    this.vel = [0, 0, 0];
    this.onGround = false;
    this.peakY = y;
    this.fallImpact = 0;
  }

  eyePosition() { return [this.pos[0], this.pos[1] + this.eyeHeight, this.pos[2]]; }

  look(dx, dy, sensitivity) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const lim = Math.PI / 2 - 0.01;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;
    const TAU = Math.PI * 2;
    this.yaw = ((this.yaw % TAU) + TAU) % TAU;
  }

  collidesAt(world, x, y, z, h) {
    const hw = this.cfg.width / 2;
    const x0 = Math.floor(x - hw + TOL), x1 = Math.floor(x + hw - TOL);
    const y0 = Math.floor(y + TOL), y1 = Math.floor(y + h - TOL);
    const z0 = Math.floor(z - hw + TOL), z1 = Math.floor(z + hw - TOL);
    for (let by = y0; by <= y1; by++)
      for (let bz = z0; bz <= z1; bz++)
        for (let bx = x0; bx <= x1; bx++)
          if (world.isSolid(bx, by, bz)) return true;
    return false;
  }

  // Mueve un eje y resuelve la colisión ajustando la posición contra el bloque.
  moveAxis(world, axis, d) {
    if (d === 0) return;
    const p = this.pos;
    const h = this.height;
    const hw = this.cfg.width / 2;
    p[axis] += d;

    const x0 = Math.floor(p[0] - hw + TOL), x1 = Math.floor(p[0] + hw - TOL);
    const y0 = Math.floor(p[1] + TOL), y1 = Math.floor(p[1] + h - TOL);
    const z0 = Math.floor(p[2] - hw + TOL), z1 = Math.floor(p[2] + hw - TOL);

    let snap = null;
    for (let by = y0; by <= y1; by++) {
      for (let bz = z0; bz <= z1; bz++) {
        for (let bx = x0; bx <= x1; bx++) {
          if (!world.isSolid(bx, by, bz)) continue;
          let c;
          if (axis === 0) c = d > 0 ? bx - hw - EPS : bx + 1 + hw + EPS;
          else if (axis === 1) c = d > 0 ? by - h - EPS : by + 1;
          else c = d > 0 ? bz - hw - EPS : bz + 1 + hw + EPS;
          if (snap === null) snap = c;
          else snap = d > 0 ? Math.min(snap, c) : Math.max(snap, c);
        }
      }
    }
    if (snap !== null) {
      p[axis] = snap;
      this.vel[axis] = 0;
      if (axis === 1 && d < 0) this.onGround = true;
    }
  }

  // ¿El cuerpo del jugador ocupa la celda (bx,by,bz)? (para no colocar bloques dentro del jugador)
  intersectsBlock(bx, by, bz) {
    const hw = this.cfg.width / 2, p = this.pos, h = this.height;
    return p[0] + hw > bx && p[0] - hw < bx + 1 &&
           p[1] + h > by && p[1] < by + 1 &&
           p[2] + hw > bz && p[2] - hw < bz + 1;
  }

  // ¿Hay suelo a menos de 0.6 bloques bajo los pies? (para no caerse al agacharse)
  supported(world) {
    return this.collidesAt(world, this.pos[0], this.pos[1] - 0.6, this.pos[2], 0.6);
  }

  update(dt, input, world) {
    const c = this.cfg;

    // Agacharse / levantarse (sólo si hay espacio encima)
    if (input.crouch) this.crouching = true;
    else if (this.crouching && !this.collidesAt(world, this.pos[0], this.pos[1], this.pos[2], c.height)) {
      this.crouching = false;
    }
    const eyeTarget = this.crouching ? c.crouchEyeHeight : c.eyeHeight;
    this.eyeHeight += (eyeTarget - this.eyeHeight) * Math.min(1, dt * 15);

    // Dirección deseada
    const { fwd, strafe } = input.axes();
    if (fwd <= 0) input.sprintLatch = false;
    this.sprinting = !!input.sprintLatch && fwd > 0 && !this.crouching;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let dx = strafe * cy - fwd * sy;
    let dz = -strafe * sy - fwd * cy;
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; }
    const speed = this.crouching ? c.crouchSpeed : this.sprinting ? c.sprintSpeed : c.walkSpeed;

    const feetBlock = world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 0.4), Math.floor(this.pos[2]));
    this.inWater = feetBlock === B.WATER;
    let spd = speed;
    if (this.flying) spd = speed * (input.sprintLatch ? 3 : 2);
    else if (this.inWater) spd = speed * 0.55;

    const accel = this.onGround || this.flying ? 14 : this.inWater ? 6 : 4;
    const k = 1 - Math.exp(-accel * dt);
    this.vel[0] += (dx * spd - this.vel[0]) * k;
    this.vel[2] += (dz * spd - this.vel[2]) * k;

    // Salto, natación, vuelo y gravedad
    if (this.flying) {
      const target = input.jump ? 9 : input.crouch ? -9 : 0;
      this.vel[1] += (target - this.vel[1]) * Math.min(1, dt * 10);
    } else if (this.inWater) {
      const target = input.jump ? 3.6 : -2.2;
      this.vel[1] += (target - this.vel[1]) * Math.min(1, dt * 5);
    } else {
      if (input.jump && this.onGround) {
        this.vel[1] = c.jumpSpeed;
        this.onGround = false;
      }
      this.vel[1] = Math.max(this.vel[1] - c.gravity * dt, -78);
    }

    // Integración con subpasos
    const wasGround = this.onGround;
    const sneakEdge = this.crouching && wasGround;
    const maxMove = Math.max(Math.abs(this.vel[0]), Math.abs(this.vel[1]), Math.abs(this.vel[2])) * dt;
    const steps = Math.max(1, Math.ceil(maxMove / MAX_STEP));
    const sdt = dt / steps;
    this.onGround = false;
    for (let i = 0; i < steps; i++) {
      for (const axis of [0, 2]) {
        const before = this.pos[axis];
        this.moveAxis(world, axis, this.vel[axis] * sdt);
        if (sneakEdge && !this.supported(world)) {
          this.pos[axis] = before;
          this.vel[axis] = 0;
        }
      }
      this.moveAxis(world, 1, this.vel[1] * sdt);
    }

    // Daño por caída: se registra la altura máxima en el aire y se mide al aterrizar.
    if (this.flying || this.inWater) this.peakY = this.pos[1];
    else if (this.onGround) {
      const d = this.peakY - this.pos[1];
      if (d > 0) this.fallImpact = Math.max(this.fallImpact, d);
      this.peakY = this.pos[1];
    } else if (this.pos[1] > this.peakY) this.peakY = this.pos[1];
    if (this.flying && this.onGround) this.flying = false;
  }
}
