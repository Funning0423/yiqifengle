'use strict';
// 0008-v4 unit tests for the unified event classifier (review items A, B, D). Pure functions, no I/O.
const assert = require('assert'), fs = require('fs');
const r = require('../tools/first_open_console_rules.cjs');
const TOK = '0123456789abcdef', N = '[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 (env: macOS,mg,2.02.2608080; lib: 3.17.3)';
const ev = (level, payload) => r.classifyEvent({level, payload, token: TOK});
const ln = (line) => r.classifyEvent({...r.parseLogLine(line, ['/copy/QFFirstOpen-x']), token: TOK});
let n = 0, pass = 0; const results = [];
const t = (name, fn) => { n++; try { fn(); pass++; results.push({name, ok: true}); console.log('PASS ' + name); } catch (e) { results.push({name, ok: false, error: e.message}); console.log('FAIL ' + name + '\n  ' + e.message); } };
t('A1 plain "Error:" at any level is an error', () => { for (const l of ['log', 'info', 'warn', 'unknown', 'error']) assert.strictEqual(ev(l, 'Error: ordinary failure').kind, 'error', l); });
t('A2 any "[…错误]" category anywhere is an error (not only line start)', () => { for (const p of ['[其他错误] 资源加载失败', 'x [网络错误] y', '[渲染层错误]', '[app.json 或自定义编译条件错误] something else']) assert.strictEqual(ev('unknown', p).kind, 'error', p); });
t('A3 console.error level with unrecognised text → error "unrecognised-error-level"', () => { assert.deepStrictEqual(ev('error', 'plain fatal diagnostic'), {kind: 'error', id: 'unrecognised-error-level'}); assert.deepStrictEqual(ln('/copy/QFFirstOpen-x [console.error] plain fatal diagnostic'), {kind: 'error', id: 'unrecognised-error-level'}); });
t('A4 WeappLog level tags: [error] [console.error] [warn] [warning] [log]; timestamps stripped', () => {
  assert.deepStrictEqual(r.parseLogLine('[2026-10-09T01:02:03.004Z] /copy/QFFirstOpen-x [console.error] boom', ['/copy/QFFirstOpen-x']), {own: true, level: 'error', payload: 'boom', prefix: ''});
  assert.strictEqual(r.parseLogLine('[warning] x').level, 'warn'); assert.strictEqual(r.parseLogLine('2026-10-09 01:02:03.004 [log] x').level, 'log'); assert.strictEqual(r.parseLogLine('no tag here').level, 'unknown');
});
t('A5 other JS error classes + Uncaught; benign info stays info', () => { for (const p of ['EvalError: a', 'URIError: b', 'AggregateError: c', 'Uncaught (in promise) x']) assert.strictEqual(ev('log', p).kind, 'error', p); assert.strictEqual(ev('log', 'LoadScene db://assets/scenes/WorldR5Integration.scene: 12 ms').kind, 'info'); assert.strictEqual(ev('warn', 'deprecated api').kind, 'warn'); });
t('B1 only the EXACT normalised canary is exempt (boot / late / whitespace-normalised)', () => { assert.strictEqual(ev('error', `[QF-AUDIT-CANARY] ${TOK}`).kind, 'canary-boot'); assert.strictEqual(ev('error', `  [QF-AUDIT-CANARY-LATE]   ${TOK} `).kind, 'canary-late'); assert.strictEqual(ln(`/copy/QFFirstOpen-x [console.error] [QF-AUDIT-CANARY] ${TOK}`).kind, 'canary-boot'); });
t('B2 canary + any other text is NOT exempt; the rest is evaluated', () => {
  assert.strictEqual(ev('error', `[QF-AUDIT-CANARY] ${TOK} TypeError: real`).kind, 'error');
  assert.strictEqual(ev('log', `[QF-AUDIT-CANARY-LATE] ${TOK} TypeError: real`).kind, 'error');
  assert.strictEqual(ev('error', `prefix [QF-AUDIT-CANARY] ${TOK}`).kind, 'error'); // error level → never benign
  assert.strictEqual(ev('log', `[QF-AUDIT-CANARY] ${TOK} trailing note`).kind, 'info'); // log level, no error text → info, NOT canary (cannot prove the channel)
});
t('B3 foreign-token canary → canary-foreign; canary at log/warn level is not a canary', () => { assert.strictEqual(ev('error', '[QF-AUDIT-CANARY] ffffffffffffffff').kind, 'canary-foreign'); assert.notStrictEqual(ev('log', `[QF-AUDIT-CANARY] ${TOK}`).kind, 'canary-boot'); });
t('D1 exact notice (whole normalised payload) → known-notice, at error or unknown level', () => { assert.strictEqual(ev('error', N).kind, 'known-notice'); assert.strictEqual(ln('/copy/QFFirstOpen-x ' + N).kind, 'known-notice'); assert.strictEqual(ev('error', N.replace(' app.json 中', '   app.json 中')).kind, 'known-notice'); });
t('D2 notice with ANY other text (before/after, other error first) → error, never allowlisted', () => {
  for (const p of ['TypeError: actual failure; ' + N, N + ' TypeError: x', 'something ' + N, N + ' pages/a', N.replace('lib: 3.17.3', 'lib: 3.17.3 extra')]) assert.strictEqual(ev('unknown', p).kind, 'error', p);
  assert.strictEqual(ln('OTHER-PROJECT ' + N).kind, 'error', 'unknown prefix = not the exact payload');
});
t('D3 no suffix/end-of-line extraction API remains', () => { assert.strictEqual(r.extractKnownNotice, undefined); assert.ok(!/KNOWN_IDE_NOTICE_IN_LINE/.test(fs.readFileSync(require.resolve('../tools/first_open_console_rules.cjs'), 'utf8'))); });
t('audit uses no STRONG pattern gate and no CANARY_RE', () => { const s = fs.readFileSync(require.resolve('../tools/wechat_first_open_audit.cjs'), 'utf8'); assert.ok(!/STRONG_ERROR_PATTERNS\.some/.test(s)); assert.ok(!/CANARY_RE/.test(s)); assert.ok(/rules\.classifyEvent/.test(s)); });
console.log(`\n${pass}/${n} passed`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({passed: pass, total: n, results}, null, 2));
process.exit(pass === n ? 0 : 1);
