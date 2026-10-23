'use strict';
// r4.1 (Grok Bot, 草甸 option 1): the board hint banner (提示牌 / toast) sits ABOVE the board tray, in the plate→tray band, for
// every region alike; style unchanged. Locks, per screen (boardSafeInsets + explicit capsule variants):
//   banner bottom ≤ tray top − 6, banner top ≥ capsule / safe-area bottom + 6, width ≤ 330 and ≥ 12 pt in from the edges,
//   no overlap with the info plate (portrait phones), the tool row or the girl (meadow landing spot, lakeside frozen copy);
//   b18: on portrait the lakeside girl (B′ board lens) is also fully on screen and clear of the tray;
//   tray unchanged on the tall phones (390×844 / 414×896 / 360×780 / 768×1024); landscape: above the tray when there is room,
//   else in the left column, never over the tray. Runtime: the Toast node lands on BoardLayout.toast and the pill stays ≤ maxWidth.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHarness } = require('./harness.cjs');
const H = createHarness(), S = path.resolve(__dirname, '../../creator-build-project/assets/scripts') + '/';
const BL = H.load(S + 'ui/BoardLayout.ts');
const checks = []; const ok = (name, fn) => Promise.resolve().then(fn).then(() => { checks.push(name); console.log('PASS', name); });
const GAP = 6, EDGE = 12, MAXW = 330, HGT = 32;
const rect = r => ({ l: r.x - r.width / 2, r: r.x + r.width / 2, t: r.y - r.height / 2, b: r.y + r.height / 2 });
const banner = g => ({ l: g.toast.x - g.toast.maxWidth / 2, r: g.toast.x + g.toast.maxWidth / 2, t: g.toast.y - g.toast.height / 2, b: g.toast.y + g.toast.height / 2 });
const overlap = (a, q) => Math.max(0, Math.min(a.r, q.r) - Math.max(a.l, q.l)) * Math.max(0, Math.min(a.b, q.b) - Math.max(a.t, q.t));
const PORTRAIT = [[390, 844], [375, 667], [414, 896], [320, 568], [360, 780], [768, 1024]];
const LANDSCAPE = [[1024, 768], [1280, 800], [1440, 900], [1280, 720], [844, 390]];
const r1 = x => +x.toFixed(1), table = [];
function portraitChecks(w, h, safe, goals, label) {
  const g = BL.boardLayout(w, h, safe, goals), b = banner(g), tray = rect(g.tray), plate = rect(g.plate), cap = safe.capsule;
  assert.equal(g.toast.height, HGT, label + ' height'); assert(g.toast.maxWidth <= MAXW, label + ' max width');
  assert(b.b <= tray.t - GAP + 1e-9, `${label}: banner bottom ${r1(b.b)} > tray top ${r1(tray.t)} − ${GAP}`);
  assert(b.t >= Math.max(safe.top, cap ? cap.bottom : 0) + GAP - 1e-9, `${label}: banner top ${r1(b.t)} inside the capsule / safe area`);
  assert(b.l >= safe.left + EDGE - 1e-9 && b.r <= w - safe.right + 1e-9 - EDGE, `${label}: banner ${r1(b.l)}–${r1(b.r)} not inset ${EDGE} pt`);
  assert(b.t >= plate.b + GAP - 1e-9, `${label}: banner overlaps the info plate (${r1(b.t)} < ${plate.b} + ${GAP})`);
  for (const n of [1, 2, 3]) for (const x of BL.toolSlots(g, n)) assert.equal(overlap(b, { l: x - g.tools.size / 2, r: x + g.tools.size / 2, t: g.tools.y - g.tools.size / 2, b: g.tools.y + g.tools.size / 2 }), 0, label + ' tool icon');
  assert(Math.abs(g.toast.x - g.tray.x) < 1e-9, label + ' centred on the tray');
  return { g, b, tray, plate };
}
(async () => {
  await ok('reference 390×844: banner y 168–200 (12 pt under the plate, 12 pt over the tray), x 30–360 at 330 pt; tray / tools unchanged', () => {
    const safe = BL.boardSafeInsets(390, 844), { g, b } = portraitChecks(390, 844, safe, 2, '390x844');
    assert.deepEqual([b.t, b.b, b.l, b.r, g.toast.maxWidth].map(r1), [168, 200, 30, 360, 330]);
    assert.equal(r1(g.tray.y - g.tray.height / 2), 212); assert(Math.abs(g.pitch - 42.6) < 1e-9); assert.equal(g.tools.y, 730);
  });
  await ok('portrait phones / pad (default insets, goals 2–4): above the tray, below the capsule, ≤ 330, inset, clear of plate and tools', () => {
    for (const [w, h] of PORTRAIT) for (const goals of [2, 3, 4]) {
      const safe = BL.boardSafeInsets(w, h), r = portraitChecks(w, h, safe, goals, `${w}x${h} g${goals}`);
      if (goals === 2) table.push({ screen: `${w}x${h}`, banner: { x: [r1(r.b.l), r1(r.b.r)], y: [r1(r.b.t), r1(r.b.b)], maxWidth: r1(r.g.toast.maxWidth) }, tray: { x: [r1(r.tray.l), r1(r.tray.r)], y: [r1(r.tray.t), r1(r.tray.b)] }, plateBottom: r.plate.b, capsuleBottom: safe.capsule.bottom });
    }
  });
  await ok('real-device capsule variants (wx menu rect higher / lower, notch / no notch): same guarantees', () => {
    for (const [w, h, top, cap] of [[375, 667, 20, [26, 58]], [320, 568, 20, [24, 56]], [390, 844, 47, [50, 82]], [414, 896, 48, [56, 88]], [360, 780, 36, [42, 74]]])
      portraitChecks(w, h, { top, bottom: 34, left: 0, right: 0, capsule: { top: cap[0], bottom: cap[1], left: w - 93, right: w - 6 } }, 2, `${w}x${h} cap ${cap}`);
  });
  await ok('tall phones keep the exact r4 tray (camera / landing work stays valid); short phones give the tray ≤ 20 pt for the band', () => {
    for (const [w, h, top] of [[390, 844, 212], [414, 896, 215.4], [360, 780, 210.1], [768, 1024, 228.8]]) { const g = BL.boardLayout(w, h, BL.boardSafeInsets(w, h), 2); assert.equal(r1(g.tray.y - g.tray.height / 2), top, `${w}x${h} tray top`); }
    for (const [w, h] of [[375, 667], [320, 568]]) { const g = BL.boardLayout(w, h, BL.boardSafeInsets(w, h), 2), t = g.tray.y - g.tray.height / 2, pb = g.plate.y + g.plate.height / 2; assert(t - pb >= HGT + 2 * GAP - 1e-9 && t - pb <= 44 + 1e-9, `${w}x${h} band ${t - pb}`); assert(t - 180 <= 20 + 1e-9); }
  });
  await ok('minimum-pitch short window (390×520): the tray stays clear; the banner may sit over the plate but never in the capsule', () => {
    const safe = BL.boardSafeInsets(390, 520), g = BL.boardLayout(390, 520, safe, 2), b = banner(g), t = g.tray.y - g.tray.height / 2;
    assert(b.b <= t - GAP + 1e-9); assert(b.t >= safe.capsule.bottom + GAP);
  });
  await ok('landscape (desktop preview): above the tray when it fits (clear of top inset + capsule avoid), else left column; never over the tray', () => {
    for (const [w, h] of LANDSCAPE) {
      const safe = BL.boardSafeInsets(w, h), g = BL.boardLayout(w, h, safe, 2), b = banner(g), tray = rect(g.tray), avoid = { l: g.capsuleAvoid.left, r: w, t: g.capsuleAvoid.top, b: g.capsuleAvoid.bottom };
      assert(g.toast.maxWidth <= MAXW && g.toast.maxWidth >= 200, `${w}x${h} width ${g.toast.maxWidth}`);
      assert.equal(overlap(b, tray), 0, `${w}x${h} over the tray`); assert.equal(overlap(b, avoid), 0, `${w}x${h} capsule`);
      assert(b.t >= safe.top + GAP && b.b <= h - safe.bottom && b.l >= safe.left + EDGE - 1e-9 && b.r <= w - Math.max(12, safe.right) + 1e-9, `${w}x${h} on screen`);
      const above = b.b <= tray.t - GAP + 1e-9;
      if (above) assert(Math.abs(g.toast.x - g.tray.x) < 1e-9, 'centred on the tray');
      else { assert(b.r <= tray.l - EDGE + 1e-9, `${w}x${h} column banner left of the tray`); assert(b.t >= g.tools.y + g.tools.size / 2, 'under the tool row'); }
      table.push({ screen: `${w}x${h} landscape`, placement: above ? 'above tray' : 'left column', banner: { x: [r1(b.l), r1(b.r)], y: [r1(b.t), r1(b.b)], maxWidth: r1(g.toast.maxWidth) }, tray: { x: [r1(tray.l), r1(tray.r)], y: [r1(tray.t), r1(tray.b)] } });
    }
    assert(table.find(r => r.screen === '1024x768 landscape').placement === 'above tray'); assert(table.find(r => r.screen === '844x390 landscape').placement === 'left column');
  });
  await ok('the girl is never under the banner: meadow landing spot and the lakeside frozen copy on every screen', () => {
    const meadow = { l: 99, r: 123, t: 703, b: 762 }; assert.equal(overlap(banner(BL.boardLayout(390, 844, BL.boardSafeInsets(390, 844), 2)), meadow), 0, 'meadow 390x844');
    for (const r of require('../journey-integration/girl-frame.cjs')) if (r.visible) { const [w, h] = r.screen.split('x').map(Number); assert.equal(overlap(banner(BL.boardLayout(w, h, BL.boardSafeInsets(w, h), 2)), { l: r.boxPt.l, r: r.boxPt.r, t: r.boxPt.t, b: r.boxPt.b }), 0, r.region + ' ' + r.screen); }
    const LK = H.load(S + 'region/LakesideCameraLayout.ts'), Core = H.load(S + 'world-r1/RegionJourneyCore.ts'), C = H.load(S + 'world-r1/RegionCameraData.ts').REGION_CAMERA.islandCharacter;
    const j = LK.lakesideJourney([2, 0, -1]), P = [...j.approach, ...j.bridge.slice(1), ...j.arrival], LEN = Core.routeLength(P), START = { position: [0, 5, -10], target: [0, 0, 0], fovVerticalDeg: 45 };
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nz = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
    for (const [w, h] of PORTRAIT.concat([[390, 520]])) {
      const safe = BL.boardSafeInsets(w, h), fr = LK.lakesideScreenFrame(w, h, safe), cam = Core.journeyCamera(P, LEN, START, j.focus, undefined, 0, LK.lakesideScreenLanding(j, fr));
      const F = nz(sub(cam.target, cam.position)), R = nz(cr(F, [0, 1, 0])), U = cr(R, F), t = Math.tan(cam.fovVerticalDeg * Math.PI / 360), root = P.at(-1), xs = [], ys = [];
      // Body width along the lens right (the rendered silhouette). A world-axis cube at the v4 stop puts an empty corner a few px past the edge; the qaTools=3 renders keep her on screen.
      for (const s of [-1, 1]) for (const y of [0, C.heightM]) { const q = sub([root[0] + R[0] * s * C.halfWidthM, root[1] + y, root[2] + R[2] * s * C.halfWidthM], cam.position), z = dot(q, F); assert(z > 0); xs.push((dot(q, R) / (z * t * w / h) + 1) / 2 * w); ys.push((1 - dot(q, U) / (z * t)) / 2 * h); }
      const girl = { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
      assert.equal(overlap(banner(BL.boardLayout(w, h, safe, 2)), girl), 0, `lakeside ${w}x${h}: girl ${JSON.stringify(girl)}`);
      // b18 7 m / short: she stands under the tray. 2 px covers the 0.6 m body being slightly wider than the rendered mesh on the short lens.
      { const gl = BL.boardLayout(w, h, safe, 2); if (w < h) { assert.equal(overlap(rect(gl.tray), girl), 0, `lakeside ${w}x${h}: girl under the tray ${JSON.stringify(girl)}`); assert(girl.l >= -2 && girl.r <= w + 2 && girl.t >= -2 && girl.b <= h + 2, `lakeside ${w}x${h}: girl off screen ${JSON.stringify(girl)}`); } }
      // b18b (Grok Bot on e925b4e5): on 390×844 and 320×568 she overlaps no tool button (3 tools shown)
      if ((w === 390 && h === 844) || (w === 320 && h === 568)) { const gl = BL.boardLayout(w, h, safe, 2); for (const x of BL.toolSlots(gl, 3)) assert.equal(overlap(girl, { l: x - gl.tools.size / 2, r: x + gl.tools.size / 2, t: gl.tools.y - gl.tools.size / 2, b: gl.tools.y + gl.tools.size / 2 }), 0, `lakeside ${w}x${h}: girl over tool ${x} ${JSON.stringify(girl)}`); }
      const row = table.find(x => x.screen === `${w}x${h}`); if (row) row.lakesideGirl = { x: [r1(girl.l), r1(girl.r)], y: [r1(girl.t), r1(girl.b)] };
    }
  });
  await ok('every region alike: the board UI places the Toast only from BoardLayout.toast (no region / provider branch), style constants unchanged', () => {
    const ui = fs.readFileSync(S + 'ManagedMobileBoardUI.ts', 'utf8'), lay = fs.readFileSync(S + 'ui/BoardLayout.ts', 'utf8');
    assert.equal((ui.match(/this\.toast\.setPosition\(/g) || []).length, 1); assert(/this\.toast\.setPosition\(X\(g\.toast\.x\), Y\(g\.toast\.y\), 0\)/.test(ui));
    const size = ui.slice(ui.indexOf('private sizeToast()'), ui.indexOf('private paintToast(')); assert(size.length > 50 && !/provider|region|lakeside|meadow|skycity/i.test(size), 'no per-region sizing');
    assert(/measure\(text, 15\)/.test(size) && /tw \+ 40/.test(size) && /\?\? 330/.test(size) && /\?\? 32/.test(size), 'width = measure(text,15)+40, ≤ max, h 32');
    assert(/export const TOAST = \{ height: 32, gap: 6, maxWidth: 330, edge: 12 \}/.test(lay));
    for (const c of ['new Color(40, 30, 20, 40)', 'new Color(201, 177, 133, 255)', 'g.lineWidth = 1.5', 'roundRect(-w / 2, -h / 2, w, h, h / 2)']) assert(ui.includes(c), 'paintToast style ' + c);
    assert(!/toolsY - 62/.test(lay), 'old under-tray / over-tools slot removed');
  });
  await ok('runtime: the Toast node sits on BoardLayout.toast above the tray; the longest ManagedTools hint fills ≤ maxWidth and its text scales to stay inside', async () => {
    const { createBoard } = require('./board-fixture.cjs'), H2 = createHarness(); H2.cc.sys.localStorage.setItem('qfl.ui.seenTools', JSON.stringify(['starlight', 'windbell', 'tidebottle']));
    const b = createBoard({ harness: H2 }); await H2.flush(); b.render(); b.u.update(0);
    const u = b.u, g = u.geo, toast = u.root.getChildByName('Toast'), tr = toast.getComponent(H2.cc.UITransform), lab = toast.getChildByName('ToastText');
    const w = g.width, h = g.height; assert(Math.abs(toast.position.x - (g.toast.x - w / 2)) < 1e-6 && Math.abs(toast.position.y - (h / 2 - g.toast.y)) < 1e-6, 'Toast node at BoardLayout.toast');
    const trayTopUi = h / 2 - (g.tray.y - g.tray.height / 2); assert(toast.position.y - 16 >= trayTopUi + GAP - 1e-6, 'pill above the tray (UI y up)');
    H2.tap(u.tools[1]); assert.equal(u.diagnostics().toast, '风语铃 · 点选目标'); assert(Math.abs(tr.contentSize.width - (7 * 15 + 2 * 0.3 * 15 + 0.56 * 15 + 40)) < 1e-6, 'pill = measure(text, 15) + 40'); assert.equal(lab.scale.x, 1, 'short prompt unscaled');
    const longest = '这件道具已用完，可从已获得的宝箱或地区礼物领取'; u.say(longest);
    assert.equal(tr.contentSize.width, Math.min(330, g.toast.maxWidth)); assert.equal(tr.contentSize.height, 32); assert(lab.scale.x < 1 && lab.scale.x * longest.length * 15 <= tr.contentSize.width - 28 + 1e-6, 'longest hint inside the pill caps');
  });
  console.log('FOOTPRINT ' + JSON.stringify(table)); if (process.env.QF_HINT_FOOTPRINT) fs.writeFileSync(process.env.QF_HINT_FOOTPRINT, JSON.stringify(table, null, 1) + '\n');
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, scope: 'BoardLayout hint banner geometry + real ManagedMobileBoardUI on the board-ui harness; no rendering / device' }));
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
