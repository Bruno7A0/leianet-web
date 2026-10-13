/* Consentimiento de analytics (Google Analytics 4).
   GA solo se carga si el visitante acepta. La decision se guarda en localStorage. */
(function(){
  var GA_ID = 'G-6MP6LJPFM6', KEY = 'leia.consent';
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

  function get(){ try{ return localStorage.getItem(KEY); }catch(e){ return null; } }
  function set(v){ try{ localStorage.setItem(KEY, v); }catch(e){} }

  var loaded = false;
  function loadGA(){
    if(loaded) return; loaded = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function banner(){
    var b = document.createElement('div');
    b.id = 'leia-consent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Aviso de analítica');
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:100000;max-width:520px;margin:0 auto;padding:14px 16px;border-radius:12px;background:#18181b;color:#ededee;border:1px solid #2b2b30;box-shadow:0 8px 30px rgba(0,0,0,.5);font:14px/1.45 system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between';
    var p = document.createElement('span');
    p.textContent = 'Usamos Google Analytics para medir visitas de forma anónima. ¿Aceptás?';
    p.style.flex = '1 1 240px';
    function btn(txt, primary, val){
      var x = document.createElement('button'); x.type = 'button'; x.textContent = txt;
      x.style.cssText = 'cursor:pointer;padding:8px 14px;border-radius:8px;font:inherit;font-weight:600;border:1px solid #2b2b30;' + (primary ? 'background:#ededee;color:#0f0f11' : 'background:transparent;color:#ededee');
      x.addEventListener('click', function(){ set(val); b.remove(); if(val === 'granted') loadGA(); });
      return x;
    }
    b.appendChild(p); b.appendChild(btn('Rechazar', false, 'denied')); b.appendChild(btn('Aceptar', true, 'granted'));
    document.body.appendChild(b);
  }

  var c = get();
  if(c === 'granted') loadGA();
  else if(c !== 'denied'){
    if(document.body) banner(); else document.addEventListener('DOMContentLoaded', banner);
  }
  // permite cambiar la decision: window.leiaConsentReset()
  window.leiaConsentReset = function(){ try{ localStorage.removeItem(KEY); }catch(e){} location.reload(); };
})();
