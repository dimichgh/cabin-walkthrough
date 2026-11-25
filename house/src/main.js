import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeMaterials } from './materials.js';
import { buildHouse, LV } from './house.js';
import { buildSite, PAD } from './site.js';
import { makeWalker } from './walk.js';
import { PLACES, VIEWS } from './places.js';
import { INFO, STATUS } from './info.js';
import { makePhoto, sunDirection, makeNightLights } from './photo.js';
import { buildFurniture } from './furniture.js';
import { buildCar } from './car.js';
import { makeKit } from './kit.js';

const $ = (s) => document.querySelector(s);
const boot = (t) => { const b = $('#boot'); if (b) b.textContent = t; };
const D = Math.PI / 180;

/* ───────── renderer / scene ───────── */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // everything is static: draw the sun's shadow map once, not every frame
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 6000);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

// sky dome
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x6f9fd0) }, mid: { value: new THREE.Color(0xc9dcec) }, bot: { value: new THREE.Color(0xe9eef0) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.6,0.0,1.0),0.7)) : bot; gl_FragColor = vec4(c,1.0); }',
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), skyMat);
scene.add(sky);
scene.fog = new THREE.Fog(0xc9dcec, 420, 2600);

const hemi = new THREE.HemisphereLight(0xe4eef8, 0x5a5440, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.target.position.set(24, 0, 10);
const placeSun = (t) => { sun.position.copy(sun.target.position).addScaledVector(sunDirection(t), 220); renderer.shadowMap.needsUpdate = true; };
placeSun(0.78);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 20, far: 460 });
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

/* ───────── build ───────── */
boot('Drawing materials…');
const M = makeMaterials();
for (const m of Object.values(M)) if (m.isMeshStandardMaterial) m.envMapIntensity = 0.55;
M.glass.envMapIntensity = 1.4; M.roof.envMapIntensity = 0.28;
boot('Building the cabin…');
const H = buildHouse(M);
// furniture, fixtures and the car join the building's mesh list (so modes, cutaways and photo swaps apply);
// their meshes and colliders carry userData.opt / opt so they can be switched off
const F = buildFurniture(M);
const carKit = makeKit(); carKit.level = '1'; carKit.opt = 'car';
carKit.push(72.5, LV.GRADE, 17.0, 180); buildCar(carKit); carKit.pop();
H.meshes.push(...F.meshes, ...carKit.finish(M));
const optColliders = [...F.colliders, ...carKit.colliders];
const house = new THREE.Group(); H.meshes.forEach((m) => house.add(m)); scene.add(house);
const nightLights = makeNightLights(F.lights); scene.add(nightLights);
const site = buildSite(M, H.footprintHole); scene.add(site.group);
const walker = makeWalker({ colliders: [...H.colliders, ...optColliders], surfaces: [...H.surfaces, ...site.surfaces], bounds: { x0: PAD.x0 + 2, x1: PAD.x1 - 2, z0: PAD.z0 + 2, z1: PAD.z1 - 2 } });
const photo = makePhoto({ renderer, scene, camera, M, sky, lights: [sun, hemi], site: site.group, house: H.meshes, nightLights, lightOn: (l) => lightWanted(l) });
const grid = new THREE.GridHelper(240, 48, 0x4fd8ff, 0x1d5f7a); grid.position.set(25, LV.GRADE - 0.02, 10); grid.visible = false; scene.add(grid);

/* ───────── materials per mode (one registry; every building material carries the section plane) ───────── */
const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);
const SITE_MATS = new Set(['grass', 'water', 'trunk', 'pine', 'pine2']);
for (const [k, m] of Object.entries(M)) if (!SITE_MATS.has(k)) m.clippingPlanes = [cutPlane];
const CAT = (k) => k === 'glass' || k === 'screen' ? 'glass'
  : ['oak', 'tile', 'rug', 'mahogany'].includes(k) ? 'floor'
  : k === 'roof' ? 'roof'
  : ['steel', 'trim', 'column', 'alum', 'appliance', 'garage'].includes(k) ? 'metal'
  : ['concrete', 'flagstone', 'found', 'gravel', 'fire'].includes(k) ? 'masonry' : 'wall';
const translucent = (color, opacity, additive) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, clippingPlanes: [cutPlane] });
const XRAY = { wall: translucent(0x7ea6d6, 0.07), floor: translucent(0x3f7fc4, 0.22), glass: translucent(0x56c8f5, 0.16), roof: translucent(0x8899aa, 0.05), metal: translucent(0x29435e, 0.3), masonry: translucent(0x9d927f, 0.18) };
const HOLO = { wall: translucent(0x1fb6ff, 0.035, true), floor: translucent(0x19e0c0, 0.085, true), glass: translucent(0x8ff8ff, 0.07, true), roof: translucent(0x2a7dff, 0.025, true), metal: translucent(0x5ff4ff, 0.13, true), masonry: translucent(0x3bd1a0, 0.07, true) };
const EDGE = {
  xray: new THREE.LineBasicMaterial({ color: 0x17324f, transparent: true, opacity: 0.5, depthWrite: false, clippingPlanes: [cutPlane] }),
  holo: new THREE.LineBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes: [cutPlane] }),
};
let edgesBuilt = false;
function buildEdges() {
  if (edgesBuilt) return; edgesBuilt = true;
  for (const mesh of H.meshes) {
    if (['ceil', 'soffit', 'rug', 'glass'].includes(mesh.userData.mat)) continue;
    if (mesh.userData.mat === 'flame') continue;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, mesh.userData.opt ? 55 : 28), EDGE.xray);
    e.visible = false; e.raycast = () => {}; mesh.add(e); mesh.userData.edges = e;
  }
}

const S = { mode: 'real', view: 'orbit', levels: 'all', labels: true, cut: null, furniture: true, car: true, time: 'day' };
const LEVEL_SETS = { all: ['B', '1', '2', 'R'], roof: ['B', '1', '2'], ground: ['B', '1'], basement: ['B'] };
const levelOn = (lv) => lv === 'site' || LEVEL_SETS[S.levels].includes(lv);
const optOn = (opt) => !opt || S[opt];
const meshOn = (m) => levelOn(m.userData.level) && optOn(m.userData.opt);
// which night lights the path tracer gets: all of them from outside; from inside, the ones near you on your floor
// (it samples one light at random per bounce, so far-away lights only add noise)
const floorOf = (y) => (y < -5 ? 'B' : y < 5 ? '1' : '2');
function lightWanted(l) {
  if (!levelOn(l.userData.level) || !optOn(l.userData.opt)) return false;
  if (!insideHouse()) return true;
  const d = l.position.distanceTo(camera.position);
  return d < 34 && (l.userData.level === floorOf(walker.s.y) || d < 14);
}

let photoBusy = false, labelsBeforePhoto = null, evOffset = 0;
function setMode(mode) {
  if (photoBusy || !['real', 'photo', 'xray', 'holo'].includes(mode) || (mode === 'photo' && S.mode === 'photo')) return;
  const prev = S.mode;
  if (prev === 'photo' && mode !== 'photo') { photo.exit(); window.CABIN?.setQuality(null); if (labelsBeforePhoto != null) setLabels(labelsBeforePhoto); labelsBeforePhoto = null; }
  S.mode = mode;
  if (mode === 'photo') { applyLook('real'); enterPhoto(prev); }
  else applyLook(mode);
}
function applyLook(mode) {
  if (mode !== 'real') buildEdges();
  for (const mesh of H.meshes) {
    const k = mesh.userData.mat;
    mesh.material = mode === 'real' || k === 'flame' ? M[k] : (mode === 'xray' ? XRAY : HOLO)[CAT(k)];
    mesh.castShadow = mode === 'real' && !['glass', 'screen', 'ceil', 'soffit', 'flame'].includes(k);
    if (mesh.userData.edges) { mesh.userData.edges.visible = mode !== 'real'; mesh.userData.edges.material = EDGE[mode] || EDGE.xray; }
  }
  const real = mode === 'real';
  site.group.visible = real; grid.visible = !real; sky.visible = real;
  renderer.shadowMap.enabled = real; sun.castShadow = real; renderer.shadowMap.needsUpdate = true;
  scene.fog = real ? new THREE.Fog(0xc9dcec, 420, 2600) : null;
  scene.background = real ? null : new THREE.Color(mode === 'xray' ? 0xeef2f6 : 0x030b16);
  grid.material.opacity = mode === 'xray' ? 0.35 : 0.5; grid.material.transparent = true;
  document.body.dataset.mode = S.mode;
  document.querySelectorAll('#bar button[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
  needsRender = true;
}
// photo mode: path tracing needs a prepared scene (geometry BVH, textures); show a note while that happens
function busy(on, text) { const el = $('#busy'); el.textContent = text || ''; el.hidden = !on; }
function enterPhoto(prev) {
  if (prev !== 'photo') { labelsBeforePhoto = S.labels; setLabels(false); }
  setCut(null); window.CABIN?.setQuality(1);
  photoBusy = true; busy(true, 'Preparing photo mode…');
  setTimeout(() => {
    try { photo.enter(); exposure.cur = exposure.target = 1; applyExposure(); }
    catch (e) { console.error(e); try { photo.exit(); } catch (_) {} photoBusy = false; busy(false); S.mode = 'real'; window.CABIN?.setQuality(null); if (labelsBeforePhoto != null) setLabels(labelsBeforePhoto); labelsBeforePhoto = null; applyLook('real'); alert('Photo mode could not start on this device: ' + e.message); return; }
    photoBusy = false; busy(false); lastCamKey = '';
  }, 40);
}
// photo exposure: a base for outdoors / indoors, then partial adaptation to the metered frame (log-average
// luminance, quarter power), so a dark basement opens up without blowing out a bright living room. The Exposure
// slider adds compensation in stops on top.
const insideHouse = () => { const p = walker.s; return S.view === 'walk' && ((p.x > 0.3 && p.x < 59.5 && p.z > 0.3 && p.z < 31.8) || (p.y > 9 && p.x > -0.3 && p.x < 28.3 && p.z > -15.2 && p.z < 32.3)); };
const EXPOSURE_BASE = { day: [1.0, 3.4], dusk: [2.4, 2.6], night: [3.0, 2.2] }; // [outside, inside]
const exposure = { cur: 1, target: 1, metered: 0, L: 0.03, base: 1, snap: true, at: new THREE.Vector3() };
const applyExposure = () => { renderer.toneMappingExposure = exposure.cur * Math.pow(2, evOffset); };
const exposureFor = () => Math.max(0.6, Math.min(14, exposure.base * Math.pow(0.03 / Math.max(exposure.L, 1e-5), 0.25)));
function meterExposure(real) {
  const base = (EXPOSURE_BASE[S.time] || EXPOSURE_BASE.day)[insideHouse() ? 1 : 0];
  if (base !== exposure.base) { exposure.base = base; exposure.target = exposureFor(); }
  const n = photo.samples;
  for (const at of [4, 24, 96]) if (n >= at && exposure.metered < at) {
    exposure.metered = at;
    const L = photo.meter(); if (L > 0) { exposure.L = L; exposure.target = exposureFor(); }
    if (exposure.snap) { exposure.cur = exposure.target; exposure.snap = false; applyExposure(); }
  }
  if (Math.abs(exposure.cur - exposure.target) > 1e-3) { exposure.cur += (exposure.target - exposure.cur) * Math.min(1, real * 5); applyExposure(); }
}
function setLevels(key) {
  if (!LEVEL_SETS[key]) return;
  S.levels = key;
  for (const mesh of H.meshes) mesh.visible = meshOn(mesh);
  renderer.shadowMap.needsUpdate = true;
  photoRebuild();
  document.querySelectorAll('#bar button[data-level]').forEach((b) => b.classList.toggle('on', b.dataset.level === key));
  needsRender = true;
}
// furniture / car on or off: meshes, colliders, lamps; photo mode needs a rebuild (geometry changed)
function setOption(name, on) {
  if (!['furniture', 'car'].includes(name) || photoBusy) return;
  S[name] = !!on;
  for (const mesh of H.meshes) mesh.visible = meshOn(mesh);
  for (const c of optColliders) c.off = !optOn(c.opt);
  renderer.shadowMap.needsUpdate = true;
  $(name === 'furniture' ? '#furnBtn' : '#carBtn').classList.toggle('on', S[name]);
  photoRebuild(); needsRender = true;
}
function photoRebuild() {
  if (!photo.active || photoBusy) return;
  photoBusy = true; busy(true, 'Updating photo scene…');
  setTimeout(() => { try { photo.refreshLights(); photo.rebuild(); } finally { photoBusy = false; busy(false); exposure.metered = 0; } }, 40);
}
function setTime(t) {
  if (photoBusy || !photo.setTime(t)) return;
  S.time = t; exposure.metered = 0; exposure.snap = true;
  document.querySelectorAll('#timeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.time === t));
  $('#sunLbl').classList.toggle('off', t !== 'day');
  needsRender = true;
}
function setCut(h) { // horizontal plan cut: keep everything below h (feet); null = off
  if (S.mode === 'photo' && h != null) h = null; // the path tracer does not support clipping planes
  S.cut = h; cutPlane.constant = h == null ? 1e4 : h;
  $('#cutOn').checked = h != null; if (h != null) $('#cutH').value = h;
  $('#cutVal').textContent = h == null ? 'off' : ftIn(h);
  needsRender = true;
}
function ftIn(v) { const s = v < 0 ? '−' : ''; v = Math.abs(v); let f = Math.floor(v), i = Math.round((v - f) * 12); if (i === 12) { f++; i = 0; } return `${s}${f}'-${i}"`; }

/* ───────── orbit ───────── */
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.maxDistance = 900; orbit.minDistance = 4; orbit.maxPolarAngle = 88 * D;
let fly = null;
function view(name, { instant = false } = {}) {
  const v = VIEWS[name]; if (!v) return false;
  setView('orbit');
  camera.up.set(...(v.up || [0, 1, 0]));
  orbit.maxPolarAngle = v.up ? Math.PI : 88 * D;
  const to = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target), fov: v.fov || 50 };
  if (instant) { camera.position.copy(to.pos); orbit.target.copy(to.target); camera.fov = to.fov; camera.updateProjectionMatrix(); orbit.update(); fly = null; }
  else fly = { t: 0, from: { pos: camera.position.clone(), target: orbit.target.clone(), fov: camera.fov }, to };
  needsRender = true; return true;
}

/* ───────── walk ───────── */
const keys = new Set();
let camY = 0, lookDrag = null, everWalked = false;
const input = { f: 0, r: 0, run: false };
function setView(v) {
  if (S.view === v) return;
  S.view = v;
  orbit.enabled = v === 'orbit';
  document.body.dataset.view = v;
  document.querySelectorAll('#bar button[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'walk') { camera.up.set(0, 1, 0); camera.fov = 70; camera.updateProjectionMatrix(); camY = walker.s.y + 5.35; fly = null; }
  else { if (document.pointerLockElement) document.exitPointerLock(); camera.fov = 50; camera.updateProjectionMatrix();
    const s = walker.s; orbit.target.set(s.x - Math.sin(s.yaw) * 6, s.y + 4, s.z - Math.cos(s.yaw) * 6); orbit.update(); }
  needsRender = true;
}
function walkAt(x, z, y, yaw) {
  if (!walker.place(x, z, y + 0.5, yaw)) return false;
  walker.s.pitch = -4 * D; everWalked = true;
  if (S.view !== 'walk') { S.view = 'orbit'; setView('walk'); }
  camY = walker.s.y + 5.35; needsRender = true; return true;
}
function goTo(id) {
  const p = PLACES.find((q) => q.id === id); if (!p) return false;
  if (p.walk) {
    if (!levelOn(p.level)) setLevels('all');
    return walkAt(p.walk.x, p.walk.z, p.walk.y, p.walk.yaw);
  }
  setView('orbit');
  const t = new THREE.Vector3(...p.pos), dir = camera.position.clone().sub(orbit.target).normalize();
  fly = { t: 0, from: { pos: camera.position.clone(), target: orbit.target.clone(), fov: camera.fov }, to: { pos: t.clone().addScaledVector(dir, 38), target: t, fov: 50 } };
  return true;
}

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return; // leave browser shortcuts (copy, find…) alone
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'Digit1') setMode('real'); else if (e.code === 'Digit2') setMode('xray'); else if (e.code === 'Digit3') setMode('holo');
  else if (e.code === 'KeyP') setMode(S.mode === 'photo' ? 'real' : 'photo');
  else if (e.code === 'KeyL') setLabels(!S.labels);
  else if (e.code === 'KeyF') setOption('furniture', !S.furniture);
  else if (e.code === 'KeyC') setOption('car', !S.car);
  else if (e.code === 'KeyV') setView(S.view === 'walk' ? 'orbit' : 'walk');
  else if (e.code === 'Escape' && S.view === 'walk' && !document.pointerLockElement) setView('orbit');
  if (S.view === 'walk' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('click', () => { if (S.view === 'walk' && !document.pointerLockElement && canvas.requestPointerLock && !matchMedia('(pointer: coarse)').matches) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { } } });
addEventListener('mousemove', (e) => {
  if (S.view !== 'walk') return;
  if (document.pointerLockElement === canvas) look(e.movementX, e.movementY);
  else if (lookDrag) { look(e.clientX - lookDrag.x, e.clientY - lookDrag.y); lookDrag = { x: e.clientX, y: e.clientY }; }
});
canvas.addEventListener('mousedown', (e) => { if (S.view === 'walk') lookDrag = { x: e.clientX, y: e.clientY }; });
addEventListener('mouseup', () => { lookDrag = null; });
function look(dx, dy) { walker.s.yaw -= dx * 0.0024; walker.s.pitch = Math.max(-80 * D, Math.min(80 * D, walker.s.pitch - dy * 0.0024)); needsRender = true; }
// touch: left third = move stick, elsewhere = look
const touches = new Map();
canvas.addEventListener('touchstart', (e) => { if (S.view !== 'walk') return; for (const t of e.changedTouches) touches.set(t.identifier, { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, stick: t.clientX < innerWidth * 0.38 }); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { if (S.view !== 'walk') return; for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (!s) continue; if (!s.stick) look((t.clientX - s.x) * 1.4, (t.clientY - s.y) * 1.4); s.x = t.clientX; s.y = t.clientY; } e.preventDefault(); }, { passive: false });
const endTouch = (e) => { for (const t of e.changedTouches) touches.delete(t.identifier); };
canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);
// double-click a floor in orbit view: walk from there
canvas.addEventListener('dblclick', (e) => {
  if (S.view !== 'orbit') return;
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1), camera);
  const hits = ray.intersectObjects([...H.meshes.filter((m) => m.visible && !m.userData.opt), ...site.group.children.filter((m) => m.userData.site === 'pad' || m.userData.site === 'drive')], false)
    .filter((h) => h.face && h.face.normal.y > 0.7 && (S.cut == null || h.point.y < S.cut));
  if (!hits.length) return;
  const p = hits[0].point, d = camera.getWorldDirection(new THREE.Vector3());
  walkAt(p.x, p.z, p.y + 0.3, Math.atan2(-d.x, -d.z));
});

/* ───────── labels + info card ───────── */
const tagLayer = $('#tags');
for (const p of PLACES) {
  const el = document.createElement('button'); el.className = 'tag'; el.dataset.lv = p.level;
  el.innerHTML = `<span class="dot"></span><span class="t">${p.title}</span>`;
  el.addEventListener('click', (e) => { e.stopPropagation(); openInfo(p); });
  tagLayer.appendChild(el); p.el = el; p.v = new THREE.Vector3(...p.pos);
}
function setLabels(on) { S.labels = on; $('#labelsBtn').classList.toggle('on', on); needsRender = true; }
const tmp = new THREE.Vector3();
function updateTags() {
  const placed = [];
  const order = PLACES.map((p) => [p, p.v.distanceTo(camera.position)]).sort((a, b) => a[1] - b[1]);
  for (const [p, dist] of order) {
    let show = S.labels && levelOn(p.level) && (S.cut == null || p.v.y < S.cut + 2);
    if (S.view === 'walk') show = show && dist < 34 && Math.abs(p.v.y - 4.5 - walker.s.y) < 6.5 && p.level !== 'site';
    else show = show && dist < (p.level === 'site' ? 700 : 260);
    if (show) { tmp.copy(p.v).project(camera); show = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05; }
    if (show) {
      const x = (tmp.x + 1) / 2 * innerWidth, y = (1 - tmp.y) / 2 * innerHeight, w = 18 + p.title.length * 7.2, h = 26;
      if (placed.some((r) => x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h && y + h > r.y)) show = false;
      else { placed.push({ x, y, w, h }); p.el.style.transform = `translate(${x | 0}px, ${(y | 0) - 13}px)`; }
    }
    p.el.style.display = show ? '' : 'none';
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function openInfo(p) {
  const n = p.node && INFO[p.node];
  const card = $('#info'); card.hidden = false;
  const src = n ? (STATUS[n.status]?.label || n.status) : '';
  card.querySelector('.kind').innerHTML = `<span class="pill ${p.placement}">${p.placement === 'drawn' ? 'Position from the drawings' : 'Indicative · plan not published'}</span>${src ? `<span class="pill src">${esc(src)}</span>` : ''}`;
  card.querySelector('h2').textContent = n ? n.name : p.title;
  card.querySelector('.tagline').textContent = n?.tagline || '';
  card.querySelector('.note').textContent = p.note || n?.role || '';
  card.querySelector('.role').textContent = p.note && n?.role ? n.role : '';
  card.querySelector('.facts').innerHTML = (n?.facts || []).map((f) => `<li>${esc(f)}</li>`).join('');
  card.querySelector('.where').textContent = n?.where ? `Sheets: ${n.where}` : '';
  const wb = card.querySelector('.walkhere'); wb.hidden = !p.walk; wb.onclick = () => goTo(p.id);
}
$('#info .x').addEventListener('click', () => { $('#info').hidden = true; });

/* ───────── place list ───────── */
const LVNAME = { site: 'Outside', R: 'Roof', '2': 'Second floor', '1': 'Entry level', B: 'Basement' };
{
  const box = $('#placeList');
  for (const lv of ['site', '2', '1', 'B', 'R']) {
    const items = PLACES.filter((p) => p.level === lv && (p.walk || lv === 'R'));
    if (!items.length) continue;
    const h = document.createElement('div'); h.className = 'grp'; h.textContent = LVNAME[lv]; box.appendChild(h);
    for (const p of items) {
      const b = document.createElement('button'); b.className = 'place'; b.innerHTML = `${esc(p.title)}${p.placement === 'schematic' ? ' <i>·&nbsp;indicative</i>' : ''}`;
      b.addEventListener('click', () => { goTo(p.id); openInfo(p); }); box.appendChild(b);
    }
  }
}

/* ───────── UI wiring ───────── */
document.querySelectorAll('#bar button[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelectorAll('#bar button[data-level]').forEach((b) => b.addEventListener('click', () => setLevels(b.dataset.level)));
document.querySelectorAll('#bar button[data-view]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.view === 'walk' && S.view !== 'walk') { if (!everWalked) goTo('approach'); else setView('walk'); }
  else setView(b.dataset.view);
}));
document.querySelectorAll('#side button[data-cam]').forEach((b) => b.addEventListener('click', () => view(b.dataset.cam)));
$('#labelsBtn').addEventListener('click', () => setLabels(!S.labels));
$('#furnBtn').addEventListener('click', () => setOption('furniture', !S.furniture));
$('#carBtn').addEventListener('click', () => setOption('car', !S.car));
document.querySelectorAll('#timeSeg button').forEach((b) => b.addEventListener('click', () => setTime(b.dataset.time)));
$('#ev').addEventListener('input', (e) => { evOffset = +e.target.value; applyExposure(); });
$('#sunT').addEventListener('input', (e) => { const t = +e.target.value; placeSun(t); photo.setSun(t); exposure.metered = 0; needsRender = true; });
$('#saveImg').addEventListener('click', () => photo.save(`cabin-photo-${photo.samples}spp.png`));
for (const id of ['ev', 'sunT']) $('#' + id).addEventListener('change', (e) => e.target.blur());
$('#cutOn').addEventListener('change', (e) => { setCut(e.target.checked ? +$('#cutH').value : null); e.target.blur(); });
$('#cutH').addEventListener('input', (e) => setCut(+e.target.value));
$('#cutH').addEventListener('change', (e) => e.target.blur());
// buttons should not keep keyboard focus (Space/Enter would re-press them while walking)
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
$('#helpBtn').addEventListener('click', () => $('#help').classList.toggle('open'));
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); needsRender = true; });

/* ───────── loop ───────── */
let needsRender = true, last = performance.now(), frames = 0;
// adaptive resolution: if continuous rendering gets slow (weak GPU), render fewer pixels; recover when fast again
const PR_MAX = Math.min(window.devicePixelRatio, 2);
let pr = PR_MAX, prPinned = null, ema = 16, lastRender = 0, renderedLast = false;
function adapt(now, rendering) {
  if (prPinned != null) return;
  if (rendering && renderedLast) {
    ema = ema * 0.85 + (now - lastRender) * 0.15;
    let next = pr;
    if (ema > 55 && pr > 0.5) next = Math.max(0.5, pr * 0.8);
    else if (ema < 22 && pr < PR_MAX) next = Math.min(PR_MAX, pr * 1.1);
    if (Math.abs(next - pr) > 0.01) { pr = next; renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); ema = 30; }
  }
  renderedLast = rendering; if (rendering) lastRender = now;
}
const floorName = (y) => y < -6 ? 'Basement' : y < -1.2 ? (walker.s.x > 34 && walker.s.x < 59.8 && walker.s.z > 8.57 && walker.s.z < 32.1 ? 'Garage' : 'Outside') : y < 5 ? (walker.s.x > 0.2 && walker.s.x < 59.8 && walker.s.z > 0.2 && walker.s.z < 32.1 ? 'Entry level' : 'Terrace / outside') : 'Second floor';
function tick(now) {
  requestAnimationFrame(tick); // queue first, so one bad frame can never stop the loop
  frames++;
  const real = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now; // real time, so walking keeps pace on slow GPUs
  const dt = Math.min(0.05, real);
  if (S.view === 'walk') {
    input.f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    input.r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    if (keys.has('ArrowLeft')) look(-260 * real, 0); if (keys.has('ArrowRight')) look(260 * real, 0);
    for (const t of touches.values()) if (t.stick) { input.f = Math.max(-1, Math.min(1, -(t.y - t.y0) / 60)); input.r = Math.max(-1, Math.min(1, (t.x - t.x0) / 60)); }
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (input.f || input.r || walker.s.vy) { for (let t = real; t > 1e-4; t -= 0.05) walker.step(input, Math.min(0.05, t)); needsRender = true; }
    const target = walker.s.y + 5.35; camY += (target - camY) * Math.min(1, dt * 14); if (Math.abs(target - camY) > 0.002) needsRender = true;
    camera.position.set(walker.s.x, camY, walker.s.z);
    camera.rotation.set(walker.s.pitch, walker.s.yaw, 0, 'YXZ');
    $('#where').textContent = `${floorName(walker.s.y)} · floor ${ftIn(walker.s.y)}`;
  } else {
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 0.9); const k = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
      camera.position.lerpVectors(fly.from.pos, fly.to.pos, k); orbit.target.lerpVectors(fly.from.target, fly.to.target, k);
      camera.fov = fly.from.fov + (fly.to.fov - fly.from.fov) * k; camera.updateProjectionMatrix();
      if (fly.t >= 1) fly = null; needsRender = true;
    }
    if (orbit.update()) needsRender = true;
  }
  // compass: plan north is −z
  const d = camera.getWorldDirection(tmp); $('#compass').style.transform = `rotate(${Math.atan2(d.x, -d.z) * -180 / Math.PI}deg)`;
  if (photo.active || photoBusy) {
    if (photoBusy) return;
    const key = camKey();
    if (key !== lastCamKey) { exposure.snap = !lastCamKey || camera.position.distanceTo(exposure.at) > 6; exposure.at.copy(camera.position); lastCamKey = key; exposure.metered = 0; photo.refreshLights(); photo.cameraMoved(); try { updateTags(); } catch (e) { console.error(e); } }
    photo.render(); meterExposure(real);
    if (frames % 10 === 0) { const n = photo.samples; $('#photoInfo').textContent = n >= photo.maxSamples ? `Done · ${n} samples` : n < 3 ? 'Rendering…' : `Rendering · ${n} samples`; }
    needsRender = false;
    return;
  }
  const rendering = needsRender; adapt(now, rendering);
  if (needsRender) { needsRender = false; try { updateTags(); } catch (e) { console.error(e); } renderer.render(scene, camera); }
}
let lastCamKey = '';
const camKey = () => { const p = camera.position, q = camera.quaternion; return [p.x, p.y, p.z, q.x, q.y, q.z, q.w, camera.fov, camera.aspect].map((v) => v.toFixed(4)).join(','); };
orbit.addEventListener('change', () => { needsRender = true; });

/* ───────── automation / tests ───────── */
function testRoute(pts, { maxT = 90, tol = 0.75 } = {}) {
  const w = walker, [x0, z0, y0] = pts[0];
  if (!w.place(x0, z0, (y0 ?? 60) + 0.5)) return [{ to: pts[0], ok: false, why: 'no floor at start' }];
  const log = [];
  for (let i = 1; i < pts.length; i++) {
    const [tx, tz, ty] = pts[i]; let t = 0, best = Infinity, stall = 0; const yStart = w.s.y; w.s.minY = w.s.y;
    while (t < maxT) {
      const dx = tx - w.s.x, dz = tz - w.s.z, d = Math.hypot(dx, dz);
      if (d < tol) break;
      w.s.yaw = Math.atan2(-dx, -dz); w.step({ f: 1, r: 0, run: false }, 1 / 30); t += 1 / 30;
      if (d < best - 0.02) { best = d; stall = 0; } else if ((stall += 1 / 30) > 2.5) break;
    }
    const d = Math.hypot(tx - w.s.x, tz - w.s.z);
    const lowest = Math.min(yStart, ty ?? Infinity) - 0.6;
    const ok = d < tol && (ty === undefined || Math.abs(w.s.y - ty) < 0.35) && w.s.minY >= lowest;
    log.push({ to: [tx, tz, ty], at: [w.s.x, w.s.y, w.s.z].map((v) => +v.toFixed(2)), minY: +w.s.minY.toFixed(2), ok, secs: +t.toFixed(1) });
  }
  return log;
}
function checkPlaces() {
  return PLACES.filter((p) => p.walk).map((p) => {
    const g = walker.groundAt(p.walk.x, p.walk.z, p.walk.y + 0.5);
    return { id: p.id, ground: +g.toFixed(2), floorOk: Math.abs(g - p.walk.y) < 0.2, clear: walker.clearAt(p.walk.x, p.walk.z, g) };
  });
}
window.CABIN = { renderer, scene,
  get state() { return { ...S, walker: { ...walker.s } }; },
  setMode, setLevels, setCut, setView, view, goTo, walkAt, setLabels, setOption, testRoute, checkPlaces, stats: H.stats,
  get counts() { return { meshes: H.meshes.length, visible: H.meshes.filter((m) => m.visible).length, colliders: walker.colliderCount?.() ?? null, optOff: optColliders.filter((c) => c.off).length, lights: nightLights.children.filter((l) => l.isLight).length }; },
  openInfo(id) { const p = PLACES.find((q) => q.id === id); if (!p) throw new Error('no place ' + id); openInfo(p); return document.querySelector('#info h2').textContent; },
  places: PLACES.map((p) => p.id),
  get frames() { return frames; },
  photo: { setTime, rebuild() { photoRebuild(); }, get time() { return photo.time; }, get lights() { return photo.lightCount; }, get glow() { return photo.glow; }, get active() { return photo.active && !photoBusy; }, get samples() { return photo.samples; }, setSun(t) { placeSun(t); photo.setSun(t); }, setEV(v) { evOffset = v; applyExposure(); }, get exposure() { return +exposure.cur.toFixed(2); }, meter: () => photo.meter(), get stats() { photo.meter(); return photo.stats; } },
  setQuality(v) { prPinned = v == null ? null : +v; pr = prPinned ?? PR_MAX; renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); needsRender = true; return pr; },
  get pixelRatio() { return pr; },
  renderNow() { updateTags(); if (photo.active) photo.render(); else renderer.render(scene, camera); return true; },
  look(yawDeg, pitchDeg = -4) { walker.s.yaw = yawDeg * D; walker.s.pitch = pitchDeg * D; needsRender = true; },
};

setMode('real'); setLevels('all'); setCut(null);
view('aerial', { instant: true });
walker.place(74, -10, 0, 108 * D);
requestAnimationFrame(tick);
$('#boot').remove();
window.CABIN.ready = true;
