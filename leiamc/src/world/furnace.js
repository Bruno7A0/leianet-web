// Hornos: cada uno guarda entrada, combustible y salida, y sigue fundiendo aunque cierres la interfaz.
import { B } from '../blocks/blocks.js';
import { I } from '../items/items.js';

export const COOK_TIME = 5; // segundos por ítem
export const SMELT = new Map([[B.IRON, I.IRON_INGOT], [B.GOLD, I.GOLD_INGOT], [B.COBBLE, B.STONE], [B.SAND, B.GLASS], [B.LOG, B.COAL], [B.CACTUS, B.WOOL_GREEN], [I.RAW_MEAT, I.COOKED_MEAT]]);
export const FUEL = new Map([[B.COAL, 40], [B.LOG, 7.5], [B.PLANKS, 7.5], [I.STICK, 2.5]]); // segundos de fuego

export class Furnaces {
  constructor() { this.map = new Map(); }
  static key(x, y, z) { return `${x},${y},${z}`; }
  get(x, y, z, create = false) {
    const k = Furnaces.key(x, y, z);
    let f = this.map.get(k);
    if (!f && create) { f = { x, y, z, inp: null, fuel: null, out: null, burn: 0, burnMax: 1, cook: 0, lit: false }; this.map.set(k, f); }
    return f;
  }
  // Al romper el horno, lo que tenía adentro vuelve al inventario.
  dropAll(x, y, z, inventory) {
    const f = this.get(x, y, z);
    if (!f) return;
    for (const s of [f.inp, f.fuel, f.out]) if (s) inventory.add(s.id, s.count);
    this.map.delete(Furnaces.key(x, y, z));
  }
  update(dt, world) {
    for (const [k, f] of this.map) {
      if (!world.getChunk(f.x >> 4, f.z >> 4)) continue; // chunk descargado: queda en pausa
      const b = world.getBlock(f.x, f.y, f.z);
      if (b !== B.FURNACE && b !== B.FURNACE_ON) { this.map.delete(k); continue; }
      const res = f.inp ? SMELT.get(f.inp.id) : undefined;
      const can = res !== undefined && (!f.out || (f.out.id === res && f.out.count < 64));
      const refuel = () => {
        if (f.burn > 0 || !can || !f.fuel || !FUEL.has(f.fuel.id)) return;
        f.burn = f.burnMax = FUEL.get(f.fuel.id);
        if (--f.fuel.count <= 0) f.fuel = null;
      };
      refuel();
      if (f.burn > 0) {
        f.burn -= dt;
        if (can) {
          f.cook += dt;
          if (f.cook >= COOK_TIME) {
            f.cook = 0;
            if (--f.inp.count <= 0) f.inp = null;
            if (f.out) f.out.count++; else f.out = { id: res, count: 1 };
          }
        } else f.cook = 0;
      } else f.cook = Math.max(0, f.cook - dt * 2);
      if (f.burn <= 0) refuel(); // seguir con el próximo combustible sin apagar el horno
      const lit = f.burn > 0;
      if (lit !== f.lit) { f.lit = lit; world.setBlock(f.x, f.y, f.z, lit ? B.FURNACE_ON : B.FURNACE); }
    }
  }
  toJSON() {
    return [...this.map.values()].filter((f) => f.inp || f.fuel || f.out || f.burn > 0)
      .map((f) => [f.x, f.y, f.z, { inp: f.inp, fuel: f.fuel, out: f.out, burn: f.burn, burnMax: f.burnMax, cook: f.cook }]);
  }
  load(list, validItem) {
    this.map.clear();
    if (!Array.isArray(list)) return;
    const st = (s) => (s && validItem(s.id) && Number.isInteger(s.count) && s.count > 0 ? { id: s.id, count: Math.min(64, s.count) } : null);
    const n = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    for (const e of list) {
      if (!Array.isArray(e) || e.length < 4 || !e.slice(0, 3).every(Number.isInteger)) continue;
      const d = e[3] || {}, f = this.get(e[0], e[1], e[2], true);
      f.inp = st(d.inp); f.fuel = st(d.fuel); f.out = st(d.out);
      f.burn = Math.max(0, n(d.burn, 0)); f.burnMax = Math.max(1, n(d.burnMax, 1)); f.cook = Math.max(0, n(d.cook, 0));
    }
  }
}
