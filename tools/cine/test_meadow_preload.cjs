/** Early meadow preload (result / chest trigger): idempotence, deferral, retry, and the 5.2 s path vs the cloud hold. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');

const root = path.resolve(__dirname, '../..');
const scripts = path.join(root, 'creator-build-project/assets/scripts');
const prefetchSrc = fs.readFileSync(path.join(scripts, 'cine/SailboatMeadowPrefetch.ts'), 'utf8');
const boardSrc = fs.readFileSync(path.join(scripts, 'ManagedMobileBoardUI.ts'), 'utf8');

function loadPrefetch(loader) {
  const timers = [];
  let clock = 0;
  const logs = [];
  const fakeSetTimeout = (fn, ms) => { const t = { fn, at: clock + ms, live: true }; timers.push(t); return t; };
  const fakeClearTimeout = t => { if (t) t.live = false; };
  const src = stripTypeScriptTypes(prefetchSrc.replace(/^import .*$/gm, '').replace(/^export /gm, ''), { mode: 'transform' });
  const mod = new Function('REGIONS', 'loadRegionPrefab', 'setTimeout', 'clearTimeout', 'console', 'globalThis',
    src + '\nreturn { prefetchSailboatMeadow, scheduleSailboatMeadowPreload, cancelScheduledSailboatMeadowPreload, prefetchedSailboatMeadow, MEADOW_PRELOAD_DEFER_MS, MEADOW_PRELOAD_RETRY_MS };')(
    { meadow: { bundle: 'region_meadow' } }, loader, fakeSetTimeout, fakeClearTimeout,
    { log: m => logs.push(m), warn: m => logs.push(m) }, { performance: { now: () => clock } });
  async function tick(ms) {
    clock += ms;
    for (const t of timers.slice()) if (t.live && t.at <= clock) { t.live = false; t.fn(); }
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }
  return { mod, tick, logs, timers: () => timers.filter(t => t.live).length };
}

(async () => {
  // Deferred start, one load for any number of triggers, shared with the sail-time caller.
  {
    let calls = 0; let resolve;
    const h = loadPrefetch(() => { calls++; return new Promise(ok => { resolve = ok; }); });
    h.mod.scheduleSailboatMeadowPreload('result');
    h.mod.scheduleSailboatMeadowPreload('result');
    h.mod.scheduleSailboatMeadowPreload('chest');
    assert.equal(h.timers(), 1);
    assert.equal(calls, 0, 'no load on the frame the panel opens');
    await h.tick(h.mod.MEADOW_PRELOAD_DEFER_MS - 1);
    assert.equal(calls, 0);
    await h.tick(1);
    assert.equal(calls, 1);
    const sailPromise = h.mod.prefetchSailboatMeadow();
    h.mod.scheduleSailboatMeadowPreload('chest');
    assert.equal(calls, 1);
    assert.equal(h.timers(), 0);
    const prefab = { name: 'env_meadow' };
    resolve(prefab);
    assert.equal(await sailPromise, prefab);
    assert.equal(h.mod.prefetchedSailboatMeadow(), prefab);
    assert.ok(h.logs.some(l => /^\[meadow-preload\] start result t 400$/.test(l)), h.logs.join('\n'));
    assert.ok(h.logs.some(l => /^\[meadow-preload\] ready result t \d+ took \d+$/.test(l)));
  }
  // Sail-time caller before any early trigger still works (old path).
  {
    let calls = 0;
    const h = loadPrefetch(() => { calls++; return Promise.resolve({ name: 'm' }); });
    await h.mod.prefetchSailboatMeadow();
    h.mod.scheduleSailboatMeadowPreload('result');
    assert.equal(h.timers(), 0);
    assert.equal(calls, 1);
    assert.ok(h.logs.some(l => l.startsWith('[meadow-preload] start late')));
  }
  // Failure: promise cleared, one early retry, then the sail-time path still retries.
  {
    let calls = 0;
    const h = loadPrefetch(() => { calls++; return calls <= 2 ? Promise.reject(Error('net')) : Promise.resolve({ name: 'm' }); });
    h.mod.scheduleSailboatMeadowPreload('result');
    await h.tick(h.mod.MEADOW_PRELOAD_DEFER_MS);
    assert.equal(calls, 1);
    assert.equal(h.mod.prefetchedSailboatMeadow(), null);
    await h.tick(h.mod.MEADOW_PRELOAD_RETRY_MS);
    assert.equal(calls, 2);
    await h.tick(60000);
    assert.equal(calls, 2, 'only one early retry');
    assert.ok(h.logs.some(l => l.startsWith('[meadow-preload] fail result-retry')));
    assert.deepEqual(await h.mod.prefetchSailboatMeadow(), { name: 'm' });
    assert.equal(calls, 3);
  }
  // Cancel before the deferral fires: no load.
  {
    let calls = 0;
    const h = loadPrefetch(() => { calls++; return Promise.resolve({}); });
    h.mod.scheduleSailboatMeadowPreload('result');
    h.mod.cancelScheduledSailboatMeadowPreload();
    await h.tick(10000);
    assert.equal(calls, 0);
  }
  // Wiring: result (win) and chest reward trigger it; teardown cancels a pending deferral.
  assert.match(boardSrc, /import \{ cancelScheduledSailboatMeadowPreload, scheduleSailboatMeadowPreload \} from '\.\/cine\/SailboatMeadowPrefetch';/);
  assert.match(boardSrc, /if \(m\.kind === 'win'\) scheduleSailboatMeadowPreload\('result'\); const p = openResult\(/);
  assert.match(boardSrc, /if \(chest\) scheduleSailboatMeadowPreload\('chest'\);\n    openReward\(/);
  assert.match(boardSrc, /this\.disposing = true;\n    cancelScheduledSailboatMeadowPreload\(\);/);

  // Timeline: meadow ready before frame 81 -> 5.2 s; ready later -> cloud hold covers the gap.
  const modelSrc = fs.readFileSync(path.join(scripts, 'cine/SailboatTransitionModel.ts'), 'utf8');
  const model = new Function(stripTypeScriptTypes(modelSrc.replace(/^export /gm, ''), { mode: 'transform' }) + '\nreturn { parseSailboatTiming, createSailboatPlayback };')();
  const timing = model.parseSailboatTiming(JSON.parse(fs.readFileSync(path.join(root, 'creator-build-project/assets/resources/cine/transition_island_to_meadow.timing.json'), 'utf8')));
  function run(readyAtSec) {
    const p = model.createSailboatPlayback(timing); p.begin();
    const dt = 1 / timing.fps; let t = 0; let holdFrames = 0;
    for (let i = 0; i < 2000; i++) {
      const s = p.advance(dt, { meadowReady: t + 1e-9 >= readyAtSec });
      t += dt;
      if (s.view.phase === 'holding') holdFrames++;
      if (s.view.phase === 'done') return { total: t, holdFrames };
    }
    throw Error('never done');
  }
  const swapSec = timing.sceneSwapFrame / timing.fps;
  for (const ready of [0, 1.0, swapSec - 0.05]) {
    const r = run(ready);
    assert.equal(r.holdFrames, 0, 'ready ' + ready);
    assert.ok(Math.abs(r.total - 5.2) <= 0.2, 'ready ' + ready + ' total ' + r.total);
  }
  const late = run(swapSec + 1.0);
  assert.ok(late.holdFrames >= 25, 'late meadow still holds in cloud');
  assert.ok(late.total > 5.2 + 0.8);
  console.log('meadow preload: ok (total with early ready', run(0).total.toFixed(3), 's; late+1s', late.total.toFixed(3), 's)');
})().catch(e => { console.error(e); process.exit(1); });
