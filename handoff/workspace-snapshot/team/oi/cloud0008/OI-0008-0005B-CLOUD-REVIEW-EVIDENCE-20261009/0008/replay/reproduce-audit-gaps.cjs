'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto'), assert = require('assert');
const SOURCE = path.resolve(__dirname, '../source');
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'qf0008-review-'));
if (fs.existsSync(OUT) && fs.readdirSync(OUT).length) throw new Error('Refuse nonempty output: ' + OUT);
fs.mkdirSync(OUT, {recursive: true});
const condition = require(path.join(SOURCE, 'tools/wechat_first_open_condition.cjs'));
const {snapshotLogs, logDelta, injectShim} = require(path.join(SOURCE, 'tools/wechat_first_open_audit.cjs'));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const walk = (root, rel = '') => fs.readdirSync(path.join(root, rel), {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(root, path.join(rel,e.name)) : [path.join(rel,e.name)]).sort();
const sourceBefore = walk(SOURCE).map(f => [f, sha(path.join(SOURCE, f))]);
fs.writeFileSync(path.join(OUT, 'source-hashes-before.json'), JSON.stringify(sourceBefore, null, 2));
fs.chmodSync(path.join(__dirname, 'review-fake-cli.cjs'), 0o755);
const tmp = fs.mkdtempSync(path.join(OUT, 'fixtures-'));
const build = path.join(tmp, 'build'); fs.mkdirSync(build);
fs.copyFileSync(path.join(SOURCE, 'test/fixtures/oi-r6-first-open-A.project.config.json'), path.join(build, 'project.config.json'));
fs.writeFileSync(path.join(build, 'game.json'), '{}\n');
fs.writeFileSync(path.join(build, 'game.js'), '// Review fixture has no game or start page.\nconsole.log("only a stub");\n');
const results = [];
for (const [i, scenario] of ['no-control-no-logs', 'missing-root', 'rotation', 'unrelated-control', 'cli-nonzero'].entries()) {
  const root = path.join(tmp, scenario), out = path.join(OUT, 'repro-' + scenario), logs = path.join(root, 'logs');
  if (['rotation', 'unrelated-control', 'cli-nonzero'].includes(scenario)) {
    const log = path.join(logs, 'review', 'WeappLog', 'review.log'); fs.mkdirSync(path.dirname(log), {recursive: true});
    fs.writeFileSync(log, scenario === 'rotation' ? 'old unrelated log padding\n'.repeat(100) : 'existing empty baseline\n');
  }
  const env = {...process.env, QF_FIRST_OPEN_DRY_RUN: '1', QF_DEVTOOLS_QUIT_FIRST: '0', QF_FIRST_OPEN_SCREENCAPTURE: '0', QF_FIRST_OPEN_IGNORE_ERROR_REGEX: '',
    QF_WECHAT_CLI: path.join(__dirname, 'review-fake-cli.cjs'), QF_MINIPROGRAM_AUTOMATOR_MODULE: path.join(__dirname, 'review-fake-automator.cjs'),
    QF_WECHAT_BUILD_DIR: build, QF_FIRST_OPEN_WORK_ROOT: path.join(root, 'copies'), QF_FIRST_OPEN_OUT: out,
    QF_FIRST_OPEN_CONTROL: scenario === 'no-control-no-logs' ? 'none' : 'A', QF_FIRST_OPEN_VARIANT: 'B',
    QF_FIRST_OPEN_MODE: 'auto', QF_FIRST_OPEN_INJECT_SHIM: '1', QF_FIRST_OPEN_KEEP_COPIES: '1', QF_DEVTOOLS_LOG_DIR: logs,
    QF_AUTO_PORT: String(41000 + 2 * i), QF_FIRST_OPEN_SETTLE_MS: '0', QF_FIRST_OPEN_LAUNCH_TIMEOUT_MS: '5000', QF_REVIEW_STATE: path.join(root,'state'), QF_REVIEW_SCENARIO: scenario};
  const run = cp.spawnSync(process.execPath, [path.join(SOURCE, 'tools/wechat_first_open_audit.cjs')], {env, encoding:'utf8', timeout:30000});
  fs.mkdirSync(out, {recursive:true}); fs.writeFileSync(path.join(out,'runner.stdout.txt'),run.stdout || ''); fs.writeFileSync(path.join(out,'runner.stderr.txt'),run.stderr || '');
  const v = JSON.parse(fs.readFileSync(path.join(out,'verdict.json'),'utf8'));
  const r = {scenario, exit:run.status, status:v.status, reason:v.reason, targetLogChannel:v.variants[0].channels.weappLog, targetCliCode:v.variants[0].steps.cliAuto.code, targetScreenshotError:v.variants[0].steps.screenshotError, controlDetected:v.controlDetected};
  assert.strictEqual(v.status,'PASS','Expected to reproduce unsound PASS in ' + scenario);
  if (scenario === 'missing-root' || scenario === 'rotation') {
    const raw = fs.readFileSync(path.join(logs,'review','WeappLog','review.log'),'utf8');
    assert.ok(raw.includes('[TARGET ERROR')); assert.strictEqual(v.variants[0].errors.length,0); r.rawLogHasTargetError = true;
    fs.copyFileSync(path.join(logs,'review','WeappLog','review.log'),path.join(out,'review-raw-weapplog.txt'));
  }
  if (scenario === 'unrelated-control') assert.ok(v.variants[1].errors.some(e => e.text.includes('UNRELATED OTHER PROJECT')));
  if (scenario === 'cli-nonzero') assert.strictEqual(r.targetCliCode,7);
  results.push(r); console.log(JSON.stringify(r));
}
// Standalone byte-delta tests: root equal to WeappLog, new old file, truncation, cap.
const logTests=[]; const logRoot=path.join(tmp,'delta-tests'), logDir=path.join(logRoot,'WeappLog'); fs.mkdirSync(logDir,{recursive:true});
const f=path.join(logDir,'x.log'); fs.writeFileSync(f,'baseline\n');
logTests.push({case:'root-is-WeappLog',files:snapshotLogs(logDir).snap.size});
let before=snapshotLogs(logRoot); fs.writeFileSync(path.join(logDir,'historic.log'),'[2001-01-01] [app.json 或自定义编译条件错误] historical archived error\n');
logTests.push({case:'new-file-with-old-timestamp',delta:logDelta(before,snapshotLogs(logRoot))});
before=snapshotLogs(logRoot); fs.appendFileSync(f,'x'.repeat(8*1024*1024)+'\n[app.json 或自定义编译条件错误] after cap\n');
logTests.push({case:'over-8MiB-append',capturedError:logDelta(before,snapshotLogs(logRoot)).some(x=>x.line.includes('after cap')),dataLossDisclosed:false});
const malformed={game:{current:0,pathName:'pages/launch',query:'keep-me'}};
const configDir=path.join(tmp,'condition');fs.mkdirSync(configDir);fs.writeFileSync(path.join(configDir,'project.config.json'),JSON.stringify({compileType:'game',condition:malformed,setting:{enhance:false}}));
condition.applyFirstOpenCondition(configDir,'B');
logTests.push({case:'condition-with-missing-list',classifiedEmpty:condition.isEmptyCondition(malformed),after:JSON.parse(fs.readFileSync(path.join(configDir,'project.config.json'),'utf8'))});
fs.writeFileSync(path.join(OUT,'delta-and-condition-results.json'),JSON.stringify(logTests,null,2));
const sourceAfter = walk(SOURCE).map(f => [f, sha(path.join(SOURCE, f))]); assert.deepStrictEqual(sourceAfter,sourceBefore);
fs.writeFileSync(path.join(OUT,'source-hashes-after.json'),JSON.stringify(sourceAfter,null,2));
fs.writeFileSync(path.join(OUT,'reproduction-summary.json'),JSON.stringify({scope:'Cloud-only reviewer-authored fake CLI and in-process vm automator. No real Mac, real DevTools, network, install, or quit call. NOT validation of actual DevTools behavior.',sourceUnchanged:true,results,logTests},null,2));

console.log("Evidence directory: " + OUT);
