#!/usr/bin/env node
// Headless check of dist/cabin-house.html: boots it, fails on ANY request to another origin, walks the routes
// through the real movement code, checks every walk-to spot, and writes screenshots to .shots/.
//   node test.mjs [--only views,routes,modes,levels,walk] [--w 1600 --h 1000]
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const only = new Set((opt('--only', 'views,routes,modes,levels,walk,input,info')).split(','));
const W = +opt('--w', 1600), Hh = +opt('--h', 1000);
const out = path.join(here, '.shots'); fs.mkdirSync(out, { recursive: true });
const root = path.join(here, 'dist');

const server = http.createServer((req, res) => {
  const f = path.join(root, path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, ''));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let origin = `http://127.0.0.1:${server.address().port}`;
const external = new Set(), logs = [];

function findChrome() {
  for (const p of [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']) if (p && fs.existsSync(p)) return p;
  for (const b of ['google-chrome', 'chromium', 'chromium-browser']) { try { const p = execSync(`command -v ${b}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); if (p) return p; } catch { } }
  throw new Error('Chrome not found — set CHROME=');
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cabin-test-'));
const chrome = spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--window-size=${W},${Hh}`,
  ...(argv.includes('--gpu') ? ['--use-angle=metal', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++seq; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
const shot = async (name) => { await ev('CABIN.renderNow()'); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64')); return name; };
const problems = [], report = { routes: {}, places: null, shots: [] };
const fail = (m) => { problems.push(m); console.log('  ✗ ' + m); };

try {
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try { const port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { await sleep(250); }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; if (/^(https?|wss?|ftp):/i.test(u) && !u.startsWith(origin + '/')) external.add(u.slice(0, 160)); }
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: Hh, deviceScaleFactor: 1, mobile: false });
  const live = opt('--url'); if (live) origin = new URL(live).origin;
  await send('Page.navigate', { url: live || (argv.includes('--file') ? 'file://' + path.join(root, 'cabin-house.html') : origin + '/cabin-house.html') });
  const t0 = Date.now(); while (Date.now() - t0 < 60000) { try { if (await ev('window.CABIN && window.CABIN.ready === true')) break; } catch { } await sleep(300); }
  if (!await ev('!!(window.CABIN && CABIN.ready)')) throw new Error('page did not boot\n' + logs.join('\n'));
  console.log('booted in', ((Date.now() - t0) / 1000).toFixed(1), 's ·', JSON.stringify(await ev('CABIN.stats')));
  await ev(`(document.querySelector('#info').hidden = true, CABIN.setLabels(false), CABIN.setQuality(1), true)`);

  if (only.has('views')) {
    for (const v of ['aerial', 'p01', 'p02', 'p03', 'p04', 'p05', 'plan', 'elevLake', 'elevEast']) { await ev(`CABIN.view('${v}', {instant:true})`); await sleep(150); report.shots.push(await shot('a-' + v)); }
  }
  if (only.has('routes')) {
    const { FFB, FF1, FF2, FFG, TERR } = { FFB: -10.354, FF1: 0, FF2: 10.354, FFG: -2.427, TERR: -0.15 };
    const routes = {
      'entry → stair → gallery → suite': [[31.5, 5.8, TERR], [28.8, 6.5, TERR], [25.4, 6.5, FF1], [25.4, 11, FF1], [8.0, 11], [4.2, 11, FF2], [4.2, 15.4, FF2], [27, 15.4, FF2], [30.8, 15.6, FF2], [30.8, 21.4, FF2], [36, 21.5, FF2], [44, 21.5, FF2]],
      'entry → basement: gathering, laundry, mechanical': [[31.5, 5.8, TERR], [25.4, 6.5, FF1], [25.4, 15.2, FF1], [4.6, 15.2, FF1], [4.2, 11, FF1], [24.4, 11, FFB], [24.4, 15.4, FFB], [18, 25, FFB], [25.4, 15.4, FFB], [25.4, 9.6, FFB], [25.4, 5.2, FFB], [25.4, 15.2, FFB], [9.2, 15.2, FFB], [5.0, 15.2, FFB], [4.5, 12, FFB]],
      'entry → terrace → fireplace': [[31.5, 5.8, TERR], [31.5, -2, TERR], [20, -2, TERR], [12, -9.5, TERR], [7.1, -12.0, TERR]],
      'hallway → garage → back up': [[31.5, 5.8, TERR], [25.4, 6.5, FF1], [25.4, 15.2, FF1], [30.8, 15.2, FF1], [30.8, 28.5, FF1], [37.6, 28.5, FFG], [45, 22, FFG], [37.6, 28.5, FFG], [30.8, 28.5, FF1]],
      // around the dining table and behind the sofa (furniture on), out to the screened patio, back down the stair
      'second floor: living → screened patio, back down the stair': [[17, 5.2, FF2], [12.0, 6.5, FF2], [12.0, -4.9, FF2], [7.5, -4.9, FF2], [7.5, -8.8, FF2], [7.5, -4.9, FF2], [12.0, -4.9, FF2], [12.0, 7.3, FF2], [4.2, 7.5, FF2], [4.2, 11, FF2], [24.6, 11, FF1]],
      'terrace steps → lake side → around to the drive': [[18, -3, TERR], [-4, -4, TERR], [-12, -4, -2.45], [-12, 40, -2.45], [70, 40, -2.45], [66, 26, -2.45]],
    };
    for (const opts of [true, false]) { // with furniture + car, then without
      await ev(`(CABIN.setOption('furniture', ${opts}), CABIN.setOption('car', ${opts}), true)`);
      const tag = opts ? 'furniture on' : 'furniture off';
      for (const [name, pts] of Object.entries(routes)) {
        const log = await ev(`CABIN.testRoute(${JSON.stringify(pts)})`);
        report.routes[`${name} (${tag})`] = log;
        const bad = log.filter((l) => !l.ok);
        console.log(`${bad.length ? '✗' : '✓'} route (${tag}): ${name}`);
        for (const b of bad) fail(`${name} (${tag}): to ${JSON.stringify(b.to)} stopped at ${JSON.stringify(b.at)} minY ${b.minY}${b.why ? ' ' + b.why : ''}`);
      }
      report.places = await ev('CABIN.checkPlaces()');
      for (const p of report.places) if (!p.floorOk || !p.clear) fail(`walk-to spot ${p.id} (${tag}): ground ${p.ground}, floorOk ${p.floorOk}, clear ${p.clear}`);
      console.log(`places checked (${tag}): ${report.places.length}`);
    }
    await ev(`(CABIN.setOption('furniture', true), CABIN.setOption('car', true), true)`);
    { // the toggles really remove meshes and colliders
      const on = await ev('CABIN.counts'); await ev(`(CABIN.setOption('furniture', false), CABIN.setOption('car', false), true)`); const off = await ev('CABIN.counts');
      await ev(`(CABIN.setOption('furniture', true), CABIN.setOption('car', true), true)`); const back = await ev('CABIN.counts');
      console.log(`toggles: visible meshes ${on.visible} → ${off.visible} → ${back.visible}, colliders off ${on.optOff} → ${off.optOff} → ${back.optOff}, night lights ${on.lights}`);
      if (!(off.visible < on.visible && back.visible === on.visible && off.optOff > 0 && back.optOff === 0)) fail('furniture / car toggles did not switch meshes and colliders');
    }
  }
  if (only.has('modes')) {
    await ev(`CABIN.view('aerial', {instant:true})`);
    for (const m of ['real', 'xray', 'holo']) { await ev(`CABIN.setMode('${m}')`); await sleep(200); report.shots.push(await shot('c-mode-' + m)); }
    await ev(`CABIN.setMode('real')`);
  }
  if (only.has('levels')) {
    await ev(`CABIN.view('aerial', {instant:true})`);
    for (const [m, l] of [['real', 'roof'], ['real', 'ground'], ['real', 'basement'], ['xray', 'ground'], ['holo', 'all']]) { await ev(`(CABIN.setMode('${m}'), CABIN.setLevels('${l}'), true)`); await sleep(150); report.shots.push(await shot(`d-${m}-${l}`)); }
    await ev(`(CABIN.setMode('real'), CABIN.setLevels('all'), CABIN.setLabels(true), CABIN.setCut(5), CABIN.view('aerial',{instant:true}), true)`); report.shots.push(await shot('d-cut-5ft-labels'));
    await ev(`(CABIN.setCut(null), CABIN.setLabels(false), true)`);
  }
  if (only.has('walk')) {
    for (const [id, yaw, pitch] of [['approach'], ['entry'], ['stair'], ['living'], ['patio'], ['gallery'], ['suite'], ['terrace'], ['garage'], ['gathering'], ['laundry'], ['lakeside']]) {
      await ev(`(CABIN.goTo('${id}'), ${yaw !== undefined ? `CABIN.look(${yaw}, ${pitch ?? -4}),` : ''} true)`); await sleep(250);
      report.shots.push(await shot('e-walk-' + id));
    }
    await ev(`(CABIN.goTo('living'), CABIN.setMode('xray'), true)`); await sleep(200); report.shots.push(await shot('e-walk-living-xray'));
    await ev(`CABIN.setMode('holo')`); await sleep(200); report.shots.push(await shot('e-walk-living-holo'));
    await ev(`(CABIN.goTo('suite'), true)`); await sleep(200); report.shots.push(await shot('e-walk-suite-holo'));
    await ev(`(CABIN.setMode('real'), CABIN.setView('orbit'), true)`);
  }
  if (only.has('perf')) {
    const fps = async (label, setup) => { await ev(setup); await sleep(800); const f0 = await ev('CABIN.frames'); const t = Date.now(); for (let i = 0; i < 6; i++) { await ev('CABIN.look(CABIN.state.walker.yaw*57.3+0.5,-4) || true'); await sleep(500); } const f1 = await ev('CABIN.frames'); console.log(`perf ${label}: ${((f1 - f0) / ((Date.now() - t) / 1000)).toFixed(2)} fps`); };
    await fps('orbit aerial', `(CABIN.setView('orbit'), CABIN.view('aerial',{instant:true}), true)`);
    await fps('walk entry', `(CABIN.goTo('entry'), true)`);
    await fps('walk terrace', `(CABIN.goTo('terrace'), true)`);
    await fps('walk living', `(CABIN.goTo('living'), true)`);
    await ev('CABIN.setQuality(null)'); await fps('walk terrace, adaptive', `(CABIN.goTo('terrace'), true)`); console.log('  pixel ratio settled at', await ev('CABIN.pixelRatio')); await ev('CABIN.setQuality(1)');
  }
  if (only.has('input')) {   // the path a person takes: real clicks, keys and a mouse drag
    const st = () => ev('CABIN.state');
    const framesAdvance = async (label) => { const f0 = await ev('CABIN.frames'); await ev('CABIN.look(0,-4) || true'); await sleep(5000); const f1 = await ev('CABIN.frames'); if (!(f1 > f0)) fail(`render loop stopped after ${label}`); };
    await ev(`(CABIN.setView('orbit'), CABIN.setLabels(true), CABIN.view('aerial',{instant:true}), true)`); await sleep(400);
    const tagged = await ev(`(() => { const t = [...document.querySelectorAll('.tag')].find(e => e.style.display !== 'none'); if (!t) return null; t.click(); return t.textContent; })()`);
    if (!tagged) fail('no visible scene label to click'); else { const s1 = await st(); if (s1.levels !== 'all') fail('clicking a scene label changed the cutaway to ' + s1.levels); }
    if (await ev(`document.querySelector('#info').hidden`)) fail('clicking a scene label did not open its card');
    await framesAdvance('label click');
    for (const sel of ['#bar button[data-mode="xray"]', '#bar button[data-mode="holo"]', '#bar button[data-mode="real"]', '#bar button[data-level="roof"]', '#bar button[data-level="ground"]', '#bar button[data-level="basement"]', '#bar button[data-level="all"]', '#labelsBtn', '#labelsBtn', '#side button[data-cam="plan"]', '#side button[data-cam="aerial"]'])
      await ev(`document.querySelector('${sel}').click()`);
    let s2 = await st(); if (s2.mode !== 'real' || s2.levels !== 'all') fail(`toolbar clicks left mode ${s2.mode}, levels ${s2.levels}`);
    await framesAdvance('toolbar clicks');
    await ev(`CABIN.openInfo('garage')`); await ev(`document.querySelector('#info .walkhere').click()`); await sleep(200);
    s2 = await st(); if (s2.view !== 'walk' || Math.abs(s2.walker.y - (-2.427)) > 0.2) fail(`"Walk here" (garage) gave view ${s2.view}, y ${s2.walker.y}`);
    await ev(`[...document.querySelectorAll('#placeList .place')].find(b => b.textContent.startsWith('Entry 105')).click()`); await sleep(200);
    const a = await st(); if (a.view !== 'walk') fail('place-list click did not start walking');
    const key = async (code, k, vk, ms) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: vk }); await sleep(ms); await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: vk }); };
    await ev('CABIN.setQuality(null)'); await key('KeyW', 'w', 87, 2500);
    const b = await st(); const moved = Math.hypot(b.walker.x - a.walker.x, b.walker.z - a.walker.z); if (moved < 1.5) fail(`W key moved the walker only ${moved.toFixed(2)} ft`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 800, y: 500, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 5; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 800 + i * 30, y: 500, button: 'left', buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 950, y: 500, button: 'left', clickCount: 1 });
    const c = await st(); if (Math.abs(c.walker.yaw - b.walker.yaw) < 0.05) fail('mouse drag did not turn the view');
    await key('Digit3', '3', 51, 60); const d1 = await st(); await key('Digit1', '1', 49, 60); const d2 = await st();
    if (d1.mode !== 'holo' || d2.mode !== 'real' || d2.view !== 'walk') fail(`keys 3/1 gave ${d1.mode}/${d2.mode}, view ${d2.view}`);
    await framesAdvance('walk input');
    await ev('CABIN.setQuality(1)');
    console.log(`input: label "${tagged}", toolbar, walk-here, place list, W moved ${moved.toFixed(1)} ft, drag turned ${((c.walker.yaw - b.walker.yaw) * 57.3).toFixed(0)}°, keys 3/1 ok`);
    await ev(`(CABIN.setView('orbit'), CABIN.setLabels(false), document.querySelector('#info').hidden = true, true)`);
  }
  // named camera spots for shots: VIEWS ids, walk-to places, and a few extra eye-level spots
  const SPOTS = { fire: [14.5, -5.5, -0.15, 41, -9], dining: [12.2, 6.8, 10.354, -45, -8], pool: [19.5, 21, -10.354, -117, -12], kitchen: [17.2, 6.2, 10.354, -20, -6], study: [16, 19.5, 10.354, 160, -8], firstroom: [10.5, 6.8, 0, 120, -8] };
  const goShot = (id) => SPOTS[id] ? `(CABIN.walkAt(${SPOTS[id][0]}, ${SPOTS[id][1]}, ${SPOTS[id][2]}, ${SPOTS[id][3]} * Math.PI / 180), CABIN.look(${SPOTS[id][3]}, ${SPOTS[id][4]}), true)`
    : id === 'sky' ? `(CABIN.goTo('lakeside'), CABIN.look(-60, 38), true)`
    : /^(p0|aerial|elev|lakeOut|car|plan)/.test(id) ? `(CABIN.setView('orbit'), CABIN.view('${id}',{instant:true}), true)` : `(CABIN.goTo('${id}'), true)`;
  if (only.has('eval')) console.log('eval:', JSON.stringify(await ev(opt('--eval', '1'))));
  if (only.has('looks')) { // Real-mode screenshots of named spots: --looks dining,pool,carFront
    await ev(`(CABIN.setMode('real'), CABIN.setLabels(false), document.querySelector('#info').hidden = true, true)`);
    for (const id of opt('--looks', 'dining,carFront').split(',')) { await ev(goShot(id)); await sleep(600); report.shots.push(await shot('h-look-' + id)); }
  }
  if (only.has('photo')) {
    // --pplan "day:p03,living;night:p03,living;dusk:p01" — time of day, then views (VIEWS ids) or walk-to places
    const target = +opt('--spp', argv.includes('--gpu') ? 400 : 4);
    const plan = opt('--pplan', 'day:p03,living,stair;night:p03,living,suite,gathering,terrace;dusk:p01').split(';').map((seg) => { const i = seg.indexOf(':'); return [seg.slice(0, i), seg.slice(i + 1).split(',')]; });
    const waitSamples = async (label) => {
      const t0 = Date.now(); while (Date.now() - t0 < 300000) { if (await ev('CABIN.photo.active') && await ev('CABIN.photo.samples') >= target) break; await sleep(1000); }
      await sleep(1200); const n = await ev('CABIN.photo.samples');
      const st = await ev('CABIN.photo.stats');
      console.log(`photo ${label}: ${n} samples in ${((Date.now() - t0) / 1000).toFixed(0)} s · stats ${JSON.stringify(st)} · exposure ${await ev('CABIN.photo.exposure')} · lights ${await ev('CABIN.photo.lights')}`);
      if (n < Math.min(target, 2)) fail(`photo mode did not render (${label}): ${n} samples`);
      return st;
    };
    const resetWait = async () => { const t0 = Date.now(); await sleep(400); while (Date.now() - t0 < 15000 && await ev('CABIN.photo.samples') >= target) await sleep(200); };
    const look = `JSON.stringify({ tm: CABIN.renderer.toneMapping, exp: CABIN.renderer.toneMappingExposure, env: CABIN.scene.environment?.uuid, bg: CABIN.scene.background?.uuid ?? null, fog: !!CABIN.scene.fog, labels: CABIN.state.labels, night: CABIN.scene.getObjectByName('nightLights').visible })`;
    await ev(`(CABIN.setView('orbit'), CABIN.setLabels(true), CABIN.setMode('real'), true)`);
    const before = await ev(look);
    await ev(`(CABIN.setView('orbit'), document.querySelector('#info').hidden = true, CABIN.view('p03',{instant:true}), CABIN.setMode('photo'), true)`);
    await sleep(500); await ev(`(CABIN.setMode('photo'), true)`); // a second click must not corrupt the saved state
    const go = (id) => goShot(id); const _unused = (id) => id === 'fire' ? `(CABIN.walkAt(14.5, -5.5, -0.15, 41 * Math.PI / 180), CABIN.look(41, -9), true)` : id === 'sky' ? `(CABIN.goTo('lakeside'), CABIN.look(-60, 38), true)` : id === 'lakeOut' || /^p0|aerial|elev/.test(id) ? `(CABIN.setView('orbit'), CABIN.view('${id}',{instant:true}), true)` : `(CABIN.goTo('${id}'), true)`;
    let first = true;
    for (const [time, views] of plan) {
      await ev(`(CABIN.photo.setTime('${time}'), true)`);
      for (const id of views) {
        if (id.startsWith('sun:')) { await ev(`(CABIN.photo.setSun(${+id.slice(4)}), true)`); continue; }
        if (id === 'moving') { // a frame grabbed while walking (W held): the fast preview, not a converged frame
          await ev(goShot('living')); await resetWait(); await waitSamples(`${time} before moving`);
          await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 }); await sleep(900);
          report.shots.push(await shot(`g-photo-${time}-moving`));
          await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 }); await sleep(300);
          continue;
        }
        await ev(go(id)); if (!first) await resetWait(); first = false;
        await waitSamples(`${time} ${id}`); report.shots.push(await shot(`g-photo-${time}-${id}`));
      }
    }
    { // furniture toggle inside photo mode rebuilds the traced scene and keeps rendering
      await ev(`(CABIN.setOption('furniture', false), true)`); await sleep(500); await resetWait(); await waitSamples('furniture off (rebuilt)');
      report.shots.push(await shot('g-photo-furniture-off'));
      await ev(`(CABIN.setOption('furniture', true), true)`); await sleep(500); await resetWait(); await waitSamples('furniture back on');
    }
    if (argv.includes('--rebuild-check')) { // time changes must match a full rebuild
      const a = await ev('CABIN.photo.stats'); await ev(`(CABIN.photo.rebuild(), true)`); await resetWait(); const b = await waitSamples('after full rebuild');
      const d = Math.abs(a[0] - b[0]) / Math.max(a[0], 1e-6); console.log(`rebuild check: log-average ${a[0]} vs ${b[0]} (${(d * 100).toFixed(1)}%)`);
      if (d > 0.12) fail(`switching time of day differs from a full rebuild: ${a[0]} vs ${b[0]}`);
    }
    await ev(`CABIN.setMode('real')`);
    const after = await ev(look); if (after !== before) fail(`leaving photo mode did not restore the raster look: ${before} → ${after}`);
    const f0 = await ev('CABIN.frames'); await ev('CABIN.look(0,-4) || true'); await sleep(3000); if (!(await ev('CABIN.frames') > f0)) fail('render loop stopped after leaving photo mode');
    if (await ev('CABIN.state.mode') !== 'real') fail('could not leave photo mode');
    await ev(`(CABIN.photo.setTime('day'), true)`);
  }
  if (only.has('info')) {
    await ev(`(CABIN.setMode('real'), CABIN.setView('orbit'), CABIN.view('aerial',{instant:true}), true)`);
    const titles = [];
    for (const id of await ev('CABIN.places')) titles.push(await ev(`CABIN.openInfo('${id}')`));
    console.log(`info cards opened: ${titles.length}`);
    const txt = await ev(`(CABIN.openInfo('chimney'), document.querySelector('#info').innerText)`);
    if (/on The elevation/.test(txt)) fail('chimney card wording: ' + txt.match(/on The elevation[^.]*/)[0]);
    for (const id of ['garage', 'ribbon', 'chimney', 'living']) { await ev(`CABIN.openInfo('${id}')`); report.shots.push(await shot('f-info-' + id)); }
  }
} catch (e) { fail('error: ' + e.message); }
finally {
  if (external.size) fail('external requests: ' + [...external].join(', '));
  const errs = logs.filter((l) => !/GPU stall|swiftshader|WebGL: INVALID|THREE.WebGLRenderer: Context Lost/i.test(l));
  if (errs.length) { console.log('console:\n  ' + errs.slice(0, 12).join('\n  ')); if (errs.some((l) => l.startsWith('[exception]') || l.startsWith('[error]'))) fail('page logged errors'); }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ problems, external: [...external], ...report }, null, 1));
  console.log(problems.length ? `\n✗ ${problems.length} problem(s)` : `\n✓ all checks passed · 0 external requests · shots in ${path.relative(process.cwd(), out)}/`);
  try { ws?.close(); } catch { } chrome.kill('SIGKILL'); server.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { } process.exit(problems.length ? 1 : 0); }, 300);
}
