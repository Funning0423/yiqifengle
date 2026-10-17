'use strict';
// Unit test: audit shim behaviour in a vm (fake console/wx) + injectShim placement. node test/test_shim.cjs
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const {injectShim} = require('../tools/wechat_first_open_audit.cjs');
const shim = fs.readFileSync(path.join(__dirname, '../tools/first-open-audit-shim.js'), 'utf8').replace(/__QF_TOKEN__/g, 'tok123');
let n = 0, pass = 0;
const t = (name, fn) => { n++; try { fn(); pass++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + ' ' + e.message); } };
function run(src) {
  const seen = []; const handlers = {};
  const con = {log: (...a) => seen.push(['log', a.join(' ')]), warn: (...a) => seen.push(['warn', a.join(' ')]), error: (...a) => seen.push(['error', a.join(' ')]), info() {}};
  const sb = {console: con, wx: {onError: (f) => (handlers.err = f), onUnhandledRejection: (f) => (handlers.rej = f)}, Date, JSON};
  vm.runInContext(src, vm.createContext(sb));
  return {sb, seen, handlers};
}
t('records console.error/warn, still calls originals, heartbeat logged', () => {
  const {sb, seen} = run(injectShim('console.error("boom", {a:1}); console.warn("careful");', shim));
  const A = sb.__QF_FIRST_OPEN_AUDIT__;
  assert.strictEqual(A.token, 'tok123'); assert.strictEqual(A.heartbeat, true);
  assert.strictEqual(A.errors.length, 1); assert.match(A.errors[0].msg, /boom \{"a":1\}/);
  assert.strictEqual(A.warns.length, 1);
  assert.ok(seen.some(([l, m]) => l === 'error' && m.startsWith('boom')), 'original console.error still called');
  assert.ok(seen.some(([l, m]) => l === 'log' && m === '[QF-AUDIT-HEARTBEAT] tok123'));
});
t('wx.onError / onUnhandledRejection captured; ping logs late heartbeat', () => {
  const {sb, seen, handlers} = run(shim);
  handlers.err({message: 'E1', stack: 'at x'}); handlers.rej({reason: 'R1'});
  const A = sb.__QF_FIRST_OPEN_AUDIT__;
  assert.strictEqual(A.onError[0].msg, 'E1'); assert.strictEqual(A.unhandled[0].msg, 'R1');
  assert.strictEqual(A.ping(), 'tok123'); assert.ok(seen.some(([, m]) => m === '[QF-AUDIT-HEARTBEAT-LATE] tok123'));
});
t('double injection is a no-op (guard)', () => {
  const {sb} = run(shim + '\n' + shim.replace(/tok123/g, 'other') + '\nconsole.error("x")');
  assert.strictEqual(sb.__QF_FIRST_OPEN_AUDIT__.token, 'tok123'); assert.strictEqual(sb.__QF_FIRST_OPEN_AUDIT__.errors.length, 1);
});
t('injectShim keeps leading "use strict" first', () => {
  assert.ok(injectShim('"use strict";\nfoo();', 'SHIM').startsWith('"use strict";\nSHIM'));
  assert.ok(injectShim('/* hdr */\n\'use strict\';x()', 'SHIM').startsWith('/* hdr */\n\'use strict\';\nSHIM'));
  assert.ok(injectShim('require("a");', 'SHIM').startsWith('SHIM\nrequire'));
  assert.ok(injectShim('var s="use strict";', 'SHIM').startsWith('SHIM\nvar'));
});
t('strict-mode game.js still strict after injection', () => {
  const {sb} = run(injectShim('"use strict"; this.__strict = (function(){ return this === undefined; })();', shim));
  assert.strictEqual(sb.__strict, true);
});
console.log(`\n${pass}/${n} passed`); process.exit(pass === n ? 0 : 1);
