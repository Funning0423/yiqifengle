/** Early meadow preload (result / chest trigger): meadow-bound condition, idempotence, deferral, retry, release on
 *  unload (once), and the 5.2 s path vs the cloud hold. */
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
  const requiresMeadowScene = sel => /^r05-meadow-/.test(String(sel && sel.stageId || '')) || /^mainline-0[5-8]$/.test(String(sel && sel.stageId || ''));
  const mod = new Function('REGIONS', 'loadRegionPrefab', 'requiresMeadowScene', 'setTimeout', 'clearTimeout', 'console', 'globalThis',
    src + '\nreturn { prefetchSailboatMeadow, scheduleSailboatMeadowPreload, maybeScheduleSailboatMeadowPreload, meadowSailNextStage, cancelScheduledSailboatMeadowPreload, prefetchedSailboatMeadow, consumeSailboatMeadow, releaseSailboatMeadow, noteMeadowLease, MEADOW_PRELOAD_DEFER_MS, MEADOW_PRELOAD_RETRY_MS };')(
    { meadow: { bundle: 'region_meadow' } }, loader, requiresMeadowScene, fakeSetTimeout, fakeClearTimeout,
    { log: m => logs.push(m), warn: m => logs.push(m) }, { performance: { now: () => clock } });
  async function tick(ms) {
    clock += ms;
    for (const t of timers.slice()) if (t.live && t.at <= clock) { t.live = false; t.fn(); }
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }
  return { mod, tick, logs, timers: () => timers.filter(t => t.live).length };
}

function refPrefab(name) { return { name, refCount: 0, released: 0, addRef() { this.refCount++; return this; }, decRef(auto) { this.refCount--; if (auto && this.refCount === 0) this.released++; return this; } }; }
const win = (next, extra) => Object.assign({ state: 'result.saved', active: { status: 'won' }, result: { completionRecorded: true }, nextStageId: next }, extra || {});

(async () => {
  // Condition: only a win whose next stage is a meadow stage (the sail) preloads.
  {
    let calls = 0;
    const h = loadPrefetch(() => { calls++; return Promise.resolve(refPrefab('m')); });
    assert.equal(h.mod.meadowSailNextStage(win('mainline-05')), 'mainline-05');
    assert.equal(h.mod.meadowSailNextStage(win('r05-meadow-01')), 'r05-meadow-01');
    for (const s of [win('mainline-03'), win('mainline-09'), win('r05-sky-01'), win(null), win('mainline-05', { state: 'result.unsaved' }),
      win('mainline-05', { active: { status: 'lost' } }), win('mainline-05', { result: { completionRecorded: false } }), null]) {
      assert.equal(h.mod.meadowSailNextStage(s), null, JSON.stringify(s));
      assert.equal(h.mod.maybeScheduleSailboatMeadowPreload('result', s), false);
      assert.equal(h.mod.maybeScheduleSailboatMeadowPreload('chest', s), false);
    }
    await h.tick(60000);
    assert.equal(calls, 0, 'non-meadow wins never load');
    assert.equal(h.timers(), 0);
    assert.ok(h.logs.some(l => l === '[meadow-preload] skip result next mainline-03'), h.logs.join('\n'));
    assert.equal(h.mod.maybeScheduleSailboatMeadowPreload('result', win('mainline-05')), true);
    await h.tick(h.mod.MEADOW_PRELOAD_DEFER_MS);
    assert.equal(calls, 1, 'meadow-bound win loads');
  }
  // Release: held once, released once on meadow unload after the sail; never double-released.
  {
    let calls = 0; const p = refPrefab('env_meadow');
    const h = loadPrefetch(() => { calls++; return Promise.resolve(p); });
    h.mod.maybeScheduleSailboatMeadowPreload('result', win('mainline-05'));
    await h.tick(h.mod.MEADOW_PRELOAD_DEFER_MS);
    assert.equal(p.refCount, 1, 'module holds one ref');
    // Previous meadow level's lease goes away during the exit (meadow -> meadow): armed, so kept.
    h.mod.noteMeadowLease(1); h.mod.noteMeadowLease(-1);
    assert.equal(p.refCount, 1, 'armed preload survives the old meadow unload');
    // Sail uses the cached prefab, no second load.
    assert.equal(h.mod.prefetchedSailboatMeadow(), p);
    assert.equal(await h.mod.prefetchSailboatMeadow(), p);
    assert.equal(calls, 1);
    h.mod.consumeSailboatMeadow();
    p.addRef(); h.mod.noteMeadowLease(1);          // live meadow takes its own ref
    assert.equal(p.refCount, 2);
    p.decRef(true); h.mod.noteMeadowLease(-1);     // leaving the meadow
    assert.equal(p.refCount, 0); assert.equal(p.released, 1);
    assert.equal(h.mod.prefetchedSailboatMeadow(), null);
    assert.equal(h.mod.releaseSailboatMeadow('home'), false, 'second release is a no-op');
    h.mod.noteMeadowLease(-1);
    assert.equal(p.refCount, 0, 'no double decRef'); assert.equal(p.released, 1);
    assert.ok(h.logs.some(l => /^\[meadow-preload\] release meadow-unload t \d+ leases 0$/.test(l)), h.logs.join('\n'));
    // After release the next sail loads afresh.
    await h.mod.prefetchSailboatMeadow(); assert.equal(calls, 2); assert.equal(p.refCount, 1);
  }
  // Release while the live meadow still holds it: only our ref goes, the meadow's stays.
  {
    const p = refPrefab('m'); const h = loadPrefetch(() => Promise.resolve(p));
    await h.mod.prefetchSailboatMeadow(); p.addRef(); h.mod.noteMeadowLease(1);
    assert.equal(h.mod.releaseSailboatMeadow('not-meadow'), true);
    assert.equal(p.refCount, 1); assert.equal(p.released, 0);
  }
  // Sail abandoned (home) while the load is in flight: the late result takes no ref; pending deferral cancelled.
  {
    let resolve; const p = refPrefab('m');
    const h = loadPrefetch(() => new Promise(ok => { resolve = ok; }));
    h.mod.maybeScheduleSailboatMeadowPreload('result', win('mainline-05'));
    await h.tick(h.mod.MEADOW_PRELOAD_DEFER_MS);
    h.mod.releaseSailboatMeadow('home'); resolve(p); await h.tick(0);
    assert.equal(p.refCount, 0); assert.equal(h.mod.prefetchedSailboatMeadow(), null);
    const h2 = loadPrefetch(() => Promise.resolve(p)); let n = 0;
    h2.mod.maybeScheduleSailboatMeadowPreload('chest', win('mainline-05'));
    h2.mod.releaseSailboatMeadow('home'); await h2.tick(60000); assert.equal(h2.timers(), 0); n = p.refCount;
    assert.equal(n, 0, 'released before the deferral fired: nothing loads');
  }
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
    const prefab = refPrefab('env_meadow');
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
  assert.match(boardSrc, /import \{ cancelScheduledSailboatMeadowPreload, maybeScheduleSailboatMeadowPreload \} from '\.\/cine\/SailboatMeadowPrefetch';/);
  assert.match(boardSrc, /if \(m\.kind === 'win'\) maybeScheduleSailboatMeadowPreload\('result', s\); const p = openResult\(/);
  assert.match(boardSrc, /if \(chest\) maybeScheduleSailboatMeadowPreload\('chest', s\);\n    openReward\(/);
  assert.doesNotMatch(boardSrc, /[^e]scheduleSailboatMeadowPreload\(/, 'board never schedules unconditionally');
  const bgSrc = fs.readFileSync(path.join(scripts, 'region/MeadowBoardBackground.ts'), 'utf8');
  assert.match(bgSrc, /prefab=await waitAsset\(loadRegionPrefab\(REGIONS\.meadow\)\);leased=true;noteMeadowLease\(1\);/);
  assert.match(bgSrc, /if\(leased\)\{leased=false;noteMeadowLease\(-1\);\}/);
  const flowSrc = fs.readFileSync(path.join(scripts, 'world-r1/WorldFlowComponent.ts'), 'utf8');
  assert.match(flowSrc, /else releaseSailboatMeadow\('home'\);/);
  assert.match(flowSrc, /requiresMeadowScene\(\{stageId\}\)\?playSailboatTransition\([^\n]*\):\(releaseSailboatMeadow\('not-meadow'\),null\),/);
  const drvSrc = fs.readFileSync(path.join(scripts, 'cine/SailboatTransitionDriver.ts'), 'utf8');
  assert.match(drvSrc, /this\.closed = true;\n    consumeSailboatMeadow\(\);/);
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
