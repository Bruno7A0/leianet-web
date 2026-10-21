/* Opciones de lanzamiento de Steam (Linux) — JS puro, sin dependencias.
   Uso: <div id="lo-app"></div> + este script. Se inicia solo.

   No consulta ninguna API: arma el texto en el navegador a partir de lo que tildás.
   Todo texto se inserta con textContent (nunca innerHTML). El estado se guarda en
   localStorage (si está disponible) para que no pierdas la configuración al recargar. */
(function () {
  'use strict';

  const root = document.getElementById('lo-app');
  if (!root) return;
  root.classList.add('lo-app');

  /* ---------- 1. Catálogo de opciones ---------- */
  // pos: 'outer' (antes de gamescope, ej. gamemoderun) | 'inner' (después, ej. mangohud)
  // only: 'proton' | 'nativo' (si falta, sirve para ambos)
  const GRUPOS = [
    { id: 'rend', t: 'Rendimiento', s: 'Ajustes que suelen sumar FPS o estabilidad.' },
    { id: 'ov', t: 'Overlay y monitoreo', s: 'Para ver FPS, frametimes y uso de la GPU mientras jugás.' },
    { id: 'proton', t: 'Proton / Wine', s: 'Solo aplican a juegos de Windows corriendo con Proton.' },
    { id: 'gpu', t: 'GPU', s: 'Elegir qué placa usa el juego y ajustes del driver.' },
    { id: 'compat', t: 'Compatibilidad y arreglos', s: 'Para cuando algo no arranca o se cierra solo.' },
    { id: 'args', t: 'Argumentos del juego', s: 'Van después de %command% y los lee el propio juego (no todos los juegos los entienden).' },
  ];

  const OPCIONES = [
    { id: 'gamemode', g: 'rend', t: 'GameMode (gamemoderun)', pos: 'outer', wrap: 'gamemoderun',
      d: 'Pide al sistema que pase a modo juego (CPU en «performance» y algunas prioridades). Requiere instalar el paquete gamemode.' },
    { id: 'shaders', g: 'rend', t: 'Caché de shaders más grande', env: ['MESA_SHADER_CACHE_MAX_SIZE=10G', '__GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1'],
      d: 'Evita que el driver borre shaders ya compilados: menos tirones al volver a jugar. Mesa (AMD/Intel) usa el límite de 10 GB; Nvidia, el que no limpia la caché.' },
    { id: 'glthread', g: 'rend', t: 'Hilo extra de OpenGL (Mesa)', env: ['mesa_glthread=true'],
      d: 'Reparte parte del trabajo de OpenGL en otro hilo. Ayuda en juegos nativos con OpenGL y con WineD3D en AMD/Intel; con DXVK (Vulkan) no hace nada.' },
    { id: 'novsync', g: 'rend', t: 'Desactivar VSync de OpenGL', env: ['vblank_mode=0', '__GL_SYNC_TO_VBLANK=0'],
      d: 'Quita la sincronización vertical forzada del driver (Mesa y Nvidia). Puede aparecer tearing; no afecta a juegos Vulkan.' },
    { id: 'fpscap', g: 'rend', t: 'Limitar FPS (DXVK)', only: 'proton', env: ['DXVK_FRAME_RATE={v}'],
      val: { type: 'num', def: 60, min: 10, max: 1000, unit: 'FPS' },
      d: 'Tope de FPS para juegos que usan DXVK (DirectX 9, 10 y 11). Menos calor y consumo; útil en notebooks.' },
    { id: 'noesync', g: 'rend', t: 'Desactivar Esync y Fsync', only: 'proton', env: ['PROTON_NO_ESYNC=1', 'PROTON_NO_FSYNC=1'], warn: 'Solo si hay cierres raros',
      d: 'Apaga los mecanismos de sincronización rápida de Proton. Normalmente empeoran el rendimiento al desactivarlos; usalo solo para descartar que sean la causa de un crash.' },

    { id: 'mangohud', g: 'ov', t: 'MangoHud', pos: 'inner', wrap: 'mangohud',
      d: 'Overlay con FPS, frametimes, temperaturas y uso de CPU/GPU. Requiere el paquete mangohud. Se configura en ~/.config/MangoHud/MangoHud.conf.' },
    { id: 'dxvkhud', g: 'ov', t: 'HUD de DXVK', only: 'proton', env: ['DXVK_HUD={v}'],
      val: { type: 'sel', def: 'fps', opts: [['fps', 'Solo FPS'], ['fps,frametimes', 'FPS + frametimes'], ['fps,frametimes,gpuload,memory', 'FPS, frametimes, GPU y memoria'], ['full', 'Todo']] },
      d: 'HUD propio de DXVK, sin instalar nada. Alternativa liviana a MangoHud para juegos DirectX 9/10/11.' },
    { id: 'vkbasalt', g: 'ov', t: 'vkBasalt (filtros post-proceso)', env: ['ENABLE_VKBASALT=1'],
      d: 'Activa vkBasalt: nitidez (CAS), SMAA, LUTs. Requiere el paquete vkbasalt y su configuración.' },

    { id: 'wined3d', g: 'proton', t: 'Usar WineD3D (OpenGL) en vez de DXVK', only: 'proton', env: ['PROTON_USE_WINED3D=1'],
      d: 'Traduce DirectX a OpenGL en lugar de Vulkan. Sirve para GPUs viejas sin Vulkan o juegos antiguos que fallan con DXVK. Suele rendir menos.' },
    { id: 'nvapi', g: 'proton', t: 'Habilitar NVAPI (DLSS)', only: 'proton', env: ['PROTON_ENABLE_NVAPI=1'],
      d: 'Expone NVAPI al juego: necesario para DLSS en muchos títulos con GPU Nvidia. Si ya te aparece DLSS en el juego, no hace falta.' },
    { id: 'dxr', g: 'proton', t: 'Ray tracing en DirectX 12 (DXR)', only: 'proton', env: ['VKD3D_CONFIG=dxr'],
      d: 'Habilita DXR en vkd3d-proton. Necesita una GPU y un driver con ray tracing por Vulkan. No combina con WineD3D.' },
    { id: 'wayland', g: 'proton', t: 'Ventana Wayland nativa', only: 'proton', env: ['PROTON_ENABLE_WAYLAND=1'], warn: 'Experimental',
      d: 'Corre el juego como cliente Wayland (sin XWayland). Requiere sesión Wayland y una versión reciente de Proton; puede traer problemas con el overlay o el mouse.' },
    { id: 'laa', g: 'proton', t: 'Forzar Large Address Aware', only: 'proton', env: ['PROTON_FORCE_LARGE_ADDRESS_AWARE=1'],
      d: 'Permite a juegos de 32 bits usar más de 2 GB de RAM. Soluciona cierres por falta de memoria en juegos viejos con mods.' },
    { id: 'winedebug', g: 'proton', t: 'Silenciar logs de Wine', only: 'proton', env: ['WINEDEBUG=-all'],
      d: 'Apaga los mensajes de depuración de Wine. Menos escritura en disco y consola más limpia.' },

    { id: 'nvthread', g: 'gpu', t: 'Optimizaciones con hilos (Nvidia)', env: ['__GL_THREADED_OPTIMIZATIONS=1'],
      d: 'Driver propietario de Nvidia: ejecuta parte del trabajo de OpenGL en un hilo aparte. Sirve en juegos OpenGL nativos.' },

    { id: 'steamdeck', g: 'compat', t: 'Fingir que es una Steam Deck', env: ['SteamDeck=1'],
      d: 'Algunos juegos cambian su interfaz, controles o se saltean el launcher si creen que corren en una Deck.' },
    { id: 'ldpreload', g: 'compat', t: 'Limpiar LD_PRELOAD', env: ['LD_PRELOAD=""'], warn: 'Desactiva el overlay de Steam',
      d: 'Quita las librerías que Steam inyecta al juego. Arregla algunos cierres al abrir, pero el overlay de Steam (Shift+Tab) deja de funcionar.' },
    { id: 'sdlx11', g: 'compat', t: 'Forzar SDL sobre X11', only: 'nativo', env: ['SDL_VIDEODRIVER=x11'],
      d: 'Para juegos nativos que usan SDL y fallan o se ven mal en Wayland: los obliga a usar XWayland.' },
    { id: 'protonlog', g: 'compat', t: 'Guardar log de Proton', only: 'proton', env: ['PROTON_LOG=1'],
      d: 'Escribe un log detallado en tu carpeta personal (steam-<AppID>.log). Es lo que te piden al reportar un problema en ProtonDB o en GitHub.' },

    { id: 'novid', g: 'args', t: '-novid', arg: '-novid', d: 'Se saltea los videos de intro (juegos Source y Source 2).' },
    { id: 'console', g: 'args', t: '-console', arg: '-console', d: 'Abre la consola del juego al iniciar (Source).' },
    { id: 'nojoy', g: 'args', t: '-nojoy', arg: '-nojoy', d: 'No carga el soporte de joystick (Source): arranca más rápido si usás solo teclado y mouse.' },
    { id: 'windowed', g: 'args', t: '-windowed -noborder', arg: '-windowed -noborder', d: 'Ventana sin bordes en lugar de pantalla completa exclusiva (Source). Útil para alt-tab y varios monitores.' },
    { id: 'forcevulkan', g: 'args', t: '-force-vulkan', arg: '-force-vulkan', d: 'Obliga a los juegos hechos con Unity a usar Vulkan en vez de OpenGL.' },
  ];
  const POR_ID = Object.fromEntries(OPCIONES.map(o => [o.id, o]));

  const GPU_OPTS = [
    ['auto', 'Automática (la que elija el sistema)'],
    ['dri', 'Dedicada AMD / Intel (DRI_PRIME=1)'],
    ['nvidia', 'Dedicada Nvidia (PRIME render offload)'],
  ];
  const GPU_ENV = {
    auto: [],
    dri: ['DRI_PRIME=1'],
    nvidia: ['__NV_PRIME_RENDER_OFFLOAD=1', '__GLX_VENDOR_LIBRARY_NAME=nvidia', '__VK_LAYER_NV_optimus=NVIDIA_only'],
  };

  const PRESETS = [
    { n: 'Equilibrado', on: ['gamemode', 'mangohud'] },
    { n: 'Rendimiento', on: ['gamemode', 'shaders', 'winedebug'] },
    { n: 'Nvidia + DLSS', on: ['gamemode', 'nvapi', 'nvthread', 'shaders'] },
    { n: 'Diagnóstico', on: ['mangohud', 'protonlog'] },
  ];

  /* ---------- 2. Estado ---------- */
  const STORE = 'lo-state-v1';
  const GS_DEF = { on: false, gw: 1280, gh: 720, ow: 1920, oh: 1080, fps: 0, fs: true, filter: 'none', scaler: 'auto' };
  function estadoInicial() {
    return { tipo: 'proton', on: {}, vals: {}, gpu: 'auto', gs: Object.assign({}, GS_DEF), cenv: '', carg: '' };
  }
  const num = (v, min, max, def) => { const n = Math.round(Number(v)); return isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const limpio = s => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim().slice(0, 300);

  function cargar() {
    const st = estadoInicial();
    try {
      const j = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!j || typeof j !== 'object') return st;
      if (j.tipo === 'nativo') st.tipo = 'nativo';
      if (j.on && typeof j.on === 'object') for (const k in j.on) if (POR_ID[k] && j.on[k] === true) st.on[k] = true;
      if (j.vals && typeof j.vals === 'object') for (const k in j.vals) {
        const o = POR_ID[k]; if (!o || !o.val) continue;
        if (o.val.type === 'num') st.vals[k] = num(j.vals[k], o.val.min, o.val.max, o.val.def);
        else if (o.val.opts.some(x => x[0] === j.vals[k])) st.vals[k] = j.vals[k];
      }
      if (GPU_ENV[j.gpu]) st.gpu = j.gpu;
      if (j.gs && typeof j.gs === 'object') {
        const g = st.gs;
        g.on = j.gs.on === true; g.fs = j.gs.fs !== false;
        g.gw = num(j.gs.gw, 0, 7680, GS_DEF.gw); g.gh = num(j.gs.gh, 0, 4320, GS_DEF.gh);
        g.ow = num(j.gs.ow, 0, 7680, GS_DEF.ow); g.oh = num(j.gs.oh, 0, 4320, GS_DEF.oh);
        g.fps = num(j.gs.fps, 0, 1000, 0);
        if (['none', 'fsr', 'nis', 'nearest', 'linear', 'pixel'].includes(j.gs.filter)) g.filter = j.gs.filter;
        if (['auto', 'integer', 'fit', 'fill', 'stretch'].includes(j.gs.scaler)) g.scaler = j.gs.scaler;
      }
      st.cenv = limpio(j.cenv); st.carg = limpio(j.carg);
    } catch (e) { /* sin storage o JSON roto: arranca de cero */ }
    return st;
  }
  let st = cargar();
  function guardar() { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) { /* ignorar */ } }

  /* ---------- 3. Armado del comando ---------- */
  const aplica = o => !o.only || o.only === st.tipo;
  const valorDe = o => (st.vals[o.id] != null ? st.vals[o.id] : o.val.def);

  function gamescopeArgs() {
    const g = st.gs, a = ['gamescope'];
    if (g.gw > 0 && g.gh > 0) a.push('-w', g.gw, '-h', g.gh);
    if (g.ow > 0 && g.oh > 0) a.push('-W', g.ow, '-H', g.oh);
    if (g.fps > 0) a.push('-r', g.fps);
    if (g.fs) a.push('-f');
    if (g.filter !== 'none') a.push('-F', g.filter);
    if (g.scaler !== 'auto') a.push('-S', g.scaler);
    a.push('--');
    return a.join(' ');
  }

  // Devuelve { texto, partes: [{ code, desc }] } para el comando y la explicación.
  function armar() {
    const envs = [], outer = [], inner = [], args = [], partes = [];
    const nota = (code, desc) => partes.push({ code, desc });

    if (st.cenv) { envs.push(st.cenv); nota(st.cenv, 'Variables propias que escribiste.'); }

    for (const o of OPCIONES) {
      if (!st.on[o.id] || !aplica(o)) continue;
      if (o.env) {
        const v = o.val ? valorDe(o) : '';
        const lista = o.env.map(e => e.replace('{v}', v));
        envs.push(...lista);
        nota(lista.join(' '), o.t);
      }
      if (o.wrap) { (o.pos === 'inner' ? inner : outer).push(o.wrap); nota(o.wrap, o.t); }
      if (o.arg) { args.push(o.arg); nota(o.arg, o.t); }
    }
    const gpu = GPU_ENV[st.gpu];
    if (gpu.length) { envs.push(...gpu); nota(gpu.join(' '), 'Usar la GPU dedicada'); }

    const mid = [];
    if (st.gs.on) { const gs = gamescopeArgs(); mid.push(gs); nota(gs, 'Gamescope: ventana, resolución y escalado'); }

    if (st.carg) { args.push(st.carg); nota(st.carg, 'Argumentos propios que escribiste.'); }

    const texto = [].concat(envs, outer, mid, inner, ['%command%'], args).join(' ');
    return { texto, partes };
  }

  function avisos() {
    const a = [];
    const on = id => st.on[id] && aplica(POR_ID[id]);
    if (on('wined3d') && on('dxr')) a.push('DXR necesita vkd3d-proton (DirectX 12): no funciona junto con WineD3D.');
    if (on('wined3d') && on('dxvkhud')) a.push('El HUD de DXVK no se muestra con WineD3D: usá MangoHud o quitá una de las dos.');
    if (on('dxvkhud') && on('mangohud')) a.push('Tener el HUD de DXVK y MangoHud a la vez duplica el overlay. Dejá solo uno.');
    if (on('ldpreload')) a.push('Con LD_PRELOAD limpio el overlay de Steam (Shift+Tab y capturas) no va a funcionar.');
    if (on('noesync')) a.push('Esync y Fsync suelen mejorar el rendimiento: dejalos apagados solo mientras buscás la causa de un problema.');
    if (st.gs.on && on('wayland')) a.push('Gamescope ya maneja su propia ventana; probá sin «Ventana Wayland nativa» si algo falla.');
    if (st.gs.on && st.gs.gw > 0 && st.gs.ow > 0 && st.gs.gw > st.gs.ow) a.push('La resolución del juego es mayor que la de salida: gamescope va a reducirla.');
    return a;
  }

  /* ---------- 4. Utilidades de DOM ---------- */
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  }
  let toastT = 0;
  const toast = el('div', { class: 'lo-toast', role: 'status', 'aria-live': 'polite' });
  function avisar(msg) {
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 1800);
  }
  async function copiar(texto, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(texto); ok = true; } catch (e) {
      const ta = el('textarea', { 'aria-hidden': 'true', tabindex: '-1' });
      ta.value = texto; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(ta); ta.focus({ preventScroll: true }); ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
    }
    if (btn) {
      if (!btn.dataset.txt) btn.dataset.txt = btn.textContent;
      btn.textContent = ok ? 'Copiado ✓' : 'No se pudo';
      btn.classList.toggle('is-ok', ok);
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.textContent = btn.dataset.txt; btn.classList.remove('is-ok'); }, 1500);
    }
    avisar(ok ? 'Copiado al portapapeles' : 'No se pudo copiar: seleccioná el texto a mano');
  }

  /* ---------- 5. Construcción de la interfaz ---------- */
  const refs = { checks: {}, rows: {}, extras: {}, inputs: {} };
  let outCode, outCount, warnBox, expl, copyBtn, tipoBtns = [], gsBox, gsToggle;

  function filaOpcion(o) {
    const cb = el('input', { type: 'checkbox', class: 'lo-check', id: 'lo-o-' + o.id });
    refs.checks[o.id] = cb;
    cb.addEventListener('change', () => { st.on[o.id] = cb.checked; refrescar(); });

    const label = el('label', { class: 'lo-opt__label', for: 'lo-o-' + o.id }, el('span', { text: o.t }));
    if (o.only === 'proton') label.append(el('span', { class: 'lo-tag', text: 'Proton' }));
    if (o.only === 'nativo') label.append(el('span', { class: 'lo-tag', text: 'Nativo' }));
    if (o.warn) label.append(el('span', { class: 'lo-tag lo-tag--warn', text: o.warn }));

    const li = el('li', { class: 'lo-opt' }, cb, label, el('p', { class: 'lo-opt__desc', text: o.d }));
    const code = o.env ? o.env.join(' ') : (o.wrap || o.arg || '');
    if (code && !o.val) li.append(el('div', { class: 'lo-opt__extra' }, el('span', { class: 'lo-opt__code', text: code })));

    if (o.val) {
      const box = el('div', { class: 'lo-opt__extra' });
      let inp;
      if (o.val.type === 'num') {
        inp = el('input', { type: 'number', class: 'lo-input lo-sm lo-num', min: o.val.min, max: o.val.max, step: 1, inputmode: 'numeric', 'aria-label': o.t });
        inp.addEventListener('input', () => { st.vals[o.id] = num(inp.value, o.val.min, o.val.max, o.val.def); refrescar(true); });
        inp.addEventListener('change', () => { inp.value = valorDe(o); });
        box.append(inp, el('span', { class: 'lo-opt__code', text: o.val.unit }));
      } else {
        inp = el('select', { class: 'lo-select lo-sm', 'aria-label': o.t });
        for (const [v, l] of o.val.opts) inp.append(el('option', { value: v, text: l }));
        inp.addEventListener('change', () => { st.vals[o.id] = inp.value; refrescar(); });
        box.append(inp);
      }
      refs.inputs[o.id] = inp;
      li.append(box);
    }
    refs.rows[o.id] = li;
    return li;
  }

  function panelGrupo(g) {
    const ul = el('ul', { class: 'lo-list' });
    for (const o of OPCIONES) if (o.g === g.id) ul.append(filaOpcion(o));
    const panel = el('section', { class: 'lo-group lo-panel', 'aria-labelledby': 'lo-g-' + g.id },
      el('h3', { class: 'lo-group__title', id: 'lo-g-' + g.id, text: g.t }),
      el('p', { class: 'lo-group__sub', text: g.s }), ul);

    if (g.id === 'gpu') {
      const sel = el('select', { class: 'lo-select lo-sm', id: 'lo-gpu', 'aria-label': 'GPU a usar' });
      for (const [v, l] of GPU_OPTS) sel.append(el('option', { value: v, text: l }));
      sel.addEventListener('change', () => { st.gpu = sel.value; refrescar(); });
      refs.gpu = sel;
      ul.prepend(el('li', { class: 'lo-opt' },
        el('span'), el('label', { class: 'lo-opt__label', for: 'lo-gpu', text: 'GPU a usar' }),
        el('p', { class: 'lo-opt__desc', text: 'Para notebooks con gráfica integrada y dedicada (híbridas). En una PC de escritorio con una sola GPU dejalo en automática.' }),
        el('div', { class: 'lo-opt__extra' }, sel)));
    }
    return panel;
  }

  function campoNum(clave, etiqueta, max) {
    const inp = el('input', { type: 'number', class: 'lo-input lo-sm', min: 0, max, step: 1, inputmode: 'numeric', 'aria-label': etiqueta });
    inp.addEventListener('input', () => { st.gs[clave] = num(inp.value, 0, max, 0); refrescar(true); });
    inp.addEventListener('change', () => { inp.value = st.gs[clave]; });
    refs.inputs['gs-' + clave] = inp;
    return inp;
  }

  function panelGamescope() {
    gsToggle = el('input', { type: 'checkbox', class: 'lo-check', id: 'lo-gs-on' });
    gsToggle.addEventListener('change', () => { st.gs.on = gsToggle.checked; refrescar(); });

    const fs = el('input', { type: 'checkbox', class: 'lo-check', id: 'lo-gs-fs' });
    fs.addEventListener('change', () => { st.gs.fs = fs.checked; refrescar(); });
    refs.inputs['gs-fs'] = fs;

    const filt = el('select', { class: 'lo-select lo-sm', 'aria-label': 'Filtro de escalado' });
    for (const [v, l] of [['none', 'Sin filtro'], ['fsr', 'AMD FSR'], ['nis', 'Nvidia NIS'], ['linear', 'Lineal'], ['nearest', 'Nearest'], ['pixel', 'Píxel perfecto']]) filt.append(el('option', { value: v, text: l }));
    filt.addEventListener('change', () => { st.gs.filter = filt.value; refrescar(); });
    refs.inputs['gs-filter'] = filt;

    const esc = el('select', { class: 'lo-select lo-sm', 'aria-label': 'Modo de escalado' });
    for (const [v, l] of [['auto', 'Automático'], ['integer', 'Entero'], ['fit', 'Ajustar'], ['fill', 'Rellenar'], ['stretch', 'Estirar']]) esc.append(el('option', { value: v, text: l }));
    esc.addEventListener('change', () => { st.gs.scaler = esc.value; refrescar(); });
    refs.inputs['gs-scaler'] = esc;

    const par = (a, b, sep) => el('div', { class: 'lo-res' }, a, el('span', { text: sep }), b);
    gsBox = el('div', { class: 'lo-gs' },
      el('div', { class: 'lo-field' }, el('span', { class: 'lo-label', text: 'Resolución del juego' }), par(campoNum('gw', 'Ancho del juego', 7680), campoNum('gh', 'Alto del juego', 4320), '×')),
      el('div', { class: 'lo-field' }, el('span', { class: 'lo-label', text: 'Resolución de salida' }), par(campoNum('ow', 'Ancho de salida', 7680), campoNum('oh', 'Alto de salida', 4320), '×')),
      el('div', { class: 'lo-field' }, el('span', { class: 'lo-label', text: 'Límite de FPS (0 = sin límite)' }), campoNum('fps', 'Límite de FPS', 1000)),
      el('div', { class: 'lo-field' }, el('span', { class: 'lo-label', text: 'Filtro' }), filt),
      el('div', { class: 'lo-field' }, el('span', { class: 'lo-label', text: 'Escalado' }), esc),
      el('div', { class: 'lo-field' }, el('span', { class: 'lo-label', text: 'Pantalla' }),
        el('label', { class: 'lo-opt__label', for: 'lo-gs-fs' }, fs, el('span', { text: 'Pantalla completa (-f)' }))));

    return el('section', { class: 'lo-group lo-panel', 'aria-labelledby': 'lo-g-gs' },
      el('h3', { class: 'lo-group__title', id: 'lo-g-gs', text: 'Gamescope' }),
      el('p', { class: 'lo-group__sub', text: 'Micro-compositor de Valve: renderizá a menor resolución y escalá con FSR, limitá FPS o forzá una ventana aislada. Requiere el paquete gamescope.' }),
      el('ul', { class: 'lo-list' },
        el('li', { class: 'lo-opt' }, gsToggle,
          el('label', { class: 'lo-opt__label', for: 'lo-gs-on' }, el('span', { text: 'Usar Gamescope' })),
          el('p', { class: 'lo-opt__desc', text: 'Envuelve al juego: gamescope … -- %command%. MangoHud, si lo activaste, queda adentro de gamescope.' }))),
      gsBox);
  }

  function panelPersonalizado() {
    const ce = el('input', { type: 'text', class: 'lo-input', id: 'lo-cenv', maxlength: 300, placeholder: 'MI_VARIABLE=1 OTRA=valor', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
    const ca = el('input', { type: 'text', class: 'lo-input', id: 'lo-carg', maxlength: 300, placeholder: '-fps_max 144 +connect ip:puerto', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
    ce.addEventListener('input', () => { st.cenv = limpio(ce.value); refrescar(true); });
    ca.addEventListener('input', () => { st.carg = limpio(ca.value); refrescar(true); });
    refs.inputs.cenv = ce; refs.inputs.carg = ca;
    return el('section', { class: 'lo-group lo-panel', 'aria-labelledby': 'lo-g-custom' },
      el('h3', { class: 'lo-group__title', id: 'lo-g-custom', text: 'Lo tuyo' }),
      el('p', { class: 'lo-group__sub', text: 'Agregá lo que no esté en la lista. Se respeta tal cual lo escribas.' }),
      el('div', { class: 'lo-gs', style: 'grid-template-columns:1fr;padding-bottom:16px' },
        el('div', { class: 'lo-field' }, el('label', { class: 'lo-label', for: 'lo-cenv', text: 'Variables de entorno (van antes)' }), ce),
        el('div', { class: 'lo-field' }, el('label', { class: 'lo-label', for: 'lo-carg', text: 'Argumentos del juego (van después de %command%)' }), ca)));
  }

  function construir() {
    // Tipo de juego
    for (const [v, l] of [['proton', 'Juego de Windows (Proton)'], ['nativo', 'Juego nativo de Linux']]) {
      const b = el('button', { type: 'button', class: 'lo-chip', 'aria-pressed': 'false', text: l });
      b.addEventListener('click', () => { st.tipo = v; refrescar(); });
      b.dataset.tipo = v; tipoBtns.push(b);
    }
    const presetBtns = PRESETS.map(p => {
      const b = el('button', { type: 'button', class: 'lo-chip', text: p.n });
      b.addEventListener('click', () => { st.on = {}; for (const id of p.on) st.on[id] = true; refrescar(); avisar('Preset «' + p.n + '» aplicado'); });
      return b;
    });
    const limpiar = el('button', { type: 'button', class: 'lo-chip', text: 'Limpiar todo' });
    limpiar.addEventListener('click', () => { st = estadoInicial(); refrescar(); avisar('Todo limpio'); });

    const head = el('div', { class: 'lo-head' },
      el('div', {}, el('h2', { class: 'lo-head__title', text: 'Armá tus opciones de lanzamiento' }),
        el('p', { class: 'lo-head__sub', text: 'Tildá lo que querés, copiá el resultado y pegalo en Steam. Todo pasa en tu navegador.' })),
      el('p', { class: 'lo-pill', id: 'lo-pill' }));

    const barra = el('div', { class: 'lo-toolbar' },
      el('div', { class: 'lo-field' }, el('span', { class: 'lo-label', text: 'Tipo de juego' }), el('div', { class: 'lo-chips', role: 'group', 'aria-label': 'Tipo de juego' }, ...tipoBtns)),
      el('div', { class: 'lo-field lo-field--grow' }, el('span', { class: 'lo-label', text: 'Presets' }), el('div', { class: 'lo-chips', role: 'group', 'aria-label': 'Presets' }, ...presetBtns, limpiar)));

    const main = el('div', { class: 'lo-main' });
    for (const g of GRUPOS) {
      main.append(panelGrupo(g));
      if (g.id === 'ov') main.append(panelGamescope());
    }
    main.append(panelPersonalizado());

    outCode = el('code', { id: 'lo-out-code' });
    copyBtn = el('button', { type: 'button', class: 'lo-copy', text: 'Copiar' });
    copyBtn.addEventListener('click', () => copiar(armar().texto, copyBtn));
    outCount = el('p', { class: 'lo-count' });
    warnBox = el('p', { class: 'lo-warnbox', hidden: true, role: 'status' });
    expl = el('ul', { class: 'lo-expl' });
    const copyBig = el('button', { type: 'button', class: 'lo-btn', text: 'Copiar al portapapeles' });
    copyBig.addEventListener('click', () => copiar(armar().texto, copyBig));

    const side = el('aside', { class: 'lo-side lo-panel', 'aria-label': 'Resultado' },
      el('h3', { class: 'lo-side__title', text: 'Tu línea de lanzamiento' }),
      el('div', { class: 'lo-code lo-out' }, outCode, copyBtn),
      outCount, el('div', { class: 'lo-actions' }, copyBig), warnBox,
      el('h3', { class: 'lo-side__title', style: 'font-size:14px', text: 'Qué hace cada parte' }), expl,
      el('h3', { class: 'lo-side__title', style: 'font-size:14px', text: 'Cómo ponerlo en Steam' }),
      el('ol', { class: 'lo-steps' },
        el('li', {}, 'En tu biblioteca, ', el('b', { text: 'clic derecho' }), ' sobre el juego → ', el('b', { text: 'Propiedades' }), '.'),
        el('li', {}, 'En ', el('b', { text: 'General' }), ' buscá ', el('b', { text: 'Opciones de lanzamiento' }), '.'),
        el('li', {}, 'Pegá el texto (reemplaza lo que hubiera) y cerrá la ventana.'),
        el('li', {}, 'Para el Proton: en ', el('b', { text: 'Compatibilidad' }), ' elegí la versión (ej. Proton Experimental o GE).')));

    root.append(head, barra, el('div', { class: 'lo-layout' }, main, side), toast);
  }

  /* ---------- 6. Refresco ---------- */
  function refrescar(soloTexto) {
    if (!soloTexto) {
      for (const b of tipoBtns) b.setAttribute('aria-pressed', String(b.dataset.tipo === st.tipo));
      for (const o of OPCIONES) {
        const ok = aplica(o), cb = refs.checks[o.id], row = refs.rows[o.id];
        cb.checked = !!st.on[o.id]; cb.disabled = !ok;
        row.dataset.off = ok ? '0' : '1';
        const inp = refs.inputs[o.id];
        if (inp) { inp.disabled = !ok || !cb.checked; if (document.activeElement !== inp) inp.value = valorDe(o); }
        row.title = ok ? '' : 'Esta opción no aplica al tipo de juego elegido';
      }
      refs.gpu.value = st.gpu;
      gsToggle.checked = st.gs.on;
      gsBox.hidden = !st.gs.on;
      for (const k of ['gw', 'gh', 'ow', 'oh', 'fps']) { const i = refs.inputs['gs-' + k]; if (document.activeElement !== i) i.value = st.gs[k]; }
      refs.inputs['gs-fs'].checked = st.gs.fs;
      refs.inputs['gs-filter'].value = st.gs.filter;
      refs.inputs['gs-scaler'].value = st.gs.scaler;
      if (document.activeElement !== refs.inputs.cenv) refs.inputs.cenv.value = st.cenv;
      if (document.activeElement !== refs.inputs.carg) refs.inputs.carg.value = st.carg;
    }

    const { texto, partes } = armar();
    outCode.textContent = texto;
    outCount.textContent = texto.length + ' caracteres';
    document.getElementById('lo-pill').replaceChildren(
      el('strong', { text: String(partes.length) }), partes.length === 1 ? ' ajuste activo' : ' ajustes activos');

    expl.replaceChildren();
    if (!partes.length) expl.append(el('li', { text: 'Todavía no elegiste nada: Steam solo necesita %command% (o dejalo en blanco).' }));
    for (const p of partes) expl.append(el('li', {}, el('code', { text: p.code }), ' — ' + p.desc));

    const av = avisos();
    warnBox.hidden = !av.length;
    warnBox.textContent = av.join(' ');
    guardar();
  }

  construir();
  refrescar();
})();
