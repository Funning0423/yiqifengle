'use strict';
/* lakeside-kit-flag: LAKESIDE_KIT (Funning fusion) TRIAL default ON; ?qflakesidekit=0 / __qfLakesideBoardKit=false opt-out;
 * cellM=1.1 anchor [0,0,12]; kit path unskips contact_shadow + ripple_ring, keeps LK_piece_* (board_frame stays skipped);
 * pieceKeys = LK_piece_* (not board_art); hide2D.pieces=true. Formal tip 05ca7c50 stays OFF. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createHarness } = require('../board-ui/harness.cjs');
const H = createHarness();
const K = H.load('ui/BoardKit'), B = H.load('ui/BoardProjection'), S = H.load('region/LakesideSceneData');
delete globalThis.location; delete globalThis.__qfLakesideBoardKit;
assert.equal(K.boardKitFor('lake').id, 'default', 'unregistered → default');
assert.equal(B.lakesideBoardKitFromFlag(), true, 'no flag → TRIAL default ON');
assert.equal(K.boardKitFor('lake').id, 'lakeside');
assert.equal(S.lakesideKitAssetsEnabled(), true);
const kit = K.boardKitFor('lake');
assert.equal(kit.id, 'lakeside');
assert.deepEqual(kit.board.anchor, [0, 0, 12]);
assert.equal(kit.board.cellM, 1.1);
assert.equal(kit.board.topY, 0.02);
assert.equal(kit.board.yawDeg, 0);
assert.equal(kit.hide2D.tray, true);
assert.equal(kit.hide2D.tiles, true);
assert.equal(kit.hide2D.pieces, true, 'scene LK_piece_* = visual');
assert.equal(kit.pieceBundle, 'region_lakeside');
assert.equal(kit.pieceKeys[0], 'LK_piece_shell');
assert.equal(S.lakesidePieceGlbForType(0), 'LK_piece_shell.glb');
assert.deepEqual([...S.lakesideSkippedGlb()], ['LK_board_frame.glb']);
// opt-out via global
globalThis.__qfLakesideBoardKit = false;
assert.equal(B.lakesideBoardKitFromFlag(), false, 'global false → OFF');
assert.equal(K.boardKitFor('lake').id, 'default');
assert.equal(S.lakesideKitAssetsEnabled(), false);
// opt-out via query
delete globalThis.__qfLakesideBoardKit;
B.setLakesideBoardKit(true);
globalThis.location = { search: '?qflakesidekit=0' };
assert.equal(B.lakesideBoardKitFromFlag(), false, 'query=0 closes kit');
// force on via query
B.setLakesideBoardKit(false);
globalThis.location = { search: '?qflakesidekit=1' };
assert.equal(B.lakesideBoardKitFromFlag(), true, 'query=1 opens kit');
delete globalThis.__qfLakesideBoardKit;
globalThis.__qfLakesideBoardKit = true;
delete globalThis.location;
B.setLakesideBoardKit(false);
assert.equal(B.lakesideBoardKitFromFlag(), true, 'global true opens kit');
// world centres match LAKESIDE_GRID
const tw0 = K.kitTileWorld(kit, 0), tw48 = K.kitTileWorld(kit, 48), tw24 = K.kitTileWorld(kit, 24);
assert.ok(Math.abs(tw0[0] + 3.3) < 1e-9 && Math.abs(tw0[2] - 8.7) < 1e-9, 'cell0');
assert.ok(Math.abs(tw48[0] - 3.3) < 1e-9 && Math.abs(tw48[2] - 15.3) < 1e-9, 'cell48');
assert.ok(Math.abs(tw24[0]) < 1e-9 && Math.abs(tw24[2] - 12) < 1e-9, 'cell24');
assert.ok(Math.abs(tw0[1] - 0.02) < 1e-9, 'topY');
const pose = B.lakesideBoardKitPose(390, 844);
assert.ok(pose.fovVerticalDeg > 0 && pose.position.length === 3);
// race fix: board preload/build must apply flag before scenery filter (UI initializeManaged is too late)
const bgSrc = fs.readFileSync(path.join(__dirname, '../../creator-build-project/assets/scripts/region/LakesideBoardBackground.ts'), 'utf8');
const bi = bgSrc.indexOf('const buildLakesideBoard=async'), mi = bgSrc.indexOf("step='scenery'", bi), fi = bgSrc.indexOf('lakesideBoardKitFromFlag()', bi);
assert.ok(bi > 0 && fi > bi && fi < mi, 'buildLakesideBoard calls fromFlag before scenery mount');
console.log('lakeside-kit-flag: PASS', { defaultOn: true, anchor: kit.board.anchor, cellM: kit.board.cellM, poseFov: +pose.fovVerticalDeg.toFixed(2) });