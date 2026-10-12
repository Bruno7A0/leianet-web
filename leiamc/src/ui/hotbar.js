// Hotbar en el DOM. Los iconos se dibujan desde el mismo atlas generado por código.
import { generateAtlas, ATLAS_SIZE, TILE_PX, ATLAS_GRID } from '../blocks/atlas.js';
import { nameOf, iconTile, maxDur } from '../items/items.js';
import { HOTBAR_SIZE } from '../inventory/inventory.js';

export class Hotbar {
  constructor(root, nameEl, inventory) {
    this.inv = inventory;
    this.nameEl = nameEl;
    this.atlas = generateAtlas();
    this.iconCache = new Map();
    this.slotEls = [];
    this.nameTimer = null;
    root.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = '<span class="key">' + (i + 1) + '</span><span class="count"></span><span class="dur"><i></i></span>';
      root.appendChild(el);
      this.slotEls.push(el);
    }
    this.refresh();
  }

  icon(id) {
    let url = this.iconCache.get(id);
    if (url) return url;
    const tile = iconTile(id);
    const tx = tile % ATLAS_GRID, ty = Math.floor(tile / ATLAS_GRID);
    const cv = document.createElement('canvas');
    cv.width = cv.height = TILE_PX;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(TILE_PX, TILE_PX);
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const s = ((ty * TILE_PX + y) * ATLAS_SIZE + tx * TILE_PX + x) * 4;
        const d = (y * TILE_PX + x) * 4;
        for (let k = 0; k < 4; k++) img.data[d + k] = this.atlas[s + k];
      }
    }
    ctx.putImageData(img, 0, 0);
    url = cv.toDataURL();
    this.iconCache.set(id, url);
    return url;
  }

  refresh() {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = this.slotEls[i], s = this.inv.slots[i];
      el.classList.toggle('selected', i === this.inv.selected);
      el.style.backgroundImage = s ? `url(${this.icon(s.id)})` : 'none';
      el.querySelector('.count').textContent = s && s.count > 1 ? s.count : '';
      const durEl = el.querySelector('.dur'), max = s ? maxDur(s.id) : 0;
      durEl.style.display = s && max && s.dur < max ? 'block' : 'none';
      if (s && max) { const f = s.dur / max; const i2 = durEl.firstChild; i2.style.width = `${f * 100}%`; i2.style.background = `hsl(${f * 120},80%,45%)`; }
    }
  }

  showName() {
    const s = this.inv.selectedStack;
    this.nameEl.textContent = s ? nameOf(s.id) : '';
    this.nameEl.style.opacity = s ? '1' : '0';
    clearTimeout(this.nameTimer);
    this.nameTimer = setTimeout(() => { this.nameEl.style.opacity = '0'; }, 1500);
  }
}
