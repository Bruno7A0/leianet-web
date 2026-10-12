// Inventario: 36 slots (los primeros 9 son la hotbar), stacks de hasta 64.
// Pensado para extenderse (crafting, herramientas): cada slot es { id, count } o null.
import { B } from '../blocks/blocks.js';
import { stackMax, maxDur, I } from '../items/items.js';

export const STACK_MAX = 64;
export const HOTBAR_SIZE = 9;

export class Inventory {
  constructor(size = 36) {
    this.slots = new Array(size).fill(null);
    this.selected = 0;
  }

  get selectedStack() { return this.slots[this.selected]; }

  select(i) {
    this.selected = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  // Agrega `count` items del bloque `id`. Devuelve cuántos NO entraron.
  add(id, count = 1) {
    for (const s of this.slots) {
      if (count <= 0) break;
      if (s && s.id === id && s.count < stackMax(id)) {
        const n = Math.min(stackMax(id) - s.count, count);
        s.count += n; count -= n;
      }
    }
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(stackMax(id), count);
        this.slots[i] = { id, count: n };
        if (maxDur(id)) this.slots[i].dur = maxDur(id);
        count -= n;
      }
    }
    return count;
  }

  // Quita items de un slot; el slot queda en null al vaciarse.
  removeFromSlot(i, count = 1) {
    const s = this.slots[i];
    if (!s) return false;
    if (s.count < count) return false;
    s.count -= count;
    if (s.count === 0) this.slots[i] = null;
    return true;
  }

  // Kit de supervivencia: lo justo para empezar a fabricar.
  giveSurvivalKit() {
    this.add(B.LOG, 10); this.add(B.CRAFTING, 1); this.add(B.TNT, 4); this.add(I.APPLE, 4);
  }

  // Kit inicial de prueba (creativo): un poco de cada bloque en la hotbar.
  giveStarterKit() {
    for (const id of [B.STONE, B.DIRT, B.GRASS, B.PLANKS, B.BRICKS, B.GLASS, B.LOG, B.SAND, B.LEAVES]) {
      this.add(id, 64);
    }
  }
}
