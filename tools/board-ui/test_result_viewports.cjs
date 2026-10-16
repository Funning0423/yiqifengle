'use strict';
/**
 * Actual BoardPanels / PopupKit TypeScript through the shipped Cocos node double.
 * This is a geometry and input/lifecycle regression gate, NOT a Cocos render,
 * device screenshot, text-glyph measurement, or safe-area platform integration.
 *
 * QF_TYPESCRIPT_MODULE=/path/to/typescript node tools/board-ui/test_result_viewports.cjs
 * Optional: QF_RESULT_VIEWPORT_REPORT=/path/to/report.json
 * Optional: QF_RESULT_VIEWPORT_ARTIFACTS=/path/to/artifact-directory
 * Artifacts are opt-in; the test is otherwise read-only outside process memory.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createHarness, ROOT } = require('./harness.cjs');

const VIEWPORTS = [[320, 568], [390, 844], [320, 480], [568, 320], [480, 320], [480, 240], [640, 360], [844, 390], [1024, 768]];
// Additional probes either side of the short-landscape cutoff, plus the narrow
// normal-landscape and second short width requested by the independent audit.
const EXTRA_VIEWPORTS = [[568, 240], [480, 297], [480, 298], [480, 299], [480, 307], [480, 308], [480, 309]];
const EPSILON = 1e-6;
const MIN_HIT = 44;
const SAFE_MARGIN = 12;
const results = [];
const rows = [];
const noop = () => {};
const scope = 'Actual production TypeScript and node transforms in the shipped Cocos double, with real PNG dimensions in loaded-art passes. Node geometry, not Cocos pixel rendering or a device screenshot. Label rectangles do not certify glyph layout.';

function reward(kind, state = 'ready', region = 'tide') {
  if (kind === 'chest') return { id: 'chest', label: state === 'claimed' ? '宝箱已打开' : '打开宝箱', icon: 'popup/chest_closed', iconKind: 'chest', state };
  if (kind === 'gift') return { id: 'regionReward', label: state === 'claimed' ? '地区道具已领取' : '领取地区道具', icon: '', iconKind: 'tool', tool: 'tideNet', state };
  return { id: 'seal', label: state === 'claimed' ? '地区印记已领取' : '领取地区印记', icon: 'popup/reward_seal_' + region, iconKind: 'seal', state };
}

const modelCases = [];
for (const hasNext of [true, false]) {
  const sets = [[], ...['ready', 'claimed', 'locked'].flatMap(state => [[reward('chest', state)], [reward('gift', state)], [reward('chest', state), reward('gift', state)]]), [reward('chest'), reward('gift', 'claimed')], [reward('chest', 'claimed'), reward('gift')], [reward('seal')], [reward('seal', 'claimed', 'meadow')], [reward('seal', 'locked', 'sky')]];
  for (const rewards of sets) modelCases.push({ name: 'win-' + (hasNext ? 'next' : 'home') + '-' + (rewards.map(r => r.id + ':' + r.state).join(',') || 'no-rewards'), kind: 'win', hasNext, rewards });
}
for (const chestHint of [false, true]) for (const hasReplay of [false, true]) for (const goalCount of [0, 1, 2]) modelCases.push({ name: `lose-hint${chestHint}-replay${hasReplay}-goals${goalCount}`, kind: 'lose', chestHint, hasReplay, goalCount });
for (const chestHint of [false, true]) modelCases.push({ name: 'unsaved-hint' + chestHint, kind: 'unsaved', chestHint });
modelCases.push({ name: 'readonly', kind: 'readonly' });
for (const stars of [null, 0, 1, 2, 3]) modelCases.push({ name: 'win-long-score-stars' + stars, kind: 'win', hasNext: true, rewards: [reward('chest'), reward('gift')], stars, score: 987654321012345, movesUsed: stars === null ? null : 0, movesLeft: 999999 });

function makeModel(spec, calls = []) {
  return {
    kind: spec.kind,
    score: spec.score ?? 1234567,
    stars: Object.hasOwn(spec, 'stars') ? spec.stars : 3,
    movesUsed: Object.hasOwn(spec, 'movesUsed') ? spec.movesUsed : 15,
    movesLeft: Object.hasOwn(spec, 'movesLeft') ? spec.movesLeft : 7,
    goalsLeft: [{ art: 'board/piece_leaf', count: 20 }, { art: 'board/piece_flower', count: 12 }].slice(0, spec.goalCount ?? 2),
    chestHint: !!spec.chestHint,
    rewards: (spec.rewards || []).map(r => ({ ...r, claim: () => calls.push('Claim-' + r.id) })),
    next: spec.hasNext ? () => calls.push('Next') : null,
    replay: spec.hasReplay ? () => calls.push('Replay') : null,
    retrySave: () => calls.push('RetrySave'),
    home: () => calls.push('Home'),
  };
}

function expectedActions(model) {
  if (model.kind === 'win') return [...(model.rewards.some(r => r.state === 'ready' && r.claim) ? ['ClaimAll'] : []), ...(model.next ? ['Next'] : []), 'Home'].sort();
  if (model.kind === 'lose') return [...(model.replay ? ['Replay'] : []), 'Home'].sort();
  if (model.kind === 'unsaved') return ['Home', 'RetrySave'];
  return ['Home'];
}

// Compose every actual ancestor transform. This also records a rotated stamp's
// AABB; the harness's convenience worldPosition/worldScale omit rotation.
function rect(H, node) {
  const ui = node.getComponent(H.cc.UITransform);
  const corners = [[-ui.width * ui.anchorX, -ui.height * ui.anchorY], [ui.width * (1 - ui.anchorX), -ui.height * ui.anchorY], [ui.width * (1 - ui.anchorX), ui.height * (1 - ui.anchorY)], [-ui.width * ui.anchorX, ui.height * (1 - ui.anchorY)]];
  for (let n = node; n; n = n.parent) {
    const angle = ((n.euler?.z || 0) + (n.angle || 0)) * Math.PI / 180;
    const c = Math.cos(angle), s = Math.sin(angle);
    for (const p of corners) { const x = p[0] * n.scale.x, y = p[1] * n.scale.y; p[0] = c * x - s * y + n.position.x; p[1] = s * x + c * y + n.position.y; }
  }
  const xs = corners.map(p => p[0] + H.state.viewport.width / 2), ys = corners.map(p => H.state.viewport.height / 2 - p[1]);
  const x = Math.min(...xs), y = Math.min(...ys), label = node.getComponent(H.cc.Label);
  const nodePath = []; for (let n = node; n && n.name !== 'result-viewport-owner' && n.name !== 'result-input-owner'; n = n.parent) nodePath.unshift(n.name);
  return { name: node.name, nodePath: nodePath.join('/'), x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, ...(label ? { text: label.string, fontSize: label.fontSize, physicalFontSize: label.fontSize * Math.abs(node.worldScale.y), physicalLineHeight: label.lineHeight * Math.abs(node.worldScale.y), horizontalAlign: label.horizontalAlign } : {}) };
}
function overlap(a, b) { return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPSILON && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPSILON; }
function safe(box, width, height, margin) { return box.x >= margin - EPSILON && box.y >= margin - EPSILON && box.x + box.w <= width - margin + EPSILON && box.y + box.h <= height - margin + EPSILON; }
function settle(stack) { for (let i = 0; i < 40; i++) stack.update(.025); }
function rounded(n) { return Math.round(n * 1e5) / 1e5; }

function snapshot(H, panel, meta, model) {
  const boxes = [], buttons = [], labels = [], art = [], textEstimates = [];
  panel.root.walk(node => {
    if (!node.activeInHierarchy || !node.getComponent(H.cc.UITransform)) return;
    const b = rect(H, node), isButton = node.listeners('touch-start') > 0;
    if (isButton) { buttons.push(b); boxes.push({ ...b, role: 'hit' }); }
    else if (node.name === 'PanelFrame' || node.name === 'TitlePlank') boxes.push({ ...b, role: 'frame' });
    else if (node.getComponent(H.cc.Label)) {
      labels.push(b); boxes.push({ ...b, role: 'text' });
      const label = node.getComponent(H.cc.Label), estimatedWidth = H.load('ui/PopupKit').measure(label.string, label.fontSize) * Math.abs(node.worldScale.x);
      const x = label.horizontalAlign === H.cc.Label.HorizontalAlign.LEFT ? b.x : label.horizontalAlign === H.cc.Label.HorizontalAlign.RIGHT ? b.x + b.w - estimatedWidth : b.x + (b.w - estimatedWidth) / 2;
      textEstimates.push({ ...b, x, y: b.y + (b.h - b.physicalFontSize) / 2, w: estimatedWidth, h: b.physicalFontSize, estimateOnly: true });
    }
    else if (node.getComponent(H.cc.Sprite) && !['Plate', 'Icon', 'Plank', 'Title'].includes(node.name)) { art.push(b); boxes.push({ ...b, role: 'art' }); }
  });
  const { width, height } = H.state.viewport;
  const frame = boxes.filter(b => b.role === 'frame');
  const failures = [];
  const record = (type, detail) => failures.push({ type, ...detail });
  if (frame.length !== 2) record('missing-frame-or-title', { names: frame.map(b => b.name) });
  for (const b of frame) if (!safe(b, width, height, SAFE_MARGIN)) record('frame-title-safe-margin', { box: b, required: SAFE_MARGIN });
  for (const b of buttons) {
    if (b.w < MIN_HIT - EPSILON || b.h < MIN_HIT - EPSILON) record('hit-below-44', { box: b });
    if (!safe(b, width, height, SAFE_MARGIN)) record('hit-outside-safe-viewport', { box: b });
  }
  for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) if (overlap(buttons[i], buttons[j])) record('hit-overlap', { names: [buttons[i].name, buttons[j].name], boxes: [buttons[i], buttons[j]] });
  // Page-local hit geometry. Complete action/text coverage across every page
  // is separately required by test_result_safe_area.cjs.
  const actual = buttons.map(b => b.name).sort(), expected = expectedActions(model).filter(name => panel.root.find(name)?.activeInHierarchy);
  for (const name of ['ResultPreviousPage', 'ResultNextPage']) if (panel.root.find(name)?.activeInHierarchy) expected.push(name);
  expected.sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) record('action-contract', { actual, expected });
  for (const name of [panel.root.name, 'PopupShade']) {
    const n = name === panel.root.name ? panel.root : panel.root.find(name), b = n && rect(H, n);
    if (!b || Math.abs(b.x) > EPSILON || Math.abs(b.y) > EPSILON || Math.abs(b.w - width) > EPSILON || Math.abs(b.h - height) > EPSILON) record('modal-coverage', { name, box: b });
  }
  // A transform box is useful inspection evidence, but Label Overflow.NONE and
  // unrendered opening stars cannot be turned into a glyph/visibility claim.
  const contentObservations = [...labels, ...art].filter(b => !safe(b, width, height, 0));
  const estimatedContentOverlaps = [];
  for (let i = 0; i < textEstimates.length; i++) {
    const text = textEstimates[i];
    for (let j = i + 1; j < textEstimates.length; j++) if (overlap(text, textEstimates[j])) estimatedContentOverlaps.push({ type: 'estimated-text-text', boxes: [text, textEstimates[j]] });
    for (const a of art) if (overlap(text, a)) estimatedContentOverlaps.push({ type: 'estimated-text-art', boxes: [text, a] });
  }
  const row = { ...meta, width, height, panelWidth: panel.width, panelHeight: panel.height, bodyScale: panel.body.scale.x, boxes, failures, contentTransformOutsideViewport: contentObservations, textEstimates, estimatedTextOutsideViewport: textEstimates.filter(b => !safe(b, width, height, 0)), estimatedContentOverlaps };
  rows.push(row);
  return row;
}

async function check(name, fn) {
  try { const info = await fn(); results.push({ name, ok: true, ...(info || {}) }); }
  catch (e) { results.push({ name, ok: false, error: e.stack }); console.error('FAIL', name, e.message); }
}

async function runMatrix() {
  for (const loadedArt of [false, true]) for (const reducedMotion of [false, true]) {
    const H = createHarness(), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels'), A = H.load('ui/BoardArt'), N = H.load('ui/NightTint');
    H.load('ui/UiPrefs').setReducedMotion(reducedMotion);
    const artLoads = loadedArt ? await Promise.all(['board', 'popup', 'r2', 'r3'].map(dir => A.BoardArt.shared().load(dir))) : [];
    assert(!loadedArt || artLoads.every(Boolean), 'loaded-art matrix must use successful actual PNG loads');
    const owner = new H.cc.Node('result-viewport-owner'); H.cc._scene.addChild(owner);
    const stack = new K.PopupStack(owner, () => H.state.viewport);
    for (const [width, height] of [...VIEWPORTS, ...EXTRA_VIEWPORTS]) for (let i = 0; i < modelCases.length; i++) {
      const spec = modelCases[i], model = makeModel(spec), night = i % 2 === 1;
      globalThis.__worldDayNight = { snapshot: () => ({ mode: night ? 'night' : 'day' }) }; N.resetUiNightWeight();
      H.setViewport(width, height);
      const panel = P.openResult(stack, model, null), meta = { case: spec.name, loadedArt, reducedMotion, tint: night ? 'night' : 'day', primaryViewport: VIEWPORTS.some(v => v[0] === width && v[1] === height) };
      snapshot(H, panel, { ...meta, phase: 'open' }, model);
      stack.update(.1); snapshot(H, panel, { ...meta, phase: 'opening' }, model);
      settle(stack); const settled = snapshot(H, panel, { ...meta, phase: 'settled' }, model);
      const before = JSON.stringify(settled.boxes.map(b => [b.name, rounded(b.x), rounded(b.y), rounded(b.w), rounded(b.h)]));
      for (let j = 0; j < 3; j++) { stack.layout(); stack.update(.016); }
      const after = []; panel.root.walk(n => { if (n.activeInHierarchy && n.listeners('touch-start')) { const b = rect(H, n); after.push([b.name, rounded(b.x), rounded(b.y), rounded(b.w), rounded(b.h)]); } });
      const beforeHits = JSON.parse(before).filter(b => expectedActions(model).includes(b[0]) || ['ResultPreviousPage', 'ResultNextPage'].includes(b[0]));
      if (JSON.stringify(after) !== JSON.stringify(beforeHits)) settled.failures.push({ type: 'unstable-settled-hit-layout', before: beforeHits, after });
      stack.clear(); assert.equal(H.cc.game.listeners('hide'), 0, 'matrix panel leaked Game.EVENT_HIDE listener');
    }
    owner.destroy();
  }
  delete globalThis.__worldDayNight;
}

function revealAction(H, panel, target) {
  const node = panel.root.find(target); assert(node, target);
  for (let i = 0; i < 100 && panel.root.find('ResultPreviousPage')?.activeInHierarchy; i++) {
    const text = panel.root.find('ResultPageNumber').getComponent(H.cc.Label).string;
    if (text.startsWith('1 /')) break; H.tap(panel.root.find('ResultPreviousPage'));
  }
  for (let i = 0; i < 100 && !node.activeInHierarchy; i++) H.tap(panel.root.find('ResultNextPage'));
  assert(node.activeInHierarchy, target + ' is reachable on an explicit content page');
}
function send(H, node, type, point = H.point(node), pointer = 1) { node.emit('touch-' + type, H.event(point, pointer)); }
const targetCases = [
  ['ClaimAll', { kind: 'win', hasNext: true, rewards: [reward('chest'), reward('gift')] }],
  ['Next', { kind: 'win', hasNext: true, rewards: [reward('chest')] }],
  ['Home', { kind: 'win', hasNext: true, rewards: [reward('chest')] }],
  ['Replay', { kind: 'lose', hasReplay: true, chestHint: true }],
  ['RetrySave', { kind: 'unsaved', chestHint: true }],
];

function fired(spec, target) {
  if (target !== 'ClaimAll') return [target];
  return (spec.rewards || []).filter(r => (r.state || 'ready') === 'ready').map(r => 'Claim-' + r.id);
}
async function runInputChecks() {
  const H = createHarness(), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
  await Promise.all(['board', 'popup', 'r2', 'r3'].map(dir => H.load('ui/BoardArt').BoardArt.shared().load(dir)));
  const owner = new H.cc.Node('result-input-owner'); H.cc._scene.addChild(owner);
  const stack = new K.PopupStack(owner, () => H.state.viewport);
  const modes = ['foreign-end', 'foreign-move', 'foreign-cancel', 'second-start', 'outside-end', 'outside-positive-end', 'out-in', 'cancel-late-end', 'node-hide', 'ancestor-hide', 'component-disable', 'game-hide', 'unchanged-layout', 'modal-cover', 'modal-cover-rotation', 'closing', 'closing-rotation', 'destroy', 'teardown-after-reflow'];
  for (const viewport of [[320, 568], [568, 320], [480, 240]]) for (const [target, spec] of targetCases) for (const mode of modes) await check(`${target} ${mode} ${viewport.join('x')}`, () => {
    H.setViewport(...viewport); const calls = [], expected = fired(spec, target), panel = P.openResult(stack, makeModel(spec, calls), null); settle(stack);
    const node = panel.root.find(target); assert(node, target + ' is real Result action'); revealAction(H, panel, target);
    const point = H.point(node); send(H, node, 'start', point);
    try {
      if (mode === 'foreign-end') send(H, node, 'end', point, 2);
      if (mode === 'foreign-move') send(H, node, 'move', { x: -100, y: -100 }, 2);
      if (mode === 'foreign-cancel') send(H, node, 'cancel', point, 2);
      if (mode === 'second-start') { send(H, node, 'start', point, 2); send(H, node, 'end', point, 2); }
      if (mode.startsWith('foreign-') || mode === 'second-start') { assert.deepEqual(calls, []); send(H, node, 'end', point); assert.deepEqual(calls, expected); send(H, node, 'end', point); assert.deepEqual(calls, expected); }
      else if (mode === 'outside-end' || mode === 'outside-positive-end') { send(H, node, 'end', mode === 'outside-end' ? { x: -100, y: -100 } : { x: 4000, y: 4000 }); assert.deepEqual(calls, []); H.tap(node); assert.deepEqual(calls, expected); }
      else if (mode === 'out-in') { send(H, node, 'move', { x: -100, y: -100 }); send(H, node, 'move', point); send(H, node, 'end', point); assert.deepEqual(calls, expected); }
      else if (mode === 'cancel-late-end') { send(H, node, 'cancel', point); send(H, node, 'end', point); assert.deepEqual(calls, []); H.tap(node); assert.deepEqual(calls, expected); }
      else if (mode === 'node-hide' || mode === 'ancestor-hide' || mode === 'component-disable' || mode === 'game-hide') {
        if (mode === 'node-hide') { node.active = false; node.active = true; }
        if (mode === 'ancestor-hide') { panel.body.active = false; panel.body.active = true; }
        if (mode === 'component-disable') { const guard = node.components.find(c => typeof c.reset === 'function' && typeof c.cleanup === 'function'); assert(guard); guard.enabled = false; guard.enabled = true; }
        if (mode === 'game-hide') { H.cc.game.emit(H.cc.Game.EVENT_HIDE); H.cc.game.emit(H.cc.Game.EVENT_SHOW); }
        send(H, node, 'end', point); assert.deepEqual(calls, []); H.tap(node); assert.deepEqual(calls, expected);
      }
      else if (mode === 'unchanged-layout') { for (let j = 0; j < 8; j++) { stack.layout(); stack.update(.016); } send(H, node, 'end', point); assert.deepEqual(calls, expected); }
      else if (mode === 'modal-cover' || mode === 'modal-cover-rotation') {
        const upper = stack.open({ name: 'CoverProbe', height: 300, title: 'Cover' });
        if (mode === 'modal-cover-rotation') { H.setViewport(viewport[1], viewport[0]); stack.layout(); }
        send(H, node, 'end', H.point(node)); H.tap(node); assert.deepEqual(calls, [], 'covered result must reject old and fresh input');
        upper.close(); stack.update(.05); H.tap(node); assert.deepEqual(calls, [], 'closing upper modal still covers result');
        settle(stack); send(H, node, 'end', H.point(node)); assert.deepEqual(calls, [], 'covered gesture must not revive'); revealAction(H, panel, target); H.tap(node); assert.deepEqual(calls, expected);
      }
      else if (mode === 'closing' || mode === 'closing-rotation') {
        panel.close(); if (mode === 'closing-rotation') { H.setViewport(viewport[1], viewport[0]); stack.layout(); }
        send(H, node, 'end', H.point(node)); H.tap(node); assert.deepEqual(calls, []); settle(stack); assert(!panel.alive);
      }
      else if (mode === 'destroy') { panel.destroy(); send(H, node, 'end', point); H.tap(node); assert.deepEqual(calls, []); assert.doesNotThrow(() => panel.destroy()); }
      else if (mode === 'teardown-after-reflow') {
        H.setViewport(480, 240); stack.layout(); send(H, node, 'start', H.point(node), 3); stack.clear();
        send(H, node, 'end', point, 1); send(H, node, 'end', point, 3); assert.deepEqual(calls, []); assert.doesNotThrow(() => stack.clear()); assert.doesNotThrow(() => H.cc.game.emit(H.cc.Game.EVENT_HIDE));
      }
    } finally { stack.clear(); assert.equal(H.cc.game.listeners('hide'), 0, 'lifecycle listener leak'); }
    return { callbackCount: calls.length };
  });
  for (const [target, spec] of targetCases) for (const pair of [[[320, 568], [568, 320]], [[568, 320], [480, 240]], [[480, 240], [390, 844]], [[480, 297], [480, 299]], [[480, 307], [480, 309]], [[390, 844], [320, 568]]]) await check(`${target} same-panel rotation ${pair.map(v => v.join('x')).join(' -> ')}`, () => {
    const calls = [], expected = fired(spec, target); H.setViewport(...pair[0]); const panel = P.openResult(stack, makeModel(spec, calls), null); settle(stack);
    revealAction(H, panel, target);
    const node = panel.root.find(target), root = panel.root, body = panel.body, point = H.point(node);
    const meta = { case: 'same-panel-' + target + '-' + pair.map(v => v.join('x')).join('-to-'), loadedArt: true, reducedMotion: false, tint: 'day', primaryViewport: true };
    snapshot(H, panel, { ...meta, phase: 'rotation-before' }, makeModel(spec)); send(H, node, 'start', point);
    try {
      H.setViewport(...pair[1]); stack.layout(); stack.update(.016);
      snapshot(H, panel, { ...meta, phase: 'rotation-after' }, makeModel(spec));
      assert.equal(stack.find('ResultPanel'), panel); assert.equal(panel.root, root); assert.equal(panel.body, body); assert.equal(panel.root.find(target), node, 'reflow retains real action identity');
      send(H, node, 'end', H.point(node)); assert.deepEqual(calls, [], 'pre-reflow owned press must not activate at the new hit center');
      send(H, node, 'end', point); assert.deepEqual(calls, [], 'old-coordinate late END must not activate');
      revealAction(H, panel, target); H.tap(node); assert.deepEqual(calls, expected);
      send(H, node, 'start', H.point(node), 4); H.setViewport(...pair[0]); stack.layout(); send(H, node, 'end', H.point(node), 4); assert.deepEqual(calls, expected);
      revealAction(H, panel, target); H.tap(node, 5); assert.deepEqual(calls, expected.concat(expected));
    } finally { stack.clear(); assert.equal(H.cc.game.listeners('hide'), 0); }
  });
  for (const [target, spec] of targetCases) await check(`${target} child-first null-field teardown after reflow`, () => {
    H.setViewport(390, 844); const calls = [], panel = P.openResult(stack, makeModel(spec, calls), null), node = panel.root.find(target);
    settle(stack); H.setViewport(480, 240); stack.layout(); const point = H.point(node), endCallbacks = [...node._ev.get('touch-end')]; send(H, node, 'start', point);
    const destroy = H.cc.Node.prototype.destroy;
    H.cc.Node.prototype.destroy = function () {
      if (!this.isValid) return; this.active = false;
      for (const child of [...this.children]) child.destroy();
      for (const component of [...this.components]) { component.onDestroy?.(); for (const key of Object.keys(component)) if (typeof component[key] === 'object' || typeof component[key] === 'function') component[key] = null; }
      this.isValid = false; this.children = null; this.components = null; this.position = null; this._ev = null;
    };
    try {
      assert.doesNotThrow(() => panel.root.destroy()); assert.doesNotThrow(() => panel.destroy()); assert.doesNotThrow(() => panel.destroy());
      for (const [fn, context] of endCallbacks) assert.doesNotThrow(() => fn.call(context, H.event(point)));
      assert.deepEqual(calls, []); assert.equal(H.cc.game.listeners('hide'), 0); assert.doesNotThrow(() => H.cc.game.emit(H.cc.Game.EVENT_HIDE));
    } finally { H.cc.Node.prototype.destroy = destroy; stack.clear(); owner.children = owner.children.filter(n => n.isValid); }
  });
  owner.destroy();
}

async function runDelayedArtChecks() {
  for (const closeBeforeLoad of [false, true]) await check('delayed art ' + (closeBeforeLoad ? 'after destruction' : 'on live reflowed result'), async () => {
    const H = createHarness(), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels'), A = H.load('ui/BoardArt');
    const owner = new H.cc.Node('delayed-owner'); H.cc._scene.addChild(owner); const stack = new K.PopupStack(owner, () => H.state.viewport), calls = [];
    const spec = { kind: 'win', hasNext: true, rewards: [reward('chest'), reward('gift')] }, model = makeModel(spec, calls);
    H.setViewport(390, 844); const panel = P.openResult(stack, model, null), home = panel.root.find('Home'); send(H, home, 'start');
    const pending = Promise.all(['board', 'popup', 'r2', 'r3'].map(dir => A.BoardArt.shared().load(dir)));
    if (closeBeforeLoad) stack.clear(); else { H.setViewport(480, 240); stack.layout(); }
    assert((await pending).every(Boolean)); await H.flush();
    send(H, home, 'end'); assert.deepEqual(calls, []);
    if (!closeBeforeLoad) { settle(stack); snapshot(H, panel, { case: 'delayed-art-live', loadedArt: true, reducedMotion: false, tint: 'day', phase: 'settled', primaryViewport: true }, model); H.tap(home); assert.deepEqual(calls, ['Home']); }
    else { assert(!panel.alive); const replacement = P.openResult(stack, model, null); H.tap(home); assert.deepEqual(calls, []); H.tap(replacement.root.find('Home')); assert.deepEqual(calls, ['Home']); }
    stack.clear(); owner.destroy(); assert.equal(H.cc.game.listeners('hide'), 0);
  });
}

function escapeXml(value) { return String(value).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[x])); }
function diagram(row) {
  const header = 66, footer = 42, left = 14, keyX = row.width + 42;
  const textBoxes = row.boxes.filter(b => b.role === 'text'), solidBoxes = row.boxes.filter(b => b.role === 'frame' || b.role === 'hit');
  const width = row.width + 650, height = Math.max(row.height + header + footer, header + 56 + solidBoxes.length * 32 + textBoxes.length * 48 + footer);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`, '<rect width="100%" height="100%" fill="#edf2f4"/>', '<style>text{font-family:Arial,sans-serif}.small{font-size:10px}.label{font-size:9px}</style>', '<text x="14" y="20" font-size="14" font-weight="bold">NODE GEOMETRY · not Cocos pixels / device screenshot</text>', `<text x="14" y="38" class="small">${row.width}×${row.height} · ${escapeXml(row.phase)} · actual TS transforms · ${row.loadedArt ? 'real PNG dimensions' : 'fallback art dimensions'}</text>`, `<text x="14" y="54" class="small">${escapeXml(row.case)} · ${row.failures.length ? 'FAIL: ' + row.failures.length + ' geometry violations' : 'PASS: geometry gates'}</text>`, `<g transform="translate(${left},${header})">`, `<rect width="${row.width}" height="${row.height}" fill="#fff" stroke="#9aacb2"/>`, `<rect x="12" y="12" width="${row.width - 24}" height="${row.height - 24}" fill="none" stroke="#cf871d" stroke-dasharray="4 3"/>`];
  for (const box of row.boxes) {
    const invalid = row.failures.some(f => f.box?.name === box.name || f.names?.includes(box.name));
    const color = invalid ? '#c5363c' : box.role === 'hit' ? '#177861' : box.role === 'frame' ? '#977143' : box.role === 'art' ? '#5264a1' : '#728389';
    out.push(`<rect x="${box.x.toFixed(2)}" y="${box.y.toFixed(2)}" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" fill="${color}" fill-opacity="${box.role === 'hit' ? .12 : .04}" stroke="${color}" stroke-width="${box.role === 'hit' ? 1.4 : .7}"${box.role === 'text' ? ' stroke-dasharray="2 2"' : ''}/>`);
    if (box.role === 'frame' || box.role === 'hit' || box.name === 'Score' || box.name.startsWith('Star-')) {
      const text = `${box.name}${box.role === 'hit' ? ' ' + box.w.toFixed(1) + '×' + box.h.toFixed(1) : ''}`;
      out.push(`<text x="${(box.x + box.w / 2).toFixed(2)}" y="${(box.y + (box.role === 'frame' ? 12 : box.h / 2 + 3)).toFixed(2)}" text-anchor="middle" class="label" fill="${color}">${escapeXml(text)}</text>`);
    }
    if (box.role === 'text') out.push(`<text x="${(box.x + 2).toFixed(2)}" y="${(box.y + 9).toFixed(2)}" class="label" fill="#41505a">T${textBoxes.indexOf(box) + 1}</text>`);
  }
  out.push('</g>');
  let keyY = header + 14;
  out.push(`<text x="${keyX}" y="${keyY}" font-size="13" font-weight="bold">Measured bounds: x, y, width, height (viewport px)</text>`); keyY += 20;
  for (const box of solidBoxes) { out.push(`<text x="${keyX}" y="${keyY}" font-size="11">${escapeXml(box.name)}: ${[box.x, box.y, box.w, box.h].map(n => n.toFixed(2)).join(', ')}</text>`); keyY += 32; }
  out.push(`<text x="${keyX}" y="${keyY}" font-size="13" font-weight="bold">All actual Label strings and container bounds</text>`); keyY += 22;
  for (let i = 0; i < textBoxes.length; i++) {
    const b = textBoxes[i], label = b.nodePath.split('/').slice(-3).join('/');
    out.push(`<text x="${keyX}" y="${keyY}" font-size="11">T${i + 1} ${escapeXml(label)}: ${escapeXml(b.text)}</text>`);
    out.push(`<text x="${keyX + 18}" y="${keyY + 15}" class="small">${[b.x, b.y, b.w, b.h].map(n => n.toFixed(2)).join(', ')} · font ${b.physicalFontSize.toFixed(2)} px</text>`); keyY += 48;
  }
  out.push(`<text x="14" y="${height - 23}" class="small">Green: actual hit UITransform · brown: frame/title · blue: art · dotted T#: text node; exact strings in right-hand key</text>`, `<text x="14" y="${height - 9}" class="small">Amber: 12 px inset · text containers do not measure glyphs · no font rasterization, sprite slicing or Cocos render simulated</text>`, '</svg>'); return out.join('\n');
}

function writeArtifacts(summary) {
  const dir = process.env.QF_RESULT_VIEWPORT_ARTIFACTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'result-viewport-geometry.json'), JSON.stringify({ summary, rows }, null, 2));
  fs.writeFileSync(path.join(dir, 'result-viewport-input.json'), JSON.stringify({ scope, results }, null, 2));
  const files = [];
  for (const [width, height] of VIEWPORTS) for (const phase of ['open', 'settled']) {
    const row = rows.find(r => r.width === width && r.height === height && r.loadedArt && !r.reducedMotion && r.phase === phase && r.case === 'win-next-chest:ready,regionReward:ready');
    if (!row) continue;
    const file = `node-geometry-${width}x${height}-${phase}.svg`; fs.writeFileSync(path.join(dir, file), diagram(row)); files.push(file);
  }
  for (const [name, caseName, width, height] of [['short-chest', 'win-next-chest:ready', 390, 844], ['320x568-short-chest', 'win-next-chest:ready', 320, 568], ['390x844-no-rewards', 'win-next-no-rewards', 390, 844], ['lose', 'lose-hinttrue-replaytrue-goals2', 480, 240], ['unsaved', 'unsaved-hinttrue', 568, 320], ['readonly', 'readonly', 320, 480]]) {
    const row = rows.find(r => r.width === width && r.height === height && r.loadedArt && !r.reducedMotion && r.phase === 'settled' && r.case === caseName);
    if (row) { const file = `node-geometry-${name}.svg`; fs.writeFileSync(path.join(dir, file), diagram(row)); files.push(file); }
  }
  for (const pair of ['320x568-to-568x320', '568x320-to-480x240', '480x307-to-480x309']) for (const phase of ['rotation-before', 'rotation-after']) {
    const row = rows.find(r => r.case === 'same-panel-Next-' + pair && r.phase === phase);
    if (row) { const file = `node-geometry-same-panel-${pair}-${phase}.svg`; fs.writeFileSync(path.join(dir, file), diagram(row)); files.push(file); }
  }
  fs.writeFileSync(path.join(dir, 'result-viewport-summary.json'), JSON.stringify({ ...summary, diagrams: files }, null, 2));
  fs.writeFileSync(path.join(dir, 'README.md'), `# Result viewport geometry and input regression\n\n${scope}\n\nStatus: **${summary.status}**. ${summary.geometrySamples} geometry samples from ${summary.modelCases} model cases, ${summary.viewportCount} viewports, loaded/fallback art, reduced/animated motion, and open/opening/settled phases. ${summary.inputChecks} real-Result action/lifecycle checks.\n\nRequired physical gates: frame and title at least 12 px from every viewport edge; each real action hit box at least 44 by 44 px; no simultaneous action hit overlap; root and shade cover the viewport. Actions must match the Result model. Input checks use actual Result nodes and callbacks, including pointer identity, outside release, out/in, modal coverage, closing, hiding, destruction, unchanged layout, and same-panel reflow.\n\nSVG files plot measured node rectangles. They are explicitly **not Cocos screenshots**. Actual PNG metadata is loaded in the matching samples, but SVGs do not simulate sliced textures, font glyphs, native delivery, or device safe areas. Non-action content boxes outside the viewport are reported separately for visual review, not silently certified.\n\nReproduce from the source root:\n\n    QF_TYPESCRIPT_MODULE=/workspace/shared/qifengle-cloud-tools/node_modules/typescript QF_RESULT_VIEWPORT_ARTIFACTS=../tests node tools/board-ui/test_result_viewports.cjs\n\nSee result-viewport-summary.json, result-viewport-geometry.json and result-viewport-input.json for inspectable measurements, failures and source SHA-256.\n`);
}

function sourceHashes() {
  return Object.fromEntries(['creator-build-project/assets/scripts/ui/BoardPanels.ts', 'creator-build-project/assets/scripts/ui/PopupKit.ts', 'tools/board-ui/test_result_viewports.cjs'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
}
(async () => {
  const sourceSha256Start = sourceHashes();
  await runMatrix(); await runInputChecks(); await runDelayedArtChecks();
  const sourceSha256 = sourceHashes();
  await check('production source unchanged throughout matrix execution', () => assert.deepEqual(sourceSha256, sourceSha256Start));
  const geometryFailures = rows.filter(r => r.failures.length);
  const inputFailures = results.filter(r => !r.ok);
  const failureTypes = {};
  for (const row of rows) for (const failure of row.failures) failureTypes[failure.type] = (failureTypes[failure.type] || 0) + 1;
  const summary = { status: geometryFailures.length || inputFailures.length ? 'FAIL' : 'PASS', scope, source: ROOT, sourceSha256, primaryViewports: VIEWPORTS, extraViewports: EXTRA_VIEWPORTS, viewportCount: VIEWPORTS.length + EXTRA_VIEWPORTS.length, modelCases: modelCases.length, geometrySamples: rows.length, geometrySamplesFailed: geometryFailures.length, failureTypes, contentTransformObservationSamples: rows.filter(r => r.contentTransformOutsideViewport.length).length, estimatedTextOutsideViewportSamples: rows.filter(r => r.estimatedTextOutsideViewport.length).length, estimatedContentOverlapSamples: rows.filter(r => r.estimatedContentOverlaps.length).length, textEstimateScope: 'Production PopupKit.measure CJK-aware width approximation and physical font height, not glyph rasterization; diagnostics only, not a pass/fail gate.', inputChecks: results.length, inputChecksFailed: inputFailures.length, inputFailures: inputFailures.map(r => ({ name: r.name, error: r.error })), firstGeometryFailures: geometryFailures.slice(0, 6) };
  writeArtifacts(summary);
  if (process.env.QF_RESULT_VIEWPORT_REPORT) fs.writeFileSync(process.env.QF_RESULT_VIEWPORT_REPORT, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ status: summary.status, geometrySamples: summary.geometrySamples, geometrySamplesFailed: summary.geometrySamplesFailed, failureTypes, contentTransformObservationSamples: summary.contentTransformObservationSamples, inputChecks: summary.inputChecks, inputChecksFailed: summary.inputChecksFailed, inputFailures: inputFailures.map(r => r.name) }, null, 2));
  if (summary.status !== 'PASS') process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
