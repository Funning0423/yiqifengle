'use strict';
// Drives the real GameAudio cine slot and hold-wind bed with a Cocos/WX fake.
// Not a Creator build and not a listening test.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync('creator-build-project/assets/scripts/audio/GameAudio.ts', 'utf8');
const plain = source
  .replace(/^import .* from 'cc';\n/m, '')
  .replace(/^@ccclass\('GameAudio'\)\n/m, '')
  .replace(/export /g, '');
const code = stripTypeScriptTypes(plain, { mode: 'transform' }) + '\nglobalThis.AudioClass = GameAudio;';

const CINE = 'audio_cine/sfx_transition_island_to_meadow';
const WIND = 'audio_amb/amb_wind_soft_loop';

function harness() {
  const loads = [];
  const warnings = [];
  class Events {
    constructor() { this.events = new Map(); }
    on(n, f, t) { const a = this.events.get(n) || []; a.push([f, t]); this.events.set(n, a); }
    off(n, f, t) { this.events.set(n, (this.events.get(n) || []).filter(x => x[0] !== f || x[1] !== t)); }
    emit(n) { for (const [f, t] of [...(this.events.get(n) || [])]) f.call(t); }
  }
  class Component { destroy() { this.queued = true; return true; } }
  class AudioSource {
    constructor() {
      this.clip = null; this.playing = false; this.volume = 1; this.loop = false;
      this.playOnAwake = true; this.starts = 0; this.stops = 0; this.pauses = 0; this.destroyed = false;
    }
    play() { this.starts++; this.playing = true; }
    pause() { this.pauses++; this.playing = false; }
    stop() { this.stops++; this.playing = false; }
    destroy() { this.destroyed = true; this.playing = false; }
  }
  AudioSource.EventType = { STARTED: 'started', ENDED: 'ended' };
  class Node extends Events {
    constructor(name) { super(); this.name = name; this.valid = true; this.components = []; }
    addComponent(C) { const c = new C(); c.node = this; this.components.push(c); c.onLoad?.(); return c; }
    addChild() {}
  }
  const game = new Events();
  const input = new Events();
  const scene = new Node('scene');
  const wx = { setInnerAudioOption(o) { o.success(); } };
  for (const event of ['Hide', 'Show', 'AudioInterruptionBegin', 'AudioInterruptionEnd']) {
    wx['on' + event] = f => {};
    wx['off' + event] = f => {};
  }
  const bundles = new Map();
  const bundleLoads = [];
  const assetManager = {
    fail: false,
    getBundle: name => bundles.get(name) || null,
    loadBundle(name, cb) {
      bundleLoads.push(name);
      if (assetManager.fail) { cb(new Error('bundle ' + name + ' unavailable'), null); return; }
      const b = { name, load: (p, t, done) => loads.push({ p, bundle: name, cb: done }) };
      bundles.set(name, b);
      cb(null, b);
    },
  };
  const ctx = {
    _decorator: { ccclass: () => x => x }, Component, Node, AudioSource, AudioClip: class {},
    resources: { load: (p, t, cb) => loads.push({ p, cb }), loadDir: () => {} },
    assetManager,
    director: { getScene: () => scene, addPersistRootNode() {} },
    game, Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' },
    input, Input: { EventType: { TOUCH_END: 'touch', MOUSE_UP: 'mouse', KEY_DOWN: 'key' } },
    sys: { localStorage: { getItem: () => null, setItem() {} } },
    isValid: n => !!n?.valid,
    wx,
    console: { warn: (...a) => warnings.push(a.map(String).join(' ')) },
  };
  vm.runInNewContext(code, ctx);
  const A = ctx.AudioClass;
  let time = 10000;
  A.now = () => time;
  const clip = name => ({ name, refs: 0, addRef() { this.refs++; }, decRef() { this.refs--; } });
  const sources = () => A.instance.node.components.filter(c => c instanceof AudioSource);
  return {
    A, loads, warnings, game, input, clip, sources, assetManager, bundleLoads, bundles,
    create: () => A.ensure(),
    advance: n => { time += n; },
  };
}

function deliver(h, path, clip) {
  const hit = h.loads.filter(x => x.p === path).pop();
  assert.ok(hit, 'expected load ' + path);
  hit.cb(null, clip);
}

let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS', name); }

test('missing cine file warns and does not throw or start a source', () => {
  const h = harness();
  const a = h.create();
  const before = h.sources().length;
  a.playCineSlot(CINE);
  assert.equal(h.loads.at(-1).p, CINE);
  h.loads.at(-1).cb(new Error('missing'));
  assert.equal(h.sources().length, before);
  assert.match(h.warnings.join('\n'), /cine slot missing/);
});

test('cine plays once at transition start and a late load after stop is ignored', () => {
  const h = harness();
  const a = h.create();
  a.playCineSlot(CINE);
  a.stopCineSlot();
  const c = h.clip('cine');
  h.loads.at(-1).cb(null, c);
  assert.equal(c.refs, 0);
  a.playCineSlot(CINE);
  const live = h.clip('cine-live');
  deliver(h, CINE, live);
  const voice = h.sources().filter(s => s.clip === live)[0];
  assert.equal(voice.loop, false);
  assert.equal(voice.starts, 1);
  assert.equal(live.refs, 1);
});

test('skip fades the cine bed over the supplied 0.3s and then stops it', () => {
  const h = harness();
  const a = h.create();
  a.playCineSlot(CINE);
  const c = h.clip('cine');
  deliver(h, CINE, c);
  const voice = h.sources().filter(s => s.clip === c)[0];
  a.fadeCineSlot(0.3);
  assert.ok(Math.abs(voice.volume - 1) < 1e-6);
  h.advance(150);
  a.update();
  assert.ok(Math.abs(voice.volume - Math.cos(Math.PI / 4)) < 1e-6, 'equal-power midpoint');
  assert.equal(voice.destroyed, false);
  h.advance(150);
  a.update();
  assert.equal(voice.destroyed, true);
  assert.equal(voice.playing, false);
  assert.equal(c.refs, 0);
});

test('background stops the cine bed and showing the app does not resume it', () => {
  const h = harness();
  const a = h.create();
  a.playCineSlot(CINE);
  const c = h.clip('cine');
  deliver(h, CINE, c);
  const voice = h.sources().filter(s => s.clip === c)[0];
  h.game.emit('hide');
  assert.equal(voice.destroyed, true);
  assert.equal(c.refs, 0);
  h.game.emit('show');
  a.update();
  assert.equal(h.loads.filter(x => x.p === CINE).length, 1);
  assert.equal(h.sources().some(s => s.clip === c && !s.destroyed), false);
});

test('hold waits on the existing wind loop, then fades it when the load continues', () => {
  const h = harness();
  const a = h.create();
  a.loopHoldAmbience(WIND);
  assert.equal(h.loads.some(x => x.p === WIND), false, 'no gesture yet');
  h.input.emit('touch');
  a.update();
  assert.equal(h.loads.at(-1).p, WIND);
  const c = h.clip('wind');
  deliver(h, WIND, c);
  const voice = h.sources().filter(s => s.clip === c)[0];
  assert.equal(voice.loop, true);
  assert.equal(voice.starts, 1);
  assert.ok(Math.abs(voice.volume - 0.32) < 1e-6);
  a.fadeHoldAmbience(0.3);
  h.advance(300);
  a.update();
  assert.equal(voice.destroyed, true);
  assert.equal(c.refs, 0);
  a.update();
  assert.equal(h.loads.filter(x => x.p === WIND).length, 1, 'fade does not restart the bed');
});

test('background stops hold wind; returning does not loop it again until asked', () => {
  const h = harness();
  const a = h.create();
  h.input.emit('touch');
  a.loopHoldAmbience(WIND);
  const c = h.clip('wind');
  deliver(h, WIND, c);
  h.game.emit('hide');
  assert.equal(c.refs, 0);
  h.game.emit('show');
  a.update();
  assert.equal(h.loads.filter(x => x.p === WIND).length, 1);
  a.loopHoldAmbience(WIND);
  const again = h.clip('wind-2');
  deliver(h, WIND, again);
  assert.equal(h.sources().some(s => s.clip === again && s.loop && s.playing), true);
});

test('sfx mute stops cine only; full mute also stops the hold bed', () => {
  const h = harness();
  const a = h.create();
  h.input.emit('touch');
  a.playCineSlot(CINE);
  a.loopHoldAmbience(WIND);
  const cine = h.clip('cine');
  const wind = h.clip('wind');
  deliver(h, CINE, cine);
  deliver(h, WIND, wind);
  a.setSfxMuted(true);
  assert.equal(cine.refs, 0);
  assert.equal(wind.refs, 1);
  a.setMuted(true);
  assert.equal(wind.refs, 0);
});

test('pause holds the cine voice and resume continues the same source', () => {
  const h = harness();
  const a = h.create();
  a.playCineSlot(CINE);
  const c = h.clip('cine');
  deliver(h, CINE, c);
  const voice = h.sources().filter(s => s.clip === c)[0];
  a.pauseCineSlot();
  assert.equal(voice.playing, false);
  assert.equal(voice.pauses, 1);
  a.resumeCineSlot();
  assert.equal(voice.playing, true);
  assert.equal(voice.starts, 2);
  assert.equal(c.refs, 1);
});

test('cloud hold fades the cine bed over 80ms without cutting it, then the wind bed is still up', () => {
  const h = harness();
  const a = h.create();
  h.input.emit('touch');
  a.playCineSlot(CINE);
  const cine = h.clip('cine');
  deliver(h, CINE, cine);
  const voice = h.sources().filter(s => s.clip === cine)[0];
  a.fadeCineSlot(0.08);
  a.loopHoldAmbience(WIND);
  const wind = h.clip('wind');
  deliver(h, WIND, wind);
  const bed = h.sources().filter(s => s.clip === wind)[0];
  assert.ok(Math.abs(voice.volume - 1) < 1e-6, 'fade starts at the current gain');
  assert.equal(voice.stops, 0);
  assert.equal(voice.destroyed, false);
  assert.equal(bed.playing, true);
  let prev = voice.volume;
  h.advance(40);
  a.update();
  assert.equal(voice.destroyed, false);
  assert.ok(Math.abs(voice.volume - Math.cos(Math.PI / 4)) < 1e-6, 'equal-power at 40ms');
  assert.ok(voice.volume < prev);
  prev = voice.volume;
  assert.equal(bed.destroyed, false);
  assert.equal(bed.playing, true);
  h.advance(40);
  a.update();
  assert.equal(voice.destroyed, true);
  assert.equal(voice.playing, false);
  assert.equal(cine.refs, 0);
  assert.equal(bed.destroyed, false);
  assert.equal(bed.playing, true);
  assert.equal(wind.refs, 1);
  assert.ok(prev > 0.001);
});

test('sail sting loads from the region_island bundle and a missing bundle only warns', () => {
  const h = harness();
  const a = h.create();
  a.playCineSlot(CINE, 'region_island');
  assert.equal(h.loads.filter(x => x.p === CINE && !x.bundle).length, 0);
  assert.deepEqual(h.bundleLoads, ['region_island']);
  assert.equal(h.loads.at(-1).bundle, 'region_island');
  assert.equal(h.loads.at(-1).p, CINE);
  const live = h.clip('bundle-cine');
  deliver(h, CINE, live);
  assert.equal(h.sources().some(s => s.clip === live && s.playing && !s.loop), true);
  const again = harness();
  const b = again.create();
  const ready = { load: (p, t, done) => again.loads.push({ p, bundle: 'region_island', cb: done }) };
  again.bundles.set('region_island', ready);
  b.playCineSlot(CINE, 'region_island');
  assert.equal(again.bundleLoads.length, 0);
  assert.equal(again.loads.at(-1).bundle, 'region_island');
  const missing = harness();
  const c = missing.create();
  const before = missing.sources().length;
  missing.assetManager.fail = true;
  c.playCineSlot(CINE, 'region_island');
  assert.match(missing.warnings.join('\n'), /cine slot missing/);
  assert.equal(missing.sources().length, before);
});

console.log(JSON.stringify({ status: 'PASS_SAILBOAT_AUDIO', cases: count }));
