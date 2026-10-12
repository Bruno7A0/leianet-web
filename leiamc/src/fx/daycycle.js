// Ciclo día/noche. t en [0,1): 0 = amanecer, 0.25 = mediodía, 0.5 = atardecer, 0.75 = medianoche.
const DAY = [0.53, 0.74, 0.95], NIGHT = [0.015, 0.025, 0.07], DUSK = [0.95, 0.52, 0.28];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

export const DAY_LENGTH = 600; // segundos por ciclo completo

export function skyState(t) {
  const a = t * Math.PI * 2;
  const h = Math.sin(a); // altura del sol
  const day = smooth((h + 0.12) / 0.38);
  let sky = mix(NIGHT, DAY, day);
  const dusk = Math.max(0, 1 - Math.abs(h) / 0.22) * 0.65;
  sky = mix(sky, DUSK, dusk);
  const d = [Math.cos(a), Math.sin(a), 0.25];
  const n = Math.hypot(d[0], d[1], d[2]);
  return {
    sky,
    light: 0.24 + 0.76 * day,
    sunDir: [d[0] / n, d[1] / n, d[2] / n],
    sunAngle: a,
    stars: clamp01(1 - day * 1.6),
    night: h < -0.05,
    height: h,
  };
}

export function timeLabel(t) {
  const hours = ((t * 24 + 6) % 24); // t=0 -> 06:00
  const hh = Math.floor(hours), mm = Math.floor((hours - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
