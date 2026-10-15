/* LeiaNET · modos "matrix", "win95", "gameboy", "brutal" y "darkfantasy". Escribí la palabra en cualquier página (fuera de inputs) para activar/desactivar.
   Misma mecánica que Aero/Retrowave: se guarda entre páginas (localStorage + window.name + ?matrix=1 / ?win95=1 / ?gameboy=1 / ?brutal=1 en los links)
   y los modos son excluyentes entre sí (evento 'leianet-theme'). Cada modo puede traer música de fondo (cfg.music) con botón de silencio. */
(function(){
  var root=document.documentElement;
  function wnGet(k){var m=(window.name||'').match(new RegExp('(?:^|\\|)'+k+':([^|]*)'));return m?m[1]:null}
  function wnSet(k,v){try{var n=(window.name||'').replace(new RegExp('(?:^|\\|)'+k+':[^|]*','g'),'');window.name=n+'|'+k+':'+v}catch(e){}}
  function get(k){var v=null;try{v=localStorage.getItem(k)}catch(e){}return v!==null?v:wnGet(k)}
  function set(k,v){try{localStorage.setItem(k,v)}catch(e){}wnSet(k,v)}
  function reduced(){return window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches}
  function lowPerf(){return !!(window.__LOW_PERF__||root.classList.contains('low-perf'))}

  function makeMode(cfg){
    var KEY='leianet-'+cfg.id,PARAM=cfg.id,on=false,toast=null,scene=null,ctl=null,buf='';
    var qm=(location.search.match(new RegExp('[?&]'+PARAM+'=([01])'))||[])[1];
    if(qm!==undefined){
      set(KEY,qm);
      try{var cu=new URL(location.href);cu.searchParams.delete(PARAM);history.replaceState(history.state,'',cu.pathname+cu.search+cu.hash)}catch(e){}
    }
    on=get(KEY)==='1';

    /* ---------- música de fondo (loop con crossfade, volumen bajito, se reanuda entre páginas) ---------- */
    var MM=cfg.music,MUTE=KEY+'-mute',POS=KEY+'-pos',muted=get(MUTE)==='1',mA=null,mB=null,mCur=null,mTimer=null,mGain=0,mFirst=true,mSave=0,muteBtn=null;
    var ICO_ON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
    var ICO_OFF='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
    function clamp(v){return Math.max(0,Math.min(1,v))}
    function mk(){var a=new Audio(MM.src);a.preload='auto';a.loop=false;a.volume=0;return a}
    function savePos(w){
      if(!mCur||mCur.paused||!mCur.currentTime)return;
      try{localStorage.setItem(POS,String(mCur.currentTime))}catch(e){}
      if(w)wnSet(POS,String(mCur.currentTime));
    }
    function mTick(){
      if(!mCur)return;
      var target=muted?0:MM.vol;
      mGain+=(target-mGain)*.2;if(Math.abs(target-mGain)<.0005)mGain=target;
      var other=mCur===mA?mB:mA,d=mCur.duration;
      if(!d||isNaN(d))return;
      var t=mCur.currentTime,left=d-t,vc=1,FADE=MM.fade||3;
      if(mFirst)vc=clamp(t/(MM.intro||2)); /* entrada suave la primera vez */
      if(left<=FADE){
        if(other.paused){other.currentTime=0;var p=other.play();if(p&&p.catch)p.catch(function(){})}
        var x=clamp(1-left/FADE);
        mCur.volume=clamp(mGain*vc*Math.cos(x*Math.PI/2));
        other.volume=clamp(mGain*Math.sin(x*Math.PI/2));
        if(left<=.08||mCur.ended){mCur.pause();mCur.currentTime=0;mCur.volume=0;mCur=other;mFirst=false}
      }else mCur.volume=clamp(mGain*vc);
      if(++mSave%20===0)savePos(false);
    }
    function startMusic(){
      if(!MM||mTimer||!on)return;
      if(!mA){mA=mk();mB=mk();mCur=mA;
        var rs=parseFloat(get(POS))||0; /* retoma donde iba en la página anterior */
        if(rs>0)mA.addEventListener('loadedmetadata',function(){if(mA.duration&&rs<mA.duration-6)try{mA.currentTime=rs}catch(e){}},{once:true});
      }
      var p=mCur.play();
      if(p&&p.catch)p.catch(function(){stopTimer()}); /* si el navegador lo bloquea, reintenta en el próximo gesto */
      mTimer=setInterval(mTick,100);
    }
    function stopTimer(){if(mTimer){clearInterval(mTimer);mTimer=null}}
    function stopMusic(){
      stopTimer();
      [mA,mB].forEach(function(a){if(a){a.pause();a.currentTime=0;a.volume=0}});
      mCur=mA;mGain=0;mFirst=true;
    }
    function applyMute(){if(muteBtn){muteBtn.innerHTML=muted?ICO_OFF:ICO_ON;muteBtn.classList.toggle('muted',muted);muteBtn.title=muted?'Activar música':'Silenciar música';muteBtn.setAttribute('aria-label',muteBtn.title)}}
    function buildMute(){
      if(muteBtn||!MM)return;
      muteBtn=document.createElement('button');muteBtn.id=cfg.id+'-mute';muteBtn.className='tm-mute';muteBtn.type='button';
      muteBtn.onclick=function(){muted=!muted;set(MUTE,muted?'1':'0');if(!muted)startMusic();applyMute()};
      document.body.appendChild(muteBtn);applyMute();
    }
    if(MM){
      /* el navegador exige un gesto para reproducir audio: se arranca con el primer click/tecla/toque */
      ['keydown','pointerdown','touchstart'].forEach(function(ev){document.addEventListener(ev,function(){if(on&&!muted&&!mTimer)startMusic()},true)});
      window.addEventListener('pagehide',function(){savePos(true)});
    }

    function showToast(msg){
      if(!toast){toast=document.createElement('div');toast.id=cfg.id+'-toast';toast.className='tm-toast';document.body.appendChild(toast)}
      toast.textContent=msg;toast.classList.add('show');clearTimeout(toast._t);
      toast._t=setTimeout(function(){toast.classList.remove('show')},2800);
    }
    function announce(){try{window.dispatchEvent(new CustomEvent('leianet-theme',{detail:cfg.id}))}catch(e){}}
    window.addEventListener('leianet-theme',function(e){if(e.detail!==cfg.id&&on){on=false;set(KEY,'0');apply();decorateAll()}});

    /* ---------- escena (fondo) ---------- */
    function buildScene(){
      if(scene||!cfg.scene)return;
      scene=document.createElement('div');scene.id=cfg.id+'-scene';scene.setAttribute('aria-hidden','true');
      cfg.scene(scene);
      document.body.insertBefore(scene,document.body.firstChild);
    }
    function teardown(){if(scene){if(cfg.sceneStop)cfg.sceneStop();scene.remove();scene=null}}

    function apply(){
      root.classList.toggle(cfg.cls,on);
      if(on){buildScene();if(cfg.onOn)cfg.onOn();if(MM){buildMute();applyMute();if(!muted)startMusic()}}
      else{teardown();if(cfg.onOff)cfg.onOff();if(MM)stopMusic()}
      if(ctl)ctl.title=on?'Salir del modo '+cfg.name:'Modo '+cfg.name;
    }
    function setOn(v,gesture){
      on=v;set(KEY,v?'1':'0');
      if(v&&gesture)set(POS,'0'); /* al activar a propósito, la música arranca desde el principio */
      if(v)announce();
      apply();decorateAll();
      if(v)showToast(cfg.onMsg);else showToast('Modo '+cfg.name+' desactivado · escribí "'+cfg.word+'" para volver');
      if(v&&gesture&&cfg.sound)cfg.sound();
    }
    function buildCtl(){
      ctl=document.createElement('button');ctl.id=cfg.id+'-ctl';ctl.className='tm-ctl';ctl.type='button';
      ctl.innerHTML=cfg.icon;ctl.setAttribute('aria-label','Volver al modo original');ctl.title='Volver al modo original';
      ctl.onclick=function(){setOn(!on,true)};
      document.body.appendChild(ctl);
    }

    /* ---------- links internos con ?modo=1 ---------- */
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
      if(new RegExp('[?&]'+PARAM+'='+v+'(&|$)').test(base))return;
      base=base.replace(new RegExp('\\?'+PARAM+'=[01]&'),'?').replace(new RegExp('[?&]'+PARAM+'=[01]'),'');
      a.setAttribute('href',base+(base.indexOf('?')>=0?'&':'?')+PARAM+'='+v+hash);
    }
    function decorateAll(){var as=document.querySelectorAll('a[href]');for(var i=0;i<as.length;i++)decorate(as[i])}
    var decT=null;
    function watchLinks(){
      if(!window.MutationObserver)return;
      new MutationObserver(function(){clearTimeout(decT);decT=setTimeout(decorateAll,250)}).observe(document.body,{childList:true,subtree:true});
    }
    document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(a)decorate(a)},true);
    document.addEventListener('auxclick',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(a)decorate(a)},true);
    window.addEventListener('pageshow',function(e){if(e.persisted){var v=get(KEY)==='1';if(v!==on){on=v;apply()}decorateAll()}});
    window.addEventListener('storage',function(e){if(e.key===KEY&&(e.newValue==='1')!==on){on=e.newValue==='1';apply()}});

    /* ---------- palabra secreta ---------- */
    document.addEventListener('keydown',function(e){
      var t=e.target,tag=t&&t.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable))return;
      if(e.ctrlKey||e.metaKey||e.altKey||!e.key||e.key.length!==1)return;
      buf=(buf+e.key.toLowerCase()).slice(-cfg.word.length);
      if(buf===cfg.word){buf='';setOn(!on,true)}
    });

    function init(){
      buildCtl();apply();decorateAll();watchLinks();
      if(on)announce(); /* si llegaran dos estados guardados a la vez, el último en iniciar gana */
    }
    if(document.body)init();else document.addEventListener('DOMContentLoaded',init);
  }

  /* =================== MATRIX =================== */
  var rain={cv:null,raf:0,onResize:null};
  function matrixScene(sc){
    var cv=document.createElement('canvas');cv.className='mx-rain';sc.appendChild(cv);
    sc.insertAdjacentHTML('beforeend','<div class="mx-vignette"></div><div class="mx-scan"></div>');
    rain.cv=cv;
    var ctx=cv.getContext('2d'),fs=lowPerf()?18:16,cols=0,drops=[],w=0,h=0,last=0;
    var chars='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFZ:.=*+-<>¦';
    function size(){
      var dpr=1;w=cv.width=Math.floor(window.innerWidth*dpr);h=cv.height=Math.floor(window.innerHeight*dpr);
      cols=Math.ceil(w/fs);while(drops.length<cols)drops.push(Math.random()*-60);drops.length=cols;
    }
    size();rain.onResize=size;window.addEventListener('resize',size);
    function frame(t){
      rain.raf=requestAnimationFrame(frame);
      if(t-last<(lowPerf()?80:48))return;last=t;
      ctx.fillStyle='rgba(0,0,0,.09)';ctx.fillRect(0,0,w,h);
      ctx.font=fs+'px "Courier New",monospace';
      for(var i=0;i<cols;i++){
        var y=drops[i]*fs,ch=chars.charAt(Math.floor(Math.random()*chars.length));
        ctx.fillStyle='#80ff80';ctx.fillText(ch,i*fs,y);
        ctx.fillStyle='rgba(0,255,0,.9)';ctx.fillText(chars.charAt(Math.floor(Math.random()*chars.length)),i*fs,y-fs);
        if(y>h&&Math.random()>.975)drops[i]=0;
        drops[i]+=1;
      }
    }
    if(reduced()){ /* sin animación: una sola captura estática */
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.font=fs+'px "Courier New",monospace';
      for(var c=0;c<cols;c++)for(var r=0;r<h/fs;r+=1){if(Math.random()<.12){ctx.fillStyle=Math.random()<.1?'#80ff80':'rgba(0,255,0,.35)';ctx.fillText(chars.charAt(Math.floor(Math.random()*chars.length)),c*fs,r*fs)}}
    }else{ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);rain.raf=requestAnimationFrame(frame)}
  }
  function matrixStop(){cancelAnimationFrame(rain.raf);rain.raf=0;if(rain.onResize)window.removeEventListener('resize',rain.onResize);rain.onResize=null;rain.cv=null}

  /* beep corto tipo terminal (WebAudio, sin archivos) */
  var ac=null;
  function beep(freqs,type,dur,vol){
    try{
      ac=ac||new (window.AudioContext||window.webkitAudioContext)();
      var t=ac.currentTime;
      freqs.forEach(function(f,i){
        var o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;
        g.gain.setValueAtTime(0,t+i*dur);g.gain.linearRampToValueAtTime(vol,t+i*dur+.01);g.gain.exponentialRampToValueAtTime(.0001,t+(i+1)*dur);
        o.connect(g);g.connect(ac.destination);o.start(t+i*dur);o.stop(t+(i+1)*dur+.02);
      });
    }catch(e){}
  }

  makeMode({
    id:'matrix',cls:'matrix',word:'matrix',name:'Matrix',onMsg:'> Modo Matrix activado_',
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7l5 5-5 5M12 18h8"/></svg>',
    scene:matrixScene,sceneStop:matrixStop,
    music:{src:'assets/matrix-music.mp3',vol:.2,fade:3,intro:3},
    sound:function(){beep([880,1320,1760],'square',.06,.05)}
  });

  /* =================== WINDOWS 95 =================== */
  function win95Scene(sc){
    sc.innerHTML='<div class="w95-desk"></div>';
  }
  function w95Chrome(){
    if(document.getElementById('w95-taskbar'))return;
    var tb=document.createElement('div');tb.id='w95-taskbar';
    tb.innerHTML='<button type="button" class="w95-start" id="w95-start"><span class="w95-flag"><i></i><i></i><i></i><i></i></span><b>Inicio</b></button>'+
      '<span class="w95-sep"></span><span class="w95-task" id="w95-task"></span><span class="w95-tray"><span class="w95-snd"></span><span id="w95-clock">00:00</span></span>';
    document.body.appendChild(tb);
    var menu=document.createElement('div');menu.id='w95-menu';
    menu.innerHTML='<div class="w95-menu-side"><span>Leia<b>NET</b>95</span></div><div class="w95-menu-items">'+
      '<a href="index.html">Inicio</a><a href="index.html#utilidades">Utilidades</a><a href="index.html#minecraft">Minecraft</a><a href="index.html#cs16">Counter-Strike 1.6</a><a href="index.html#foro">Foro</a><a href="https://discord.gg/3Hsy6JrSMH" target="_blank" rel="noopener">Discord</a><hr>'+
      '<button type="button" id="w95-off">Salir de Windows 95…</button></div>';
    document.body.appendChild(menu);
    var st=tb.querySelector('#w95-start');
    function closeMenu(){menu.classList.remove('open');st.classList.remove('down')}
    st.onclick=function(e){e.stopPropagation();var o=menu.classList.toggle('open');st.classList.toggle('down',o)};
    document.addEventListener('click',function(e){if(!menu.contains(e.target))closeMenu()});
    menu.querySelector('#w95-off').onclick=function(){closeMenu();document.getElementById('w95-ctl').click()};
    var t=document.getElementById('w95-task');t.textContent=(document.title||'LeiaNET');
    function clock(){var d=new Date(),el=document.getElementById('w95-clock');if(el)el.textContent=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
    clock();w95Chrome.timer=setInterval(clock,15000);
    w95Icons();w95Dlg();
    document.addEventListener('click',w95Click,true);
  }
  /* iconos del escritorio (se ven sólo en pantallas anchas) */
  function w95Icons(){
    if(document.getElementById('w95-icons'))return;
    var d=document.createElement('div');d.id='w95-icons';
    var L=[['Inicio','index.html','assets/favicon-48.png'],['Minecraft','index.html#minecraft','assets/logo_minecraft.webp'],['Counter-Strike 1.6','index.html#cs16','assets/logo_cs_transparent.webp'],['Utilidades','index.html#utilidades','assets/favicon-48.png'],['Foro','index.html#foro','assets/favicon-48.png']];
    d.innerHTML=L.map(function(i){return '<a class="w95-ico" href="'+i[1]+'"><i style="background-image:url('+i[2]+')"></i><span>'+i[0]+'</span></a>'}).join('');
    document.body.appendChild(d);
    d.addEventListener('click',function(e){var a=e.target.closest('.w95-ico');if(!a)return;e.preventDefault();
      var all=d.querySelectorAll('.w95-ico');for(var i=0;i<all.length;i++)all[i].classList.remove('sel');a.classList.add('sel')});
    d.addEventListener('dblclick',function(e){var a=e.target.closest('.w95-ico');if(a)location.href=a.href});
    document.addEventListener('click',function(e){if(!d.contains(e.target)){var s=d.querySelector('.sel');if(s)s.classList.remove('sel')}});
  }
  /* cuadro de mensaje clásico */
  function w95Dlg(){
    if(document.getElementById('w95-dlg'))return;
    var d=document.createElement('div');d.id='w95-dlg';d.setAttribute('role','alertdialog');
    d.innerHTML='<div class="t"><span>LeiaNET</span><u>×</u></div><div class="b"><em>×</em><div id="w95-dlg-msg"></div></div><div class="f"><button type="button">Aceptar</button></div>';
    document.body.appendChild(d);
    var close=function(){d.classList.remove('open')};
    d.querySelector('button').onclick=close;d.querySelector('u').onclick=close;
    document.addEventListener('keydown',function(e){if(d.classList.contains('open')&&(e.key==='Enter'||e.key==='Escape'))close()});
  }
  var W95MSG=['Esta ventana no se puede cerrar. Es parte de LeiaNET y la perra no te deja irte todavía.','Error 404: ganas de irte no encontradas.','Operación no válida. Se cerrará el programa… mentira, seguí navegando.','Esta ventana está ocupada. Probá de nuevo cuando termines de leer.'];
  var w95i=0;
  /* botones de la barra de título: _ minimiza · □ sube al inicio de la ventana · × cuadro de error */
  function w95Click(e){
    if(!root.classList.contains('win95'))return;
    var bar=e.target.closest&&e.target.closest('.sec-head,.hero');if(!bar)return;
    var r=bar.getBoundingClientRect(),isHero=bar.classList.contains('hero');
    var top=isHero?6:(r.height-14)/2,right=isHero?6:3;
    var x=r.right-right-e.clientX,y=e.clientY-r.top-top;
    if(x<0||x>50||y<0||y>14)return;
    e.preventDefault();e.stopPropagation();
    var win=isHero?bar:bar.closest('section')||bar.parentNode;
    if(x>34){ /* minimizar */
      win.classList.toggle('w95-min');
    }else if(x>16){ /* maximizar → centra la ventana */
      win.classList.remove('w95-min');win.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
    }else{ /* cerrar */
      var dlg=document.getElementById('w95-dlg');if(!dlg)return;
      document.getElementById('w95-dlg-msg').textContent=W95MSG[w95i++%W95MSG.length];dlg.classList.add('open');
      beep([392,294],'square',.09,.05);
    }
  }
  function w95Unchrome(){
    document.removeEventListener('click',w95Click,true);
    ['w95-taskbar','w95-menu','w95-icons','w95-dlg'].forEach(function(id){var e=document.getElementById(id);if(e)e.remove()});
    clearInterval(w95Chrome.timer);
  }
  /* "ding" corto tipo arranque */
  makeMode({
    id:'win95',cls:'win95',word:'win95',name:'Windows 95',onMsg:'Windows 95 · Modo activado',
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5l8-1v7H3zM12 4l9-1.5V11h-9zM3 12h8v7l-8-1zM12 12h9v8.5L12 19z"/></svg>',
    scene:win95Scene,onOn:w95Chrome,onOff:w95Unchrome,
    music:{src:'assets/win95-music.mp3',vol:.2,fade:3,intro:2},
    sound:function(){beep([523,659,784,1047],'triangle',.12,.08)}
  });

  /* =================== GAME BOY =================== */
  function gameboyScene(sc){
    sc.innerHTML='<div class="gb-lcd"></div><div class="gb-ghost"></div><div class="gb-vig"></div>';
  }
  makeMode({
    id:'gameboy',cls:'gameboy',word:'gameboy',name:'Game Boy',onMsg:'▶ GAME BOY · PRESS START',
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
    scene:gameboyScene,
    music:{src:'assets/gameboy-music.mp3',vol:.18,fade:3,intro:1.5},
    sound:function(){beep([1047,2093],'square',.09,.05)} /* el clásico "ba-ding" del arranque */
  });

  /* =================== BRUTAL =================== */
  function brutalScene(sc){
    sc.innerHTML='<i class="bt-s bt-s1"></i><i class="bt-s bt-s2"></i><i class="bt-s bt-s3"></i><i class="bt-s bt-s4"></i><i class="bt-s bt-s5"></i>';
  }
  makeMode({
    id:'brutal',cls:'brutal',word:'brutal',name:'Brutalista',onMsg:'BRUTALISMO ACTIVADO!',
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h13v13H4z"/><path d="M8 21h13V8"/></svg>',
    scene:brutalScene,
    music:{src:'assets/brutal-music.mp3',vol:.2,fade:3,intro:1.5},
    sound:function(){beep([196,98],'sawtooth',.09,.07)}
  });

  /* =================== DARK FANTASY =================== */
  var dfx={raf:0,onResize:null,onMove:null,rt:0,mv:0};
  function dfRng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function dfSm(a,b,x){x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)}
  /* cresta dentada: unión de picos cónicos afilados + ruido fractal fino; devuelve alturas cada 4 px */
  function dfRidge(w,rnd,amp,rough,pw,envK,density){
    var N=Math.ceil(w/4)+1,out=new Float32Array(N),i,k;
    var np=Math.max(4,Math.round(w/(density||240))),pk=[];
    for(k=0;k<np;k++){var px=(k+rnd()*.9)/np*w,x=px/w,env=1-envK*dfSm(.1,.85,x);
      pk.push({x:px,h:(.35+.65*Math.pow(rnd(),pw))*amp*env,s:.9+rnd()*1.1+(rnd()<.25?1:0)})}
    var np2=Math.round(w/60),pk2=[];
    for(k=0;k<np2;k++){var qx=rnd()*w,qe=1-envK*dfSm(.1,.85,qx/w);pk2.push({x:qx,h:(.1+rnd()*.3)*amp*qe,s:1.4+rnd()*2.2})}
    var P=1;while(P<N-1)P<<=1;
    var a=new Float32Array(P+1),disp=1,step=P,half;
    a[0]=rnd();a[P]=rnd();
    while(step>1){half=step>>1;for(i=half;i<P;i+=step)a[i]=(a[i-half]+a[i+half])/2+(rnd()-.5)*2*disp;disp*=rough;step=half}
    for(i=0;i<N;i++){
      var X=i*4,m=amp*.06;
      for(k=0;k<np;k++){var v=pk[k].h-Math.abs(X-pk[k].x)*pk[k].s;if(v>m)m=v}
      for(k=0;k<np2;k++){var v2=pk2[k].h-Math.abs(X-pk2[k].x)*pk2[k].s;if(v2>m)m=v2}
      out[i]=Math.max(0,m+a[i]*amp*.15);
    }
    return out;
  }
  function dfTree(ctx,x,y,len,ang,wd,rnd,d){
    var x2=x+Math.cos(ang)*len,y2=y+Math.sin(ang)*len;
    ctx.lineWidth=wd;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();
    if(d<=0||len<5)return;
    var n=rnd()<.3?3:2;
    for(var k=0;k<n;k++)dfTree(ctx,x2,y2,len*(.62+rnd()*.18),ang+(rnd()-.5)*1.5,Math.max(.6,wd*.68),rnd,d-1);
  }
  /* cielo estático: degradé violeta, Vía Láctea, estrellas, eclipse, tres capas de montañas y árboles muertos */
  function dfPaintSky(cv){
    var w=cv.width,h=cv.height,ctx=cv.getContext('2d'),rnd=dfRng(1337),i,g;
    g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'#040308');g.addColorStop(.3,'#0b0813');g.addColorStop(.5,'#150f23');g.addColorStop(.68,'#2a1f3c');g.addColorStop(.8,'#43325a');g.addColorStop(.9,'#201a32');g.addColorStop(1,'#08060d');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    /* resplandor del horizonte, con un toque carmesí */
    g=ctx.createRadialGradient(w*.38,h*.78,0,w*.38,h*.78,Math.max(w,h)*.62);
    g.addColorStop(0,'rgba(229,164,199,.2)');g.addColorStop(.45,'rgba(137,105,145,.16)');g.addColorStop(1,'rgba(78,60,93,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    g=ctx.createRadialGradient(w*.85,h*.82,0,w*.85,h*.82,Math.max(w,h)*.35);
    g.addColorStop(0,'rgba(229,164,199,.14)');g.addColorStop(1,'rgba(229,164,199,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    /* banda de la Vía Láctea: de abajo-izquierda a arriba-derecha */
    var ax=-.05*w,ay=.72*h,bx=1.05*w,by=.02*h,dx=bx-ax,dy=by-ay,len=Math.sqrt(dx*dx+dy*dy),nx=-dy/len,ny=dx/len;
    ctx.globalCompositeOperation='screen';
    var cols=['rgba(137,105,145,','rgba(229,164,199,','rgba(110,84,135,','rgba(245,194,217,'];
    for(i=0;i<16;i++){
      var u=rnd(),off=(rnd()-.5)*h*.2,cx=ax+dx*u+nx*off,cy=ay+dy*u+ny*off,r=(.1+rnd()*.2)*Math.min(w,h)*1.1;
      g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);var c=cols[i%4];
      g.addColorStop(0,c+(.04+rnd()*.07)+')');g.addColorStop(1,c+'0)');
      ctx.fillStyle=g;ctx.fillRect(cx-r,cy-r,r*2,r*2);
    }
    /* estrellas: algunas dispersas por todo el cielo y muchas concentradas en la banda */
    var count=Math.min(7000,Math.floor(w*h/380)),sc=['255,255,255','245,194,217','229,164,199','232,218,240','205,190,235'];
    for(i=0;i<count;i++){
      var x,y,band=rnd()<.62;
      if(band){var u2=rnd(),gs=(rnd()+rnd()+rnd()-1.5)*h*.16;x=ax+dx*u2+nx*gs;y=ay+dy*u2+ny*gs}else{x=rnd()*w;y=rnd()*h*.82}
      if(x<0||x>w||y<0||y>h)continue;
      var b=Math.pow(rnd(),band?2.2:3);var col=sc[(rnd()*rnd()*5)|0];
      ctx.fillStyle='rgba('+col+','+(.18+b*.82)+')';
      var s=b>.86?2:1;ctx.fillRect(x|0,y|0,s,s);
      if(b>.95){var gg=ctx.createRadialGradient(x,y,0,x,y,6);gg.addColorStop(0,'rgba('+col+',.35)');gg.addColorStop(1,'rgba('+col+',0)');ctx.fillStyle=gg;ctx.fillRect(x-6,y-6,12,12)}
    }
    ctx.globalCompositeOperation='source-over';
    /* eclipse: disco negro con corona carmesí y dorada */
    var ex=w*.62,ey=h*.2,er=Math.min(w,h)*.062;
    g=ctx.createRadialGradient(ex,ey,er*.9,ex,ey,er*4.4);
    g.addColorStop(0,'rgba(245,194,217,.3)');g.addColorStop(.12,'rgba(229,164,199,.28)');g.addColorStop(.4,'rgba(137,105,145,.14)');g.addColorStop(1,'rgba(78,60,93,0)');
    ctx.fillStyle=g;ctx.fillRect(ex-er*5,ey-er*5,er*10,er*10);
    ctx.beginPath();ctx.arc(ex,ey,er*1.04,0,6.2832);ctx.strokeStyle='rgba(245,194,217,.95)';ctx.lineWidth=Math.max(1.5,er*.07);ctx.shadowColor='rgba(229,164,199,.9)';ctx.shadowBlur=er*.5;ctx.stroke();ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(ex,ey,er,0,6.2832);ctx.fillStyle='#0d0a18';ctx.fill();
    /* montañas */
    var layers=[
      {base:.78,amp:.46,rough:.6,pw:.9,env:.6,dn:330,top:'#2f2342',bot:'#150f22',rim:'rgba(245,194,217,.5)',haze:'rgba(110,70,130,',hz:.5,seed:11},
      {base:.89,amp:.36,rough:.62,pw:1,env:.65,dn:260,top:'#1c1530',bot:'#0b0813',rim:'rgba(229,164,199,.38)',haze:'rgba(80,55,100,',hz:.42,seed:23},
      {base:1.03,amp:.2,rough:.6,pw:1.2,env:.75,dn:200,top:'#0a0710',bot:'#030207',rim:'rgba(229,164,199,.22)',haze:'',hz:0,seed:37}
    ];
    for(var li=0;li<layers.length;li++){
      var L=layers[li],r2=dfRng(L.seed*97+3),base=L.base*h,amp=L.amp*h,hs=dfRidge(w,r2,amp,L.rough,L.pw,L.env,L.dn),N=hs.length,k;
      var path=new Path2D();path.moveTo(0,h);for(k=0;k<N;k++)path.lineTo(k*4,base-hs[k]);path.lineTo(w,h);path.closePath();
      g=ctx.createLinearGradient(0,base-amp,0,base);g.addColorStop(0,L.top);g.addColorStop(1,L.bot);
      ctx.fillStyle=g;ctx.fill(path);
      ctx.save();ctx.clip(path);
      /* facetas: cuña oscura a la derecha de cada pico y cuña de luz a la izquierda */
      for(k=8;k<N-8;k++){
        var v=hs[k],isPk=true,j;
        for(j=-8;j<=8;j++){if(hs[k+j]>v){isPk=false;break}}
        if(!isPk||v<amp*.22)continue;
        var px=k*4,py=base-v,Lw=40+r2()*90;
        ctx.fillStyle='rgba(13,10,24,'+(.3+r2()*.25)+')';ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Lw,base);ctx.lineTo(px+Lw*.1,base);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(245,194,217,'+(.06+r2()*.08)+')';ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-Lw*.95,base);ctx.lineTo(px-Lw*.1,base);ctx.closePath();ctx.fill();
      }
      if(L.hz){g=ctx.createLinearGradient(0,base-amp*.75,0,base);g.addColorStop(0,L.haze+'0)');g.addColorStop(1,L.haze+L.hz+')');ctx.fillStyle=g;ctx.fillRect(0,base-amp,w,amp+2)}
      ctx.restore();
      ctx.beginPath();for(k=0;k<N;k++){if(k)ctx.lineTo(k*4,base-hs[k]);else ctx.moveTo(0,base-hs[k])}
      ctx.strokeStyle=L.rim;ctx.lineWidth=1.2;ctx.stroke();
      if(li===2){ /* árboles muertos sobre la capa cercana, sólo del lado izquierdo (el resto lo tapa el acantilado) */
        ctx.strokeStyle='#0d0a18';ctx.lineCap='round';
        var nt=Math.max(4,Math.floor(w/260));
        for(k=0;k<nt;k++){var tx=r2()*w*.56,ti=Math.min(N-1,Math.floor(tx/4));dfTree(ctx,tx,base-hs[ti]+8,(26+r2()*34)*(h/900+.4),-Math.PI/2+(r2()-.5)*.4,3+r2()*2,r2,5)}
      }
    }
    /* viñeta de piso para que el borde inferior se pierda en la niebla */
    g=ctx.createLinearGradient(0,h*.82,0,h);g.addColorStop(0,'rgba(13,10,24,0)');g.addColorStop(1,'rgba(13,10,24,.75)');ctx.fillStyle=g;ctx.fillRect(0,h*.82,w,h*.18);
  }
  /* acantilado con musgo, muralla y torres con techo de hongo (SVG, 520x640) */
  function dfCliffSVG(){
    var rnd=dfRng(777),o='',i,Y0=246;
    /* contorno del acantilado: cara izquierda irregular */
    var pts=[[520,640],[30,640]],x=34,y=636;
    var edge=[[44,600],[62,572],[50,540],[84,508],[70,470],[104,436],[92,398],[126,362],[112,324],[142,292],[132,268],[168,252]];
    for(i=0;i<edge.length;i++){pts.push([edge[i][0]+(rnd()-.5)*10,edge[i][1]+(rnd()-.5)*8])}
    pts.push([230,Y0+2],[330,Y0],[430,Y0-4],[520,Y0-6]);
    var d='M'+pts.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1)}).join(' L')+' Z';
    var defs='<defs>'+
     '<linearGradient id="dfRock" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a4570"/><stop offset=".14" stop-color="#3a2d4e"/><stop offset=".4" stop-color="#201829"/><stop offset=".75" stop-color="#120d1c"/><stop offset="1" stop-color="#07050b"/></linearGradient>'+
     '<linearGradient id="dfRockV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".6" stop-color="#0d0a18" stop-opacity=".25"/><stop offset="1" stop-color="#0d0a18" stop-opacity=".8"/></linearGradient>'+
     '<linearGradient id="dfMoss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a6290"/><stop offset=".55" stop-color="#3a2d4e"/><stop offset="1" stop-color="#201a32"/></linearGradient>'+
     '<linearGradient id="dfBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a5080"/><stop offset=".22" stop-color="#3a2c4d"/><stop offset=".65" stop-color="#1a1429"/><stop offset="1" stop-color="#0a0710"/></linearGradient>'+
     '<radialGradient id="dfCap" cx=".35" cy=".15" r=".95"><stop offset="0" stop-color="#b08aa8"/><stop offset=".42" stop-color="#6a4a78"/><stop offset=".8" stop-color="#2e2340"/><stop offset="1" stop-color="#100b19"/></radialGradient>'+
     '<radialGradient id="dfGlowA"><stop offset="0" stop-color="#f5c2d9" stop-opacity=".75"/><stop offset="1" stop-color="#e5a4c7" stop-opacity="0"/></radialGradient>'+
     '<radialGradient id="dfGlowR"><stop offset="0" stop-color="#d6b4ee" stop-opacity=".7"/><stop offset="1" stop-color="#896991" stop-opacity="0"/></radialGradient>'+
     '<radialGradient id="dfGlowP"><stop offset="0" stop-color="#f5c2d9" stop-opacity=".6"/><stop offset="1" stop-color="#e5a4c7" stop-opacity="0"/></radialGradient>'+
     '<pattern id="dfBrick" width="14" height="9" patternUnits="userSpaceOnUse"><path d="M0 .5H14M0 9.5H14M7 .5V4.5M0 4.5H14M3.5 4.5V9.5M10.5 4.5V9.5" stroke="#000" stroke-opacity=".38" stroke-width=".8" fill="none"/></pattern>'+
     '</defs>';
    o+=defs;
    o+='<path d="'+d+'" fill="url(#dfRock)"/>';
    /* estratos y grietas */
    for(i=0;i<22;i++){var yy=300+i*15+rnd()*8,xx=70+rnd()*60+(yy-300)*-.05,l=40+rnd()*120;
      o+='<path d="M'+xx.toFixed(0)+','+yy.toFixed(0)+' q'+(l*.5).toFixed(0)+','+((rnd()-.5)*10).toFixed(0)+' '+l.toFixed(0)+','+((rnd()-.5)*8).toFixed(0)+'" stroke="#000" stroke-opacity=".38" stroke-width="'+(1+rnd()*1.4).toFixed(1)+'" fill="none"/>'+
         '<path d="M'+(xx+2).toFixed(0)+','+(yy+2).toFixed(0)+' q'+(l*.5).toFixed(0)+',0 '+(l*.9).toFixed(0)+',3" stroke="#8c80ff" stroke-opacity=".1" stroke-width="1" fill="none"/>'}
    /* piedras sueltas en la cara */
    for(i=0;i<26;i++){var sx=80+rnd()*150,sy=290+rnd()*330,sw=8+rnd()*22,sh=5+rnd()*13;
      o+='<path d="M'+sx.toFixed(0)+','+(sy+sh).toFixed(0)+' l'+(sw*.15).toFixed(0)+',-'+sh.toFixed(0)+' l'+(sw*.7).toFixed(0)+',-'+(sh*.2).toFixed(0)+' l'+(sw*.3).toFixed(0)+','+(sh*1.1).toFixed(0)+' z" fill="#2a2240" stroke="#b894c4" stroke-opacity=".25" stroke-width=".8"/>'}
    for(i=0;i<14;i++){var bx2=90+rnd()*260,by2=300+rnd()*300,bw2=30+rnd()*60,bh2=24+rnd()*46;
      o+='<path d="M'+bx2.toFixed(0)+','+(by2+bh2).toFixed(0)+' l'+(bw2*.1).toFixed(0)+',-'+(bh2*.8).toFixed(0)+' l'+(bw2*.4).toFixed(0)+',-'+(bh2*.2).toFixed(0)+' l'+(bw2*.5).toFixed(0)+','+(bh2*.3).toFixed(0)+' l'+(bw2*.1).toFixed(0)+','+(bh2*.7).toFixed(0)+' z" fill="#000" fill-opacity=".28"/>'+
         '<path d="M'+bx2.toFixed(0)+','+(by2+bh2).toFixed(0)+' l'+(bw2*.1).toFixed(0)+',-'+(bh2*.8).toFixed(0)+' l'+(bw2*.4).toFixed(0)+',-'+(bh2*.2).toFixed(0)+'" stroke="#f5c2d9" stroke-opacity=".35" stroke-width="1.3" fill="none"/>'}
    o+='<path d="M'+pts.slice(2,2+edge.length+1).map(function(q){return q[0].toFixed(1)+','+q[1].toFixed(1)}).join(' L')+'" stroke="#f5c2d9" stroke-opacity=".6" stroke-width="2" fill="none"/>';
    o+='<path d="'+d+'" fill="url(#dfRockV)"/>';
    /* musgo: tapa superior + goteos por la cara */
    var mp='M168,252 Q200,238 230,246 L330,244 L430,240 L520,240 L520,262 Q470,272 430,262 Q380,276 330,264 Q280,272 236,262 Q200,276 172,266 Z';
    o+='<path d="'+mp+'" fill="url(#dfMoss)"/>';
    for(i=0;i<edge.length;i++){var e=pts[2+i],dl=14+rnd()*46;
      o+='<path d="M'+(e[0]-3).toFixed(0)+','+(e[1]-4).toFixed(0)+' q'+(8+rnd()*8).toFixed(0)+','+(dl*.5).toFixed(0)+' '+(4+rnd()*8).toFixed(0)+','+dl.toFixed(0)+' q-12,-'+(dl*.4).toFixed(0)+' -10,-'+(dl).toFixed(0)+' z" fill="#43365a" fill-opacity=".92"/>'}
    for(i=0;i<40;i++){var gx=175+rnd()*345,gy=240+rnd()*10;o+='<path d="M'+gx.toFixed(0)+','+(gy+4).toFixed(0)+' l'+((rnd()-.5)*4).toFixed(1)+',-'+(4+rnd()*7).toFixed(0)+'" stroke="#e5a4c7" stroke-opacity=".7" stroke-width="1.2"/>'}
    /* muralla almenada */
    var wl='M176,'+(Y0+6)+' V228 h8 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h8 V'+(Y0+4)+' Z';
    o+='<path d="'+wl+'" fill="url(#dfBody)"/><path d="'+wl+'" fill="url(#dfBrick)"/><path d="'+wl+'" fill="none" stroke="#000" stroke-opacity=".6"/>';
    /* torres */
    function cap(cx,yb,w,h){
      var n=Math.max(5,Math.round(w/16)),sw=w/n,dd='M'+(cx-w/2)+','+yb+' C'+(cx-w/2-4)+','+(yb-h*1.3)+' '+(cx+w/2+4)+','+(yb-h*1.3)+' '+(cx+w/2)+','+yb;
      for(var k=0;k<n;k++){var x1=cx+w/2-(k+1)*sw;dd+=' Q'+(x1+sw/2).toFixed(1)+','+(yb+h*.2).toFixed(1)+' '+x1.toFixed(1)+','+yb}
      var s='<path d="'+dd+' Z" fill="url(#dfCap)" stroke="#14101f" stroke-width="1.2"/>';
      s+='<path d="M'+(cx-w*.42)+','+(yb-h*.12)+' Q'+(cx-w*.05)+','+(yb-h*1.05)+' '+(cx+w*.3)+','+(yb-h*.7)+'" stroke="#f5c2d9" stroke-opacity=".28" stroke-width="2" fill="none" stroke-linecap="round"/>';
      var nd=Math.round(w/5);
      for(k=0;k<nd;k++){var a=rnd(),fx=(rnd()-.5)*.8,px=cx+fx*w,maxy=h*1.0*Math.pow(1-Math.abs(fx)*1.9,.6)*.8,py=yb-4-rnd()*maxy;
        if(maxy<4)continue;var cls='df-dot'+(a<.33?'':a<.66?' df-d2':' df-d3');
        s+='<circle class="'+cls+'" cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="'+(w>100?4.5:3.2)+'" fill="url(#dfGlowP)"/><circle class="'+cls+'" cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="'+(w>100?1.5:1.1)+'" fill="#fff2f8"/>'}
      return s;
    }
    function win(x,y,kind,wd){
      var g=kind==='r'?'dfGlowR':'dfGlowA',f=kind==='r'?'#d6b4ee':'#f5c2d9',c=(rnd()<.5?'df-win':'df-win w2'),hw=wd/2;
      return '<g class="'+c+'"><circle cx="'+x+'" cy="'+(y+wd*.9)+'" r="'+(wd*3.4)+'" fill="url(#'+g+')"/><path d="M'+(x-hw)+','+(y+wd*2)+' V'+(y+hw)+' A'+hw+','+hw+' 0 0 1 '+(x+hw)+','+(y+hw)+' V'+(y+wd*2)+' Z" fill="'+f+'"/><path d="M'+x+','+(y)+' V'+(y+wd*2)+' M'+(x-hw)+','+(y+wd*1.1)+' H'+(x+hw)+'" stroke="#201a32" stroke-width="1.2"/></g>';
    }
    function tower(cx,top,bw,cw,ch,wins){
      var s='',bx=cx-bw/2,h=Y0-top;
      s+='<rect x="'+(bx-3)+'" y="'+(Y0-10)+'" width="'+(bw+6)+'" height="14" fill="url(#dfBody)" stroke="#000" stroke-opacity=".6"/>';
      s+='<rect x="'+bx+'" y="'+top+'" width="'+bw+'" height="'+h+'" fill="url(#dfBody)"/><rect x="'+bx+'" y="'+top+'" width="'+bw+'" height="'+h+'" fill="url(#dfBrick)"/>';
      s+='<rect x="'+bx+'" y="'+top+'" width="2" height="'+h+'" fill="#f5c2d9" fill-opacity=".3"/><rect x="'+bx+'" y="'+top+'" width="'+bw+'" height="'+h+'" fill="none" stroke="#000" stroke-opacity=".55"/>';
      s+='<rect x="'+(bx-4)+'" y="'+top+'" width="'+(bw+8)+'" height="6" fill="#201a32" stroke="#000" stroke-opacity=".6"/>';
      s+=cap(cx,top,cw,ch);
      for(var k=0;k<wins.length;k++)s+=win(cx+wins[k][0],wins[k][1],wins[k][2],wins[k][3]);
      return s;
    }
    o+=tower(206,206,26,52,26,[[0,218,'a',6]]);
    o+=tower(262,222,20,40,21,[[0,229,'r',5]]);
    /* torre principal con estandarte */
    o+=tower(392,104,76,142,64,[[0,134,'a',8],[0,176,'r',8],[-16,214,'a',6],[16,214,'a',6]]);
    o+='<g class="df-banner"><path d="M350,114 h16 v60 l-8,-10 l-8,10 z" fill="#896991" stroke="#201a32"/><path d="M358,126 l0,26" stroke="#f5c2d9" stroke-opacity=".8" stroke-width="2"/></g>';
    /* torre gigante cortada por el borde */
    o+=tower(492,64,92,176,80,[[-10,98,'a',9],[14,150,'r',8],[-6,206,'a',7]]);
    /* portón con arco entre las torres grandes */
    o+='<rect x="432" y="196" width="22" height="52" fill="#14101f" stroke="#000"/><path d="M434,246 V222 A9,9 0 0 1 452,222 V246 Z" fill="#201a32"/><circle cx="443" cy="228" r="20" fill="url(#dfGlowA)" class="df-glow"/><path d="M436,246 V224 A7,7 0 0 1 450,224 V246 Z" fill="#f5c2d9" fill-opacity=".9"/>';
    /* braseros */
    o+='<ellipse cx="318" cy="236" rx="40" ry="26" fill="url(#dfGlowA)" class="df-glow"/><rect x="313" y="232" width="10" height="14" fill="#1a1328" stroke="#000"/><path class="df-flame" d="M318,232 q-7,-8 -2,-18 q2,6 5,2 q6,8 -3,16 z" fill="#e5a4c7"/><path class="df-flame f2" d="M318,231 q-3,-5 0,-11 q4,5 0,11 z" fill="#fff2f8"/>';
    o+='<ellipse cx="176" cy="236" rx="30" ry="20" fill="url(#dfGlowR)" class="df-glow"/><path class="df-flame f2" d="M176,234 q-5,-6 -1,-14 q2,5 4,1 q5,6 -3,13 z" fill="#c9a0e0"/>';
    /* cuervo posado */
    o+='<path d="M296,232 q4,-9 12,-8 l5,-2 l-3,5 q-2,6 -8,7 z" fill="#0d0a18"/>';
    return '<svg class="df-cliff" viewBox="0 0 520 640" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">'+o+'</svg>';
  }
  function darkfantasyScene(sc){
    var sky=document.createElement('canvas'),fx=document.createElement('canvas');
    sky.className='df-sky';fx.className='df-fx';
    sc.appendChild(sky);
    sc.insertAdjacentHTML('beforeend','<div class="df-fog"></div>'+dfCliffSVG()+'<div class="df-fog df-fog2"></div><div class="df-birds"></div><div class="df-veil"></div><div class="df-vig"></div>');
    sc.insertBefore(fx,sc.querySelector('.df-fog'));
    var birds=sc.querySelector('.df-birds');
    if(!reduced()&&!lowPerf()){
      for(var b=0;b<4;b++){var el=document.createElement('div');el.className='df-bird';
        el.style.top=(8+Math.random()*60)+'%';el.style.animationDuration=(38+Math.random()*40)+'s';el.style.animationDelay=(-Math.random()*50)+'s';el.style.scale=(.7+Math.random()*.8);
        el.innerHTML='<svg viewBox="0 0 22 10"><path d="M0,3 Q5,0 11,8 Q17,0 22,3 Q16,3 11,10 Q6,3 0,3 Z" fill="#0d0a18"/></svg>';birds.appendChild(el)}
    }
    var cliff=sc.querySelector('.df-cliff'),fog=sc.querySelector('.df-fog'),W=0,H=0,stars=[],embers=[],shoot=null,nextShoot=0,last=0,mx=0,my=0,tx=0,ty=0,rnd=dfRng(4242),fctx=null;
    function size(){
      W=sky.width=fx.width=Math.max(320,window.innerWidth);H=sky.height=fx.height=Math.max(320,window.innerHeight);
      dfPaintSky(sky);fctx=fx.getContext('2d');
      /* estrellas titilantes: las más brillantes de la banda */
      stars=[];var n=Math.round(Math.min(46,W*H/26000)),r=dfRng(99);
      for(var i=0;i<n;i++){var u=r(),ax=-.05*W,ay=.72*H,dx=1.1*W,dy=-.7*H,gs=(r()-.5)*H*.3;
        var X=ax+dx*u+(-dy)/Math.sqrt(dx*dx+dy*dy)*gs,Y=ay+dy*u+dx/Math.sqrt(dx*dx+dy*dy)*gs;
        if(r()<.35){X=r()*W;Y=r()*H*.6}
        if(X<0||X>W||Y<0||Y>H*.8)continue;
        stars.push({x:X,y:Y,r:1.3+r()*2.0+(r()<.12?1.2:0),ph:r()*6.28,sp:.5+r()*1.8,c:['#ffffff','#f5c2d9','#e5a4c7','#e3d6f2'][(r()*4)|0]});
      }
      if(reduced())frame(0,true);
    }
    function spawnEmber(init){
      var e={x:W*(.5+rnd()*.5),y:H*(init?.55+rnd()*.45:1.02),vx:(rnd()-.35)*.18,vy:-(.18+rnd()*.5),s:.7+rnd()*1.7,life:0,max:7+rnd()*9,ph:rnd()*6.28,hot:rnd()};
      if(init)e.life=rnd()*e.max;return e;
    }
    var NE=lowPerf()?14:34;
    for(var q=0;q<NE;q++)embers.push(spawnEmber(true));
    function star4(x,y,r,a,col){
      fctx.globalAlpha=a*.3;fctx.fillStyle=col;fctx.beginPath();fctx.arc(x,y,r*1.9,0,6.2832);fctx.fill();
      fctx.globalAlpha=a;fctx.strokeStyle=col;fctx.lineWidth=1;
      if(r>2.9){fctx.beginPath();fctx.moveTo(x-r*1.7,y);fctx.lineTo(x+r*1.7,y);fctx.moveTo(x,y-r*1.7);fctx.lineTo(x,y+r*1.7);fctx.stroke()}
      fctx.fillStyle=col;fctx.beginPath();fctx.arc(x,y,r*.4,0,6.2832);fctx.fill();
    }
    function frame(t,still){
      if(!still)dfx.raf=requestAnimationFrame(frame);
      if(!still&&t-last<(lowPerf()?80:40))return;
      var dt=Math.min(.1,(t-last)/1000||.04);last=t;
      fctx.clearRect(0,0,W,H);
      var s=t/1000,i;
      for(i=0;i<stars.length;i++){var st=stars[i];star4(st.x,st.y,st.r,still?.7:.25+.75*(.5+.5*Math.sin(s*st.sp+st.ph)),st.c)}
      fctx.globalAlpha=1;
      if(still)return;
      /* brasas que suben del acantilado */
      for(i=0;i<embers.length;i++){var e=embers[i];e.life+=dt;e.x+=(e.vx+Math.sin(s*.8+e.ph)*.15)*dt*60;e.y+=e.vy*dt*60;
        if(e.life>e.max||e.y<-10){embers[i]=spawnEmber(false);continue}
        var f=e.life/e.max,a=Math.min(1,f*6)*(1-f)*(.6+.4*Math.sin(s*7+e.ph));
        fctx.globalAlpha=a*.22;fctx.fillStyle=e.hot>.5?'#e5a4c7':'#c9a0e0';fctx.beginPath();fctx.arc(e.x,e.y,e.s*3.2,0,6.2832);fctx.fill();
        fctx.globalAlpha=a;fctx.fillStyle=e.hot>.5?'#f5c2d9':'#fff2f8';fctx.beginPath();fctx.arc(e.x,e.y,e.s*.9,0,6.2832);fctx.fill();
      }
      /* estrella fugaz ocasional */
      if(!shoot&&s>nextShoot){var sx=W*(.1+rnd()*.6),sy=H*(.04+rnd()*.25);shoot={x:sx,y:sy,vx:9+rnd()*6,vy:3+rnd()*3,l:0};nextShoot=s+14+rnd()*22}
      if(shoot){shoot.x+=shoot.vx;shoot.y+=shoot.vy;shoot.l+=1;var sa=Math.max(0,1-shoot.l/38);
        var gr=fctx.createLinearGradient(shoot.x,shoot.y,shoot.x-shoot.vx*9,shoot.y-shoot.vy*9);gr.addColorStop(0,'rgba(245,194,217,'+sa+')');gr.addColorStop(1,'rgba(137,105,145,0)');
        fctx.globalAlpha=1;fctx.strokeStyle=gr;fctx.lineWidth=1.6;fctx.beginPath();fctx.moveTo(shoot.x,shoot.y);fctx.lineTo(shoot.x-shoot.vx*9,shoot.y-shoot.vy*9);fctx.stroke();
        if(sa<=0||shoot.x>W+50||shoot.y>H)shoot=null}
      fctx.globalAlpha=1;
      /* parallax suave con el mouse */
      mx+=(tx-mx)*.06;my+=(ty-my)*.06;
      if(cliff)cliff.style.translate=(-mx*14).toFixed(1)+'px '+(-my*7).toFixed(1)+'px';
      if(fog)fog.style.translate=(mx*10).toFixed(1)+'px 0';
    }
    size();
    dfx.onResize=function(){clearTimeout(dfx.rt);dfx.rt=setTimeout(size,160)};window.addEventListener('resize',dfx.onResize);
    if(!reduced()){
      dfx.onMove=function(e){tx=(e.clientX/window.innerWidth-.5)*2;ty=(e.clientY/window.innerHeight-.5)*2};
      if(!lowPerf()&&window.matchMedia&&matchMedia('(hover:hover)').matches)window.addEventListener('pointermove',dfx.onMove,{passive:true});
      nextShoot=6+rnd()*8;dfx.raf=requestAnimationFrame(frame);
    }
  }
  function darkfantasyStop(){
    cancelAnimationFrame(dfx.raf);dfx.raf=0;clearTimeout(dfx.rt);
    if(dfx.onResize)window.removeEventListener('resize',dfx.onResize);if(dfx.onMove)window.removeEventListener('pointermove',dfx.onMove);
    dfx.onResize=dfx.onMove=null;
  }
  makeMode({
    id:'darkfantasy',cls:'darkfantasy',word:'darkfantasy',name:'Dark Fantasy',onMsg:'☩ Las sombras te reciben, viajero…',
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M7 7h10"/><path d="M5 22h14"/></svg>',
    scene:darkfantasyScene,sceneStop:darkfantasyStop,
    music:{src:'assets/darkfantasy-music.mp3',vol:.22,fade:3,intro:3},
    sound:function(){beep([110,82,55],'sawtooth',.28,.06)} /* campanada grave */
  });
})();
