// Raycast sobre vóxeles (Amanatides & Woo). Devuelve el primer bloque apuntable
// (cualquier bloque salvo aire y agua) y la normal de la cara por la que entró el rayo.
import { B } from '../blocks/blocks.js';

export function raycast(world, origin, dir, maxDist) {
  let x = Math.floor(origin[0]), y = Math.floor(origin[1]), z = Math.floor(origin[2]);
  const stepX = dir[0] > 0 ? 1 : -1, stepY = dir[1] > 0 ? 1 : -1, stepZ = dir[2] > 0 ? 1 : -1;
  const tDeltaX = dir[0] !== 0 ? Math.abs(1 / dir[0]) : Infinity;
  const tDeltaY = dir[1] !== 0 ? Math.abs(1 / dir[1]) : Infinity;
  const tDeltaZ = dir[2] !== 0 ? Math.abs(1 / dir[2]) : Infinity;
  let tMaxX = dir[0] > 0 ? (x + 1 - origin[0]) * tDeltaX : dir[0] < 0 ? (origin[0] - x) * tDeltaX : Infinity;
  let tMaxY = dir[1] > 0 ? (y + 1 - origin[1]) * tDeltaY : dir[1] < 0 ? (origin[1] - y) * tDeltaY : Infinity;
  let tMaxZ = dir[2] > 0 ? (z + 1 - origin[2]) * tDeltaZ : dir[2] < 0 ? (origin[2] - z) * tDeltaZ : Infinity;
  let t = 0, nx = 0, ny = 0, nz = 0;

  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id !== B.AIR && id !== B.WATER) return { x, y, z, nx, ny, nz, id, dist: t };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}
