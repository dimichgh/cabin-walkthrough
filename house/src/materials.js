// Procedural materials. Every texture is drawn on a canvas at startup, so the page needs no image files.
// Geometry UVs are in feet, so texture.repeat = 1 / (tile size in feet).
import * as THREE from 'three';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function tex(w, h, tileFt, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tileFt[0], 1 / tileFt[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

/* vertical boards: Ipe 1x6 (5.5"), mahogany T&G, oak planks */
function boards(tileFt, nBoards, base, varyL, grooveAlpha, seed, { grainDir = 'v', h = 512 } = {}) {
  const R = rng(seed);
  const color = tex(256, h, tileFt, (g, w, hh) => {
    const bw = w / nBoards;
    for (let i = 0; i < nBoards; i++) {
      const l = base[2] + (R() - 0.5) * varyL, hu = base[0] + (R() - 0.5) * 8, s = base[1] + (R() - 0.5) * 10;
      g.fillStyle = hsl(hu, s, l); g.fillRect(i * bw, 0, bw, hh);
      for (let k = 0; k < 26; k++) { // grain streaks
        g.strokeStyle = hsl(hu + (R() - 0.5) * 6, s, l + (R() - 0.5) * 9); g.globalAlpha = 0.35; g.lineWidth = 0.6 + R() * 1.2;
        const x = i * bw + R() * bw; g.beginPath(); g.moveTo(x, 0);
        for (let y = 0; y <= hh; y += 32) g.lineTo(x + Math.sin(y * 0.02 + k) * 1.2, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = `rgba(0,0,0,${grooveAlpha})`; g.fillRect(i * bw, 0, 1.6, hh);
    }
  });
  const bump = tex(128, 64, tileFt, (g, w, hh) => {
    const bw = w / nBoards; g.fillStyle = '#bbb'; g.fillRect(0, 0, w, hh);
    g.fillStyle = '#222'; for (let i = 0; i < nBoards; i++) g.fillRect(i * bw, 0, 1.2, hh);
  }, { srgb: false });
  return { color, bump };
}

function seams(tileFt, base, seed) { // standing seam: a raised rib every 12"
  const R = rng(seed);
  const color = tex(256, 256, tileFt, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const n = Math.round(tileFt[0]); const sw = w / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(i * sw, 0, (i + 1) * sw, 0);
      const v = (R() - 0.5) * 0.05;
      gr.addColorStop(0, `rgba(255,255,255,${0.04 + v})`); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.06 + v})`);
      g.fillStyle = gr; g.fillRect(i * sw, 0, sw, h);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(i * sw, 0, 2, h);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(i * sw + 2, 0, 2, h);
    }
  });
  const bump = tex(128, 32, tileFt, (g, w, h) => {
    g.fillStyle = '#777'; g.fillRect(0, 0, w, h);
    const n = Math.round(tileFt[0]), sw = w / n;
    for (let i = 0; i < n; i++) { g.fillStyle = '#fff'; g.fillRect(i * sw, 0, 2, h); g.fillStyle = '#555'; g.fillRect(i * sw + 2, 0, 1, h); }
  }, { srgb: false });
  return { color, bump };
}

function noise(tileFt, base, amp, seed, speck = 0) {
  const R = rng(seed);
  return tex(256, 256, tileFt, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * amp})`; const s = 1 + R() * 3; g.fillRect(R() * w, R() * h, s, s); }
    for (let i = 0; i < speck; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.2})`; g.fillRect(R() * w, R() * h, 1, 1); }
  });
}

function flagstone(seed) {
  const R = rng(seed);
  return tex(512, 512, [6, 6], (g, w, h) => {
    g.fillStyle = '#6f6a62'; g.fillRect(0, 0, w, h); // mortar
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      let x = -R() * 60; const y0 = r * h / rows;
      while (x < w) {
        const sw = 50 + R() * 90, sh = h / rows - 6;
        const l = 52 + R() * 18, hu = 30 + R() * 25;
        g.fillStyle = hsl(hu, 8 + R() * 10, l);
        g.beginPath();
        const j = () => (R() - 0.5) * 10;
        g.moveTo(x + 4 + j(), y0 + 4 + j()); g.lineTo(x + sw - 4 + j(), y0 + 4 + j());
        g.lineTo(x + sw - 4 + j(), y0 + sh + j()); g.lineTo(x + 4 + j(), y0 + sh + j()); g.closePath(); g.fill();
        x += sw;
      }
    }
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.08})`; g.fillRect(R() * w, R() * h, 2, 2); }
  });
}

function steelPlate(seed) {
  const R = rng(seed);
  return tex(256, 512, [4, 8], (g, w, h) => {
    g.fillStyle = '#4b5056'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '20,24,30' : '120,126,132'},${R() * 0.06})`; g.beginPath(); g.ellipse(R() * w, R() * h, 20 + R() * 60, 10 + R() * 40, R() * 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  });
}

function grass(seed) {
  const R = rng(seed);
  return tex(256, 256, [12, 12], (g, w, h) => {
    g.fillStyle = '#56703a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = hsl(80 + R() * 30, 30 + R() * 20, 22 + R() * 22); g.fillRect(R() * w, R() * h, 1, 2 + R() * 2); }
  });
}

function tiles(tileFt, base, grout) {
  return tex(128, 128, tileFt, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = grout; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); });
}

function garageDoor() {
  return tex(256, 256, [16, 8], (g, w, h) => {
    g.fillStyle = '#4a4e53'; g.fillRect(0, 0, w, h);
    for (let i = 1; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, i * h / 4, w, 3); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, i * h / 4 + 3, w, 2); }
  });
}

export function makeMaterials() {
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const ipe = boards([8 * 5.5 / 12, 8], 8, [22, 58, 36], 12, 0.55, 11);
  const oak = boards([8 * 4 / 12, 8], 8, [34, 45, 66], 9, 0.25, 21);
  const mah = boards([8 * 5.5 / 12, 8], 8, [14, 48, 28], 8, 0.4, 31);
  const wallSeam = seams([4, 4], '#3a3e42', 41);
  const roofSeam = seams([4, 4], '#35393d', 51);
  const M = {
    ipe:       S({ map: ipe.color, bumpMap: ipe.bump, bumpScale: 0.6, roughness: 0.78 }),
    metal:     S({ map: wallSeam.color, bumpMap: wallSeam.bump, bumpScale: 0.8, metalness: 0.55, roughness: 0.42 }),
    roof:      S({ map: roofSeam.color, bumpMap: roofSeam.bump, bumpScale: 0.8, metalness: 0.35, roughness: 0.55 }),
    soffit:    S({ color: 0x34383c, metalness: 0.5, roughness: 0.5 }),
    trim:      S({ color: 0x26292c, metalness: 0.6, roughness: 0.38 }),
    steel:     S({ map: steelPlate(61), metalness: 0.72, roughness: 0.36 }),
    column:    S({ color: 0x2b2e32, metalness: 0.5, roughness: 0.45 }),
    glass:     new THREE.MeshPhysicalMaterial({ color: 0xa9c8d8, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.22, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false }),
    screen:    S({ color: 0x1d1f21, transparent: true, opacity: 0.32, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    concrete:  S({ map: noise([8, 8], '#b4b0a8', 0.08, 71), roughness: 0.92 }),
    found:     S({ map: noise([8, 8], '#8f8b84', 0.1, 72), roughness: 0.95 }),
    flagstone: S({ map: flagstone(81), roughness: 0.88 }),
    oak:       S({ map: oak.color, roughness: 0.5 }),
    mahogany:  S({ map: mah.color, roughness: 0.55 }),
    gyp:       S({ color: 0xf0ede6, roughness: 0.93 }),
    ceil:      S({ color: 0xf6f4ef, roughness: 0.95 }),
    walnut:    S({ color: 0x5b3b27, roughness: 0.5 }),
    quartz:    S({ color: 0xe8e6e0, roughness: 0.28 }),
    laminate:  S({ color: 0xf4f3ef, roughness: 0.4 }),
    tile:      S({ map: tiles([1, 1], '#e4e2dd', '#b9b6b0'), roughness: 0.35 }),
    appliance: S({ color: 0xdedede, metalness: 0.2, roughness: 0.35 }),
    garage:    S({ map: garageDoor(), metalness: 0.4, roughness: 0.5 }),
    alum:      S({ color: 0xb9bdc1, metalness: 0.9, roughness: 0.28 }),
    soil:      S({ color: 0x4a3b2c, roughness: 1 }),
    gravel:    S({ map: noise([6, 6], '#8d8a83', 0.25, 91, 3000), roughness: 1 }),
    grass:     S({ map: grass(101), roughness: 1 }),
    water:     S({ color: 0x2f5f78, metalness: 0.3, roughness: 0.08, envMapIntensity: 1.2 }),
    trunk:     S({ color: 0x4a3626, roughness: 0.95 }),
    pine:      S({ color: 0x2c4a2b, roughness: 0.9 }),
    pine2:     S({ color: 0x34552f, roughness: 0.9 }),
    fire:      S({ color: 0x15100d, roughness: 1 }),
    fabric:    S({ color: 0x8a8781, roughness: 0.95 }),
    rug:       S({ color: 0xcfc6b5, roughness: 1 }),
    ramp:      new THREE.MeshBasicMaterial({ visible: false }),
  };
  for (const [k, m] of Object.entries(M)) m.name = k;
  return M;
}
