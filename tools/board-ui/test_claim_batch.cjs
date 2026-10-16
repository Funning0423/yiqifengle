'use strict';
// Result claims that fire in one turn must share one invoke. A per-call busy gate drops the second.
const fs = require('node:fs'), assert = require('node:assert/strict');
const ts = require('../qf-env.cjs').typescript();
const src = fs.readFileSync('creator-build-project/assets/scripts/WorldIntegrationBoot.ts', 'utf8');
const a = src.indexOf('function enqueueResultBatch');
const b = src.indexOf('/** end enqueueResultBatch */');
assert(a > 0 && b > a, 'enqueueResultBatch boundaries');
const js = ts.transpileModule(src.slice(a, b), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
const enqueueResultBatch = new Function(js + '\nreturn enqueueResultBatch;')();
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const order = [];
  let busy = false;
  const enqueue = enqueueResultBatch(run => {
    if (busy) { order.push('drop'); return; }
    busy = true;
    void Promise.resolve(run()).then(() => { busy = false; }, () => { busy = false; });
  });
  enqueue(() => order.push('chest'));
  enqueue(() => order.push('region'));
  assert.deepEqual(order, [], 'same-turn claims wait for one flush');
  await delay(30);
  assert.deepEqual(order, ['chest', 'region'], 'both claims run inside the one invoke');

  const dropped = [];
  let gate = false;
  const invoke = async fn => { if (gate) { dropped.push('drop'); return; } gate = true; try { await fn(); } finally { gate = false; } };
  void invoke(() => dropped.push('chest'));
  void invoke(() => dropped.push('region'));
  await delay(0);
  assert.deepEqual(dropped, ['chest', 'drop'], 'the busy gate by itself drops the second claim');

  let release = null;
  const late = [];
  const held = enqueueResultBatch(run => { void run(); });
  held(() => new Promise(r => { release = r; }));
  await delay(20);
  held(() => late.push('again'));
  await delay(20);
  assert.deepEqual(late, [], 'a claim that arrives while the batch is running is ignored');
  release();
  await delay(20);
  assert.deepEqual(late, []);
  console.log(JSON.stringify({ status: 'PASS', checks: ['same-turn batch', 'busy gate drops', 'in-flight ignored'] }));
})().catch(e => { console.error(e); process.exitCode = 1; });
