/*!
 * voxelia-egg.js — activa THE NETWORK como easter egg dentro de cualquier página.
 * No carga nada hasta que se activa (cero costo para tu sitio).
 *
 * Uso mínimo:
 *   <script src="voxelia-egg.js" data-src="voxelia/index.html" defer></script>
 *
 * Uso con opciones:
 *   VoxeliaEgg.init({
 *     src: 'voxelia/index.html',            // ruta al index.html del juego
 *     konami: true,                          // ↑ ↑ ↓ ↓ ← → ← → B A
 *     word: 'thenetwork',                    // escribir esta palabra en cualquier parte (false = desactivar)
 *     clicks: { selector: '#logo', count: 5 }, // 5 clics rápidos sobre un elemento
 *     seed: 'mi-pagina', mode: 'survival',   // opcional: ?seed= y ?mode=creative
 *     // Rendimiento: si la web está en modo bajo rendimiento, el juego arranca en calidad Baja.
 *     lowPerf: 'low-perf',                   // clase(s) de <html>/<body> que marcan ese modo, o una función () => boolean
 *     lowPerfClass: 'low-perf',              // clase que se agrega a <html> mientras el juego está abierto (se restaura al cerrar)
 *     onOpen: function () {}, onClose: function () {},
 *   });
 *   VoxeliaEgg.open();   // abrir a mano (por ejemplo desde un botón)
 */
(function () {
  'use strict';
  var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  var cfg = { src: 'voxelia/index.html', konami: true, word: 'thenetwork', clicks: null, seed: null, mode: null,
    lowPerf: null, lowPerfClass: null, onOpen: null, onClose: null };
  var LOW_CLASSES = ['low-perf', 'lowperf', 'low-performance', 'perf-low', 'low-power'];
  var addedClass = false;

  // ¿La web está en su modo de bajo rendimiento? (función propia, clases configuradas o las más comunes)
  function siteIsLow() {
    try {
      if (typeof cfg.lowPerf === 'function') return !!cfg.lowPerf();
      var classes = cfg.lowPerf ? [].concat(cfg.lowPerf) : LOW_CLASSES, els = [document.documentElement, document.body];
      for (var i = 0; i < els.length; i++) {
        var el = els[i]; if (!el) continue;
        for (var j = 0; j < classes.length; j++) if (el.classList.contains(classes[j])) return true;
        if (String((el.dataset && (el.dataset.perf || el.dataset.performance)) || '').toLowerCase() === 'low') return true;
      }
    } catch (e) {}
    return false;
  }
  var opened = false, wrap = null, prevOverflow = '', initialized = false;

  function close() {
    if (!wrap) return;
    // el juego guarda el mundo y el jugador (mismo origen); si no se puede, se guarda solo cada 20 s
    try { var fw = wrap.querySelector('iframe').contentWindow; if (fw && fw.__voxeliaSave) fw.__voxeliaSave(); } catch (e) {}
    if (addedClass && cfg.lowPerfClass) { document.documentElement.classList.remove(cfg.lowPerfClass); addedClass = false; }
    try { if (cfg.onClose) cfg.onClose(); } catch (e) {}
    wrap.remove(); wrap = null; opened = false;
    document.documentElement.style.overflow = prevOverflow;
    window.removeEventListener('message', onMessage);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function onMessage(e) {
    if (!wrap) return;
    var fr = wrap.querySelector('iframe');
    if (!fr || e.source !== fr.contentWindow) return;
    if (e.data && e.data.type === 'voxelia:exit') close();
  }

  function open() {
    if (opened) return;
    opened = true;
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;';

    var url = new URL(cfg.src, location.href);
    url.searchParams.set('embed', '1');
    if (cfg.seed != null) url.searchParams.set('seed', cfg.seed);
    if (cfg.mode) url.searchParams.set('mode', cfg.mode);
    if (siteIsLow()) url.searchParams.set('perf', 'low'); // la web está en bajo rendimiento: el juego también
    // mientras el juego está abierto, la web fuerza su propio modo liviano (se restaura al cerrar)
    if (cfg.lowPerfClass && !document.documentElement.classList.contains(cfg.lowPerfClass)) {
      document.documentElement.classList.add(cfg.lowPerfClass); addedClass = true;
    }
    try { if (cfg.onOpen) cfg.onOpen(); } catch (e) {}

    var frame = document.createElement('iframe');
    frame.src = url.toString();
    frame.title = 'The Network';
    frame.allow = 'fullscreen; autoplay';
    frame.setAttribute('allowfullscreen', '');
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;';
    wrap.appendChild(frame);

    document.body.appendChild(wrap);
    window.addEventListener('message', onMessage);
    setTimeout(function () { try { frame.focus(); } catch (e) {} }, 100);
  }

  function init(options) {
    for (var k in options) if (Object.prototype.hasOwnProperty.call(options, k)) cfg[k] = options[k];
    if (initialized) return;
    initialized = true;

    var kIdx = 0, typed = '';
    window.addEventListener('keydown', function (e) {
      if (opened) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) { kIdx = 0; typed = ''; return; }
      if (cfg.konami) {
        kIdx = e.code === KONAMI[kIdx] ? kIdx + 1 : (e.code === KONAMI[0] ? 1 : 0);
        if (kIdx === KONAMI.length) { kIdx = 0; open(); return; }
      }
      if (cfg.word && e.key && e.key.length === 1) {
        typed = (typed + e.key.toLowerCase()).slice(-cfg.word.length);
        if (typed === String(cfg.word).toLowerCase()) { typed = ''; open(); }
      }
    });

    if (cfg.clicks && cfg.clicks.selector) {
      var n = 0, timer = null, need = cfg.clicks.count || 5;
      document.addEventListener('click', function (e) {
        if (opened || !e.target.closest || !e.target.closest(cfg.clicks.selector)) return;
        n++; clearTimeout(timer); timer = setTimeout(function () { n = 0; }, 1200);
        if (n >= need) { n = 0; open(); }
      });
    }
  }

  window.VoxeliaEgg = { init: init, open: open, close: close };

  // Autoinicio con atributos data-* en la etiqueta <script>
  var me = document.currentScript;
  if (me && me.dataset.src) {
    var o = { src: me.dataset.src };
    if (me.dataset.word !== undefined) o.word = me.dataset.word === 'false' ? false : me.dataset.word;
    if (me.dataset.konami === 'false') o.konami = false;
    if (me.dataset.seed) o.seed = me.dataset.seed;
    if (me.dataset.mode) o.mode = me.dataset.mode;
    if (me.dataset.lowPerf) o.lowPerf = me.dataset.lowPerf.split(',');
    if (me.dataset.lowPerfClass) o.lowPerfClass = me.dataset.lowPerfClass;
    if (me.dataset.clickSelector) o.clicks = { selector: me.dataset.clickSelector, count: Number(me.dataset.clickCount) || 5 };
    init(o);
  }
})();
