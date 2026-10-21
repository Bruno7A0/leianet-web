/* Precio en pesos (estilo Steamcito) — JS puro, sin dependencias.
   Uso: <div id="pp-app"></div> + este script. Se inicia solo.
   Precio en US$ + plataforma + método de pago => total en pesos con IVA y percepciones.
   Cotizaciones en vivo de dolarapi.com (cache 15 min en sessionStorage); si falla, usa una referencia fija.
   Todo texto se inserta con textContent (nunca innerHTML). Elecciones y ajustes se guardan en localStorage. */
(function () {
  'use strict';
  var root = document.getElementById('pp-app');
  if (!root) return;

  /* ---------- 1. Datos ---------- */
  var REF_FECHA = '21/10/2026';
  var REF = { oficial: 1545, mep: 1545.68, cripto: 1623.14, blue: 1570 };
  var PLATAFORMAS = [
    { id: 'steam', n: 'Steam', perc: false },
    { id: 'epic', n: 'Epic Games', perc: false },
    { id: 'ps', n: 'PlayStation', perc: false },
    { id: 'xbox', n: 'Xbox', perc: false },
    { id: 'nin', n: 'Nintendo eShop', perc: false },
    { id: 'sus', n: 'Suscripciones (Netflix, Spotify…)', perc: true },
    { id: 'otro', n: 'Otro servicio digital', perc: true }
  ];
  var METODOS = [
    { id: 'card', n: 'Tarjeta en pesos', k: 'oficial', perc: true, d: 'Crédito, débito o prepaga que te cobra en pesos.' },
    { id: 'mep', n: 'Pagando en dólares (MEP)', k: 'mep', perc: false, d: 'Comprás dólares MEP y pagás el resumen en USD (o débito en dólares).' },
    { id: 'cripto', n: 'Cripto / USDT', k: 'cripto', perc: false, d: 'Tarjeta cripto o saldo en USDT.' },
    { id: 'blue', n: 'Dólar blue', k: 'blue', perc: false, d: 'Dólares en efectivo o a través de terceros.' }
  ];
  var RATE_LBL = { oficial: 'Dólar oficial', mep: 'Dólar MEP', cripto: 'Dólar cripto', blue: 'Dólar blue' };
  var API = 'https://dolarapi.com/v1/dolares';
  var CACHE_KEY = 'pp-cotiz-v1', SAVE_KEY = 'pp-estado-v1', CACHE_MS = 15 * 60 * 1000;
  var QUICK = [9.99, 19.99, 29.99, 59.99, 69.99];

  var S = { usd: '', pl: 'steam', me: 'card', iva: 21, perc: 30, otros: 0, ov: {} };
  var live = null, liveInfo = '', liveState = 'ref';
  try {
    var sv = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (sv && typeof sv === 'object') {
      if (PLATAFORMAS.some(function (p) { return p.id === sv.pl; })) S.pl = sv.pl;
      if (METODOS.some(function (m) { return m.id === sv.me; })) S.me = sv.me;
      ['iva', 'perc', 'otros'].forEach(function (k) { if (isFinite(sv[k]) && sv[k] >= 0 && sv[k] <= 200) S[k] = +sv[k]; });
      if (sv.ov && typeof sv.ov === 'object') Object.keys(REF).forEach(function (k) { if (isFinite(sv.ov[k]) && sv.ov[k] > 0) S.ov[k] = +sv.ov[k]; });
    }
  } catch (e) {}
  function guardar() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ pl: S.pl, me: S.me, iva: S.iva, perc: S.perc, otros: S.otros, ov: S.ov })); } catch (e) {} }

  /* ---------- 2. Cálculo ---------- */
  function leerNumero(t) {
    var s = String(t == null ? '' : t).trim();
    if (!s) return NaN;
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    return /^(\d+(\.\d*)?|\.\d+)$/.test(s) ? parseFloat(s) : NaN;
  }
  function tasa(k) { return S.ov[k] || (live && live[k]) || REF[k]; }
  function plat() { return PLATAFORMAS.filter(function (p) { return p.id === S.pl; })[0]; }
  function calcular(m) {
    var usd = leerNumero(S.usd); if (!(usd > 0) || usd > 100000) usd = 0;
    var r = tasa(m.k), base = usd * r, iva = base * S.iva / 100;
    var aplica = m.perc && plat().perc, pp = aplica ? base * S.perc / 100 : 0, ot = base * S.otros / 100;
    return { usd: usd, rate: r, base: base, iva: iva, pp: pp, aplica: aplica, ot: ot, tot: base + iva + pp + ot };
  }
  function ars0(n) { return '$ ' + Math.round(n).toLocaleString('es-AR'); }
  function ars2(n) { return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* ---------- 3. DOM ---------- */
  function h(tag, cls, txt, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  root.classList.add('pp-app');
  var el = {};

  // Entrada
  var cIn = h('div', 'pp-card');
  cIn.appendChild(h('label', 'pp-lbl', 'Precio en dólares', { for: 'pp-usd' }));
  var wrap = h('div', 'pp-input');
  wrap.appendChild(h('span', null, 'US$'));
  el.usd = h('input', null, null, { id: 'pp-usd', type: 'text', inputmode: 'decimal', placeholder: '59,99', autocomplete: 'off', 'aria-label': 'Precio en dólares' });
  el.usd.addEventListener('input', function () { S.usd = el.usd.value; pintar(); });
  wrap.appendChild(el.usd);
  cIn.appendChild(wrap);
  var quick = h('div', 'pp-chips pp-quick');
  QUICK.forEach(function (q) {
    var b = h('button', 'pp-chip pp-chip--sm', 'US$ ' + String(q).replace('.', ','), { type: 'button' });
    b.addEventListener('click', function () { el.usd.value = String(q).replace('.', ','); S.usd = el.usd.value; pintar(); });
    quick.appendChild(b);
  });
  cIn.appendChild(quick);
  cIn.appendChild(h('div', 'pp-lbl pp-sec', 'Plataforma'));
  el.pl = h('div', 'pp-chips', null, { role: 'radiogroup', 'aria-label': 'Plataforma' });
  cIn.appendChild(el.pl);
  cIn.appendChild(h('div', 'pp-lbl pp-sec', 'Método de pago'));
  el.me = h('div', 'pp-chips', null, { role: 'radiogroup', 'aria-label': 'Método de pago' });
  cIn.appendChild(el.me);
  el.meDesc = h('p', 'pp-hint');
  cIn.appendChild(el.meDesc);

  // Resultado
  var cRes = h('div', 'pp-card pp-res', null, { 'aria-live': 'polite' });
  cRes.appendChild(h('span', 'pp-lbl', 'Vas a pagar aprox.'));
  el.tot = h('div', 'pp-big', '$ 0');
  el.eff = h('div', 'pp-eff');
  el.copy = h('button', 'pp-copy', 'Copiar total', { type: 'button' });
  el.copy.addEventListener('click', function () {
    var c = calcular(METODOS.filter(function (m) { return m.id === S.me; })[0]);
    if (!c.usd) return;
    var txt = String(Math.round(c.tot));
    var ok = function () { el.copy.textContent = 'Copiado ✓'; setTimeout(function () { el.copy.textContent = 'Copiar total'; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () {});
  });
  cRes.appendChild(el.tot); cRes.appendChild(el.eff); cRes.appendChild(el.copy);

  // Desglose
  var cDet = h('div', 'pp-card');
  cDet.appendChild(h('div', 'pp-lbl', 'Desglose'));
  el.det = h('div', 'pp-rows');
  cDet.appendChild(el.det);

  // Comparación
  var cCmp = h('div', 'pp-card');
  cCmp.appendChild(h('div', 'pp-lbl', 'Comparar métodos de pago'));
  el.cmp = h('div', 'pp-cmp');
  cCmp.appendChild(el.cmp);

  // Ajustes
  var cSet = h('div', 'pp-card');
  var det = h('details', 'pp-details');
  det.appendChild(h('summary', null, 'Ajustar cotizaciones e impuestos'));
  el.status = h('p', 'pp-status');
  det.appendChild(el.status);
  var grid = h('div', 'pp-grid');
  el.inputs = {};
  function campo(key, etiqueta, getVal, setVal) {
    var l = h('label', 'pp-field'); l.appendChild(h('span', null, etiqueta));
    var i = h('input', null, null, { type: 'text', inputmode: 'decimal', autocomplete: 'off' });
    i.addEventListener('input', function () { var n = leerNumero(i.value); setVal(n); pintar(true); });
    l.appendChild(i); grid.appendChild(l); el.inputs[key] = { i: i, get: getVal };
  }
  Object.keys(RATE_LBL).forEach(function (k) {
    campo(k, RATE_LBL[k], function () { return tasa(k); }, function (n) { if (n > 0) S.ov[k] = n; else delete S.ov[k]; guardar(); });
  });
  campo('iva', 'IVA %', function () { return S.iva; }, function (n) { S.iva = n >= 0 && n <= 200 ? n : 0; guardar(); });
  campo('perc', 'Percepción Ganancias %', function () { return S.perc; }, function (n) { S.perc = n >= 0 && n <= 200 ? n : 0; guardar(); });
  campo('otros', 'Otros impuestos % (IIBB, sellos)', function () { return S.otros; }, function (n) { S.otros = n >= 0 && n <= 200 ? n : 0; guardar(); });
  det.appendChild(grid);
  var reset = h('button', 'pp-reset', 'Restablecer cotizaciones', { type: 'button' });
  reset.addEventListener('click', function () { S.ov = {}; guardar(); pintar(); });
  det.appendChild(reset);
  cSet.appendChild(det);

  [cIn, cRes, cDet, cCmp, cSet].forEach(function (c) { root.appendChild(c); });
  el.nota = h('p', 'pp-note', 'Es una estimación. Para videojuegos (Steam, Epic, PlayStation, Xbox, Nintendo) ARCA eliminó la percepción del 30 % de Ganancias; en suscripciones y otros servicios digitales sigue vigente. Si tu provincia o tu banco suman otros cargos, cargalos en “Otros impuestos”. Confirmá siempre con el resumen de tu tarjeta.');
  root.appendChild(el.nota);

  /* ---------- 4. Pintado ---------- */
  function chips(cont, lista, sel, cb) {
    cont.textContent = '';
    lista.forEach(function (x) {
      var on = sel(x);
      var b = h('button', 'pp-chip' + (on ? ' is-on' : ''), x.n, { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false' });
      b.addEventListener('click', function () { cb(x); });
      cont.appendChild(b);
    });
  }
  function fila(a, b, tot) {
    var r = h('div', 'pp-row' + (tot ? ' pp-row--tot' : ''));
    r.appendChild(h('span', null, a)); r.appendChild(h('span', null, b));
    return r;
  }
  function pintar(sinInputs) {
    var me = METODOS.filter(function (m) { return m.id === S.me; })[0];
    chips(el.pl, PLATAFORMAS, function (p) { return p.id === S.pl; }, function (p) { S.pl = p.id; guardar(); pintar(); });
    chips(el.me, METODOS, function (m) { return m.id === S.me; }, function (m) { S.me = m.id; guardar(); pintar(); });
    el.meDesc.textContent = me.d;
    var c = calcular(me);
    el.tot.textContent = ars0(c.tot);
    el.eff.textContent = c.usd ? 'Dólar efectivo: ' + ars2(c.tot / c.usd) + ' por US$ 1' : 'Ingresá un precio para calcular';
    el.copy.hidden = !c.usd;
    el.det.textContent = '';
    el.det.appendChild(fila('Precio en US$', c.usd ? 'US$ ' + c.usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'));
    el.det.appendChild(fila('Cotización (' + RATE_LBL[me.k] + ')', ars2(c.rate)));
    el.det.appendChild(fila('Precio convertido', ars2(c.base)));
    el.det.appendChild(fila('IVA servicios digitales ' + S.iva + ' %', ars2(c.iva)));
    if (me.perc) el.det.appendChild(fila('Percepción Ganancias ' + S.perc + ' %', c.aplica ? ars2(c.pp) : 'No aplica a esta plataforma'));
    if (S.otros > 0) el.det.appendChild(fila('Otros impuestos ' + S.otros + ' %', ars2(c.ot)));
    el.det.appendChild(fila('Total', ars2(c.tot), true));
    var all = METODOS.map(function (m) { return { m: m, c: calcular(m) }; }).sort(function (a, b) { return a.c.tot - b.c.tot; });
    el.cmp.textContent = '';
    all.forEach(function (x, i) {
      var b = h('button', 'pp-cmp__it' + (x.m.id === S.me ? ' is-on' : ''), null, { type: 'button' });
      var l = h('span', null, x.m.n);
      if (i === 0 && x.c.usd) l.appendChild(h('em', null, 'MÁS BARATO'));
      b.appendChild(l); b.appendChild(h('b', null, ars0(x.c.tot)));
      b.addEventListener('click', function () { S.me = x.m.id; guardar(); pintar(); });
      el.cmp.appendChild(b);
    });
    el.status.textContent = liveState === 'live'
      ? 'Cotizaciones en vivo (dolarapi.com)' + liveInfo + '. Podés corregirlas a mano.'
      : 'No se pudieron traer las cotizaciones en vivo: usamos las de referencia del ' + REF_FECHA + '. Podés corregirlas a mano.';
    if (!sinInputs) Object.keys(el.inputs).forEach(function (k) {
      var v = el.inputs[k].get(); el.inputs[k].i.value = String(v).replace('.', ',');
    });
  }

  /* ---------- 5. Cotizaciones en vivo ---------- */
  function aplicarLive(arr) {
    var map = { oficial: 'oficial', bolsa: 'mep', cripto: 'cripto', blue: 'blue' }, out = {}, fecha = '';
    (Array.isArray(arr) ? arr : []).forEach(function (d) {
      var k = d && map[d.casa], v = d && +d.venta;
      if (k && isFinite(v) && v > 100 && v < 100000) { out[k] = v; if (k === 'oficial' && d.fechaActualizacion) fecha = d.fechaActualizacion; }
    });
    if (Object.keys(out).length < 4) return false;
    live = out; liveState = 'live';
    var dt = fecha ? new Date(fecha) : null;
    liveInfo = dt && !isNaN(dt) ? ' · actualizado ' + dt.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return true;
  }
  function cargar() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.ts < CACHE_MS && aplicarLive(c.data)) return Promise.resolve();
    } catch (e) {}
    var ctl = window.AbortController ? new AbortController() : null;
    var to = ctl ? setTimeout(function () { ctl.abort(); }, 7000) : 0;
    return fetch(API, ctl ? { signal: ctl.signal } : {}).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { if (aplicarLive(d)) { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: d })); } catch (e) {} } })
      .catch(function () {}).then(function () { clearTimeout(to); });
  }

  pintar();
  cargar().then(function () { pintar(); });
})();
