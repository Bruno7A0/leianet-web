// Matemática 3D mínima: matrices column-major (formato WebGL), cámara y frustum.

export function mat4Perspective(fovy, aspect, near, far, out = new Float32Array(16)) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

// out = a * b
export function mat4Multiply(a, b, out = new Float32Array(16)) {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[c * 4 + k];
      r[c * 4 + row] = s;
    }
  }
  out.set(r);
  return out;
}

// Dirección hacia donde mira la cámara. yaw=0 mira hacia -Z.
export function lookDirection(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

// Matriz de vista (lookAt) a partir de posición, yaw y pitch.
export function mat4View(eye, yaw, pitch, out = new Float32Array(16)) {
  const f = lookDirection(yaw, pitch);
  const r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const u = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  out[0] = r[0]; out[1] = u[0]; out[2] = -f[0]; out[3] = 0;
  out[4] = r[1]; out[5] = u[1]; out[6] = -f[1]; out[7] = 0;
  out[8] = r[2]; out[9] = u[2]; out[10] = -f[2]; out[11] = 0;
  out[12] = -dot(r, eye); out[13] = -dot(u, eye); out[14] = dot(f, eye); out[15] = 1;
  return out;
}

// Extrae los 6 planos del frustum (normalizados) de una matriz viewProj.
export function extractFrustumPlanes(m, planes = new Float32Array(24)) {
  const row = (i) => [m[i], m[4 + i], m[8 + i], m[12 + i]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  const combos = [
    [r3, r0, 1], [r3, r0, -1],
    [r3, r1, 1], [r3, r1, -1],
    [r3, r2, 1], [r3, r2, -1],
  ];
  for (let i = 0; i < 6; i++) {
    const [a, b, s] = combos[i];
    let x = a[0] + s * b[0], y = a[1] + s * b[1], z = a[2] + s * b[2], w = a[3] + s * b[3];
    const len = Math.hypot(x, y, z) || 1;
    planes[i * 4] = x / len; planes[i * 4 + 1] = y / len;
    planes[i * 4 + 2] = z / len; planes[i * 4 + 3] = w / len;
  }
  return planes;
}

// true si la AABB intersecta (o está dentro de) el frustum.
export function aabbInFrustum(planes, minx, miny, minz, maxx, maxy, maxz) {
  for (let i = 0; i < 6; i++) {
    const a = planes[i * 4], b = planes[i * 4 + 1], c = planes[i * 4 + 2], d = planes[i * 4 + 3];
    const px = a >= 0 ? maxx : minx;
    const py = b >= 0 ? maxy : miny;
    const pz = c >= 0 ? maxz : minz;
    if (a * px + b * py + c * pz + d < 0) return false;
  }
  return true;
}
