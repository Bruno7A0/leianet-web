// Romper y colocar bloques. Lógica separada del DOM para poder testearla.
import { B, BLOCKS, wallTorchFor } from '../blocks/blocks.js';
import { CHUNK_HEIGHT } from '../world/constants.js';

// Rompe el bloque apuntado y lo manda al inventario. Devuelve true si se rompió.
// opts.drop: id que suelta (0 = nada). Sin opts, suelta el propio bloque.
export function breakBlock(world, inventory, hit, opts = {}) {
  const id = world.getBlock(hit.x, hit.y, hit.z);
  if (id === B.AIR || BLOCKS[id].hardness < 0) return false; // irrompible (agua, etc.)
  if (!world.setBlock(hit.x, hit.y, hit.z, B.AIR)) return false;
  const drop = opts.drop === undefined ? id : opts.drop;
  if (drop) inventory.add(drop, 1);
  return true;
}

// Coloca el bloque del slot seleccionado contra la cara apuntada. Devuelve true si se colocó.
export function placeBlock(world, inventory, player, hit) {
  if (!hit || (hit.nx === 0 && hit.ny === 0 && hit.nz === 0)) return false;
  const stack = inventory.selectedStack;
  if (!stack || !BLOCKS[stack.id]) return false; // los ítems (herramientas, palos…) no se colocan
  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  if (y < 0 || y >= CHUNK_HEIGHT) return false;
  const cur = world.getBlock(x, y, z);
  if (cur !== B.AIR && cur !== B.WATER) return false; // sólo sobre aire o agua
  if (BLOCKS[stack.id].solid && player.intersectsBlock(x, y, z)) return false;
  let placed = stack.id;
  if (stack.id === B.TORCH) {
    if (hit.ny < 0) return false;                                  // no se cuelga del techo
    if (hit.nx !== 0 || hit.nz !== 0) placed = wallTorchFor(hit.nx, hit.nz); // contra una pared: se inclina y se apoya
  }
  if (!world.setBlock(x, y, z, placed)) return false;
  inventory.removeFromSlot(inventory.selected, 1);
  return true;
}
