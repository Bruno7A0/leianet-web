// Modo de rendimiento: 3 niveles + automático. Sólo baja solo (nunca sube) para no oscilar;
// subir es decisión del jugador desde el menú de pausa.
export const TIERS = [
  { key: 'high', name: 'Alto',  msaa: 4, dpr: 2,   dist: 8, particles: 1 },
  { key: 'mid',  name: 'Medio', msaa: 2, dpr: 1.5, dist: 6, particles: 0.6 },
  { key: 'low',  name: 'Bajo',  msaa: 0, dpr: 1,   dist: 4, particles: 0.3 },
];

const NAMES = { high: 0, alto: 0, mid: 1, medium: 1, medio: 1, low: 2, bajo: 2 };

// Elige el nivel inicial. Prioridad: ?perf= (la web puede pedir "low") > preferencia guardada > detección del equipo.
// Devuelve { auto, tier }: auto = el gobernador de FPS puede bajar el nivel.
export function pickTier({ param = null, stored = null, touch = false, cores = 8, memory = 8 } = {}) {
  const p = (param || '').toLowerCase();
  if (p in NAMES) return { auto: false, tier: NAMES[p] };
  const s = (stored || '').toLowerCase();
  if (s in NAMES) return { auto: false, tier: NAMES[s] };
  const weak = touch || cores <= 4 || memory <= 4;
  return { auto: true, tier: weak ? 1 : 0 };
}

// Mide FPS promedio en ventanas de `windowSec` segundos de juego activo; devuelve true cuando conviene bajar.
// Ignora los primeros `grace` segundos tras cada cambio (las mallas y el JIT todavía están calentando).
export class FpsGovernor {
  constructor({ threshold = 28, windowSec = 3, grace = 4, strikes = 2 } = {}) {
    this.threshold = threshold; this.windowSec = windowSec; this.grace = grace; this.strikes = strikes;
    this.reset();
  }

  reset() { this.t = 0; this.frames = 0; this.skip = this.grace; this.bad = 0; }

  // `rawDt` en segundos (sin recortar). `active`: sólo cuenta si se está jugando de verdad.
  update(rawDt, active) {
    if (!active || rawDt <= 0 || rawDt > 0.5) return false; // pausa, cambio de pestaña, etc.
    if (this.skip > 0) { this.skip -= rawDt; return false; }
    this.t += rawDt; this.frames++;
    if (this.t < this.windowSec) return false;
    const fps = this.frames / this.t;
    this.t = 0; this.frames = 0;
    this.bad = fps < this.threshold ? this.bad + 1 : 0;
    if (this.bad >= this.strikes) { this.reset(); return true; }
    return false;
  }
}

// ¿La web que contiene el juego está en su modo de bajo rendimiento? Se prueba con clases/atributos comunes
// en <html> y <body>; la página puede indicar los suyos con VoxeliaEgg.init({ lowPerf: ... }).
export const DEFAULT_LOW_CLASSES = ['low-perf', 'lowperf', 'low-performance', 'perf-low', 'low-power'];
export function siteIsLowPerf(doc, classes = DEFAULT_LOW_CLASSES) {
  try {
    for (const el of [doc.documentElement, doc.body]) {
      if (!el) continue;
      if (classes.some((c) => el.classList.contains(c))) return true;
      const d = (el.dataset && (el.dataset.perf || el.dataset.performance)) || '';
      if (String(d).toLowerCase() === 'low') return true;
    }
  } catch { /* documento de otro origen */ }
  return false;
}
