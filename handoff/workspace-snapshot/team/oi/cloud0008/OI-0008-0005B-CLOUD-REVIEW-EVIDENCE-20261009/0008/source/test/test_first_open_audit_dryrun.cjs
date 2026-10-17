'use strict';
/**
 * Dry-run of tools/wechat_first_open_audit.cjs against the FAKE CLI + fake automation server (real miniprogram-automator client).
 * Proves the runner's plumbing and verdict logic only — NOT WeChat DevTools behaviour.
 *   QF_MINIPROGRAM_AUTOMATOR_MODULE=<dir of miniprogram-automator> node test/test_first_open_audit_dryrun.cjs [outDir]
 */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'qf0008-dry-')));
fs.mkdirSync(OUT, {recursive: true});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qf0008-dryw-'));
const build = path.join(tmp, 'wechatgame-fresh');
fs.mkdirSync(build);
fs.copyFileSync(path.join(__dirname, 'fixtures/oi-r6-first-open-A.project.config.json'), path.join(build, 'project.config.json'));
fs.writeFileSync(path.join(build, 'game.json'), JSON.stringify({deviceOrientation: 'portrait', subpackages: [{name: 'resources', root: 'subpackages/resources/'}]}, null, 2));
fs.copyFileSync(path.join(__dirname, 'fixtures/fake-build-game.js'), path.join(build, 'game.js'));
fs.mkdirSync(path.join(build, 'subpackages/resources'), {recursive: true});
fs.writeFileSync(path.join(build, 'subpackages/resources/game.js'), '// fake subpackage\n');
const treeHash = (d) => { const h = crypto.createHash('sha256'); const walk = (r) => { for (const e of fs.readdirSync(path.join(d, r), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(r, e.name); if (e.isDirectory()) walk(p); else { h.update(p); h.update(fs.readFileSync(path.join(d, p))); } } }; walk(''); return h.digest('hex'); };
const buildHash0 = treeHash(build);
const buildB = path.join(tmp, 'wechatgame-fresh-finalized-B');
fs.cpSync(build, buildB, {recursive: true});
fs.copyFileSync(path.join(__dirname, 'fixtures/oi-r6-first-open-B.project.config.json'), path.join(buildB, 'project.config.json'));

let port = 9620;
const cases = [
  {name: '01-clean-B-control-A', env: {}, expect: 'PASS', check: (v) => { assert.strictEqual(v.controlDetected, true); assert.ok(v.variants[1].errors.some((e) => e.source === 'weapplog')); assert.strictEqual(v.variants[0].channels.automatorConsole.provenByLateHeartbeat, true); assert.strictEqual(v.variants[0].channels.shim.readable, true); }},
  {name: '02-target-A-no-control', env: {QF_FIRST_OPEN_VARIANT: 'A', QF_FIRST_OPEN_CONTROL: 'none'}, expect: 'FAIL', check: (v) => assert.ok(v.reason.includes('weapplog'))},
  {name: '03-boot-error-before-connect', env: {QF_FAKE_SCENARIO: 'game-error'}, expect: 'FAIL', check: (v) => { const s = v.variants[0].errors.map((e) => e.source); assert.ok(s.includes('shim.console.error')); assert.ok(!s.includes('automator.console.error'), 'pre-connect error invisible to automator — shim needed'); }},
  {name: '04-late-error-after-connect', env: {QF_FAKE_SCENARIO: 'late-error'}, expect: 'FAIL', check: (v) => { const s = v.variants[0].errors.map((e) => e.source); assert.ok(s.includes('automator.console.error') && s.includes('shim.console.error')); }},
  {name: '05-exception', env: {QF_FAKE_SCENARIO: 'exception'}, expect: 'FAIL', check: (v) => { const s = v.variants[0].errors.map((e) => e.source); assert.ok(s.includes('automator.exception') && s.includes('shim.wx.onError')); }},
  {name: '06-console-not-forwarded', env: {QF_FAKE_SCENARIO: 'no-log-forward', QF_FIRST_OPEN_CONTROL: 'none'}, expect: 'BLOCKED', check: (v) => assert.match(v.reason, /console channel not proven/)},
  {name: '07-connect-fail', env: {QF_FAKE_SCENARIO: 'connect-fail', QF_FIRST_OPEN_LAUNCH_TIMEOUT_MS: '4000'}, expect: 'BLOCKED', check: (v) => assert.match(v.reason, /connect/)},
  {name: '08-cli-missing', env: {QF_WECHAT_CLI: '/nonexistent/cli'}, expect: 'BLOCKED', check: (v) => assert.match(v.reason, /CLI not found/)},
  {name: '09-control-invisible-no-weapplog', env: {QF_FAKE_NO_WEAPPLOG: '1'}, expect: 'BLOCKED', check: (v) => { assert.strictEqual(v.variants[0].status, 'PASS'); assert.match(v.reason, /detector not proven/); }},
  {name: '10-open-mode', env: {QF_FIRST_OPEN_MODE: 'open', QF_FIRST_OPEN_CONTROL: 'none'}, expect: 'BLOCKED', check: (v) => assert.match(v.reason, /open mode/)},
  {name: '11-B1-control-A', env: {QF_FIRST_OPEN_VARIANT: 'B1'}, expect: 'PASS', check: (v) => assert.ok(fs.existsSync(path.join(v.variants[0].projectDir, 'project.private.config.json')))},
  {name: '12-B2-control-A', env: {QF_FIRST_OPEN_VARIANT: 'B2'}, expect: 'PASS'},
  {name: '14-source-build-already-B', env: {QF_WECHAT_BUILD_DIR: buildB}, expect: 'PASS', check: (v) => { assert.strictEqual(v.controlDetected, true); assert.deepStrictEqual(v.variants[1].steps.sourceConditionRemovedOnCopy, {game: {current: -1, list: []}, miniprogram: {current: -1, list: []}}); }},
  {name: '13-no-control', env: {QF_FIRST_OPEN_CONTROL: 'none'}, expect: 'PASS', check: (v) => assert.match(v.reason, /NO positive control/)},
];
const summary = [];
for (const c of cases) {
  const out = path.join(OUT, c.name);
  const env = {...process.env, QF_FIRST_OPEN_DRY_RUN: '1', QF_WECHAT_CLI: path.join(__dirname, 'fake-wechat-cli.cjs'), QF_WECHAT_BUILD_DIR: build,
    QF_FIRST_OPEN_WORK_ROOT: path.join(tmp, 'copies'), QF_FIRST_OPEN_OUT: out, QF_AUTO_PORT: String(port), QF_FIRST_OPEN_SETTLE_MS: '2500',
    QF_DEVTOOLS_LOG_DIR: path.join(tmp, 'devtools-userdata'), QF_FAKE_STATE_DIR: path.join(tmp, 'fake-state'), QF_FIRST_OPEN_LAUNCH_TIMEOUT_MS: '20000', QF_FAKE_SCENARIO: '', ...c.env};
  port += 2;
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools/wechat_first_open_audit.cjs')], {env, encoding: 'utf8', timeout: 180000});
  const v = JSON.parse(fs.readFileSync(path.join(out, 'verdict.json'), 'utf8'));
  let ok = v.status === c.expect && r.status === {PASS: 0, FAIL: 1, BLOCKED: 2}[c.expect], err = null;
  try {
    if (ok && c.check) c.check(v);
    // manifest integrity
    for (const line of fs.readFileSync(path.join(out, 'SHA256SUMS.txt'), 'utf8').trim().split('\n')) {
      const [h, p] = line.split(/  /); assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(out, p))).digest('hex'), h, p);
    }
    assert.ok(fs.readFileSync(path.join(out, 'run.log'), 'utf8').split('\n').filter(Boolean).every((l) => /^\d{4}-\d\d-\d\dT[\d:.]+Z \+\d+\.\ds /.test(l)), 'every log line timestamped');
    assert.strictEqual(v.dryRun, true);
  } catch (e) { ok = false; err = e.message; }
  summary.push({case: c.name, expect: c.expect, got: v.status, exit: r.status, ok, reason: v.reason, error: err, ms: Date.now() - t0});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name}: expect ${c.expect}, got ${v.status} (exit ${r.status}) — ${v.reason}${err ? ' !! ' + err : ''}`);
}
// unique copies + source untouched
const copies = fs.readdirSync(path.join(tmp, 'copies'));
const uniq = new Set(copies).size === copies.length && copies.every((n) => /^QFFirstOpen-\d{8}T\d{6}Z-[0-9a-f]{6}-(A|B|B1|B2)$/.test(n));
const untouched = treeHash(build) === buildHash0;
summary.push({case: 'unique-copy-names', ok: uniq, copies: copies.length}, {case: 'source-build-untouched', ok: untouched});
console.log(`${uniq ? 'PASS' : 'FAIL'} unique copy dir names (${copies.length})`);
console.log(`${untouched ? 'PASS' : 'FAIL'} source build dir byte-identical after all runs`);
const passed = summary.filter((s) => s.ok).length;
fs.writeFileSync(path.join(OUT, 'dryrun-summary.json'), JSON.stringify({scope: 'DRY RUN with fake CLI + fake automation server; real miniprogram-automator client', passed, total: summary.length, summary}, null, 2));
console.log(`\n${passed}/${summary.length} passed`);
try { cp.spawnSync(path.join(__dirname, 'fake-wechat-cli.cjs'), ['quit'], {env: {...process.env, QF_FAKE_STATE_DIR: path.join(tmp, 'fake-state')}}); } catch {}
process.exit(passed === summary.length ? 0 : 1);
