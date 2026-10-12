// Reglas de herramientas: tiempo de minado, qué suelta un bloque, daño y desgaste. Lógica pura.
import { B, TOOL, isTorch, isCrop, cropStage, cropKind } from '../blocks/blocks.js';
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
  if (isCrop(id)) return cropKind(id) === 'carrot' ? I.CARROT : cropStage(id) === 3 ? I.WHEAT : I.SEEDS;
  switch (id) {
    case B.STONE: return B.COBBLE;
    case B.GRASS: return B.DIRT;
    case B.FURNACE_ON: return B.FURNACE;
    case B.IRON: return I.IRON_INGOT;
    case B.GOLD: return I.GOLD_INGOT;
    case B.DIAMOND: return I.DIAMOND;
    case B.LEAVES: return rnd() < 0.2 ? I.STICK : rnd() < 0.07 ? I.APPLE : rnd() < 0.08 ? I.SEEDS : 0;
    case B.FARMLAND: return B.DIRT;
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

// Extras que suelta un cultivo maduro (además de dropFor): semillas del trigo, más zanahorias.
export function cropExtras(id, rnd = Math.random) {
  if (!isCrop(id) || cropStage(id) !== 3) return [];
  return cropKind(id) === 'carrot' ? [[I.CARROT, Math.floor(rnd() * 3)]] : [[I.SEEDS, 1 + Math.floor(rnd() * 2)]];
}
