/* Seedmap + calculadoras de Minecraft — JS puro. Uso: <div id="sm-app"></div> + este script.
   La generación de mundo corre en assets/seedmap.wasm (cubiomes, MIT) dentro de un Web Worker.
   Todo local: sin API ni backend. Solo Minecraft Java. */
(function () {
  'use strict';
  const root = document.getElementById('sm-app'); if (!root) return;
  const $ = (t, c, p, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; if (p) p.appendChild(e); return e; };
  const VERS = ['1.16.5', '1.17.1', '1.18.2', '1.19.2', '1.19.4', '1.20.6', '1.21.1', '1.21.3', '1.21 (Winter Drop)'];
  const DIMS = [['Overworld', 0], ['Nether', -1], ['End', 1]];
  /* [nombre, dimensión, color, activa por defecto] — el índice coincide con sm_structures() */
  const ST = [['Pirámide del desierto', 0, '#e0c068', 1], ['Templo de la jungla', 0, '#5fbf5f', 1], ['Choza de pantano', 0, '#8a6bbf', 1], ['Iglú', 0, '#bfe6ff', 1], ['Aldea', 0, '#e8944a', 1], ['Ruina oceánica', 0, '#4aa3df', 0], ['Naufragio', 0, '#a07a4a', 0], ['Monumento oceánico', 0, '#3ec9c9', 1], ['Mansión', 0, '#7a4a2a', 1], ['Puesto de saqueadores', 0, '#b03030', 1], ['Portal en ruinas', 0, '#b54fe0', 0], ['Portal en ruinas', -1, '#b54fe0', 0], ['Ciudad antigua', 0, '#2a8a9a', 1], ['Tesoro enterrado', 0, '#ffd23f', 0], ['Mina abandonada', 0, '#9a9a9a', 0], ['Pozo del desierto', 0, '#d9c28a', 0], ['Geoda de amatista', 0, '#c58aff', 0], ['Fortaleza del Nether', -1, '#c0392b', 1], ['Bastión', -1, '#6b6b6b', 1], ['Ciudad del End', 1, '#e8e0a0', 1], ['Portal de salida', 1, '#ffffff', 1], ['Ruinas del sendero', 0, '#c9a46b', 0], ['Cámaras de prueba', 0, '#e0a040', 1]];
  const MIN_VER = { 12: 3, 21: 5, 22: 6 };
  const ES = { ocean: 'Océano', deep_ocean: 'Océano profundo', warm_ocean: 'Océano cálido', lukewarm_ocean: 'Océano tibio', deep_lukewarm_ocean: 'Océano tibio profundo', cold_ocean: 'Océano frío', deep_cold_ocean: 'Océano frío profundo', frozen_ocean: 'Océano helado', deep_frozen_ocean: 'Océano helado profundo', plains: 'Llanuras', sunflower_plains: 'Llanuras de girasoles', desert: 'Desierto', swamp: 'Pantano', mangrove_swamp: 'Manglar', forest: 'Bosque', flower_forest: 'Bosque de flores', birch_forest: 'Bosque de abedules', old_growth_birch_forest: 'Bosque de abedules antiguo', dark_forest: 'Bosque oscuro', taiga: 'Taiga', old_growth_pine_taiga: 'Taiga de pinos antigua', old_growth_spruce_taiga: 'Taiga de abetos antigua', snowy_taiga: 'Taiga nevada', snowy_plains: 'Llanuras nevadas', ice_spikes: 'Picos de hielo', snowy_beach: 'Playa nevada', beach: 'Playa', stony_shore: 'Costa rocosa', river: 'Río', frozen_river: 'Río helado', jungle: 'Jungla', sparse_jungle: 'Jungla dispersa', bamboo_jungle: 'Jungla de bambú', savanna: 'Sabana', savanna_plateau: 'Meseta de sabana', windswept_savanna: 'Sabana ventosa', windswept_hills: 'Colinas ventosas', windswept_forest: 'Bosque ventoso', windswept_gravelly_hills: 'Colinas de grava ventosas', badlands: 'Badlands', eroded_badlands: 'Badlands erosionadas', wooded_badlands: 'Badlands boscosas', meadow: 'Prado', grove: 'Arboleda', snowy_slopes: 'Laderas nevadas', frozen_peaks: 'Picos helados', jagged_peaks: 'Picos escarpados', stony_peaks: 'Picos rocosos', cherry_grove: 'Cerezos', pale_garden: 'Jardín pálido', mushroom_fields: 'Campos de hongos', dripstone_caves: 'Cuevas de espeleotemas', lush_caves: 'Cuevas frondosas', deep_dark: 'Oscuridad profunda', nether_wastes: 'Desierto del Nether', soul_sand_valley: 'Valle de arena de almas', crimson_forest: 'Bosque carmesí', warped_forest: 'Bosque distorsionado', basalt_deltas: 'Deltas de basalto', the_end: 'El End', small_end_islands: 'Islotes del End', end_midlands: 'Tierras medias del End', end_highlands: 'Tierras altas del End', end_barrens: 'Yermo del End', the_void: 'Vacío' };
  const bname = (n) => n ? (ES[n] || n.replace(/_/g, ' ')) : 'Desconocido';

  /* ---------- Worker ---------- */
  const W = new Worker('assets/seedmap-worker.js'); let nid = 0; const waits = {};
  W.onmessage = (e) => { const r = waits[e.data.id]; if (r) { delete waits[e.data.id]; r(e.data); } };
  const call = (op, a) => new Promise((r) => { const id = ++nid; waits[id] = r; W.postMessage(Object.assign({ id, op }, a)); });

  /* ---------- Estado ---------- */
  const S = { vi: 8, dim: 0, lo: 0, hi: 0, cx: 0, cz: 0, bpp: 8, ep: 0, ready: false };
  let colors = null, names = [], tiles = new Map(), slimes = new Map(), structs = {}, cover = null, capped = {}, sh = [], spawn = null;
  const on = ST.map((s) => s[3]); let showSh = true, showSlime = false, showSpawn = true, dirty = true, busy = false, hover = null;

  /* ---------- UI ---------- */
  const mapCard = $('div', 'sm-card', root);
  const bar = $('div', 'sm-bar', mapCard);
  const inSeed = $('input', 'sm-in sm-seed', bar); inSeed.placeholder = 'Seed (número o texto)'; inSeed.value = '0'; inSeed.setAttribute('aria-label', 'Seed');
  const selVer = $('select', 'sm-in', bar); VERS.forEach((v, i) => { const o = $('option', '', selVer, v); o.value = i; }); selVer.value = S.vi; selVer.setAttribute('aria-label', 'Versión');
  const go = $('button', 'sm-btn sm-pri', bar, 'Generar');
  const tabs = $('div', 'sm-tabs', bar); const tabBtns = DIMS.map((d) => { const b = $('button', 'sm-tab', tabs, d[0]); b.onclick = () => { S.dim = d[1]; reset(); }; return b; });
  const bar2 = $('div', 'sm-bar', mapCard);
  const gx = $('input', 'sm-in sm-num', bar2); gx.placeholder = 'X'; const gz = $('input', 'sm-in sm-num', bar2); gz.placeholder = 'Z';
  const bGo = $('button', 'sm-btn', bar2, 'Ir'), bSpawn = $('button', 'sm-btn', bar2, 'Spawn'), bSh = $('button', 'sm-btn', bar2, 'Stronghold cercano'), bOrg = $('button', 'sm-btn', bar2, '0, 0');
  const bZin = $('button', 'sm-btn sm-sq', bar2, '+'), bZout = $('button', 'sm-btn sm-sq', bar2, '−'); bZin.setAttribute('aria-label', 'Acercar'); bZout.setAttribute('aria-label', 'Alejar');
  const chips = $('div', 'sm-chips', mapCard);
  const wrap = $('div', 'sm-wrap', mapCard); const cv = $('canvas', 'sm-canvas', wrap); const ctx = cv.getContext('2d');
  const msg = $('div', 'sm-msg', wrap, 'Cargando motor…');
  const status = $('div', 'sm-status', mapCard, 'Arrastrá para moverte · rueda para zoom');

  const chipEls = [];
  function chip(label, color, get, set, vis) {
    const b = $('button', 'sm-chip', chips); $('span', 'sm-dot', b).style.background = color; $('span', '', b, label);
    const paint = () => b.classList.toggle('off', !get()); paint();
    b.onclick = () => { set(!get()); paint(); dirty = true; if (set !== null) loadStructs(true); };
    chipEls.push({ b, vis }); return b;
  }
  ST.forEach((s, i) => { if (i === 11) return; chip(s[0], s[2], () => on[i], (v) => { on[i] = v; if (i === 10) on[11] = v; }, () => s[1] === S.dim || (i === 10 && S.dim === -1)); });
  chip('Stronghold', '#ff5468', () => showSh, (v) => { showSh = v; }, () => S.dim === 0);
  chip('Slime chunks', '#7be07b', () => showSlime, (v) => { showSlime = v; }, () => S.dim === 0);
  chip('Spawn', '#ffffff', () => showSpawn, (v) => { showSpawn = v; }, () => S.dim === 0);

  /* ---------- Seed ---------- */
  function parseSeed(t) {
    t = t.trim(); let v;
    if (/^-?\d+$/.test(t)) v = BigInt.asIntN(64, BigInt(t));
    else { let h = 0; for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0; v = BigInt(h); }  /* String.hashCode() como Java */
    return { lo: Number(BigInt.asUintN(32, v)) | 0, hi: Number(BigInt.asUintN(32, v >> 32n)) | 0 };
  }

  async function reset() {
    const ep = ++S.ep; S.ready = false; tiles = new Map(); slimes = new Map(); structs = {}; cover = null; capped = {}; sh = []; spawn = null;
    msg.textContent = 'Generando…'; msg.style.display = '';
    tabBtns.forEach((b, i) => b.classList.toggle('on', DIMS[i][1] === S.dim));
    chipEls.forEach((c) => { c.b.style.display = c.vis() ? '' : 'none'; });
    const r = await call('setup', { vi: S.vi, lo: S.lo, hi: S.hi, dim: S.dim });
    if (ep !== S.ep) return; names = r.names; S.ready = true; msg.style.display = 'none'; dirty = true; pump(); loadStructs(true);
    if (S.dim === 0) {
      call('spawn', {}).then((p) => { if (ep === S.ep) { spawn = p.pt; dirty = true; } });
      call('sh', { max: 128 }).then((p) => { if (ep === S.ep) { sh = p.pts; dirty = true; } });
    }
  }
  const apply = () => { const s = parseSeed(inSeed.value); S.lo = s.lo; S.hi = s.hi; S.vi = +selVer.value; reset(); };
  go.onclick = apply; inSeed.onkeydown = (e) => { if (e.key === 'Enter') apply(); }; selVer.onchange = apply;

  /* ---------- Teselas ---------- */
  const scaleFor = () => (S.bpp * 2 >= 256 ? 256 : S.bpp * 2 >= 64 ? 64 : S.bpp * 2 >= 16 ? 16 : 4);
  function view() { const w = cv.width, h = cv.height, b = S.bpp; return { x0: S.cx - w / 2 * b, x1: S.cx + w / 2 * b, z0: S.cz - h / 2 * b, z1: S.cz + h / 2 * b }; }
  function visibleTiles(sc) {
    const v = view(), T = 64 * sc, out = [];
    for (let tz = Math.floor(v.z0 / T); tz <= Math.floor(v.z1 / T); tz++) for (let tx = Math.floor(v.x0 / T); tx <= Math.floor(v.x1 / T); tx++) out.push({ tx, tz, sc, key: sc + ':' + tx + ':' + tz, d: Math.hypot((tx + .5) * T - S.cx, (tz + .5) * T - S.cz) });
    return out;
  }
  function mkTile(ids) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), im = x.createImageData(64, 64);
    for (let i = 0; i < 4096; i++) { const id = ids[i] * 3; im.data[i * 4] = colors ? colors[id] : 90; im.data[i * 4 + 1] = colors ? colors[id + 1] : 90; im.data[i * 4 + 2] = colors ? colors[id + 2] : 90; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); return { c, ids };
  }
  async function pump() {
    if (busy || !S.ready) return; busy = true;
    while (S.ready) {
      const sc = scaleFor(), list = visibleTiles(sc).filter((t) => !tiles.has(t.key)).sort((a, b) => a.d - b.d); if (!list.length) break;
      const t = list[0], ep = S.ep; const r = await call('tile', { sc, x: t.tx * 64, z: t.tz * 64 });
      if (ep !== S.ep) continue;
      if (tiles.size > 700) tiles.delete(tiles.keys().next().value);
      tiles.set(t.key, r.e ? { c: null, ids: null } : mkTile(r.ids)); dirty = true;
    }
    busy = false;
    if (S.ready && visibleTiles(scaleFor()).some((t) => !tiles.has(t.key))) pump();
  }
  async function slimeTile(cx, cz, key) {
    slimes.set(key, null); const ep = S.ep; const r = await call('slime', { cx, cz }); if (ep !== S.ep) return;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), im = x.createImageData(64, 64);
    for (let i = 0; i < 4096; i++) if (r.s[i]) { im.data[i * 4] = 90; im.data[i * 4 + 1] = 230; im.data[i * 4 + 2] = 90; im.data[i * 4 + 3] = 150; }
    x.putImageData(im, 0, 0); slimes.set(key, c); dirty = true;
  }

  /* ---------- Estructuras ---------- */
  let sTimer = 0;
  function loadStructs(force) {
    clearTimeout(sTimer);
    sTimer = setTimeout(async () => {
      if (!S.ready) return;
      if (busy || visibleTiles(scaleFor()).some((t) => !tiles.has(t.key))) { loadStructs(force); return; }  /* primero biomas, después estructuras */
      const v = view(), ep = S.ep, mx = (v.x1 - v.x0) / 4, mz = (v.z1 - v.z0) / 4;
      if (!force && cover && v.x0 >= cover.x0 && v.x1 <= cover.x1 && v.z0 >= cover.z0 && v.z1 <= cover.z1 && cover.bpp === S.bpp) return;
      const b = { x0: Math.floor(v.x0 - mx), x1: Math.ceil(v.x1 + mx), z0: Math.floor(v.z0 - mz), z1: Math.ceil(v.z1 + mz) };
      for (let i = 0; i < ST.length; i++) {
        if (!on[i] || (ST[i][1] !== S.dim)) { structs[i] = null; continue; }
        const r = await call('structs', Object.assign({ ti: i, viable: 1 }, b)); if (ep !== S.ep) return;
        capped[i] = r.n < 0; structs[i] = r.n > 0 ? r.pts : null; dirty = true;
      }
      cover = Object.assign({ bpp: S.bpp }, b); update();
    }, force ? 30 : 220);
  }
  function update() { const n = Object.keys(capped).filter((i) => capped[i] && on[i] && ST[i][1] === S.dim).map((i) => ST[i][0]); msg.style.display = n.length ? '' : 'none'; msg.textContent = n.length ? 'Acercá más para ver: ' + n.join(', ') : ''; if (S.ready === false) msg.style.display = ''; }

  /* ---------- Dibujo ---------- */
  const sx = (wx) => (wx - S.cx) / S.bpp + cv.width / 2, sz = (wz) => (wz - S.cz) / S.bpp + cv.height / 2;
  function dot(x, z, color, glyph) {
    ctx.beginPath(); ctx.arc(x, z, 7, 0, 6.2832); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.stroke();
    if (glyph) { ctx.fillStyle = '#000'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, x, z + .5); }
  }
  function visiblePts() {
    const out = [], w = cv.width, h = cv.height;
    ST.forEach((s, i) => { const p = structs[i]; if (!p || !on[i] || s[1] !== S.dim) return; for (let k = 0; k < p.length; k += 2) { const x = sx(p[k]), z = sz(p[k + 1]); if (x > -10 && x < w + 10 && z > -10 && z < h + 10) out.push({ x, z, wx: p[k], wz: p[k + 1], n: s[0], c: s[2], g: s[0][0] }); } });
    if (S.dim === 0 && showSh) for (let k = 0; k < sh.length; k += 2) { const x = sx(sh[k]), z = sz(sh[k + 1]); if (x > -10 && x < w + 10 && z > -10 && z < h + 10) out.push({ x, z, wx: sh[k], wz: sh[k + 1], n: 'Stronghold', c: '#ff5468', g: 'S' }); }
    if (S.dim === 0 && showSpawn && spawn) out.push({ x: sx(spawn[0]), z: sz(spawn[1]), wx: spawn[0], wz: spawn[1], n: 'Spawn', c: '#fff', g: '★' });
    return out;
  }
  function draw() {
    const w = cv.width, h = cv.height; ctx.fillStyle = '#101014'; ctx.fillRect(0, 0, w, h); ctx.imageSmoothingEnabled = false;
    /* teselas de otras escalas como fondo mientras llega la correcta */
    for (const sc of [256, 64, 16, 4]) {
      if (sc === scaleFor()) continue; const T = 64 * sc;
      for (const t of visibleTiles(sc)) { const e = tiles.get(t.key); if (e && e.c && (sc > scaleFor() || true)) ctx.drawImage(e.c, sx(t.tx * T), sz(t.tz * T), T / S.bpp + .5, T / S.bpp + .5); }
    }
    const sc = scaleFor(), T = 64 * sc;
    for (const t of visibleTiles(sc)) { const e = tiles.get(t.key); if (e && e.c) ctx.drawImage(e.c, sx(t.tx * T), sz(t.tz * T), T / S.bpp + .5, T / S.bpp + .5); }
    if (S.dim === 0 && showSlime && S.ready && S.bpp <= 8) {
      const v = view(), C = 1024;
      for (let tz = Math.floor(v.z0 / C); tz <= Math.floor(v.z1 / C); tz++) for (let tx = Math.floor(v.x0 / C); tx <= Math.floor(v.x1 / C); tx++) {
        const k = tx + ':' + tz; if (!slimes.has(k)) slimeTile(tx * 64, tz * 64, k); const c = slimes.get(k);
        if (c) ctx.drawImage(c, sx(tx * C), sz(tz * C), C / S.bpp, C / S.bpp);
      }
    }
    /* ejes en 0,0 */
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx(0) + .5, 0); ctx.lineTo(sx(0) + .5, h); ctx.moveTo(0, sz(0) + .5); ctx.lineTo(w, sz(0) + .5); ctx.stroke();
    for (const p of visiblePts()) dot(p.x, p.z, p.c, p.g);
    gx.placeholder = 'X ' + Math.round(S.cx); gz.placeholder = 'Z ' + Math.round(S.cz);
  }
  (function loop() { if (dirty) { dirty = false; draw(); } requestAnimationFrame(loop); })();
  function resize() { const w = Math.max(280, wrap.clientWidth), h = wrap.clientHeight; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; dirty = true; } }
  new ResizeObserver(resize).observe(wrap); resize();

  /* ---------- Interacción ---------- */
  function changed() { dirty = true; pump(); loadStructs(false); }
  function zoom(f, px, pz) {
    const nb = Math.min(2048, Math.max(.5, S.bpp * f)); if (nb === S.bpp) return;
    const wx = S.cx + (px - cv.width / 2) * S.bpp, wz = S.cz + (pz - cv.height / 2) * S.bpp; S.bpp = nb;
    S.cx = wx - (px - cv.width / 2) * nb; S.cz = wz - (pz - cv.height / 2) * nb; changed();
  }
  const pts = new Map(); let lastD = 0;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); lastD = 0; });
  cv.addEventListener('pointerup', (e) => pts.delete(e.pointerId)); cv.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect(), p = pts.get(e.pointerId);
    if (p) {
      if (pts.size === 1) { S.cx -= (e.clientX - p.x) * S.bpp; S.cz -= (e.clientY - p.y) * S.bpp; p.x = e.clientX; p.y = e.clientY; changed(); }
      else if (pts.size === 2) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (lastD) zoom(lastD / d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); lastD = d; }
    }
    hover = { x: e.clientX - r.left, z: e.clientY - r.top }; showInfo();
  });
  cv.addEventListener('pointerleave', () => { hover = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(e.deltaY > 0 ? 1.25 : .8, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  function showInfo() {
    if (!hover) return; const wx = Math.floor(S.cx + (hover.x - cv.width / 2) * S.bpp), wz = Math.floor(S.cz + (hover.z - cv.height / 2) * S.bpp);
    let t = 'X ' + wx + ', Z ' + wz; if (S.dim === 0) t += ' · Nether ' + Math.floor(wx / 8) + ', ' + Math.floor(wz / 8); else if (S.dim === -1) t += ' · Overworld ' + wx * 8 + ', ' + wz * 8;
    const sc = scaleFor(), T = 64 * sc, e = tiles.get(sc + ':' + Math.floor(wx / T) + ':' + Math.floor(wz / T));
    if (e && e.ids) { const id = e.ids[Math.floor(((wz % T + T) % T) / sc) * 64 + Math.floor(((wx % T + T) % T) / sc)]; t += ' · ' + bname(names[id]); }
    const near = visiblePts().find((p) => Math.hypot(p.x - hover.x, p.z - hover.z) < 10); if (near) t += ' · ' + near.n + ' (' + near.wx + ', ' + near.wz + ')';
    status.textContent = t;
  }
  const center = (x, z, b) => { S.cx = x; S.cz = z; if (b) S.bpp = b; changed(); };
  bGo.onclick = () => { const x = parseInt(gx.value, 10), z = parseInt(gz.value, 10); if (!isNaN(x) && !isNaN(z)) center(x, z, Math.min(S.bpp, 4)); };
  bOrg.onclick = () => center(0, 0);
  bSpawn.onclick = () => { if (spawn) center(spawn[0], spawn[1], 4); };
  bSh.onclick = () => { let b = null, bd = 1e18; for (let k = 0; k < sh.length; k += 2) { const d = Math.hypot(sh[k] - S.cx, sh[k + 1] - S.cz); if (d < bd) { bd = d; b = [sh[k], sh[k + 1]]; } } if (b) { center(b[0], b[1], 4); status.textContent = 'Stronghold más cercano: ' + b[0] + ', ' + b[1]; } };
  bZin.onclick = () => zoom(.5, cv.width / 2, cv.height / 2); bZout.onclick = () => zoom(2, cv.width / 2, cv.height / 2);
  gx.onkeydown = gz.onkeydown = (e) => { if (e.key === 'Enter') bGo.click(); };

  call('colors', {}).then((r) => { colors = r.colors; reset(); });

  /* ================== Calculadoras ================== */
  const calc = $('div', 'sm-grid', root);
  const num = (p, label, ph) => { const l = $('label', 'sm-lbl', p); $('span', '', l, label); const i = $('input', 'sm-in', l); i.type = 'number'; i.inputMode = 'numeric'; i.placeholder = ph || '0'; return i; };
  const val = (i) => { const n = parseInt(i.value, 10); return isNaN(n) ? null : n; };

  const c1 = $('div', 'sm-card', calc); $('h3', 'sm-h', c1, 'Coordenadas Overworld ↔ Nether'); $('p', 'sm-p', c1, 'En el Nether 1 bloque equivale a 8 del Overworld. Útil para ubicar portales.');
  const ro = $('div', 'sm-row', c1), ox = num(ro, 'Overworld X'), oy = num(ro, 'Y', '64'), oz = num(ro, 'Overworld Z'); const outN = $('div', 'sm-out', c1);
  const rn = $('div', 'sm-row', c1), nx = num(rn, 'Nether X'), ny = num(rn, 'Y', '64'), nz = num(rn, 'Nether Z'); const outO = $('div', 'sm-out', c1);
  const nf = (n) => n.toLocaleString('es-AR');
  function cc() {
    const x = val(ox), z = val(oz), y = val(oy);
    outN.textContent = x == null || z == null ? 'Ingresá X y Z del Overworld.' : '→ Nether: ' + nf(Math.floor(x / 8)) + (y != null ? ', ' + y : '') + ', ' + nf(Math.floor(z / 8)) + '  ·  chunk Overworld ' + Math.floor(x / 16) + ', ' + Math.floor(z / 16);
    const a = val(nx), b = val(nz), yy = val(ny);
    outO.textContent = a == null || b == null ? 'Ingresá X y Z del Nether.' : '→ Overworld: ' + nf(a * 8) + (yy != null ? ', ' + yy : '') + ', ' + nf(b * 8) + '  (el portal puede quedar hasta +7 bloques)';
  }
  [ox, oy, oz, nx, ny, nz].forEach((i) => i.addEventListener('input', cc)); cc();

  const c2 = $('div', 'sm-card', calc); $('h3', 'sm-h', c2, 'Stacks y shulkers'); $('p', 'sm-p', c2, 'Un shulker box guarda 27 stacks; un cofre doble, 54.');
  const r2 = $('div', 'sm-row', c2); const items = num(r2, 'Cantidad de ítems');
  const lz = $('label', 'sm-lbl', r2); $('span', '', lz, 'Stack de'); const sz2 = $('select', 'sm-in', lz); [[64, '64 (bloques, la mayoría)'], [16, '16 (ender pearls, huevos…)'], [1, '1 (herramientas, pociones)']].forEach((o) => { const e = $('option', '', sz2, o[1]); e.value = o[0]; });
  const out2 = $('div', 'sm-out', c2); $('h4', 'sm-h4', c2, 'Al revés: ¿cuántos ítems son?');
  const r3 = $('div', 'sm-row', c2), bs = num(r3, 'Shulkers'), bst = num(r3, 'Stacks'), bi = num(r3, 'Ítems sueltos'); const out3 = $('div', 'sm-out', c2);
  function cs() {
    const n = val(items), per = +sz2.value;
    if (n == null || n < 0) out2.textContent = 'Ingresá una cantidad.';
    else { const st = Math.floor(n / per), rest = n % per, shu = Math.floor(st / 27), st2 = st % 27; out2.textContent = nf(n) + ' ítems = ' + nf(shu) + ' shulker' + (shu === 1 ? '' : 's') + ' + ' + st2 + ' stack' + (st2 === 1 ? '' : 's') + ' + ' + rest + ' suelto' + (rest === 1 ? '' : 's') + '  ·  ' + nf(st) + ' stacks en total (' + nf(Math.ceil(st / 54)) + ' cofre' + (Math.ceil(st / 54) === 1 ? '' : 's') + ' doble' + (Math.ceil(st / 54) === 1 ? '' : 's') + ')'; }
    const a = val(bs) || 0, b = val(bst) || 0, c = val(bi) || 0; out3.textContent = (bs.value || bst.value || bi.value) ? '= ' + nf((a * 27 + b) * per + c) + ' ítems (con stacks de ' + per + ')' : 'Ingresá shulkers, stacks o ítems.';
  }
  [items, sz2, bs, bst, bi].forEach((i) => i.addEventListener('input', cs)); cs();
})();
