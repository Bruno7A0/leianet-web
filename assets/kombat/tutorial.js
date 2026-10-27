/* LeiaKOMBAT · tutorial interactivo + consejos de los primeros minutos.
   · Se juega en un modo propio ('tutorial': práctica con un muñeco guionado). Enseña moverse, saltar, golpe, patada, bloqueo y ladrido,
     y cada paso se completa HACIENDO la acción (no leyendo). Los botones táctiles del paso se iluminan.
   · Solo LEE la simulación (eventos y estado) y nunca toca el online; en el tutorial ajusta cosas locales (medidor, caída de poderes).
   · tips(): consejos de una sola vez ("Mantené Shift para bloquear") para quien todavía no hizo el tutorial. */
(function (root) {
'use strict';
const { IN, K } = root.KSim;
const $ = id => document.getElementById(id);
const ic = n => '<span class="px">' + root.KIcon.svg(n) + '</span>';
let ctx = null, on = false, free = false, vis = false, hide = false;
const T = { k: 0, p: 0, cd: 0, atk: 0, n: 0, prevY: 0, note: '', noteT: 0, kind: '', shownP: -1, shownSub: null };

/* ---- textos por dispositivo ---- */
const KEYS = {
  kb: { move: ['A', 'D', '|', '←', '→'], jump: ['W', '|', 'Espacio'], punch: ['E'], kick: ['Q'], block: ['Shift'], bark: ['R'] },
  touch: { move: ['#left', '#right'], jump: ['#up'], punch: ['#punch GOLPE'], kick: ['#kick PATADA'], block: ['#shield BLOQUEO'], bark: ['#bark LADRIDO'] },
  pad: { move: ['Palanca'], jump: ['A'], punch: ['B'], kick: ['X'], block: ['LB'], bark: ['Y'] }
};
const LAB = {
  kb: { punch: 'E', kick: 'Q', block: 'Shift', bark: 'R', pow: 'T' },
  touch: { punch: 'GOLPE', kick: 'PATADA', block: 'BLOQUEO', bark: 'LADRIDO', pow: 'PODER' },
  pad: { punch: 'B', kick: 'X', block: 'LB', bark: 'Y', pow: 'Select' }
};
const kind = () => (ctx && KEYS[ctx.kind()]) ? ctx.kind() : 'kb';
const chip = x => {
  if (x === '|') return '<em>o</em>';
  if (x[0] === '#') { const p = x.slice(1).split(' '); return '<kbd class="ti">' + ic(p[0]) + (p[1] ? '<span>' + p[1] + '</span>' : '') + '</kbd>'; }
  return '<kbd>' + x + '</kbd>';
};
const tk = t => '<b class="tk">' + t + '</b>';

/* ---- pasos ---- */
const dist = s => Math.abs(s.f[0].x - s.f[1].x);
const far = s => dist(s) > K.RANGE + 40;
const mine = (e, kd) => e.k === 'hit' && e.by === 0 && e.to === 1 && !e.blocked && !e.wave && (!kd || e.kind === kd);
const STEPS = [
  { id: 'move', t: 'Moverte', d: 'Caminá hacia el muñeco', need: 420, hl: ['L', 'R'], sub: () => 'Probá ir para los dos lados',
    upd(s, me) { T.p += Math.abs(me.x - me.px); } },
  { id: 'jump', t: 'Saltar', d: 'Saltá dos veces', need: 2, hl: ['JUMP'], sub: () => 'Mantené apretado para saltar más alto',
    upd(s, me) { if (me.y > 0 && T.prevY === 0 && !me.cross) T.p++; T.prevY = me.y; } },
  { id: 'punch', t: 'Golpe', d: 'Pegale 3 golpes al muñeco', need: 3, hl: ['PR'], sub: s => far(s) ? 'Acercate al muñeco' : 'Tocá seguido para encadenar un combo',
    ev(e) { if (mine(e, 'punch')) T.p++; } },
  { id: 'kick', t: 'Patada', d: 'Ahora, 2 patadas', need: 2, hl: ['PL'], sub: s => far(s) ? 'Acercate al muñeco' : 'Es más lenta, pero pega más fuerte y llega más lejos',
    ev(e) { if (mine(e, 'kick')) T.p++; } },
  { id: 'block', t: 'Bloqueo', d: 'Frená 2 golpes del muñeco', need: 2, hl: ['BLOCK'], sub: () => 'Mantené el bloqueo apretado antes de que pegue',
    init(s, me) { me.stam = K.STAM_MAX; },
    ev(e) { if (e.k === 'hit' && e.to === 0 && e.by === 1 && !e.wave) { if (e.blocked && !e.shield) T.p++; else if (!e.blocked) note('¡Te pegó! Mantené el bloqueo apretado'); } } },
  { id: 'bark', t: 'Ladrido', d: 'Soltá el ladrido', need: 1, hl: ['SPEC'], sub: () => 'El medidor ya está lleno. En combate, cada golpe lo va cargando',
    init(s, me) { me.meter = K.METER_MAX; },
    ev(e) { if (e.k === 'wave' && e.owner === 0) T.p = 1; else if (e.k === 'hit' && e.by === 0 && e.wave) note('¡Le diste con el ladrido!'); } },
  { id: 'done', t: '¡Listo!', need: Infinity, hl: [] }
];
const LAST = STEPS.length - 1;
function note(t) { T.note = t; T.noteT = 150; }

/* ---- DOM ---- */
function setHl(ids) {
  document.querySelectorAll('.tut-hl').forEach(e => e.classList.remove('tut-hl'));
  (ids || []).forEach(b => { const e = document.querySelector('#touch [data-b="' + b + '"]'); if (e) e.classList.add('tut-hl'); });
  const st = $('stick'); if (st) st.classList.toggle('tut-hl', !!(ids && ids.indexOf('L') >= 0));
}
function place() {
  if (!ctx) return;
  const c = ctx.canvas.getBoundingClientRect(), r = document.documentElement.style;
  r.setProperty('--ty', Math.round(c.top + c.height * .215) + 'px'); r.setProperty('--tx', Math.round(c.left + c.width / 2) + 'px'); r.setProperty('--tw', Math.round(Math.min(480, c.width - 24)) + 'px');
}
function apply() { const el = $('tut'); if (el) el.hidden = !(vis && on && !hide); if (!vis) hideTip(); }
function title(st) { return st.t + (st.need > 1 && st.need < 10 ? ' · ' + Math.min(T.p, st.need) + '/' + st.need : ''); }
function render() {
  const st = STEPS[T.k], el = $('tut'), card = $('tutCard'); if (!el) return;
  T.kind = kind(); T.shownP = -1; T.shownSub = null;
  card.classList.toggle('fin', st.id === 'done'); card.classList.remove('ok');
  $('tutDots').innerHTML = STEPS.slice(0, LAST).map((x, i) => '<i class="' + (i < T.k ? 'd' : i === T.k ? 'c' : '') + '"></i>').join('');
  $('tutT').textContent = title(st);
  if (st.id !== 'done') { $('tutD').textContent = st.d; $('tutK').innerHTML = KEYS[T.kind][st.id].map(chip).join(' '); $('tutP').style.width = '0%'; }
  setHl(st.hl);
  apply();
}
function progress(s, st) {
  const v = Math.max(0, Math.min(1, T.p / st.need)), pv = Math.floor(T.p) * 1000 + (T.noteT > 0 ? 1 : 0);
  $('tutP').style.width = Math.round(v * 100) + '%';
  if (pv !== T.shownP) { T.shownP = pv; $('tutT').textContent = title(st); }
  const sub = (T.noteT > 0 && T.note) || st.sub(s);
  if (sub !== T.shownSub) { T.shownSub = sub; $('tutS').textContent = sub; }
}

/* ---- flujo ---- */
function enter(s, k) {
  T.k = k; T.p = 0; T.cd = 0; T.atk = 0; T.note = ''; T.noteT = 0; T.prevY = s.f[0].y;
  const st = STEPS[k]; if (st.init) st.init(s, s.f[0]);
  if (st.id === 'done') { ctx.cfg.tutDone = 1; ctx.save(); ctx.play('go'); }
  render();
}
function start(s) { on = true; free = false; hide = false; T.n = 0; place(); enter(s, 0); }
function stop() {
  const s = ctx && ctx.sim(); if (on && s && s.dropT > 100) s.dropT = K.DROP_MIN;
  on = false; free = false; hide = false; setHl([]); apply();
}
function tick(s) {
  if (!on) return;
  const me = s.f[0];
  if (!free) { s.dropT = 999; if (T.k < 5 && me.meter > 60) me.meter = 60; }   // sin poderes cayendo; el ladrido no se llena solo antes de su paso
  if (!(++T.n % 30)) place();
  if (kind() !== T.kind) render();
  if (free || s.phase !== 'fight') return;
  const st = STEPS[T.k]; if (st.id === 'done') return;
  if (T.noteT > 0) T.noteT--;
  if (T.cd > 0) { if (--T.cd === 0) enter(s, T.k + 1); return; }
  if (st.upd) st.upd(s, me);
  if (st.ev) for (const e of s.events) st.ev(e, s, me);
  progress(s, st);
  if (T.p >= st.need) {
    T.p = st.need; progress(s, st); T.cd = st.id === 'bark' ? 80 : 45;
    $('tutCard').classList.add('ok'); $('tutD').innerHTML = ic('check') + ' ¡Bien!'; $('tutS').textContent = ''; T.shownSub = ''; ctx.play('pick');
  }
}
/* el muñeco: quieto, se mantiene a tiro para golpe/patada y, en el paso de bloqueo, pega cada 2,5 s con aviso */
function dummyMask(s) {
  if (!on || free || s.phase !== 'fight' || T.cd > 0) return 0;
  const me = s.f[0], d = s.f[1], dx = me.x - d.x, d2 = Math.abs(dx), toward = dx < 0 ? IN.L : IN.R, id = STEPS[T.k].id; let m = 0;
  if (id === 'punch' || id === 'kick') { if (d2 > 150) m |= toward; }   // vuelve solo al alcance: así el novato no persigue al muñeco
  else if (id === 'block') {
    if (d2 > 160) { m |= toward; T.atk = 0; }
    else { T.atk++; if (T.atk === 40 && T.noteT <= 0) note('¡Viene un golpe!'); if (T.atk >= 70 && T.atk < 73) m |= IN.PR; if (T.atk >= 150) T.atk = 0; }
  }
  return m;
}

/* ---- consejos de una sola vez (para quien no hizo el tutorial) ---- */
const Q = { t: 0, hurt: 0, blk: false, tipT: 0 };
const seen = b => (ctx.cfg.tips & (1 << b)) !== 0;
function hideTip() { const e = $('tip'); if (e) e.classList.remove('on'); }
function showTip(b, icon, html) {
  ctx.cfg.tips |= 1 << b; ctx.save(); const e = $('tip'); if (!e) return;
  place(); e.innerHTML = ic(icon) + '<span>' + html + '</span>'; e.classList.add('on'); Q.tipT = 300;
}
function reset() { Q.t = 0; Q.hurt = 0; Q.blk = false; Q.tipT = 0; hideTip(); }
function tips(s) {
  if (!ctx || on || ctx.cfg.tutDone) return;
  if (Q.tipT > 0 && --Q.tipT === 0) hideTip();
  if (s.phase !== 'fight') return;
  Q.t++;
  const me = s.f[0], L = LAB[kind()];
  for (const e of s.events) if (e.k === 'hit' && e.to === 0 && !e.shield) { if (e.blocked) Q.blk = true; else Q.hurt++; }
  if (me.state === 'block') Q.blk = true;
  if (Q.tipT > 0) return;
  if (!seen(0) && !ctx.cfg.tutAsked && Q.t > 75) showTip(0, 'punch', 'Acercate y pegá: ' + tk(L.punch) + ' golpe · ' + tk(L.kick) + ' patada');
  else if (!seen(1) && Q.hurt >= 3 && !Q.blk) showTip(1, 'shield', '¿Te pegan mucho? Mantené ' + tk(L.block) + ' para bloquear');
  else if (!seen(2) && me.meter >= K.METER_MAX) showTip(2, 'bark', '¡Ladrido listo! Apretá ' + tk(L.bark));
  else if (!seen(3) && me.power) showTip(3, 'gift', 'Tenés un poder: apretá ' + tk(L.pow) + ' para usarlo');
}

/* ---- arranque ---- */
function init(c) {
  ctx = c;
  $('tutNext').onclick = () => { ctx.play('click'); const s = ctx.sim(); if (on && T.k < LAST) enter(s, T.k + 1); };
  $('tutX').onclick = () => { ctx.play('click'); ctx.onExit(); };
  $('tutGo').onclick = () => { ctx.play('click'); ctx.onFight(); };
  $('tutMenu').onclick = () => { ctx.play('click'); ctx.onExit(); };
  $('tutFree').onclick = () => { ctx.play('click'); free = true; hide = true; const s = ctx.sim(); if (s) s.dropT = 5; setHl([]); apply(); };
  addEventListener('resize', place);
}
root.KTutorial = { init, start, stop, tick, tips, reset, dummyMask, visible(v) { vis = !!v; apply(); } };
})(window);
