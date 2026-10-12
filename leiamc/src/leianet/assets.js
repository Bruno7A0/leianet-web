// Materiales de la web de LeiaNET (logo, mascota, música). Todo es opcional: si no se encuentran
// (por ejemplo al abrir el juego suelto, fuera del sitio) el juego usa sus texturas procedurales.
import { registerTile, TILES } from '../blocks/atlas.js';

const params = new URLSearchParams(location.search);
// Por defecto el juego vive en /voxelia/ (carpeta; el nombre visible es The Network) y los assets de la web en /assets/.
export const ASSET_BASE = params.get('assets') ?? 'assets/';
export const assetURL = (name) => ASSET_BASE + name;

function loadImage(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = assetURL(name);
  });
}

// Reduce un recorte de la imagen a w x h píxeles promediando por pasos (se ve mejor que un solo drawImage).
function shrink(img, sx, sy, sw, sh, w, h, bg = null) {
  let src = document.createElement('canvas');
  src.width = sw; src.height = sh;
  let ctx = src.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, sw, sh); }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  while (src.width > w * 2 || src.height > h * 2) {
    const n = document.createElement('canvas');
    n.width = Math.max(w, src.width >> 1); n.height = Math.max(h, src.height >> 1);
    const c = n.getContext('2d'); c.imageSmoothingQuality = 'high';
    c.drawImage(src, 0, 0, n.width, n.height);
    src = n;
  }
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const c = out.getContext('2d'); c.imageSmoothingQuality = 'high';
  c.drawImage(src, 0, 0, w, h);
  return c.getImageData(0, 0, w, h).data;
}

export const leia = {
  ok: false,
  face: null,      // favicon del collie (Image)
  musicURL: assetURL('musica.mp3'),
  dogRun: [assetURL('dog_run1.png'), assetURL('dog_run2.png')],
  dogSad: assetURL('dog_sad.png'),
};

// Carga las imágenes y registra los tiles parcheados. Nunca rechaza: como mucho espera `timeoutMs`.
export async function loadLeiaAssets(timeoutMs = 3500) {
  const work = (async () => {
    const [logo, face] = await Promise.all([loadImage('logo_leianet_star_color.webp'), loadImage('favicon.png')]);
    if (logo) {
      // El logo trae un borde claro redondeado: lo recortamos un poco para que llene la cara del bloque.
      const m = Math.round(logo.width * 0.035);
      registerTile(TILES.LEIA_L, shrink(logo, m, m, logo.width - 2 * m, logo.height - 2 * m, 16, 16));
      leia.ok = true;
    }
    if (face) {
      leia.face = face;
      // Cara del collie sobre un fondo oscuro del sitio (#18181b) para que no quede translúcida.
      registerTile(TILES.DOG_FACE, shrink(face, 0, 0, face.width, face.height, 16, 16, '#18181b'));
      registerTile(TILES.COLLIE, shrink(face, 0, 0, face.width, face.height, 16, 16, '#dcdce0')); // bloque decorativo: fondo claro
      leia.ok = true;
    }
  })().catch(() => {});
  await Promise.race([work, new Promise((r) => setTimeout(r, timeoutMs))]);
  return leia.ok;
}

// Mural en píxeles-bloque a partir de la mascota: devuelve { w, h, cells } con cells[y][x] en
// null (aire) | 'W' blanco | 'K' negro | 'P' rosa (lengua) | 'B' marrón (ojos).
// Se analiza la imagen a resolución completa (no la versión reducida) para que los detalles chicos
// —la lengua y los ojos— no se pierdan al achicar.
const EYES = [[0.412, 0.332], [0.6455, 0.332]]; // centro de cada ojo en la imagen (0..1)
const EYE = [ // 3 x 2: chiquitos y tranquilos, un iris casi negro con un brillo blanco
  'BWB',
  'BKB',
];
export function collieMural(size = 56) {
  if (!leia.face) return null;
  const SRC = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = SRC;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(leia.face, 0, 0, SRC, SRC);
  const d = ctx.getImageData(0, 0, SRC, SRC).data;
  const cs = SRC / size;
  const cells = [];
  for (let gy = 0; gy < size; gy++) {
    const row = [];
    for (let gx = 0; gx < size; gx++) {
      let w = 0, k = 0, p = 0, air = 0, tot = 0;
      for (let y = Math.floor(gy * cs); y < Math.floor((gy + 1) * cs); y++) {
        for (let x = Math.floor(gx * cs); x < Math.floor((gx + 1) * cs); x++) {
          const i = (y * SRC + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
          tot++;
          if (a < 110) { air++; continue; }
          if (r > 45 && r > g * 1.5 && r - b >= 15) p++;            // rosa / rojizo: lengua (incluye su sombra)
          else if (0.3 * r + 0.59 * g + 0.11 * b >= 115) w++;
          else k++;
        }
      }
      if (air > tot * 0.5) row.push(null);
      else if (p > tot * 0.2) row.push('P');
      else row.push(w > k ? 'W' : 'K');
    }
    cells.push(row);
  }
  // ojos: sobre el pelo negro se pierden al achicar, así que se dibujan aparte en su sitio
  for (const [ex, ey] of EYES) {
    const x0 = Math.round(ex * size - EYE[0].length / 2), y0 = Math.round(ey * size - EYE.length / 2);
    EYE.forEach((line, dy) => [...line].forEach((ch, dx) => {
      const y = y0 + dy, x = x0 + dx;
      if (ch !== '.' && cells[y] && cells[y][x] !== undefined && cells[y][x] !== null) cells[y][x] = ch;
    }));
  }
  return { w: size, h: size, cells };
}
