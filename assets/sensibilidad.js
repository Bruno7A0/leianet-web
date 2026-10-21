/* Conversor de sensibilidad — JS puro, sin dependencias, sin API ni backend.
   Uso: <div id="sc-app"></div> + este script. Se inicia solo.

   Es solo matemática: cada juego mueve la cámara una cantidad fija de grados por "cuenta" del mouse
   (el "yaw") multiplicada por la sensibilidad. Dos configuraciones giran igual cuando
       yaw × sensibilidad × DPI
   (grados por pulgada recorrida) es el mismo. De ahí salen la sensibilidad equivalente, el eDPI
   (sensibilidad × DPI) y los cm necesarios para girar 360°.

   Todo texto se inserta con textContent (nunca innerHTML). Lo último que elegiste se guarda en localStorage. */
(function () {
  'use strict';

  /* ---------- 1. Datos ---------- */

  // yaw = grados que gira la cámara por cada cuenta del mouse con sensibilidad 1.
  // dec = decimales que admite el menú del juego (para redondear el resultado).
  const JUEGOS = [
    { id: 'cs',   nombre: 'Counter-Strike', detalle: 'CS 1.6 · CS:GO · CS2', yaw: 0.022,  dec: 3 },
    { id: 'val',  nombre: 'Valorant',       detalle: 'Riot Games',           yaw: 0.07,   dec: 3 },
    { id: 'apex', nombre: 'Apex Legends',   detalle: 'Respawn',              yaw: 0.022,  dec: 3 },
    { id: 'ow',   nombre: 'Overwatch 2',    detalle: 'Blizzard',             yaw: 0.0066, dec: 2 }
  ];
  const POR_ID = Object.fromEntries(JUEGOS.map(j => [j.id, j]));

  const DPIS = [400, 800, 1600, 3200];
  const LIM = { sensMin: 0.001, sensMax: 1000, dpiMin: 50, dpiMax: 64000 };
  const KEY = 'sc-estado-v1';
  const DEFECTO = { juego: 'cs', sens: '1', dpi: '800', dpiDestino: '' };
  const CM_POR_PULGADA = 2.54;

  /* ---------- 2. Matemática ---------- */

  // "1,5" o "1.5" -> 1.5; NaN si no es un número positivo simple (sin notación científica ni signos).
  function leerNumero(txt) {
    const s = String(txt == null ? '' : txt).trim().replace(',', '.');
    if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }

  function redondear(n, dec) {
    const f = Math.pow(10, dec);
    return Math.round(n * f) / f;
  }

  // Grados que gira la cámara por cada pulgada que movés el mouse.
  function gradosPorPulgada(juego, sens, dpi) { return juego.yaw * sens * dpi; }
  function cmPara360(juego, sens, dpi) { return 360 / gradosPorPulgada(juego, sens, dpi) * CM_POR_PULGADA; }

  // Devuelve una fila por juego (en el orden de JUEGOS). La del juego de origen es tu config tal cual (origen:true).
  // Con DPI destino distinto, justo después va la misma config del juego de origen ajustada a ese DPI (otroDpi:true).
  function convertir(origenId, sens, dpi, dpiDestino) {
    const ori = POR_ID[origenId];
    if (!ori) throw new Error('Juego desconocido: ' + origenId);
    const dpiFin = dpiDestino > 0 ? dpiDestino : dpi;
    const gpp = gradosPorPulgada(ori, sens, dpi);
    const cmObjetivo = cmPara360(ori, sens, dpi);

    function fila(j, extra) {
      const exacta = gpp / (j.yaw * dpiFin);
      // El menú del juego no admite más decimales: se redondea, sin llegar nunca a 0.
      const usada = Math.max(redondear(exacta, j.dec), Math.pow(10, -j.dec));
      const cm = cmPara360(j, usada, dpiFin);
      return Object.assign({
        id: j.id, juego: j, origen: false, otroDpi: false, sens: usada, exacta: exacta, dpi: dpiFin,
        edpi: usada * dpiFin, cm360: cm, pulg360: cm / CM_POR_PULGADA,
        difPct: (cmObjetivo / cm - 1) * 100   // + = la versión redondeada gira un poco más rápido
      }, extra);
    }

    const filas = [];
    JUEGOS.forEach(j => {
      if (j.id === ori.id) {
        filas.push({ id: j.id, juego: j, origen: true, otroDpi: false, sens: sens, exacta: sens, dpi: dpi, edpi: sens * dpi, cm360: cmObjetivo, pulg360: cmObjetivo / CM_POR_PULGADA, difPct: 0 });
        if (dpiFin !== dpi) filas.push(fila(j, { otroDpi: true }));
      } else {
        filas.push(fila(j));
      }
    });
    return filas;
  }

  /* ---------- 3. Formato ---------- */

  function num(n, maxDec) {
    if (!isFinite(n)) return '—';
    const s = n.toFixed(maxDec);
    return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
  }
  function fmtSens(n, dec) { return num(n, dec); }
  function fmtEdpi(n) { return num(n, n < 100 ? 2 : 1); }
  function fmtCm(n) { return isFinite(n) ? n.toFixed(n < 10 ? 2 : 1) : '—'; }
  function fmtDif(p) {
    if (Math.abs(p) < 0.005) return '0 %';
    return (p > 0 ? '+' : '−') + num(Math.abs(p), 2) + ' %';
  }

  /* ---------- 4. Estado guardado ---------- */

  function leerGuardado() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!o || typeof o !== 'object') return Object.assign({}, DEFECTO);
      return {
        juego: POR_ID[o.juego] ? o.juego : DEFECTO.juego,
        sens: typeof o.sens === 'string' && o.sens.length <= 12 ? o.sens : DEFECTO.sens,
        dpi: typeof o.dpi === 'string' && o.dpi.length <= 8 ? o.dpi : DEFECTO.dpi,
        dpiDestino: typeof o.dpiDestino === 'string' && o.dpiDestino.length <= 8 ? o.dpiDestino : ''
      };
    } catch (e) { return Object.assign({}, DEFECTO); }
  }
  function guardar(e) {
    try { localStorage.setItem(KEY, JSON.stringify(e)); } catch (err) { /* modo privado: no pasa nada */ }
  }

  /* ---------- 5. Interfaz ---------- */

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;   // textContent: nunca interpreta HTML
    return n;
  }

  // Copiar al portapapeles, con respaldo para navegadores/contextos que no tienen la API.
  async function copiar(txt) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); return true; }
    } catch (e) { /* cae al respaldo */ }
    const ta = el('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function crearTarjeta(r) {
    const card = el('li', 'sc-card' + (r.origen ? ' sc-card--origen' : ''));
    card.dataset.juego = r.id;
    const top = el('div', 'sc-card__top');
    const tit = el('div');
    tit.append(el('h3', 'sc-card__name', r.juego.nombre), el('p', 'sc-card__det', r.juego.detalle));
    top.appendChild(tit);
    if (r.origen) top.appendChild(el('span', 'sc-badge', 'Tu config'));
    else if (r.otroDpi) top.appendChild(el('span', 'sc-badge sc-badge--alt', 'Otro DPI'));

    const valor = el('div', 'sc-card__valor');
    const numero = el('span', 'sc-card__num', fmtSens(r.sens, r.juego.dec));
    numero.setAttribute('aria-label', 'Sensibilidad en ' + r.juego.nombre + ': ' + fmtSens(r.sens, r.juego.dec));
    const btn = el('button', 'sc-btn sc-btn--mini', 'Copiar');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Copiar sensibilidad de ' + r.juego.nombre);
    btn.addEventListener('click', async () => {
      const original = btn.dataset.orig || (btn.dataset.orig = btn.textContent);   // se guarda una vez: el doble click no deja "Copiado"
      const ok = await copiar(fmtSens(r.sens, r.juego.dec));
      btn.textContent = ok ? 'Copiado ✓' : 'No se pudo';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.textContent = original; }, 1400);
    });
    valor.append(numero, btn);

    const dl = el('dl', 'sc-stats');
    const fila = (k, v) => { const w = el('div'); w.append(el('dt', null, k), el('dd', null, v)); dl.appendChild(w); };
    fila('eDPI', fmtEdpi(r.edpi));
    fila('DPI', num(r.dpi, 0));
    fila('cm / 360°', fmtCm(r.cm360));
    card.append(top, valor, dl);

    if (!r.origen) {
      const pie = el('p', 'sc-card__pie');
      const exacto = fmtSens(r.exacta, 5);
      const hayError = Math.abs(r.difPct) >= 0.005;
      pie.textContent = hayError
        ? 'Exacto: ' + exacto + ' · diferencia por redondeo: ' + fmtDif(r.difPct)
        : 'Equivalencia exacta.';
      card.appendChild(pie);
    }
    return card;
  }

  function iniciar(root) {
    const guardado = leerGuardado();
    const estado = { juego: guardado.juego, sens: guardado.sens, dpi: guardado.dpi, dpiDestino: guardado.dpiDestino };

    /* Encabezado (div y no <header>: el CSS global estiliza <header> como barra de navegación) */
    const head = el('div', 'sc-head');
    const izq = el('div');
    izq.append(
      el('h2', 'sc-head__title', 'Mismo giro, en todos los juegos'),
      el('p', 'sc-head__sub', 'Elegí tu juego, ponés tu sensibilidad y tu DPI, y te damos la equivalente en los demás.')
    );
    const resumen = el('p', 'sc-pill');
    resumen.setAttribute('role', 'status');
    resumen.setAttribute('aria-live', 'polite');
    head.append(izq, resumen);

    /* Formulario */
    const form = el('form', 'sc-toolbar');
    form.noValidate = true;
    form.setAttribute('aria-label', 'Datos de tu configuración');
    form.addEventListener('submit', ev => ev.preventDefault());

    const fJuego = el('div', 'sc-field sc-field--full');
    fJuego.append(el('span', 'sc-label', 'Juego de origen'));
    const chipsJuego = el('div', 'sc-chips');
    chipsJuego.setAttribute('role', 'group');
    chipsJuego.setAttribute('aria-label', 'Juego de origen');
    const chipJuegoEls = JUEGOS.map(j => {
      const c = el('button', 'sc-chip', j.nombre);
      c.type = 'button';
      c.dataset.v = j.id;
      chipsJuego.appendChild(c);
      return c;
    });
    fJuego.appendChild(chipsJuego);

    const fSens = el('div', 'sc-field');
    const lSens = el('label', 'sc-label', 'Sensibilidad');
    lSens.htmlFor = 'sc-sens';
    const inSens = el('input', 'sc-input');
    inSens.id = 'sc-sens';
    inSens.type = 'text';
    inSens.inputMode = 'decimal';
    inSens.autocomplete = 'off';
    inSens.maxLength = 12;
    inSens.placeholder = 'ej. 1.5';
    inSens.setAttribute('aria-describedby', 'sc-err');
    fSens.append(lSens, inSens);

    const fDpi = el('div', 'sc-field');
    const lDpi = el('label', 'sc-label', 'DPI del mouse');
    lDpi.htmlFor = 'sc-dpi';
    const inDpi = el('input', 'sc-input');
    inDpi.id = 'sc-dpi';
    inDpi.type = 'text';
    inDpi.inputMode = 'numeric';
    inDpi.autocomplete = 'off';
    inDpi.maxLength = 8;
    inDpi.placeholder = 'ej. 800';
    inDpi.setAttribute('aria-describedby', 'sc-err');
    fDpi.append(lDpi, inDpi);

    const fPre = el('div', 'sc-field');
    fPre.append(el('span', 'sc-label', 'DPI comunes'));
    const chipsDpi = el('div', 'sc-chips');
    chipsDpi.setAttribute('role', 'group');
    chipsDpi.setAttribute('aria-label', 'DPI comunes');
    const chipDpiEls = DPIS.map(d => {
      const c = el('button', 'sc-chip', String(d));
      c.type = 'button';
      c.dataset.v = String(d);
      chipsDpi.appendChild(c);
      return c;
    });
    fPre.appendChild(chipsDpi);

    const fDest = el('div', 'sc-field');
    const lDest = el('label', 'sc-label', 'DPI destino (opcional)');
    lDest.htmlFor = 'sc-dpi-dest';
    const inDest = el('input', 'sc-input');
    inDest.id = 'sc-dpi-dest';
    inDest.type = 'text';
    inDest.inputMode = 'numeric';
    inDest.autocomplete = 'off';
    inDest.maxLength = 8;
    inDest.placeholder = 'igual al tuyo';
    inDest.setAttribute('aria-describedby', 'sc-err sc-ayuda-dest');
    fDest.appendChild(lDest);
    fDest.appendChild(inDest);
    const ayudaDest = el('span', 'sc-hint', 'Si vas a jugar con otro DPI, ponelo acá.');
    ayudaDest.id = 'sc-ayuda-dest';
    fDest.appendChild(ayudaDest);

    form.append(fJuego, fSens, fDpi, fPre, fDest);

    const err = el('p', 'sc-error');
    err.id = 'sc-err';
    err.setAttribute('role', 'alert');
    err.hidden = true;

    const lista = el('ul', 'sc-grid');
    lista.setAttribute('aria-label', 'Sensibilidades equivalentes');

    const vacio = el('div', 'sc-estado');
    vacio.hidden = true;
    vacio.appendChild(el('p', null, 'Completá una sensibilidad y un DPI para ver las equivalencias.'));

    /* Cómo se calcula */
    const det = el('details', 'sc-detalle');
    det.appendChild(el('summary', null, 'Cómo se calcula'));
    const cuerpo = el('div', 'sc-detalle__body');
    cuerpo.append(
      el('p', null, 'Cada juego gira la cámara una cantidad fija de grados por cada cuenta del mouse (el «yaw») multiplicada por la sensibilidad. Lo que importa es cuántos grados girás por cada pulgada que movés el mouse:'),
      el('p', 'sc-formula', 'grados por pulgada = yaw × sensibilidad × DPI'),
      el('p', null, 'Dos juegos giran igual cuando ese número coincide, así que la equivalente es  sens₂ = (yaw₁ × sens₁ × DPI₁) ÷ (yaw₂ × DPI₂).  El eDPI es sensibilidad × DPI y los cm / 360° son 360 ÷ grados por pulgada × 2,54.')
    );
    const tabla = el('table', 'sc-tabla');
    const cap = el('caption', 'sc-sr', 'Yaw de cada juego');
    const thead = el('thead');
    const trh = el('tr');
    ['Juego', 'Yaw (° por cuenta)', 'Decimales del menú'].forEach(t => { const th = el('th', null, t); th.scope = 'col'; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = el('tbody');
    JUEGOS.forEach(j => {
      const tr = el('tr');
      const th = el('th', null, j.nombre); th.scope = 'row';
      tr.append(th, el('td', null, String(j.yaw)), el('td', null, String(j.dec)));
      tbody.appendChild(tr);
    });
    tabla.append(cap, thead, tbody);
    const scroll = el('div', 'sc-tabla-wrap');
    scroll.appendChild(tabla);
    cuerpo.append(
      scroll,
      el('p', 'sc-nota', 'El resultado se redondea a los decimales que acepta el menú de cada juego, por eso puede haber una diferencia mínima (se muestra en cada tarjeta). Esta conversión asume mouse sin aceleración ni suavizado, y que usás el mismo mouse en todos los juegos.')
    );
    det.appendChild(cuerpo);

    root.replaceChildren(head, form, err, lista, vacio, det);

    /* Lógica */
    function marcarChips() {
      chipJuegoEls.forEach(c => c.setAttribute('aria-pressed', c.dataset.v === estado.juego ? 'true' : 'false'));
      const d = leerNumero(estado.dpi);
      chipDpiEls.forEach(c => c.setAttribute('aria-pressed', d === Number(c.dataset.v) ? 'true' : 'false'));
    }

    function validar() {
      const s = leerNumero(estado.sens);
      const d = leerNumero(estado.dpi);
      const dd = estado.dpiDestino.trim() === '' ? 0 : leerNumero(estado.dpiDestino);
      const malas = { sens: false, dpi: false, dest: false };
      let msg = '';
      if (estado.sens.trim() !== '' && !(s >= LIM.sensMin && s <= LIM.sensMax)) {
        malas.sens = true;
        msg = 'La sensibilidad tiene que ser un número entre ' + LIM.sensMin + ' y ' + LIM.sensMax + '.';
      } else if (estado.dpi.trim() !== '' && !(d >= LIM.dpiMin && d <= LIM.dpiMax)) {
        malas.dpi = true;
        msg = 'El DPI tiene que ser un número entre ' + LIM.dpiMin + ' y ' + LIM.dpiMax + '.';
      } else if (estado.dpiDestino.trim() !== '' && !(dd >= LIM.dpiMin && dd <= LIM.dpiMax)) {
        malas.dest = true;
        msg = 'El DPI destino tiene que ser un número entre ' + LIM.dpiMin + ' y ' + LIM.dpiMax + '.';
      }
      const completo = estado.sens.trim() !== '' && estado.dpi.trim() !== '' && !msg;
      return { s, d, dd, malas, msg, completo };
    }

    function pintar() {
      marcarChips();
      const v = validar();
      inSens.setAttribute('aria-invalid', v.malas.sens ? 'true' : 'false');
      inDpi.setAttribute('aria-invalid', v.malas.dpi ? 'true' : 'false');
      inDest.setAttribute('aria-invalid', v.malas.dest ? 'true' : 'false');
      err.hidden = !v.msg;
      err.textContent = v.msg;

      if (!v.completo) {
        lista.replaceChildren();
        lista.hidden = true;
        vacio.hidden = !!v.msg;
        resumen.hidden = true;
        resumen.textContent = '';
        return;
      }
      vacio.hidden = true;
      lista.hidden = false;
      const filas = convertir(estado.juego, v.s, v.d, v.dd);
      lista.replaceChildren(...filas.map(crearTarjeta));
      const o = filas.find(f => f.origen);
      resumen.hidden = false;
      resumen.textContent = '';
      const strong = el('strong', null, fmtCm(o.cm360) + ' cm');
      resumen.append('Tu giro de 360° = ', strong, ' · ' + fmtCm(o.pulg360) + ' in');
    }

    function aplicarAInputs() {
      inSens.value = estado.sens;
      inDpi.value = estado.dpi;
      inDest.value = estado.dpiDestino;
    }

    function cambio() { guardar(estado); pintar(); }

    inSens.addEventListener('input', () => { estado.sens = inSens.value; cambio(); });
    inDpi.addEventListener('input', () => { estado.dpi = inDpi.value; cambio(); });
    inDest.addEventListener('input', () => { estado.dpiDestino = inDest.value; cambio(); });
    chipsJuego.addEventListener('click', ev => {
      const c = ev.target.closest('button.sc-chip');
      if (!c) return;
      estado.juego = c.dataset.v;
      cambio();
    });
    chipsDpi.addEventListener('click', ev => {
      const c = ev.target.closest('button.sc-chip');
      if (!c) return;
      estado.dpi = c.dataset.v;
      inDpi.value = estado.dpi;
      cambio();
    });

    aplicarAInputs();
    pintar();
  }

  function auto() {
    const root = document.getElementById('sc-app');
    if (root) { root.classList.add('sc-app'); iniciar(root); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

  window.ConversorSens = { iniciar, convertir, leerNumero, cmPara360, JUEGOS, LIM };
})();
