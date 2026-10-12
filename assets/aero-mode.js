/* LeiaNET · modo Frutiger Aero. Escribí "aero" en cualquier página para activarlo/desactivarlo. */
(function(){
  var KEY='leianet-aero',MUTE='leianet-aero-mute',root=document.documentElement;
  /* la elección se guarda en localStorage y, de respaldo, en window.name (sobrevive al cambiar de página en la misma pestaña aunque localStorage falle) */
  function wnGet(k){var m=(window.name||'').match(new RegExp('(?:^|\\|)'+k+':([^|]*)'));return m?m[1]:null}
  function wnSet(k,v){try{var n=(window.name||'').replace(new RegExp('(?:^|\\|)'+k+':[^|]*','g'),'');window.name=n+'|'+k+':'+v}catch(e){}}
  function get(k){var v=null;try{v=localStorage.getItem(k)}catch(e){}return v!==null?v:wnGet(k)}
  function set(k,v){try{localStorage.setItem(k,v)}catch(e){}wnSet(k,v)}
  /* el estado también viaja en la URL (?aero=1 / ?aero=0): funciona igual en file://, Live Server o producción */
  var qm=(location.search.match(/[?&]aero=([01])/)||[])[1];
  if(qm!==undefined){
    set(KEY,qm);
    try{var cu=new URL(location.href);cu.searchParams.delete('aero');history.replaceState(history.state,'',cu.pathname+cu.search+cu.hash)}catch(e){}
  }
  var on=get(KEY)==='1',muted=get(MUTE)==='1';
  var bgWrap=null,hills=null,toast=null,ctl=null,muteBtn=null,orb=null,flares=[];
  function rand(a,b){return a+Math.random()*(b-a)}

  /* ---------- música: tema "Frutiger Aero Underwater" en loop infinito con crossfade ---------- */
  var MUSIC_SRC='assets/aero-idle.mp3',VOL=.14,FADE=9,INTRO=4; /* volumen bajito; fundido de 9s entre repeticiones */
  var A=null,B=null,cur=null,timer=null,gain=0,first=true;
  function mk(){var a=new Audio(MUSIC_SRC);a.preload='auto';a.loop=false;a.volume=0;return a}
  function clamp(v){return Math.max(0,Math.min(1,v))}
  function tick(){
    if(!cur)return;
    var target=muted?0:VOL;
    gain+=(target-gain)*.2;if(Math.abs(target-gain)<.0005)gain=target;
    var other=cur===A?B:A,d=cur.duration;
    if(!d||isNaN(d)){return}
    var t=cur.currentTime,left=d-t,vc=1;
    if(first)vc=clamp(t/INTRO); /* entrada suave la primera vez */
    if(left<=FADE){
      /* se acerca el final: arranca la otra copia y mezclamos (potencia constante) */
      if(other.paused){other.currentTime=0;var p=other.play();if(p&&p.catch)p.catch(function(){})}
      var x=clamp(1-left/FADE);
      cur.volume=clamp(gain*vc*Math.cos(x*Math.PI/2));
      other.volume=clamp(gain*Math.sin(x*Math.PI/2));
      if(left<=.08||cur.ended){cur.pause();cur.currentTime=0;cur.volume=0;cur=other;first=false}
    }else{
      cur.volume=clamp(gain*vc);
    }
  }
  function startMusic(){
    if(timer)return;
    if(!A){A=mk();B=mk();cur=A}
    var p=cur.play();
    if(p&&p.catch)p.catch(function(){stopTimer()}); /* si el navegador lo bloquea, reintenta en el próximo gesto */
    timer=setInterval(tick,100);
  }
  function stopTimer(){if(timer){clearInterval(timer);timer=null}}
  function stopMusic(){
    stopTimer();
    [A,B].forEach(function(a){if(a){a.pause();a.currentTime=0;a.volume=0}});
    cur=A;gain=0;first=true;
  }
  function applyMute(){if(muteBtn)muteBtn.textContent=muted?'🔇':'🎵'}

  /* ---------- visual ---------- */
  function showToast(msg){
    if(!toast){toast=document.createElement('div');toast.id='aero-toast';document.body.appendChild(toast)}
    toast.textContent=msg;toast.classList.add('show');clearTimeout(toast._t);
    toast._t=setTimeout(function(){toast.classList.remove('show')},2600);
  }
  var SCENE_HTML=
   '<div class="aero-sun"><i></i></div>'+
   '<svg class="aero-beams" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><defs>'+
    '<linearGradient id="abm1" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#9fe8ff" stop-opacity="0"/></linearGradient>'+
    '<linearGradient id="abm2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9fe8ff" stop-opacity="0"/><stop offset=".55" stop-color="#d8f8ff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'+
    '<filter id="abb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter></defs>'+
    '<g filter="url(#abb)">'+
     '<path d="M-60 560 C170 380 430 470 690 270 S990 70 1080 -30 L1080 40 C960 150 800 330 560 430 S150 600 -60 620Z" fill="url(#abm1)"/>'+
     '<path d="M-60 440 C140 330 380 360 600 210 S900 30 1080 -40 L1080 10 C900 100 760 250 560 330 S120 480 -60 500Z" fill="url(#abm2)" opacity=".8"/>'+
     '<path d="M-60 610 C220 500 520 560 760 380 S1010 190 1080 110 L1080 170 C990 250 840 430 600 520 S200 640 -60 660Z" fill="url(#abm2)" opacity=".6"/>'+
    '</g></svg>'+
   '<div class="aero-haze"></div>'+
   '<svg class="aero-hills-svg" viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden="true"><defs>'+
    '<linearGradient id="ahf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6ece0"/><stop offset="1" stop-color="#7fd6cc"/></linearGradient>'+
    '<linearGradient id="ahm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6f06a"/><stop offset="1" stop-color="#4fc02c"/></linearGradient>'+
    '<linearGradient id="ahn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe24a"/><stop offset=".55" stop-color="#3fb125"/><stop offset="1" stop-color="#1f8a17"/></linearGradient>'+
    '<pattern id="ahg" width="14" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><path d="M0 5H14" stroke="#eaffc8" stroke-width="1.2" opacity=".5"/></pattern>'+
    '<filter id="ahb"><feGaussianBlur stdDeviation="2.5"/></filter></defs>'+
    '<path d="M0 175 C190 105 410 160 650 120 S1110 60 1440 135 L1440 360 L0 360Z" fill="url(#ahf)" opacity=".75"/>'+
    '<path d="M0 235 C250 150 520 215 800 172 S1230 135 1440 205 L1440 360 L0 360Z" fill="url(#ahm)"/>'+
    '<path d="M0 235 C250 150 520 215 800 172 S1230 135 1440 205" fill="none" stroke="#fff" stroke-width="3" opacity=".55" filter="url(#ahb)"/>'+
    '<path d="M0 305 C300 205 690 238 1000 258 S1320 232 1440 268 L1440 360 L0 360Z" fill="url(#ahn)"/>'+
    '<path d="M0 305 C300 205 690 238 1000 258 S1320 232 1440 268 L1440 360 L0 360Z" fill="url(#ahg)" opacity=".35"/>'+
    '<path d="M0 305 C300 205 690 238 1000 258 S1320 232 1440 268" fill="none" stroke="#f4ffd8" stroke-width="3.5" opacity=".75" filter="url(#ahb)"/>'+
   '</svg>';
  function buildBg(){
    if(bgWrap)return;
    var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
    hills=document.createElement('div');hills.id='aero-scene';hills.innerHTML=SCENE_HTML;
    /* nubes estilo Bliss */
    var nc=reduce?3:(window.__LOW_PERF__?3:6);
    for(var c=0;c<nc;c++){
      var cl=document.createElement('div'),w=rand(34,60);cl.className='aero-cloud'+(reduce?'':' aero-drift');
      cl.style.cssText='--w:'+w+'vw;--t:'+rand(2,48)+'vh;--o:'+(rand(60,95)/100)+';--d:'+rand(150,260)+'s;--dl:'+(-rand(0,240))+'s;left:'+(reduce?rand(0,60)+'vw':'0');
      hills.appendChild(cl);
    }
    /* destellos tipo lente */
    var ng=reduce?4:(window.__LOW_PERF__?5:11);
    for(var g=0;g<ng;g++){
      var gl=document.createElement('i');gl.className='aero-glint';
      gl.style.cssText='left:'+rand(4,96)+'vw;top:'+rand(4,70)+'vh;--d:'+rand(3.5,7)+'s;--dl:'+(-rand(0,7))+'s';
      hills.appendChild(gl);
    }
    /* reflejos de lente alineados con el sol */
    var sizes=[46,110,34,150,70];flares=[];
    for(var f=0;f<sizes.length;f++){var fl=document.createElement('div');fl.className='aero-flare';fl.style.width=fl.style.height=sizes[f]+'px';hills.appendChild(fl);flares.push(fl)}
    placeFlares();
    document.body.appendChild(hills);
    /* orbe de cristal en el hero (solo escritorio, solo si hay hero) */
    var hero=document.querySelector('.hero');
    if(hero&&!hero.querySelector('.aero-orb')){
      orb=document.createElement('div');orb.className='aero-orb';orb.setAttribute('aria-hidden','true');
      var oi=document.createElement('img');oi.src='assets/favicon-180.png';oi.alt='';orb.appendChild(oi);
      hero.insertBefore(orb,hero.firstChild);
    }
    bgWrap=document.createElement('div');bgWrap.id='aero-bubbles';document.body.appendChild(bgWrap);
    var n=reduce?6:(window.__LOW_PERF__?8:18);
    for(var i=0;i<n;i++){
      var b=document.createElement('div'),s=rand(22,100);b.className='aero-bubble'+(reduce?'':' aero-rise');
      b.style.cssText='width:'+s+'px;height:'+s+'px;left:'+rand(0,100)+'vw;top:'+(reduce?rand(0,90):rand(100,130))+'vh;--dx:'+rand(-70,70)+'px;animation-duration:'+rand(16,36)+'s;animation-delay:'+(-rand(0,34))+'s;opacity:.85';
      bgWrap.appendChild(b);
    }
  }
  function placeFlares(){
    var vw=window.innerWidth,vh=window.innerHeight,vm=Math.max(vw,vh);
    var sx=vw-.27*vm,sy=.15*vm,tx=.18*vw,ty=.9*vh,ts=[.28,.45,.62,.8,.97];
    for(var i=0;i<flares.length;i++){
      var t=ts[i],w=parseFloat(flares[i].style.width)||40;
      flares[i].style.left=(sx+(tx-sx)*t-w/2)+'px';flares[i].style.top=(sy+(ty-sy)*t-w/2)+'px';
    }
  }
  window.addEventListener('resize',function(){if(flares.length)placeFlares()});
  function teardownBg(){[hills,bgWrap,orb].forEach(function(e){if(e)e.remove()});hills=bgWrap=orb=null;flares=[]}

  /* logo: en modo Aero se usa el logo de vidrio */
  var LOGO_AERO='assets/logo_leianetwork_aero.webp';
  function swapLogos(){
    var imgs=document.querySelectorAll('.brand img,.fbrand img');
    for(var i=0;i<imgs.length;i++){
      var im=imgs[i];
      if(on){
        if(!im.dataset.orig&&/logo_leianetwork\.(webp|png)/.test(im.getAttribute('src')||''))im.dataset.orig=im.getAttribute('src');
        if(im.dataset.orig){im.removeAttribute('srcset');im.src=LOGO_AERO}
      }else if(im.dataset.orig){im.src=im.dataset.orig}
    }
  }
  function apply(){
    root.classList.toggle('aero',on);
    swapLogos();
    if(on){buildBg();if(muteBtn)applyMute()}else{teardownBg();stopMusic()}
    if(ctl)ctl.querySelector('.aero-toggle').title=on?'Salir del modo Aero':'Modo Aero';
  }
  function setOn(v,gesture){
    on=v;set(KEY,v?'1':'0');apply();decorateAll();
    if(v){
      if(gesture&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)){var sw=document.createElement('div');sw.className='aero-sweep';document.body.appendChild(sw);setTimeout(function(){sw.remove()},1400)}
      showToast('✨ Modo Aero activado');if(gesture)startMusic()}else showToast('Modo Aero desactivado · escribí "aero" para volver');
  }
  function buildCtl(){
    ctl=document.createElement('div');ctl.id='aero-ctl';
    muteBtn=document.createElement('button');muteBtn.className='aero-mute';muteBtn.textContent=muted?'🔇':'🎵';muteBtn.title='Música';muteBtn.setAttribute('aria-label','Música Aero');
    var t=document.createElement('button');t.className='aero-toggle';t.textContent='🫧';t.title='Volver al modo original';t.setAttribute('aria-label','Volver al modo original');
    ctl.appendChild(muteBtn);ctl.appendChild(t);document.body.appendChild(ctl);
    t.onclick=function(){setOn(!on,true)};
    muteBtn.onclick=function(){muted=!muted;set(MUTE,muted?'1':'0');if(!muted)startMusic();applyMute()};
  }

  /* links internos: llevan la elección en la URL para que sobreviva a cualquier navegador/entorno */
  function stateVal(){var v=get(KEY);return v==='1'||v==='0'?v:null}
  function decorate(a){
    var v=stateVal();if(v===null)return;
    var h=a.getAttribute('href');
    if(!h||h.charAt(0)==='#'||/^(mailto:|tel:|javascript:|data:|blob:|sms:)/i.test(h)||a.hasAttribute('download'))return;
    var u;try{u=new URL(a.href,location.href)}catch(e){return}
    if(u.protocol!==location.protocol)return;
    if(location.protocol!=='file:'&&u.host!==location.host)return;
    var last=u.pathname.split('/').pop();
    if(last&&/\./.test(last)&&!/\.html?$/i.test(last))return; /* nada de .png, .zip, etc. */
    var hi=h.indexOf('#'),base=hi>=0?h.slice(0,hi):h,hash=hi>=0?h.slice(hi):'';
    if(new RegExp('[?&]aero='+v+'(&|$)').test(base))return;
    base=base.replace(/\?aero=[01]&/,'?').replace(/[?&]aero=[01]/,'');
    a.setAttribute('href',base+(base.indexOf('?')>=0?'&':'?')+'aero='+v+hash);
  }
  function decorateAll(){var as=document.querySelectorAll('a[href]');for(var i=0;i<as.length;i++)decorate(as[i])}
  var decT=null;
  function watchLinks(){
    if(!window.MutationObserver)return;
    new MutationObserver(function(){clearTimeout(decT);decT=setTimeout(decorateAll,250)}).observe(document.body,{childList:true,subtree:true});
  }
  document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(a)decorate(a)},true);
  document.addEventListener('auxclick',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(a)decorate(a)},true);
  /* volver con el botón "atrás" (bfcache): re-leer la elección */
  window.addEventListener('pageshow',function(e){if(e.persisted){var v=get(KEY)==='1';if(v!==on){on=v;apply()}decorateAll()}});

  /* escribir "aero" en cualquier lado (fuera de inputs) */
  var buf='';
  document.addEventListener('keydown',function(e){
    var t=e.target,tag=t&&t.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable))return;
    if(e.ctrlKey||e.metaKey||e.altKey||!e.key||e.key.length!==1)return;
    buf=(buf+e.key.toLowerCase()).slice(-4);
    if(buf==='aero'){buf='';setOn(!on,true)}
  });
  /* click: solo arranca la música tras el primer gesto (sin burbujas) */
  document.addEventListener('pointerdown',function(e){
    if(!on)return;
    if(!muted)startMusic();
  },true);
  document.addEventListener('keydown',function(){if(on&&!muted&&!timer)startMusic()},true);

  /* si cambia en otra pestaña/página abierta, acompañar */
  window.addEventListener('storage',function(e){
    if(e.key===KEY&&(e.newValue==='1')!==on){on=e.newValue==='1';apply()}
  });
  function init(){buildCtl();apply();if(on)applyMute();decorateAll();watchLinks()}
  if(document.body)init();else document.addEventListener('DOMContentLoaded',init);
})();
