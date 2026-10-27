/* LeiaKOMBAT · audio: música chiptune (chip.js) + SFX sintetizados + samples de assets/ (ladrido, salto, voltereta, multitud)
   El ladrido de assets/ladrido.mp3 es la voz de los poderes: cambia de tono según el poder (onda, meteoro, lluvia). */
(function (root) {
'use strict';
const A = {
  ac: null, master: null, sfxG: null, musG: null, chip: null, vol: { m: .5, s: .8 }, muted: false, buf: {}, cur: '', ready: false, want: '', paused: false, viewer: 0,
  SAMPLES: { bark: 'assets/ladrido.mp3', jump: 'assets/saltar.mp3', click: 'assets/clicksound.mp3', roll: 'assets/volversound.wav', crowd: 'assets/gol.529f1f92.mp3' },
  init() {
    if (this.ready) { if (this.ac && this.ac.state === 'suspended') this.ac.resume(); return; }
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.ready = true;
    this.master = this.ac.createGain(); this.master.connect(this.ac.destination);
    this.sfxG = this.ac.createGain(); this.sfxG.connect(this.master);
    this.musG = this.ac.createGain(); this.musG.connect(this.master);
    try { this.chip = new KChip.Chip(this.ac, this.musG); } catch (e) { this.chip = null; }
    this.apply();
    this.BARK_B64 = 'data:audio/mpeg;base64,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mDLSfpjEgFMBZr9CA//7ksTog9iY8SwOaysLJp5lAd3k4S7aUwBDLyA84L1G4qUPoWIMmcHKEIjjKVibwRQJNmoCNFA6Et0lchIjBE2GSqjU2A2isKt40wWmAUhjhBHRnJmM+h8gCDggQHDU4FD16oC25MTbx9GVPFJVg2IXU6mtImpEoJXWiEEMdgiSMljGEA1JmUTOOM5R1L87lcl+VNaIyI6pMqKmBhGYgIJhMNm+pqBUsZJFBo8zHuImoNjB8HBTOljbmjFJQCKBQoW7GyUhc0cNYY1IcU4ASJ5LnMqBqklhCyo4CTjJwOFAZYMmZFICjmeonukOAuTIbCvZowlIpjEiAEKgGaoW6KQj0HLZAZgw0DLXAAoFaOM1CwoWMtAxzjdgL6ky5AOBuVcKrp7iNwtMHJI3g41mA6HEVTEQSXjlFzZh9gAGlwlA6Kwz9KujC1YrD7tO9Qy93aaT3IDjUPUMddFxYFl0NWLMut/hfnmCJVyr6a27g4CmNFZpTqcY4mIKhtDOCnEsk4z9mCZ2eZlnbZeM3JQYAzoeBKBJwMCukCoTZYwoOapgqr//+5LE54PYXPEmDmsqi0afIwHNZSCl7UzViioEmnULLLTRAOsFM07SQw4XhJovarAXGbiF1jWXGjQKUDjmBGCMgdGV9AgMDEoyGm0ApofjEDKYqdp8lzi+T1rFhh9wYCpctFasxD0NMOXcqaMP1WcqDXlZUy6j3NP9Lo1Lsqa1jrK7GbNampsKbtXGFFJBUxakVCIhpiJfoKCSI1B81E0UlGrPlMgC6BQqplyrmVuWivJuLOi5JgmAR0LxA2IkdHFBGSOBCIsEtAysR5BXIVrAjQBLBgQjHGDBlEYSIYEKSQCfqCIQHEbhiozoQ+FdgBgGWLIKwl+UAyNqWq2Glvo+qtyE0ZEQHHCjgFK2cPGvpMlF5DulOnoudrjjuY05hrSmRM9bI6b6ROCHxT+SWUXYA19+IfjEriExN0lu9apZVEYjHK9gPDhci6K8WF+sW1C/FWpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uSxOODljD1DA3jK4sYnlWJrOFwqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg==';
    // si el juego se abre con doble clic (file://) fetch() falla: el ladrido tiene copia embebida para que suene siempre
    fetch(this.BARK_B64).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => { const p = this.ac.decodeAudioData(b, res, rej); if (p && p.catch) p.catch(rej); })).then(d => { if (!this.buf.bark) this.buf.bark = d; }).catch(() => {});
    for (const k in this.SAMPLES) fetch(this.SAMPLES[k]).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(b => new Promise((res, rej) => { const p = this.ac.decodeAudioData(b, res, rej); if (p && p.catch) p.catch(rej); })).then(d => { this.buf[k] = d; }).catch(() => {});
    if (this.want) this.music(this.want);
  },
  apply() {
    if (this.sfxG) this.sfxG.gain.value = this.muted ? 0 : this.vol.s;
    if (this.musG) this.musG.gain.value = this.muted ? 0 : Math.min(1, this.vol.m * 1.1);
  },
  setVol(m, s) { this.vol.m = m; this.vol.s = s; this.apply(); },
  setMuted(v) { this.muted = !!v; this.apply(); },
  /* música: menu | core | marte | hielo | neon | arcade | void (o '' para silencio) */
  music(name) {
    this.want = name; if (!this.ready || !this.chip) return;
    if (!name) { this.chip.stop(.6); this.cur = ''; return; }
    if (this.cur === name) return;
    this.cur = name; this.chip.play(name);
  },
  setLevel(n) { if (this.chip) this.chip.setLevel(n); },       // 0 normal · 1 tensión (poca vida / últimos segundos)
  setPaused(p) { this.paused = !!p; if (this.chip) this.chip.setPaused(!!p); },
  duck(s, to) { if (this.chip) this.chip.duck(s, to); },
  beat() { return this.chip && this.cur ? this.chip.beat() : { phase: 0, n: 0, on: false }; },
  tone(type, f0, f1, dur, vol, delay) {
    const a = this.ac; if (!a || this.muted) return; const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol, hp, delay, lp) {
    const a = this.ac; if (!a || this.muted) return; const t = a.currentTime + (delay || 0), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = lp ? 'lowpass' : 'highpass'; f.frequency.value = lp || hp; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(t);
  },
  sweep(f0, f1, dur, vol, delay, q) {
    const a = this.ac; if (!a || this.muted) return; const t = a.currentTime + (delay || 0), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) { const k = i / n; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, k * 1.15)); }
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'bandpass'; f.Q.value = q || 1.4;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(t);
  },
  sample(k, vol, rate, dur, delay) {
    const a = this.ac, b = this.buf[k]; if (!a || !b || this.muted) return false;
    const s = a.createBufferSource(), g = a.createGain(); s.buffer = b; if (rate) s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g); g.connect(this.sfxG); const t = a.currentTime + (delay || 0); s.start(t);
    if (dur) { g.gain.setValueAtTime(vol, t + dur * .6); g.gain.linearRampToValueAtTime(0, t + dur); s.stop(t + dur + .02); }
    return true;
  },
  /* ladrido con ECO: el original + repeticiones cada vez más suaves y apagadas (pasa-bajos) + una cola de reverb corta */
  barkEcho(vol, rate) {
    const a = this.ac, b = this.buf.bark; if (!a || this.muted) return;
    if (!b) { this.bark(vol, rate); return; }
    const t0 = a.currentTime, gap = .19, taps = 5;
    for (let i = 0; i < taps; i++) {
      const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
      s.buffer = b; s.playbackRate.value = rate; f.type = 'lowpass'; f.frequency.value = Math.max(900, 9000 * Math.pow(.62, i));
      g.gain.value = vol * Math.pow(.56, i); s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(t0 + i * gap);
    }
    // cola de reverb: ruido filtrado que se apaga
    this.noise(.9, vol * .05, 0, .05, 1200);
  },
  /* ladrido: si existe el sample se usa (con tono y largo a elección); si no, un "guau" chiptune de reemplazo */
  bark(vol, rate, delay, dur) {
    if (this.sample('bark', vol, rate, dur, delay)) return;
    const f = 340 * rate; this.tone('square', f, f * .45, .17, vol * .14, delay); this.tone('sawtooth', f * 1.5, f * .6, .12, vol * .06, delay); this.noise(.06, vol * .1, 900, delay);
  },
  /* ladrido por luchador: el jugador 1 siempre con el tono original (1.0); el rival, apenas distinto para diferenciarlos */
  RATE: [1, 1.12],
  play(n, v, who, kind) {
    if (!this.ready) return;
    const br = this.RATE[who === 1 ? 1 : 0];
    const cp = 1 + Math.min(Math.max((v | 0) - 1, 0), 7) * .055;   // el tono sube con cada golpe del combo
    switch (n) {
      case 'jump': if (!this.sample('jump', .5, 1.1)) this.tone('square', 220, 560, .13, .08); this.tone('square', 520, 880, .06, .03, .02); break;
      case 'land': this.noise(.07, .1, 150); this.tone('triangle', 110, 60, .08, .12); break;
      case 'punch': this.sweep(2600, 900, .09, .22, 0, 1.2); this.tone('square', 900, 400, .04, .02); this.bark(.8, br); break;   // ladra al apretar golpe (E), le pegue o no
      case 'kick': this.sweep(1500, 380, .15, .3, 0, 1); this.tone('triangle', 260, 120, .1, .05); break;
      case 'whiff': this.sweep(1100, 260, .2, .1, .02, .8); break;
      /* golpes que conectan: cada uno suena distinto */
      case 'hitP': this.noise(.05, .22, 2200); this.tone('square', 320 * cp, 90, .08, .1); this.tone('triangle', 130, 55, .1, .2); break;
      case 'hitK': this.noise(.14, .34, 0, 0, 1400); this.tone('sine', 150, 38, .24, .4); this.tone('square', 240 * cp, 60, .12, .1); this.noise(.04, .25, 3000); break;
      case 'hitW': this.tone('sawtooth', 820, 110, .3, .13); this.tone('square', 410, 70, .26, .1); this.noise(.2, .22, 600); this.tone('sine', 110, 40, .3, .32); break;
      case 'hitC': this.noise(.16, .38, 0, 0, 1600); this.tone('sine', 130, 32, .3, .5); this.tone('square', 200, 50, .16, .14); this.tone('triangle', 1760, 1760, .22, .09, .02); this.tone('triangle', 2640, 2640, .18, .06, .06); this.noise(.05, .3, 3200);  break;
      case 'hit': this.tone('square', 190, 45, .15, .13); this.noise(.09, .2, 300); this.tone('triangle', 90, 40, .14, .16); break;
      case 'block': this.tone('triangle', 520, 380, .08, .16); this.tone('square', 1250, 1250, .05, .05); this.tone('square', 1870, 1870, .04, .03, .01); this.noise(.05, .14, 2800); this.tone('sine', 120, 70, .08, .16); break;
      case 'roll': if (!this.sample('roll', .45, 1.2)) this.tone('sine', 300, 760, .22, .09); this.tone('square', 300, 900, .18, .04); this.noise(.1, .05, 1200); break;
      case 'ko': this.tone('sawtooth', 300, 40, .75, .14); this.noise(.3, .18, 200); this.sample('crowd', .5, 1, 2.6); this.duck(.9, .15); break;
      case 'bark': this.barkEcho(1, br); this.tone('sine', 140, 55, .22, .12); break;   // poder LADRIDO: suena ladrido.mp3 al lanzar la onda
      case 'storm': [0, 1, 2, 3, 4].forEach(i => this.tone('square', 900 + i * 120, 500 + i * 60, .08, .035, i * .08)); break;
      case 'meteor': this.tone('sawtooth', 1100, 90, .45, .08); this.noise(.45, .1, 400); break;
      case 'quake': this.tone('sine', 95, 28, .45, .3); this.tone('triangle', 60, 30, .35, .2); this.noise(.4, .3, 0, 0, 900); break;
      case 'bone': this.tone('square', 520, 190, .06, .09); this.noise(.05, .12, 1500); break;
      case 'drop': this.tone('square', 1500, 500, .35, .035); this.tone('triangle', 1500, 500, .35, .04, .01); break;
      case 'pick': if (this.chip) this.chip.jingle('pick'); break;
      case 'shield': this.tone('square', 1400, 2200, .09, .07); this.tone('triangle', 700, 1400, .15, .1); this.noise(.07, .1, 3500); break;
      case 'beep': this.tone('square', 660, 660, .12, .08); break;
      case 'go': this.tone('square', 990, 990, .28, .1); this.tone('square', 1320, 1320, .22, .05, .1); break;
      case 'dodge': this.tone('square', 900, 1500, .07, .05); this.tone('triangle', 1500, 1800, .05, .04, .05); break;
      case 'win': this.sample('crowd', .55, 1, 4); if (this.chip) this.chip.jingle('win'); break;
      case 'lose': if (this.chip) this.chip.jingle('lose'); break;
      case 'click': if (!this.sample('click', .45, 1.4)) this.tone('square', 800, 600, .04, .05); break;
    }
  },
  consume(s) {
    for (const e of s.events) {
      if (e.k === 'sfx') this.play(e.n, e.v, e.who, e.kind);
      else if (e.k === 'end' && e.match) this.play(this.viewer >= 0 && e.winner >= 0 && e.winner !== this.viewer ? 'lose' : 'win');
      else if (e.k === 'cast' && this.chip) this.chip.jingle('power');
    }
  }
};
root.KAudio = A;
})(window);