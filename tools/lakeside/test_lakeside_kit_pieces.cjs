'use strict';
/* lakeside-kit-pieces: kit ON projects the shipped board_art sprites onto the ff0d9c55 cell faces and
 * they follow the live board (swap, clear, drop, settle, win). Static LK_piece_* are not in the scene.
 * The same predicate rejects the static mesh layout (counterexample) and a one-cell lie.
 * L1–L6 each play a shipped witness to won, and write a mid-board and a win-board PNG. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { createHarness } = require('../board-ui/harness.cjs');
const { createBoard, snapshot } = require('../board-ui/board-fixture.cjs');

const ROOT = path.resolve(__dirname, '../..');
const R = path.join(ROOT, 'creator-build-project/assets/scripts/regional-r05/runtime');
const API = require(path.join(R, 'index.js'));
const LEVELS = require(path.join(R, 'lakeside-levels-data.js'));
const WITNESS = JSON.parse(fs.readFileSync(path.join(__dirname, 'calibration-report.json'), 'utf8'));
const ART_ROOT = path.join(ROOT, 'creator-build-project/assets/bundles/board_art');
const SHOTS = process.env.QF_LAKESIDE_KIT_SHOTS || '/opt/cursor/artifacts/lakeside-kit-on';
const SHOOT = path.join(__dirname, 'shoot_lakeside_kit_board.py');

function typesOf(board) {
  return board.map(t => (t && Number.isInteger(t.type) ? t.type % 6 : null));
}
function same(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function staticTypes(instances, glbs) {
  const shown = Array(49).fill(null);
  for (const inst of instances) {
    if (!/^LK_piece_/.test(inst.glb) || !(inst.pos[1] < 1)) continue;
    const col = Math.round((inst.pos[0] + 3.3) / 1.1);
    const row = Math.round((inst.pos[2] - 8.7) / 1.1);
    if (col < 0 || col > 6 || row < 0 || row > 6) continue;
    shown[row * 7 + col] = glbs.indexOf(inst.glb);
  }
  return shown;
}
function shownFromUi(u, keys) {
  return u.cells.map(n => {
    const art = n.getChildByName('ProjectPieceArt');
    if (!art.active) return null;
    const frame = art.getComponent('Sprite').spriteFrame;
    const key = frame && frame.texture && frame.texture.image && frame.texture.image.path;
    const type = keys.indexOf(key);
    if (type < 0) throw Error('piece sprite is not a shipped board_art frame: ' + key);
    return type;
  });
}

(async () => {
  const H = createHarness();
  globalThis.__qfLakesideBoardKit = true;
  delete globalThis.location;
  const K = H.load('ui/BoardKit');
  const B = H.load('ui/BoardProjection');
  const S = H.load('region/LakesideSceneData');
  const Art = H.load('ui/BoardArt');
  assert.equal(B.lakesideBoardKitFromFlag(), true, 'gate runs with the kit forced on');
  const kit = K.boardKitFor('lake');
  assert.equal(kit.id, 'lakeside');
  assert.equal(kit.hide2D.pieces, false);
  let even = 0, odd = 0;
  for (let i = 0; i < 49; i++) {
    const y = (i % 7 + Math.floor(i / 7)) % 2 === 0 ? 0.018 : 0.02;
    assert.equal(S.lakesideCellFaceY(i), y, 'face ' + i);
    assert.equal(kit.board.faceY[i], y);
    assert.equal(K.kitTileWorld(kit, i)[1], y);
    if (y === 0.018) even++; else odd++;
  }
  assert.equal(even, 25);
  assert.equal(odd, 24);

  const tr = JSON.parse(fs.readFileSync(path.join(ROOT, 'creator-build-project/assets/bundles/region_lakeside/scene_r5h_slim_transforms.json'), 'utf8'));
  const kept = S.lakesideSceneInstances(tr.instances);
  assert.equal(kept.filter(i => /^LK_piece_/.test(i.glb)).length, 0, 'static LK_piece_* are not in the kit scene');
  assert.equal(kept.filter(i => i.glb === 'LK_ripple_ring.glb').length, 49, 'cell faces stay');
  const frozen = staticTypes(tr.instances, S.LAKESIDE_PIECE_GLBS);
  assert.ok(frozen.some(t => t !== null), 'the counterexample still has static meshes to reject');

  const s = snapshot('regional-r05', 0);
  s.active.region = 'lake';
  s.active.stageId = 'r04-lake-01';
  const b = createBoard({ harness: H, provider: 'regional-r05', snapshot: s, width: 390, height: 844 });
  await H.flush();
  const keys = Art.PIECE_KEYS;
  const results = [];
  fs.mkdirSync(SHOTS, { recursive: true });

  function paint(board) {
    s.active.board = JSON.parse(JSON.stringify(board));
    s.state = 'run.ready';
    b.render();
    const shown = shownFromUi(b.u, keys);
    const want = typesOf(board);
    assert.deepEqual(shown, want, 'painted sprites diverged from the board');
    const lie = want.slice();
    const flip = lie.findIndex(t => t !== null);
    lie[flip] = lie[flip] === 0 ? 1 : 0;
    assert.equal(same(shown, lie), false, 'a one-cell lie must fail the same predicate');
    return shown;
  }
  function shoot(level, name, board) {
    const w = 780, h = 1688;
    const projected = B.projectBoard(kit, w, h);
    const pieces = [];
    for (let i = 0; i < 49; i++) {
      const place = B.kitPiecePlacement(kit, w, h, i);
      const t = board[i];
      pieces.push({
        i, type: t && Number.isInteger(t.type) ? t.type % 6 : null,
        x: place.x, y: place.y, width: place.width, anchorY: place.anchorY,
        key: t && Number.isInteger(t.type) ? keys[t.type % 6] : null,
        faceY: K.kitCellFaceY(kit, i),
      });
    }
    const spec = { w, h, artRoot: ART_ROOT, quads: projected.quads, pieces };
    const json = path.join(SHOTS, level + '-' + name + '.json');
    const png = path.join(SHOTS, level + '-' + name + '.png');
    fs.writeFileSync(json, JSON.stringify(spec));
    const r = cp.spawnSync('python3', [SHOOT, json, png], { encoding: 'utf8' });
    if (r.status !== 0) throw Error('shot ' + png + '\n' + r.stderr + r.stdout);
    fs.unlinkSync(json);
    assert.ok(fs.statSync(png).size > 1000, png);
    return png;
  }

  for (const level of LEVELS) {
    const w = WITNESS.find(x => x.id === level.id).witness[0];
    const run = API.createSession(level.id, w.seed);
    let sawSwap = false, sawClear = false, sawDrop = false, midBoard = null;
    paint(run.snapshot().board);
    const staticAtStart = frozen.slice();
    for (let step = 0; step < w.actions.length; step++) {
      const action = w.actions[step];
      assert.equal(run.act(action), true, level.id + ' action ' + step);
      for (const frame of run.frames) {
        if (frame.kind === 'action') {
          sawSwap = true;
          assert.equal(frame.after[action[1]].id, frame.before[action[2]].id, 'swap moves the piece id');
          assert.equal(frame.after[action[2]].id, frame.before[action[1]].id);
          paint(frame.after);
        } else if (frame.kind === 'clear') {
          sawClear = true;
          paint(frame.before);
          paint(frame.after);
          if (!midBoard) midBoard = JSON.parse(JSON.stringify(frame.after));
          for (const removed of frame.wave.removed) assert.equal(frame.after[removed.index], null, 'cleared cell is empty');
        } else if (frame.kind === 'drop') {
          sawDrop = true;
          const shown = paint(frame.board);
          for (const moved of frame.changes.moved) assert.equal(shown[moved.to], moved.type % 6, 'dropped piece landed');
          for (const spawned of frame.changes.spawned) assert.equal(shown[spawned.to], spawned.type % 6, 'spawned piece landed');
        }
      }
      const settled = run.snapshot().board;
      paint(settled);
      assert.equal(same(staticAtStart, frozen), true, 'static meshes do not change with the board');
      assert.equal(same(frozen, typesOf(settled)), false, level.id + ' static LK_piece_* must not match the live board');
      if (step === 0) results.push({ id: level.id, ordinal: level.ordinal, mid: shoot('L' + level.ordinal, 'mid', midBoard || settled) });
    }
    assert.equal(run.snapshot().status, 'won', level.id);
    assert.equal(sawSwap && sawClear && sawDrop, true, level.id + ' witness never swapped, cleared and dropped');
    const win = shoot('L' + level.ordinal, 'win', run.snapshot().board);
    results[results.length - 1].win = win;
    results[results.length - 1].actions = w.actions.length;
    results[results.length - 1].seed = w.seed;
    console.log('cleared', level.id, 'L' + level.ordinal, 'actions', w.actions.length, 'seed', w.seed);
  }
  console.log(JSON.stringify({ status: 'PASS', levels: results, shots: SHOTS }));
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
