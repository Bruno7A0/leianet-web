/* Juegos gratis hoy — JS puro, sin dependencias.
   Uso: <div id="jg-app"></div> + este script. Se inicia solo.

   Fuente de datos: GamerPower (https://www.gamerpower.com/api/giveaways), gratis y sin clave.
   Es un único pedido; las listas, filtros y plazos se calculan acá, en el cliente.
   Todo texto externo se inserta con textContent (nunca innerHTML) y los links se validan (solo https). */
(function () {
  'use strict';

  /* ---------- 1. Datos ---------- */

  const API = 'https://www.gamerpower.com/api/giveaways?sort-by=popularity';
  const CACHE_KEY = 'jg-cache-v1';
  const CACHE_MS = 10 * 60 * 1000;
  const TIMEOUT_MS = 12000;

  async function pedir() {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API, { signal: ctl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // Sin giveaways activos la API responde con un objeto de estado en vez de una lista: no es un error.
      const json = await res.json().catch(() => null);
      return Array.isArray(json) ? json : [];
    } finally {
      clearTimeout(t);
    }
  }

  const httpsOk = u => typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u);

  // "2026-10-21 23:59:00" (UTC) -> ms; null si no hay fecha ("N/A" u otro valor).
  function parseFin(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }
  // "$9.99" -> 9.99; "N/A" -> 0
  function parseValor(s) {
    const n = parseFloat(String(s || '').replace(/[^0-9.]/g, ''));
    return isFinite(n) && n > 0 ? n : 0;
  }

  const TIPOS_ES = { game: 'Juego', dlc: 'DLC', loot: 'Extra', 'early access': 'Acceso anticipado', beta: 'Beta' };
  const TIPOS = { game: 'juego', dlc: 'dlc', loot: 'dlc', 'early access': 'beta', beta: 'beta' };

  // Devuelve un giveaway limpio o null si no sirve (sin título, sin link seguro).
  function normalizar(g) {
    if (!g || typeof g !== 'object') return null;
    const id = parseInt(g.id, 10);
    const titulo = String(g.title || '').trim();
    const claim = [g.open_giveaway_url, g.open_giveaway, g.gamerpower_url].find(httpsOk);
    if (!id || !titulo || !claim) return null;
    if (/^expired$/i.test(String(g.status || ''))) return null;
    const plataformas = String(g.platforms || '').split(',').map(s => s.trim()).filter(Boolean);
    return {
      id,
      titulo,
      valor: parseValor(g.worth),
      imagen: httpsOk(g.image) ? g.image : '',
      miniatura: httpsOk(g.thumbnail) ? g.thumbnail : '',
      claim,
      plataformas,
      tipo: TIPOS[String(g.type || '').trim().toLowerCase()] || 'otro',
      tipoTexto: TIPOS_ES[String(g.type || '').trim().toLowerCase()] || String(g.type || '').trim(),
      fin: parseFin(g.end_date),
      users: parseInt(g.users, 10) || 0
    };
  }

  async function cargar(forzar) {
    const cache = leerCache();
    if (!forzar && cache && Date.now() - cache.t < CACHE_MS) return { items: cache.items, t: cache.t, viejo: false };
    try {
      const crudos = await pedir();
      const items = crudos.map(normalizar).filter(Boolean);
      const t = Date.now();
      guardarCache({ t, items });
      return { items, t, viejo: false };
    } catch (e) {
      if (cache && cache.items && cache.items.length) return { items: cache.items, t: cache.t, viejo: true };
      throw e;
    }
  }

  function leerCache() {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      return c && typeof c.t === 'number' && Array.isArray(c.items) ? c : null;
    } catch (e) { return null; }
  }
  function guardarCache(c) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { /* storage bloqueado: sin cache y listo */ }
  }

  /* ---------- 2. Listas y filtros ---------- */

  const HORA = 3600 * 1000;
  const PRONTO_MS = 72 * HORA;

  const PLATAFORMAS = [
    { id: 'todas', texto: 'Todas', test: () => true },
    { id: 'steam', texto: 'Steam', test: p => /steam/i.test(p) },
    { id: 'epic', texto: 'Epic Games', test: p => /epic/i.test(p) },
    { id: 'gog', texto: 'GOG', test: p => /\bgog\b/i.test(p) },
    { id: 'ubisoft', texto: 'Ubisoft', test: p => /ubisoft/i.test(p) },
    { id: 'itch', texto: 'Itch.io', test: p => /itch/i.test(p) },
    { id: 'consolas', texto: 'Consolas', test: p => /playstation|ps4|ps5|xbox|switch|nintendo/i.test(p) },
    { id: 'movil', texto: 'Móvil', test: p => /android|ios/i.test(p) }
  ];

  // Cada giveaway aparece en una sola lista (la primera que lo reclama).
  const LISTAS = [
    {
      id: 'pronto', titulo: 'Terminan pronto',
      desc: 'Se acaban en menos de 3 días: reclamalos antes de que se pasen.',
      filtro: (g, ahora) => g.fin != null && g.fin - ahora <= PRONTO_MS,
      orden: (a, b) => a.fin - b.fin
    },
    {
      id: 'juegos', titulo: 'Juegos completos',
      desc: 'Juegos que te quedás para siempre en tu biblioteca.',
      filtro: g => g.tipo === 'juego',
      orden: (a, b) => b.valor - a.valor || b.users - a.users
    },
    {
      id: 'dlc', titulo: 'DLC y contenido extra',
      desc: 'Packs, skins y extras para juegos que ya tenés o querés probar.',
      filtro: g => g.tipo === 'dlc',
      orden: (a, b) => b.valor - a.valor || b.users - a.users
    },
    {
      id: 'beta', titulo: 'Acceso anticipado y betas',
      desc: 'Claves de prueba y juegos en desarrollo.',
      filtro: g => g.tipo === 'beta' || g.tipo === 'otro',
      orden: (a, b) => b.users - a.users
    }
  ];

  const sinAcentos = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function vigentes(items, ahora) {
    return items.filter(g => g.fin == null || g.fin > ahora);   // el cache puede traer algo que venció entre medio
  }

  function aplicarFiltros(items, f, ahora) {
    const plat = PLATAFORMAS.find(p => p.id === f.plataforma) || PLATAFORMAS[0];
    const q = sinAcentos((f.q || '').trim());
    return vigentes(items, ahora).filter(g =>
      (plat.id === 'todas' || g.plataformas.some(plat.test) || plat.test(g.plataformas.join(' '))) &&
      (!q || sinAcentos(g.titulo).includes(q))
    );
  }

  function armarListas(items, f, ahora) {
    const base = aplicarFiltros(items, f, ahora);
    const usados = new Set();
    const listas = [];
    for (const l of LISTAS) {
      const sel = base.filter(g => !usados.has(g.id) && l.filtro(g, ahora)).sort(l.orden);
      sel.forEach(g => usados.add(g.id));
      if (sel.length) listas.push({ def: l, items: sel });
    }
    return { listas, mostrados: base.length, valor: base.reduce((s, g) => s + g.valor, 0) };
  }

  function conteoPlataformas(items, ahora) {
    const v = vigentes(items, ahora);
    const out = {};
    for (const p of PLATAFORMAS) out[p.id] = p.id === 'todas' ? v.length : v.filter(g => g.plataformas.some(p.test)).length;
    return out;
  }

  /* ---------- 3. Render ---------- */

  const fmtUsd = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' });

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;   // textContent: nunca interpreta HTML
    return n;
  }

  function restante(fin, ahora) {
    const ms = fin - ahora;
    const h = Math.floor(ms / HORA);
    const d = Math.floor(h / 24);
    if (ms <= 0) return 'Terminó';
    if (h < 1) return 'Termina en menos de 1 h';
    if (h < 24) return 'Termina en ' + h + ' h';
    return 'Termina en ' + d + (d === 1 ? ' día' : ' días') + (h % 24 && d < 3 ? ' ' + (h % 24) + ' h' : '');
  }
  function fechaLarga(fin) {
    return new Date(fin).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' hs';
  }

  function crearTarjeta(g, ahora) {
    const card = el('li', 'jg-card');
    const a = el('a', 'jg-card__link');
    a.href = g.claim;   // validado: solo https
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const plat = g.plataformas.join(', ');
    a.setAttribute('aria-label', g.titulo + (plat ? ', ' + plat : '') + ', gratis' +
      (g.fin ? '. ' + restante(g.fin, ahora) : '. Sin fecha de vencimiento') + '. Se abre en una pestaña nueva');

    const media = el('div', 'jg-card__media');
    const img = el('img', 'jg-card__img');
    const fuentes = [g.imagen, g.miniatura].filter(Boolean);
    let k = 0;
    if (fuentes.length) {
      img.src = fuentes[0];
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => {
        if (++k < fuentes.length) { img.src = fuentes[k]; return; }
        img.remove();
        media.appendChild(el('span', 'jg-card__img jg-card__img--vacio', '?'));
      });
      media.appendChild(img);
    } else {
      media.appendChild(el('span', 'jg-card__img jg-card__img--vacio', '?'));
    }
    const urgente = g.fin != null && g.fin - ahora < 24 * HORA;
    const badge = el('span', 'jg-card__off' + (g.fin == null ? ' jg-card__off--none' : urgente ? ' jg-card__off--soon' : ''),
      g.fin == null ? 'Sin fecha' : restante(g.fin, ahora));
    media.appendChild(badge);

    const body = el('div', 'jg-card__body');
    const nombre = el('h4', 'jg-card__name', g.titulo);
    nombre.title = g.titulo;
    const meta = el('p', 'jg-meta');
    meta.append((g.tipoTexto || 'Giveaway') + (plat ? ' · ' + plat : ''));
    meta.title = plat;

    const foot = el('div', 'jg-card__foot');
    const precio = el('span', 'jg-price');
    if (g.valor) precio.appendChild(el('span', 'jg-price__old', fmtUsd.format(g.valor)));
    precio.appendChild(el('span', 'jg-price__new jg-price__new--gratis', 'Gratis'));
    foot.appendChild(precio);
    foot.appendChild(el('span', 'jg-card__cta', 'Reclamar →'));
    if (g.fin) {
      const fin = el('p', 'jg-card__fin', 'Vence: ' + fechaLarga(g.fin));
      body.append(nombre, meta, fin, foot);
    } else {
      body.append(nombre, meta, foot);
    }
    a.append(media, body);
    card.appendChild(a);
    return card;
  }

  function crearSeccion(lista, ahora) {
    const sec = el('section', 'jg-section');
    sec.id = 'jg-lista-' + lista.def.id;
    sec.setAttribute('aria-labelledby', sec.id + '-t');
    const head = el('div', 'jg-section__head');
    const fila = el('div', 'jg-section__row');
    const h = el('h3', 'jg-section__title', lista.def.titulo);
    h.id = sec.id + '-t';
    fila.append(h, el('span', 'jg-section__count', lista.items.length + (lista.items.length === 1 ? ' giveaway' : ' giveaways')));
    head.append(fila, el('p', 'jg-section__desc', lista.def.desc));
    const grid = el('ul', 'jg-grid');
    for (const g of lista.items) grid.appendChild(crearTarjeta(g, ahora));
    sec.append(head, grid);
    return sec;
  }

  /* ---------- 4. App ---------- */

  function iniciar(root) {
    const estado = { items: [], filtros: { q: '', plataforma: 'todas' }, cargando: false };

    const head = el('div', 'jg-head');   // div y no <header>: el CSS global estiliza <header> como barra de navegación
    const izq = el('div');
    izq.append(el('h2', 'jg-head__title', 'Gratis ahora mismo'));
    const sub = el('p', 'jg-head__sub', 'Cargando giveaways…');
    izq.append(sub);
    const der = el('div', 'jg-head__side');
    const cuenta = el('p', 'jg-pill');
    cuenta.hidden = true;
    const btnAct = el('button', 'jg-btn', 'Actualizar');
    btnAct.type = 'button';
    der.append(cuenta, btnAct);
    head.append(izq, der);

    const bar = el('div', 'jg-toolbar');
    bar.setAttribute('role', 'search');
    const fBuscar = el('div', 'jg-field jg-field--grow');
    const lBuscar = el('label', 'jg-label', 'Buscar');
    lBuscar.htmlFor = 'jg-q';
    const inBuscar = el('input', 'jg-input');
    inBuscar.id = 'jg-q';
    inBuscar.type = 'search';
    inBuscar.placeholder = 'Nombre del juego…';
    inBuscar.autocomplete = 'off';
    inBuscar.maxLength = 60;
    fBuscar.append(lBuscar, inBuscar);

    const fPlat = el('div', 'jg-field');
    fPlat.append(el('span', 'jg-label', 'Plataforma'));
    const chips = el('div', 'jg-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Plataforma');
    const chipEls = PLATAFORMAS.map(p => {
      const c = el('button', 'jg-chip', p.texto);
      c.type = 'button';
      c.dataset.v = p.id;
      c.setAttribute('aria-pressed', p.id === 'todas' ? 'true' : 'false');
      chips.appendChild(c);
      return c;
    });
    fPlat.appendChild(chips);
    const btnLimpiar = el('button', 'jg-btn', 'Limpiar filtros');
    btnLimpiar.type = 'button';
    btnLimpiar.hidden = true;
    bar.append(fBuscar, fPlat, btnLimpiar);

    const nav = el('nav', 'jg-nav');
    nav.setAttribute('aria-label', 'Listas de giveaways');
    const cont = el('div', 'jg-lists');
    const live = el('p', 'jg-sr');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    root.replaceChildren(head, bar, nav, cont, live);

    const filtrosActivos = () => !!(estado.filtros.q.trim() || estado.filtros.plataforma !== 'todas');

    function pintar() {
      const ahora = Date.now();
      const conteo = conteoPlataformas(estado.items, ahora);
      chipEls.forEach(c => { c.hidden = c.dataset.v !== 'todas' && !conteo[c.dataset.v] && c.getAttribute('aria-pressed') !== 'true'; });
      const r = armarListas(estado.items, estado.filtros, ahora);
      btnLimpiar.hidden = !filtrosActivos();

      cuenta.hidden = false;
      cuenta.replaceChildren(el('strong', null, String(r.mostrados)), (r.mostrados === 1 ? ' giveaway' : ' giveaways') +
        (r.valor ? ' · valen ' + fmtUsd.format(r.valor) : ''));
      live.textContent = r.mostrados + (r.mostrados === 1 ? ' giveaway' : ' giveaways') + ' en pantalla';

      const ul = el('ul', 'jg-jump');
      for (const l of r.listas) {
        const li = el('li');
        const a = el('a', null, l.def.titulo);
        a.href = '#jg-lista-' + l.def.id;
        li.appendChild(a);
        ul.appendChild(li);
      }
      nav.replaceChildren(r.listas.length ? ul : document.createTextNode(''));

      if (!r.listas.length) {
        const box = el('div', 'jg-estado');
        box.appendChild(el('p', null, filtrosActivos()
          ? 'Ningún giveaway cumple con esos filtros. Probá con otra plataforma o con otro nombre.'
          : 'Ahora mismo no hay giveaways activos. Volvé más tarde: aparecen casi todos los días.'));
        if (filtrosActivos()) {
          const b = el('button', 'jg-btn', 'Limpiar filtros');
          b.type = 'button';
          b.addEventListener('click', limpiar);
          box.appendChild(b);
        }
        cont.replaceChildren(box);
        return;
      }
      const frag = document.createDocumentFragment();
      for (const l of r.listas) frag.appendChild(crearSeccion(l, ahora));
      cont.replaceChildren(frag);   // una sola escritura al DOM
    }

    function pintarCargando() {
      const grid = el('div', 'jg-grid');
      grid.style.marginTop = '28px';
      for (let i = 0; i < 8; i++) grid.appendChild(el('div', 'jg-skeleton'));
      nav.replaceChildren();
      cont.replaceChildren(grid);
      cont.setAttribute('aria-busy', 'true');
    }

    function pintarError() {
      cont.removeAttribute('aria-busy');
      nav.replaceChildren();
      cuenta.hidden = true;
      sub.textContent = 'No se pudieron cargar los giveaways.';
      const box = el('div', 'jg-estado');
      box.appendChild(el('p', null, 'No pudimos cargar los juegos gratis. Revisá tu conexión e intentá de nuevo.'));
      const b = el('button', 'jg-btn', 'Reintentar');
      b.type = 'button';
      b.addEventListener('click', () => pedirTodo(true));
      box.appendChild(b);
      cont.replaceChildren(box);
    }

    function textoSub(res) {
      const hora = new Date(res.t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (res.viejo) return 'No hay conexión con la fuente: mostrando datos guardados de las ' + hora + ' hs (tu horario).';
      return 'Juegos y extras que podés reclamar sin pagar. Consultado a las ' + hora + ' hs (tu horario).';
    }

    async function pedirTodo(forzar) {
      if (estado.cargando) return;
      estado.cargando = true;
      btnAct.disabled = true;
      sub.textContent = 'Cargando giveaways…';
      pintarCargando();
      try {
        const res = await cargar(forzar);
        cont.removeAttribute('aria-busy');
        estado.items = res.items;
        sub.textContent = textoSub(res);
        pintar();
      } catch (e) {
        pintarError();
      } finally {
        estado.cargando = false;
        btnAct.disabled = false;
      }
    }

    function limpiar() {
      estado.filtros = { q: '', plataforma: 'todas' };
      inBuscar.value = '';
      chipEls.forEach(c => c.setAttribute('aria-pressed', c.dataset.v === 'todas' ? 'true' : 'false'));
      pintar();
    }

    let timer = null;
    inBuscar.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { estado.filtros.q = inBuscar.value; pintar(); }, 150);
    });
    chips.addEventListener('click', ev => {
      const c = ev.target.closest('button.jg-chip');
      if (!c) return;
      estado.filtros.plataforma = c.dataset.v;
      chipEls.forEach(x => x.setAttribute('aria-pressed', x === c ? 'true' : 'false'));
      pintar();
    });
    btnLimpiar.addEventListener('click', limpiar);
    btnAct.addEventListener('click', () => pedirTodo(true));

    return pedirTodo(false);
  }

  function auto() {
    const root = document.getElementById('jg-app');
    if (root) { root.classList.add('jg-app'); iniciar(root); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

  window.JuegosGratis = { iniciar, normalizar, armarListas, aplicarFiltros, parseFin, parseValor, LISTAS };
})();
