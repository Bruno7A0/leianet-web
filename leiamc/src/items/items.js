// Ítems (id >= 100): materiales y herramientas. Los bloques usan ids < 100.
import { ITEM_TILE, TOOL_MATS } from '../blocks/atlas.js';
import { BLOCKS, TILE_OF } from '../blocks/blocks.js';

export const I = { STICK: 100, IRON_INGOT: 101, GOLD_INGOT: 102, DIAMOND: 103, APPLE: 130, RAW_MEAT: 131, COOKED_MEAT: 132 };
export const KINDS = ['pickaxe', 'axe', 'shovel', 'sword'];
const KIND_NAME = ['Pico', 'Hacha', 'Pala', 'Espada'];
// tier: 0 madera/oro, 1 piedra, 2 hierro, 3 diamante. speed: multiplicador de minado. dur: usos.
const MAT = [
  { tier: 0, speed: 2, dur: 60 }, { tier: 1, speed: 4, dur: 132 }, { tier: 2, speed: 6, dur: 251 },
  { tier: 0, speed: 12, dur: 33 }, { tier: 3, speed: 8, dur: 1562 },
];
const DMG = [[3, 4, 2, 5], [4, 5, 3, 6], [5, 6, 4, 7], [3, 4, 2, 5], [6, 7, 5, 8]]; // [material][tipo]

export const toolId = (mat, kind) => 110 + mat * 4 + kind;
const defs = new Map([
  [I.STICK, { name: 'Palo', tile: ITEM_TILE.STICK, stack: 64 }],
  [I.IRON_INGOT, { name: 'Lingote de hierro', tile: ITEM_TILE.IRON_INGOT, stack: 64 }],
  [I.GOLD_INGOT, { name: 'Lingote de oro', tile: ITEM_TILE.GOLD_INGOT, stack: 64 }],
  [I.DIAMOND, { name: 'Diamante', tile: ITEM_TILE.DIAMOND, stack: 64 }],
  [I.APPLE, { name: 'Manzana', tile: ITEM_TILE.APPLE, stack: 64, food: 4 }],
  [I.RAW_MEAT, { name: 'Carne cruda', tile: ITEM_TILE.RAW_MEAT, stack: 64, food: 2 }],
  [I.COOKED_MEAT, { name: 'Carne cocida', tile: ITEM_TILE.COOKED_MEAT, stack: 64, food: 8 }],
]);
TOOL_MATS.forEach((m, mi) => KINDS.forEach((k, ki) => {
  defs.set(toolId(mi, ki), {
    name: `${KIND_NAME[ki]} de ${m.key}`, tile: ITEM_TILE.TOOL0 + mi * 4 + ki, stack: 1,
    tool: { type: k, tier: MAT[mi].tier, speed: MAT[mi].speed, dur: MAT[mi].dur, dmg: DMG[mi][ki] },
  });
}));

export const ALL_ITEMS = [...defs.keys()];
export const isItem = (id) => id >= 100;
export const itemDef = (id) => defs.get(id);
export const toolOf = (id) => (isItem(id) ? defs.get(id)?.tool || null : null);
export const stackMax = (id) => (isItem(id) ? defs.get(id)?.stack ?? 64 : 64);
export const foodOf = (id) => (isItem(id) ? defs.get(id)?.food || 0 : 0);
export const maxDur = (id) => toolOf(id)?.dur || 0;
export const nameOf = (id) => (isItem(id) ? defs.get(id)?.name : BLOCKS[id]?.name) || '?';
export const iconTile = (id) => (isItem(id) ? defs.get(id).tile : TILE_OF[id * 3 + 2]);
