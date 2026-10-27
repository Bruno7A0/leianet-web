/* LeiaKOMBAT · control del juego: menús, input, IA, simulación fija a 60 Hz + render a los Hz del monitor, y online */
(function () {
'use strict';
const { IN, K } = KSim, DT = K.DT;
const R = new KRender.Renderer(document.getElementById('c')), STAGES = KRender.STAGES, A = KAudio;
const $ = id => document.getElementById(id);
const ic = n => '<span class="px">' + KIcon.svg(n) + '</span>';
KIcon.fill(document);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* <-- PONÉ ACÁ tu servidor de LeiaKOMBAT (ver servers/kombat-server/README.md). También sirve ?server=wss://... en la URL */
const DEFAULT_SERVER = 'wss://leiakombat.leianet.ar/ws';
const DIFFS = [
  { n: 'Fácil', rival: 'CACHORRO', tint: '#9be39b', t0: .45, t1: .8, punch: .3, react: .25, spec: .25 },
  { n: 'Normal', rival: 'GUARDIÁN', tint: '#7fb6ff', t0: .18, t1: .45, punch: .55, react: .72, spec: .6 },
  { n: 'Difícil', rival: 'ALFA', tint: '#ff8a8a', t0: .15, t1: .4, punch: .55, react: .8, spec: .8 }
];

/* ---------- ajustes (localStorage con try/catch) ---------- */
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const cfg = Object.assign({ tw: [0, 0, 0, 0], stage: 0, diff: 1, wins: 2, time: 60, mus: 50, sfx: 80, nick: '', srv: '', muted: false, won: 0, qual: 0, col: ['#ffffff', '#7fb6ff'], tsz: 1, top: 1, move: 0, side: 0, vib: 1, mot: 0, tutDone: 0, tutAsked: 0, tips: 0 }, (() => { try { return JSON.parse(ls.get('kombat.cfg')) || {}; } catch (e) { return {}; } })());
const save = () => ls.set('kombat.cfg', JSON.stringify(cfg));
/* ---------- color de la perra (RGB): se tiñe multiplicando; blanco = colores originales ---------- */
const COL_PRESETS = ['#ffffff', '#7fb6ff', '#ff8a8a', '#9be39b', '#ffd27f', '#d9a2ff', '#ff9ad8', '#7fffe0'];
const hexOk = h => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
const toHex = c => '#' + c.map(v => ('0' + Math.max(0, Math.min(255, v | 0)).toString(16)).slice(-2)).join('');
const fromHex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const tintOf = h => { if (!hexOk(h)) return null; const c = fromHex(h); return c[0] > 245 && c[1] > 245 && c[2] > 245 ? null : h.toLowerCase(); };
const cdist = (a, b) => { const x = fromHex(a), y = fromHex(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
if (!Array.isArray(cfg.col)) cfg.col = ['#ffffff', '#7fb6ff'];
const colorOf = i => hexOk(cfg.col[i]) ? cfg.col[i] : (i ? '#7fb6ff' : '#ffffff');
/* si los dos eligen casi el mismo color, el 2.º pasa a uno distinto (igual en ambos clientes) */
function pairTints(c0, c1) {
  c0 = hexOk(c0) ? c0 : '#ffffff'; c1 = hexOk(c1) ? c1 : '#7fb6ff';
  if (cdist(c0, c1) < 60) c1 = cdist(c0, '#7fb6ff') >= 60 ? '#7fb6ff' : '#ff8a8a';
  return [tintOf(c0), tintOf(c1)];
}
const pickers = [];
function paintPreview(cv, hex) {
  const x = cv.getContext('2d'), im = R.img.idle; x.clearRect(0, 0, cv.width, cv.height); if (!im || !im.complete) return;
  const tmp = paintPreview.t || (paintPreview.t = document.createElement('canvas')); tmp.width = 219; tmp.height = 370; const y = tmp.getContext('2d'), t = tintOf(hex);
  y.clearRect(0, 0, 219, 370); y.drawImage(im, 0, 0, 219, 370, 0, 0, 219, 370);
  if (t) { y.globalCompositeOperation = 'multiply'; y.fillStyle = t; y.fillRect(0, 0, 219, 370); y.globalCompositeOperation = 'destination-in'; y.drawImage(im, 0, 0, 219, 370, 0, 0, 219, 370); y.globalCompositeOperation = 'source-over'; }
  x.drawImage(tmp, 0, 0, 219, 370, 0, 0, cv.width, cv.height);
}
function mkPicker(el, idx, onSet) {
  if (!el) return;
  el.className = 'cpk';
  el.innerHTML = '<canvas class="cpv" width="52" height="88" aria-hidden="true"></canvas><div class="cpc"><div class="cpp">' + COL_PRESETS.map(c => '<button type="button" data-c="' + c + '" style="background:' + c + '" aria-label="Color ' + c + '"></button>').join('') + '</div>' +
    ['R', 'G', 'B'].map((n, i) => '<label class="cps"><b>' + n + '</b><input type="range" min="0" max="255" data-i="' + i + '" aria-label="' + ['Rojo', 'Verde', 'Azul'][i] + '"><output></output></label>').join('') +
    '<input class="cph" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Color hexadecimal"></div>';
  const cv = el.querySelector('canvas'), rs = el.querySelectorAll('input[type=range]'), os = el.querySelectorAll('output'), hx = el.querySelector('.cph');
  const sync = () => {
    const h = colorOf(idx), c = fromHex(h);
    rs.forEach((r, i) => { if (+r.value !== c[i]) r.value = c[i]; os[i].textContent = c[i]; }); if (document.activeElement !== hx) hx.value = h;
    el.querySelectorAll('.cpp button').forEach(b => { b.classList.toggle('on', b.dataset.c === h); b.setAttribute('aria-pressed', b.dataset.c === h ? 'true' : 'false'); }); paintPreview(cv, h);
  };
  const set = h => { cfg.col[idx] = h.toLowerCase(); save(); pickers.forEach(p => p.sync()); if (onSet) onSet(h); };
  rs.forEach(r => { r.oninput = () => set(toHex([...rs].map(q => +q.value))); });
  el.querySelector('.cpp').onclick = e => { const b = e.target.closest('button'); if (b) { ui(); set(b.dataset.c); } };
  hx.oninput = () => { let v = hx.value.trim(); if (v[0] !== '#') v = '#' + v; if (hexOk(v)) set(v); };
  hx.onblur = () => { hx.value = colorOf(idx); };
  pickers.push({ sync }); sync();
}
function syncPickers() { pickers.forEach(p => p.sync()); }

/* ---------- estado ---------- */
const G = { mode: null, sim: null, attract: true, paused: false, acc: 0, last: 0, startReq: false, net: null, side: 0, wait: false, stall: 0, resShown: false, hint: 0, screen: 'menu', ai: [null, null, null], tw: null, arc: null, D: null, touch: 0, inKind: 'kb', pendingGo: 'cpu', names: ['LEIA', 'RIVAL'], lobby: null, local: null, ping: 0, desync: 0 };
const keys = new Set(); let touchMask = 0; const pads = [0, 0];
/* táctil: cada dedo (botón o palanca) aporta su propia máscara; touchMask = OR de todas. Así soltar un dedo nunca borra los bits de otro. */
const srcs = new Map();
function setSrc(k, m) { if (m) srcs.set(k, m); else srcs.delete(k); let t = 0; for (const v of srcs.values()) t |= v; touchMask = t; }
let resetStick = null;
/* suelta TODO lo táctil: se usa al perder foco, rotar, abrir un menú o cuando el sistema no entrega el pointerup */
function resetTouch() {
  document.querySelectorAll('#touch .t').forEach(b => { if (b._rel) b._rel(); b.classList.remove('on'); });
  srcs.clear(); touchMask = 0; if (resetStick) resetStick();
}
let toastT = 0;
function toast(t, ms) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), ms || 2200); }

/* ---------- pantallas ---------- */
const SCREENS = ['menu', 'opts', 'ctrls', 'online', 'pause', 'result', 'tower', 'climb', 'arcTop', 'first'];
let prevScreen = 'menu';
function show(id) {
  if (id !== G.screen) prevScreen = G.screen;
  G.screen = id || '';
  SCREENS.forEach(s => { $(s).hidden = s !== id; });
  const playing = !!G.mode && !G.attract;
  document.body.dataset.screen = id || '';
  document.body.classList.toggle('playing', playing && id !== 'online');
  document.body.classList.toggle('inmatch', playing && !id);
  $('bPause').hidden = !(playing);
  if (id === 'ctrls' && prevScreen !== 'ctrls') setTab($('ctrls'), G.touch ? 'touch' : 'kb');
  resetTouch(); placeIbs();
  if (window.__placeStick) window.__placeStick();
  if (id === 'menu') { $('menuFoot').textContent = cfg.won ? 'Victorias vs CPU: ' + cfg.won : ''; $('menuTut').hidden = !!cfg.tutDone; }
  KTutorial.visible(G.mode === 'tutorial' && !id);
}
function ui(btn) { A.init(); A.play('click'); }
/* ---------- pestañas (Opciones y Cómo jugar) ---------- */
function setTab(card, name) {
  if (!card) return;
  card.querySelectorAll('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
  card.querySelectorAll('.pane').forEach(p => { p.hidden = p.dataset.pane !== name; });
  const b = card.querySelector('.card-b'); if (b) b.scrollTop = 0;
}
document.addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; ui(); setTab(t.closest('.card'), t.dataset.tab); });

/* ---------- input ---------- */
const MAP = [
  { KeyA: IN.L, KeyD: IN.R, KeyW: IN.JUMP, Space: IN.JUMP, KeyS: IN.CROUCH, ShiftLeft: IN.BLOCK, KeyQ: IN.PL, KeyE: IN.PR, KeyF: IN.ROLL, KeyR: IN.SPEC, KeyT: IN.POW, KeyV: IN.RUN, Enter: IN.START },
  { ArrowLeft: IN.L, ArrowRight: IN.R, ArrowUp: IN.JUMP, ArrowDown: IN.CROUCH, Slash: IN.BLOCK, Comma: IN.PL, Period: IN.PR, ShiftRight: IN.ROLL, Semicolon: IN.SPEC, Quote: IN.POW, KeyL: IN.RUN, NumpadEnter: IN.START }
];
const GAMEKEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Slash', 'Comma', 'Period', 'Semicolon', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'KeyF', 'KeyC', 'KeyR', 'ShiftLeft', 'ShiftRight', 'Enter', 'KeyT', 'Quote', 'KeyV', 'KeyL']);
function kbMask(side) { let m = 0; const mp = MAP[side]; for (const c of keys) if (mp[c]) m |= mp[c]; return m; }
function padMask(i) {
  const p = pads[i]; if (!p) return 0; let m = 0; const b = n => p.buttons[n] && p.buttons[n].pressed, ax = p.axes || [];
  if (ax[0] < -.45 || b(14)) m |= IN.L; if (ax[0] > .45 || b(15)) m |= IN.R; if (ax[1] < -.65 || b(12)) m |= IN.JUMP; if (ax[1] > .65 || b(13)) m |= IN.CROUCH;
  if (b(0)) m |= IN.JUMP; if (b(2)) m |= IN.PL; if (b(1)) m |= IN.PR; if (b(3)) m |= IN.SPEC; if (b(4) || b(6)) m |= IN.BLOCK; if (b(5) || b(7)) m |= IN.ROLL; if (b(8) || b(11)) m |= IN.POW; if (b(10)) m |= IN.RUN; if (b(9)) m |= IN.START;
  return m;
}
function pollPads() {
  const l = (navigator.getGamepads && navigator.getGamepads()) || []; let n = 0;
  for (let i = 0; i < l.length && n < 2; i++) if (l[i] && l[i].connected) pads[n++] = l[i];
  for (; n < 2; n++) pads[n] = 0;
  for (let i = 0; i < 2; i++) { const q = pads[i]; if (q && (q.buttons.some(b => b.pressed) || Math.abs(q.axes[0] || 0) > .5 || Math.abs(q.axes[1] || 0) > .5)) { G.inKind = 'pad'; break; } }
  const st = pads[0] && pads[0].buttons[9] && pads[0].buttons[9].pressed; if (st && !pollPads.st && G.mode && !G.attract) togglePause(); pollPads.st = st;
}
function localMask(side) { // máscara para el jugador local
  if (G.mode === '2p') return kbMask(side) | padMask(side);
  return kbMask(0) | kbMask(1) | touchMask | padMask(0);
}
addEventListener('keydown', e => {
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { if (e.code === 'Escape') e.target.blur(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const inGame = G.mode && !G.attract && !G.screen;
  if (GAMEKEYS.has(e.code) && (inGame || G.screen === 'result')) e.preventDefault();
  if (e.repeat) return;
  A.init(); G.inKind = 'kb';
  if (G.screen === 'climb') { if (e.code === 'Enter' || e.code === 'Space') fightNow(); else if (e.code === 'Escape') quitTower(); e.preventDefault(); return; }
  if (G.screen === 'result' && e.code === 'Enter' && ((G.arc && G.arc.over) || (G.tw && G.tw.done))) { $('rAgain').click(); return; }
  if (e.code === 'KeyM') { setMuted(!cfg.muted); return; }
  if ((e.code === 'KeyP' || e.code === 'Escape') && G.mode && !G.attract) { if (G.screen === 'opts' && prevScreen === 'pause') { show('pause'); return; } togglePause(); return; }
  if (e.code === 'Escape' && ['opts', 'ctrls'].includes(G.screen)) { show(prevScreen === 'pause' ? 'pause' : 'menu'); return; }
  keys.add(e.code);
});
addEventListener('keyup', e => { keys.delete(e.code); if (GAMEKEYS.has(e.code) && G.mode && !G.attract && !G.screen) e.preventDefault(); });   // Espacio/Enter en un botón con foco no debe "clickearlo" en pleno combate
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b && b.blur && !G.screen) setTimeout(() => b.blur(), 0); });
addEventListener('blur', () => { keys.clear(); resetTouch(); if (G.mode && !G.attract && G.mode !== 'online' && !G.screen) togglePause(true); });
addEventListener('pagehide', () => { keys.clear(); resetTouch(); });
document.addEventListener('gesturestart', e => e.preventDefault());   // iOS Safari ignora user-scalable=no: evita el zoom con pellizco en pleno combate
{ let land = innerWidth >= innerHeight; const chk = () => { const l = innerWidth >= innerHeight; if (l !== land) { land = l; keys.clear(); resetTouch(); } }; addEventListener('resize', chk); addEventListener('orientationchange', () => { keys.clear(); resetTouch(); setTimeout(chk, 250); }); }
document.addEventListener('visibilitychange', () => { try { if (A.ac) { if (document.hidden) A.ac.suspend(); else if (!cfg.muted) A.ac.resume(); } } catch (e) {} if (document.hidden) { keys.clear(); resetTouch(); } if (document.hidden && G.mode && !G.attract && G.mode !== 'online' && !G.screen) togglePause(true); });
const buzz = ms => { if (cfg.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} };
/* botones: cada uno es un dedo independiente (multitoque). La cruceta permite DESLIZAR el dedo de una dirección a otra sin soltar,
   y doble toque en ◀/▶ = correr (así movés, corrés y pegás con solo dos pulgares). */
const RUN_TAP = 300; let dpTap = { bit: 0, t: -1e9 };
document.querySelectorAll('#touch .t').forEach(b => {
  const own = IN[b.dataset.b], isDir = b.classList.contains('dir'); let pid = null, act = b, run = false;
  const mk = bit => bit | (run && (bit & (IN.L | IN.R)) ? IN.RUN : 0);
  const rel = () => { if (pid !== null && (own & (IN.L | IN.R))) dpTap = { bit: own, t: performance.now() }; pid = null; run = false; act.classList.remove('on'); act = b; setSrc(b, 0); b.classList.remove('on'); };
  b._rel = () => { pid = null; run = false; act = b; setSrc(b, 0); };
  const on = e => {
    e.preventDefault();
    if (pid !== null && pid !== e.pointerId) { if (b.hasPointerCapture && b.hasPointerCapture(pid)) return; }   // ya lo sostiene otro dedo (si ese dedo se perdió, lo toma este)
    A.init(); G.inKind = 'touch'; buzz(8); pid = e.pointerId; act = b;
    run = !!(own & (IN.L | IN.R)) && dpTap.bit === own && performance.now() - dpTap.t < RUN_TAP;
    setSrc(b, mk(own)); b.classList.add('on'); if (b.setPointerCapture) try { b.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const mv = e => {
    if (!isDir || e.pointerId !== pid) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest && el.closest('.t.dir');
    if (t && t !== act) { act.classList.remove('on'); act = t; t.classList.add('on'); setSrc(b, mk(IN[t.dataset.b])); buzz(4); }
  };
  const off = e => { e.preventDefault(); if (pid !== null && e.pointerId !== pid) return; rel(); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointermove', mv); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
});
/* palanca flotante: apoyá el pulgar en cualquier lugar del lado de movimiento */
(function () {
  const z = $('stickZone'), st = $('stick'); if (!z || !st) return;
  const knob = st.firstElementChild; let pid = null, ox = 0, oy = 0, runOn = false, firstDir = 0, tapT = -1e9, tapDir = 0;
  const setPos = (x, y) => { st.style.left = x + 'px'; st.style.top = y + 'px'; };
  const knobAt = (x, y) => { knob.style.setProperty('--kx', x + 'px'); knob.style.setProperty('--ky', y + 'px'); };
  /* posición de reposo (le muestra al jugador dónde apoyar el pulgar) */
  window.__placeStick = () => {
    if (pid !== null || !st.offsetWidth) return; const w = st.offsetWidth, cs = getComputedStyle($('touch')), pl = parseFloat(cs.paddingLeft) || 10, pr = parseFloat(cs.paddingRight) || 10;
    setPos(cfg.side ? innerWidth - pr - w * .5 - 14 : pl + w * .5 + 14, innerHeight - w * .5 - 16); knobAt(0, 0); st.classList.add('hint');
  };
  const move = e => {
    let dx = e.clientX - ox, dy = e.clientY - oy; const r = st.offsetWidth * .36, len = Math.hypot(dx, dy);
    if (len > r) { const k = (len - r) / len; ox += dx * k; oy += dy * k; setPos(ox, oy); dx = e.clientX - ox; dy = e.clientY - oy; } // la base sigue al dedo
    knobAt(dx, dy);
    let m = 0; if (dx > r * .3) m |= IN.R; else if (dx < -r * .3) m |= IN.L; if (dy < -r * .55) m |= IN.JUMP; else if (dy > r * .55) m |= IN.CROUCH;
    /* doble toque hacia un lado (soltar y volver a apoyar en menos de 0,3 s hacia el mismo lado) = correr mientras mantengas el dedo */
    const hd = (m & IN.R) ? 1 : (m & IN.L) ? -1 : 0;
    if (hd && !firstDir) { firstDir = hd; if (performance.now() - tapT < RUN_TAP && tapDir === hd) runOn = true; }
    setSrc('stick', m | (runOn && hd ? IN.RUN : 0));
  };
  const end = e => { if (e.pointerId !== pid) return; if (firstDir) { tapT = performance.now(); tapDir = firstDir; } else tapT = -1e9; pid = null; runOn = false; firstDir = 0; setSrc('stick', 0); st.classList.remove('on'); window.__placeStick(); };
  resetStick = () => { pid = null; runOn = false; firstDir = 0; tapT = -1e9; setSrc('stick', 0); st.classList.remove('on'); knobAt(0, 0); window.__placeStick(); };
  z.addEventListener('pointerdown', e => { if (pid !== null) { if (z.hasPointerCapture && z.hasPointerCapture(pid)) return; resetStick(); } e.preventDefault(); runOn = false; firstDir = 0; A.init(); G.inKind = 'touch'; buzz(6); pid = e.pointerId; try { z.setPointerCapture(pid); } catch (_) {} ox = e.clientX; oy = e.clientY; setPos(ox, oy); st.classList.remove('hint'); st.classList.add('on'); move(e); });
  z.addEventListener('pointermove', e => { if (e.pointerId === pid) { e.preventDefault(); move(e); } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => z.addEventListener(n, end));
  z.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('resize', () => window.__placeStick()); addEventListener('orientationchange', () => setTimeout(() => window.__placeStick(), 200));
})();
R.cv.addEventListener('pointerdown', () => { A.init(); if (G.sim && G.sim.phase === 'matchend' && !G.screen) G.startReq = true; });
window.__kdbg = () => ({ mode: G.mode, screen: G.screen, paused: G.paused, touch: G.touch, tmask: touchMask, pmask: padMask(0), kmask: kbMask(0) | kbMask(1), keys: [...keys], phase: G.sim && G.sim.phase, f0: G.sim && { x: Math.round(G.sim.f[0].x), y: Math.round(G.sim.f[0].y), st: G.sim.f[0].state } });   // para pruebas
if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) { document.body.classList.add('touch'); G.touch = 1; G.inKind = 'touch'; }

/* ---------- audio ---------- */
function setMuted(v) { cfg.muted = !!v; A.setMuted(cfg.muted); $('bMute').innerHTML = ic(cfg.muted ? 'mute' : 'sound'); save(); }
A.setVol(cfg.mus / 100, cfg.sfx / 100); A.muted = cfg.muted; $('bMute').innerHTML = ic(cfg.muted ? 'mute' : 'sound');
$('bMute').onclick = () => { A.init(); setMuted(!cfg.muted); };
/* pantalla completa (donde el navegador lo permite; en Android se bloquea en horizontal) */
(function () {
  const b = $('bFull'), de = document.documentElement; if (!b) return;
  const req = de.requestFullscreen || de.webkitRequestFullscreen, ext = document.exitFullscreen || document.webkitExitFullscreen; if (!req || document.fullscreenEnabled === false) return;
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const paint = () => { b.innerHTML = ic(isFs() ? 'shrink' : 'expand'); b.title = b.ariaLabel = isFs() ? 'Salir de pantalla completa' : 'Pantalla completa'; };
  b.hidden = false; paint();
  b.onclick = () => {
    A.init(); if (isFs()) { ext.call(document); return; }
    const lock = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
    try { const r = req.call(de); if (r && r.then) r.then(lock, () => {}); else lock(); } catch (e) {}
  };
  document.addEventListener('fullscreenchange', paint); document.addEventListener('webkitfullscreenchange', paint);
})();

/* ---------- IA ---------- (ver ai.js) */
const { newAI, aiMask } = KAI;

/* ---------- partida ---------- */
function music(stage) { A.music(STAGES[stage].music); A.viewer = G.mode === '2p' ? -1 : (G.mode === 'online' ? G.side : 0); }
function startMatch(mode, extra) {
  extra = extra || {};
  const D = DIFFS[cfg.diff], nick = (cfg.nick || 'LEIA').toUpperCase();
  G.series = null; G.mode = mode; G.attract = false; G.paused = false; A.setPaused(false); G.net = null; G.wait = false; G.resShown = false; G.startReq = false; G.stall = 0; G.desync = 0; G.acc = 0; G.oppDown = false; G.localEnd = false; G.forfeit = '';
  if (mode !== 'cpu') { G.tw = null; G.arc = null; }
  KTutorial.reset();
  const AL = mode === 'cpu' && G.arc ? G.arc.L : null;
  const TL = AL || (mode === 'cpu' && G.tw ? G.tw.lv[G.tw.k] : null); G.D = TL ? TL.D : null; G.D2 = AL && AL.D2 ? AL.D2 : G.D; G.fyLast = undefined;
  const opts = extra.opts || { wins: cfg.wins, time: cfg.time, stage: TL ? TL.stage : cfg.stage };
  if (AL) { Object.assign(opts, KArcade.OPT, { stage: AL.stage }); }
  G.sim = KSim.create({ wins: opts.wins, time: opts.time, mode: mode === 'practice' || mode === 'tutorial' ? 'practice' : 'versus', stage: opts.stage, partner: !!(AL && AL.partner), boost: AL ? [null, AL.boost, AL.boost2] : null });
  R.setStage(opts.stage); R.hpd = [100, 100, 100];
  if (mode === 'cpu') { G.names = [nick, TL ? TL.name : D.rival]; R.tints = [tintOf(colorOf(0)), TL ? TL.tint : D.tint]; G.ai = [null, newAI(), AL && AL.partner ? newAI() : null]; if (AL && AL.partner) R.tints[2] = AL.tint2; }
  else if (mode === 'practice' || mode === 'tutorial') { G.names = [nick, 'MUÑECO']; R.tints = [tintOf(colorOf(0)), '#ffd27f']; G.ai = [null, null]; }
  else if (mode === '2p') { G.names = [nick, 'JUGADOR 2']; R.tints = pairTints(colorOf(0), colorOf(1)); G.ai = [null, null]; }
  else { G.names = extra.names || ['J1', 'J2']; const cs = extra.colors || []; R.tints = pairTints(cs[0], cs[1]); G.ai = [null, null]; }
  if (AL && AL.partner) G.names[2] = AL.name2;
  R.setNames(G.names[0], G.names[1], G.names[2]); R.portrait = null;
  G.hint = mode === 'tutorial' ? 0 : 14; music(opts.stage);
  if (mode === 'tutorial') KTutorial.start(G.sim); else KTutorial.stop();
  show('');
}
function toAttract() {
  KTutorial.stop(); KTutorial.reset(); clearTimeout(G.twT); G.tw = null; G.arc = null; G.mode = null; G.attract = true; G.net = null; G.wait = false; G.paused = false; A.setPaused(false); A.setLevel(0); G.resShown = false;
  const st = Math.floor(Math.random() * STAGES.length);
  G.sim = KSim.create({ wins: 2, time: 40, mode: 'versus', stage: st }); R.setStage(st); R.hpd = [100, 100];
  G.ai = [newAI(), newAI()]; R.tints = [null, '#7fb6ff']; R.setNames('LEIA', 'RIVAL'); G.hint = 0;
  A.music('menu'); document.body.classList.remove('playing', 'inmatch'); $('bPause').hidden = true; G.hold = false;
}
function togglePause(force) {
  if (!G.mode || G.attract) return;
  if (G.screen === 'pause' || G.screen === 'opts' && prevScreen === 'pause') { if (force === true) return; resume(); return; }
  if (G.screen) return;
  const online = G.mode === 'online';
  if (!online) { G.paused = true; A.setPaused(true); }
  $('pTitle').textContent = online ? 'Menú' : 'Pausa'; $('pRst').hidden = online || G.mode === 'practice' && false; $('pOpt').hidden = online;
  $('pRes').textContent = 'Continuar'; $('pQuit').textContent = online ? 'Abandonar partida' : 'Salir al menú';
  show('pause');
}
function resume() { G.paused = false; A.setPaused(false); show(''); }
$('bPause').onclick = () => { A.init(); togglePause(); };
$('pRes').onclick = () => { ui(); resume(); };
$('pRst').onclick = () => { ui(); startMatch(G.mode); };
$('pOpt').onclick = () => { ui(); openOpts(); };
if ($('rotQuit')) $('rotQuit').onclick = () => { ui(); if (G.mode === 'online') { onlineQuit(); return; } toAttract(); show('menu'); };
$('pQuit').onclick = () => { ui(); if (G.mode === 'online') { onlineQuit(); return; } toAttract(); show('menu'); };

function tickOnce() {
  const s = G.sim; let m0 = 0, m1 = 0, m2 = 0;
  if (G.attract) {
    m0 = aiMask(s, 0, G.ai[0], DIFFS[2]); m1 = aiMask(s, 1, G.ai[1], DIFFS[1]);
    if (s.phase === 'matchend' && s.phaseT > 2.5) m0 |= IN.START;
  } else if (G.mode === 'online') {
    if (G.localEnd) { m0 = m1 = 0; }   // el rival se fue: la partida termina sola y se muestra el resultado
    else if (G.wait) return false;
    else {
    const r = G.net.step(localMask(G.side) | (G.startReq ? IN.START : 0)); G.startReq = false;
    if (!r) { G.stall++; return false; }
    G.stall = 0; m0 = r[0]; m1 = r[1]; }
  } else {
    if (G.mode === '2p') { m0 = kbMask(0) | padMask(0); m1 = kbMask(1) | padMask(1); }
    else { m0 = localMask(0); if (G.mode === 'cpu') { m1 = aiMask(s, 1, G.ai[1], G.D || DIFFS[cfg.diff]); if (s.f[2] && G.ai[2]) m2 = aiMask(s, 2, G.ai[2], G.D2); furyTell(); } else if (G.mode === 'tutorial') m1 = KTutorial.dummyMask(s); }
    if (G.startReq) { m0 |= IN.START; G.startReq = false; }
    if (s.phase === 'matchend') { m0 |= (m0 & IN.START); }
  }
  KSim.step(s, m0, m1, m2);
  if (G.mode === 'tutorial') KTutorial.tick(s); else if (G.mode === 'cpu' || G.mode === 'practice') KTutorial.tips(s);   // solo leen la simulación
  if (G.mode === 'online' && G.net && !G.localEnd) G.net.check(KSim.hash(s));
  A.consume(s);
  if (G.touch && !G.attract && G.mode !== '2p') {  // vibración: se siente cuando pegás, cuando te pegan y cuando bloqueás
    const me = G.mode === 'online' ? G.side : 0;
    for (const e of s.events) {
      if (e.k === 'hit') { if (e.to === me) buzz(e.blocked ? 10 : (e.counter || e.kind !== 'punch') ? 34 : 20); else if (e.by === me) buzz(e.blocked ? 6 : e.kind === 'kick' || e.counter ? 18 : 12); }
      else if (e.k === 'ko') buzz(e.to === me ? [40, 40, 90] : [20, 30, 40]);
    }
  }
  if (s.res && s.phase === 'matchend' && G.mode === 'cpu' && !G.arc && s.phaseT < DT * 1.5 && s.res.winner === 0) { cfg.won++; save(); }
  R.consume(s);
  return true;
}

const portraitPhone = matchMedia('(orientation:portrait) and (pointer:coarse) and (max-width:700px)');
function frame(ts) {
  requestAnimationFrame(frame);
  if (G.attract && ts - (frame.ld || 0) < 30) return; frame.ld = ts;   // menú/demo a ~30 fps: mismo aspecto, menos batería y calor
  if (G.net && G.last && ts - G.last > 1500) G.net.lastProgress = performance.now();   // pestaña dormida/congelada: no cuenta como "el rival no responde"
  const dt = Math.min(.1, (ts - G.last) / 1000 || 0); G.last = ts;
  R.resize(); pollPads();
  const s = G.sim; if (!s) return;
  /* celular en vertical durante un combate: se congela (el aviso "Girá el teléfono" tapa la pantalla) */
  const hold = !!(G.mode && !G.attract && !G.screen && G.mode !== 'online' && portraitPhone.matches);
  if (hold !== G.hold) { G.hold = hold; if (!G.paused) A.setPaused(hold); }
  if (!G.paused && !hold) {
    G.acc = Math.min(.25, G.acc + dt);
    for (let n = 0; G.acc >= DT && n < 6; n++) { if (!tickOnce()) { G.acc = Math.min(G.acc, DT); break; } G.acc -= DT; }
  }
  if (G.mode === 'online' && G.stall > 45 && !G.wait && !G.localEnd) toast(G.lobby && G.lobby.reconnecting ? 'Sin conexión… reconectando' : G.oppDown ? 'Tu rival perdió la conexión… esperando que vuelva' : 'Esperando al rival…', 600);
  if (G.mode === 'online' && G.net && !G.local && !G.localEnd && !G.wait && !G.oppDown && !(G.lobby && G.lobby.reconnecting) && G.net.idleMs > KNet.TIMEOUT.idle) { if (G.lobby) G.lobby.send({ t: 'quit' }); rivalGone('El rival dejó de responder'); }
  // resultado
  if (!G.attract) {
    if (s.phase === 'matchend' && s.phaseT > (G.mode === 'online' ? 1.6 : 2.4) && !G.resShown && !G.screen) { G.resShown = true; showResult(); }
    else if (s.phase !== 'matchend' && G.resShown) { G.resShown = false; if (G.screen === 'result') show(''); }
  }
  if (G.hint > 0 && s.phase === 'fight') G.hint -= dt;
  A.setLevel(!G.attract && s.phase === 'fight' && (s.f[0].hp <= 30 || s.f[1].hp <= 30 || (s.opt.time > 0 && s.opt.mode !== 'practice' && s.timeLeft <= 10)) ? 1 : 0);
  const online = G.mode === 'online' && G.net, ku = keyUi();
  if (G.touch) { const me = !G.attract && G.mode ? s.f[G.mode === 'online' ? G.side : 0] : null; btnPow.classList.toggle('ready', !!(me && me.power)); btnSpec.classList.toggle('ready', !!(me && me.meter >= K.METER_MAX)); }
  // se dibuja en CADA cuadro del monitor (60/120/144/240 Hz); la simulación queda a 60 Hz fijos (necesario para el lockstep online) y el render interpola entre ticks
  const ddt = dt;
  R.draw(s, G.paused || G.hold ? 1 : Math.min(1, G.acc / DT), ddt, {
    hud: !G.attract, hideResult: G.resShown, hint: G.hint > 0 ? Math.min(1, G.hint) : 0, pk: ku.pk, lk: ku.lk, rows: ku.rows,
    badge: online ? (G.lobby && G.lobby.p2p ? 'DIRECTO · ' + Math.round(G.lobby.prtt || 0) : 'ONLINE · ' + Math.round(G.lobby && G.lobby.rtt || 0)) + ' ms · delay ' + G.net.delay + (G.net.desync ? ' · DESYNC' : '') : ''
  });
}
/* teclas dibujadas en pantalla (sin texto): filas de [teclas + ícono] */
const ROW1 = [{ k: ['A', 'D'], e: 'move' }, { k: ['W'], e: 'up' }, { k: ['S'], e: 'down' }, { k: ['⇧'], e: 'shield' }, { k: ['Q'], e: 'kick' }, { k: ['E'], e: 'punch' }, { k: ['F'], e: 'roll' }, { k: ['V'], e: 'run' }, { k: ['R'], e: 'bark' }, { k: ['T'], e: 'gift' }];
const ROW2 = [{ k: ['◀', '▶'], e: 'move' }, { k: ['▲'], e: 'up' }, { k: ['▼'], e: 'down' }, { k: ['/'], e: 'shield' }, { k: [','], e: 'kick' }, { k: ['.'], e: 'punch' }, { k: ['⇧'], e: 'roll' }, { k: ['L'], e: 'run' }, { k: ['Ñ'], e: 'bark' }, { k: ['{'], e: 'gift' }];
function keyUi() {
  if (G.attract || !G.mode) return {};
  if (G.touch) { const h = 'TAP'; return { pk: G.mode === 'online' && G.side ? ['', h] : [h, ''], lk: G.mode === 'online' && G.side ? ['', h] : [h, ''], rows: null }; }
  if (G.mode === '2p') return { pk: ['T', '{'], lk: ['R', 'Ñ'], rows: [[{ tag: 'J1' }].concat(ROW1), [{ tag: 'J2' }].concat(ROW2)] };
  if (G.mode === 'online' && G.side === 1) return { pk: ['', 'T'], lk: ['', 'R'], rows: [ROW1] };
  return { pk: ['T', ''], lk: ['R', ''], rows: [ROW1] };
}
const btnPow = document.querySelector('#touch [data-b=POW]'), btnSpec = document.querySelector('#touch [data-b=SPEC]');

/* ---------- resultado ---------- */
function showResult() {
  const s = G.sim, r = s.res; if (!r) return;
  let title, win = false, sub = '';
  if (G.mode === 'online') { win = r.winner === G.side; title = win ? 'VICTORIA' : 'DERROTA'; sub = G.names[0] + ' ' + s.wins[0] + ' – ' + s.wins[1] + ' ' + G.names[1]; if (G.forfeit) sub = G.forfeit + ' · ' + sub; }
  else if (G.mode === '2p') { title = r.winner < 0 ? 'EMPATE' : 'GANA ' + G.names[r.winner]; win = true; sub = s.wins[0] + ' – ' + s.wins[1]; }
  else if (G.arc && G.mode === 'cpu') {
    const a = G.arc; win = r.winner === 0;
    if (win) { const pts = KArcade.score(s, a.L); a.score += pts; a.run.push(pts); a.k++; if (a.score > (cfg.arcBest | 0)) { cfg.arcBest = a.score; save(); } arcIntro(); return; }
    a.over = true; title = 'GAME OVER'; sub = 'Llegaste al nivel ' + a.L.n + ' · ' + a.score + ' pts';
    $('result').querySelector('.card').className = 'card wide res lose'; $('rTitle').textContent = title; $('rSub').textContent = sub;
    $('rN0').textContent = 'JUGADOR'; $('rN1').textContent = 'PUNTAJE'; $('rStats').innerHTML = '<tr><td colspan="3">Guardando…</td></tr>'; setAgain('Nueva partida'); $('rBadges').innerHTML = '<span class="chip gold">RÉCORD PERSONAL ' + (cfg.arcBest | 0) + '</span>'; $('rTip').hidden = true; show('result');
    KBoard.submit(G.names[0], a.score, a.L.n, a.run).then(rk => KBoard.top().then(t => { $('rStats').innerHTML = (rk === 1 ? '<tr><td colspan="3">¡NUEVO RÉCORD!</td></tr>' : '') + topRows(t.list, G.names[0], a.score); }));
    return;
  }
  else if (G.tw && G.mode === 'cpu') {
    win = r.winner === 0; const tw = G.tw;
    if (win && tw.k < tw.lv.length - 1) { tw.k++; climb(); return; }
    if (win) { tw.done = true; cfg.tw[tw.ti] = 1; save(); title = '¡TORRE COMPLETADA!'; sub = 'Torre ' + TIERS[tw.ti].n + ' · ' + tw.lv.length + ' niveles superados'; }
    else { title = 'DERROTA'; sub = 'Nivel ' + (tw.k + 1) + ' / ' + tw.lv.length + ' · vs ' + G.names[1]; }
  }
  else { win = r.winner === 0; title = win ? 'VICTORIA' : 'DERROTA'; sub = G.names[0] + ' ' + s.wins[0] + ' – ' + s.wins[1] + ' ' + G.names[1]; }
  // serie de revanchas contra el mismo rival (CPU o 2 jugadores)
  let series = null;
  if ((G.mode === 'cpu' && !G.tw && !G.arc) || G.mode === '2p') { if (r.winner >= 0) { G.series = G.series || [0, 0]; G.series[r.winner]++; } if (G.series && G.series[0] + G.series[1] >= 2) series = G.series; }
  const me = G.mode === 'online' ? G.side : 0, ex = resultExtras(s, r, win, me, series);
  const h = $('rTitle'); h.textContent = title; $('rSub').textContent = sub;
  if (ex.grade) { const g = document.createElement('span'); g.className = 'gr g-' + ex.grade; g.textContent = ex.grade; g.setAttribute('role', 'img'); g.setAttribute('aria-label', 'Rango ' + ex.grade); h.appendChild(g); }
  $('rBadges').innerHTML = ex.chips.map(c => '<span class="chip ' + c[0] + '">' + c[1] + '</span>').join('');
  $('rTip').textContent = ex.tip; $('rTip').hidden = !ex.tip;
  $('result').querySelector('.card').className = 'card wide res ' + (win ? 'win' : 'lose');
  $('rN0').textContent = G.names[0]; $('rN1').textContent = G.names[1];
  const st = s.stats, op = 1 - me;
  // cada fila: quién ganó se resalta y una barrita muestra la diferencia de un vistazo
  const row = (n, a, b, f) => { const mx = Math.max(a, b, 1), cell = (v, o) => '<td class="' + (v > o ? 'lead' : '') + '"><span class="v">' + (f ? f(v) : v) + '</span><span class="bar"><i style="--w:' + Math.round(v / mx * 100) + '%"></i></span></td>'; return '<tr><td>' + n + '</td>' + cell(a, b) + cell(b, a) + '</tr>'; };
  let rows = row('Golpes', st[0].hits, st[1].hits) + row('Daño', st[0].dmg, st[1].dmg) + row('Combo máx.', st[0].maxCombo, st[1].maxCombo, v => 'x' + v) + row('Bloqueos', st[1].blocked, st[0].blocked);
  if (st[0].waves + st[1].waves) rows += row('Ladridos', st[0].waves, st[1].waves);
  if (st[0].powers + st[1].powers) rows += row('Poderes', st[0].powers, st[1].powers);
  $('rStats').innerHTML = rows;
  setAgain(G.tw ? (G.tw.done ? 'Elegir torre' : 'Reintentar nivel') : G.localEnd ? 'Volver a la sala' : 'Revancha');
  show('result');
}
/* medallas, rango y un consejo según cómo fue la pelea (todo sale de las estadísticas del sim) */
function resultExtras(s, r, win, me, series) {
  const op = 1 - me, a = s.stats[me], b = s.stats[op], chips = [], duel = G.mode !== '2p'; let grade = '', tip = '';
  if (r.perfect && r.winner >= 0) chips.push(['gold', 'PERFECTO']);
  if (win && duel && s.wins[op] > 0) chips.push(['blue', 'REMONTADA']);
  if (win && duel && s.f[me].hp <= 25) chips.push(['red', 'AL FILO']);
  if (a.maxCombo >= 3) chips.push(['', 'COMBO x' + a.maxCombo]);
  if (series) chips.push(['', 'SERIE ' + series[0] + '–' + series[1]]);
  if (win && duel) {
    const pts = s.f[me].hp * .5 + (r.perfect ? 20 : 0) + Math.min(a.maxCombo, 5) * 5 + (s.wins[op] === 0 ? 15 : 0) + Math.min(10, a.dmg / (b.dmg + 1) * 3);
    grade = pts >= 95 ? 'S' : pts >= 70 ? 'A' : pts >= 45 ? 'B' : 'C';
  } else if (!win && duel && G.mode !== 'online') {
    if (a.hits < b.hits * .6) tip = 'Consejo: atacá más seguido. Cada golpe que conecta carga el ladrido.';
    else if (b.maxCombo >= 3 && b.blocked < 2) tip = 'Consejo: cuando el rival te empiece un combo, mantené BLOQUEO.';
    else if (a.waves === 0) tip = 'Consejo: cuando el medidor brille, soltá el ladrido: viaja por el piso.';
    else tip = '¡Estuvo cerca! Una revancha y es tuya.';
  }
  return { chips, grade, tip };
}
function setAgain(t) { $('rAgain').innerHTML = t + (G.touch ? '' : ' <kbd>↵</kbd>'); }
$('rAgain').onclick = () => { ui(); if (G.arc && G.arc.over) { arcadeNew(); return; } if (G.tw && G.tw.done) { toAttract(); buildTower(); show('tower'); return; } if (G.mode === 'online' && G.localEnd) { onlineQuit(); return; } G.startReq = true; show(''); };
$('rMenu').onclick = () => { ui(); if (G.mode === 'online') { onlineQuit(); return; } if (G.arc) { toAttract(); show('menu'); return; } const t = !!G.tw; toAttract(); if (t) { buildTower(); show('tower'); } else show('menu'); };

/* ---------- menú y opciones ---------- */
function seg(el, items, get, set) {
  if (!el) return;
  el.innerHTML = items.map(i => '<button type="button" data-v="' + i.v + '" aria-pressed="false">' + i.l + '</button>').join('');
  const upd = () => el.querySelectorAll('button').forEach(b => { const on = String(get()) === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; ui(); set(+b.dataset.v); upd(); save(); };
  upd();
}
function buildOpts() {
  seg($('oDiff'), DIFFS.map((d, i) => ({ v: i, l: d.n })), () => cfg.diff, v => cfg.diff = v);
  seg($('oMot'), [{ v: 0, l: 'Auto' }, { v: 1, l: 'Sí' }, { v: 2, l: 'No' }], () => cfg.mot, v => { cfg.mot = v; applyMotion(); });
  seg($('oQual'), [{ v: 0, l: 'Auto' }, { v: 1, l: 'Alta' }, { v: 2, l: 'Media' }, { v: 3, l: 'Baja' }], () => cfg.qual, v => { cfg.qual = v; applyQuality(); });
  mkPicker($('oC0'), 0); mkPicker($('oC1'), 1);
  mkPicker($('olCb'), 0, sendColor); mkPicker($('olCc'), 0, sendColor); mkPicker($('olCl'), 0);
  seg($('oTsz'), [{ v: 0, l: 'Chicos' }, { v: 1, l: 'Normal' }, { v: 2, l: 'Grandes' }], () => cfg.tsz, v => { cfg.tsz = v; applyTouch(); });
  seg($('oTop'), [{ v: 0, l: 'Mucha' }, { v: 1, l: 'Media' }, { v: 2, l: 'Poca' }], () => cfg.top, v => { cfg.top = v; applyTouch(); });
  seg($('oMove'), [{ v: 0, l: 'Cruceta' }, { v: 1, l: 'Palanca' }], () => cfg.move, v => { cfg.move = v; applyTouch(); });
  seg($('oSide'), [{ v: 0, l: 'Derecha' }, { v: 1, l: 'Izquierda' }], () => cfg.side, v => { cfg.side = v; applyTouch(); });
  seg($('oVib'), [{ v: 1, l: 'Sí' }, { v: 0, l: 'No' }], () => cfg.vib, v => { cfg.vib = v; if (v) buzz(18); });
  seg($('oWins'), [1, 2, 3].map(v => ({ v, l: v })), () => cfg.wins, v => cfg.wins = v);
  seg($('oTime'), [{ v: 30, l: '30' }, { v: 60, l: '60' }, { v: 99, l: '99' }, { v: 0, l: '∞' }], () => cfg.time, v => cfg.time = v);
  const st = $('oStage'); st.innerHTML = '';
  STAGES.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'stg'; b.setAttribute('aria-label', s.name);
    const c = document.createElement('canvas'); c.width = 240; c.height = 150; const x = c.getContext('2d');
    if (R.bgs[i]) x.drawImage(R.bgs[i], 110, 30, 1280, 600, 0, 0, 240, 150);
    x.save(); x.scale(240 / 1280, 150 / 600); try { KStages.draw(s.id, x, { t: 2.6, q: 1, acc: s.acc, beat: null, camL: 0, vw: 1280, sky: s.sky }); } catch (e) {} x.restore();
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 118, 240, 32); x.fillStyle = s.acc; x.fillRect(0, 118, 240, 2);
    b.appendChild(c); b.insertAdjacentHTML('beforeend', '<span>' + s.name + '</span>');
    b.onclick = () => { ui(); cfg.stage = i; save(); upd(); R.setStage(i); };
    st.appendChild(b);
  });
  const upd = () => st.querySelectorAll('.stg').forEach((b, i) => { b.classList.toggle('on', i === cfg.stage); b.setAttribute('aria-pressed', i === cfg.stage ? 'true' : 'false'); });
  upd();
  $('oNick').value = cfg.nick; $('oNick').oninput = e => { cfg.nick = e.target.value.replace(/[<>]/g, '').slice(0, 16); save(); };
  const vol = () => { $('vM').textContent = cfg.mus + '%'; $('vS').textContent = cfg.sfx + '%'; A.setVol(cfg.mus / 100, cfg.sfx / 100); };
  $('oMus').value = cfg.mus; $('oSfx').value = cfg.sfx; vol();
  $('oMus').oninput = e => { cfg.mus = +e.target.value; vol(); save(); }; $('oSfx').oninput = e => { cfg.sfx = +e.target.value; vol(); save(); };
  $('oSfx').onchange = () => { A.init(); A.play('hit'); };
  const os = $('olStage'); os.innerHTML = STAGES.map((s, i) => '<option value="' + i + '">' + s.name + '</option>').join('');
}
/* los íconos (sonido/pausa) quedan justo debajo del HUD del rival, calculado sobre el escenario real */
function placeIbs() { try { const r = R.cv.getBoundingClientRect(), f = Math.min(1.5, Math.max(1, .85 / Math.max(.2, r.width / 1280))); document.body.style.setProperty('--ibt', Math.round(r.top + r.height * (112 * f + 8) / 600) + 'px'); } catch (e) {} }
addEventListener('resize', placeIbs); addEventListener('orientationchange', () => setTimeout(placeIbs, 250));
function applyTouch() {
  placeIbs();
  const t = $('touch'); if (!t) return;
  t.style.setProperty('--ts', [.86, 1, 1.2][cfg.tsz] || 1); t.style.setProperty('--to', [.34, .6, .88][cfg.top] || .6);
  document.body.classList.toggle('stick', cfg.move === 1); document.body.classList.toggle('lefty', cfg.side === 1);
  if (window.__placeStick) window.__placeStick();
}
function sendColor() { const L = G.lobby; if (L && L.connected) L.send({ t: 'color', c: colorOf(0) }); }
const mqRM = matchMedia('(prefers-reduced-motion: reduce)');
function applyMotion() { const on = cfg.mot === 1 || (!cfg.mot && mqRM.matches); R.rm = on; document.body.classList.toggle('rm', on); }
if (mqRM.addEventListener) mqRM.addEventListener('change', applyMotion);
/* batería baja (y sin cargar): en Auto baja un escalón los gráficos; al enchufar o recargar vuelve solo */
function watchBattery() {
  if (!navigator.getBattery) return;
  navigator.getBattery().then(b => {
    const chk = () => {
      const low = !b.charging && b.level <= .2; if (low === !!G.batLow) return; G.batLow = low;
      if (low && cfg.qual === 0) { R.lv = Math.max(R.lv, 2); R.noUp = true; R._applyLv(); toast('Batería baja: bajé un poco los gráficos para ahorrar', 3200); }
      else if (!low && cfg.qual === 0) applyQuality();
    };
    b.addEventListener('levelchange', chk); b.addEventListener('chargingchange', chk); chk();
  }).catch(() => {});
}
function applyQuality() { R.setQuality(['auto', 'high', 'mid', 'low'][cfg.qual | 0] || 'auto'); }
function openOpts() { A.init(); show('opts'); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if (!b) return; ui(); const g = b.dataset.go;
  if (g === '2p' && b.classList.contains('dis')) { toast('2 Jugadores necesita teclado o un joystick conectado', 3200); return; }
  if ((g === 'cpu' || g === 'arcade' || g === 'tower') && !cfg.tutDone && !cfg.tutAsked) { G.pendingGo = g; show('first'); return; }   // primera vez: se ofrece el tutorial una sola vez
  if (g === 'tutorial') { G.tw = null; G.arc = null; startMatch('tutorial'); }
  else if (g === 'cpu' || g === '2p' || g === 'practice') { G.tw = null; G.arc = null; startMatch(g); }
  else if (g === 'arcade') arcadeNew();
  else if (g === 'arcTop') openTop();
  else if (g === 'tower') { buildTower(); show('tower'); }
  else if (g === 'menu') show('menu');
  else if (g === 'opts') openOpts();
  else if (g === 'ctrls') show('ctrls');
  else if (g === 'online') openOnline();
  else if (g === 'back') show(prevScreen === 'pause' ? 'pause' : 'menu');
});


/* ================= TORRE (estilo MK) ================= */
const _P = (t0, t1, punch, react, spec) => ({ t0, t1, punch, react, spec });
const TIERS = [
  { n: 'Fácil', len: 5, c: '#9be39b', a: _P(.5, .9, .25, .15, .15), b: _P(.4, .75, .35, .35, .3), boss: ['GUARDIÁN MAYOR', '#5aa0ff'] },
  { n: 'Normal', len: 7, c: '#7fb6ff', a: _P(.35, .7, .4, .45, .4), b: _P(.2, .5, .5, .7, .65), boss: ['ALFA', '#ff5a5a'] },
  { n: 'Difícil', len: 9, c: '#ff9a5a', a: _P(.2, .5, .5, .65, .6), b: _P(.1, .3, .6, .9, .9), boss: ['CERBERO', '#a03030'] },
  { n: 'Extremo', len: 12, c: '#ff4f6a', a: _P(.1, .3, .6, .85, .85), b: _P(.03, .12, .8, 1, 1), boss: ['LEIA PRIME', '#ffd700'] }
];
const RIVALS = [['CACHORRO', '#9be39b'], ['MANCHAS', '#ffd27f'], ['PIRATA', '#ff9ad8'], ['TRUENO', '#7fb6ff'], ['CANELA', '#d99a6c'], ['NIEBLA', '#7fffe0'], ['FUEGO', '#ff6a4d'], ['ESCARCHA', '#a8e8ff'], ['VENENO', '#b6ff3d'], ['ECLIPSE', '#9a7bff'], ['NEÓN', '#ff4fd8'], ['SAMURÁI', '#c9c9d4'], ['TITÁN', '#5a6aff'], ['VOLCÁN', '#ff7a1a']];
function towerLevels(ti) {
  const T = TIERS[ti], n = T.len, out = [];
  for (let k = 0; k < n; k++) {
    const p = n > 1 ? k / (n - 1) : 1, D = {}; for (const key in T.a) D[key] = T.a[key] + (T.b[key] - T.a[key]) * p;
    const boss = k === n - 1, r = RIVALS[Math.round(k * (RIVALS.length - 1) / Math.max(1, n - 2))] || RIVALS[0];
    out.push({ name: boss ? T.boss[0] : r[0], tint: boss ? T.boss[1] : r[1], D, stage: (k + ti * 2) % STAGES.length, boss });
  }
  return out;
}
function buildTower() {
  A.init(); A.music('menu');
  $('tCols').innerHTML = TIERS.map((T, i) => '<button class="tcol" data-t="' + i + '" style="--tc:' + T.c + '"><div class="stk">' +
    towerLevels(i).map(L => '<div class="mini' + (L.boss ? ' boss' : '') + '" style="--c:' + L.tint + '"></div>').reverse().join('') +
    '</div><span class="tn">' + (cfg.tw[i] ? ic('check') + ' ' : '') + T.n + '</span><span class="tl">' + T.len + ' niveles</span></button>').join('');
}
$('tCols').onclick = e => { const b = e.target.closest('.tcol'); if (!b) return; ui(); G.tw = { ti: +b.dataset.t, k: 0, lv: towerLevels(+b.dataset.t), done: false }; climb(); };
const _face = {};
function tpos(k) { const col = $('cCol'), b = col.firstElementChild, h = b ? b.offsetHeight : 76, n = col.children.length; return Math.round(($('cView').clientHeight || 400) / 2 - (n - 1 - k) * (h + 8) - h / 2); }
/* cara de la perra (el mismo recorte del HUD), espejada y teñida con el color del rival */
function facePic(tint) {
  R._portrait(); if (!R.portrait) return null; const k = tint || ''; if (_face[k]) return _face[k];
  const c = document.createElement('canvas'); c.width = c.height = 120; const x = c.getContext('2d');
  x.save(); x.translate(120, 0); x.scale(-1, 1); x.drawImage(R.portrait, 0, 0); x.restore();
  if (tint) { x.globalCompositeOperation = 'multiply'; x.globalAlpha = .75; x.fillStyle = tint; x.fillRect(0, 0, 120, 120); x.globalCompositeOperation = 'screen'; x.globalAlpha = .38; x.fillRect(0, 0, 120, 120); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
  return (_face[k] = c);
}
const FC = tint => '<canvas class="fc" width="120" height="120" data-t="' + (tint || '') + '"></canvas>';
function paintFaces(root) { root.querySelectorAll('canvas.fc').forEach(cv => { const f = facePic(cv.dataset.t); if (f) cv.getContext('2d').drawImage(f, 0, 0); }); }
function climb() { const tw = G.tw, L = tw.lv[tw.k]; climbView(tw.lv, tw.k, 'TORRE ' + TIERS[tw.ti].n.toUpperCase(), L.boss ? '¡JEFE FINAL!' : 'NIVEL ' + (tw.k + 1) + ' / ' + tw.lv.length, L.name, STAGES[L.stage].name); }
function climbView(lv, k0, title, lvText, vsName, sub) {
  const tw = { lv, k: k0 }, L = lv[k0], col = $('cCol'); clearTimeout(G.twT);
  G.paused = true; A.music('menu');
  col.classList.remove('go');
  col.innerHTML = tw.lv.map((l, i) => '<div class="tb' + (l.boss ? ' boss' : '') + '" data-i="' + i + '" style="--c:' + l.tint + '"><i class="av">' + FC(l.tint) + '<u class="ck">' + KIcon.svg('check') + '</u></i><div><b>' + esc(l.name) + '</b><small>' + (l.label || (l.boss ? 'JEFE' : 'NIVEL ' + (i + 1))) + '</small></div></div>').reverse().join('');
  paintFaces(col);
  const setK = k => { col.querySelectorAll('.tb').forEach(b => { const i = +b.dataset.i; b.classList.toggle('done', i < k); b.classList.toggle('cur', i === k); }); col.style.transform = 'translateY(' + tpos(k) + 'px)'; };
  $('cT').textContent = title; $('cLv').textContent = lvText;
  $('cVs').textContent = vsName; $('cAv').innerHTML = FC(L.tint); paintFaces($('cAv')); $('cAv').parentNode.style.setProperty('--tc', L.tint); $('cAv').style.setProperty('--tc', L.tint);
  $('cSub').textContent = sub; $('cGo').innerHTML = 'Pelear ' + ic('right');
  show('climb'); setK(tw.k - 1);
  requestAnimationFrame(() => requestAnimationFrame(() => { col.classList.add('go'); setK(tw.k); A.play('beep'); }));
  setTimeout(() => { if (G.screen === 'climb') { A.play('pick'); A.play('shield'); } }, 700);
  G.twT = setTimeout(fightNow, 3000);
}
function fightNow() { if (G.screen !== 'climb') return; clearTimeout(G.twT); A.play('go'); startMatch('cpu'); }
function quitTower() { ui(); const a = !!G.arc; toAttract(); if (a) show('menu'); else { buildTower(); show('tower'); } }
$('cGo').onclick = () => { ui(); fightNow(); }; $('cQuit').onclick = quitTower;
addEventListener('resize', () => { if (G.screen === 'climb' && (G.tw || G.arc)) { const col = $('cCol'), t = col.style.transition; col.style.transition = 'none'; col.style.transform = 'translateY(' + tpos(G.tw ? G.tw.k : G.arc.kk) + 'px)'; setTimeout(() => col.style.transition = t); } });

/* ================= ARCADE ================= */
function topRows(list, me, myScore) {
  let hl = false;
  return list.map((e, i) => { const mine = !hl && e.name === me && e.score === myScore; if (mine) hl = true; return '<tr' + (mine ? ' style="color:#ffd84c"' : '') + '><td>#' + (i + 1) + '</td><td>' + esc(e.name) + ' · Nv ' + (e.level | 0) + '</td><td>' + (e.score | 0) + '</td></tr>'; }).join('') || '<tr><td colspan="3">Todavía no hay puntajes</td></tr>';
}
/* aviso de fase del jefe FURIA (lo que el jugador tiene que leer para ganar) */
function furyTell() { const a = G.ai[1], D = G.D; if (!a || !D || D.arch !== 'fury') return; if (a.rage !== G.fyLast) { if (G.fyLast !== undefined) toast(a.rage ? '¡FURIA! Aguantá con la guardia' : 'Se agotó: ¡castigalo!', 900); G.fyLast = a.rage; } }
function arcadeNew() { A.init(); G.fyLast = undefined; G.arc = { k: Math.max(0, (+new URLSearchParams(location.search).get('arclv') || 1) - 1), score: 0, run: [], L: null, over: false, kk: 0 }; arcIntro(); }
function arcIntro() {
  const a = G.arc; a.L = KArcade.level(a.k, STAGES.length); const L = a.L, from = Math.max(0, a.k - 1);
  const lv = []; for (let i = from; i < from + 6; i++) { const q = KArcade.level(i, STAGES.length); q.label = (q.boss ? 'JEFE ' : 'NIVEL ') + q.n + (q.partner ? ' · x2' : ''); lv.push(q); }
  a.kk = a.k - from; G.mode = 'cpu';
  climbView(lv, a.kk, 'ARCADE · ' + a.score + ' PTS' + (L.boss ? ' · ¡JEFE!' : ''), 'NIVEL ' + L.n, L.partner ? L.name + ' + ' + L.name2 : L.name, L.tip || ((L.partner ? '2 PERROS · ' : '') + 'DAÑO x' + L.boost.dm.toFixed(1)));
}
async function openTop() { show('arcTop'); $('atBody').innerHTML = '<tr><td colspan="3">Cargando…</td></tr>'; const t = await KBoard.top(); $('atBody').innerHTML = topRows(t.list); $('atSrc').textContent = t.online ? 'Top global' : 'Top en este dispositivo'; }

/* ================= ONLINE ================= */
const olv = v => ['olA', 'olB', 'olC', 'olL'].forEach(x => { $(x).hidden = x !== v; });
function olErr(t) { const e = $('olErr'); e.textContent = t || ''; clearTimeout(olErr.t); if (t) olErr.t = setTimeout(() => { e.textContent = ''; }, 7000); }
function olStatus(t, on) { const e = $('olSt'); e.textContent = t; e.classList.toggle('on', !!on); }
function defSrv() { const q = new URLSearchParams(location.search).get('server'); return q || cfg.srv || DEFAULT_SERVER; }
function normSrv(s) {
  s = s.trim(); if (!/^wss?:\/\//i.test(s)) s = (location.protocol === 'https:' ? 'wss://' : 'ws://') + s;
  if (!/^wss?:\/\/[^\/]+\/./i.test(s)) s = s.replace(/\/+$/, '') + '/ws'; return s;
}
function openOnline() {
  A.init(); show('online'); $('olNick').value = cfg.nick; $('olSrv').value = defSrv();
  const L = G.lobby; olv(L && L.connected ? (L.room ? 'olC' : 'olB') : 'olA');
  if (L && L.connected) { olStatus('Conectado · ' + L.online + ' online', true); if (L.room) renderRoom(); }
  else olStatus('Desconectado');
}
function lobby() {
  if (G.lobby) return G.lobby;
  const L = G.lobby = new KNet.Lobby();
  L.on('welcome', m => olStatus('Conectado · ' + m.online + ' online', true));
  L.on('rooms', m => { olStatus('Conectado · ' + m.online + ' online', true); renderRooms(m.rooms); });
  L.on('room', () => { if (G.mode === 'online' && !G.attract) return; olv('olC'); renderRoom(); if (G.screen !== 'online') show('online'); });
  L.on('left', () => { if (!(G.mode === 'online' && !G.attract)) { olv('olB'); L.send({ t: 'list' }); } });
  L.on('err', t => olErr(t));
  L.on('chat', m => { chat.push(m); chat = chat.slice(-40); renderChat(); });
  L.on('start', m => startOnline(m));
  L.on('go', () => { G.wait = false; clearTimeout(G.waitT); });
  L.on('oppleft', () => rivalGone('Tu rival abandonó la partida'));
  L.on('reconnecting', () => { if (G.mode === 'online' && !G.attract) toast('Sin conexión… reconectando', 4000); });
  L.on('resumed', () => { if (G.net) G.net.lastProgress = performance.now(); toast('¡Reconectado!', 1800); });
  L.on('oppdown', g => { if (G.mode === 'online' && !G.attract) { G.oppDown = true; toast('Tu rival perdió la conexión: lo espero hasta ' + Math.round(g / 1000) + ' s', 5000); } });
  L.on('oppback', () => { G.oppDown = false; if (G.net) G.net.lastProgress = performance.now(); toast('Tu rival volvió', 1800); });
  L.on('down', was => { if (G.mode === 'online' && !G.attract) { if (G.sim && G.sim.phase === 'matchend') rivalGone('Se perdió la conexión con el servidor'); else endOnline('Se cortó la conexión con el servidor'); } olStatus('Desconectado'); if (G.screen === 'online') { olv('olA'); olErr(was ? 'Se cortó la conexión con el servidor' : ''); } chat = []; });
  return L;
}
let chat = [];
$('olCon').onclick = async () => {
  const nick = $('olNick').value.replace(/[<>]/g, '').trim(), raw = $('olSrv').value.trim(); cfg.nick = nick; cfg.srv = raw; save();
  if (!raw) { olErr('Escribí la dirección del servidor'); return; }
  const url = normSrv(raw);
  if (location.protocol === 'https:' && /^ws:\/\//i.test(url)) { olErr('Esta página usa https: el servidor tiene que ser wss://'); return; }
  if (navigator.onLine === false) { olErr('No tenés conexión a internet. Revisá tu red o probá el modo 2 pestañas.'); return; }
  olStatus('Conectando…'); $('olCon').disabled = true;
  try { await lobby().connect(url, nick || 'Jugador', colorOf(0)); olv('olB'); olErr(''); }
  catch (e) { olStatus('Desconectado'); olErr((e.message || 'No se pudo conectar') + ' (' + url + '). ¿Está encendido el servidor? Mientras tanto probá el modo 2 pestañas.'); }
  $('olCon').disabled = false;
};
$('olDis').onclick = () => { ui(); if (G.lobby) G.lobby.close(); olv('olA'); olStatus('Desconectado'); };
$('olRef').onclick = () => { ui(); G.lobby.send({ t: 'list' }); };
$('olMk').onclick = () => { ui(); G.lobby.send({ t: 'create', name: $('olRName').value, pass: $('olRPass').value }); };
$('olLeave').onclick = () => { ui(); G.lobby.send({ t: 'leave' }); };
$('olSend').onclick = say; $('olSay').addEventListener('keydown', e => { if (e.key === 'Enter') say(); });
function say() { const i = $('olSay'), t = i.value.trim(); if (t) G.lobby.send({ t: 'chat', text: t }); i.value = ''; }
function renderChat() { const c = $('olChat'); c.innerHTML = chat.map(x => '<div><b>' + esc(x.from) + ':</b> ' + esc(x.text) + '</div>').join(''); c.scrollTop = c.scrollHeight; }
function renderRooms(rooms) {
  $('olRooms').innerHTML = rooms.length ? rooms.map(r => {
    const full = r.n >= 2 || r.playing;
    return '<div class="slot"><div><b>' + (r.lock ? ic('lock') + ' ' : '') + esc(r.name) + '</b><small>' + esc(r.host) + ' · ' + (r.playing ? '● jugando' : r.n + '/2') + ' · #' + r.id + '</small></div><button class="btn" data-j="' + r.id + '" data-l="' + (r.lock ? 1 : 0) + '"' + (full ? ' disabled' : '') + '>' + (full ? 'Llena' : 'Unirse') + '</button></div>';
  }).join('') : '<p class="note">No hay salas todavía. ¡Creá la primera!</p>';
}
$('olRooms').onclick = e => {
  const b = e.target.closest('button[data-j]'); if (!b || b.disabled) return; ui(); let pass = '';
  if (b.dataset.l === '1') { pass = prompt('Contraseña de la sala:'); if (pass === null) return; }
  G.lobby.send({ t: 'join', id: +b.dataset.j, pass });
};
function renderRoom() {
  const L = G.lobby, r = L.room, me = L.me; if (!r) return; const host = me === 0, g = r.players[1];
  $('olRT').textContent = (r.lock ? '(con clave) ' : '') + r.name + ' · código #' + r.id;
  $('olSlots').innerHTML = [0, 1].map(i => {
    const p = r.players[i]; if (!p) return '<div class="slot off"><div><b>Esperando rival…</b><small>' + (i ? 'Visitante' : 'Local') + '</small></div></div>';
    return '<div class="slot' + (i === me ? ' me' : '') + '"><div><b><i class="dot" style="background:' + (hexOk(p.color) ? p.color : '#fff') + '"></i>' + esc(p.name) + (i === me ? ' (vos)' : '') + '</b><small>' + (i ? 'Visitante · ' : 'Anfitrión · ') + '</small></div><em>' + (i === 0 ? 'ANFITRIÓN' : (p.ready ? ic('check') + ' LISTO' : ic('hourglass') + ' no listo')) + '</em></div>';
  }).join('');
  $('olStage').value = r.stage; $('olWins').value = r.wins; $('olTime').value = r.time;
  ['olStage', 'olWins', 'olTime'].forEach(i => { $(i).disabled = !host; });
  const bt = $('olGo');
  if (host) { bt.textContent = g ? (g.ready ? 'Iniciar combate' : 'Esperando que el rival esté listo…') : 'Esperando rival…'; bt.disabled = !(g && g.ready); }
  else { bt.textContent = g && g.ready ? 'Quitar listo' : '¡Estoy listo!'; bt.disabled = false; }
  renderChat();
}
['olStage', 'olWins', 'olTime'].forEach(i => { $(i).onchange = () => G.lobby.send({ t: 'cfg', stage: +$('olStage').value, wins: +$('olWins').value, time: +$('olTime').value }); });
$('olGo').onclick = () => { ui(); const L = G.lobby; if (L.me === 0) L.send({ t: 'start' }); else { const g = L.room && L.room.players[1]; L.send({ t: 'ready', v: !(g && g.ready) }); } };

function startOnline(m) {
  const L = G.lobby; if (!m || !m.opts) return;
  G.side = m.side | 0; const names = (m.names || ['J1', 'J2']).map(n => String(n).toUpperCase().slice(0, 16));
  let colors = Array.isArray(m.colors) ? m.colors.slice(0, 2) : null;
  if (!colors) { colors = ['#ffffff', '#7fb6ff']; colors[G.side] = colorOf(0); } // servidor viejo sin colores: al menos te ves con el tuyo
  startMatch('online', { opts: { wins: m.opts.wins | 0 || 2, time: m.opts.time | 0, stage: m.opts.stage | 0 }, names, colors });
  G.sim = KSim.create({ wins: m.opts.wins | 0 || 2, time: m.opts.time | 0, mode: 'versus', stage: m.opts.stage | 0 });
  G.net = new KNet.Lockstep(L.transport(), G.side, { delay: m.delay | 0 || 5 });
  hookNet();
  G.wait = true; clearTimeout(G.waitT); G.waitT = setTimeout(() => { G.wait = false; }, 5000); L.send({ t: 'ld' });
}
/* resincronización: si los hashes difieren, el anfitrión manda su estado y el invitado lo adopta (ver KNet.Lockstep) */
function hookNet() {
  const n = G.net;
  n.snapFn = () => KSim.snapshot(G.sim);
  n.applyFn = d => KSim.restore(G.sim, d);
  n.onDesync = t => { G.desync++; if (G.desync > 12) { if (G.lobby) G.lobby.send({ t: 'quit' }); rivalGone('Las partidas no se pudieron sincronizar'); } };
  n.onResync = () => { toast('Conexión inestable: partida resincronizada', 2500); };
}
/* el rival se fue (abandono, timeout o corte sin vuelta): si la pelea seguía, gana el que queda; si ya había terminado, se muestra el resultado igual */
function rivalGone(note) {
  if (G.mode !== 'online' || G.attract || G.localEnd) return;
  const s = G.sim; if (!s || !G.net) { endOnline(note); return; }
  G.net.close(); G.localEnd = true; clearTimeout(G.waitT); G.wait = false;
  if (s.phase !== 'matchend') { G.forfeit = note; s.res = { winner: G.side, reason: 'forfeit', match: true, perfect: false }; s.wins[G.side] = Math.max(s.wins[G.side], s.opt.wins); s.phase = 'matchend'; s.phaseT = 0; }
  else G.forfeit = note;
  toast(note, 4000);
}
function endOnline(note) {
  G.localEnd = false; G.oppDown = false; clearTimeout(G.waitT); G.wait = false; if (G.net) G.net.close(); G.net = null;
  if (G.local) { G.local.bc && G.local.bc.close(); G.local.tx && G.local.tx.close && G.local.tx.close(); G.local = null; }
  toAttract(); show('online');
  const L = G.lobby; if (L && L.connected) { olv(L.room ? 'olC' : 'olB'); if (L.room) renderRoom(); else L.send({ t: 'list' }); } else olv('olA');
  if (note) olErr(note);
}
function onlineQuit() { if (G.lobby && G.lobby.connected && G.lobby.room) G.lobby.send({ t: 'quit' }); endOnline(); }

/* ---- modo 2 pestañas (BroadcastChannel, sin servidor) ---- */
$('olLocal').onclick = () => { ui(); if (!window.BroadcastChannel) { olErr('Tu navegador no soporta BroadcastChannel'); return; } olv('olL'); olErr(''); };
$('olLBack').onclick = () => { ui(); localStop(); olv('olA'); };
function localStop() { if (G.local && G.local.bc) { G.local.bc.close(); G.local.timer && clearInterval(G.local.timer); } G.local = null; olStatus('Desconectado'); }
function startLocal(role, seed, opts, names, colors) {
  const tx = KNet.BCTransport('leiakombat-game-' + seed, role), side = role;
  const keepBc = G.local && G.local.bc; if (keepBc) keepBc.close(); if (G.local && G.local.timer) clearInterval(G.local.timer);
  startMatch('online', { opts, names, colors }); G.side = side; A.viewer = side; G.local = { tx };
  G.sim = KSim.create({ wins: opts.wins, time: opts.time, mode: 'versus', stage: opts.stage });
  G.net = new KNet.Lockstep(tx, side, { delay: 5 }); hookNet();
}
$('olLHost').onclick = () => {
  ui(); localStop(); const bc = new BroadcastChannel('leiakombat-local'), nick = (cfg.nick || 'LEIA').toUpperCase();
  G.local = { bc }; olStatus('Esperando que otra pestaña toque “Unirme”…', true);
  bc.onmessage = e => {
    const m = e.data; if (!m || m.t !== 'join') return;
    const seed = (Math.random() * 0x7fffffff) | 0, opts = { wins: cfg.wins, time: cfg.time, stage: cfg.stage }, names = [nick, String(m.name || 'J2').toUpperCase().slice(0, 16)], colors = [colorOf(0), hexOk(m.color) ? m.color : '#7fb6ff'];
    bc.postMessage({ t: 'start', to: m.id, seed, opts, names, colors }); startLocal(0, seed, opts, names, colors);
  };
};
$('olLJoin').onclick = () => {
  ui(); localStop(); const bc = new BroadcastChannel('leiakombat-local'), id = Math.random().toString(36).slice(2), nick = (cfg.nick || 'LEIA').toUpperCase();
  const timer = setInterval(() => bc.postMessage({ t: 'join', id, name: nick, color: colorOf(0) }), 600); bc.postMessage({ t: 'join', id, name: nick, color: colorOf(0) });
  G.local = { bc, timer }; olStatus('Buscando una partida en otra pestaña…', true);
  bc.onmessage = e => { const m = e.data; if (!m || m.t !== 'start' || m.to !== id) return; startLocal(1, m.seed, m.opts, m.names, m.colors); };
};

/* 2 jugadores: en celu solo con joystick */
function sync2p() {
  const t = document.querySelector('[data-go="2p"]'); if (!t) return;
  const pad = !!((navigator.getGamepads && [...navigator.getGamepads()]) || []).some(p => p && p.connected), need = !!G.touch && !pad;
  t.classList.toggle('dis', need); const k = t.querySelector('.kbonly'); if (k) k.textContent = !G.touch ? 'Mismo teclado o joystick' : need ? 'Necesita un joystick' : 'Con dos joysticks';
}
addEventListener('gamepadconnected', sync2p); addEventListener('gamepaddisconnected', sync2p);

/* ---------- tutorial: conexión con el módulo ---------- */
KTutorial.init({
  cfg, save, canvas: R.cv, play: n => A.play(n), sim: () => G.sim, kind: () => G.inKind,
  onFight() { G.tw = null; G.arc = null; startMatch('cpu'); },
  onExit() { cfg.tutAsked = 1; save(); toAttract(); show('menu'); }
});
$('fTut').onclick = () => { ui(); G.tw = null; G.arc = null; startMatch('tutorial'); };
$('fSkip').onclick = () => {
  ui(); cfg.tutAsked = 1; save(); const g = G.pendingGo;
  if (g === 'arcade') arcadeNew(); else if (g === 'tower') { buildTower(); show('tower'); } else { G.tw = null; G.arc = null; startMatch('cpu'); }
};

/* ---------- arranque ---------- */
async function boot() {
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  try { await withTimeout(Promise.all([document.fonts.load('20px "Silkscreen"'), document.fonts.load('14px "Pixelify Sans"')]), 2500); } catch (e) {}
  const slow = setTimeout(() => { $('loadTxt').textContent = 'Está tardando más de lo normal. Revisá tu conexión…'; if ($('loadRetry')) $('loadRetry').hidden = false; }, 12000);
  try { await R.load('assets/kombat/', (n, t) => { $('loadTxt').textContent = 'Cargando ' + n + '/' + t + '…'; }); }
  catch (e) { clearTimeout(slow); $('loadTxt').textContent = navigator.onLine === false ? 'Sin conexión a internet. Conectate y reintentá.' : 'No se pudieron cargar las imágenes del juego. Reintentá.'; if ($('loadRetry')) $('loadRetry').hidden = false; return; }
  clearTimeout(slow); if ($('loadRetry')) $('loadRetry').hidden = true;
  R.onTier = t => document.body.classList.toggle('lowfx', t === 0); applyQuality(); applyMotion(); watchBattery();
  R.resize(); buildOpts(); applyTouch(); sync2p(); toAttract(); show('menu');
  A.music && 0;
  requestAnimationFrame(ts => { G.last = ts; frame(ts); });
  setTimeout(() => $('load').classList.add('off'), 300); setTimeout(() => { const l = $('load'); l && l.remove(); }, 1100);
}
window.__k = { G, R, KSim, A, cfg, startMatch, tickOnce, show };
boot();
})();
