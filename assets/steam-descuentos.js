/* Steam Descuentos — JS puro, sin dependencias.
   Uso: <div id="sd-app"></div> + este script. Se inicia solo.

   Fuente de datos: CheapShark (https://www.cheapshark.com/api), filtrando la tienda Steam (storeID=1).
   Las listas se arman acá, en el cliente, a partir de un pool de ofertas: así no dependemos de cómo
   ordene el servidor cada consulta y podemos filtrar basura (juegos sin reseñas, etc.).
   Los precios vienen en USD. Todo texto externo se inserta con textContent (nunca innerHTML). */
(function () {
  'use strict';

  /* ---------- 1. Datos ---------- */

  const API = 'https://www.cheapshark.com/api/1.0/deals';
  const CACHE_KEY = 'sd-cache-v1';
  const CACHE_MS = 15 * 60 * 1000;   // 15 min: cuida la API y la velocidad de la página
  const TIMEOUT_MS = 12000;

  // Pool de ofertas: las 180 mejores por "Deal Rating" (3 páginas), más dos recortes para no perder
  // joyas baratas ni grandes lanzamientos. Ninguna depende del sentido del orden (desc).
  const BASE = { storeID: 1, onSale: 1, pageSize: 60, sortBy: 'Deal Rating' };
  const CONSULTAS = [
    { ...BASE, pageNumber: 0 },
    { ...BASE, pageNumber: 1 },
    { ...BASE, pageNumber: 2 },
    { ...BASE, upperPrice: 10, steamRating: 85 },
    { ...BASE, AAA: 1 }
  ];

  function urlConsulta(params) {
    const q = new URLSearchParams();
    for (const k of Object.keys(params)) q.set(k, String(params[k]));
    return API + '?' + q.toString();
  }

  async function pedir(params) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(urlConsulta(params), { signal: ctl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('Respuesta inesperada');
      return json;
    } finally {
      clearTimeout(t);
    }
  }

  // Devuelve una oferta limpia o null si no sirve (sin appid de Steam, sin descuento real, datos rotos).
  function normalizar(d) {
    if (!d || typeof d !== 'object') return null;
    const id = String(d.steamAppID == null ? '' : d.steamAppID);
    if (!/^\d+$/.test(id) || id === '0') return null;
    const sale = parseFloat(d.salePrice);
    const normal = parseFloat(d.normalPrice);
    const off = Math.round(parseFloat(d.savings));
    if (!isFinite(sale) || !isFinite(normal) || !(off > 0) || !(normal > 0) || sale > normal) return null;
    return {
      id,
      titulo: String(d.title || 'Sin título'),
      sale,
      normal,
      off,
      rating: parseInt(d.steamRatingPercent, 10) || 0,
      votos: parseInt(d.steamRatingCount, 10) || 0,
      ratingTexto: String(d.steamRatingText || ''),
      meta: parseInt(d.metacriticScore, 10) || 0,
      dealRating: parseFloat(d.dealRating) || 0,
      thumb: String(d.thumb || '')
    };
  }

  async function cargarPool(forzar) {
    const cache = leerCache();
    if (!forzar && cache && Date.now() - cache.t < CACHE_MS) {
      return { deals: cache.deals, t: cache.t, deCache: true, viejo: false };
    }
    const resultados = await Promise.allSettled(CONSULTAS.map(pedir));
    const vistos = new Map();
    let ok = 0;
    for (const r of resultados) {
      if (r.status !== 'fulfilled') continue;
      ok++;
      for (const raw of r.value) {
        const d = normalizar(raw);
        if (d && !vistos.has(d.id)) vistos.set(d.id, d);
      }
    }
    if (ok && vistos.size) {
      const deals = Array.from(vistos.values());
      const t = Date.now();
      guardarCache({ t, deals });
      return { deals, t, deCache: false, viejo: false };
    }
    // Si falló todo pero hay algo guardado (aunque vencido), lo mostramos avisando.
    if (cache && cache.deals && cache.deals.length) return { deals: cache.deals, t: cache.t, deCache: true, viejo: true };
    return { deals: [], t: Date.now(), deCache: false, viejo: false };
  }

  function leerCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || typeof c.t !== 'number' || !Array.isArray(c.deals)) return null;
      return c;
    } catch (e) { return null; }
  }
  function guardarCache(c) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { /* storage bloqueado: sin cache y listo */ }
  }

  /* ---------- 2. Listas ---------- */

  // Cada juego aparece en una sola lista (la primera que lo reclama, en el orden de abajo).
  const LISTAS = [
    {
      id: 'gratis', titulo: 'Gratis por tiempo limitado',
      desc: 'Descuento del 100%: te los quedás para siempre si los canjeás mientras dure la promo.',
      filtro: d => d.sale === 0,
      orden: (a, b) => b.normal - a.normal || b.votos - a.votos, max: 12
    },
    {
      id: 'mejores', titulo: 'Mejores ofertas ahora',
      desc: 'La mejor combinación de descuento, precio y reseñas según CheapShark.',
      filtro: d => d.sale > 0 && d.votos >= 200,
      orden: (a, b) => b.dealRating - a.dealRating || b.votos - a.votos, max: 12
    },
    {
      id: 'descuentos', titulo: 'Mayores descuentos',
      desc: 'Los recortes más fuertes entre juegos bien reseñados (75%+ positivas y 1.000+ reseñas).',
      filtro: d => d.sale > 0 && d.votos >= 1000 && d.rating >= 75,
      orden: (a, b) => b.off - a.off || b.votos - a.votos, max: 12
    },
    {
      id: 'populares', titulo: 'Los más populares en oferta',
      desc: 'Ordenados por cantidad de reseñas en Steam: lo que más jugó la gente, ahora más barato.',
      filtro: d => d.sale > 0 && d.votos >= 5000 && d.rating >= 70,
      orden: (a, b) => b.votos - a.votos, max: 12
    },
    {
      id: 'joyas', titulo: 'Joyas por menos de US$ 10',
      desc: 'Muy bien valorados (85%+ positivas, 1.000+ reseñas) y a precio de snack.',
      filtro: d => d.sale > 0 && d.sale <= 10 && d.rating >= 85 && d.votos >= 1000,
      orden: (a, b) => b.rating - a.rating || b.votos - a.votos, max: 12
    },
    {
      id: 'aaa', titulo: 'Grandes lanzamientos con rebaja',
      desc: 'Juegos de precio completo de US$ 30 o más, ahora con descuento.',
      filtro: d => d.sale > 0 && d.normal >= 30 && d.votos >= 500 && d.rating >= 70,
      orden: (a, b) => b.off - a.off || b.votos - a.votos, max: 12
    }
  ];

  const sinAcentos = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function aplicarFiltros(pool, f) {
    const q = sinAcentos((f.q || '').trim());
    return pool.filter(d =>
      d.off >= (f.minOff || 0) &&
      (!f.maxPrecio || d.sale <= f.maxPrecio) &&
      (!q || sinAcentos(d.titulo).includes(q))
    );
  }

  function armarListas(pool, f) {
    const base = aplicarFiltros(pool, f);
    const usados = new Set();
    const out = [];
    for (const l of LISTAS) {
      const items = base.filter(d => !usados.has(d.id) && l.filtro(d)).sort(l.orden).slice(0, l.max);
      items.forEach(d => usados.add(d.id));
      if (items.length) out.push({ def: l, items });
    }
    return { listas: out, mostrados: usados.size, total: pool.length };
  }

  /* ---------- 3. Render ---------- */

  const RATING_ES = {
    'Overwhelmingly Positive': 'Extremadamente positivas', 'Very Positive': 'Muy positivas', 'Positive': 'Positivas',
    'Mostly Positive': 'Mayormente positivas', 'Mixed': 'Mixtas', 'Mostly Negative': 'Mayormente negativas',
    'Negative': 'Negativas', 'Very Negative': 'Muy negativas', 'Overwhelmingly Negative': 'Extremadamente negativas'
  };
  function textoRating(d) {
    if (!d.votos) return 'Sin reseñas';
    if (RATING_ES[d.ratingTexto]) return RATING_ES[d.ratingTexto];
    if (d.rating >= 95 && d.votos >= 500) return 'Extremadamente positivas';
    if (d.rating >= 80) return d.votos >= 50 ? 'Muy positivas' : 'Positivas';
    if (d.rating >= 70) return 'Mayormente positivas';
    if (d.rating >= 40) return 'Mixtas';
    return 'Negativas';
  }
  const nivelRating = d => (!d.votos ? '' : d.rating >= 80 ? 'alto' : d.rating >= 70 ? 'medio' : 'bajo');

  const fmtUsd = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' });
  const fmtNum = new Intl.NumberFormat('es-AR');

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;   // textContent: nunca interpreta HTML
    return n;
  }

  function crearTarjeta(d) {
    const precio = d.sale === 0 ? 'Gratis' : fmtUsd.format(d.sale);
    const card = el('li', 'sd-card');

    const a = el('a', 'sd-card__link');
    a.href = 'https://store.steampowered.com/app/' + d.id + '/';   // d.id es solo dígitos (validado en normalizar)
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', d.titulo + ', ' + d.off + '% de descuento, ' + (d.sale === 0 ? 'gratis' : 'ahora ' + precio) + '. Abre la tienda de Steam en una pestaña nueva');

    const media = el('div', 'sd-card__media');
    const img = el('img', 'sd-card__img');
    img.src = 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + d.id + '/header.jpg';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    let intento = 0;
    img.addEventListener('error', () => {
      if (intento++ === 0 && /^https:\/\//.test(d.thumb)) { img.src = d.thumb; return; }   // 2.º intento: miniatura de CheapShark
      img.remove();
      media.appendChild(el('span', 'sd-card__img sd-card__img--vacio', '?'));
    });
    media.append(img, el('span', 'sd-card__off', '-' + d.off + '%'));

    const body = el('div', 'sd-card__body');
    const nombre = el('h4', 'sd-card__name', d.titulo);
    nombre.title = d.titulo;

    const rating = el('p', 'sd-rating');
    if (nivelRating(d)) rating.dataset.nivel = nivelRating(d);
    rating.append(textoRating(d));
    if (d.votos) {
      rating.append(' ', el('small', null, d.rating + '% · ' + fmtNum.format(d.votos)));
    }

    const foot = el('div', 'sd-card__foot');
    const p = el('span', 'sd-price');
    p.append(el('span', 'sd-price__old', fmtUsd.format(d.normal)), el('span', d.sale === 0 ? 'sd-price__new sd-price__new--gratis' : 'sd-price__new', precio));
    foot.appendChild(p);
    if (d.meta) {
      const mc = el('span', 'sd-card__meta', 'MC ' + d.meta);
      mc.title = 'Puntaje de Metacritic';
      foot.appendChild(mc);
    }

    body.append(nombre, rating, foot);
    a.append(media, body);
    card.appendChild(a);
    return card;
  }

  function crearSeccion(lista) {
    const sec = el('section', 'sd-section');
    sec.id = 'sd-lista-' + lista.def.id;
    sec.setAttribute('aria-labelledby', sec.id + '-t');
    const head = el('div', 'sd-section__head');
    const fila = el('div', 'sd-section__row');
    const h = el('h3', 'sd-section__title', lista.def.titulo);
    h.id = sec.id + '-t';
    fila.append(h, el('span', 'sd-section__count', lista.items.length + (lista.items.length === 1 ? ' juego' : ' juegos')));
    head.append(fila, el('p', 'sd-section__desc', lista.def.desc));
    const grid = el('ul', 'sd-grid');
    for (const d of lista.items) grid.appendChild(crearTarjeta(d));
    sec.append(head, grid);
    return sec;
  }

  /* ---------- 4. App ---------- */

  function iniciar(root) {
    const estado = { pool: [], filtros: { q: '', minOff: 0, maxPrecio: 0 }, cargando: false };

    // --- Encabezado ---
    // div y no <header>: el CSS global del sitio estiliza <header> como barra de navegación.
    const head = el('div', 'sd-head');
    const izq = el('div');
    izq.append(el('h2', 'sd-head__title', 'Ofertas de Steam'));
    const sub = el('p', 'sd-head__sub', 'Cargando ofertas…');
    izq.append(sub);
    const der = el('div', 'sd-head__side');
    const cuenta = el('p', 'sd-pill');
    cuenta.hidden = true;
    const btnAct = el('button', 'sd-btn', 'Actualizar');
    btnAct.type = 'button';
    der.append(cuenta, btnAct);
    head.append(izq, der);

    // --- Filtros ---
    const bar = el('div', 'sd-toolbar');
    bar.setAttribute('role', 'search');

    const fBuscar = el('div', 'sd-field sd-field--grow');
    const lBuscar = el('label', 'sd-label', 'Buscar en las ofertas');
    lBuscar.htmlFor = 'sd-q';
    const inBuscar = el('input', 'sd-input');
    inBuscar.id = 'sd-q';
    inBuscar.type = 'search';
    inBuscar.placeholder = 'Nombre del juego…';
    inBuscar.autocomplete = 'off';
    inBuscar.maxLength = 60;
    fBuscar.append(lBuscar, inBuscar);

    const fOff = el('div', 'sd-field');
    const lOff = el('span', 'sd-label', 'Descuento mínimo');
    const chips = el('div', 'sd-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Descuento mínimo');
    const chipEls = [[0, 'Todos'], [50, '50%+'], [75, '75%+'], [90, '90%+']].map(([v, t]) => {
      const c = el('button', 'sd-chip', t);
      c.type = 'button';
      c.dataset.v = String(v);
      c.setAttribute('aria-pressed', v === 0 ? 'true' : 'false');
      chips.appendChild(c);
      return c;
    });
    fOff.append(lOff, chips);

    const fPrecio = el('div', 'sd-field');
    const lPrecio = el('label', 'sd-label', 'Precio máximo');
    lPrecio.htmlFor = 'sd-precio';
    const selPrecio = el('select', 'sd-select');
    selPrecio.id = 'sd-precio';
    for (const [v, t] of [[0, 'Cualquiera'], [5, 'Hasta US$ 5'], [10, 'Hasta US$ 10'], [20, 'Hasta US$ 20'], [30, 'Hasta US$ 30']]) {
      const o = el('option', null, t);
      o.value = String(v);
      selPrecio.appendChild(o);
    }
    fPrecio.append(lPrecio, selPrecio);

    const btnLimpiar = el('button', 'sd-btn', 'Limpiar filtros');
    btnLimpiar.type = 'button';
    btnLimpiar.hidden = true;

    bar.append(fBuscar, fOff, fPrecio, btnLimpiar);

    // --- Contenido ---
    const nav = el('nav', 'sd-nav');
    nav.setAttribute('aria-label', 'Listas de ofertas');
    const cont = el('div', 'sd-lists');
    const live = el('p', 'sd-sr');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');

    root.replaceChildren(head, bar, nav, cont, live);

    function filtrosActivos() {
      const f = estado.filtros;
      return !!(f.q.trim() || f.minOff || f.maxPrecio);
    }

    function pintar() {
      const r = armarListas(estado.pool, estado.filtros);
      btnLimpiar.hidden = !filtrosActivos();

      cuenta.hidden = false;
      cuenta.replaceChildren(el('strong', null, String(r.mostrados)), ' de ' + r.total + ' ofertas');
      live.textContent = r.mostrados + (r.mostrados === 1 ? ' oferta' : ' ofertas') + ' en pantalla';

      const ul = el('ul', 'sd-jump');
      for (const l of r.listas) {
        const li = el('li');
        const a = el('a', null, l.def.titulo);
        a.href = '#sd-lista-' + l.def.id;
        li.appendChild(a);
        ul.appendChild(li);
      }
      nav.replaceChildren(r.listas.length ? ul : document.createTextNode(''));

      if (!r.listas.length) {
        const box = el('div', 'sd-estado');
        box.appendChild(el('p', null, 'Ninguna oferta cumple con esos filtros. Probá con un descuento menor o con otro nombre.'));
        if (filtrosActivos()) {
          const b = el('button', 'sd-btn', 'Limpiar filtros');
          b.type = 'button';
          b.addEventListener('click', limpiar);
          box.appendChild(b);
        }
        cont.replaceChildren(box);
        return;
      }
      const frag = document.createDocumentFragment();
      for (const l of r.listas) frag.appendChild(crearSeccion(l));
      cont.replaceChildren(frag);   // una sola escritura al DOM
    }

    function pintarCargando() {
      const grid = el('div', 'sd-grid');
      grid.style.marginTop = '28px';
      for (let i = 0; i < 8; i++) grid.appendChild(el('div', 'sd-skeleton'));
      nav.replaceChildren();
      cont.replaceChildren(grid);
      cont.setAttribute('aria-busy', 'true');
    }

    function pintarError() {
      cont.removeAttribute('aria-busy');
      nav.replaceChildren();
      cuenta.hidden = true;
      sub.textContent = 'No se pudieron cargar las ofertas.';
      const box = el('div', 'sd-estado');
      box.appendChild(el('p', null, 'No pudimos cargar las ofertas de Steam. Revisá tu conexión e intentá de nuevo.'));
      const b = el('button', 'sd-btn', 'Reintentar');
      b.type = 'button';
      b.addEventListener('click', () => cargar(true));
      box.appendChild(b);
      cont.replaceChildren(box);
    }

    function textoSub(res) {
      const hora = new Date(res.t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (res.viejo) return 'No hay conexión con la fuente: mostrando datos guardados de las ' + hora + ' hs (tu horario).';
      return 'Precios en dólares (US$). Consultado a las ' + hora + ' hs (tu horario).';
    }

    async function cargar(forzar) {
      if (estado.cargando) return;
      estado.cargando = true;
      btnAct.disabled = true;
      sub.textContent = 'Cargando ofertas…';
      pintarCargando();
      try {
        const res = await cargarPool(forzar);
        cont.removeAttribute('aria-busy');
        if (!res.deals.length) { pintarError(); return; }
        estado.pool = res.deals;
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
      estado.filtros = { q: '', minOff: 0, maxPrecio: 0 };
      inBuscar.value = '';
      selPrecio.value = '0';
      chipEls.forEach(c => c.setAttribute('aria-pressed', c.dataset.v === '0' ? 'true' : 'false'));
      if (estado.pool.length) pintar();
    }

    // --- Eventos ---
    let timer = null;
    inBuscar.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { estado.filtros.q = inBuscar.value; if (estado.pool.length) pintar(); }, 150);
    });
    chips.addEventListener('click', ev => {
      const c = ev.target.closest('button.sd-chip');
      if (!c) return;
      estado.filtros.minOff = parseInt(c.dataset.v, 10) || 0;
      chipEls.forEach(x => x.setAttribute('aria-pressed', x === c ? 'true' : 'false'));
      if (estado.pool.length) pintar();
    });
    selPrecio.addEventListener('change', () => {
      estado.filtros.maxPrecio = parseInt(selPrecio.value, 10) || 0;
      if (estado.pool.length) pintar();
    });
    btnLimpiar.addEventListener('click', limpiar);
    btnAct.addEventListener('click', () => cargar(true));

    return cargar(false);
  }

  function auto() {
    const root = document.getElementById('sd-app');
    if (root) { root.classList.add('sd-app'); iniciar(root); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

  window.SteamDescuentos = { iniciar, normalizar, armarListas, aplicarFiltros, LISTAS };
})();
