// Reglas de herramientas: tiempo de minado, qué suelta un bloque, daño y desgaste. Lógica pura.
import { B, TOOL, isTorch } from '../blocks/blocks.js';
import { I, toolOf } from '../items/items.js';

// stack: el ítem en mano (o null). Devuelve { time (s), canHarvest }.
export function mineInfo(def, stack) {
  const t = stack ? toolOf(stack.id) : null;
  const matches = !!t && def.tool !== TOOL.NONE && t.type === def.tool;
  const canHarvest = def.harvest === undefined || (matches && t.tier >= def.harvest);
  let time = def.hardness;
  if (def.tool !== TOOL.NONE) time = matches ? def.hardness / t.speed : def.hardness * 2.5;
  if (!canHarvest) time *= 2;
  return { time: Math.max(0.05, time), canHarvest };
}

// Qué ítem suelta un bloque (0 = nada).
export function dropFor(id, canHarvest, rnd = Math.random) {
  if (!canHarvest || id === B.TNT_FLASH) return 0;
  if (isTorch(id)) return B.TORCH; // las antorchas de pared sueltan la antorcha común
  switch (id) {
    case B.STONE: return B.COBBLE;
    case B.GRASS: return B.DIRT;
    case B.FURNACE_ON: return B.FURNACE;
    case B.IRON: return I.IRON_INGOT;
    case B.GOLD: return I.GOLD_INGOT;
    case B.DIAMOND: return I.DIAMOND;
    case B.LEAVES: return rnd() < 0.2 ? I.STICK : rnd() < 0.07 ? I.APPLE : 0;
    default: return id;
  }
}

export function attackDamage(stack) {
  const t = stack ? toolOf(stack.id) : null;
  return t ? t.dmg : 2;
}

// Resta durabilidad al slot. Devuelve true si la herramienta se rompió (el slot queda en null).
export function wear(slots, i, amount = 1) {
  const s = slots[i];
  if (!s || !toolOf(s.id)) return false;
  s.dur -= amount;
  if (s.dur <= 0) { slots[i] = null; return true; }
  return false;
}
