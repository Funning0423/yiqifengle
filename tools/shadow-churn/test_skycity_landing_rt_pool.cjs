'use strict';
/** b20 skycity landing-board RT pool.
 *  Mac ced9972f: pin made skycity.board-background cre/des ~0, but skycity.landing-board (16 samples)
 *  stayed cre/des 308–399 (avg 389.4), DepthStencil on every sample, uploads avg 83.4/s, anonymous `?:N`.
 *  Mac 186b34e7: the attachment-only pool dropped landing from sample 2 to uploads median 0 and named
 *  DepthStencil churn 0, but cre/des stayed median 112/s (108–114, zero_frac 0). Those creates are under
 *  the probe's 256KB line, so the old key (COLOR/DEPTH and size >= 1) never kept them.
 *  Gate: depth + color, a sampled image, a 16×16 usage-none image, and a 0×0 pass dummy, each destroyed
 *  and created for many frames, stay at one native create and 0 native destroys. The GPU probe is wrapped
 *  outside the pool and then the pool re-installs outside it; probe cre/des stay at the first real
 *  allocate. External images still hit the device.
 *  Mac 606f434e: exact keys still left sample2+ at cre/des median 114/s (uploads 0, no ≥256KB TEX line, live 384).
 *  A texture view (info.texture set, no width) and a sub-256KB image whose size changes every frame must also
 *  stay at one native create. A size change with no Texture.resize stays a real allocate. Do not loosen the
 *  N=600 residency gate. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require(process.env.QF_TYPESCRIPT_MODULE || 'typescript');
const ROOT = path.join(__dirname, '../..');
const FRAMES = 40;
const DEPTH = { usage: 0x20, format: 55, width: 1170, height: 2532, samples: 1, type: 0, flags: 0, depth: 1, layerCount: 1, levelCount: 1 };
const COLOR = { usage: 0x10, format: 35, width: 1170, height: 2532, samples: 1, type: 0, flags: 0, depth: 1, layerCount: 1, levelCount: 1 };

function load() {
  const handlers = {};
  let native = 0, realDestroys = 0;
  const device = {
    createTexture(info) {
      native++;
      const tex = { width: info.width | 0, height: info.height | 0, dead: false, destroy() { this.dead = true; realDestroys++; } };
      if (!info.__noResize) tex.resize = function (w, h) { this.width = w | 0; this.height = h | 0; };
      return tex;
    },
  };
  const director = {
    on(ev, f) { (handlers[ev] = handlers[ev] || []).push(f); },
    off(ev, f) { handlers[ev] = (handlers[ev] || []).filter(x => x !== f); },
    root: { device, pipeline: null, windows: [{ renderWindowId: 0 }] },
  };
  const any = new Proxy(function () {}, { get: (t, k) => k === 'prototype' ? {} : any, apply: () => any, construct: () => ({}) });
  const cc = new Proxy({ director, Director: { EVENT_BEFORE_DRAW: 'bd', EVENT_AFTER_DRAW: 'ad' }, assetManager: { assets: new Map(), bundles: new Map() } }, { get: (t, k) => k in t ? t[k] : any });
  const req = s => s === 'cc' ? cc : String(s).includes('DebugQuery') ? { debugSearch: () => '' } : String(s).includes('CameraPose') ? { cameraWriteHook: {} } : any;
  const opt = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } };
  const rigJs = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'creator-build-project/assets/scripts/render/RoomLightingRig.ts'), 'utf8'), opt).outputText;
  const camJs = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'creator-build-project/assets/scripts/region/CamTraceLog.ts'), 'utf8'), opt).outputText;
  const ctx = { module: { exports: {} }, exports: {}, console, performance: { now: () => 0 }, setTimeout, clearTimeout, globalThis: {}, require: req };
  ctx.module.exports = ctx.exports;
  vm.runInNewContext(rigJs, ctx);
  const Rig = ctx.exports;
  const camBox = { module: { exports: {} }, exports: {} };
  camBox.module.exports = camBox.exports;
  vm.runInNewContext(camJs, Object.assign({}, ctx, camBox));
  const Cam = camBox.exports;
  return {
    Rig, Cam, device, native: () => native, destroyed: () => realDestroys,
    tick: () => { for (const f of (handlers.bd || []).slice()) f(); },
  };
}

const { Rig, Cam, device, native, destroyed, tick } = load();
assert.equal(Rig.ensureRtPool(undefined), false, 'no device is a no-op');
tick();
assert.equal(device.createTexture.__qfRtOuter, true, 'pool is the outer createTexture');
assert.equal(Cam.gpuWrapDevice(device), true, 'probe wraps the device once');
assert.notEqual(device.createTexture.__qfRtOuter, true, 'probe sat outside the pool');
tick();
assert.equal(device.createTexture.__qfRtOuter, true, 'BEFORE_DRAW puts the pool back outside the probe');

const G = Cam.gpuProbe;
G.creates = 0; G.destroys = 0; G.uploads = 0; G.upBytes = 0; G.live.clear(); G.liveBytes = 0; G.churn.clear();
const n0 = native();
for (let i = 0; i < FRAMES; i++) {
  const d = device.createTexture(DEPTH), c = device.createTexture(COLOR);
  assert.equal(d.dead, false); assert.equal(c.dead, false);
  d.destroy(); c.destroy();
  assert.equal(d.dead, false, 'pooled depth is not destroyed');
  assert.equal(c.dead, false, 'pooled color is not destroyed');
}
assert.equal(native() - n0, 2, 'one native depth + one native color across ' + FRAMES + ' frames');
assert.equal(destroyed(), 0, 'no native destroy while the hot set fits');
assert.equal(G.creates, 2, 'probe counts the first allocate only');
assert.equal(G.destroys, 0, 'probe does not count a recycle as destroy');
assert.equal(G.uploads, 2, 'create-driven uploads stop after the first allocate');
assert.equal(G.churn.size, 0, 'no anonymous churn while recycling');

const pairA = device.createTexture(DEPTH), pairB = device.createTexture(DEPTH);
assert.notStrictEqual(pairA, pairB, 'two live attachments of one key do not alias');
pairA.destroy(); pairB.destroy();

const s0 = native(), sd0 = destroyed(), g0 = G.creates, gd0 = G.destroys;
let sampled = null;
for (let i = 0; i < 10; i++) {
  const t = device.createTexture({ usage: 0x4, format: 35, width: 64, height: 64, flags: 0 });
  if (!sampled) sampled = t; else assert.strictEqual(t, sampled, 'same sampled size is the cached object');
  t.destroy();
  assert.equal(t.dead, false, 'sampled image is recycled');
}
assert.equal(native() - s0, 1, 'sampled textures of one size are pooled');
assert.equal(destroyed() - sd0, 0, 'sampled recycle is not a native destroy');
assert.equal(G.creates - g0, 1, 'probe counts the sampled image once');
assert.equal(G.destroys - gd0, 0, 'probe does not count a sampled recycle');

const small0 = native(), smallD = destroyed(), gs = G.creates, gsd = G.destroys;
for (let i = 0; i < FRAMES; i++) {
  const img = device.createTexture({ width: 16, height: 16 });
  const dummy = device.createTexture({});
  img.destroy(); dummy.destroy();
  assert.equal(img.dead, false, '16x16 usage-none image stays pooled');
  assert.equal(dummy.dead, false, '0x0 pass dummy stays pooled');
}
assert.equal(native() - small0, 2, '16x16 + empty descriptor are two native creates, then hits');
assert.equal(destroyed() - smallD, 0, 'small textures are not destroyed while hot');
assert.equal(G.creates - gs, 2, 'probe counts each small texture once');
assert.equal(G.destroys - gsd, 0, 'probe does not count small recycles');

const ext = device.createTexture({ usage: 0x10, format: 35, width: 32, height: 32, flags: 0x8 });
const nExt = native();
ext.destroy();
assert.equal(ext.dead, true, 'external color is not pooled');
assert.equal(native(), nExt, 'external destroy does not allocate');

const z0 = native();
const z = device.createTexture({ usage: 0x20, format: 55, width: 512, height: 512, samples: 1, type: 0, flags: 0 });
z.destroy();
const z2 = device.createTexture({ usage: 0x20, format: 55, width: 512, height: 512, samples: 1, type: 0, flags: 0 });
assert.equal(native() - z0, 1, 'a second size is one native create, then a hit');
assert.strictEqual(z2, z);

const occ = Rig.rtPoolOccupancy();
const c0 = native(), d0 = destroyed();
const made = [];
for (let i = 0; i < 33; i++) made.push(device.createTexture({ usage: 0x20, format: 55, width: 1000 + i, height: 8, samples: 1, type: 0, flags: 0 }));
assert.equal(native() - c0, 33, 'distinct sizes miss the pool');
for (let i = 0; i < made.length; i++) made[i].destroy();
assert.equal(destroyed() - d0, occ + 33 - Rig.RT_POOL_CAP, 'cap evicts the oldest with the real destroy');
assert.equal(made[0].dead, true, 'oldest of the overflow batch is evicted');
assert.equal(made[32].dead, false, 'newest stays pooled');
const back = device.createTexture({ usage: 0x20, format: 55, width: 1032, height: 8, samples: 1, type: 0, flags: 0 });
assert.strictEqual(back, made[32]);
assert.equal(native() - c0, 33, 'reusing the newest size does not allocate');

const huge0 = destroyed();
const huge = device.createTexture({ usage: 0x20, format: 55, width: 4000, height: 4000, samples: 1, type: 0, flags: 0 });
huge.destroy();
assert.equal(huge.dead, true, 'an attachment above the byte cap is destroyed');
assert.equal(destroyed() - huge0, 1);
const huge2 = device.createTexture({ usage: 0x20, format: 55, width: 4000, height: 4000, samples: 1, type: 0, flags: 0 });
assert.notStrictEqual(huge2, huge, 'over-cap textures are not reused');
huge2.destroy();

assert.notEqual(Rig.rtPoolKey({ usage: 0x4, width: 1024, height: 1024, format: 35 }), '', 'sampled-only key is pooled');
assert.equal(
  Rig.rtPoolKey({ usage: 0x4, width: 64, height: 64, format: 35, flags: 0 }),
  Rig.rtPoolKey({ usage: 0x4, width: 64, height: 64, format: 35, samples: 1, type: 1, depth: 1, layerCount: 1, levelCount: 1, flags: 0 }),
  'omitted samples/type/mips match the engine defaults',
);
assert.equal(Rig.rtPoolKey({ samples: 0, width: 4, height: 4 }), Rig.rtPoolKey({ width: 4, height: 4 }), 'samples 0 matches omitted');
assert.equal(Rig.rtPoolKey({ type: 1, width: 4, height: 4 }), Rig.rtPoolKey({ width: 4, height: 4 }), 'TEX2D matches omitted type');
assert.notEqual(Rig.rtPoolKey({ type: 0, width: 4, height: 4 }), Rig.rtPoolKey({ width: 4, height: 4 }), 'explicit TEX1D stays distinct');
assert.notEqual(Rig.rtPoolKey({}), '', 'empty descriptor (0x0 pass dummy) is pooled');
assert.equal(Rig.rtPoolKey({ texture: {}, usage: 0x10, width: 8, height: 8 }), '', 'texture view is not an image key');
{ const baseKey = {};
  assert.notEqual(Rig.rtViewKey({ texture: baseKey, format: 35 }), '', 'texture view has its own key');
  assert.equal(
    Rig.rtViewKey({ texture: baseKey, format: 35 }),
    Rig.rtViewKey({ texture: baseKey, format: 35, type: 1, baseLevel: 0, levelCount: 1, baseLayer: 0, layerCount: 1, basePlane: 0, planeCount: 1 }),
    'omitted view range matches the engine defaults',
  ); }
{ const b1 = {}, b2 = {}; assert.notEqual(Rig.rtViewKey({ texture: b1, format: 35 }), Rig.rtViewKey({ texture: b2, format: 35 }), 'two bases do not share a view'); }
assert.notEqual(Rig.rtPoolKey(DEPTH), '', 'depth attachment key is pooled');
assert.equal(Rig.rtPoolKey({ usage: 0x10, width: 8, height: 8, flags: 0x4 }), '', 'external flag is not pooled');
assert.equal(Rig.pinShadowResidency({ numVertices: () => 1, vertexName: () => 'Bloom0', getTraits: () => ({ residency: 0 }) }), 0);
{ const traits = [{ residency: 0 }, { residency: 0 }];
  assert.equal(Rig.pinShadowResidency({ numVertices: () => 2, vertexName: (v) => ['CopyColor', 'Bloom0'][v], getTraits: (v) => traits[v] }), 1);
  assert.deepEqual(traits.map((t) => t.residency), [2, 0], 'unnamed MANAGED vertex is pinned; Bloom0 stays MANAGED'); }
{ let released = 0; const dt = new Map([['Gone', { release() { released++; } }], ['Null', { release() { released++; } }], ['Keep', { release() {} }]]);
  assert.equal(Rig.releaseOrphans({ find: (n) => n === 'Keep' ? 1 : n === 'Null' ? null : 4294967295 }, dt), 2);
  assert.equal(released, 2); assert.equal(dt.has('Gone'), false); assert.equal(dt.has('Null'), false); assert.equal(dt.has('Keep'), true); }

const base = device.createTexture({ usage: 0x4, format: 35, width: 32, height: 32, flags: 0 });
const nView = native(), dView = destroyed(), gView = G.creates, gdView = G.destroys;
let view = null;
for (let i = 0; i < FRAMES; i++) {
  const v = device.createTexture({ texture: base, type: 1, format: 35, baseLevel: 0, levelCount: 1 });
  if (!view) view = v; else assert.strictEqual(v, view, 'same view range is the cached object');
  v.destroy();
  assert.equal(v.dead, false, 'pooled view is not destroyed');
}
assert.equal(native() - nView, 1, 'one native view across ' + FRAMES + ' frames');
assert.equal(destroyed() - dView, 0, 'view recycle is not a native destroy');
assert.equal(G.creates - gView, 1, 'probe counts the view once');
assert.equal(G.destroys - gdView, 0, 'probe does not count a view recycle');
const liveA = device.createTexture({ texture: base, format: 35, baseLevel: 0, levelCount: 1 });
const liveB = device.createTexture({ texture: base, format: 35, baseLevel: 0, levelCount: 1 });
assert.notStrictEqual(liveA, liveB, 'two live views of one range do not alias');
liveA.destroy(); liveB.destroy();
const mip = device.createTexture({ texture: base, format: 35, baseLevel: 1, levelCount: 1 });
assert.notStrictEqual(mip, liveA, 'a different mip is a different view');
mip.destroy();
const capped = [];
for (let i = 0; i < Rig.RT_VIEW_CAP + 1; i++) capped.push(device.createTexture({ texture: base, format: 35, baseLevel: 100 + i, levelCount: 1 }));
for (let i = 0; i < capped.length; i++) capped[i].destroy();
assert.equal(capped[0].dead, true, 'oldest view is evicted at the view cap');
assert.equal(capped[capped.length - 1].dead, false, 'newest view stays pooled');

const nLoose = native(), dLoose = destroyed(), gLoose = G.creates, gdLoose = G.destroys;
let loose = null;
for (let i = 0; i < FRAMES; i++) {
  const w = 16 + (i % 5);
  const t = device.createTexture({ usage: 0x4, format: 35, width: w, height: 8, flags: 0 });
  if (!loose) loose = t; else assert.strictEqual(t, loose, 'sub-256KB size change resizes the cached object');
  assert.equal(t.width, w, 'resize reports the requested width');
  t.destroy();
  assert.equal(t.dead, false, 'resized image stays pooled');
}
assert.equal(native() - nLoose, 1, 'a changing sub-256KB size is one native create');
assert.equal(destroyed() - dLoose, 0, 'resize is not a native destroy');
assert.equal(G.creates - gLoose, 1, 'probe counts the resized image once');
assert.equal(G.destroys - gdLoose, 0, 'probe does not count a resize recycle');
const bigA = device.createTexture({ usage: 0x10, format: 35, width: 1024, height: 512, flags: 0 });
bigA.destroy();
const nBig = native();
const bigB = device.createTexture({ usage: 0x10, format: 35, width: 1024, height: 256, flags: 0 });
assert.notStrictEqual(bigB, bigA, 'a size change at or above 256KB is not loose-resized');
assert.equal(native() - nBig, 1);
bigB.destroy();
const nBare = native();
const bare1 = device.createTexture({ usage: 0x4, format: 99, width: 12, height: 12, flags: 0, __noResize: 1 });
bare1.destroy();
const bare2 = device.createTexture({ usage: 0x4, format: 99, width: 13, height: 12, flags: 0, __noResize: 1 });
assert.notStrictEqual(bare2, bare1, 'without Texture.resize a size change allocates');
assert.equal(bare1.width, 12, 'a texture with no resize keeps its size');
assert.equal(bare2.dead, false);
assert.equal(native() - nBare, 2);
bare2.destroy();

const evidence = {
  model: 'skycity-landing-rt-pool',
  frames: FRAMES,
  cap: Rig.RT_POOL_CAP,
  byteCap: Rig.RT_POOL_BYTES,
  nativeCreatesForDepthAndColor: 2,
  nativeDestroysWhileHot: 0,
  probeCreates: 2,
  probeDestroys: 0,
  probeUploads: 2,
  sampledNativeCreates: 1,
  smallNativeCreates: 2,
  viewNativeCreates: 1,
  looseNativeCreates: 1,
  mac606f434e: {
    commit: '606f434eb6289aa03585165ee9f76aff775fa504',
    feature: '968ab266c4e401e0cac35c5e3efb9b1aab33def2',
    phase: 'skycity.landing-board',
    from2: { n: 15, creAvg: 112.8, creMedian: 114, desMedian: 114, zeroFrac: 0, uploadsMedian: 0, uploadsMax: 0 },
    all: { n: 16, creAvg: 112.1, creMedian: 114, desMedian: 114, zeroFrac: 0, uploadsMedian: 0, uploadsMax: 0 },
    live: 384,
    texDetailDuringLanding: 0,
    steadyPhase: 'skycity.board-background',
    steadySamples: 85,
    steadyZeroFrac: 0.988,
    steadyCreAvg: 0.4,
    packageProbeKept: { total: 23600616, main: 1874614 },
  },
  macBefore: {
    commit: 'ced9972fb7917119baa7220c783f4dab40019ab5',
    phase: 'skycity.landing-board',
    samples: 16,
    creMin: 308,
    creMax: 399,
    creAvg: 389.4,
    zeroFrac: 0,
    uploadsAvg: 83.4,
    uploadsMax: 87,
    uploadMBMax: 34.5,
    depthStencilChurnRows: 16,
    namedSceneColorRows: 0,
    steadyPhase: 'skycity.board-background',
    steadySamples: 73,
    steadyZeroFrac: 0.986,
    steadyCreAvg: 1.1,
  },
  mac186b34e7: {
    commit: '186b34e7f627c3f15ac31c3c5b2c5b30a5d7c015',
    feature: 'b45315eae7a0c49763a6afb4f974b88816c1d560',
    phase: 'skycity.landing-board',
    from2: { n: 15, creMin: 108, creMax: 114, creAvg: 112.3, creMedian: 112, desMedian: 112, zeroFrac: 0, uploadsMedian: 0, uploadsMax: 0, depthStencilChurnRows: 0 },
    all: { n: 16, creMin: 56, creAvg: 108.8, creMedian: 112, desMedian: 112, zeroFrac: 0, uploadsMedian: 0, uploadsMax: 3 },
    steadyPhase: 'skycity.board-background',
    steadySamples: 79,
    steadyZeroFrac: 0.975,
    steadyCreAvg: 1.1,
    steadyCreMax: 78,
    packageProbeKept: { total: 23600600, main: 1874614 },
  },
  note: 'Exact-key pool plus texture views (base id + subresource) plus sub-256KB resize when Texture.resize exists. A hit returns the same object and the probe does not count it. External images and a size change with no resize still allocate. Mac 606f434e still failed landing (from2 cre/des median 114, uploads 0, TEX lines 0, live 384). Board-background zero_frac was 0.988. Mac must re-measure: landing from sample 2 cre and des median <= 2/s (ideally 0), and the per-second small= histogram if any remainder is left.',
};
const evDir = path.join(ROOT, 'docs/r5/b20-hotfix/evidence');
fs.mkdirSync(evDir, { recursive: true });
fs.writeFileSync(path.join(evDir, 'skycity-landing-rt.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log('PASS skycity-landing-rt-pool frames=' + FRAMES + ' native=2 probeCre=2 probeDes=0 uploads=2');
