'use strict';
// Reward chest (board-ui §5): GLB c-popups result_chest.glb in bundle board_art/chest, lid keys from its chest_open
// clip (0.5 s, ends at −118° so the inside shows from the 40° camera), off-screen RenderTexture shown by a UI Sprite.
// Real ResultChest3D / CommonPanels.openReward sources on the board-ui Cocos doubles; no GPU, no Creator import.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHarness } = require('./board-ui/harness.cjs');
const ROOT = path.resolve(__dirname, '..'), S = path.join(ROOT, 'creator-build-project/assets/scripts'), GLB = path.join(ROOT, 'creator-build-project/assets/bundles/board_art/chest/result_chest.glb');
const checks = []; const ok = async (name, fn) => { await fn(); checks.push(name); console.log('PASS', name); };
function glb() {
  const b = fs.readFileSync(GLB); assert.equal(b.toString('ascii', 0, 4), 'glTF');
  const jl = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jl)), bin = b.subarray(20 + jl + 8);
  const read = i => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = { SCALAR: 1, VEC4: 4 }[a.type], off = (v.byteOffset || 0) + (a.byteOffset || 0); return Array.from({ length: a.count }, (_, k) => Array.from({ length: n }, (_, c) => bin.readFloatLE(off + (k * n + c) * 4))); };
  return { json, read };
}
(async () => {
  const H = createHarness(), cc = H.cc, M = H.load('ResultChest3D'), { BoardArt } = H.load('ui/BoardArt');
  await ok('GLB: chest_lid + chest_body nodes, one chest_open rotation clip on the lid; LID_KEYS are its samples (±0.05°)', () => {
    const { json, read } = glb(); assert.deepEqual(json.nodes.map(n => n.name).sort(), ['chest_body', 'chest_lid']);
    const a = json.animations.find(x => x.name === 'chest_open'); assert(a); assert.equal(a.channels.length, 1);
    const ch = a.channels[0], s = a.samplers[ch.sampler]; assert.equal(json.nodes[ch.target.node].name, 'chest_lid'); assert.equal(ch.target.path, 'rotation');
    const times = read(s.input).map(x => x[0]), q = read(s.output); assert.equal(times.length, M.LID_KEYS.length);
    assert(Math.abs(times[times.length - 1] - M.OPEN_SECONDS) < 1e-3, 'clip length ' + times.at(-1));
    q.forEach(([x, , , w], i) => { const deg = 2 * Math.atan2(x, w) * 180 / Math.PI; assert(Math.abs(deg - M.LID_KEYS[i]) < 0.05, i + ': ' + deg + ' vs ' + M.LID_KEYS[i]); });
  });
  await ok('lid curve: 0 → overshoot −126° → settles −118° at 0.5 s (inside visible), clamped outside [0, 0.5]', () => {
    assert.equal(M.lidAngleAt(0), 0); assert.equal(M.lidAngleAt(-1), 0); assert.equal(M.lidAngleAt(M.OPEN_SECONDS), -118); assert.equal(M.lidAngleAt(9), -118);
    assert.equal(Math.min(...M.LID_KEYS), -126); for (let i = 1; i <= 9; i++) assert(M.LID_KEYS[i] < M.LID_KEYS[i - 1], 'opening is monotone');
    M.LID_KEYS.forEach((k, i) => { if (i < M.LID_KEYS.length - 1) assert(Math.abs(M.lidAngleAt(i / 30) - k) < 1e-9); });
    assert(Math.abs(M.lidAngleAt(7.5 / 30) - (M.LID_KEYS[7] + M.LID_KEYS[8]) / 2) < 1e-9, 'linear between keys like the GLB sampler');
  });
  await ok('camera: 40° pitch, looking at the chest mouth, framing covers the lid sweep', () => {
    assert.equal(M.CHEST_CAMERA.pitchDeg, 40); const p = M.chestCameraPosition(), t = M.CHEST_CAMERA.target;
    const dy = p[1] - t[1], dz = p[2] - t[2]; assert(Math.abs(Math.atan2(dy, dz) * 180 / Math.PI - 40) < 1e-9); assert(Math.abs(Math.hypot(dy, dz) - M.CHEST_CAMERA.distance) < 1e-9);
    const half = M.CHEST_CAMERA.fovDeg / 2 * Math.PI / 180, top = [0, 2.0, -0.35]; const v = [top[1] - p[1], top[2] - p[2]], ang = Math.atan2(-v[0], -v[1]) * 180 / Math.PI;
    assert(Math.abs(ang - 40) < M.CHEST_CAMERA.fovDeg / 2, 'lid top inside the vertical FOV');
  });
  const lid = new cc.Node('chest_lid'), prefab = { lid };
  cc.instantiate = () => { const m = new cc.Node('result_chest'); const l = new cc.Node('chest_lid'); m.addChild(l); m.addChild(new cc.Node('chest_body')); l.addComponent(cc.MeshRenderer).sharedMaterials = [null]; return m; };
  let paletteOk = true; cc.assetManager.loadAny = (_o, cb) => Promise.resolve().then(() => cb(paletteOk ? null : Error('x'), paletteOk ? new cc.Material() : null));
  const art = BoardArt.shared(); let prefabResult = prefab; art.chestPrefab = () => Promise.resolve(prefabResult);
  await ok('load: rig at the off-screen origin on CHEST_LAYER, perspective camera only sees that layer into a 512² RenderTexture on the Sprite; open() reaches −118° in 0.5 s', async () => {
    const host = new cc.Node('Host'); cc._scene.addChild(host); const c = new M.ResultChest3D(host, 340);
    assert.equal(await c.load(), true); assert.equal(c.diagnostics().state, 'ready');
    const rig = cc._scene.getChildByName('ResultChestRig'); assert(rig); assert.deepEqual([rig.position.x, rig.position.y, rig.position.z], [10000, 10000, 10000]);
    const cam = rig.getComponentsInChildren(cc.Camera)[0]; assert.equal(cam.visibility, M.CHEST_LAYER); assert.equal(cam.projection, cc.Camera.ProjectionType.PERSPECTIVE); assert.equal(cam.fov, 30); assert(cam.targetTexture);
    rig.walk(n => { if (n !== rig) assert.equal(n.layer, M.CHEST_LAYER, n.name + ' layer'); });
    assert(c.sprite.spriteFrame && c.sprite.spriteFrame.texture === cam.targetTexture); assert.equal(c.node.getComponent(cc.UITransform).width, 340);
    c.open(true); assert.equal(c.angle(), 0); for (let i = 0; i < 15; i++) c.update(1 / 30); assert.equal(c.angle(), -118);
    c.close(); assert.equal(c.angle(), 0); c.open(false); assert.equal(c.angle(), -118, 'reduced motion jumps to open');
    const frame = c.sprite.spriteFrame, rt = cam.targetTexture; c.dispose(); c.dispose();
    assert.equal(c.sprite.spriteFrame, null); assert(frame.destroyed); assert(!cc._scene.getChildByName('ResultChestRig'), 'rig removed'); assert.equal(cam.enabled, false); host.destroy();
    void rt;
  });
  await ok('failure is bounded: missing prefab / disposed while loading leave no rig and no frame', async () => {
    prefabResult = null; const h = new cc.Node('H'); cc._scene.addChild(h); const a = new M.ResultChest3D(h, 200); assert.equal(await a.load(), false); assert.equal(a.diagnostics().state, 'failed'); assert.equal(a.sprite.spriteFrame, null); a.dispose();
    prefabResult = prefab; const b = new M.ResultChest3D(h, 200), wait = b.load(); b.dispose(); assert.equal(await wait, false); assert(!cc._scene.getChildByName('ResultChestRig'));
    paletteOk = false; const c = new M.ResultChest3D(h, 200); assert.equal(await c.load(), true, 'palette is optional'); c.dispose(); paletteOk = true; h.destroy();
  });
  await ok('reward popup: 3D chest replaces the closed-chest fallback once loaded and opens; text rows sit below the chest', async () => {
    const { PopupStack } = H.load('ui/PopupKit'), { openReward } = H.load('ui/CommonPanels'); await art.load('popup');
    const layer = new cc.Node('Layer'); cc._scene.addChild(layer); const stack = new PopupStack(layer, () => ({ width: 390, height: 844 }));
    const p = openReward(stack, [{ kind: 'windBell', count: 1, label: '风语铃 ×1' }], null, {}); await H.flush();
    const chest = p.body.getChildByName('ResultChest3D'), fallback = p.body.getChildByName('Fallback') || p.body.children.find(n => n.name === 'chest_closed');
    assert(chest && chest.active, '3D chest shown'); assert(fallback && !fallback.active, 'fallback hidden');
    for (let i = 0; i < 20; i++) p.update(1 / 30);
    const ct = chest.getComponent(cc.UITransform), chestBottom = chest.position.y - ct.height / 2;
    for (const l of p.body.getComponentsInChildren(cc.Label)) { if (l.node.parent !== p.body) continue; assert(l.node.position.y + l.fontSize * 0.7 < chestBottom, 'text above the chest bottom: ' + l.string); }
    p.destroy(); assert(!cc._scene.getChildByName('ResultChestRig'), 'popup teardown disposes the chest');
  });
  await ok('old chest pipeline removed: no geometry script, painter, view, resource, chest-lit effect or preview GLB references', () => {
    for (const f of ['ResultChestGeometry.ts', 'ResultChestView.ts', 'ResultChestResource.ts', 'OriginalResultChestPainter.ts', 'ResultLayout.ts']) assert(!fs.existsSync(path.join(S, f)), f);
    assert(!fs.existsSync(path.join(ROOT, 'creator-build-project/assets/resources/result-chest')));
    const all = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|js)$/.test(e.name)) all.push(fs.readFileSync(p, 'utf8')); } })(S);
    const src = all.join('\n'); for (const s of ['ResultChestGeometry', 'RESULT_CHEST_GEOMETRY', 'OriginalResultChestPainter', 'result-chest/chest-lit', 'result_chest_preview']) assert(!src.includes(s), s);
  });
  const out = path.join(ROOT, 'evidence/result-chest-3d'); fs.mkdirSync(out, { recursive: true });
  const report = { result: 'PASS', checks, scope: 'GLB parse + real ResultChest3D/openReward on Cocos doubles. Not GPU rendering, Creator GLB import or device framing.' };
  fs.writeFileSync(path.join(out, 'tests.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
})().catch(e => { console.error(e); process.exit(1); });
