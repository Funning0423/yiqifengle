'use strict';
// 地名开局淡入 (UI设计部 SPEC v1.1, ui/region-arrival-title 00bae3e7; Grok Bot approved): the name of a new region fades in at its
// first board (L5 花粉草甸 / L9 天空之城 / L13 风铃湖畔) on the toast slot for 2.0 s (0.4 in + 6 pt rise, 1.2 hold, 0.4 out), once per
// region, never blocking touches; tips, 「关卡已调整」 and tool intros wait behind it; style switch default B (night glow off);
// no place-name sign / 「回到小岛」 in any transition. Real ManagedMobileBoardUI on the board-ui harness (no rendering, no WeChat).
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHarness } = require('../board-ui/harness.cjs'), { createBoard, snapshot } = require('../board-ui/board-fixture.cjs');
const ROOT = path.resolve(__dirname, '../..'), S = ROOT + '/creator-build-project/assets/scripts/', B = ROOT + '/creator-build-project/assets/bundles/board_art/';
const checks = []; const ok = (name, fn) => Promise.resolve().then(fn).then(() => { checks.push(name); console.log('PASS', name); });
const H0 = createHarness(), C = H0.load(S + 'ui/RegionArrivalTitleCore.ts'), BL = H0.load(S + 'ui/BoardLayout.ts'), W = H0.load(S + 'world-r2/WindWipeCore.ts');
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const ALL_SEEN = JSON.stringify(['starlight', 'windbell', 'tidebottle']);
async function board(stageId, opts = {}) {
  const H = createHarness(); if (opts.seen !== null) H.cc.sys.localStorage.setItem('qfl.ui.seenTools', opts.seen || ALL_SEEN);
  if (opts.seenTitles) H.cc.sys.localStorage.setItem(C.SEEN_REGION_TITLE_KEY, JSON.stringify(opts.seenTitles));
  const s = snapshot('mainline-v33', opts.region || 1); s.active.stageId = stageId; if (opts.notice) s.notice = opts.notice;
  const b = createBoard({ harness: H, snapshot: s, region: opts.region || 1 }); await H.flush(); b.render(); b.u.update(0); return b;
}
const titleOp = b => b.u.regionTitle.node.getComponent(b.H.cc.UIOpacity).opacity;
const toastOp = b => b.u.toast.getComponent(b.H.cc.UIOpacity).opacity;
const all = (x, o = []) => { o.push(x); for (const ch of x.children) all(ch, o); return o; };
(async () => {
  await ok('timeline §5: 0 s α0 +6 pt, ease-out cubic in to 0.4 s, hold to 1.6 s, ease-in quad out, done at 2.0 s', () => {
    assert(near(C.REGION_TITLE_TOTAL_S, 2.0)); const s0 = C.regionTitleState(0); assert.equal(s0.alpha, 0); assert.equal(s0.dy, 6);
    const m = C.regionTitleState(0.2); assert(near(m.alpha, 1 - 0.125)); assert(near(m.dy, 6 * 0.125));
    for (const t of [0.4, 1.0, 1.599]) assert.deepEqual(C.regionTitleState(t), { alpha: 1, dy: 0, done: false });
    assert(near(C.regionTitleState(1.8).alpha, 0.75)); assert.equal(C.regionTitleState(1.8).dy, 0); assert.equal(C.regionTitleState(2.0).done, true);
  });
  await ok('style switch §10: default B; A kept as backup; __qfConfig.regionTitleStyle overrides; B params = spec_params.json "B"', () => {
    const P = JSON.parse(fs.readFileSync(ROOT + '/ui-design/region-title/spec_params.json', 'utf8'));
    assert.equal(C.REGION_TITLE_STYLE.style, 'B'); assert.equal(C.regionTitleStyle(), 'B'); assert.equal(C.regionTitleTable(), C.REGION_TITLE_B);
    globalThis.__qfConfig = { regionTitleStyle: 'A' }; assert.equal(C.regionTitleStyle(), 'A'); delete globalThis.__qfConfig;
    const b = C.REGION_TITLE_B, a = C.REGION_TITLE_A;
    assert.equal(b.shadowDayA, P.B.shadow_day_a); assert.equal(b.shadowDayBlur, P.B.shadow_day_blur); assert.equal(b.tightDayA, P.B.tight_day_a); assert.equal(b.tightDaySpread, P.B.tight_day_spread);
    assert.equal(b.tightDayBlur, P.B.tight_day_blur); assert.deepEqual([...b.haloDay], P.B.halo_rgb); assert.equal(b.haloDayA, P.B.halo_a); assert.deepEqual([...b.haloNight], P.B.halo_rgb_night); assert.equal(b.haloNightA, P.B.halo_a_night);
    assert.equal(b.tightNightA, P.B.tight_night_a); assert.equal(b.tightNightSpread, P.B.tight_night_spread); assert.equal(b.haloPadX, P.B.halo_padx); assert.equal(b.haloPadY, P.B.halo_pady);
    assert.equal(a.shadowDayA, P.shadow_day_a); assert.equal(a.glowNightA, P.glow_night_a); assert.deepEqual([...a.fillDay], P.fill_day); assert.deepEqual([...a.fillNight], P.fill_night); assert.equal(a.nightAlpha, P.night_alpha);
  });
  await ok('night §10.3: B has no light-blue glow (α 0 at any night weight), dark halo #141C34 α0.22, text #E8EEFF α0.9; A night keeps glow 0.38', () => {
    for (const w of [0, 0.5, 1]) assert.equal(C.regionTitleLook(w, C.REGION_TITLE_B).glowA, 0);
    const n = C.regionTitleLook(1, C.REGION_TITLE_B); assert.equal(n.shadowA, 0, 'Label shadow off at night'); assert.deepEqual(n.haloRgb, [20, 28, 52]); assert(near(n.haloA, 0.22)); assert.deepEqual(n.fill, [232, 238, 255]); assert(near(n.maxAlpha, 0.9));
    const d = C.regionTitleLook(0, C.REGION_TITLE_B); assert.deepEqual(d.fill, [255, 248, 236]); assert(near(d.shadowA, 0.6)); assert(near(d.haloA, 0.24)); assert.equal(d.maxAlpha, 1);
    assert(near(C.regionTitleLook(1, C.REGION_TITLE_A).glowA, 0.38)); assert.equal(C.regionTitleLook(1, C.REGION_TITLE_A).haloA, 0);
  });
  await ok('names §2: L5 花粉草甸, L9 天空之城, L13 风铃湖畔 (+ r04-lake-*); island L1–4 none; chapter name 天空回声 untouched', () => {
    assert.deepEqual(C.REGION_TITLE, { meadow: '花粉草甸', skycity: '天空之城', lakeside: '风铃湖畔' });
    assert.equal(C.regionForStage('mainline-05'), 'meadow'); assert.equal(C.regionForStage('mainline-09'), 'skycity'); assert.equal(C.regionForStage('mainline-13'), 'lakeside');
    assert.equal(C.regionForStage('r04-lake-01'), 'lakeside'); for (const id of ['mainline-01', 'mainline-04', 'test', null]) assert.equal(C.regionForStage(id), null);
    assert(/sky[^\n]*天空回声/.test(fs.readFileSync(S + 'ui/IslandPanels.ts', 'utf8')), 'CHAPTERS sky = 天空回声');
    const gl = fs.readdirSync(S + 'ui').filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(S + 'ui/' + f, 'utf8')).join('\n'); assert(!/天空回声[^\n]*天空之城|REGION_TITLE[^\n]*天空回声/.test(gl));
  });
  await ok('7 sizes §4/§8.5: ink block (incl. the 6 pt rise) centred on toast.y clears the info plate and the tray; ≥ 32 pt side margins', () => {
    for (const [w, h] of [[320, 568], [360, 780], [375, 667], [390, 844], [402, 874], [414, 896], [430, 932]]) {
      const g = BL.boardLayout(w, h, BL.boardSafeInsets(w, h), 2), ink = C.regionTitleInk('风铃湖畔', w), top = g.toast.y - ink.h / 2, bot = g.toast.y + ink.h / 2;
      assert(top >= g.plate.y + g.plate.height / 2 - 1e-9, `${w}x${h} ink top ${top} over the plate`); assert(bot <= g.tray.y - g.tray.height / 2 + 1e-9, `${w}x${h} ink over the tray`);
      assert((w - ink.w) / 2 >= 32, `${w}x${h} margins`); assert.equal(ink.font, 24);
    }
    assert(near(C.regionTitleInk('花粉草甸', 390).w, 4 * 24 + 3 * 3.6));
  });
  await ok('board L5: 花粉草甸 shows after presentForPlay on toast.y, above the Toast, 2.0 s, no input blocker; the flag is written at start', async () => {
    const b = await board('mainline-05'), { u, H } = b, d = u.regionTitle.diagnostics();
    assert.equal(d.showing, true); assert.equal(d.text, '花粉草甸'); assert.equal(u.regionTitle.main.string, '花粉草甸');
    const g = u.geo, h = u.layoutInfo.height; assert(near(u.regionTitle.node.position.y, h / 2 - g.toast.y));
    const kids = u.root.children; assert(kids.indexOf(u.regionTitle.node) > kids.indexOf(u.toast), 'title above the toast');
    assert(!all(u.regionTitle.node).some(x => (x.components || []).some(k => /BlockInput|Button/.test(k?.constructor?.name || ''))), 'no blocker / button');
    assert(!all(u.regionTitle.node).some(x => (x._ev && [...x._ev.keys()].some(k => /touch|mouse/i.test(k)))), 'no touch listeners');
    assert.deepEqual(JSON.parse(H.cc.sys.localStorage.getItem('qfl.ui.seenRegionTitle')), { meadow: 1 });
    b.step(0.4); assert(titleOp(b) >= 250); b.step(1.2); assert(titleOp(b) >= 250, 'holding'); b.step(0.45); assert.equal(titleOp(b), 0); assert.equal(u.regionTitle.showing(), false); assert.equal(u.regionTitle.node.active, false);
  });
  await ok('touches land during the title: a cell tap reaches the board at frame 0 (input clears the auto hint)', async () => {
    const b = await board('mainline-09', { hintCells: [3] }), { u, H } = b; assert.equal(u.regionTitle.diagnostics().text, '天空之城');
    u.hintCells = [3]; const e = H.event(H.point(u.cells[20])); u.cells[20].emit('touch-start', e); assert.deepEqual(u.diagnostics().hintCells, [], 'touch reached the cell'); u.cells[20].emit('touch-end', e);
  });
  await ok('once per region §6: second entry into the same region (restart, reload) shows nothing; another region still does', async () => {
    const b1 = await board('mainline-06', { seenTitles: { meadow: 1 } }); assert.equal(b1.u.regionTitle.showing(), false);
    const b2 = await board('mainline-13', { seenTitles: { meadow: 1, skycity: 1 } }); assert.equal(b2.u.regionTitle.diagnostics().text, '风铃湖畔');
    const b3 = await board('mainline-03'); assert.equal(b3.u.regionTitle.showing(), false, 'island: no title');
    const ro = snapshot('mainline-v33', 1); ro.active.stageId = 'mainline-05'; ro.readOnly = true; assert.equal(C.regionTitleFor(ro, null), null, 'read-only board');
  });
  await ok('queue §7: an item tip during the title waits and shows after it; a cancelled tool tip is dropped; auto-hint counts from the end', async () => {
    const b = await board('mainline-05'), { u, H, log } = b;
    H.tap(u.tools[1]); assert.notEqual(u.diagnostics().toast, '风语铃 · 点选目标', 'not on the toast during the title'); assert.equal(u.titleGate.pending(), 1);
    b.step(1.0); assert.equal(toastOp(b), 0); b.step(1.1); assert.equal(u.diagnostics().toast, '风语铃 · 点选目标', 'shown after the title'); assert.equal(log.hints, 0);
    const c = await board('mainline-09'); c.H.tap(c.u.tools[1]); c.H.tap(c.u.tools[1])/* cancel: 已收回 */; c.step(2.1);
    assert.equal(c.u.diagnostics().toast, '已收回，道具没有消耗', 'cancelled tool tip dropped, the later tip kept');
    const d = await board('mainline-13', { hintCells: [3] }); d.step(2.0); const at = d.log.hints; d.step(4.8); assert.equal(d.log.hints, at, 'no auto hint < 5 s after the title'); d.step(0.4); assert.equal(d.log.hints, at + 1);
  });
  await ok('queue §7: 「关卡已调整，从头开始」 waits for the title, then shows (0.3/2/0.3) before queued tips', async () => {
    const b = await board('mainline-13', { notice: { text: '关卡已调整，从头开始' } }), { u, H } = b; b.binding.clearNotice = () => { };
    H.tap(u.tools[1]); assert.notEqual(u.diagnostics().toast, '关卡已调整，从头开始'); b.step(1.9); assert.notEqual(u.diagnostics().toast, '关卡已调整，从头开始');
    b.step(0.2); assert.equal(u.diagnostics().toast, '关卡已调整，从头开始'); b.step(2.8); assert.equal(u.diagnostics().toast, '风语铃 · 点选目标', 'tip after the notice');
  });
  await ok('queue §7: a first-time tool intro (e.g. 星光) opens only after the title', async () => {
    const b = await board('mainline-09', { seen: null }), { u } = b; b.step(1.5); assert.equal(u.popups.any(), false, 'no intro during the title');
    b.step(0.7); assert.equal(u.popups.any(), true, 'intro after the title');
  });
  await ok('transitions §1: no place-name sign or 「回到小岛」 anywhere in a transition; the vehicle stays', () => {
    for (const to of ['meadow', 'skycity', 'lakeside', 'ending', 'island', null]) assert.equal(W.wipeContentFor(to).sign, null, String(to));
    assert.equal(W.wipeContentFor('meadow').vehicle, 'sailboat'); assert.equal(W.wipeContentFor('skycity').vehicle, 'balloon'); assert.equal(W.wipeContentFor('lakeside').vehicle, 'balloon');
    const ww = fs.readFileSync(S + 'ui/WindWipe.ts', 'utf8'), la = fs.readFileSync(S + 'ui/LakesideArrivalUI.ts', 'utf8'), core = fs.readFileSync(S + 'world-r2/WindWipeCore.ts', 'utf8');
    assert(!/WindWipeSign|title_plank|RegionName/.test(ww)); assert(!/LakesideSign|title_plank|RegionName/.test(la)); assert(/LakesideSkip/.test(la), 'skip badge kept'); assert(!/回到小岛|花粉草甸|天空之城|风铃湖畔/.test(core));
  });
  await ok('assets: QFLRegionTitle.ttf (≤ 12 KB, same bytes as the design) + OFL text, each with a Creator .meta; new scripts have .meta', () => {
    const f = B + 'font/QFLRegionTitle.ttf'; assert(fs.statSync(f).size <= 12 * 1024); assert(fs.readFileSync(f).equals(fs.readFileSync(ROOT + '/ui-design/region-title/font/QFLRegionTitle.ttf')));
    const m = JSON.parse(fs.readFileSync(f + '.meta', 'utf8')); assert.equal(m.importer, 'ttf-font'); assert.deepEqual(m.files, ['.json', 'QFLRegionTitle.ttf']);
    for (const p of [B + 'font.meta', B + 'licenses/qfl-region-title-ofl.txt.meta', S + 'ui/RegionArrivalTitle.ts.meta', S + 'ui/RegionArrivalTitleCore.ts.meta']) assert(/"uuid": "[0-9a-f-]{36}"/.test(fs.readFileSync(p, 'utf8')), p);
    assert(/Open Font License/.test(fs.readFileSync(B + 'licenses/qfl-region-title-ofl.txt', 'utf8')));
  });
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length }));
})().catch(e => { console.error(e); process.exit(1); });
