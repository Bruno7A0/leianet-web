// Guardado del mundo. No se guarda el mundo entero: sólo la DIFERENCIA contra el terreno recién
// generado (que es determinístico por la semilla). Un cráter de TNT o una casa pesan unos pocos KB.
//
// Formato binario (luego en base64 dentro de localStorage):
//   u8 versión · varint nChunks · por chunk: i16 cx, i16 cz, varint nTramos
//   tramo = varint (inicio - fin del tramo anterior) · u8 id · varint largo   (índices consecutivos con el mismo id)
import { CHUNK_SIZE as S, CHUNK_HEIGHT as H } from '../world/constants.js';

export const VERSION = 1;
const CH_LEN = S * S * H;
const MAX_B64 = 4_000_000; // tope de caracteres por clave (localStorage ronda los 5 M)

// ---- instantánea y diferencias ----
export function snapshot(world) {
  const m = new Map();
  for (const c of world.chunks.values()) m.set(`${c.cx},${c.cz}`, c.blocks.slice());
  return m;
}

// `norm`: tabla opcional id -> id (p. ej. TNT encendido se guarda como TNT).
// `base`: Map de instantáneas por chunk; si es null se usa `chunk.base` (la copia que el mundo hace al primer cambio),
// así sólo se recorren los chunks editados.
export function diffWorld(world, base, norm = null) {
  const out = [];
  for (const c of world.chunks.values()) {
    const b0 = base ? base.get(`${c.cx},${c.cz}`) : c.base;
    if (!b0) continue;
    const b = c.blocks, runs = [];
    let i = 0;
    while (i < CH_LEN) {
      const v = norm ? norm[b[i]] : b[i];
      if (v === b0[i]) { i++; continue; }
      let j = i + 1;
      while (j < CH_LEN && (norm ? norm[b[j]] : b[j]) === v && v !== b0[j]) j++;
      runs.push([i, v, j - i]);
      i = j;
    }
    if (runs.length) out.push({ cx: c.cx, cz: c.cz, runs });
  }
  return out;
}

// Aplica tramos guardados sobre un chunk recién generado (antes guarda su copia pristina en chunk.base).
export function applyRuns(chunk, runs, isValidId = () => true) {
  if (!chunk.base) chunk.base = chunk.blocks.slice();
  let n = 0;
  for (const [start, id, len] of runs) {
    if (!isValidId(id)) continue;
    for (let k = 0; k < len; k++) { chunk.blocks[start + k] = id; n++; }
  }
  chunk.recomputeMaxY();
  return n;
}

// Aplica la diferencia sobre los chunks que ya están en el mundo (y los marca para rehacer la malla).
export function applyDiff(world, diff, isValidId = () => true) {
  let n = 0;
  for (const d of diff) {
    const c = world.getChunk(d.cx, d.cz);
    if (!c) continue;
    n += applyRuns(c, d.runs, isValidId);
    world.dirty.add(c);
  }
  return n;
}

// Diferencia a guardar = chunks editados en memoria + lo guardado de chunks que todavía no se generaron esta sesión.
export function mergePending(diff, pending) {
  const out = diff.slice();
  for (const [key, runs] of pending) { const [cx, cz] = key.split(',').map(Number); out.push({ cx, cz, runs }); }
  return out;
}

// ---- codificación ----
function pushVar(a, n) { while (n >= 128) { a.push((n & 127) | 128); n = Math.floor(n / 128); } a.push(n); }
function pushI16(a, n) { a.push(n & 255, (n >> 8) & 255); }

export function encodeDiff(diff) {
  const a = [VERSION];
  pushVar(a, diff.length);
  for (const d of diff) {
    pushI16(a, d.cx); pushI16(a, d.cz); pushVar(a, d.runs.length);
    let prevEnd = 0;
    for (const [start, id, len] of d.runs) {
      pushVar(a, start - prevEnd); a.push(id); pushVar(a, len);
      prevEnd = start + len;
    }
  }
  return Uint8Array.from(a);
}

// Devuelve null si los datos están corruptos o son de otra versión (nunca lanza).
export function decodeDiff(bytes) {
  try {
    let p = 0;
    const u8 = () => { if (p >= bytes.length) throw new Error('eof'); return bytes[p++]; };
    const vr = () => { let r = 0, m = 1, b; do { b = u8(); r += (b & 127) * m; m *= 128; } while (b & 128); return r; };
    const i16 = () => { const v = u8() | (u8() << 8); return v & 0x8000 ? v - 0x10000 : v; };
    if (u8() !== VERSION) return null;
    const nc = vr(), out = [];
    if (nc > 4096) return null;
    for (let k = 0; k < nc; k++) {
      const cx = i16(), cz = i16(), nr = vr(), runs = [];
      if (nr > CH_LEN) return null;
      let prevEnd = 0;
      for (let r = 0; r < nr; r++) {
        const start = prevEnd + vr(), id = u8(), len = vr();
        if (len < 1 || start + len > CH_LEN) return null;
        runs.push([start, id, len]);
        prevEnd = start + len;
      }
      out.push({ cx, cz, runs });
    }
    return p === bytes.length ? out : null;
  } catch { return null; }
}

export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(str) {
  try { const s = atob(str); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  catch { return null; }
}

// ---- inventario ----
export function packInventory(inv) {
  const pk = (s) => (s ? (s.dur !== undefined ? [s.id, s.count, s.dur] : [s.id, s.count]) : null);
  return { sel: inv.selected, arm: (inv.armor || []).map(pk), slots: inv.slots.map((s) => (s ? (s.dur !== undefined ? [s.id, s.count, s.dur] : [s.id, s.count]) : null)) };
}
// `isValidItem(id)` decide si el id existe; los conteos se acotan a 1..64.
export function unpackInventory(inv, data, isValidItem) {
  if (!data || !Array.isArray(data.slots)) return false;
  data.slots.slice(0, inv.slots.length).forEach((s, i) => {
    if (!Array.isArray(s) || !isValidItem(s[0])) { inv.slots[i] = null; return; }
    const st = { id: s[0] | 0, count: Math.max(1, Math.min(64, s[1] | 0)) };
    if (s[2] !== undefined) st.dur = Math.max(1, s[2] | 0);
    inv.slots[i] = st;
  });
  if (Array.isArray(data.arm) && inv.armor) {
    data.arm.slice(0, 4).forEach((s, i) => {
      if (!Array.isArray(s) || !isValidItem(s[0])) { inv.armor[i] = null; return; }
      inv.armor[i] = { id: s[0] | 0, count: 1, dur: Math.max(1, s[2] | 0 || 1) };
    });
  }
  inv.select(Number.isInteger(data.sel) ? data.sel : 0);
  return true;
}

// ---- almacenamiento (localStorage; todo envuelto en try/catch: puede estar bloqueado o lleno) ----
export class SaveStore {
  constructor(key, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    this.key = key; this.storage = storage; this.lastError = null;
  }

  load() {
    try {
      const m = this.storage?.getItem(this.key + ':meta');
      if (!m) return null;
      const meta = JSON.parse(m);
      if (!meta || meta.v !== VERSION) return null;
      const raw = this.storage.getItem(this.key + ':blk');
      const diff = raw ? decodeDiff(fromB64(raw) || new Uint8Array(0)) : [];
      return { meta, diff: diff || [] };
    } catch { return null; }
  }

  // Devuelve true si guardó. Primero los bloques y recién después el resto, así un fallo no deja datos mezclados.
  save(meta, diff) {
    try {
      const b64 = toB64(encodeDiff(diff));
      if (b64.length > MAX_B64) { this.lastError = 'grande'; return false; }
      this.storage.setItem(this.key + ':blk', b64);
      this.storage.setItem(this.key + ':meta', JSON.stringify({ ...meta, v: VERSION, saved: Date.now() }));
      this.lastError = null;
      return true;
    } catch (e) { this.lastError = e && e.name === 'QuotaExceededError' ? 'lleno' : 'bloqueado'; return false; }
  }

  clear() {
    try { this.storage?.removeItem(this.key + ':meta'); this.storage?.removeItem(this.key + ':blk'); } catch { /* nada */ }
  }
}
