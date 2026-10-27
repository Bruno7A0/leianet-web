/* LeiaKOMBAT · IA de la CPU (sin DOM). Se carga en el juego y también en el banco de pruebas de balance (tools/balance.js).

   Principios de diseño (que "ganar dependa de aprender a jugar"):
   · La CPU reacciona con LATENCIA: ve un golpe recién cuando lleva `lat` segundos en el aire, como un humano.
     Con puños rápidos (arranque ~.18 s) y latencia alta, a veces no llega a bloquear: eso se puede aprender a explotar.
   · Respeta enfriamientos entre ataques (`cool`) y se retira un instante si se la bloquean: no hace spam.
   · Elige el ataque según la distancia y la postura del jugador (patada si se agacha o si está lejos, puño si está cerca).
   · La dificultad sube con latencia más corta y más decisiones por segundo, NO con daño/velocidad de trampa.
   Los parámetros de dificultad D = { t0, t1, punch, react, spec } alimentan todo lo demás (los extras se derivan si no vienen). */
(function (root) {
'use strict';
const { IN, K } = root.KSim, DT = K.DT;
let rnd = Math.random;   // el banco de pruebas lo reemplaza por un generador con semilla
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.max(0, Math.min(1, x));

function newAI() { return { t: 0, mv: 0, blk: 0, crouch: 0, jh: 0, seen: 0, cool: 0, rx: 0, blkSeen: 0, back: 0, ph: 0, pdone: 0, dodge: 0, hurt: 0, aa: 0, rp: 0, hz: new WeakSet(), burst: 0, rest: 0, rip: 0, rb: 0, near: 0, dn: 0, aired: 0, runF: 0, fy: 0, rage: 0, style: rnd() < .5 ? 0 : 1 }; }
/* perillas derivadas de la dificultad (0..1) */
function knobs(D) {
  const r = clamp01(D.react);
  return {
    lat: D.lat != null ? D.lat : lerp(.36, .17, r),             // segundos hasta "ver" un golpe
    cool: D.cool != null ? D.cool : lerp(.85, .35, clamp01(D.punch)),   // pausa mínima entre ataques
    dec0: Math.max(.09, D.t0), dec1: Math.max(.16, D.t1)         // nunca decide más de ~8 veces por segundo
  };
}


/* ============ ESTILOS DE JEFE (Arcade) ============
   Cada jefe se define por CÓMO pelea, no por cuánta vida/daño tiene, y cada uno tiene una debilidad legible:
   · rush  (EMBESTIDA): corre y ataca en ráfagas de 3, después se frena. Débil: bloquear la ráfaga y castigar la pausa.
   · zoner (LADRIDO):   mantiene distancia y lanza ladridos (carga el medidor solo). Débil: saltar/rodar la onda y acorralarlo.
   · wall  (MURO):      se tapa y solo contraataca tras bloquear. Débil: presión sostenida: la guardia gasta estamina y se rompe.
   · trick (SOMBRA):    fintas, saltos con ataque aéreo y voltereta defensiva. Débil: esperar su error (no pegar a ciegas).
   · fury  (FURIA):     alterna rabia (corre sin defenderse) y agotamiento (no ataca). Débil: aguantar y castigar el cansancio.
   `tier` (0,1,2…) sube al repetirse el estilo: reflejos y pausas más afinados. */
const FURY = { rage: 5, rest: 3 };
function archD(D, ai) {
  const t = D.tier | 0, k = .03 * t, E = Object.assign({}, D);
  switch (D.arch) {
    case 'rush': E.react = clamp01(D.react * .6 + k); E.punch = 1; break;
    case 'zoner': E.punch = D.punch * .5; E.react = clamp01(D.react + k); break;
    case 'wall': E.react = 1; E.punch = .35; E.lat = Math.max(.12, .2 - .02 * t); break;
    case 'trick': E.react = clamp01(D.react * .9 + k); E.rollDef = 1; break;
    case 'fury': E.react = ai.rage ? clamp01(D.react * .3) : clamp01(D.react * .15); E.punch = 1; break;
  }
  return E;
}
/* devuelve las entradas de este "turno de decisión" (bits IN) o -1 si no decide nada (usa la lógica normal) */
function archDecide(s, f, o, ai, D, kn, dist, idle) {
  const t = D.tier | 0, inP = dist <= K.RANGE - 6, inK = dist <= K.KICK_RANGE - 8, nearWall = f.x <= K.WALL + 12 || f.x >= K.W - K.WALL - 12;
  ai.runF = 0;
  switch (D.arch) {
    case 'rush': {
      if (!idle || f.y) return 0;
      if (ai.rest > 0) { if (dist < K.KICK_RANGE + 70) ai.mv = -f.dir; return 0; }        // la pausa: ventana para castigar
      if (ai.cool > 0) { if (dist > K.RANGE - 20) { ai.mv = f.dir; ai.runF = 1; } return 0; }
      if (inP) { ai.burst++; if (ai.burst >= 3) { ai.burst = 0; ai.rest = Math.max(.55, 1.05 - .1 * t); ai.cool = ai.rest; } else ai.cool = .24 - .02 * t; return IN.PR; }
      if (inK && dist > K.RANGE + 20 && rnd() < .35) { ai.cool = .5; return IN.PL; }
      ai.mv = f.dir; ai.runF = 1; return 0;
    }
    case 'zoner': {
      if (!idle || f.y) return 0;
      if (f.power) return -1;
      if (f.meter >= K.METER_MAX && dist > 200 && rnd() < .95) return IN.SPEC;
      const want = 440 + 30 * t;
      ai.near = dist < K.KICK_RANGE ? ai.near + kn.dec1 : 0;
      if (ai.near > .5 && ai.cool <= 0 && inK) { ai.near = 0; ai.cool = 1.2; return IN.PL; }   // acorralado/encimado: se defiende a patadas
      if (dist < want - 40 && !(nearWall && dist < K.KICK_RANGE + 40)) { ai.mv = -f.dir; if (dist < 360 && f.stam > 45 && !f.tired) ai.runF = 1; }
      else if (dist > want + 140) ai.mv = f.dir;
      else if (inK && ai.cool <= 0 && rnd() < .5) { ai.cool = 1.1; return IN.PL; }
      return 0;
    }
    case 'wall': {
      if (!idle || f.y) return 0;
      const ob = s.stats[1 - (f === s.f[1] || f === s.f[2] ? 1 : 0)].blocked;
      if (ob !== ai.rb) { ai.rb = ob; ai.rip = .1 + rnd() * .1; }                          // bloqueó un golpe: riposta
      if (ai.rip > 0) { ai.rip -= kn.dec0; if (ai.rip <= 0 && dist <= K.RANGE - 6 && f.stun <= 0) { ai.blk = 0; ai.cool = 1.1; return IN.PR; } }
      if (f.stam < 26) { ai.back = .5; ai.cool = Math.max(ai.cool, .8); return 0; }        // guardia casi rota: se aleja a respirar
      if (dist < K.KICK_RANGE + 50) { ai.blk = .35; if (dist < K.MIN_DIST + 30 && rnd() < .3) ai.mv = -f.dir; return 0; }
      ai.mv = f.dir; return 0;
    }
    case 'trick': {
      if (f.y > 20) { if (dist <= K.RANGE + 20 && !ai.aired) { ai.aired = 1; return IN.PR; } return 0; }
      ai.aired = 0;
      if (!idle || f.y) return 0;
      const r = rnd();
      if (r < .22 && f.stam > 35) { ai.jh = .5; ai.mv = f.dir; return 0; }                // salto con ataque aéreo
      if (r < .6) { ai.dn ^= 1; ai.mv = ai.dn ? f.dir : -f.dir; return 0; }                // finta: entra y sale del alcance
      if (ai.cool <= 0 && inK && !inP) { ai.cool = 1; return IN.PL; }
      if (ai.cool <= 0 && inP) { ai.cool = .8; return IN.PR; }
      if (dist > K.KICK_RANGE - 30) ai.mv = f.dir;
      return 0;
    }
    case 'fury': {
      
      if (!idle || f.y) return 0;
      if (ai.rage) {
        if (dist > K.RANGE - 10) { ai.mv = f.dir; ai.runF = 1; return 0; }
        ai.cool = .22; return rnd() < .75 ? IN.PR : IN.PL;
      }
      ai.mv = dist < K.KICK_RANGE + 90 ? -f.dir : 0; return 0;                              // cansado: no ataca, se aleja
    }
  }
  return -1;
}

function aiMask(s, i, ai, D) {
  if (s.phase !== 'fight') return 0;
  const f = s.f[i], o = s.f[i ? 0 : 1], dist = Math.abs(f.x - o.x), side = i ? 1 : 0; let m = 0, atk = 0;
  ai.t -= DT; if (ai.cool > 0) ai.cool -= DT; if (ai.rest > 0) ai.rest -= DT;
  if (D.arch === 'fury') {   // fases: rabia (corre y pega sin defenderse) ↔ agotamiento (queda expuesto). Con poca vida casi no descansa.
    ai.fy += DT; const t = D.tier | 0, lim = ai.rage ? FURY.rage + .5 * t : Math.max(1.6, FURY.rest - .3 * t) * (f.hp < 35 ? .6 : 1);
    if (ai.fy >= lim) { ai.fy = 0; ai.rage ^= 1; }
  }
  if (D.arch) D = archD(D, ai);
  const kn = knobs(D);
  if (ai.blk > 0) { ai.blk -= DT; m |= IN.BLOCK; }
  if (ai.crouch > 0) { ai.crouch -= DT; m |= IN.CROUCH; }
  if (ai.jh > 0) { ai.jh -= DT; m |= IN.JUMP; }
  if (ai.back > 0) { ai.back -= DT; ai.mv = ai.dodge || -f.dir; if (ai.back <= 0) ai.dodge = 0; }

  // ladridos del rival: los "ve" cuando ya están cerca (latencia) y salta, se agacha o rueda
  const wr = 150 + kn.lat * K.WAVE_V;
  for (const p of s.proj) if ((p.owner ? 1 : 0) !== side && p.id !== ai.seen && Math.sign(f.x - p.x) === p.dir && Math.abs(f.x - p.x) < wr) {
    ai.seen = p.id;
    if (rnd() < D.react) {
      const r = rnd();
      if (D.rollDef && r < .3 && f.rollCd <= 0 && f.stam >= K.ROLL_COST) m |= IN.ROLL; else if (r < .45) ai.crouch = .45; else if (r < .8 || f.rollCd > 0 || f.stam < K.ROLL_COST) ai.jh = .5; else m |= IN.ROLL;
    }
  }
  // poderes del rival que caen sobre ella: se sale del meteoro (tras `lat`) y salta el terremoto
  for (const h of s.hz) {
    if (h.owner === i || (h.owner > 0) === (i > 0) || f.ko) continue;
    if (h.k === 'meteor' && !ai.hz.has(h) && h.t >= kn.lat && Math.abs(f.x - h.x) < 110) { ai.hz.add(h); if (rnd() < D.react) { ai.back = .4; ai.mv = f.x < h.x ? -1 : 1; ai.dodge = f.x < h.x ? -1 : 1; } }
    if (h.k === 'quake' && !ai.hz.has(h)) { const gap = Math.abs(Math.abs(f.x - h.x) - h.t * K.QUAKE_V); if (gap < 170 && h.t >= kn.lat * .5) { ai.hz.add(h); if (rnd() < D.react) ai.jh = .45; } }
  }
  // golpe del rival: lo reconoce tras `lat` segundos y elige la defensa según el tipo de golpe
  if (o.state === 'punch' && !o.punchHit && !o.special && !f.ko) {
    const reach = (o.kick ? K.KICK_RANGE : K.RANGE) + 14;
    if (!ai.rx && dist < reach && o.t / 1000 >= kn.lat) {
      ai.rx = 1;
      if (rnd() < D.react) {
        const r = rnd();
        if (D.rollDef && r < .35 && f.rollCd <= 0 && f.stam >= K.ROLL_COST) m |= IN.ROLL; else {
        const sta = f.stam >= K.BLOCK_COST_KICK + 4;                           // sin estamina un bloqueo no sirve: esquiva
        if (o.kick) { if (r < .8 && sta) ai.blk = .45; else ai.jh = .3; }     // la patada pega agachado: se bloquea
        else if (r < .5 && sta) ai.blk = .45; else if (r < .85) ai.crouch = .45; else ai.jh = .3;
        ai.cool = Math.max(ai.cool, .15); }
      }
    }
  } else ai.rx = 0;

  // salto/voltereta del rival: lo espera con la guardia arriba y, cuando cae (queda quieto un instante), lo castiga
  if (o.y > 20 && !o.cross && f.y === 0 && dist < K.RANGE + 120) {
    if (!ai.aa) { ai.aa = 1; if (rnd() < D.react && f.stam >= K.BLOCK_COST + 4) ai.blk = Math.max(ai.blk, .5); }
  } else if (o.y === 0) ai.aa = 0;
  if (D.whiff !== 0 && o.rlag > 0 && o.y === 0 && dist <= K.RANGE - 6 && f.state !== 'punch' && f.stun <= 0 && f.y === 0) {
    if (!ai.rp) { ai.rp = 1; if (rnd() < D.react) { atk = IN.PR; ai.blk = 0; ai.crouch = 0; ai.cool = kn.cool * .8; } }
  } else if (!(o.rlag > 0)) ai.rp = 0;
  // al salir del aturdimiento levanta la guardia en vez de quedarse parada recibiendo otro golpe
  if (f.stun > 0) ai.hurt = 1;
  else if (ai.hurt) { ai.hurt = 0; if (D.guardUp !== 0 && dist < K.KICK_RANGE + 40 && rnd() < .45 + .5 * clamp01(D.react) && f.stam >= K.BLOCK_COST + 4) { ai.blk = .45; ai.cool = Math.max(ai.cool, .2); } }
  // CASTIGO: el rival ya soltó su golpe y está recuperándose → contraataca (con latencia: reconoce la recuperación tras ~60% de `lat`)
  if (D.whiff !== 0 && o.state === 'punch' && o.punchHit && !o.special) {
    ai.ph += DT;
    if (!ai.pdone && ai.ph >= kn.lat * .6) {
      ai.pdone = 1;
      const inP = dist <= K.RANGE - 6, inK = dist <= K.KICK_RANGE - 8;
      const inK2 = dist <= K.KICK_RANGE - 2;      // castigo con patada hasta casi el límite de su alcance
      if (f.state !== 'punch' && f.stun <= 0 && f.y === 0 && (inP || inK2) && rnd() < D.react) { atk = inP ? IN.PR : IN.PL; ai.blk = 0; ai.crouch = 0; ai.cool = kn.cool * .8; ai.t = Math.min(ai.t, .3); }
    }
  } else { ai.ph = 0; ai.pdone = 0; }

  // si le bloquearon el golpe, no insiste a ciegas: espera o da un paso atrás
  const bk = s.stats[side].blocked; if (bk !== ai.blkSeen) { ai.blkSeen = bk; ai.cool = Math.max(ai.cool, kn.cool * 1.1); if (rnd() < .5) ai.back = .28; }

  if (ai.t <= 0) {
    ai.t = kn.dec0 + rnd() * (kn.dec1 - kn.dec0); ai.mv = 0;
    const idle = f.state === 'idle' || f.state === 'walk';
    const ar = D.arch ? archDecide(s, f, o, ai, D, kn, dist, idle) : -1;
    if (ar >= 0) { m |= ar & ~(IN.PL | IN.PR); atk = ar & (IN.PL | IN.PR); }
    else if (D.spec > 0 && f.power && idle && f.y === 0 && rnd() < D.spec + .25) {
      if (f.power === 'shield') { if (o.state === 'punch' || dist < 320) m |= IN.POW; }
      else if (f.power === 'quake') { if (dist < 560) m |= IN.POW; }
      else if (dist > 200 && o.state !== 'crouch') m |= IN.POW;
    }
    else if (D.spec > 0 && f.meter >= K.METER_MAX && dist > 260 && dist < 760 && idle && o.state !== 'crouch' && rnd() < D.spec) m |= IN.SPEC;
    else if (!f.power && s.items.length && rnd() < .5) { let it = s.items[0]; for (const q of s.items) if (Math.abs(q.x - f.x) < Math.abs(it.x - f.x)) it = q; if (Math.abs(it.x - f.x) > 30) ai.mv = it.x > f.x ? 1 : -1; }
    else {
      const want = ai.style ? K.KICK_RANGE - 22 : K.RANGE - 12;           // estilo 1: pelea de lejos (patadas); estilo 0: de cerca (puños)
      const inPunch = dist <= K.RANGE - 6, inKick = dist <= K.KICK_RANGE - 8;
      const canAtk = idle && ai.cool <= 0 && f.y === 0;
      const threat = dist < (o.kick ? K.KICK_RANGE : K.RANGE) + 30 && !(o.state === 'punch' && o.punchHit);
      // guardia preventiva: parada cerca del rival sin atacar, levanta el bloqueo (si tiene estamina; si no, se aleja)
      if (!(canAtk && (inPunch || inKick) && rnd() < D.punch * .8) && threat && rnd() < .3 + .5 * clamp01(D.react)) { if (f.stam >= K.BLOCK_COST_KICK + 4) ai.blk = .3 + rnd() * .25; else ai.back = .3; }
      if (ai.blk > 0 || ai.back > 0) { /* ya eligió defender */ }
      else if (canAtk && (inPunch || inKick) && rnd() < D.punch) {
        // elección: agachado → patada; lejos → patada; cerca → puño (más rápido), con algo de mezcla
        const kick = o.state === 'crouch' || !inPunch || (ai.style && rnd() < .55) || rnd() < .22;
        atk = kick && inKick ? IN.PL : IN.PR; ai.cool = kn.cool * (.75 + rnd() * .6);
      }
      else if (ai.cool > 0 && dist > K.RANGE && dist < K.KICK_RANGE + 14 && rnd() < .3 + .4 * clamp01(D.react)) ai.mv = -f.dir;   // en pausa no se queda en la zona de patada del rival
      else if (dist > want) ai.mv = f.dir;
      else if (dist < K.MIN_DIST + 20 && rnd() < .6) ai.mv = -f.dir;       // demasiado pegada: se acomoda
      else {
        const r = rnd();
        if (r < .12) ai.blk = .35; else if (r < .3) ai.mv = -f.dir; else if (r < .36) ai.jh = .3;
      }
    }
  }
  if (atk) { m &= ~(IN.BLOCK | IN.CROUCH); ai.blk = 0; ai.crouch = 0; }   // atacar cancela la guardia (si no, el golpe se pierde)
  m |= atk;
  if (!(m & (IN.BLOCK | IN.CROUCH | IN.PL | IN.PR))) { let mv = ai.mv; if (dist < K.MIN_DIST && mv === f.dir) mv = 0; if (mv > 0) m |= IN.R; else if (mv < 0) m |= IN.L; }
  if ((m & (IN.L | IN.R)) && ai.mv === f.dir && dist > K.KICK_RANGE + 10 && dist < 330 && f.stam > 45 && !f.tired && D.react > .5 && D.run !== false) m |= IN.RUN;
  if ((m & (IN.L | IN.R)) && ai.runF && ai.mv === f.dir && dist > K.KICK_RANGE + 10 && f.stam > 20 && !f.tired) m |= IN.RUN;   // cierra la distancia corriendo
  if (f.ko) return 0;
  return m;
}

root.KAI = { newAI, aiMask, setRandom(f) { rnd = f || Math.random; } };
})(typeof window !== 'undefined' ? window : globalThis);
