/* a11y.js — foco, teclado y ARIA de los menús.
   No toca la simulación ni el input del combate: solo actúa cuando hay una pantalla de menú abierta.
   Se engancha al atributo body[data-screen] que ya mantiene show() en main.js. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const body = document.body;
  const FIELD = /^(INPUT|SELECT|TEXTAREA)$/;
  let uid = 0; const nid = p => p + (++uid);

  const shown = el => !!(el && !el.hidden && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  function focusables(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll('button,a[href],input,select,textarea,[tabindex]'))
      .filter(el => !el.disabled && el.tabIndex >= -1 && el.getAttribute('tabindex') !== '-1' && shown(el));
  }
  /* para el recorrido con Tab/flechas: cada tab cuenta (aunque tenga tabindex -1 por el roving) */
  function reachable(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll('button,a[href],input,select,textarea'))
      .filter(el => !el.disabled && shown(el));
  }
  const screenEl = () => { const id = body.dataset.screen; return id ? $(id) : null; };
  const scope = sec => { const l = reachable(sec); if (sec && sec.id === 'menu') return reachable($('top')).concat(l); return l; };

  /* ---------- 1. ARIA estático y dinámico ---------- */
  const TITLES = { menu: 'Menú principal', climb: 'Próximo combate' };
  function setupScreens() {
    document.querySelectorAll('section.screen').forEach(sec => {
      const h = sec.querySelector('h2,h1'); if (h && !h.id) h.id = 'h-' + sec.id;
      if (sec.id === 'menu') { sec.setAttribute('role', 'region'); sec.setAttribute('aria-label', TITLES.menu); return; }
      sec.setAttribute('role', 'dialog'); sec.setAttribute('aria-modal', 'true');
      if (h) sec.setAttribute('aria-labelledby', h.id); else sec.setAttribute('aria-label', TITLES[sec.id] || sec.id);
    });
    const st = $('olSt'); if (st) st.setAttribute('aria-live', 'polite');
    const ch = $('olChat'); if (ch) { ch.setAttribute('role', 'log'); ch.setAttribute('aria-live', 'polite'); }
    const say = $('olSay'); if (say) say.setAttribute('aria-label', 'Mensaje para la sala');
    const cv = $('c'); if (cv) { cv.setAttribute('role', 'img'); }
    $('rot') && $('rot').setAttribute('aria-live', 'assertive');
  }
  function labelFields(root) {
    // cada .lbl pasa a ser la etiqueta del control que tiene debajo (seg, input, select)
    root.querySelectorAll('.lbl').forEach(l => {
      if (!l.id) l.id = nid('lbl');
      const box = l.parentElement; if (!box) return;
      let n = l.nextElementSibling;
      // el control es el siguiente hermano directo, o el que está dentro del mismo bloque
      const ctl = n && (n.matches('.seg,input,select,.stages,.cpk') ? n : n.querySelector('input,select'));
      if (!ctl || ctl.getAttribute('aria-labelledby') || ctl.getAttribute('aria-label')) return;
      if (ctl.matches('.seg,.stages,.cpk')) ctl.setAttribute('role', 'group');
      ctl.setAttribute('aria-labelledby', l.id);
    });
    root.querySelectorAll('.seg').forEach(s => { if (!s.hasAttribute('role')) s.setAttribute('role', 'group'); });
  }
  function setupRanges() {
    [['oMus', 'vM'], ['oSfx', 'vS']].forEach(([i, v]) => {
      const r = $(i); if (!r) return;
      const u = () => r.setAttribute('aria-valuetext', r.value + ' por ciento'); u(); r.addEventListener('input', u);
    });
  }
  function decorate(root) {
    (root.querySelectorAll ? root.querySelectorAll('.px') : []).forEach(e => e.setAttribute('aria-hidden', 'true'));
    if (root.classList && root.classList.contains('px')) root.setAttribute('aria-hidden', 'true');
  }

  /* ---------- 2. pestañas (tablist) ---------- */
  function setupTabs() {
    document.querySelectorAll('section.screen .tabs').forEach(tl => {
      const card = tl.closest('.card'), sec = tl.closest('section');
      const h = card.querySelector('h2'); if (h) tl.setAttribute('aria-labelledby', h.id || (h.id = nid('h')));
      tl.setAttribute('aria-orientation', 'horizontal');
      tl.querySelectorAll('.tab').forEach(t => {
        const pane = card.querySelector('.pane[data-pane="' + t.dataset.tab + '"]');
        t.id = t.id || (sec.id + '-tab-' + t.dataset.tab);
        if (pane) { pane.id = pane.id || (sec.id + '-pane-' + t.dataset.tab); pane.setAttribute('role', 'tabpanel'); pane.setAttribute('aria-labelledby', t.id); t.setAttribute('aria-controls', pane.id); }
      });
      syncTabs(card);
    });
  }
  function syncTabs(card) {
    if (!card) return;
    card.querySelectorAll('.tab').forEach(t => { const on = t.classList.contains('on'); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
  }
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.tab'); if (t) setTimeout(() => syncTabs(t.closest('.card')), 0); });

  /* ---------- 3. mute con estado ---------- */
  function syncMute() {
    const b = $('bMute'), k = window.__k; if (!b || !k) return;
    const m = !!k.cfg.muted; b.setAttribute('aria-pressed', m ? 'true' : 'false'); b.setAttribute('aria-label', m ? 'Sonido desactivado' : 'Sonido activado');
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#bMute')) setTimeout(syncMute, 0); });

  /* ---------- 4. foco al cambiar de pantalla ---------- */
  const lastFocus = {};
  document.addEventListener('focusin', e => { const s = e.target.closest && e.target.closest('section.screen'); if (s) lastFocus[s.id] = e.target; });
  const PREFER = { menu: '.tile:not([hidden])', opts: '.tab.on', ctrls: '.tab.on', pause: '#pRes', result: '#rAgain', climb: '#cGo', first: '#fTut', tower: '.tcol', arcTop: '[data-go=menu]', online: '#olNick' };
  function focusScreen(id) {
    const sec = $(id); if (!sec || sec.hidden) return;
    let t = lastFocus[id];
    if (!(t && sec.contains(t) && shown(t))) { t = PREFER[id] && sec.querySelector(PREFER[id]); if (!(t && shown(t))) t = reachable(sec)[0]; }
    if (t && t.focus) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  }
  let lastScreen = '';
  new MutationObserver(() => {
    const id = body.dataset.screen || ''; if (id === lastScreen) return; lastScreen = id;
    if (id) { requestAnimationFrame(() => { if ((body.dataset.screen || '') === id) { focusScreen(id); syncTabs($(id) && $(id).querySelector('.card')); syncMute(); } }); }
    else { const a = document.activeElement; if (a && a !== body && a.closest && a.closest('#app')) a.blur(); }
  }).observe(body, { attributes: true, attributeFilter: ['data-screen'] });

  /* ---------- 5. teclado: trampa de foco, flechas, pestañas, Escape ---------- */
  function dirNext(cur, list, key) {
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let best = null, bs = 1e9;
    for (const el of list) {
      if (el === cur || FIELD.test(el.tagName)) continue;
      const q = el.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, dx = x - cx, dy = y - cy; let s;
      if (key === 'ArrowRight' && dx > 4) s = dx + 2.5 * Math.abs(dy);
      else if (key === 'ArrowLeft' && dx < -4) s = -dx + 2.5 * Math.abs(dy);
      else if (key === 'ArrowDown' && dy > 4) s = dy + 2.5 * Math.abs(dx);
      else if (key === 'ArrowUp' && dy < -4) s = -dy + 2.5 * Math.abs(dx);
      else continue;
      if (s < bs) { bs = s; best = el; }
    }
    return best;
  }
  document.addEventListener('keydown', e => {
    const sec = screenEl(); if (!sec || e.ctrlKey || e.metaKey || e.altKey) return;
    const id = sec.id, t = e.target, field = t && FIELD.test(t.tagName);

    // Tab queda dentro de la pantalla abierta (el menú principal también incluye la barra superior)
    if (e.key === 'Tab') {
      const l = scope(sec); if (!l.length) return;
      if (!sec.contains(document.activeElement) && !(id === 'menu' && $('top').contains(document.activeElement))) { e.preventDefault(); l[e.shiftKey ? l.length - 1 : 0].focus(); return; }
      // las pestañas son un solo punto de Tab (roving): el recorrido lo hace el navegador salvo en los bordes
      const f = focusables(sec.id === 'menu' ? body : sec).filter(x => sec.contains(x) || (id === 'menu' && $('top').contains(x)));
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); } else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      return;
    }

    // pestañas: ← → Inicio Fin
    if (t && t.classList && t.classList.contains('tab')) {
      const tabs = Array.from(t.parentElement.querySelectorAll('.tab')).filter(shown); let i = tabs.indexOf(t), n = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length; else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1;
      if (n >= 0) { e.preventDefault(); e.stopPropagation(); tabs[n].focus(); tabs[n].click(); return; }
    }

    // flechas: moverse entre botones por posición (menú en cuadrícula, selectores, listas)
    if (!field && id !== 'climb' && /^Arrow(Left|Right|Up|Down)$/.test(e.key) && t && t.closest && t.closest('button,a')) {
      const n = dirNext(t, scope(sec), e.key);
      if (n) { e.preventDefault(); e.stopPropagation(); n.focus(); }
      return;
    }

    // Escape: volver en las pantallas que main.js no cubre
    if (e.key === 'Escape' && !field) {
      let b = null;
      if (id === 'tower' || id === 'arcTop' || id === 'first') b = sec.querySelector('[data-go=menu]');
      else if (id === 'online' && (!$('olA').hidden || !$('olL').hidden)) b = $('olBack');
      if (b) { e.preventDefault(); e.stopPropagation(); b.click(); }
    }
  }, true);

  document.addEventListener('keyup', e => { if (e.code === 'KeyM') setTimeout(syncMute, 0); });

  /* ---------- 6. dinámicos (torre, salas, estadísticas…) ---------- */
  new MutationObserver(muts => {
    for (const m of muts) m.addedNodes.forEach(n => { if (n.nodeType === 1) decorate(n); });
  }).observe($('app'), { childList: true, subtree: true });

  function init() { setupScreens(); labelFields(document); setupRanges(); setupTabs(); decorate(document); syncMute(); }
  init();
  // los .lbl de los pickers de color se crean al armar las opciones
  setTimeout(() => { labelFields(document); decorate(document); syncMute(); }, 600);
})();
