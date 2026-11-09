'use strict';
/* f9c5656a asset export checked into this candidate. SHA256 is the export manifest.
 * GLB parse and the loader mock are not a Cocos engine load. 14 metas stay absent. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const REL = 'creator-build-project/assets/bundles/region_coast';
const FILES = [
  ['board/piece_badge.png', 12745, '9dd3526a99790b6e96dc412467166a9d8e521c76b48fcb3ef8b8840b089314db'],
  ['board/piece_conch.png', 10651, '9e2401db5461a44b472017e51b95f6fd1f061a0655c46baa5717615d80144242'],
  ['board/piece_coral.png', 10461, '9b285f844f7e8e4f0aa7a77872088164a312c0f1171849a9a4975016f73d05df'],
  ['board/piece_float.png', 10050, '70b087177a7f60780f5699aafafcaaf0f25043fe56f38b113b3414885bb1ac2e'],
  ['board/piece_scallop.png', 9765, 'c2838c6e7a66788ac05c85ff738fbc99a0e0f397b4db90378e4092492bb0205f'],
  ['board/piece_star.png', 10350, '88797b7d415f7060d8ed695fdbc2fea7c2dbfea1e824eebd91fc751e48614eb7'],
  ['data/coast_layout.json', 20146, '012c075f71c787a67a6df7d38db27df17c4506c21b8a31bc5fae72a758fe47b8'],
  ['models/coast_board.glb', 244752, 'd8ca6823c8c4c1529c3eb8200c1ba007ae7adb097e2c366bc7af529c4a7970a6'],
  ['models/coast_props.glb', 164064, 'c447fd184c99c30f005ffb22ed3f0b9ce84f47c82d44b96e6272d7104bb341a9'],
  ['models/coast_reuse.glb', 66592, '3912d735e35a994dec31a282e8483531cea6e0460588e7ef16db6fcd586ab837'],
  ['models/coast_rocks.glb', 128172, '10bc46fe55f063aabe7e3ad6549664f9810a41c458a7f7e696b39d1f4b679938'],
  ['models/coast_terrain.glb', 507684, '193c98784b2c7e8f1eda526b9d82c985e9a74a96eebb2572fb61fef6124f684c'],
  ['textures/coast_palette_256.png', 2969, '5f53154ec4294e0ad40e9ff0a7c7dd1a9f131b1fc62ed1be1518f5c78ebabce1'],
  ['textures/coast_palette_sand_256.png', 3156, '10b98602ff2d711e5994e3fe7938a679a0f50c95858285005b139710dd596295'],
];
const META_DIRS = [REL, REL + '/board', REL + '/data', REL + '/models', REL + '/textures'];
assert.equal(FILES.length, 14);
const missingMetas = [];
for (const [rel, size, sha] of FILES) {
  const abs = path.join(ROOT, REL, rel);
  const buf = fs.readFileSync(abs);
  assert.equal(buf.length, size, rel);
  assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), sha, rel);
  const meta = abs + '.meta';
  assert.equal(fs.existsSync(meta), false, 'hand-written meta refused ' + rel);
  missingMetas.push(REL + '/' + rel + '.meta');
  if (rel.endsWith('.png')) assert.equal(buf.toString('ascii', 1, 4), 'PNG', rel);
  if (rel.endsWith('.glb')) {
    assert.equal(buf.toString('ascii', 0, 4), 'glTF', rel);
    assert.equal(buf.readUInt32LE(4), 2, rel + ' version');
    assert.equal(buf.readUInt32LE(8), buf.length, rel + ' length');
    const jsonLen = buf.readUInt32LE(12);
    assert.equal(buf.readUInt32LE(16), 0x4E4F534A, rel + ' json chunk');
    const doc = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
    assert.ok(Array.isArray(doc.meshes) && doc.meshes.length > 0, rel + ' meshes');
    assert.ok(Array.isArray(doc.nodes) && doc.nodes.length > 0, rel + ' nodes');
  }
}
for (const dir of META_DIRS) assert.equal(fs.existsSync(path.join(ROOT, dir + '.meta')), false, dir + '.meta');
assert.equal(fs.existsSync(path.join(ROOT, REL, 'scripts/CoastSceneLoader.ts')), false, 'divergent loader script was not copied');
assert.equal(fs.existsSync(path.join(ROOT, REL, 'scripts/CoastSceneLayout.ts')), false, 'divergent layout script was not copied');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, REL, 'data/coast_layout.json'), 'utf8'));
assert.deepEqual(layout.placement.position, [-0.6, -0.845, 21.5]);
assert.equal(layout.placement.yaw_deg, 180);
const reuse = Object.values(layout.layout).filter((e) => e && e.reuse);
const palms = reuse.filter((e) => e.mesh === 'reuse_palm_tall' || e.mesh === 'reuse_palm_lean');
assert.equal(palms.filter((e) => e.mesh === 'reuse_palm_tall').length, 2);
assert.equal(palms.filter((e) => e.mesh === 'reuse_palm_lean').length, 1);
const baked = new Set(reuse.map((e) => e.mesh));
for (const name of ['reuse_grass_a', 'reuse_grass_b', 'reuse_flowers', 'reuse_bush']) assert.ok(baked.has(name), name);

function glbDoc(rel) {
  const buf = fs.readFileSync(path.join(ROOT, REL, rel));
  return JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
}
const { createHarness } = require('../board-ui/harness.cjs');
(async () => {
  const H = createHarness();
  const P = H.load('ui/CoastBoardPieces');
  const Loader = H.load('ui/CoastSceneLoader');
  const Layout = H.load('ui/CoastSceneLayout');
  const props = H.load('world-r2/IslandPropsLayout');
  assert.equal(P.COAST_PALETTE_UUID, props.ISLAND_PROPS.paletteMaterialUuid);
  assert.equal(P.COAST_PALETTE_NAME, 'M_env_palette');
  const tall = new H.cc.Node('env_prop_palm_tall_01');
  const lean = new H.cc.Node('env_prop_palm_lean_01');
  const island = new H.cc.Node('island'); island.addChild(tall); island.addChild(lean);
  assert.equal(P.coastReuseFrom(island, 'reuse_palm_tall'), tall);
  assert.equal(P.coastReuseFrom(island, 'reuse_palm_lean'), lean);
  assert.equal(P.coastReuseFrom(island, 'reuse_grass_a'), null, 'grass is baked, not an island resolve');
  const inst = Layout.coastInstances(layout);
  const ordinary = inst.filter((i) => !(i.reuse && Layout.COAST_REUSE_SOURCES[i.mesh].from === 'island'));
  assert.equal(inst.length, 226);
  assert.equal(ordinary.length, 223, 'non-palm placements');
  const meshIds = new Set();
  function holdable(extra) { return Object.assign({ label: 'mock-not-cocos', refs: 0, isValid: true, addRef() { this.refs++; }, decRef() { this.refs--; } }, extra); }
  function prefabsFromGlb(dropName) {
    return ['models/coast_board.glb', 'models/coast_props.glb', 'models/coast_reuse.glb', 'models/coast_rocks.glb', 'models/coast_terrain.glb'].map((rel) => {
      const root = new H.cc.Node(rel);
      root.label = 'mock-not-cocos';
      for (const n of glbDoc(rel).nodes || []) {
        if (!n.name || n.mesh === undefined || n.name === dropName) continue;
        const node = new H.cc.Node(n.name);
        const r = node.addComponent(H.cc.MeshRenderer);
        r.mesh = { label: 'mock-not-cocos', name: n.name, source: rel };
        meshIds.add(r.mesh);
        root.addChild(node);
      }
      const prefab = new H.cc.Prefab();
      prefab.data = root; prefab.label = 'mock-not-cocos'; prefab.refs = 0; prefab.isValid = true;
      prefab.addRef = function () { this.refs++; }; prefab.decRef = function () { this.refs--; };
      return prefab;
    });
  }
  const layoutAsset = holdable({ json: layout });
  const tex = holdable({ name: 'coast_palette' });
  const sand = holdable({ name: 'coast_palette_sand' });
  const calls = { bundle: [], load: [], loadDir: [], ordinary: 0, palms: 0, prefabs: 0, materials: 0 };
  function install(dropName) {
    const built = prefabsFromGlb(dropName);
    H.cc.assetManager.getBundle = () => null;
    H.cc.assetManager.loadBundle = (name, cb) => { calls.bundle.push(name); cb(null, bundle); };
    const bundle = {
      label: 'mock-not-cocos',
      load(p, type, cb) { calls.load.push([p, type]); if (p === 'data/coast_layout') cb(null, layoutAsset); else if (p === 'textures/coast_palette_256/texture') cb(null, tex); else if (p === 'textures/coast_palette_sand_256/texture') cb(null, sand); else cb(Error('missing ' + p), null); },
      loadDir(dir, type, cb) { calls.loadDir.push([dir, type]); cb(null, built); },
    };
    return built;
  }
  function cloneTree(n) {
    const c = new H.cc.Node(n.name || '');
    c.label = 'mock-not-cocos';
    const r = n.getComponent && n.getComponent(H.cc.MeshRenderer);
    if (r && r.mesh) { const nr = c.addComponent(H.cc.MeshRenderer); nr.mesh = r.mesh; }
    for (const ch of n.children || []) c.addChild(cloneTree(ch));
    return c;
  }
  H.cc.instantiate = (src) => {
    if (src instanceof H.cc.Prefab) { calls.prefabs++; return cloneTree(src.data); }
    if (src && src.getComponent && src.getComponent(H.cc.MeshRenderer)) calls.ordinary++;
    else calls.palms++;
    return cloneTree(src);
  };
  H.cc.MeshRenderer.prototype.setMaterial = function (m, i = 0) {
    if (i === 0) calls.materials++;
    assert.ok(m instanceof H.cc.Material, 'setMaterial requires a Material');
    this.sharedMaterials[i] = m;
  };
  function passFor(handles) {
    return {
      getHandle: (n) => (handles[n] ? 1 : 0),
      defines: { USE_EMISSIVE_MAP: true },
      // builtin-standard v3.8.8: mainColor and emissive are linear:true; emissiveScale is not.
      properties: { mainColor: { linear: true }, emissive: { linear: true }, emissiveScale: {}, mainTexture: {} },
      rasterizerState: { cullMode: H.cc.gfx.CullMode.FRONT },
      depthStencilState: { depthTest: true, depthWrite: true, depthFunc: H.cc.gfx.ComparisonFunc.LESS_EQUAL },
      blendState: { targets: [{ blend: false, blendSrc: H.cc.gfx.BlendFactor.ONE, blendDst: H.cc.gfx.BlendFactor.ZERO }] },
    };
  }
  function uniform(pass, name) {
    const out = new H.cc.Vec4();
    pass.getUniform(pass.getHandle(name), out);
    return out;
  }
  const baseMat = new H.cc.Material();
  baseMat.name = 'M_env_palette'; baseMat.label = 'mock-not-cocos';
  baseMat.passes = [passFor({ mainTexture: 1, mainColor: 1, emissive: 1, emissiveScale: 1 })];
  const authoredAlbedo = new H.cc.Vec4(0.5, 0.4, 0.25, 1);
  baseMat.setProperty('mainColor', authoredAlbedo);
  baseMat.setProperty('emissiveScale', new H.cc.Vec3(0, 0, 0));
  const basePass = baseMat.passes[0];
  const released = new Set();
  const origDestroy = H.cc.Material.prototype.destroy;
  H.cc.Material.prototype.destroy = function () {
    if (released.has(this)) throw Error('material released twice');
    released.add(this);
    return origDestroy.call(this);
  };
  const world = new H.cc.Node('scene_root');
  const opts = () => ({ resolveReuse: (n) => P.coastReuseFrom(island, n), resolveMaterial: () => baseMat, cancelled: () => false, kitOn: () => true });
  install(null);
  assert.equal(await Loader.loadCoastScene(world, { ...opts(), kitOn: () => false }), null);
  assert.equal(calls.bundle.length, 0, 'kit off does not call assetManager');
  const handle = await Loader.loadCoastScene(world, opts());
  assert.ok(handle, 'labeled mock bundle placed every layout instance');
  assert.equal(calls.bundle.length, 1);
  assert.equal(calls.bundle[0], 'region_coast');
  assert.ok(calls.load.some((c) => c[0] === 'data/coast_layout' && c[1] === H.cc.JsonAsset));
  assert.ok(calls.load.some((c) => c[0] === 'textures/coast_palette_256/texture' && c[1] === H.cc.Texture2D));
  assert.ok(calls.load.some((c) => c[0] === 'textures/coast_palette_sand_256/texture' && c[1] === H.cc.Texture2D));
  assert.ok(calls.loadDir.some((c) => c[0] === 'models' && c[1] === H.cc.Prefab));
  assert.equal(calls.prefabs, 5, 'each GLB prefab was instantiated');
  assert.equal(calls.ordinary, 223, 'factory ran for every non-palm placement');
  assert.equal(calls.palms, 3, 'island palms were cloned from the live nodes');
  assert.equal(calls.materials, 223, 'setMaterial once per non-palm placement');
  assert.equal(handle.planned, 226);
  assert.equal(handle.geometryCreated, 223);
  assert.equal(handle.materialAssigned, 223);
  assert.equal(handle.placed, 135);
  assert.equal(handle.reusePlaced, 91);
  assert.equal(handle.engineLoaded, false, 'class shape is not a Creator render pass');
  assert.equal(handle.engineEvidence, 'unavailable');
  assert.equal(handle.typesAccepted, false, 'explicit mock assets are not accepted');
  assert.equal(Loader.coastMeshTypeAccepted({ label: 'mock-not-cocos', constructor: { name: 'Mesh' }, renderingSubMeshes: [{}], struct: { primitives: [{}] }, hash: 1 }), false);
  assert.equal(Loader.coastAssetTypeAccepted({ constructor: { name: 'Prefab' }, nativeUrl: 'db://region_coast/models/coast_board', _uuid: 'u', refCount: 1 }), false);
  const legalPrefab = new H.cc.Prefab(); legalPrefab.nativeUrl = '';
  const legalJson = new H.cc.JsonAsset(); legalJson.nativeUrl = '';
  assert.equal(Loader.coastAssetTypeAccepted(legalPrefab), true, 'Prefab with empty nativeUrl is a supported type');
  assert.equal(Loader.coastAssetTypeAccepted(legalJson), true, 'JsonAsset with empty nativeUrl is a supported type');
  legalPrefab.label = 'mock-not-cocos';
  assert.equal(Loader.coastAssetTypeAccepted(legalPrefab), false, 'explicit mock Prefab fails evidence');
  const plain = new H.cc.Material();
  plain.name = 'plain-asset';
  plain.passes = [new H.cc.Pass(passFor({ mainColor: 1, emissive: 1, emissiveScale: 1 }))];
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...a) => { warns.push(a.map(String).join(' ')); origWarn.apply(console, a); };
  plain.overridePipelineStates({ blendState: { targets: [{ blend: true, blendSrc: H.cc.gfx.BlendFactor.SRC_ALPHA, blendDst: H.cc.gfx.BlendFactor.ONE_MINUS_SRC_ALPHA }] } }, 0);
  console.warn = origWarn;
  assert.equal(plain.passes[0].blendState.targets[0].blend, false, 'Material.overridePipelineStates is warnID(16371) and leaves the pass alone');
  assert.ok(warns.some((line) => line.includes('16371')), warns.join('\n'));
  plain._props.emissive = new H.cc.Vec4(1, 0, 0, 1);
  assert.equal(plain.getProperty('emissive').x, 1, 'getProperty sees the cached write');
  const uploaded = uniform(plain.passes[0], 'emissive');
  assert.equal(uploaded.x, 0); assert.equal(uploaded.y, 0); assert.equal(uploaded.z, 0, 'cached emissive does not change the pass uniform');
  let geo = 0, grass = 0, sandRocks = 0, lamps = 0, foams = 0, inners = 0, lines = 0, pools = 0, opaque = 0;
  let lampMat = null;
  const slabs = [];
  handle.root.walk((n) => {
    if (n.name === 'slab_0') slabs.push([n.position.x, n.position.y, n.position.z]);
    if (n.name === 'reuse_grass_a') grass++;
    const r = n.getComponent(H.cc.MeshRenderer);
    if (!r || !r.mesh) return;
    assert.equal(r.mesh.label, 'mock-not-cocos');
    assert.ok(meshIds.has(r.mesh), 'renderer mesh is the GLB template geometry');
    const mat = r.getMaterial(0);
    assert.ok(mat instanceof H.cc.Material);
    geo++;
    const pass = mat.passes[0];
    const color = uniform(pass, 'mainColor'), emit = uniform(pass, 'emissive');
    const blend = pass.blendState.targets[0], depthWrite = pass.depthStencilState.depthWrite;
    if (n.name === 'beacon_lamp') {
      lamps++; if (!lampMat) lampMat = mat; assert.equal(mat, lampMat, 'one clone per emissive key');
      assert.ok(mat instanceof H.cc.MaterialInstance); assert.notEqual(mat, baseMat);
      assert.ok(Math.abs(emit.x - Loader.COAST_EMISSIVE[0] * Loader.COAST_EMISSIVE[0]) < 1e-6);
      assert.ok(Math.abs(emit.y - Loader.COAST_EMISSIVE[1] * Loader.COAST_EMISSIVE[1]) < 1e-6);
      assert.ok(Math.abs(emit.z - Loader.COAST_EMISSIVE[2] * Loader.COAST_EMISSIVE[2]) < 1e-6);
      assert.ok(Math.abs(emit.w - Loader.COAST_EMISSIVE[3]) < 1e-6, 'emissive W is not squared');
      assert.ok(Math.abs(emit.y - Loader.COAST_EMISSIVE[1]) > 1e-4, 'former raw-sRGB emissive readback must not match the uniform');
      assert.equal(pass.defines.USE_EMISSIVE_MAP, false);
      const scale = uniform(pass, 'emissiveScale');
      assert.ok(Math.abs(scale.y - Loader.COAST_EMISSIVE_SCALE[1]) < 1e-6);
      assert.ok(Math.abs(scale.y - Loader.COAST_EMISSIVE_SCALE[1] * Loader.COAST_EMISSIVE_SCALE[1]) > 1e-4, 'emissiveScale is not linear:true');
      assert.ok(Math.abs(color.x - authoredAlbedo.x * authoredAlbedo.x) < 1e-6);
      assert.equal(color.w, 1); assert.equal(blend.blend, false); assert.equal(depthWrite, true);
      assert.ok(Math.abs(mat.getProperty('emissive').y - Loader.COAST_EMISSIVE[1]) < 1e-6, 'getProperty keeps the authored sRGB value');
    }
    if (n.name === 'foam') { foams++; assert.ok(mat instanceof H.cc.MaterialInstance); assert.ok(Math.abs(color.x - authoredAlbedo.x * authoredAlbedo.x) < 1e-6); assert.ok(Math.abs(color.y - authoredAlbedo.y * authoredAlbedo.y) < 1e-6); assert.ok(Math.abs(color.z - authoredAlbedo.z * authoredAlbedo.z) < 1e-6); assert.equal(color.w, 0.92); assert.ok(Math.abs(mat.getProperty('mainColor').x - authoredAlbedo.x) < 1e-6); assert.equal(blend.blend, true); assert.equal(depthWrite, false); assert.equal(blend.blendSrc, H.cc.gfx.BlendFactor.SRC_ALPHA); assert.equal(blend.blendDst, H.cc.gfx.BlendFactor.ONE_MINUS_SRC_ALPHA); assert.ok(Math.abs(emit.y - Loader.COAST_EMISSIVE[1] * Loader.COAST_EMISSIVE[1]) < 1e-6); }
    if (n.name === 'foam_inner') { inners++; assert.ok(Math.abs(color.x - authoredAlbedo.x * authoredAlbedo.x) < 1e-6); assert.equal(color.w, 0.55); assert.equal(blend.blend, true); assert.equal(depthWrite, false); assert.ok(Math.abs(emit.z - Loader.COAST_EMISSIVE[2] * Loader.COAST_EMISSIVE[2]) < 1e-6); }
    if (n.name === 'beacon_line') { lines++; assert.equal(color.w, 0.9); assert.ok(Math.abs(color.y - authoredAlbedo.y * authoredAlbedo.y) < 1e-6); assert.equal(blend.blend, true); assert.equal(depthWrite, false); assert.ok(Math.abs(emit.w - 1) < 1e-6); assert.equal(pass.defines.USE_EMISSIVE_MAP, false); }
    if (n.name === 'sidepool') { pools++; assert.ok(mat instanceof H.cc.MaterialInstance); assert.ok(Math.abs(color.x - authoredAlbedo.x * authoredAlbedo.x) < 1e-6); assert.ok(Math.abs(color.z - authoredAlbedo.z * authoredAlbedo.z) < 1e-6); assert.equal(color.w, 0.7); assert.equal(blend.blend, true); assert.equal(depthWrite, false); assert.equal(emit.x, 0); assert.equal(emit.y, 0); assert.equal(emit.z, 0); }
    if (n.name === 'slab_0') { opaque++; assert.ok(!(mat instanceof H.cc.MaterialInstance)); assert.notEqual(mat, baseMat); assert.ok(Math.abs(color.x - authoredAlbedo.x * authoredAlbedo.x) < 1e-6); assert.equal(color.w, 1); assert.equal(blend.blend, false); assert.equal(depthWrite, true); assert.equal(emit.x, 0); assert.equal(emit.y, 0); assert.equal(emit.z, 0); assert.equal(mat.getProperty('mainTexture'), tex); }
    if (n.parent && n.parent.name === 'reuse_rock_s0') { sandRocks++; assert.equal(mat.getProperty('mainTexture'), sand); }
    if (n.parent && n.parent.name === 'reuse_grass_a') assert.equal(mat.getProperty('mainTexture'), tex);
  });
  assert.equal(geo, 223);
  assert.equal(grass, 25);
  assert.equal(sandRocks, 5);
  assert.equal(lamps, 2); assert.equal(foams, 1); assert.equal(inners, 1); assert.equal(lines, 1); assert.equal(pools, 1);
  assert.equal(lamps + foams + inners + lines + pools, 6);
  assert.equal(opaque, 6);
  assert.equal(baseMat.passes[0], basePass, 'island template pass was not replaced');
  assert.equal(basePass.blendState.targets[0].blend, false);
  assert.equal(basePass.depthStencilState.depthWrite, true);
  assert.ok(Math.abs(baseMat.getProperty('mainColor').x - authoredAlbedo.x) < 1e-6, 'shared template keeps authored sRGB, not the GPU uniform');
  assert.equal(baseMat.getProperty('mainColor').w, 1);
  assert.equal(baseMat.getProperty('emissiveScale').x, 0);
  const twice = new H.cc.Material();
  twice.passes = [new H.cc.Pass(passFor({ mainColor: 1, emissive: 1, emissiveScale: 1 }))];
  twice.setProperty('mainColor', authoredAlbedo);
  twice.setProperty('emissive', new H.cc.Vec4(Loader.COAST_EMISSIVE[0], Loader.COAST_EMISSIVE[1], Loader.COAST_EMISSIVE[2], Loader.COAST_EMISSIVE[3]));
  twice.setProperty('emissiveScale', new H.cc.Vec3(0.8, 0.8, 0.8));
  const onceRgb = uniform(twice.passes[0], 'mainColor');
  const onceEmit = uniform(twice.passes[0], 'emissive');
  const onceScale = uniform(twice.passes[0], 'emissiveScale');
  assert.ok(Math.abs(onceEmit.y - 0.72) > 1e-4, 'former emissive readback (uniform === 0.72) fails');
  assert.ok(Math.abs(onceEmit.y - 0.72 * 0.72) < 1e-6);
  assert.ok(Math.abs(onceEmit.w - 1) < 1e-6);
  assert.ok(Math.abs(onceScale.x - 0.8) < 1e-6);
  assert.ok(Math.abs(onceScale.x - 0.64) > 1e-4);
  twice.setProperty('mainColor', new H.cc.Vec4(onceRgb.x, onceRgb.y, onceRgb.z, 0.92));
  const doubled = uniform(twice.passes[0], 'mainColor');
  assert.ok(Math.abs(doubled.x - onceRgb.x) > 1e-4, 'feeding the linear uniform back into setProperty squares RGB again');
  assert.ok(Math.abs(doubled.x - onceRgb.x * onceRgb.x) < 1e-6);
  assert.ok(Math.abs(doubled.w - 0.92) < 1e-6);
  assert.deepEqual(slabs, inst.filter((i) => i.mesh === 'slab_0').map((i) => i.position));
  assert.equal(tall.isValid, true, 'dispose must not destroy the island palm');
  const clonesBefore = released.size;
  handle.dispose();
  handle.dispose();
  assert.ok(released.size > clonesBefore, 'owned clones are released');
  assert.equal(handle.root.isValid, false);
  assert.equal(tall.isValid, true);
  assert.equal(baseMat.isValid, true, 'caller material is not destroyed');
  assert.equal(layoutAsset.refs, 0);
  assert.equal(tex.refs, 0);
  assert.equal(sand.refs, 0);
  calls.ordinary = 0; calls.materials = 0; calls.palms = 0; calls.prefabs = 0;
  install('slab_0');
  assert.equal(await Loader.loadCoastScene(world, opts()), null);
  assert.ok(calls.ordinary < 223);
  install(null);
  assert.equal(await Loader.loadCoastScene(world, { ...opts(), resolveMaterial: () => null }), null);
  assert.equal(await Loader.loadCoastScene(world, { ...opts(), resolveReuse: () => null }), null);
  assert.equal(await Loader.loadCoastScene(world, { ...opts(), cancelled: () => true }), null);
  assert.equal(await Loader.loadCoastScene(null, opts()), null);
  const blind = new H.cc.Material();
  blind.name = 'M_env_palette'; blind.passes = [passFor({ mainTexture: 1 })]; blind.props = {};
  const noted = [];
  const origErr = console.error;
  console.error = (...a) => { noted.push(a.map(String).join(' ')); origErr.apply(console, a); };
  const beforeBlind = released.size;
  assert.equal(await Loader.loadCoastScene(world, { ...opts(), resolveMaterial: () => blind }), null);
  console.error = origErr;
  assert.ok(noted.some((line) => line.includes('[QF_COAST]') && (line.includes('mainColor') || line.includes('emissive'))), noted.join('\n'));
  assert.ok(released.size >= beforeBlind, 'failed mount releases the clones it created');
  assert.equal(blind.destroyed, undefined);
  let arm = false, asks = 0;
  const beforeCancel = released.size;
  assert.equal(await Loader.loadCoastScene(world, { ...opts(), resolveMaterial: () => { if (++asks > 4) arm = true; return baseMat; }, cancelled: () => arm }), null);
  assert.ok(released.size > beforeCancel);
  function refAsset(obj) { obj.nativeUrl = ''; obj.refs = 0; obj.isValid = true; obj.addRef = function () { this.refs++; }; obj.decRef = function () { this.refs--; }; return obj; }
  function legalPrefabs() {
    return ['models/coast_board.glb', 'models/coast_props.glb', 'models/coast_reuse.glb', 'models/coast_rocks.glb', 'models/coast_terrain.glb'].map((rel) => {
      const root = new H.cc.Node(rel);
      for (const n of glbDoc(rel).nodes || []) {
        if (!n.name || n.mesh === undefined) continue;
        const node = new H.cc.Node(n.name);
        const r = node.addComponent(H.cc.MeshRenderer);
        r.mesh = new H.cc.Mesh();
        root.addChild(node);
      }
      return refAsset(Object.assign(new H.cc.Prefab(), { data: root }));
    });
  }
  const legalJsonAsset = refAsset(Object.assign(new H.cc.JsonAsset(), { json: layout }));
  const legalTex = refAsset(new H.cc.Texture2D());
  const legalSand = refAsset(new H.cc.Texture2D());
  assert.equal(legalJsonAsset.nativeUrl, '');
  assert.equal(legalPrefabs()[0].nativeUrl, '');
  function useBundle(jsonAsset, texAsset, sandAsset, built, tag) {
    H.cc.assetManager.getBundle = () => null;
    H.cc.assetManager.loadBundle = (_name, cb) => cb(null, { load(p, _type, cb2) { if (p === 'data/coast_layout') cb2(null, jsonAsset); else if (p === 'textures/coast_palette_256/texture') cb2(null, texAsset); else if (p === 'textures/coast_palette_sand_256/texture') cb2(null, sandAsset); else cb2(Error('missing ' + p), null); }, loadDir(_d, _t, cb2) { cb2(null, built); }, label: tag });
    H.cc.assetManager.loadAny = (_req, ...rest) => { const cb = [...rest].reverse().find((f) => typeof f === 'function'); cb(null, baseMat); };
  }
  const built = legalPrefabs();
  useBundle(legalJsonAsset, legalTex, legalSand, built, undefined);
  const ctx = { parent: new H.cc.Node('coast-parent'), selection: { provider: 'r5', stageId: 'r06-coast-01' }, token: { cancelled: false } };
  delete globalThis.__qfCoastBoardKit;
  const contract = await Loader.loadCoastScene(world, opts());
  assert.equal(contract.typesAccepted, true, 'empty nativeUrl still counts as a typed Prefab/JsonAsset');
  assert.equal(contract.engineEvidence, 'unavailable');
  assert.ok(contract.root.isValid);
  contract.dispose();
  const scene = H.cc.director.getScene();
  scene.addChild(tall); scene.addChild(lean);
  await assert.rejects(() => P.createCoastBoardBackground(ctx), (e) => e instanceof P.CoastEntryRejected && e.reason === 'coast-runtime-evidence-unavailable');
  assert.equal(ctx.parent.getChildByName('region_coast_root'), null, 'typed assets are not left mounted as a coast board');
  for (const asset of [legalJsonAsset, legalTex, legalSand, ...built]) asset.label = 'mock-not-cocos';
  for (const prefab of built) prefab.data.walk((n) => { const r = n.getComponent(H.cc.MeshRenderer); if (r && r.mesh) r.mesh.label = 'mock-not-cocos'; });
  useBundle(legalJsonAsset, legalTex, legalSand, built, 'mock-not-cocos');
  await assert.rejects(() => P.createCoastBoardBackground(ctx), (e) => e instanceof P.CoastEntryRejected && e.reason === 'coast-contract-not-accepted');
  assert.equal(ctx.parent.getChildByName('region_coast_root'), null);
  console.log('coast-resource-layer: PASS', JSON.stringify({
    files: FILES.length,
    missingMetas: missingMetas.length,
    folderMetasAlsoMissing: META_DIRS.length,
    ordinaryFactoryCalls: 223,
    materialAssignments: 223,
    geometryPresent: 223,
    engineLoaded: false,
    engineEvidence: 'unavailable',
    mockLabeled: true,
    zipBytesAreNotWeChatBudget: true,
  }));
})().catch((e) => { console.error(e); process.exit(1); });
