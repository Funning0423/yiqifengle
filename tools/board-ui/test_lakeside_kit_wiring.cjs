'use strict';
/* lakeside-kit-wiring: ManagedMobileBoardUI lakeside fusion-kit branch. TRIAL default ON; opt-out ?qflakesidekit=0 / __qfLakesideBoardKit=false
 * (2D tray, grid cellAt). ON: cells on the projected water-grid centres (tap hit), tray + tile bases + 2D piece art hidden
 * (scene LK_piece_* / wb_line / buoy / raft are the visual), cellAt = nearest projected centre, fallback = 0, no camera writes.
 * Kit scene keep = default 842 (813 + 29 board-fusion perimeter pads/lotus) + 49 RING + 49 SHD + 52 LK_piece_* (=992); board_frame still skipped. Formal tip 05ca7c50 stays OFF. */
const assert = require('node:assert/strict');
const { createHarness } = require('./harness.cjs');
const { createBoard, snapshot } = require('./board-fixture.cjs');
async function mk(on, w, h, region) {
  const H = createHarness();
  if (on) {
    delete globalThis.__qfLakesideBoardKit;
    globalThis.location = { search: '?qflakesidekit=1' };
  } else {
    globalThis.__qfLakesideBoardKit = false;
    globalThis.location = { search: '?qflakesidekit=0' };
  }
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
      assert.equal(n.getChildByName('ProjectPieceArt').active, false, '2D piece art hidden (scene LK_piece_*)');
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
  assert.equal(SD.lakesideSceneInstances(tr.instances).length, 842, 'default keep 842');
  assert.equal(SD.lakesideSkippedGlb().length, 3, 'default skip 3');
  assert.equal(SD.lakesideSceneInstances(tr.instances).filter(i => /^LK_piece_/.test(i.glb)).length, 0, 'default filters pieces');
  SD.setLakesideKitAssets(true);
  const on = SD.lakesideSceneInstances(tr.instances);
  assert.equal(on.length, 992, 'kit keep 842+98 RING/SHD +52 pieces');
  assert.equal(on.filter(i => /^LK_(lilypad|lotus)_fz\d\d$/.test(i.name)).length, 29, 'board-fusion perimeter pads/lotus');
  assert.equal(on.filter(i => i.glb === 'LK_contact_shadow.glb').length, 49);
  assert.equal(on.filter(i => i.glb === 'LK_ripple_ring.glb').length, 49);
  assert.equal(on.filter(i => /^LK_piece_/.test(i.glb)).length, 52, 'kit keeps LK_piece_*');
  assert.equal(on.filter(i => i.glb === 'LK_wb_line.glb').length, 16);
  assert.equal(on.filter(i => i.glb === 'LK_buoy_lantern.glb').length, 4);
  assert.equal(on.filter(i => i.glb === 'LK_chime_raft.glb').length, 2);
  assert.equal(on.filter(i => i.glb === 'LK_board_frame.glb').length, 0);
  assert.deepEqual(SD.lakesideSkippedGlb(), ['LK_board_frame.glb']);
  console.log('lakeside-kit-wiring: PASS');
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
