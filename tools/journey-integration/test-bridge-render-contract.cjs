'use strict';
// Production bridge helper against the Creator 3.8.8 Material/createMesh boundary contract (r5 彩虹桥: RainbowBridge.mountRainbowBridge,
// one runtime-built deck on the controller centreline — replaces the 7 RainbowBridgeStrip* ribbons).
// No browser, GPU rendering, controller clock, storage, or scene changes are exercised here.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ts = require('../qf-env.cjs').typescript();
const DIR = path.resolve(__dirname, '../../creator-build-project/assets/scripts/region');
class Node { constructor(name) { this.name = name; this.children = []; this.components = []; } addChild(node) { this.children.push(node); }
  addComponent(Type) { const c = new Type(); c.node = this; this.components.push(c); if (Type === MeshRenderer) this.renderer = c; return c; }
  getComponent(Type) { return this.components.find(c => c instanceof Type) || null; } }
class Component {}
class MeshRenderer { setSharedMaterial(material, i) { assert.equal(i, 0); this.material = material; } }
let materials = [];
class Material { constructor() { this.properties = {}; materials.push(this); } initialize(info) { this.info = info; } setProperty(key, value) { this.properties[key] = value; } }
class EffectAsset { constructor(p) { this.path = p; this.refs = 0; } addRef() { this.refs++; } decRef() { this.refs--; } }
class V { constructor(...a) { this.v = a; [this.x, this.y, this.z, this.w] = a; } }
let loads = [], failLoads = false;
const cc = { _decorator: { ccclass: () => c => c }, Component, Node, MeshRenderer, Material, EffectAsset, Color: class { constructor(hex) { this.hex = hex; } }, Vec3: V, Vec4: V,
  resources: { load(p, T, cb) { loads.push(p); assert.equal(T, EffectAsset); setImmediate(() => failLoads ? cb(Error('missing ' + p), null) : cb(null, new EffectAsset(p))); } },
  utils: { createMesh(geometry, out, options = {}) {
    const mesh = { geometry, struct: {} };
    // 3.8.8 createMesh: geometry.minPos/maxPos win; calculateBounds only fills them when they are absent.
    mesh.struct.minPosition = geometry.minPos; mesh.struct.maxPosition = geometry.maxPos; if (!geometry.minPos && options.calculateBounds) throw Error('unexpected');
    return mesh; } } };
let night = 0;
function load(file, cache = {}) {
  if (cache[file]) return cache[file].exports; const module = { exports: {} }; cache[file] = module;
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true } }).outputText;
  new Function('require', 'exports', 'module', js)(id => id === 'cc' ? cc : id === '../ui/NightTint' ? { uiNightWeight: () => night } : load(path.resolve(path.dirname(file), id + '.ts'), cache), module.exports, module);
  return module.exports;
}
const RB = load(path.join(DIR, 'RainbowBridge.ts')), Mesh = load(path.join(DIR, 'RainbowBridgeMesh.ts')), Lay = load(path.join(DIR, 'RegionJourneyLayout.ts'));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const length = points => points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);
const near = (a, b, message, eps = 1e-9) => assert(distance(a, b) < eps, message + ' ' + JSON.stringify([a, b]));
const connections = [
  // The actual island endpoint and 24 m landing offset, plus rising/returning generic spans.
  { start: [-2.1135000586509705, 0, 5.281400203704834], edge: [-2.1135000586509705, 0, 8.481400203704834], end: [-2.1135000586509705, 0, 32.481400203704834], arrival: [-2.1135000586509705, 0, 34.88140020370483] },
  { start: [-4, 2, 5], edge: [-4, 3, 8], end: [-4, 15, 32], arrival: [-4, 15, 34.4] },
  { start: [8, 7, 19], edge: [7, 6, 17], end: [-3, 4, -7], arrival: [-4, 4, -9] },
];
(async () => {
const rows = [];
for (const { start, edge, end, arrival } of connections) {
  const points = Lay.bridgePath(edge, end, 2);
  near(points[0], edge, 'bridge must begin at the approach edge');
  near(points.at(-1), end, 'bridge must end at the landing anchor');
  for (const axis of [0, 2]) {
    assert(points.every(p => p[axis] >= Math.min(edge[axis], end[axis]) - 1e-9 && p[axis] <= Math.max(edge[axis], end[axis]) + 1e-9), 'horizontal span must stay between its anchors');
    assert(points.slice(1).every((p, i) => (p[axis] - points[i][axis]) * (end[axis] - edge[axis]) >= -1e-9), 'bridge cannot double back before its landing');
  }
  // sin² arch: same 2 m peak at mid-span, zero arch slope at both landings (the old sin(πt) came in at ≈15°)
  const lin = t => edge[1] + (end[1] - edge[1]) * t, h = i => points[i][1] - lin(i / (points.length - 1));
  assert(Math.abs(h(16) - 2) < 1e-9, 'peak 2 m'); assert(Math.abs(h(1)) < .02 && Math.abs(h(31)) < .02, 'flat landings ' + h(1));
  // RegionJourneyAdapter joins these arrays without repeating the shared edge. This must not add a hidden connector.
  const joined = [start, edge, ...points.slice(1), arrival];
  assert(Math.abs(length(joined) - (distance(start, edge) + length(points) + distance(end, arrival))) < 1e-9, 'approach/bridge/arrival must join without an extra gap');
  const input = JSON.stringify(points), parent = new Node('connected-bridge'), owned = []; materials = []; loads = [];
  const r = await RB.mountRainbowBridge(parent, points, owned);
  assert.equal(JSON.stringify(points), input, 'render setup must not mutate the controller path');
  assert.deepEqual(parent.children.map(n => n.name), ['RainbowBridgeDeck'], 'capless ends: the deck only, ONE renderer');
  assert.equal(r.drawCalls, 1);
  const deck = parent.children[0].renderer, g = deck.mesh.geometry, P = Mesh.pathSampler(points);
  assert.equal(deck.material.info.effectAsset.path, 'world/rainbow-bridge', 'deck uses the r5 deck effect');
  assert(owned.includes(deck.mesh) && owned.includes(deck.material), 'the journey lease must retain ownership');
  // the rendered walk surface (ring vertex 4 = top centre) shares the controller centreline, 1 cm under her feet, on the span
  const n = Mesh.RB.ringVerts; let checked = 0;
  const stations = Mesh.rainbowDeckGeometry(points).stations;
  stations.forEach((s, i) => { if (s < 3.2 || s > P.plan - 3.2) return; const k = (i * n + 4) * 3, p = P.at(s);
    near([g.positions[k], g.positions[k + 1], g.positions[k + 2]], [p[0], p[1] - Mesh.RB.feetM, p[2]], 'rendered deck must share the controller centerline', .02); checked++; });
  assert(checked > 20, 'span stations checked');
  const b = deck.mesh.struct; assert(['x', 'y', 'z'].every(k => Number.isFinite(b.minPosition[k]) && Number.isFinite(b.maxPosition[k])), 'real bridge mesh bounds required');
  for (let i = 0; i < g.positions.length; i++) { const k = 'xyz'[i % 3]; assert(g.positions[i] >= b.minPosition[k] && g.positions[i] <= b.maxPosition[k], 'bounds must contain every bridge vertex'); }
  assert.equal(g.indices.length % 3, 0); assert(g.indices.every(i => i >= 0 && i < g.positions.length / 3), 'indices in range');
  rows.push({ rings: g.positions.length / 3 / n, tris: g.indices.length / 3 });
}
// capped ends (as the island → meadow leg): deck + ends + motes = 3 draw calls, night weight drives both materials
{ const pts = Lay.bridgePath(connections[0].edge, connections[0].end, 2), flat = { ground: () => 0, surface: () => 'g', cap: true };
  const parent = new Node('capped'), owned = []; materials = []; night = 1;
  const r = await RB.mountRainbowBridge(parent, pts, owned, [flat, flat]);
  assert.deepEqual(parent.children.map(n => n.name), ['RainbowBridgeDeck', 'RainbowBridgeEnds', 'RainbowBridgeMotes']); assert.equal(r.drawCalls, 3);
  assert.equal(r.particles, Mesh.RAINBOW_PARTICLES.max, '88 motes'); assert.equal(parent.children[1].renderer.material.info.technique, 0); assert.equal(parent.children[2].renderer.material.info.technique, 1);
  const look = parent.getComponent(RB.RainbowBridgeLook); assert(look, 'night driver on the rig');
  assert.deepEqual(look.deck.properties.rbParams0.v, Mesh.rainbowLook(1).deck, 'night deck params written at mount');
  night = 0; look.update(); assert.deepEqual(look.deck.properties.rbParams0.v, Mesh.rainbowLook(0).deck, 'day deck params follow the weight');
  for (const m of look.ends) assert.deepEqual(m.properties.endParams.v, Mesh.rainbowLook(0).ends);
  assert.equal(owned.length, 6, 'three meshes + three materials owned'); }
// effects missing: one error line, plain deck, the walk goes on
{ failLoads = true; const errors = [], saved = console.error; console.error = m => errors.push(String(m));
  try { const RB2 = load(path.join(DIR, 'RainbowBridge.ts'), {}) /* fresh module: no cached effects */, parent = new Node('fallback'), owned = []; const r = await RB2.mountRainbowBridge(parent, Lay.bridgePath([0, 0, 0], [0, 0, 24], 2), owned);
    assert.equal(r.drawCalls, 1); assert.equal(parent.children[0].renderer.material.info.effectName, 'builtin-standard'); assert.equal(errors.length, 1); assert.match(errors[0], /\[QF_RAINBOW\]/); }
  finally { console.error = saved; failLoads = false; } }
// wiring: every leg mounts the r5 bridge; no strips left
{ const ad = fs.readFileSync(path.join(DIR, 'RegionJourneyAdapter.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert(!/RainbowBridgeStrip|function rainbowBridge/.test(ad), 'old strips removed');
  assert.equal((ad.match(/await waitRegionAsset\(mountRainbowBridge\(rig,/g) || []).length, 2, 'region legs + lakeside leg');
  assert.match(ad, /rainbowEnd\('island',bridge\[0\],approach\),rainbowEnd\('meadow',bridge\[bridge\.length-1\],arrival\)/);
  assert.match(ad, /rainbowEnd\('island',L\.bridge\[0\],L\.approach\),rainbowEnd\('lakeside',L\.bridge\[L\.bridge\.length-1\],L\.arrival\)/);
  assert.match(ad, /:\[null,null\]\),token\)/, 'sky city: capless until plan B §8.4'); }
console.log('PASS bridge render contract: 3 endpoint/route joins (sin² arch, flat landings), ONE deck renderer on the controller centerline, enclosing bounds, owned assets; capped = 3 DC + 88 motes + night driver; effect-missing fallback; wiring ' + JSON.stringify(rows) + '; no GPU/visual acceptance');
})().catch(e => { console.error(e); process.exitCode = 1; });
