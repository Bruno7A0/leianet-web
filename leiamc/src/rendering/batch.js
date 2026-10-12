// Lote de geometría dinámica (entidades, partículas, grietas). Mismo formato de vértice que el mesher.
import { FACES, FLOATS_PER_VERTEX } from './mesher.js';
import { ATLAS_GRID } from '../blocks/atlas.js';

export class Batch {
  constructor(maxQuads = 8000) {
    this.max = maxQuads;
    this.v = new Float32Array(maxQuads * 4 * FLOATS_PER_VERTEX);
    this.n = 0; // quads usados
  }
  reset() { this.n = 0; }

  // Caja con centro (cx,cy,cz) y semi-medidas (hx,hy,hz), girada `yaw` alrededor de Y respecto a `origin`.
  // tiles: id único o {front, other}; `front` es la cara +Z local. uvSub = [u,v,tam] recorta la textura (0..1).
  // Giros opcionales (para animar miembros): `rx` gira la caja alrededor del eje X con pivote en (py, pz) locales;
  // `tilt` gira todo el cuerpo alrededor del eje X con pivote en (ty, 0) (por ejemplo, un zombi que cae).
  box(cx, cy, cz, hx, hy, hz, o = {}) {
    const yaw = o.yaw || 0, ox = o.ox || 0, oz = o.oz || 0, shade = o.shade ?? 1, uvSub = o.uvSub;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const rx = o.rx || 0, rc = Math.cos(rx), rs = Math.sin(rx), py = o.py || 0, pz = o.pz || 0;
    const tl = o.tilt || 0, tc = Math.cos(tl), ts = Math.sin(tl), ty = o.ty || 0;
    for (let f = 0; f < 6; f++) {
      if (this.n >= this.max) return;
      const F = FACES[f];
      const tile = typeof o.tile === 'object' ? (f === 4 ? o.tile.front : o.tile.other) : o.tile;
      const tx = tile % ATLAS_GRID, ty = (tile / ATLAS_GRID) | 0;
      let u0 = tx / ATLAS_GRID, v0 = ty / ATLAS_GRID, du = 1 / ATLAS_GRID;
      if (uvSub) { u0 += uvSub[0] * du; v0 += uvSub[1] * du; du *= uvSub[2]; }
      const e = 0.0015 / ATLAS_GRID;
      let p = this.n * 4 * FLOATS_PER_VERTEX;
      for (let k = 0; k < 4; k++) {
        const c = F.c[k], uv = F.uv[k];
        let lx = cx + (c[0] * 2 - 1) * hx, ly = cy + (c[1] * 2 - 1) * hy, lz = cz + (c[2] * 2 - 1) * hz;
        if (rx) { const dy = ly - py, dz = lz - pz; ly = py + dy * rc - dz * rs; lz = pz + dy * rs + dz * rc; }
        if (tl) { const dy = ly - ty; ly = ty + dy * tc - lz * ts; lz = dy * ts + lz * tc; }
        this.v[p++] = ox + lx * cs + lz * sn;
        this.v[p++] = ly;
        this.v[p++] = oz - lx * sn + lz * cs;
        this.v[p++] = uv[0] ? u0 + du - e : u0 + e;
        this.v[p++] = uv[1] ? v0 + du - e : v0 + e;
        this.v[p++] = F.shade * shade;
      }
      this.n++;
    }
  }

  // Quad de 4 puntos [x,y,z]x4, muestreando el centro del texel (u,v): color plano, sin bleeding.
  quad(pts, u, v, shade) {
    if (this.n >= this.max) return;
    let p = this.n * 4 * FLOATS_PER_VERTEX;
    for (let k = 0; k < 4; k++) {
      this.v[p++] = pts[k * 3]; this.v[p++] = pts[k * 3 + 1]; this.v[p++] = pts[k * 3 + 2];
      this.v[p++] = u; this.v[p++] = v; this.v[p++] = shade;
    }
    this.n++;
  }

  // Caja con base ortonormal derecha B=[X,Y,Z] (vectores de mundo) centrada en c. tile: id o arreglo de 6 (orden de FACES).
  boxBasis(c, hx, hy, hz, B, o = {}) {
    const shade = o.shade ?? 1;
    for (let f = 0; f < 6; f++) {
      if (this.n >= this.max) return;
      const F = FACES[f];
      const tile = Array.isArray(o.tile) ? o.tile[f] : o.tile;
      const tx = tile % ATLAS_GRID, ty = (tile / ATLAS_GRID) | 0, du = 1 / ATLAS_GRID, e = 0.0015 / ATLAS_GRID;
      const u0 = tx / ATLAS_GRID, v0 = ty / ATLAS_GRID;
      let p = this.n * 4 * FLOATS_PER_VERTEX;
      for (let k = 0; k < 4; k++) {
        const q = F.c[k], uv = F.uv[k];
        const lx = (q[0] * 2 - 1) * hx, ly = (q[1] * 2 - 1) * hy, lz = (q[2] * 2 - 1) * hz;
        this.v[p++] = c[0] + B[0][0] * lx + B[1][0] * ly + B[2][0] * lz;
        this.v[p++] = c[1] + B[0][1] * lx + B[1][1] * ly + B[2][1] * lz;
        this.v[p++] = c[2] + B[0][2] * lx + B[1][2] * ly + B[2][2] * lz;
        this.v[p++] = uv[0] ? u0 + du - e : u0 + e;
        this.v[p++] = uv[1] ? v0 + du - e : v0 + e;
        this.v[p++] = F.shade * shade;
      }
      this.n++;
    }
  }

  // Las 6 caras de un bloque de mundo (para la grieta de rotura), levemente infladas.
  blockShell(x, y, z, tile, grow = 0.003) {
    this.box(x + 0.5, y + 0.5, z + 0.5, 0.5 + grow, 0.5 + grow, 0.5 + grow, { tile, shade: 1 });
  }
}

// Índices compartidos 0,1,2 0,2,3 por quad.
export function quadIndices(maxQuads) {
  const ix = new Uint32Array(maxQuads * 6);
  for (let q = 0; q < maxQuads; q++) {
    const b = q * 4, i = q * 6;
    ix[i] = b; ix[i + 1] = b + 1; ix[i + 2] = b + 2; ix[i + 3] = b; ix[i + 4] = b + 2; ix[i + 5] = b + 3;
  }
  return ix;
}
