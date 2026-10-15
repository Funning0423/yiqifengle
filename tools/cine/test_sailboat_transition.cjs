/** Island → meadow sailboat transition: timing parse, skip window, cloud hold. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { stripTypeScriptTypes } = require('node:module');

const root = path.resolve(__dirname, '../..');
const timingPath = path.join(root, 'creator-build-project/assets/resources/cine/transition_island_to_meadow.timing.json');
const modelPath = path.join(root, 'creator-build-project/assets/scripts/cine/SailboatTransitionModel.ts');
const windPath = path.join(root, 'creator-build-project/assets/scripts/audio/WindAudio.ts');

const model = new Function(stripTypeScriptTypes(fs.readFileSync(modelPath, 'utf8').replace(/^export /gm, ''), { mode: 'transform' }) + '\nreturn { parseSailboatTiming, parseSailboatTimingText, createSailboatPlayback, sailboatCoverAlpha, SAILBOAT_CINE_FILE, SAILBOAT_CINE_PATH, SAILBOAT_HOLD_WIND_PATH, SAILBOAT_TIMING_RESOURCE };')();
const rawText = fs.readFileSync(timingPath, 'utf8');
const raw = JSON.parse(rawText);
const timing = model.parseSailboatTiming(raw);

function pump(playback, seconds, input, step = 1 / timing.fps) {
  const commands = [];
  let view = null;
  let left = seconds;
  while (left > 1e-8) {
    const dt = Math.min(step, left);
    const sample = playback.advance(dt, input);
    commands.push(...sample.commands);
    view = sample.view;
    left -= dt;
    if (view.phase === 'done' || view.phase === 'holding' || view.phase === 'skip-hold') break;
  }
  return { view, commands };
}
function kinds(commands) { return commands.map(command => command.kind); }

assert.equal(crypto.createHash('sha256').update(rawText).digest('hex'), '0fc8dbf89e0ba397bd61dc8ba925916fcd2d6b9bcf53790e8327d3b46121c7ad');
assert.equal(timing.fps, raw.fps);
assert.equal(timing.lastFrame, raw.lastFrame);
assert.equal(timing.frameCount, raw.frameCount);
assert.equal(timing.durationSec, raw.durationSec);
assert.equal(timing.frameCount, timing.lastFrame + 1);
assert.equal(timing.durationSec, timing.lastFrame / timing.fps);
assert.deepEqual(timing.shots.map(shot => shot.startFrame), raw.events.shots.map(shot => shot.startFrame));
assert.deepEqual(timing.shots.map(shot => shot.id), raw.events.shots.map(shot => shot.id));
assert.equal(timing.shots.length, 5);
assert.equal(timing.skipEnabledFromFrame, raw.events.skipEnabledFromFrame);
assert.equal(timing.skipFadeSec, raw.events.skipFadeSec);
assert.equal(timing.skipLandingFrame, raw.events.skipLanding.frame);
assert.equal(timing.sceneSwapFrame, raw.events.sceneSwapFrame);
assert.deepEqual(timing.cloud, {
  inStartFrame: raw.events.cloudCover.inStartFrame,
  fullFrom: raw.events.cloudCover.fullFrom,
  fullTo: raw.events.cloudCover.fullTo,
  outEndFrame: raw.events.cloudCover.outEndFrame,
});
assert.equal(timing.holdCoverIfNotLoaded, true);
assert.equal(model.SAILBOAT_CINE_FILE, 'audio_cine/sfx_transition_island_to_meadow.mp3');
assert.equal(model.SAILBOAT_CINE_PATH, 'audio_cine/sfx_transition_island_to_meadow');
assert.equal(model.SAILBOAT_HOLD_WIND_PATH, 'audio_amb/amb_wind_soft_loop');
assert.match(fs.readFileSync(windPath, 'utf8'), /audio_amb\/amb_wind_soft_loop/);
assert.equal(fs.existsSync(path.join(root, 'creator-build-project/assets/resources/audio_amb/amb_wind_soft_loop.mp3')), true);

const modelSource = fs.readFileSync(modelPath, 'utf8');
for (const token of ['78', '81', '84', '126', '156']) {
  assert.equal(modelSource.includes(token), false, 'timing model hard-codes frame ' + token);
}

const moved = JSON.parse(rawText);
moved.events.sceneSwapFrame = moved.events.cloudCover.fullFrom - 1;
assert.throws(() => model.parseSailboatTiming(moved), /scene swap/);
const broken = JSON.parse(rawText);
broken.events.skipEnabledFromFrame = 40;
broken.events.skipFadeSec = 0.5;
const custom = model.parseSailboatTiming(broken);
assert.equal(custom.skipEnabledFromFrame, 40);
assert.equal(custom.skipFadeSec, 0.5);

function atFrame(frame, ready = true) {
  const playback = model.createSailboatPlayback(timing, { startFov: 42 });
  const started = playback.begin();
  const sample = pump(playback, frame / timing.fps, { meadowReady: ready });
  return { started, ...sample, playback };
}

const beforeCloud = atFrame(timing.cloud.inStartFrame, true);
assert.equal(beforeCloud.view.frame, timing.cloud.inStartFrame);
assert.equal(beforeCloud.view.cloud, 0);
const full = atFrame(timing.cloud.fullFrom, true);
assert.equal(full.view.frame, timing.cloud.fullFrom);
assert.equal(full.view.cloud, 1);
const stillFull = atFrame(timing.cloud.fullTo, true);
assert.equal(stillFull.view.cloud, 1);
const opened = atFrame(timing.cloud.outEndFrame, true);
assert.equal(opened.view.cloud, 0);
const swappedAt = atFrame(timing.sceneSwapFrame, true);
assert.equal(swappedAt.view.scene, 'meadow');
assert.equal(swappedAt.view.cloud, 1);
assert.ok(swappedAt.view.swapped);
assert.equal(full.view.scene, timing.cloud.fullFrom >= timing.sceneSwapFrame ? 'meadow' : 'island');
assert.equal(kinds(swappedAt.commands).includes('wind-loop'), false);

const early = model.createSailboatPlayback(timing);
const earlyStart = early.begin();
assert.deepEqual(kinds(earlyStart.commands), ['cine-play']);
assert.equal(earlyStart.commands[0].path, model.SAILBOAT_CINE_PATH);
assert.equal(earlyStart.view.hudVisible, false);
assert.equal(earlyStart.view.preload, true);
const beforeSkip = pump(early, timing.skipEnabledFromFrame / timing.fps - 1 / timing.fps, { meadowReady: true });
assert.equal(beforeSkip.view.frame, timing.skipEnabledFromFrame - 1);
const ignored = early.advance(0, { meadowReady: true, tap: true });
assert.equal(ignored.view.phase, 'playing');
assert.equal(kinds(ignored.commands).includes('cine-fade'), false);
const armed = early.advance(1 / timing.fps, { meadowReady: true });
assert.equal(armed.view.frame, timing.skipEnabledFromFrame);
const skipping = early.advance(0, { meadowReady: true, tap: true });
assert.equal(skipping.view.phase, 'skip-fade');
assert.equal(skipping.commands.find(command => command.kind === 'cine-fade').seconds, timing.skipFadeSec);
const landed = early.advance(timing.skipFadeSec, { meadowReady: true });
assert.equal(landed.view.phase, 'done');
assert.equal(landed.view.frame, timing.skipLandingFrame);
assert.equal(landed.view.scene, 'meadow');
assert.equal(landed.view.hudVisible, true);
assert.equal(landed.view.cloud, 0);
assert.equal(landed.view.white, 0);
assert.equal(landed.view.boatAlong, 1);
assert.equal(model.sailboatCoverAlpha(landed.view), 0);

const skipEarly = model.createSailboatPlayback(timing);
skipEarly.begin();
pump(skipEarly, timing.skipEnabledFromFrame / timing.fps, { meadowReady: false });
skipEarly.advance(0, { meadowReady: false, tap: true });
const covered = skipEarly.advance(timing.skipFadeSec, { meadowReady: false });
assert.equal(covered.view.phase, 'skip-hold');
assert.equal(covered.view.scene, 'island');
assert.equal(covered.view.cloud, 1);
assert.equal(covered.view.white, 1);
assert.equal(covered.view.swapped, false);
assert.equal(kinds(covered.commands).includes('wind-loop'), true);
const still = skipEarly.advance(1, { meadowReady: false });
assert.equal(still.view.phase, 'skip-hold');
assert.equal(still.view.frame, covered.view.frame);
const afterLoad = skipEarly.advance(0, { meadowReady: true });
assert.equal(afterLoad.view.phase, 'done');
assert.equal(afterLoad.view.frame, timing.lastFrame);
assert.equal(afterLoad.view.scene, 'meadow');
assert.equal(afterLoad.view.hudVisible, true);
assert.equal(afterLoad.commands.find(command => command.kind === 'wind-fade').seconds, timing.skipFadeSec);
assert.equal(afterLoad.commands.find(command => command.kind === 'wind-fade').path, model.SAILBOAT_HOLD_WIND_PATH);

const held = model.createSailboatPlayback(timing);
const heldStart = held.begin();
const waiting = pump(held, timing.durationSec + 1, { meadowReady: false });
assert.equal(waiting.view.phase, 'holding');
assert.equal(waiting.view.holding, true);
assert.equal(waiting.view.frame, timing.sceneSwapFrame);
assert.equal(waiting.view.cloud, 1);
assert.equal(waiting.view.scene, 'island');
assert.equal(waiting.view.swapped, false);
assert.equal(kinds(waiting.commands).filter(kind => kind === 'wind-loop').length, 1);
assert.equal(kinds(waiting.commands).includes('cine-pause'), true);
const stuck = held.advance(2, { meadowReady: false });
assert.equal(stuck.view.frame, timing.sceneSwapFrame);
assert.equal(stuck.view.phase, 'holding');
assert.equal(stuck.commands.length, 0);
const released = held.advance(0, { meadowReady: true });
assert.equal(released.view.phase, 'playing');
assert.equal(released.view.scene, 'meadow');
assert.equal(released.view.swapped, true);
assert.equal(released.view.frame, timing.sceneSwapFrame);
assert.equal(kinds(released.commands).includes('wind-fade'), true);
assert.equal(kinds(released.commands).includes('cine-resume'), true);
const finished = pump(held, timing.durationSec, { meadowReady: true });
assert.equal(finished.view.phase, 'done');
assert.equal(finished.view.frame, timing.lastFrame);
assert.equal(finished.view.hudVisible, true);
assert.equal(kinds(finished.commands).includes('wind-loop'), false);

const customPlay = model.createSailboatPlayback(custom);
customPlay.begin();
const tooSoon = pump(customPlay, 39 / custom.fps, { meadowReady: true });
assert.equal(customPlay.advance(0, { meadowReady: true, tap: true }).view.phase, 'playing');
assert.equal(tooSoon.view.frame, 39);
pump(customPlay, 1 / custom.fps, { meadowReady: true });
const customSkip = customPlay.advance(0, { meadowReady: true, tap: true });
assert.equal(customSkip.view.phase, 'skip-fade');
assert.equal(customSkip.commands[0].seconds, 0.5);

const background = model.createSailboatPlayback(timing);
background.begin();
const bgHold = pump(background, timing.durationSec, { meadowReady: false });
assert.equal(bgHold.view.phase, 'holding');
const hidden = background.advance(0, { meadowReady: false, background: true });
assert.equal(hidden.view.paused, true);
assert.equal(kinds(hidden.commands).includes('cine-stop'), true);
assert.equal(kinds(hidden.commands).includes('wind-stop'), true);
assert.equal(hidden.commands.find(command => command.kind === 'cine-stop').path, model.SAILBOAT_CINE_PATH);
const quiet = background.advance(1, { meadowReady: false, background: true });
assert.equal(quiet.view.frame, timing.sceneSwapFrame);
assert.equal(quiet.commands.length, 0);
const shown = background.advance(0, { meadowReady: false, background: false });
assert.equal(shown.view.paused, false);
assert.equal(shown.view.phase, 'holding');
assert.deepEqual(kinds(shown.commands), ['wind-loop']);
assert.equal(kinds(shown.commands).includes('cine-resume'), false);

const straight = model.createSailboatPlayback(timing, { startFov: 42 });
straight.begin();
let seenSwap = false;
let wind = false;
for (let i = 0; i < timing.frameCount + 2; i++) {
  const sample = straight.advance(1 / timing.fps, { meadowReady: true });
  if (sample.commands.some(command => command.kind === 'wind-loop')) wind = true;
  if (sample.view.frame >= timing.sceneSwapFrame) {
    assert.equal(sample.view.swapped, true);
    seenSwap = true;
  }
  if (sample.view.phase === 'done') {
    assert.equal(sample.view.frame, timing.lastFrame);
    break;
  }
}
assert.equal(seenSwap, true);
assert.equal(wind, false);
assert.equal(straight.advance(0, { meadowReady: true }).view.phase, 'done');
assert.equal(heldStart.view.shotId, timing.shots[0].id);

function componentDecorators(source) {
  return [...source.matchAll(/@(?:ccclass|_decorator\.ccclass)\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
}
function walkTs(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}
const scriptRoot = path.join(root, 'creator-build-project/assets/scripts');
const packed = [];
for (const file of walkTs(scriptRoot, [])) {
  const names = componentDecorators(fs.readFileSync(file, 'utf8'));
  if (names.length > 1) packed.push(path.relative(root, file) + ' ' + names.join(','));
}
assert.deepEqual(packed, [], 'one @ccclass Component per file');
assert.equal(fs.existsSync(path.join(scriptRoot, 'cine/SailboatTransitionPlayer.ts')), false);
for (const name of ['SailboatPrefabSlot', 'SailboatTransitionDriver']) {
  const file = path.join(scriptRoot, 'cine', name + '.ts');
  assert.deepEqual(componentDecorators(fs.readFileSync(file, 'utf8')), [name]);
  assert.equal(path.basename(file, '.ts'), name);
}
assert.match(fs.readFileSync(path.join(root, 'creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts'), 'utf8'), /from '\.\.\/cine\/SailboatTransitionDriver'/);

console.log('sailboat transition tests ok', JSON.stringify({
  frames: timing.frameCount, lastFrame: timing.lastFrame, fps: timing.fps,
  shots: timing.shots.map(shot => shot.startFrame),
  skipFrom: timing.skipEnabledFromFrame, swap: timing.sceneSwapFrame,
  cloud: timing.cloud, cine: model.SAILBOAT_CINE_FILE,
}));
