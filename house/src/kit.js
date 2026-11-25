// Small modelling kit for furniture, fixtures and the car: local transforms, rounded boxes, lathes, colliders,
// then one merged mesh per (level, material, option) — the same shape of output as house.js, so modes, cutaways,
// edges and photo mode treat these meshes like the building.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const D = Math.PI / 180;

export function makeKit() {
  const parts = [], colliders = [], stack = [];
  let T = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  const k = {
    level: '2', opt: null, parts, colliders,
    // enter a local frame: origin (x, y, z) in the current frame, rotated rotY degrees about +y (0 = front faces +z)
    push(x = 0, y = 0, z = 0, rotY = 0, s = 1, rotX = 0, rotZ = 0) {
      stack.push(T);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX * D, rotY * D, rotZ * D, 'YXZ'));
      T = T.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)));
      return k;
    },
    pop() { T = stack.pop(); return k; },
    // geometry in local coordinates → world; uv 'auto' = world box mapping in feet, 'keep' = the geometry's own UVs
    add(geo, mat, o = {}) {
      geo.applyMatrix4(T);
      if (T.determinant() < 0) geo.index ? geo.index.array.reverse() : null;
      parts.push({ geo, mat, level: o.level ?? k.level, opt: o.opt !== undefined ? o.opt : k.opt, uv: o.uv || 'auto' });
      return geo;
    },
    box(mat, x0, x1, y0, y1, z0, z1, o) {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return k.add(g, mat, o);
    },
    // rounded box centred at (cx, cy, cz)
    rbox(mat, cx, cy, cz, w, h, d, r = 0.12, seg = 3, o) {
      const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)); g.translate(cx, cy, cz); return k.add(g, mat, o);
    },
    // vertical cylinder (or cone with r1 at the top)
    cyl(mat, x, z, r, y0, y1, o = {}) {
      const g = new THREE.CylinderGeometry(o.r1 ?? r, r, y1 - y0, o.seg || 18, 1, !!o.open); g.translate(x, (y0 + y1) / 2, z); return k.add(g, mat, o);
    },
    // cylinder between two local points
    rod(mat, a, b, r, o = {}) {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
      const g = new THREE.CylinderGeometry(o.r1 ?? r, r, len, o.seg || 10, 1, !!o.open);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
      g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); return k.add(g, mat, o);
    },
    sphere(mat, x, y, z, r, o = {}) { const g = new THREE.SphereGeometry(r, o.seg || 20, o.rings || 14); if (o.sy) g.scale(1, o.sy, 1); g.translate(x, y, z); return k.add(g, mat, o); },
    // profile [[r, y], …] spun about the local y axis
    lathe(mat, pts, x, y, z, o = {}) { const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), o.seg || 24); g.translate(x, y, z); return k.add(g, mat, o); },
    // a rotated piece of raw geometry, local
    geo(mat, g, o) { return k.add(g, mat, o); },
    // collider from a local box (world AABB of its corners)
    solid(x0, x1, y0, y1, z0, z1, o = {}) {
      const b = new THREE.Box3();
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) b.expandByPoint(tmp.set(x, y, z).applyMatrix4(T));
      colliders.push({ x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z, opt: o.opt !== undefined ? o.opt : k.opt });
    },
    // a point in the current local frame, in world space
    at(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(T); },
    finish(M) {
      const groups = new Map(), n = new THREE.Vector3();
      for (const p of parts) {
        let g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
        for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
        if (!g.attributes.normal) g.computeVertexNormals();
        if (p.uv === 'auto' || !g.attributes.uv) {
          const pos = g.attributes.position, nor = g.attributes.normal, uv = new Float32Array(pos.count * 2);
          for (let i = 0; i < pos.count; i++) {
            n.fromBufferAttribute(nor, i); const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
          }
          g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        }
        g.clearGroups();
        const key = `${p.level}|${p.mat}|${p.opt || ''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(g);
      }
      const meshes = [];
      for (const [key, list] of groups) {
        const [level, mat, opt] = key.split('|');
        if (!M[mat]) throw new Error('kit: no material ' + mat);
        const geo = mergeGeometries(list, false); geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, M[mat]);
        mesh.userData = { level, mat, opt: opt || null };
        mesh.castShadow = !['glass', 'shade', 'globe', 'lamp', 'flame', 'ember'].includes(mat); mesh.receiveShadow = true;
        meshes.push(mesh);
      }
      return meshes;
    },
  };
  return k;
}

// colour temperature → linear RGB (rough fit, fine for warm interior light)
export function kelvin(K) {
  const t = K / 100; let r, g, b;
  r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = new THREE.Color(Math.min(255, Math.max(0, r)) / 255, Math.min(255, Math.max(0, g)) / 255, Math.min(255, Math.max(0, b)) / 255);
  return c.convertSRGBToLinear();
}
