'use strict';
/**
 * 0008 v2 unit tests. Applies 0008-v2-finalize_wechat_local.patch to Oi's REAL finalize_wechat_local.cjs (12ef697) with
 * git apply --check / apply, compares patched vs original on Oi's real R6 configs and the Creator 3.8.8 template fields Oi reported,
 * then checks the console rules on Oi's real console copies.   node test/test_finalizer_0008v2.cjs [resultJson]
 */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto'), assert = require('assert');
const PKG = path.resolve(__dirname, '..'), FX = path.join(__dirname, 'fixtures'), R6 = path.join(FX, 'oi-r6startup');
const ORIG = path.join(FX, 'oi-finalize_wechat_local-12ef697.cjs'), PATCH = path.join(PKG, '0008-v2-finalize_wechat_local.patch');
const rules = require('../tools/first_open_console_rules.cjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qf0008v2-unit-'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let n = 0, pass = 0; const results = [];
function t(name, fn) { n++; try { fn(); pass++; results.push({name, ok: true}); console.log('PASS ' + name); } catch (e) { results.push({name, ok: false, error: e.message}); console.log('FAIL ' + name + '\n  ' + String(e.stack || e).split('\n').slice(0, 6).join('\n  ')); } }
const git = (cwd, ...a) => cp.execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const repo = path.join(tmp, 'repo'); fs.mkdirSync(path.join(repo, 'tools'), {recursive: true});
fs.copyFileSync(ORIG, path.join(repo, 'tools/finalize_wechat_local.cjs'));
git(repo, 'init', '-q'); git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'oi 12ef697');
const PATCHED = path.join(repo, 'tools/finalize_wechat_local.cjs');

t('Oi finalizer SHA256 = 613273…6b09 (12ef697), same file as from-oi/r6-finalizer-2310Z', () => assert.strictEqual(sha(fs.readFileSync(ORIG)), '613273428bd91756e08f9a49c27a8ca218ac674c2055fa763d164de278266b09'));
t('git apply --check OK; applied result == reference/finalize_wechat_local.12ef697+0008v2.cjs; node --check OK', () => {
  git(repo, 'apply', '--check', PATCH); git(repo, 'apply', PATCH);
  assert.strictEqual(fs.readFileSync(PATCHED, 'utf8'), fs.readFileSync(path.join(PKG, 'reference/finalize_wechat_local.12ef697+0008v2.cjs'), 'utf8'));
  cp.execFileSync(process.execPath, ['--check', PATCHED]);
});
t('patch touches only tools/finalize_wechat_local.cjs and reverse-applies (git apply -R --check)', () => {
  assert.deepStrictEqual(fs.readFileSync(PATCH, 'utf8').split('\n').filter((l) => l.startsWith('diff --git')), ['diff --git a/tools/finalize_wechat_local.cjs b/tools/finalize_wechat_local.cjs']);
  git(repo, 'apply', '-R', '--check', PATCH);
});
t('patched source keeps the compileType + AppID asserts, the refusal message and enhance=false line verbatim', () => {
  const src = fs.readFileSync(PATCHED, 'utf8');
  for (const l of ["assert.equal(config.compileType,'game','Only normalize a mini-game output');", "assert.equal(config.appid,'wx3bdd911c5c06f591','Unexpected game AppID');", "'Preserve active custom compile conditions; review manually'", 'config.setting.enhance = false;', 'delete config.condition;']) assert.ok(src.includes(l), l);
  assert.ok(!/QF_FIRST_OPEN_CONDITION|config\.condition\s*=[^=]/.test(src), 'no condition-writing variants in the finalizer');
});

function out(fixture, extra = {}) { const d = fs.mkdtempSync(path.join(tmp, 'out-')); fs.copyFileSync(fixture, path.join(d, 'project.config.json')); for (const [k, v] of Object.entries(extra)) fs.writeFileSync(path.join(d, k), v); return d; }
function run(script, dir) { const r = cp.spawnSync(process.execPath, [script, dir], {encoding: 'utf8'}); return {code: r.status, stderr: r.stderr, json: r.status === 0 ? JSON.parse(r.stdout.trim()) : null}; }
const rd = (d, f = 'project.config.json') => fs.readFileSync(path.join(d, f), 'utf8');
const js = (d) => JSON.parse(rd(d));
const TEMPLATE = path.join(FX, 'creator388-template-from-oi.project.config.json');
const EFG = path.join(FX, 'oi-r6efg');
const CFGS = {creator388Template: TEMPLATE, oiE_noCondition: path.join(EFG, 'e-project.config.json'), oiF_officialTemplate: path.join(EFG, 'f-project.config.json'), oiG_officialTemplate: path.join(EFG, 'g-project.config.json'), r6Audio: path.join(R6, 'audio-project.config.json'), r6NoEnhanceD: path.join(R6, 'noenhance-d-project.config.json'), r6GameRootC: path.join(R6, 'gameroot-c-project.config.json'), r6FirstOpenA: path.join(FX, 'oi-r6-first-open-A.project.config.json'), r6FirstOpenB: path.join(FX, 'oi-r6-first-open-B.project.config.json')};

t('template fixture carries Oi\'s exact fields: game {currentL:-1,list:[],current:-1}; search/conversation/miniprogram {current:-1,list:[]}; enhance true; miniprogramRoot "./"', () => {
  const c = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  assert.deepStrictEqual(c.condition.game, {currentL: -1, list: [], current: -1});
  for (const k of ['search', 'conversation', 'miniprogram']) assert.deepStrictEqual(c.condition[k], {current: -1, list: []});
  assert.strictEqual(c.setting.enhance, true); assert.strictEqual(c.miniprogramRoot, './');
});
t('v3: reconstructed template condition == Oi\'s REAL official template in G/F (r6efg), including key order and currentL', () => {
  const tpl = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8')).condition;
  for (const f of ['g-project.config.json', 'f-project.config.json']) {
    const real = JSON.parse(fs.readFileSync(path.join(EFG, f), 'utf8')).condition;
    assert.deepStrictEqual(real, tpl); assert.strictEqual(JSON.stringify(real), JSON.stringify(tpl));
  }
});
for (const [name, f] of Object.entries(CFGS)) {
  t(`patched == original: byte-identical output, same JSON fields (${name})`, () => {
    const a = out(f), b = out(f); const ro = run(ORIG, a), rp = run(PATCHED, b);
    assert.strictEqual(ro.code, 0, ro.stderr); assert.strictEqual(rp.code, 0, rp.stderr);
    assert.strictEqual(rd(b), rd(a));
    for (const k of Object.keys(ro.json)) if (k !== 'output') assert.deepStrictEqual(rp.json[k], ro.json[k], k);
    const o = js(b); assert.strictEqual(o.setting.enhance, false); assert.strictEqual(o.condition, undefined); assert.strictEqual(o.compileType, 'game');
    const src = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.deepStrictEqual(rp.json.removedCondition, src.condition === undefined ? null : src.condition);
  });
}
t('template: every non-condition field preserved, key order kept, only enhance flipped', () => {
  const d = out(TEMPLATE); run(PATCHED, d);
  const src = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8')), o = js(d);
  delete src.condition; src.setting.enhance = false; assert.deepStrictEqual(o, src); assert.deepStrictEqual(Object.keys(o), Object.keys(src));
});
t('idempotent: 2nd run changed=false, file bytes and mtime untouched', () => {
  const d = out(TEMPLATE); const r1 = run(PATCHED, d); const once = rd(d); const m = fs.statSync(path.join(d, 'project.config.json')).mtimeMs;
  const r2 = run(PATCHED, d), r3 = run(PATCHED, d);
  assert.strictEqual(r1.json.changed, true); assert.strictEqual(r2.json.changed, false); assert.strictEqual(r3.json.changed, false);
  assert.strictEqual(rd(d), once); assert.strictEqual(fs.statSync(path.join(d, 'project.config.json')).mtimeMs, m);
  assert.strictEqual(r2.json.removedCondition, null); assert.strictEqual(r2.json.emptyCompileConditionsRemoved, true);
});
t('nothing written outside project.config.json (no sibling/log files)', () => {
  const d = out(TEMPLATE); const parent = path.dirname(d), before = fs.readdirSync(parent).length; run(PATCHED, d);
  assert.deepStrictEqual(fs.readdirSync(d), ['project.config.json']); assert.strictEqual(fs.readdirSync(parent).length, before);
});
const base = () => JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
for (const [label, mut, re, origAlsoRejects] of [
  ['compileType miniprogram', (o) => { o.compileType = 'miniprogram'; }, /Only normalize a mini-game output/, true],
  ['wrong AppID', (o) => { o.appid = 'wx0000000000000000'; }, /Unexpected game AppID/, true],
  ['active game condition', (o) => { o.condition.game = {currentL: -1, current: 0, list: [{name: 'dbg', query: 'x=1'}]}; }, /Preserve active custom compile conditions/, true],
  ['active miniprogram condition (pathName)', (o) => { o.condition.miniprogram = {current: 0, list: [{pathName: 'pages/index/index'}]}; }, /Preserve active custom compile conditions/, true],
  ['branch without list', (o) => { o.condition.search = {current: -1}; }, /Preserve active custom compile conditions/, true],
  ['branch null (original crashed with TypeError; patched refuses with the same message)', (o) => { o.condition.search = null; }, /Preserve active custom compile conditions/, false],
]) {
  t(`refuses ${label}; file untouched`, () => {
    const o = base(); mut(o); const text = JSON.stringify(o, null, 2) + '\n';
    for (const s of [ORIG, PATCHED]) {
      const d = out(TEMPLATE); fs.writeFileSync(path.join(d, 'project.config.json'), text);
      const r = run(s, d); assert.notStrictEqual(r.code, 0); assert.strictEqual(rd(d), text);
      if (s === PATCHED || origAlsoRejects) assert.match(r.stderr, re);
    }
  });
}

// console rules on Oi's real copies
const tr = (f) => rules.classifyTranscript(fs.readFileSync(path.join(R6, f), 'utf8'));
t('A/audio console (Oi raw copy): KNOWN_NOTICE_ONLY — 1 notice, LoadScene seen, 0 forbidden, 0 unclassified', () => {
  const r = tr('audio-startup-console-raw.txt'); assert.strictEqual(r.verdict, 'KNOWN_NOTICE_ONLY'); assert.strictEqual(r.knownNotice.length, 1); assert.ok(r.loadSceneSeen); assert.strictEqual(r.forbidden.length + r.unclassified.length, 0);
});
t('D (enhance=false) console: same KNOWN_NOTICE_ONLY', () => { const r = tr('noenhance-d-settled-console.txt'); assert.strictEqual(r.verdict, 'KNOWN_NOTICE_ONLY'); assert.ok(r.loadSceneSeen); });
t('B reopened console: FAIL (babel helper + prerequisite-imports), no LoadScene → not a valid zero-red control', () => {
  const r = tr('first-open-b-reopened-console.txt'); assert.strictEqual(r.verdict, 'FAIL'); assert.ok(!r.loadSceneSeen);
  const ids = new Set(r.forbidden.map((x) => x.id)); assert.ok(ids.has('babel-helper-missing') && ids.has('prerequisite-imports'));
});
t('notice position in A and D: right after the WAGame.js device-info log, right before LoadScene; it carries no source location', () => {
  for (const f of ['audio-startup-console-raw.txt', 'noenhance-d-settled-console.txt']) {
    const L = fs.readFileSync(path.join(R6, f), 'utf8').split('\n').filter(Boolean);
    const i = L.findIndex((l) => l.startsWith('[app.json'));
    assert.match(L[i - 1], /^WAGame\.js:1 \{batteryLevel/); assert.match(L[i + 1], /LoadScene db:\/\/assets\/scenes\/WorldR5Integration\.scene/);
    assert.ok(!/\.js(\?)?( \[sm\])?:\d+/.test(L[i]), 'no source location');
  }
});
t('expected console after the change (A/D minus nothing): exact allowlist only, everything else forbidden', () => {
  assert.strictEqual(rules.classifyText('[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 (env: macOS,mg,2.02.2608080; lib: 3.17.3)').kind, 'known-ide-notice');
  assert.strictEqual(rules.classifyText('[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 pages/index/index (env: macOS,mg,2.02.2608080; lib: 3.17.3)').kind, 'forbidden');
  assert.strictEqual(rules.classifyText('[game.json 文件内容错误] game.json: x').kind, 'forbidden');
  const zero = fs.readFileSync(path.join(R6, 'audio-startup-console-raw.txt'), 'utf8').split('\n').filter((l) => !l.startsWith('[app.json')).join('\n');
  assert.strictEqual(rules.classifyTranscript(zero).verdict, 'ZERO_RED');
  assert.strictEqual(rules.classifyTranscript(zero.split('\n').filter((l) => !l.includes('LoadScene')).join('\n')).verdict, 'INCOMPLETE');
  assert.strictEqual(rules.classifyTranscript(zero + '\nsomething new').verdict, 'REVIEW');
});
t('log-line extraction: notice at end of a log line counts, notice with a page name does not', () => {
  assert.ok(rules.extractKnownNotice('[ts] [console.error] [app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 (env: macOS,mg,2.02.2608080; lib: 3.17.3)'));
  assert.strictEqual(rules.extractKnownNotice('x [app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 pages/a'), null);
});
const efg = (f) => fs.readFileSync(path.join(EFG, f), 'utf8');
t('E first open (pure wx canvas, no Cocos, no condition): the exact known notice, right AFTER the game\'s own marker line', () => {
  const L = efg('console-raw.txt').split('\n').filter(Boolean);
  const i = L.findIndex((l) => rules.classifyText(l).kind === 'known-ide-notice');
  assert.ok(i > 0, 'notice present'); assert.strictEqual(L[i - 1], 'WAGame.js:1 OI_MINIMAL_CONTROL_E_READY');
  const r = rules.classifyTranscript(efg('console-raw.txt')); assert.strictEqual(r.forbidden.length, 0); assert.strictEqual(r.knownNotice.length, 1);
  assert.ok(!/cc\.|cocos/i.test(fs.readFileSync(path.join(EFG, 'e-game.js'), 'utf8')), 'E game.js has no Cocos');
});
t('E/F reopen: marker, no notice; G reopen (official template condition): notice + LoadScene → KNOWN_NOTICE_ONLY', () => {
  for (const f of ['e-reopened-console.txt', 'e-reopened-settled-console.txt', 'f-reopened-console.txt']) { const r = rules.classifyTranscript(efg(f)); assert.strictEqual(r.knownNotice.length, 0, f); assert.strictEqual(r.forbidden.length, 0, f); }
  const g = rules.classifyTranscript(efg('g-reopened-console.txt')); assert.strictEqual(g.verdict, 'KNOWN_NOTICE_ONLY'); assert.ok(g.loadSceneSeen);
});
t('installed DevTools source (Oi read-only trace): message is JSON_CUSTOM_COMPILE_PATH_NOT_EXISTS shown on realNotFound with the launch path as %s', () => {
  const c = JSON.parse(efg('installed-devtools-condition-calls.json')).map((x) => x.context).join('\n');
  assert.ok(c.includes("JSON_CUSTOM_COMPILE_PATH_NOT_EXISTS: 'app.json 中未定义自定义编译中指定的启动页面 %s'"));
  assert.ok(/O\.realNotFound&&v\.default\.display\(\{command:y\.default\.DISPLAY_ERROR/.test(c)); assert.ok(c.includes('JSON_CUSTOM_COMPILE_PATH_NOT_EXISTS.format(C)')); assert.ok(c.includes('const C=d.path'));
});
console.log(`\n${pass}/${n} passed`);
fs.writeFileSync(process.argv[2] || path.join(tmp, 'result.json'), JSON.stringify({passed: pass, total: n, results}, null, 2));
process.exit(pass === n ? 0 : 1);
