/* LeiaKOMBAT · modo Arcade: niveles infinitos, dificultad creciente y puntaje (sin DOM).
   Nv 1-19: 1 perro, cada uno más duro (con mecánicas que se estrenan de a una). Nv 20+: 2 perros. Cada 5 niveles, jefe con estilo propio. */
(function (root) {
'use strict';
const NAMES = ['CACHORRO', 'MANCHAS', 'PIRATA', 'TRUENO', 'CANELA', 'NIEBLA', 'FUEGO', 'ESCARCHA', 'VENENO', 'ECLIPSE', 'NEÓN', 'SAMURÁI', 'TITÁN', 'VOLCÁN'];
const TINTS = ['#9be39b', '#ffd27f', '#ff9ad8', '#7fb6ff', '#d99a6c', '#7fffe0', '#ff6a4d', '#a8e8ff', '#b6ff3d', '#9a7bff', '#ff4fd8', '#c9c9d4', '#5a6aff', '#ff7a1a'];
const PARTNER_FROM = 20, BOSS_EVERY = 5;
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.max(0, Math.min(1, x));

/* Jefes: cada uno tiene un ESTILO propio (ver ARCH en ai.js) con una debilidad que se aprende. Ciclan cada 5 niveles y,
   al repetirse, vuelven con más "tier" (más afinados), no con más vida. */
const BOSSES = [
  { arch: 'rush', name: 'EMBESTIDA', tip: 'Ataca en ráfagas de 3. Bloqueá la ráfaga y castigalo cuando se frena.' },
  { arch: 'zoner', name: 'LADRIDO', tip: 'Pelea de lejos con ladridos. Saltá o rodá la onda y acortá distancia.' },
  { arch: 'wall', name: 'MURO', tip: 'Casi no ataca: se tapa. Presionalo hasta romperle la guardia (estamina).' },
  { arch: 'trick', name: 'SOMBRA', tip: 'Finta, rueda y salta. No pegues a ciegas: esperá su error.' },
  { arch: 'fury', name: 'FURIA', tip: 'Alterna rabia y cansancio. Aguantá la furia y castigá cuando se agota.' }
];
/* Qué mecánica se estrena en cada tramo: antes de eso la CPU no la usa (así cada tramo enseña algo y no abruma al principio). */
const TIPS = { 3: 'NUEVO: el rival usa ladridos', 6: 'NUEVO: el rival corre para acortar distancia', 8: 'NUEVO: castiga tus golpes fallados', 12: 'NUEVO: el rival se cubre al salir del aturdimiento', 20: 'NUEVO: ahora pelean dos perros' };

function level(k, nStages) {
  const L = k + 1, boss = L % BOSS_EVERY === 0, partner = L >= PARTNER_FROM;
  /* d = dominio pedido al jugador (0..1). Antes se saturaba en Nv19 (1-e^(-L/9)) y justo ahí entraba el 2.º perro: un muro.
     Ahora sube lento hasta ~Nv45 y el 2.º perro entra gradual. */
  const d = 1 - Math.exp(-L / 17);
  const D = { t0: lerp(.55, .03, d), t1: lerp(.95, .08, d), punch: lerp(.22, .9, d), react: lerp(.1, .97, d), spec: L < 3 ? 0 : lerp(.12, .95, d), run: L >= 6, whiff: L >= 8 ? 1 : 0, guardUp: L >= 12 ? 1 : 0 };
  /* daño y velocidad con tope, monótonos (el jefe ya no se distingue por stats sino por patrón) */
  let dm = 1 + .3 * (1 - Math.exp(-(L - 1) / 18)), spd = 1 + .12 * (1 - Math.exp(-L / 20));
  let bi = -1, B = null, tier = 0;
  if (boss) { bi = L / BOSS_EVERY - 1; B = BOSSES[bi % BOSSES.length]; tier = Math.floor(bi / BOSSES.length); dm *= 1.04; D.arch = B.arch; D.tier = tier; }
  /* 2.º perro: entra suave (Nv20 ≈ mitad de reacción y de ataque) y llega a pleno en ~Nv32. En jefes, el compañero es un perro normal. */
  const pr = partner ? clamp01(.45 + (L - PARTNER_FROM) / 22) : 0;
  const D2 = partner ? Object.assign({}, D, { arch: null, react: D.react * lerp(.6, .92, pr), punch: D.punch * lerp(.55, .85, pr), spec: D.spec * .6, t0: D.t0 + .06, t1: D.t1 + .1, role: 'flank' }) : null;
  const i = k % NAMES.length, j = (k + 5) % NAMES.length;
  const boost = { dm, spd }; if (B && B.arch === 'zoner') { boost.mt = 6 + 1.5 * tier; boost.mg = 1.6; }
  const boost2 = { dm: dm * lerp(.35, .55, pr), spd: spd * .95 };
  const name = boss ? 'JEFE ' + B.name : NAMES[i];
  const tip = boss ? B.tip : (TIPS[L] || '');
  return { n: L, name, tint: TINTS[i], name2: partner ? NAMES[j] : '', tint2: TINTS[j], D, D2, boost, boost2, partner, boss, arch: B ? B.arch : '', tier, tip, stage: k % (nStages || 1) };
}

/* puntaje de un nivel ganado a partir del sim terminado */
function score(s, L) {
  const me = s.f[0], flawless = s.wins[1] === 0;
  const base = 1000 * L.n, bonus = Math.round(me.hp * 15 + Math.ceil(s.timeLeft) * 10 + s.stats[0].maxCombo * 100 + (s.res && s.res.perfect ? 1000 : 0) + (flawless ? 1500 : 0));
  return Math.round((base + bonus) * (L.partner ? 1.5 : 1) * (L.boss ? 1.25 : 1));
}

root.KArcade = { level, score, PARTNER_FROM, BOSS_EVERY, OPT: { wins: 2, time: 45 } };
})(typeof window !== 'undefined' ? window : globalThis);
