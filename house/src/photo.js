// Photo mode: progressive path tracing (three-gpu-pathtracer). Real sky light and sun through the windows,
// bounced light indoors, soft sun shadows, refracting glass, reflective water. While the camera moves you see a
// fast low-resolution preview; when it stops the frame converges.
import * as THREE from 'three';
import { WebGLPathTracer, DenoiseMaterial } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// time of day 0…1: sunrise in the east → noon in the south → sunset in the west (plan: x east, z south)
export function sunDirection(t) {
  const az = Math.PI * t, elev = Math.max(4, 62 * Math.sin(Math.PI * t)) * Math.PI / 180;
  return new THREE.Vector3(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)).normalize();
}

// HDR equirectangular sky with a physically sized sun disk; energy is normalised so the sun's irradiance does not
// depend on texture resolution.
export function makeSky(sunDir, W = 1024, H = 512) {
  const data = new Float32Array(W * H * 4);
  const se = Math.asin(sunDir.y), low = 1 - Math.min(1, se / (50 * Math.PI / 180));           // 0 high sun … 1 at horizon
  const zen = [0.07, 0.17, 0.46], hor = [0.52 + 0.25 * low, 0.64 + 0.05 * low, 0.82 - 0.2 * low];
  const sunCol = [1.0, 0.94 - 0.22 * low, 0.86 - 0.42 * low], tint = [1.0, 0.8 - 0.15 * low, 0.55 - 0.2 * low];
  const skyScale = 0.55 * (0.45 + 0.55 * (1 - low)), E_sun = 3.4 * (0.35 + 0.65 * (1 - low * low));
  const rs = Math.max(0.265 * Math.PI / 180, 0.8 * Math.PI / H), cosRs = Math.cos(rs);
  const disk = []; let omega = 0;
  for (let j = 0; j < H; j++) {
    const e = ((j + 0.5) / H - 0.5) * Math.PI, ce = Math.cos(e), dOmega = (2 * Math.PI / W) * (Math.PI / H) * ce;
    for (let i = 0; i < W; i++) {
      const phi = ((i + 0.5) / W - 0.5) * 2 * Math.PI;
      const dx = Math.cos(phi) * ce, dy = Math.sin(e), dz = Math.sin(phi) * ce, k = (j * W + i) * 4;
      const cosS = dx * sunDir.x + dy * sunDir.y + dz * sunDir.z;
      let r, g, b;
      if (e < 0) { const f = Math.min(1, -e * 6); r = hor[0] * (1 - f) + 0.06 * f; g = hor[1] * (1 - f) + 0.055 * f; b = hor[2] * (1 - f) + 0.05 * f; }
      else {
        const t = Math.pow(1 - e / (Math.PI / 2), 3.2);
        r = zen[0] + (hor[0] - zen[0]) * t; g = zen[1] + (hor[1] - zen[1]) * t; b = zen[2] + (hor[2] - zen[2]) * t;
        const c = Math.max(cosS, 0), glow = (0.22 * Math.pow(c, 6) + 1.1 * Math.pow(c, 48)) * (1 + 2.5 * low * Math.pow(1 - e / (Math.PI / 2), 6));
        r += tint[0] * glow; g += tint[1] * glow; b += tint[2] * glow;
      }
      data[k] = r * skyScale; data[k + 1] = g * skyScale; data[k + 2] = b * skyScale; data[k + 3] = 1;
      if (cosS > cosRs) { disk.push(k); omega += dOmega; }
    }
  }
  const L = E_sun / Math.max(omega, 1e-6);
  for (const k of disk) { data[k] += sunCol[0] * L; data[k + 1] += sunCol[1] * L; data[k + 2] += sunCol[2] * L; }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  return tex;
}

// InstancedMesh → plain merged meshes (the path tracer flattens meshes but does not expand instances).
// Instance tints are kept as three shade buckets.
function flattenInstances(group) {
  const out = new THREE.Group(), m = new THREE.Matrix4(), c = new THREE.Color();
  group.traverse((o) => {
    if (!o.isInstancedMesh) return;
    const buckets = [[], [], []];
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.premultiply(o.matrixWorld);
      const g = o.geometry.clone().applyMatrix4(m);
      let b = 1; if (o.instanceColor) { o.getColorAt(i, c); b = c.r < 0.92 ? 0 : c.r < 1.02 ? 1 : 2; }
      buckets[b].push(g);
    }
    buckets.forEach((list, b) => {
      if (!list.length) return;
      const mat = o.material.clone(); mat.onBeforeCompile = o.material.onBeforeCompile; mat.customProgramCacheKey = o.material.customProgramCacheKey;
      if (o.instanceColor) mat.color.setScalar([0.86, 0.97, 1.08][b]);
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      list.forEach((g) => g.dispose());
      out.add(mesh);
    });
  });
  return out;
}

export function makePhoto({ renderer, scene, camera, M, sky, lights, site, house }) {
  let pt = null, forest = null, skyTex = null, active = false, sunT = 0.78, maxSamples = 3000, saved = {};
  // window panes as thin glass (thickness 0 = thin film in the path tracer: transmits and reflects, no offset)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.0, transmission: 1, ior: 1.5, thickness: 0, side: THREE.DoubleSide });
  const water = new THREE.MeshPhysicalMaterial({ color: 0x0b2733, metalness: 0, roughness: 0.04, ior: 1.33 });
  const swaps = { glass };
  // standing-seam panels, trim, columns and the garage door are painted: a dielectric coat, not bare metal
  for (const [k, rough] of [['roof', 0.64], ['metal', 0.5], ['trim', 0.4], ['column', 0.4], ['soffit', 0.55], ['garage', 0.45]]) {
    const m = M[k].clone(); m.metalness = 0; m.roughness = rough; swaps[k] = m;
  }

  function init() {
    if (pt) return;
    pt = new WebGLPathTracer(renderer);
    pt.tiles.set(2, 2);
    pt.bounces = 6; pt.transmissiveBounces = 8; pt.filterGlossyFactor = 0.5; pt.multipleImportanceSampling = true;
    pt.minSamples = 2; pt.fadeDuration = 350; pt.renderDelay = 80; pt.dynamicLowRes = true; pt.lowResScale = 0.3;
    pt.textureSize.set(512, 512);
    // early frames: an edge-aware denoise blended over the raw image, fading out as samples accumulate
    const den = new DenoiseMaterial(); den.transparent = true; den.blending = THREE.NormalBlending;
    const denQuad = new FullScreenQuad(den), FADE = 300;
    pt.renderToCanvasCallback = (target, r, quad) => {
      const ac = r.autoClear; r.autoClear = false;
      quad.render(r);
      const n = pt.samples;
      if (n < FADE && quad.material.opacity >= 1) {
        const k = 1 - n / FADE;
        den.uniforms.map.value = target.texture; den.uniforms.sigma.value = 2.5 + 3.5 * k; den.uniforms.threshold.value = 0.04 + 0.08 * k; den.uniforms.kSigma.value = 1;
        den.uniforms.opacity.value = Math.min(1, k * 1.25); denQuad.render(r);
      }
      r.autoClear = ac;
    };
    forest = flattenInstances(site); forest.visible = false; site.add(forest);
  }
  function applySky() {
    skyTex?.dispose(); skyTex = makeSky(sunDirection(sunT));
    scene.background = skyTex; scene.environment = skyTex;
  }
  function setVisibility(on) {
    sky.visible = !on;
    for (const l of lights) l.visible = !on;
    site.traverse((o) => { if (o.isInstancedMesh) o.visible = !on; });
    if (forest) forest.visible = on;
    for (const mesh of house) { const k = mesh.userData.mat; if (swaps[k]) mesh.material = on ? swaps[k] : M[k]; }
    site.traverse((o) => { if (o.userData.site === 'lake') o.material = on ? water : M.water; });
  }
  return {
    get active() { return active; },
    get samples() { return pt ? Math.floor(pt.samples) : 0; },
    get maxSamples() { return maxSamples; },
    get sun() { return sunT; },
    enter() { // returns after the scene has been prepared (BVH, textures)
      init();
      saved = { tm: renderer.toneMapping, exp: renderer.toneMappingExposure, env: scene.environment, bg: scene.background, fog: scene.fog };
      active = true; scene.fog = null;
      renderer.toneMapping = THREE.AgXToneMapping;
      applySky(); setVisibility(true);
      pt.setScene(scene, camera);
    },
    exit() {
      if (!active) return;
      active = false; setVisibility(false);
      renderer.toneMapping = saved.tm; renderer.toneMappingExposure = saved.exp;
      scene.environment = saved.env; scene.background = saved.bg; scene.fog = saved.fog;
    },
    rebuild() { if (active) pt.setScene(scene, camera); },           // after a cutaway change
    cameraMoved() { if (active) pt.updateCamera(); },
    setSun(t) { sunT = t; if (active) { applySky(); pt.updateEnvironment(); } },
    render() { if (active && pt.samples < maxSamples) pt.renderSample(); },
    save(name) {
      if (!active) return;
      pt.renderSample();
      renderer.domElement.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
    },
  };
}
