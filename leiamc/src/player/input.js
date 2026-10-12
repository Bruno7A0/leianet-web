// Entrada de teclado y ratón (Pointer Lock). Sólo se usa en el navegador.
export class Input {
  constructor(canvas, onLockChange) {
    this.canvas = canvas;
    this.keys = new Set();
    this.locked = false;
    this.sprintLatch = false;
    this.lastW = -1e9;
    this.mdx = 0;
    this.mdy = 0;
    this.onLockChange = onLockChange || (() => {});
    this.touchMode = false; // en celulares/tablets no hay Pointer Lock: "locked" lo maneja lock()/unlock()
    this.analog = null;     // { fwd, strafe } del joystick virtual (-1..1)

    document.addEventListener('pointerlockchange', () => {
      if (this.touchMode) return;
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.keys.clear(); this.mouse.clear(); this.sprintLatch = false; }
      this.onLockChange(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || this.touchMode) return;
      this.mdx += e.movementX;
      this.mdy += e.movementY;
    });
    // Botones del ratón: `mouse` = mantenidos; `click` = pulsados desde el último frame.
    this.mouse = new Set();
    this.click = { 0: false, 2: false };
    this.wheel = 0;
    this.hotbarPress = -1;
    this.lastSpace = -1e9;
    this.flyToggle = false;
    this.pick = false;
    document.addEventListener('mousedown', (e) => {
      if (!this.locked || this.touchMode) return; // en touch los clics sintéticos del navegador se ignoran
      e.preventDefault();
      this.mouse.add(e.button);
      if (e.button === 0 || e.button === 2) this.click[e.button] = true;
      if (e.button === 1) this.pick = true;
    });
    document.addEventListener('mouseup', (e) => this.mouse.delete(e.button));
    document.addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });
    document.addEventListener('wheel', (e) => {
      if (!this.locked || this.touchMode) return;
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (!this.locked) return;
      if (/^Digit[1-9]$/.test(e.code)) this.hotbarPress = Number(e.code[5]) - 1;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Space') {
        const now = performance.now();
        if (now - this.lastSpace < 280) this.flyToggle = true; // doble espacio = volar (modo creativo)
        this.lastSpace = now;
      }
      if (e.code === 'KeyW') {
        const now = performance.now();
        if (now - this.lastW < 300) this.sprintLatch = true; // doble toque en W = sprint
        this.lastW = now;
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyW') this.sprintLatch = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.sprintLatch = false; });
  }

  enableTouch() { this.touchMode = true; }

  _setLocked(v) {
    if (this.locked === v) return;
    this.locked = v;
    if (!v) { this.keys.clear(); this.mouse.clear(); this.sprintLatch = false; this.analog = null; }
    this.onLockChange(v);
  }

  unlock() {
    if (this.touchMode) this._setLocked(false);
    else if (document.pointerLockElement) document.exitPointerLock();
  }

  lock() {
    if (this.touchMode) { this._setLocked(true); return; }
    const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => this.canvas.requestPointerLock());
  }

  down(code) { return this.keys.has(code); }
  get jump() { return this.keys.has('Space'); }
  get crouch() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }

  axes() {
    if (this.analog) return this.analog;
    return {
      fwd: (this.down('KeyW') ? 1 : 0) - (this.down('KeyS') ? 1 : 0),
      strafe: (this.down('KeyD') ? 1 : 0) - (this.down('KeyA') ? 1 : 0),
    };
  }

  // Devuelve y reinicia las acciones puntuales del frame.
  consumeActions() {
    const a = { click: { ...this.click }, wheel: this.wheel, hotbar: this.hotbarPress, fly: this.flyToggle, pick: this.pick };
    this.flyToggle = false; this.pick = false;
    this.click[0] = this.click[2] = false;
    this.wheel = 0;
    this.hotbarPress = -1;
    return a;
  }

  consumeMouse() {
    const r = [this.mdx, this.mdy];
    this.mdx = 0; this.mdy = 0;
    return r;
  }
}
