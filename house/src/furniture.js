// Illustrative furniture, light fixtures and the night lighting plan. Nothing here comes from the drawings: the
// upper-floor plans were not published, so pieces are placed to suit the rooms the sections fix and to keep the
// circulation (and the test walking routes) clear. Furniture and lamps carry opt 'furniture' (toggle F); built-in
// fixtures (pendants, downlights, sconces, bollards, the fire) are always present and light up at dusk / night.
import * as THREE from 'three';
import { makeKit } from './kit.js';
import { LV } from './house.js';

const { FFB, FF1, FF2, TERR, GRADE } = LV;
const C2 = 19.9, CG = 18.6, CS = 19.2, C1 = FF2 - 1.0, CB = FF1 - 1.0; // ceiling heights: main box, gallery, suite, first floor, basement

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function buildFurniture(M) {
  const k = makeKit();
  const lights = [];
  // light spec: point or spot; level for cutaways; opt so lamps vanish with the furniture
  const point = (at, I, K = 2700, o = {}) => lights.push({ type: 'point', at: at.toArray ? at.toArray() : at, I, K, level: o.level ?? k.level, opt: o.opt !== undefined ? o.opt : k.opt });
  const spot = (at, to, I, K = 3000, o = {}) => lights.push({ type: 'spot', at, to, I, K, angle: o.angle ?? 0.62, penumbra: o.penumbra ?? 0.6, radius: o.radius ?? 0.12, level: o.level ?? k.level, opt: null });

  /* ───────── pieces (local frame: origin on the floor, front faces +z) ───────── */
  function sofa(len, depth = 3.2, o = {}) {
    const fab = o.mat || 'linen', armW = 0.55, n = Math.max(2, Math.round((len - 2 * armW) / 2.6)), sw = (len - 2 * armW) / n;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(o.legs || 'darkwood', sx * (len / 2 - 0.35), sz * (depth / 2 - 0.3), 0.07, 0, 0.42, { r1: 0.09, seg: 10 });
    k.rbox(fab, 0, 0.75, 0, len, 0.62, depth, 0.12);                                                  // base
    k.rbox(fab, 0, 1.55, -depth / 2 + 0.22, len, 1.6, 0.44, 0.16);                                    // back frame
    for (const sx of [-1, 1]) k.rbox(fab, sx * (len / 2 - armW / 2), 1.42, 0, armW, 1.34, depth, 0.18); // arms
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + armW + sw * (i + 0.5);
      k.rbox(fab, x, 1.27, 0.32, sw - 0.04, 0.44, depth - 0.95, 0.14);                                // seat cushion
      k.push(x, 1.98, -depth / 2 + 0.72, 0, 1, -9); k.rbox(fab, 0, 0, 0, sw - 0.06, 1.3, 0.55, 0.2); k.pop(); // back cushion
    }
    k.push(-len / 2 + armW + 0.75, 2.0, -depth / 2 + 1.1, 18, 1, -14); k.rbox(o.p1 || 'accent', 0, 0, 0, 1.45, 1.4, 0.42, 0.18); k.pop();
    k.push(len / 2 - armW - 0.75, 1.95, -depth / 2 + 1.1, -14, 1, -12); k.rbox(o.p2 || 'pillow', 0, 0, 0, 1.35, 1.3, 0.4, 0.18); k.pop();
    if (o.throw !== false) { k.rbox('throw', len / 2 - armW / 2, 2.12, 0.25, armW + 0.12, 0.07, 1.5, 0.03); k.rbox('throw', len / 2 + 0.02, 1.6, 0.25, 0.07, 1.0, 1.5, 0.03); }
    k.solid(-len / 2, len / 2, 0, 2.4, -depth / 2, depth / 2);
  }
  function loungeChair(o = {}) {
    const wood = o.wood || 'lightwood', fab = o.mat || 'boucle';
    for (const sx of [-1, 1]) {
      k.rod(wood, [sx * 1.08, 0, 1.0], [sx * 1.08, 1.92, 0.75], 0.06);   // front leg up into the arm
      k.rod(wood, [sx * 1.08, 0, -1.05], [sx * 1.08, 1.92, -0.6], 0.06); // back leg
      k.box(wood, sx * 1.08 - 0.09, sx * 1.08 + 0.09, 1.9, 2.0, -1.0, 1.08); // armrest
      k.box(wood, sx * 1.08 - 0.05, sx * 1.08 + 0.05, 0.85, 1.0, -1.05, 1.0); // side rail
    }
    k.rbox(fab, 0, 1.18, 0.12, 2.05, 0.46, 2.0, 0.16);
    k.push(0, 2.15, -0.86, 0, 1, -16); k.rbox(fab, 0, 0, 0, 2.0, 1.9, 0.48, 0.2); k.pop();
    k.push(0.15, 1.72, -0.25, 12, 1, -10); k.rbox(o.p || 'pillow', 0, 0, 0, 1.2, 0.9, 0.35, 0.15); k.pop();
    k.solid(-1.25, 1.25, 0, 3, -1.25, 1.2);
  }
  function rug(w, d, mat = 'rugwool') { k.rbox(mat, 0, 0.025, 0, w, 0.05, d, 0.02, 2); }
  function coffeeTable(L = 4.2, W = 2.2, H = 1.25) {
    k.rbox('darkwood', 0, H - 0.07, 0, L, 0.14, W, 0.05, 2);
    for (const sx of [-1, 1]) { k.box('blackmetal', sx * (L / 2 - 0.35) - 0.06, sx * (L / 2 - 0.35) + 0.06, 0, H - 0.14, -W / 2 + 0.2, W / 2 - 0.2); k.box('blackmetal', sx * (L / 2 - 0.35) - 0.06, sx * (L / 2 - 0.35) + 0.06, 0, 0.06, -W / 2 + 0.15, W / 2 - 0.15); }
    k.rbox('books', -L / 4, H + 0.06, 0.1, 1.0, 0.12, 0.75, 0.01, 1); k.rbox('throw', -L / 4, H + 0.17, 0.12, 0.85, 0.1, 0.65, 0.01, 1);
    k.lathe('ceramic', [[0, 0], [0.18, 0.02], [0.24, 0.25], [0.15, 0.55], [0.08, 0.62], [0.09, 0.7], [0, 0.7]], L / 4, H, -0.15);
    k.solid(-L / 2, L / 2, 0, H, -W / 2, W / 2);
  }
  function sideTable(h = 1.8, r = 0.65) {
    k.cyl('stone', 0, 0, r, h - 0.1, h, { seg: 28 }); k.cyl('blackmetal', 0, 0, 0.06, 0.05, h - 0.1); k.cyl('blackmetal', 0, 0, 0.4, 0, 0.05, { seg: 24 });
    k.solid(-r, r, 0, h, -r, r);
  }
  // shade lamps: the light sits inside the shade; in photo mode the shade is translucent fabric
  function floorLamp(h = 5.3, I = 2.4) {
    k.cyl('blackmetal', 0, 0, 0.42, 0, 0.07, { seg: 24 }); k.cyl('brass', 0, 0, 0.035, 0.07, h - 0.7);
    k.cyl('shade', 0, 0, 0.72, h - 1.0, h, { r1: 0.58, open: true, seg: 28 });
    k.rod('brass', [0, h - 0.7, 0], [0, h - 0.5, 0], 0.05);
    point(k.at(0, h - 0.5, 0), I, 2700, { opt: 'furniture' });
    k.solid(-0.35, 0.35, 0, h, -0.35, 0.35);
  }
  function tableLamp(y, I = 1.4) {
    k.lathe('ceramic', [[0, 0], [0.32, 0], [0.38, 0.25], [0.3, 0.75], [0.12, 0.98], [0.06, 1.05], [0, 1.05]], 0, y, 0);
    k.cyl('brass', 0, 0, 0.025, y + 1.05, y + 1.35);
    k.cyl('shade', 0, 0, 0.62, y + 1.15, y + 1.9, { r1: 0.5, open: true, seg: 28 });
    point(k.at(0, y + 1.45, 0), I, 2700, { opt: 'furniture' });
  }
  function nightstand(withLamp = true) {
    k.rbox('darkwood', 0, 0.95, 0, 1.7, 1.9, 1.35, 0.05, 2); k.box('blackmetal', -0.75, 0.75, 1.15, 1.18, 0.66, 0.68);
    k.box('brass', -0.2, 0.2, 1.42, 1.47, 0.68, 0.72);
    if (withLamp) tableLamp(1.9);
    k.solid(-0.85, 0.85, 0, 1.9, -0.7, 0.7);
  }
  function diningTable(L = 6.2, W = 3.0) {
    k.rbox('darkwood', 0, 2.42, 0, L, 0.16, W, 0.05, 2);
    for (const sx of [-1, 1]) { // trestles
      k.box('darkwood', sx * (L / 2 - 0.9) - 0.12, sx * (L / 2 - 0.9) + 0.12, 0.1, 2.34, -0.12, 0.12);
      k.box('darkwood', sx * (L / 2 - 0.9) - 0.15, sx * (L / 2 - 0.9) + 0.15, 0, 0.12, -W / 2 + 0.25, W / 2 - 0.25);
      k.box('darkwood', sx * (L / 2 - 0.9) - 0.12, sx * (L / 2 - 0.9) + 0.12, 2.22, 2.34, -W / 2 + 0.3, W / 2 - 0.3);
    }
    k.box('darkwood', -L / 2 + 0.9, L / 2 - 0.9, 0.6, 0.76, -0.08, 0.08);
    k.lathe('ceramic', [[0, 0], [0.5, 0], [0.62, 0.12], [0.6, 0.2], [0, 0.2]], 0, 2.5, 0, { seg: 32 }); // bowl
    for (let i = 0; i < 3; i++) k.sphere('throw', -0.2 + i * 0.22, 2.68, (i % 2) * 0.15 - 0.05, 0.13, { seg: 12, rings: 8 });
    k.solid(-L / 2, L / 2, 0, 2.5, -W / 2, W / 2);
  }
  function diningChair(o = {}) {
    for (const [x, z] of [[-0.68, 0.62], [0.68, 0.62], [-0.62, -0.62], [0.62, -0.62]]) k.rod('lightwood', [x, 0, z], [x * 0.9, 1.5, z * 0.9], 0.055, { r1: 0.045 });
    k.rbox(o.seat || 'leather', 0, 1.56, 0.03, 1.5, 0.14, 1.45, 0.06, 2);
    const back = new THREE.CylinderGeometry(0.95, 0.95, 0.42, 20, 1, true, Math.PI - 0.95, 1.9);
    back.translate(0, 2.55, 0.22); k.geo('lightwood', back);
    for (const sx of [-1, 1]) k.rod('lightwood', [sx * 0.62, 1.55, -0.62], [sx * 0.66, 2.75, -0.5], 0.045);
    k.solid(-0.78, 0.78, 0, 2.8, -0.78, 0.75);
  }
  function barStool() {
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; k.rod('blackmetal', [Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62], [Math.cos(a) * 0.38, 2.38, Math.sin(a) * 0.38], 0.035); }
    const ring = new THREE.TorusGeometry(0.5, 0.025, 6, 28); ring.rotateX(Math.PI / 2); ring.translate(0, 0.9, 0); k.geo('blackmetal', ring);
    k.lathe('lightwood', [[0, 0], [0.62, 0], [0.66, 0.08], [0.62, 0.16], [0, 0.18]], 0, 2.38, 0, { seg: 28 });
    k.solid(-0.6, 0.6, 0, 2.55, -0.6, 0.6);
  }
  function bed(W = 5.3, L = 6.9) { // head at −z
    k.box('blackmetal', -W / 2 + 0.3, W / 2 - 0.3, 0, 0.28, -L / 2 + 0.4, L / 2 - 0.4);
    k.rbox('darkwood', 0, 0.72, 0, W + 0.35, 0.88, L + 0.2, 0.06, 2);
    k.rbox('bedding', 0, 1.5, 0.02, W, 0.78, L - 0.08, 0.2);
    k.rbox('bedding', 0, 1.95, L * 0.16, W + 0.28, 0.2, L * 0.7, 0.1);                                 // duvet
    k.rbox('bedding', 0, 1.62, L * 0.16, W + 0.3, 0.55, L * 0.7, 0.1);                                 // duvet drop
    k.rbox('throw', 0, 2.1, L / 2 - 0.85, W + 0.36, 0.1, 1.25, 0.04);
    for (const sx of [-1, 1]) {
      k.push(sx * W / 4, 2.3, -L / 2 + 0.75, 0, 1, -24); k.rbox('bedding', 0, 0, 0, W / 2 - 0.2, 1.35, 0.5, 0.22); k.pop();
      k.push(sx * W / 4.6, 2.2, -L / 2 + 1.25, -sx * 6, 1, -18); k.rbox(sx < 0 ? 'pillow' : 'accent', 0, 0, 0, 1.55, 1.1, 0.38, 0.18); k.pop();
    }
    k.rbox('linen', 0, 2.05, -L / 2 - 0.2, W + 0.7, 3.6, 0.4, 0.12);                                    // headboard
    k.solid(-W / 2 - 0.35, W / 2 + 0.35, 0, 2.3, -L / 2 - 0.4, L / 2 + 0.1);
  }
  function desk(L = 4.6, Dp = 2.0) {
    k.rbox('lightwood', 0, 2.42, 0, L, 0.1, Dp, 0.03, 2);
    for (const sx of [-1, 1]) { k.box('blackmetal', sx * (L / 2 - 0.12) - 0.05, sx * (L / 2 - 0.12) + 0.05, 0, 2.37, -Dp / 2 + 0.1, Dp / 2 - 0.1); k.box('blackmetal', sx * (L / 2 - 0.12) - 0.05, sx * (L / 2 - 0.12) + 0.05, 2.32, 2.37, -Dp / 2 + 0.1, Dp / 2 - 0.1); }
    k.rbox('books', L / 2 - 0.8, 2.55, -0.4, 0.9, 0.16, 0.65, 0.01, 1);
    k.solid(-L / 2, L / 2, 0, 2.5, -Dp / 2, Dp / 2);
  }
  // potted plant: a lathe pot and leaf blades on arching stems
  const leafGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.17, 0.12, 0.2, 0.42, 0, 0.62); s.bezierCurveTo(-0.2, 0.42, -0.17, 0.12, 0, 0); const g = new THREE.ShapeGeometry(s, 6); return g; })();
  function plant(h = 5, seed = 1, potR = 0.75) {
    const R = rng(seed);
    k.lathe('pot', [[0, 0.02], [potR * 0.8, 0], [potR, potR * 1.3], [potR * 0.94, potR * 1.32], [0, potR * 1.2]], 0, 0, 0, { seg: 26 });
    const top = potR * 1.25;
    for (let s = 0; s < 3; s++) {
      const a = s * 2.1 + R(), lean = 0.08 + R() * 0.12, hh = h * (0.75 + R() * 0.25);
      const end = [Math.cos(a) * lean * hh, top + hh, Math.sin(a) * lean * hh];
      k.rod('log', [0, top, 0], end, 0.035, { r1: 0.025 });
      const nL = 18;
      for (let i = 0; i < nL; i++) {
        const t = 0.25 + 0.75 * (i / nL), px = end[0] * t, py = top + (end[1] - top) * t, pz = end[2] * t;
        const g = leafGeo.clone(), sc = 0.9 + R() * 0.8; g.scale(sc, sc, sc);
        g.rotateX(-0.6 - R() * 0.9); g.rotateY(R() * Math.PI * 2); g.translate(px, py, pz); k.geo('leaf', g);
      }
    }
    k.solid(-potR, potR, 0, top + 1.5, -potR, potR);
  }
  function bookshelf(w = 3.8, h = 7, d = 1.1) {
    const sh = 5, sp = (h - 0.4) / sh;
    for (const sx of [-1, 1]) k.box('lightwood', sx * w / 2 - 0.05, sx * w / 2 + 0.05, 0, h, -d / 2, d / 2);
    for (let i = 0; i <= sh; i++) k.box('lightwood', -w / 2, w / 2, 0.2 + i * sp - 0.04, 0.2 + i * sp + 0.04, -d / 2, d / 2);
    k.box('lightwood', -w / 2, w / 2, 0, h, -d / 2, -d / 2 + 0.05);
    for (let i = 0; i < sh; i++) {
      const y0 = 0.24 + i * sp, bh = sp - 0.14, bw = w - 0.2 - (i % 2) * 0.9;
      const face = new THREE.PlaneGeometry(bw, bh); const uv = face.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * bw, uv.getY(j));
      face.translate(-w / 2 + 0.1 + bw / 2, y0 + bh / 2, d / 2 - 0.12); k.geo('books', face, { uv: 'keep' });
      k.box('darkwood', -w / 2 + 0.1, -w / 2 + 0.1 + bw, y0, y0 + bh * 0.96, -d / 2 + 0.1, d / 2 - 0.13);
      if (i % 2) k.lathe('ceramic', [[0, 0], [0.2, 0], [0.25, 0.3], [0.1, 0.6], [0, 0.6]], w / 2 - 0.5, y0, 0);
    }
    k.solid(-w / 2, w / 2, 0, h, -d / 2, d / 2);
  }
  function art(w, h, mat) { // framed canvas on a wall; local front +z, origin at the wall surface, centre height in y
    k.box('blackmetal', -w / 2 - 0.08, w / 2 + 0.08, -h / 2 - 0.08, h / 2 + 0.08, 0, 0.1);
    const c = new THREE.PlaneGeometry(w, h); c.translate(0, 0, 0.11); k.geo(mat, c, { uv: 'keep' });
  }
  function tv() { k.rbox('tv', 0, 0, 0, 4.1, 2.35, 0.1, 0.03, 1); }
  function console_(L = 6, Dp = 1.5, H = 1.7) {
    k.rbox('darkwood', 0, H / 2 + 0.25, 0, L, H - 0.25, Dp, 0.04, 2);
    k.box('blackmetal', -L / 2 + 0.2, L / 2 - 0.2, 0, 0.25, -Dp / 2 + 0.2, Dp / 2 - 0.2);
    for (let i = 1; i < 4; i++) k.box('blackmetal', -L / 2 + i * L / 4 - 0.01, -L / 2 + i * L / 4 + 0.01, 0.35, H - 0.05, Dp / 2, Dp / 2 + 0.01);
    k.solid(-L / 2, L / 2, 0, H, -Dp / 2, Dp / 2);
  }
  function poolTable() {
    const L = 7.6, W = 4.2;
    k.rbox('darkwood', 0, 2.25, 0, L, 0.7, W, 0.06, 2);
    k.box('felt', -L / 2 + 0.45, L / 2 - 0.45, 2.6, 2.66, -W / 2 + 0.45, W / 2 - 0.45);
    for (const s of [-1, 1]) { k.box('felt', -L / 2 + 0.45, L / 2 - 0.45, 2.6, 2.78, s * (W / 2 - 0.45) - (s > 0 ? 0.12 : 0), s * (W / 2 - 0.45) + (s < 0 ? 0.12 : 0)); k.box('felt', s * (L / 2 - 0.45) - (s > 0 ? 0.12 : 0), s * (L / 2 - 0.45) + (s < 0 ? 0.12 : 0), 2.6, 2.78, -W / 2 + 0.45, W / 2 - 0.45); }
    k.box('darkwood', -L / 2, L / 2, 2.6, 2.85, W / 2 - 0.45, W / 2); k.box('darkwood', -L / 2, L / 2, 2.6, 2.85, -W / 2, -W / 2 + 0.45);
    k.box('darkwood', -L / 2, -L / 2 + 0.45, 2.6, 2.85, -W / 2, W / 2); k.box('darkwood', L / 2 - 0.45, L / 2, 2.6, 2.85, -W / 2, W / 2);
    for (const [x, z] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) k.cyl('carblack', x * (L / 2 - 0.4), z * (W / 2 - 0.4), 0.17, 2.6, 2.87, { seg: 12 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.rbox('darkwood', sx * (L / 2 - 0.7), 0.95, sz * (W / 2 - 0.6), 0.55, 1.9, 0.55, 0.05, 2);
    const cols = ['carpaint', 'throw', 'ceramic', 'accent', 'tire', 'brass', 'leather'];
    let i = 0; for (let r = 0; r < 4; r++) for (let c = 0; c <= r; c++) k.sphere(cols[i++ % cols.length], 1.6 + r * 0.2, 2.75, (c - r / 2) * 0.23, 0.1, { seg: 12, rings: 8 });
    k.sphere('ceramic', -1.9, 2.75, 0.2, 0.1, { seg: 12, rings: 8 });
    k.solid(-L / 2, L / 2, 0, 2.9, -W / 2, W / 2);
  }
  function teakChair() {
    for (const sx of [-1, 1]) { k.box('teak', sx * 1.1 - 0.1, sx * 1.1 + 0.1, 0, 1.75, -1.25, 1.2); k.box('teak', sx * 1.1 - 0.12, sx * 1.1 + 0.12, 1.75, 1.85, -1.3, 1.25); }
    k.box('teak', -1.0, 1.0, 0.7, 0.85, -1.2, 1.15);
    k.rbox('cushion', 0, 1.1, 0.1, 2.0, 0.5, 2.1, 0.15);
    k.push(0, 1.95, -1.0, 0, 1, -14); k.rbox('cushion', 0, 0, 0, 1.95, 1.7, 0.45, 0.18); k.pop();
    k.solid(-1.25, 1.25, 0, 2.6, -1.35, 1.3);
  }
  // fixtures (not furniture: always present)
  function globePendant(x, z, ceil, drop, r = 0.48, I = 3.2) {
    k.cyl('blackmetal', x, z, 0.28, ceil - 0.08, ceil, { seg: 20 }); k.cyl('blackmetal', x, z, 0.012, ceil - drop + r, ceil - 0.08, { seg: 6 });
    k.cyl('brass', x, z, 0.07, ceil - drop + r - 0.02, ceil - drop + r + 0.12, { seg: 14 });
    k.sphere('globe', x, ceil - drop, z, r, { seg: 28, rings: 18 });
    point([x, ceil - drop, z], I, 2700);
  }
  function domePendant(x, z, ceil, drop, R = 1.0, I = 4.5) {
    k.cyl('blackmetal', x, z, 0.3, ceil - 0.08, ceil); k.cyl('blackmetal', x, z, 0.012, ceil - drop + 0.75, ceil - 0.08, { seg: 6 });
    const y = ceil - drop;
    k.lathe('brass', [[0.06, 0.78], [0.25, 0.72], [0.62, 0.48], [0.86, 0.22], [R, 0.0], [R - 0.03, 0.0], [0.83, 0.2], [0.6, 0.44], [0.24, 0.68], [0.05, 0.74]], x, y, z, { seg: 40 });
    k.cyl('lamp', x, z, 0.22, y + 0.38, y + 0.5, { seg: 16 });
    point([x, y + 0.3, z], I, 2700);
  }
  function downlight(x, z, ceil, to, I = 9, o = {}) {
    k.cyl('blackmetal', x, z, 0.32, ceil - 0.02, ceil + 0.005, { seg: 20 }); k.cyl('lamp', x, z, 0.2, ceil - 0.03, ceil - 0.015, { seg: 16 });
    spot([x, ceil - 0.25, z], to || [x + 0.01, ceil - 10, z], I, o.K || 3000, o);
  }

  /* ═════════════ SECOND FLOOR · living, dining, kitchen (indicative) ═════════════ */
  k.level = '2';
  k.opt = 'furniture';
  k.push(6.9, FF2, 1.2); rug(9.0, 8.8); k.pop();
  k.push(9.5, FF2, 1.6, -90); sofa(7.4, 3.2); k.pop();
  k.push(3.4, FF2, -1.6, 40); loungeChair(); k.pop();
  k.push(3.4, FF2, 4.4, 140); loungeChair({ p: 'accent' }); k.pop();
  k.push(5.9, FF2, 1.4, 90); coffeeTable(4.2, 2.2); k.pop();
  k.push(1.4, FF2, 6.6); floorLamp(5.4, 2.4); k.pop();
  k.push(9.4, FF2, -2.95); sideTable(1.85, 0.6); tableLamp(1.85, 1.3); k.pop();
  k.push(1.3, FF2, -4.6); plant(5.2, 3); k.pop();
  k.push(15.6, FF2, 0.4, 90); diningTable(6.2, 3.0); k.pop();
  for (const z of [-1.6, 0.4, 2.4]) { k.push(13.75, FF2, z, 90); diningChair(); k.pop(); k.push(17.45, FF2, z, -90); diningChair(); k.pop(); }
  for (const x of [19.6, 21.0]) { k.push(x, FF2, 4.15, 180); barStool(); k.pop(); }
  k.push(15.6, FF2 + 5.4, 8.53, 180); art(3.6, 2.8, 'art1'); k.pop();
  k.push(26.5, FF2 + 3.05, -4.2); k.lathe('ceramic', [[0, 0], [0.35, 0], [0.4, 0.2], [0, 0.22]], 0, 0, 0); k.sphere('throw', 0, 0.3, 0, 0.14, { seg: 10, rings: 8 }); k.sphere('accent', 0.18, 0.28, 0.1, 0.13, { seg: 10, rings: 8 }); k.pop();
  k.opt = null;
  globePendant(20.3, -1.5, C2, 3.7); globePendant(20.3, 1.5, C2, 3.7);
  domePendant(15.6, 0.4, C2, 4.2);
  downlight(6.5, 1.2, C2, null, 7, { angle: 0.75 }); downlight(26.4, 0.0, C2, null, 7, { angle: 0.7 });
  downlight(14.5, 11.0, C2, [14.5, FF1, 11.0], 9, { angle: 0.7 }); // down the stair well

  /* screened patio */
  k.opt = 'furniture';
  k.push(4.2, FF2, -12.6, -90); teakChair(); k.pop();
  k.push(4.2, FF2, -9.4, -90); teakChair(); k.pop();
  k.push(4.4, FF2, -11.0); sideTable(1.5, 0.5); k.pop();
  k.push(12.3, FF2, -13.8); plant(3.4, 11, 0.6); k.pop();
  k.opt = null;
  { const x = 7.0, z = -10.5; k.cyl('blackmetal', x, z, 0.012, 19.0, C2, { seg: 6 }); k.cyl('shade', x, z, 0.62, 18.2, 19.0, { r1: 0.62, open: true, seg: 28 }); k.cyl('lamp', x, z, 0.55, 18.95, 19.0, { seg: 24 }); point([x, 18.4, z], 2.6, 2700); }

  /* rooms 201 · 203 (indicative bedroom and study) */
  k.opt = 'furniture';
  k.push(5.6, FF2, 25.0); rug(8.6, 9.0); k.pop();
  k.push(4.25, FF2, 25.0, 90); bed(5.3, 6.9); k.pop();
  k.push(1.35, FF2, 21.15, 90); nightstand(); k.pop();
  k.push(1.35, FF2, 28.85, 90); nightstand(false); k.pop();
  k.push(20.0, FF2, 30.8, 180); desk(4.6, 1.9); k.pop();
  k.push(20.0, FF2, 29.4); diningChair({ seat: 'lightwood' }); k.pop();
  k.push(26.6, FF2, 30.6); plant(4.4, 7); k.pop();
  k.push(15.8, FF2 + 5.2, 31.78, 180); art(3.0, 3.6, 'art3'); k.pop();
  k.opt = null;
  downlight(12.0, 24.5, C2, null, 7, { angle: 0.8 });

  /* gallery */
  k.opt = 'furniture';
  k.push(28.42, FF2 + 5.3, 26.0, 90); art(3.4, 4.2, 'art2'); k.pop();
  k.push(33.72, FF2 + 5.0, 13.6, -90); art(2.6, 3.2, 'art3'); k.pop();
  k.push(32.9, FF2, 27.5, -90); k.rbox('lightwood', 0, 1.45, 0, 4.4, 0.15, 1.3, 0.04, 2); for (const sx of [-1, 1]) k.box('blackmetal', sx * 1.8 - 0.06, sx * 1.8 + 0.06, 0, 1.38, -0.5, 0.5); k.solid(-2.2, 2.2, 0, 1.5, -0.65, 0.65); k.pop();
  k.opt = null;
  downlight(30.4, 26.0, CG, [28.4, FF2 + 5, 26.0], 8, { angle: 0.5 }); downlight(31.8, 13.6, CG, [33.9, FF2 + 5, 13.6], 7, { angle: 0.5 });

  /* apartment suite (indicative) */
  k.opt = 'furniture';
  k.push(40.0, FF2, 16.1); rug(9.0, 7.4); k.pop();
  k.push(37.4, FF2, 16.0, 90); sofa(5.8, 3.0, { p1: 'pillow', p2: 'throw', throw: false }); k.pop();
  k.push(40.7, FF2, 16.0); k.cyl('darkwood', 0, 0, 1.25, 1.15, 1.3, { seg: 36 }); k.cyl('darkwood', 0, 0, 0.75, 0, 1.15, { r1: 0.6, seg: 30 }); k.solid(-1.25, 1.25, 0, 1.3, -1.25, 1.25); k.pop();
  k.push(43.5, FF2, 13.6, -60); loungeChair({ mat: 'linen', wood: 'darkwood' }); k.pop();
  k.push(37.0, FF2, 12.0); floorLamp(5.2, 2.2); k.pop();
  k.push(50.0, FF2, 16.5); k.cyl('stone', 0, 0, 1.4, 2.35, 2.47, { seg: 36 }); k.cyl('blackmetal', 0, 0, 0.08, 0.06, 2.35); k.cyl('blackmetal', 0, 0, 0.7, 0, 0.06, { seg: 24 }); k.solid(-1.4, 1.4, 0, 2.47, -1.4, 1.4); k.pop();
  k.push(48.55, FF2, 16.5, 90); diningChair(); k.pop(); k.push(51.45, FF2, 16.5, -90); diningChair(); k.pop();
  k.push(52.0, FF2, 27.5, 180); bed(5.3, 6.9); k.pop();
  k.push(48.0, FF2, 30.6); nightstand(); k.pop(); k.push(56.0, FF2, 30.6); nightstand(); k.pop();
  k.push(57.9, FF2, 10.4); plant(5.0, 5); k.pop();
  k.push(59.08, FF2 + 4.8, 26.8, -90); art(2.4, 3.0, 'art1'); k.pop();
  k.opt = null;
  globePendant(50.0, 16.5, CS, 4.4, 0.42, 2.6);
  downlight(50.0, 10.4, CS, null, 6, { angle: 0.6 });

  /* ═════════════ FIRST FLOOR ═════════════ */
  k.level = '1';
  k.opt = 'furniture';
  k.push(5.1, FF1, 4.0); rug(7.6, 5.8); k.pop();
  k.push(3.4, FF1, 4.0, 90); loungeChair({ mat: 'leather' }); k.pop();
  k.push(7.4, FF1, 4.0, -90); loungeChair(); k.pop();
  k.push(5.35, FF1, 4.0); sideTable(1.7, 0.7); k.pop();
  k.push(1.4, FF1, 6.9, 90); bookshelf(3.8, 7.0, 1.0); k.pop();
  k.push(2.4, FF1, 1.6); floorLamp(5.3, 2.2); k.pop();
  k.push(24.6, FF1, 1.4); plant(4.6, 9); k.pop();
  // guest room (indicative)
  k.push(8.0, FF1, 27.55, 180); bed(4.8, 6.9); k.pop();
  k.push(4.15, FF1, 30.6); nightstand(); k.pop(); k.push(11.85, FF1, 30.6); nightstand(false); k.pop();
  k.push(15.0, FF1 + 4.7, 31.42, 180); art(2.6, 2.0, 'art2'); k.pop();
  // hallway bench
  k.push(33.0, FF1, 21.0, -90); k.rbox('darkwood', 0, 1.45, 0, 4.0, 0.14, 1.2, 0.04, 2); for (const sx of [-1, 1]) k.box('darkwood', sx * 1.7 - 0.1, sx * 1.7 + 0.1, 0, 1.38, -0.5, 0.5); k.solid(-2.0, 2.0, 0, 1.5, -0.6, 0.6); k.pop();
  k.push(33.75, FF1 + 4.6, 21.0, -90); art(2.4, 2.8, 'art1'); k.pop();
  k.opt = null;
  downlight(12.0, 4.5, C1, null, 6, { angle: 0.85 }); downlight(31.2, 20.0, C1, null, 5, { angle: 0.75 }); downlight(31.2, 12.0, C1, null, 4, { angle: 0.7 });
  downlight(15.0, 24.0, C1, null, 6, { angle: 0.85 });

  /* ═════════════ BASEMENT · gathering 001 ═════════════ */
  k.level = 'B';
  k.opt = 'furniture';
  k.push(9.0, FFB, 25.8); rug(9.2, 8.8); k.pop();
  k.push(8.8, FFB, 23.5); sofa(7.6, 3.1, { p1: 'throw', p2: 'pillow' }); k.pop();
  k.push(6.45, FFB, 26.6, 90); sofa(3.2, 2.9, { throw: false, p1: 'pillow', p2: 'accent' }); k.pop();
  k.push(10.3, FFB, 27.0); coffeeTable(3.6, 2.4, 1.2); k.pop();
  k.push(9.5, FFB, 30.75, 180); console_(6.4, 1.3, 1.7); k.pop();
  k.push(9.5, FFB + 3.4, 31.38, 180); tv(); k.pop();
  k.push(26.3, FFB, 24.4); poolTable(); k.pop();
  k.push(32.3, FFB, 30.6); plant(4.6, 13); k.pop();
  k.push(21.8, FFB + 4.8, 31.45, 180); art(3.8, 2.4, 'art3'); k.pop();
  k.opt = null;
  { // billiard pendant: one long shade, one light
    const x = 26.3, z = 24.4, y = FFB + 5.55;
    for (const sx of [-1, 1]) k.cyl('blackmetal', x + sx * 1.8, z, 0.012, y + 0.4, CB, { seg: 6 });
    k.box('blackmetal', x - 2.4, x + 2.4, y + 0.3, y + 0.42, z - 0.35, z + 0.35);
    k.box('blackmetal', x - 2.4, x + 2.4, y, y + 0.3, z - 0.35, z - 0.33); k.box('blackmetal', x - 2.4, x + 2.4, y, y + 0.3, z + 0.33, z + 0.35);
    k.box('lamp', x - 2.3, x + 2.3, y + 0.05, y + 0.1, z - 0.3, z + 0.3);
    point([x, y - 0.1, z], 4.0, 2700);
  }
  downlight(9.0, 25.5, CB, null, 5, { angle: 0.85 }); downlight(22.5, 5.0, CB, null, 4, { angle: 0.8 }); downlight(16.5, 15.2, CB, null, 4, { angle: 0.8 });
  downlight(4.2, 9.0, CB, null, 4, { angle: 0.85, K: 4000 });                       // mechanical 003

  /* ═════════════ EXTERIOR · terrace, fire, wall lights, bollards ═════════════ */
  k.level = '1';
  k.opt = 'furniture';
  k.push(2.6, TERR, -11.0, 125); teakChair(); k.pop();
  k.push(12.6, TERR, -12.2, -125); teakChair(); k.pop();
  k.opt = null;
  // firewood on the hearth, and a fire that lights up at dusk / night
  for (let i = 0; i < 7; i++) k.rod('log', [4.45, 1.48 + (i % 3) * 0.24 + Math.floor(i / 3) * 0.02, -13.85 + (i % 3) * 0.04 + Math.floor(i / 3) * 0.26], [5.35, 1.48 + (i % 3) * 0.24, -13.85 + Math.floor(i / 3) * 0.26], 0.12, { seg: 8 });
  k.rod('log', [6.2, 1.5, -13.55], [7.9, 1.5, -13.7], 0.15, { seg: 9 }); k.rod('log', [6.4, 1.5, -13.75], [7.8, 1.52, -13.45], 0.14, { seg: 9 }); k.rod('log', [7.05, 1.75, -13.45], [7.05, 1.75, -13.8], 0.12, { seg: 8 });
  k.box('ember', 6.1, 8.0, 1.36, 1.44, -13.92, -13.3);
  for (const [x, h, r] of [[6.5, 0.95, 0.2], [6.85, 1.3, 0.22], [7.2, 1.55, 0.26], [7.6, 1.0, 0.2], [7.05, 0.8, 0.3]]) k.lathe('flame', [[0, 0], [r * 0.8, 0.1], [r, h * 0.3], [r * 0.6, h * 0.65], [0.02, h]], x, 1.55, -13.6, { seg: 14, uv: 'keep' });
  point([7.05, 2.3, -12.95], 3.6, 1900, { level: '1' });
  // wall lights at the entry and beside the garage door
  k.box('lamp', 26.96, 26.99, 6.25, 6.85, 8.28, 8.42); point([27.5, 6.5, 8.35], 1.1, 2700);
  k.box('lamp', 59.96, 59.99, 3.45, 4.05, 11.63, 11.77); point([60.5, 3.75, 11.7], 1.1, 2700);
  // soffit downlights over the covered terrace
  downlight(8.0, -8.5, LV.FF2 - 1.0, [8.01, TERR, -8.5], 7, { angle: 0.8, K: 2700 }); downlight(20.0, -8.5, LV.FF2 - 1.0, [20.01, TERR, -8.5], 7, { angle: 0.8, K: 2700 });
  k.level = '1'; downlight(42.0, 20.5, C1, null, 24, { angle: 1.0, K: 4000 }); downlight(52.0, 20.5, C1, null, 24, { angle: 1.0, K: 4000 }); // garage ceiling
  // path bollards along the north edge of the entry court
  k.level = 'site';
  for (const x of [40.5, 48.5, 56.5]) {
    const z = -3.7; k.cyl('blackmetal', x, z, 0.22, GRADE, GRADE + 2.3, { seg: 16 }); k.cyl('lamp', x, z, 0.2, GRADE + 1.85, GRADE + 2.15, { seg: 16 }); k.cyl('blackmetal', x, z, 0.26, GRADE + 2.25, GRADE + 2.4, { seg: 16 });
    k.solid(x - 0.25, x + 0.25, GRADE, GRADE + 2.4, z - 0.25, z + 0.25);
    point([x, GRADE + 2.0, z + 0.65], 0.5, 2700);
  }

  const meshes = k.finish(M);
  return { meshes, colliders: k.colliders, lights };
}
