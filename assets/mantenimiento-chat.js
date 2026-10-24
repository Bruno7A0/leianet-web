/* ============================================================
   LeiaNET — Chat del admin (mantenimiento.html)
   Lee del MISMO servicio que Novedades (novedades.leianet.ar/api/novedades).
   Los mensajes se suben desde admin.html con tipo "Mantenimiento":
   aparecen acá como chat, y además siguen siendo novedades normales.
   ============================================================ */
(function(){
  "use strict";

  var API = 'https://novedades.leianet.ar/api/novedades';
  var TIPO = 'mantenimiento';   // tipo de novedad que se muestra en el chat
  var MAX = 30;                 // cuántos mensajes mostrar
  var POLL_MS = 30000;          // refresco automático

  var box = document.getElementById('mnt-chat-msgs');
  if (!box) return;
  var status = document.getElementById('mnt-chat-status');

  var lastSig = null;
  var timer = 0;

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  // Mismo formato limitado que las novedades: **negrita**, ~~tachado~~, __subrayado__, *cursiva*, [texto](https://link)
  function fmt(t){
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/~~(.+?)~~/g, '<s>$1</s>');
    t = t.replace(/__(.+?)__/g, '<u>$1</u>');
    t = t.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
    return t;
  }
  function formatear(texto){
    var seguro = esc(texto);
    var links = [];
    seguro = seguro.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, function(_, label, url){
      links.push('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + fmt(label) + '</a>');
      return '\u0001' + (links.length - 1) + '\u0001';
    });
    seguro = fmt(seguro).replace(/\n/g, '<br>');
    return seguro.replace(/\u0001(\d+)\u0001/g, function(_, i){ return links[+i]; });
  }

  function fechaCorta(f){
    if (!f) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f));
    return m ? (m[3] + '/' + m[2] + '/' + m[1]) : String(f);
  }

  function imagenSegura(u){
    return typeof u === 'string' && /^https:\/\//i.test(u) ? u : '';
  }

  function setStatus(txt, err){
    if (!status) return;
    status.textContent = txt;
    status.className = 'mnt-chat-status' + (err ? ' err' : '');
  }

  function render(lista){
    var msgs = (Array.isArray(lista) ? lista : [])
      .filter(function(n){ return n && String(n.tipo).toLowerCase() === TIPO; })
      .slice(0, MAX)
      .reverse(); // el backend manda la más nueva primero: acá la más nueva queda abajo

    var sig = msgs.map(function(n){ return n.id; }).join('|');
    if (sig === lastSig) return;
    var primero = lastSig === null;
    lastSig = sig;

    if (!msgs.length){
      box.innerHTML = '<div class="mnt-chat-empty">Todavía no hay mensajes del admin.</div>';
      return;
    }

    // si el usuario ya estaba leyendo abajo, lo dejamos pegado al último mensaje
    var pegado = primero || box.scrollHeight - box.scrollTop - box.clientHeight < 40;

    box.innerHTML = msgs.map(function(n){
      var img = imagenSegura(n.imagen);
      return '<div class="mnt-msg">' +
        '<div class="mnt-msg-head"><span class="mnt-msg-who">Admin</span>' +
        '<span class="mnt-msg-date">' + esc(fechaCorta(n.fecha)) + '</span></div>' +
        (n.titulo ? '<div class="mnt-msg-title">' + esc(n.titulo) + '</div>' : '') +
        (n.texto ? '<div class="mnt-msg-text">' + formatear(n.texto) + '</div>' : '') +
        (img ? '<a href="' + esc(img) + '" target="_blank" rel="noopener noreferrer"><img class="mnt-msg-img" src="' + esc(img) + '" alt="" loading="lazy"></a>' : '') +
        '</div>';
    }).join('');

    if (pegado) box.scrollTop = box.scrollHeight;
  }

  function cargar(){
    fetch(API, { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(data){ render(data); setStatus('En vivo · se actualiza solo'); })
      .catch(function(){
        setStatus('Sin conexión con el servidor', true);
        if (lastSig === null) box.innerHTML = '<div class="mnt-chat-empty">No se pudo cargar el chat.</div>';
      });
  }

  function start(){
    cargar();
    clearInterval(timer);
    timer = setInterval(cargar, POLL_MS);
  }

  // no gastar red con la pestaña en segundo plano
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) clearInterval(timer);
    else start();
  });

  start();
})();
