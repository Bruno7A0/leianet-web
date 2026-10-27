/* LeiaKOMBAT · simulación determinista (sin DOM, sin canvas, sin Math.random)
   Todo el combate depende SOLO de: opciones + inputs (máscara de bits por jugador) + tick fijo de 60 Hz.
   Eso es lo que hace posible el online por lockstep: los dos clientes simulan lo mismo con los mismos inputs. */
(function (root) {
'use strict';
const W = 1280, H = 600, GROUND = 520, SC = .62, WALL = 80, DT = 1 / 60;
const K = {
  W, H, GROUND, SC, WALL, DT,
  GRAV: 1500, FALL_MULT: 1.55, JUMP_V: 470, JUMP_CUT: .6, AIR_HIT: 44, CROUCH_SCALE: .7,
  /* BALANCE · tabla de ataques (60 ticks = 1 s). Arranque = ticks hasta que conecta; el resto sale de ANIM.
       puñetazo: rápido y corto   · arranque 10 · alcance 165 · daño 8  · stun .30
       patada:   lenta y larga    · arranque 16 · alcance 176 · daño 12 · stun .38 · pega al agachado y al salto bajo
       ladrido:  16 de daño a distancia, se esquiva agachado/saltando/volteretas */
  HIT_FRAME: 21, DMG: 8, STAM_MAX: 100, STAM_DRAIN: 34, STAM_REGEN: 20, STAM_MIN: 22, RUN_MULT: 1.7, DMG_BLOCK: 1, KICK_HIT: 5, KICK_RANGE: 284 * SC, AIR_DMG: .7, DMG_KICK: 12, DMG_SPEC: 15, DMG_SPEC_BLOCK: 3,
  /* COMBOS: si tu golpe conecta (sin ser bloqueado) podés cancelar la recuperación con otro ataque. Cadena máx. 4 ataques.
     Final de combo: patada desde el 3er ataque, o el 4to ataque = más daño, más aturdimiento y empuje. */
  CHAIN_MAX: 3, CHAIN_GAP: .05, CHAIN_STEP: 10, DMG_FIN: 11, DMG_FIN_KICK: 17, FIN_STUN: .22,
  AIR_HIT_KICK: 62,                              // la patada alcanza al que salta bajo (anti-salto); el puño no
  /* bloquear cuesta estamina: sin freno, la tortuga era imbatible. Sin estamina el golpe entra completo ("guardia rota") */
  BLOCK_COST: 9, BLOCK_COST_KICK: 15, BLOCK_COST_WAVE: 22, BLOCK_PAUSE: .6,
  /* voltereta: cuesta estamina, tiene más enfriamiento y te deja quieto un instante al caer */
  ROLL_CD: 2, ROLL_COST: 30, ROLL_INV: .32, ROLL_LAG: .28, LAND_LAG: .26,
  RANGE: 266 * SC, MIN_DIST: 170 * SC, SPEED: 190, STUN: .3, BSTUN: .12,
  WAVE_V: 640, WAVE_LIFE: 1.5, METER_MAX: 100, WAVE_STUN: .35, STORM_STUN: .2, STORM_GAP: .34,
  DMG_STORM: 6, DMG_METEOR: 17, DMG_QUAKE: 12, DMG_BONE: 10, SHIELD_T: 3, METEOR_DELAY: .95, QUAKE_V: 720, BONE_V: 560,
  DROP_FIRST: 8, DROP_MIN: 9, DROP_VAR: 5
};
/* poderes que caen del cielo: se agarran caminando encima y se sueltan con POW */
const POWERS = ['storm', 'meteor', 'quake', 'bone', 'shield'];
/* bits de input */
const IN = { L: 1, R: 2, JUMP: 4, CROUCH: 8, BLOCK: 16, PL: 32, PR: 64, ROLL: 128, SPEC: 256, START: 512, POW: 1024, RUN: 2048 };
/* hojas de sprites: ax = x del cuerpo dentro del frame, fy = y de los pies */
const META = {
  idle:   { n: 16, w: 219, h: 370, cols: 8, ax: 100, fy: 368 },
  walk:   { n: 16, w: 283, h: 370, cols: 8, ax: 127, fy: 368 },
  blockwalk: { n: 16, w: 283, h: 370, cols: 8, ax: 127, fy: 368 },
  kick:   { n: 12, w: 600, h: 380, cols: 4, ax: 200, fy: 372 },
  block:  { n: 32, w: 264, h: 380, cols: 8, ax: 108, fy: 372 },
  punchR: { n: 29, w: 264, h: 380, cols: 8, ax: 109, fy: 375 },
  punchL: { n: 29, w: 328, h: 380, cols: 8, ax: 109, fy: 375 }
};
/* [hoja, frame inicial, frame final, ms por frame, loop] */
const ANIM = {
  idle:   ['idle', 0, 15, 80, true],
  walk:   ['walk', 0, 15, 55, true],
  run:    ['walk', 0, 15, 30, true],
  blockwalk: ['blockwalk', 0, 15, 55, true],
  kick:   ['kick', 0, 11, 52, false],
  block:  ['block', 17, 30, 70, true],
  punchR: ['punchR', 16, 28, 34, false],
  punchL: ['punchL', 16, 28, 34, false]
};

/* Math.pow/exp pueden diferir en el último bit entre navegadores/CPUs y romper el lockstep: constante fija (= .0005^(1/60)) */
const KX_DECAY = 0.8810140479978791;
function mk(x, dir, bo) {
  return {
    spd: bo && bo.spd || 1, dm: bo && bo.dm || 1, mt: bo && bo.mt || 0, mg: bo && bo.mg || 1,
    x, dir, hp: 100, anim: 'idle', t: 0, state: 'idle', punchHit: false, special: false, flash: 0, shake: 0,
    kx: 0, inv: 0, y: 0, vy: 0, vx: 0, sy: 1, sx: 1, land: 0, cut: false, cross: false, crossDir: 1, crossV: 0,
    rollCd: 0, rlag: 0, ko: false, grace: 0, stun: 0, bstun: 0, meter: 0, lastH: dir,
    jb: 0, pb: null, pbt: 0, rb: 0, sb: 0, dmgTaken: 0, px: x, py: 0,
    chain: 0, conn: false, fin: false, power: '', wb: 0, shield: 0, stepT: 0, alt: 0, kick: false, stam: 100, tired: false, run: false, stamD: 0
  };
}
/* lado de un luchador: 0 = jugador, 1 = bando enemigo (el perro 2 de Arcade es aliado del 1) */
function sd(i) { return i ? 1 : 0; }
/* a quién ataca el luchador i: los enemigos van por el jugador; el jugador va por el enemigo vivo más cercano */
function tg(s, i) {
  if (i > 0) return 0;
  const a = s.f[1];
  if (s.f.length < 3) return 1;
  const b = s.f[2];
  if (a.ko && !b.ko) return 2;
  if (b.ko && !a.ko) return 1;
  return Math.abs(b.x - s.f[0].x) < Math.abs(a.x - s.f[0].x) ? 2 : 1;
}
function ev(s, o) { if (s.events.length < 240) s.events.push(o); }
function sfx(s, n, v, who, kind) { ev(s, { k: 'sfx', n, v: v || 0, who: who == null ? -1 : sd(who), kind: kind || '' }); }   // who = lado que lo origina (0 jugador / 1 rival)

function create(opt) {
  opt = opt || {};
  const s = {
    opt: { wins: opt.wins || 2, time: opt.time == null ? 60 : opt.time, mode: opt.mode || 'versus', stage: opt.stage | 0, partner: !!opt.partner, boost: opt.boost || null },
    tick: 0, round: 0, wins: [0, 0], phase: 'intro', phaseT: 0, timeLeft: 0, f: null, proj: [], events: [],
    combo: [{ n: 0, t: 0 }, { n: 0, t: 0 }], freeze: 0, koSlow: 0, slow: 0, prev: [0, 0, 0], res: null, beeped: 0,
    stats: null, nid: 1, regen: 0, items: [], hz: [], dropT: K.DROP_FIRST,
    rs: (0x9e3779b9 ^ (((opt.stage | 0) + 1) * 2654435761)) >>> 0
  };
  newMatch(s);
  return s;
}
function newMatch(s) {
  s.wins = [0, 0]; s.round = 0; s.res = null;
  s.stats = [0, 1].map(() => ({ hits: 0, maxCombo: 0, dmg: 0, blocked: 0, waves: 0, powers: 0 }));
  startRound(s);
}
function startRound(s) {
  s.round++;
  const bo = s.opt.boost || [];
  s.f = [mk(330, 1), mk(950, -1, bo[1])];
  if (s.opt.partner) s.f.push(mk(1120, -1, bo[2] || bo[1]));
  s.proj = []; s.items = []; s.hz = []; s.dropT = K.DROP_FIRST; s.phase = 'intro'; s.phaseT = 0; s.res = null; s.beeped = 0;
  s.timeLeft = s.opt.time; s.combo = [{ n: 0, t: 0 }, { n: 0, t: 0 }]; s.freeze = 0; s.koSlow = 0; s.slow = 0;
  // el medidor de ladrido se conserva entre rondas (a medias)
}
function endRound(s, w, reason) {
  if (w >= 0) s.wins[w]++;
  const match = s.wins[0] >= s.opt.wins || s.wins[1] >= s.opt.wins;
  s.phase = match ? 'matchend' : 'roundend'; s.phaseT = 0;
  s.res = { winner: w, reason, match, perfect: w >= 0 && s.f[w].dmgTaken === 0 };
  ev(s, { k: 'end', winner: w, match, reason });
}

function rand(s) { s.rs = (Math.imul(s.rs, 1664525) + 1013904223) >>> 0; return s.rs / 4294967296; }

/* ---------- animación ---------- */
function setAnim(f, name) { if (f.anim !== name) { f.anim = name; f.t = 0; } }
function frameOf(f) {
  const a = ANIM[f.anim], total = a[2] - a[1] + 1; let i = Math.floor(f.t / a[3]);
  if (a[4]) i %= total; else i = Math.min(i, total - 1);
  return a[1] + i;
}
function animDone(f) { const a = ANIM[f.anim]; return !a[4] && f.t >= (a[2] - a[1] + 1) * a[3]; }
function startPunch(s, f, side, special, chain) {
  f.state = 'punch'; f.punchHit = false; f.special = !!special; f.kick = false; f.conn = false; f.chain = chain | 0; f.fin = false;
  /* Q (side 'L') = patada; E (side 'R') = puñetazo que alterna derecho / izquierdo en cada toque */
  let anim;
  if (!special && side === 'L') { f.kick = true; anim = 'kick'; }
  else if (special) anim = 'punchR';
  else { anim = f.alt ? 'punchL' : 'punchR'; f.alt ^= 1; }
  f.fin = !special && ((f.kick && f.chain >= 2) || f.chain >= K.CHAIN_MAX);   // remate del combo
  setAnim(f, anim); f.t = 0;
  if (special) ev(s, { k: 'windup', who: -1 });
  else sfx(s, f.kick ? 'kick' : 'punch', 0, s.f.indexOf(f));
}

/* ---------- física / estado ---------- */
function doJump(s, f, mv) {
  f.vy = K.JUMP_V; f.y = 1; f.vx = mv * K.SPEED; f.cut = false; f.land = 0;
  ev(s, { k: 'dust', x: f.x, n: 5 }); sfx(s, 'jump');
}
function doRoll(s, f, o) {
  const v = K.JUMP_V * .95, h = v * v / (2 * K.GRAV), T = v / K.GRAV + Math.sqrt(2 * h / (K.GRAV * K.FALL_MULT));
  let tx = o.x + f.dir * K.MIN_DIST * 1.15; tx = Math.max(WALL, Math.min(W - WALL, tx));
  f.crossDir = tx >= f.x ? 1 : -1; f.crossV = Math.min(900, Math.abs(tx - f.x) / T);
  f.vy = v; f.y = 1; f.cross = true; f.inv = K.ROLL_INV; f.cut = true; f.rollCd = K.ROLL_CD; f.vx = 0; f.land = 0; f.stam = Math.max(0, f.stam - K.ROLL_COST); f.stamD = Math.max(f.stamD, .6);
  ev(s, { k: 'dust', x: f.x, n: 8 }); sfx(s, 'roll');
}
function clamp(f) { f.x = Math.max(WALL, Math.min(W - WALL, f.x)); }

function upd(s, i, inp, ctl) {
  const f = s.f[i], o = s.f[tg(s, i)], dt = DT;
  f.t += dt * 1000;
  if (!f.ko) f.dir = o.x > f.x ? 1 : -1;
  if (f.flash > 0) f.flash -= dt;
  if (f.inv > 0) f.inv -= dt;
  if (f.rollCd > 0) f.rollCd -= dt;
  if (f.rlag > 0) f.rlag -= dt;
  if (f.land > 0) f.land -= dt;
  if (f.jb > 0) f.jb -= dt;
  if (f.pbt > 0) { f.pbt -= dt; if (f.pbt <= 0) f.pb = null; }
  if (f.rb > 0) f.rb -= dt;
  if (f.sb > 0) f.sb -= dt;
  if (f.wb > 0) f.wb -= dt;
  if (f.shield > 0) f.shield -= dt;
  if (f.stun > 0) f.stun -= dt;
  if (f.bstun > 0) f.bstun -= dt;
  if (f.shake > 0) f.shake -= dt;
  if (Math.abs(f.kx) > 1) { f.x += f.kx * dt * 8; f.kx *= KX_DECAY; } else f.kx = 0;

  // estamina: correr la gasta; si no corrés (tras una pausa corta) se recupera. Agotada = cansada hasta recuperar un mínimo
  if (f.run) f.stamD = .45; else if (f.stamD > 0) f.stamD -= dt; else f.stam = Math.min(K.STAM_MAX, f.stam + K.STAM_REGEN * dt);
  if (f.tired && f.stam >= K.STAM_MIN) f.tired = false;
  if (f.mt && s.phase === 'fight') gain(f, f.mt * dt);   // jefes tipo LADRIDO: el medidor se carga solo
  f.run = false;
  const can = ctl && !f.ko && f.stun <= 0 && f.rlag <= 0;
  let mv = 0, wantRun = false, blk = false, crouch = false, punch = null, jump = false, roll = false, spec = false, pw = false;
  if (can) {
    const l = inp & IN.L, r = inp & IN.R;
    mv = (l && r) ? f.lastH : (r ? 1 : (l ? -1 : 0));
    blk = !!(inp & IN.BLOCK); crouch = !!(inp & IN.CROUCH); wantRun = !!(inp & IN.RUN);
    punch = f.pb; roll = f.rb > 0; jump = f.jb > 0; spec = f.sb > 0; pw = f.wb > 0;
  }
  const grounded = f.y === 0 && f.vy === 0;
  if (spec && grounded && f.meter >= K.METER_MAX && f.state !== 'punch' && !f.cross && !blk && !crouch) {
    f.meter = 0; f.sb = 0; f.pb = null; f.pbt = 0; startPunch(s, f, 'R', true); clamp(f); return;
  }
  if (pw && grounded && f.power && f.state !== 'punch' && !f.cross) { usePower(s, i); if (f.state === 'punch') { clamp(f); return; } }
  if (roll && grounded && f.rollCd <= 0 && f.stam >= K.ROLL_COST && f.state !== 'punch') { f.rb = 0; doRoll(s, f, o); }
  else if (jump && grounded && f.state !== 'punch' && !blk && !crouch) { f.jb = 0; doJump(s, f, mv); }

  // salto variable: soltar la tecla antes corta el salto
  if (f.vy > 0 && !f.cut && !(inp & IN.JUMP) && !f.cross) { f.vy *= K.JUMP_CUT; f.cut = true; }
  // física vertical (cae más rápido de lo que sube = salto con "peso")
  if (f.y > 0 || f.vy > 0) {
    f.vy -= (f.vy < 0 ? K.GRAV * K.FALL_MULT : K.GRAV) * dt; f.y += f.vy * dt;
    if (f.cross) f.x += f.crossDir * f.crossV * dt;
    else { f.vx += (mv * K.SPEED - f.vx) * Math.min(1, dt * 5); f.x += f.vx * dt; }
    if (f.y <= 0) {
      const hard = f.vy < -220, wasRoll = f.cross; f.y = 0; f.vy = 0; f.vx = 0; f.cross = false;
      f.rlag = Math.max(f.rlag, wasRoll ? K.ROLL_LAG : (hard ? K.LAND_LAG : 0));   // caer cuesta un instante: se puede castigar
      if (hard) { f.land = .13; ev(s, { k: 'dust', x: f.x, n: 7 }); sfx(s, 'land'); }
    }
  }
  const air = f.y > 0;
  // estirar al subir, aplastar al caer
  let tsx = 1, tsy = 1;
  if (f.land > 0) { tsx = 1.1; tsy = .84; }
  else if (air) { if (f.vy > 0) { tsx = .93; tsy = 1.07; } else { tsx = .97; tsy = 1.03; } }
  else if (f.state === 'crouch') tsy = K.CROUCH_SCALE;
  f.sx += (tsx - f.sx) * Math.min(1, dt * 16); f.sy += (tsy - f.sy) * Math.min(1, dt * 16);

  if (f.ko) { setAnim(f, 'idle'); clamp(f); return; }
  if (f.stun > 0) { f.state = 'hurt'; setAnim(f, 'idle'); clamp(f); return; }
  if (f.state === 'hurt') f.state = 'idle';

  if (f.state === 'punch') {
    const fr = frameOf(f), air0 = f.y > 0;
    if (!f.punchHit && fr >= (f.kick ? K.KICK_HIT : K.HIT_FRAME)) {
      f.punchHit = true; f.hitT = f.t;
      if (f.special) spawnWave(s, i);
      else {
        const r = f.kick ? tryHit(s, i, tg(s, i), K.KICK_RANGE, f.fin ? K.DMG_FIN_KICK : K.DMG_KICK) : tryHit(s, i, tg(s, i), 0, f.fin ? K.DMG_FIN : K.DMG);
        ev(s, { k: 'swing', x: f.x, y: GROUND - 150 - f.y, dir: f.dir, kick: f.kick, miss: r === 0, who: i });
        if (r === 0 && s.phase === 'fight') sfx(s, 'whiff');
      }
    }
    /* COMBO: golpe conectado + otro ataque apretado = cancela la recuperación y encadena (en el piso, sin remate previo) */
    if (f.punchHit && f.conn && !f.special && !f.fin && f.chain < K.CHAIN_MAX && !air0 && punch && f.t >= f.hitT + K.CHAIN_GAP * 1000 && !animDone(f)) {
      const n = f.chain + 1; f.pb = null; f.pbt = 0; f.x += f.dir * K.CHAIN_STEP;
      startPunch(s, f, punch, false, n); ev(s, { k: 'chain', who: i, n: n + 1, x: f.x }); clamp(f); return;
    }
    if (animDone(f)) { f.state = 'idle'; f.special = false; f.chain = 0; f.fin = false; f.conn = false; }
    else { clamp(f); return; }
  }
  if (air) {
    if (f.state === 'block' || f.state === 'crouch') f.state = 'idle';
    if (punch) { f.pb = null; f.pbt = 0; startPunch(s, f, punch, false); clamp(f); return; }
    if (f.cross) { f.state = 'idle'; setAnim(f, 'idle'); }
    else if (mv !== 0) { f.state = 'walk'; setAnim(f, 'walk'); }
    else { f.state = 'idle'; setAnim(f, 'idle'); }
  } else if (crouch) { f.state = 'crouch'; setAnim(f, 'idle'); f.x += mv * 70 * dt; }  // agachada = animación idle aplastada (CROUCH_SCALE)
  else if (blk) { f.state = 'block'; setAnim(f, mv !== 0 ? 'blockwalk' : 'block'); f.x += mv * 90 * dt; }
  else {
    if (f.state === 'block' || f.state === 'crouch') f.state = 'idle';
    if (punch) { f.pb = null; f.pbt = 0; startPunch(s, f, punch, false); clamp(f); return; }
    if (mv !== 0) {
      const sprint = wantRun && !f.tired && f.stam > 0;
      f.state = 'walk'; setAnim(f, sprint ? 'run' : 'walk'); f.x += mv * K.SPEED * f.spd * (sprint ? K.RUN_MULT : 1) * dt; f.grace = .12; f.stepT -= dt;
      if (sprint) { f.run = true; f.stam = Math.max(0, f.stam - K.STAM_DRAIN * dt); if (f.stam <= 0) f.tired = true; }
      if (f.stepT <= 0) { f.stepT = sprint ? .09 : .17; ev(s, { k: 'dust', x: f.x - f.dir * 24, n: sprint ? 2 : 1 }); }
    }
    else if (f.grace > 0 && (f.anim === 'walk' || f.anim === 'run')) f.grace -= dt;
    else { f.state = 'idle'; setAnim(f, 'idle'); }
  }
  clamp(f);
}

/* ---------- golpes ---------- */
function gain(f, n) { f.meter = Math.min(K.METER_MAX, f.meter + n * (f.mg || 1)); }
function tryHit(s, ai, di, range, dmg) {
  const a = s.f[ai], d = s.f[di];
  if (Math.abs(a.x - d.x) > (range || K.RANGE) || s.phase !== 'fight') return 0;
  const hy = GROUND - 150 - d.y;
  if (d.inv > 0 || d.y > (a.kick ? K.AIR_HIT_KICK : K.AIR_HIT) || (d.state === 'crouch' && !a.kick)) { ev(s, { k: 'dodge', x: d.x, y: hy - 30 }); sfx(s, 'dodge'); return 1; }
  applyHit(s, ai, di, dmg || K.DMG, false, a.x); return 2;
}
function applyHit(s, ai, di, dmg, wave, fromX, stn) {
  const a = s.f[ai], d = s.f[di];
  const hy = GROUND - 150 - d.y; let blocked = d.state === 'block', crush = false;
  /* bloquear gasta estamina; sin estamina suficiente se rompe la guardia y el golpe entra completo */
  if (blocked) {
    const cost = wave ? K.BLOCK_COST_WAVE : (a.kick ? K.BLOCK_COST_KICK : K.BLOCK_COST);
    if (d.stam >= cost) { d.stam -= cost; d.stamD = Math.max(d.stamD, K.BLOCK_PAUSE); }
    else { blocked = false; crush = true; d.stam = 0; d.tired = true; d.stamD = 1.2; }
  }
  if (d.shield > 0) {
    d.shield = Math.max(0, d.shield - 1); d.inv = .15; d.kx = (fromX <= d.x ? 1 : -1) * 8; s.freeze = .03;
    ev(s, { k: 'hit', x: d.x - (fromX <= d.x ? 1 : -1) * 20, y: hy, dir: fromX <= d.x ? 1 : -1, blocked: true, shield: true, dmg: 0, wave, by: ai, to: di }); sfx(s, 'shield'); return;
  }
  const fin = !wave && a.fin;
  const kind = wave ? 'wave' : (a.kick ? 'kick' : 'punch'), heavy = kind === 'kick';
  /* contraataque: lo agarrás mientras prepara su golpe (antes de que conecte) */
  const counter = !blocked && !wave && d.state === 'punch' && !d.punchHit && !d.special;
  if (blocked) dmg = wave ? K.DMG_SPEC_BLOCK : K.DMG_BLOCK; else dmg = Math.round(dmg * a.dm * (counter ? 1.25 : 1) * (a.y > 20 && !wave ? K.AIR_DMG : 1));   // golpe aéreo: 80%
  const sa = sd(ai), sdd = sd(di);
  const dir = fromX <= d.x ? 1 : -1;
  d.hp = Math.max(0, d.hp - dmg);
  const st = s.stats[sa];
  st.dmg += dmg;
  const cb = s.combo[sa], cn = !blocked && cb.t > 0 ? cb.n + 1 : 1;   // golpe N del combo
  const wall = d.x <= WALL + 6 || d.x >= W - WALL - 6;                  // arrinconado: el que pega retrocede
  if (blocked) { st.blocked++; d.bstun = K.BSTUN; d.inv = .2; d.kx = dir * (wave ? 22 : 6); if (!wave) a.kx = -dir * (wall ? 16 : 2); }   // bloqueado: poco empuje, así el golpe fallido se puede castigar
  else {
    if (!wave) a.conn = true;
    st.hits++; d.dmgTaken += dmg; d.inv = .12; d.stun = (stn != null ? stn : wave ? K.WAVE_STUN : heavy ? K.STUN + .08 : K.STUN) + (counter ? .1 : 0) + (crush ? .1 : 0) + (fin ? K.FIN_STUN : 0); d.flash = .18; d.shake = counter || heavy ? .22 : .15;
    d.kx = dir * (wave ? 40 : heavy ? 46 : 26) * (counter ? 1.25 : 1) * (cn > 2 ? .78 : 1) * (fin ? 1.9 : 1);   // en un combo largo empuja menos, para no escapar
    if (wall && !wave) a.kx = -dir * (heavy ? 30 : 20);
    if (d.state === 'punch') { d.state = 'hurt'; d.special = false; }
    d.pb = null; d.pbt = 0;
    cb.n = cn; cb.t = 1.4; if (cn > st.maxCombo) st.maxCombo = cn;
    s.combo[sdd].n = 0; s.combo[sdd].t = 0;
  }
  gain(a, blocked ? 3 : 8); gain(d, blocked ? 2 : 10);
  /* hitstop: cuanto más fuerte el golpe, más se "clava" el instante del impacto */
  s.freeze = blocked ? .04 : (wave ? .11 : heavy ? .1 : .07) + (counter || fin ? .05 : 0);
  ev(s, { k: 'hit', x: d.x - dir * 20, y: hy, dir, blocked, dmg, wave, by: ai, to: di, kind, counter, cn, crush, fin: fin && !blocked });
  sfx(s, blocked ? 'block' : (counter || fin) ? 'hitC' : wave ? 'hitW' : heavy ? 'hitK' : 'hitP', cn, ai, kind);
  if (d.hp <= 0) {
    if (s.opt.mode === 'practice') { d.hp = 100; s.regen = 0; return; }
    d.ko = true; s.koSlow = 1.1; d.kx = dir * 40; sfx(s, 'ko');
    ev(s, { k: 'ko', to: di, by: ai, x: d.x });
    if (di === 0) endRound(s, 1, 'ko');
    else if (s.f.slice(1).every(q => q.ko)) endRound(s, 0, 'ko');
  }
}
function spawnWave(s, i, dmg, stn, quiet) {
  const f = s.f[i];
  s.proj.push({ id: s.nid++, x: f.x + f.dir * 70, dir: f.dir, owner: i, life: K.WAVE_LIFE, dmg: dmg || K.DMG_SPEC, kind: 'wave', stn });
  s.stats[sd(i)].waves++;
  ev(s, { k: 'wave', x: f.x + f.dir * 70, dir: f.dir, owner: i });
  if (!quiet) sfx(s, 'bark', 0, i);   // el ladrido suena justo cuando sale la onda
}
function updProj(s) {
  const dt = DT;
  for (const p of s.proj) {
    p.life -= dt;
    if (p.kind === 'bone') {
      p.age = (p.age || 0) + dt;
      if (!p.back && p.age > .7) { p.back = true; p.dir = -p.dir; }
      p.x += p.dir * K.BONE_V * dt;
      if (p.back && Math.abs(p.x - s.f[p.owner].x) < 40) p.life = 0;
      if (p.x < -60 || p.x > W + 60) p.life = 0;
      continue;
    }
    p.x += p.dir * K.WAVE_V * dt;
    if (p.x < -60 || p.x > W + 60) p.life = 0;
  }
  // dos ladridos que se cruzan se anulan
  for (let a = 0; a < s.proj.length; a++) for (let b = a + 1; b < s.proj.length; b++) {
    const A = s.proj[a], B = s.proj[b];
    if (A.life > 0 && B.life > 0 && sd(A.owner) !== sd(B.owner) && Math.abs(A.x - B.x) < 46) {
      A.life = B.life = 0; ev(s, { k: 'clash', x: (A.x + B.x) / 2, y: GROUND - 140 }); sfx(s, 'block');
    }
  }
  for (const p of s.proj) {
    if (p.life <= 0 || s.phase !== 'fight') continue;
    const tl = p.owner === 0 ? s.f.map((q, n) => n).slice(1) : [0];
    for (const di of tl) {
      const d = s.f[di];
      if (Math.abs(p.x - d.x) < 48) {
        if (d.inv > 0 || d.y > K.AIR_HIT || d.state === 'crouch' || d.ko) { continue; }
        p.life = 0; applyHit(s, p.owner, di, p.kind === 'bone' ? K.DMG_BONE : (p.dmg || K.DMG_SPEC), p.kind !== 'bone', p.x - p.dir * 30, p.stn);
        break;
      }
    }
  }
  s.proj = s.proj.filter(p => p.life > 0);
}
/* ---------- poderes ---------- */
function usePower(s, i) {
  const f = s.f[i], o = s.f[tg(s, i)], k = f.power;
  f.power = ''; f.wb = 0; s.stats[sd(i)].powers++;
  ev(s, { k: 'cast', who: i, kind: k, x: f.x });
  if (k === 'shield') { f.shield = K.SHIELD_T; sfx(s, 'shield'); return; }
  f.state = 'punch'; f.punchHit = true; f.special = false; f.kick = false; setAnim(f, 'punchR'); f.t = 0;
  if (k === 'storm') { sfx(s, 'storm'); s.hz.push({ k: 'storm', owner: i, t: 0, n: 3, next: .08 }); }
  else if (k === 'meteor') { sfx(s, 'meteor'); s.hz.push({ k: 'meteor', owner: i, x: o.x, t: 0, delay: K.METEOR_DELAY }); }
  else if (k === 'quake') { sfx(s, 'quake'); s.hz.push({ k: 'quake', owner: i, x: f.x, t: 0, hit: false }); }
  else if (k === 'bone') { sfx(s, 'bone'); s.proj.push({ id: s.nid++, x: f.x + f.dir * 60, dir: f.dir, owner: i, life: 1.6, kind: 'bone', age: 0, back: false }); }
}
function updItems(s) {
  const dt = DT;
  if (s.phase === 'fight') {
    s.dropT -= dt;
    if (s.dropT <= 0 && s.items.length < 2) {
      const it = { id: s.nid++, x: 230 + rand(s) * 820, y: 460, vy: 0, kind: POWERS[Math.floor(rand(s) * POWERS.length)], life: 14 };
      s.items.push(it); s.dropT = K.DROP_MIN + rand(s) * K.DROP_VAR; sfx(s, 'drop'); ev(s, { k: 'drop', x: it.x, kind: it.kind });
    } else if (s.dropT <= 0) s.dropT = 1;
  }
  for (const it of s.items) {
    if (it.y > 0) { it.vy -= 900 * dt; it.y += it.vy * dt; if (it.y <= 0) { it.y = 0; it.vy = 0; ev(s, { k: 'dust', x: it.x, n: 4 }); } }
    else it.life -= dt;
    if (s.phase !== 'fight' || it.y > 90) continue;
    for (let i = 0; i < s.f.length; i++) {
      const f = s.f[i];
      if (!f.ko && it.life > 0 && Math.abs(f.x - it.x) < 58 && f.y < it.y + 80) { f.power = it.kind; it.life = 0; ev(s, { k: 'pick', who: i, kind: it.kind, x: it.x }); sfx(s, 'pick'); break; }
    }
  }
  s.items = s.items.filter(it => it.life > 0);
}
function updHz(s) {
  const dt = DT;
  for (const h of s.hz) {
    h.t += dt;
    const f = s.f[h.owner], d = s.f[tg(s, h.owner)], fight = s.phase === 'fight';
    if (h.k === 'storm') {
      while (h.n > 0 && h.t >= h.next) { h.n--; h.next += K.STORM_GAP; if (!f.ko) spawnWave(s, h.owner, K.DMG_STORM, K.STORM_STUN, true); }
      if (h.n <= 0 || f.ko) h.done = true;
    } else if (h.k === 'meteor') {
      if (h.t >= h.delay) {
        h.done = true; ev(s, { k: 'boom', x: h.x, big: true });
        if (fight && !d.ko && Math.abs(d.x - h.x) < 90 && d.y < 70) {
          if (d.inv > 0) { ev(s, { k: 'dodge', x: d.x, y: GROUND - 180 }); sfx(s, 'dodge'); }
          else applyHit(s, h.owner, tg(s, h.owner), K.DMG_METEOR, true, h.x);
        }
      }
    } else if (h.k === 'quake') {
      const r = h.t * K.QUAKE_V;
      if (!h.hit && fight && !d.ko && Math.abs(Math.abs(d.x - h.x) - r) < 50 && d.y < 25) {
        h.hit = true;
        if (d.inv > 0) { ev(s, { k: 'dodge', x: d.x, y: GROUND - 150 }); sfx(s, 'dodge'); }
        else { applyHit(s, h.owner, tg(s, h.owner), K.DMG_QUAKE, true, h.x); if (d.stun > 0) { d.vy = 360; d.y = 1; d.cut = true; d.vx = 0; } }
      }
      if (r > 1100) h.done = true;
    }
  }
  s.hz = s.hz.filter(h => !h.done);
}

function separate(s, ia, ib) {
  const P = s.f[ia], E = s.f[ib];
  if (s.f.length > 2 && (P.ko || E.ko)) return;
  const d = Math.abs(P.x - E.x);
  if (d >= K.MIN_DIST || P.y >= 40 || E.y >= 40 || P.cross || E.cross) return;
  const sg = P.x < E.x ? -1 : 1, need = K.MIN_DIST - d;
  P.x += sg * need / 2; E.x -= sg * need / 2; clamp(P); clamp(E);
  const left = K.MIN_DIST - Math.abs(P.x - E.x);
  if (left > 0) {
    const pAtWall = P.x <= WALL || P.x >= W - WALL;
    if (pAtWall) { E.x -= sg * left; clamp(E); } else { P.x += sg * left; clamp(P); }
  }
}

/* ---------- paso fijo ---------- */
function step(s, in0, in1, in2) {
  const dt = DT, N = s.f.length, ins = [in0 | 0, in1 | 0, in2 | 0].slice(0, N);
  s.tick++;
  for (const q of s.f) { q.px = q.x; q.py = q.y; }
  const pr = ins.map((m, n) => m & ~s.prev[n]);
  s.prev = ins;
  for (let i = 0; i < N; i++) {
    const f = s.f[i], p = pr[i], m = ins[i];
    if (p & IN.L) f.lastH = -1;
    if (p & IN.R) f.lastH = 1;
    if (p & IN.JUMP) f.jb = .14;
    if (p & IN.PL) { f.pb = 'L'; f.pbt = .14; } else if (p & IN.PR) { f.pb = 'R'; f.pbt = .14; }
    if (p & IN.ROLL) f.rb = .12;
    if (p & IN.SPEC) f.sb = .14;
    if (p & IN.POW) f.wb = .14;
  }
  s.phaseT += dt;
  if (s.phase === 'matchend' && s.phaseT > 1.2 && ((pr[0] | pr[1]) & IN.START)) { newMatch(s); return; }
  if (s.phase === 'roundend' && s.phaseT > 2.8) { startRound(s); return; }
  if (s.phase === 'intro') {
    if (s.beeped === 0) { sfx(s, 'beep'); s.beeped = 1; }
    if (s.phaseT >= .9 && s.beeped === 1) { sfx(s, 'go'); s.beeped = 2; }
    if (s.phaseT >= 1.5) { s.phase = 'fight'; s.phaseT = 0; }
  }
  if (s.freeze > 0) { s.freeze -= dt; return; }
  if (s.koSlow > 0) { s.koSlow -= dt; s.slow += .3; if (s.slow < 1) return; s.slow -= 1; }
  const ctl = s.phase === 'fight';
  for (let i = 0; i < N; i++) upd(s, i, ins[i], ctl);
  separate(s, 0, 1); if (N > 2) { separate(s, 0, 2); separate(s, 1, 2); }
  updProj(s); updItems(s); updHz(s);
  for (let i = 0; i < 2; i++) if (s.combo[i].t > 0) s.combo[i].t -= dt;
  if (s.phase === 'fight') {
    if (s.opt.mode === 'practice') {
      s.regen += dt; if (s.regen > 2.5) for (const f of s.f) f.hp = Math.min(100, f.hp + 40 * dt);
      for (const f of s.f) if (f.meter < K.METER_MAX && s.regen > 2.5) f.meter = Math.min(K.METER_MAX, f.meter + 25 * dt);
    } else if (s.opt.time > 0) {
      s.timeLeft -= dt;
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        const a = s.f[0].hp, b = s.f.slice(1).reduce((t, q) => t + q.hp, 0) / (N - 1);
        endRound(s, a > b ? 0 : (b > a ? 1 : -1), 'time');
      }
    }
  }
}
/* huella del estado para detectar desincronización (online): FNV-1a sobre TODO lo que importa de la simulación */
const _hf = new Float64Array(1), _hu = new Uint32Array(_hf.buffer);
function hash(s) {
  let h = 0x811c9dc5;
  const mix = x => { _hf[0] = x; h = Math.imul(h ^ _hu[0], 16777619); h = Math.imul(h ^ _hu[1], 16777619); };
  const str = t => { for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); };
  mix(s.tick); mix(s.round); mix(s.rs); mix(s.timeLeft); mix(s.wins[0]); mix(s.wins[1]); mix(s.nid); str(s.phase); mix(s.phaseT);
  for (const f of s.f) { mix(f.x); mix(f.y); mix(f.vy); mix(f.hp); mix(f.meter); mix(f.stam); mix(f.stun); mix(f.kx); mix(f.t); mix(f.shield); mix(f.rollCd); mix(f.inv); str(f.state); str(f.anim); str(f.power); }
  for (const p of s.proj) { mix(p.x); mix(p.id | 0); }
  mix(s.items.length); mix(s.hz.length); mix(s.dropT);
  return h | 0;
}
/* instantánea del estado para RESINCRONIZAR (el anfitrión manda la suya; el invitado la adopta). Sin eventos/efectos: no afectan la simulación. */
function snapshot(s) { return JSON.stringify(s, (k, v) => k === 'events' ? undefined : v); }
function restore(s, str) {
  const o = JSON.parse(str);
  for (const k of Object.keys(s)) if (k !== 'events') delete s[k];
  Object.assign(s, o); s.events = [];
}

root.KSim = { K, IN, POWERS, META, ANIM, create, step, hash, snapshot, restore, frameOf, animDone, newMatch };
})(typeof window !== 'undefined' ? window : globalThis);
