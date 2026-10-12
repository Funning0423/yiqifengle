'use strict';
// Board-UI runtime (INTEGRATION §2–§7, §13): HUD = pause + info plate only; 2 s toast; idle auto hint (5 s / 8 s, no
// action submitted); pause panel flow (resume / restart confirm / bag / settings / home without confirm / music + sfx);
// result pages driven by host actions; reward popup on claim; first-time tool intros; night tint; beacon route; swap
// shake. Real ManagedMobileBoardUI + PopupKit panels on the board-ui harness (no rendering, no WeChat).
const assert = require('node:assert/strict');
const { createBoard } = require('./board-fixture.cjs');
const { createHarness } = require('./harness.cjs');
const checks = [];
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { checks.push(name); console.log('PASS', name); });
const ALL_SEEN = JSON.stringify(['starlight', 'windbell', 'tidebottle']);
async function board(opts = {}, seen = ALL_SEEN) {
  const H = createHarness(); if (seen) H.cc.sys.localStorage.setItem('qfl.ui.seenTools', seen);
  const b = createBoard({ harness: H, ...opts }); await H.flush(); b.render(); b.u.update(0); return b;
}
const names = b => b.u.popups.names(), top = b => names(b).slice(-1)[0] || null;
const inPopup = (b, panel, name) => b.u.popups.find(panel)?.root.find(name) || null;
const labels = (b, panel) => b.u.popups.find(panel).root.getComponentsInChildren(b.H.cc.Label).map(l => l.string);
(async () => {
  await ok('HUD: only the pause button and the info plate (title, goals, moves); no back / bag / retry / hint / status line', async () => {
    const b = await board(), { u, s } = b; s.active.name = '潮声'; b.render();
    assert.deepEqual(u.root.getChildByName('LightGoalHUD').children.map(n => n.name), ['pause', 'InfoPlate']);
    for (const n of ['back', 'bagBtn', 'retryBtn', 'hintBtn', 'StatusLine', 'ToolLabel', 'Backpack', 'RetryConfirm']) assert(!u.root.find(n), 'removed: ' + n);
    assert.equal(u.titleLabel.string, '01  潮声'); assert.equal(u.moves.string, '20'); assert.equal(u.goalNodes.filter(n => n.active).length, 1); assert.equal(u.goalLabels[0].string, '20');
    assert.equal(u.managedViewVersion(), 'mobile-managed-v2-board-ui'); assert.equal(u.cells.length, 49);
    const plate = u.plateSprite; assert(plate.spriteFrame, 'plate art loaded'); assert.equal(plate.type, b.H.cc.Sprite.Type.SLICED);
  });
  await ok('toast: tool prompts show for 2 s then fade out; a new message restarts the timer', async () => {
    const b = await board(), { H, u } = b, op = () => u.root.getChildByName('Toast').getComponent(H.cc.UIOpacity).opacity;
    H.tap(u.tools[1]); assert.equal(u.diagnostics().toast, '风语铃 · 点选目标'); b.step(0.3); assert.equal(op(), 255);
    b.step(1.6); assert.equal(op(), 255, 'still visible at 1.9 s'); b.step(0.5); assert.equal(op(), 0, 'gone after 2 s + 0.3 s fade');
    H.tap(u.tools[1]); b.step(0.3); assert.equal(op(), 255);
  });
  await ok('auto hint: after 5 s idle the managed hint lights cells, again 8 s later; input clears it; no action or command is sent', async () => {
    const b = await board({ hintCells: [3, 10] }), { H, u, log } = b;
    b.step(4.9); assert.equal(log.hints, 0); b.step(0.2); assert.equal(log.hints, 1); assert.deepEqual(u.diagnostics().hintCells, [3, 10]);
    b.step(8); assert.equal(log.hints, 2);
    const e = H.event(H.point(u.cells[20])); u.cells[20].emit('touch-start', e); assert.deepEqual(u.diagnostics().hintCells, [], 'input clears the hint'); u.cells[20].emit('touch-end', e);
    b.step(4.9); assert.equal(log.hints, 2, 'input restarts the 5 s wait');
    assert.deepEqual(log.submits, []); assert(!log.commands.some(c => /hint/i.test(c[0])), 'hint is presentation only (no star penalty)');
    H.tap(u.pause); const before = log.hints; b.step(12); assert.equal(log.hints, before, 'no hints while paused');
  });
  await ok('lock return: hidden→visible while paused opens the full pause panel on the next tick; leaving run.paused closes it', async () => {
    const b = await board(), { u, s, log } = b;
    s.hidden = true; s.state = 'run.paused'; b.render(); assert.equal(top(b), null, 'still hidden: no pause panel yet');
    s.hidden = false; b.render(); assert.equal(top(b), null, 'panel waits for the board tick so a same-turn resume does not flash it');
    u.update(0.016); assert.equal(top(b), 'PausePanel'); assert.equal(u.popups.find('PausePanel').options.title, '暂停一下');
    for (const n of ['Tile-重来', 'Tile-行囊', 'Tile-设置', 'Resume', 'Home']) assert(inPopup(b, 'PausePanel', n), n);
    assert.deepEqual(log.commands, [], 'already paused: opening the panel does not pause again');
    s.state = 'run.ready'; b.render(); assert.equal(top(b), null, 'resume already happened: the pause panel closes');
    const stayed = await board(); stayed.s.hidden = true; stayed.s.state = 'result.saved'; stayed.render(); stayed.s.hidden = false; stayed.render(); stayed.u.update(0.016);
    assert.equal(names(stayed).includes('PausePanel'), false, 'a result page is not a pause panel');
  });
  await ok('pause panel: pause → PausePanel (3 tiles, music + sfx toggles, resume, home); resume sends resume after the close animation', async () => {
    const b = await board(), { H, u, s, log } = b;
    H.tap(u.pause); assert.deepEqual(log.commands.map(c => c[0]), ['pause']); assert.equal(s.state, 'run.paused'); assert.equal(top(b), 'PausePanel');
    for (const n of ['Tile-重来', 'Tile-行囊', 'Tile-设置', 'MusicToggle', 'SfxToggle', 'Resume', 'Home']) assert(inPopup(b, 'PausePanel', n), n);
    assert(!inPopup(b, 'PausePanel', 'Close'), 'pause is not closable by ×'); assert(!labels(b, 'PausePanel').some(t => /提示/.test(t)), 'no manual hint');
    assert(labels(b, 'PausePanel').includes('01 test · 还剩 20 步'));
    H.tap(u.pause); assert.equal(log.commands.length, 1, 'pause under a popup does nothing');
    H.tap(inPopup(b, 'PausePanel', 'Resume')); b.step(0.3); assert.deepEqual(log.commands.map(c => c[0]), ['pause', 'resume']); assert.equal(s.state, 'run.ready'); assert.deepEqual(names(b), []);
  });
  await ok('pause → 重来 asks first (留下 keeps the pause page); 重来 restarts; 回到小岛 exits at once without a confirm', async () => {
    const b = await board(), { H, u, log } = b;
    H.tap(u.pause); H.tap(inPopup(b, 'PausePanel', 'Tile-重来')); assert.equal(top(b), 'RestartConfirm');
    H.tap(inPopup(b, 'RestartConfirm', 'Stay')); b.step(0.3); assert.equal(top(b), 'PausePanel'); assert.equal(log.restarts, 0);
    H.tap(inPopup(b, 'PausePanel', 'Tile-重来')); H.tap(inPopup(b, 'RestartConfirm', 'Restart')); b.step(0.3); assert.equal(log.restarts, 1); assert(!names(b).includes('PausePanel'));
    const c = await board(); c.H.tap(c.u.pause); c.H.tap(inPopup(c, 'PausePanel', 'Home')); assert.deepEqual(c.log.commands.map(x => x[0]), ['pause', 'requestExit']); assert.deepEqual(names(c), []);
  });
  await ok('pause → 行囊 (level bag: tools, no pearl, earned chests open via openChest) and → 设置 (full settings); toggles drive GameAudio', async () => {
    const b = await board(), { H, u, s, log } = b; s.journey.chests = [{ level: 0, earned: true, opened: false, name: '潮声' }]; b.render();
    H.tap(u.pause); H.tap(inPopup(b, 'PausePanel', 'Tile-行囊')); assert.equal(top(b), 'BagPanel'); assert(!labels(b, 'BagPanel').some(t => /珍珠/.test(t)));
    const Art = H.load('ui/BoardArt'), lib = Art.BoardArt.shared();
    for (const [name, key] of [['tool_tidenet', 'r2/tool_tidenet'], ['tool_sunseed', 'r2/tool_sunseed'], ['tool_starshears', 'r2/tool_starshears']]) {
      const n = inPopup(b, 'BagPanel', name); assert(n, name); assert.equal(n.getComponent(H.cc.Sprite).spriteFrame, lib.frame(key));
    }
    assert.equal(inPopup(b, 'BagPanel', 'tool_windbell').getComponent(H.cc.Sprite).spriteFrame, lib.frame('board/tool_windbell'), 'level bag mainline stays on the board slice');
    H.tap(inPopup(b, 'BagPanel', 'OpenChest-0')); b.step(0.3); assert.deepEqual(log.commands.at(-1), ['openChest', 0]);
    H.tap(inPopup(b, 'PausePanel', 'Tile-设置')); assert.equal(top(b), 'SettingsPanel'); for (const n of ['MusicVolume', 'SfxToggle', 'ReducedMotion', 'AboutRow']) assert(inPopup(b, 'SettingsPanel', n), n);
    const vis = n => { const t = n.getComponent(H.cc.UITransform); return [Math.round(t.width * n.scale.x), Math.round(t.height * n.scale.y)]; };
    const dayPlate = inPopup(b, 'SettingsPanel', 'Day').find('Plate');
    assert.deepEqual(vis(dayPlate), [136, 62], 'day button keeps its design size');
    assert.equal(dayPlate.getComponent(H.cc.Sprite).type, H.cc.Sprite.Type.SLICED);
    assert.equal(dayPlate.getComponent(H.cc.Sprite).spriteFrame.insetLeft, 207);
    assert.ok(dayPlate.getComponent(H.cc.Sprite).spriteFrame.originalSize.height >= 312);
    const frameN = inPopup(b, 'SettingsPanel', 'PanelFrame');
    assert.deepEqual(vis(frameN), [680, 768], 'settings frame keeps its design size');
    assert.equal(frameN.getComponent(H.cc.Sprite).spriteFrame.insetTop, 276);
    const music = inPopup(b, 'SettingsPanel', 'icon_music');
    assert.equal(music.getComponent(H.cc.UITransform).height, 56);
    assert.equal(music.scale.x, 1, 'unsliced icons stay in their box');
    assert(labels(b, 'SettingsPanel').includes('v0.1 · 构建 dev'));
    H.tap(inPopup(b, 'SettingsPanel', 'AboutRow')); assert.equal(top(b), 'AboutPanel'); assert(labels(b, 'AboutPanel').includes('v0.1 · 构建 dev'));
    b.u.popups.close('AboutPanel'); b.u.popups.close('SettingsPanel'); b.step(0.3);
    const knob = t => inPopup(b, 'PausePanel', t); H.tap(knob('SfxToggle')); assert(H.audioLog.includes('sfx:true')); H.tap(knob('MusicToggle')); assert(H.audioLog.includes('music:0'));
    H.tap(knob('MusicToggle')); assert(H.audioLog.includes('music:0.4'), 'music comes back to the previous volume');
    const bag2 = await board({ provider: 'regional-r05', region: 0 }); bag2.H.tap(bag2.u.pause); const t = inPopup(bag2, 'PausePanel', 'Tile-行囊'); bag2.H.tap(t); assert.equal(top(bag2), 'PausePanel', 'regional stages have no bag');
  });
  await ok('result pages: win with host chest/next actions, 差一点点 lose + replay, 还没存上 grey chest + retry save, 旅途回顾 read-only', async () => {
    const b = await board(), { H, u, s, log } = b; let chest = 0, next = 0;
    s.state = 'result.saved'; s.active.status = 'won'; s.result = { stars: 3 }; s.journey.chests = [{ level: 0, earned: true, opened: false }]; b.render();
    u.setHostActions({ chest: { visible: true, run: () => chest++ }, mainNext: { visible: true, run: () => next++ } }); b.step(0.3);
    let p = u.popups.find('ResultPanel'); assert(p); assert.equal(p.options.title, '过关啦'); assert.equal(u.hostModalOpen(), false, 'result page is not a board modal');
    H.tap(inPopup(b, 'ResultPanel', 'Claim-chest')); assert.equal(chest, 1); H.tap(inPopup(b, 'ResultPanel', 'Next')); assert.equal(next, 1);
    H.tap(inPopup(b, 'ResultPanel', 'Home')); assert.deepEqual(log.commands.at(-1), ['requestExit']);
    const reg = await board(); reg.s.state = 'result.saved'; reg.s.active.status = 'won'; reg.s.result = { stars: 1 }; reg.s.journey.regionRewards = [{ region: 0, unlocked: true, claimed: false }]; reg.render();
    const net = inPopup(reg, 'ResultPanel', 'tool_tidenet'); assert(net, 'result region reward uses the tide-net slice');
    assert.equal(net.getComponent(reg.H.cc.Sprite).spriteFrame, reg.H.load('ui/BoardArt').BoardArt.shared().frame('r2/tool_tidenet'));
    const lose = await board(); lose.s.state = 'result.saved'; lose.s.active.status = 'lost'; lose.render(); p = lose.u.popups.find('ResultPanel'); assert.equal(p.options.title, '差一点点'); assert.equal(p.options.titleArt, 'popup/title_5');
    lose.H.tap(inPopup(lose, 'ResultPanel', 'Replay')); assert.deepEqual(lose.log.commands.at(-1), ['startStage', 'test', {}]);
    const uns = await board(); uns.s.state = 'run.unsaved'; uns.s.active.status = 'won'; uns.render(); p = uns.u.popups.find('ResultPanel'); assert.equal(p.options.title, '还没存上');
    assert(labels(uns, 'ResultPanel').includes('存好后就能打开')); uns.H.tap(inPopup(uns, 'ResultPanel', 'RetrySave')); assert.deepEqual(uns.log.commands.at(-1), ['retrySave']);
    const ro = await board(); ro.s.state = 'error.readonly'; ro.s.active.status = 'won'; ro.render(); assert.equal(ro.u.popups.find('ResultPanel').options.title, '旅途回顾'); assert.equal(ro.u.popups.find('ResultPanel').options.titleArt, 'r2/title_review');
  });
  await ok('reward popup: a chest opened while the board is up shows 获得 with the gained tools; closing queues the first-time intro', async () => {
    const snap = require('./board-fixture.cjs').snapshot(); snap.journey.inventory.tools.windBell = 0;
    const b = await board({ snapshot: snap }, JSON.stringify(['starlight', 'tidebottle'])), { u, s } = b; assert.deepEqual(names(b), [], 'no windBell in stock yet: nothing to introduce');
    s.journey.chests = [{ level: 0, earned: true, opened: false }]; b.render();
    s.journey.chests = [{ level: 0, earned: true, opened: true }]; s.journey.inventory.tools.windBell += 1; b.render();
    assert.equal(top(b), 'RewardPanel'); assert(labels(b, 'RewardPanel').includes('风语铃 ×1'));
    b.H.tap(inPopup(b, 'RewardPanel', 'Accept')); b.step(0.3); assert.equal(top(b), 'ToolIntroPanel', 'unseen windBell is introduced after the reward');
    assert.equal(u.popups.top().options.title, '风语铃');
  });
  await ok('tool intro: each bar tool is introduced once (qfl.ui.seenTools), never again on the next board', async () => {
    const b = await board({}, null), { H, u } = b, seen = [];
    for (let i = 0; i < 5 && top(b) === 'ToolIntroPanel'; i++) { seen.push(u.popups.top().options.title); H.tap(inPopup(b, 'ToolIntroPanel', 'GotIt')); b.step(0.3); }
    assert.deepEqual(seen, ['星光', '风语铃', '潮汐瓶']); assert.deepEqual(JSON.parse(H.cc.sys.localStorage.getItem('qfl.ui.seenTools')).sort(), ['starlight', 'tidebottle', 'windbell']);
    const again = createBoard({ harness: H }); await H.flush(); again.render(); again.step(0.5); assert(!again.u.popups.names().includes('ToolIntroPanel'));
  });
  await ok('night: board sprites multiply by K_UI, text recolours, board tiles too; back to day restores', async () => {
    const b = await board(), { H, u } = b, N = H.load('ui/NightTint');
    globalThis.__worldDayNight = { snapshot: () => ({ mode: 'night' }) }; N.resetUiNightWeight(); u.update(0);
    const c = u.plateSprite.color; assert.deepEqual([c.r, c.g, c.b], N.tintRgb('ui', 1)); const t = u.titleLabel.color; assert.deepEqual([t.r, t.g, t.b], N.TEXT_NIGHT.brown);
    const tile = u.root.find('Base-0').getComponent(H.cc.Sprite).color; assert.deepEqual([tile.r, tile.g, tile.b], N.tintRgb('ui', 1));
    globalThis.__worldDayNight = { snapshot: () => ({ mode: 'day' }) }; N.resetUiNightWeight(); u.update(0); const d = u.plateSprite.color; assert.deepEqual([d.r, d.g, d.b], [255, 255, 255]);
    delete globalThis.__worldDayNight; N.resetUiNightWeight();
  });
  await ok('beacon cell: lighthouse + ring on the current target, faint dots for beaconRoute.slice(cursor + 1)', async () => {
    const b = await board(), { u, s } = b; s.active.beaconTarget = { index: 22, type: null, cursor: 0, total: 3, typed: false }; s.active.beaconRoute = [22, 24, 26]; s.active.goals = { beacons: 3 }; s.active.goalOrder = ['beacons']; b.render();
    const ring = u.root.find('BeaconRing'), c22 = u.cells[22].position; assert(ring.activeInHierarchy); assert.deepEqual([ring.position.x, ring.position.y], [c22.x, c22.y]);
    const dots = u.marks.ops.filter(o => o[0] === 'circle' && o[3] === 5); assert.equal(dots.length, 2, 'one dot per later beacon');
    const P = u.cell; for (const [i, d] of [[24, dots[0]], [26, dots[1]]]) { const p = u.cells[i].position; assert(Math.abs(d[1] - p.x) < 1e-6 && Math.abs(d[2] - (p.y - P * 0.4)) < 1e-6); }
    s.active.beaconTarget = { index: 26, type: null, cursor: 2, total: 3, typed: false }; b.render(); assert.equal(u.marks.ops.filter(o => o[0] === 'circle' && o[3] === 5).length, 0, 'last beacon: no route left');
    s.active.beaconTarget = null; b.render(); assert(!u.root.find('BeaconArt').children.some(n => n.activeInHierarchy && n.name !== 'BeaconTypeCoin'), 'no beacon art without a target');
  });
  await ok('invalid swap: no commit, both pieces shake (reduced motion: no shake)', async () => {
    const b = await board({ command: n => n === 'previewAction' ? { ok: false, reason: 'no-match' } : null }), { H, u, log } = b;
    const n = 0, e = H.event(H.point(u.cells[n])), to = H.event({ x: H.point(u.cells[n]).x + 40, y: H.point(u.cells[n]).y });
    H.cc._tweens.length = 0; u.cells[n].emit('touch-start', e); u.cells[n].emit('touch-move', to); u.cells[n].emit('touch-end', to);
    assert.deepEqual(log.commands.map(c => c[0]), ['previewAction']); const shaken = new Set(H.cc._tweens.map(t => t.target.parent?.name)); assert(shaken.has('Tile-0') && shaken.has('Tile-1'), [...shaken].join());
    H.cc.sys.localStorage.setItem('forest-v33-reduced-motion', 'true'); H.cc._tweens.length = 0; u.cells[n].emit('touch-start', e); u.cells[n].emit('touch-move', to); u.cells[n].emit('touch-end', to); assert.equal(H.cc._tweens.filter(t => t.target.name === 'ProjectPieceArt').length, 0);
  });
  await ok('settings music slider: drag updates the volume, release and cancel keep it', async () => {
    const b = await board(), { H, u } = b;
    H.tap(u.pause); H.tap(inPopup(b, 'PausePanel', 'Tile-设置')); b.step(0.3);
    const slider = inPopup(b, 'SettingsPanel', 'MusicVolume'); assert(slider, 'MusicVolume');
    const scale = (() => { let k = 1, n = slider; while (n) { k *= n.scale.x || 1; n = n.parent; } return k || 1; })();
    const rail = 236, last = () => { const xs = H.audioLog.filter(x => x.startsWith('music:')); return xs.length ? Number(xs[xs.length - 1].slice(6)) : null; };
    const knobX = () => slider.getChildByName('Knob').position.x;
    const gesture = (dx, how) => {
      const start = H.point(slider), id = 4, end = { x: start.x + dx, y: start.y };
      slider.emit('touch-start', H.event(start, id)); slider.emit('touch-move', H.event(end, id)); slider.emit(how, H.event(end, id));
    };
    gesture(0.6 * rail * scale, 'touch-end');
    assert(Math.abs(last() - 1) < 1e-6, 'drag to the right end is full volume ' + last());
    assert(Math.abs(knobX() - rail / 2) < 1e-6, 'knob stays at the released end');
    gesture(-rail * scale, 'touch-cancel');
    assert(last() === 0, 'drag to zero sticks after the gesture is cancelled');
    assert(Math.abs(knobX() + rail / 2) < 1e-6, 'knob stays at zero and does not snap back');
    H.tap(inPopup(b, 'SettingsPanel', 'SfxToggle')); assert(H.audioLog.includes('sfx:true'), 'sfx toggle still mutes');
  });
  await ok('teardown: onDestroy clears popups and host; later updates are inert', async () => {
    const b = await board(), { H, u } = b; H.tap(u.pause); u.onDestroy(); assert.deepEqual(u.popups.names(), []); u.update(1); u.onDestroy();
  });
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, scope: 'Real board-ui ManagedMobileBoardUI + panels on Cocos memory doubles (tools/board-ui/harness.cjs); not rendering, device touch or WeChat' }));
})().catch(e => { console.error(e); process.exit(1); });
