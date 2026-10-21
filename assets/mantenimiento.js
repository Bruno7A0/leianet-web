/* ============================================================
   LeiaNET — Modo mantenimiento
   Abre LeiaRUN desde el aviso de mantenimiento. dog-runner.js/.css se
   cargan recién cuando se toca "Jugar LeiaRUN" (no pesan en cada visita).
   THE NETWORK y Fútbol 3D son links comunes, no necesitan JS.
   ============================================================ */
(function(){
  "use strict";

  var btn = document.getElementById('mnt-play-run');
  if (!btn) return;

  var base = btn.getAttribute('data-assets') || 'assets/';
  var label = btn.textContent;
  var starting = false;

  function reset(text){
    starting = false;
    btn.disabled = false;
    btn.textContent = text || label;
  }

  function openRunner(){
    window.LeiaNETDogRunner.open();
    btn.blur(); // para que ESPACIO (saltar) no vuelva a "apretar" el botón
    reset();
  }

  // Espera a que dog-runner.js termine de definir window.LeiaNETDogRunner
  // (también cubre juegos.html, que ya lo trae con defer).
  function whenReady(tries){
    if (window.LeiaNETDogRunner) return openRunner();
    if (tries > 100) return reset('No se pudo cargar · reintentar'); // ~10 s
    setTimeout(function(){ whenReady(tries + 1); }, 100);
  }

  btn.addEventListener('click', function(){
    if (window.LeiaNETDogRunner) return openRunner();
    if (starting) return;
    starting = true;
    btn.disabled = true;
    btn.textContent = 'Cargando…';

    if (!document.querySelector('script[src*="dog-runner.js"]')){
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = base + 'dog-runner.css';
      document.head.appendChild(css);

      var js = document.createElement('script');
      js.src = base + 'dog-runner.js?v=2';
      js.onerror = function(){ reset('No se pudo cargar · reintentar'); };
      document.body.appendChild(js);
    }
    whenReady(0);
  });
})();
