'use strict';
// Actual production TS/node contracts; synthetic Canvas boundary probes, not engine glyphs.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const ROOT = process.env.QF_RESULT_SAFE_SOURCE || path.resolve(__dirname, '../..');
const OUT = process.env.QF_REWARD_WIDTH_OUTPUT;
const { createHarness } = require(path.join(ROOT, 'tools/board-ui/harness.cjs'));
const files = ['ManagedMobileBoardUI.ts', 'ui/PopupKit.ts', 'ui/BoardPanels.ts'];
const hashes = () => Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'creator-build-project/assets/scripts', f))).digest('hex')]));
const initial = hashes(), rows = [], checks = [];
const check = (name, fn) => { try { fn(); checks.push({ name, ok: true }); } catch (e) { checks.push({ name, ok: false, error: e.message }); } };
const textFor = { 7: '领取工具大礼包', 8: '领取地区工具礼包', 12: '奖'.repeat(12) };
const old = { document: globalThis.document, wx: globalThis.wx };
async function main() {
  for (const branch of ['none', 'canvas', 'wxCanvas']) for (const loaded of [false, true]) for (const reduced of [false, true]) {
    delete globalThis.document; delete globalThis.wx;
    const context = { font: '', measureText(text) { return { width: Array.from(text).length * parseFloat(this.font) }; } };
    if (branch === 'canvas') globalThis.document = { createElement: () => ({ getContext: () => context }) };
    if (branch === 'wxCanvas') globalThis.wx = { createCanvas: () => ({ getContext: () => context }) };
    const H = createHarness(), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
    H.load('ui/UiPrefs').setReducedMotion(reduced);
    if (loaded) await Promise.all(['board', 'popup', 'r2'].map(x => H.load('ui/BoardArt').BoardArt.shared().load(x)));
    const owner = new H.cc.Node('RewardWidthProbe'); H.cc._scene.addChild(owner);
    let viewport; const stack = new K.PopupStack(owner, () => viewport);
    for (const state of ['ready', 'claimed', 'locked']) for (const chars of [7, 8, 12]) for (const count of [1, 2]) for (const delta of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) {
      const measured = chars * 16 + (branch === 'none' ? 0 : 1);
      // One reward: safeW - frame24 - inner16 - icon60 - label16.
      // Paired: (safeW - frame24 - inner16 - gap12)/2 - icon60 - label16.
      const width = count === 1 ? measured + 116 + delta : measured * 2 + 204 + delta;
      viewport = { width, height: 196 }; H.setViewport(width, 196);
      const calls = [], text = textFor[chars];
      const model = { kind: 'win', stars: 3, score: 100, movesUsed: 1, movesLeft: 1, goalsLeft: [], chestHint: false,
        rewards: Array.from({ length: count }, (_, i) => ({ id: String(i), state, label: text, icon: 'popup/chest_closed', claim: () => calls.push('claim-' + i) })), next: () => calls.push('next'), home: () => calls.push('home') };
      const p = P.openResult(stack, model, null);
      for (let i = 0; i < 40; i++) stack.update(.025);
      const pages = Number(p.root.find('ResultPageNumber').getComponent(H.cc.Label).string.split('/')[1]) || 1;
      const visible = new Map();
      for (let page = 1; page <= pages; page++) {
        p.root.walk(n => { const l = n.getComponent(H.cc.Label); if (l && n.activeInHierarchy) visible.set(n, { name: n.name, text: l.string, font: l.fontSize, width: n.getComponent(H.cc.UITransform).width, page }); });
        if (page < pages) H.tap(p.root.find('ResultNextPage'));
      }
      const inner = Math.min(680, width - 24) - 16;
      const expectedPaired = count === 2 && inner >= 400 && measured <= (inner - 12) / 2 - 76;
      const cell = expectedPaired ? (inner - 12) / 2 : inner, expectedFull = measured > cell - 76;
      const record = { branch, loaded, reduced, state, chars, count, delta, width, safeHeight: 196, measured, pages, expectedPaired, expectedFull, labels: [] };
      const key = [branch, loaded, reduced, state, chars, count, delta].join('/');
      for (let i = 0; i < count; i++) {
        const full = [...visible.values()].filter(l => l.name === 'ResultRewardLabel-' + i || l.name.startsWith('ResultRewardLabel-' + i + '-continued-')).sort((a, b) => (Number(a.name.split('-continued-')[1]) || 0) - (Number(b.name.split('-continued-')[1]) || 0));
        const n = state === 'ready' ? p.root.find('Claim-' + i).find('Label') : p.root.find('ResultRewardState-' + i);
        const label = n.getComponent(H.cc.Label), labelWidth = n.getComponent(H.cc.UITransform).width;
        const row = { reward: i, fullText: full.map(l => l.text).join(''), displayed: label.string, labelWidth, fullPages: full.map(l => l.page), parent: state === 'ready' ? n.parent.parent.parent.name : n.parent.name };
        record.labels.push(row);
        check(key + '/' + i + ' exact threshold', () => { assert.equal(!!full.length, expectedFull); assert.equal(row.parent === 'ResultFlow-reward-pair', expectedPaired); });
        check(key + '/' + i + ' complete reachable label', () => { assert(visible.has(n), 'state/action text must be reachable through real paging'); assert.equal(row.fullText || label.string, text); });
        check(key + '/' + i + ' visible glyph bound', () => { assert(Array.from(label.string).length * 16 <= labelWidth, JSON.stringify(row)); for (const l of full) assert(Array.from(l.text).length * l.font <= l.width); });
        if (state === 'ready') check(key + '/' + i + ' actual claim text width', () => { assert.equal(labelWidth, cell - 76); assert.equal(label.overflow, H.cc.Label.Overflow.CLAMP); });
      }
      check(key + ' no callbacks from paging', () => assert.deepEqual(calls, []));
      rows.push(record); stack.clear();
    }
    owner.destroy();
  }
  check('production source unchanged', () => assert.deepEqual(hashes(), initial));
  const failures = checks.filter(c => !c.ok);
  const result = { status: failures.length ? 'FAIL' : 'PASS', source: ROOT, sourceSha256: initial, testSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), scope: 'Reward label threshold, actual CLAMP width, all reachable text and paired layout, Canvas/no Canvas/wxCanvas, equality and both sides, 7/8/12 CJK characters, ready/claimed/locked, loaded/fallback and animated/reduced. Synthetic metrics only; no engine glyph claim.', samples: rows.length, checks: checks.length, failures, matrix: rows };
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'reward-width.json'), JSON.stringify(result, null, 2)); }
  console.log(JSON.stringify({ ...result, matrix: undefined, failures: failures.slice(0, 12), failedChecks: failures.length }, null, 2));
  if (failures.length) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exitCode = 2; }).finally(() => { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
