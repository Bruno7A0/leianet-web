// Ítems (id >= 100): materiales y herramientas. Los bloques usan ids < 100.
import { ITEM_TILE, TOOL_MATS } from '../blocks/atlas.js';
import { BLOCKS, TILE_OF } from '../blocks/blocks.js';

export const I = { STICK: 100, IRON_INGOT: 101, GOLD_INGOT: 102, DIAMOND: 103, APPLE: 130, RAW_MEAT: 131, COOKED_MEAT: 132, BONE: 133, STRING: 134, SEEDS: 135, WHEAT: 136, CARROT: 137, BREAD: 138, LEATHER: 139 };
export const hoeId = (mat) => 140 + mat;
export const armorId = (mat, piece) => 150 + mat * 4 + piece; // mat: 0 cuero, 1 hierro, 2 oro, 3 diamante · piece: 0 casco, 1 peto, 2 pantalones, 3 botas
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
  [I.BONE, { name: 'Hueso', tile: ITEM_TILE.BONE, stack: 64 }],
  [I.STRING, { name: 'Hilo', tile: ITEM_TILE.STRING, stack: 64 }],
  [I.SEEDS, { name: 'Semillas de trigo', tile: ITEM_TILE.SEEDS, stack: 64 }],
  [I.WHEAT, { name: 'Trigo', tile: ITEM_TILE.WHEAT, stack: 64 }],
  [I.CARROT, { name: 'Zanahoria', tile: ITEM_TILE.CARROT, stack: 64, food: 3 }],
  [I.BREAD, { name: 'Pan', tile: ITEM_TILE.BREAD, stack: 64, food: 5 }],
  [I.LEATHER, { name: 'Cuero', tile: ITEM_TILE.LEATHER, stack: 64 }],
  [I.COOKED_MEAT, { name: 'Carne cocida', tile: ITEM_TILE.COOKED_MEAT, stack: 64, food: 8 }],
]);
TOOL_MATS.forEach((m, mi) => KINDS.forEach((k, ki) => {
  defs.set(toolId(mi, ki), {
    name: `${KIND_NAME[ki]} de ${m.key}`, tile: ITEM_TILE.TOOL0 + mi * 4 + ki, stack: 1,
    tool: { type: k, tier: MAT[mi].tier, speed: MAT[mi].speed, dur: MAT[mi].dur, dmg: DMG[mi][ki] },
  });
}));

// Azadas (una por material) y armaduras (4 materiales x 4 piezas). Puntos de defensa y durabilidad como en Minecraft.
TOOL_MATS.forEach((m, mi) => defs.set(hoeId(mi), { name: `Azada de ${m.key}`, tile: ITEM_TILE.HOE0 + mi, stack: 1, tool: { type: 'hoe', tier: MAT[mi].tier, speed: 1, dur: MAT[mi].dur, dmg: 1 } }));
const ARMOR_MATNAME = ['cuero', 'hierro', 'oro', 'diamante'], PIECE_NAME = ['Casco', 'Peto', 'Pantalones', 'Botas'];
const ARMOR_PTS = [[1, 3, 2, 1], [2, 6, 5, 2], [2, 5, 3, 1], [3, 8, 6, 3]], ARMOR_DUR = [[55, 80, 75, 65], [165, 240, 225, 195], [77, 112, 105, 91], [363, 528, 495, 429]];
for (let mi = 0; mi < 4; mi++) for (let pi = 0; pi < 4; pi++) {
  defs.set(armorId(mi, pi), { name: `${PIECE_NAME[pi]} de ${ARMOR_MATNAME[mi]}`, tile: ITEM_TILE.ARMOR0 + mi * 4 + pi, stack: 1, armor: { slot: pi, pts: ARMOR_PTS[mi][pi], dur: ARMOR_DUR[mi][pi] } });
}
export const armorOf = (id) => (isItem(id) ? defs.get(id)?.armor || null : null);

export const ALL_ITEMS = [...defs.keys()];
export const isItem = (id) => id >= 100;
export const itemDef = (id) => defs.get(id);
export const toolOf = (id) => (isItem(id) ? defs.get(id)?.tool || null : null);
export const stackMax = (id) => (isItem(id) ? defs.get(id)?.stack ?? 64 : 64);
export const foodOf = (id) => (isItem(id) ? defs.get(id)?.food || 0 : 0);
export const maxDur = (id) => toolOf(id)?.dur || armorOf(id)?.dur || 0;
export const nameOf = (id) => (isItem(id) ? defs.get(id)?.name : BLOCKS[id]?.name) || '?';
export const iconTile = (id) => (isItem(id) ? defs.get(id).tile : TILE_OF[id * 3 + 2]);
