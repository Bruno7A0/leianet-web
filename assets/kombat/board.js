/* LeiaKOMBAT · ranking (Top) del Arcade. Hoy guarda local; para activar el backend poné KBoard.cfg.url.
   CONTRATO DEL BACKEND (a implementar):
     GET  {url}/top?game=leiakombat-arcade&limit=10   ->  [{ name, score, level, ts }]  (ordenado por score desc)
     POST {url}/score   body JSON { game, name, score, level, ts, run:[puntaje por nivel] }  ->  200 { ok:true }
   El puntaje lo calcula el cliente, así que el servidor debería validarlo (recalcular con `run`, límites de
   plausibilidad, rate limit por IP, firma/token por partida). Los envíos que fallan quedan en cola y se reintentan. */
(function (root) {
'use strict';
const cfg = { url: '', game: 'leiakombat-arcade', max: 10, timeout: 6000 };
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const read = (k, d) => { try { return JSON.parse(LS.get(k)) || d; } catch (e) { return d; } };
const clean = n => String(n || 'LEIA').replace(/[<>&"']/g, '').slice(0, 16).toUpperCase() || 'LEIA';
const sortTop = a => a.sort((x, y) => y.score - x.score || x.ts - y.ts).slice(0, cfg.max);
function http(path, opt) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), cfg.timeout);
  return fetch(cfg.url.replace(/\/+$/, '') + path, Object.assign({ signal: c.signal }, opt)).then(r => { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }, e => { clearTimeout(t); throw e; });
}
function localTop() { return sortTop(read('kombat.top', [])); }
async function flush() {
  if (!cfg.url) return;
  let q = read('kombat.topq', []); if (!q.length) return;
  const left = [];
  for (const e of q) { try { await http('/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) }); } catch (_) { left.push(e); } }
  LS.set('kombat.topq', JSON.stringify(left));
}
/* guarda local siempre; si hay backend, lo manda (o lo deja en cola). Devuelve el puesto local (1 = récord). */
async function submit(name, score, level, run) {
  const e = { game: cfg.game, name: clean(name), score: score | 0, level: level | 0, ts: Date.now(), run: run || [] };
  const all = sortTop(localTop().concat([{ name: e.name, score: e.score, level: e.level, ts: e.ts }]));
  LS.set('kombat.top', JSON.stringify(all));
  const rank = all.findIndex(x => x.ts === e.ts) + 1;
  if (cfg.url) { LS.set('kombat.topq', JSON.stringify(read('kombat.topq', []).concat([e]).slice(-50))); flush(); }
  return rank;
}
/* devuelve { list, online } — del backend si responde, si no del local */
async function top() {
  if (cfg.url) { try { await flush(); const l = await http('/top?game=' + encodeURIComponent(cfg.game) + '&limit=' + cfg.max); if (Array.isArray(l)) return { list: l.slice(0, cfg.max), online: true }; } catch (_) {} }
  return { list: localTop(), online: false };
}
root.KBoard = { cfg, submit, top, localTop };
})(typeof window !== 'undefined' ? window : globalThis);
