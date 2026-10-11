'use strict';
// 0008-v5 unit checks for the three defects from Oi's v4 cloud review (A prefix, B CLI level, C UTF-8 at EOF).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const rules = require('../tools/first_open_console_rules.cjs');
const audit = require('../tools/wechat_first_open_audit.cjs');

const OWN = '/tmp/QFFirstOpen-x-default';
const TOKEN = '0123456789abcdef';
const NOTICE = '[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面';
const judge = (line, own = [OWN]) => { const p = rules.parseLogLine(line, own); return rules.classifyEvent({level: p.level, payload: p.payload, token: TOKEN}).kind; };
const cli = (line) => { const p = rules.parseCliLine(line); return rules.classifyEvent({level: p.level, payload: p.payload, token: TOKEN}).kind; };

const cases = [
  ['V0 runner and rules labels are 0008-v5', () => { assert.equal(audit.VERSION, '0008-v5'); assert.equal(rules.VERSION, '0008-v5'); }],
  ['A1 prefix TypeError before [log]', () => assert.equal(judge(`${OWN} TypeError: actual prefix failure [log] harmless`), 'error')],
  ['A2 prefix TypeError before exact canary', () => assert.equal(judge(`${OWN} TypeError: x [error] [QF-AUDIT-CANARY] ${TOKEN}`), 'error')],
  ['A3 prefix TypeError before exact notice', () => assert.equal(judge(`${OWN} TypeError: x [error] ${NOTICE}`), 'error')],
  ['A4 unowned prefix error is error and not own', () => { const p = rules.parseLogLine('OTHER-PROJECT TypeError: y [log] harmless', [OWN]); assert.equal(p.own, false); assert.equal(rules.classifyEvent({level: p.level, payload: p.payload, token: TOKEN}).kind, 'error'); }],
  ['A5 benign prefix keeps canary from being exempt', () => assert.notEqual(judge(`${OWN} note [error] [QF-AUDIT-CANARY] ${TOKEN}`), 'canary-boot')],
  ['A6 control: own exact canary still exempt', () => assert.equal(judge(`${OWN} [error] [QF-AUDIT-CANARY] ${TOKEN}`), 'canary-boot')],
  ['A7 control: own [log] LoadScene stays info with bare payload', () => { const p = rules.parseLogLine(`${OWN} [log] LoadScene db://assets/scenes/WorldR5Integration.scene: 1 ms`, [OWN]); assert.equal(p.prefix, ''); assert.equal(rules.classifyText(p.payload).id, 'loadscene'); }],
  ['A8 control: timestamp + own + tag is not an unknown prefix', () => assert.equal(rules.parseLogLine(`[2026-10-10T01:00:00.000Z] ${OWN} [warn] w`, [OWN]).prefixUnknown, undefined)],
  ['B1 CLI [console.error] is error', () => assert.equal(cli('[console.error] plain fatal diagnostic'), 'error')],
  ['B2 CLI [error] is error', () => assert.equal(cli('[error] plain fatal diagnostic'), 'error')],
  ['B3 CLI [warn] stays warn', () => assert.equal(cli('[warn] something'), 'warn')],
  ['B4 CLI untagged plain line stays info', () => assert.equal(cli('✔ IDE server started'), 'info')],
];

async function utf8Case(bytes, expectIncomplete) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qf-v5-utf8-'));
  const t = new audit.LogTailer(dir, {pollMs: 20, maxBytes: 1 << 20});
  t.start();
  fs.mkdirSync(path.join(dir, 'WeappLog')); fs.writeFileSync(path.join(dir, 'WeappLog', 'a.log'), Buffer.concat([Buffer.from(`${OWN} [log] ok\n${OWN} [log] truncated utf8: `), bytes]));
  await new Promise((r) => setTimeout(r, 80));
  await t.stop(30);
  const hit = t.incomplete.some((x) => /UTF-8/.test(x));
  assert.equal(hit, expectIncomplete, JSON.stringify(t.incomplete));
}
cases.push(['C1 lone 0xE4 at EOF → incomplete', () => utf8Case(Buffer.from([0xe4]), true)]);
cases.push(['C2 complete multibyte at EOF → no UTF-8 incomplete', () => utf8Case(Buffer.from('中', 'utf8'), false)]);
cases.push(['C3 0xFF mid-stream → incomplete (unchanged)', () => utf8Case(Buffer.from([0xff, 0x0a]), true)]);

(async () => {
  let pass = 0; const rows = [];
  for (const [name, fn] of cases) {
    try { await fn(); pass++; rows.push({name, ok: true}); console.log('ok  ', name); }
    catch (e) { rows.push({name, ok: false, error: String(e.message || e)}); console.log('FAIL', name, e.message); }
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({pass, total: cases.length, rows}, null, 2));
  console.log(`${pass}/${cases.length} passed`);
  process.exit(pass === cases.length ? 0 : 1);
})();
