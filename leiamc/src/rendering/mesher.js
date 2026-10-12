// Generación de mallas por chunk: sólo se emiten las caras visibles (face culling),
// con oclusión ambiental por vértice (AO). Los buffers de trabajo se reutilizan.
import { CHUNK_SIZE as S, CHUNK_HEIGHT as H } from '../world/constants.js';
import { B, IS_OPAQUE, IS_BLEND, IS_EMISSIVE, CULL_SAME, TILE_OF, LIGHT_R, WALL_TORCH, PLANT_TILE } from '../blocks/blocks.js';
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
// Todo se indexa con una "caché" de bloques con borde (LR en x/z y 1 capa extra arriba y abajo), así el mallado no
// consulta el mundo (Map + chunks) por cada vecino: sólo lee un Uint8Array contiguo.
const HP = H + 2, LSZ = LW * LW * HP, LAYER = LW * LW;
const LV = new Uint8Array(LSZ), CB = new Uint8Array(LSZ), HMAP = new Int16Array(LW * LW), LQ = [];
const cidx = (x, y, z) => (y + 1) * LAYER + (z + LR) * LW + (x + LR);
// desplazamientos (en índices de la caché) de cada vecino de cara y de los 3 ocluyentes de cada esquina
const FACE_D = FACES.map((f) => f.n[0] + f.n[2] * LW + f.n[1] * LAYER);
const AO_D = AO_OFFSETS.map((cs) => cs.map(([o1, o2, oc]) => [
  o1[0] + o1[2] * LW + o1[1] * LAYER, o2[0] + o2[2] * LW + o2[1] * LAYER, oc[0] + oc[2] * LW + oc[1] * LAYER]));
// UV de cada tile precalculados (u0,u1,v0,v1)
const NT = ATLAS_GRID * ATLAS_GRID, TUV = new Float32Array(NT * 4);
for (let t = 0; t < NT; t++) {
  const tx = t % ATLAS_GRID, ty = (t / ATLAS_GRID) | 0;
  TUV[t * 4] = (tx + TEX_EPS) / ATLAS_GRID; TUV[t * 4 + 1] = (tx + 1 - TEX_EPS) / ATLAS_GRID;
  TUV[t * 4 + 2] = (ty + TEX_EPS) / ATLAS_GRID; TUV[t * 4 + 3] = (ty + 1 - TEX_EPS) / ATLAS_GRID;
}
const FC = FACES.map((f, i) => f.c.map((c, k) => [c[0] + GROW[i][k][0], c[1] + GROW[i][k][1], c[2] + GROW[i][k][2]]));
const FUV = FACES.map((f) => f.uv.map((u) => [u[0], u[1]]));

function fillCache(world, chunk, top) {
  CB.fill(0);
  const ox = chunk.cx * S, oz = chunk.cz * S;
  // capa -1 (fondo del mundo): piedra, no se dibuja
  CB.fill(B.STONE, 0, LAYER);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = dx === 0 && dz === 0 ? chunk : world.getChunk(chunk.cx + dx, chunk.cz + dz);
    if (!c) continue;
    const cx0 = ox + dx * S, cz0 = oz + dz * S;
    const xs = Math.max(ox - LR, cx0), xe = Math.min(ox + S + LR, cx0 + S);
    const zs = Math.max(oz - LR, cz0), ze = Math.min(oz + S + LR, cz0 + S);
    if (xs >= xe || zs >= ze) continue;
    const blocks = c.blocks, len = xe - xs;
    for (let y = 0; y <= top; y++) {
      for (let z = zs; z < ze; z++) {
        const src = ((z - cz0) << 4) | (y << 8) | (xs - cx0);
        CB.set(blocks.subarray(src, src + len), (y + 1) * LAYER + (z - oz + LR) * LW + (xs - ox + LR));
      }
    }
  }
}

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

// Cultivo: cuatro planos en forma de # (0.25 y 0.75 en cada eje), visibles por ambos lados.
const PLANT_LINES = [[0.25, 0, 0.25, 1, 'z'], [0.75, 0, 0.75, 1, 'z'], [0, 0.25, 1, 0.25, 'x'], [0, 0.75, 1, 0.75, 'x']];
function plantQuads(builder, x, y, z, tile, shade) {
  const tx = tile % ATLAS_GRID, ty = (tile / ATLAS_GRID) | 0;
  const u0 = tx / ATLAS_GRID, u1 = (tx + 1) / ATLAS_GRID, v0 = ty / ATLAS_GRID, v1 = (ty + 1) / ATLAS_GRID;
  for (const [ax, az, bx, bz] of PLANT_LINES) {
    for (let side = 0; side < 2; side++) {
      const [p, q] = side ? [[bx, bz], [ax, az]] : [[ax, az], [bx, bz]];
      const pts = [[p[0], 0, p[1], u0, v1], [q[0], 0, q[1], u1, v1], [q[0], 1, q[1], u1, v0], [p[0], 1, p[1], u0, v0]];
      builder.ensure();
      const base = builder.vc;
      let o = builder.vc * FLOATS_PER_VERTEX;
      for (const c of pts) { builder.v[o++] = x + c[0]; builder.v[o++] = y + c[1]; builder.v[o++] = z + c[2]; builder.v[o++] = c[3]; builder.v[o++] = c[4]; builder.v[o++] = shade; }
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
  chunk.crops = []; // [x, y, z, id] de cultivos (los hace crecer world/crops.js)
  chunk.lights = []; // [x, y, z, radio] de bloques que iluminan (antorcha, piedra luminosa, horno encendido…)
  opaqueBuilder.reset();
  blendBuilder.reset();
  deepBuilder.reset();
  const blocks = chunk.blocks;
  const ox = chunk.cx * S, oz = chunk.cz * S;

  // Luz de cielo: columnas abiertas = 15; bajo techo, la luz entra de costado y baja 3 por bloque (alcance ~4).
  let hmax = chunk.maxY;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = world.getChunk(chunk.cx + dx, chunk.cz + dz); if (n && n.maxY > hmax) hmax = n.maxY; }
  const topFill = Math.min(hmax + 1, H - 1);
  fillCache(world, chunk, topFill);
  for (let z = -LR; z < S + LR; z++) for (let x = -LR; x < S + LR; x++) {
    let k = cidx(x, topFill, z), y = topFill;
    while (y >= 0 && !IS_OPAQUE[CB[k]]) { y--; k -= LAYER; }
    HMAP[(z + LR) * LW + x + LR] = y; // y del bloque opaco más alto de la columna
  }
  LV.fill(0); LQ.length = 0;
  const li = cidx;
  const NBX = [1, -1, 0, 0], NBZ = [0, 0, 1, -1];
  for (let z = -LR + 1; z < S + LR - 1; z++) for (let x = -LR + 1; x < S + LR - 1; x++) {
    const h = HMAP[(z + LR) * LW + x + LR];
    for (let q4 = 0; q4 < 4; q4++) {
      const dx = NBX[q4], dz = NBZ[q4];
      const hn = HMAP[(z + dz + LR) * LW + x + dx + LR];
      for (let y = Math.max(0, hn + 1); y <= h; y++) {
        const k = li(x, y, z);
        if (!IS_OPAQUE[CB[k]] && LV[k] < 12) { LV[k] = 12; LQ.push(x, y, z); }
      }
    }
  }
  for (let q = 0; q < LQ.length; q += 3) {
    const x = LQ[q], y = LQ[q + 1], z = LQ[q + 2], l = LV[li(x, y, z)] - 3;
    if (l <= 0) continue;
    for (let d = 0; d < 6; d++) {
      const nx = x + (d === 0) - (d === 1), ny = y + (d === 2) - (d === 3), nz = z + (d === 4) - (d === 5);
      if (ny < 0 || ny >= H || nx < -LR || nx >= S + LR || nz < -LR || nz >= S + LR) continue;
      const k = li(nx, ny, nz);
      if (ny > HMAP[(nz + LR) * LW + nx + LR] || IS_OPAQUE[CB[k]]) continue;
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
        if (PLANT_TILE[id]) { // cultivo
          plantQuads(opaqueBuilder, x, y, z, PLANT_TILE[id], 2 * skyLevel(x, y, z) + 0.92);
          if (chunk.crops.length < 4096) chunk.crops.push([ox + x, y, oz + z, id]);
          continue;
        }
        if (WALL_TORCH[id]) { leanTorchQuads(opaqueBuilder, x, y, z, WALL_TORCH[id]); continue; }
        const blend = IS_BLEND[id] === 1;
        const builder = blend ? blendBuilder : y < splitY ? deepBuilder : opaqueBuilder;
        const emissive = IS_EMISSIVE[id];
        const ci = cidx(x, y, z);

        for (let f = 0; f < 6; f++) {
          const nb = CB[ci + FACE_D[f]];
          if (!shouldDraw(id, nb)) continue;

          const F = FACES[f];
          const tuv = TILE_OF[id * 3 + (f === 0 ? 0 : f === 1 ? 1 : 2)] * 4;
          const u0 = TUV[tuv], u1 = TUV[tuv + 1], v0 = TUV[tuv + 2], v1 = TUV[tuv + 3];

          builder.ensure();
          const sky = emissive ? 0 : 2 * skyLevel(x + F.n[0], y + F.n[1], z + F.n[2]);
          let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
          if (!blend) {
            const A = AO_D[f];
            let s1 = IS_OPAQUE[CB[ci + A[0][0]]], s2 = IS_OPAQUE[CB[ci + A[0][1]]], c = IS_OPAQUE[CB[ci + A[0][2]]];
            ao0 = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
            s1 = IS_OPAQUE[CB[ci + A[1][0]]]; s2 = IS_OPAQUE[CB[ci + A[1][1]]]; c = IS_OPAQUE[CB[ci + A[1][2]]];
            ao1 = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
            s1 = IS_OPAQUE[CB[ci + A[2][0]]]; s2 = IS_OPAQUE[CB[ci + A[2][1]]]; c = IS_OPAQUE[CB[ci + A[2][2]]];
            ao2 = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
            s1 = IS_OPAQUE[CB[ci + A[3][0]]]; s2 = IS_OPAQUE[CB[ci + A[3][1]]]; c = IS_OPAQUE[CB[ci + A[3][2]]];
            ao3 = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
          }

          const base = builder.vc;
          let p = builder.vc * FLOATS_PER_VERTEX;
          const v = builder.v, C = FC[f], UV = FUV[f], fs = F.shade;
          for (let k = 0; k < 4; k++) {
            const c = C[k], uv = UV[k];
            v[p++] = x + c[0];
            v[p++] = y + c[1];
            v[p++] = z + c[2];
            v[p++] = uv[0] ? u1 : u0;
            v[p++] = uv[1] ? v1 : v0;
            const a = k === 0 ? ao0 : k === 1 ? ao1 : k === 2 ? ao2 : ao3;
            v[p++] = (emissive ? 100 + 0.9 : sky + fs * AO_LEVELS[a]);
          }
          builder.vc += 4;

          const idx = builder.i;
          let q = builder.ic;
          if (ao0 + ao2 > ao1 + ao3) {
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
