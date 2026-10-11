'use strict';
// A5 (Voice bot): UI tap SFX. Runs the REAL GameAudio.ts against a minimal Cocos fake (mock, not a Creator build or a
// listening test), checks the AudioBridge wiring statically, and checks the six shipped mp3 + .meta files.
// Run from the repo root: node tools/a5-ui-sfx/test_a5_ui_tap_sfx.cjs   (node >= 22.6 for stripTypeScriptTypes)
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const S = 'creator-build-project/assets/scripts', R = 'creator-build-project/assets/resources/audio_sfx';
const src = fs.readFileSync(path.join(S, 'audio/GameAudio.ts'), 'utf8');
const plain = src.replace(/^import .* from 'cc';\n/m, '').replace(/^@ccclass\('GameAudio'\)\n/m, '').replace(/export /g, '');
const code = stripTypeScriptTypes(plain, { mode: 'transform' }) + '\nglobalThis.AudioClass = GameAudio;';
const NAMES = ['bag', 'book', 'signpost', 'confirm', 'back', 'click'];   // ui-soft: settings has no own file, it plays click
let count = 0; const test = (n, f) => { f(); count++; console.log('PASS', n); };

function harness() {
  const sfxLoads = [];
  class Events { constructor() { this.m = new Map(); } on(n, f, t) { (this.m.get(n) || this.m.set(n, []).get(n)).push([f, t]); } off(n, f, t) { this.m.set(n, (this.m.get(n) || []).filter(x => x[0] !== f || x[1] !== t)); } emit(n) { for (const [f, t] of [...(this.m.get(n) || [])]) f.call(t); } }
  class Component { destroy() { return true; } }
  class AudioSource { constructor() { this.clip = null; this.playing = false; this.volume = 1; } play() { this.playing = true; } pause() { this.playing = false; } stop() { this.playing = false; } destroy() {} }
  AudioSource.EventType = { STARTED: 'started', ENDED: 'ended' }; AudioSource.maxAudioChannel = 10;
  class Node extends Events { constructor(name) { super(); this.name = name; this.components = []; } addComponent(C) { const c = new C(); c.node = this; this.components.push(c); c.onLoad?.(); return c; } addChild() {} }
  const game = new Events(), input = new Events(), scene = new Node('scene');
  const ctx = { _decorator: { ccclass: () => x => x }, Component, Node, AudioSource, AudioClip: class {}, console,
    resources: { load() {}, loadDir: (p, t, cb) => sfxLoads.push(cb) }, director: { getScene: () => scene, addPersistRootNode() {} },
    game, Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' }, input, Input: { EventType: { TOUCH_END: 'te', MOUSE_UP: 'mu', KEY_DOWN: 'kd' } },
    sys: { localStorage: { getItem: () => null, setItem() {} } }, isValid: () => true, Number, Math, Map, Set, Array, Date, String, Object };
  vm.runInNewContext(code, ctx); const A = ctx.AudioClass; let t = 10000; A.now = () => t;
  const a = A.ensure();
  const clip = name => ({ name, addRef() {}, decRef() {} });
  sfxLoads[0](null, NAMES.map(n => clip('sfx_ui_' + n)));
  const played = () => [...a.sfxVoices.values()].map(v => [v.name, v.source.volume]);
  const reset = () => { for (const s of [...a.sfxVoices.keys()]) a.retireSfx(s); t += 1000; };
  return { a, game, played, reset };
}

test('press plays the target sound, confirm plays sfx_ui_confirm, at UI volume below cheers', () => {
  const h = harness();
  for (const [target, n] of [['bag', 'bag'], ['book', 'book'], ['settings', 'click'], ['signpost', 'signpost']]) {
    h.a.onPropTap(target, 'press', { blocked: false, props: true });
    assert.deepEqual(h.played(), [['sfx_ui_' + n, 1]]); h.reset();
    h.a.onPropTap(target, 'confirm', { blocked: false, props: false });
    assert.deepEqual(h.played(), [['sfx_ui_confirm', 1]]); h.reset();
  }
});
test('blocked press/confirm plays nothing; unknown target/phase plays nothing', () => {
  const h = harness();
  for (const phase of ['press', 'confirm']) for (const target of ['bag', 'book', 'settings', 'signpost']) h.a.onPropTap(target, phase, { blocked: true, props: true });
  h.a.onPropTap('nope', 'press', { blocked: false }); h.a.onPropTap('bag', 'hover', { blocked: false });
  assert.deepEqual(h.played(), []);
});
test('muted and suspended (hidden) drop UI tap sounds like every other SFX', () => {
  const h = harness();
  h.a.muted = true; h.a.onPropTap('bag', 'press', { blocked: false }); h.a.onUiBack(); assert.deepEqual(h.played(), []);
  h.a.muted = false; h.game.emit('hide'); h.a.onPropTap('bag', 'confirm', { blocked: false }); assert.deepEqual(h.played(), []);
  h.game.emit('show'); h.a.onPropTap('bag', 'press', { blocked: false }); assert.deepEqual(h.played(), [['sfx_ui_bag', 1]]);
});
test('onUiBack plays sfx_ui_back; generic onButton / onToolTap play the soft click at UI volume 1', () => {
  const h = harness(); h.a.onUiBack(); assert.deepEqual(h.played(), [['sfx_ui_back', 1]]); h.reset();
  h.a.onButton(); assert.deepEqual(h.played(), [['sfx_ui_click', 1]]); h.reset();
  h.a.onToolTap(); assert.deepEqual(h.played(), [['sfx_ui_click', 1]]);
});
test('AudioBridge: subscribes onPropTap in onLoad, unsubscribes in onDestroy, no double click on prop hit areas, back buttons', () => {
  const b = fs.readFileSync(path.join(S, 'audio/AudioBridge.ts'), 'utf8');
  assert.match(b, /import \{ onPropTap \} from '\.\.\/world-r2\/IslandPropTaps'/);
  assert.match(b, /onLoad\(\) \{[\s\S]*?this\.offPropTap = onPropTap\([\s\S]*?GameAudio\.instance\?\.onPropTap\(target, phase, info\)/);
  assert.match(b, /onDestroy\(\) \{\s*try \{ this\.offPropTap\?\.\(\); \}[^\n]*\n\s*this\.offPropTap = null;/);
  for (const n of ['Island-bag', 'Island-journal', 'Island-settings', 'mainline']) assert(b.includes(`'${n}'`), n);
  assert.match(b, /if \(propTap\) return;/); assert.match(b, /if \(back\) \{ GameAudio\.instance\?\.onUiBack\(\); return; \}/);
  // the names must still exist where T9 / the overlay create them
  const o = fs.readFileSync(path.join(S, 'world-r2/IslandJourneyOverlay.ts'), 'utf8');
  assert.match(o, /'Island-'\+role/);
  // board-ui: island pages are PopupKit panels (not WarmButtons, so AudioBridge adds no click); close × and
  // back-to-chapters play sfx_ui_back through PopupKit's own sound option.
  const kit = fs.readFileSync(path.join(S, 'ui/PopupKit.ts'), 'utf8'), pages = fs.readFileSync(path.join(S, 'ui/IslandPanels.ts'), 'utf8');
  assert.match(o, /new PopupStack\(/); assert(!/warmButton\(/.test(pages) && !/warmButton\(/.test(kit), 'popup buttons are not WarmButtons');
  assert.match(kit, /pressable\(n, s\.node, \(\) => this\.close\(\), \{ sound: 'back' \}\)/); assert.match(pages, /name: 'BackToChapters', sound: 'back'/);
  assert.match(kit, /else if \(kind === 'back'\) a\.onUiBack\(\)/);
  assert.match(fs.readFileSync(path.join(S, 'WorldIntegrationBoot.ts'), 'utf8'), /if\(id==='mainline'\)emitPropTap\('signpost','confirm'/);
});
test('ui-soft mp3 + meta (no sfx_ui_settings): mono 44.1 kHz MPEG-1 L3, total <= 40 KB, unique uuids, cheer-style meta', () => {
  const uuids = new Set(); let total = 0;
  for (const f of fs.readdirSync(R).filter(f => f.endsWith('.meta'))) uuids.add(JSON.parse(fs.readFileSync(path.join(R, f))).uuid);
  const ref = JSON.parse(fs.readFileSync(path.join(R, 'sfx_cheer_1_great.mp3.meta')));
  for (const n of NAMES) {
    const buf = fs.readFileSync(path.join(R, `sfx_ui_${n}.mp3`)); total += buf.length;
    let i = 0; if (buf.slice(0, 3).toString() === 'ID3') i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
    assert.equal(buf[i], 0xff); assert.equal(buf[i + 1] & 0xfe, 0xfa, 'MPEG-1 Layer III'); assert.equal((buf[i + 2] >> 2) & 3, 0, '44.1 kHz'); assert.equal(buf[i + 3] >> 6, 3, 'mono');
    const meta = JSON.parse(fs.readFileSync(path.join(R, `sfx_ui_${n}.mp3.meta`)));
    assert.deepEqual({ ...meta, uuid: '' }, { ...ref, uuid: '' }); assert.match(meta.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.ok(src.includes(`'sfx_ui_${n}'`), 'SfxName has sfx_ui_' + n);
  }
  assert.ok(!fs.existsSync(path.join(R, 'sfx_ui_settings.mp3')) && !fs.existsSync(path.join(R, 'sfx_ui_settings.mp3.meta')) && !src.includes("'sfx_ui_settings'"), 'sfx_ui_settings removed');
  const metas = fs.readdirSync(R).filter(f => f.endsWith('.meta')).length; assert.equal(uuids.size, metas, 'uuids unique in audio_sfx');
  assert.ok(total <= 40 * 1024, 'total ' + total); console.log('  total bytes', total);
});
console.log(JSON.stringify({ status: 'PASS_A5_UI_TAP_SFX', cases: count, creatorBuild: 'NOT_RUN', deviceListening: 'NOT_RUN' }));
