/* Tracker de la Tienda de Fortnite — JS puro, sin dependencias.
   Uso: <div id="fn-shop"></div> + este script. Se inicia solo.            */
(function () {
  'use strict';

  /* ---------- 1. Datos ---------- */

  // CORRECCIONES respecto a la función original:
  //  - La URL no tenía endpoint: la tienda actual es /v2/shop (language=es para textos en español).
  //  - La API ya no devuelve `entry.items` sino `brItems` (y `tracks`, `cars`, `instruments`, `legoKits`).
  //  - `finalPrice` es el precio de TODA la entrada: en un pack con 5 objetos, repetirlo en cada
  //    objeto mostraba 5 veces el mismo precio. Ahora hay una tarjeta por entrada.
  //  - Se agregan rareza, fecha, orden de secciones y chequeo de res.ok.
  async function obtenerTiendaCompleta() {
    try {
      const res = await fetch('https://fortnite-api.com/v2/shop?language=es');
      if (!res.ok) return { secciones: {}, fecha: null };
      const shop = await res.json();
      if (shop.status !== 200 || !shop.data) return { secciones: {}, fecha: null };

      const entradas = (shop.data.entries || []).slice().sort(
        (a, b) => (a.layout?.index ?? 9999) - (b.layout?.index ?? 9999) ||
                  (b.sortPriority ?? 0) - (a.sortPriority ?? 0)
      );

      const secciones = {};
      for (const e of entradas) {
        const items = normalizarItems(e);
        if (!items.length) continue;

        const principal = items[0];
        const esPack = !!e.bundle || items.length > 1;
        const nombreSec = e.layout?.name || e.layout?.category || 'Variedad';

        (secciones[nombreSec] ||= []).push({
          nombre: e.bundle?.name || principal.nombre,
          precio: e.finalPrice ?? 0,
          imagen: e.bundle?.image || e.newDisplayAsset?.materialInstances?.[0]?.images?.Background || principal.imagen,
          tipo: esPack ? 'Pack' : principal.tipo,
          rareza: principal.rareza,
          rarezaTexto: principal.rarezaTexto,
          cantidad: items.length
        });
      }
      return { secciones, fecha: shop.data.date || null };
    } catch {
      return { secciones: {}, fecha: null };
    }
  }

  function normalizarItems(e) {
    const out = [];
    for (const i of e.brItems || e.items || []) {
      out.push({
        nombre: i.name || 'Sin nombre',
        imagen: i.images?.featured || i.images?.icon || i.images?.smallIcon || '',
        tipo: TIPOS[i.type?.value] || i.type?.displayValue || 'Cosmético',
        rareza: i.series ? 'serie' : (i.rarity?.value || 'common'),
        rarezaTexto: i.series?.name || i.rarity?.displayValue || ''
      });
    }
    for (const t of e.tracks || [])
      out.push({ nombre: t.title || 'Pista', imagen: t.albumArt || '', tipo: 'Pista', rareza: t.rarity?.value || 'common', rarezaTexto: t.rarity?.displayValue || '' });
    for (const c of e.cars || [])
      out.push({ nombre: c.name || 'Vehículo', imagen: c.images?.large || c.images?.small || '', tipo: 'Vehículo', rareza: c.rarity?.value || 'common', rarezaTexto: c.rarity?.displayValue || '' });
    for (const x of [...(e.instruments || []), ...(e.legoKits || [])])
      out.push({ nombre: x.name || 'Objeto', imagen: x.images?.large || x.images?.small || '', tipo: TIPOS[x.type?.value] || 'Cosmético', rareza: x.rarity?.value || 'common', rarezaTexto: x.rarity?.displayValue || '' });
    return out;
  }

  const TIPOS = {
    outfit: 'Skin', pickaxe: 'Pico', emote: 'Gesto', glider: 'Ala delta', backpack: 'Mochila',
    wrap: 'Envoltorio', contrail: 'Estela', music: 'Música', loadingscreen: 'Pantalla de carga',
    spray: 'Grafiti', toy: 'Juguete', pet: 'Mascota', petcarrier: 'Mascota', emoji: 'Emoji',
    banner: 'Estandarte', shoes: 'Calzado', bundle: 'Pack', instrument: 'Instrumento', legokit: 'Kit LEGO'
  };

  /* ---------- 2. Render ---------- */

  const RAREZAS_CONOCIDAS = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'serie']);
  const fmtPrecio = new Intl.NumberFormat('es-AR');

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;   // textContent: nunca interpreta HTML
    return n;
  }

  function crearTarjeta(it) {
    const card = el('li', 'fn-card');
    card.dataset.rareza = RAREZAS_CONOCIDAS.has(it.rareza) ? it.rareza : 'common';

    const media = el('div', 'fn-card__media');
    if (it.imagen) {
      const img = el('img', 'fn-card__img');
      img.src = it.imagen;
      img.alt = it.nombre;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => { img.remove(); media.appendChild(el('span', 'fn-card__img fn-card__img--vacio', '?')); }, { once: true });
      media.appendChild(img);
    }
    if (it.cantidad > 1) media.appendChild(el('span', 'fn-card__badge', it.cantidad + ' objetos'));

    const body = el('div', 'fn-card__body');
    body.appendChild(el('h3', 'fn-card__name', it.nombre)).title = it.nombre;
    body.appendChild(el('p', 'fn-card__type', it.tipo));

    const foot = el('div', 'fn-card__foot');
    const precio = el('span', it.precio ? 'fn-price' : 'fn-price fn-price--gratis');
    if (it.precio) {
      precio.appendChild(el('span', 'fn-price__icon', 'V')).setAttribute('aria-hidden', 'true');
      precio.appendChild(document.createTextNode(fmtPrecio.format(it.precio)));
      precio.setAttribute('aria-label', fmtPrecio.format(it.precio) + ' PaVos');
    } else precio.textContent = 'Gratis';
    foot.appendChild(precio);
    if (it.rarezaTexto) foot.appendChild(el('span', 'fn-rareza', it.rarezaTexto));

    body.appendChild(foot);
    card.append(media, body);
    return card;
  }

  function renderTienda(root, data) {
    const nombres = Object.keys(data.secciones);
    const frag = document.createDocumentFragment();

    // Encabezado
    const fecha = data.fecha ? new Date(data.fecha) : new Date();
    const head = el('header', 'fn-head');
    const izq = el('div');
    izq.appendChild(el('h2', 'fn-head__title', 'Tienda de objetos de Fortnite'));
    // La API fecha la tienda a las 00:00 UTC (= 21:00 en Argentina). Se muestra en UTC para que el día coincida con el de la tienda.
    const sig = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate() + 1));
    const largo = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
    // Comparamos el día de la tienda (UTC) con el día de hoy en tu calendario: desde la renovación (21:00 en Argentina)
    // hasta medianoche, la tienda activa ya es la "de mañana".
    const hoy = new Date();
    const diaTienda = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
    const diaHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const prefijo = diaTienda > diaHoy ? 'Tienda de mañana: ' : diaTienda === diaHoy ? 'Tienda de hoy: ' : 'Tienda del ';
    izq.appendChild(el('p', 'fn-head__date', prefijo + fecha.toLocaleDateString('es-AR', largo)));
    izq.appendChild(el('p', 'fn-head__date',
      'Próxima renovación: ' + sig.toLocaleString('es-AR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) + ' hs (tu horario)'));
    const cont = el('p', 'fn-head__count');
    cont.append(el('strong', null, String(nombres.length)), ' ' + (nombres.length === 1 ? 'sección' : 'secciones'));
    head.append(izq, cont);
    frag.appendChild(head);

    // Secciones
    for (const nombre of nombres) {
      const items = data.secciones[nombre];
      const sec = el('section', 'fn-section');
      const h = el('div', 'fn-section__head');
      h.append(el('h3', 'fn-section__title', nombre), el('span', 'fn-section__count', items.length + (items.length === 1 ? ' artículo' : ' artículos')));
      const grid = el('ul', 'fn-grid');
      for (const it of items) grid.appendChild(crearTarjeta(it));
      sec.append(h, grid);
      frag.appendChild(sec);
    }

    root.replaceChildren(frag);   // una sola escritura al DOM
  }

  function renderCargando(root) {
    const grid = el('div', 'fn-grid');
    grid.style.marginTop = '24px';
    for (let i = 0; i < 8; i++) grid.appendChild(el('div', 'fn-skeleton'));
    root.replaceChildren(grid);
    root.setAttribute('aria-busy', 'true');
  }

  function renderVacio(root, reintentar) {
    const box = el('div', 'fn-estado');
    box.appendChild(el('p', null, 'No pudimos cargar la tienda. Revisá tu conexión e intentá de nuevo.'));
    const b = el('button', null, 'Reintentar');
    b.type = 'button';
    b.addEventListener('click', reintentar);
    box.appendChild(b);
    root.replaceChildren(box);
  }

  /* ---------- 3. Inicio ---------- */

  async function iniciar(root) {
    renderCargando(root);
    const data = await obtenerTiendaCompleta();
    root.removeAttribute('aria-busy');
    if (!Object.keys(data.secciones).length) return renderVacio(root, () => iniciar(root));
    renderTienda(root, data);
  }

  function auto() {
    const root = document.getElementById('fn-shop');
    if (root) { root.classList.add('fn-shop'); iniciar(root); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

  window.FortniteShop = { iniciar, obtenerTiendaCompleta };
})();
