// Recetas de fabricación (con forma). Funcionan en la grilla 2x2 del inventario y en la 3x3 de la mesa.
import { B } from '../blocks/blocks.js';
import { I, toolId, hoeId, armorId } from '../items/items.js';

export const RECIPES = [];
function shaped(rows, legend, id, count = 1) {
  RECIPES.push({ rows: rows.map((r) => [...r].map((ch) => (ch === ' ' ? 0 : legend[ch]))), id, count });
}

shaped(['L'], { L: B.LOG }, B.PLANKS, 4);
shaped(['P', 'P'], { P: B.PLANKS }, I.STICK, 4);
shaped(['PP', 'PP'], { P: B.PLANKS }, B.CRAFTING);
shaped(['CSC', 'SCS', 'CSC'], { C: B.COAL, S: B.SAND }, B.TNT);
shaped(['PPP', 'BBB', 'PPP'], { P: B.PLANKS, B: B.GLASS }, B.BOOKSHELF); // librería simplificada
shaped(['CCC', 'C C', 'CCC'], { C: B.COBBLE }, B.FURNACE);
shaped(['C', 'S'], { C: B.COAL, S: I.STICK }, B.TORCH, 4);
shaped(['PPP', 'P P', 'PPP'], { P: B.PLANKS }, B.CHEST);
shaped(['WWW'], { W: I.WHEAT }, I.BREAD);
shaped(['GG', 'GG'], { G: B.GLOWSTONE }, B.GLOWSTONE, 4);

[B.WOOL_WHITE, B.WOOL_BLACK, B.WOOL_PINK, B.WOOL_GREEN, B.WOOL_BROWN].forEach((w) =>
  shaped(['WWW', 'PPP'], { W: w, P: B.PLANKS }, B.BED)); // cama: 3 lanas (la verde sale del cactus en el horno) + 3 tablones

const MATERIALS = [B.PLANKS, B.COBBLE, I.IRON_INGOT, I.GOLD_INGOT, I.DIAMOND];
MATERIALS.forEach((m, mi) => {
  const L = { M: m, S: I.STICK };
  shaped(['MMM', ' S ', ' S '], L, toolId(mi, 0));
  shaped(['MM', 'MS', ' S'], L, toolId(mi, 1));
  shaped(['M', 'S', 'S'], L, toolId(mi, 2));
  shaped(['M', 'M', 'S'], L, toolId(mi, 3));
  shaped(['MM', ' S', ' S'], L, hoeId(mi));
});
[I.LEATHER, I.IRON_INGOT, I.GOLD_INGOT, I.DIAMOND].forEach((m, mi) => {
  const L = { M: m };
  shaped(['MMM', 'M M'], L, armorId(mi, 0));
  shaped(['M M', 'MMM', 'MMM'], L, armorId(mi, 1));
  shaped(['MMM', 'M M', 'M M'], L, armorId(mi, 2));
  shaped(['M M', 'M M'], L, armorId(mi, 3));
});

function trim(rows) {
  let y0 = rows.length, y1 = -1, x0 = Infinity, x1 = -1;
  rows.forEach((r, y) => r.forEach((v, x) => { if (v) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }));
  if (y1 < 0) return null;
  return rows.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1));
}
const same = (a, b) => a.length === b.length && a.every((r, y) => r.length === b[y].length && r.every((v, x) => v === b[y][x]));

// ids: arreglo plano (0 = vacío) de size*size. Devuelve { id, count } o null.
export function findRecipe(ids, size) {
  const rows = [];
  for (let y = 0; y < size; y++) rows.push(ids.slice(y * size, y * size + size));
  const g = trim(rows);
  if (!g) return null;
  const mirror = g.map((r) => [...r].reverse());
  for (const r of RECIPES) {
    const t = trim(r.rows);
    if (same(g, t) || same(mirror, t)) return { id: r.id, count: r.count };
  }
  return null;
}
