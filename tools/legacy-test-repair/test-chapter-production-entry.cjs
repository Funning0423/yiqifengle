'use strict';
// Legal replay -> actual provider gate -> actual island journal and chapter buttons, with Cocos boundaries doubled.
const assert = require('node:assert/strict');
const { createHarness } = require('../board-ui/harness.cjs');
const Host = require('../../creator-build-project/assets/scripts/regional-r05/runtime/campaign-host.js');
const Engine = require('../../creator-build-project/assets/scripts/regional-r05/runtime/index.js');
const checks = [];
(async () => {
  for (const milestone of [4, 8, 12]) {
    const H = createHarness({ debug: true }), x = H.load('world-r2/RegionFlowTest').createRegionFlowCheckpoint(milestone);
    const c = x.mainline.createController();
    for (const won of [false, true]) {
      if (won) {
        assert(c.resume().ok); const p = c.previewAction(x.lastAction); assert(p.ok); assert(c.commitAction(p.token).ok);
        while (c.snapshot().visual) assert(c.finishVisualStep(c.snapshot().visual.token).ok);
        assert.equal(c.snapshot().state, 'result.saved');
      }
      const completed = milestone - (won ? 0 : 1), journey = c.snapshot().journey;
      assert.equal(journey.completed, completed);
      const gates = ['tide', 'meadow', 'sky'].map(region => {
        const stageId = 'r05-' + region + '-01';
        return { region, ...Host.inspectSelection(x.r5, { stageId, seed: Engine.getStage(stageId).seedBank[0] }) };
      });
      assert.deepEqual(gates.map(g => g.ok), [completed >= 4, completed >= 8, completed >= 12]);
      for (let region = 0; region < gates.length; region++) {
        const id = gates[region].region, allowed = completed >= (region + 1) * 4, entered = [];
        const Overlay = H.load('world-r2/IslandJourneyOverlay').IslandJourneyOverlay;
        const o = new Overlay(H.cc._scene, { invoke: fn => fn(), mainlineStatus: () => ({ journey }), gates: () => ({ r5: gates, challenges: {} }),
          enterRegion: value => entered.push(value), enterR4() {}, enterSkycity() {}, returnHome() {}, toggleDayNight() {}, dayNight: () => ({ mode: 'day' }) });
        await H.flush(); o.sync(390, 844, true);
        H.tap(o.root.find('Island-journal')); assert(o.isOpen());
        const journal = o.popups.find('JourneyPanel'); assert(journal);
        const labels = journal.root.getComponentsInChildren(H.cc.Label).map(l => l.string);
        assert.equal(labels.includes('挑战需通关主线 ' + String((region + 1) * 4).padStart(2, '0')), !allowed);
        const chapterButton = journal.root.find('Chapter-' + id); assert(chapterButton);
        H.tap(chapterButton); const chapter = o.popups.find('ChapterPanel'); assert(chapter);
        H.tap(chapter.root.find('Continue-' + id));
        assert.deepEqual(entered, allowed ? [id] : [], 'production chapter button must obey provider gate');
        o.dispose();
      }
      checks.push({ milestone, completed, won, actualProviderGates: gates.map(g => g.ok), journalLabelsAndChapterClicksVerified: true });
    }
  }
  console.log(JSON.stringify({ status: 'PASS', checks, scope: 'Actual legal mainline replay, R5 campaign host, IslandJourneyOverlay, IslandPanels and button events on Cocos structural doubles. No rendered/device acceptance.' }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
