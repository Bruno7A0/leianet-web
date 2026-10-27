/* LeiaKOMBAT · stages.js — fondos animados (todo procedural en canvas,)
   Cada escenario dibuja capas con parallax SOBRE la imagen base y debajo de los luchadores.
   Se sincronizan con la música (pulso `beat`) y tienen modo "bajo" (q = 0) para celulares lentos. */
(function (root) {
'use strict';
const TAU = Math.PI * 2;
const fr = v => v - Math.floor(v);
const hh = n => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const pulse = b => b && b.on ? Math.pow(1 - b.phase, 3) : 0;
/* posición envuelta dentro de la ventana visible: la capa con profundidad d se ve en [camL*d - 160, camL*d + vw + 160] */
const wrap = (px, o, d) => { const base = o.camL * d - 160, span = o.vw + 320; return base + (((px - base) % span) + span) % span; };

const FX = {
  /* ───── Núcleo LeiaNET: anillos de datos, lluvia de código y orbes ───── */
  core(x, o) {
    const { t, q, acc } = o, b = pulse(o.beat);
    x.save(); x.translate(o.camL * .88, 0); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const r = 96 + i * 54 + b * 7, dir = i % 2 ? -1 : 1, a0 = t * (.22 + i * .1) * dir;
      x.strokeStyle = acc; x.lineWidth = 2 + (i === 2 ? 2 : 0); x.globalAlpha = .16 + .12 * b + i * .02;
      for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(640, 175, r, a0 + k * TAU / 3, a0 + k * TAU / 3 + 1.25); x.stroke(); }
      if (q) { x.globalAlpha = .1; x.setLineDash([2, 12]); x.beginPath(); x.arc(640, 175, r + 14, -a0, -a0 + TAU); x.stroke(); x.setLineDash([]); }
    }
    x.globalAlpha = .3 + .4 * b; const g = x.createRadialGradient(640, 175, 2, 640, 175, 90); g.addColorStop(0, '#fff'); g.addColorStop(.3, acc); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(540, 75, 200, 200);
    x.restore();
    // lluvia de código
    x.save(); x.translate(o.camL * .7, 0); const n = q ? 30 : 12;
    for (let i = 0; i < n; i++) {
      const sp = 70 + hh(i) * 130, cx = wrap(hh(i + 7) * (o.vw + 400), o, .3) - o.camL * .7 + o.camL * .3, y = ((t * sp + hh(i + 3) * 700) % 760) - 120;
      for (let k = 0; k < 9; k++) { x.globalAlpha = (1 - k / 9) * .35; x.fillStyle = k === 0 ? '#fff' : acc; x.fillRect(cx, y - k * 13, 4, 8); }
    }
    x.restore();
    // barrido de luz
    const sw = (t * .25) % 1; x.save(); x.globalAlpha = .06 * Math.sin(sw * Math.PI); x.fillStyle = acc; x.fillRect(o.camL - 40, sw * 560, o.vw + 80, 40); x.restore();
    // orbes
    if (q) { x.save(); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { const ox = wrap(300 + i * 150 + Math.sin(t * .4 + i) * 60, o, .2), oy = 120 + i * 40 + Math.cos(t * .5 + i * 2) * 30; const g2 = x.createRadialGradient(ox, oy, 0, ox, oy, 26); g2.addColorStop(0, 'rgba(180,200,255,.5)'); g2.addColorStop(1, 'rgba(180,200,255,0)'); x.fillStyle = g2; x.fillRect(ox - 26, oy - 26, 52, 52); } x.restore(); }
  },

  /* ───── Colonia Marte: tormenta de polvo, lunas, volcán en erupción y rayos ───── */
  marte(x, o) {
    const { t, q } = o;
    // lunas
    x.save(); x.translate(o.camL * .92, 0);
    for (const [r, cx, cy, sp, c] of [[16, 860, 92, .07, '#d9b79a'], [9, 430, 70, -.11, '#b79c88']]) {
      const px = cx + Math.cos(t * sp) * 90, py = cy + Math.sin(t * sp) * 18, g = x.createRadialGradient(px - r * .4, py - r * .4, 1, px, py, r); g.addColorStop(0, '#fff2e0'); g.addColorStop(.6, c); g.addColorStop(1, '#3a2018'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
    } x.restore();
    // volcán
    x.save(); x.translate(o.camL * .8, 0);
    const vx = 960, base = 520, cr = 372, g = x.createLinearGradient(0, cr, 0, base); g.addColorStop(0, '#3a110a'); g.addColorStop(1, '#14060a'); x.fillStyle = g;
    x.beginPath(); x.moveTo(vx - 260, base); x.lineTo(vx - 40, cr + 8); x.lineTo(vx - 18, cr); x.lineTo(vx + 18, cr + 2); x.lineTo(vx + 42, cr + 8); x.lineTo(vx + 270, base); x.closePath(); x.fill();
    const ph = (t % 8) / 8, er = ph < .3 ? Math.sin(ph / .3 * Math.PI) : 0;
    x.globalCompositeOperation = 'lighter';
    const gl = x.createRadialGradient(vx, cr, 2, vx, cr, 90 + er * 70); gl.addColorStop(0, 'rgba(255,170,70,' + (.35 + er * .5) + ')'); gl.addColorStop(1, 'rgba(255,80,20,0)'); x.fillStyle = gl; x.fillRect(vx - 170, cr - 170, 340, 340);
    if (er > .02) for (let i = 0; i < (q ? 22 : 9); i++) { const k = Math.floor(t / 8), tt = ph * 8 * .8 - hh(i + k * 9) * .6; if (tt < 0) continue; const vxp = (hh(i + 1 + k) - .5) * 260, vyp = 330 + hh(i + 2) * 280; const px = vx + vxp * tt, py = cr - vyp * tt + 420 * tt * tt; x.globalAlpha = Math.max(0, 1 - tt * .8); x.fillStyle = hh(i + 5) > .5 ? '#ffb347' : '#ff5a1f'; x.beginPath(); x.arc(px, py, 3 + hh(i) * 3, 0, TAU); x.fill(); }
    x.restore();
    // polvo
    x.save(); x.globalAlpha = 1; const n = q ? 38 : 16;
    for (let i = 0; i < n; i++) {
      const sp = 150 + hh(i) * 330, y = 50 + hh(i + 4) * 440, px = wrap(hh(i + 9) * (o.vw + 600) - t * sp, o, .45), len = 40 + hh(i + 2) * 110;
      x.strokeStyle = 'rgba(255,178,122,' + (.1 + hh(i + 6) * .2) + ')'; x.lineWidth = 1.5 + hh(i + 8) * 2; x.beginPath(); x.moveTo(px, y); x.lineTo(px + len, y + 4); x.stroke();
    }
    x.restore();
    // rayo
    const k = Math.floor(t / 6.5), p = fr(t / 6.5);
    if (hh(k) > .35 && p < .16) {
      const lx = o.camL + 100 + hh(k + 3) * (o.vw - 200); x.save(); x.globalAlpha = (1 - p / .16) * .28; x.fillStyle = '#ffd6b0'; x.fillRect(o.camL - 40, 0, o.vw + 80, 560);
      x.globalAlpha = 1 - p / .16; x.strokeStyle = '#fff6e6'; x.lineWidth = 3; x.beginPath(); let px = lx, py = 0; x.moveTo(px, py); for (let i = 0; i < 9; i++) { px += (hh(k + i * 3) - .5) * 70; py += 55; x.lineTo(px, py); } x.stroke(); x.restore();
    }
  },

  /* ───── Cumbre Helada: aurora boreal, montañas, nevada y estrella fugaz ───── */
  hielo(x, o) {
    const { t, q } = o;
    // aurora
    x.save(); x.globalCompositeOperation = 'lighter'; x.translate(o.camL * .95, 0);
    const cols = [['#3dffb0', 'rgba(61,255,176,'], ['#4aa8ff', 'rgba(74,168,255,'], ['#c46bff', 'rgba(196,107,255,']];
    for (let i = 0; i < (q ? 3 : 2); i++) {
      const g = x.createLinearGradient(0, 30, 0, 330); g.addColorStop(0, cols[i][1] + '0)'); g.addColorStop(.45, cols[i][1] + (.22 + .08 * pulse(o.beat)) + ')'); g.addColorStop(1, cols[i][1] + '0)'); x.fillStyle = g;
      x.beginPath(); const x0 = o.camL * .05 - 80, x1 = x0 + o.vw + 160, ys = [];
      for (let px = x0; px <= x1; px += 26) { const y = 90 + i * 34 + Math.sin(px * .0042 + t * .5 + i * 1.7) * 38 + Math.sin(px * .012 - t * .8) * 12; ys.push([px, y]); x.lineTo(px, y); }
      for (let k = ys.length - 1; k >= 0; k--) x.lineTo(ys[k][0], ys[k][1] + 130 + Math.sin(ys[k][0] * .006 + t) * 24);
      x.closePath(); x.fill();
    } x.restore();
    // montañas
    for (const [d, c, hgt, w] of [[.22, '#143247', 150, 230], [.4, '#0b2030', 110, 170]]) {
      x.save(); x.translate(o.camL * (1 - d), 0); x.fillStyle = c; x.beginPath(); const x0 = o.camL * d - 200; x.moveTo(x0, 530);
      for (let px = x0, i = 0; px < x0 + o.vw + 400; px += w, i++) { const idx = Math.floor(px / w); x.lineTo(px + w * .5, 530 - hh(idx + d * 9) * hgt - 40); x.lineTo(px + w, 530 - 20 - hh(idx + 1 + d * 9) * 20); }
      x.lineTo(x0 + o.vw + 400, 530); x.closePath(); x.fill(); x.restore();
    }
    // nevada
    x.save(); const n = q ? 110 : 40;
    for (let i = 0; i < n; i++) {
      const d = .5 + (i % 3) * .25, sz = 1 + (i % 3) * .9, px = wrap(hh(i) * (o.vw + 400) + Math.sin(t * .7 + i) * 18 - t * (14 + (i % 3) * 8), o, d), py = (hh(i + 5) * 640 + t * (28 + (i % 3) * 22)) % 640 - 20;
      x.globalAlpha = .35 + (i % 3) * .2; x.fillStyle = '#eaf6ff'; x.fillRect(px - o.camL * (1 - d), py, sz, sz);
    }
    x.restore();
    // estrella fugaz
    const k = Math.floor(t / 4.7), p = fr(t / 4.7) * 3.2;
    if (p < 1) { const sx = o.camL + hh(k) * o.vw * .7, sy = 40 + hh(k + 2) * 80, hx = sx + p * 380, hy = sy + p * 170, g = x.createLinearGradient(hx - 110, hy - 50, hx, hy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.95)'); x.save(); x.strokeStyle = g; x.lineWidth = 3; x.beginPath(); x.moveTo(hx - 110, hy - 50); x.lineTo(hx, hy); x.stroke(); x.restore(); }
  },

  /* ───── Neón Retrowave: sol con persianas, skyline con ventanas, ecualizador y láseres ───── */
  neon(x, o) {
    const { t, q } = o, b = pulse(o.beat), sky = o.sky;
    const mix = (y) => { const k = Math.min(1, y / 560), a = sky[0], c = sky[1], h = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]; const A = h(a), C = h(c); return 'rgb(' + A.map((v, i) => Math.round(v + (C[i] - v) * k)).join(',') + ')'; };
    // sol
    x.save(); x.translate(o.camL * .93, 0); const cx = 640, cy = 190, r = 100 + b * 4;
    const hl = x.createRadialGradient(cx, cy, r * .6, cx, cy, r * 2.4); hl.addColorStop(0, 'rgba(255,90,190,.45)'); hl.addColorStop(1, 'rgba(255,90,190,0)'); x.fillStyle = hl; x.fillRect(cx - r * 2.5, cy - r * 2.5, r * 5, r * 5);
    const sg = x.createLinearGradient(0, cy - r, 0, cy + r); sg.addColorStop(0, '#ffe36b'); sg.addColorStop(.55, '#ff8a5c'); sg.addColorStop(1, '#ff2fa0'); x.fillStyle = sg; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
    for (let i = 0; i < 8; i++) { const yy = cy + 6 + i * 14 + ((t * 10) % 14), th = 2 + i * 1.6; if (yy > cy + r) continue; x.fillStyle = mix(yy); x.fillRect(cx - r - 2, yy, r * 2 + 4, th); }
    x.restore();
    // ecualizador
    x.save(); x.translate(o.camL * .7, 0); x.globalAlpha = .55; const bars = q ? 46 : 22;
    for (let i = 0; i < bars; i++) { const bx = wrap(i * (o.vw + 300) / bars + 40, o, .3) - o.camL * .3 + o.camL * .3; const hgt = 14 + 70 * (Math.abs(Math.sin(t * 3.1 + i * .8)) * .5 + b * hh(i + 3) * .8); const g = x.createLinearGradient(0, 514 - hgt, 0, 514); g.addColorStop(0, '#ff5cc8'); g.addColorStop(1, '#4cf3ff'); x.fillStyle = g; x.fillRect(bx, 514 - hgt, 9, hgt); }
    x.restore();
    // skyline
    x.save(); x.translate(o.camL * .62, 0); const w0 = 62, x0 = o.camL * .38 - 120; x.fillStyle = '#0e0426';
    for (let bx = Math.floor(x0 / w0) * w0; bx < x0 + o.vw + 240; bx += w0) { const idx = Math.floor(bx / w0), hgt = 70 + hh(idx + 3) * 130, bw = w0 - 4 - hh(idx) * 10; x.fillStyle = '#0e0426'; x.fillRect(bx, 514 - hgt, bw, hgt);
      if (q) for (let wy = 514 - hgt + 10; wy < 506; wy += 14) for (let wx = bx + 6; wx < bx + bw - 8; wx += 12) { const on = hh(idx * 31 + wx * .13 + wy * .07 + Math.floor(t * .6 + hh(wx + wy))) > .55; if (on) { x.fillStyle = hh(wx * .1 + idx) > .5 ? 'rgba(255,92,200,.8)' : 'rgba(76,243,255,.75)'; x.fillRect(wx, wy, 5, 7); } } }
    x.restore();
    // láseres
    x.save(); x.globalCompositeOperation = 'lighter'; x.translate(o.camL * .9, 0);
    for (let i = 0; i < 3; i++) { const ox = 200 + i * 440, ang = -Math.PI / 2 + Math.sin(t * .9 + i * 2.1) * .95; x.strokeStyle = i === 1 ? 'rgba(76,243,255,.16)' : 'rgba(255,92,200,.16)'; x.lineWidth = 12; x.beginPath(); x.moveTo(ox, 514); x.lineTo(ox + Math.cos(ang) * 900, 514 + Math.sin(ang) * 900); x.stroke(); x.lineWidth = 3; x.strokeStyle = i === 1 ? 'rgba(180,250,255,.55)' : 'rgba(255,170,230,.55)'; x.stroke(); }
    x.restore();
  },

  /* ───── Arcade 8-bit: cielo en bandas, sol pixelado, invasores y ciudad de píxeles ───── */
  arcade(x, o) {
    const { t, q } = o, b = pulse(o.beat), P = 6;
    // cielo en bandas
    const bands = ['#160d4f', '#201566', '#2f1b7c', '#4a2294', '#7a2fa3', '#b43f98', '#e5607a'], bh = 520 / bands.length;
    x.save(); x.globalAlpha = .88; bands.forEach((c, i) => { x.fillStyle = c; x.fillRect(o.camL - 160, i * bh, o.vw + 320, bh + 1); });
    x.globalAlpha = .5; bands.forEach((c, i) => { if (i === 0) return; for (let px = 0; px < o.vw + 320; px += P * 2) { x.fillStyle = bands[i - 1]; x.fillRect(Math.floor((o.camL - 160 + px) / (P * 2)) * P * 2 + (i % 2 ? P : 0), i * bh - P, P, P); } }); x.restore();
    // moneda gigante pixelada (firma del escenario: se lee como "arcade" aun siendo chica)
    x.save(); x.translate(o.camL * .9, 0); { const cx = 900, cy = 196 + Math.round(Math.sin(t * 2) * 4), R = 72;
      for (let yy = -R; yy < R; yy += P) { const w = Math.sqrt(R * R - yy * yy), x0 = Math.round((cx - w) / P) * P, ww = Math.round(w * 2 / P) * P;
        x.fillStyle = '#c98a00'; x.fillRect(x0, cy + yy, ww, P); x.fillStyle = yy < -R * .3 ? '#fff0a0' : '#ffd23f'; x.fillRect(x0 + P, cy + yy, Math.max(0, ww - P * 2), P); }
      x.fillStyle = '#c98a00'; x.fillRect(cx - P, cy - 30, P * 2, 60); x.fillStyle = '#7a4d00'; x.fillRect(cx - P / 2, cy - 24, P, 48);
      if (Math.sin(t * 3) > .2) { x.fillStyle = '#fff'; x.fillRect(cx - 44, cy - 52, P, P * 3); x.fillRect(cx - 44 - P, cy - 52 + P, P * 3, P); } }
    x.restore();
    // estrellas
    x.save(); for (let i = 0; i < 40; i++) { x.globalAlpha = hh(i + Math.floor(t * 1.3)) > .5 ? 1 : .25; x.fillStyle = '#fff'; x.fillRect(Math.floor(wrap(hh(i) * (o.vw + 400), o, .06) / P) * P, Math.floor(hh(i + 1) * 260 / P) * P, P / 2 * (1 + (i % 2)), P / 2 * (1 + (i % 2))); } x.restore();
    // nubes
    x.save(); x.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 5; i++) { const cxp = Math.floor(wrap(i * 360 + t * 14, o, .22) / P) * P, cyp = 90 + (i * 53 % 160); x.fillRect(cxp, cyp, P * 8, P); x.fillRect(cxp + P, cyp - P, P * 5, P); x.fillRect(cxp + P * 2, cyp - P * 2, P * 3, P); x.fillRect(cxp - P, cyp + P, P * 10, P); }
    x.restore();
    // invasores
    const A = [0x0420, 0x0e70, 0x1ff8, 0x3b6c, 0x7ffe, 0x2184, 0x4002, 0x2004]; // 16x8 abajo se dibuja como 11x8 simplificado
    const SH = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'], SH2 = ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'];
    x.save(); x.translate(o.camL * .75, 0); x.fillStyle = 'rgba(190,255,200,.8)'; const step = Math.floor(t * 2) % 2, sw = Math.sin(t * .5) * 120;
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { const ix = 280 + i * 120 + sw + (r ? 40 : 0), iy = 70 + r * 62, sp = step ? SH2 : SH; for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 11; xx++) if (sp[yy][xx] === '1') x.fillRect(Math.round(ix + xx * 4), iy + yy * 4, 4, 4); }
    const sk = Math.floor(t * 1.4); x.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const sx = 280 + ((sk * 3 + i * 5) % 6) * 120 + sw + 22, sy = 140 + ((t * 160 + i * 130) % 380); x.fillRect(Math.round(sx), Math.round(sy), 4, 12); } x.restore();
    // fila de gabinetes de arcade (dos capas): marquesina, pantalla animada, panel con palanca y botones
    const CAB = ['#e5365a', '#2bb5ff', '#ffd23f', '#5dff8a', '#c04bff'];
    for (const [d, body, H0, dim] of [[.3, '#1c1160', 192, .5], [.5, '#0d0733', 144, .72]]) {
      x.save(); x.translate(o.camL * (1 - d), 0); const w0 = P * 16, x0 = o.camL * d - 120;
      for (let bx = Math.floor(x0 / w0) * w0; bx < x0 + o.vw + 240; bx += w0) {
        const idx = Math.floor(bx / w0), col = CAB[((idx % 5) + 5) % 5], h = H0 - ((((idx % 3) + 3) % 3) * P), y0 = 514 - h, X = bx + P, wd = P * 14;
        x.globalAlpha = dim; x.fillStyle = body; x.fillRect(X, y0, wd, h);
        x.fillStyle = col; x.fillRect(X + P, y0 + P, wd - P * 2, P * 3);                       // marquesina
        x.fillStyle = '#04030f'; x.fillRect(X + P, y0 + P * 5, wd - P * 2, Math.round(h * .38 / P) * P);   // pantalla
        const sh = Math.round(h * .38 / P) * P, sx0 = X + P, sy0 = y0 + P * 5;
        if (q) { x.fillStyle = col; for (let k = 0; k < 5; k++) { const px = sx0 + Math.floor(hh(idx * 9 + k + Math.floor(t * (1 + idx % 3))) * ((wd - P * 2) / P - 1)) * P, py = sy0 + Math.floor(hh(idx * 5 + k * 3 + Math.floor(t * (1.5 + idx % 2))) * (sh / P - 1)) * P; x.fillRect(px, py, P, P); } }
        else { x.fillStyle = col; x.fillRect(sx0 + P * 2, sy0 + P * 2, P * 2, P); x.fillRect(sx0 + P * 6, sy0 + P * 3, P, P); }
        const cy2 = y0 + P * 5 + sh + P;                                                        // panel de control
        x.fillStyle = col; x.fillRect(X, cy2, wd, P); x.fillStyle = '#2a1a70'; x.fillRect(X + P, cy2 + P, wd - P * 2, P * 3);
        x.fillStyle = '#fff'; x.fillRect(X + P * 3, cy2 + P, P, P * 2); x.fillStyle = col; x.fillRect(X + P * 2, cy2 + P, P * 3, P);   // palanca
        x.fillStyle = '#ffd23f'; x.fillRect(X + P * 8, cy2 + P * 2, P, P); x.fillStyle = '#ff5a7a'; x.fillRect(X + P * 10, cy2 + P * 2, P, P);   // botones
        if (q) { x.globalAlpha = dim * .18; x.fillStyle = col; x.fillRect(X - P, y0 - P, wd + P * 2, h + P); }   // resplandor de la pantalla
      }
      x.restore();
    }
    x.globalAlpha = 1;
    if (q) { x.save(); x.globalAlpha = .1; x.fillStyle = '#000'; for (let y = 0; y < 600; y += 4) x.fillRect(o.camL - 40, y, o.vw + 80, 1.5); x.restore(); }
    if (b > .5) { x.save(); x.globalAlpha = .06 * b; x.fillStyle = '#fff'; x.fillRect(o.camL - 40, 0, o.vw + 80, 560); x.restore(); }
  },

  /* ───── Vacío: agujero negro con disco de acreción, escombros en espiral y estrellas que se estiran ───── */
  void(x, o) {
    const { t, q } = o, b = pulse(o.beat), cx = 640, cy = 210;
    // nebulosas
    x.save(); x.translate(o.camL * .95, 0); for (let i = 0; i < 3; i++) { const nx = 260 + i * 380 + Math.sin(t * .1 + i) * 60, ny = 200 + Math.cos(t * .13 + i * 2) * 70, g = x.createRadialGradient(nx, ny, 10, nx, ny, 260); g.addColorStop(0, i === 1 ? 'rgba(255,90,60,.22)' : 'rgba(150,80,255,.26)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(nx - 270, ny - 270, 540, 540); } x.restore();
    // estrellas que caen al agujero
    x.save(); x.translate(o.camL * .88, 0); x.globalCompositeOperation = 'lighter'; const n = q ? 46 : 18;
    for (let i = 0; i < n; i++) { const p = Math.pow(fr(t * .12 + hh(i)), 1.8), ang = hh(i + 3) * TAU, d0 = 120 + (1 - p) * 700, ex = cx + Math.cos(ang) * d0, ey = cy + Math.sin(ang) * d0 * .55, len = 6 + p * 46 + 8; x.strokeStyle = 'rgba(210,200,255,' + (.15 + (1 - p) * .55) + ')'; x.lineWidth = 1 + (1 - p) * 1.2; x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex - Math.cos(ang) * -len * .4 * 1, ey - Math.sin(ang) * -len * .22); x.stroke(); }
    x.restore();
    // halo gigante + fragmentos de cristal flotando (silueta propia: se reconoce aunque se vea chico)
    x.save(); x.translate(o.camL * .86, 0); x.globalCompositeOperation = 'lighter'; x.lineWidth = 3; x.strokeStyle = 'rgba(180,140,255,' + (.2 + b * .22) + ')'; x.beginPath(); x.arc(cx, cy, 236, 0, TAU); x.stroke();
    x.lineWidth = 2; x.strokeStyle = 'rgba(255,170,90,.16)'; x.setLineDash([10, 18]); x.beginPath(); x.arc(cx, cy, 268, t * .12, t * .12 + TAU); x.stroke(); x.setLineDash([]); x.restore();
    x.save(); x.translate(o.camL * .55, 0);
    for (let i = 0; i < 7; i++) {
      const sx = 90 + i * 190 + hh(i) * 40, sy = 150 + hh(i + 9) * 150 + Math.sin(t * .5 + i * 1.7) * 12, sz = 34 + hh(i + 4) * 46, r0 = t * .08 * (i % 2 ? 1 : -1) + i;
      x.save(); x.translate(sx, sy); x.rotate(Math.sin(r0) * .3); x.beginPath(); x.moveTo(0, -sz * 1.2); x.lineTo(sz * .55, -sz * .1); x.lineTo(sz * .3, sz * .9); x.lineTo(-sz * .25, sz * .6); x.lineTo(-sz * .6, -sz * .2); x.closePath();
      x.fillStyle = '#080320'; x.fill(); x.lineWidth = 2; x.strokeStyle = 'rgba(180,140,255,.65)'; x.stroke();
      x.beginPath(); x.moveTo(0, -sz * 1.2); x.lineTo(sz * .55, -sz * .1); x.lineTo(sz * .1, sz * .1); x.closePath(); x.fillStyle = 'rgba(180,140,255,.18)'; x.fill(); x.restore();
    }
    x.restore();
    // disco de acreción
    x.save(); x.translate(o.camL * .86, 0); x.translate(cx, cy); x.rotate(-.22); x.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 9; k++) { const rx = 62 + k * 20, ry = rx * .26, sp = 1.9 / (1 + k * .35); const g = x.createLinearGradient(-rx, 0, rx, 0); g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(.3, k < 4 ? 'rgba(255,230,160,.85)' : 'rgba(255,140,60,.55)'); g.addColorStop(.5, 'rgba(255,255,255,.9)'); g.addColorStop(.7, k < 4 ? 'rgba(255,230,160,.85)' : 'rgba(255,140,60,.55)'); g.addColorStop(1, 'rgba(255,120,40,0)'); x.strokeStyle = g; x.lineWidth = 4 - k * .25 + b * 1.4; x.globalAlpha = .75 - k * .05; x.setLineDash([46 + k * 8, 20 + k * 6]); x.lineDashOffset = -t * 60 * sp; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, TAU); x.stroke(); }
    x.setLineDash([]); x.restore();
    // horizonte de sucesos + lente gravitacional
    x.save(); x.translate(o.camL * .86, 0); x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, 48, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,' + (.55 + b * .4) + ')'; x.lineWidth = 2.2; x.beginPath(); x.arc(cx, cy, 50, 0, TAU); x.stroke();
    x.globalCompositeOperation = 'lighter'; const lg = x.createRadialGradient(cx, cy, 48, cx, cy, 120); lg.addColorStop(0, 'rgba(255,200,140,.4)'); lg.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = lg; x.beginPath(); x.arc(cx, cy, 120, 0, TAU); x.fill(); x.restore();
    // escombros en espiral
    x.save(); x.translate(o.camL * .86, 0); const m = q ? 64 : 24;
    for (let i = 0; i < m; i++) { const life = fr(t * .06 + hh(i)), r = 330 * (1 - life) + 52, ang = hh(i + 4) * TAU + t * (1.1 + 90 / r) * (hh(i + 2) > .3 ? 1 : -.4) + life * 6, px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r * .27; if (Math.sin(ang) < 0 && r < 78) continue; x.globalAlpha = Math.min(1, life * 4) * (1 - Math.pow(life, 6)); x.fillStyle = r < 120 ? '#ffd7a0' : r < 200 ? '#ff9a5a' : '#a87bff'; const sz = 1.5 + (1 - life) * 2.2 + hh(i) * 1.5; x.fillRect(px, py, sz, sz); }
    x.restore();
  }
};

/* efectos del piso (se dibujan después de la grilla, antes de los luchadores) */
const FLOOR = {
  core(x, o) { const b = pulse(o.beat); x.save(); x.globalAlpha = .05 + .22 * b; x.fillStyle = o.acc; x.fillRect(o.camL - 60, o.top, o.vw + 120, 24); x.restore(); },
  marte(x, o) { x.save(); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { const bx = o.camL - 40 + hh(i) * (o.vw + 80), by = o.top + 18 + hh(i + 1) * 60; x.strokeStyle = 'rgba(255,110,40,' + (.25 + .25 * Math.sin(o.t * 2 + i * 1.3)) + ')'; x.lineWidth = 2; x.beginPath(); x.moveTo(bx, by); let px = bx, py = by; for (let k = 0; k < 5; k++) { px += 24 + hh(i * 5 + k) * 30; py += (hh(i * 9 + k) - .5) * 14; x.lineTo(px, py); } x.stroke(); } x.restore(); },
  hielo(x, o) { x.save(); for (let i = 0; i < 16; i++) { const a = .5 + .5 * Math.sin(o.t * 2.2 + i * 1.9); if (a < .55) continue; const sx = o.camL - 40 + hh(i + 7) * (o.vw + 80), sy = o.top + 10 + hh(i + 2) * 80, s = 4 + a * 5; x.strokeStyle = 'rgba(220,245,255,' + a * .9 + ')'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(sx - s, sy); x.lineTo(sx + s, sy); x.moveTo(sx, sy - s); x.lineTo(sx, sy + s); x.stroke(); } x.restore(); },
  neon(x, o) { const b = pulse(o.beat); x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .15 + .3 * b; const g = x.createLinearGradient(0, o.top, 0, o.top + 70); g.addColorStop(0, '#ff5cc8'); g.addColorStop(1, 'rgba(255,92,200,0)'); x.fillStyle = g; x.fillRect(o.camL - 60, o.top, o.vw + 120, 70); x.restore(); },
  arcade(x, o) { x.save(); x.beginPath(); x.rect(o.camL - 80, o.top + 3, o.vw + 160, 140); x.clip(); const s = 54, off = (o.t * 50) % (s * 2); for (let r = 0; r < 4; r++) for (let c = -2; c < o.vw / s + 3; c++) { if ((r + c) % 2) continue; const px = Math.floor((o.camL - 80) / s) * s + c * s - off + s * 2, py = o.top + 3 + r * 26; x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(px, py, s, 26); } x.restore(); },
  void(x, o) { x.save(); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const p = fr(o.t * .22 + i / 3); x.strokeStyle = 'rgba(190,150,255,' + (.35 * (1 - p)) + ')'; x.lineWidth = 2; x.beginPath(); x.ellipse(640 + (o.camL - 0) * .0, o.top + 20, 80 + p * 620, 6 + p * 34, 0, 0, TAU); x.stroke(); } x.restore(); }
};
const FLOOR_SCROLL = { core: .2, marte: 0, hielo: 0, neon: .9, arcade: 0, void: .35 };

/* ═════════ Escenarios nuevos: Original LeiaNET (planetas del CSS), Matrix, Windows 95 y Pixel Art ═════════ */
const W0 = 1320, PX = 6, FONT95 = 'Tahoma,"MS Sans Serif",Arial,sans-serif';
const GLY = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';
const rr = (v, p) => Math.round(v / p) * p;

/* planeta con el mismo degradé / cráteres / anillo que el CSS de index.html */
function planet(x, cx, cy, r, cols, glow, ringC, ringRx, ringRy) {
  let g = x.createRadialGradient(cx, cy, r * .6, cx, cy, r * 1.9); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  x.save(); x.translate(cx, cy); x.rotate(-.314); x.strokeStyle = ringC; x.lineWidth = 1.5; x.beginPath(); x.ellipse(0, 0, ringRx, ringRy, 0, 0, TAU); x.stroke();
  x.globalAlpha = .5; x.beginPath(); x.ellipse(0, 0, ringRx - 9, ringRy - 4, 0, 0, TAU); x.stroke(); x.restore();
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.clip();
  g = x.createLinearGradient(cx - r * .7, cy - r * .7, cx + r * .7, cy + r * .7); g.addColorStop(0, cols[0]); g.addColorStop(.45, cols[1]); g.addColorStop(1, cols[2]); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  g = x.createRadialGradient(cx - r * .36, cy - r * .44, 0, cx - r * .36, cy - r * .44, r * .85); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  g = x.createRadialGradient(cx - r * .3, cy - r * .3, r * .5, cx - r * .3, cy - r * .3, r * 1.5); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.7)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  x.fillStyle = 'rgba(0,0,0,.16)';
  for (const c of [[.22, .4, 6], [.68, .25, 9], [.48, .7, 5], [.78, .6, 4]]) { x.beginPath(); x.arc(cx - r + c[0] * r * 2, cy - r + c[1] * r * 2, c[2] * r / 205, 0, TAU); x.fill(); }
  x.restore();
}
/* Windows 95: biseles, ventanas, íconos, diálogos */
function bev(x, X, Y, Wd, Ht, down) {
  x.fillStyle = '#c0c0c0'; x.fillRect(X, Y, Wd, Ht);
  if (!down) { x.fillStyle = '#fff'; x.fillRect(X, Y, Wd - 1, 1); x.fillRect(X, Y, 1, Ht - 1); x.fillStyle = '#000'; x.fillRect(X, Y + Ht - 1, Wd, 1); x.fillRect(X + Wd - 1, Y, 1, Ht); x.fillStyle = '#808080'; x.fillRect(X + 1, Y + Ht - 2, Wd - 2, 1); x.fillRect(X + Wd - 2, Y + 1, 1, Ht - 2); }
  else { x.fillStyle = '#808080'; x.fillRect(X, Y, Wd - 1, 1); x.fillRect(X, Y, 1, Ht - 1); x.fillStyle = '#fff'; x.fillRect(X, Y + Ht - 1, Wd, 1); x.fillRect(X + Wd - 1, Y, 1, Ht); x.fillStyle = '#000'; x.fillRect(X + 1, Y + 1, Wd - 3, 1); x.fillRect(X + 1, Y + 1, 1, Ht - 3); }
}
function titleBar(x, X, Y, Wd, title, active) {
  const g = x.createLinearGradient(X, 0, X + Wd, 0);
  if (active) { g.addColorStop(0, '#000080'); g.addColorStop(1, '#1084d0'); } else { g.addColorStop(0, '#808080'); g.addColorStop(1, '#b5b5b5'); }
  x.fillStyle = g; x.fillRect(X + 3, Y + 3, Wd - 6, 18);
  x.fillStyle = '#fff'; x.font = '700 11px ' + FONT95; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(title, X + 8, Y + 13);
  bev(x, X + Wd - 20, Y + 5, 16, 14, false); x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(X + Wd - 16, Y + 9); x.lineTo(X + Wd - 8, Y + 16); x.moveTo(X + Wd - 8, Y + 9); x.lineTo(X + Wd - 16, Y + 16); x.stroke();
}
function win95w(x, X, Y, Wd, Ht, title, active, t, kind) {
  bev(x, X, Y, Wd, Ht, false); titleBar(x, X, Y, Wd, title, active);
  const cx = X + 4, cy = Y + 24, cw = Wd - 8, ch = Ht - 28; x.fillStyle = '#fff'; x.fillRect(cx, cy, cw, ch); x.fillStyle = '#808080'; x.fillRect(cx, cy, cw, 1); x.fillRect(cx, cy, 1, ch);
  if (kind === 0) {
    x.fillStyle = '#000'; x.font = '11px ' + FONT95; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('Copiando...', cx + 10, cy + 16);
    x.fillStyle = '#808080'; x.fillRect(cx + 10, cy + 30, cw - 20, 18); x.fillStyle = '#fff'; x.fillRect(cx + 11, cy + 31, cw - 22, 16);
    const nb = Math.floor((cw - 24) / 11), on = Math.floor(((t * .5) % 1) * nb); x.fillStyle = '#000080'; for (let i = 0; i < on; i++) x.fillRect(cx + 13 + i * 11, cy + 33, 9, 12);
  } else if (kind === 1) {
    const colr = ['#f00', '#0a0', '#00f', '#f80', '#808', '#088', '#880'], bw = (cw - 24) / 7;
    for (let i = 0; i < 7; i++) { const h = 8 + (Math.sin(t * 2 + i * 1.3) * .5 + .5) * (ch - 26); x.fillStyle = colr[i]; x.fillRect(cx + 12 + i * bw, cy + ch - 8 - h, bw - 5, h); }
  } else if (kind === 2) {
    x.fillStyle = '#000'; for (let i = 0; i < 6; i++) x.fillRect(cx + 10, cy + 12 + i * 14, (cw - 20) * (.45 + hh(i + 3) * .55), 3);
  } else {
    for (let i = 0; i < 6; i++) { const ix = cx + 14 + (i % 3) * 56, iy = cy + 10 + Math.floor(i / 3) * 44; x.fillStyle = '#ffd84c'; x.fillRect(ix, iy + 4, 26, 18); x.fillRect(ix, iy, 12, 6); x.fillStyle = '#000'; x.fillRect(ix + 3, iy + 28, 20, 2); }
  }
}
function ico95(x, X, Y, kind, sel, label) {
  if (kind === 0) { x.fillStyle = '#c0c0c0'; x.fillRect(X, Y, 32, 24); x.fillStyle = '#008080'; x.fillRect(X + 4, Y + 3, 24, 16); x.fillStyle = '#c0c0c0'; x.fillRect(X + 10, Y + 24, 12, 4); x.fillRect(X + 6, Y + 28, 20, 3); }
  else if (kind === 1) { x.fillStyle = '#9a9a9a'; x.beginPath(); x.moveTo(X + 4, Y + 6); x.lineTo(X + 28, Y + 6); x.lineTo(X + 25, Y + 31); x.lineTo(X + 7, Y + 31); x.fill(); x.fillStyle = '#6a6a6a'; x.fillRect(X + 2, Y + 3, 28, 3); x.fillStyle = '#0a0'; x.fillRect(X + 12, Y + 14, 8, 10); }
  else if (kind === 2) { x.fillStyle = '#ffd84c'; x.fillRect(X, Y + 6, 32, 24); x.fillRect(X, Y + 2, 14, 6); x.fillStyle = '#b58a00'; x.fillRect(X, Y + 28, 32, 2); }
  else { x.fillStyle = '#fff'; x.fillRect(X + 4, Y, 24, 32); x.fillStyle = '#000'; for (let i = 0; i < 5; i++) x.fillRect(X + 8, Y + 6 + i * 5, 16, 1); }
  x.font = '11px ' + FONT95; x.textAlign = 'center'; x.textBaseline = 'top';
  const tw = x.measureText(label).width + 6; if (sel) { x.fillStyle = '#000080'; x.fillRect(X + 16 - tw / 2, Y + 36, tw, 14); } x.fillStyle = '#fff'; x.fillText(label, X + 16, Y + 37);
}
function dlg95(x, X, Y) {
  bev(x, X, Y, 210, 86, false); titleBar(x, X, Y, 210, 'Error', true);
  x.fillStyle = '#f00'; x.beginPath(); x.arc(X + 30, Y + 46, 12, 0, TAU); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(X + 25, Y + 41); x.lineTo(X + 35, Y + 51); x.moveTo(X + 35, Y + 41); x.lineTo(X + 25, Y + 51); x.stroke();
  x.fillStyle = '#000'; x.fillRect(X + 56, Y + 36, 120, 3); x.fillRect(X + 56, Y + 46, 90, 3); bev(x, X + 80, Y + 62, 50, 18, false);
  x.fillStyle = '#000'; x.font = '11px ' + FONT95; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('OK', X + 105, Y + 71);
}

const NEW_FX = {
  /* ───── Original LeiaNET: el fondo espacial de la web (nebulosas, estrellas, planeta gris con anillo, planeta ámbar, asteroide, satélite) ───── */
  original(x, o) {
    const { t, q } = o, b = pulse(o.beat), vw = o.vw;
    x.save(); x.translate(o.camL, 0);
    let g = x.createRadialGradient(vw * .15, -60, 0, vw * .15, -60, 820); g.addColorStop(0, 'rgba(217,164,65,.16)'); g.addColorStop(1, 'rgba(217,164,65,0)'); x.fillStyle = g; x.fillRect(-60, -60, vw + 120, 700);
    g = x.createRadialGradient(vw * .9, -20, 0, vw * .9, -20, 640); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-60, -60, vw + 120, 700);
    for (const nb of [[.08, 150, 440, '120,140,255', .17, .12], [.92, 470, 400, '217,164,65', .15, .1], [.6, 250, 340, '255,255,255', .08, .09]]) {
      const nx = vw * nb[0] + Math.sin(t * nb[5]) * 70, ny = nb[1] + Math.cos(t * nb[5] * 1.3) * 40, r = nb[2];
      g = x.createRadialGradient(nx, ny, 0, nx, ny, r); g.addColorStop(0, 'rgba(' + nb[3] + ',' + nb[4] + ')'); g.addColorStop(1, 'rgba(' + nb[3] + ',0)'); x.fillStyle = g; x.fillRect(nx - r, ny - r, r * 2, r * 2);
    }
    x.restore();
    for (let L = 0; L < 3; L++) {
      const k = [.04, .09, .16][L], n = (q ? [70, 46, 26] : [34, 20, 10])[L], sz = 1 + L * .6;
      x.save(); x.translate(o.camL * k, 0); x.fillStyle = '#fff';
      for (let i = 0; i < n; i++) { x.globalAlpha = (.25 + .75 * (.5 + .5 * Math.sin(t * (1.2 + L * .5) + hh(i + L * 50) * 40))) * (.5 + L * .2); x.fillRect(hh(i + L * 13) * W0, hh(i + 7 + L * 31) * 470, sz, sz); }
      x.restore();
    }
    x.save(); x.translate(o.camL * .9, 0); planet(x, 1010, 170 + Math.sin(t * .24) * 9, 150, ['#3a3a40', '#232326', '#131315'], 'rgba(199,199,204,' + (.16 + .12 * b) + ')', 'rgba(199,199,204,.3)', 235, 60); x.restore();
    x.save(); x.translate(o.camL * .85, 0); planet(x, 150, 470 + Math.cos(t * .2) * 8, 130, ['#4a3d2c', '#2a2320', '#14110f'], 'rgba(217,164,65,' + (.2 + .1 * b) + ')', 'rgba(217,164,65,.26)', 200, 50); x.restore();
    // asteroide
    x.save(); x.translate(o.camL * .8, 0); x.translate(330 + Math.sin(t * .33) * 45, 150 + Math.cos(t * .4) * 20); x.rotate(t * .12);
    g = x.createLinearGradient(-30, -24, 30, 24); g.addColorStop(0, '#4a4a50'); g.addColorStop(.55, '#2c2c30'); g.addColorStop(1, '#17171a'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 32, 26, 0, 0, TAU); x.fill();
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.arc(-9, -5, 4, 0, TAU); x.fill(); x.beginPath(); x.arc(10, 6, 3, 0, TAU); x.fill(); x.restore();
    // satélite
    x.save(); x.translate(o.camL * .75, 0); x.translate(((t * 16) % (W0 + 240)) - 120, 300 + Math.sin(t * .5) * 28); x.rotate(-.52);
    x.fillStyle = 'rgba(217,164,65,.55)'; x.strokeStyle = 'rgba(217,164,65,.6)'; x.lineWidth = 1; x.fillRect(-35, -4, 16, 8); x.strokeRect(-35, -4, 16, 8); x.fillRect(19, -4, 16, 8); x.strokeRect(19, -4, 16, 8);
    g = x.createLinearGradient(-11, -7, 11, 7); g.addColorStop(0, '#c7c7cc'); g.addColorStop(.55, '#8f8f96'); g.addColorStop(1, '#4a4a50'); x.fillStyle = g; x.fillRect(-11, -7, 22, 14); x.fillStyle = '#d9d9de'; x.fillRect(-5, -17, 10, 10);
    if (Math.sin(t * 2.4) > 0) { x.fillStyle = '#d9a441'; x.fillRect(5, -9, 3, 3); } x.restore();
    // constelación con forma de huella de perra: firma de LeiaNET (ámbar, tenue, sin competir con la pelea)
    x.save(); x.translate(o.camL * .8, 62); x.translate(400, 214); x.scale(.88, .88); x.translate(-400, -214);
    { const pts = [[400, 214, 14], [326, 150, 9], [372, 108, 9], [432, 108, 9], [478, 150, 9]], tw = k => .55 + .45 * Math.sin(t * 1.6 + k * 1.3);
      x.strokeStyle = 'rgba(255,200,100,.55)'; x.lineWidth = 2; x.setLineDash([4, 7]); x.beginPath(); for (let k = 1; k < 5; k++) { x.moveTo(pts[0][0], pts[0][1]); x.lineTo(pts[k][0], pts[k][1]); } x.moveTo(pts[1][0], pts[1][1]); x.lineTo(pts[2][0], pts[2][1]); x.lineTo(pts[3][0], pts[3][1]); x.lineTo(pts[4][0], pts[4][1]); x.stroke(); x.setLineDash([]);
      pts.forEach((p, k) => { const g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], p[2] * 3); g.addColorStop(0, 'rgba(255,224,150,' + (.9 * tw(k)) + ')'); g.addColorStop(1, 'rgba(217,164,65,0)'); x.fillStyle = g; x.fillRect(p[0] - p[2] * 3, p[1] - p[2] * 3, p[2] * 6, p[2] * 6); x.fillStyle = '#fff3d0'; x.fillRect(p[0] - 4, p[1] - 4, 8, 8); x.globalAlpha = .5 * tw(k); x.fillRect(p[0] - 1, p[1] - 12, 2, 24); x.fillRect(p[0] - 12, p[1] - 1, 24, 2); x.globalAlpha = 1; }); }
    x.restore();
    // estrella fugaz
    const kk = Math.floor(t / 4.1), p = fr(t / 4.1) * 3;
    if (p < 1) { const sx = o.camL + hh(kk) * o.vw * .7, sy = 30 + hh(kk + 2) * 90, hx = sx + p * 420, hy = sy + p * 170; g = x.createLinearGradient(hx - 120, hy - 48, hx, hy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.95)'); x.save(); x.strokeStyle = g; x.lineWidth = 2.5; x.beginPath(); x.moveTo(hx - 120, hy - 48); x.lineTo(hx, hy); x.stroke(); x.fillStyle = '#fff'; x.fillRect(hx - 1.5, hy - 1.5, 3, 3); x.restore(); }
  },

  /* ───── Matrix: lluvia de código en dos capas, glitch y barrido ───── */
  matrix(x, o) {
    const { t, q } = o, b = pulse(o.beat), vw = o.vw;
    x.save(); x.translate(o.camL, 0);
    const g = x.createRadialGradient(vw / 2, 240, 10, vw / 2, 240, 520); g.addColorStop(0, 'rgba(0,255,65,' + (.1 + .12 * b) + ')'); g.addColorStop(1, 'rgba(0,255,65,0)'); x.fillStyle = g; x.fillRect(-60, -60, vw + 120, 700);
    x.restore();
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (let L = 0; L < 2; L++) {
      const far = L === 0, k = far ? .35 : .75, fs = far ? 12 : 19, lh = far ? 14 : 22, cols = q ? (far ? 34 : 24) : (far ? 16 : 11), gap = W0 / cols;
      x.save(); x.translate(o.camL * k, 0); x.font = (far ? '' : '700 ') + fs + 'px "Pixelify Sans",ui-monospace,monospace';
      for (let i = 0; i < cols; i++) {
        const sp = (far ? 60 : 110) + hh(i + L * 40) * (far ? 90 : 230), n = (far ? 9 : 12) + Math.floor(hh(i + 3 + L * 40) * (far ? 8 : 10)), cx = i * gap + gap * .5 + (hh(i + 9) - .5) * gap * .4;
        const cyc = 560 + n * lh, head = ((t * sp + hh(i + 5 + L * 40) * cyc) % cyc) - n * lh * .2;
        if (!far) { x.fillStyle = 'rgba(0,255,65,' + (.08 + .3 * b) + ')'; x.fillRect(cx - fs * .6, head - lh * .1, fs * 1.2, lh * 1.2); }
        for (let j = 0; j < n; j++) {
          const y = head - j * lh; if (y < -lh || y > 560) continue;
          const gi = Math.floor(hh(i * 31 + j * 7 + Math.floor(t * (j ? 2 + hh(i) * 4 : 14)) * 13 + L * 5) * GLY.length) % GLY.length, a = (1 - j / n) * (far ? .38 : .85);
          x.fillStyle = j === 0 ? 'rgba(215,255,225,' + Math.min(1, a + .15) + ')' : 'rgba(0,255,65,' + a + ')';
          x.fillText(GLY[gi], cx, y);
        }
      }
      x.restore();
    }
    const gp = t % 7.3;
    if (gp < .22) { x.save(); x.fillStyle = 'rgba(0,255,65,.14)'; for (let i = 0; i < 5; i++) x.fillRect(o.camL - 40 + (hh(i + 9) - .5) * 80, hh(Math.floor(t / 7.3) + i) * 480, vw + 80, 6 + hh(i + 2) * 22); x.restore(); }
    if (q) { x.save(); x.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < 560; y += 4) x.fillRect(o.camL - 40, y, vw + 80, 1.5); x.restore(); }
    const sw = (t * .18) % 1; x.save(); x.fillStyle = 'rgba(0,255,65,.05)'; x.fillRect(o.camL - 40, sw * 640 - 60, vw + 80, 60); x.restore();
  },

  /* ───── Windows 95: escritorio verde-azulado, ventanas, íconos, diálogos de error, cursor y pantallazo azul ───── */
  win95(x, o) {
    const { t, q } = o, b = pulse(o.beat), vw = o.vw;
    // salvapantallas: banderas voladoras
    x.save(); x.translate(o.camL * .5, 0); const nf = q ? 26 : 12;
    for (let i = 0; i < nf; i++) {
      const p = fr(t * .12 + i / nf), s = 3 + p * p * 40, ang = hh(i + 2) * TAU, d = p * p * 760, fx = 640 + Math.cos(ang) * d, fy = 250 + Math.sin(ang) * d * .6, h = s / 2;
      x.globalAlpha = Math.min(1, p * 3) * .55; x.fillStyle = '#f33'; x.fillRect(fx, fy, h, h); x.fillStyle = '#3c3'; x.fillRect(fx + h, fy, h, h); x.fillStyle = '#36f'; x.fillRect(fx, fy + h, h, h); x.fillStyle = '#fd2'; x.fillRect(fx + h, fy + h, h, h);
    }
    x.restore();
    // íconos del escritorio
    x.save(); x.translate(o.camL * .95, 0); const sel = Math.floor(t / 1.7) % 4;
    [['Mi PC', 0], ['Papelera', 1], ['LEIA', 2], ['Docs', 3]].forEach((ic, i) => ico95(x, 34, 40 + i * 100, ic[1], i === sel, ic[0])); x.restore();
    // ventanas
    x.save(); x.translate(o.camL * .75, 0); const act = Math.floor(t / 2.4) % 4;
    [[60, 40, 280, 140, 'LEIA.EXE', 0], [400, 80, 250, 130, 'Estadísticas', 1], [720, 36, 270, 150, 'Bloc de notas', 2], [1010, 100, 230, 130, 'Mi PC', 3]].forEach((w, i) => {
      win95w(x, Math.round(w[0] + Math.sin(t * .4 + i * 1.7) * 22), Math.round(w[1] + Math.cos(t * .5 + i * 2.3) * 12), w[2], w[3], w[4], i === act, t, w[5]);
    });
    x.restore();
    // diálogos de error en cascada + cursor
    x.save(); x.translate(o.camL * .8, 0);
    const k = Math.floor(t / 2.6), p = fr(t / 2.6), dx = 200 + hh(k) * 760, dy = 150 + hh(k + 3) * 200;
    if (p < .85) { dlg95(x, Math.round(dx), Math.round(dy)); if (p > .3) dlg95(x, Math.round(dx + 18), Math.round(dy + 18)); }
    const mx = 640 + Math.sin(t * .7) * 380, my = 250 + Math.cos(t * .9) * 120;
    if (b > .5) { x.strokeStyle = 'rgba(255,255,255,' + b + ')'; x.lineWidth = 2; x.beginPath(); x.arc(mx, my, 8 + (1 - b) * 24, 0, TAU); x.stroke(); }
    x.translate(mx, my); x.scale(1.6, 1.6); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 16); x.lineTo(4, 12); x.lineTo(7, 19); x.lineTo(10, 18); x.lineTo(7, 11); x.lineTo(12, 11); x.closePath(); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 1.2; x.strokeStyle = '#000'; x.stroke();
    x.restore();
    // pantallazo azul
    if ((t % 21) > 20.55) {
      x.save(); x.fillStyle = '#0000aa'; x.fillRect(o.camL - 60, -40, vw + 120, 600); x.fillStyle = '#fff'; x.font = '700 15px "Courier New",monospace'; x.textAlign = 'left'; x.textBaseline = 'top';
      x.fillText('Windows', o.camL + 40, 60); x.fillText('Un error fatal 0E ha ocurrido en 0028:C0011E36', o.camL + 40, 110); x.fillText('Presione una tecla para continuar _', o.camL + 40, 160); x.restore();
    }
  },

  /* ───── Pixel Art: paisaje diurno de píxeles (montañas, pinos, nubes, globo, pájaros) ───── */
  pixel(x, o) {
    const { t } = o, b = pulse(o.beat), vw = o.vw, P = PX;
    const bands = ['#4cb8f5', '#5fc4f8', '#74d0fa', '#8adbfc', '#a2e5fd', '#bdeefe', '#d8f6ff'], bh = 520 / bands.length;
    x.save(); bands.forEach((c, i) => { x.fillStyle = c; x.fillRect(o.camL - 160, i * bh, vw + 320, bh + 1); });
    bands.forEach((c, i) => { if (!i) return; x.fillStyle = bands[i - 1]; for (let px = 0; px < vw + 320; px += P * 2) x.fillRect(Math.floor((o.camL - 160 + px) / (P * 2)) * P * 2 + (i % 2 ? P : 0), i * bh - P, P, P); }); x.restore();
    // sol con rayos
    x.save(); x.translate(o.camL * .9, 0); const sx = 930, sy = 130, R = 48 + (b > .5 ? P / 2 : 0), st = Math.floor(t * 1.5) % 2;
    x.fillStyle = '#fff6a0'; for (let i = 0; i < 8; i++) { const a = (i + st * .5) * Math.PI / 4, d = R + 14 + (i % 2) * 10; x.fillRect(rr(sx + Math.cos(a) * d, P) - P, rr(sy + Math.sin(a) * d, P) - P, P * 2, P * 2); }
    for (let yy = -R; yy < R; yy += P) { const w = Math.sqrt(R * R - yy * yy); x.fillStyle = yy < -18 ? '#fff27a' : yy < 20 ? '#ffd23a' : '#ffb02e'; x.fillRect(rr(sx - w, P), sy + yy, rr(w * 2, P), P); }
    x.restore();
    // nubes
    x.save(); for (let i = 0; i < 6; i++) { const cx = rr(wrap(i * 300 + t * (10 + i * 2), o, .2), P), cy = 70 + (i * 47 % 150);
      x.fillStyle = '#fff'; x.fillRect(cx, cy, P * 8, P); x.fillRect(cx + P, cy - P, P * 5, P); x.fillRect(cx + P * 2, cy - P * 2, P * 3, P); x.fillRect(cx - P, cy + P, P * 10, P); x.fillStyle = '#cfe9ff'; x.fillRect(cx - P, cy + P * 2, P * 10, P); }
    x.restore();
    // globo aerostático
    x.save(); x.translate(o.camL * .6, 0); { const bx = rr(520 + Math.sin(t * .2) * 200, P), by = rr(150 + Math.sin(t * .5) * 12, P), ws = [3, 5, 7, 7, 7, 5, 3];
      ws.forEach((w, r) => { for (let c = 0; c < w; c++) { x.fillStyle = c % 2 ? '#ff4d4d' : '#fff'; x.fillRect(bx - w * P / 2 + c * P, by + r * P, P, P); } });
      x.fillStyle = '#3a2a1a'; x.fillRect(bx - P, by + 8 * P, P * 2, P); x.fillRect(bx - P * 1.5, by + 7 * P, P / 2, P); x.fillRect(bx + P, by + 7 * P, P / 2, P); } x.restore();
    // montañas y colinas
    for (const L of [[.25, '#7ea5e0', true, 60, 150, .31], [.45, '#4faf5c', false, 30, 70, .5]]) {
      const d = L[0], w0 = P * 2, x0 = o.camL * d - 120; x.save(); x.translate(o.camL * (1 - d), 0);
      for (let bx = Math.floor(x0 / w0) * w0; bx < x0 + vw + 240; bx += w0) {
        const idx = bx / w0, h = Math.max(P, rr(L[3] + L[4] * (.55 + .3 * Math.sin(idx * L[5]) + .15 * Math.sin(idx * L[5] * 2.7 + d * 10)), P));
        x.fillStyle = L[1]; x.fillRect(bx, 514 - h, w0, h); x.fillStyle = 'rgba(0,0,60,.13)'; x.fillRect(bx, 514 - h + P * 3, P, h - P * 3);
        if (L[2] && h > 150) { x.fillStyle = '#fff'; x.fillRect(bx, 514 - h, w0, P * 2); if (idx % 2) x.fillRect(bx, 514 - h + P * 2, P, P); }
      }
      x.restore();
    }
    // pinos
    x.save(); x.translate(o.camL * .35, 0); { const w0 = 90, x0 = o.camL * .65 - 120;
      for (let bx = Math.floor(x0 / w0) * w0; bx < x0 + vw + 240; bx += w0) {
        const idx = bx / w0, px = bx + Math.round(hh(idx) * 30 / P) * P, rows = 4 + Math.floor(hh(idx + 3) * 3), sw = Math.sin(t * 2 + idx) > .6 ? P : 0;
        for (let r = 0; r < rows; r++) { const w = P * (1 + 2 * r), y = 514 - P * 2 - (rows - r) * P, off = r < 2 ? sw : 0; x.fillStyle = r % 2 ? '#2a9a48' : '#1f7a3a'; x.fillRect(rr(px - w / 2, P) + off, y, w, P); }
        x.fillStyle = '#6b4423'; x.fillRect(px - P / 2, 514 - P * 2, P, P * 2);
      } } x.restore();
    // pájaros
    x.save(); for (let i = 0; i < 3; i++) { const bx = rr(wrap(i * 420 + t * 46, o, .12), P), by = rr(110 + i * 36 + Math.sin(t * 2 + i) * 14, P), fl = Math.floor(t * 4 + i) % 2; x.fillStyle = '#2b3a67';
      if (fl) { x.fillRect(bx - P, by - P, P, P); x.fillRect(bx, by, P, P); x.fillRect(bx + P, by - P, P, P); } else { x.fillRect(bx - P, by + P, P, P); x.fillRect(bx, by, P, P); x.fillRect(bx + P, by + P, P, P); } }
    x.restore();
  }
};
Object.assign(FX, NEW_FX);

const NEW_FLOOR = {
  original(x, o) { FLOOR.core(x, o); },
  matrix(x, o) {
    const b = pulse(o.beat); x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(0,255,65,' + (.08 + .25 * b) + ')'; x.fillRect(o.camL - 60, o.top, o.vw + 120, 18);
    x.font = '12px monospace'; x.textAlign = 'left'; x.textBaseline = 'top'; const sp = o.vw + 80;
    for (let i = 0; i < 14; i++) { const px = o.camL - 40 + (((hh(i) * sp - o.t * (30 + hh(i + 3) * 60)) % sp) + sp) % sp; x.fillStyle = 'rgba(0,255,65,' + (.15 + .3 * hh(i + 8)) + ')'; x.fillText(GLY[Math.floor(hh(i + Math.floor(o.t * 2)) * GLY.length) % GLY.length], px, o.top + 22 + hh(i + 5) * 70); }
    x.restore();
  },
  win95(x, o) { // barra de tareas
    const X = o.camL - 60, Wd = o.vw + 120, top = o.top, t = o.t, cl = o.camL;
    bev(x, X, top + 2, Wd, 42, false);
    bev(x, cl + 8, top + 8, 82, 30, false); x.fillStyle = '#f33'; x.fillRect(cl + 16, top + 15, 7, 7); x.fillStyle = '#3c3'; x.fillRect(cl + 24, top + 15, 7, 7); x.fillStyle = '#36f'; x.fillRect(cl + 16, top + 23, 7, 7); x.fillStyle = '#fd2'; x.fillRect(cl + 24, top + 23, 7, 7);
    x.fillStyle = '#000'; x.font = '700 13px ' + FONT95; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('Inicio', cl + 38, top + 24);
    const dn = Math.floor(t / 2.4) % 3;
    for (let i = 0; i < 3; i++) { bev(x, cl + 104 + i * 128, top + 8, 120, 30, i === dn); x.fillStyle = ['#000080', '#008080', '#ffd84c'][i]; x.fillRect(cl + 112 + i * 128, top + 16, 14, 14); x.fillStyle = '#000'; x.fillRect(cl + 132 + i * 128, top + 22, 60, 3); }
    const tx = cl + o.vw - 112; bev(x, tx, top + 8, 104, 30, true); const m = Math.floor(t) % 60; x.fillStyle = '#000'; x.font = '12px ' + FONT95; x.textAlign = 'right'; x.fillText('12:' + (m < 10 ? '0' : '') + m, tx + 96, top + 24);
    x.fillStyle = '#808080'; x.fillRect(tx + 8, top + 19, 6, 8); x.fillRect(tx + 14, top + 16, 4, 14);
  },
  pixel(x, o) {
    const P = PX; x.save(); x.beginPath(); x.rect(o.camL - 80, o.top - 20, o.vw + 160, 90); x.clip();
    const w3 = P * 3, x0 = Math.floor((o.camL - 80) / w3) * w3;
    for (let px = x0; px < o.camL + o.vw + 80; px += w3) {
      const idx = px / w3, h = (hh(idx) > .5 ? 2 : 1) * P;
      x.fillStyle = '#7be36b'; x.fillRect(px, o.top - h + P, P, h); x.fillStyle = '#3f9d4a'; x.fillRect(px + P, o.top + 2, P, P);
      if (idx % 7 === 0) { const col = ['#ff5a5a', '#ffe36b', '#fff', '#ff8ad8'][Math.abs(idx) % 4 | 0], on = Math.sin(o.t * 3 + idx) > -.4; x.fillStyle = col; x.fillRect(px, o.top - P * 3, P, P); if (on) { x.fillRect(px - P, o.top - P * 2, P, P); x.fillRect(px + P, o.top - P * 2, P, P); x.fillRect(px, o.top - P * 2 - P * 2 + P * 3, P, 0); } x.fillStyle = '#3f9d4a'; x.fillRect(px, o.top - P * 2, P, P * 2); }
    }
    for (let r = 0; r < 3; r++) for (let px = x0; px < o.camL + o.vw + 80; px += P) { if (((px / P) + r) % 2) continue; x.fillStyle = 'rgba(0,0,0,.09)'; x.fillRect(px, o.top + 14 + r * P * 2, P, P); }
    x.restore();
  }
};
Object.assign(FLOOR, NEW_FLOOR);
Object.assign(FLOOR_SCROLL, { original: .2, matrix: .6, win95: 0, pixel: 0 });

root.KStages = {
  draw(id, x, o) { const f = FX[id]; if (f) f(x, o); },
  floor(id, x, o) { const f = FLOOR[id]; if (f) f(x, o); },
  scroll(id) { return FLOOR_SCROLL[id] || 0; }
};
})(window);