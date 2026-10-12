// Texture atlas generado por código (sin archivos de imagen).
// 16x16 tiles de 16x16 px => 256x256 RGBA. Devuelve un Uint8Array listo para subir a la GPU.
import { hash3 } from '../utils/random.js';

export const TILE_PX = 16;
export const ATLAS_GRID = 16;
export const ATLAS_SIZE = TILE_PX * ATLAS_GRID;

export const TILES = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4,
  LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7, WATER: 8, COAL: 9,
  IRON: 10, GLASS: 11, PLANKS: 12, BRICKS: 13,
  COBBLE: 14, BEDROCK: 15, GRAVEL: 16, GOLD: 17, DIAMOND: 18,
  TNT_SIDE: 19, TNT_TOP: 20, TNT_BOTTOM: 21, TNT_FLASH: 22,
  CRAFT_TOP: 23, CRAFT_SIDE: 24, BOOKSHELF: 25, GLOWSTONE: 26, OBSIDIAN: 27,
  WHEAT0: 100, CARROT0: 104, FARMLAND: 108, CHEST_TOP: 119, CHEST_SIDE: 120,
  BONE: 28, RED: 29, SMOKE: 30, SPIDER: 31, YELLOW: 63,
  // LeiaNET: 42..51 (los 32..41 son las grietas)
  WOOL_WHITE: 42, WOOL_BLACK: 43, WOOL_PINK: 44, WOOL_GREEN: 45,
  LEIA_L: 46, COLLIE: 47, DOG_BLACK: 48, DOG_WHITE: 49, DOG_FACE: 50, WOOL_BROWN: 51,
  SNOW: 52, SNOW_SIDE: 53, CACTUS_SIDE: 54, CACTUS_TOP: 55, // biomas: nieve y desierto
  BED_TOP: 61, BED_SIDE: 62, // cama
  SKIN: 59, SLEEVE: 60, // mano estilo Steve
  TORCH: 56, FURNACE_SIDE: 57, FURNACE_ON_SIDE: 58, // antorcha y horno
  CRACK0: 32, // 10 etapas de rotura: 32..41
};

const h = (x, y, s) => hash3(0x51ed + s * 977, x, y, s);
const vary = (c, n, amt) => {
  const f = 1 + (n - 0.5) * 2 * amt;
  return [c[0] * f, c[1] * f, c[2] * f, 255];
};
const GRASS = [92, 150, 50];
const DIRT = [134, 96, 67];

function stoneBase(x, y) {
  let v = vary([125, 125, 125], h(x, y, 11), 0.14);
  if (h(x, y, 12) < 0.06) v = vary([95, 95, 95], h(x, y, 13), 0.1);
  const crack = Math.abs(((x * 5 + y * 3) % 13) - 6) < 0.6 && h(x >> 2, y >> 2, 14) < 0.35; // vetas oscuras
  if (crack) v = [v[0] * 0.8, v[1] * 0.8, v[2] * 0.8, 255];
  else if (h(x >> 1, y >> 1, 15) < 0.12) v = [v[0] * 1.1, v[1] * 1.1, v[2] * 1.1, 255];       // manchas claras
  return v;
}
function blobs(x, y, centers) {
  for (const [cx, cy] of centers) {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= 2) return true;
  }
  return false;
}
const COAL_C = [[3, 4], [10, 3], [6, 10], [12, 12], [2, 13]];
const IRON_C = [[4, 3], [11, 5], [7, 11], [13, 13], [2, 9]];

const painters = {
  [TILES.GRASS_TOP]: (x, y) => vary(h(x >> 1, y, 2) < 0.2 ? [78, 136, 42] : GRASS, h(x, y, 1), 0.2),
  [TILES.GRASS_SIDE]: (x, y) => {
    const edge = 3 + Math.floor(h(x, 0, 2) * 3);
    return y < edge ? vary(GRASS, h(x, y, 1), 0.18) : vary(DIRT, h(x, y, 3), 0.15);
  },
  [TILES.DIRT]: (x, y) => vary(h(x >> 1, y >> 1, 4) < 0.12 ? [112, 80, 56] : DIRT, h(x, y, 3), 0.15),
  [TILES.STONE]: stoneBase,
  [TILES.SAND]: (x, y) => vary([219, 207, 142], h(x, y, 4), 0.07),
  [TILES.LOG_SIDE]: (x, y) => vary([100, 76, 46], h(x, 0, 5) * 0.6 + h(x, y, 6) * 0.4, 0.25),
  [TILES.LOG_TOP]: (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d >= 7) return vary([100, 76, 46], h(x, y, 6), 0.2);
    return vary(Math.floor(d) % 2 ? [160, 125, 75] : [182, 146, 92], h(x, y, 7), 0.06);
  },
  [TILES.LEAVES]: (x, y) => {
    if (h(x, y, 7) < 0.12) return [0, 0, 0, 0];
    return vary(h(x >> 1, y >> 1, 9) < 0.35 ? [44, 100, 32] : [64, 132, 44], h(x, y, 8), 0.22);
  },
  [TILES.WATER]: (x, y) => {
    const c = vary([40, 100, 210], h(x, y, 9), 0.06);
    c[3] = 150;
    return c;
  },
  [TILES.COAL]: (x, y) => (blobs(x, y, COAL_C) ? vary([30, 30, 30], h(x, y, 14), 0.3) : stoneBase(x, y)),
  [TILES.IRON]: (x, y) => (blobs(x, y, IRON_C) ? vary([214, 172, 140], h(x, y, 15), 0.1) : stoneBase(x, y)),
  [TILES.GLASS]: (x, y) => {
    if (x === 0 || x === 15 || y === 0 || y === 15) return [200, 230, 240, 255];
    if ((x === 3 && y === 3) || (x === 4 && y === 4) || (x === 11 && y === 6) || (x === 12 && y === 7)) return [255, 255, 255, 255];
    return [0, 0, 0, 0];
  },
  [TILES.PLANKS]: (x, y) => {
    if (y % 4 === 3) return vary([140, 108, 62], h(x, y, 16), 0.08);
    return vary([180, 144, 90], h(x + (y >> 2) * 5, 0, 17) * 0.5 + h(x, y, 18) * 0.5, 0.08);
  },
  [TILES.BRICKS]: (x, y) => {
    const row = y >> 2;
    const off = (row % 2) * 4;
    if (y % 4 === 3 || (x + off) % 8 === 7) return vary([190, 190, 180], h(x, y, 19), 0.05);
    return vary([150, 64, 50], h(x, y, 20), 0.12);
  },
};

const GOLD_C = [[3, 3], [11, 4], [6, 10], [12, 12], [2, 12]];
const DIA_C = [[4, 4], [10, 3], [7, 11], [12, 11], [2, 9]];
const cobble = (x, y) => {
  const cell = h(x >> 2, y >> 2, 21);
  const edge = x % 4 === 0 || y % 4 === 0;
  return vary([118, 118, 118], cell * 0.7 + h(x, y, 22) * 0.3, edge ? 0.28 : 0.12);
};
Object.assign(painters, {
  [TILES.COBBLE]: cobble,
  [TILES.BEDROCK]: (x, y) => vary(h(x >> 1, y >> 1, 23) < 0.5 ? [50, 50, 50] : [90, 90, 90], h(x, y, 24), 0.2),
  [TILES.GRAVEL]: (x, y) => vary(h(x >> 1, y >> 1, 25) < 0.35 ? [100, 95, 92] : [140, 134, 130], h(x, y, 26), 0.18),
  [TILES.GOLD]: (x, y) => (blobs(x, y, GOLD_C) ? vary([245, 205, 60], h(x, y, 27), 0.1) : stoneBase(x, y)),
  [TILES.DIAMOND]: (x, y) => (blobs(x, y, DIA_C) ? vary([90, 225, 215], h(x, y, 28), 0.1) : stoneBase(x, y)),
  [TILES.TNT_SIDE]: (x, y) => {
    if (y >= 6 && y <= 9) {
      if (x >= 3 && x <= 12 && y >= 7 && y <= 8) return [40, 40, 40, 255];
      return vary([235, 230, 220], h(x, y, 29), 0.05);
    }
    return vary([200, 40, 30], h(x, y, 30), 0.1);
  },
  [TILES.TNT_TOP]: (x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 2) return [50, 50, 50, 255];
    return vary([220, 215, 200], h(x, y, 31), 0.06);
  },
  [TILES.TNT_BOTTOM]: (x, y) => vary([220, 215, 200], h(x, y, 31), 0.06),
  [TILES.TNT_FLASH]: (x, y) => vary([255, 255, 255], h(x, y, 32), 0.02),
  [TILES.CRAFT_TOP]: (x, y) => {
    if (x < 2 || y < 2 || x > 13 || y > 13) return vary([100, 70, 40], h(x, y, 33), 0.1);
    return (x + y) % 5 === 0 || x === 7 || x === 8 || y === 7 || y === 8 ? vary([90, 60, 35], h(x, y, 34), 0.1) : vary([170, 130, 80], h(x, y, 35), 0.08);
  },
  [TILES.CRAFT_SIDE]: (x, y) => {
    if (y < 3) return vary([95, 65, 38], h(x, y, 36), 0.1);
    if (x < 2 || x > 13) return vary([120, 85, 50], h(x, y, 37), 0.1);
    if (y > 5 && y < 12 && x > 3 && x < 12) return vary([190, 150, 95], h(x, y, 38), 0.08);
    return vary([140, 100, 58], h(x, y, 39), 0.1);
  },
  [TILES.BOOKSHELF]: (x, y) => {
    if (y < 2 || y > 13 || y === 7 || y === 8) return vary([180, 144, 90], h(x, y, 40), 0.08);
    const cols = [[170, 40, 40], [40, 90, 170], [60, 140, 60], [200, 160, 40], [120, 60, 150]];
    const c = cols[(Math.floor(x / 2) + (y > 8 ? 2 : 0)) % cols.length];
    return x % 2 === 0 && h(x, y, 41) < 0.25 ? [30, 20, 10, 255] : vary(c, h(x, y, 42), 0.15);
  },
  [TILES.GLOWSTONE]: (x, y) => vary(h(x >> 1, y >> 1, 43) < 0.4 ? [200, 140, 50] : [250, 205, 110], h(x, y, 44), 0.1),
  [TILES.OBSIDIAN]: (x, y) => vary(h(x >> 2, y >> 2, 45) < 0.3 ? [45, 20, 70] : [20, 12, 32], h(x, y, 46), 0.25),
  [TILES.SMOKE]: (x, y) => {
    const v = 150 + h(x, y, 49) * 70;
    return [v, v, v, 255];
  },
});
Object.assign(painters, {
  [TILES.SNOW]: (x, y) => vary([240, 244, 250], h(x, y, 61), 0.045),
  [TILES.SNOW_SIDE]: (x, y) => {
    const edge = 3 + Math.floor(h(x, 0, 62) * 3);
    return y < edge ? vary([240, 244, 250], h(x, y, 61), 0.045) : vary(DIRT, h(x, y, 3), 0.15);
  },
  [TILES.CACTUS_SIDE]: (x, y) => {
    if (x === 0 || x === 15) return vary([30, 90, 36], h(x, y, 63), 0.12);
    if (x % 4 === 2 && y % 3 === 1) return [226, 232, 190, 255]; // espinas
    return vary(x % 4 === 3 ? [48, 128, 52] : [58, 144, 62], h(x, y, 64), 0.1);
  },
  [TILES.CACTUS_TOP]: (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d >= 6.5) return vary([30, 90, 36], h(x, y, 65), 0.1);
    return vary(d < 2.5 ? [86, 170, 90] : [60, 146, 64], h(x, y, 66), 0.08);
  },
});
for (let s = 0; s < 10; s++) {
  painters[TILES.CRACK0 + s] = (x, y) => {
    const t = (s + 1) / 10;
    const chunky = h(x >> 1, y >> 1, 50 + s * 0) < t * 0.5;
    const line = Math.abs(((x * 7 + y * 3 + s) % 11) - 5) < 1 && h(x, y, 60) < t;
    return chunky || line ? [0, 0, 0, 150] : [0, 0, 0, 0];
  };
}

// ---- Iconos de ítems (tiles 64+), dibujados por código ----
export const TOOL_MATS = [
  { key: 'madera', color: [160, 120, 66] }, { key: 'piedra', color: [135, 135, 135] },
  { key: 'hierro', color: [226, 226, 232] }, { key: 'oro', color: [250, 214, 72] },
  { key: 'diamante', color: [92, 228, 216] },
];
export const ITEM_TILE = { STICK: 64, IRON_INGOT: 65, GOLD_INGOT: 66, DIAMOND: 67, TOOL0: 68, APPLE: 88, RAW_MEAT: 89, COOKED_MEAT: 90, BONE: 91, STRING: 92, SEEDS: 109, WHEAT: 110, CARROT: 111, BREAD: 112, LEATHER: 113, HOE0: 114, ARMOR0: 121 }; // TOOL0 + mat*4 + kind

function iconGrid(kind) {
  const g = new Array(256).fill(0);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y * 16 + x] = c; };
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  };
  const rows = (list, c) => list.forEach(([y, a, b]) => { for (let x = a; x <= b; x++) set(x, y, c); });
  if (kind === 'stick') line(3, 12, 12, 3, 'H');
  else if (kind === 'pickaxe') {
    line(2, 13, 10, 5, 'H');
    for (let t = -5; t <= 5; t += 0.5) {
      const b = 2.2 * (1 - (t / 5) ** 2);
      for (const bb of [b, b - 1]) if (bb >= 0) set(10 + 0.707 * (t + bb), 5 + 0.707 * (t - bb), 'M');
    }
  } else if (kind === 'axe') {
    line(2, 13, 10, 5, 'H');
    rows([[1, 9, 11], [2, 8, 12], [3, 8, 13], [4, 9, 13], [5, 10, 13], [6, 11, 13]], 'M');
  } else if (kind === 'shovel') {
    line(2, 13, 10, 5, 'H');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - 11.5, y - 3.5) <= 2.7) set(x, y, 'M');
  } else if (kind === 'sword') {
    for (let k = 0; k <= 8; k++) { set(5 + k, 10 - k, 'M'); set(6 + k, 10 - k, 'M'); }
    line(2, 9, 6, 13, 'G');
    line(3, 12, 1, 14, 'H');
  } else if (kind === 'ingot') {
    rows([[6, 6, 13], [7, 5, 12], [8, 4, 11]], 'M');
    rows([[9, 3, 10], [10, 3, 10]], 'D');
  } else if (kind === 'apple') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - 7.5, y - 9) <= 4.8) set(x, y, 'M');
    line(8, 5, 9, 2, 'H'); rows([[3, 10, 12]], 'G');
  } else if (kind === 'meat') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot((x - 7) / 1.25, y - 7.5) <= 4.6) set(x, y, 'M');
    line(9, 10, 13, 14, 'H'); set(13, 13, 'D'); set(14, 14, 'D');
  } else if (kind === 'hoe') {
    line(2, 13, 10, 5, 'H'); rows([[3, 8, 13], [4, 8, 9], [5, 8, 8]], 'M'); set(10, 4, 'M'); set(11, 4, 'M');
  } else if (kind === 'helmet') {
    rows([[3, 5, 10], [4, 4, 11], [5, 4, 11], [6, 4, 11], [7, 4, 5], [7, 10, 11], [8, 4, 5], [8, 10, 11]], 'M');
  } else if (kind === 'chest') {
    rows([[2, 2, 5], [2, 10, 13], [3, 2, 13], [4, 2, 13], [5, 4, 11], [6, 4, 11], [7, 4, 11], [8, 4, 11], [9, 4, 11], [10, 4, 11], [11, 4, 11], [12, 4, 11]], 'M');
    rows([[3, 6, 9], [4, 6, 9]], 0);
  } else if (kind === 'legs') {
    rows([[3, 4, 11], [4, 4, 11], [5, 4, 11], [6, 4, 7], [6, 8, 11], [7, 4, 6], [7, 9, 11], [8, 4, 6], [8, 9, 11], [9, 4, 6], [9, 9, 11], [10, 4, 6], [10, 9, 11], [11, 4, 6], [11, 9, 11]], 'M');
  } else if (kind === 'boots') {
    rows([[5, 3, 6], [6, 3, 6], [7, 3, 6], [8, 3, 6], [9, 3, 8], [10, 2, 8], [5, 9, 12], [6, 9, 12], [7, 9, 12], [8, 9, 12], [9, 9, 13], [10, 9, 14]], 'M');
  } else if (kind === 'wheat') {
    for (const bx of [4, 8, 12]) { line(bx, 14, bx - 1, 5, 'H'); rows([[2, bx - 2, bx - 1], [3, bx - 2, bx - 1], [4, bx - 2, bx - 1]], 'M'); }
  } else if (kind === 'seeds') {
    for (const [x, y] of [[4, 5], [9, 4], [6, 9], [11, 8], [5, 12], [10, 12]]) { set(x, y, 'M'); set(x + 1, y, 'M'); set(x, y + 1, 'M'); }
  } else if (kind === 'carrot') {
    rows([[4, 10, 11], [5, 9, 12], [6, 8, 12], [7, 7, 11], [8, 6, 10], [9, 5, 9], [10, 4, 8], [11, 3, 7], [12, 3, 5], [13, 2, 4]], 'M');
    rows([[1, 11, 11], [2, 10, 12], [3, 11, 13], [3, 9, 9]], 'L');
  } else if (kind === 'bread') {
    rows([[6, 4, 11], [7, 3, 12], [8, 3, 12], [9, 3, 12], [10, 4, 11]], 'M'); rows([[6, 5, 6], [6, 8, 9]], 'D');
  } else if (kind === 'leather') {
    rows([[3, 5, 10], [4, 3, 12], [5, 3, 12], [6, 3, 12], [7, 3, 12], [8, 3, 12], [9, 3, 12], [10, 4, 11], [11, 5, 10]], 'M'); rows([[6, 6, 9], [7, 6, 9]], 'D');
  } else if (kind === 'bone') {
    line(4, 11, 11, 4, 'M');
    rows([[2, 10, 11], [3, 10, 12], [3, 12, 12]], 'M'); set(12, 3, 'M'); set(11, 2, 'M'); set(13, 4, 'M');
    set(3, 12, 'M'); set(4, 13, 'M'); set(2, 11, 'M'); set(3, 13, 'M'); set(2, 12, 'M');
  } else if (kind === 'string') {
    for (let k = 0; k <= 12; k++) set(2 + k, 8 + Math.round(Math.sin(k * 0.9) * 3), 'M');
    for (let k = 0; k <= 12; k++) set(2 + k, 10 + Math.round(Math.sin(k * 0.9 + 1) * 2), 'D');
  } else if (kind === 'gem') {
    rows([[3, 6, 9], [4, 5, 10], [5, 4, 11], [6, 3, 12], [7, 4, 11], [8, 5, 10], [9, 6, 9], [10, 7, 8]], 'M');
  }
  return g;
}
const HANDLE = [122, 86, 46], GUARD = [88, 72, 56];
function iconPainter(kind, color) {
  const g = iconGrid(kind);
  const at = (x, y) => (x < 0 || y < 0 || x > 15 || y > 15 ? 0 : g[y * 16 + x]);
  return (x, y) => {
    const c = at(x, y);
    if (!c) return [0, 0, 0, 0];
    let base = c === 'H' ? HANDLE : c === 'G' ? GUARD : c === 'L' ? [70, 150, 50] : c === 'D' ? color.map((v) => v * 0.72) : color;
    let f = 1;
    if (!at(x - 1, y) || !at(x, y - 1)) f = 1.18;
    else if (!at(x + 1, y) || !at(x, y + 1)) f = 0.78;
    const n = 0.96 + h(x, y, 70) * 0.08;
    return [base[0] * f * n, base[1] * f * n, base[2] * f * n, 255];
  };
}
painters[ITEM_TILE.STICK] = iconPainter('stick', HANDLE);
painters[ITEM_TILE.IRON_INGOT] = iconPainter('ingot', TOOL_MATS[2].color);
painters[ITEM_TILE.GOLD_INGOT] = iconPainter('ingot', TOOL_MATS[3].color);
painters[ITEM_TILE.APPLE] = iconPainter('apple', [214, 36, 40]);
painters[ITEM_TILE.RAW_MEAT] = iconPainter('meat', [226, 118, 130]);
painters[ITEM_TILE.COOKED_MEAT] = iconPainter('meat', [150, 82, 44]);
painters[TILES.BED_TOP] = (x, y) => (x < 5 ? vary([232, 232, 236], h(x, y, 82), 0.05) : x === 5 || y === 0 || y === 15 ? vary([120, 20, 28], h(x, y, 83), 0.06) : vary([196, 38, 48], h(x, y, 84), 0.07));
painters[TILES.BED_SIDE] = (x, y) => (y < 8 ? vary([196, 38, 48], h(x, y, 85), 0.07) : vary([150, 110, 62], h(x, y, 86), 0.08));
const ARMOR_MATS = [[160, 100, 60], [226, 226, 232], [250, 214, 72], [92, 228, 216]]; // cuero, hierro, oro, diamante
painters[ITEM_TILE.SEEDS] = iconPainter('seeds', [150, 170, 60]);
painters[ITEM_TILE.WHEAT] = iconPainter('wheat', [226, 190, 84]);
painters[ITEM_TILE.CARROT] = iconPainter('carrot', [238, 128, 28]);
painters[ITEM_TILE.BREAD] = iconPainter('bread', [196, 140, 70]);
painters[ITEM_TILE.LEATHER] = iconPainter('leather', [150, 92, 54]);
TOOL_MATS.forEach((m, mi) => { painters[ITEM_TILE.HOE0 + mi] = iconPainter('hoe', m.color); });
ARMOR_MATS.forEach((c, mi) => ['helmet', 'chest', 'legs', 'boots'].forEach((k, pi) => { painters[ITEM_TILE.ARMOR0 + mi * 4 + pi] = iconPainter(k, c); }));
for (let st = 0; st < 4; st++) { // cultivos: 4 etapas de crecimiento (plano cruzado, fondo transparente)
  painters[TILES.WHEAT0 + st] = (x, y) => {
    if (x % 3 === 0 || h(x, 0, 110) > 0.85) return [0, 0, 0, 0];
    const ht = 3 + st * 3 + Math.floor(h(x, 1, 111) * 3);
    if (y < 16 - ht) return [0, 0, 0, 0];
    if (st === 3) return y < 16 - ht + 3 ? vary([210, 172, 62], h(x, y, 112), 0.12) : vary([186, 150, 60], h(x, y, 113), 0.1);
    return vary([70 + st * 8, 150 - st * 6, 46], h(x, y, 114), 0.15);
  };
  painters[TILES.CARROT0 + st] = (x, y) => {
    if (x % 2 === 1 && h(x, 0, 115) > 0.4) return [0, 0, 0, 0];
    const ht = 2 + st * 2 + Math.floor(h(x, 1, 116) * 3);
    if (st === 3 && y >= 13 && x >= 6 && x <= 9) return vary([238, 128, 28], h(x, y, 118), 0.1);
    if (y < 16 - ht) return [0, 0, 0, 0];
    return vary([60, 140 + st * 6, 44], h(x, y, 117), 0.15);
  };
}
painters[TILES.FARMLAND] = (x, y) => vary(y % 4 === 1 ? [62, 40, 26] : [88, 58, 38], h(x, y, 119), 0.1);
painters[TILES.CHEST_TOP] = (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? vary([92, 58, 24], h(x, y, 120), 0.1) : vary([168, 118, 56], h(x, y, 121), 0.1));
painters[TILES.CHEST_SIDE] = (x, y) => {
  if (x === 0 || x === 15 || y === 0 || y === 15) return vary([92, 58, 24], h(x, y, 122), 0.1);
  if (x >= 7 && x <= 8 && y >= 5 && y <= 8) return [210, 210, 214, 255];       // cerradura
  if (y === 5 || y === 6) return vary([110, 72, 30], h(x, y, 123), 0.1);         // línea de la tapa
  return vary([160, 110, 52], h(x, y, 124), 0.1);
};
painters[ITEM_TILE.BONE] = iconPainter('bone', [232, 232, 220]);
painters[ITEM_TILE.STRING] = iconPainter('string', [238, 238, 238]);
painters[ITEM_TILE.DIAMOND] = iconPainter('gem', TOOL_MATS[4].color);
['pickaxe', 'axe', 'shovel', 'sword'].forEach((kind, k) => {
  TOOL_MATS.forEach((m, mi) => { painters[ITEM_TILE.TOOL0 + mi * 4 + k] = iconPainter(kind, m.color); });
});


// ---- LeiaNET: pintores de respaldo (si las imágenes de la web no cargan se ven igual de bien) ----
const wool = (c) => (x, y) => vary(c, h(x >> 1, y >> 1, 80) * 0.5 + h(x, y, 81) * 0.5, 0.07);
painters[TILES.WOOL_WHITE] = wool([236, 236, 238]);
painters[TILES.WOOL_BLACK] = wool([28, 28, 32]);
painters[TILES.WOOL_PINK] = wool([240, 120, 150]);
painters[TILES.WOOL_GREEN] = wool([79, 209, 98]);
painters[TILES.WOOL_BROWN] = wool([70, 55, 46]);
painters[TILES.LEIA_L] = (x, y) => { // cuadro verde con una "L" azul marino
  const edge = x === 0 || y === 0 || x === 15 || y === 15;
  if (edge) return [190, 235, 180, 255];
  const stem = x >= 4 && x <= 7 && y >= 3 && y <= 12;
  const foot = y >= 9 && y <= 12 && x >= 4 && x <= 12;
  if (stem || foot) return x === 4 || y === 3 || y === 12 ? [20, 28, 90, 255] : [225, 228, 240, 255];
  return vary([92, 150, 78], h(x, y, 82), 0.06);
};
painters[TILES.BONE] = (x, y) => vary(h(x >> 1, y, 94) < 0.2 ? [168, 168, 160] : [214, 214, 204], h(x, y, 95), 0.07);
painters[TILES.RED] = (x, y) => vary([196, 28, 30], h(x, y, 96), 0.1);
painters[TILES.SPIDER] = (x, y) => vary(h(x >> 1, y >> 1, 97) < 0.3 ? [26, 22, 22] : [52, 44, 40], h(x, y, 98), 0.18);
painters[TILES.YELLOW] = (x, y) => vary([240, 196, 50], h(x, y, 99), 0.08);
painters[TILES.SKIN] = (x, y) => vary([198, 134, 96], h(x, y, 92), 0.06);
painters[TILES.SLEEVE] = (x, y) => vary([0, 150, 160], h(x, y, 93), 0.07);
painters[TILES.TORCH] = (x, y) => {
  if (x >= 7 && x <= 8 && y >= 6) return vary([110, 78, 42], h(x, y, 90), 0.2);
  if (x >= 6 && x <= 9 && y >= 2 && y <= 5) return (x === 6 || x === 9) && (y === 2 || y === 5) ? [0, 0, 0, 0] : y <= 3 ? [255, 230, 120, 255] : [255, 150, 40, 255];
  return [0, 0, 0, 0];
};
const furnaceSide = (on) => (x, y) => {
  if (x >= 4 && x <= 11 && y >= 6 && y <= 12) {
    if (on && y >= 9) return vary(y >= 11 ? [255, 210, 80] : [255, 130, 30], h(x, y, 91), 0.12);
    return y === 6 || x === 4 || x === 11 ? [30, 30, 32] : [14, 14, 16];
  }
  if (y >= 3 && y <= 4 && x >= 3 && x <= 12) return [60, 60, 64];
  return cobble(x, y);
};
painters[TILES.FURNACE_SIDE] = furnaceSide(false);
painters[TILES.FURNACE_ON_SIDE] = furnaceSide(true);
painters[TILES.DOG_BLACK] = (x, y) => vary([30, 30, 34], h(x, y, 83), 0.18);
painters[TILES.DOG_WHITE] = (x, y) => vary([238, 238, 240], h(x, y, 84), 0.06);
const DOG_FACE_ROWS = ['................', '..XX........XX..', '.XXXX......XXXX.', '.XXXXXXXXXXXXXX.', '.XXXXXWWWWXXXXX.', '.XXXXWWWWWWXXXX.', '.XXXXWXWWXWXXXX.', '.XXXXWWWWWWXXXX.', '..XXXWWNNWWXXX..', '..XXXWWNNWWXXX..', '...XXWWWWWWXX...', '....XWWPPWWX....', '.....WWPPWW.....', '......WWWW......', '................', '................'];
const dogFace = (x, y) => {
  const c = DOG_FACE_ROWS[y][x];
  if (c === 'X') return vary([30, 30, 34], h(x, y, 85), 0.12);
  if (c === 'W') return vary([238, 238, 240], h(x, y, 86), 0.05);
  if (c === 'N') return [10, 10, 12, 255];
  if (c === 'P') return [235, 110, 135, 255];
  return vary([30, 30, 34], h(x, y, 85), 0.12);
};
painters[TILES.DOG_FACE] = dogFace;
painters[TILES.COLLIE] = dogFace;

// Parches con imágenes reales (se registran antes de crear el renderer; ver leianet/assets.js).
const patches = new Map();
export function registerTile(tile, rgba) { patches.set(tile, rgba); }

export function generateAtlas() {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  for (let t = 0; t < ATLAS_GRID * ATLAS_GRID; t++) {
    const tx = t % ATLAS_GRID, ty = Math.floor(t / ATLAS_GRID);
    const paint = painters[t];
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        let c;
        if (paint) c = paint(x, y);
        else c = [0, 0, 0, 0]; // tile sin definir: transparente (nunca se usa; un damero magenta se colaba en los bordes de bloques vecinos)
        const i = ((ty * TILE_PX + y) * ATLAS_SIZE + tx * TILE_PX + x) * 4;
        data[i] = Math.max(0, Math.min(255, c[0]));
        data[i + 1] = Math.max(0, Math.min(255, c[1]));
        data[i + 2] = Math.max(0, Math.min(255, c[2]));
        data[i + 3] = c[3];
      }
    }
  }
  for (const [tile, rgba] of patches) {
    const tx = tile % ATLAS_GRID, ty = Math.floor(tile / ATLAS_GRID);
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const i = ((ty * TILE_PX + y) * ATLAS_SIZE + tx * TILE_PX + x) * 4, k = (y * TILE_PX + x) * 4;
        data[i] = rgba[k]; data[i + 1] = rgba[k + 1]; data[i + 2] = rgba[k + 2]; data[i + 3] = rgba[k + 3];
      }
    }
  }
  bleedTransparent(data);
  return data;
}

// Los texels transparentes (hojas, vidrio, tiles vacíos) tienen RGB = 0: al generar los mipmaps oscurecerían y
// ensuciarían los bordes. Les damos el color medio de los texels opacos de su tile.
function bleedTransparent(data) {
  for (let ty = 0; ty < ATLAS_GRID; ty++) {
    for (let tx = 0; tx < ATLAS_GRID; tx++) {
      let r = 0, g = 0, b = 0, n = 0;
      const at = (x, y) => ((ty * TILE_PX + y) * ATLAS_SIZE + tx * TILE_PX + x) * 4;
      for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
        const i = at(x, y);
        if (data[i + 3] > 0) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
      }
      if (n === 0 || n === TILE_PX * TILE_PX) continue;
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
        const i = at(x, y);
        if (data[i + 3] === 0) { data[i] = r; data[i + 1] = g; data[i + 2] = b; }
      }
    }
  }
}
