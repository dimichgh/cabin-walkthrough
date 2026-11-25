// Photo mode: progressive path tracing (three-gpu-pathtracer). Real sky light and sun through the windows,
// bounced light indoors, soft sun shadows, thin reflective glass, reflective water. While the camera moves you see a
// fast low-resolution preview; when it stops the frame converges.
import * as THREE from 'three';
import { WebGLPathTracer, DenoiseMaterial, PhysicalSpotLight } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { kelvin } from './kit.js';

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
  const zen = [0.1, 0.19, 0.4], hor = [0.52 + 0.25 * low, 0.64 + 0.05 * low, 0.82 - 0.2 * low];
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

// dusk (blue hour, sun ~6° below the western horizon) and night (moon, stars) skies, same conventions as makeSky
export function makeTwilightSky(kind) {
  const night = kind === 'night', W = night ? 2048 : 1024, H = W / 2, data = new Float32Array(W * H * 4);
  const sun = sunDirection(0.92).setY(0).normalize();                  // azimuth of the set sun (west, a touch south)
  const moon = new THREE.Vector3(0.42, Math.sin(34 * Math.PI / 180), 0.78).normalize();
  const zen = night ? [0.0011, 0.0017, 0.0040] : [0.010, 0.017, 0.044];
  const hor = night ? [0.0026, 0.0031, 0.0047] : [0.034, 0.034, 0.050];
  const glow = night ? [0.0012, 0.0010, 0.0010] : [0.15, 0.06, 0.018], belt = night ? [0, 0, 0] : [0.03, 0.02, 0.03];
  const gnd = night ? [0.0007, 0.0007, 0.0008] : [0.006, 0.006, 0.007];
  const mr = 0.6 * Math.PI / 180, cosMr = Math.cos(mr), disk = []; let omega = 0;
  for (let j = 0; j < H; j++) {
    const e = ((j + 0.5) / H - 0.5) * Math.PI, ce = Math.cos(e), dOmega = (2 * Math.PI / W) * (Math.PI / H) * ce;
    for (let i = 0; i < W; i++) {
      const phi = ((i + 0.5) / W - 0.5) * 2 * Math.PI, dx = Math.cos(phi) * ce, dy = Math.sin(e), dz = Math.sin(phi) * ce, k = (j * W + i) * 4;
      let r, g, b;
      if (e < 0) { const f = Math.min(1, -e * 5); r = hor[0] * (1 - f) + gnd[0] * f; g = hor[1] * (1 - f) + gnd[1] * f; b = hor[2] * (1 - f) + gnd[2] * f; }
      else {
        const t = Math.pow(1 - e / (Math.PI / 2), 3.0);
        r = zen[0] + (hor[0] - zen[0]) * t; g = zen[1] + (hor[1] - zen[1]) * t; b = zen[2] + (hor[2] - zen[2]) * t;
        const ca = (dx * sun.x + dz * sun.z) / Math.max(ce, 1e-4), low = Math.exp(-e / 0.16);
        const w = Math.pow(Math.max(ca, 0), 3) * low, v = Math.pow(Math.max(-ca, 0), 2) * Math.exp(-Math.abs(e - 0.12) / 0.1);
        r += glow[0] * w + belt[0] * v; g += glow[1] * w + belt[1] * v; b += glow[2] * w + belt[2] * v;
      }
      data[k] = r; data[k + 1] = g; data[k + 2] = b; data[k + 3] = 1;
      if (night && dx * moon.x + dy * moon.y + dz * moon.z > cosMr) { disk.push(k); omega += dOmega; }
    }
  }
  if (night) {
    const L = 0.045 / Math.max(omega, 1e-6);                            // moonlight irradiance 0.045 (sunlight ≈ 3.4)
    for (const k of disk) { data[k] += 0.82 * L; data[k + 1] += 0.88 * L; data[k + 2] += 1.0 * L; }
    let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 1500; n++) {                                     // stars: single faint texels (a texel spans a few pixels, so keep them dim)
      const u = R(), v = 0.5 + 0.5 * Math.asin(0.15 + 0.85 * R()) / (Math.PI / 2) * 0.999, k = ((Math.floor(v * H) * W) + Math.floor(u * W)) * 4;
      const m = Math.pow(R(), 9) * 0.09 + 0.004, tint = R();
      data[k] += m * (0.85 + 0.15 * tint); data[k + 1] += m * 0.92; data[k + 2] += m * (1.1 - 0.2 * tint);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  return tex;
}

// night lights from furniture.js specs. Layer 5: the path tracer finds them (it walks visible objects), the raster
// preview does not (its camera only renders layer 0), so lighting stays shadowed and shaders never recompile.
const WHITE = new THREE.Color(1, 1, 1);
export const balanced = (K, keep = 0.55) => kelvin(K).lerp(WHITE, 1 - keep);
export function makeNightLights(specs) {
  const g = new THREE.Group(); g.name = 'nightLights'; g.visible = false;
  for (const sp of specs) {
    let l;
    if (sp.type === 'spot') {
      l = new PhysicalSpotLight(balanced(sp.K), sp.I, 0, sp.angle, sp.penumbra, 2); l.radius = sp.radius;
      l.target.position.set(...sp.to); g.add(l.target);
    } else l = new THREE.PointLight(balanced(sp.K, sp.K < 2200 ? 0.85 : 0.55), sp.I, 0, 2);
    l.position.set(...sp.at); l.layers.set(5); l.castShadow = false;
    l.userData = { level: sp.level, opt: sp.opt, type: sp.type };
    g.add(l);
  }
  return g;
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

export function makePhoto({ renderer, scene, camera, M, sky, lights, site, house, nightLights, lightOn = () => true }) {
  let pt = null, forest = null, skyTex = null, active = false, sunT = 0.78, maxSamples = 3000, saved = {}, time = 'day';
  // window panes as thin glass (thickness 0 = thin film in the path tracer: transmits and reflects, no offset)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.0, transmission: 1, ior: 1.5, thickness: 0, side: THREE.DoubleSide });
  const water = new THREE.MeshPhysicalMaterial({ color: 0x0b2733, metalness: 0, roughness: 0.04, ior: 1.33 });
  const swaps = { glass };
  // standing-seam panels, trim, columns and the garage door are painted: a dielectric coat, not bare metal
  for (const [k, rough] of [['roof', 0.64], ['metal', 0.5], ['trim', 0.4], ['column', 0.4], ['soffit', 0.55], ['garage', 0.45]]) {
    const m = M[k].clone(); m.metalness = 0; m.roughness = rough; swaps[k] = m;
  }
  // the path tracer renders clearcoat materials black, so the car's paint and glass get clearcoat-free equivalents
  swaps.carpaint = new THREE.MeshPhysicalMaterial({ color: M.carpaint.color, metalness: 0.45, roughness: 0.22, ior: 1.5 });
  swaps.carglass = new THREE.MeshPhysicalMaterial({ color: 0x0b0e10, metalness: 0, roughness: 0.02, ior: 1.5 });
  // light fittings: translucent shades and opal globes let the lamp inside light the room (shadow rays pass through
  // transmissive surfaces); at dusk / night they and the fixture faces, embers and flames glow
  const warm = balanced(2700), fireCol = kelvin(1700);
  swaps.shade = new THREE.MeshPhysicalMaterial({ color: 0xf2ebdf, roughness: 1, transmission: 0.6, thickness: 0, side: THREE.DoubleSide, emissive: warm });
  swaps.globe = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, transmission: 0.92, thickness: 0, emissive: warm });
  swaps.lamp = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.4, emissive: warm });
  swaps.ember = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.9, emissive: kelvin(1300) });
  // flames: hot yellow at the base → orange → red tips that fade out (lathe UVs run base → tip)
  const grad = (stops) => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'), lg = g.createLinearGradient(0, 64, 0, 0);
    for (const [t, col] of stops) lg.addColorStop(t, col); g.fillStyle = lg; g.fillRect(0, 0, 4, 64); const t = new THREE.CanvasTexture(c); return t; };
  const flameCol = grad([[0, '#fff1c4'], [0.3, '#ffb347'], [0.65, '#ff6a1a'], [1, '#8a1c00']]); flameCol.colorSpace = THREE.SRGBColorSpace;
  const flameA = grad([[0, '#ffffff'], [0.55, '#ffffff'], [1, '#000000']]);
  swaps.flame = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 1, transmission: 1, thickness: 0, transparent: true, opacity: 0, emissive: 0xffffff, emissiveMap: flameCol, alphaMap: flameA, side: THREE.DoubleSide });
  const GLOW = { shade: 0.05, globe: 0.1, lamp: 0.9, ember: 1.1, flame: 0.9 };
  // while moving at dusk / night, the 1-sample traced preview is mostly noise: show the raster instead, lit by a dim
  // fill (a hemisphere light, which the path tracer ignores) plus the glowing fittings, until the traced frame fades in
  const previewFill = new THREE.HemisphereLight(0xd9dfe8, 0x3b3128, 0.0); previewFill.visible = false; scene.add(previewFill);
  function applyPreview() {
    const night = active && time !== 'day';
    previewFill.visible = night; previewFill.intensity = time === 'night' ? 0.035 : 0.08;
    if (pt) { pt.dynamicLowRes = !night; pt.rasterizeScene = true; }
  }
  function applyGlow() {
    const on = time !== 'day';
    for (const [k, v] of Object.entries(GLOW)) swaps[k].emissiveIntensity = on ? v : 0;
    swaps.flame.opacity = on ? 1 : 0;
  }
  applyGlow();
  // night lights: visible to the path tracer only (layer 5 keeps them out of the raster preview)
  function applyLights() {
    const on = active && time !== 'day';
    let changed = nightLights.visible !== on; nightLights.visible = on;
    for (const l of nightLights.children) if (l.isLight) { const v = on && lightOn(l); if (l.visible !== v) { l.visible = v; changed = true; } }
    return changed;
  }

  // exposure meter: copy the accumulated (linear HDR) frame to a tiny float target and log-average its luminance
  const MW = 64, MH = 40, meterRT = new THREE.WebGLRenderTarget(MW, MH, { type: THREE.FloatType, depthBuffer: false }), meterBuf = new Float32Array(MW * MH * 4);
  const meterQuad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { map: { value: null } }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv); }',
  }));
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
    // despeckle: a pixel far brighter than all eight neighbours is a firefly (a bounce ray that happened to hit a lamp
    // or a lit shade); show the neighbours' average there instead. Multi-pixel highlights (lamps, stars) are kept.
    const spk = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, texel: { value: new THREE.Vector2() } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform vec2 texel; varying vec2 vUv;
        float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
        void main() {
          vec3 c = texture2D(map, vUv).rgb; float lc = lum(c), mx = 0.0; vec3 sum = vec3(0.0);
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { if (i == 0 && j == 0) continue;
            vec3 q = texture2D(map, vUv + vec2(float(i), float(j)) * texel).rgb; mx = max(mx, lum(q)); sum += q; }
          if (lc < mx * 2.2 + 0.002) discard;
          gl_FragColor = vec4(sum / 8.0, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    pt.renderToCanvasCallback = (target, r, quad) => {
      const ac = r.autoClear; r.autoClear = false;
      quad.render(r);
      const n = pt.samples;
      if (quad.material.opacity >= 1) {
        if (n < FADE) {
          const k = 1 - n / FADE;
          den.uniforms.map.value = target.texture; den.uniforms.sigma.value = 2.5 + 3.5 * k; den.uniforms.threshold.value = 0.04 + 0.08 * k; den.uniforms.kSigma.value = 1;
          den.uniforms.opacity.value = Math.min(1, k * 1.25); denQuad.render(r);
        }
        spk.material.uniforms.map.value = target.texture; spk.material.uniforms.texel.value.set(1 / target.width, 1 / target.height); spk.render(r);
      }
      r.autoClear = ac;
    };
    forest = flattenInstances(site); forest.visible = false; site.add(forest);
  }
  function applySky() {
    skyTex?.dispose(); skyTex = time === 'day' ? makeSky(sunDirection(sunT)) : makeTwilightSky(time);
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
    get time() { return time; },
    get glow() { return Object.fromEntries(Object.keys(GLOW).map((k) => [k, swaps[k].emissiveIntensity])); },
    get nightVisible() { return nightLights.visible; },
    get lightCount() { return nightLights.visible ? nightLights.children.filter((l) => l.isLight && l.visible).length : 0; },
    enter() { // returns after the scene has been prepared (BVH, textures)
      if (active) return;
      init();
      saved = { tm: renderer.toneMapping, exp: renderer.toneMappingExposure, env: scene.environment, bg: scene.background, fog: scene.fog };
      active = true; scene.fog = null;
      renderer.toneMapping = THREE.AgXToneMapping;
      applySky(); setVisibility(true); applyGlow(); applyLights(); applyPreview();
      pt.setScene(scene, camera);
    },
    exit() {
      if (!active) return;
      active = false; setVisibility(false); applyLights(); applyPreview();
      renderer.toneMapping = saved.tm; renderer.toneMappingExposure = saved.exp;
      scene.environment = saved.env; scene.background = saved.bg; scene.fog = saved.fog;
    },
    rebuild() { if (active) pt.setScene(scene, camera); },           // after a cutaway change
    cameraMoved() { if (active) pt.updateCamera(); },
    setSun(t) { sunT = t; if (active && time === 'day') { applySky(); pt.updateEnvironment(); } },
    // day / dusk / night: new sky, glow on or off, lights on or off — no scene rebuild needed
    setTime(t) {
      if (!['day', 'dusk', 'night'].includes(t)) return false;
      time = t; applyGlow();
      if (active) { applySky(); applyLights(); applyPreview(); pt.updateEnvironment(); pt.updateMaterials(); pt.updateLights(); }
      return true;
    },
    // re-evaluate which night lights are on (cutaway, furniture toggle, where the camera is)
    refreshLights() { if (active && applyLights()) pt.updateLights(); },
    render() { if (active && pt.samples < maxSamples) pt.renderSample(); },
    meter() {
      if (!active) return 0;
      meterQuad.material.uniforms.map.value = pt.target.texture;
      const prev = renderer.getRenderTarget(); renderer.setRenderTarget(meterRT); meterQuad.render(renderer);
      renderer.readRenderTargetPixels(meterRT, 0, 0, MW, MH, meterBuf); renderer.setRenderTarget(prev);
      const N = MW * MH, Ls = new Float32Array(N);
      for (let i = 0; i < N; i++) { const k = i * 4; Ls[i] = 0.2126 * meterBuf[k] + 0.7152 * meterBuf[k + 1] + 0.0722 * meterBuf[k + 2]; }
      Ls.sort(); const q = (f) => Ls[Math.min(N - 1, Math.floor(f * N))];
      let sum = 0; for (let i = 0; i < N; i++) sum += Math.log(1e-4 + Math.min(Ls[i], 50));
      this.stats = [Math.exp(sum / N), q(0.5), q(0.75), q(0.9), q(0.95), q(0.98)].map((v) => +v.toFixed(4));
      return Math.exp(sum / N);
    },
    save(name) {
      if (!active) return;
      pt.renderSample();
      renderer.domElement.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
    },
  };
}
