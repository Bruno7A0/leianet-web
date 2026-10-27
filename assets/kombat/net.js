/* LeiaKOMBAT · base online (lockstep determinista)
   La simulación (sim.js) solo depende de opciones + inputs por tick. Online, los dos clientes arrancan con la MISMA
   semilla/opciones y se pasan sus inputs; cada tick solo avanza cuando están los inputs de los dos lados.
   transporte = { send(obj), onmsg }. WSTransport usa el relé (servers/kombat-server), BCTransport sirve para
   probar con 2 pestañas del mismo navegador sin servidor. */
(function (root) {
'use strict';

/* Lockstep con input delay adaptativo. Cada lado manda SUS inputs `delay` ticks hacia adelante (ventana de 4 ticks
   de redundancia). Si se queda sin los inputs del rival sube el delay; si pasa un rato sin trabas lo baja.
   Robustez ante red imperfecta:
   · RETRANSMISIÓN: si faltan inputs (mensaje descartado por el buffer, corte de conexión) pide con 'rs' que el rival
     los reenvíe desde el tick que necesita; el rival guarda su historial de inputs.
   · RESINCRONIZACIÓN: si los hashes difieren, el anfitrión (lado 0) manda una instantánea del estado ('snap') y el
     invitado la adopta y retoma desde ese tick (reconstruyendo los inputs del historial).
   · `idleMs`: cuánto hace que no avanza ningún tick (el cliente decide cuándo rendirse). */
const HIST = 600;
class Lockstep {
  constructor(tx, side, opts) {
    opts = opts || {};
    this.tx = tx; this.side = side;
    this.delay = opts.delay || 4; this.minD = 2; this.maxD = 16;
    this.tick = 0; this.sent = -1;
    this.q = [new Map(), new Map()]; this.ring = new Int32Array(64);
    this.mine = new Map(); this.theirs = new Map();
    this.own = new Map();                 // historial de MIS inputs enviados (para retransmitir)
    this.done = new Map();                // historial de pares [m0,m1] ya consumidos (para rebobinar en una resync)
    this.stall = 0; this.stalls = 0; this.lastBump = 0;
    const now = performance.now();
    this.calmSince = now; this.lastProgress = now; this.lastRs = 0; this.lastRx = now;
    this.desync = 0; this.resyncs = 0; this.rsReq = 0; this.on = true; this.maxR = -1; this.lastSnap = 0;
    this.onDesync = null; this.onResync = null; this.hashFn = null; this.snapFn = null; this.applyFn = null;
    for (let i = 0; i < this.delay; i++) { this.q[0].set(i, 0); this.q[1].set(i, 0); this.ring[i & 63] = 0; this.own.set(i, 0); }
    this.sent = this.delay - 1;
    tx.onmsg = m => this.recv(m);
  }
  get idleMs() { return performance.now() - this.lastProgress; }
  recv(m) {
    if (!m || typeof m !== 'object') return;
    this.lastRx = performance.now();
    if (m.t === 'in' && Array.isArray(m.v)) {
      const R = 1 - this.side, Q = this.q[R], n = m.n | 0;
      if (n - this.tick > 400) return;
      for (let i = 0; i < m.v.length && i < 6; i++) {
        const tk = n - i; if (tk < this.tick || Q.has(tk)) continue;
        Q.set(tk, m.v[i] | 0);
      }
      if (n > this.maxR) this.maxR = n;
    } else if (m.t === 'rs') {            // el rival se quedó sin mis inputs desde el tick n: se los reenvío
      const from = Math.max(m.n | 0, this.sent - 300, 0);
      for (let e = Math.min(this.sent, from + 5); ; e += 6) {
        e = Math.min(e, this.sent); const v = [];
        for (let i = 0; i < 6 && e - i >= from; i++) v.push(this.own.has(e - i) ? this.own.get(e - i) : 0);
        this.tx.send({ t: 'in', n: e, v });
        if (e >= this.sent) break;
      }
    } else if (m.t === 'sr') {            // el invitado pide una resincronización
      if (this.side === 0) this.sendSnap();
    } else if (m.t === 'snap') {
      if (this.side === 1 && typeof m.d === 'string' && Number.isInteger(m.n)) this.adopt(m.n, m.d);
    } else if (m.t === 'h') {
      const n = m.n | 0;
      if (this.mine.has(n)) {
        if (this.mine.get(n) !== m.v) this.flagDesync(n);
        this.mine.delete(n);
      } else this.theirs.set(n, m.v);
    }
  }
  flagDesync(n) {
    this.desync++; if (this.onDesync) this.onDesync(n);
    if (!this.snapFn) return;
    if (this.side === 0) this.sendSnap(); else this.tx.send({ t: 'sr', n: this.tick });
  }
  sendSnap() {
    const now = performance.now(); if (!this.snapFn || now - this.lastSnap < 1500) return; this.lastSnap = now;
    this.mine.clear(); this.theirs.clear();
    this.tx.send({ t: 'snap', n: this.tick, d: this.snapFn() });
  }
  adopt(n, d) {
    if (!this.applyFn) return;
    this.applyFn(d);
    for (const Q of this.q) for (const k of [...Q.keys()]) if (k < n) Q.delete(k);
    for (let tk = n; tk < this.tick; tk++) { const p = this.done.get(tk); if (p) { this.q[0].set(tk, p[0]); this.q[1].set(tk, p[1]); } }   // si el invitado iba adelantado, se rebobina
    this.tick = n; this.mine.clear(); this.theirs.clear(); this.resyncs++; this.stall = 0; this.lastProgress = performance.now();
    if (this.onResync) this.onResync(n);
  }
  /* devuelve [mask0, mask1] o null si falta el input del rival (esperar) */
  step(localMask) {
    const tg = this.tick + this.delay;
    while (this.sent < tg) {
      const n = ++this.sent;
      this.q[this.side].set(n, localMask | 0); this.ring[n & 63] = localMask | 0; this.own.set(n, localMask | 0); this.own.delete(n - HIST);
      const v = []; for (let i = 0; i < 4 && n - i >= 0; i++) v.push(this.ring[(n - i) & 63]);
      this.tx.send({ t: 'in', n, v });
    }
    const a = this.q[0].get(this.tick), b = this.q[1].get(this.tick);
    const now = performance.now();
    if (a === undefined || b === undefined) {
      this.stall++;
      if (this.stall >= 5 && now - this.lastBump > 350 && this.delay < this.maxD) { this.delay++; this.lastBump = now; this.calmSince = now; this.stalls++; }
      if (now - this.lastRs > 250) { this.lastRs = now; this.rsReq++; this.tx.send({ t: 'rs', n: this.tick }); }   // ¿se perdió algo? pedir retransmisión
      return null;
    }
    this.stall = 0; this.lastProgress = now;
    if (now - this.calmSince > 6000 && this.delay > this.minD) { this.delay--; this.calmSince = now; }
    this.q[0].delete(this.tick); this.q[1].delete(this.tick);
    this.done.set(this.tick, [a, b]); this.done.delete(this.tick - 240);
    this.tick++;
    return [a, b];
  }
  /* llamar después de cada step con la huella del estado: compara cada 60 ticks */
  check(h) {
    if (this.tick % 60 !== 0) return;
    const n = this.tick;
    if (this.theirs.has(n)) { if (this.theirs.get(n) !== h) this.flagDesync(n); this.theirs.delete(n); }
    else this.mine.set(n, h);
    this.tx.send({ t: 'h', n, v: h });
    if (this.mine.size > 20) this.mine.delete(this.mine.keys().next().value);
    if (this.theirs.size > 20) this.theirs.delete(this.theirs.keys().next().value);
  }
  get ahead() { return this.maxR - this.tick; }
  close() { this.on = false; this.tx.onmsg = null; }
}
const TIMEOUT = { idle: 25000 };   // sin avanzar ningún tick durante tanto tiempo (con el servidor vivo) → el rival no responde

/* ---- transportes ---- */
/* relé WebSocket: los mensajes 'in' y 'h' los reenvía el servidor al rival de la sala */
function WSTransport(ws) {
  const t = { onmsg: null, send(o) { if (ws.readyState === 1 && ws.bufferedAmount < 65536) ws.send(JSON.stringify(o)); } };
  return t;
}
/* 2 pestañas del mismo navegador, sin servidor (para probar) */
function BCTransport(name, me) {
  const bc = new BroadcastChannel(name);
  const t = { onmsg: null, send(o) { o.__f = me; bc.postMessage(o); }, close() { bc.close(); } };
  bc.onmessage = e => { if (e.data && e.data.__f !== me && t.onmsg) t.onmsg(e.data); };
  return t;
}

/* ---- cliente de lobby (WebSocket) ----
   Reconexión: si se corta el socket en plena partida, reintenta con el mismo `token` durante GRACE ms; el servidor
   le guarda el lugar y el rival ve "reconectando". Si vuelve a tiempo, la partida sigue (el lockstep retransmite lo perdido). */
class Lobby {
  constructor() { this.ws = null; this.h = {}; this.online = 0; this.room = null; this.me = -1; this.rtt = 0; this.inGame = false; this.tx = null; this.token = ''; this.reconnecting = false; this.GRACE = 22000; }
  on(t, fn) { this.h[t] = fn; return this; }
  emit(t, a, b) { const f = this.h[t]; if (f) f(a, b); }
  get connected() { return !!this.ws && this.ws.readyState === 1; }
  _open(url, name, color, token) {
    return new Promise((res, rej) => {
      let ws; try { ws = new WebSocket(url); } catch (e) { rej(new Error('Dirección inválida')); return; }
      let opened = false;
      this.ws = ws;
      const to = setTimeout(() => { if (!opened) { try { ws.close(); } catch (e) {} rej(new Error('Tiempo de espera agotado')); } }, 7000);
      ws.onopen = () => { opened = true; clearTimeout(to); this.lastRx = performance.now(); this.send({ t: 'hello', name, color, token: token || '' }); if (!token) this.send({ t: 'list' }); this._ping(); res(); };
      ws.onerror = () => { if (!opened) { clearTimeout(to); rej(new Error('No se pudo conectar')); } };
      ws.onclose = () => {
        clearTimeout(to); clearInterval(this._pt);
        if (this.ws !== ws) return;
        if (!opened) return;
        this.ws = null;
        if (this.inGame && this.token && !this.closing) { this._retry(); return; }     // corte en plena partida: intenta volver
        this.room = null; this.me = -1; this.emit('down', true);
      };
      ws.onmessage = e => {
        if (typeof e.data !== 'string') return;
        let m; try { m = JSON.parse(e.data); } catch (_) { return; }
        this.lastRx = performance.now(); this._msg(m);
      };
    });
  }
  connect(url, name, color) { this.url = url; this.nick = name; this.color = color; this.closing = false; this.token = ''; return this._open(url, name, color, ''); }
  _retry() {
    if (!this.reconnecting) { this.reconnecting = true; this.rcStart = performance.now(); this.rcN = 0; this.emit('reconnecting', this.GRACE); }
    clearTimeout(this._rt);
    const left = this.GRACE - (performance.now() - this.rcStart);
    if (left <= 0 || this.closing) { this.reconnecting = false; this.room = null; this.me = -1; this.inGame = false; this.emit('down', true); return; }
    this._rt = setTimeout(() => {
      this._open(this.url, this.nick, this.color, this.token).catch(() => { this.ws = null; this._retry(); });
    }, Math.min(2000, 300 * (1 + this.rcN++)));
  }
  _ping() {
    clearInterval(this._pt);
    const go = () => {
      if (performance.now() - this.lastRx > 9000 && this.ws) { try { this.ws.close(); } catch (e) {} return; }   // socket "colgado" (sin cortar): se reinicia
      this.send({ t: 'ping', ts: performance.now() });
    };
    this._pt = setInterval(go, 3000); this.send({ t: 'ping', ts: performance.now() });
  }
  send(o) { if (this.connected) this.ws.send(JSON.stringify(o)); }
  close() { this.closing = true; clearTimeout(this._rt); this.reconnecting = false; this.inGame = false; if (this.ws) try { this.ws.close(); } catch (e) {} }
  _msg(m) {
    switch (m.t) {
      case 'welcome':
        this.online = m.online | 0;
        if (m.token) this.token = m.token;
        if (this.reconnecting) {
          if (m.resumed) { this.reconnecting = false; this.emit('resumed'); }
          else { this.reconnecting = false; this.closing = true; this.inGame = false; this.room = null; this.me = -1; try { this.ws.close(); } catch (e) {} this.emit('down', true); }   // el servidor ya no tenía mi lugar
          break;
        }
        this.emit('welcome', m); break;
      case 'pong': { const d = performance.now() - m.ts; if (d >= 0 && d < 5000) this.rtt = this.rtt ? this.rtt * .6 + d * .4 : d; break; }
      case 'rooms': this.online = m.online | 0; this.emit('rooms', m); break;
      case 'room': this.room = m.room; this.me = m.me; this.emit('room', m); break;
      case 'left': this.room = null; this.me = -1; this.inGame = false; this.emit('left'); break;
      case 'err': this.emit('err', m.msg); break;
      case 'chat': this.emit('chat', m); break;
      case 'start': this.inGame = true; this.emit('start', m); break;
      case 'go': this.emit('go'); break;
      case 'oppleft': this.inGame = false; this.emit('oppleft'); break;
      case 'oppdown': this.emit('oppdown', m.grace | 0); break;
      case 'oppback': this.emit('oppback'); break;
      case 'in': case 'h': case 'rs': case 'sr': case 'snap': if (this.tx && this.tx.onmsg) this.tx.onmsg(m); break;
    }
  }
  /* transporte para el lockstep: manda por el mismo socket (si está caído, descarta: el lockstep retransmite al volver) */
  transport() { const l = this; const t = { onmsg: null, send(o) { if (l.connected && l.ws.bufferedAmount < 65536) l.ws.send(JSON.stringify(o)); } }; this.tx = t; return t; }
}

root.KNet = { Lockstep, WSTransport, BCTransport, Lobby, TIMEOUT };
})(typeof window !== 'undefined' ? window : globalThis);
