/* ============================================================
   LeiaNET — Fondo espacial de mantenimiento.html
   Mismo comportamiento que el inicio: estrellas (3 capas), destellos,
   estrellas fugaces y meteoritos. Respeta prefers-reduced-motion y el
   modo rendimiento del sitio (lo que el visitante ya tenga guardado).
   ============================================================ */
(function(){
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- modo rendimiento: se reusa lo que ya eligió/detectó el sitio ---- */
  var tier = 'full';
  try{
    var manual = localStorage.getItem('leianet-perf'); // 'low' | 'full'
    if (manual === 'low' || manual === 'full'){
      tier = manual;
    } else {
      var c = JSON.parse(localStorage.getItem('leianet-perf-auto') || 'null');
      if (c && ['full','mid','low','ultra'].indexOf(c.tier) !== -1 && (Date.now() - c.ts) < 6*60*60*1000) tier = c.tier;
    }
  }catch(e){}
  root.classList.remove('perf-mid','low-perf','force-full-fx');
  if (tier === 'mid') root.classList.add('perf-mid');
  else if (tier === 'low' || tier === 'ultra') root.classList.add('low-perf');
  else root.classList.add('force-full-fx');
  var midOrWorse = tier !== 'full';

  /* ---- estrellas: puntos al azar por capa, con box-shadow (barato, sin DOM extra) ---- */
  var layers = [
    {id:'stars-s1', count:130, size:1, opacity:.9},
    {id:'stars-s2', count:80,  size:2, opacity:.7},
    {id:'stars-s3', count:40,  size:1, opacity:1}
  ];
  var vw0 = Math.max(window.innerWidth || 0, (window.screen && screen.width) || 0);
  var vh0 = Math.max(window.innerHeight || 0, (window.screen && screen.height) || 0);
  var w = Math.max(2600, vw0 + 200), h = Math.max(2000, Math.round(vh0 * 1.9));
  var densityK = Math.min(4, (w * h) / (2600 * 2000));
  layers.forEach(function(layer){
    var el = document.getElementById(layer.id);
    if (!el) return;
    var shadows = [];
    for (var i = 0; i < Math.round(layer.count * densityK); i++){
      shadows.push(Math.round(Math.random()*w) + 'px ' + Math.round(Math.random()*h) + 'px 0px rgba(255,255,255,' + layer.opacity + ')');
    }
    el.style.width = layer.size + 'px';
    el.style.height = layer.size + 'px';
    el.style.borderRadius = '50%';
    el.style.background = 'transparent';
    el.style.boxShadow = shadows.join(',');
  });

  if (reduceMotion || midOrWorse) return;

  /* ---- destellos ---- */
  var sparkles = document.getElementById('sparkles');
  if (sparkles){
    for (var i = 0; i < 14; i++){
      var s = document.createElement('div');
      s.className = 'sparkle';
      var size = Math.random() < .3 ? 3 : 2;
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.left = Math.random()*100 + 'vw';
      s.style.top = Math.random()*window.innerHeight + 'px';
      s.style.animationDuration = (3.5 + Math.random()*4.5) + 's';
      s.style.animationDelay = (Math.random()*6) + 's';
      sparkles.appendChild(s);
    }
  }

  /* ---- estrellas fugaces y meteoritos (trayectoria curva con offset-path) ---- */
  var starfield = document.querySelector('.starfield');
  if (!starfield) return;
  var supportsOffsetPath = window.CSS && CSS.supports && CSS.supports('offset-path', "path('M0,0')");

  function fly(el, dx, dy, curveMin, curveRange, durVar, dur){
    el.style.setProperty(durVar, dur.toFixed(2) + 's');
    if (supportsOffsetPath){
      var len = Math.hypot(dx, dy) || 1;
      var perpX = -dy/len, perpY = dx/len;
      var sign = Math.random() < 0.5 ? 1 : -1;
      var amt = curveMin + Math.random()*curveRange;
      var cx = dx/2 + perpX*amt*sign, cy = dy/2 + perpY*amt*sign;
      el.style.offsetPath = "path('M0,0 Q" + cx.toFixed(1) + "," + cy.toFixed(1) + " " + dx.toFixed(1) + "," + dy.toFixed(1) + "')";
    }
    starfield.appendChild(el);
    el.addEventListener('animationend', function(){ el.remove(); });
  }

  function spawnShootingStar(){
    if (starfield.querySelectorAll('.shooting-star').length >= 3) return;
    var el = document.createElement('div');
    el.className = 'shooting-star fire';
    el.style.top = (15 + Math.random()*45) + '%';
    el.style.left = (10 + Math.random()*40) + '%';
    var dir = Math.random() < 0.5 ? 1 : -1;
    var dx = dir * (Math.min(window.innerWidth*0.35, 420) + Math.random()*120);
    var dy = 70 + Math.random()*160;
    if (!supportsOffsetPath){
      el.style.setProperty('--star-dx', dx.toFixed(1) + 'px');
      el.style.setProperty('--star-dy', dy.toFixed(1) + 'px');
    }
    fly(el, dx, dy, 50, 70, '--star-dur', 1.0 + Math.random()*0.6);
  }

  function spawnMeteor(){
    if (starfield.querySelectorAll('.meteor').length >= 1) return;
    var el = document.createElement('div');
    el.className = 'meteor';
    el.innerHTML = '<div class="meteor-trail"></div><div class="meteor-rock"></div>';
    el.style.top = (2 + Math.random()*18) + '%';
    el.style.left = (5 + Math.random()*60) + '%';
    var dir = Math.random() < 0.5 ? 1 : -1;
    var dx = dir * (Math.min(window.innerWidth*0.45, 560) + Math.random()*160);
    var dy = 220 + Math.random()*220;
    if (!supportsOffsetPath){
      el.style.setProperty('--meteor-dx', dx.toFixed(1) + 'px');
      el.style.setProperty('--meteor-dy', dy.toFixed(1) + 'px');
    }
    fly(el, dx, dy, 30, 40, '--meteor-dur', 2.0 + Math.random()*1.0);
  }

  var timers = [];
  function clearTimers(){ timers.forEach(clearTimeout); timers = []; }
  function scheduleStars(){
    timers.push(setTimeout(function(){
      if (document.hidden){ scheduleStars(); return; }
      spawnShootingStar();
      if (Math.random() < .3) timers.push(setTimeout(spawnShootingStar, 400 + Math.random()*500));
      scheduleStars();
    }, 2200 + Math.random()*5500));
  }
  function scheduleMeteors(){
    timers.push(setTimeout(function(){
      if (document.hidden){ scheduleMeteors(); return; }
      spawnMeteor();
      scheduleMeteors();
    }, 20000 + Math.random()*25000));
  }
  function start(){
    timers.push(setTimeout(spawnShootingStar, 900));
    scheduleStars();
    timers.push(setTimeout(spawnMeteor, 6000 + Math.random()*4000));
    scheduleMeteors();
  }
  start();

  // pestaña oculta: frenar todo; al volver, limpiar restos y arrancar de nuevo
  document.addEventListener('visibilitychange', function(){
    if (document.hidden){ clearTimers(); return; }
    starfield.querySelectorAll('.shooting-star, .meteor').forEach(function(el){ el.remove(); });
    start();
  });
})();
