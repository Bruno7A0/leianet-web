// Explosiones: vacían una esfera irregular de bloques. Lógica pura (sin DOM) para poder testearla.
import { B, BLOCKS } from '../blocks/blocks.js';
import { hash3 } from '../utils/random.js';

// Devuelve { removed: [{x,y,z,id}], tnt: [{x,y,z}] }. Los TNT dentro del radio no se destruyen: se encienden.
export function explode(world, cx, cy, cz, radius, seed = 1) {
  const removed = [], tnt = [];
  const r = Math.ceil(radius) + 1;
  const x0 = Math.floor(cx), y0 = Math.floor(cy), z0 = Math.floor(cz);
  for (let dy = -r; dy <= r; dy++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = x0 + dx, y = y0 + dy, z = z0 + dz;
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz);
        const jitter = 0.75 + hash3(seed, x, y, z) * 0.5; // borde irregular
        if (dist > radius * jitter) continue;
        const id = world.getBlock(x, y, z);
        if (id === B.AIR || id === B.WATER) continue;
        if (id === B.TNT) { tnt.push({ x, y, z }); continue; }
        if (BLOCKS[id].hardness < 0) continue; // bedrock, TNT encendido
        if (id === B.OBSIDIAN && dist > radius * 0.5) continue; // la obsidiana resiste
        world.setBlock(x, y, z, B.AIR);
        removed.push({ x, y, z, id });
      }
    }
  }
  return { removed, tnt };
}

// Daño a una entidad a `dist` bloques del centro (0 si está fuera del doble del radio).
export function blastDamage(dist, radius, max = 16) {
  const reach = radius * 2;
  if (dist >= reach) return 0;
  return Math.round(max * (1 - dist / reach) ** 1.3);
}
