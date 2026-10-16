'use strict';
// Production bridge helper against the Creator 3.8.8 Material/createMesh boundary contract.
// No browser, GPU rendering, controller clock, storage, or scene changes are exercised here.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ts = require('../qf-env.cjs').typescript();
const file = path.resolve(__dirname, '../../creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts');
const source = fs.readFileSync(file, 'utf8');
const NONE = 0, BACK = 2;
class Node {
  constructor(name) { this.name = name; this.children = []; }
  addChild(node) { this.children.push(node); }
  addComponent(Type) { return this.renderer = new Type(); }
}
class MeshRenderer { setSharedMaterial(material) { this.material = material; } }
class Material {
  constructor() { this.properties = {}; }
  initialize(info) { this.cullMode = info.states?.rasterizerState?.cullMode ?? BACK; }
  setProperty(key, value) { this.properties[key] = value; }
  // Material assets only warn in 3.8.8; the attempted override has no effect.
  overridePipelineStates() {}
}
const cc = { Node, MeshRenderer, Material, Color: class { constructor(hex) { this.hex = hex; } },
  gfx: { CullMode: { NONE } }, utils: { createMesh(geometry, out, options = {}) {
    const mesh = { geometry, struct: {} };
    // 3.8.8 createMesh computes bounds only when calculateBounds is explicitly enabled.
    if (options.calculateBounds) {
      for (const [key, reduce] of [['minPosition', Math.min], ['maxPosition', Math.max]])
        mesh.struct[key] = [0, 1, 2].map(axis => reduce(...geometry.positions.filter((_, index) => index % 3 === axis)));
    }
    return mesh;
  } } };
function loadBridge(text) {
  const module = { exports: {} };
  // Expose only in this in-memory test module; the shipped module keeps its private helper.
  const js = ts.transpileModule(text + '\nexport { rainbowBridge, bridgePath };', {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'exports', 'module', js)(name => name === 'cc' ? cc : {}, module.exports, module);
  return module.exports;
}
const { rainbowBridge: bridge, bridgePath } = loadBridge(source);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const length = points => points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);
const near = (a, b, message) => assert(distance(a, b) < 1e-9, message);
const connections = [
  // The actual island endpoint and 24 m landing offset, plus rising/returning generic spans.
  { start: [-2.1135000586509705, 0, 5.281400203704834], edge: [-2.1135000586509705, 0, 8.481400203704834], end: [-2.1135000586509705, 0, 32.481400203704834], arrival: [-2.1135000586509705, 0, 34.88140020370483] },
  { start: [-4, 2, 5], edge: [-4, 3, 8], end: [-4, 15, 32], arrival: [-4, 15, 34.4] },
  { start: [8, 7, 19], edge: [7, 6, 17], end: [-3, 4, -7], arrival: [-4, 4, -9] },
];
for (const { start, edge, end, arrival } of connections) {
  const points = bridgePath(edge, end, 2);
  near(points[0], edge, 'bridge must begin at the approach edge');
  near(points.at(-1), end, 'bridge must end at the landing anchor');
  for (const axis of [0, 2]) {
    assert(points.every(p => p[axis] >= Math.min(edge[axis], end[axis]) - 1e-9 && p[axis] <= Math.max(edge[axis], end[axis]) + 1e-9), 'horizontal span must stay between its anchors');
    assert(points.slice(1).every((p, i) => (p[axis] - points[i][axis]) * (end[axis] - edge[axis]) >= -1e-9), 'bridge cannot double back before its landing');
  }
  // RegionJourneyAdapter joins these arrays without repeating the shared edge. This must not add a hidden connector.
  const joined = [start, edge, ...points.slice(1), arrival];
  assert(Math.abs(length(joined) - (distance(start, edge) + length(points) + distance(end, arrival))) < 1e-9, 'approach/bridge/arrival must join without an extra gap');
  const parent = new Node('connected-bridge'); bridge(parent, points, []);
  for (let i = 0; i < points.length; i++) {
    const centerStrip = parent.children[3].renderer.mesh.geometry.positions, offset = i * 6;
    near([(centerStrip[offset] + centerStrip[offset + 3]) / 2, (centerStrip[offset + 1] + centerStrip[offset + 4]) / 2 + .015, (centerStrip[offset + 2] + centerStrip[offset + 5]) / 2], points[i], 'rendered bridge must share the controller centerline');
  }
}
const paths = [
  [[-2.1, 0, 8.4], [-2.1, 1.4, 14.4], [-2.1, 2, 20.4], [-2.1, 1.4, 26.4], [-2.1, 0, 32.4]],
  [[-4, 3, 12], [-2, 7, 18], [1, 11, 24], [5, 15, 30]],
];
const geometries = [];
for (const points of paths) {
  const input = JSON.stringify(points), parent = new Node('bridge-owner'), owned = [];
  bridge(parent, points, owned);
  assert.equal(JSON.stringify(points), input, 'render setup must not mutate the controller path');
  assert.equal(parent.children.length, 7); assert.equal(owned.length, 14);
  for (const child of parent.children) {
    const { mesh, material } = child.renderer, { geometry: g, struct: bounds } = mesh;
    assert.equal(material.cullMode, NONE, 'bridge strips must have effective two-sided rendering');
    assert(owned.includes(mesh) && owned.includes(material), 'the journey lease must retain ownership');
    assert.equal(g.positions.length, points.length * 6); assert.equal(g.indices.length, (points.length - 1) * 6);
    assert(bounds.minPosition?.every(Number.isFinite) && bounds.maxPosition?.every(Number.isFinite), 'real bridge mesh bounds required');
    for (let i = 0; i < g.positions.length; i++)
      assert(g.positions[i] >= bounds.minPosition[i % 3] && g.positions[i] <= bounds.maxPosition[i % 3], 'bounds must contain every bridge vertex');
    geometries.push(g);
  }
}
// Independently confirm that the rendering-only correction leaves the prior vertex/index generation intact.
const oldBridge = loadBridge(source.replace(',undefined,{calculateBounds:true}', '').replace(',states:{rasterizerState:{cullMode:gfx.CullMode.NONE}}', '')).rainbowBridge;
let index = 0;
for (const points of paths) {
  const parent = new Node('prior-render-contract'); oldBridge(parent, points, []);
  for (const child of parent.children) {
    assert.deepEqual(child.renderer.mesh.geometry, geometries[index++]);
    assert.equal(child.renderer.material.cullMode, BACK, 'negative control retains the ineffective old asset state');
    assert.equal(child.renderer.mesh.struct.minPosition, undefined, 'negative control retains missing old bounds');
  }
}
console.log('PASS bridge render contract: 3 endpoint/route joins with matching rendered centerlines; 14 strips, effective cull NONE, enclosing bounds, unchanged strip geometry; no GPU/visual acceptance');
