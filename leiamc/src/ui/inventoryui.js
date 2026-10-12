// Inventario completo + fabricación (2x2 en el inventario, 3x3 en la mesa). Arrastre estilo Minecraft:
// clic izq. toma/coloca todo · clic der. toma la mitad / coloca uno · Shift+clic mueve entre hotbar e inventario.
import { CREATIVE_LIST } from '../blocks/blocks.js';
import { ALL_ITEMS, stackMax, maxDur, nameOf } from '../items/items.js';
import { findRecipe } from '../inventory/recipes.js';
import { SMELT, FUEL, COOK_TIME } from '../world/furnace.js';
const FKEY = { fin: 'inp', ffuel: 'fuel', fout: 'out' };

const newStack = (id, count) => { const s = { id, count }; const d = maxDur(id); if (d) s.dur = d; return s; };

export class InventoryUI {
  constructor(root, hotbar, inventory, isCreative) {
    this.root = root; this.hotbar = hotbar; this.inv = inventory; this.isCreative = isCreative;
    this.cursor = null; this.grid = []; this.size = 2; this.result = null;
    this.onSound = null; // (nombre) => reproduce un sonido de interfaz (lo pone main)
    this.half = false; // touch: el próximo toque actúa como clic derecho (tomar la mitad / colocar uno)
    root.innerHTML = `
      <div class="invwrap">
        <div class="invpanel main">
          <div class="invhead"><span class="invtitle"></span><span class="invsub"></span></div>
          <div class="craftbox invfurn" style="display:none">
            <div class="fcol"><div class="slotcol"><div class="fin-w"></div><div class="lab">Material</div></div><div class="flame"><i></i></div><div class="slotcol"><div class="ffuel-w"></div><div class="lab">Combustible</div></div></div>
            <div class="parr"><i></i></div>
            <div class="slotcol"><div class="fout-w"></div><div class="lab">Resultado</div></div>
          </div>
          <div class="craftbox invcraft"><div class="cgrid"></div><div class="arrow"></div><div class="slotcol"><div class="islot out"></div><div class="lab">Resultado</div></div></div>
          <div class="secl">Inventario</div>
          <div class="invmain"></div>
          <div class="secl">Barra rápida</div>
          <div class="invhot"></div>
          <div class="invhelp"><span><kbd>Clic izq.</kbd> tomar</span><span><kbd>Clic der.</kbd> mitad / uno</span><span><kbd>Shift</kbd>+clic mover</span><span><kbd>1</kbd>–<kbd>9</kbd> pasar a la barra</span><span><kbd>Esc</kbd> cerrar</span></div>
        </div>
        <div class="invpanel palette">
          <div class="invhead"><span class="invtitle">Creativo</span><span class="invsub pcount"></span></div>
          <input class="psearch" type="text" placeholder="Buscar bloque o ítem…" spellcheck="false" autocomplete="off">
          <div class="pgrid"></div>
          <div class="pfoot"><span>Clic: tomar un stack</span><div class="islot trash" title="Papelera: soltá acá lo que lleves"><span>&#128465;</span></div></div>
        </div>
      </div>
      <div class="cursor"><span class="count"></span><span class="dur"><i></i></span></div>
      <div class="tip"><b></b><span></span></div>`;
    this.q = (sel) => root.querySelector(sel);
    this.cursorEl = this.q('.cursor');
    this.outEl = this.q('.out');
    this.tipEl = this.q('.tip');
    this.hover = null; // { kind, i } casilla bajo el ratón
    this.mk = (parent, kind, i) => {
      const el = document.createElement('div');
      el.className = 'islot';
      el.innerHTML = '<span class="count"></span><span class="dur"><i></i></span>';
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.click(kind, i, this.btn(e), e.shiftKey); });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('mouseenter', () => { this.hover = { kind, i }; this._tip(kind === 'out' ? null : this._get(kind, i), el); });
      el.addEventListener('mouseleave', () => { if (this.hover && this.hover.kind === kind && this.hover.i === i) this.hover = null; this._tip(null); });
      parent.appendChild(el);
      return el;
    };
    this.invEls = [];
    for (let i = 9; i < 36; i++) this.invEls[i] = this.mk(this.q('.invmain'), 'inv', i);
    for (let i = 0; i < 9; i++) this.invEls[i] = this.mk(this.q('.invhot'), 'inv', i);
    this.outEl.addEventListener('mousedown', (e) => { e.preventDefault(); this.click('out', 0, this.btn(e), e.shiftKey); });
    this.outEl.addEventListener('mouseenter', () => this._tip(this.result ? { id: this.result.id, count: this.result.count } : null, this.outEl));
    this.outEl.addEventListener('mouseleave', () => this._tip(null));
    this.gridEls = [];
    this.furnace = null;
    this.fEls = { fin: this.mk(this.q('.fin-w'), 'fin', 0), ffuel: this.mk(this.q('.ffuel-w'), 'ffuel', 0), fout: this.mk(this.q('.fout-w'), 'fout', 0) };
    this.fEls.fout.classList.add('out');
    // Paleta creativa (con buscador)
    const pg = this.q('.pgrid');
    this.pal = [];
    for (const id of [...CREATIVE_LIST, ...ALL_ITEMS]) {
      const el = document.createElement('div');
      el.className = 'islot';
      el.style.backgroundImage = `url(${hotbar.icon(id)})`;
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.cursor = newStack(id, stackMax(id)); this.render(); });
      el.addEventListener('mouseenter', () => this._tip({ id, count: 1 }, el));
      el.addEventListener('mouseleave', () => this._tip(null));
      pg.appendChild(el);
      this.pal.push({ id, el, name: nameOf(id).toLowerCase() });
    }
    this.q('.pcount').textContent = `${this.pal.length} ítems`;
    const search = this.q('.psearch');
    search.addEventListener('input', () => {
      const t = search.value.trim().toLowerCase();
      for (const p of this.pal) p.el.style.display = !t || p.name.includes(t) ? '' : 'none';
    });
    search.addEventListener('keydown', (e) => { if (e.code === 'Escape') search.blur(); e.stopPropagation(); }); // escribir no dispara atajos del juego
    this.q('.trash').addEventListener('mousedown', (e) => { e.preventDefault(); this.cursor = null; this.render(); });
    root.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; this._place(); });
    // Con el ratón sobre una casilla del inventario, 1-9 la intercambia con esa casilla de la barra rápida.
    window.addEventListener('keydown', (e) => {
      if (root.style.display !== 'flex' || !this.hover || this.hover.kind !== 'inv' || document.activeElement === search) return;
      const m = /^Digit([1-9])$/.exec(e.code);
      if (!m) return;
      const j = Number(m[1]) - 1, i = this.hover.i;
      if (i === j) return;
      const t = this.inv.slots[j]; this.inv.slots[j] = this.inv.slots[i]; this.inv.slots[i] = t;
      if (this.onSound) this.onSound('click');
      this.render(); this._tip(this._get('inv', i), this.invEls[i]);
    });
  }

  btn(e) { return this.half && e.button === 0 ? 2 : e.button; }

  _place() {
    this.cursorEl.style.transform = `translate(${(this.mx || 0) - 22}px, ${(this.my || 0) - 22}px)`;
    if (this.tipEl.style.display === 'block') this.tipEl.style.transform = `translate(${(this.mx || 0) + 16}px, ${(this.my || 0) - 34}px)`;
  }

  // Cartel con el nombre (y la durabilidad) de lo que hay bajo el ratón.
  _tip(s, el) {
    if (!s || this.cursor) { this.tipEl.style.display = 'none'; return; }
    const max = maxDur(s.id);
    this.tipEl.firstChild.textContent = nameOf(s.id);
    this.tipEl.lastChild.textContent = max ? `Durabilidad ${s.dur ?? max} / ${max}` : (s.count > 1 ? `Cantidad ${s.count}` : '');
    this.tipEl.lastChild.style.display = this.tipEl.lastChild.textContent ? 'block' : 'none';
    this.tipEl.style.display = 'block';
    this._place();
  }

  open(mode, furnace = null) {
    this.furnace = mode === 'furnace' ? furnace : null;
    this.q('.invfurn').style.display = this.furnace ? 'flex' : 'none';
    this.q('.invcraft').style.display = this.furnace ? 'none' : 'flex';
    this.size = mode === 'table' ? 3 : 2;
    this.grid = new Array(this.size * this.size).fill(null);
    this.q('.main .invtitle').textContent = mode === 'table' ? 'Mesa de crafteo' : mode === 'furnace' ? 'Horno' : 'Inventario';
    this.q('.main .invsub').textContent = mode === 'table' ? 'grilla 3×3' : mode === 'furnace' ? 'fundí minerales' : 'fabricación 2×2';
    this.hover = null; this._tip(null);
    const search = this.q('.psearch'); search.value = ''; search.dispatchEvent(new Event('input'));
    const g = this.q('.cgrid');
    g.innerHTML = ''; g.style.gridTemplateColumns = `repeat(${this.size}, var(--s))`;
    this.gridEls = [];
    for (let i = 0; i < this.size * this.size; i++) this.gridEls[i] = this.mk(g, 'grid', i);
    this.q('.palette').style.display = this.isCreative() ? 'flex' : 'none';
    this.cursor = null;
    this.render();
  }

  _giveBack(s) {
    if (!s) return;
    if (maxDur(s.id)) { const i = this.inv.slots.findIndex((x) => !x); if (i >= 0) this.inv.slots[i] = s; return; }
    this.inv.add(s.id, s.count);
  }

  close() {
    this.grid.forEach((s) => this._giveBack(s));
    this._giveBack(this.cursor);
    this.grid = []; this.cursor = null; this.furnace = null;
    this.hotbar.refresh();
  }

  _get(kind, i) { return kind === 'inv' ? this.inv.slots[i] : FKEY[kind] ? this.furnace[FKEY[kind]] : this.grid[i]; }
  _set(kind, i, v) { if (kind === 'inv') this.inv.slots[i] = v; else if (FKEY[kind]) this.furnace[FKEY[kind]] = v; else this.grid[i] = v; }

  click(kind, i, button, shift) {
    if (kind === 'out') return this._takeResult();
    if (this.onSound) this.onSound('click');
    const slot = this._get(kind, i), cur = this.cursor;
    if (kind === 'fout') { // la salida del horno: sólo se retira
      if (slot && (!cur || (cur.id === slot.id && cur.count < stackMax(cur.id)))) {
        if (shift) this._quickMove(kind, i);
        else if (!cur) { this.cursor = slot; this.furnace.out = null; }
        else { const n = Math.min(stackMax(cur.id) - cur.count, slot.count); cur.count += n; slot.count -= n; if (slot.count <= 0) this.furnace.out = null; }
      }
      return this.render();
    }
    if (cur && kind === 'fin' && !SMELT.has(cur.id)) return;
    if (cur && kind === 'ffuel' && !FUEL.has(cur.id)) return;
    if (button === 0) {
      if (shift && slot) { this._quickMove(kind, i); }
      else if (!cur) { if (slot) { this.cursor = slot; this._set(kind, i, null); } }
      else if (!slot) { this._set(kind, i, cur); this.cursor = null; }
      else if (slot.id === cur.id && !maxDur(slot.id) && slot.count < stackMax(slot.id)) {
        const n = Math.min(stackMax(slot.id) - slot.count, cur.count);
        slot.count += n; cur.count -= n; if (cur.count <= 0) this.cursor = null;
      } else { this._set(kind, i, cur); this.cursor = slot; }
    } else if (button === 2) {
      if (!cur) {
        if (slot) {
          const take = Math.ceil(slot.count / 2);
          this.cursor = { ...slot, count: take }; slot.count -= take;
          if (slot.count <= 0) this._set(kind, i, null);
        }
      } else if (!slot) {
        this._set(kind, i, { ...cur, count: 1 }); cur.count--; if (cur.count <= 0) this.cursor = null;
      } else if (slot.id === cur.id && !maxDur(slot.id) && slot.count < stackMax(slot.id)) {
        slot.count++; cur.count--; if (cur.count <= 0) this.cursor = null;
      }
    }
    this.render();
  }

  // Mueve un stack entre la hotbar (0-8) y el inventario (9-35); desde la grilla, al inventario.
  _quickMove(kind, i) {
    const s = this._get(kind, i);
    if (this.furnace && kind === 'inv') { // Shift+clic con el horno abierto: material → entrada, combustible → combustible
      const dst = SMELT.has(s.id) ? 'inp' : FUEL.has(s.id) ? 'fuel' : null;
      if (dst) {
        const t = this.furnace[dst];
        if (!t) { this.furnace[dst] = { id: s.id, count: s.count }; this.inv.slots[i] = null; return; }
        if (t.id === s.id) { const n = Math.min(stackMax(s.id) - t.count, s.count); t.count += n; s.count -= n; if (s.count <= 0) this.inv.slots[i] = null; return; }
      }
    }
    const range = kind !== 'inv' ? [9, 36] : i < 9 ? [9, 36] : [0, 9];
    if (!maxDur(s.id)) {
      for (let k = range[0]; k < range[1] && s.count > 0; k++) {
        const t = this.inv.slots[k];
        if (t && t.id === s.id && t.count < stackMax(s.id)) { const n = Math.min(stackMax(s.id) - t.count, s.count); t.count += n; s.count -= n; }
      }
    }
    for (let k = range[0]; k < range[1] && s.count > 0; k++) {
      if (!this.inv.slots[k]) { this.inv.slots[k] = { ...s }; s.count = 0; }
    }
    if (s.count <= 0) this._set(kind, i, null);
  }

  _takeResult() {
    const r = this.result, cur = this.cursor;
    if (!r) return;
    if (cur && (cur.id !== r.id || maxDur(r.id) || cur.count + r.count > stackMax(r.id))) return;
    if (this.onSound) this.onSound('craft');
    this.cursor = cur ? { ...cur, count: cur.count + r.count } : newStack(r.id, r.count);
    this.grid = this.grid.map((s) => { if (!s) return null; s.count--; return s.count > 0 ? s : null; });
    this.render();
  }

  _paint(el, s) {
    el.style.backgroundImage = s ? `url(${this.hotbar.icon(s.id)})` : 'none';
    const c = el.querySelector('.count'); if (c) c.textContent = s && s.count > 1 ? s.count : '';
    const d = el.querySelector('.dur'), max = s ? maxDur(s.id) : 0;
    if (d) {
      d.style.display = s && max && s.dur < max ? 'block' : 'none';
      if (s && max) { const f = s.dur / max; d.firstChild.style.width = `${f * 100}%`; d.firstChild.style.background = `hsl(${f * 120},80%,45%)`; }
    }
  }

  // Se llama cada cuadro con el horno abierto: refleja el fuego y el avance de la fundición.
  tick() {
    const f = this.furnace;
    if (!f) return;
    for (const k of Object.keys(FKEY)) this._paint(this.fEls[k], f[FKEY[k]]);
    this.q('.flame i').style.height = `${f.burn > 0 ? Math.max(0, Math.min(1, f.burn / f.burnMax)) * 100 : 0}%`;
    this.q('.parr i').style.width = `${Math.min(1, f.cook / COOK_TIME) * 100}%`;
    this.fEls.fout.classList.toggle('has', !!f.out);
  }

  render() {
    this.tick();
    for (let i = 0; i < 36; i++) this._paint(this.invEls[i], this.inv.slots[i]);
    this.gridEls.forEach((el, i) => this._paint(el, this.grid[i]));
    this.result = findRecipe(this.grid.map((s) => (s ? s.id : 0)), this.size);
    this._paint(this.outEl, this.result ? { id: this.result.id, count: this.result.count, dur: maxDur(this.result.id) } : null);
    for (let i = 0; i < 9; i++) this.invEls[i].classList.toggle('sel', i === this.inv.selected);
    this.outEl.classList.toggle('has', !!this.result);
    this.q('.arrow').classList.toggle('ready', !!this.result);
    this._paint(this.cursorEl, this.cursor);
    if (this.cursor) this._tip(null);
    this.cursorEl.style.display = this.cursor ? 'block' : 'none';
    this._place();
    this.hotbar.refresh();
  }
}
