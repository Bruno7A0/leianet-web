/* LeiaNET — sugerencias
 * Formulario público + lista de sugerencias ya revisadas (con estado y respuesta).
 * Las nuevas quedan pendientes hasta que se aprueban desde admin.html.
 * Anti-bots: proof-of-work que valida el servidor + honeypot (igual que las encuestas).
 */
(function(){
  'use strict';
  var root = document.getElementById('sugerencias');
  if(!root) return;
  var API = window.LEIA_SUG_API || 'https://novedades.leianet.ar/api/sugerencias';
  var ESTADOS = {
    revision:   'En revisión',
    planeada:   'Planeada',
    desarrollo: 'En desarrollo',
    completada: 'Completada',
    rechazada:  'Rechazada'
  };
  var ORDEN = ['desarrollo','planeada','revision','completada','rechazada'];
  var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var CH_MAX_AGE = 9 * 60e3;

  var form = root.querySelector('#sug-form');
  var fTitulo = root.querySelector('#sug-titulo'), fDetalle = root.querySelector('#sug-detalle'), fNombre = root.querySelector('#sug-nombre');
  var btn = root.querySelector('#sug-enviar'), msg = root.querySelector('#sug-msg');
  var listEl = root.querySelector('#sug-list'), filtersEl = root.querySelector('#sug-filters');
  var items = [], filtro = 'todas', prep = null, busy = false;

  function esc(s){ return (s == null ? '' : String(s)).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function delay(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function fecha(ms){ var d = new Date(ms); return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }

  /* ---------- contadores ---------- */
  function contar(inp){
    var out = root.querySelector('[data-count="' + inp.id + '"]');
    if(out) out.textContent = inp.value.length + '/' + inp.getAttribute('maxlength');
  }
  [fTitulo, fDetalle, fNombre].forEach(function(i){
    if(!i) return;
    contar(i);
    i.addEventListener('input', function(){ contar(i); });
    i.addEventListener('focus', function(){ prepare().catch(function(){}); }, { once: true });
  });

  /* ---------- anti-bots: proof-of-work ---------- */
  function lz(h){ var b = 0; for(var i = 0; i < h.length; i++){ if(h[i] === 0){ b += 8; continue; } b += Math.clz32(h[i]) - 24; break; } return b; }
  async function solve(ch, bits){
    if(!(window.crypto && crypto.subtle)) throw new Error('Tu navegador no permite la verificación anti-bots.');
    var enc = new TextEncoder(), pre = ch + ':';
    for(var n = 0; ; n++){
      var h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(pre + n)));
      if(lz(h) >= bits) return n;
      if(n % 4000 === 3999) await delay(0);
    }
  }
  function prepare(){
    if(prep && Date.now() - prep.t0 < CH_MAX_AGE) return prep.promise;
    var p = { t0: Date.now() };
    p.promise = fetch(API + '/challenge').then(function(r){
      return r.json().then(function(d){ if(!r.ok) throw new Error(d.error || 'No se pudo verificar.'); return d; });
    }).then(function(d){
      var t = Date.now();
      return solve(d.ch, d.bits).then(function(nonce){
        return delay(Math.max(0, (d.minMs || 2500) + 150 - (Date.now() - t))).then(function(){ return { ch: d.ch, nonce: nonce }; });
      });
    });
    p.promise.catch(function(){ if(prep === p) prep = null; });
    prep = p;
    return p.promise;
  }

  /* ---------- enviar ---------- */
  function setMsg(t, cls){ msg.textContent = t || ''; msg.className = 'sug-msg' + (cls ? ' ' + cls : ''); }
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(busy) return;
    var titulo = fTitulo.value.trim(), detalle = fDetalle.value.trim();
    if(titulo.length < 4){ setMsg('Poné un título un poco más largo.', 'err'); fTitulo.focus(); return; }
    if(detalle.length < 10){ setMsg('Contanos un poco más en el detalle.', 'err'); fDetalle.focus(); return; }
    busy = true; btn.disabled = true; btn.textContent = 'Enviando…'; setMsg('');
    prepare().then(function(c){
      prep = null; // un desafío sirve una sola vez
      return fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: titulo, detalle: detalle, nombre: fNombre.value.trim(), ch: c.ch, nonce: c.nonce, sitio_web: form.elements.sitio_web.value })
      });
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(d){ if(!r.ok) throw new Error(d.error || 'No se pudo enviar. Probá de nuevo.'); });
    }).then(function(){
      form.reset(); [fTitulo, fDetalle, fNombre].forEach(contar);
      setMsg('¡Gracias! Recibimos tu sugerencia. Va a aparecer acá cuando la revisemos.', 'ok');
    }).catch(function(err){
      setMsg(err && err.message === 'Failed to fetch' ? 'No pudimos conectar con el servidor. Probá más tarde.' : (err && err.message) || 'No se pudo enviar.', 'err');
    }).then(function(){ busy = false; btn.disabled = false; btn.textContent = 'Enviar sugerencia'; });
  });

  /* ---------- lista ---------- */
  function renderFiltros(){
    var cnt = {}; items.forEach(function(x){ cnt[x.estado] = (cnt[x.estado] || 0) + 1; });
    var html = '<button type="button" class="sug-chip" data-f="todas" aria-pressed="' + (filtro === 'todas') + '">Todas <i>· ' + items.length + '</i></button>';
    ORDEN.forEach(function(k){
      if(!cnt[k]) return;
      html += '<button type="button" class="sug-chip" data-f="' + k + '" aria-pressed="' + (filtro === k) + '">' + ESTADOS[k] + ' <i>· ' + cnt[k] + '</i></button>';
    });
    filtersEl.innerHTML = html;
  }
  function tarjeta(x, i){
    return '<article class="sug-item" data-e="' + esc(x.estado) + '" style="animation-delay:' + Math.min(i, 8) * 45 + 'ms">' +
      '<div class="sug-top"><span class="sug-badge">' + esc(ESTADOS[x.estado] || x.estado) + '</span>' +
      '<span class="sug-meta">' + esc(x.nombre || 'Anónimo') + ' · ' + fecha(x.creada) + '</span></div>' +
      '<h4 class="sug-t">' + esc(x.titulo) + '</h4><p class="sug-d">' + esc(x.detalle) + '</p>' +
      (x.respuesta ? '<div class="sug-reply"><b>Respuesta de LeiaNET</b><p>' + esc(x.respuesta) + '</p></div>' : '') +
      '</article>';
  }
  function render(){
    if(filtro !== 'todas' && !items.some(function(x){ return x.estado === filtro; })) filtro = 'todas';
    renderFiltros();
    var vis = items.filter(function(x){ return filtro === 'todas' || x.estado === filtro; });
    listEl.innerHTML = vis.length ? vis.map(tarjeta).join('') : '<div class="sug-empty">Todavía no hay sugerencias publicadas. ¡Sé el primero!</div>';
  }
  filtersEl.addEventListener('click', function(e){
    var b = e.target.closest('[data-f]'); if(!b) return;
    filtro = b.getAttribute('data-f'); render();
  });
  fetch(API).then(function(r){ return r.ok ? r.json() : Promise.reject(); }).then(function(d){
    items = (d.sugerencias || []).slice().sort(function(a, b){ return (ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado)) || (b.creada - a.creada); }); render();
  }).catch(function(){
    filtersEl.innerHTML = '';
    listEl.innerHTML = '<div class="sug-empty">No se pudieron cargar las sugerencias en este momento.</div>';
  });
})();
