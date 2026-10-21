/* Worker de Seedmap: carga seedmap.wasm (cubiomes, MIT) y responde pedidos del mapa. */
'use strict';
let x = null;
const ready = fetch('seedmap.wasm').then(r => r.arrayBuffer()).then(b => WebAssembly.instantiate(b, {
  wasi_snapshot_preview1: new Proxy({}, { get: (_, k) => k === 'proc_exit' ? () => {} : () => 0 })
})).then(m => { x = m.instance.exports; if (x._initialize) x._initialize(); });
const i32 = (n) => new Int32Array(x.memory.buffer, x.sm_out(), n);
const cstr = (p) => { if (!p) return ''; const u = new Uint8Array(x.memory.buffer, p, 64); let s = ''; for (const c of u) { if (!c) break; s += String.fromCharCode(c); } return s; };
onmessage = async (e) => {
  const d = e.data;
  try {
    await ready;
    let r = {};
    switch (d.op) {
      case 'colors': r.colors = new Uint8Array(new Uint8Array(x.memory.buffer, x.sm_colors(), 768)); break;
      case 'setup': {
        x.sm_setup(d.vi, d.lo, d.hi, d.dim);
        r.names = []; for (let i = 0; i < 256; i++) r.names.push(cstr(x.sm_biome_name(i)));
        break; }
      case 'tile': {
        r.e = x.sm_tile(d.sc, d.x, d.z, 64, 64);
        const a = new Int32Array(x.memory.buffer, x.sm_out(), 4096); r.ids = new Uint8Array(4096);
        if (!r.e) for (let i = 0; i < 4096; i++) r.ids[i] = a[i];
        break; }
      case 'structs': {
        r.n = x.sm_structures(d.ti, d.x0, d.z0, d.x1, d.z1, d.viable);
        r.pts = r.n > 0 ? new Int32Array(i32(r.n * 2)) : new Int32Array(0); break; }
      case 'sh': { const n = x.sm_strongholds(d.max); r.pts = new Int32Array(i32(n * 2)); break; }
      case 'spawn': { x.sm_spawn(); r.pt = Array.from(i32(2)); break; }
      case 'slime': { x.sm_slime(d.cx, d.cz, 64, 64); r.s = new Uint8Array(new Uint8Array(x.memory.buffer, x.sm_slime_buf(), 4096)); break; }
    }
    r.id = d.id; postMessage(r);
  } catch (err) { postMessage({ id: d.id, err: String(err), e: -9, n: -9, pts: new Int32Array(0), ids: new Uint8Array(4096), s: new Uint8Array(4096), names: [] }); }
};
