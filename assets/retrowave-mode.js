/* LeiaNET · modo Retrowave / Synthwave. Escribí "retrowave" en cualquier página para activarlo/desactivarlo.
   Misma mecánica que el modo Aero: se guarda entre páginas (localStorage + window.name + ?retro=1 en los links)
   y la música continúa desde donde iba. Aero y Retrowave son excluyentes. */
(function(){
  var KEY='leianet-retro',MUTE='leianet-retro-mute',POS='leianet-retro-pos',root=document.documentElement;
  function wnGet(k){var m=(window.name||'').match(new RegExp('(?:^|\\|)'+k+':([^|]*)'));return m?m[1]:null}
  function wnSet(k,v){try{var n=(window.name||'').replace(new RegExp('(?:^|\\|)'+k+':[^|]*','g'),'');window.name=n+'|'+k+':'+v}catch(e){}}
  function get(k){var v=null;try{v=localStorage.getItem(k)}catch(e){}return v!==null?v:wnGet(k)}
  function set(k,v){try{localStorage.setItem(k,v)}catch(e){}wnSet(k,v)}
  var qm=(location.search.match(/[?&]retro=([01])/)||[])[1];
  if(qm!==undefined){
    set(KEY,qm);
    try{var cu=new URL(location.href);cu.searchParams.delete('retro');history.replaceState(history.state,'',cu.pathname+cu.search+cu.hash)}catch(e){}
  }
  var on=get(KEY)==='1',muted=get(MUTE)==='1';
  var scene=null,toast=null,ctl=null,muteBtn=null;
  function rand(a,b){return a+Math.random()*(b-a)}
  function lowPerf(){return !!(window.__LOW_PERF__||root.classList.contains('low-perf'))}
  function reduced(){return window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches}

  /* ---------- exclusión mutua con Aero ---------- */
  function announce(){try{window.dispatchEvent(new CustomEvent('leianet-theme',{detail:'retro'}))}catch(e){}}
  window.addEventListener('leianet-theme',function(e){
    if(e.detail!=='retro'&&on){on=false;set(KEY,'0');apply();decorateAll()}
  });

  /* ---------- música: "Neon Highway" en loop con crossfade; sigue desde donde iba al cambiar de página ---------- */
  var MUSIC_SRC='assets/retrowave-music.mp3',VOL=.28,FADE=6,INTRO=3;
  var A=null,B=null,cur=null,timer=null,gain=0,first=true,resumeAt=0;
  function mk(){var a=new Audio(MUSIC_SRC);a.preload='auto';a.loop=false;a.volume=0;return a}
  function clamp(v){return Math.max(0,Math.min(1,v))}
  function savePos(){
    if(!cur||!on||!isFinite(cur.currentTime))return;
    var t=cur.currentTime,other=cur===A?B:A;
    /* si ya estamos en medio del crossfade, la "posición real" es la de la copia entrante */
    if(other&&!other.paused&&other.currentTime>0&&other.currentTime<FADE+1)t=other.currentTime;
    set(POS,String(Math.round(t*10)/10));
  }
  function tick(){
    if(!cur)return;
    var target=muted?0:VOL;
    gain+=(target-gain)*.2;if(Math.abs(target-gain)<.0005)gain=target;
    var other=cur===A?B:A,d=cur.duration;
    if(!d||isNaN(d))return;
    var t=cur.currentTime,left=d-t,vc=1;
    if(first&&!resumeAt)vc=clamp(t/INTRO);
    if(left<=FADE){
      if(other.paused){other.currentTime=0;var p=other.play();if(p&&p.catch)p.catch(function(){})}
      var x=clamp(1-left/FADE);
      cur.volume=clamp(gain*vc*Math.cos(x*Math.PI/2));
      other.volume=clamp(gain*Math.sin(x*Math.PI/2));
      if(left<=.08||cur.ended){cur.pause();cur.currentTime=0;cur.volume=0;cur=other;first=false}
    }else{cur.volume=clamp(gain*vc)}
    if(++saveN%5===0)savePos();
  }
  var saveN=0;
  function startMusic(){
    if(timer)return;
    if(!A){
      A=mk();B=mk();cur=A;
      var pos=parseFloat(get(POS));
      if(isFinite(pos)&&pos>1){
        resumeAt=pos;
        var seek=function(){try{if(A.duration&&pos<A.duration-FADE)A.currentTime=pos}catch(e){}};
        if(A.readyState>=1)seek();else A.addEventListener('loadedmetadata',seek,{once:true});
      }
    }
    var p=cur.play();
    if(p&&p.then)p.then(function(){if(ctl)ctl.classList.add('playing')});
    if(p&&p.catch)p.catch(function(){stopTimer();if(ctl)ctl.classList.remove('playing')}); /* si el navegador lo bloquea, reintenta en el próximo gesto */
    timer=setInterval(tick,100);
  }
  function stopTimer(){if(timer){clearInterval(timer);timer=null}}
  function stopMusic(){
    stopTimer();
    [A,B].forEach(function(a){if(a){a.pause();a.currentTime=0;a.volume=0}});
    cur=A;gain=0;first=true;resumeAt=0;if(ctl)ctl.classList.remove('playing');
  }
  function applyMute(){if(ctl)ctl.classList.toggle('muted',muted);if(muteBtn){muteBtn.innerHTML=muted?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';muteBtn.title=muted?'Activar música':'Silenciar música'}}
  window.addEventListener('pagehide',savePos);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')savePos()});

  /* ---------- escena ---------- */
  function showToast(msg){
    if(!toast){toast=document.createElement('div');toast.id='rw-toast';document.body.appendChild(toast)}
    toast.textContent=msg;toast.classList.add('show');clearTimeout(toast._t);
    toast._t=setTimeout(function(){toast.classList.remove('show')},2800);
  }
  /* sol con franjas que se engrosan hacia abajo */
  var SUN='<svg viewBox="0 0 400 400" aria-hidden="true"><defs>'+
    '<linearGradient id="rwsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6019D"/><stop offset=".38" stop-color="#D40078"/><stop offset=".62" stop-color="#ECA089"/><stop offset="1" stop-color="#ECC6A2"/></linearGradient>'+
    '<mask id="rwsm"><rect width="400" height="400" fill="#fff"/>'+
    '<rect y="214" width="400" height="3" fill="#000"/><rect y="238" width="400" height="5" fill="#000"/><rect y="262" width="400" height="7" fill="#000"/>'+
    '<rect y="288" width="400" height="9" fill="#000"/><rect y="316" width="400" height="11" fill="#000"/><rect y="346" width="400" height="14" fill="#000"/><rect y="378" width="400" height="18" fill="#000"/></mask></defs>'+
    '<circle cx="200" cy="200" r="198" fill="url(#rwsg)" mask="url(#rwsm)"/></svg>';
  /* montañas wireframe: cada línea tapa a las de atrás (estilo contornos del fondo de referencia) */
  function ridge(x,row,ph,sc){
    var u=x/1440,
      env=Math.exp(-Math.pow((u-.5)/.2,2))+.5*Math.exp(-Math.pow((u-.16)/.13,2))+.55*Math.exp(-Math.pow((u-.86)/.14,2))+.03,
      s=row*.07,
      n=.55*Math.abs(Math.sin(u*9.1+1.3+s+ph))+.3*Math.abs(Math.sin(u*21+.4-s*1.7+ph*2))+.15*Math.abs(Math.sin(u*47+2.2+s*2.3));
    return env*(.45+.8*n);
  }
  function mix(a,b,t){return Math.round(a+(b-a)*t)}
  /* back=true: cordillera lejana (más baja, violeta/rosa); si no: montañas delanteras cian→azul */
  function buildMountains(back){
    var lp=lowPerf(),rows=back?(lp?8:12):(lp?18:28),pts=lp?70:130,W=1440,H=420,A=back?118:150,B0=back?170:205,ph=back?2.4:0,out='',
        c0=back?[151,0,204]:[45,226,230],c1=back?[246,1,157]:[3,94,232],fill=back?'#2a0f58':'#21104d';
    for(var r=0;r<rows;r++){
      var base=B0+r*(H-B0)/(rows-1),t=r/(rows-1),d='';
      for(var i=0;i<=pts;i++){
        var x=i/pts*W,y=base-A*ridge(x,r,ph)*(1-t*.12);
        d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);
      }
      var col='rgb('+mix(c0[0],c1[0],t)+','+mix(c0[1],c1[1],t)+','+mix(c0[2],c1[2],t)+')';
      out+='<path d="'+d+'L'+W+' '+(H+10)+'L0 '+(H+10)+'Z" fill="'+fill+'"/>'+
           '<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+(r===0?2.2:1.5)+'" stroke-linejoin="round"/>';
    }
    var rd='';for(var j=0;j<=pts;j++){var xx=j/pts*W;rd+=(j?'L':'M')+xx.toFixed(1)+' '+(B0-A*ridge(xx,0,ph)).toFixed(1)}
    out+='<path d="'+rd+'" fill="none" stroke="'+(back?'#ECA089':'#F887FF')+'" stroke-width="1.4" opacity=".75"/>';
    return '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true">'+out+'</svg>';
  }
  function buildScene(){
    if(scene)return;
    scene=document.createElement('div');scene.id='rw-scene';
    var lp=lowPerf();
    scene.innerHTML='<div class="rw-sky"></div><div class="rw-aurora"></div><div class="rw-stars"></div>'+
      (lp?'':'<i class="rw-shoot" style="--dl:3s;--top:12vh;--left:62vw"></i><i class="rw-shoot" style="--dl:11s;--top:6vh;--left:28vw"></i>')+
      '<div class="rw-sun"><div class="rw-sun-in">'+SUN+'</div></div><div class="rw-haze"></div>'+
      '<div class="rw-mtn back">'+buildMountains(true)+'</div><div class="rw-mtn">'+buildMountains(false)+'</div>'+
      '<div class="rw-floor"><div class="rw-grid"><div class="rw-road"><i></i></div></div><div class="rw-reflect"></div><div class="rw-horizon"></div></div>'+
      '<div class="rw-veil"></div><div class="rw-scan"></div>';
    var st=scene.querySelector('.rw-stars'),n=reduced()?30:(lp?28:80),cols=['#fff','#fff','#F887FF','#2DE2E6','#ECC6A2'];
    for(var i=0;i<n;i++){
      var e=document.createElement('i'),z=rand(1,2.7),c=cols[i%cols.length];e.className='rw-star'+(i%11===0&&!lp?' big':'');
      e.style.cssText='left:'+rand(0,100)+'%;top:'+(Math.pow(Math.random(),1.3)*100)+'%;width:'+z+'px;height:'+z+'px;color:'+c+';background:'+c+';--d:'+rand(2.5,6)+'s;--dl:'+(-rand(0,6))+'s';
      st.appendChild(e);
    }
    document.body.insertBefore(scene,document.body.firstChild);
    bindParallax();
  }
  /* parallax suave con el scroll: el sol y las montañas se desplazan a distinta velocidad */
  var pxOn=false,pxTick=false;
  function pxUpdate(){pxTick=false;if(scene)scene.style.setProperty('--sy',Math.min(window.scrollY||0,1400))}
  function onScroll(){if(!pxTick&&scene){pxTick=true;requestAnimationFrame(pxUpdate)}}
  function bindParallax(){if(pxOn||reduced()||lowPerf())return;pxOn=true;window.addEventListener('scroll',onScroll,{passive:true});pxUpdate()}
  function teardown(){if(scene){scene.remove();scene=null}}

  /* logos: en modo Retrowave se usa el logo neón (header y footer), igual que Aero usa el de vidrio */
  var LOGO_RW='assets/logo_leianetwork_retro.webp';
  function swapLogos(){
    var imgs=document.querySelectorAll('.brand img,.fbrand img');
    for(var i=0;i<imgs.length;i++){
      var im=imgs[i],cs=im.getAttribute('src')||'';
      if(on){
        if(!im.dataset.orig&&/logo_leianetwork\.(webp|png)/.test(cs))im.dataset.orig=cs;
        if(im.dataset.orig){im.removeAttribute('srcset');im.src=LOGO_RW}
      }else if(im.dataset.orig&&cs.indexOf('logo_leianetwork_retro')>-1){im.src=im.dataset.orig}
    }
  }
  function apply(){
    root.classList.toggle('retrowave',on);
    swapLogos();
    if(on){buildScene();applyMute()}else{teardown();stopMusic()}
    if(ctl)ctl.querySelector('.rw-toggle').title=on?'Salir del modo Retrowave':'Modo Retrowave';
  }
  function setOn(v,gesture){
    on=v;set(KEY,v?'1':'0');
    if(v)announce(); /* apaga Aero si estaba activo */
    apply();decorateAll();
    if(v){
      if(gesture&&!reduced()){var sw=document.createElement('div');sw.className='rw-sweep';document.body.appendChild(sw);setTimeout(function(){sw.remove()},1400)}
      showToast('◢ Modo Retrowave activado');
      if(gesture){set(POS,'0');resumeAt=0;startMusic()}
    }else showToast('Modo Retrowave desactivado · escribí "retrowave" para volver');
  }
  function buildCtl(){
    ctl=document.createElement('div');ctl.id='rw-ctl';
    var pill=document.createElement('div');pill.className='rw-now';pill.innerHTML='<span class="rw-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="rw-track">Neon Highway</span>';
    muteBtn=document.createElement('button');muteBtn.className='rw-mute';muteBtn.innerHTML=muted?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';muteBtn.setAttribute('aria-label','Música Retrowave');
    var t=document.createElement('button');t.className='rw-toggle';t.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="11" r="5"/><path d="M2 18h20M5 21h14"/></svg>';t.title='Volver al modo original';t.setAttribute('aria-label','Volver al modo original');
    ctl.appendChild(pill);ctl.appendChild(muteBtn);ctl.appendChild(t);document.body.appendChild(ctl);
    t.onclick=function(){setOn(!on,true)};
    muteBtn.onclick=function(){muted=!muted;set(MUTE,muted?'1':'0');if(!muted)startMusic();applyMute()};
  }

  /* links internos: llevan la elección en la URL para sobrevivir a cualquier navegador/entorno */
  function stateVal(){var v=get(KEY);return v==='1'||v==='0'?v:null}
  function decorate(a){
    var v=stateVal();if(v===null)return;
    var h=a.getAttribute('href');
    if(!h||h.charAt(0)==='#'||/^(mailto:|tel:|javascript:|data:|blob:|sms:)/i.test(h)||a.hasAttribute('download'))return;
    var u;try{u=new URL(a.href,location.href)}catch(e){return}
    if(u.protocol!==location.protocol)return;
    if(location.protocol!=='file:'&&u.host!==location.host)return;
    var last=u.pathname.split('/').pop();
    if(last&&/\./.test(last)&&!/\.html?$/i.test(last))return;
    var hi=h.indexOf('#'),base=hi>=0?h.slice(0,hi):h,hash=hi>=0?h.slice(hi):'';
    if(new RegExp('[?&]retro='+v+'(&|$)').test(base))return;
    base=base.replace(/\?retro=[01]&/,'?').replace(/[?&]retro=[01]/,'');
    a.setAttribute('href',base+(base.indexOf('?')>=0?'&':'?')+'retro='+v+hash);
  }
  function decorateAll(){var as=document.querySelectorAll('a[href]');for(var i=0;i<as.length;i++)decorate(as[i])}
  var decT=null;
  function watchLinks(){
    if(!window.MutationObserver)return;
    new MutationObserver(function(){clearTimeout(decT);decT=setTimeout(decorateAll,250)}).observe(document.body,{childList:true,subtree:true});
  }
  document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(a){decorate(a);savePos()}},true);
  document.addEventListener('auxclick',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(a)decorate(a)},true);
  /* botón "atrás" (bfcache): re-leer la elección */
  window.addEventListener('pageshow',function(e){if(e.persisted){var v=get(KEY)==='1';if(v!==on){on=v;apply()}decorateAll()}});

  /* escribir "retrowave" en cualquier lado (fuera de inputs) */
  var WORD='retrowave',buf='';
  document.addEventListener('keydown',function(e){
    var t=e.target,tag=t&&t.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable))return;
    if(e.ctrlKey||e.metaKey||e.altKey||!e.key||e.key.length!==1)return;
    buf=(buf+e.key.toLowerCase()).slice(-WORD.length);
    if(buf===WORD){buf='';setOn(!on,true)}
  });
  /* el navegador exige un gesto para reproducir audio: se arranca con el primer click/tecla/toque de la página */
  function gestureStart(){if(on&&!muted&&!timer)startMusic()}
  document.addEventListener('pointerdown',gestureStart,true);
  document.addEventListener('keydown',gestureStart,true);
  document.addEventListener('touchend',gestureStart,true);

  window.addEventListener('storage',function(e){
    if(e.key===KEY&&(e.newValue==='1')!==on){on=e.newValue==='1';apply()}
  });
  function init(){
    buildCtl();apply();decorateAll();watchLinks();
    if(on){
      announce(); /* si llegaron ambos estados, gana Retrowave */
      if(!muted)startMusic(); /* si el navegador lo permite, suena solo; si no, arranca con el primer gesto */
    }
  }
  if(document.body)init();else document.addEventListener('DOMContentLoaded',init);
})();
