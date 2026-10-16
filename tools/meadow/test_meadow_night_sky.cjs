'use strict';
// Meadow night sky: dome, near clouds, camera clear, and the reveal key light.
// Weight 0 keeps the day values. Missing nodes are ignored. Pause does not skip the tint.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('../board-ui/harness.cjs');

const H = createHarness();
H.cc.Vec4 = class { constructor(x, y, z, w) { Object.assign(this, { x, y, z, w }); } };
const M = H.load('region/MeadowBoardBackground');

function surface(name) {
  const node = new H.cc.Node(name);
  const renderer = node.addComponent(H.cc.MeshRenderer);
  const mat = { mainColor: null, setProperty(key, value) { this[key] = value; } };
  renderer.getMaterialInstance = () => mat;
  return { node, mat };
}

function close(a, b, label) {
  assert.equal(a.length, b.length, label);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-6, label + ' [' + i + '] ' + a[i] + ' vs ' + b[i]);
}

const root = new H.cc.Node('meadow');
const dome = surface('meadow_sky_dome');
const clouds = surface('meadow_clouds_near');
root.addChild(dome.node);
root.addChild(clouds.node);
const camNode = new H.cc.Node('MeadowBackgroundCamera');
const camera = camNode.addComponent(H.cc.Camera);
camera.clearColor = new H.cc.Color(1, 2, 3, 255);
const lightNode = new H.cc.Node('MeadowKeyLight');
const light = lightNode.addComponent(H.cc.SphereLight);
light.luminance = 12;
light.color = new H.cc.Color(255, 243, 218, 255);
root.addChild(lightNode);

M.applyMeadowNightSky(root, camera, light, 0);
close([dome.mat.mainColor.x, dome.mat.mainColor.y, dome.mat.mainColor.z], [1, 1, 1], 'day dome');
close([clouds.mat.mainColor.x, clouds.mat.mainColor.y, clouds.mat.mainColor.z], [1, 1, 1], 'day clouds');
assert.deepEqual([camera.clearColor.r, camera.clearColor.g, camera.clearColor.b], [135, 191, 201]);
assert.equal(light.luminance, 12);
assert.deepEqual([light.color.r, light.color.g, light.color.b], [255, 243, 218]);

M.applyMeadowNightSky(root, camera, light, 1);
close([dome.mat.mainColor.x, dome.mat.mainColor.y, dome.mat.mainColor.z], M.MEADOW_DOME_NIGHT, 'night dome');
close([clouds.mat.mainColor.x, clouds.mat.mainColor.y, clouds.mat.mainColor.z], M.MEADOW_CLOUD_NIGHT, 'night clouds');
assert.deepEqual([camera.clearColor.r, camera.clearColor.g, camera.clearColor.b], [...M.MEADOW_CLEAR_NIGHT]);
close([light.color.r, light.color.g, light.color.b], M.MEADOW_KEY_NIGHT, 'night key');
assert.ok(Math.abs(light.luminance - 12 * M.MEADOW_KEY_NIGHT_SCALE) < 1e-6);

const mid = M.meadowNightMix(M.MEADOW_CLEAR_DAY, M.MEADOW_CLEAR_NIGHT, 0.5);
M.applyMeadowNightSky(root, camera, light, 0.5);
assert.deepEqual([camera.clearColor.r, camera.clearColor.g, camera.clearColor.b], mid);
close([dome.mat.mainColor.x, dome.mat.mainColor.y, dome.mat.mainColor.z], M.meadowNightMix([1, 1, 1], M.MEADOW_DOME_NIGHT, 0.5), 'half dome');

assert.doesNotThrow(() => M.applyMeadowNightSky(new H.cc.Node('empty'), null, null, 1));
assert.doesNotThrow(() => M.applyMeadowNightSky(null, null, null, 1));

const motion = root.addComponent(M.MeadowSceneMotion);
motion.skyCamera = camera;
motion.light = light;
motion.hostPaused = true;
motion.visible = false;
camera.clearColor = new H.cc.Color(1, 2, 3, 255);
globalThis.__worldDayNight = { snapshot: () => ({ mode: 'night' }) };
H.load('ui/NightTint').resetUiNightWeight();
motion.update(0.1);
assert.equal(motion.diagnostics().seconds, 0, 'paused clock stays put');
assert.deepEqual([camera.clearColor.r, camera.clearColor.g, camera.clearColor.b], [...M.MEADOW_CLEAR_NIGHT], 'paused frame still writes the night sky');

const src = fs.readFileSync(path.join(__dirname, '../../creator-build-project/assets/scripts/region/MeadowBoardBackground.ts'), 'utf8');
const updateBody = src.slice(src.indexOf('update(dt:number)'), src.indexOf('diagnostics()'));
assert.match(updateBody, /applyMeadowNightSky\(this\.node,this\.skyCamera,this\.light,night\)/);
assert.ok(updateBody.indexOf('applyMeadowNightSky') > updateBody.indexOf('windParams'), 'tint is outside the clock gate');
assert.match(src, /applyMeadowNightSky\(rig,camera,light\)/);

console.log('PASS meadow night sky: dome, clouds, clear #87bfc9->#2e3d75, key light, paused frame, mount');
