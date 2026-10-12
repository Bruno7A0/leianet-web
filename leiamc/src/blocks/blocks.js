// Registro de bloques. Cada bloque tiene ID, nombre, texturas (tiles del atlas),
// transparencia, solidez, resistencia y herramienta necesaria.
import { TILES as T } from './atlas.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6,
  WATER: 7, COAL: 8, IRON: 9, GLASS: 10, PLANKS: 11, BRICKS: 12,
  COBBLE: 13, BEDROCK: 14, GRAVEL: 15, GOLD: 16, DIAMOND: 17, TNT: 18, TNT_FLASH: 19,
  CRAFTING: 20, BOOKSHELF: 21, GLOWSTONE: 22, OBSIDIAN: 23,
  // LeiaNET
  LEIA: 24, COLLIE: 25, WOOL_WHITE: 26, WOOL_BLACK: 27, WOOL_PINK: 28, WOOL_GREEN: 29, WOOL_BROWN: 30,
  SNOW: 31, CACTUS: 32, // biomas
  TORCH: 33, FURNACE: 34, FURNACE_ON: 35,
  // Antorcha apoyada en una pared (inclinada 45°): el sufijo indica de qué lado está el bloque que la sostiene.
  TORCH_PX: 36, TORCH_NX: 37, TORCH_PZ: 38, TORCH_NZ: 39,
  BED: 40,
};

export const TOOL = { NONE: 'none', PICKAXE: 'pickaxe', AXE: 'axe', SHOVEL: 'shovel' };

// tiles: [arriba, abajo, lados]
// hardness: segundos aprox. a mano (-1 = irrompible). transparent: no oculta caras vecinas.
// blend: se dibuja en el pase translúcido (mezcla alfa). cullSame: oculta caras entre bloques iguales.
const defs = [
  { id: B.AIR, name: 'Aire', tiles: [0, 0, 0], transparent: true, solid: false, hardness: 0, tool: TOOL.NONE, cullSame: true },
  { id: B.GRASS, name: 'Pasto', tiles: [T.GRASS_TOP, T.DIRT, T.GRASS_SIDE], transparent: false, solid: true, hardness: 0.6, tool: TOOL.SHOVEL },
  { id: B.DIRT, name: 'Tierra', tiles: [T.DIRT, T.DIRT, T.DIRT], transparent: false, solid: true, hardness: 0.5, tool: TOOL.SHOVEL },
  { id: B.STONE, name: 'Piedra', tiles: [T.STONE, T.STONE, T.STONE], transparent: false, solid: true, hardness: 1.5, tool: TOOL.PICKAXE },
  { id: B.SAND, name: 'Arena', tiles: [T.SAND, T.SAND, T.SAND], transparent: false, solid: true, hardness: 0.5, tool: TOOL.SHOVEL },
  { id: B.LOG, name: 'Tronco', tiles: [T.LOG_TOP, T.LOG_TOP, T.LOG_SIDE], transparent: false, solid: true, hardness: 2, tool: TOOL.AXE },
  { id: B.LEAVES, name: 'Hojas', tiles: [T.LEAVES, T.LEAVES, T.LEAVES], transparent: true, solid: true, hardness: 0.2, tool: TOOL.NONE, cullSame: false },
  { id: B.WATER, name: 'Agua', tiles: [T.WATER, T.WATER, T.WATER], transparent: true, solid: false, hardness: -1, tool: TOOL.NONE, blend: true, cullSame: true },
  { id: B.COAL, name: 'Carbón', tiles: [T.COAL, T.COAL, T.COAL], transparent: false, solid: true, hardness: 3, tool: TOOL.PICKAXE },
  { id: B.IRON, name: 'Hierro', tiles: [T.IRON, T.IRON, T.IRON], transparent: false, solid: true, hardness: 3, tool: TOOL.PICKAXE },
  { id: B.GLASS, name: 'Vidrio', tiles: [T.GLASS, T.GLASS, T.GLASS], transparent: true, solid: true, hardness: 0.3, tool: TOOL.NONE, cullSame: true },
  { id: B.PLANKS, name: 'Madera', tiles: [T.PLANKS, T.PLANKS, T.PLANKS], transparent: false, solid: true, hardness: 2, tool: TOOL.AXE },
  { id: B.BRICKS, name: 'Ladrillos', tiles: [T.BRICKS, T.BRICKS, T.BRICKS], transparent: false, solid: true, hardness: 2, tool: TOOL.PICKAXE },
  { id: B.COBBLE, name: 'Roca', tiles: [T.COBBLE, T.COBBLE, T.COBBLE], transparent: false, solid: true, hardness: 2, tool: TOOL.PICKAXE },
  { id: B.BEDROCK, name: 'Lecho de roca', tiles: [T.BEDROCK, T.BEDROCK, T.BEDROCK], transparent: false, solid: true, hardness: -1, tool: TOOL.NONE },
  { id: B.GRAVEL, name: 'Grava', tiles: [T.GRAVEL, T.GRAVEL, T.GRAVEL], transparent: false, solid: true, hardness: 0.6, tool: TOOL.SHOVEL },
  { id: B.GOLD, name: 'Oro', tiles: [T.GOLD, T.GOLD, T.GOLD], transparent: false, solid: true, hardness: 3, tool: TOOL.PICKAXE },
  { id: B.DIAMOND, name: 'Diamante', tiles: [T.DIAMOND, T.DIAMOND, T.DIAMOND], transparent: false, solid: true, hardness: 3.5, tool: TOOL.PICKAXE },
  { id: B.TNT, name: 'TNT', tiles: [T.TNT_TOP, T.TNT_BOTTOM, T.TNT_SIDE], transparent: false, solid: true, hardness: 0.1, tool: TOOL.NONE },
  { id: B.TNT_FLASH, name: 'TNT (encendido)', tiles: [T.TNT_FLASH, T.TNT_FLASH, T.TNT_FLASH], transparent: false, solid: true, hardness: -1, tool: TOOL.NONE, emissive: true },
  { id: B.CRAFTING, name: 'Mesa de crafteo', tiles: [T.CRAFT_TOP, T.PLANKS, T.CRAFT_SIDE], transparent: false, solid: true, hardness: 1.5, tool: TOOL.AXE },
  { id: B.BOOKSHELF, name: 'Librería', tiles: [T.PLANKS, T.PLANKS, T.BOOKSHELF], transparent: false, solid: true, hardness: 1.5, tool: TOOL.AXE },
  { id: B.GLOWSTONE, name: 'Piedra luminosa', tiles: [T.GLOWSTONE, T.GLOWSTONE, T.GLOWSTONE], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE, emissive: true },
  { id: B.LEIA, name: 'Bloque LeiaNET', tiles: [T.LEIA_L, T.LEIA_L, T.LEIA_L], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE, emissive: true },
  { id: B.COLLIE, name: 'Bloque Leia (collie)', tiles: [T.DOG_BLACK, T.DOG_BLACK, T.COLLIE], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE },
  { id: B.WOOL_WHITE, name: 'Lana blanca', tiles: [T.WOOL_WHITE, T.WOOL_WHITE, T.WOOL_WHITE], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE },
  { id: B.WOOL_BLACK, name: 'Lana negra', tiles: [T.WOOL_BLACK, T.WOOL_BLACK, T.WOOL_BLACK], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE },
  { id: B.WOOL_PINK, name: 'Lana rosa', tiles: [T.WOOL_PINK, T.WOOL_PINK, T.WOOL_PINK], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE },
  { id: B.WOOL_GREEN, name: 'Lana verde LeiaNET', tiles: [T.WOOL_GREEN, T.WOOL_GREEN, T.WOOL_GREEN], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE },
  { id: B.WOOL_BROWN, name: 'Lana marrón', tiles: [T.WOOL_BROWN, T.WOOL_BROWN, T.WOOL_BROWN], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE },
  { id: B.SNOW, name: 'Nieve', tiles: [T.SNOW, T.DIRT, T.SNOW_SIDE], transparent: false, solid: true, hardness: 0.3, tool: TOOL.SHOVEL },
  { id: B.CACTUS, name: 'Cactus', tiles: [T.CACTUS_TOP, T.CACTUS_TOP, T.CACTUS_SIDE], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE },
  { id: B.TORCH, name: 'Antorcha', tiles: [T.TORCH, T.TORCH, T.TORCH], transparent: true, solid: false, hardness: 0, tool: TOOL.NONE, cullSame: false, light: 12 },
  { id: B.FURNACE, name: 'Horno', tiles: [T.COBBLE, T.COBBLE, T.FURNACE_SIDE], transparent: false, solid: true, hardness: 3, tool: TOOL.PICKAXE },
  { id: B.FURNACE_ON, name: 'Horno (encendido)', tiles: [T.COBBLE, T.COBBLE, T.FURNACE_ON_SIDE], transparent: false, solid: true, hardness: 3, tool: TOOL.PICKAXE, light: 8 },
  ...[B.TORCH_PX, B.TORCH_NX, B.TORCH_PZ, B.TORCH_NZ].map((id) => ({ id, name: 'Antorcha', tiles: [T.TORCH, T.TORCH, T.TORCH], transparent: true, solid: false, hardness: 0, tool: TOOL.NONE, cullSame: false, light: 12 })),
  { id: B.BED, name: 'Cama', tiles: [T.BED_TOP, T.PLANKS, T.BED_SIDE], transparent: false, solid: true, hardness: 0.4, tool: TOOL.NONE },
  { id: B.OBSIDIAN, name: 'Obsidiana', tiles: [T.OBSIDIAN, T.OBSIDIAN, T.OBSIDIAN], transparent: false, solid: true, hardness: 8, tool: TOOL.PICKAXE },
];

// Bloques que se pueden elegir en el inventario creativo (E).
export const CREATIVE_LIST = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.SAND, B.SNOW, B.CACTUS, B.GRAVEL, B.LOG, B.LEAVES, B.PLANKS, B.BRICKS, B.GLASS,
  B.COAL, B.IRON, B.GOLD, B.DIAMOND, B.OBSIDIAN, B.BOOKSHELF, B.CRAFTING, B.GLOWSTONE, B.TORCH, B.FURNACE, B.BED, B.TNT,
  B.LEIA, B.COLLIE, B.WOOL_WHITE, B.WOOL_BLACK, B.WOOL_PINK, B.WOOL_GREEN, B.WOOL_BROWN,
];

// Nivel mínimo de herramienta (0 madera/oro, 1 piedra, 2 hierro, 3 diamante) para que el bloque suelte algo.
const HARVEST = { [B.STONE]: 0, [B.COBBLE]: 0, [B.COAL]: 0, [B.BRICKS]: 0, [B.FURNACE]: 0, [B.FURNACE_ON]: 0, [B.IRON]: 1, [B.GOLD]: 2, [B.DIAMOND]: 2, [B.OBSIDIAN]: 3 };
for (const d of defs) if (HARVEST[d.id] !== undefined) d.harvest = HARVEST[d.id];

// Dirección horizontal [dx, dz] hacia la pared que sostiene cada antorcha de pared.
export const WALL_TORCH = { [B.TORCH_PX]: [1, 0], [B.TORCH_NX]: [-1, 0], [B.TORCH_PZ]: [0, 1], [B.TORCH_NZ]: [0, -1] };
export const isTorch = (id) => id === B.TORCH || WALL_TORCH[id] !== undefined;
// Antorcha que corresponde colocar contra una cara con normal (nx, nz): la pared queda del lado opuesto.
export const wallTorchFor = (nx, nz) => (nx === 1 ? B.TORCH_NX : nx === -1 ? B.TORCH_PX : nz === 1 ? B.TORCH_NZ : B.TORCH_PZ);

export const BLOCKS = [];
export const IS_SOLID = new Uint8Array(256);
export const IS_OPAQUE = new Uint8Array(256);
export const IS_EMISSIVE = new Uint8Array(256);
export const IS_BLEND = new Uint8Array(256);
export const LIGHT_R = new Float32Array(256); // radio de luz (0 = no ilumina)
export const CULL_SAME = new Uint8Array(256);
export const TILE_OF = new Uint8Array(256 * 3); // [id*3 + (0 arriba, 1 abajo, 2 lados)]

for (const d of defs) {
  BLOCKS[d.id] = d;
  IS_SOLID[d.id] = d.solid ? 1 : 0;
  IS_OPAQUE[d.id] = d.transparent ? 0 : 1;
  IS_BLEND[d.id] = d.blend ? 1 : 0;
  IS_EMISSIVE[d.id] = d.emissive ? 1 : 0;
  CULL_SAME[d.id] = d.cullSame ? 1 : 0;
  LIGHT_R[d.id] = d.light || (d.id === B.GLOWSTONE || d.id === B.LEIA ? 9 : 0);
  TILE_OF[d.id * 3] = d.tiles[0];
  TILE_OF[d.id * 3 + 1] = d.tiles[1];
  TILE_OF[d.id * 3 + 2] = d.tiles[2];
}
