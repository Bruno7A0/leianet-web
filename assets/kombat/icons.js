/* LeiaKOMBAT · iconos pixel art (12×12). Una sola fuente: se usan como SVG en el DOM y como canvas en el juego. */
(function (root) {
'use strict';
const PAL = { k: '#12101c', w: '#ffffff', g: '#c7c7cc', d: '#7d7d88', a: '#d9a441', r: '#ff5a5a', b: '#4f8dff', c: '#7fe7ff', l: '#cfd8ff', y: '#ffe36b', o: '#ff8a3d', n: '#9a6a3a', f: '#fff1c9', p: '#ff7ac8', G: '#6bd07f', s: '#ffcf9a' };
const G = {
sound: ['............', '......w.....', '.....ww..w..', '.wwwwww...w.', '.wwwww..w.w.', '.wwwww..w.w.', '.wwwww..w.w.', '.wwwwww...w.', '.....ww..w..', '......w.....'],
mute: ['............', '......w.....', '.....ww.....', '.wwwwww.r..r', '.wwwww...rr.', '.wwwww...rr.', '.wwwww..r..r', '.wwwwww.....', '.....ww.....', '......w.....'],
pause: ['............', '............', '..www..www..', '..www..www..', '..www..www..', '..www..www..', '..www..www..', '..www..www..', '..www..www..', '..www..www..'],
left: ['............', '.....w......', '....ww......', '...www......', '..wwwwwwww..', '.wwwwwwwww..', '.wwwwwwwww..', '..wwwwwwww..', '...www......', '....ww......', '.....w......'],
move: ['............', '............', '..w......w..', '.ww......ww.', '.wwwwwwwwww.', 'wwwwwwwwwwww', '.wwwwwwwwww.', '.ww......ww.', '..w......w..'],
shield: ['............', '.kkkkkkkkkk.', '.kbbbbbbbbk.', '.kbwwbbbbbk.', '.kbwbbbbbbk.', '.kbbbbbbbbk.', '..kbbbbbbk..', '..kbbbbbbk..', '...kbbbbk...', '....kbbk....', '.....kk.....'],
kick: ['............', '...kkkkk....', '...kwwwk....', '...kwwwk....', '...kwwwk....', '...kaaak....', '...kwwwwkk..', '...kwwwwwwk.', '...kwwwwwwk.', '...kkkkkkkk.'],
punch: ['............', '..kkkkkkk...', '.kssksskssk.', '.kssksskssk.', '.kssssssssk.', '.kkssssssskk', '..ksssssssk.', '..kssssssk..', '..kkkkkkkk..', '..kaaaaaak..', '..kkkkkkkk..'],
roll: ['............', '...wwwww....', '..w.....w...', '.w.......w..', '.w.....wwwww', '.w......www.', '.w.......w..', '..w.....w...', '...wwwww....'],
run: ['............', '......wwwww.', '............', '.wwwwwwww...', '............', '...wwwwwww..', '.........ww.', '.wwwwww...w.', '..........w.', '....wwwwww..'],
bark: ['............', '......y.....', '.....yy..y..', '.yyyyyy...y.', '.yyyyy..y.y.', '.yyyyy..y.y.', '.yyyyy..y.y.', '.yyyyyy...y.', '.....yy..y..', '......y.....'],
gift: ['............', '....kk.kk...', '...kyykyyk..', '....kkkkk...', '.kkkkkkkkkk.', '.kpppyypppk.', '.kkkkkkkkkk.', '..kccyyccck.', '..kccyyccck.', '..kccyyccck.', '..kkkkkkkk..'],
storm: ['............', '...kkkk.....', '..kllllkkk..', '.kllllllllk.', '.kllllllllk.', '..kkkkkkkk..', '.....yy.....', '....yy......', '...yyyyy....', '.....yy.....', '....y.......'],
meteor: ['............', 'o...........', '.oo.........', '..oyy..kkkk.', '...oyykoooko', '....yykoyook', '.....okoyook', '......koooko', '.......kkkk.'],
quake: ['............', '............', '....rr.r....', '...rryrro...', '...kkkkkk...', '..knnnnnnk..', '..knnnnnnk..', '.knnnrnnnnk.', '.knnnrrnnnk.', 'kkkkkkkkkkkk'],
bone: ['............', '............', '.kk......kk.', 'kffk....kffk', 'kfffkkkkfffk', '.kffffffffk.', 'kfffkkkkfffk', 'kffk....kffk', '.kk......kk.'],
trophy: ['............', '.kkkkkkkkkk.', 'kykyyyyyykyk', 'kykyyyyyykyk', '.kkyyyyyykk.', '..kyyyyyyk..', '...kyyyyk...', '....kyyk....', '.....kk.....', '...kkkkkk...', '...kaaaak...'],
check: ['............', '............', '............', '..........G.', '.........GG.', 'G.......GG..', 'GG.....GG...', '.GG...GG....', '..GG.GG.....', '...GGG......', '....G.......'],
lock: ['............', '...kkkkkk...', '..kw....wk..', '..kw....wk..', '..kw....wk..', '.kkkkkkkkkk.', '.kyyyyyyyyk.', '.kyyykkyyyk.', '.kyyykkyyyk.', '.kyyyyyyyyk.', '.kkkkkkkkkk.'],
swords: ['............', 'w..........w', '.w........w.', '..w......w..', '...w....w...', '....w..w....', '.....ww.....', '....w..w....', '...yw..wy...', '..yyy..yyy..', '.nn......nn.'],
hourglass: ['............', '.kkkkkkkkkk.', '..kwwwwwwk..', '...kwwwwk...', '....kwwk....', '.....kk.....', '....kaak....', '...kaaaak...', '..kaaaaaak..', '.kkkkkkkkkk.'],
warn: ['............', '.....kk.....', '....kyyk....', '...kyyyyk...', '...kyykyk...', '..kyyykyyk..', '..kyyykyyk..', '.kyyyyyyyyk.', '.kyyykkyyyk.', '.kkkkkkkkkk.'],
tap: ['............', '.....kk.....', '....kwwk....', '....kwwk....', '....kwwk....', '....kwwkkk..', '.kk.kwwkwwkk', 'kwwkwwwwwwwk', 'kwwwwwwwwwk.', '.kwwwwwwwwk.', '..kkkkkkkk..'],
crown: ['............', '............', '..y..y..y...', '..yy.yy.yy..', '..yyyyyyyy..', '..yyyyyyyy..', '..kkkkkkkk..', '............'],
paw: ['............', '..kk....kk..', '.kwwk..kwwk.', '.kwwk..kwwk.', '..kk.kk.kk..', '....kwwk....', '...kwwwwk...', '...kwwwwk...', '....kkkk....'],
gear: ['....wwww....', '.ww.wwww.ww.', '.wwwwwwwwww.', '..wwwwwwww..', 'wwwww..wwwww', 'wwwww..wwwww', '..wwwwwwww..', '.wwwwwwwwww.', '.ww.wwww.ww.', '....wwww....'],
expand: ['............', 'wwww....wwww', 'w..........w', 'w..........w', 'w..........w', '............', '............', 'w..........w', 'w..........w', 'w..........w', 'wwww....wwww'],
shrink: ['............', '...w....w...', '...w....w...', '...w....w...', 'wwww....wwww', '............', '............', 'wwww....wwww', '...w....w...', '...w....w...', '...w....w...'],
globe: ['.....kk.....', '...kbbbbk...', '..kGGbbbbk..', '.kGGbbbGGbk.', '.bGGGbbGGGb.', 'kbbGGbbbGbbk', 'kbbbbbbGGbbk', '.bbbGbbGGbb.', '.kbbbGbbbbk.', '..kbbbbbbk..', '...kbbbbk...', '.....kk.....'],
users: ['............', '..ww....ww..', '.wwww..wwww.', '.wwww..wwww.', '..ww....ww..', '.wwww..wwww.', 'wwwwww.wwwww', 'wwwwww.wwwww', 'wwwwww.wwwww'],
target: ['.....kk.....', '...kwwwwk...', '..wwwrrwww..', '.kwrrrrrrwk.', '.wwrwwwwrww.', 'kwrrwrrwrrwk', 'kwrrwrrwrrwk', '.wwrwwwwrww.', '.kwrrrrrrwk.', '..wwwrrwww..', '...kwwwwk...', '.....kk.....'],
book: ['............', '.kkkkkkkkkk.', 'kwwwwkkwwwwk', 'kwkkwkkwkkwk', 'kwwwwkkwwwwk', 'kwkkwkkwkkwk', 'kwwwwkkwwwwk', 'kwkkwkkwkkwk', 'kwwwwkkwwwwk', '.kkkkkkkkkk.'],
phone: ['...wwwwwwww.', '...wccccccw.', '...wccccccw.', '...wccccccw.', '...wccccccw.', '...wccccccw.', '...wccccccw.', '...wccccccw.', '...wccccccw.', '...wwwwwwww.', '...wwwwwwww.']
};
const pad = g => { const o = g.map(r => (r + '............').slice(0, 12)); while (o.length < 12) o.push('............'); return o; };
const rot = g => g.map((_, y) => g.map((__, x) => g[11 - x][y]).join('')); // 90° horario
const flip = g => g.map(r => r.split('').reverse().join(''));
const P = {}; for (const k in G) P[k] = pad(G[k]);
P.right = flip(P.left); P.up = rot(P.left).map(r => r); P.down = P.up.slice().reverse();
const cache = {}, cvs = {};
function grid(n) { return P[n]; }
function svg(n, pal) {
  const g = P[n]; if (!g) return ''; const key = n + (pal ? JSON.stringify(pal) : ''); if (cache[key]) return cache[key];
  let d = ''; const col = c => (pal && pal[c]) || PAL[c];
  for (let y = 0; y < 12; y++) { let x = 0; while (x < 12) { const c = g[y][x]; if (c === '.') { x++; continue; } let w = 1; while (x + w < 12 && g[y][x + w] === c) w++; d += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1" fill="' + col(c) + '"/>'; x += w; } }
  return cache[key] = '<svg class="pxs" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">' + d + '</svg>';
}
function canvas(n) {
  if (cvs[n]) return cvs[n]; const g = P[n]; if (!g) return null;
  const c = document.createElement('canvas'); c.width = c.height = 12; const x = c.getContext('2d');
  for (let y = 0; y < 12; y++) for (let i = 0; i < 12; i++) { const ch = g[y][i]; if (ch !== '.') { x.fillStyle = PAL[ch]; x.fillRect(i, y, 1, 1); } }
  return cvs[n] = c;
}
function fill(r) { (r || document).querySelectorAll('[data-i]').forEach(e => { if (!e.firstChild || e.dataset.done !== '1') { e.innerHTML = svg(e.dataset.i); e.dataset.done = '1'; } }); }
root.KIcon = { svg, canvas, fill, grid, has: n => !!P[n] };
})(window);
