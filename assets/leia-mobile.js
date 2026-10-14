/* ==========================================================================
   LeiaNET — capa móvil / tablet (JS)
   - Hoja de menú inferior (bottom sheet) que se sincroniza con #nav-toggle:
     el código original sigue manejando abrir/cerrar, esto solo lo muestra.
   - Dock inferior de 5 accesos con indicador deslizante; se oculta al
     scrollear hacia abajo y vuelve al subir.
   - Todo es progresivo: sin JS queda el menú original.
   ========================================================================== */
(function(){
  'use strict';
  var mq = window.matchMedia('(max-width:880px)');
  var root = document.documentElement;
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('main-nav');
  var backdrop = document.getElementById('nav-backdrop');
  if(!toggle || !nav) return;

  // ¿estamos en el inicio o en una página interna (utilidades, foro de skins, etc.)?
  var path = location.pathname;
  var isHome = /(^|\/)(index\.html)?$/.test(path) && !/404/.test(path);
  var isTool = /(utilidades|canirun|iacompare|steam-preview|minecraft-server|fondos|skin-editor)(\.html)?$/.test(path);
  var HOME = isHome ? '' : 'index.html';          // prefijo para anclas del inicio
  function key(href){ return (href || '').replace(/^(\.\/)?index\.html(?=#|$)/, '') || '#'; }

  var sheet = null, dock = null, pill = null, items = [];
  var built = false;

  var ICONS = {
    home:'<svg viewBox="0 0 24 24"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></svg>',
    server:'<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="6.5" rx="2"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="2"/><path d="M7.5 7.25h.01M7.5 16.75h.01"/></svg>',
    news:'<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/></svg>',
    tools:'<svg viewBox="0 0 24 24"><path d="M14.5 6.5a4 4 0 0 0-5.3 5.2L4 17a1.8 1.8 0 0 0 2.5 2.5l5.3-5.2a4 4 0 0 0 5.2-5.3l-2.6 2.6-2.2-.6-.6-2.2z"/></svg>',
    menu:'<svg viewBox="0 0 24 24"><path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h9"/></svg>',
    chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>'
  };

  // icono + color por destino (se arma con los links reales del nav)
  var META = {
    '#minecraft':{e:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',c:'#4d8a3a'},
    '#cs16':{e:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>',c:'#c98a2c'},
    '#haxball':{e:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m12 8 3.5 2.5-1.3 4h-4.4l-1.3-4z"/></svg>',c:'#3f9a54'},
    '#novedades':{e:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-5v12L3 14z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',c:'#8a5cd6'},
    'utilidades.html':{e:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6.5a4 4 0 0 0-5.3 5.2L4 17a1.8 1.8 0 0 0 2.5 2.5l5.3-5.2a4 4 0 0 0 5.2-5.3l-2.6 2.6-2.2-.6-.6-2.2z"/></svg>',c:'#3b6fd8'},
    'https://foro.leianet.ar':{e:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.7 7L3 20.5l1.6-5A8 8 0 1 1 21 12z"/></svg>',c:'#d6567e'},
    '#cafecito':{e:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/></svg>',c:'#b8862e'},
    '#faq':{e:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 18h.01"/></svg>',c:'#5b6372'},
    '#contact':{e:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',c:'#3a8fc2'}
  };
  var GROUPS = [
    ['#minecraft','#cs16','#haxball'],
    ['#novedades','utilidades.html','https://foro.leianet.ar','#cafecito'],
    ['#faq','#contact']
  ];

  function el(tag, cls, html){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(html != null) n.innerHTML = html;
    return n;
  }

  /* --------------------------------------------------------------- sheet */
  function buildSheet(){
    var links = {};
    [].forEach.call(nav.querySelectorAll('a'), function(a){
      var raw = a.getAttribute('href');
      links[key(raw)] = {raw:raw, text:a.textContent.trim(), cur:a.classList.contains('active')};
    });

    sheet = el('div', 'lm-sheet');
    sheet.id = 'lm-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Menú de navegación');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.appendChild(el('div', 'lm-grab'));

    var top = el('div', 'lm-top');
    top.appendChild(el('div', 'lm-title', 'Explorar'));
    var done = el('button', 'lm-done', 'Listo');
    done.type = 'button';
    done.addEventListener('click', closeMenu);
    top.appendChild(done);
    sheet.appendChild(top);

    GROUPS.forEach(function(g){
      var box = el('div', 'lm-group');
      g.forEach(function(href){
        if(!links[href]) return;
        var m = META[href] || {e:'•', c:'#3a3a3f'};
        var a = el('a', 'lm-row');
        a.href = links[href].raw;
        if(/^https?:/.test(href)) { a.rel = 'noopener'; }
        if(links[href].cur) a.setAttribute('aria-current', 'page');
        var ico = el('span', 'lm-ico', m.e); ico.style.setProperty('--c', m.c); ico.setAttribute('aria-hidden', 'true');
        a.appendChild(ico);
        a.appendChild(el('span', 'lm-name', links[href].text));
        var ch = el('span', 'lm-chev', ICONS.chev); ch.setAttribute('aria-hidden', 'true');
        a.appendChild(ch);
        a.addEventListener('click', function(){ if(isOpen()) toggle.click(); });
        box.appendChild(a);
      });
      if(box.children.length) sheet.appendChild(box);
    });

    // arrastrar hacia abajo para cerrar
    var startY = 0, dy = 0, dragging = false;
    sheet.addEventListener('touchstart', function(e){
      if(sheet.scrollTop > 0) return;
      startY = e.touches[0].clientY; dy = 0; dragging = true;
    }, {passive:true});
    sheet.addEventListener('touchmove', function(e){
      if(!dragging) return;
      dy = e.touches[0].clientY - startY;
      if(dy <= 0){ dy = 0; sheet.style.transform = ''; sheet.classList.remove('drag'); return; }
      sheet.classList.add('drag');
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }, {passive:true});
    function endDrag(){
      if(!dragging) return;
      dragging = false;
      sheet.classList.remove('drag');
      sheet.style.transform = '';
      if(dy > 90) closeMenu();
    }
    sheet.addEventListener('touchend', endDrag, {passive:true});
    sheet.addEventListener('touchcancel', endDrag, {passive:true});

    document.body.appendChild(sheet);
  }

  function isOpen(){ return toggle.classList.contains('open'); }
  function closeMenu(){ if(isOpen()) toggle.click(); }

  function syncSheet(){
    if(!sheet) return;
    var open = isOpen();
    sheet.classList.toggle('open', open);
    sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
    if(open){
      var first = sheet.querySelector('.lm-done');
      if(first) try{ first.focus({preventScroll:true}); }catch(e){}
    }
    if(dock) dock.setAttribute('aria-hidden', open ? 'true' : 'false');
  }

  /* ---------------------------------------------------------------- dock */
  function buildDock(){
    dock = el('div', 'lm-dock');   // OJO: no usar <nav>: el CSS global de `nav` lo movería
    dock.setAttribute('role', 'navigation');
    dock.setAttribute('aria-label', 'Accesos rápidos');
    pill = el('span', 'lm-pill'); pill.setAttribute('aria-hidden', 'true'); pill.style.opacity = '0';
    dock.appendChild(pill);

    function item(tag, label, icon, attrs){
      var n = el(tag, 'lm-it', icon + '<span>' + label + '</span>');
      Object.keys(attrs || {}).forEach(function(k){ n.setAttribute(k, attrs[k]); });
      dock.appendChild(n);
      items.push(n);
      return n;
    }
    var home = item('a', 'Inicio', ICONS.home, {href: isHome ? '#' : 'index.html'});
    if(isHome) home.addEventListener('click', function(e){ e.preventDefault(); window.scrollTo({top:0, behavior:'smooth'}); });
    item('a', 'Servidores', ICONS.server, {href: HOME + '#minecraft'});
    item('a', 'Novedades', ICONS.news, {href: HOME + '#novedades'});
    item('a', 'Utilidades', ICONS.tools, {href:'utilidades.html'});
    var menu = item('button', 'Menú', ICONS.menu, {type:'button', 'aria-label':'Abrir menú', 'aria-haspopup':'dialog'});
    menu.addEventListener('click', function(){ toggle.click(); });

    document.body.appendChild(dock);
  }

  var activeIdx = -1;
  function setActive(i){
    if(i === activeIdx) return;
    activeIdx = i;
    items.forEach(function(n, k){ n.classList.toggle('on', k === i); if(k === i) n.setAttribute('aria-current', 'true'); else n.removeAttribute('aria-current'); });
    if(!pill) return;
    if(i < 0){ pill.style.opacity = '0'; return; }
    pill.style.opacity = '1';
    pill.style.transform = 'translateX(' + (i * 100) + '%)';
  }

  // sección activa: franja a mitad de pantalla
  var live = {};
  function observe(){
    if(!isHome){ if(isTool) setActive(3); return; }
    if(!('IntersectionObserver' in window)) return;
    var map = {hero:0, minecraft:1, cs16:1, haxball:1, novedades:2};
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ live[en.target.getAttribute('data-lm') || en.target.id] = en.isIntersecting; });
      var idx = -1;
      ['hero','minecraft','cs16','haxball','novedades'].forEach(function(k){ if(live[k]) idx = map[k]; });
      setActive(idx);
    }, {rootMargin:'-40% 0px -50% 0px'});
    var hero = document.querySelector('.hero');
    if(hero){ hero.setAttribute('data-lm', 'hero'); io.observe(hero); }
    ['minecraft','cs16','haxball','novedades'].forEach(function(id){
      var s = document.getElementById(id); if(s) io.observe(s);
    });
  }

  // ocultar al bajar, mostrar al subir
  var lastY = window.pageYOffset, ticking = false, hidden = false;
  function setHidden(h){
    if(h === hidden) return;
    hidden = h;
    root.classList.toggle('lm-dock-hidden', h);
  }
  function onScroll(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      ticking = false;
      var y = window.pageYOffset, d = y - lastY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if(isOpen()){ lastY = y; return; }
      if(y < 120 || y > max - 60) setHidden(false);
      else if(d > 10) setHidden(true);
      else if(d < -6) setHidden(false);
      if(Math.abs(d) > 4) lastY = y;
    });
  }

  /* ----------------------------------------------------------------- init */
  function enable(){
    if(!built){
      buildSheet(); buildDock(); observe();
      built = true;
      new MutationObserver(syncSheet).observe(toggle, {attributes:true, attributeFilter:['class']});
      window.addEventListener('scroll', onScroll, {passive:true});
      document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeMenu(); });
    }
    root.classList.add('lm-js');
  }
  function disable(){
    closeMenu();
    root.classList.remove('lm-js', 'lm-dock-hidden');
    document.body.style.overflow = '';
    hidden = false;
  }
  function apply(){ if(mq.matches) enable(); else disable(); }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  if(mq.addEventListener) mq.addEventListener('change', apply); else if(mq.addListener) mq.addListener(apply);
  // al volver desde el historial (bfcache) el dock debe estar visible
  window.addEventListener('pageshow', function(){ setHidden(false); });
})();
