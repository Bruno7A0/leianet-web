import { mulberry32 } from '../utils/random.js';

// Ruido Perlin 2D con tabla de permutaciones derivada de la seed (determinista).
const GRADS = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

export class Perlin2D {
  constructor(seed) {
    const rnd = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  _grad(h, x, y) {
    const g = GRADS[h & 7];
    return g[0] * x + g[1] * y;
  }

  // Devuelve aprox. [-1, 1]
  noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const P = this.perm;
    const aa = P[P[X] + Y], ab = P[P[X] + Y + 1];
    const ba = P[P[X + 1] + Y], bb = P[P[X + 1] + Y + 1];
    const u = fade(xf), v = fade(yf);
    return lerp(
      lerp(this._grad(aa, xf, yf), this._grad(ba, xf - 1, yf), u),
      lerp(this._grad(ab, xf, yf - 1), this._grad(bb, xf - 1, yf - 1), u),
      v
    );
  }

  // Suma de octavas, normalizada a aprox. [-1, 1]
  fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

// Ruido Perlin 3D (para cuevas). Misma idea que el 2D; devuelve aprox. [-1, 1].
const G3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];

export class Perlin3D {
  constructor(seed) {
    this.perm = new Perlin2D(seed).perm; // misma tabla de permutación barajada por la seed
  }

  _g(h, x, y, z) {
    const g = G3[h % 12];
    return g[0] * x + g[1] * y + g[2] * z;
  }

  noise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const X = xi & 255, Y = yi & 255, Z = zi & 255;
    const P = this.perm;
    const a = P[X] + Y, aa = P[a] + Z, ab = P[a + 1] + Z;
    const b = P[X + 1] + Y, ba = P[b] + Z, bb = P[b + 1] + Z;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    return lerp(
      lerp(
        lerp(this._g(P[aa], xf, yf, zf), this._g(P[ba], xf - 1, yf, zf), u),
        lerp(this._g(P[ab], xf, yf - 1, zf), this._g(P[bb], xf - 1, yf - 1, zf), u), v),
      lerp(
        lerp(this._g(P[aa + 1], xf, yf, zf - 1), this._g(P[ba + 1], xf - 1, yf, zf - 1), u),
        lerp(this._g(P[ab + 1], xf, yf - 1, zf - 1), this._g(P[bb + 1], xf - 1, yf - 1, zf - 1), u), v),
      w);
  }
}
