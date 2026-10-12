// Mano en primera persona estilo Steve: brazo (manga + piel) y lo que llevás en la mano, como modelo 3D.
// Se arma en coordenadas de mundo a partir de la cámara; el renderer la dibuja encima de todo (borra la profundidad).
import { TILES as T, ATLAS_SIZE, TILE_PX, ATLAS_GRID } from '../blocks/atlas.js';
import { B, TILE_OF, BLOCKS } from '../blocks/blocks.js';
import { iconTile, isItem, toolOf, I } from '../items/items.js';
import { lookDirection } from '../utils/math.js';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
// Giros de la base [X, Y, Z] (derecha, arriba, adelante locales) sobre uno de sus ejes.
const rotX = ([X, Y, Z], a) => [X, add(mul(Y, Math.cos(a)), Z, Math.sin(a)), add(mul(Y, -Math.sin(a)), Z, Math.cos(a))];
const rotY = ([X, Y, Z], a) => [add(mul(X, Math.cos(a)), Z, -Math.sin(a)), Y, add(mul(X, Math.sin(a)), Z, Math.cos(a))];
const rotZ = ([X, Y, Z], a) => [add(mul(X, Math.cos(a)), Y, Math.sin(a)), add(mul(X, -Math.sin(a)), Y, Math.cos(a)), Z];

export class Hand {
  // Modelo 3D de un ítem: cada píxel opaco de su ícono se extruye en un vóxel (como la mano de Minecraft).
  _model(tile) {
    let m = this.models.get(tile);
    if (m) return m;
    const q = [], a = this.atlas, tx = (tile % ATLAS_GRID) * TILE_PX, ty = Math.floor(tile / ATLAS_GRID) * TILE_PX;
    const op = (x, y) => x >= 0 && y >= 0 && x < TILE_PX && y < TILE_PX && a[((ty + y) * ATLAS_SIZE + tx + x) * 4 + 3] >= 128;
    const P = 1 / TILE_PX, Th = 1.4 * P, z0 = -Th / 2, z1 = Th / 2;
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
      if (!op(x, y)) continue;
      const xl = 0.5 - x * P, xr = 0.5 - (x + 1) * P, yt = 0.5 - y * P, yb = 0.5 - (y + 1) * P;
      const u = (tx + x + 0.5) / ATLAS_SIZE, v = (ty + y + 0.5) / ATLAS_SIZE;
      q.push([[xl, yt, z0, xr, yt, z0, xr, yb, z0, xl, yb, z0], u, v, 1]);
      if (!op(x - 1, y)) q.push([[xl, yt, z0, xl, yt, z1, xl, yb, z1, xl, yb, z0], u, v, 0.65]);
      if (!op(x + 1, y)) q.push([[xr, yt, z0, xr, yt, z1, xr, yb, z1, xr, yb, z0], u, v, 0.65]);
      if (!op(x, y - 1)) q.push([[xl, yt, z0, xr, yt, z0, xr, yt, z1, xl, yt, z1], u, v, 0.85]);
      if (!op(x, y + 1)) q.push([[xl, yb, z0, xr, yb, z0, xr, yb, z1, xl, yb, z1], u, v, 0.6]);
    }
    q.cx = 0; q.cy = 0; let n = 0;                     // centroide del ícono en coordenadas locales (-.5..+.5)
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) if (op(x, y)) { q.cx += 0.5 - (x + 0.5) * P; q.cy += 0.5 - (y + 0.5) * P; n++; }
    if (n) { q.cx /= n; q.cy /= n; }
    this.models.set(tile, q);
    return q;
  }

  constructor(atlas) { this.atlas = atlas; this.models = new Map(); this.swing = 1; this.bob = 0; this.bobAmt = 0; this.equip = 1; this.lastId = -1; }

  punch() { if (this.swing >= 1) this.swing = 0; }

  // active: está picando (el golpe se repite). speed: velocidad horizontal del jugador.
  update(dt, speed, active, heldId) {
    if (heldId !== this.lastId) { this.lastId = heldId; this.equip = 0; } // al cambiar de ítem sube desde abajo
    this.equip = Math.min(1, this.equip + dt * 5);
    if (active && this.swing >= 1) this.swing = 0;
    if (this.swing < 1) this.swing = Math.min(1, this.swing + dt * 2.8);
    this.bobAmt += (Math.min(1, speed / 5) - this.bobAmt) * Math.min(1, dt * 8);
    this.bob += dt * (4 + speed * 1.1);
  }

  draw(batch, eye, yaw, pitch, heldId) {
    const F = lookDirection(yaw, pitch), R = [Math.cos(yaw), 0, -Math.sin(yaw)], U = cross(R, F);
    const cam = [mul(R, -1), U, F]; // x local = izquierda, y = arriba, z = adelante (base derecha)
    const sw = Math.sin(this.swing * Math.PI), sw2 = Math.sin(Math.sqrt(this.swing) * Math.PI);
    const bobX = Math.sin(this.bob) * 0.015 * this.bobAmt, bobY = Math.abs(Math.cos(this.bob)) * -0.02 * this.bobAmt;
    // Como en Minecraft: el brazo entra desde la esquina inferior derecha, largo y fino, con la mano hacia el centro.
    const L = 0.85, down = (1 - this.equip) * 0.6;
    let tip = add(eye, F, 0.62 + sw * 0.16);                       // punta de la mano
    tip = add(tip, R, 0.27 + bobX - sw2 * 0.1);
    tip = add(tip, U, -0.27 + bobY - down - sw2 * 0.12);
    let arm = rotY(rotX(cam, -0.62 + sw * 0.85), 0.3);              // sube y se inclina hacia adentro
    arm = rotZ(arm, -sw2 * 0.2);
    const o = add(tip, arm[2], -L);                                 // extremo trasero (fuera de pantalla)
    const ctr = (a, b) => add(o, arm[2], (a + b) / 2);
    const part = (center, h, basis, tile) => batch.boxBasis(center, h[0], h[1], h[2], basis, { tile, shade: 1 });
    const T_ = 0.075;                                               // semi-grosor (brazo cuadrado 4x4 como Steve)
    part(ctr(0, L * 0.62), [T_, T_, L * 0.31], arm, T.SLEEVE);      // manga
    part(ctr(L * 0.62, L), [T_ * 0.98, T_ * 0.98, L * 0.19], arm, T.SKIN); // mano y antebrazo
    if (!heldId) return;
    const flat = isItem(heldId) || heldId === B.TORCH || !BLOCKS[heldId]?.solid;
    if (flat) {
      const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
      const dot = (a, c2) => a[0] * c2[0] + a[1] * c2[1] + a[2] * c2[2];
      const tile = isItem(heldId) ? iconTile(heldId) : TILE_OF[heldId * 3 + 2];
      const model = this._model(tile);
      // Tres maneras de agarrar un ícono plano (como en Minecraft):
      //  · 'torch': el ícono es vertical (mango abajo, llama arriba) -> se sostiene parado, inclinado un poco hacia adelante.
      //  · 'tool' : mango en la esquina inf. izquierda del ícono (palo, picos, hachas, palas, espadas) -> apunta en diagonal.
      //  · 'item' : lingotes y gemas no tienen mango -> se agarran por el centro, con la misma inclinación.
      const style = heldId === B.TORCH ? 'torch' : (isItem(heldId) && (heldId === I.STICK || toolOf(heldId))) ? 'tool' : 'item';
      const S = style === 'item' ? 0.5 : 0.7;                                      // lingotes y gemas: más chicos, como en la mano de Minecraft
      let b, gx, gy; // base del ícono (X izq., Y arriba, Z normal) y punto del ícono (local) que queda en la mano
      let n0 = add(add(mul(R, -0.85), F, -0.25), U, 0.3);                         // hacia donde mira la cara visible
      if (style === 'torch') {
        const Y = nrm(add(add(mul(U, 1 - sw * 0.7), F, 0.5 + sw * 0.9), R, -0.06)); // el "arriba" del ícono: parado e inclinado hacia adelante
        n0 = nrm(add(n0, Y, -dot(n0, Y)));
        const Z = mul(n0, -1);
        b = [cross(Y, Z), Y, Z];
        gx = 0; gy = 0.5 - 12.5 / TILE_PX;
      } else {
        const D = nrm(add(add(mul(F, 0.9), U, 0.4 - sw * 1.0), R, -0.12));          // dirección mango -> cabeza
        n0 = nrm(add(n0, D, -dot(n0, D)));
        const Z = mul(n0, -1), P = cross(D, Z);                                      // la cara visible es la -Z local
        b = [nrm(add(P, D, -1)), nrm(add(P, D, 1)), Z];                              // X=(P-D)/√2, Y=(P+D)/√2
        if (style === 'tool') { gx = 0.25; gy = -0.25; } else { gx = model.cx; gy = model.cy; }
      }
      const g = add(tip, U, style === 'torch' ? 0.07 : style === 'item' ? 0.06 : 0.03); // agarre: sobre el puño
      const c = add(add(g, b[0], -gx * S), b[1], -gy * S);                          // lleva el punto de agarre del ícono a g
      const pts = new Array(12);
      for (const [pp, u, v, sh] of model) {
        for (let k = 0; k < 4; k++) {
          const lx = pp[k * 3] * S, ly = pp[k * 3 + 1] * S, lz = pp[k * 3 + 2] * S;
          for (let d = 0; d < 3; d++) pts[k * 3 + d] = c[d] + b[0][d] * lx + b[1][d] * ly + b[2][d] * lz;
        }
        batch.quad(pts, u, v, sh);
      }
    } else {
      const b = rotY(rotX(cam, -0.35), 0.7);
      const t = TILE_OF, top = t[heldId * 3], bot = t[heldId * 3 + 1], side = t[heldId * 3 + 2];
      part(add(add(tip, U, 0.11), F, 0.02), [0.13, 0.13, 0.13], b, [top, bot, side, side, side, side]);
    }
  }
}
