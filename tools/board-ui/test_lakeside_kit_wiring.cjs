'use strict';
/* lakeside-kit-wiring: ManagedMobileBoardUI lakeside kit branch. OFF without ?qflakesidekit=1 even on a lake board
 * (2D tray, grid cellAt). ON (test mode): cells on the projected water-grid centres (≤ 0.5 pt), scaled by perspective,
 * tray + tile bases hidden, cellAt = nearest projected centre (±8 pt jitter), fallback = 0, no camera writes.
 * Default path (island) untouched. */
const assert = require('node:assert/strict');
const { createHarness } = require('./harness.cjs');
const { createBoard, snapshot } = require('./board-fixture.cjs');
async function mk(on, w, h, region) {
  const H = createHarness();
  if (on) globalThis.location = { search: '?qflakesidekit=1' }; else delete globalThis.location;
  delete globalThis.__qfLakesideBoardKit;
  const s = snapshot('regional-r05', 1); s.active.region = region;
  const b = createBoard({ harness: H, provider: 'regional-r05', snapshot: s, width: w, height: h });
  await H.flush(); b.render(); b.u.update(0); return { H, b };
}
(async () => {
  { const { b } = await mk(false, 390, 844, 'lake');
    assert.equal(b.u.boardFrame.getChildByName('Tray').active, true, 'off: tray shown');
    assert.equal(b.u.kitGridCache, null, 'off: no kit grid'); }
  { const { b } = await mk(true, 390, 844, 'meadow');
    assert.equal(b.u.kitGridCache, null, 'on flag but meadow: no kit');
    assert.equal(b.u.boardFrame.getChildByName('Tray').active, true, 'meadow tray'); }
  for (const [w, h] of [[390, 844], [320, 568], [390, 520], [768, 1024]]) {
    const { H, b } = await mk(true, w, h, 'lake'), u = b.u, K = H.load('ui/BoardKit'), B = H.load('ui/BoardProjection');
    assert.ok(u.kitGridCache && u.kitGridCache.projected, w + 'x' + h + ' projected');
    assert.equal(u.boardFrame.getChildByName('Tray').active, false, 'tray hidden');
    const pb = B.projectBoard(K.LAKESIDE_KIT, w, h), g = u.geo; let bad = 0;
    for (let i = 0; i < 49; i++) {
      const n = u.cells[i], c = pb.centers[i];
      assert.ok(Math.abs(n.position.x - (c.x - g.grid.x)) < 0.5 && Math.abs(n.position.y - (g.grid.y - c.y)) < 0.5, 'cell on water ' + i);
      assert.equal(u.bases[i].node.active, false, 'tile base hidden');
      assert.equal(u.cellAt(c.x, c.y, true), i, 'exact centre yDown');
      assert.equal(u.cellAt(c.x, h - c.y, false), i, 'exact centre yUp');
      for (let k = 0; k < 20; k++) {
        /* Lakeside foreshortening packs far-row centres ~9 pt apart; ±2 stays inside the Voronoi (coast used ±8 on ~1 m cells). */
        const x = c.x + (Math.sin(i * 7 + k) * 2), y = c.y + (Math.cos(i * 3 + k * 5) * 2);
        if (u.cellAt(x, y, true) !== i || u.cellAt(x, h - y, false) !== i) bad++;
      }
    }
    assert.equal(bad, 0, w + 'x' + h + ' taps');
    assert.ok(u.cells[3].scale.x <= u.cells[45].scale.x + 1e-6, 'perspective: far ≤ near');
    console.log(`ok   ${w}x${h}: 49 cells on projected water grid, far scale ${u.cells[3].scale.x.toFixed(3)} / near ${u.cells[45].scale.x.toFixed(3)}, tray/bases hidden, 1960 taps 0 wrong`);
  }
  delete globalThis.location;
  const fb = (globalThis.__qfBoardKitFallback || { count: 0 }).count;
  assert.equal(fb, 0, 'fallback');
  // scene skip A/B
  const S = require('../qf-env.cjs'); // ensure path
  const SD = createHarness().load('region/LakesideSceneData');
  const tr = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '../../creator-build-project/assets/bundles/region_lakeside/scene_r5h_slim_transforms.json'), 'utf8'));
  SD.setLakesideKitAssets(false);
  assert.equal(SD.lakesideSceneInstances(tr.instances).length, 813, 'default keep 813');
  assert.equal(SD.lakesideSkippedGlb().length, 3, 'default skip 3');
  SD.setLakesideKitAssets(true);
  const on = SD.lakesideSceneInstances(tr.instances);
  assert.equal(on.length, 911, 'kit keep 813+98');
  assert.equal(on.filter(i => i.glb === 'LK_contact_shadow.glb').length, 49);
  assert.equal(on.filter(i => i.glb === 'LK_ripple_ring.glb').length, 49);
  assert.equal(on.filter(i => i.glb === 'LK_board_frame.glb').length, 0);
  assert.deepEqual(SD.lakesideSkippedGlb(), ['LK_board_frame.glb']);
  console.log('lakeside-kit-wiring: PASS');
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
