'use strict';
/** b20 skycity landing-board RT pool.
 *  Mac ced9972f: pin made skycity.board-background cre/des ~0, but skycity.landing-board (16 samples)
 *  stayed cre/des 308–399 (avg 389.4), DepthStencil on every sample, uploads avg 83.4/s, anonymous `?:N`.
 *  Named SceneDepth/Radiance/LdrColor/UiColor were not in the churn list (rt_named_rows=0).
 *  Those anonymous destroys are device textures that are not in the executor map (RenderWindow color/depth).
 *  Gate: one depth + one color attachment, destroyed and created for 40 frames, stay at 2 native creates
 *  and 0 native destroys. The GPU probe is wrapped outside the pool and then the pool re-installs outside
 *  it; probe cre/des/uploads stay at the first real allocate. Sampled-only and external textures still
 *  hit the device. Do not loosen the N=600 residency gate. */
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
      return { width: info.width | 0, height: info.height | 0, dead: false, destroy() { this.dead = true; realDestroys++; } };
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
for (let i = 0; i < 10; i++) {
  const t = device.createTexture({ usage: 0x4, format: 35, width: 64, height: 64, flags: 0 });
  t.destroy();
  assert.equal(t.dead, true, 'sampled image destroy still runs');
}
assert.equal(native() - s0, 10, 'sampled textures are not pooled');
assert.equal(destroyed() - sd0, 10);
assert.equal(G.creates - g0, 10);
assert.equal(G.destroys - gd0, 10);

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

assert.equal(Rig.rtPoolKey({ usage: 0x4, width: 1024, height: 1024, format: 35 }), '', 'sampled-only key is empty');
assert.notEqual(Rig.rtPoolKey(DEPTH), '', 'depth attachment key is pooled');
assert.equal(Rig.rtPoolKey({ usage: 0x10, width: 8, height: 8, flags: 0x4 }), '', 'external flag is not pooled');
assert.equal(Rig.pinShadowResidency({ numVertices: () => 1, vertexName: () => 'Bloom0', getTraits: () => ({ residency: 0 }) }), 0);

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
  sampledNotPooled: 10,
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
  note: 'Pool keeps COLOR_ATTACHMENT and DEPTH_STENCIL_ATTACHMENT textures. The probe is re-wrapped so a cache hit is not a create or an upload. Sampled images and external textures still allocate. Mac must re-measure skycity.landing-board and skycity.board-background: cre, des, and create-driven uploads near 0 after the first sample. Copy uploads of existing textures can remain.',
};
const evDir = path.join(ROOT, 'docs/r5/b20-hotfix/evidence');
fs.mkdirSync(evDir, { recursive: true });
fs.writeFileSync(path.join(evDir, 'skycity-landing-rt.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log('PASS skycity-landing-rt-pool frames=' + FRAMES + ' native=2 probeCre=2 probeDes=0 uploads=2');
