// Punto de entrada: mundo, jugador, ciclo día/noche, TNT, sonido y UI.
import { CONFIG } from './config.js';
import { World } from './world/world.js';
import { Chunk } from './world/chunk.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from './world/constants.js';
import { TerrainGenerator, BIOME_NAMES, GEN_VERSION } from './terrain/generator.js';
import { Renderer } from './rendering/renderer.js';
import { buildChunkMesh } from './rendering/mesher.js';
import { Batch } from './rendering/batch.js';
import { Player } from './player/player.js';
import { Input } from './player/input.js';
import { B, BLOCKS, CREATIVE_LIST, IS_OPAQUE, isTorch } from './blocks/blocks.js';
import { TILES } from './blocks/atlas.js';
import { parseSeed } from './utils/random.js';
import { lookDirection } from './utils/math.js';
import { raycast } from './world/raycast.js';
import { explode, blastDamage } from './world/explosion.js';
import { Inventory } from './inventory/inventory.js';
import { Hotbar } from './ui/hotbar.js';
import { breakBlock, placeBlock } from './player/interaction.js';
import { skyState, timeLabel, DAY_LENGTH } from './fx/daycycle.js';
import { Particles } from './fx/particles.js';
import { Mobs } from './world/mobs.js';
import { Sound } from './fx/audio.js';
import { loadLeiaAssets, collieMural, leia } from './leianet/assets.js';
import { InventoryUI } from './ui/inventoryui.js';
import { toolOf, nameOf, foodOf } from './items/items.js';
import { mineInfo, dropFor, wear } from './player/tools.js';
import { TouchControls, wantsTouch } from './player/touch.js';
import { SaveStore, diffWorld, applyRuns, mergePending, packInventory, unpackInventory } from './save/save.js';
import { TIERS, pickTier, FpsGovernor } from './perf.js';
import { itemDef, I } from './items/items.js';
import { Hand } from './fx/hand.js';
import { Furnaces } from './world/furnace.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const overlay = $('overlay');
const loading = $('loading');
const loadingBar = $('loading-bar');
const loadingText = $('loading-text');
const hud = $('hud');
const errorBox = $('error');

function fail(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
  loading.style.display = 'none';
}

// Materiales de LeiaNET (logo, mascota). Si no están, el juego sigue con sus texturas procedurales.
await loadLeiaAssets();

let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  fail(String(e.message || e));
  throw e;
}

const params = new URLSearchParams(location.search);
const showcase = params.get('mode') === 'creative';
const noSave = params.get('save') === '0';
// Qué mundo se abre: ?seed= (lo pone la web o un enlace compartido) manda; si no, el mundo que ya se guardó en este
// navegador; y si no hay ninguno, uno NUEVO al azar. El mundo "actual" se recuerda recién cuando se guarda por primera vez.
const PTR_KEY = 'leianet.network.world';
const explicitSeed = (params.get('seed') || '').trim();
function randomSeedText() {
  const a = new Uint32Array(2);
  (window.crypto || { getRandomValues: (x) => x.map(() => Math.random() * 4294967296) }).getRandomValues(a);
  return (a[0].toString(36) + a[1].toString(36)).replace(/[^a-z0-9]/g, '').slice(0, 8).padEnd(8, '0');
}
function chooseSeed() {
  if (explicitSeed) return explicitSeed;
  if (!noSave) { try { const p = localStorage.getItem(PTR_KEY); if (p) return p; } catch { /* sin almacenamiento */ } }
  return randomSeedText();
}
const seedText = chooseSeed();
const seed = parseSeed(seedText);
const embed = params.get('embed') === '1';
let creative = params.get('mode') === 'creative';
if (embed) { document.body.classList.add('embed'); }
const touch = wantsTouch();
let touchCtl = null;
const isPortrait = () => touch && window.innerHeight > window.innerWidth;
// Al pausar con un toque, el navegador genera un "clic" justo después sobre lo que quedó debajo del dedo
// (el menú de pausa) y lo volvería a cerrar. Ese clic fantasma se ignora un momento.
let ignoreClickUntil = 0;
const ghostClick = () => performance.now() < ignoreClickUntil;

const world = new World();
const generator = new TerrainGenerator(seed);
const player = new Player(CONFIG.player);
const sound = new Sound();
sound.setMusic(params.get('music') === '0' ? null : leia.musicURL);
const particles = new Particles();
const mobs = new Mobs();
const furnaces = new Furnaces();
const handBatch = new Batch(640);
const entBatch = new Batch(8000);
const crackBatch = new Batch(64);
let state = 'loading'; // loading | playing | dead
let menuOpen = false;

let started = false;
const input = new Input(canvas, (locked) => {
  if (locked) {
    sound.start();
    if (!started) {
      started = true;
      const sp = $('splash'); sp.classList.add('show');
      if (!creative) setTimeout(() => toast('Empezás sin nada: rompé un árbol con el clic izquierdo'), 2600);
    }
  }
  if (touchCtl) touchCtl.show(locked);
  if (!locked && state === 'playing') saveNow();
  if (!locked && state === 'playing' && !menuOpen) updatePause();
  overlay.style.display = locked || state !== 'playing' || menuOpen ? 'none' : 'flex';
});

if (touch) input.enableTouch();

const inventory = new Inventory();
// Supervivencia: se empieza sin nada (a puño limpio: talar un árbol, fabricar, etc.). Creativo trae un kit de prueba.
if (creative) { inventory.giveStarterKit(); inventory.slots[8] = { id: B.TNT, count: 16 }; }
const hotbar = new Hotbar($('hotbar'), $('blockname'), inventory);
const hand = new Hand(hotbar.atlas); // mano en primera persona (usa el atlas para extruir los ítems)
let actionCooldown = 0;
const ACTION_DELAY = 0.2;
if (touch) {
  touchCtl = new TouchControls(input, { hotbarEl: $('hotbar'), onPause: () => { ignoreClickUntil = performance.now() + 700; input.unlock(); }, onInventory: () => setMenu(!menuOpen) });
}

// ---- Salud ----
const MAX_HP = 20;
let hp = MAX_HP, regenT = 0, hurtFlash = 0, shake = 0;
const heartsEl = $('hearts');
for (let i = 0; i < 10; i++) heartsEl.appendChild(document.createElement('span'));
function refreshHearts() {
  [...heartsEl.children].forEach((el, i) => {
    const v = hp - i * 2;
    el.className = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
  });
  heartsEl.style.display = creative ? 'none' : 'flex';
}
refreshHearts();

// ---- Hambre ----
const MAX_FOOD = 20;
let food = MAX_FOOD, foodT = 0, starveT = 0, bed = null;
const foodEl = $('food');
for (let i = 0; i < 10; i++) foodEl.appendChild(document.createElement('span'));
function refreshFood() {
  [...foodEl.children].forEach((el, i) => {
    const v = food - i * 2;
    el.className = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
  });
  foodEl.style.display = creative ? 'none' : 'flex';
}
refreshFood();

function hurt(dmg) {
  if (creative || state !== 'playing' || dmg <= 0) return;
  hp = Math.max(0, hp - dmg);
  hurtFlash = 0.45; regenT = 0;
  sound.hurt();
  refreshHearts();
  if (hp <= 0) die();
}
function die() {
  state = 'dead';
  sound.death();
  input.unlock();
  $('death').style.display = 'flex';
  saveNow();
}
$('respawn').addEventListener('click', () => {
  hp = MAX_HP; refreshHearts(); mobs.clear();
  food = MAX_FOOD; foodT = 0; starveT = 0; refreshFood();
  let rp = spawn;
  if (bed && world.getBlock(bed[0], bed[1], bed[2]) === B.BED) rp = [bed[0] + 0.5, bed[1] + 1, bed[2] + 0.5]; else bed = null;
  ensureAround(rp[0], rp[2], 1);
  player.spawn(rp[0], rp[1], rp[2]);
  state = 'playing';
  $('death').style.display = 'none';
  input.lock();
});

// ---- Preparación del mundo ----
// El mundo es grande: antes de empezar se genera sólo un radio chico alrededor del jugador; el resto se genera
// mientras caminás y se descarga lo lejano que no editaste (se regenera igual si volvés).
const half = CONFIG.worldChunks / 2;
const WORLD_LIM = half * CHUNK_SIZE;   // borde del mundo, en bloques
const INIT_R = 4;                      // radio (en chunks) que se genera antes de empezar
const inWorld = (cx, cz) => cx >= -half && cx < half && cz >= -half && cz < half;
const pending = new Map();             // 'cx,cz' -> tramos guardados de chunks que todavía no se generaron
let streamR = CONFIG.renderDistance + 1;
let spawn = null;
let muralTarget = null;
let planned = false, ready = false, savedData = null;
let initList = [], genIdx = 0, totalToMesh = 0;

const MURAL = 56;
// Dónde va el mural: lo más lejos posible (para verlo entero), que entre en el mundo y que el terreno no lo invada ni lo tape.
// No depende de si las imágenes cargaron: el punto de aparición tiene que ser el mismo en cada sesión.
function muralSpot(sx, sz, y0) {
  const lim = WORLD_LIM - 2;
  const x0 = Math.round(sx - MURAL / 2);
  if (x0 - 1 < -lim || x0 + MURAL + 1 > lim) return null;
  const yb = Math.min(y0 + 16, CHUNK_HEIGHT - 3 - MURAL);
  for (const d of [56, 48, 40, 32, 24]) {
    const wz = sz - d;
    if (wz - 2 < -lim) continue;
    let ok = true;
    for (let x = x0; x <= x0 + MURAL && ok; x += 8) if (generator.heightAt(x, wz) > yb - 3) ok = false;
    for (let z = sz; z >= wz && ok; z -= 8) if (generator.heightAt(Math.round(sx), z) > y0 + 8) ok = false;
    if (ok) return { x0, wz, yb };
  }
  return null;
}

// Punto de aparición + estructuras fijas (galería creativa, mural del collie). Se registran en el generador como
// "estampas": se aplican al generar cada chunk, así no se pierden al descargarlo ni dependen de qué chunks estén cargados.
function planWorld() {
  planned = true;
  if (!noSave) {
    savedData = store.load();
    if (savedData) for (const d of savedData.diff) pending.set(`${d.cx},${d.cz}`, d.runs);
  }
  const [sx, sz] = generator.findSpawn((x, z, y) => !!muralSpot(x, z, y)) || generator.findSpawn() || [0, 0];
  const y0 = Math.max(generator.heightAt(sx, sz), SEA_LEVEL) + 1;
  spawn = [sx + 0.5, y0, sz + 0.5];
  generator.addNoTrees(sx - 5, sz - 5, sx + 5, sz + 5);   // sin troncos ni hojas justo donde aparecés
  generator.addNoCaves(sx - 6, sz - 6, sx + 6, sz + 6);   // y sin cuevas debajo
  if (showcase) { // galería con los bloques disponibles (3 filas)
    generator.addNoTrees(sx - 10, sz - 4, sx + 11, sz + 8);
    generator.addBox(sx - 7, y0 - 1, sz - 2, sx + 8, y0 - 1, sz + 5, B.STONE);
    generator.addBox(sx - 7, y0, sz - 2, sx + 8, y0 + 3, sz + 5, B.AIR);
    CREATIVE_LIST.forEach((id, i) => generator.addCell(sx - 5 + (i % 10), y0, sz + 3 + Math.floor(i / 10), id));
  }
  const ms = muralSpot(sx, sz, y0);
  if (ms) { // mural de lana flotando delante del punto de aparición
    generator.addNoTrees(sx - 11, ms.wz - 3, sx + 11, sz + 4);
    generator.addBox(ms.x0 - 1, ms.yb - 1, ms.wz - 1, ms.x0 + MURAL, ms.yb + MURAL, ms.wz + 1, B.AIR);
    const m = collieMural(MURAL);
    if (m) {
      const MAP = { W: B.WOOL_WHITE, K: B.WOOL_BLACK, P: B.WOOL_PINK, B: B.WOOL_BROWN };
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const c = m.cells[m.h - 1 - y][x];
        if (c) generator.addCell(ms.x0 + x, ms.yb + y, ms.wz, MAP[c]);
      }
      muralTarget = { x: ms.x0 + m.w / 2, y: ms.yb + m.h / 2, z: ms.wz };
    }
  }
  // la carga inicial se centra en donde vas a aparecer: el punto guardado o, si no hay, el de aparición
  const sp = savedData && savedData.meta && savedData.meta.pos;
  const ok = Array.isArray(sp) && sp.length === 3 && sp.every((v) => typeof v === 'number' && Number.isFinite(v));
  const cx0 = Math.floor((ok ? sp[0] : spawn[0]) / CHUNK_SIZE), cz0 = Math.floor((ok ? sp[2] : spawn[2]) / CHUNK_SIZE);
  for (let dz = -INIT_R; dz <= INIT_R; dz++) for (let dx = -INIT_R; dx <= INIT_R; dx++) {
    if (inWorld(cx0 + dx, cz0 + dz)) initList.push([cx0 + dx, cz0 + dz, dx * dx + dz * dz]);
  }
  initList.sort((p, q) => p[2] - q[2]);
}

// Genera un chunk; si había ediciones guardadas para él, las aplica encima.
function makeChunk(cx, cz) {
  const c = new Chunk(cx, cz);
  generator.generateChunk(c);
  const key = `${cx},${cz}`, runs = pending.get(key);
  if (runs) { applyRuns(c, runs, isValidBlock); pending.delete(key); }
  world.addChunk(c);
  return c;
}

function meshDirty(budgetMs) {
  const t0 = performance.now();
  for (const chunk of world.dirty) {
    world.dirty.delete(chunk);
    renderer.uploadChunk(chunk, buildChunkMesh(world, chunk));
    if (performance.now() - t0 > budgetMs) break;
  }
}

// Genera y dibuja ya (sin presupuesto de tiempo) lo que falte alrededor de un punto: para teletransportes.
function ensureAround(wx, wz, r) {
  const pcx = Math.floor(wx / CHUNK_SIZE), pcz = Math.floor(wz / CHUNK_SIZE);
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (inWorld(pcx + dx, pcz + dz) && !world.getChunk(pcx + dx, pcz + dz)) makeChunk(pcx + dx, pcz + dz);
  }
  while (world.dirty.size) meshDirty(1e9);
}

// ---- Carga progresiva mientras jugás ----
const SPIRAL = [];
for (let dz = -12; dz <= 12; dz++) for (let dx = -12; dx <= 12; dx++) SPIRAL.push([dx, dz, Math.hypot(dx, dz)]);
SPIRAL.sort((p, q) => p[2] - q[2]);
let lastPcx = NaN, lastPcz = NaN, streamBusy = true;
function streamWorld(budgetMs) {
  const pcx = Math.floor(player.pos[0] / CHUNK_SIZE), pcz = Math.floor(player.pos[2] / CHUNK_SIZE);
  if (!streamBusy && pcx === lastPcx && pcz === lastPcz) return;
  lastPcx = pcx; lastPcz = pcz;
  const t0 = performance.now();
  for (const [dx, dz, d] of SPIRAL) {
    if (d > streamR) break;
    const cx = pcx + dx, cz = pcz + dz;
    if (!inWorld(cx, cz) || world.getChunk(cx, cz)) continue;
    makeChunk(cx, cz);
    if (performance.now() - t0 > budgetMs) { streamBusy = true; return; }
  }
  streamBusy = false;
}
// Descarga lo lejano que nadie editó (los editados se quedan: son los que se guardan).
function unloadFar() {
  const pcx = Math.floor(player.pos[0] / CHUNK_SIZE), pcz = Math.floor(player.pos[2] / CHUNK_SIZE), R = Math.ceil(streamR) + 3;
  for (const c of [...world.chunks.values()]) {
    if (c.base || Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) <= R) continue;
    renderer.releaseChunk(c);
    world.removeChunk(c);
  }
}

function loadStep() {
  if (!planned) { loadingText.textContent = 'Eligiendo un mundo…'; planWorld(); return; }
  const t0 = performance.now();
  if (genIdx < initList.length) {
    while (genIdx < initList.length && performance.now() - t0 < 10) {
      const [cx, cz] = initList[genIdx++];
      makeChunk(cx, cz);
    }
    loadingBar.style.width = `${(genIdx / initList.length) * 60}%`;
    loadingText.textContent = 'Generando terreno…';
    if (genIdx >= initList.length) totalToMesh = world.dirty.size;
    return;
  }
  if (world.dirty.size > 0) {
    meshDirty(10);
    loadingBar.style.width = `${60 + (1 - world.dirty.size / totalToMesh) * 40}%`;
    loadingText.textContent = 'Construyendo mallas…';
    return;
  }
  player.spawn(spawn[0], spawn[1], spawn[2]);
  player.yaw = 0;
  player.pitch = 0.12; // un poco hacia arriba
  if (savedData) restoreSaved(savedData.meta);
  else if (muralTarget) { // mirar hacia el mural flotante
    const dy = muralTarget.y - (spawn[1] + CONFIG.player.eyeHeight), dz = spawn[2] - muralTarget.z;
    player.pitch = Math.min(1.2, Math.atan2(dy, dz) * 0.85);
  }
  state = 'playing';
  loading.style.display = 'none';
  updatePause();
  overlay.style.display = 'flex';
  if (embed && window.parent !== window) window.parent.postMessage({ type: 'voxelia:ready' }, '*');
  ready = true;
  lastSaveAt = performance.now();
}

// ---- Guardado (localStorage): sólo la diferencia contra el terreno generado + jugador e inventario ----
const store = new SaveStore(`leianet.network.v${GEN_VERSION}:${seedText}:${showcase ? 'c' : 's'}`);
const NORM = new Uint8Array(256).map((_, i) => i);
NORM[B.TNT_FLASH] = B.TNT; // un TNT a mitad de parpadeo se guarda como TNT común
NORM[B.FURNACE_ON] = B.FURNACE; // el horno encendido se guarda como horno (su estado va aparte)
let wiped = false, ptrSet = false;
let lastSaveAt = 0, saveWarned = false, savedOnce = false;
const isValidBlock = (id) => !!BLOCKS[id] && id !== B.TNT_FLASH;
const isValidItem = (id) => Number.isInteger(id) && (id < 100 ? isValidBlock(id) && id !== B.AIR && id !== B.WATER : !!itemDef(id));

function saveNow() {
  if (noSave || wiped || !ready || state === 'loading') return false;
  // chunks editados en memoria + lo guardado de chunks que todavía no se generaron esta sesión
  const diff = mergePending(diffWorld(world, null, NORM), pending);
  const dead = state === 'dead';
  const r2 = (v) => Math.round(v * 100) / 100;
  const meta = {
    seed: seedText, creative, t: timeOfDay, hp: dead ? MAX_HP : hp, food: dead ? MAX_FOOD : food, bed,
    pos: (dead ? spawn : player.pos).map(r2), yaw: r2(player.yaw), pitch: r2(player.pitch),
    inv: packInventory(inventory), furn: furnaces.toJSON(),
  };
  const ok = store.save(meta, diff);
  lastSaveAt = performance.now();
  if (ok) {
    savedOnce = true;
    // desde el primer guardado, este es "el mundo" de este navegador: la próxima vez se abre el mismo
    if (!explicitSeed && !ptrSet) { try { localStorage.setItem(PTR_KEY, seedText); } catch { /* nada */ } ptrSet = true; }
  }
  else if (!saveWarned) { saveWarned = true; toast(`No se pudo guardar (almacenamiento ${store.lastError})`); }
  return ok;
}

function restoreSaved(meta) {
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!showcase && typeof meta.creative === 'boolean') creative = meta.creative;
  unpackInventory(inventory, meta.inv, isValidItem);
  furnaces.load(meta.furn, isValidItem);
  if (num(meta.t)) timeOfDay = ((meta.t % 1) + 1) % 1;
  if (!creative && num(meta.food)) { food = Math.max(0, Math.min(MAX_FOOD, Math.round(meta.food))); refreshFood(); }
  if (Array.isArray(meta.bed) && meta.bed.length === 3 && meta.bed.every(num)) bed = meta.bed;
  if (!creative && num(meta.hp)) hp = Math.max(1, Math.min(MAX_HP, Math.round(meta.hp)));
  if (Array.isArray(meta.pos) && meta.pos.length === 3 && meta.pos.every(num)) {
    const [x, y, z] = meta.pos, bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    // sólo si el lugar es válido (chunk cargado y con aire para el cuerpo); si no, el punto de aparición
    if (world.getChunk(bx >> 4, bz >> 4) && !world.isSolid(bx, by, bz) && !world.isSolid(bx, by + 1, bz)) player.spawn(x, y, z);
    else ensureAround(spawn[0], spawn[2], 2);
  } else ensureAround(spawn[0], spawn[2], 2);
  if (num(meta.yaw)) player.yaw = meta.yaw;
  if (num(meta.pitch)) player.pitch = Math.max(-1.5, Math.min(1.5, meta.pitch));
  refreshHearts(); refreshFood(); hotbar.refresh();
  toast('Mundo cargado');
}
window.__voxeliaSave = saveNow; // lo llama el cargador de la web justo antes de cerrar el juego
window.addEventListener('pagehide', () => saveNow());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { saveNow(); if (touch && state === 'playing') input.unlock(); }
});

// ---- Rendimiento: Alto / Medio / Bajo. En automático sólo baja si los FPS son malos de forma sostenida ----
const PERF_KEY = 'leianet.network.perf';
let storedPerf = null;
try { storedPerf = localStorage.getItem(PERF_KEY); } catch { /* sin almacenamiento */ }
const deviceHints = { touch, cores: navigator.hardwareConcurrency || 8, memory: navigator.deviceMemory || 8 };
const pick = pickTier({ param: params.get('perf'), stored: storedPerf, ...deviceHints });
let perfAuto = pick.auto, tierIdx = pick.tier;
let perfMode = pick.auto ? 'auto' : TIERS[pick.tier].key;
const governor = new FpsGovernor();
let maxDist = CONFIG.renderDistance * CHUNK_SIZE;
function applyTier(i) {
  tierIdx = i;
  const t = TIERS[i], mp = params.get('msaa');
  const msaa = mp === null ? t.msaa : i === 0 ? (Number(mp) || 0) : Math.min(t.msaa, Number(mp) || 0);
  renderer.setQuality({ msaa, dpr: t.dpr });
  maxDist = Math.min(CONFIG.renderDistance, t.dist) * CHUNK_SIZE;
  streamR = Math.min(CONFIG.renderDistance, t.dist) + 1;
  streamBusy = true;
  particles.max = Math.max(60, Math.round(600 * t.particles));
  particles.scale = t.particles;
  governor.reset();
}
applyTier(tierIdx);
const PERF_MODES = ['auto', 'high', 'mid', 'low'];
const perfLabel = () => `Rendimiento: ${perfMode === 'auto' ? `Auto (${TIERS[tierIdx].name})` : TIERS[tierIdx].name}`;
function cyclePerf() {
  perfMode = PERF_MODES[(PERF_MODES.indexOf(perfMode) + 1) % PERF_MODES.length];
  if (perfMode === 'auto') {
    const p = pickTier(deviceHints);
    perfAuto = true; applyTier(p.tier);
  } else {
    perfAuto = false; applyTier(PERF_MODES.indexOf(perfMode) - 1);
  }
  try { localStorage.setItem(PERF_KEY, perfMode === 'auto' ? 'auto' : perfMode); } catch { /* nada */ }
  updatePause();
}

// ---- Celular: pantalla en horizontal, pantalla completa y ayuda propia ----
const rotateEl = $('rotate');
function checkOrientation() {
  const p = isPortrait();
  rotateEl.style.display = p ? 'flex' : 'none';
  if (p && input.locked) input.unlock();
}
function fitInventory() { // el panel de fabricación no entra en un celular apaisado: se achica hasta que entre
  const w = invEl.querySelector('.invwrap');
  ui.half = false; const hb = $('inv-half'); if (hb) hb.classList.remove('active');
  w.style.transform = ''; w.style.transformOrigin = 'center center';
  const r = w.getBoundingClientRect();
  const s = Math.min(1, (window.innerWidth * 0.96) / r.width, (window.innerHeight * 0.92) / r.height);
  w.style.transform = `scale(${s})`;
}
window.addEventListener('resize', () => { if (menuOpen) fitInventory(); });
if (touch) {
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
  checkOrientation();
  $('keys').innerHTML = '<p class="touchhelp"><b>Izquierda:</b> joystick (empujalo al borde para correr) · <b>Derecha:</b> arrastrá para mirar<br>' +
    '<b>⛏</b> romper (mantené) · <b>▣</b> colocar / usar · <b>▲</b> saltar (doble toque = volar) · <b>▼</b> agacharse · <b>🎒</b> inventario</p>';
  $('keys').classList.add('touchkeys');
}
let fsTried = false;
function touchFullscreen() {
  if (!touch || fsTried) return;
  fsTried = true;
  try {
    const el = document.documentElement;
    const p = el.requestFullscreen && !document.fullscreenElement ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p && p.catch) p.catch(() => {});
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
  } catch { /* no soportado */ }
}

// ---- Menú de pausa (Esc) ----
function updatePause() {
  $('pause-sub').textContent = started ? 'En pausa' : (touch ? 'Tocá para jugar' : 'Hacé clic para jugar');
  $('btn-perf').textContent = perfLabel();
  $('resume').textContent = started ? 'Continuar' : 'Jugar';
  $('btn-sound').textContent = sound.muted ? 'Sonido: no' : 'Sonido: sí';
  const hp_ = `${hp / 2} ♥`;
  $('pause-chips').innerHTML = [creative ? 'Creativo' : 'Supervivencia', `Hora ${timeLabel(timeOfDay)}`, creative ? '' : hp_, `Semilla ${seedText}`, savedOnce ? 'Guardado' : '']
    .filter(Boolean).map((t) => `<span>${t}</span>`).join('');
}
overlay.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b && b.id !== 'resume') return;       // los demás botones hacen lo suyo
  if (e.target.closest('.keys, .chips')) return;
  if (isPortrait() || ghostClick()) return;
  touchFullscreen();
  input.lock();
});
$('btn-perf').addEventListener('click', (e) => { e.stopPropagation(); cyclePerf(); });
let wipeTimer = null;
$('btn-wipe').addEventListener('click', (e) => {
  e.stopPropagation();
  const b = e.currentTarget;
  if (!b.classList.contains('arm')) {
    b.classList.add('arm'); b.textContent = '¿Seguro? Tocá de nuevo';
    clearTimeout(wipeTimer);
    wipeTimer = setTimeout(() => { b.classList.remove('arm'); b.textContent = 'Mundo nuevo'; }, 3000);
    return;
  }
  wiped = true; store.clear();
  try { localStorage.removeItem(PTR_KEY); } catch { /* nada */ }
  location.reload();
});
$('btn-sound').addEventListener('click', (e) => { e.stopPropagation(); sound.toggleMute(); updatePause(); });
$('btn-hud').addEventListener('click', (e) => { e.stopPropagation(); showHud = !showHud; hud.style.display = showHud ? 'block' : 'none'; });
canvas.addEventListener('click', () => { if (state === 'playing' && !input.locked && !menuOpen && !ghostClick() && !isPortrait()) input.lock(); });
$('exit').addEventListener('click', (e) => {
  e.stopPropagation();
  if (window.parent !== window) window.parent.postMessage({ type: 'voxelia:exit' }, '*');
});

// ---- TNT ----
const primed = new Map(); // "x,y,z" -> { x, y, z, t, fuse }
function ignite(x, y, z, fuse = 3) {
  const k = `${x},${y},${z}`;
  if (primed.has(k) || world.getBlock(x, y, z) !== B.TNT) return;
  primed.set(k, { x, y, z, t: 0, fuse });
  sound.hiss();
}
function updateTNT(dt) {
  for (const [k, p] of primed) {
    p.t += dt;
    world.setBlock(p.x, p.y, p.z, Math.floor(p.t * 4) % 2 ? B.TNT_FLASH : B.TNT);
    if (p.t >= p.fuse) {
      primed.delete(k);
      world.setBlock(p.x, p.y, p.z, B.AIR);
      blast(p.x + 0.5, p.y + 0.5, p.z + 0.5, 4);
    }
  }
}

// ---- Explosión (TNT) ----
function blast(cx, cy, cz, radius) {
  const res = explode(world, cx, cy, cz, radius, (cx * 31 + cz * 17) | 0);
  sound.explode();
  particles.puff(cx, cy, cz, 28, radius);
  res.removed.forEach((b, i) => { if (i % 3 === 0) particles.burst(b.x, b.y, b.z, b.id, 3, 6); });
  shake = Math.max(shake, Math.min(1, 6 / (1 + Math.hypot(player.pos[0] - cx, player.pos[2] - cz))));
  // jugador
  const dxp = player.pos[0] - cx, dyp = player.pos[1] + 0.9 - cy, dzp = player.pos[2] - cz;
  const dp = Math.hypot(dxp, dyp, dzp) || 0.01;
  const dmg = blastDamage(dp, radius);
  if (dmg > 0) {
    hurt(dmg);
    const kb = (1 - dp / (radius * 2)) * 14;
    player.vel[0] += (dxp / dp) * kb; player.vel[2] += (dzp / dp) * kb; player.vel[1] += 5 + kb * 0.3;
    player.onGround = false;
  }
  for (const t of res.tnt) ignite(t.x, t.y, t.z, 0.4 + Math.random() * 0.9);
}

// ---- Inventario y fabricación (E, o clic derecho en una mesa de crafteo) ----
const invEl = $('invui');
const ui = new InventoryUI(invEl, hotbar, inventory, () => creative);
ui.onSound = (name) => sound[name] && sound[name]();
// clic en cualquier botón de los menús (los botones de juego táctiles no: ahí suena la acción)
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('button');
  if (b && !b.closest('#touch')) sound.click();
}, true);
if (touch) { // sin teclado: botón para cerrar y modo "mitad" (equivale al clic derecho)
  const bar = document.createElement('div');
  bar.className = 'inv-touchbar';
  bar.innerHTML = '<button id="inv-half" type="button">½ Mitad</button><button id="inv-close" type="button">✕ Cerrar</button>';
  invEl.appendChild(bar);
  $('inv-half').addEventListener('click', (e) => { ui.half = !ui.half; e.currentTarget.classList.toggle('active', ui.half); });
  $('inv-close').addEventListener('click', () => { if (menuOpen) setMenu(false); });
}
function setMenu(open, mode = 'inv', extra = null) {
  if (state !== 'playing') return;
  menuOpen = open;
  invEl.style.display = open ? 'flex' : 'none';
  if (open) { sound.open(mode); ui.open(mode, extra); input.unlock(); overlay.style.display = 'none'; fitInventory(); }
  else {
    // Cerrar el inventario (E, Esc o clic afuera) vuelve directo al juego: NO abre el menú de pausa.
    // Si el navegador no deja recapturar el ratón (pasa al cerrar con Esc), queda un cartel "clic para continuar".
    sound.close(); ui.close(); saveNow(); overlay.style.display = 'none'; input.lock();
  }
  updateHint();
}
const hintEl = $('resumehint');
function updateHint() {
  const show = state === 'playing' && started && !input.locked && !menuOpen && overlay.style.display === 'none' && !touch;
  const v = show ? 'block' : 'none';
  if (hintEl.style.display !== v) hintEl.style.display = v;
}
invEl.addEventListener('mousedown', (e) => { if (e.target === invEl || e.target.classList.contains('invwrap')) { if (!ui.cursor) setMenu(false); } });

function wearHeld(amount = 1) {
  const i = inventory.selected, name = inventory.slots[i] ? nameOf(inventory.slots[i].id) : '';
  if (wear(inventory.slots, i, amount)) { sound.pop(); toast(`Se rompió: ${name}`); }
  hotbar.refresh();
}

let showHud = !embed;
hud.style.display = showHud ? 'block' : 'none';
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !e.repeat && (input.locked || menuOpen)) setMenu(!menuOpen);
  else if (e.code === 'Escape' && menuOpen) { e.preventDefault(); setMenu(false); }
  else if (e.code === 'KeyM' && !e.repeat) { const m = sound.toggleMute(); toast(m ? 'Sonido: apagado' : 'Sonido: encendido'); }
  else if (e.code === 'F3') { e.preventDefault(); showHud = !showHud; hud.style.display = showHud ? 'block' : 'none'; }
  else if (e.code === 'KeyG' && !e.repeat && input.locked) {
    creative = !creative;
    if (!creative) player.flying = false;
    refreshHearts(); refreshFood();
    toast(creative ? 'Modo creativo (doble espacio: volar)' : 'Modo supervivencia');
  }
});
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

// ---- Bucle principal ----
if (params.get('debug') === '1') window.__vx = { setMenu, ui, furnaces, player, world, inventory, input, store, generator, sound, pending, get tier() { return tierIdx; }, get streamR() { return streamR; }, saveNow };
let last = performance.now();
let fpsAcc = 0, fpsFrames = 0, fps = 0;
let timeOfDay = 0.06;
let caveK = 0;          // 0 = al aire libre … 1 = bajo tierra (suave)
let mine = null;        // { x, y, z, progress }
let stepDist = 0, wasInWater = false;
let attackCd = 0;
const UNDERWATER = [0.08, 0.18, 0.42];

let unloadTick = 0, borderToastAt = -1e9;
let wasOnGround = false, lastFoot = 0, swimT = 0, mineSfx = 0;
// Qué bloque suena bajo los pies: el agua si tenés los pies en el agua; si no, el de abajo.
function footId() {
  const x = Math.floor(player.pos[0]), z = Math.floor(player.pos[2]);
  if (world.getBlock(x, Math.floor(player.pos[1] + 0.1), z) === B.WATER) return B.WATER;
  return world.getBlock(x, Math.floor(player.pos[1] - 0.5), z);
}
// Luces dinámicas: las 12 fuentes más cercanas (antorchas, piedra luminosa, horno encendido, antorcha en mano).
const LIGHTS = new Float32Array(48);
function gatherLights(eye) {
  const pcx = Math.floor(eye[0] / CHUNK_SIZE), pcz = Math.floor(eye[2] / CHUNK_SIZE), cand = [];
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const c = world.getChunk(pcx + dx, pcz + dz);
    if (!c || !c.lights) continue;
    for (const l of c.lights) {
      const rx = l[0] - eye[0], ry = l[1] - eye[1], rz = l[2] - eye[2], d2 = rx * rx + ry * ry + rz * rz, r = l[3] + 12;
      if (d2 < r * r) cand.push([d2, rx, ry, rz, l[3]]);
    }
  }
  const held = inventory.selectedStack;
  if (held && held.id === B.TORCH) cand.push([0, 0, -0.3, 0, 10]);
  cand.sort((a, b) => a[0] - b[0]);
  const n = Math.min(12, cand.length);
  for (let i = 0; i < n; i++) { LIGHTS[i * 4] = cand[i][1]; LIGHTS[i * 4 + 1] = cand[i][2]; LIGHTS[i * 4 + 2] = cand[i][3]; LIGHTS[i * 4 + 3] = cand[i][4]; }
  return n;
}
function frame(now) {
  updateHint();
  const rawDt = (now - last) / 1000;
  const dt = Math.min(rawDt, 0.05);
  last = now;

  if (state === 'loading') {
    loadStep();
  } else {
    const sim = state === 'playing' && input.locked;
    let hit = null;
    const eye = player.eyePosition();
    const dir = lookDirection(player.yaw, player.pitch);

    if (perfAuto && tierIdx < TIERS.length - 1 && governor.update(rawDt, sim)) {
      applyTier(tierIdx + 1);
      toast(`Rendimiento ajustado: ${TIERS[tierIdx].name}`);
    }
    if (sim && now - lastSaveAt > 20000) saveNow(); // autoguardado

    if (sim) {
      timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
      const [mx, my] = input.consumeMouse();
      player.look(mx, my, CONFIG.mouseSensitivity);
      player.update(dt, input, world);

      // Daño por caída y sonidos de movimiento
      if (player.fallImpact > 1) sound.block(footId(), 'land'); // el golpe al caer suena según dónde caés
      if (player.fallImpact > 3) hurt(Math.floor(player.fallImpact - 3));
      player.fallImpact = 0;
      if (player.inWater && !wasInWater) sound.splash();
      wasInWater = player.inWater;
      // saltar: despegar del suelo hacia arriba (no cuenta caerse de un borde)
      if (wasOnGround && !player.onGround && player.vel[1] > 2 && !player.inWater && !player.flying) sound.block(lastFoot, 'jump');
      wasOnGround = player.onGround;
      lastFoot = footId();
      if (player.onGround && !player.flying) {
        stepDist += Math.hypot(player.vel[0], player.vel[2]) * dt;
        if (stepDist > (player.sprinting ? 2.1 : 1.6)) {
          stepDist = 0;
          if (!player.crouching) sound.block(lastFoot, 'step'); // agachado se camina sin hacer ruido
        }
      } else if (player.inWater && !player.onGround) { // nadando: una brazada cada tanto
        swimT += Math.hypot(player.vel[0], player.vel[2]) * dt;
        if (swimT > 2.2) { swimT = 0; sound.swim(); }
      }
      if (!creative) {
        regenT += dt;
        if (food >= 14 && hp < MAX_HP && regenT > 4) { hp++; regenT = 2.5; foodT += 4; refreshHearts(); }
        const moving = Math.hypot(player.vel[0], player.vel[2]) > 0.5;
        foodT += dt * (player.sprinting ? 2.5 : moving ? 1 : 0.35);
        if (foodT >= 30 && food > 0) { foodT = 0; food--; refreshFood(); }
        if (food === 0) { starveT += dt; if (starveT >= 4) { starveT = 0; if (hp > 1) hurt(1); } } else starveT = 0;
        if (food < 6) input.sprintLatch = false;
      }

      const act = input.consumeActions();
      if (act.fly && creative) { player.flying = !player.flying; player.vel[1] = 0; sound.fly(player.flying); }
      let changed = false;
      if (act.hotbar >= 0) { inventory.select(act.hotbar); changed = true; }
      if (act.wheel !== 0) { inventory.select(inventory.selected + act.wheel); changed = true; }
      if (changed) { hotbar.refresh(); hotbar.showName(); sound.select(); }

      hit = raycast(world, eye, dir, CONFIG.reach);
      if (act.pick && hit && creative) {
        const id = hit.id === B.TNT_FLASH ? B.TNT : isTorch(hit.id) ? B.TORCH : hit.id;
        let slot = -1;
        for (let i = 0; i < 9; i++) if (inventory.slots[i] && inventory.slots[i].id === id) slot = i;
        if (slot >= 0) inventory.select(slot);
        else inventory.slots[inventory.selected] = { id, count: 64 };
        hotbar.refresh(); hotbar.showName();
      }

      attackCd -= dt; actionCooldown -= dt;
      const mh = mobs.raycast(eye, dir, CONFIG.reach);
      const mobTarget = mh && (!hit || mh.dist < hit.dist) ? mh : null;
      if (mobTarget && act.click[0] && attackCd <= 0) {
        const tl = toolOf(inventory.selectedStack ? inventory.selectedStack.id : 0);
        mobs.damage(mobTarget.mob, tl ? tl.dmg : 1, player.pos[0], player.pos[2]);
        attackCd = 0.4; sound.pop(); hand.punch();
        if (!creative && tl) wearHeld(1);
      }
      const holdL = input.mouse.has(0) || act.click[0];
      const holdR = input.mouse.has(2) || act.click[2];
      if (hit && holdL && !mobTarget) {
        const def = BLOCKS[hit.id];
        if (hit.id === B.TNT && !player.crouching) {
          if (act.click[0]) ignite(hit.x, hit.y, hit.z, 3);
          mine = null;
        } else if (def.hardness >= 0) {
          if (!mine || mine.x !== hit.x || mine.y !== hit.y || mine.z !== hit.z) mine = { x: hit.x, y: hit.y, z: hit.z, progress: 0 };
          const info = mineInfo(def, inventory.selectedStack);
          mine.progress += creative ? 1 : dt / info.time;
          if (!creative && (mineSfx -= dt) <= 0) { mineSfx = 0.26; sound.block(hit.id, 'hit'); } // golpes mientras picás
          if (mine.progress >= 1 && actionCooldown <= 0) {
            const id = hit.id;
            const info2 = mineInfo(def, inventory.selectedStack);
            const drop = creative ? 0 : dropFor(id, info2.canHarvest);
            if (breakBlock(world, inventory, hit, { drop })) {
              if (id === B.FURNACE || id === B.FURNACE_ON) furnaces.dropAll(hit.x, hit.y, hit.z, inventory);
              if (!creative && def.hardness > 0) wearHeld(1);
              particles.burst(hit.x, hit.y, hit.z, id, 16, 3.5);
              sound.block(id, 'break');
              if (drop) sound.pickup(0.12);
              actionCooldown = creative ? 0.15 : 0.05;
              hotbar.refresh();
            }
            mine = null;
          }
        }
      } else mine = null;
      if (!input.mouse.has(0)) mine = null;

      const heldFood = !creative && inventory.selectedStack ? foodOf(inventory.selectedStack.id) : 0;
      if (heldFood && food < MAX_FOOD && act.click[2]) {
        food = Math.min(MAX_FOOD, food + heldFood); foodT = 0; refreshFood();
        inventory.removeFromSlot(inventory.selected, 1);
        sound.pickup(0.3); hand.punch(); hotbar.refresh();
      } else if (hit && act.click[2] && hit.id === B.BED && !player.crouching) {
        bed = [hit.x, hit.y, hit.z];
        if (skyState(timeOfDay).night) {
          timeOfDay = 0.02; mobs.clear(); sound.close();
          if (!creative) { food = Math.max(0, food - 2); refreshFood(); }
          toast('Dormiste hasta el amanecer · punto de reaparición guardado');
          saveNow();
        } else toast('Solo podés dormir de noche · punto de reaparición guardado');
      } else if (hit && act.click[2] && hit.id === B.CRAFTING && !player.crouching) {
        setMenu(true, 'table');
      } else if (hit && act.click[2] && (hit.id === B.FURNACE || hit.id === B.FURNACE_ON) && !player.crouching) {
        setMenu(true, 'furnace', furnaces.get(hit.x, hit.y, hit.z, true));
      } else if (hit && holdR && actionCooldown <= 0) {
        const stack = inventory.selectedStack;
        const sid = stack ? stack.id : 0;
        if (placeBlock(world, inventory, player, hit)) {
          sound.block(sid, 'place'); hand.punch();
          actionCooldown = ACTION_DELAY; hotbar.refresh();
        }
      }

      hand.update(dt, Math.hypot(player.vel[0], player.vel[2]), !!(hit && holdL && mine), inventory.selectedStack ? inventory.selectedStack.id : 0);
      updateTNT(dt);
      furnaces.update(dt, world);
      particles.update(dt, world);
      mobs.update(dt, world, player, skyState(timeOfDay).night && !creative, hurt, particles,
        () => { const n = 1 + (Math.random() < 0.4 ? 1 : 0); if (inventory.add(I.RAW_MEAT, n) < n) sound.pickup(0.2); hotbar.refresh(); });
    } else {
      input.consumeMouse();
      input.consumeActions();
      if (state === 'playing' && menuOpen) { furnaces.update(dt, world); ui.tick(); } // el horno sigue trabajando con la interfaz abierta
    }

    // ---- Mundo: generar lo que se acerca, descargar lo lejano, avisar del borde ----
    if (state === 'playing') {
      streamWorld(3);
      if (++unloadTick % 90 === 0) unloadFar();
      if ((Math.abs(player.pos[0]) > WORLD_LIM - 1.2 || Math.abs(player.pos[2]) > WORLD_LIM - 1.2) && now - borderToastAt > 6000) {
        borderToastAt = now; toast('Llegaste al borde del mundo');
      }
    }

    // ---- Dibujo ----
    meshDirty(6);
    const st = skyState(timeOfDay);
    let sky = st.sky, light = st.light, fogStart = maxDist * 0.6, fogEnd = maxDist;
    const eyeBlock = world.getBlock(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    { // ¿hay roca sobre tu cabeza? el cielo y la niebla se oscurecen bajo tierra
      const ex = Math.floor(eye[0]), ez = Math.floor(eye[2]), ey = Math.floor(eye[1]);
      let hy = CHUNK_HEIGHT - 1;
      while (hy > ey && !IS_OPAQUE[world.getBlock(ex, hy, ez)]) hy--;
      const tgt = hy > ey ? Math.min(1, (hy - ey + 1) / 7) : 0;
      caveK += (tgt - caveK) * Math.min(1, dt * 2.5);
      if (caveK > 0.01) sky = sky.map((v) => v * (1 - 0.92 * caveK));
    }
    if (eyeBlock === B.WATER) {
      sky = UNDERWATER.map((v) => v * (0.35 + 0.65 * st.light));
      fogStart = 0; fogEnd = 22;
    }
    entBatch.reset(); crackBatch.reset();
    particles.draw(entBatch); mobs.draw(entBatch);
    handBatch.reset();
    if (state === 'playing' && !menuOpen && input.locked) { const hs = inventory.selectedStack; hand.draw(handBatch, eye, player.yaw, player.pitch, hs ? hs.id : 0); }
    const nL = gatherLights(eye);
    if (mine && mine.progress > 0.02) crackBatch.blockShell(mine.x, mine.y, mine.z, TILES.CRACK0 + Math.min(9, Math.floor(mine.progress * 10)));

    shake = Math.max(0, shake - dt * 1.6);
    const sx = shake ? (Math.random() - 0.5) * shake * 0.06 : 0;
    const sy = shake ? (Math.random() - 0.5) * shake * 0.06 : 0;
    renderer.render(
      world,
      { pos: eye, yaw: player.yaw + sx, pitch: player.pitch + sy },
      {
        sky, fogStart, fogEnd, light, fov: CONFIG.fov + (player.sprinting ? 6 : 0), maxDist: maxDist + CHUNK_SIZE,
        highlight: sim ? hit : null, sunDir: st.sunDir, sunAngle: st.sunAngle, stars: eyeBlock === B.WATER ? 0 : st.stars,
        entities: entBatch, overlay: crackBatch, hand: handBatch, lights: LIGHTS, nLights: nL,
      }
    );

    hurtFlash = Math.max(0, hurtFlash - dt);
    $('hurt').style.opacity = hurtFlash > 0 ? String(Math.min(0.55, hurtFlash)) : '0';

    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) {
      fps = Math.round(fpsFrames / fpsAcc);
      fpsAcc = 0; fpsFrames = 0;
      if (showHud) {
        const p = player.pos, s = renderer.stats;
        hud.textContent =
          `FPS ${fps}\n` +
          `XYZ ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${p[2].toFixed(1)}\n` +
          `Chunks ${s.chunksDrawn}/${s.chunksTotal}  Tri ${Math.round(s.triangles / 1000)}k\n` +
          `Bioma ${BIOME_NAMES[generator.biomeAt(Math.floor(p[0]), Math.floor(p[2]))]}\n` +
          `Hora ${timeLabel(timeOfDay)}  ${creative ? 'Creativo' : 'Supervivencia'}\n` +
          `Calidad ${TIERS[tierIdx].name}${perfAuto ? ' (auto)' : ''}${touch ? '  touch' : ''}\n` +
          `Seed ${seedText}`;
      }
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__voxelia = { world, player, renderer, inventory, CONFIG, CHUNK_HEIGHT, blast, setTime: (t) => { timeOfDay = t; } };
