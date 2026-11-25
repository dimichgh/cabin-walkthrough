// Procedural forest: spruces, pines, birches and shrubs. Every tree is real geometry: a tapered bark trunk,
// plus branch "fronds" (crossed alpha-cut cards) carrying needle or leaf textures drawn on canvases at startup.
// Each species has a few variants; the instances get random height, spin, lean and tint.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const UP = new THREE.Vector3(0, 1, 0);
function canvasTex(w, h, draw, { srgb = true, wrap = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* ───────── textures ───────── */
// a conifer frond: twig axis from the bottom centre (attachment) to the top (tip), side twigs, needles
function frondTex(seed, o) {
  const R = rng(seed);
  return canvasTex(256, 512, (g, w, h) => {
    g.lineCap = 'round';
    const twigs = [[w / 2, h - 2, -Math.PI / 2, h * 0.97, 1]];
    for (let t = 0.03; t < 0.93; t += o.spacing * (0.7 + R() * 0.6)) {
      for (const side of [-1, 1]) {
        const x0 = w / 2 + Math.sin(t * 4) * 4, y0 = h - 2 - t * h * 0.97;
        const len = w * 0.48 * Math.pow(1 - t, o.taper) * (0.7 + R() * 0.4);
        twigs.push([x0, y0, -Math.PI / 2 + side * (o.twigAngle + (R() - 0.5) * 0.35), len, 0.6]);
      }
    }
    // wood first
    for (const [x, y, a, len, wgt] of twigs) { g.strokeStyle = hsl(25, 30, 22); g.lineWidth = 2.6 * wgt + 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); }
    // needles: dark underlayer, mid, lit tips
    for (const [dl, lw, keep] of [[-10, 3.0, 1], [0, 2.1, 1], [10, 1.5, 0.45]]) {
      for (const [x0, y0, a, len] of twigs) {
        const n = Math.floor(len / o.density);
        for (let i = 1; i < n; i++) {
          if (R() > keep) continue;
          const s = i / n, x = x0 + Math.cos(a) * len * s, y = y0 + Math.sin(a) * len * s;
          for (const sd of [-1, 1]) {
            const na = a + sd * (o.needleAngle + (R() - 0.5) * 0.45), nl = o.needle * (0.65 + R() * 0.6) * (1 - s * 0.3);
            g.strokeStyle = hsl(o.hue + (R() - 0.5) * 14, o.sat + (R() - 0.5) * 12, o.light + dl + (R() - 0.5) * 8);
            g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(na) * nl, y + Math.sin(na) * nl); g.stroke();
          }
        }
      }
    }
  });
}
// a leafy spray for birches and shrubs
function leafTex(seed, o) {
  const R = rng(seed);
  return canvasTex(256, 256, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    g.strokeStyle = hsl(30, 20, 30); g.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) { const a = R() * Math.PI * 2, r = 70 + R() * 45; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a + 0.4) * r * 0.5, cy + Math.sin(a + 0.4) * r * 0.5, cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
    for (let i = 0; i < o.n; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 112, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const L = o.size * (0.7 + R() * 0.6), rot = R() * Math.PI, l = o.light + (R() - 0.5) * 16 + (y < cy ? 4 : -4);
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = hsl(o.hue + (R() - 0.5) * 16, o.sat + (R() - 0.5) * 12, l); g.beginPath(); g.ellipse(0, 0, L, L * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = hsl(o.hue, o.sat, l + 8, 0.5); g.beginPath(); g.ellipse(-L * 0.2, -L * 0.15, L * 0.6, L * 0.25, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  });
}
function barkTex(kind, seed) {
  const R = rng(seed);
  return canvasTex(128, 256, (g, w, h) => {
    if (kind === 'birch') {
      g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(40,36,32,${0.35 + R() * 0.5})`; const y = R() * h; g.fillRect(R() * w, y, 8 + R() * 30, 1 + R() * 3); }
      for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(25,22,20,.85)'; g.beginPath(); g.ellipse(R() * w, R() * h, 4 + R() * 9, 3 + R() * 7, 0, 0, 7); g.fill(); }
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(120,110,95,${R() * 0.15})`; g.fillRect(R() * w, R() * h, 2, 2); }
    } else {
      g.fillStyle = kind === 'pine' ? '#6e4630' : '#4f3a2c'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { const x = R() * w; g.strokeStyle = `rgba(20,12,8,${0.4 + R() * 0.4})`; g.lineWidth = 1 + R() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 16) g.lineTo(x + (R() - 0.5) * 6, y); g.stroke(); }
      for (let i = 0; i < 90; i++) { g.fillStyle = kind === 'pine' ? `rgba(160,100,60,${R() * 0.35})` : `rgba(120,100,80,${R() * 0.25})`; g.fillRect(R() * w, R() * h, 4 + R() * 12, 8 + R() * 22); }
    }
  }, { wrap: true });
}

/* ───────── geometry ───────── */
function cardBuilder() {
  const P = [], N = [], U = [], I = [];
  return {
    // a frond bending downward along its length; normals point away from the crown axis for soft shading
    frond(O, D, S, L, W, droop, crownY) {
      const base = P.length / 3;
      for (const s of [0, 0.5, 1]) {
        const c = O.clone().addScaledVector(D, L * s); c.y -= droop * L * s * s;
        const half = W / 2 * (1 - 0.2 * s);
        for (const side of [-1, 1]) {
          const p = c.clone().addScaledVector(S, side * half);
          P.push(p.x, p.y, p.z);
          const n = new THREE.Vector3(p.x, 0.55 * Math.hypot(p.x, p.z) + 0.35 * (p.y - crownY) + 0.05, p.z).normalize();
          N.push(n.x, n.y, n.z); U.push(side < 0 ? 0 : 1, s);
        }
      }
      for (let r = 0; r < 2; r++) { const a = base + r * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    },
    // a square leaf cluster card centred at C
    cluster(C, S, T, size, ctr) {
      const base = P.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const p = C.clone().addScaledVector(S, (u - 0.5) * size).addScaledVector(T, (v - 0.5) * size);
        P.push(p.x, p.y, p.z);
        const n = p.clone().sub(ctr); n.y += 0.15; n.normalize(); N.push(n.x, n.y, n.z); U.push(u, v);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    },
    geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); return g; },
  };
}
function trunkGeo(r0, r1, h, extra = []) {
  const parts = [];
  const t = new THREE.CylinderGeometry(r1, r0, h, 8, 4, true); t.translate(0, h / 2, 0);
  const uv = t.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * h * 14);
  parts.push(t);
  for (const [x, y, z, len, r, ax, ang] of extra) {
    const b = new THREE.CylinderGeometry(r * 0.4, r, len, 6, 1, true); b.translate(0, len / 2, 0);
    const m = new THREE.Matrix4().makeRotationAxis(ax, ang).setPosition(x, y, z); b.applyMatrix4(m);
    const u2 = b.attributes.uv; for (let i = 0; i < u2.count; i++) u2.setY(i, u2.getY(i) * len * 14);
    parts.push(b);
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
}
function frameAround(D) { const S1 = new THREE.Vector3().crossVectors(D, UP); if (S1.lengthSq() < 1e-6) S1.set(1, 0, 0); S1.normalize(); const S2 = new THREE.Vector3().crossVectors(D, S1).normalize(); return [S1, S2]; }

// spruce / fir: dense drooping whorls all the way down, narrow spire
function spruce(seed, lite) {
  const R = rng(seed), B = cardBuilder(), whorls = lite ? 9 : 15, h0 = 0.1, crownY = 0.45;
  for (let k = 0; k < whorls; k++) {
    const t = k / (whorls - 1), y = h0 + (0.95 - h0) * t, L = 0.25 * Math.pow(1 - t, 0.9) + 0.035;
    const nb = Math.max(3, Math.round(6 - t * 2)), a0 = R() * 6.28;
    for (let b = 0; b < nb; b++) {
      const a = a0 + b / nb * 6.28 + (R() - 0.5) * 0.6, droop = (0.45 - t * 0.3) * (0.7 + R() * 0.6);
      const D = new THREE.Vector3(Math.cos(a), -0.12 - droop * 0.35, Math.sin(a)).normalize();
      const O = new THREE.Vector3(Math.cos(a) * 0.006, y + (R() - 0.5) * 0.02, Math.sin(a) * 0.006);
      const [S1, S2] = frameAround(D); S1.applyAxisAngle(D, (R() - 0.5) * 0.7); S2.crossVectors(D, S1).normalize();
      const Ll = L * (0.85 + R() * 0.3);
      B.frond(O, D, S1, Ll, Math.max(0.05, Ll * 0.7), droop * 0.4, crownY);
      if (!lite || b % 2 === 0) B.frond(O, D, S2, Ll, Math.max(0.04, Ll * 0.5), droop * 0.4, crownY);
    }
  }
  B.frond(new THREE.Vector3(0, 0.9, 0), UP, new THREE.Vector3(1, 0, 0), 0.12, 0.06, 0, crownY);
  B.frond(new THREE.Vector3(0, 0.9, 0), UP, new THREE.Vector3(0, 0, 1), 0.12, 0.06, 0, crownY);
  return { leaves: B.geo(), trunk: trunkGeo(0.016, 0.003, 0.98) };
}
// pine: tall clear trunk, irregular open crown of upturned limbs with needle tufts
function pine(seed, lite) {
  const R = rng(seed), B = cardBuilder(), crownY = 0.78, extra = [];
  const n = lite ? 15 : 26;
  for (let k = 0; k < n; k++) {
    const t = R(), y = 0.52 + t * 0.44, a = R() * 6.28, reach = (0.12 + R() * 0.1) * (1 - t * 0.55);
    const lift = 0.15 + t * 0.6 + (R() - 0.5) * 0.3;
    const D = new THREE.Vector3(Math.cos(a), lift, Math.sin(a)).normalize();
    const O = new THREE.Vector3(Math.cos(a) * 0.01, y, Math.sin(a) * 0.01);
    if (R() < 0.6) extra.push([O.x, O.y, O.z, reach * 0.75, 0.0045, new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -Math.acos(Math.min(1, D.y))]);
    for (let j = 0; j < (lite ? 2 : 3); j++) { // tufts along the limb, splayed
      const s = 0.35 + j * (lite ? 0.45 : 0.3), C = O.clone().addScaledVector(D, reach * s);
      const Dj = D.clone().add(new THREE.Vector3((R() - 0.5) * 0.6, 0.15, (R() - 0.5) * 0.6)).normalize();
      const [S1, S2] = frameAround(Dj); S1.applyAxisAngle(Dj, R() * 3);  S2.crossVectors(Dj, S1).normalize();
      const L = 0.075 + R() * 0.05;
      B.frond(C, Dj, S1, L, L * 0.95, -0.05, crownY); B.frond(C, Dj, S2, L, L * 0.8, -0.05, crownY);
    }
  }
  return { leaves: B.geo(), trunk: trunkGeo(0.02, 0.005, 0.97, extra) };
}
// birch: slender pale trunk, a few ascending limbs, loose rounded crown of leaf sprays
function birch(seed, lite) {
  const R = rng(seed), B = cardBuilder(), ctr = new THREE.Vector3(0, 0.7, 0), extra = [];
  for (let i = 0; i < 4; i++) { const a = R() * 6.28, y = 0.4 + R() * 0.25; extra.push([0, y, 0, 0.32, 0.008, new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -(0.45 + R() * 0.3)]); }
  for (let i = 0; i < (lite ? 20 : 34); i++) {
    const a = R() * 6.28, r = Math.sqrt(R()), C = new THREE.Vector3(Math.cos(a) * r * 0.22, 0.48 + R() * 0.48, Math.sin(a) * r * 0.22);
    const D = C.clone().sub(ctr).normalize(); const [S1, S2] = frameAround(D.lengthSq() ? D : UP);
    const size = 0.13 + R() * 0.09;
    B.cluster(C, S1, S2, size, ctr); B.cluster(C, S1, D, size * 0.9, ctr);
  }
  return { leaves: B.geo(), trunk: trunkGeo(0.012, 0.004, 0.95, extra) };
}
function shrub(seed) {
  const R = rng(seed), B = cardBuilder(), ctr = new THREE.Vector3(0, 0.25, 0);
  for (let i = 0; i < 9; i++) {
    const a = R() * 6.28, r = R() * 0.45, C = new THREE.Vector3(Math.cos(a) * r, 0.3 + R() * 0.4, Math.sin(a) * r);
    const [S1, S2] = frameAround(new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)).normalize());
    B.cluster(C, S1, S2, 0.7 + R() * 0.4, ctr); B.cluster(C, S1, UP, 0.6 + R() * 0.3, ctr);
  }
  return { leaves: B.geo(), trunk: null };
}

/* ───────── materials ───────── */
function foliageMat(map, envI = 0.35) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, alphaToCoverage: true, envMapIntensity: envI });
  // keep the outward crown normals on both faces of a card (no back-face flip) so foliage shades as a volume
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '')); };
  m.customProgramCacheKey = () => 'foliage';
  return m;
}

/* ───────── forest ───────── */
// trees: [x, y, z, height, rand, distFromHouse]; shrubs: [x, y, z, size, rand]
export function buildForest(trees, shrubs) {
  const group = new THREE.Group();
  const T = {
    spruceNeedles: frondTex(11, { spacing: 0.035, taper: 0.8, twigAngle: 0.95, density: 3.2, needle: 13, needleAngle: 0.95, hue: 135, sat: 32, light: 22 }),
    pineNeedles: frondTex(23, { spacing: 0.06, taper: 0.5, twigAngle: 0.55, density: 2.6, needle: 30, needleAngle: 0.45, hue: 105, sat: 30, light: 27 }),
    birchLeaves: leafTex(31, { n: 340, size: 9, hue: 88, sat: 40, light: 33 }),
    shrubLeaves: leafTex(37, { n: 300, size: 8, hue: 95, sat: 35, light: 26 }),
    bark: barkTex('spruce', 41), pineBark: barkTex('pine', 43), birchBark: barkTex('birch', 47),
  };
  const mats = {
    spruce: foliageMat(T.spruceNeedles), pine: foliageMat(T.pineNeedles), birch: foliageMat(T.birchLeaves, 0.45), shrub: foliageMat(T.shrubLeaves),
    bark: new THREE.MeshStandardMaterial({ map: T.bark, roughness: 1, envMapIntensity: 0.3 }),
    pineBark: new THREE.MeshStandardMaterial({ map: T.pineBark, roughness: 1, envMapIntensity: 0.3 }),
    birchBark: new THREE.MeshStandardMaterial({ map: T.birchBark, roughness: 0.9, envMapIntensity: 0.35 }),
  };
  const species = [
    { name: 'spruce', build: spruce, seeds: [101, 202, 303], leaf: mats.spruce, bark: mats.bark },
    { name: 'pine', build: pine, seeds: [404, 505], leaf: mats.pine, bark: mats.pineBark },
    { name: 'birch', build: birch, seeds: [606, 707], leaf: mats.birch, bark: mats.birchBark },
  ];
  // near trees get the full variants; far ones (beyond ~300 ft) lighter ones with fewer branch cards
  const variants = species.flatMap((sp) => sp.seeds.flatMap((s) => [false, true].map((lite) => ({ sp, lite, ...sp.build(s, lite), list: [] }))));
  const pick = (name, r, lite) => { const vs = variants.filter((v) => v.sp.name === name && v.lite === lite); return vs[Math.floor(r * vs.length) % vs.length]; };
  for (const [x, y, z, h, v, d] of trees) {
    const name = v < 0.16 && d < 260 ? 'birch' : v < 0.42 ? 'pine' : 'spruce';
    const hh = name === 'birch' ? 0.55 + (h - 38) / 38 * 0.35 : name === 'pine' ? 1.15 : 1;
    pick(name, (v * 9.73) % 1, d > 300).list.push([x, y, z, h * hh, v]);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const place = (geo, mat, list, tint, shadow = true) => {
    if (!geo || !list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, h, v], i) => {
      e.set((v - 0.5) * 0.05, v * 97.3, ((v * 13.1) % 1 - 0.5) * 0.05); q.setFromEuler(e);
      const wobble = 0.88 + ((v * 31.7) % 1) * 0.28;
      m.compose(p.set(x, y - 0.4, z), q, sc.set(h * wobble, h, h * wobble)); im.setMatrixAt(i, m);
      if (tint) { col.setHSL(0, 0, 0.82 + ((v * 53.9) % 1) * 0.3); im.setColorAt(i, col); }
    });
    im.castShadow = shadow; im.receiveShadow = true; im.userData.site = 'trees';
    im.computeBoundingSphere(); group.add(im);
  };
  // only the near trees can throw a shadow inside the sun's shadow area around the house
  for (const vnt of variants) { place(vnt.trunk, vnt.sp.bark, vnt.list, false, !vnt.lite); place(vnt.leaves, vnt.sp.leaf, vnt.list, true, !vnt.lite); }
  const sh = [shrub(808), shrub(909)];
  sh.forEach((g, k) => place(g.leaves, mats.shrub, shrubs.filter((_, i) => i % 2 === k), true, false));
  return group;
}
