// Utilidades de azar determinista (la misma seed produce siempre el mismo resultado).

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Acepta número ("12345") o texto libre ("mi mundo").
export function parseSeed(input) {
  const s = String(input ?? '').trim();
  if (s === '') return hashString('voxelia');
  if (/^-?\d+$/.test(s)) return (parseInt(s, 10) | 0) >>> 0;
  return hashString(s);
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash entero 3D -> [0,1)
export function hash3(seed, x, y, z) {
  let h = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
