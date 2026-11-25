// First-person walker: a vertical cylinder that slides along wall boxes, steps up to 1.3 ft,
// follows stair ramps, and never walks into a spot that has no floor under it.
export function makeWalker({ colliders, surfaces, bounds }) {
  const R = 0.8, STEP = 1.3, B0 = 0.7, B1 = 5.9, G = 32;
  const s = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vy: 0, minY: Infinity };

  const heightOf = (f, x) => {
    if (!f.ramp) return f.y;
    const t = Math.min(1, Math.max(0, (x - f.aLo) / (f.aHi - f.aLo)));
    return f.yLo + t * (f.yHi - f.yLo);
  };
  // highest walkable surface at (x,z) that is not more than one step above y
  function groundAt(x, z, y) {
    let best = -Infinity;
    for (const f of surfaces) {
      if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
      if (f.holes && f.holes.some((r) => x > r[0] && x < r[1] && z > r[2] && z < r[3])) continue;
      const h = heightOf(f, x);
      if (h <= y + STEP && h > best) best = h;
    }
    return best;
  }
  // push the cylinder out of every box that overlaps its body band (feet + 0.7 … feet + 5.9)
  function push(p) {
    let moved = false;
    for (let it = 0; it < 4; it++) {
      let any = false;
      for (const c of colliders) {
        if (c.y1 <= p.y + B0 || c.y0 >= p.y + B1) continue;
        if (p.x < c.x0 - R || p.x > c.x1 + R || p.z < c.z0 - R || p.z > c.z1 + R) continue;
        const cx = Math.max(c.x0, Math.min(p.x, c.x1)), cz = Math.max(c.z0, Math.min(p.z, c.z1));
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (R - d) / d; p.x += dx * k; p.z += dz * k; }
        else {
          const o = [p.x - c.x0 + R, c.x1 - p.x + R, p.z - c.z0 + R, c.z1 - p.z + R], i = o.indexOf(Math.min(...o));
          if (i === 0) p.x = c.x0 - R; else if (i === 1) p.x = c.x1 + R; else if (i === 2) p.z = c.z0 - R; else p.z = c.z1 + R;
        }
        any = moved = true;
      }
      if (!any) break;
    }
    return moved;
  }
  function clampBounds() {
    s.x = Math.min(bounds.x1, Math.max(bounds.x0, s.x));
    s.z = Math.min(bounds.z1, Math.max(bounds.z0, s.z));
  }
  // inp: { f: forward −1…1, r: strafe −1…1, run: bool }
  function step(inp, dt) {
    const sp = (inp.run ? 13 : 6.5) * dt;
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
    let mx = (fx * inp.f + rx * inp.r) * sp, mz = (fz * inp.f + rz * inp.r) * sp;
    const L = Math.hypot(mx, mz); if (L > sp) { mx *= sp / L; mz *= sp / L; }
    const n = Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.2));
    for (let i = 0; i < n; i++) {
      const px = s.x, pz = s.z;
      s.x += mx / n; s.z += mz / n; push(s); clampBounds();
      const g = groundAt(s.x, s.z, s.y);
      if (g === -Infinity) { s.x = px; s.z = pz; continue; }
      if (s.vy <= 0 && (g >= s.y || s.y - g < STEP)) s.y = g; // step up, or follow stairs down
    }
    const g = groundAt(s.x, s.z, s.y);
    if (g > -Infinity && s.y > g + 1e-4) { s.vy -= G * dt; s.y = Math.max(g, s.y + s.vy * dt); if (s.y === g) s.vy = 0; }
    else s.vy = 0;
    s.minY = Math.min(s.minY, s.y);
  }
  function place(x, z, yHint = 60, yaw) {
    const g = groundAt(x, z, yHint);
    if (g === -Infinity) return false;
    Object.assign(s, { x, z, y: g, vy: 0, minY: g });
    if (yaw !== undefined) s.yaw = yaw;
    return true;
  }
  // is the spot clear (standing there overlaps no wall)?
  function clearAt(x, z, y) { const p = { x, z, y }; return !push(p); }
  return { s, step, place, groundAt, clearAt, R };
}
