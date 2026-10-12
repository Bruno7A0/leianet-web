// Controles táctiles: joystick flotante (izquierda), mirar arrastrando (resto de la pantalla)
// y botones de romper / colocar / saltar / agacharse / inventario / pausa.
// Escribe sobre el mismo Input que usa el teclado, así el resto del juego no se entera.

export function wantsTouch(search = location.search) {
  const q = new URLSearchParams(search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
}

// Joystick: convierte un desplazamiento en píxeles a ejes -1..1 con zona muerta.
export function stickAxes(dx, dy, radius = 56, dead = 0.18) {
  let x = dx / radius, y = dy / radius;
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  const mag = Math.min(1, m);
  if (mag < dead) return { fwd: 0, strafe: 0, mag };
  return { fwd: -y, strafe: x, mag };
}

const LOOK_GAIN = 1.9;      // multiplica los píxeles arrastrados (la sensibilidad base es la del ratón)
const SPRINT_AT = 0.97;     // empujar el joystick hasta el borde = correr

export class TouchControls {
  constructor(input, { hotbarEl, onPause, onInventory }) {
    this.input = input;
    this.shown = false;
    this.crouchOn = false;
    this.stick = null;      // { id, ox, oy }
    this.look = null;       // { id, x, y }
    this.held = new Map();  // pointerId -> acción mantenida (para soltar bien al cancelar)

    const root = this.root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `
      <div class="t-look"></div>
      <div class="t-stick-zone"><div class="t-base"><div class="t-knob"></div></div></div>
      <button class="tb tb-break" data-act="break" aria-label="Romper">⛏</button>
      <button class="tb tb-place" data-act="place" aria-label="Colocar">▣</button>
      <button class="tb tb-jump" data-act="jump" aria-label="Saltar">▲</button>
      <button class="tb tb-crouch" data-act="crouch" aria-label="Agacharse">▼</button>
      <button class="tb tb-top tb-inv" data-act="inv" aria-label="Inventario">🎒</button>
      <button class="tb tb-top tb-pause" data-act="pause" aria-label="Pausa">❚❚</button>`;
    document.body.appendChild(root);
    this.q = (s) => root.querySelector(s);
    this.base = this.q('.t-base');
    this.knob = this.q('.t-knob');
    this.cb = { onPause, onInventory };

    document.body.classList.add('touch');
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---- mirar ----
    const lookEl = this.q('.t-look');
    lookEl.addEventListener('pointerdown', (e) => {
      if (this.look) return;
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      lookEl.setPointerCapture(e.pointerId);
    });
    lookEl.addEventListener('pointermove', (e) => {
      if (!this.look || e.pointerId !== this.look.id) return;
      this.input.mdx += (e.clientX - this.look.x) * LOOK_GAIN;
      this.input.mdy += (e.clientY - this.look.y) * LOOK_GAIN;
      this.look.x = e.clientX; this.look.y = e.clientY;
    });
    const endLook = (e) => { if (this.look && e.pointerId === this.look.id) this.look = null; };
    lookEl.addEventListener('pointerup', endLook);
    lookEl.addEventListener('pointercancel', endLook);

    // ---- joystick flotante ----
    const zone = this.q('.t-stick-zone');
    zone.addEventListener('pointerdown', (e) => {
      if (this.stick) return;
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      this.base.style.left = `${e.clientX - r.left}px`;
      this.base.style.top = `${e.clientY - r.top}px`;
      this.base.classList.add('on');
      this._stickMove(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
      if (this.stick && e.pointerId === this.stick.id) this._stickMove(e.clientX, e.clientY);
    });
    const endStick = (e) => {
      if (!this.stick || e.pointerId !== this.stick.id) return;
      this._stickEnd();
    };
    zone.addEventListener('pointerup', endStick);
    zone.addEventListener('pointercancel', endStick);

    // ---- botones ----
    for (const b of root.querySelectorAll('.tb')) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.held.set(e.pointerId, b.dataset.act);
        b.classList.add('down');
        this._press(b.dataset.act, true, b);
      });
      const up = (e) => {
        const act = this.held.get(e.pointerId);
        if (!act) return;
        this.held.delete(e.pointerId);
        b.classList.remove('down');
        this._press(act, false, b);
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    }

    // ---- hotbar: tocar una ranura la elige ----
    if (hotbarEl) {
      hotbarEl.style.pointerEvents = 'auto';
      [...hotbarEl.children].forEach((el, i) => {
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.input.hotbarPress = i; });
      });
    }
  }

  _stickMove(x, y) {
    const s = this.stick;
    const dx = x - s.ox, dy = y - s.oy;
    const a = stickAxes(dx, dy);
    this.input.analog = { fwd: a.fwd, strafe: a.strafe };
    const m = Math.hypot(dx, dy) || 1, k = Math.min(1, 56 / m);
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    this.input.sprintLatch = a.fwd > 0.5 && a.mag >= SPRINT_AT;
  }

  _stickEnd() {
    this.stick = null;
    this.input.analog = null;
    this.input.sprintLatch = false;
    this.base.classList.remove('on');
    this.knob.style.transform = '';
  }

  _press(act, down, el) {
    const inp = this.input;
    switch (act) {
      case 'break':
        if (down) { inp.mouse.add(0); inp.click[0] = true; } else inp.mouse.delete(0);
        break;
      case 'place':
        if (down) { inp.mouse.add(2); inp.click[2] = true; } else inp.mouse.delete(2);
        break;
      case 'jump':
        if (down) {
          const now = performance.now();
          if (now - inp.lastSpace < 280) inp.flyToggle = true; // doble toque = volar (creativo)
          inp.lastSpace = now;
          inp.keys.add('Space');
        } else inp.keys.delete('Space');
        break;
      case 'crouch':
        if (down) {
          this.crouchOn = !this.crouchOn;
          if (this.crouchOn) inp.keys.add('ShiftLeft'); else inp.keys.delete('ShiftLeft');
          el.classList.toggle('active', this.crouchOn);
        }
        break;
      case 'inv': if (down) this.cb.onInventory(); break;
      case 'pause': if (down) this.cb.onPause(); break;
    }
  }

  // Muestra u oculta los controles. Al ocultarlos se suelta todo (nada queda "apretado").
  show(v) {
    this.shown = v;
    this.root.style.display = v ? 'block' : 'none';
    if (!v) {
      this.look = null;
      this._stickEnd();
      this.held.clear();
      this.crouchOn = false;
      this.q('.tb-crouch').classList.remove('active');
      for (const b of this.root.querySelectorAll('.tb.down')) b.classList.remove('down');
    }
  }
}
