'use strict';
// v2 spec (provisional): Next/Home before opening auto-claims the ready rewards first; input-lifecycle checks compare
// the navigation part only (test_result_screen_style asserts the auto-claim itself).
const nav = c => c.some(x => x === 'Next' || x === 'Home') ? c.filter(x => !/^Claim-/.test(x) && x !== 'chest' && x !== 'regionReward') : c;
/** Actual TS/node regressions. Logical UI geometry only; never a Cocos/device screenshot.
 * QF_RESULT_SAFE_SOURCE can point at an immutable baseline for a negative control.
 * QF_RESULT_SAFE_OUTPUT selects a separate evidence directory. */
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const ROOT = process.env.QF_RESULT_SAFE_SOURCE || path.resolve(__dirname, '../..');
const OUT = process.env.QF_RESULT_SAFE_OUTPUT;
const sourceHashes = () => Object.fromEntries(['creator-build-project/assets/scripts/ManagedMobileBoardUI.ts', 'creator-build-project/assets/scripts/ui/PopupKit.ts', 'creator-build-project/assets/scripts/ui/BoardPanels.ts'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const initialHashes = sourceHashes();
const { createHarness } = require(path.join(ROOT, 'tools/board-ui/harness.cjs'));
const { createBoard, snapshot: boardSnapshot } = require(path.join(ROOT, 'tools/board-ui/board-fixture.cjs'));
const rows = [], checks = [], noop = () => { };
const record = (name, fn) => { try {
    fn();
    checks.push({ name, ok: true });
}
catch (e) {
    checks.push({ name, ok: false, error: e.stack });
} };
const reward = (id, state = 'ready', label) => ({ id, state, label: label || (id === 'chest' ? '打开宝箱' : '领取地区道具'), icon: id === 'chest' ? 'popup/chest_closed' : 'popup/reward_seal_tide', iconKind: id === 'chest' ? 'chest' : 'seal' });
const cases = [
    { name: 'win-complex', kind: 'win', rewards: [reward('chest'), reward('regionReward')], next: true },
    ...['ready', 'claimed', 'locked'].flatMap(state => [
        { name: 'win-' + state, kind: 'win', rewards: [reward('chest', state), reward('regionReward', state)], next: true },
        { name: 'win-one-' + state, kind: 'win', rewards: [reward('chest', state)], next: false },
    ]),
    { name: 'win-mixed', kind: 'win', rewards: [reward('chest', 'claimed'), reward('regionReward')], next: true },
    { name: 'win-empty', kind: 'win', rewards: [], next: false },
    { name: 'win-extreme', kind: 'win', score: Number.MAX_SAFE_INTEGER, movesUsed: 999999999999, movesLeft: 999999999999, rewards: [reward('chest', 'ready', '超长测试奖励名称ABCDEFGHIJKLMNOPQRSTUVWXYZ领取宝箱奖励'.repeat(3)), reward('regionReward', 'claimed', '地区道具已领取'.repeat(5))], next: true },
    { name: 'win-three', kind: 'win', rewards: [reward('chest'), reward('regionReward'), reward('seal', 'locked', '地区印记尚未解锁')], next: true },
    ...[false, true].flatMap(chestHint => [false, true].map(replay => ({ name: 'lose-' + chestHint + '-' + replay, kind: 'lose', chestHint, replay }))),
    { name: 'lose-extreme', kind: 'lose', goals: [{ art: 'board/piece_leaf', count: Number.MAX_SAFE_INTEGER }, { art: 'board/piece_flower', count: 999999 }], chestHint: true, replay: true },
    ...[false, true].map(chestHint => ({ name: 'unsaved-' + chestHint, kind: 'unsaved', chestHint })),
    { name: 'readonly', kind: 'readonly' },
];
function model(spec, calls = []) { return { kind: spec.kind, score: spec.score ?? 1234567, stars: 3, movesUsed: spec.movesUsed ?? 15, movesLeft: spec.movesLeft ?? 7, goalsLeft: spec.goals || [{ art: 'board/piece_leaf', count: 20 }, { art: 'board/piece_flower', count: 12 }], chestHint: !!spec.chestHint, rewards: (spec.rewards || []).map(r => ({ ...r, claim: () => calls.push('Claim-' + r.id) })), next: spec.next ? () => calls.push('Next') : null, replay: spec.replay ? () => calls.push('Replay') : null, retrySave: () => calls.push('RetrySave'), home: () => calls.push('Home') }; }
function bounds(H, n, width, height) {
    const ui = n.getComponent(H.cc.UITransform), l = n.getComponent(H.cc.Label);
    const points = [[-ui.width * ui.anchorX, -ui.height * ui.anchorY], [ui.width * (1 - ui.anchorX), -ui.height * ui.anchorY], [ui.width * (1 - ui.anchorX), ui.height * (1 - ui.anchorY)], [-ui.width * ui.anchorX, ui.height * (1 - ui.anchorY)]];
    for (let a = n; a; a = a.parent) {
        const t = ((a.euler?.z || 0) + (a.angle || 0)) * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
        for (const p of points) {
            const x = p[0] * a.scale.x, y = p[1] * a.scale.y;
            p[0] = x * c - y * s + a.position.x;
            p[1] = x * s + y * c + a.position.y;
        }
    }
    const x = Math.min(...points.map(p => p[0] + width / 2)), y = Math.min(...points.map(p => height / 2 - p[1]));
    return { name: n.name, x, y, w: Math.max(...points.map(p => p[0] + width / 2)) - x, h: Math.max(...points.map(p => height / 2 - p[1])) - y, ...(l ? { text: l.string, font: l.fontSize * Math.abs(n.worldScale.y), fontLocal: l.fontSize, line: l.lineHeight * Math.abs(n.worldScale.y), bold: l.isBold } : {}), owner: n.parent?.parent?.name, role: n.listeners('touch-start') ? 'hit' : l ? 'text' : n.name === 'PanelFrame' || n.name === 'TitlePlank' ? 'frame' : 'art' };
}
function inside(b, s) { return b.x >= s.left - 1e-6 && b.y >= s.top - 1e-6 && b.x + b.w <= s.right + 1e-6 && b.y + b.h <= s.bottom + 1e-6; }
function overlap(a, b) { return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-6 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-6; }
function snapshot(H, p, v, meta) {
    const safe = v.safeInsets || {}, s = { left: safe.left || 0, right: v.width - (safe.right || 0), top: Math.max(safe.top || 0, safe.capsule?.bottom || 0), bottom: v.height - (safe.bottom || 0) }, boxes = [], failures = [];
    p.root.walk(n => { if (!n.activeInHierarchy || !n.getComponent(H.cc.UITransform) || ['PopupShade', 'ResultPanel', 'PopupPanel'].includes(n.name))
        return; if (n.listeners('touch-start') || n.getComponent(H.cc.Label) || n.getComponent(H.cc.Sprite) || ['PanelFrame', 'TitlePlank'].includes(n.name))
        boxes.push(bounds(H, n, v.width, v.height)); });
    const hits = boxes.filter(b => b.role === 'hit'), texts = boxes.filter(b => b.role === 'text');
    for (const b of boxes) {
        if (!inside(b, s))
            failures.push({ type: 'outside-safe', box: b });
        if (b.role === 'hit' && (b.w < 44 - 1e-6 || b.h < 44 - 1e-6))
            failures.push({ type: 'small-hit', box: b });
        if (b.role === 'text' && b.font < 14 - 1e-6)
            failures.push({ type: 'small-font', box: b });
    }
    for (let i = 0; i < hits.length; i++)
        for (let j = i + 1; j < hits.length; j++)
            if (overlap(hits[i], hits[j]))
                failures.push({ type: 'hit-overlap', names: [hits[i].name, hits[j].name] });
    for (let i = 0; i < texts.length; i++)
        for (let j = i + 1; j < texts.length; j++)
            if (overlap(texts[i], texts[j]))
                failures.push({ type: 'text-overlap', names: [texts[i].name, texts[j].name] });
    for (const n of [p.root, p.root.find('PopupShade')]) {
        const b = bounds(H, n, v.width, v.height);
        if (Math.abs(b.x) > 1e-6 || Math.abs(b.y) > 1e-6 || Math.abs(b.w - v.width) > 1e-6 || Math.abs(b.h - v.height) > 1e-6)
            failures.push({ type: 'shade-coverage', box: b });
    }
    const supported = s.right - s.left >= 216 && s.bottom - s.top >= 196;
    if (!supported)
        failures.push({ type: 'unsupported-safe-rectangle', width: s.right - s.left, height: s.bottom - s.top, degraded: !p.root.find('Home')?.activeInHierarchy });
    const r = { ...meta, width: v.width, height: v.height, safe: s, supported, boxes, failures };
    rows.push(r);
    return r;
}
function pageCount(H, p) { if (!p.root.find('Home')?.activeInHierarchy)
    return 1; const s = p.root.find('ResultPageNumber')?.getComponent(H.cc.Label).string; return s ? Number(s.split('/')[1].trim()) : 1; }
function pageNumber(H, p) { const s = p.root.find('ResultPageNumber')?.getComponent(H.cc.Label).string; return s ? Number(s.split('/')[0].trim()) : 1; }
function reveal(H, p, name) { let n = p.root.find(name); for (let i = 0; i < pageCount(H, p) && n && !n.activeInHierarchy; i++) {
    const next = p.root.find('ResultNextPage');
    if (pageNumber(H, p) === pageCount(H, p)) {
        const prev = p.root.find('ResultPreviousPage');
        for (let j = pageCount(H, p); j > 1; j--)
            H.tap(prev);
    }
    else
        H.tap(next);
    n = p.root.find(name);
} return n; }
function settle(stack) { for (let i = 0; i < 40; i++)
    stack.update(.025); }
const frames = [[240, 320], [320, 320], [321, 320], [320, 480], [320, 568], [390, 844], [480, 320], [568, 320], [640, 360], [844, 390], [1024, 768]];
const insetModes = { none: (w, h) => ({ top: 0, bottom: 0, left: 0, right: 0 }), host: (w, h) => w < h * 1.1 ? { top: 47, bottom: 34, left: 0, right: 0, capsule: { top: 51, bottom: 87, left: w - 93, right: w - 6 } } : { top: 12, bottom: 21, left: 44, right: 44 }, larger: (w, h) => w < h * 1.1 ? { top: 56, bottom: 40, left: 12, right: 12, capsule: { top: 60, bottom: 84, left: w - 98, right: w - 12 } } : { top: 24, bottom: 34, left: 60, right: 52 } };
async function matrix() {
    for (const loaded of [false, true])
        for (const reduced of [false, true]) {
            const H = createHarness(), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
            H.load('ui/UiPrefs').setReducedMotion(reduced);
            if (loaded)
                await Promise.all(['board', 'popup', 'r2'].map(d => H.load('ui/BoardArt').BoardArt.shared().load(d)));
            let viewport;
            const owner = new H.cc.Node('Owner');
            H.cc._scene.addChild(owner);
            const stack = new K.PopupStack(owner, () => viewport);
            for (const [width, height] of frames)
                for (const [mode, insets] of Object.entries(insetModes))
                    for (const spec of cases) {
                        H.setViewport(width, height);
                        viewport = { width, height, safeInsets: insets(width, height) };
                        const calls = [], m = model(spec, calls), p = P.openResult(stack, m, null), meta = { case: spec.name, loaded, reduced, insets: mode };
                        snapshot(H, p, viewport, { ...meta, phase: 'open', page: 1 });
                        stack.update(.1);
                        snapshot(H, p, viewport, { ...meta, phase: 'opening', page: 1 });
                        settle(stack);
                        const seen = new Set(), allText = new Map();
                        for (let i = 0; i < pageCount(H, p); i++) {
                            const row = snapshot(H, p, viewport, { ...meta, phase: 'settled', page: i + 1 });
                            for (const b of row.boxes.filter(b => b.role === 'hit'))
                                seen.add(b.name);
                            for (const b of row.boxes.filter(b => b.role === 'text'))
                                allText.set(b.name + '|' + (b.owner || ''), { ...b, page: i + 1 });
                            if (i + 1 < pageCount(H, p))
                                H.tap(p.root.find('ResultNextPage'));
                        }
                        const expected = [...(m.kind === 'win' && m.rewards.some(r => r.state === 'ready' && r.claim) ? ['ResultChestTap'] : []), ...(m.kind === 'win' && m.next ? ['Next'] : []), ...(m.kind === 'lose' && m.replay ? ['Replay'] : []), ...(m.kind === 'unsaved' ? ['RetrySave'] : []), 'Home'];
                        record(`reachable ${width}x${height} ${mode} ${spec.name} ${loaded}/${reduced}`, () => { if (p.root.find('Home').activeInHierarchy) {
                            for (const name of expected)
                                assert(seen.has(name), name);
                        }
                        else {
                            assert(!rows.at(-1).supported);
                            assert.equal(seen.size, 0, 'unsupported geometry exposes no actions');
                        } assert.deepEqual(nav(calls), [], 'paging must never claim, leave or retry'); });
                        if (p.root.find('Home').activeInHierarchy)
                            record(`complete text ${width}x${height} ${mode} ${spec.name} ${loaded}/${reduced}`, () => {
                                const fragments = id => [...allText.values()].filter(b => b.name === id || b.name.startsWith(id + '-continued-')).sort((a, b) => (Number(a.name.split('-continued-')[1]) || 0) - (Number(b.name.split('-continued-')[1]) || 0)).map(b => b.text).join('');
                                if (m.kind !== 'lose')
                                    assert.equal(fragments('Score'), m.score + ' 分');
                    if (spec.name === 'win-extreme') assert.equal(new Set([...allText.values()].filter(b => b.name === 'Score' || b.name.startsWith('Score-continued-')).map(b => b.page)).size, 1, 'full numeric score remains on one page');
                                if (m.kind === 'win') {
                                    // SPEC v2.2 text list: a win page has no step line, 成绩已保存, 点宝箱领取, reward names / ×N or unlock hint.
                                    for (const id of ['ResultSummary', 'ResultUnlockHint', 'ResultChestHint']) assert.equal(fragments(id) || '', '', id + ' removed (SPEC v2.2)');
                                    m.rewards.forEach((r, i) => { assert.equal((fragments('ResultRewardLabel-' + i) || '') + (fragments('ResultRewardState-' + i) || ''), '', 'no reward names (SPEC v2.2)'); });
                                    if (m.rewards.some(r => r.state === 'ready' && r.claim)) assert(p.root.find('ResultChestTap'), 'a ready reward page keeps the tap target');
                                }
                                if (m.kind === 'readonly')
                                    assert.equal(fragments('ResultNotice'), '记录暂时不能写入，这局只看不存');
                                if (m.kind === 'readonly') assert.equal(new Set([...allText.values()].filter(b => b.name === 'ResultNotice' || b.name.startsWith('ResultNotice-continued-')).map(b => b.page)).size, 1, 'readonly protection explanation stays on one page');
                                if (m.kind === 'unsaved')
                                    assert.equal(fragments('ResultNotice'), '成绩还没存进旅程册');
                            });
                        stack.clear();
                        record('no lifecycle leak', () => assert.equal(H.cc.game.listeners('hide'), 0));
                    }
            owner.destroy();
        }
}
async function host() {
    for (const [width, height] of [[568, 320], [480, 240], [239, 240], [320, 320], [321, 320], [390, 844]])
        for (const mode of ['default', 'css', 'wx']) {
            const H = createHarness();
            H.cc.sys.localStorage.setItem('qfl.ui.seenTools', '["starlight","windbell","tidebottle"]');
            const old = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle, wx: globalThis.wx };
            if (mode === 'css') {
                globalThis.document = { documentElement: {} };
                globalThis.getComputedStyle = () => ({ getPropertyValue: key => ({ '--safe-left': '12', '--safe-right': '12', '--safe-top': '56', '--safe-bottom': '36' }[key] || '0') });
            }
            if (mode === 'wx')
                globalThis.wx = { getWindowInfo: () => ({ windowWidth: width, windowHeight: height, safeArea: { top: 24, bottom: height - 28, left: 8, right: width - 10 } }), getMenuButtonBoundingClientRect: () => ({ top: 25, bottom: 59, left: width - 88, right: width - 8 }) };
            try {
                const s = boardSnapshot();
                s.state = 'result.saved';
                s.active.status = 'won';
                s.active.score = 1234567;
                s.journey.chests = [{ level: 0, earned: true, opened: false }];
                s.journey.regionRewards = [{ region: 0, unlocked: true, claimed: false }];
                const b = createBoard({ width, height, harness: H, snapshot: s });
                await H.flush();
                const calls = [];
                b.u.setHostActions({ chest: { visible: true, run: () => calls.push('chest') }, regionReward: { visible: true, run: () => calls.push('regionReward') }, mainNext: { visible: true, run: () => calls.push('next') } });
                b.render();
                b.step(1);
                let p = b.u.popups.find('ResultPanel');
                const v = { width: b.u.layoutInfo.width, height: b.u.layoutInfo.height, safeInsets: b.u.layoutInfo.safe };
                for (let i = 0; i < pageCount(H, p); i++) {
                    snapshot(H, p, v, { case: 'actual-host', hostFrame: { width, height }, insets: mode, phase: 'settled', page: i + 1 });
                    if (i + 1 < pageCount(H, p))
                        H.tap(p.root.find('ResultNextPage'));
                }
                record(`host callback ${width}x${height} ${mode}`, () => { assert.equal(v.width, Math.max(240, width)); assert.equal(v.height, Math.max(320, height)); if (!p.root.find('Home').activeInHierarchy) {
                    assert(!rows.at(-1).supported);
                    assert.equal(calls.length, 0);
                    return;
                } const claim = reveal(H, p, 'ResultChestTap'); H.tap(claim); assert.deepEqual(calls.slice(0, 2), ['chest', 'regionReward']); const n = reveal(H, p, 'Next'); n.emit('touch-start', H.event(H.point(n), 1)); const before = calls.length; H.setViewport(640, 360); H.cc.view.emit('canvas-resize'); n.emit('touch-end', H.event(H.point(n), 1)); assert.equal(calls.length, before); H.tap(n); assert.equal(calls.length, before + 1); });
                b.u.onDestroy();
                record('host teardown', () => assert.equal(H.cc.game.listeners('hide'), 0));
            }
            finally {
                for (const [k, v] of Object.entries(old)) {
                    if (v === undefined)
                        delete globalThis[k];
                    else
                        globalThis[k] = v;
                }
            }
        }
}
async function lifecycle() {
    const H = createHarness(), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
    const owner = new H.cc.Node('Owner');
    H.cc._scene.addChild(owner);
    let viewport = { width: 320, height: 320, safeInsets: insetModes.host(320, 320) };
    H.setViewport(320, 320);
    const stack = new K.PopupStack(owner, () => viewport);
    const targets = [['ResultChestTap', cases[0]], ['Next', cases[0]], ['Home', cases[0]], ['Replay', cases.find(c => c.kind === 'lose' && c.replay)], ['RetrySave', cases.find(c => c.kind === 'unsaved')]];
    const fired = (target, spec) => target === 'ResultChestTap' ? (spec.rewards || []).filter(r => (r.state || 'ready') === 'ready').map(r => 'Claim-' + r.id) : [target];
    for (const [target, spec] of targets)
        for (const mode of ['other-pointer', 'outside', 'cancel', 'hide', 'node-hide', 'ancestor-hide', 'disable', 'cover', 'page-away', 'rotate', 'inset-only', 'unchanged', 'destroy', 'closing']) {
            const calls = [], p = P.openResult(stack, model(spec, calls), null);
            settle(stack);
            const n = reveal(H, p, target), point = H.point(n);
            n.emit('touch-start', H.event(point, 1));
            record(target + ' ' + mode, () => {
                if (mode === 'other-pointer') {
                    n.emit('touch-end', H.event(point, 2));
                    assert.deepEqual(nav(calls), []);
                    n.emit('touch-end', H.event(point, 1));
                    assert.deepEqual(nav(calls), fired(target, spec));
                    return;
                }
                if (mode === 'outside')
                    n.emit('touch-end', H.event({ x: -10000, y: -10000 }, 1));
                if (mode === 'cancel')
                    n.emit('touch-cancel', H.event(point, 1));
                if (mode === 'hide')
                    H.cc.game.emit(H.cc.Game.EVENT_HIDE);
                if (mode === 'node-hide') {
                    n.active = false;
                    n.active = true;
                }
                if (mode === 'ancestor-hide') {
                    p.body.active = false;
                    p.body.active = true;
                }
                if (mode === 'disable') {
                    const c = n.components.find(c => typeof c.reset === 'function');
                    c.enabled = false;
                    c.enabled = true;
                }
                if (mode === 'cover') {
                    const cover = stack.open({ name: 'Cover', height: 300, title: 'Cover' });
                    n.emit('touch-end', H.event(point, 1));
                    H.tap(n);
                    assert.deepEqual(nav(calls), []);
                    cover.close();
                    settle(stack);
                }
                if (mode === 'page-away') {
                    if (pageNumber(H, p) < pageCount(H, p))
                        H.tap(p.root.find('ResultNextPage'));
                    else
                        H.tap(p.root.find('ResultPreviousPage'));
                }
                if (mode === 'rotate') {
                    viewport = { width: 568, height: 320, safeInsets: insetModes.host(568, 320) };
                    H.setViewport(568, 320);
                    stack.layout();
                }
                if (mode === 'inset-only') {
                    viewport = { ...viewport, safeInsets: { ...viewport.safeInsets, left: (viewport.safeInsets.left || 0) + 2, right: (viewport.safeInsets.right || 0) + 2 } };
                    stack.layout();
                }
                if (mode === 'unchanged') {
                    stack.layout();
                    stack.update(.01);
                    n.emit('touch-end', H.event(point, 1));
                    assert.deepEqual(nav(calls), fired(target, spec));
                    return;
                }
                if (mode === 'destroy') {
                    p.destroy();
                    n.emit('touch-end', H.event(point, 1));
                    assert.deepEqual(nav(calls), []);
                    return;
                }
                if (mode === 'closing') {
                    p.close();
                    n.emit('touch-end', H.event(point, 1));
                    H.tap(n);
                    assert.deepEqual(nav(calls), []);
                    return;
                }
                n.emit('touch-end', H.event(H.point(n), 1));
                assert.deepEqual(nav(calls), []);
                const again = reveal(H, p, target);
                assert(again.activeInHierarchy);
                H.tap(again);
                assert.deepEqual(nav(calls), fired(target, spec));
            });
            stack.clear();
            viewport = { width: 320, height: 320, safeInsets: insetModes.host(320, 320) };
            H.setViewport(320, 320);
        }
    // Same-size insets translation (width/height unchanged) must also cancel.
    record('equal-safe-size translation cancels', () => { const calls = [], p = P.openResult(stack, model(cases[0], calls), null); settle(stack); const n = p.root.find('Next'); n.emit('touch-start', H.event(H.point(n), 1)); viewport.safeInsets = { ...viewport.safeInsets, left: 4, right: 0 }; stack.layout(); n.emit('touch-end', H.event(H.point(n), 1)); assert.deepEqual(nav(calls), []); stack.clear(); });
    owner.destroy();
}
async function transitions() {
    for (const destroyed of [false, true]) {
        const H = createHarness(), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels'), A = H.load('ui/BoardArt');
        const o = new H.cc.Node('Delayed');
        H.cc._scene.addChild(o);
        let v = { width: 320, height: 320, safeInsets: insetModes.host(320, 320) };
        H.setViewport(320, 320);
        const s = new K.PopupStack(o, () => v), calls = [], p = P.openResult(s, model(cases[0], calls), null);
        settle(s);
        const n = reveal(H, p, 'ResultChestTap');
        n.emit('touch-start', H.event(H.point(n), 1));
        const pending = Promise.all(['board', 'popup', 'r2'].map(d => A.BoardArt.shared().load(d)));
        v = { width: 568, height: 320, safeInsets: insetModes.host(568, 320) };
        H.setViewport(568, 320);
        s.layout();
        if (destroyed)
            s.clear();
        await pending;
        await H.flush();
        record('delayed art ' + destroyed, () => { n.emit('touch-end', H.event(destroyed ? { x: 0, y: 0 } : H.point(n), 1)); assert.deepEqual(nav(calls), []); if (!destroyed) {
            assert.equal(s.find('ResultPanel'), p);
            snapshot(H, p, v, { case: 'delayed-art', phase: 'settled', insets: 'host', page: 1 });
            H.tap(reveal(H, p, 'ResultChestTap'));
            assert.deepEqual(nav(calls), ['Claim-chest', 'Claim-regionReward']);
        }
        else
            assert(!p.alive); });
        s.clear();
        o.destroy();
    }
    for (const target of ['ResultPreviousPage', 'ResultNextPage'])
        for (const action of ['rotate', 'close', 'cover', 'degrade']) {
            const H = createHarness(), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels'), o = new H.cc.Node('Pager');
            H.cc._scene.addChild(o);
            let v = { width: 320, height: 320, safeInsets: insetModes.host(320, 320) };
            H.setViewport(320, 320);
            const s = new K.PopupStack(o, () => v), calls = [], p = P.openResult(s, model(cases[0], calls), null);
            settle(s);
            record(target + ' held ' + action, () => {
                assert(pageCount(H, p) > 1);
                if (target === 'ResultPreviousPage')
                    H.tap(p.root.find('ResultNextPage'));
                const n = p.root.find(target);
                n.emit('touch-start', H.event(H.point(n), 1));
                if (action === 'rotate') {
                    v = { width: 568, height: 320, safeInsets: insetModes.host(568, 320) };
                    H.setViewport(568, 320);
                    s.layout();
                    // Larger integrated reward cards can retain finite pages after rotation.
                    assert(pageCount(H, p) >= 1);
                    assert(pageNumber(H, p) >= 1 && pageNumber(H, p) <= pageCount(H, p));
                }
                if (action === 'close')
                    p.close();
                if (action === 'cover') {
                    const upper = s.open({ name: 'Cover', height: 300, title: 'Cover' });
                    upper.close();
                    settle(s);
                }
                if (action === 'degrade') {
                    v = { width: 320, height: 320, safeInsets: { left: 88, right: 88, top: 120, bottom: 80 } };
                    s.layout();
                    assert(!p.root.find('Home').activeInHierarchy);
                }
                const after = pageNumber(H, p);
                n.emit('touch-end', H.event(H.point(n), 1));
                assert.equal(pageNumber(H, p), after);
                assert.deepEqual(nav(calls), []);
                if (action === 'degrade') {
                    v = { width: 320, height: 320, safeInsets: insetModes.host(320, 320) };
                    s.layout();
                    assert(p.root.find('Home').activeInHierarchy);
                    H.tap(p.root.find('Home'));
                    assert.deepEqual(nav(calls), ['Home']);
                }
            });
            s.clear();
            o.destroy();
        }
    const H = createHarness();
    H.cc.sys.localStorage.setItem('qfl.ui.seenTools', '["starlight","windbell","tidebottle"]');
    const state = boardSnapshot();
    state.state = 'result.saved';
    state.active.status = 'won';
    state.active.score = 1234567;
    state.journey.chests = [{ level: 0, earned: true, opened: false }];
    state.journey.regionRewards = [{ region: 0, unlocked: true, claimed: false }];
    const b = createBoard({ width: 320, height: 320, harness: H, snapshot: state });
    await H.flush();
    const calls = [];
    b.u.setHostActions({ chest: { visible: true, run: () => { calls.push('chest'); Promise.resolve().then(() => { state.journey.chests[0].opened = true; b.render(); }); } }, regionReward: { visible: true, run: () => { calls.push('regionReward'); Promise.resolve().then(() => { state.journey.regionRewards[0].claimed = true; b.render(); }); } }, mainNext: { visible: true, run: () => calls.push('next') } });
    b.render();
    b.step(1);
    {
        let p = b.u.popups.find('ResultPanel');
        const n = reveal(H, p, 'ResultChestTap');
        H.tap(n);
        await H.flush();
        b.step(1);
        record('actual host asynchronous claim-all stays on the result screen (no RewardPanel)', () => { assert.equal(calls.filter(x => x === 'chest').length, 1); assert.equal(calls.filter(x => x === 'regionReward').length, 1); assert(!p.alive); const replacement = b.u.popups.find('ResultPanel'); assert(replacement); assert(!replacement.root.find('ResultChestTap'), 'claimed action must be removed'); assert(!b.u.popups.find('RewardPanel'), 'SPEC v2.1: no separate 获得 popup on the result screen'); n.emit('touch-end', H.event({ x: 0, y: 0 }, 1)); assert.equal(calls.filter(x => x === 'chest').length, 1); b.step(1); assert(replacement.root.activeInHierarchy); assert.equal(b.u.popups.top(), replacement); const home = replacement.root.find('Home'); assert(home.activeInHierarchy); });
    }
    record('actual host last page keeps Next after both rewards', () => { const p = b.u.popups.find('ResultPanel'); for (let i = 1; i < pageCount(H, p); i++)
        H.tap(p.root.find('ResultNextPage')); H.tap(p.root.find('Next')); assert.equal(calls.at(-1), 'next'); });
    b.u.onDestroy();
    record('transition teardown', () => assert.equal(H.cc.game.listeners('hide'), 0));
}
function xml(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])); }
function diagram(r) { const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${r.width + 32}" height="${r.height + 86}" viewBox="0 0 ${r.width + 32} ${r.height + 86}">`, `<rect width="100%" height="100%" fill="#f5f2e8"/>`, `<text x="16" y="20" font-size="12">NODE DIAGRAM · NOT COCOS RENDER</text>`, `<text x="16" y="38" font-size="11">${xml(r.case)} · ${r.width}×${r.height} · ${xml(r.insets)} · page ${r.page}</text>`, `<g transform="translate(16,50)"><rect width="${r.width}" height="${r.height}" fill="#d9e7dd"/>`, `<rect x="${r.safe.left}" y="${r.safe.top}" width="${r.safe.right - r.safe.left}" height="${r.safe.bottom - r.safe.top}" fill="#fff8e9" stroke="#bf7400" stroke-dasharray="4 3"/>`]; for (const b of r.boxes) {
    if (b.role === 'art' && b.name === 'Title') {
        out.push(`<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 6}" font-size="16" text-anchor="middle">${xml(r.case.startsWith('win') || r.case === 'actual-host' ? '过关啦' : r.case === 'readonly' ? '旅途回顾' : '还没存上')}</text>`);
        continue;
    }
    if (b.role === 'art' && !b.name.startsWith('Star'))
        continue;
    if (b.role !== 'text')
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4" fill="${b.role === 'hit' ? '#6bb8ac' : b.role === 'frame' ? '#cc9f67' : '#ffd575'}" fill-opacity=".3" stroke="${b.role === 'hit' ? '#16685a' : '#9b773e'}"/>`);
    else
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#8b8b8b" stroke-width=".3"/><text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + b.font * .35}" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="${b.font}"${b.bold ? ' font-weight="bold"' : ''}>${xml(b.text)}</text>`);
} out.push(`</g><text x="16" y="${r.height + 71}" font-size="10">Logical UI units. Dashed boundary includes host safe area/capsule.</text></svg>`); return out.join('\n'); }
(async () => {
    await matrix();
    await host();
    await lifecycle();
    await transitions();
    // Retain explicit out-of-contract failures; do not silently enlarge the support claim.
    {
        const H = createHarness(), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels'), o = new H.cc.Node('Stress');
        H.cc._scene.addChild(o);
        for (const v of [{ width: 160, height: 140, safeInsets: { left: 0, right: 0, top: 0, bottom: 0 } }, { width: 320, height: 320, safeInsets: { left: 88, right: 88, top: 120, bottom: 80 } }]) {
            H.setViewport(v.width, v.height);
            const s = new K.PopupStack(o, () => v), p = P.openResult(s, model(cases[0]), null);
            settle(s);
            for (let i = 0; i < pageCount(H, p); i++) {
                snapshot(H, p, v, { case: 'unsupported-stress', phase: 'settled', insets: 'stress', page: i + 1 });
                if (i + 1 < pageCount(H, p))
                    H.tap(p.root.find('ResultNextPage'));
            }
            s.clear();
        }
        o.destroy();
    }
    record('source unchanged throughout validation', () => assert.deepEqual(sourceHashes(), initialHashes));
    const supported = rows.filter(r => r.supported), unsupported = rows.filter(r => !r.supported), failed = supported.filter(r => r.failures.length), failedChecks = checks.filter(c => !c.ok);
    const summary = { status: failed.length || failedChecks.length ? 'FAIL' : 'PASS', source: ROOT, sourceSha256: initialHashes, testSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), scope: 'Actual TS/Cocos node doubles; logical UI geometry, host clamp, CSS/wx insets and input lifecycle. Not engine rendering, actual device projection or native storage.', supportedContract: 'Safe rectangle, after capsule top-band reservation, at least 216 × 196 logical units; only sampled rows certified.', samples: rows.length, supportedSamples: supported.length, supportedFailures: failed.length, unsupportedSamples: unsupported.length, unsupportedFailures: unsupported.filter(r => r.failures.length).length, checks: checks.length, failedChecks, firstFailures: failed.slice(0, 5) };
    if (OUT) {
        fs.mkdirSync(OUT, { recursive: true });
        fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
        fs.writeFileSync(path.join(OUT, 'matrix.json'), JSON.stringify(rows, null, 2));
        fs.writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify(checks, null, 2));
        fs.writeFileSync(path.join(OUT, 'labels.json'), JSON.stringify(rows.flatMap((r, i) => r.supported ? r.boxes.filter(b => b.role === 'text').map(b => ({ sample: i, ...b })) : [])));
        for (const r of rows.filter(r => r.phase === 'settled' && r.loaded && !r.reduced && ['win-complex', 'win-extreme', 'unsaved-true', 'readonly'].includes(r.case) && [320, 321, 568, 390].includes(r.width) && r.insets === 'host'))
            fs.writeFileSync(path.join(OUT, `${r.case}-${r.width}x${r.height}-page${r.page}.svg`), diagram(r));
        for (const r of rows.filter(r => r.case === 'actual-host'))
            fs.writeFileSync(path.join(OUT, `host-${r.hostFrame.width}x${r.hostFrame.height}-${r.insets}-page${r.page}.svg`), diagram(r));
    }
    console.log(JSON.stringify({ ...summary, firstFailures: summary.firstFailures.map(r => ({ case: r.case, width: r.width, height: r.height, insets: r.insets, page: r.page, failures: r.failures.slice(0, 3) })) }, null, 2));
    if (summary.status !== 'PASS')
        process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
