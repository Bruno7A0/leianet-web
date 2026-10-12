// Cofres: 27 casillas por cofre, indexados por posición. Se guardan con la partida; al romper el cofre, todo vuelve al inventario.
import { B } from '../blocks/blocks.js';

export const CHEST_SLOTS = 27;

export class Chests {
  constructor() { this.map = new Map(); }
  static key(x, y, z) { return `${x},${y},${z}`; }
  get(x, y, z, create = false) {
    const k = Chests.key(x, y, z);
    let c = this.map.get(k);
    if (!c && create) { c = { x, y, z, slots: new Array(CHEST_SLOTS).fill(null) }; this.map.set(k, c); }
    return c;
  }
  dropAll(x, y, z, inventory) {
    const c = this.get(x, y, z);
    if (!c) return;
    for (const s of c.slots) {
      if (!s) continue;
      if (s.dur !== undefined) { const i = inventory.slots.findIndex((v) => !v); if (i >= 0) inventory.slots[i] = s; } else inventory.add(s.id, s.count);
    }
    this.map.delete(Chests.key(x, y, z));
  }
  prune(world) { for (const [k, c] of this.map) if (world.getChunk(c.x >> 4, c.z >> 4) && world.getBlock(c.x, c.y, c.z) !== B.CHEST) this.map.delete(k); }
  toJSON() {
    return [...this.map.values()].filter((c) => c.slots.some(Boolean))
      .map((c) => [c.x, c.y, c.z, c.slots.map((s) => (s ? (s.dur !== undefined ? [s.id, s.count, s.dur] : [s.id, s.count]) : null))]);
  }
  load(list, validItem) {
    this.map.clear();
    if (!Array.isArray(list)) return;
    for (const e of list) {
      if (!Array.isArray(e) || e.length < 4 || !e.slice(0, 3).every(Number.isInteger) || !Array.isArray(e[3])) continue;
      const c = this.get(e[0], e[1], e[2], true);
      e[3].slice(0, CHEST_SLOTS).forEach((s, i) => {
        if (!Array.isArray(s) || !validItem(s[0])) return;
        const st = { id: s[0] | 0, count: Math.max(1, Math.min(64, s[1] | 0)) };
        if (s[2] !== undefined) st.dur = Math.max(1, s[2] | 0);
        c.slots[i] = st;
      });
    }
  }
}
