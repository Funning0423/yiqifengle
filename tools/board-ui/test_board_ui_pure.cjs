'use strict';
// Board-UI engine-free pieces: BuildInfo label, UI flags in localStorage (not the journey), sfxMuted, BoardLayout
// reference numbers, tool-bar choice, idle hint clock, night tint contrast, cabin hint curve, journey-book summary,
// board background cover fit, beaconRoute in the R4 / mainline snapshots, art inventory and removed assets.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
// Needs node:module.stripTypeScriptTypes (Node >=22.6). Older Node: report the reason and exit 78 (run-suite: BLOCKED_NODE); never a pass.
if (typeof stripTypeScriptTypes !== 'function') { console.error('BLOCKED_NODE: legacy-board-ui-pure requires Node >=22.6 (node:module.stripTypeScriptTypes), found ' + process.version); process.exit(78); }
const { createHarness, pngSize, SCRIPTS, BUNDLES, ROOT } = require('./harness.cjs');
const checks = []; const ok = (name, fn) => { fn(); checks.push(name); console.log('PASS', name); };
const H = createHarness(), store = H.cc.sys.localStorage;
const read = rel => fs.readFileSync(path.join(SCRIPTS, rel), 'utf8');
function walk(dir, out = []) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; }

ok('BuildInfo: committed placeholder dev; label "v0.1 · 构建 <sha>"; write_build_info stamps a 7-char sha', () => {
  const info = H.load('BuildInfo'), { buildLabel } = H.load('ui/CommonPanels');
  assert.equal(info.BUILD_VERSION, 'v0.1'); assert.equal(info.BUILD_SHA, 'dev', 'only the dev placeholder is committed'); assert.equal(buildLabel(), 'v0.1 · 构建 dev');
  const { source } = require('../write_build_info.cjs'), stamped = source('d637356');
  const ts = H.ts.transpileModule(stamped, { compilerOptions: { module: H.ts.ModuleKind.CommonJS } }).outputText, m = { exports: {} }; new Function('exports', 'module', ts)(m.exports, m);
  const label = m.exports.BUILD_VERSION + ' · 构建 ' + m.exports.BUILD_SHA; assert.equal(label, 'v0.1 · 构建 d637356');
  assert.match(label, /^v\d+\.\d+ · 构建 [0-9a-f]{7}(-dirty)?$/);
  assert(fs.readFileSync(path.join(ROOT, 'tools/check_wechat_build.py'), 'utf8').includes('BUILD_SHA'), 'build gate reports the stamped sha');
});
ok('UI flags live in localStorage under qfl.ui.* (seenTools JSON list, cabinHintSeen "1"), tolerate corrupt values, never in journey code', () => {
  const P = H.load('ui/UiPrefs'); store.clear();
  assert.equal(P.SEEN_TOOLS_KEY, 'qfl.ui.seenTools'); assert.equal(P.CABIN_HINT_KEY, 'qfl.ui.cabinHintSeen'); assert.equal(P.REDUCED_MOTION_KEY, 'forest-v33-reduced-motion');
  assert.deepEqual(P.seenTools(), []); P.markToolSeen('windbell'); P.markToolSeen('windbell'); P.markToolSeen('starlight');
  assert.equal(store.getItem('qfl.ui.seenTools'), '["windbell","starlight"]'); assert(P.hasSeenTool('starlight')); assert(!P.hasSeenTool('tidebottle'));
  store.setItem('qfl.ui.seenTools', '{bad'); assert.deepEqual(P.seenTools(), []); store.setItem('qfl.ui.seenTools', '{"a":1}'); assert.deepEqual(P.seenTools(), []);
  assert.equal(P.cabinHintSeen(), false); P.markCabinHintSeen(); assert.equal(store.getItem('qfl.ui.cabinHintSeen'), '1'); assert(P.cabinHintSeen());
  P.setReducedMotion(true); assert.equal(store.getItem('forest-v33-reduced-motion'), 'true'); assert(P.reducedMotion()); P.setReducedMotion(false); assert(!P.reducedMotion());
  const journeyCode = walk(path.join(SCRIPTS, 'mainline-r1')).concat(walk(path.join(SCRIPTS, 'regional-r05')), walk(path.join(SCRIPTS, 'r4-cloud-compat'))).filter(f => /\.(js|ts)$/.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  for (const k of ['qfl.ui.', 'seenTools', 'cabinHintSeen']) assert(!journeyCode.includes(k), 'journey/progress code never touches ' + k);
  for (const f of ['world-r2/ManagedBoardSession.ts', 'mainline-r1/runtime/journey-bridge.js']) if (fs.existsSync(path.join(SCRIPTS, f))) assert(!/UiPrefs|qfl\.ui\./.test(read(f)), f);
});
ok('GameAudio sfxMuted: qfl.audio.sfxMuted persists, mutes every SFX (UI clicks included) but not music; restored on next load', () => {
  const src = read('audio/GameAudio.ts'); assert(src.includes("const SFX_MUTE_KEY = 'qfl.audio.sfxMuted'"));
  assert.equal((src.match(/this\.muted \|\| this\.sfxMuted \|\| this\.reasons\.size > 0/g) || []).length, 3, 'all three SFX gates (play, playCheer, exit cine) check sfxMuted');
  const plain = src.replace(/^import .* from 'cc';\n/m, '').replace(/^@ccclass\('GameAudio'\)\n/m, '').replace(/export /g, '');
  const code = stripTypeScriptTypes(plain, { mode: 'transform' }) + '\nglobalThis.AudioClass = GameAudio;';
  const make = data => {
    const loads = [];
    class Events { constructor() { this.m = new Map(); } on(n, f, t) { (this.m.get(n) || this.m.set(n, []).get(n)).push([f, t]); } off(n, f, t) { this.m.set(n, (this.m.get(n) || []).filter(x => x[0] !== f || x[1] !== t)); } emit(n) { for (const [f, t] of [...(this.m.get(n) || [])]) f.call(t); } }
    class Component { destroy() { return true; } }
    class AudioSource { constructor() { this.clip = null; this.playing = false; this.volume = 1; } play() { this.playing = true; } pause() { this.playing = false; } stop() { this.playing = false; } destroy() {} }
    AudioSource.EventType = { STARTED: 'started', ENDED: 'ended' }; AudioSource.maxAudioChannel = 10;
    class Node extends Events { constructor(name) { super(); this.name = name; this.components = []; } addComponent(C) { const c = new C(); c.node = this; this.components.push(c); c.onLoad?.(); return c; } addChild() {} }
    const ctx = { _decorator: { ccclass: () => x => x }, Component, Node, AudioSource, AudioClip: class {}, console, resources: { load() {}, loadDir: (p, t, cb) => loads.push(cb) }, director: { getScene: () => new Node('s'), addPersistRootNode() {} },
      game: new Events(), Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' }, input: new Events(), Input: { EventType: { TOUCH_END: 'te', MOUSE_UP: 'mu', KEY_DOWN: 'kd' } },
      sys: { localStorage: { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)) } }, isValid: () => true, Number, Math, Map, Set, Array, Date, String, Object };
    vm.runInNewContext(code, ctx); const A = ctx.AudioClass; A.now = () => 10000; const a = A.ensure();
    loads[0]?.(null, ['sfx_ui_click', 'sfx_ui_confirm', 'sfx_ui_back', 'sfx_match_normal', 'sfx_combo_1', 'sfx_cheer_1_great'].map(n => ({ name: n, addRef() {}, decRef() {} })));
    return { a, played: () => [...a.sfxVoices.values()].map(v => v.name) };
  };
  const data = new Map(), h = make(data); assert.equal(h.a.isSfxMuted(), false); h.a.onButton(); assert.deepEqual(h.played(), ['sfx_ui_click']);
  for (const s of [...h.a.sfxVoices.keys()]) h.a.retireSfx(s);
  h.a.onBoardFrame({ kind: 'clear' }); h.a.onBoardFrame({ kind: 'clear' });
  assert.deepEqual([...h.played()].sort(), ['sfx_cheer_1_great', 'sfx_combo_1', 'sfx_match_normal']);
  for (const s of [...h.a.sfxVoices.keys()]) h.a.retireSfx(s);
  h.a.setSfxMuted(true); assert.equal(data.get('qfl.audio.sfxMuted'), '1'); h.a.onButton(); h.a.onUiBack();
  h.a.onBoardFrame({ kind: 'clear' }); h.a.onBoardFrame({ kind: 'clear' });
  assert.deepEqual(h.played(), [], 'muted: click, clear and cheer stay silent');
  assert.equal(h.a.isMuted?.() ?? h.a.muted, false, 'music mute untouched');
  const again = make(data); assert.equal(again.a.isSfxMuted(), true, 'restored'); again.a.setSfxMuted(false); assert.equal(data.get('qfl.audio.sfxMuted'), '0');
});
ok('BoardLayout reference phone 390×844: pause (38,67) hit 44, plate 88–302 × 96–156, pitch 42.6, tray centre ≈400, tools y 730 step 82', () => {
  const L = H.load('ui/BoardLayout'), g = L.boardLayout(390, 844, { top: 47, bottom: 34, left: 0, right: 0, capsule: { top: 51, bottom: 83, left: 297, right: 384 } }, 2);
  assert.deepEqual([g.pause.x, g.pause.y, g.pause.hit], [38, 67, 44]); assert.deepEqual([g.plate.x - g.plate.width / 2, g.plate.x + g.plate.width / 2, g.plate.y - 30, g.plate.y + 30], [88, 302, 96, 156]);
  assert(Math.abs(g.pitch - 42.6) < 1e-9); assert(Math.abs(g.grid.y - 400) < 1); assert.equal(g.tools.y, 730); assert.equal(g.tools.step, 82);
  assert.deepEqual(L.toolSlots(g, 3), [113, 195, 277]); assert.deepEqual(L.toolSlots(g, 1), [195]);
  const c = L.cellCenter(g, 24); assert.equal(c.x, g.grid.x); assert.equal(c.y, g.grid.y);
  assert.deepEqual([L.plateWidth(1), L.plateWidth(2), L.plateWidth(3), L.plateWidth(4)], [214, 214, 232, 250]);
  for (const [w, h] of [[320, 568], [375, 667], [430, 932], [568, 320], [844, 390]]) {
    const q = L.boardLayout(w, h, { top: 20, bottom: 20, left: 0, right: 0, capsule: null }, 3), plateBottom = q.plate.y + q.plate.height / 2, trayTop = q.tray.y - q.tray.height / 2;
    if (w < h) { assert(trayTop >= plateBottom, 'tray below the plate ' + w); assert(q.tray.y + q.tray.height / 2 <= q.tools.y - q.tools.hit / 2 + 1e-9, 'tray above tools ' + w); }
    else assert(q.tray.x - q.tray.width / 2 >= q.plate.x + q.plate.width / 2, 'landscape: board right of the side column ' + w);
    assert(q.tray.x + q.tray.width / 2 <= w && q.tray.y + q.tray.height / 2 <= h, 'tray on screen ' + w);
  }
});
ok('tool bar choice: in-stock only, 星光 > 风语铃 > 潮汐瓶 > regional, max 3, never pearl', () => {
  const { pickToolBar } = H.load('ui/BoardLayout'), t = (o) => Object.entries(o).map(([kind, count]) => ({ kind, count }));
  assert.deepEqual(pickToolBar(t({ tideNet: 1, tideBottle: 2, windBell: 1, bomb: 2, pearl: 9 })), ['bomb', 'windBell', 'tideBottle']);
  assert.deepEqual(pickToolBar(t({ tideNet: 1, tideBottle: 2, windBell: 0, bomb: 0, pearl: 9 })), ['tideBottle', 'tideNet']);
  assert.deepEqual(pickToolBar(t({ pearl: 3 })), []); assert.deepEqual(pickToolBar(t({ sunSeed: 1 })), ['sunSeed']);
  const { managedTools, TOOL_NAMES } = H.load('world-r2/ManagedTools'); assert(!('pearl' in TOOL_NAMES));
  const s = { provider: 'mainline-v33', active: { level: 0, bombs: 1 }, journey: { inventory: { tools: { pearl: 4, windBell: 1, tideBottle: 1 } }, regionRewards: [{ region: 0, claimed: true }] } };
  assert.deepEqual(managedTools(s).map(x => x.kind), ['bomb', 'windBell', 'tideBottle', 'tideNet']);
});
ok('QA qaTools=3 forces 3 tools only outside the player build; ignored without the guard (MINIGAME) or the param', () => {
  const { qaForcedToolBar } = H.load('ui/BoardLayout');
  assert.deepEqual(qaForcedToolBar('?qa=1&qaTools=3', false), ['bomb', 'windBell', 'tideBottle']);
  assert.equal(qaForcedToolBar('?qa=1&qaTools=3', true), null, 'MINIGAME guard: ignored in the player build');
  assert.equal(qaForcedToolBar('?qa=1', false), null); assert.equal(qaForcedToolBar(null, false), null); assert.equal(qaForcedToolBar('?qaTools=9', false), null);
  const ui = read('ManagedMobileBoardUI.ts');
  assert.match(ui, /private qaTools\(\): string\[\] \| null \{ if \(MINIGAME\) return null;/, 'UI reads qaTools only behind MINIGAME');
  assert.match(ui, /import \{ MINIGAME \} from 'cc\/env';/);
});
ok('idle hint clock: first hint after 5 s idle, then every 8 s; input or inactive restarts; frame spikes clamp to 0.25 s', () => {
  const { IdleHintClock, HINT_FIRST_S, HINT_REPEAT_S, TOAST_S } = H.load('ui/BoardLayout'); assert.deepEqual([HINT_FIRST_S, HINT_REPEAT_S, TOAST_S], [5, 8, 2]);
  const c = new IdleHintClock(), fire = []; for (let i = 1; i <= 176; i++) if (c.tick(0.125, true)) fire.push(i * 0.125); assert.deepEqual(fire, [5, 13, 21]);
  c.reset(); let n = 0; for (let i = 0; i < 49; i++) n += c.tick(0.1, true) ? 1 : 0; c.tick(0.1, false); for (let i = 0; i < 49; i++) n += c.tick(0.1, true) ? 1 : 0; assert.equal(n, 0, 'inactive frame restarts the wait');
  c.reset(); assert.equal(c.tick(30, true), false, 'a 30 s frame (app in background) does not fire at once');
});
ok('night tint: sprites multiply by K_UI / K_SEA, text recolours; every role keeps contrast ≥ 4.5 on the night panel', () => {
  const N = H.load('ui/NightTint'), panel = [236, 224, 196];
  assert.deepEqual(N.tintRgb('ui', 0), [255, 255, 255]); assert.deepEqual(N.tintRgb('ui', 1), [158, 151, 143]); assert.deepEqual(N.tintRgb('sea', 1), [127, 159, 179]); assert.deepEqual(N.tintRgb('none', 1), [255, 255, 255]);
  for (const role of ['brown', 'brown2', 'teal']) for (const w of [0, 0.25, 0.5, 0.75, 1]) { const bg = N.tintRgb('ui', w, panel), r = N.contrast(N.textRgb(role, w), bg); assert(r >= 4.5, role + ' @' + w + ' contrast ' + r.toFixed(2)); }
  const btn = [86, 140, 118]; for (const w of [0, 1]) assert(N.contrast(N.textRgb('white', w), N.tintRgb('ui', w, btn)) >= 3, 'white on the primary button (large text)');
  N.resetUiNightWeight(); globalThis.__worldDayNight = { snapshot: () => ({ mode: 'night' }) }; assert.equal(N.uiNightWeight(1000), 1, 'first read snaps');
  globalThis.__worldDayNight = { snapshot: () => ({ mode: 'day' }) }; let t = 1000, w = 1; const seen = []; while (w > 0 && t < 3000) { t += 50; w = N.uiNightWeight(t); seen.push(w); } assert.equal(w, 0); assert(t >= 1500 && t <= 1550, 'linear 0.5 s fade at 20 fps ' + t); assert(seen.slice(0, -1).every(v => v > 0 && v < 1));
  delete globalThis.__worldDayNight; N.resetUiNightWeight();
});
ok('cabin hint curve: 0.4 s in to 0.25, 3 × (0.7 s up to 1, 0.9 s down to 0.25), rests at 0.25; reduced motion holds 0.6', () => {
  const C = H.load('world-r2/CabinHint'), f = t => C.cabinHintIntensity(t, false);
  assert.equal(C.CABIN_HINT.breaths, 3); assert(Math.abs(C.CABIN_HINT_TOTAL_S - (0.4 + 3 * 1.6)) < 1e-9);
  assert.equal(f(0), 0); assert(Math.abs(f(0.4) - 0.25) < 1e-9); assert(Math.abs(f(1.1) - 1) < 1e-9); assert(Math.abs(f(2.0) - 0.25) < 1e-9); assert(Math.abs(f(2.7) - 1) < 1e-9);
  assert(Math.abs(f(5.2) - 0.25) < 1e-9); assert(Math.abs(f(60) - 0.25) < 1e-9); assert(Math.abs(C.cabinHintIntensity(3, true) - 0.6) < 1e-9);
  for (let t = 0; t < 6; t += 0.05) { const v = f(t); assert(v >= 0 && v <= 1); }
  const r = C.cabinSpotRect(390, 844, C.CABIN_SPOTS[0].box), k = Math.max(390 / 750, 844 / 1624); assert(Math.abs(r.x - (447 - 375) * k) < 1e-9 && Math.abs(r.y - (812 - 664) * k) < 1e-9 && r.size > 0, 'design px → canvas, cover-fit like the island view');
});
ok('journey book summary: mainline stars per chapter x/12, challenge lock until the same chapter milestone 04/08/12 is cleared, challenge marks x/4', () => {
  const { chapterSummary, CHAPTERS } = H.load('ui/IslandPanels');
  assert.deepEqual(CHAPTERS.map(c => c.id), ['tide', 'meadow', 'sky', 'lake', 'coast', 'snow', 'rail', 'cloud', 'spring']); assert.equal(CHAPTERS[0].description, '听潮声，捡起海浪送来的贝壳。');
  const journey = { unlocked: 5, records: Array.from({ length: 12 }, (_, i) => ({ bestStars: i < 4 ? 3 : i === 4 ? 2 : 0 })) };
  const a = chapterSummary(journey, { tide: 3 }, 0), b = chapterSummary(journey, null, 1), c = chapterSummary(journey, {}, 2);
  assert.equal(a.stars, 12); assert.equal(a.locked, false); assert.equal(a.challenges, 3); assert.equal(b.stars, 2); assert.equal(b.locked, true, 'mainline 05 open is not mainline 08 completed'); assert.equal(b.challenges, 0); assert.equal(c.locked, true);
  assert.equal(chapterSummary(null, null, 0).stars, 0);
  assert.equal(chapterSummary(null, null, 0).locked, true, 'new players have not cleared mainline 04');
});
function jpegSize(file) {
  const b = fs.readFileSync(file); let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) break;
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc2) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  throw Error('jpeg SOF missing ' + file);
}
ok('board background: island jpg stays the default; 天空回声 (r05-sky) reads region_skycity/board/bg_skycity_board.jpg; meadow has no picture', () => {
  const B = H.load('world-r2/IslandBoardBackground'), Art = H.load('ui/BoardArt');
  assert.deepEqual(B.BACKGROUND_SIZE, { width: 750, height: 1624 });
  assert.deepEqual(Art.BOARD_BACKGROUND, { bundle: 'region_island', path: 'board/bg_island_board' });
  assert.deepEqual(Art.SKY_BOARD_BACKGROUND, { bundle: 'region_skycity', path: 'board/bg_skycity_board' });
  const sky = { provider: 'r5', stageId: 'r05-sky-01', seed: 1 };
  assert.equal(Art.boardChapter(sky), 'sky');
  assert.deepEqual(Art.boardBackgroundFor(sky), Art.SKY_BOARD_BACKGROUND);
  assert.deepEqual(Art.boardBackgroundFor({ provider: 'r5', stageId: 'r05-sky-04', seed: 1 }), Art.SKY_BOARD_BACKGROUND);
  const meadow = { provider: 'r5', stageId: 'r05-meadow-01', seed: 1 };
  assert.equal(Art.boardChapter(meadow), 'meadow');
  assert.throws(()=>Art.boardBackgroundFor(meadow), /meadow-requires-live-3d-background/, 'meadow must use its real 3D lease');
  assert.deepEqual(Art.boardBackgroundFor({ provider: 'r5', stageId: 'r05-tide-03', seed: 1 }), Art.BOARD_BACKGROUND);
  assert.deepEqual(Art.boardBackgroundFor({ provider: 'r4', stageId: 'tide-c01-001', seed: 1 }), Art.BOARD_BACKGROUND);
  assert.equal(Art.boardChapter({ provider: 'mainline', stageId: 'mainline-09', seed: 1 }), 'sky');
  assert.deepEqual(Art.boardBackgroundFor({ provider: 'mainline', stageId: 'mainline-12', seed: 1 }), Art.SKY_BOARD_BACKGROUND, 'sky-city mainline must never resolve island art');
  const islandJpg = path.join(BUNDLES, 'region_island/board/bg_island_board.jpg');
  const skyJpg = path.join(BUNDLES, 'region_skycity/board/bg_skycity_board.jpg');
  assert(fs.existsSync(islandJpg)); assert.deepEqual(jpegSize(islandJpg), { width: 750, height: 1624 });
  assert(fs.existsSync(skyJpg)); assert.deepEqual(jpegSize(skyJpg), { width: 750, height: 1624 });
  assert(fs.existsSync(path.join(BUNDLES, 'region_meadow/env_meadow.glb')), 'real meadow scene is shipped');
  assert(fs.existsSync(path.join(BUNDLES, 'region_meadow/audio/bgm_meadow.mp3')));
  assert(!fs.existsSync(path.join(BUNDLES, 'region_skycity/board/bg_skycity_night.jpg')));
  const bgSrc = read('world-r2/IslandBoardBackground.ts');
  assert(bgSrc.includes('boardBackgroundFor(selection)'), 'the background read is boardBackgroundFor, not a fixed BOARD_BACKGROUND.path');
  assert(bgSrc.includes("tintRgb('sea'"));
  assert(!/bg_\w+_night/.test(bgSrc));
  for (const [w, h] of [[390, 844], [320, 568], [844, 390]]) { const s = B.coverSize(w, h); assert(s.width >= w - 1e-9 && s.height >= h - 1e-9); assert(Math.abs(s.width / s.height - 750 / 1624) < 1e-9); assert(Math.abs(s.width - w) < 1e-9 || Math.abs(s.height - h) < 1e-9); }
  assert(read('world-r2/WorldNativeComposition.ts').includes('createIslandBoardBackground'));
  const all = walk(SCRIPTS).filter(f => /\.(ts|js)$/.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  for (const s of ['painted-cloud', 'OriginalLevelEnvironment', 'OriginalLevelBackground', "'ui/pieces'", 'loading-reference', 'wind-rises']) assert(!all.includes(s), s);
  assert(!fs.existsSync(path.join(BUNDLES, 'background_foliage')));
});
ok('beaconRoute: R4 snapshot carries the ordered route (tide-c01-001 → [22,24,26]) next to beaconTarget; mainline session snapshot too', () => {
  const R4 = require(path.join(SCRIPTS, 'r4-cloud-compat/runtime/challenge-controller.js')), Cat = require(path.join(SCRIPTS, 'r4-cloud-compat/runtime/challenge-catalog.js'));
  const data = new Map(), platform = { load: k => data.has(k) ? JSON.parse(data.get(k)) : null, save: (k, v) => { data.set(k, JSON.stringify(v)); return true; } };
  const c = new R4({ platform, journey: { readOnly: false, records: Array.from({ length: 12 }, () => ({ bestStars: 3, clears: 1 })) } }), st = Cat.stages.find(x => x.id === 'tide-c01-001');
  assert(c.startStage(st.id, { seed: st.seedBank[0] }).ok); const a = c.snapshot().active;
  assert.deepEqual(a.beaconRoute, [22, 24, 26]); assert.equal(a.beaconTarget.index, 22); assert.equal(a.beaconTarget.cursor, 0); assert.equal(a.beaconTarget.total, 3);
  assert.deepEqual(a.beaconRoute.slice(a.beaconTarget.cursor + 1), [24, 26], 'what the board draws as faint dots');
  assert(fs.readFileSync(path.join(SCRIPTS, 'r4-cloud-compat/runtime/challenge-controller.d.ts'), 'utf8').includes('beaconRoute'));
  const S = require(path.join(SCRIPTS, 'mainline-r1/runtime/mainline-session.js')), m = new S(0, 1).snapshot(); assert(Array.isArray(m.beaconRoute)); assert.equal(m.beaconTarget, null);
});
ok('art inventory: board_art dirs (board, popup, r2, r3, chest, licenses) + region_island/board present; no _rejected slices, preview GLB or film refs packed', () => {
  for (const d of ['board', 'popup', 'r2', 'r3', 'chest', 'licenses']) assert(fs.existsSync(path.join(BUNDLES, 'board_art', d)), d);
  const files = walk(path.join(BUNDLES, 'board_art')).concat(walk(path.join(BUNDLES, 'region_island/board')));
  for (const f of files) assert(!/_rejected|result_chest_preview|wind-rises|apron-ref/.test(f), f);
  for (const k of ['board/tray_frame', 'board/hud_pause', 'board/hud_levelplate', 'board/piece_leaf', 'popup/panel_frame_9s', 'popup/title_plank_3s', 'popup/btn_primary_3s', 'popup/btn_close', 'r3/about_gamename']) {
    const p = path.join(BUNDLES, 'board_art', k + '.png'); assert(fs.existsSync(p), k); const s = pngSize(p); assert(s.width > 0 && s.height > 0, k);
  }
  const meta = JSON.parse(fs.readFileSync(path.join(BUNDLES, 'board_art.meta'), 'utf8')); assert.equal(meta.userData.isBundle, true);
  const ts = walk(SCRIPTS).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(f, 'utf8')).join('\n'), keys = new Set();
  for (const m of ts.matchAll(/'((?:board|popup|r2|r3)\/[A-Za-z0-9_]+)'(\s*\+)?/g)) if (!m[2] && m[1] !== 'board/bg_island_board' && m[1] !== 'board/bg_skycity_board') keys.add(m[1]);
  for (const m of ts.matchAll(/'((?:popup\/reward_seal|r2\/chapter|r2\/region)_)'\s*\+/g)) for (const id of ['tide', 'meadow', 'sky']) keys.add(m[1] + id);
  for (const k of keys) assert(fs.existsSync(path.join(BUNDLES, 'board_art', k + '.png')), 'art key used in code but not shipped: ' + k);
  assert(keys.size > 60, 'scanned ' + keys.size + ' art keys');
  assert(fs.existsSync(path.join(ROOT, 'creator-build-project/assets/resources/ui/tools-original.png')), 'mainline atlas kept; the sheet is not replaced');
  const crypto = require('node:crypto');
  const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  for (const n of ['tool_tidenet', 'tool_sunseed', 'tool_starshears']) {
    const src = path.join(ROOT, 'art-src/board-ui/c-popups/r2/slices', n + '.png');
    const dst = path.join(BUNDLES, 'board_art/r2', n + '.png');
    assert.equal(hash(dst), hash(src), n + ' bundle copy matches the signed-off slice');
  }
  const Art = H.load('ui/BoardArt');
  assert.equal(Art.TOOL_KEYS.bomb, 'board/tool_starlight');
  assert.equal(Art.TOOL_KEYS.windBell, 'board/tool_windbell');
  assert.equal(Art.TOOL_KEYS.tideBottle, 'board/tool_tidebottle');
  assert.deepEqual([Art.TOOL_KEYS.tideNet, Art.TOOL_KEYS.sunSeed, Art.TOOL_KEYS.starShears], ['r2/tool_tidenet', 'r2/tool_sunseed', 'r2/tool_starshears']);
});
async function mountBackground(selection) {
  const { Cancellation } = H.load('world-r1/WorldFlowCore');
  const { createIslandBoardBackground } = H.load('world-r2/IslandBoardBackground');
  const parent = new H.cc.Node('parent'), canvas = new H.cc.Node('NativeBoardCanvas');
  parent.addChild(canvas);
  const lease = await createIslandBoardBackground({ parent, selection, token: new Cancellation() });
  lease.frame(true, { width: 390, height: 844, boardTop: 310 });
  const bg = canvas.getChildByName('IslandBoardBackground');
  return { lease, sprite: bg.getComponent(H.cc.Sprite), d: lease.diagnostics() };
}
(async () => {
  const N = H.load('ui/NightTint');
  N.resetUiNightWeight(); globalThis.__worldDayNight = { snapshot: () => ({ mode: 'night' }) };
  const sky = await mountBackground({ provider: 'r5', stageId: 'r05-sky-01', seed: 1 });
  assert.equal(sky.d.bundle, 'region_skycity'); assert.equal(sky.d.path, 'board/bg_skycity_board'); assert.equal(sky.d.chapter, 'sky');
  assert.equal(sky.d.night, 1); assert.deepEqual([sky.sprite.color.r, sky.sprite.color.g, sky.sprite.color.b], N.tintRgb('sea', 1));
  assert.equal(sky.sprite.spriteFrame.texture.image.path, 'board/bg_skycity_board');
  sky.lease.dispose();
  delete globalThis.__worldDayNight; N.resetUiNightWeight();
  await assert.rejects(mountBackground({ provider: 'r5', stageId: 'r05-meadow-02', seed: 1 }), /meadow-requires-live-3d-background/);
  const forest = await mountBackground({ provider: 'mainline', stageId: 'mainline-09', seed: 1 });
  assert.equal(forest.d.chapter, 'sky'); assert.equal(forest.d.path, 'board/bg_skycity_board');
  forest.lease.dispose();
  checks.push('static art identity respects sky-city mainline; meadow rejects image fallback (composition uses real regional 3D leases)');
  console.log('PASS', checks[checks.length - 1]);
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
