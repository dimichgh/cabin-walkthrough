// Site: a level pad around the cabin (with the house footprint cut out so the basement is never sliced),
// rolling forest terrain beyond it, the lake to the west (Modern-Cabin-Site-Plan), pines, gravel drive.
import * as THREE from 'three';
import { LV } from './house.js';
import { buildForest } from './trees.js';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const PAD = { x0: -105, x1: 155, z0: -105, z1: 125 };

export function buildSite(M, footprintHole) {
  const G = LV.GRADE, group = new THREE.Group(), surfaces = [];
  // pad with the footprint hole (shape y = −z so that rotateX(−90°) lands it on the ground facing up)
  const sh = new THREE.Shape();
  sh.moveTo(PAD.x0, -PAD.z0); sh.lineTo(PAD.x0, -PAD.z1); sh.lineTo(PAD.x1, -PAD.z1); sh.lineTo(PAD.x1, -PAD.z0); sh.closePath();
  const hole = new THREE.Path(); footprintHole.forEach(([x, z], i) => i ? hole.lineTo(x, -z) : hole.moveTo(x, -z)); hole.closePath();
  sh.holes.push(hole);
  const padGeo = new THREE.ShapeGeometry(sh); padGeo.rotateX(-Math.PI / 2); padGeo.translate(0, G, 0);
  const pad = new THREE.Mesh(padGeo, M.grass); pad.receiveShadow = true; pad.userData.site = 'pad'; group.add(pad);
  // walkable everywhere except over the house footprint and the window wells (otherwise grade would act as a floor over the basement)
  surfaces.push({ x0: PAD.x0, x1: PAD.x1, z0: PAD.z0, z1: PAD.z1, y: G, holes: [
    [0.37, 28.13, 0.37, 17.4], [2.57, 59.8, 17.4, 32.35], [28.13, 59.8, 8.57, 17.4], [-0.6, 2.57, 21.8, 27.0],
    [8.0, 10.6, 32.35, 34.2], [17.0, 19.6, 32.35, 34.2], [25.1, 27.7, 32.35, 34.2]] });

  // gravel drive to garage door 111A and a path to the entry steps
  const drive = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.gravel);
  const mkBox = (x0, x1, z0, z1, t = 0.06) => { const g = new THREE.BoxGeometry(x1 - x0, t, z1 - z0); g.translate((x0 + x1) / 2, G + t / 2 - 0.02, (z0 + z1) / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (z1 - z0)); return g; };
  for (const g of [mkBox(59.8, PAD.x1, 12.0, 29.6), mkBox(37.4, 59.8, -3.0, 8.3)]) { const m = new THREE.Mesh(g, M.gravel); m.receiveShadow = true; m.userData.site = 'drive'; group.add(m); }
  drive.geometry.dispose();

  // terrain: flat at grade under the pad, hills to the east, falling to the lake on the west
  const R = rng(7), cx = 25, cz = 10;
  const terr = new THREE.PlaneGeometry(2400, 2400, 150, 150); terr.rotateX(-Math.PI / 2); terr.translate(cx, 0, cz);
  const pos = terr.attributes.position;
  const ph = Array.from({ length: 6 }, () => [R() * 6.28, R() * 6.28, 0.004 + R() * 0.012, 0.004 + R() * 0.012, 2 + R() * 5]);
  const hAt = (x, z) => {
    const dx = Math.max(PAD.x0 - x, 0, x - PAD.x1), dz = Math.max(PAD.z0 - z, 0, z - PAD.z1), d = Math.hypot(dx, dz);
    let h = 0; for (const [a, b, fx, fz, amp] of ph) h += Math.sin(x * fx + a) * Math.cos(z * fz + b) * amp;
    const k = Math.min(1, d / 120);
    let y = G - 0.06 + k * k * (h + Math.max(0, (x - 150) * 0.05));
    if (x < -80) y -= Math.pow((-80 - x) / 70, 1.3) * 9; // down to the shore
    return y;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const inside = x > PAD.x0 + 18 && x < PAD.x1 - 18 && z > PAD.z0 + 18 && z < PAD.z1 - 18;
    pos.setY(i, inside ? G - 30 : hAt(x, z));
  }
  terr.computeVertexNormals();
  const uv = terr.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
  const terrain = new THREE.Mesh(terr, M.grass); terrain.receiveShadow = true; terrain.userData.site = 'terrain'; group.add(terrain);
  // lake (west)
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(3000, 4000), M.water); lake.rotation.x = -Math.PI / 2; lake.position.set(-1400 - 160, G - 12.5, 0);
  lake.userData.site = 'lake'; group.add(lake);

  // pines: dense forest kept around the cabin; a clear view west to the lake and a clear drive
  const trees = [];
  for (let i = 0; i < 3600 && trees.length < 700; i++) {
    const a = R() * Math.PI * 2, r = 70 + Math.pow(R(), 0.8) * 650, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (x < -150) continue;                                     // lake
    if (x < 10 && z > -60 && z < 75) continue;                  // view corridor to the lake
    if (x > 50 && z > 2 && z < 40) continue;                    // drive
    if (x > PAD.x0 - 4 && x < PAD.x1 + 4 && z > PAD.z0 - 4 && z < PAD.z1 + 4 && Math.hypot(x - cx, z - cz) < 85) continue;
    trees.push([x, hAt(x, z), z, 38 + R() * 38, R()]);
  }
  // undergrowth along the forest edge
  const shrubs = [];
  for (let i = 0; i < 1400 && shrubs.length < 260; i++) {
    const a = R() * Math.PI * 2, r = 58 + Math.pow(R(), 1.4) * 260, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (x < -140 || (x < 6 && z > -50 && z < 66) || (x > 50 && z > 4 && z < 38)) continue;
    shrubs.push([x, hAt(x, z), z, 3 + R() * 4, R()]);
  }
  group.add(buildForest(trees.map(([x, y, z, h, v]) => [x, y, z, h, v, Math.hypot(x - cx, z - cz)]), shrubs.map(([x, y, z, sz, v]) => [x, y + 0.2, z, sz, v])));
  return { group, surfaces, hAt };
}
