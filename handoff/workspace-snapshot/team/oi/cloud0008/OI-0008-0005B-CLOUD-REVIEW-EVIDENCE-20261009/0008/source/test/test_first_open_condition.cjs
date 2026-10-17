'use strict';
// Unit tests for tools/wechat_first_open_condition.cjs and tools/finalize_wechat_local_firstopen.cjs. node test/test_first_open_condition.cjs
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), assert = require('assert');
const M = require('../tools/wechat_first_open_condition.cjs');
const FX = path.join(__dirname, 'fixtures');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qf0008-unit-'));
let n = 0, pass = 0; const results = [];
function t(name, fn) { n++; try { fn(); pass++; results.push({name, ok: true}); console.log('PASS ' + name); } catch (e) { results.push({name, ok: false, error: e.message}); console.log('FAIL ' + name + '\n  ' + e.stack); } }
function mkOut(fixture, extra = {}) {
  const d = fs.mkdtempSync(path.join(tmp, 'out-'));
  fs.copyFileSync(path.join(FX, fixture), path.join(d, 'project.config.json'));
  fs.writeFileSync(path.join(d, 'game.json'), '{"deviceOrientation":"portrait"}\n');
  for (const [k, v] of Object.entries(extra)) fs.copyFileSync(path.join(FX, v), path.join(d, k));
  return d;
}
const rd = (d, f = 'project.config.json') => fs.readFileSync(path.join(d, f), 'utf8');
const js = (d, f) => JSON.parse(rd(d, f));
const B_COND = {game: {current: -1, list: []}, miniprogram: {current: -1, list: []}};
const oiA = JSON.parse(fs.readFileSync(path.join(FX, 'oi-r6-first-open-A.project.config.json'), 'utf8'));
const oiB = JSON.parse(fs.readFileSync(path.join(FX, 'oi-r6-first-open-B.project.config.json'), 'utf8'));

t('fixtures: Oi A has no condition key; Oi B differs from A only by projectname + condition', () => {
  assert.strictEqual(oiA.condition, undefined);
  const strip = (o) => { const c = {...o}; delete c.projectname; delete c.condition; return c; };
  assert.deepStrictEqual(strip(oiA), strip(oiB));
  assert.deepStrictEqual(oiB.condition, B_COND);
});
t('A (default/off) is a no-op: file byte-identical, no log dir', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json'); const before = rd(d);
  for (const v of ['A', undefined, '', 'off', '0']) { const r = M.applyFirstOpenCondition(d, v); assert.strictEqual(r.changed, false); }
  assert.strictEqual(rd(d), before); assert.ok(!fs.existsSync(d + '.first-open-condition'));
});
t('B on Oi A keeps Oi\'s \\u-escaped style: text = A text + condition block only', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json'); const before = rd(d);
  M.applyFirstOpenCondition(d, 'B'); const after = rd(d);
  assert.ok(after.includes('\\u9879\\u76ee'), 'description stays escaped');
  assert.strictEqual(after.slice(0, before.length - 2), before.slice(0, before.length - 2), 'prefix unchanged up to closing');
});
t('B on Oi A reproduces Oi-verified B config exactly (deep-equal after projectname)', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  const r = M.applyFirstOpenCondition(d, 'B'); assert.strictEqual(r.changed, true);
  const got = js(d); got.projectname = oiB.projectname;
  assert.deepStrictEqual(got, oiB);
  assert.deepStrictEqual(Object.keys(got), Object.keys(oiB), 'key order');
});
t('B on Oi A is BYTE-identical to Oi\'s verified first-open-b-project.config.json (projectname aside)', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  M.applyFirstOpenCondition(d, 'B');
  assert.strictEqual(rd(d).replace('ForestWorldR6FirstOpenA', 'ForestWorldR6FirstOpenB'), fs.readFileSync(path.join(FX, 'oi-r6-first-open-B.project.config.json'), 'utf8'));
});
t('B preserves every other field and key order; backup + log written OUTSIDE the output dir', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json'); const before = rd(d);
  const r = M.applyFirstOpenCondition(d, 'B');
  const after = js(d);
  for (const k of Object.keys(oiA)) assert.deepStrictEqual(after[k], oiA[k], k);
  assert.deepStrictEqual(Object.keys(after), [...Object.keys(oiA), 'condition']);
  const logDir = d + '.first-open-condition';
  assert.strictEqual(fs.readFileSync(path.join(logDir, 'project.config.json.before-first-open.bak'), 'utf8'), before);
  const lines = fs.readFileSync(path.join(logDir, 'first-open-condition.log.jsonl'), 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 1);
  const rec = JSON.parse(lines[0]);
  assert.ok(rec.files[0].diff.includes('+  "condition": {'), 'diff shows condition');
  assert.ok(!rec.files[0].diff.split('\n').some((l) => l.startsWith('-') && !l.startsWith('---') && !l.includes('"projectname"') && l !== '-}'), 'no removed lines except closing brace');
  assert.deepStrictEqual(fs.readdirSync(d).sort(), ['game.json', 'project.config.json'], 'nothing extra inside output dir');
  assert.strictEqual(r.files[0].previousCondition, '(absent)');
});
t('idempotent: second B run changes nothing, keeps single backup, no new log line', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  M.applyFirstOpenCondition(d, 'B'); const once = rd(d);
  const r2 = M.applyFirstOpenCondition(d, 'B');
  assert.strictEqual(r2.changed, false); assert.strictEqual(rd(d), once);
  assert.strictEqual(fs.readFileSync(path.join(d + '.first-open-condition', 'first-open-condition.log.jsonl'), 'utf8').trim().split('\n').length, 1);
});
t('B on already-B (Oi B file) is untouched byte-for-byte (keeps Oi\'s \\u escapes)', () => {
  const d = mkOut('oi-r6-first-open-B.project.config.json'); const before = rd(d);
  const r = M.applyFirstOpenCondition(d, 'B'); assert.strictEqual(r.changed, false); assert.strictEqual(rd(d), before);
});
t('empty Cocos-template condition (game.currentL typo) is replaced by B', () => {
  const d = mkOut('synthetic-cocos-template-currentL.project.config.json');
  const r = M.applyFirstOpenCondition(d, 'B'); assert.strictEqual(r.changed, true);
  assert.deepStrictEqual(js(d).condition, B_COND);
  assert.ok(r.files[0].previousCondition.game.currentL === -1);
});
t('active (non-empty) condition is refused and file untouched', () => {
  const d = mkOut('synthetic-active-condition.project.config.json'); const before = rd(d);
  assert.throws(() => M.applyFirstOpenCondition(d, 'B'), /NOT empty/); assert.strictEqual(rd(d), before);
});
t('B1 creates project.private.config.json with the same condition', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  const r = M.applyFirstOpenCondition(d, 'B1');
  assert.deepStrictEqual(js(d).condition, B_COND);
  assert.deepStrictEqual(js(d, 'project.private.config.json'), {condition: B_COND});
  assert.strictEqual(r.files.length, 2); assert.strictEqual(r.files[1].existed, false);
  assert.strictEqual(M.applyFirstOpenCondition(d, 'B1').changed, false, 'B1 idempotent');
});
t('B1 preserves existing private config fields and order', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json', {'project.private.config.json': 'synthetic-existing.project.private.config.json'});
  const orig = js(d, 'project.private.config.json');
  M.applyFirstOpenCondition(d, 'B1');
  const p = js(d, 'project.private.config.json');
  for (const k of Object.keys(orig)) assert.deepStrictEqual(p[k], orig[k]);
  assert.deepStrictEqual(Object.keys(p), [...Object.keys(orig), 'condition']);
  assert.ok(fs.existsSync(path.join(d + '.first-open-condition', 'project.private.config.json.before-first-open.bak')));
});
t('B2 writes game-only condition', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  M.applyFirstOpenCondition(d, 'B2'); assert.deepStrictEqual(js(d).condition, {game: {current: -1, list: []}});
});
t('switching B -> B2 on the same output is allowed (B condition counts as empty)', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  M.applyFirstOpenCondition(d, 'B'); M.applyFirstOpenCondition(d, 'B2');
  assert.deepStrictEqual(js(d).condition, {game: {current: -1, list: []}});
  assert.strictEqual(fs.readFileSync(path.join(d + '.first-open-condition', 'project.config.json.before-first-open.bak'), 'utf8'), fs.readFileSync(path.join(FX, 'oi-r6-first-open-A.project.config.json'), 'utf8'), 'backup keeps the very first original');
});
t('--check writes nothing', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json'); const before = rd(d);
  const r = M.applyFirstOpenCondition(d, 'B', {check: true});
  assert.strictEqual(r.files[0].changed, true); assert.strictEqual(rd(d), before); assert.ok(!fs.existsSync(d + '.first-open-condition'));
});
t('unknown variant rejected; missing project.config.json rejected', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  assert.throws(() => M.applyFirstOpenCondition(d, 'C'), /unknown/);
  assert.throws(() => M.applyFirstOpenCondition(tmp, 'B'), /not found/);
});
t('CLI entry: prints JSON report, exit 0; active condition exit 1', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, '../tools/wechat_first_open_condition.cjs'), d, '--variant=B'], {encoding: 'utf8'});
  assert.strictEqual(r.status, 0, r.stderr); assert.strictEqual(JSON.parse(r.stdout).variant, 'B');
  const d2 = mkOut('synthetic-active-condition.project.config.json');
  const r2 = cp.spawnSync(process.execPath, [path.join(__dirname, '../tools/wechat_first_open_condition.cjs'), d2, '--variant=B'], {encoding: 'utf8'});
  assert.strictEqual(r2.status, 1);
});
const W = path.join(__dirname, '../tools/finalize_wechat_local_firstopen.cjs');
const wenv = (extra) => ({...process.env, QF_FINALIZE_WECHAT_LOCAL: path.join(__dirname, 'fake-finalize_wechat_local.cjs'), QF_FIRST_OPEN_CONDITION: '', ...extra});
t('wrapper default off == original finalizer alone (byte-identical output)', () => {
  const d1 = mkOut('synthetic-cocos-template-currentL.project.config.json'), d2 = mkOut('synthetic-cocos-template-currentL.project.config.json');
  cp.spawnSync(process.execPath, [path.join(__dirname, 'fake-finalize_wechat_local.cjs'), d1, '--gate']);
  const r = cp.spawnSync(process.execPath, [W, d2, '--gate'], {encoding: 'utf8', env: wenv({})});
  assert.strictEqual(r.status, 0, r.stderr); assert.strictEqual(rd(d2), rd(d1)); assert.strictEqual(js(d2).condition, undefined);
});
t('wrapper with env B: finalizer runs first, then B applied', () => {
  const d = mkOut('synthetic-cocos-template-currentL.project.config.json');
  const r = cp.spawnSync(process.execPath, [W, d], {encoding: 'utf8', env: wenv({QF_FIRST_OPEN_CONDITION: 'B'})});
  assert.strictEqual(r.status, 0, r.stderr); assert.deepStrictEqual(js(d).condition, B_COND);
  assert.match(r.stdout, /removed empty condition/);
});
t('wrapper flag --first-open-condition=B is stripped before the finalizer sees argv', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  const r = cp.spawnSync(process.execPath, [W, d, '--first-open-condition=B'], {encoding: 'utf8', env: wenv({})});
  assert.strictEqual(r.status, 0, r.stderr); assert.deepStrictEqual(js(d).condition, B_COND);
});
t('wrapper propagates finalizer rejection and applies nothing', () => {
  const d = mkOut('synthetic-active-condition.project.config.json'); const before = rd(d);
  const r = cp.spawnSync(process.execPath, [W, d], {encoding: 'utf8', env: wenv({QF_FIRST_OPEN_CONDITION: 'B'})});
  assert.strictEqual(r.status, 5); assert.strictEqual(rd(d), before);
});
t('wrapper re-run on its own output is stable (finalizer strips B, wrapper re-applies B → identical)', () => {
  const d = mkOut('oi-r6-first-open-A.project.config.json');
  cp.spawnSync(process.execPath, [W, d], {env: wenv({QF_FIRST_OPEN_CONDITION: 'B'})}); const once = js(d);
  const r = cp.spawnSync(process.execPath, [W, d], {encoding: 'utf8', env: wenv({QF_FIRST_OPEN_CONDITION: 'B'})});
  assert.strictEqual(r.status, 0, r.stderr); assert.deepStrictEqual(js(d), once); const second = rd(d);
  cp.spawnSync(process.execPath, [W, d], {env: wenv({QF_FIRST_OPEN_CONDITION: 'B'})});
  assert.strictEqual(rd(d), second, '2nd and 3rd wrapper runs byte-identical (1st may differ only by the stand-in finalizer\'s own formatting)');
});
console.log(`\n${pass}/${n} passed`);
fs.writeFileSync(process.env.QF_UNIT_RESULT || path.join(tmp, 'result.json'), JSON.stringify({passed: pass, total: n, results}, null, 2));
process.exit(pass === n ? 0 : 1);
