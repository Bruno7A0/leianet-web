// Renderer WebGL2: atlas, shaders, VAO por chunk, frustum culling y pase translúcido (agua).
import { generateAtlas, ATLAS_SIZE, TILE_PX } from '../blocks/atlas.js';
import { CHUNK_SIZE as S, CHUNK_HEIGHT as H } from '../world/constants.js';
import {
  mat4Perspective, mat4Multiply, mat4View, extractFrustumPlanes, aabbInFrustum,
} from '../utils/math.js';
import { FLOATS_PER_VERTEX } from './mesher.js';
import { quadIndices } from './batch.js';

const DEEP_NEAR = 30; // bloques: dentro de esta distancia horizontal también se dibuja lo subterráneo

const VERT = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in float a_shade;
uniform mat4 u_viewProj;   // proyección * rotación de cámara (sin traslación)
uniform vec3 u_offset;     // origen del chunk - posición de la cámara (precisión en mundos grandes)
centroid out vec2 v_uv;   // centroid: con MSAA, las muestras en el borde no se salen del tile y no traen el color del tile vecino
out float v_shade;
out float v_dist;
out vec3 v_rel;
void main() {
  vec3 rel = a_pos + u_offset;
  v_rel = rel;
  v_uv = a_uv;
  v_shade = a_shade;
  v_dist = length(rel);
  gl_Position = u_viewProj * vec4(rel, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;   // mediump (fp16 en móviles) hace que el muestreo del atlas se corra de texel y "sangre" de tiles vecinos
centroid in vec2 v_uv;
in float v_shade;
in float v_dist;
in vec3 v_rel;
uniform vec4 u_lights[12];  // xyz relativo a la cámara, w = radio
uniform int u_nl;
uniform sampler2D u_atlas;
uniform vec3 u_fogColor;
uniform vec2 u_fog;
uniform float u_light;
uniform int u_pass;
uniform float u_a2c;      // 1 = el borde de hojas/vidrio lo suaviza el multimuestreo (alpha-to-coverage)
out vec4 o;
void main() {
  vec4 t = texture(u_atlas, v_uv);
  if (u_pass == 0) {
    if (u_a2c > 0.5) { if (t.a < 0.02) discard; }          // alpha-to-coverage: el alfa pasa a cobertura de muestras
    else { if (t.a < 0.5) discard; t.a = 1.0; }
  }
  else if (t.a < 0.01) discard;
  float em = step(50.0, v_shade);          // sombra >= 10 marca bloques emisivos (brillan de noche)
  float rest = v_shade - em * 100.0;
  float lvl = floor(rest / 2.0);          // nivel de oscuridad de cueva 0..4 (+2 por nivel); el resto es la sombra de la cara
  float sh = rest - lvl * 2.0;
  float cave = lvl / 7.0;
  float lc = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= u_nl) break;
    float k = clamp(1.0 - length(v_rel - u_lights[i].xyz) / u_lights[i].w, 0.0, 1.0);
    lc += k * k;
  }
  float night = mix(1.0 - clamp((u_light - 0.24) / 0.76, 0.0, 1.0) * 0.8, 1.0, cave);
  float amb = mix(u_light, 0.07, cave);   // bajo tierra no entra el sol: sólo queda la luz de antorchas
  vec3 c = t.rgb * sh * (mix(amb, 1.0, em) + vec3(1.0, 0.94, 0.84) * min(lc, 1.25) * night);
  float f = clamp((v_dist - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
  o = vec4(mix(c, u_fogColor, f), t.a);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Error de shader: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 no está disponible en este navegador/GPU.');
    this.gl = gl;
    this.canvas = canvas;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.u = {};
    for (const n of ['u_viewProj', 'u_offset', 'u_atlas', 'u_fogColor', 'u_fog', 'u_light', 'u_pass', 'u_a2c', 'u_lights', 'u_nl']) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }

    this._initHighlight(gl);
    this._initSky(gl);
    this._initDynamic(gl);

    // Texture atlas (generado por código)
    this.atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ATLAS_SIZE, ATLAS_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, generateAtlas());
    // De cerca se ven los píxeles nítidos (NEAREST); de lejos se promedian con mipmaps (sin parpadeo ni bordes
    // dentados). Cada tile mide 16 px, así que hasta el nivel 4 un texel nunca mezcla dos tiles distintos.
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, Math.log2(TILE_PX));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // (sin filtrado anisotrópico: sus muestras se salen del tile y traen el color del tile vecino a los bordes)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.msaa = null;
    // Muestras de MSAA: por defecto 4. Se puede cambiar con ?msaa=0 (apagado), 2, 4 u 8.
    const want = Number(new URLSearchParams(location.search).get('msaa') ?? 4) || 0;
    this.maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 0;
    this.samples = Math.min(want, this.maxSamples);
    this.dprCap = 2;

    this.proj = new Float32Array(16);
    this.view = new Float32Array(16);
    this.vp = new Float32Array(16);
    this.planes = new Float32Array(24);
    this.stats = { chunksDrawn: 0, chunksTotal: 0, triangles: 0 };
    this.resize();
  }

  // Contorno (12 aristas) del bloque apuntado.
  _initHighlight(gl) {
    const vs = `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_viewProj;
uniform vec3 u_offset;
void main() { gl_Position = u_viewProj * vec4(a_pos + u_offset, 1.0); }`;
    const fs = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(0.0, 0.0, 0.0, 1.0); }`;
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(prog));
    const e = 0.003, a = -e, b = 1 + e;
    const c = [[a, a, a], [b, a, a], [b, a, b], [a, a, b], [a, b, a], [b, b, a], [b, b, b], [a, b, b]];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const data = new Float32Array(edges.length * 6);
    edges.forEach(([i, j], k) => { data.set(c[i], k * 6); data.set(c[j], k * 6 + 3); });
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);
    this.hl = {
      prog, vao, count: edges.length * 2,
      uVP: gl.getUniformLocation(prog, 'u_viewProj'),
      uOff: gl.getUniformLocation(prog, 'u_offset'),
    };
  }


  // Cielo: sol y luna (cuadrados) + estrellas. Se dibuja antes que el terreno, sin profundidad.
  _initSky(gl) {
    const vs = `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_viewProj;
uniform float u_rot;
uniform float u_point;
void main() {
  vec3 p = a_pos;
  if (u_point > 0.0) {
    float c = cos(u_rot), s = sin(u_rot);
    p = vec3(c * a_pos.x - s * a_pos.y, s * a_pos.x + c * a_pos.y, a_pos.z);
  }
  gl_Position = u_viewProj * vec4(p, 1.0);
  gl_PointSize = 2.5;
}`;
    const fs = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 o;
void main() { o = u_color; }`;
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(prog));
    const stars = new Float32Array(400 * 3);
    let seed = 12345;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 400; i++) {
      const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      stars.set([Math.cos(a) * r * 300, Math.sin(a) * r * 300, z * 300], i * 3);
    }
    const mk = (data) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
      gl.bindVertexArray(null);
      return { vao, vbo };
    };
    this.sky = {
      prog, stars: mk(stars), quad: mk(new Float32Array(12)),
      uVP: gl.getUniformLocation(prog, 'u_viewProj'), uRot: gl.getUniformLocation(prog, 'u_rot'),
      uPoint: gl.getUniformLocation(prog, 'u_point'), uColor: gl.getUniformLocation(prog, 'u_color'),
    };
  }

  _drawBody(gl, dir, size, color) {
    // Cuadrado orientado hacia la cámara, a distancia 300 en la dirección `dir`.
    const d = Math.hypot(dir[0], dir[1], dir[2]);
    const n = [dir[0] / d, dir[1] / d, dir[2] / d];
    let u = [n[1], -n[0], 0]; // perpendicular a n, horizontal
    const ul = Math.hypot(u[0], u[1]) || 1; u = [u[0] / ul, u[1] / ul, 0];
    const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const R = 300, h = size;
    const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [
      n[0] * R + (u[0] * a + v[0] * b) * h, n[1] * R + (u[1] * a + v[1] * b) * h, n[2] * R + (u[2] * a + v[2] * b) * h]);
    const data = new Float32Array([...P[0], ...P[1], ...P[2], ...P[3]]);
    gl.bindVertexArray(this.sky.quad.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sky.quad.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.uniform4f(this.sky.uColor, color[0], color[1], color[2], color[3]);
    gl.uniform1f(this.sky.uPoint, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  }

  _drawSky(gl, env) {
    const k = this.sky, sd = env.sunDir;
    if (!sd) return;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(k.prog);
    gl.uniformMatrix4fv(k.uVP, false, this.vp);
    if (env.stars > 0.01) {
      gl.bindVertexArray(k.stars.vao);
      gl.uniform1f(k.uPoint, 1);
      gl.uniform1f(k.uRot, env.sunAngle);
      gl.uniform4f(k.uColor, 1, 1, 1, env.stars);
      gl.drawArrays(gl.POINTS, 0, 400);
    }
    gl.uniform1f(k.uRot, 0);
    this._drawBody(gl, sd, 28, [1, 0.95, 0.55, 1]);
    this._drawBody(gl, [-sd[0], -sd[1], -sd[2]], 20, [0.88, 0.9, 0.95, 1]);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.bindVertexArray(null);
  }

  // Buffers dinámicos para entidades, partículas y grietas.
  _initDynamic(gl) {
    this.dyn = {};
    for (const name of ['entities', 'overlay', 'hand']) {
      const max = name === 'entities' ? 8000 : name === 'hand' ? 640 : 64;
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, max * 4 * FLOATS_PER_VERTEX * 4, gl.DYNAMIC_DRAW);
      const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices(max), gl.STATIC_DRAW);
      const stride = FLOATS_PER_VERTEX * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 20);
      gl.bindVertexArray(null);
      this.dyn[name] = { vao, vbo };
    }
  }

  _drawBatch(gl, name, batch, cam, pass) {
    if (!batch || batch.n === 0) return 0;
    const d = this.dyn[name];
    gl.uniform1i(this.u.u_pass, pass);
    gl.uniform3f(this.u.u_offset, -cam[0], -cam[1], -cam[2]);
    gl.bindVertexArray(d.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, d.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.v, 0, batch.n * 4 * FLOATS_PER_VERTEX);
    gl.drawElements(gl.TRIANGLES, batch.n * 6, gl.UNSIGNED_INT, 0);
    return batch.n * 2;
  }

  // Calidad en caliente: { msaa: muestras (0 = apagado), dpr: tope de resolución }.
  setQuality({ msaa, dpr }) {
    if (dpr) this.dprCap = dpr;
    if (msaa !== undefined) this.samples = Math.min(msaa, this.maxSamples);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this._ensureTarget();
  }

  // Framebuffer propio con multimuestreo (MSAA 4x): suaviza los bordes de los bloques aunque el navegador
  // no active el antialiasing del canvas. Al final de cada cuadro se copia (blit) a la pantalla.
  _ensureTarget() {
    const gl = this.gl, w = this.canvas.width, h = this.canvas.height;
    const t = this.msaa;
    if (t && t.w === w && t.h === h && t.s === this.samples) return;
    if (t) { gl.deleteFramebuffer(t.fbo); gl.deleteRenderbuffer(t.color); gl.deleteRenderbuffer(t.depth); this.msaa = null; }
    if (this.samples < 2 || w < 1 || h < 1) return;
    const color = gl.createRenderbuffer(), depth = gl.createRenderbuffer(), fbo = gl.createFramebuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, color);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.RGB8, w, h); // mismo formato que el canvas (alpha:false), si no el blit falla
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { gl.deleteFramebuffer(fbo); gl.deleteRenderbuffer(color); gl.deleteRenderbuffer(depth); this.samples = 0; return; }
    this.msaa = { fbo, color, depth, w, h, s: this.samples };
  }

  _makePass(gl) {
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    const stride = FLOATS_PER_VERTEX * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 20);
    gl.bindVertexArray(null);
    return { vao, vbo, ibo, count: 0 };
  }

  _freePass(p) {
    const gl = this.gl;
    gl.deleteVertexArray(p.vao); gl.deleteBuffer(p.vbo); gl.deleteBuffer(p.ibo);
  }

  // Sube (o reutiliza) los buffers de un chunk.
  uploadChunk(chunk, mesh) {
    const gl = this.gl;
    if (!chunk.gpu) chunk.gpu = { opaque: null, blend: null, deep: null };
    for (const name of ['opaque', 'blend', 'deep']) {
      const m = mesh[name];
      let p = chunk.gpu[name];
      if (m.indices.length === 0) {
        if (p) { this._freePass(p); chunk.gpu[name] = null; }
        continue;
      }
      if (!p) p = chunk.gpu[name] = this._makePass(gl);
      gl.bindVertexArray(p.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, m.vertices, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.indices, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(null);
      p.count = m.indices.length;
    }
  }

  releaseChunk(chunk) {
    if (!chunk.gpu) return;
    if (chunk.gpu.opaque) this._freePass(chunk.gpu.opaque);
    if (chunk.gpu.blend) this._freePass(chunk.gpu.blend);
    if (chunk.gpu.deep) this._freePass(chunk.gpu.deep);
    chunk.gpu = null;
  }

  // cam: { pos:[x,y,z], yaw, pitch }; env: { sky:[r,g,b], fogStart, fogEnd, light, fov, maxDist }
  render(world, cam, env) {
    const gl = this.gl;
    this.resize();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa ? this.msaa.fbo : null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(env.sky[0], env.sky[1], env.sky[2], 1);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    mat4Perspective((env.fov * Math.PI) / 180, aspect, 0.05, 1000, this.proj);
    mat4View([0, 0, 0], cam.yaw, cam.pitch, this.view);
    mat4Multiply(this.proj, this.view, this.vp);
    extractFrustumPlanes(this.vp, this.planes);

    this._drawSky(gl, env);

    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(this.u.u_atlas, 0);
    gl.uniformMatrix4fv(this.u.u_viewProj, false, this.vp);
    gl.uniform3fv(this.u.u_fogColor, env.sky);
    gl.uniform2f(this.u.u_fog, env.fogStart, env.fogEnd);
    gl.uniform1f(this.u.u_light, env.light);
    gl.uniform4fv(this.u.u_lights, env.lights || new Float32Array(48));
    gl.uniform1i(this.u.u_nl, env.nLights || 0);
    const a2c = this.msaa ? 1 : 0;
    gl.uniform1f(this.u.u_a2c, a2c);

    const [cx, cy, cz] = cam.pos;
    const visible = [];
    let total = 0;
    for (const chunk of world.chunks.values()) {
      if (!chunk.gpu) continue;
      total++;
      const minx = chunk.cx * S - cx, minz = chunk.cz * S - cz, miny = -cy;
      if (env.maxDist) {
        const mx = minx + S / 2, mz = minz + S / 2;
        if (mx * mx + mz * mz > env.maxDist * env.maxDist) continue;
      }
      if (!aabbInFrustum(this.planes, minx, miny, minz, minx + S, miny + H, minz + S)) continue;
      const d = (minx + 8) ** 2 + (minz + 8) ** 2;
      // Lo subterráneo se dibuja si estás bajo la superficie del chunk o cerca (para ver bien las bocas de cueva y tus pozos).
      visible.push({ chunk, ox: minx, oy: miny, oz: minz, d, deep: cy < (chunk.splitY || 0) + 3 || d < DEEP_NEAR * DEEP_NEAR });
    }

    let tris = 0;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    // Pase opaco (con recorte alfa para hojas y vidrio)
    if (a2c) gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.uniform1i(this.u.u_pass, 0);
    for (const v of visible) {
      const p = v.chunk.gpu.opaque;
      if (!p) continue;
      gl.uniform3f(this.u.u_offset, v.ox, v.oy, v.oz);
      gl.bindVertexArray(p.vao);
      gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_INT, 0);
      tris += p.count / 3;
      const dp = v.deep ? v.chunk.gpu.deep : null;
      if (dp) {
        gl.bindVertexArray(dp.vao);
        gl.drawElements(gl.TRIANGLES, dp.count, gl.UNSIGNED_INT, 0);
        tris += dp.count / 3;
      }
    }

    // Entidades y partículas (opacas, con recorte alfa)
    tris += this._drawBatch(gl, 'entities', env.entities, cam.pos, 0);

    if (a2c) gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);

    // Pase translúcido (agua): de lejos a cerca, sin escribir profundidad
    gl.uniform1i(this.u.u_pass, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    visible.sort((a, b) => b.d - a.d);
    for (const v of visible) {
      const p = v.chunk.gpu.blend;
      if (!p) continue;
      gl.uniform3f(this.u.u_offset, v.ox, v.oy, v.oz);
      gl.bindVertexArray(p.vao);
      gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_INT, 0);
      tris += p.count / 3;
    }
    // Grieta del bloque que se está rompiendo
    tris += this._drawBatch(gl, 'overlay', env.overlay, cam.pos, 1);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    // Contorno del bloque apuntado (env.highlight = {x,y,z} o null)
    if (env.highlight) {
      const h = this.hl;
      gl.disable(gl.CULL_FACE);
      gl.useProgram(h.prog);
      gl.uniformMatrix4fv(h.uVP, false, this.vp);
      gl.uniform3f(h.uOff, env.highlight.x - cx, env.highlight.y - cy, env.highlight.z - cz);
      gl.bindVertexArray(h.vao);
      gl.drawArrays(gl.LINES, 0, h.count);
    }
    if (env.hand && env.hand.n) { // mano: encima de todo, sin atravesar paredes
      gl.disable(gl.CULL_FACE);
      gl.useProgram(this.prog);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      tris += this._drawBatch(gl, 'hand', env.hand, cam.pos, 0);
    }
    gl.bindVertexArray(null);

    if (this.msaa) { // resolver el multimuestreo hacia la pantalla
      const { w, h } = this.msaa;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaa.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    this.stats.chunksDrawn = visible.length;
    this.stats.chunksTotal = total;
    this.stats.triangles = tris;
  }
}
