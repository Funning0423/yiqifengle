'use strict';
// Shim unit test (v3): runs tools/first-open-audit-shim.js in a vm with a fake console + wx (no DevTools).
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '../tools/first-open-audit-shim.js'), 'utf8').replace(/__QF_TOKEN__/g, 'abc123');
const seen = []; const h = {};
const ctx = {console: {error: (...a) => seen.push(['error', a]), warn: (...a) => seen.push(['warn', a]), log: (...a) => seen.push(['log', a]), info: (...a) => seen.push(['info', a])},
  wx: {onError: (f) => { h.err = f; }, onUnhandledRejection: (f) => { h.rej = f; }}, Date};
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx); vm.runInContext(src, ctx); // twice: must install once
const A = ctx.__QF_FIRST_OPEN_AUDIT__;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('PASS ' + name); };
t('installs once, heartbeat logged with token, wraps error/warn/log/info', () => { assert.strictEqual(A.heartbeat, true); assert.deepStrictEqual([...A.wrapped], ['error', 'warn', 'log', 'info']); assert.strictEqual(seen.filter((s) => String(s[1][0]).includes('[QF-AUDIT-HEARTBEAT] abc123')).length, 1); });
t('console.error/warn/log captured AND still forwarded', () => { ctx.console.error('boom', {a: 1}); ctx.console.warn('w'); ctx.console.info('LoadScene db://assets/scenes/WorldR5Integration.scene: 1.0 ms'); assert.strictEqual(A.errors.at(-1).msg, 'boom {"a":1}'); assert.strictEqual(A.warns.at(-1).msg, 'w'); assert.match(A.logs.at(-1).msg, /LoadScene/); assert.ok(seen.some((s) => s[0] === 'error' && s[1][0] === 'boom')); });
t('wx.onError / onUnhandledRejection captured', () => { h.err({message: 'TypeError: x', stack: 's'}); h.rej({reason: 'nope'}); assert.strictEqual(A.onError[0].msg, 'TypeError: x'); assert.strictEqual(A.unhandled[0].msg, 'nope'); });
t('late ping returns token and logs late heartbeat', () => { assert.strictEqual(A.ping(), 'abc123'); assert.ok(seen.some((s) => String(s[1][0]) === '[QF-AUDIT-HEARTBEAT-LATE] abc123')); });
t('buffer capped at 500 and overflow counted (v3: dropped)', () => { for (let i = 0; i < 700; i++) ctx.console.error('e' + i); assert.strictEqual(A.errors.length, 500); assert.ok(A.dropped > 0); });
t('v3 boot canary: console.error "[QF-AUDIT-CANARY] <token>" recorded and forwarded', () => { assert.strictEqual(A.canaryAtBoot, true); assert.ok(seen.some((s) => s[0] === 'error' && s[1][0] === '[QF-AUDIT-CANARY] abc123')); });
t('v3 ping also emits the late canary', () => assert.ok(seen.some((s) => s[0] === 'error' && s[1][0] === '[QF-AUDIT-CANARY-LATE] abc123')));
t('v3 capability record: wx handlers registered, no install errors, stillWrapped tracks later console replacement', () => {
  assert.strictEqual(A.onErrorRegistered, true); assert.strictEqual(A.onUnhandledRejectionRegistered, true); assert.deepStrictEqual([...A.installErrors], []);
  assert.deepStrictEqual([...A.stillWrapped()].sort(), ['error', 'info', 'log', 'warn']); ctx.console.warn = () => {}; assert.ok(!A.stillWrapped().includes('warn'));
});
console.log(`\n${n}/${n} passed`);
