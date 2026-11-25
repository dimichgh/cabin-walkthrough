// A generic mid-size SUV, modelled in code (no brand, no reference model): a lofted body whose cross-section is
// driven by side-profile curves (sill, wheel arches, belt line, hood → windshield → roof → tailgate), glass where
// the greenhouse is, plus wheels, lamps, bumpers, mirrors and roof rails. Feet; local +x is the front.
import * as THREE from 'three';

const L = 15.4, xF = 4.75, xR = -4.65, RW = 1.17, TW = 0.78;   // length, front / rear axle, wheel radius, tyre width
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const halfW = (x) => 3.1 - 0.62 * Math.pow(Math.max(0, x - 5.6) / 2.1, 2) - 0.28 * Math.pow(Math.max(0, -x - 6.2) / 1.5, 2);
const arch = (x) => { let y = 0.95; for (const a of [xF, xR]) { const d = Math.abs(x - a); if (d < 1.5) y = Math.max(y, 1.17 + Math.sqrt(1.5 * 1.5 - d * d)); } return y; };
const bottom = (x) => Math.max(arch(x), 0.95 + 0.45 * ss(6.4, L / 2, x) + 0.4 * ss(-6.6, -L / 2, x));
const belt = (x) => 3.42 + 0.14 * (1 - (x + L / 2) / L);
// top profile: bumper → hood → windshield → roof → rear glass → tailgate
function top(x) {
  if (x > 6.9) return 2.85 + (L / 2 - x) / (L / 2 - 6.9) * 0.45;            // nose
  if (x > 2.3) return 3.3 + (6.9 - x) / 4.6 * 0.35;                         // hood
  if (x > -0.1) return 3.65 + ss(2.3, -0.1, x) * 1.75;                      // windshield
  if (x > -5.9) return 5.4 - 0.08 * ((-0.1 - x) / 5.8);                     // roof
  return 5.32 - ss(-5.9, -L / 2, x) * 0.55;                                 // rear glass / tailgate top
}
const roofHalf = (x) => halfW(x) - 0.58;

export function buildCar(k) {
  const N = 72, ring = [];
  const stations = Array.from({ length: N + 1 }, (_, i) => -L / 2 + L * (i / N));
  // section points for the right side (h = +z), bottom centre → top centre
  function section(x) {
    const w = halfW(x), b = bottom(x), t = top(x), be = Math.min(belt(x), t - 0.06), g = ss(be + 0.1, be + 0.9, t), th = roofHalf(x);
    const lerp = (p, q) => [p[0] + (q[0] - p[0]) * g, p[1] + (q[1] - p[1]) * g];
    return [[0, b], [w - 0.28, b], [w, b + 0.32], [w, be - 0.42], [w - 0.05, be],
      lerp([w - 0.12, t - 0.05], [th + 0.12, t - 0.3]), lerp([w - 0.5, t], [th - 0.28, t]), [0, t]];
  }
  for (const x of stations) {
    const p = section(x), full = [...p, ...p.slice(1, 7).reverse().map(([h, y]) => [-h, y])]; // 14 points, closed
    ring.push(full.map(([h, y]) => new THREE.Vector3(x, y, h)));
  }
  const S = ring[0].length;
  // which material a quad gets: glass in the greenhouse, black sill, paint elsewhere
  const winX = [-6.75, 1.95], bPil = -1.15, cPil = -4.15, wsX = [-0.1, 2.3], rwX = [-L / 2 + 0.35, -5.9];
  function matOf(xm, s) {
    const side = Math.min(s, 13 - s); // fold the left side onto the right: 0 bottom … 6 roof centre
    if (side <= 1) return 'carblack';
    if (side === 4) return xm > winX[0] && xm < winX[1] && Math.abs(xm - bPil) > 0.28 && Math.abs(xm - cPil) > 0.22 ? 'carglass' : xm > winX[0] && xm < winX[1] ? 'carblack' : 'carpaint';
    if (side >= 5 && ((xm > wsX[0] + 0.12 && xm < wsX[1] - 0.05) || (xm > rwX[0] && xm < rwX[1] - 0.1))) return 'carglass';
    return 'carpaint';
  }
  const by = { carpaint: [], carglass: [], carblack: [] };
  for (let i = 0; i < N; i++) for (let s = 0; s < S; s++) {
    const a = ring[i][s], b = ring[i + 1][s], c = ring[i + 1][(s + 1) % S], d = ring[i][(s + 1) % S];
    by[matOf((a.x + b.x) / 2, s)].push(a, b, c, a, c, d);
  }
  for (const [mat, pts] of Object.entries(by)) {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = mergeVertices(g); m.computeVertexNormals(); k.geo(mat, m);
  }
  // end caps: tailgate (−x) and nose (+x)
  for (const [i, sign] of [[0, -1], [N, 1]]) {
    const r = ring[i], c = r.reduce((v, p) => v.add(p), new THREE.Vector3()).multiplyScalar(1 / S), pts = [];
    for (let s = 0; s < S; s++) { const A = r[s], B = r[(s + 1) % S]; sign < 0 ? pts.push(c, A, B) : pts.push(c, B, A); }
    const g = new THREE.BufferGeometry().setFromPoints(pts); g.computeVertexNormals(); k.geo('carpaint', g);
  }
  // underbody block, so the arches read as wheel wells and not a tunnel
  k.box('carblack', -L / 2 + 0.9, L / 2 - 0.9, 0.8, 2.3, -(halfW(0) - 0.98), halfW(0) - 0.98);
  // wheels: rounded tyre, five-spoke alloy, dark inner face
  const tyre = new THREE.LatheGeometry([[0.82, -TW / 2], [1.08, -TW / 2 - 0.01], [RW - 0.02, -TW / 2 + 0.08], [RW, 0], [RW - 0.02, TW / 2 - 0.08], [1.08, TW / 2 + 0.01], [0.82, TW / 2]].map(([r, y]) => new THREE.Vector2(r, y)), 36);
  tyre.rotateX(Math.PI / 2);
  for (const x of [xF, xR]) for (const sz of [-1, 1]) {
    const z = sz * (halfW(0) - 0.47);
    k.geo('tire', tyre.clone().translate(x, RW, z));
    k.push(x, RW, z + sz * (TW / 2 - 0.06), 0, 1, sz > 0 ? 90 : -90); // local +y now points outward along ±z
    k.cyl('rim', 0, 0, 0.84, -0.12, 0.0, { seg: 32 });
    k.cyl('carblack', 0, 0, 0.7, 0.0, 0.03, { seg: 28 });
    k.cyl('rim', 0, 0, 0.2, 0.0, 0.1, { seg: 16 });
    for (let j = 0; j < 5; j++) { const a = j * Math.PI * 2 / 5; k.push(0, 0.05, 0, a * 180 / Math.PI); k.box('rim', -0.09, 0.09, -0.02, 0.06, 0.15, 0.74); k.pop(); }
    k.pop();
  }
  // lamps, grille, bumpers, mirrors, handles, roof rails
  const xn = L / 2;
  k.box('carblack', xn - 0.25, xn + 0.03, 1.45, 2.35, -1.55, 1.55);                    // grille
  for (const sz of [-1, 1]) {
    k.box('carlight', xn - 0.55, xn - 0.02, 2.4, 2.66, sz * 1.25 - 0.62, sz * 1.25 + 0.62); // headlamps
    k.box('taillight', -xn - 0.03, -xn + 0.4, 3.35, 3.7, sz * 2.05 - 0.55, sz * 2.05 + 0.55);
    k.rbox('carpaint', 1.75, 3.88, sz * (halfW(1.75) + 0.28), 0.55, 0.38, 0.5, 0.12);   // mirrors
    k.box('carblack', 1.5, 1.95, 3.68, 3.74, sz * (halfW(1.75) + 0.05), sz * (halfW(1.75) + 0.3));
    for (const hx of [0.3, -2.75]) k.box('carlight', hx - 0.35, hx, 3.12, 3.2, sz * halfW(hx) - 0.02, sz * halfW(hx) + 0.03); // door handles
    k.rod('carblack', [-5.5, 5.47, sz * (roofHalf(-3) - 0.35)], [-0.6, 5.5, sz * (roofHalf(-1) - 0.35)], 0.05, { seg: 8 }); // roof rails
  }
  k.box('taillight', -xn - 0.02, -xn + 0.3, 3.5, 3.58, -1.5, 1.5);
  k.box('carblack', xn - 0.45, xn + 0.06, 1.0, 1.55, -2.55, 2.55);                     // front bumper
  k.box('carblack', -xn - 0.06, -xn + 0.45, 1.05, 1.75, -2.6, 2.6);                     // rear bumper
  k.box('carlight', -xn - 0.04, -xn, 2.05, 2.75, -0.95, 0.95);                         // plate
  k.solid(-L / 2, L / 2, 0, 5.6, -halfW(0) - 0.4, halfW(0) + 0.4);
}

// weld coincident points so the loft shades smoothly within each material
function mergeVertices(g) {
  const pos = g.attributes.position, map = new Map(), verts = [], idx = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let j = map.get(key); if (j === undefined) { j = verts.length / 3; map.set(key, j); verts.push(pos.getX(i), pos.getY(i), pos.getZ(i)); }
    idx.push(j);
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); out.setIndex(idx); return out;
}
