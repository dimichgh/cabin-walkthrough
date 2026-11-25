// The cabin's geometry, in feet. x = east, y = up, z = south (plan north is -z).
// Origin: north-west corner of the enclosed ground floor (outer face of the Ipe walls).
// Sources: A201 foundation plan (footprints, basement rooms, stair 18R/17T), A401 elevations, A501 sections,
// the cut-away east-west building section, and the five perspectives. The upper-floor layouts were not
// published; rooms there are only placed where a section cut fixes them, and the rest is left open.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const LV = {
  FFB: -10.354,   // basement floor: 18 R @ ±7" = 10'-4 1/4" below the first floor (A201)
  FF1: 0,         // first (entry) floor
  FF2: 10.354,    // second floor, 10'-4 1/4" above (A401 / A501)
  FFG: -2.427,    // garage slab, 2'-5 1/8" below the entry floor (A201)
  GRADE: -2.45,
  TERR: -0.15,    // covered terrace slab
  SLAB: 1.0,      // floor structure depth
  EAVE: 20.45,    // top of the upper box, 20'-5 3/8" (A401)
  EAVE_S: 19.7,   // suite mass eave (read from the building section)
  PITCH: 8 / 12,  // 8:12 gables (A401 / A501)
};
const { FFB, FF1, FF2, FFG, GRADE, TERR, SLAB, EAVE, EAVE_S, PITCH } = LV;
const B2 = FF2 - SLAB;          // underside of the second floor / top of the ground-floor walls
const RISE = 10.354 / 18, RUN = 15.583 / 17; // 18 risers, 17 treads @ 11" = 15'-7"
// stair footprint (both flights stacked, rising westward, per the building section)
const ST = { xTop: 7.52, xBot: 7.52 + 17 * RUN, z0: 9.0, z1: 13.0 };
const HOLE_X = 19.26;           // floor opening over each flight where headroom is needed
const XJ = 2.6, ZJ = 17.4;      // west wall steps in 3'-0" south of here (A201 jog)

export function buildHouse(M) {
  const parts = [], colliders = [], surfaces = [];
  const T_EXT = 0.7;

  /* ───────────── primitives ───────────── */
  const add = (geo, mat, level, uv = 'auto') => { parts.push({ geo, mat, level, uv }); return geo; };
  function fixWinding(g, m) {
    if (m.determinant() >= 0) return;
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } return; }
    for (const k of Object.keys(g.attributes)) {
      const at = g.attributes[k], s = at.itemSize, arr = at.array;
      for (let i = 0; i < at.count; i += 3) for (let c = 0; c < s; c++) { const t = arr[(i + 1) * s + c]; arr[(i + 1) * s + c] = arr[(i + 2) * s + c]; arr[(i + 2) * s + c] = t; }
    }
  }
  const xform = (g, m) => { g.applyMatrix4(m); fixWinding(g, m); return g; };
  function box(mat, level, x0, x1, y0, y1, z0, z1, o = {}) {
    if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return;
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    add(g, mat, level);
    if (o.solid) colliders.push({ x0, x1, y0, y1, z0, z1 });
    if (o.walk) surfaces.push({ x0, x1, z0, z1, y: y1 });
  }
  function cyl(mat, level, x, z, r, y0, y1, o = {}) {
    const g = new THREE.CylinderGeometry(o.r1 ?? r, r, y1 - y0, o.seg || 20);
    g.translate(x, (y0 + y1) / 2, z); add(g, mat, level);
    if (o.solid) colliders.push({ x0: x - r, x1: x + r, y0, y1, z0: z - r, z1: z + r });
  }
  // downward-facing ceiling / soffit plane (invisible from above, so it never blocks a cutaway)
  function ceil(mat, level, x0, x1, z0, z1, y) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); add(g, mat, level);
  }
  // floor slab (finish on top), optional ceiling below for the room underneath
  function floor(mat, level, x0, x1, z0, z1, y, o = {}) {
    box(mat, level, x0, x1, y - (o.t ?? SLAB), y, z0, z1);
    surfaces.push({ x0, x1, z0, z1, y });
    if (o.ceil) ceil(o.ceilMat || 'ceil', o.ceilLevel, x0, x1, z0, z1, y - (o.t ?? SLAB) - 0.004);
  }
  // box positioned in a wall's local frame: u along the wall, v = y, w = depth from the outer face (+ = inward)
  function lbox(W, mat, u0, u1, v0, v1, w0, w1, level, solid) {
    const a = W.at + W.dir * w0, b = W.at + W.dir * w1, lo = Math.min(a, b), hi = Math.max(a, b);
    if (W.axis === 'x') box(mat, level ?? W.level, u0, u1, v0, v1, lo, hi, { solid });
    else box(mat, level ?? W.level, lo, hi, v0, v1, u0, u1, { solid });
  }
  function wallMatrix(axis, base, dir) {
    const m = new THREE.Matrix4();
    if (axis === 'x') m.makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, dir)).setPosition(0, 0, base);
    else m.makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir, 0, 0)).setPosition(base, 0, 0);
    return m;
  }
  const rectPath = (P, a0, v0, a1, v1) => { P.moveTo(a0, v0); P.lineTo(a1, v0); P.lineTo(a1, v1); P.lineTo(a0, v1); P.closePath(); return P; };

  /* Wall: a planar slab built from extruded layers (outside → in), with real openings.
     o = { axis:'x'|'z', at (outer face), dir (+1/-1 toward the inside), a0, a1, y0, y1, level,
           layers:[{mat,t}], holes:[{a0,a1,y0,y1,kind,mull,frame,insert}], inset:[s0,s1] (inner layers),
           outline:[[u,v]…] (non-rect, no doors), center:true (at = centre line) } */
  function wall(o) {
    const layers = o.layers || [{ mat: 'gyp', t: 0.4 }];
    const T = layers.reduce((s, l) => s + l.t, 0);
    const W = { ...o, T, at: o.center ? o.at - o.dir * T / 2 : o.at, level: o.level };
    const holes = (o.holes || []).map(h => ({ ...h, kind: h.kind || 'win' }));
    const isDoor = h => h.kind === 'door' || h.kind === 'open' || h.kind === 'slide' || h.kind === 'garage' || h.y0 <= o.y0 + 0.01;
    const doors = holes.filter(isDoor).sort((p, q) => p.a0 - q.a0);
    if (!o.outline && doors.length && !o._seg) {
      let u = o.a0;
      for (const d of doors) {
        if (d.a0 > u + 0.01) wall({ ...o, center: false, at: W.at, a1: d.a0, a0: u, holes: holes.filter(h => !isDoor(h) && h.a0 >= u - 0.01 && h.a1 <= d.a0 + 0.01), _seg: true, inset: [u === o.a0 ? (o.inset?.[0] ?? 0) : 0, 0] });
        if (d.y1 < o.y1 - 0.01) wall({ ...o, center: false, at: W.at, a0: d.a0, a1: d.a1, y0: d.y1, holes: [], _seg: true, inset: [0, 0] });
        if (d.y0 > o.y0 + 0.01) wall({ ...o, center: false, at: W.at, a0: d.a0, a1: d.a1, y1: d.y0, holes: [], _seg: true, inset: [0, 0] });
        u = d.a1;
      }
      if (o.a1 > u + 0.01) wall({ ...o, center: false, at: W.at, a0: u, holes: holes.filter(h => !isDoor(h) && h.a0 >= u - 0.01), _seg: true, inset: [0, o.inset?.[1] ?? 0] });
      for (const d of doors) fill(W, d);
      return;
    }
    let off = 0;
    layers.forEach((L, li) => {
      const ins = li === 0 ? [0, 0] : (o.inset || [0, 0]);
      let outline = o.outline ? o.outline.map(p => [p[0], p[1]]) : [[o.a0, o.y0], [o.a1, o.y0], [o.a1, o.y1], [o.a0, o.y1]];
      if (li > 0 && (ins[0] || ins[1])) {
        const lo = Math.min(...outline.map(p => p[0])), hi = Math.max(...outline.map(p => p[0]));
        outline = outline.map(([u, v]) => [u === lo ? u + ins[0] : u === hi ? u - ins[1] : u, v]);
      }
      const shape = new THREE.Shape();
      shape.moveTo(outline[0][0], outline[0][1]); for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i][0], outline[i][1]); shape.closePath();
      for (const h of holes) shape.holes.push(rectPath(new THREE.Path(), h.a0, h.y0, h.a1, h.y1));
      const g = new THREE.ExtrudeGeometry(shape, { depth: L.t, bevelEnabled: false, curveSegments: 1 });
      xform(g, wallMatrix(o.axis, W.at + o.dir * off, o.dir));
      add(g, L.mat, o.level);
      off += L.t;
    });
    // collision: the wall's rectangle (windows are solid at walking height)
    if (!o.noCollide) {
      const vs = (o.outline || [[0, o.y0], [0, o.y1]]).map(p => p[1]);
      const yb = Math.min(...vs), yt = Math.min(Math.max(...vs), (o.y1 ?? yb + 12));
      const a = W.at, b = W.at + o.dir * T, lo = Math.min(a, b), hi = Math.max(a, b);
      const u0 = o.outline ? Math.min(...o.outline.map(p => p[0])) : o.a0, u1 = o.outline ? Math.max(...o.outline.map(p => p[0])) : o.a1;
      if (o.axis === 'x') colliders.push({ x0: u0, x1: u1, y0: yb, y1: yt, z0: lo, z1: hi });
      else colliders.push({ x0: lo, x1: hi, y0: yb, y1: yt, z0: u0, z1: u1 });
    }
    for (const h of holes) fill(W, h);
  }

  // what goes in an opening
  function fill(W, h) {
    const T = W.T, fw = 0.16, mid = T * 0.45;
    const frame = (mat = 'trim', d0 = mid - 0.12, d1 = mid + 0.12, sill = true) => {
      if (sill) lbox(W, mat, h.a0, h.a1, h.y0, h.y0 + fw, d0, d1);
      lbox(W, mat, h.a0, h.a1, h.y1 - fw, h.y1, d0, d1);
      lbox(W, mat, h.a0, h.a0 + fw, h.y0, h.y1, d0, d1); lbox(W, mat, h.a1 - fw, h.a1, h.y0, h.y1, d0, d1);
    };
    if (h.frame) { // protruding break-metal box frame around the opening (A401 "extruded window framing")
      const p = h.frame, e = 0.38;
      lbox(W, 'trim', h.a0 - e, h.a1 + e, h.y1, h.y1 + e, -p, 0.05); lbox(W, 'trim', h.a0 - e, h.a1 + e, h.y0 - e, h.y0, -p, 0.05);
      lbox(W, 'trim', h.a0 - e, h.a0, h.y0, h.y1, -p, 0.05); lbox(W, 'trim', h.a1, h.a1 + e, h.y0, h.y1, -p, 0.05);
    }
    switch (h.kind) {
      case 'win': {
        frame();
        lbox(W, 'glass', h.a0 + fw, h.a1 - fw, h.y0 + fw, h.y1 - fw, mid - 0.02, mid + 0.02);
        const n = h.mull || 0;
        for (let i = 1; i <= n; i++) { const u = h.a0 + (h.a1 - h.a0) * i / (n + 1); lbox(W, 'trim', u - 0.07, u + 0.07, h.y0, h.y1, mid - 0.1, mid + 0.1); }
        if (h.transom) { const v = h.transom; lbox(W, 'trim', h.a0, h.a1, v - 0.06, v + 0.06, mid - 0.1, mid + 0.1); }
        break;
      }
      case 'screen': frame(); lbox(W, 'screen', h.a0 + fw, h.a1 - fw, h.y0 + fw, h.y1 - fw, mid - 0.02, mid + 0.02);
        for (let i = 1; i <= (h.mull || 0); i++) { const u = h.a0 + (h.a1 - h.a0) * i / ((h.mull || 0) + 1); lbox(W, 'trim', u - 0.06, u + 0.06, h.y0, h.y1, mid - 0.1, mid + 0.1); }
        break;
      case 'panel': lbox(W, h.mat || 'steel', h.a0, h.a1, h.y0, h.y1, 0.02, 0.2); break; // steel cover insert
      case 'door': {
        frame('trim', 0, T, false);
        if (h.leaf) { // leaf swung open 90° to the inside, hinged at a0
          const lw = h.a1 - h.a0 - 0.3, hu = h.a0 + 0.15;
          lbox(W, h.leaf, hu, hu + 0.16, h.y0, h.y1 - fw, T, T + lw);
        }
        if (h.lite) lbox(W, 'glass', h.lite[0], h.lite[1], h.y0 + 0.5, h.y1 - 0.5, mid - 0.02, mid + 0.02);
        break;
      }
      case 'slide': { // sliding glass door: fixed half + operable half slid open behind it
        frame('trim', 0, T, false);
        const m = (h.a0 + h.a1) / 2;
        for (const [a, b, d] of [[h.a0, m + 0.1, mid], [h.a0 + 0.2, m + 0.3, mid + 0.22]]) {
          lbox(W, 'trim', a, b, h.y0, h.y0 + 0.2, d - 0.08, d + 0.08); lbox(W, 'trim', a, b, h.y1 - 0.2, h.y1, d - 0.08, d + 0.08);
          lbox(W, 'trim', a, a + 0.16, h.y0, h.y1, d - 0.08, d + 0.08); lbox(W, 'trim', b - 0.16, b, h.y0, h.y1, d - 0.08, d + 0.08);
          lbox(W, 'glass', a + 0.16, b - 0.16, h.y0 + 0.2, h.y1 - 0.2, d - 0.02, d + 0.02);
        }
        const lo = Math.min(W.at, W.at + W.dir * T), hi = Math.max(W.at, W.at + W.dir * T); // the closed half is solid
        colliders.push(W.axis === 'x' ? { x0: h.a0, x1: m + 0.3, y0: h.y0, y1: h.y1, z0: lo, z1: hi } : { x0: lo, x1: hi, y0: h.y0, y1: h.y1, z0: h.a0, z1: m + 0.3 });
        break;
      }
      case 'garage': { // sectional door, closed
        lbox(W, 'garage', h.a0, h.a1, h.y0, h.y1, 0.12, 0.3, undefined, true);
        frame('trim', 0, 0.3);
        break;
      }
      case 'open': default: break;
    }
  }

  const ext = (mat, t0 = 0.15) => [{ mat, t: t0 }, { mat: 'gyp', t: T_EXT - t0 }];
  const IPE = ext('ipe'), MET = ext('metal'), STL = ext('steel', 0.12);
  const gableOutline = (a0, a1, yE, pitch) => { const mid = (a0 + a1) / 2, yR = yE + (a1 - a0) / 2 * pitch; return [[a0, yE], [a1, yE], [mid, yR]]; };
  // gable: rectangular wall (level) + triangle above the eave (roof level)
  function gable(o) {
    const { a0, a1, yE, pitch } = o;
    wall({ ...o, y1: yE });
    const tri = gableOutline(a0, a1, yE, pitch);
    // triangle layers: cladding full width, lining inset to stay inside the roof planes
    const mid = (a0 + a1) / 2, yR = yE + (a1 - a0) / 2 * pitch, i = T_EXT;
    wall({ ...o, outline: tri, layers: [o.layers[0]], holes: [], level: 'R', noCollide: true });
    wall({ ...o, at: o.at + o.dir * o.layers[0].t, outline: [[a0 + i, yE], [a1 - i, yE], [mid, yR - i * 1.2]], layers: [o.layers[1]], holes: [], level: 'R', noCollide: true });
  }
  // sloped roof plane: box of (length L along ridge) × (thickness) × (slope length), placed by basis
  function roofSlab(mat, level, center, along, normal, L, S, t) {
    const g = new THREE.BoxGeometry(L, t, S);
    const uv = g.attributes.uv; // scale box UVs to feet (face order px nx py ny pz nz)
    const dims = [[S, t], [S, t], [L, S], [L, S], [L, t], [L, t]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
    const m = new THREE.Matrix4().makeBasis(along, normal, new THREE.Vector3().crossVectors(along, normal)).setPosition(center);
    xform(g, m); add(g, mat, level, 'keep');
  }
  // gable roof over a rectangle of walls: ridge along 'z' (x = ridge) or 'x' (z = ridge)
  function gableRoof({ axis, w0, w1, r0, r1, eave, ov = 0.6, ovR = 0.5, t = 0.55, mat = 'roof', level = 'R' }) {
    const c = Math.cos(Math.atan(PITCH)), s = Math.sin(Math.atan(PITCH));
    const half = (w1 - w0) / 2, mid = (w0 + w1) / 2, ridgeY = eave + half * PITCH;
    const S = (half + ov) / c, L = (r1 - r0) + 2 * ovR, rc = (r0 + r1) / 2;
    for (const side of [-1, 1]) {
      // bottom line from eave edge to ridge; centre of the slab = midpoint + normal * t/2
      const hx = mid + side * (half + ov) / 2, hy = ridgeY - (half + ov) / 2 * PITCH;
      const nrm = axis === 'z' ? new THREE.Vector3(side * s, c, 0) : new THREE.Vector3(0, c, side * s);
      const along = axis === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const ctr = axis === 'z' ? new THREE.Vector3(hx, hy, rc) : new THREE.Vector3(rc, hy, hx);
      ctr.addScaledVector(nrm, t / 2);
      roofSlab(mat, level, ctr, along, nrm, L, S, t);
    }
    // ridge cap
    if (axis === 'z') box('trim', level, mid - 0.35, mid + 0.35, ridgeY + t / c - 0.1, ridgeY + t / c + 0.12, r0 - ovR, r1 + ovR);
    else box('trim', level, r0 - ovR, r1 + ovR, ridgeY + t / c - 0.1, ridgeY + t / c + 0.12, mid - 0.35, mid + 0.35);
    return ridgeY;
  }
  const rampSurf = (x0, x1, z0, z1, aLo, yLo, aHi, yHi) => surfaces.push({ x0, x1, z0, z1, ramp: true, aLo, yLo, aHi, yHi });

  /* ═════════════ SITE PAD, TERRACE, STEPS ═════════════ */
  const TX0 = -6.21, TX1 = 34.38, TZ0 = -15.54; // 40'-7" × 18'-3" terrace slab, 6'-2 1/2" wings (A201)
  box('concrete', '1', TX0, TX1, GRADE - 0.4, TERR, TZ0, 0, { walk: true });
  box('concrete', '1', TX0, 0, GRADE - 0.4, TERR, 0, 2.71, { walk: true });
  box('concrete', '1', 28, TX1, GRADE - 0.4, TERR, 0, 8.57, { walk: true });
  // steps down to grade: 4 risers of ~7"
  const nR = 4, rr = (TERR - GRADE) / nR;
  for (let k = 1; k < nR; k++) {
    const top = TERR - k * rr;
    box('concrete', '1', TX1 + (k - 1) * 1.0, TX1 + k * 1.0, GRADE - 0.3, top, -3, 8.57, { walk: true, solid: true });   // east, to the entry court
    box('concrete', '1', TX0 - k * 1.0, TX0 - (k - 1) * 1.0, GRADE - 0.3, top, -9, 2.71, { walk: true, solid: true });   // west, toward the lake
  }
  // concrete bench along the north edge, flagstone clad (A201: CONC. BENCH, T.O. +1'-4 1/4")
  box('flagstone', '1', 0, 4.3, TERR, 1.35, TZ0, TZ0 + 1.5, { solid: true });
  box('flagstone', '1', 9.8, 28, TERR, 1.35, TZ0, TZ0 + 1.5, { solid: true });
  box('concrete', '1', 0, 4.3, 1.35, 1.5, TZ0 - 0.05, TZ0 + 1.6); box('concrete', '1', 9.8, 28, 1.35, 1.5, TZ0 - 0.05, TZ0 + 1.6);
  // bench by the entry (A401: CONC. BENCH W/ FLAGSTONE CLADDING)
  box('flagstone', '1', 29.2, 33.4, TERR, 1.35, 7.0, 8.4, { solid: true }); box('concrete', '1', 29.1, 33.5, 1.35, 1.5, 6.9, 8.45);

  // exterior fireplace: 5'-4" bump-out at 105°, thickened stem wall below (A201); flagstone clad
  {
    const sh = new THREE.Shape();
    sh.moveTo(4.3, -14.0); sh.lineTo(9.8, -14.0); sh.lineTo(9.8, TZ0); sh.lineTo(9.1, TZ0 - 2.65); sh.lineTo(5.0, TZ0 - 2.65); sh.lineTo(4.3, TZ0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 8.8 - GRADE, bevelEnabled: false });
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)).setPosition(0, GRADE, 0);
    xform(g, m); add(g, 'flagstone', '1');
    colliders.push({ x0: 4.3, x1: 9.8, y0: GRADE, y1: 8.8, z0: TZ0 - 2.65, z1: -14.0 });
    box('fire', '1', 5.55, 8.55, 1.45, 4.3, -14.55, -13.96);                 // firebox
    box('concrete', '1', 4.1, 10.0, 8.8, 9.05, TZ0 - 2.8, -13.85);          // cap
    box('flagstone', '1', 4.3, 9.8, TERR, 1.35, -14.0, -13.1, { solid: true }); // raised hearth, bench height
    cyl('alum', 'R', 7.05, -16.35, 0.55, 9.05, 34.2, { solid: true });          // round aluminum flue outside the north gable
    cyl('trim', 'R', 7.05, -16.35, 0.85, 34.2, 34.9, { r1: 0.5 });             // cap
  }
  // painted steel columns carrying the box over the terrace
  for (const [x, z] of [[0.3, -15.2], [27.7, -15.2], [0.3, -6.2], [27.7, -6.2]]) cyl('column', '1', x, z, 0.26, TERR, B2, { solid: true, seg: 14 });
  for (let i = 0; i < 5; i++) cyl('column', '1', 11.2 + i * 1.25, -15.25, 0.13, 1.5, B2, { solid: true, seg: 10 });

  /* ═════════════ BASEMENT (1/A201) ═════════════ */
  const BW = [{ mat: 'found', t: 0.6 }, { mat: 'gyp', t: 0.23 }], BY0 = FFB - 0.6, BY1 = -0.5;
  const bw = (o) => wall({ layers: BW, y0: BY0, y1: BY1, level: 'B', ...o });
  bw({ axis: 'x', at: 0.37, dir: 1, a0: 0.37, a1: 28.13, inset: [0.83, 0.83] });                       // north
  bw({ axis: 'z', at: 0.37, dir: 1, a0: 0.37, a1: ZJ, inset: [0.83, 0.83] });                          // west (mechanical)
  bw({ axis: 'x', at: ZJ, dir: -1, a0: 0.37, a1: 3.4, inset: [0.83, -0.83] });                         // jog
  bw({ axis: 'z', at: 2.57, dir: 1, a0: ZJ - 0.83, a1: 32.33, inset: [0, 0.83],                       // west (gathering) + egress window 0.1
    holes: [{ a0: 22.2, a1: 26.6, y0: FFB + 3.6, y1: -1.4, kind: 'win', mull: 1 }] });
  bw({ axis: 'x', at: 32.33, dir: -1, a0: 2.57, a1: 34.03, inset: [0.83, 0.83],                       // south + light wells 0.2–0.4
    holes: [8.0, 17.0, 25.1].map(a => ({ a0: a + 0.2, a1: a + 2.4, y0: -4.1, y1: -1.3, kind: 'win' })) });
  bw({ axis: 'z', at: 34.03, dir: -1, a0: 17.27, a1: 32.33, inset: [0.83, 0.83] });                   // east (under the hallway)
  bw({ axis: 'x', at: 17.27, dir: 1, a0: 27.3, a1: 34.03, inset: [-0.83, 0.83] });                    // east jog
  bw({ axis: 'z', at: 28.13, dir: -1, a0: 0.37, a1: 18.1, inset: [0.83, 0] });                         // east (laundry side)
  // partitions: mechanical 003 | laundry 002 | stair, door 003 off the gathering room
  const BP = { layers: [{ mat: 'gyp', t: 0.4 }], y0: FFB, y1: -1.0, level: 'B', center: true };
  wall({ ...BP, axis: 'x', at: 8.8, dir: 1, a0: 7.2, a1: 27.3, holes: [{ a0: 24.0, a1: 26.7, y0: FFB, y1: FFB + 6.9, kind: 'door' }] });
  wall({ ...BP, axis: 'z', at: 19.4, dir: 1, a0: 1.2, a1: 8.6 });
  wall({ ...BP, axis: 'z', at: 7.4, dir: 1, a0: 9.0, a1: 16.6, holes: [{ a0: 13.8, a1: 16.4, y0: FFB, y1: FFB + 6.9, kind: 'door' }] });
  // floors
  floor('concrete', 'B', 1.0, 19.4, 1.0, 8.8, FFB, { t: 0.5 });
  floor('concrete', 'B', 1.0, 7.4, 8.8, 16.7, FFB, { t: 0.5 });
  floor('tile', 'B', 19.4, 27.5, 1.0, 8.8, FFB, { t: 0.5 });
  floor('oak', 'B', 7.4, 27.5, 8.8, ZJ, FFB, { t: 0.5 });
  floor('oak', 'B', 3.2, 27.5, ZJ, 18.1, FFB, { t: 0.5 });
  floor('oak', 'B', 3.2, 33.4, 18.1, 31.7, FFB, { t: 0.5 });
  // laundry: 62 1/2" quartz counter over washer + dryer (15/A704)
  box('quartz', 'B', 19.8, 25.0, FFB + 2.9, FFB + 3.05, 1.2, 3.6, { solid: true });
  box('appliance', 'B', 20.0, 22.3, FFB, FFB + 2.85, 1.3, 3.5); box('appliance', 'B', 22.5, 24.8, FFB, FFB + 2.85, 1.3, 3.5);
  box('walnut', 'B', 19.8, 25.0, FFB + 5.2, FFB + 7.4, 1.2, 2.5);
  // mechanical equipment (schematic)
  cyl('appliance', 'B', 3.0, 3.0, 1.0, FFB, FFB + 5.2, { solid: true }); box('appliance', 'B', 9.0, 12.0, FFB, FFB + 5.0, 1.4, 4.0, { solid: true });
  // egress well 0.1 and light wells 0.2–0.4 outside the walls
  box('found', 'B', -0.6, 2.57, -7.4, -7.0, 22.0, 26.8); box('gravel', 'B', -0.4, 2.57, -7.0, -6.9, 22.2, 26.6);
  box('found', 'B', -0.6, -0.4, -7.0, GRADE + 0.15, 22.0, 26.8); box('found', 'B', -0.6, 2.57, -7.0, GRADE + 0.15, 21.8, 22.0); box('found', 'B', -0.6, 2.57, -7.0, GRADE + 0.15, 26.8, 27.0);
  for (const a of [8.0, 17.0, 25.1]) {
    box('gravel', 'B', a, a + 2.6, -4.6, -4.5, 32.33, 34.0); box('found', 'B', a - 0.2, a, -4.6, GRADE + 0.15, 32.33, 34.2); box('found', 'B', a + 2.6, a + 2.8, -4.6, GRADE + 0.15, 32.33, 34.2); box('found', 'B', a - 0.2, a + 2.8, -4.6, GRADE + 0.15, 34.0, 34.2);
  }

  /* ═════════════ MAIN STAIR: two stacked flights, steel plate wall ST-1 ═════════════ */
  const flight = (yBase, level) => {
    for (let i = 0; i < 17; i++) {
      const xa = ST.xBot - (i + 1) * RUN, xb = ST.xBot - i * RUN, top = yBase + (i + 1) * RISE;
      box('oak', level, xa - 0.06, xb, top - 0.17, top, ST.z0 + 0.1, ST.z1 - 0.1);
    }
    // steel stringers
    const len = Math.hypot(ST.xBot - ST.xTop, 10.354), ang = Math.atan2(10.354, ST.xBot - ST.xTop);
    for (const z of [ST.z0 + 0.12, ST.z1 - 0.12]) {
      const g = new THREE.BoxGeometry(len, 0.95, 0.12);
      g.rotateZ(-ang); g.translate((ST.xTop + ST.xBot) / 2, yBase + 10.354 / 2 - 0.45, z); add(g, 'trim', level);
    }
    // handrail on the open (south) side + posts
    const g = new THREE.BoxGeometry(len, 0.12, 0.12); g.rotateZ(-ang); g.translate((ST.xTop + ST.xBot) / 2, yBase + 10.354 / 2 + 3.0, ST.z1 - 0.05); add(g, 'trim', level);
    for (let i = 0; i <= 6; i++) { const x = ST.xTop + 0.4 + i * (ST.xBot - ST.xTop - 0.8) / 6, y = yBase + (ST.xBot - x) / (ST.xBot - ST.xTop) * 10.354; box('trim', level, x - 0.05, x + 0.05, y, y + 3.0, ST.z1 - 0.1, ST.z1); }
    // walk ramp + stepped side guards (colliders only)
    rampSurf(ST.xTop, ST.xBot, ST.z0, ST.z1, ST.xBot, yBase, ST.xTop, yBase + 10.354);
    for (let i = 0; i < 10; i++) {
      const xa = ST.xTop + i * (ST.xBot - ST.xTop) / 10, xb = xa + (ST.xBot - ST.xTop) / 10, ym = yBase + (ST.xBot - (xa + xb) / 2) / (ST.xBot - ST.xTop) * 10.354;
      colliders.push({ x0: xa, x1: xb, y0: ym - 2.5, y1: ym + 3.5, z0: ST.z1 - 0.05, z1: ST.z1 + 0.15 });
    }
  };
  flight(FFB, 'B'); flight(FF1, '1');
  // steel plate wall on the north side of the stair, first floor to second-floor ceiling
  box('steel', '1', ST.xTop, ST.xBot, FF1, B2, 8.75, 9.0, { solid: true });
  box('steel', '2', ST.xTop, ST.xBot, B2, 19.9, 8.75, 9.0, { solid: true });
  box('gyp', '1', ST.xTop, ST.xBot, FF1, B2, 8.55, 8.75); box('gyp', '2', ST.xTop, ST.xBot, B2, 19.9, 8.55, 8.75);
  // guards around the floor openings
  const guard = (level, y, x0, x1, z0, z1) => {
    box('trim', level, x0, x1, y + 3.3, y + 3.45, z0, z1); box('glass', level, x0, x1, y + 0.1, y + 3.3, (z0 + z1) / 2 - 0.02, (z0 + z1) / 2 + 0.02);
    colliders.push({ x0, x1, y0: y, y1: y + 3.45, z0, z1 });
  };
  guard('1', FF1, ST.xTop, HOLE_X, ST.z1 + 0.05, ST.z1 + 0.25);
  guard('2', FF2, ST.xTop, HOLE_X, ST.z1 + 0.05, ST.z1 + 0.25);
  // hole edge fascias
  box('gyp', '1', ST.xTop, HOLE_X, FF1 - SLAB, FF1, ST.z1, ST.z1 + 0.05); box('gyp', '2', ST.xTop, HOLE_X, B2, FF2, ST.z1, ST.z1 + 0.05);
  box('gyp', '1', HOLE_X - 0.05, HOLE_X, FF1 - SLAB, FF1, ST.z0, ST.z1); box('gyp', '2', HOLE_X - 0.05, HOLE_X, B2, FF2, ST.z0, ST.z1);

  /* ═════════════ FIRST FLOOR (entry level) ═════════════ */
  const G0 = -0.5; // bottom of the Ipe rain screen; concrete stem below
  const w1 = (o) => wall({ y0: G0, y1: B2, level: '1', layers: IPE, inset: [T_EXT, T_EXT], ...o });
  w1({ axis: 'z', at: 0, dir: 1, a0: 0, a1: ZJ, holes: [{ a0: 1.5, a1: 4.5, y0: 3, y1: 7.3 }, { a0: 9.6, a1: 14.4, y0: 2.4, y1: 7.6, mull: 1 }] });          // west (lake)
  w1({ axis: 'x', at: ZJ, dir: -1, a0: 0, a1: XJ, inset: [T_EXT, -T_EXT] });                                                                                 // jog return
  w1({ axis: 'z', at: XJ, dir: 1, a0: ZJ, a1: 32.125, inset: [-T_EXT, T_EXT], holes: [{ a0: 20.0, a1: 26.0, y0: 2.4, y1: 7.6, mull: 1 }, { a0: 28.0, a1: 31.0, y0: 3.8, y1: 7.6 }] });
  w1({ axis: 'x', at: 32.125, dir: -1, a0: XJ, a1: 28.0, inset: [T_EXT, 0], holes: [{ a0: 7.0, a1: 13.0, y0: 4.6, y1: 6.6, mull: 1 }, { a0: 17.0, a1: 20.5, y0: 3.0, y1: 7.2 }] }); // south
  w1({ axis: 'x', at: 0, dir: 1, a0: 0, a1: 28.0, holes: [{ a0: 8.5, a1: 11.5, y0: 3, y1: 7.3 }, { a0: 13.24, a1: 21.53, y0: FF1, y1: 8.0, kind: 'slide' }] }); // north, to the terrace (door 8'-3 1/2")
  w1({ axis: 'z', at: 28.0, dir: -1, a0: 0, a1: 3.0, inset: [T_EXT, 0], holes: [{ a0: 0.9, a1: 2.1, y0: 1.0, y1: 8.0 }] });                                // east, north of the entry
  // recessed plate-steel entry 105
  wall({ axis: 'x', at: 3.0, dir: -1, a0: 26.8, a1: 28.0, y0: G0, y1: B2, level: '1', layers: STL });
  wall({ axis: 'z', at: 26.8, dir: -1, a0: 3.0, a1: 8.57, y0: G0, y1: B2, level: '1', layers: STL,
    holes: [{ a0: 3.55, a1: 4.45, y0: 0.6, y1: 8.0 }, { a0: 5.0, a1: 8.0, y0: FF1, y1: 8.2, kind: 'door', leaf: 'steel' }] });
  box('alum', '1', 26.75, 26.95, 6.2, 6.9, 8.25, 8.45); // wall-mounted light
  box('concrete', '1', 26.5, 28.0, GRADE - 0.4, TERR, 3.0, 8.57, { walk: true }); // landing in the recess
  // connector (first floor hallway) and garage
  wall({ axis: 'x', at: 8.57, dir: 1, a0: 26.8, a1: 34.0, y0: G0, y1: B2, level: '1', layers: STL, inset: [0, 0], holes: [{ a0: 31.0, a1: 33.2, y0: 3, y1: 7.3 }] });
  w1({ axis: 'x', at: 32.125, dir: -1, a0: 28.0, a1: 34.0, inset: [0, 0], holes: [{ a0: 30.0, a1: 31.2, y0: 1.0, y1: 8.0 }] });
  wall({ axis: 'z', at: 28.0, dir: -1, a0: 8.57 + T_EXT, a1: 32.125 - T_EXT, y0: FF1, y1: B2, level: '1', layers: [{ mat: 'gyp', t: 0.5 }], center: true,
    holes: [{ a0: 13.2, a1: 16.6, y0: FF1, y1: 8.0, kind: 'open' }, { a0: 25.0, a1: 27.8, y0: FF1, y1: 7.2, kind: 'door' }] });
  const wg = (o) => wall({ y0: -2.0, y1: B2, level: '1', layers: IPE, inset: [T_EXT, T_EXT], ...o });
  wg({ axis: 'x', at: 8.57, dir: 1, a0: 34.0, a1: 59.8, inset: [0, T_EXT], holes: [{ a0: 37.0, a1: 39.5, y0: 2.6, y1: 7.0 }] });
  wg({ axis: 'z', at: 59.8, dir: -1, a0: 8.57, a1: 32.125, holes: [{ a0: 13.0, a1: 28.6, y0: FFG, y1: 5.6, kind: 'garage' }] });                            // garage door 111A
  box('alum', '1', 59.75, 59.95, 3.4, 4.1, 11.6, 11.8);
  wg({ axis: 'x', at: 32.125, dir: -1, a0: 34.0, a1: 59.8, inset: [0, T_EXT] });
  wall({ axis: 'z', at: 34.0, dir: 1, a0: 8.57 + T_EXT, a1: 32.125 - T_EXT, y0: FFG, y1: B2, level: '1', layers: [{ mat: 'gyp', t: 0.5 }], center: true,
    holes: [{ a0: 27.2, a1: 29.9, y0: FF1, y1: 7.2, kind: 'door' }] });
  // stem walls showing between grade and the rain screen
  box('found', '1', 0.37, 28.13, GRADE - 0.2, G0, 0.37, 0.6); box('found', '1', 0.37, 0.6, GRADE - 0.2, G0, 0.37, ZJ); box('found', '1', 2.57, 2.8, GRADE - 0.2, G0, ZJ, 32.33);
  box('found', '1', 28.13, 34.0, GRADE - 0.2, G0, 8.75, 8.97); box('found', '1', 34.0, 59.6, GRADE - 0.2, -2.0, 8.75, 8.97); box('found', '1', 59.4, 59.62, GRADE - 0.2, -2.0, 8.75, 32.0);
  box('found', '1', 2.57, 59.6, GRADE - 0.2, -2.0, 31.95, 32.33);
  // floors (first-floor slab; its underside is the basement ceiling)
  const f1 = (x0, x1, z0, z1) => floor('oak', '1', x0, x1, z0, z1, FF1, { ceil: true, ceilLevel: 'B' });
  f1(0.4, 27.6, 0.4, 3.0); f1(0.4, 26.6, 3.0, 8.57); f1(0.4, 27.6, 8.57, ST.z0); f1(0.4, ST.xTop, ST.z0, ST.z1); f1(HOLE_X, 27.6, ST.z0, ST.z1);
  f1(0.4, 27.6, ST.z1, ZJ); f1(2.9, 27.6, ZJ, 31.8); f1(27.6, 33.9, 8.9, 31.8);
  // garage slab + steps up to the hallway door
  floor('concrete', '1', 34.25, 59.55, 8.9, 31.8, FFG, { t: 0.4 });
  floor('oak', '1', 33.6, 34.4, 27.2, 29.9, FF1, { t: 0.3 });                       // threshold of the garage door
  floor('oak', '1', 13.24, 21.53, -0.05, 0.75, FF1, { t: 1.0 });                    // threshold of the terrace slider
  for (let k = 1; k <= 3; k++) { const top = FF1 - k * (FF1 - FFG) / 4; box('concrete', '1', 34.25 + (k - 1) * 0.92, 34.25 + k * 0.92, FFG, top, 27.0, 30.1, { walk: true, solid: true }); }

  /* ═════════════ UPPER BOX (second floor) ═════════════ */
  const BX0 = -0.4, BX1 = 28.4, BZ0 = TZ0, BZ1 = 32.5; // box overhangs the rain screen slightly
  const w2 = (o) => wall({ y0: B2, y1: EAVE, level: '2', layers: MET, inset: [T_EXT, T_EXT], ...o });
  // west (lake) face: ribbon band — screen opening 2.18, steel cover insert, then sliding units (3/A401, titled EAST)
  w2({ axis: 'z', at: BX0, dir: 1, a0: BZ0, a1: BZ1, holes: [
    { a0: -14.9, a1: -8.1, y0: 13.7, y1: 19.3, kind: 'screen', mull: 1 },
    { a0: -7.9, a1: -5.7, y0: 13.7, y1: 19.3, kind: 'panel' },
    { a0: -5.5, a1: 28.0, y0: 13.7, y1: 19.3, kind: 'win', mull: 7 },
  ] });
  // one continuous break-metal frame around the whole band
  { const W = { axis: 'z', at: BX0, dir: 1, T: T_EXT, level: '2' }; const e = 0.4, p = 1.0;
    lbox(W, 'trim', -15.3, 28.4, 19.3, 19.3 + e, -p, 0.05); lbox(W, 'trim', -15.3, 28.4, 13.7 - e, 13.7, -p, 0.05);
    lbox(W, 'trim', -15.3, -14.9, 13.7, 19.3, -p, 0.05); lbox(W, 'trim', 28.0, 28.4, 13.7, 19.3, -p, 0.05); }
  // east face (exterior north of the gallery, partition beside it)
  w2({ axis: 'z', at: BX1, dir: -1, a0: BZ0, a1: 8.57, inset: [T_EXT, 0], holes: [{ a0: -6.0, a1: 6.0, y0: 15.6, y1: 17.6, mull: 3, frame: 0.8 }] });
  wall({ axis: 'z', at: BX1 - 0.25, dir: -1, a0: 8.57, a1: 32.125, y0: B2, y1: EAVE, level: '2', layers: [{ mat: 'gyp', t: 0.5 }], center: true,
    holes: [{ a0: 14.0, a1: 17.0, y0: FF2, y1: FF2 + 7.4, kind: 'door' }] });
  w2({ axis: 'z', at: BX1, dir: -1, a0: 32.125, a1: BZ1, inset: [0, T_EXT] });
  // gables (north over the terrace, south)
  gable({ axis: 'x', at: BZ0, dir: 1, a0: BX0, a1: BX1, y0: B2, yE: EAVE, pitch: PITCH, level: '2', layers: MET, inset: [T_EXT, T_EXT],
    holes: [{ a0: 1.5, a1: 9.1, y0: 12.5, y1: 17.4, kind: 'screen', mull: 1, frame: 0.8 }, { a0: 22.7, a1: 25.8, y0: 14.3, y1: 18.4, frame: 0.8 }] });
  gable({ axis: 'x', at: BZ1, dir: -1, a0: BX0, a1: BX1, y0: B2, yE: EAVE, pitch: PITCH, level: '2', layers: MET, inset: [T_EXT, T_EXT],
    holes: [{ a0: 3.5, a1: 13.0, y0: 12.8, y1: 17.3, mull: 2, frame: 0.8 }, { a0: 18.0, a1: 22.5, y0: 13.0, y1: 17.3, frame: 0.8 }] });
  // 2/A501 cut: screened patio (west) · mechanical · pantry (east) over the covered terrace
  const P2 = { layers: [{ mat: 'gyp', t: 0.4 }], y0: FF2, y1: 19.9, level: '2', center: true };
  wall({ ...P2, axis: 'x', at: -6.0, dir: 1, a0: 0.3, a1: 14.0, holes: [{ a0: 4.0, a1: 10.0, y0: FF2, y1: FF2 + 8, kind: 'slide' }] });
  wall({ ...P2, axis: 'x', at: -6.0, dir: 1, a0: 14.0, a1: 27.7, holes: [{ a0: 15.2, a1: 17.8, y0: FF2, y1: FF2 + 7, kind: 'door' }, { a0: 22.0, a1: 24.8, y0: FF2, y1: FF2 + 7, kind: 'door' }] });
  wall({ ...P2, axis: 'z', at: 14.0, dir: 1, a0: BZ0 + T_EXT, a1: -6.2 });
  wall({ ...P2, axis: 'z', at: 19.0, dir: 1, a0: BZ0 + T_EXT, a1: -6.2 });
  // upper powder beside the stair (1/A501 cut)
  wall({ ...P2, axis: 'z', at: HOLE_X + 0.2, dir: 1, a0: ST.z0, a1: 13.5 });
  wall({ ...P2, axis: 'x', at: 13.3, dir: 1, a0: HOLE_X + 0.2, a1: 24.0, holes: [{ a0: 20.6, a1: 23.0, y0: FF2, y1: FF2 + 7, kind: 'door' }] });
  wall({ ...P2, axis: 'z', at: 24.0, dir: 1, a0: ST.z0 - 0.4, a1: 13.5 });
  box('gyp', '2', ST.xBot, 24.0, FF2, 19.9, 8.75, 9.0, { solid: true });
  box('appliance', '2', 22.6, 23.7, FF2, FF2 + 1.4, 9.3, 11.2, { solid: true }); box('walnut', '2', 19.8, 21.4, FF2, FF2 + 2.8, 9.2, 10.8, { solid: true }); box('quartz', '2', 19.8, 21.4, FF2 + 2.8, FF2 + 2.9, 9.2, 10.9);
  // floors: second-floor slab, its underside is the first-floor ceiling / terrace soffit
  const f2 = (mat, x0, x1, z0, z1) => floor(mat, '2', x0, x1, z0, z1, FF2, { ceil: true, ceilLevel: '1', ceilMat: z1 <= 0.01 ? 'soffit' : 'ceil' });
  f2('ipe', -0.1, 14.0, BZ0 + 0.25, -6.0); f2('oak', 14.0, 28.1, BZ0 + 0.25, -6.0);
  f2('oak', -0.1, 28.1, -6.0, 0); f2('oak', -0.1, 28.1, 0, ST.z0); f2('oak', -0.1, ST.xTop, ST.z0, ST.z1); f2('oak', HOLE_X, 28.1, ST.z0, ST.z1); f2('oak', -0.1, 28.1, ST.z1, 32.2);
  ceil('ceil', 'R', 0.3, 27.7, BZ0 + 0.7, 31.8, 19.9);
  // kitchen (schematic placement, WD-4 walnut + quartz), living furniture for scale
  box('walnut', '2', 25.4, 27.7, FF2, FF2 + 2.9, -5.0, 5.0, { solid: true }); box('quartz', '2', 25.3, 27.7, FF2 + 2.9, FF2 + 3.05, -5.0, 5.0);
  box('walnut', '2', 25.0, 27.7, FF2, FF2 + 7.2, 5.0, 7.8, { solid: true });
  box('walnut', '2', 18.8, 21.8, FF2, FF2 + 2.9, -3.0, 3.0, { solid: true }); box('quartz', '2', 18.6, 22.0, FF2 + 2.9, FF2 + 3.05, -3.2, 3.2);
  // (living furniture is in furniture.js, switchable)

  /* ═════════════ GALLERY + SUITE over the garage ═════════════ */
  const GX0 = BX1, CZ0 = 8.57, CZ1 = 32.125, SX0 = 34.0, SX1 = 59.8;
  wall({ axis: 'x', at: CZ0, dir: 1, a0: GX0, a1: SX0, y0: B2, y1: 19.0, level: '2', layers: MET, holes: [{ a0: 29.0, a1: 33.4, y0: 12.0, y1: 18.3, mull: 1, frame: 0.8 }] }); // window 2.4
  wall({ axis: 'x', at: CZ1, dir: -1, a0: GX0, a1: SX0, y0: B2, y1: 19.0, level: '2', layers: MET });
  box('roof', 'R', GX0 - 0.2, SX0 + 0.3, 19.0, 19.45, CZ0 - 0.4, CZ1 + 0.4); box('trim', 'R', GX0 - 0.25, SX0 + 0.3, 19.0, 19.55, CZ0 - 0.45, CZ0 - 0.35);
  ceil('ceil', 'R', GX0, SX0, CZ0 + 0.7, CZ1 - 0.7, 18.6);
  box('walnut', '2', 28.9, 33.6, FF2, FF2 + 2.5, CZ0 + 0.7, CZ0 + 2.4, { solid: true }); // WD-4 cabinets (1–2/A704)
  // suite walls
  const w3 = (o) => wall({ y0: B2, y1: EAVE_S, level: '2', layers: MET, inset: [T_EXT, T_EXT], ...o });
  w3({ axis: 'x', at: CZ0, dir: 1, a0: SX0, a1: SX1, inset: [0, T_EXT], holes: [{ a0: 40.0, a1: 55.0, y0: 13.6, y1: 18.6, mull: 3, frame: 0.8 }] });
  w3({ axis: 'x', at: CZ1, dir: -1, a0: SX0, a1: SX1, inset: [0, T_EXT], holes: [{ a0: 41.0, a1: 53.0, y0: 15.0, y1: 17.4, mull: 2, frame: 0.8 }] });
  gable({ axis: 'z', at: SX1, dir: -1, a0: CZ0, a1: CZ1, y0: B2, yE: EAVE_S, pitch: PITCH, level: '2', layers: MET, inset: [T_EXT, T_EXT],
    holes: [{ a0: 13.0, a1: 20.8, y0: 12.8, y1: 17.3, mull: 1, frame: 0.8 }] });                                                                // window 2.7
  wall({ axis: 'z', at: SX0, dir: 1, a0: CZ0 + T_EXT, a1: CZ1 - T_EXT, y0: B2, y1: 19.0, level: '2', layers: [{ mat: 'gyp', t: 0.5 }], center: true,
    holes: [{ a0: 20.0, a1: 23.0, y0: FF2, y1: FF2 + 7.4, kind: 'door' }] });
  { // west gable of the suite mass, above the gallery roof
    const yR = EAVE_S + (CZ1 - CZ0) / 2 * PITCH, mid = (CZ0 + CZ1) / 2;
    wall({ axis: 'z', at: SX0, dir: 1, outline: [[CZ0, 19.0], [CZ1, 19.0], [CZ1, EAVE_S], [mid, yR], [CZ0, EAVE_S]], layers: MET, level: 'R', noCollide: true });
  }
  floor('oak', '2', GX0 - 0.3, SX0 + 0.1, CZ0 + 0.35, CZ1 - 0.35, FF2, { ceil: true, ceilLevel: '1' });
  floor('oak', '2', SX0 + 0.1, SX1 - 0.3, CZ0 + 0.35, CZ1 - 0.35, FF2, { ceil: true, ceilLevel: '1' });
  ceil('ceil', 'R', SX0, SX1 - 0.7, CZ0 + 0.7, CZ1 - 0.7, 19.2);
  // kitchenette wall: counter, MW, UC REF (3–6/A704); placed under the north window per the building section
  box('walnut', '2', 46.0, 54.0, FF2, FF2 + 2.9, CZ0 + 0.7, CZ0 + 2.7, { solid: true }); box('quartz', '2', 45.9, 54.1, FF2 + 2.9, FF2 + 3.05, CZ0 + 0.7, CZ0 + 2.8);
  box('appliance', '2', 52.0, 54.0, FF2 + 0.1, FF2 + 2.7, CZ0 + 2.7, CZ0 + 2.75);

  /* ═════════════ ROOFS ═════════════ */
  const ridgeMain = gableRoof({ axis: 'z', w0: BX0, w1: BX1, r0: BZ0, r1: BZ1, eave: EAVE });
  const ridgeSuite = gableRoof({ axis: 'x', w0: CZ0, w1: CZ1, r0: SX0 - 0.1, r1: SX1, eave: EAVE_S, ovR: 0.4 });
  // second flue on the west slope, exhaust vent on the east slope
  { const x = 11.5, z = 11.0, y = EAVE + (x - BX0) * PITCH; cyl('alum', 'R', x, z, 0.42, y - 0.5, ridgeMain + 2.6); cyl('trim', 'R', x, z, 0.62, ridgeMain + 2.6, ridgeMain + 3.1, { r1: 0.38 }); }
  { const x = 20.5, z = 2.0, y = EAVE + (BX1 - x) * PITCH; cyl('trim', 'R', x, z, 0.22, y - 0.4, y + 1.6, { seg: 10 }); }
  // eave gutters / fascia
  for (const x of [BX0 - 0.6, BX1 + 0.6]) box('trim', 'R', x - 0.15, x + 0.15, EAVE - 0.6 * PITCH - 0.35, EAVE - 0.6 * PITCH + 0.15, BZ0 - 0.5, BZ1 + 0.5);
  for (const z of [CZ0 - 0.6, CZ1 + 0.6]) box('trim', 'R', SX0, SX1 + 0.4, EAVE_S - 0.6 * PITCH - 0.35, EAVE_S - 0.6 * PITCH + 0.15, z - 0.15, z + 0.15);

  /* ═════════════ merge by (level, material) ═════════════ */
  const groups = new Map();
  const n = new THREE.Vector3();
  for (const p of parts) {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (p.uv === 'auto') { // world-space box mapping in feet: continuous texture across pieces
      const pos = g.attributes.position, nor = g.attributes.normal, uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        n.fromBufferAttribute(nor, i); const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    g.clearGroups();
    const key = p.level + '|' + p.mat;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  const meshes = [];
  for (const [key, list] of groups) {
    const [level, mat] = key.split('|');
    const geo = mergeGeometries(list, false);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, M[mat]);
    mesh.userData = { level, mat };
    mesh.castShadow = !['glass', 'screen', 'ceil', 'soffit'].includes(mat);
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }
  return {
    meshes, colliders, surfaces,
    stats: { parts: parts.length, meshes: meshes.length, colliders: colliders.length, surfaces: surfaces.length },
    footprintHole: [[0.37, 0.37], [28.13, 0.37], [28.13, 8.57], [59.8, 8.57], [59.8, 32.35], [27.7, 32.35], [27.7, 34.2], [25.1, 34.2], [25.1, 32.35],
      [19.6, 32.35], [19.6, 34.2], [17.0, 34.2], [17.0, 32.35], [10.6, 32.35], [10.6, 34.2], [8.0, 34.2], [8.0, 32.35], [2.57, 32.35],
      [2.57, 27.0], [-0.6, 27.0], [-0.6, 21.8], [2.57, 21.8], [2.57, ZJ], [0.37, ZJ]],
    ridgeMain, ridgeSuite, ST, HOLE_X,
  };
}
