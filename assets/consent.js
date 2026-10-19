/* Consentimiento de analítica (Google Analytics 4).
   - Google Analytics NO se carga ni se contacta hasta que el visitante pulsa "Aceptar".
   - La decisión se guarda en localStorage (clave `leia.consent`) y se puede cambiar en cualquier momento
     con el enlace "Preferencias de cookies" del pie (window.leiaConsentOpen()).
   - Al rechazar/revocar se desactiva GA y se borran sus cookies (_ga, _ga_*). */
(function(){
  var GA_ID = 'G-6MP6LJPFM6', KEY = 'leia.consent', PRIVACY_URL = '/privacidad.html';
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

  function get(){ try{ return localStorage.getItem(KEY); }catch(e){ return null; } }
  function set(v){ try{ localStorage.setItem(KEY, v); }catch(e){} }

  var loaded = false;
  function loadGA(){
    window['ga-disable-' + GA_ID] = false;
    if(loaded) { gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
    loaded = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    // Minimización: sin señales de Google ni personalización publicitaria
    gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  }

  function clearGaCookies(){
    try{
      var host = location.hostname, parts = host.split('.'), domains = [host, '.' + host];
      if(parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
      else domains.push('.' + host.replace(/^\./, ''));
      document.cookie.split(';').forEach(function(c){
        var n = c.split('=')[0].trim();
        if(n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid' || n.indexOf('_gat') === 0){
          domains.forEach(function(d){
            document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + d;
          });
          document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        }
      });
    }catch(e){}
  }

  function denyGA(){
    window['ga-disable-' + GA_ID] = true;
    gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    clearGaCookies();
  }

  function injectStyle(){
    if(document.getElementById('leia-consent-css')) return;
    var st = document.createElement('style'); st.id = 'leia-consent-css';
    st.textContent =
      '#leia-consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:100000;max-width:560px;margin:0 auto;padding:14px 16px;border-radius:12px;background:#18181b;color:#ededee;border:1px solid #6b6b73;box-shadow:0 8px 30px rgba(0,0,0,.5);font:14px/1.5 system-ui,sans-serif}' +
      '#leia-consent p{margin:0 0 12px}' +
      '#leia-consent a{color:#9fd3ff;text-decoration:underline}' +
      '#leia-consent .lc-row{display:flex;flex-wrap:wrap;gap:10px}' +
      '#leia-consent button{cursor:pointer;flex:1 1 140px;min-height:44px;padding:10px 16px;border-radius:8px;font:inherit;font-weight:600;background:#ededee;color:#0f0f11;border:2px solid #ededee}' +
      '#leia-consent button:hover{background:#fff;border-color:#fff}' +
      '#leia-consent button:focus-visible,#leia-consent a:focus-visible{outline:3px solid #ffd166;outline-offset:2px}';
    document.head.appendChild(st);
  }

  function closeBanner(restoreFocus){
    var b = document.getElementById('leia-consent'); if(b) b.remove();
    if(restoreFocus && restoreFocus.focus){ try{ restoreFocus.focus(); }catch(e){} }
  }

  function banner(returnTo){
    if(document.getElementById('leia-consent')) return;
    injectStyle();
    var b = document.createElement('div');
    b.id = 'leia-consent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-modal', 'false');
    b.setAttribute('aria-labelledby', 'leia-consent-txt');
    var p = document.createElement('p'); p.id = 'leia-consent-txt';
    p.appendChild(document.createTextNode('Usamos Google Analytics (Google LLC, EE. UU.) para medir las visitas con datos estadísticos y seudonimizados. Solo se activa si lo aceptás; podés cambiar tu decisión cuando quieras desde “Preferencias de cookies”. '));
    var a = document.createElement('a'); a.href = PRIVACY_URL; a.textContent = 'Más información';
    p.appendChild(a); p.appendChild(document.createTextNode('.'));
    var row = document.createElement('div'); row.className = 'lc-row';
    function btn(txt, val){
      var x = document.createElement('button'); x.type = 'button'; x.textContent = txt;
      x.addEventListener('click', function(){
        var wasGranted = get() === 'granted';
        set(val);
        if(val === 'granted') loadGA(); else if(wasGranted || loaded) denyGA();
        closeBanner(returnTo);
        var live = document.getElementById('leia-consent-live');
        if(live) live.textContent = val === 'granted' ? 'Analítica aceptada.' : 'Analítica rechazada.';
      });
      return x;
    }
    row.appendChild(btn('Rechazar', 'denied')); row.appendChild(btn('Aceptar', 'granted'));
    b.appendChild(p); b.appendChild(row);
    // Primer hijo del <body>: los usuarios de teclado/lector de pantalla lo encuentran de inmediato
    document.body.insertBefore(b, document.body.firstChild);
    if(returnTo){ var first = row.querySelector('button'); if(first) first.focus(); }
  }

  function ensureLive(){
    if(document.getElementById('leia-consent-live')) return;
    var l = document.createElement('div'); l.id = 'leia-consent-live';
    l.setAttribute('role', 'status'); l.setAttribute('aria-live', 'polite');
    l.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    document.body.appendChild(l);
  }

  function init(){
    ensureLive();
    var c = get();
    if(c === 'granted') loadGA();
    else if(c !== 'denied') banner(null);
  }

  // Reabrir el panel de preferencias (enlace del pie de página)
  window.leiaConsentOpen = function(){ banner(document.activeElement); };
  // Compatibilidad con la versión anterior
  window.leiaConsentReset = window.leiaConsentOpen;

  // Cualquier elemento con data-cookie-prefs (p. ej. el enlace del pie) reabre el panel
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-cookie-prefs]');
    if(t){ e.preventDefault(); window.leiaConsentOpen(); }
  });

  if(document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
