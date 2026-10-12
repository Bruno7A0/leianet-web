// Crecimiento de cultivos: cada segundo, los de los chunks cercanos tienen una probabilidad de pasar a la etapa siguiente
// (≈ 45 s por etapa; con lluvia, más rápido). Si falta la tierra arada debajo, el cultivo se rompe. El estado es el propio id
// del bloque, así que se guarda con el mundo y no hace falta registrar nada aparte.
import { B, isCrop, cropStage } from '../blocks/blocks.js';

export class Crops {
  constructor() { this.t = 0; }
  update(dt, world, pcx, pcz, rain = 0) {
    if ((this.t += dt) < 1) return;
    const step = this.t; this.t = 0;
    const p = Math.min(1, (step / 45) * (1 + rain));
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const c = world.getChunk(pcx + dx, pcz + dz);
      if (!c || !c.crops || !c.crops.length) continue;
      for (const [x, y, z, id] of c.crops.slice()) {
        if (world.getBlock(x, y, z) !== id) continue; // la lista puede estar desactualizada
        if (world.getBlock(x, y - 1, z) !== B.FARMLAND) { world.setBlock(x, y, z, B.AIR); continue; }
        if (isCrop(id) && cropStage(id) < 3 && Math.random() < p) world.setBlock(x, y, z, id + 1);
      }
    }
  }
}
