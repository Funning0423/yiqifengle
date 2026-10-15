'use strict';
// UI-04: checkpoint 08 meadow → mainline-09 (stage region sky / 月影古树), meadow challenge gate,
// checkpoint 12 finale, sky challenge board, and the sky-city 3D visit. Live web build.
const path = require('node:path'), assert = require('node:assert/strict'), H = require('./harness.cjs'), F = require('./flows.cjs');
const gate = (g, region) => g.r5.find(x => x.region === region);
(async () => {
  const id = H.runId(), ns8 = 'task21-web-ui04a-' + id, ns12 = 'task21-web-ui04b-' + id, errors = [], logs = [], checks = [], shots = {};
  const startedAt = new Date().toISOString();
  let context, page;
  const check = (name, data) => { checks.push({ name, pass: true, ...data }); console.log('PASS', name); };
  const launch = async (ns) => {
    const root = F.root(ns), query = '?testNamespace=' + ns, profile = path.join(H.OUT, 'profile-' + ns);
    if (context) await context.close();
    ({ context, page } = await H.launch(profile, { query, errors, logs }));
    assert.equal((await page.evaluate(() => __worldIntegration.regionFlowTest())).namespace, root);
    return { root, profile };
  };
  try {
    const a = await launch(ns8);
    const entry8 = await F.enterCheckpoint(page, 8);
    assert.equal(entry8.stageId, 'mainline-08');
    const meadowBoard = await F.boardVisual(page);
    console.log('boardVisual.background', JSON.stringify(meadowBoard.background));
    assert.equal(meadowBoard.region, 'meadow');
    assert.equal(F.liveMeadowReason(meadowBoard.background), null);
    shots.meadow08 = await H.shot(page, 'ui-04-a-checkpoint08-meadow.png');
    const win8 = await F.finalSwap(page);
    assert.equal(win8.result.journeyCompleted, 8);
    assert.equal(win8.result.nextStageId, 'mainline-09');
    const after8 = await F.gates(page);
    assert.equal(gate(after8, 'meadow').ok, true);
    assert.equal(gate(after8, 'sky').ok, false);
    assert.equal(gate(after8, 'sky').reason, 'stage-locked');
    shots.result08 = await H.shot(page, 'ui-04-b-checkpoint08-result.png');
    check('checkpoint-08-win-on-meadow-unlocks-meadow-challenge-keeps-sky-locked', { entry: entry8, meadow: meadowBoard.background, result: win8.result, gates: after8 });
    await H.tapNode(page, { popup: 'ResultPanel', name: 'Next' });
    await F.waitBoard(page, b => b.snapshot.active?.stageId === 'mainline-09' && b.background?.state === 'ready', null, 180000);
    await page.waitForTimeout(1200);
    const m9 = await F.boardVisual(page);
    assert.equal(m9.stageId, 'mainline-09');
    assert.equal(m9.region, 'sky');
    assert.equal(m9.chapterName, '月影古树');
    assert.equal(m9.name, '月光阶梯');
    assert.equal(m9.background.renderer, 'board-ui-static-picture');
    assert.equal(m9.background.bundle, 'region_island');
    assert.equal(m9.background.path, 'board/bg_island_board');
    assert.equal(m9.background.visible, true, 'mainline-09 visible=' + m9.background.visible + ' size=' + m9.background.width + 'x' + m9.background.height);
    assert(m9.background.width > 100 && m9.background.height > 100, 'mainline-09 picture size ' + m9.background.width + 'x' + m9.background.height);
    assert((await F.visiblePieces(page)) >= 20, 'mainline-09 board is not blank');
    shots.mainline09 = await H.shot(page, 'ui-04-c-mainline09-moon-tree.png');
    check('next-leaves-meadow-3d-and-enters-mainline-09-sky-chapter', { board: m9, note: 'Mainline 09–12 are the 月影古树 chapter (stage region sky) on the island board picture. The sky-city 3D visit and the 天空回声 challenge board are separate gates, checked after checkpoint 12.' });
    await F.exitToIsland(page);
    await H.tapNode(page, { name: 'Island-journal' });
    await H.tapNode(page, { name: 'Chapter-sky' });
    const blocked = (await H.nodes(page, { popup: 'ChapterPanel', name: 'Continue-sky' })).pop();
    assert(blocked && /12/.test(blocked.label), 'sky continue stays locked until mainline 12');
    shots.skyLocked = await H.shot(page, 'ui-04-d-sky-chapter-locked.png');
    check('sky-chapter-continue-stays-locked-until-mainline-12', { continueLabel: blocked.label });
    // The chapter page stacks on the journey book. Closing it leaves the book open and hides the island dock,
    // so the meadow challenge continues from 返回章节 rather than looking for Island-journal underneath.
    await H.tapNode(page, { popup: 'ChapterPanel', name: 'BackToChapters' });
    await page.waitForTimeout(500);
    await H.tapNode(page, { popup: 'JourneyPanel', name: 'Chapter-meadow' });
    await H.tapNode(page, { popup: 'ChapterPanel', name: 'Continue-meadow' });
    await F.waitBoard(page, b => b.snapshot.active?.stageId === 'r05-meadow-01' && b.background?.state === 'ready', null, 180000);
    await F.resumeBoard(page);
    await page.waitForTimeout(1000);
    const meadowChallenge = await F.boardVisual(page);
    console.log('boardVisual.background', JSON.stringify(meadowChallenge.background));
    assert.equal(meadowChallenge.provider, 'regional-r05');
    assert.equal(F.liveMeadowReason(meadowChallenge.background), null);
    assert((await F.visiblePieces(page)) >= 20);
    shots.meadowChallenge = await H.shot(page, 'ui-04-e-meadow-challenge.png');
    check('meadow-challenge-gate-enters-live-meadow-board', { board: meadowChallenge });
    await F.exitToIsland(page);
    shots.islandAfterMeadow = await H.shot(page, 'ui-04-f-back-on-island.png');
    check('meadow-challenge-returns-to-island', { state: await page.evaluate(() => __worldIntegration.snapshot().state) });

    const b = await launch(ns12);
    const entry12 = await F.enterCheckpoint(page, 12);
    assert.equal(entry12.stageId, 'mainline-12');
    const finale = await F.boardVisual(page);
    assert.equal(finale.region, 'sky');
    assert.equal(finale.chapterName, '月影古树');
    assert.equal(finale.name, '森林的心愿');
    assert.equal(finale.background.renderer, 'board-ui-static-picture');
    assert.equal(finale.background.visible, true, 'finale visible=' + finale.background.visible + ' size=' + finale.background.width + 'x' + finale.background.height);
    assert(finale.background.width > 100 && finale.background.height > 100, 'finale picture size ' + finale.background.width + 'x' + finale.background.height);
    assert((await F.visiblePieces(page)) >= 20);
    shots.finale = await H.shot(page, 'ui-04-g-checkpoint12-finale.png');
    const win12 = await F.finalSwap(page);
    assert.equal(win12.result.journeyCompleted, 12);
    assert.equal(win12.result.nextStageId, null);
    const after12 = await F.gates(page);
    assert.equal(gate(after12, 'sky').ok, true);
    assert.equal(gate(after12, 'meadow').ok, true);
    shots.result12 = await H.shot(page, 'ui-04-h-checkpoint12-result.png');
    check('checkpoint-12-finale-unlocks-sky-challenge', { entry: entry12, finale: { stageId: finale.stageId, name: finale.name, chapterName: finale.chapterName, background: finale.background }, result: win12.result, gates: after12 });
    await H.tapNode(page, { popup: 'ResultPanel', name: 'Home' });
    await H.waitState(page, 'island');
    await F.openRegionViaJournal(page, 'sky');
    await F.waitBoard(page, b => b.snapshot.active?.stageId === 'r05-sky-01' && b.background?.state === 'ready', null, 180000);
    await F.resumeBoard(page);
    await page.waitForTimeout(1000);
    const skyBoard = await F.boardVisual(page);
    assert.equal(skyBoard.provider, 'regional-r05');
    assert.equal(skyBoard.region, 'sky');
    assert.equal(skyBoard.background.renderer, 'board-ui-static-picture');
    assert.equal(skyBoard.background.bundle, 'region_skycity');
    assert.equal(skyBoard.background.path, 'board/bg_skycity_board');
    assert.equal(skyBoard.background.chapter, 'sky');
    assert.equal(skyBoard.background.visible, true, 'sky challenge visible=' + skyBoard.background.visible + ' size=' + skyBoard.background.width + 'x' + skyBoard.background.height);
    assert(skyBoard.background.width > 100 && skyBoard.background.height > 100, 'sky challenge picture size ' + skyBoard.background.width + 'x' + skyBoard.background.height);
    assert((await F.visiblePieces(page)) >= 20, 'sky challenge board is not blank');
    shots.skyChallenge = await H.shot(page, 'ui-04-i-sky-challenge.png');
    check('sky-challenge-gate-enters-skycity-board', { board: skyBoard });
    await F.exitToIsland(page);
    await H.tapNode(page, { name: 'Island-journal' });
    await H.tapNode(page, { name: 'Chapter-sky' });
    await H.tapNode(page, { popup: 'ChapterPanel', name: 'VisitSkycity' });
    await H.waitState(page, 'skycity', 180000);
    await page.waitForTimeout(2500);
    const skyCity = await page.evaluate(() => __worldIntegration.snapshot());
    assert.equal(skyCity.state, 'skycity');
    assert.equal(skyCity.hidden, false);
    shots.skyCity = await H.shot(page, 'ui-04-j-skycity-visit.png');
    check('skycity-gate-enters-3d-visit', { snapshot: skyCity });
    await H.nav(page, 'returnIsland');
    await H.waitState(page, 'island');
    shots.returned = await H.shot(page, 'ui-04-k-returned-island.png');
    check('skycity-visit-returns-to-island', { state: await page.evaluate(() => __worldIntegration.snapshot().state) });
    assert.deepEqual(errors, []);
    const out = H.write('ui-04-region-08-12.json', {
      id: 'UI-04', status: 'PASS', layer: '网页集成 (Mac headless Chrome for Testing, Cocos web-desktop debug build)',
      runId: id, startedAt, finishedAt: new Date().toISOString(), build: H.buildIdentity(),
      namespaces: { checkpoint08: a.root, checkpoint12: b.root },
      profiles: { checkpoint08: path.relative(H.ROOT, a.profile), checkpoint12: path.relative(H.ROOT, b.profile) },
      route: '08 最后一步 on meadow 3D → win → 下一关 mainline-09 月影古树 → 旅程册 花粉草甸 继续 → 回小岛; fresh namespace 12 最后一步 → win → 旅程册 天空回声 继续 → 回小岛 → 前往天空城 → 返回小岛',
      checks, screenshots: shots, errors, logs: logs.slice(-30),
      limitations: ['Mac headless Chromium only; not phone/WeChat', 'Mainline 09–12 use the island board picture by design (BoardArt: 月影古树, not the 天空回声 picture). Sky-city 3D is the journey-book visit.'],
    });
    console.log('UI-04 PASS', out);
  } catch (e) {
    errors.push(String(e.stack || e));
    try { if (page) shots.failure = await H.shot(page, 'ui-04-failure.png'); } catch {}
    H.write('ui-04-region-08-12.json', { id: 'UI-04', status: 'FAIL', runId: id, checks, screenshots: shots, errors, state: page ? await F.boardState(page).catch(() => null) : null, visual: page ? await F.boardVisual(page).catch(() => null) : null, world: page ? await page.evaluate(() => { try { return __worldIntegration.snapshot(); } catch { return null; } }).catch(() => null) : null });
    console.error(e); process.exitCode = 1;
  } finally { if (context) await context.close(); }
})();
