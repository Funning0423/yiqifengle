'use strict';
// UI-03: cold browser restart restores the in-progress meadow board (same stage, pieces, positions, live 3D background).
const path = require('node:path'), assert = require('node:assert/strict'), H = require('./harness.cjs'), F = require('./flows.cjs');
(async () => {
  const id = H.runId(), ns = 'task21-web-ui03-' + id, root = F.root(ns), query = '?testNamespace=' + ns, profile = path.join(H.OUT, 'profile-ui03-' + id), errors = [], logs = [], checks = [], shots = {};
  const startedAt = new Date().toISOString();
  let context, page;
  const check = (name, data) => { checks.push({ name, pass: true, ...data }); console.log('PASS', name); };
  const settle = async () => {
    await F.leaveHome(page);
    await H.nav(page, 'mainline');
    await F.waitBoard(page, b => b.snapshot.active?.stageId === 'mainline-08' && b.background?.state === 'ready', null, 180000);
    await F.resumeBoard(page);
    await page.waitForTimeout(1200);
  };
  try {
    ({ context, page } = await H.launch(profile, { query, errors, logs }));
    assert.equal((await page.evaluate(() => __worldIntegration.regionFlowTest())).namespace, root);
    const entry = await F.enterCheckpoint(page, 8);
    assert.equal(entry.stageId, 'mainline-08');
    assert.equal(entry.state, 'run.ready');
    const before = await F.boardVisual(page);
    console.log('boardVisual.background', JSON.stringify(before.background));
    const pieces = await F.visiblePieces(page);
    assert.equal(before.stageId, 'mainline-08');
    assert.equal(before.status, 'playing');
    assert(before.occupied >= 20, 'board has pieces');
    assert.equal(pieces, before.occupied, 'every occupied cell has a visible piece');
    assert.equal(F.liveMeadowReason(before.background), null);
    assert.equal(before.tiles.length, 49);
    await assertMark(page, 'before close');
    shots.before = await H.shot(page, 'ui-03-a-meadow-board-before-close.png');
    check('checkpoint-08-shows-meadow-board', { entry, visual: before, visiblePieces: pieces });
    const rows = await H.storageRows(page, root);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => { try { return __worldIntegration.snapshot().state === 'home'; } catch { return false; } }, {}, { timeout: 180000 });
    assert.deepEqual(await H.storageRows(page, root), rows, 'warm reload writes nothing');
    await settle();
    const warm = await F.boardVisual(page);
    assert.deepEqual(warm, before, 'warm reload restores the same board');
    assert.equal(await F.visiblePieces(page), before.occupied);
    await assertMark(page, 'warm reload');
    shots.warm = await H.shot(page, 'ui-03-b-warm-reload-meadow-board.png');
    check('warm-reload-restores-same-meadow-board', { visual: warm });
    await context.close(); context = null;
    ({ context, page } = await H.launch(profile, { query, errors, logs }));
    assert.deepEqual(await H.storageRows(page, root), rows, 'cold start writes nothing');
    await settle();
    const cold = await F.boardVisual(page);
    assert.deepEqual(cold, before, 'cold restart restores stage, pieces, positions, and meadow renderer');
    assert.equal(await F.visiblePieces(page), before.occupied);
    assert.equal(cold.attemptId, before.attemptId);
    await assertMark(page, 'cold restart');
    shots.cold = await H.shot(page, 'ui-03-c-cold-restart-meadow-board.png');
    check('cold-restart-restores-same-stage-pieces-and-meadow-renderer', { visual: cold, visiblePieces: before.occupied });
    assert.deepEqual(errors, []);
    const out = H.write('ui-03-cold-restore-board.json', {
      id: 'UI-03', status: 'PASS', layer: '网页集成 (Mac headless Chrome for Testing, Cocos web-desktop debug build)',
      runId: id, startedAt, finishedAt: new Date().toISOString(), build: H.buildIdentity(), namespace: root, profile: path.relative(H.ROOT, profile),
      route: '地区流程测试 08 · 最后一步 → 继续 → meadow board → reload → 继续旅程 → close browser → relaunch → 继续旅程',
      checks, screenshots: shots, errors, logs: logs.slice(-20),
      limitations: ['Mac headless Chromium only; not phone/WeChat', 'Cold restore closes the browser process and relaunches the same profile; a page reload is recorded separately and is not treated as the cold restore'],
    });
    console.log('UI-03 PASS', out);
  } catch (e) {
    errors.push(String(e.stack || e));
    try { if (page) shots.failure = await H.shot(page, 'ui-03-failure.png'); } catch {}
    H.write('ui-03-cold-restore-board.json', { id: 'UI-03', status: 'FAIL', runId: id, namespace: root, checks, screenshots: shots, errors, state: page ? await F.boardState(page).catch(() => null) : null, visual: page ? await F.boardVisual(page).catch(() => null) : null });
    console.error(e); process.exitCode = 1;
  } finally { if (context) await context.close(); }
})();
