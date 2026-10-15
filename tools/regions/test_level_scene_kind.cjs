'use strict';
// Selects the live region lease from stage id and checks portrait framing bands.
// Does not boot the world, import a GLB, or retune the unfinalized camera track.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('../board-ui/harness.cjs');

const H = createHarness();
const { levelBackgroundKind } = H.load('world-r2/LevelRegion');
const { meadowScenePose } = H.load('region/MeadowSceneData');
const { skycityBoardPose } = H.load('region/SkycityBoardPose');
const composition = fs.readFileSync(path.join(__dirname, '../../creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts'), 'utf8');

function ndcY(eye, target, fov, point) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const back = norm(sub(eye, target));
  const right = norm(cross([0, 1, 0], back));
  const up = cross(back, right);
  const rel = sub(point, eye);
  const depth = -dot(rel, back);
  if (!(depth > 1)) return NaN;
  return (dot(rel, up) / depth) / Math.tan(fov * Math.PI / 360);
}

const meadow = ['mainline-05', 'mainline-06', 'mainline-07', 'mainline-08', 'r05-meadow-01'];
const sky = ['mainline-09', 'mainline-10', 'mainline-11', 'mainline-12', 'r05-sky-01'];
const picture = ['mainline-01', 'mainline-04', 'r05-tide-01'];
for (const id of meadow) assert.equal(levelBackgroundKind({ provider: 'mainline', stageId: id }), 'meadow', id);
for (const id of sky) assert.equal(levelBackgroundKind({ provider: 'r5', stageId: id }), 'skycity', id);
for (const id of picture) assert.equal(levelBackgroundKind({ stageId: id }), 'picture', id);
assert.equal(levelBackgroundKind(null), 'picture');

assert.match(composition, /levelBackgroundKind\(context\.selection\)/);
assert.match(composition, /createSkycityBoardBackground\(context\)/);
assert.match(composition, /preflightSkycityScene\(\)/);
assert.match(composition, /skycity-scene-load-failed/);
assert.doesNotMatch(composition, /enterSelectedLevel\(\)\{[^}]*preflight/s);

const boardTop = 1 - 2 * (212 / 844);
const below = 1 - 2 * (588 / 844);
const meadowPose = meadowScenePose(390 / 844);
assert.equal(meadowPose.fovVerticalDeg, 49.42635311494791);
const hub = ndcY(meadowPose.position, meadowPose.target, meadowPose.fovVerticalDeg, [0, 13.662, -27.05]);
const path0 = ndcY(meadowPose.position, meadowPose.target, meadowPose.fovVerticalDeg, [0, 1.163, 20]);
assert.ok(hub > boardTop && hub < 1, 'windmill hub ' + hub);
assert.ok(path0 < below && path0 > -1, 'near path ' + path0);

const skyPose = skycityBoardPose(402 / 874);
assert.equal(skyPose.fovVerticalDeg, 46);
assert.deepEqual(skyPose.position, [1.3, 17.87, 62]);
assert.deepEqual(skyPose.target, [3.29, -12.13, 28.57]);
const head = ndcY(skyPose.position, skyPose.target, skyPose.fovVerticalDeg, [3.29, 5.05, 28.57]);
const hand = ndcY(skyPose.position, skyPose.target, skyPose.fovVerticalDeg, [4.62, 1.54, 29.79]);
const sea = ndcY(skyPose.position, skyPose.target, skyPose.fovVerticalDeg, [20, -40, 30]);
assert.ok(head > boardTop && head < 0.96, 'robot head ' + head);
assert.ok(hand > boardTop && hand < head, 'watering hand ' + hand);
assert.ok(sea < below && sea > -1, 'cloud layer ' + sea);
const landscape = skycityBoardPose(16 / 9, 0.2);
assert.notDeepEqual(landscape.position, skyPose.position);

console.log(JSON.stringify({
  status: 'PASS',
  meadow, sky, picture,
  framing: { boardTop, below, hub, path0, head, hand, sea, skyTarget: skyPose.target },
}, null, 2));
