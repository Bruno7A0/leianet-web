// Generación de mallas por chunk: sólo se emiten las caras visibles (face culling),
// con oclusión ambiental por vértice (AO). Los buffers de trabajo se reutilizan.
import { CHUNK_SIZE as S, CHUNK_HEIGHT as H } from '../world/constants.js';
import { B, IS_OPAQUE, IS_BLEND, IS_EMISSIVE, CULL_SAME, TILE_OF, LIGHT_R, WALL_TORCH } from '../blocks/blocks.js';
import { ATLAS_GRID } from '../blocks/atlas.js';

export const FLOATS_PER_VERTEX = 6; // x, y, z, u, v, shade

// Orden de vértices antihorario visto desde fuera. uv: v=0 es la parte superior de la textura.
const SIDE_UV = [[0, 1], [1, 1], [1, 0], [0, 0]];
export const FACES = [
  { n: [0, 1, 0],  c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.5 },
  { n: [1, 0, 0],  c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: SIDE_UV, shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: SIDE_UV, shade: 0.8 },
  { n: [0, 0, 1],  c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: SIDE_UV, shade: 0.65 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: SIDE_UV, shade: 0.65 },
];

// Offsets de los vecinos que ocluyen cada esquina de cada cara: [lado1, lado2, esquina]
const AO_OFFSETS = FACES.map((f) => {
  const axis = f.n.findIndex((v) => v !== 0);
  const [a1, a2] = [0, 1, 2].filter((a) => a !== axis);
  return f.c.map((c) => {
    const s1 = c[a1] ? 1 : -1, s2 = c[a2] ? 1 : -1;
    const o1 = [...f.n]; o1[a1] += s1;
    const o2 = [...f.n]; o2[a2] += s2;
    const oc = [...f.n]; oc[a1] += s1; oc[a2] += s2;
    return [o1, o2, oc];
  });
});
const AO_LEVELS = [0.5, 0.68, 0.84, 1.0];
const TEX_EPS = 0.002;
// Cada cara se agranda un pelo en su propio plano para que las caras vecinas se solapen y no queden grietas
// (líneas de fondo asomando entre bloques, sobre todo con multimuestreo y de lejos).
const FACE_GROW = 0.002;
const GROW = FACES.map((f) => f.c.map((c) => f.n.map((n, a) => (n !== 0 ? 0 : c[a] ? FACE_GROW : -FACE_GROW))));

class MeshBuilder {
  constructor() {
    this.v = new Float32Array(FLOATS_PER_VERTEX * 4 * 1024);
    this.i = new Uint32Array(6 * 1024);
    this.vc = 0;
    this.ic = 0;
  }
  reset() { this.vc = 0; this.ic = 0; }
  ensure() {
    if ((this.vc + 4) * FLOATS_PER_VERTEX > this.v.length) {
      const nv = new Float32Array(this.v.length * 2); nv.set(this.v); this.v = nv;
    }
    if (this.ic + 6 > this.i.length) {
      const ni = new Uint32Array(this.i.length * 2); ni.set(this.i); this.i = ni;
    }
  }
  finish() {
    return {
      vertices: this.v.slice(0, this.vc * FLOATS_PER_VERTEX),
      indices: this.i.slice(0, this.ic),
    };
  }
}

const opaqueBuilder = new MeshBuilder();
const blendBuilder = new MeshBuilder();
const deepBuilder = new MeshBuilder(); // caras subterráneas (cuevas): sólo se dibujan si hace falta (ver Renderer)

// Cuántos bloques por debajo de la columna más baja de la superficie empieza lo "profundo".
const DEEP_MARGIN = 5;

// ¿Hay que dibujar la cara del bloque `a` que mira al bloque vecino `b`?
export function shouldDraw(a, b) {
  if (b === B.AIR) return true;
  if (IS_OPAQUE[b]) return false;
  if (a === b) return !CULL_SAME[a];
  return true;
}

const LR = 4, LW = S + 2 * LR; // borde de la luz de cielo
const LV = new Uint8Array(LW * LW * H), HMAP = new Int16Array(LW * LW), LQ = [];

// Antorcha: dos planos cruzados (visibles por ambos lados).
const TORCH_PLANES = [[[0.1, 0.1], [0.9, 0.9]], [[0.1, 0.9], [0.9, 0.1]]];
function torchQuads(builder, x, y, z) {
  const tile = TILE_OF[B.TORCH * 3 + 2], tx = tile % ATLAS_GRID, ty = (tile / ATLAS_GRID) | 0;
  const u0 = tx / ATLAS_GRID, u1 = (tx + 1) / ATLAS_GRID, v0 = ty / ATLAS_GRID, v1 = (ty + 1) / ATLAS_GRID;
  for (const [a, b] of TORCH_PLANES) {
    for (let side = 0; side < 2; side++) {
      const [p, q] = side ? [b, a] : [a, b];
      const pts = [[p[0], 0, p[1], u0, v1], [q[0], 0, q[1], u1, v1], [q[0], 1, q[1], u1, v0], [p[0], 1, p[1], u0, v0]];
      builder.ensure();
      const base = builder.vc;
      let o = builder.vc * FLOATS_PER_VERTEX;
      for (const c of pts) { builder.v[o++] = x + c[0]; builder.v[o++] = y + c[1]; builder.v[o++] = z + c[2]; builder.v[o++] = c[3]; builder.v[o++] = c[4]; builder.v[o++] = 100.95; }
      builder.vc += 4;
      const i = builder.i; let w = builder.ic;
      i[w++] = base; i[w++] = base + 1; i[w++] = base + 2; i[w++] = base; i[w++] = base + 2; i[w++] = base + 3;
      builder.ic = w;
    }
  }
}

// Antorcha de pared: gira 45° apoyando la base contra el bloque que la sostiene (d = [dx, dz] hacia esa pared).
// Sigue siendo un par de planos cruzados, pero alrededor del eje inclinado.
function leanTorchQuads(builder, x, y, z, d) {
  const tile = TILE_OF[B.TORCH * 3 + 2], tx = tile % ATLAS_GRID, ty = (tile / ATLAS_GRID) | 0;
  const u0 = tx / ATLAS_GRID, u1 = (tx + 1) / ATLAS_GRID, v0 = ty / ATLAS_GRID, v1 = (ty + 1) / ATLAS_GRID;
  const K = Math.SQRT1_2, L = 1.0, W = 0.5;
  const base = [0.5 + d[0] * 0.46, 0.2, 0.5 + d[1] * 0.46];              // la base toca la pared
  const axis = [-d[0] * K, K, -d[1] * K];                                 // hacia arriba y lejos de la pared
  const planes = [[-d[1], 0, d[0]], [d[0] * K, K, d[1] * K]];             // ancho de cada plano: ⟂ a la pared, y ⟂ al eje
  for (const wv of planes) {
    const c = (sx, t) => [x + base[0] + axis[0] * L * t + wv[0] * W * sx, y + base[1] + axis[1] * L * t + wv[1] * W * sx, z + base[2] + axis[2] * L * t + wv[2] * W * sx];
    const quad = [[c(-1, 0), u0, v1], [c(1, 0), u1, v1], [c(1, 1), u1, v0], [c(-1, 1), u0, v0]];
    for (let side = 0; side < 2; side++) { // dos caras (visible desde ambos lados)
      const q = side ? [quad[1], quad[0], quad[3], quad[2]] : quad;
      builder.ensure();
      const b0 = builder.vc;
      let o = builder.vc * FLOATS_PER_VERTEX;
      for (const [pt, u, v] of q) { builder.v[o++] = pt[0]; builder.v[o++] = pt[1]; builder.v[o++] = pt[2]; builder.v[o++] = u; builder.v[o++] = v; builder.v[o++] = 100.95; }
      builder.vc += 4;
      const i = builder.i; let w = builder.ic;
      i[w++] = b0; i[w++] = b0 + 1; i[w++] = b0 + 2; i[w++] = b0; i[w++] = b0 + 2; i[w++] = b0 + 3;
      builder.ic = w;
    }
  }
}

export function buildChunkMesh(world, chunk) {
  chunk.lights = []; // [x, y, z, radio] de bloques que iluminan (antorcha, piedra luminosa, horno encendido…)
  opaqueBuilder.reset();
  blendBuilder.reset();
  deepBuilder.reset();
  const blocks = chunk.blocks;
  const ox = chunk.cx * S, oz = chunk.cz * S;

  const sample = (x, y, z) => {
    if (y < 0) return B.STONE; // el fondo del mundo no se dibuja
    if (y >= H) return 0;
    if (x >= 0 && x < S && z >= 0 && z < S) return blocks[x | (z << 4) | (y << 8)];
    return world.getBlock(ox + x, y, oz + z);
  };

  // Luz de cielo: columnas abiertas = 15; bajo techo, la luz entra de costado y baja 3 por bloque (alcance ~4).
  let hmax = chunk.maxY;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = world.getChunk(chunk.cx + dx, chunk.cz + dz); if (n && n.maxY > hmax) hmax = n.maxY; }
  for (let z = -LR; z < S + LR; z++) for (let x = -LR; x < S + LR; x++) {
    let y = Math.min(hmax + 1, H - 1);
    while (y >= 0 && !IS_OPAQUE[sample(x, y, z)]) y--;
    HMAP[(z + LR) * LW + x + LR] = y; // y del bloque opaco más alto de la columna
  }
  LV.fill(0); LQ.length = 0;
  const li = (x, y, z) => (y * LW + (z + LR)) * LW + (x + LR);
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let z = -LR + 1; z < S + LR - 1; z++) for (let x = -LR + 1; x < S + LR - 1; x++) {
    const h = HMAP[(z + LR) * LW + x + LR];
    for (const [dx, dz] of NB) {
      const hn = HMAP[(z + dz + LR) * LW + x + dx + LR];
      for (let y = Math.max(0, hn + 1); y <= h; y++) {
        if (!IS_OPAQUE[sample(x, y, z)] && LV[li(x, y, z)] < 12) { LV[li(x, y, z)] = 12; LQ.push(x, y, z); }
      }
    }
  }
  for (let q = 0; q < LQ.length; q += 3) {
    const x = LQ[q], y = LQ[q + 1], z = LQ[q + 2], l = LV[li(x, y, z)] - 3;
    if (l <= 0) continue;
    for (let d = 0; d < 6; d++) {
      const nx = x + (d === 0) - (d === 1), ny = y + (d === 2) - (d === 3), nz = z + (d === 4) - (d === 5);
      if (ny < 0 || ny >= H || nx < -LR || nx >= S + LR || nz < -LR || nz >= S + LR) continue;
      if (ny > HMAP[(nz + LR) * LW + nx + LR] || IS_OPAQUE[sample(nx, ny, nz)]) continue;
      const k = li(nx, ny, nz);
      if (LV[k] >= l) continue;
      LV[k] = l; LQ.push(nx, ny, nz);
    }
  }
  // nivel de oscuridad 0 (cielo) … 7 (negro) de la celda donde asoma una cara
  const skyLevel = (x, y, z) => {
    if (y < 0) return 7;
    if (y > HMAP[(z + LR) * LW + x + LR]) return 0;
    return Math.round(((15 - LV[li(x, y, z)]) / 15) * 7);
  };
  const top = Math.min(chunk.maxY + 1, H - 1);
  // Lo que queda DEBAJO de la superficie más baja del chunk va a una malla aparte ("deep"): desde afuera no se ve
  // (sólo se asoma por una boca de cueva) y las cuevas duplicarían los triángulos. El renderer decide cuándo dibujarla.
  let minTop = H;
  for (let z = 0; z < S && minTop > 0; z++) {
    for (let x = 0; x < S; x++) {
      let y = top;
      while (y > 0 && !IS_OPAQUE[blocks[x | (z << 4) | (y << 8)]]) y--;
      if (y < minTop) minTop = y;
    }
  }
  const splitY = Math.max(0, minTop - DEEP_MARGIN);
  chunk.splitY = splitY;
  for (let y = 0; y <= top; y++) {
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const id = blocks[x | (z << 4) | (y << 8)];
        if (id === 0) continue;
        if (LIGHT_R[id] && chunk.lights.length < 48) chunk.lights.push([ox + x + 0.5, y + 0.5, oz + z + 0.5, LIGHT_R[id]]);
        if (id === B.TORCH) { torchQuads(opaqueBuilder, x, y, z); continue; }
        if (WALL_TORCH[id]) { leanTorchQuads(opaqueBuilder, x, y, z, WALL_TORCH[id]); continue; }
        const blend = IS_BLEND[id] === 1;
        const builder = blend ? blendBuilder : y < splitY ? deepBuilder : opaqueBuilder;

        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          const nb = sample(x + F.n[0], y + F.n[1], z + F.n[2]);
          if (!shouldDraw(id, nb)) continue;

          const tile = TILE_OF[id * 3 + (f === 0 ? 0 : f === 1 ? 1 : 2)];
          const tx = tile % ATLAS_GRID, ty = (tile / ATLAS_GRID) | 0;
          const u0 = (tx + TEX_EPS) / ATLAS_GRID, u1 = (tx + 1 - TEX_EPS) / ATLAS_GRID;
          const v0 = (ty + TEX_EPS) / ATLAS_GRID, v1 = (ty + 1 - TEX_EPS) / ATLAS_GRID;

          builder.ensure();
          const sky = IS_EMISSIVE[id] ? 0 : 2 * skyLevel(x + F.n[0], y + F.n[1], z + F.n[2]);
          const ao = [3, 3, 3, 3];
          if (!blend) {
            for (let k = 0; k < 4; k++) {
              const [o1, o2, oc] = AO_OFFSETS[f][k];
              const s1 = IS_OPAQUE[sample(x + o1[0], y + o1[1], z + o1[2])];
              const s2 = IS_OPAQUE[sample(x + o2[0], y + o2[1], z + o2[2])];
              const c = IS_OPAQUE[sample(x + oc[0], y + oc[1], z + oc[2])];
              ao[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
            }
          }

          const base = builder.vc;
          let p = builder.vc * FLOATS_PER_VERTEX;
          const v = builder.v;
          for (let k = 0; k < 4; k++) {
            const c = F.c[k], uv = F.uv[k];
            const g = GROW[f][k];
            v[p++] = x + c[0] + g[0];
            v[p++] = y + c[1] + g[1];
            v[p++] = z + c[2] + g[2];
            v[p++] = uv[0] ? u1 : u0;
            v[p++] = uv[1] ? v1 : v0;
            v[p++] = (IS_EMISSIVE[id] ? 100 + 0.9 : sky + F.shade * AO_LEVELS[ao[k]]);
          }
          builder.vc += 4;

          const idx = builder.i;
          let q = builder.ic;
          if (ao[0] + ao[2] > ao[1] + ao[3]) {
            idx[q++] = base; idx[q++] = base + 1; idx[q++] = base + 2;
            idx[q++] = base; idx[q++] = base + 2; idx[q++] = base + 3;
          } else {
            idx[q++] = base + 1; idx[q++] = base + 2; idx[q++] = base + 3;
            idx[q++] = base + 1; idx[q++] = base + 3; idx[q++] = base;
          }
          builder.ic = q;
        }
      }
    }
  }
  return { opaque: opaqueBuilder.finish(), blend: blendBuilder.finish(), deep: deepBuilder.finish() };
}
