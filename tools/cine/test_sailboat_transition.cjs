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

const model = new Function(stripTypeScriptTypes(fs.readFileSync(modelPath, 'utf8').replace(/^export /gm, ''), { mode: 'transform' }) + '\nreturn { parseSailboatTiming, parseSailboatTimingText, createSailboatPlayback, sailboatCoverAlpha, sailboatIslandActive, meadowRevealReady, SAILBOAT_WARM_FRAMES, SAILBOAT_CINE_FILE, SAILBOAT_CINE_PATH, SAILBOAT_CINE_BUNDLE, SAILBOAT_HOLD_FADE_DELAY_SEC, SAILBOAT_HOLD_FADE_SEC, SAILBOAT_HOLD_WIND_PATH, SAILBOAT_TIMING_RESOURCE, createSailboatStartGate, SAILBOAT_START_STILL_FRAMES, SAILBOAT_START_TIMEOUT_SEC, SAILBOAT_MAX_FRAME_DT };')();
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

assert.equal(crypto.createHash('sha256').update(rawText).digest('hex'), 'b443e5d1b32ab6177c019515d57737b06f9bc84e82517b169ebb4800ae5e2d21');
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
assert.equal(model.SAILBOAT_CINE_BUNDLE, 'region_island');
assert.equal(model.SAILBOAT_HOLD_FADE_DELAY_SEC, 0.25);
assert.equal(model.SAILBOAT_HOLD_FADE_SEC, 0.4);
assert.equal('SAILBOAT_HOLD_CINE_FADE_SEC' in model, false);
assert.equal(model.SAILBOAT_HOLD_WIND_PATH, 'audio_amb/amb_wind_soft_loop');
assert.match(fs.readFileSync(windPath, 'utf8'), /audio_amb\/amb_wind_soft_loop/);
assert.equal(fs.existsSync(path.join(root, 'creator-build-project/assets/resources/audio_amb/amb_wind_soft_loop.mp3')), true);
const cineFile = path.join(root, 'creator-build-project/assets/bundles/region_island', model.SAILBOAT_CINE_FILE);
const cineBytes = fs.readFileSync(cineFile);
assert.equal(cineBytes.length, 42256);
assert.equal(crypto.createHash('sha256').update(cineBytes).digest('hex'), '9556476eb292e56045a73c3945158522726a874005f339877f909a99f1028175');
const cineMeta = JSON.parse(fs.readFileSync(cineFile + '.meta', 'utf8'));
assert.equal(cineMeta.importer, 'audio-clip');
assert.equal(cineMeta.ver, '1.0.0');
assert.deepEqual(cineMeta.files, ['.json', '.mp3']);
assert.equal(cineMeta.userData.downloadMode, 0);
const cineDirMeta = JSON.parse(fs.readFileSync(path.join(root, 'creator-build-project/assets/bundles/region_island/audio_cine.meta'), 'utf8'));
assert.equal(cineDirMeta.importer, 'directory');
assert.equal(cineDirMeta.ver, '1.2.0');

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
assert.equal(earlyStart.commands[0].bundle, model.SAILBOAT_CINE_BUNDLE);
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
assert.equal(kinds(skipping.commands).includes('cine-stop'), false);
assert.ok(kinds(skipping.commands).indexOf('cine-fade') < kinds(skipping.commands).indexOf('wind-loop'));
const coveredReady = early.advance(timing.skipFadeSec, { meadowReady: true });
assert.equal(coveredReady.view.phase, 'skip-hold');
assert.equal(coveredReady.view.scene, 'meadow');
assert.equal(coveredReady.view.swapped, true);
assert.equal(coveredReady.view.meadowBlend, 1);
assert.equal(coveredReady.view.cloud, 1);
assert.equal(coveredReady.view.white, 1);
assert.equal(model.sailboatCoverAlpha(coveredReady.view), 1);
assert.equal(kinds(coveredReady.commands).includes('cine-stop'), false);
const landed = early.advance(0, { meadowReady: true });
assert.equal(landed.view.phase, 'done');
assert.equal(landed.view.frame, timing.skipLandingFrame);
assert.equal(landed.view.scene, 'meadow');
assert.equal(landed.view.hudVisible, true);
assert.equal(landed.view.cloud, 0);
assert.equal(landed.view.white, 0);
assert.equal(landed.view.boatAlong, 1);
assert.equal(model.sailboatCoverAlpha(landed.view), 0);
assert.equal(kinds(landed.commands).includes('wind-fade'), false);
assert.equal(kinds(landed.commands).includes('wind-stop'), false);
assert.equal(kinds(landed.commands).includes('cine-stop'), false);

const skipEarly = model.createSailboatPlayback(timing);
skipEarly.begin();
pump(skipEarly, timing.skipEnabledFromFrame / timing.fps, { meadowReady: false });
const skipTap = skipEarly.advance(0, { meadowReady: false, tap: true });
assert.equal(skipTap.commands.find(command => command.kind === 'cine-fade').seconds, timing.skipFadeSec);
assert.equal(kinds(skipTap.commands).includes('cine-stop'), false);
assert.ok(kinds(skipTap.commands).indexOf('cine-fade') < kinds(skipTap.commands).indexOf('wind-loop'));
const covered = skipEarly.advance(timing.skipFadeSec, { meadowReady: false });
assert.equal(covered.view.phase, 'skip-hold');
assert.equal(covered.view.scene, 'meadow');
assert.equal(covered.view.cloud, 1);
assert.equal(covered.view.white, 1);
assert.equal(covered.view.swapped, true);
assert.equal(covered.view.meadowBlend, 1);
assert.equal(model.sailboatCoverAlpha(covered.view), 1);
assert.equal(kinds(covered.commands).includes('wind-fade'), false);
assert.equal(kinds(covered.commands).includes('cine-stop'), false);
const still = skipEarly.advance(1, { meadowReady: false });
assert.equal(still.view.phase, 'skip-hold');
assert.equal(still.view.frame, covered.view.frame);
const afterLoad = skipEarly.advance(0, { meadowReady: true });
assert.equal(afterLoad.view.phase, 'done');
assert.equal(afterLoad.view.frame, timing.lastFrame);
assert.equal(afterLoad.view.scene, 'meadow');
assert.equal(afterLoad.view.hudVisible, true);
assert.equal(kinds(afterLoad.commands).includes('wind-fade'), false);
assert.equal(kinds(afterLoad.commands).includes('wind-stop'), false);
assert.equal(kinds(afterLoad.commands).includes('cine-stop'), false);

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
assert.equal(kinds(waiting.commands).includes('cine-pause'), false);
assert.equal(kinds(waiting.commands).includes('cine-stop'), false);
// pump stops at the hold; the sting is not faded yet.
assert.equal(kinds(waiting.commands).includes('cine-fade'), false);
const stuck = held.advance(2, { meadowReady: false });
assert.equal(stuck.view.frame, timing.sceneSwapFrame);
assert.equal(stuck.view.phase, 'holding');
const holdFade = stuck.commands.find(command => command.kind === 'cine-fade');
assert.equal(holdFade.seconds, model.SAILBOAT_HOLD_FADE_SEC);
assert.equal(held.advance(1, { meadowReady: false }).commands.length, 0);
const released = held.advance(0, { meadowReady: true });
assert.equal(kinds(released.commands).includes('cine-restore'), false, 'a finished hold fade is not restored');
assert.equal(released.view.phase, 'playing');
assert.equal(released.view.scene, 'meadow');
assert.equal(released.view.swapped, true);
assert.equal(released.view.frame, timing.sceneSwapFrame);
assert.equal(kinds(released.commands).includes('wind-fade'), false);
assert.equal(kinds(released.commands).includes('wind-stop'), false);
assert.equal(kinds(released.commands).includes('cine-resume'), false);
assert.equal(kinds(released.commands).includes('cine-play'), false);
const finished = pump(held, timing.durationSec, { meadowReady: true });
assert.equal(finished.view.phase, 'done');
assert.equal(finished.view.frame, timing.lastFrame);
assert.equal(finished.view.hudVisible, true);
assert.equal(kinds(finished.commands).includes('wind-loop'), false);
assert.equal(kinds(finished.commands).includes('wind-fade'), false);

const customPlay = model.createSailboatPlayback(custom);
customPlay.begin();
const tooSoon = pump(customPlay, 39 / custom.fps, { meadowReady: true });
assert.equal(customPlay.advance(0, { meadowReady: true, tap: true }).view.phase, 'playing');
assert.equal(tooSoon.view.frame, 39);
pump(customPlay, 1 / custom.fps, { meadowReady: true });
const customSkip = customPlay.advance(0, { meadowReady: true, tap: true });
assert.equal(customSkip.view.phase, 'skip-fade');
assert.equal(customSkip.commands[0].seconds, 0.5);
assert.equal(kinds(customSkip.commands)[1], 'wind-loop');
const customHold = model.createSailboatPlayback(custom);
customHold.begin();
let customHeld = null;
for (let left = custom.durationSec + 1; left > 1e-8;) {
  customHeld = customHold.advance(Math.min(1 / custom.fps, left), { meadowReady: false });
  left -= 1 / custom.fps;
  if (customHeld.view.phase === 'holding') break;
}
assert.equal(customHeld.view.phase, 'holding');
assert.equal(kinds(customHeld.commands).includes('cine-fade'), false);
assert.equal(kinds(customHeld.commands).includes('wind-loop'), true);

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
let windFrame = -1;
for (let i = 0; i < timing.frameCount + 2; i++) {
  const sample = straight.advance(1 / timing.fps, { meadowReady: true });
  assert.equal(kinds(sample.commands).includes('cine-stop'), false);
  assert.equal(kinds(sample.commands).includes('cine-fade'), false);
  assert.equal(kinds(sample.commands).includes('wind-fade'), false);
  if (sample.commands.some(command => command.kind === 'wind-loop')) {
    assert.equal(windFrame, -1);
    assert.equal(sample.view.phase, 'done');
    windFrame = sample.view.frame;
  }
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
assert.equal(windFrame, timing.lastFrame);
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
assert.equal(model.SAILBOAT_WARM_FRAMES >= 2, true);
assert.equal(model.meadowRevealReady(model.SAILBOAT_WARM_FRAMES - 1), false);
assert.equal(model.meadowRevealReady(model.SAILBOAT_WARM_FRAMES), true);
const layoutPath = path.join(scriptRoot, 'cine/SailboatCloudLayout.ts');
const layout = new Function(stripTypeScriptTypes(fs.readFileSync(layoutPath, 'utf8').replace(/^export /gm, ''), { mode: 'transform' }) + '\nreturn { SAILBOAT_CLOUD_PUFFS, cloudBankCovers, cloudShownAlpha };')();
assert.ok(layout.SAILBOAT_CLOUD_PUFFS.length >= 7);
assert.equal(layout.cloudBankCovers(1), true);
assert.equal(layout.cloudBankCovers(0.5), false);
assert.ok(layout.cloudShownAlpha(0.2) > 0.2);
assert.equal(layout.cloudShownAlpha(0), 0);
assert.equal(layout.cloudShownAlpha(1), 1);
const driverSrc = fs.readFileSync(path.join(scriptRoot, 'cine/SailboatTransitionDriver.ts'), 'utf8');
const warmupSrc = fs.readFileSync(path.join(scriptRoot, 'cine/SailboatMeadowWarmup.ts'), 'utf8');
const cloudSrc = fs.readFileSync(path.join(scriptRoot, 'cine/SailboatCloudLayer.ts'), 'utf8');
assert.equal(driverSrc.includes('SailboatCloudCover'), false);
assert.equal(driverSrc.includes('meadowReady: !!this.meadowPrefab'), false);
assert.match(driverSrc, /meadowReady: this\.warmed/);
assert.match(driverSrc, /playCineSlot\(command\.path, command\.bundle\)/);
assert.match(driverSrc, /Present the covered skip frame/);
assert.match(driverSrc, /sailboatIslandActive/);
assert.equal(driverSrc.includes('islandRoot.active = this.islandWasActive'), false);
{
  // Skip landing and the normal meadow -> board handoff. Once the meadow owns the
  // frame, including the settled handoff, the home island root stays inactive.
  function traceHandoff(tap) {
    const play = model.createSailboatPlayback(timing);
    let sample = play.begin();
    let tapped = false;
    const seen = [];
    const note = (view, handoff) => {
      const active = model.sailboatIslandActive(view.phase, view.swapped, handoff, true);
      const owned = view.swapped || view.phase === 'done' || view.phase === 'skip-hold' || handoff === 'settled';
      if (owned) assert.equal(active, false, view.phase + '/' + handoff);
      seen.push(active);
    };
    note(sample.view, 'live');
    for (let n = 0; n < 500 && sample.view.phase !== 'done'; n++) {
      const press = tap && !tapped && sample.view.frame >= timing.skipEnabledFromFrame && sample.view.phase === 'playing';
      if (press) tapped = true;
      sample = play.advance(1 / timing.fps, { meadowReady: true, tap: press });
      note(sample.view, 'live');
    }
    assert.equal(sample.view.phase, 'done');
    assert.equal(sample.view.scene, 'meadow');
    note(sample.view, 'settled');
    assert.equal(seen.includes(false), true);
    return sample.view;
  }
  const skipped = traceHandoff(true);
  assert.equal(skipped.phase, 'done');
  const played = traceHandoff(false);
  assert.equal(played.frame, timing.lastFrame);
  assert.equal(model.sailboatIslandActive('playing', false, 'live', true), true);
  assert.equal(model.sailboatIslandActive('skip-hold', true, 'live', true), false);
  assert.equal(model.sailboatIslandActive('done', true, 'settled', true), false);
  assert.equal(model.sailboatIslandActive('done', true, 'aborted', true), true);
  assert.equal(model.sailboatIslandActive('holding', false, 'live', true), true);
  const flowSrc = fs.readFileSync(path.join(scriptRoot, 'world-r1/WorldFlowCore.ts'), 'utf8');
  const restoreAt = flowSrc.indexOf('private restore()');
  const restore = flowSrc.slice(restoreAt, flowSrc.indexOf('private invalidate()'));
  assert.ok(restore.indexOf('if(hideWorld)this.world.setLayers(NONE)') < restore.indexOf('this.world.setCamera'), 'hide island before the island camera snap');
  const worldSrc = fs.readFileSync(path.join(scriptRoot, 'world-r1/WorldFlowComponent.ts'), 'utf8');
  assert.match(worldSrc, /dropSailboatMeadow/);
  assert.match(worldSrc, /SailboatMeadowMount/);
  assert.match(worldSrc, /if\(!worldOn\)model\.active=false/);
  console.log('island handoff hidden: ok');
}
assert.match(driverSrc, /syncSailboatMeadowNight/);
assert.match(fs.readFileSync(path.join(scriptRoot, 'cine/SailboatMeadowWarmup.ts'), 'utf8'), /applyMeadowNightSky/);
assert.match(driverSrc, /stageMeadowReveal/);
assert.equal(driverSrc.includes('mountUnderCloud'), false);
assert.match(driverSrc, /mountRegion\(REGIONS\.meadow, this\.meadowPrefab as Prefab, parent, true\)/);
// Stage once per rendered frame, after the substep loop, before warm counting.
assert.match(driverSrc, /this\.stageMeadow\(this\.lastView\);\n\s*if \(this\.lastView\) this\.noteWarmth/);
assert.equal(/private apply\([\s\S]*?\n  \}/.exec(driverSrc)[0].includes('stageMeadow'), false);
assert.match(driverSrc, /\[sailboat\] meadow warm/);
// Night sky (world clear colour) only under the shut bank, never in the inactive prep.
const stageFn = /export function stageMeadowReveal[\s\S]*?\n\}/.exec(warmupSrc)[0];
assert.equal(stageFn.includes('syncSailboatMeadowNight'), false);
assert.equal(stageFn.includes('applyMeadowNightSky'), false);
assert.match(/openRoot: [\s\S]*?syncSailboatMeadowNight/.exec(driverSrc)[0], /root\.active = true/);
assert.match(fs.readFileSync(path.join(scriptRoot, 'region/RegionLoader.ts'), 'utf8'), /if\(inactive\)model\.active=false;\n  if\(def\.ambientClips/);
{
  // r4: frame-78 mount stalled 183 ms; the clamped dt jumped past sceneSwapFrame 81 before 2 warm frames.
  const stagerSrc = fs.readFileSync(path.join(scriptRoot, 'cine/SailboatMeadowStager.ts'), 'utf8');
  assert.equal((stagerSrc.match(/@ccclass\(/g) || []).length, 0);
  assert.equal(/from 'cc'/.test(stagerSrc), false);
  const st = new Function(stripTypeScriptTypes(stagerSrc.replace(/^export /gm, ''), { mode: 'transform' }) + '\nreturn { createMeadowStager, sliceByWeight, SAILBOAT_STAGE_INSTANTIATE_FROM_FRAME, SAILBOAT_STAGE_SLICES };')();
  assert.equal(st.SAILBOAT_STAGE_INSTANTIATE_FROM_FRAME, raw.events.cloudCover.inStartFrame);
  assert.ok(st.SAILBOAT_STAGE_INSTANTIATE_FROM_FRAME < raw.events.cloudCover.fullFrom);
  assert.deepEqual(st.sliceByWeight([{ child: 'a', weight: 5 }, { child: 'b', weight: 1 }, { child: 'c', weight: 4 }, { child: 'd', weight: 1 }], 2), [['a', 'd'], ['b', 'c']]);
  assert.deepEqual(st.sliceByWeight([{ child: 'a', weight: 1 }], 3), [['a']]);
  assert.deepEqual(st.sliceByWeight([], 2), [[]]);
  const run = (opts) => {
    const ev = [], logs = []; let clock = 0;
    const stager = st.createMeadowStager({
      instantiate: () => { ev.push('inst'); return { active: true, kids: ['k1', 'k2', 'k3'] }; },
      prepare: root => { ev.push('prep:' + root.active); return root.kids.map((k, i) => ({ child: k, weight: i + 1 })); },
      openRoot: (root, kids) => { ev.push('open:' + kids.join(',')); root.active = true; },
      activate: kids => ev.push('act:' + kids.join(',')),
      now: () => (clock += 3),
      log: m => logs.push(m),
    }, opts);
    return { stager, ev, logs };
  };
  // Simulate the r4 normal flow at 60 Hz: 30 fps timeline, prefab ready from the start.
  const cover = f => f >= raw.events.cloudCover.fullFrom && f <= raw.events.cloudCover.fullTo;
  const { stager, ev, logs } = run();
  let warm = 0, readyAt = null, perFrame = [];
  for (let k = 0; k < 400 && readyAt === null; k++) {
    const frame = Math.floor(k / 2);
    const before = ev.length;
    stager.step({ frame, covered: cover(frame), prefabReady: true });
    perFrame.push(ev.length - before);
    if (stager.mounted && cover(frame)) { warm += 1; if (warm >= model.SAILBOAT_WARM_FRAMES) readyAt = frame; }
    if (frame < raw.events.cloudCover.inStartFrame) assert.equal(ev.length, 0, 'nothing before cloud closing');
    if (!cover(frame)) assert.equal(ev.some(e => e.startsWith('open') || e.startsWith('act')), false, 'no activation before the bank shuts at ' + frame);
  }
  assert.ok(readyAt !== null && readyAt < raw.events.sceneSwapFrame, 'warmed by frame ' + readyAt + ' before swap ' + raw.events.sceneSwapFrame);
  assert.ok(perFrame.every(n => n <= 2), 'one stage per frame (open+first slice counts 2): ' + perFrame.join(''));
  assert.deepEqual(ev, ['inst', 'prep:true', 'open:k1,k2,k3', 'act:k3', 'act:k1,k2']);
  assert.equal(logs.length, 4);
  for (const l of logs) assert.match(l, /^\[sailboat\] meadow (instantiate|prepare|activate \d\/2) frame \d+ ms \d+$/);
  assert.match(logs[0], /instantiate frame 66 /);
  assert.match(logs[2], /activate 1\/2 frame 78 /);
  // Late prefab under cover still mounts (hold fallback covers the remaining frames).
  const late = run();
  late.stager.step({ frame: 40, covered: false, prefabReady: false });
  assert.equal(late.ev.length, 0);
  late.stager.step({ frame: 81, covered: true, prefabReady: true });
  late.stager.step({ frame: 81, covered: true, prefabReady: true });
  late.stager.step({ frame: 81, covered: true, prefabReady: true });
  late.stager.step({ frame: 81, covered: true, prefabReady: true });
  assert.equal(late.stager.mounted, true);
  // Prepared but bank open: waits.
  const wait = run();
  wait.stager.step({ frame: 70, covered: false, prefabReady: true });
  wait.stager.step({ frame: 70, covered: false, prefabReady: true });
  assert.equal(wait.stager.step({ frame: 71, covered: false, prefabReady: true }), false);
  assert.equal(wait.stager.phase, 'prepared');
  // A throwing stage marks failed and does not retry.
  const bad = st.createMeadowStager({ instantiate: () => { throw Error('boom'); }, prepare: () => [], openRoot() {}, activate() {}, now: () => 0, log() {} });
  assert.throws(() => bad.step({ frame: 70, covered: true, prefabReady: true }), /boom/);
  assert.equal(bad.phase, 'failed');
  assert.equal(bad.step({ frame: 71, covered: true, prefabReady: true }), false);
}
assert.equal((driverSrc.match(/@ccclass\(/g) || []).length, 1);
assert.match(warmupSrc, /configureMeadowVertexColors/);
assert.match(warmupSrc, /SphereLight/);
assert.equal((warmupSrc.match(/@ccclass\(/g) || []).length, 0);
assert.match(cloudSrc, /SailboatCloudLayer/);
assert.equal(cloudSrc.includes('SailboatCloudCover'), false);
assert.equal((cloudSrc.match(/@ccclass\(/g) || []).length, 0);
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

// r3 (运镜bot): procedural cloud texture, staggered dissolve, early meadow prefetch.
{
  const texPath = path.join(root, 'creator-build-project/assets/scripts/cine/SailboatCloudTexture.ts');
  const tex = new Function(stripTypeScriptTypes(fs.readFileSync(texPath, 'utf8').replace(/^export /gm, ''), { mode: 'transform' }) + '\nreturn { sailboatCloudPixels, puffDissolveAlpha, puffPlacement, cloudNightTint, SAILBOAT_CLOUD_TEX_SIZE };')();
  const n = tex.SAILBOAT_CLOUD_TEX_SIZE;
  const px = tex.sailboatCloudPixels(n, 11);
  assert.equal(px.length, n * n * 4);
  const at = (x, y) => (y * n + x) * 4;
  assert.equal(px[at(n / 2, n / 2) + 3], 255, 'cloud core is opaque');
  assert.equal(px[at(0, 0) + 3], 0, 'cloud corner is clear');
  let edgeMin = 255, edgeMax = 0, lumMin = 255, lumMax = 0;
  for (let a = 0; a < 64; a++) {
    const t = a / 64 * Math.PI * 2, r = 0.72 * n / 2;
    const i = at(Math.round(n / 2 + Math.cos(t) * r), Math.round(n / 2 + Math.sin(t) * r));
    edgeMin = Math.min(edgeMin, px[i + 3]); edgeMax = Math.max(edgeMax, px[i + 3]);
  }
  for (let y = 40; y < 88; y++) for (let x = 40; x < 88; x++) { lumMin = Math.min(lumMin, px[at(x, y)]); lumMax = Math.max(lumMax, px[at(x, y)]); }
  assert.ok(edgeMax - edgeMin > 60, 'edge is ragged (fBm), not a clean disc: ' + edgeMin + '..' + edgeMax);
  assert.ok(lumMax - lumMin > 12, 'core has billow shading, not a flat plate');
  for (const rank of [0, 0.3, 1]) {
    assert.equal(tex.puffDissolveAlpha(1, rank), 1);
    assert.equal(tex.puffDissolveAlpha(0, rank), 0);
    let prev = 0;
    for (let c = 0; c <= 1.0001; c += 0.01) { const v = tex.puffDissolveAlpha(Math.min(1, c), rank); assert.ok(v >= prev - 1e-9); prev = v; }
  }
  assert.ok(tex.puffDissolveAlpha(0.3, 0) > tex.puffDissolveAlpha(0.3, 1), 'billows lead, fill lags');
  assert.deepEqual(tex.puffPlacement(0.4, 0.2, 1, 1), { x: 0.4, y: 0.2, scale: 1 }, 'a shut puff sits on its authored spot');
  assert.ok(tex.puffPlacement(0.4, 0, 1, 0).x > 0.7, 'an arriving puff slides in from outside');
  assert.deepEqual(tex.cloudNightTint([255, 255, 255], 0), [255, 255, 255]);
  assert.ok(tex.cloudNightTint([255, 255, 255], 1)[0] < 120, 'night clouds are moonlit, not white');
  for (const p of layout.SAILBOAT_CLOUD_PUFFS) assert.ok(p.length === 7 && p[6] >= 0 && p[6] <= 1, 'every puff has a dissolve rank');
  const cloudSrc2 = fs.readFileSync(path.join(scriptRoot, 'cine/SailboatCloudLayer.ts'), 'utf8');
  assert.match(cloudSrc2, /USE_TEXTURE: true/);
  assert.match(cloudSrc2, /puffDissolveAlpha/);
  const pre = fs.readFileSync(path.join(scriptRoot, 'cine/SailboatMeadowPrefetch.ts'), 'utf8');
  assert.equal((pre.match(/@ccclass\(/g) || []).length, 0);
  assert.match(fs.readFileSync(path.join(scriptRoot, 'cine/SailboatTransitionDriver.ts'), 'utf8'), /prefetchedSailboatMeadow\(\)/);
  assert.match(fs.readFileSync(path.join(scriptRoot, 'world-r1/WorldFlowComponent.ts'), 'utf8'), /prefetchSailboatMeadow\(\)/);
  // Cover ramps are >= 0.4 s each way (r2: 6-frame ramp read as a hard cut).
  assert.ok((timing.cloud.fullFrom - timing.cloud.inStartFrame) / timing.fps >= 0.4 - 1e-9);
  assert.ok((timing.cloud.outEndFrame - timing.cloud.fullTo) / timing.fps >= 0.4 - 1e-9);
  assert.equal(timing.durationSec, 5.2);
}
console.log('sailboat r3 cloud texture/dissolve/prefetch: ok');

// r3 (Mac): sting + countdown started ~1.78 s before the boat set sail, while the exit camera was still easing.
{
  const gate = model.createSailboatStartGate();
  const cam = (z, f = 0) => ({ position: [0, 20, z], forward: [0, -0.5, -0.86 + f] });
  // exit camera still easing: 1.78 s of motion must not open the gate
  let t = 0;
  for (let i = 0; i < 107; i++) { t += 1 / 60; assert.equal(gate.feed(1 / 60, cam(35 + (107 - i) * 0.01)), false, 'gate open while camera moves at ' + t.toFixed(2)); }
  // settles: opens after exactly SAILBOAT_START_STILL_FRAMES still frames (+1 reference frame)
  let opened = -1;
  for (let i = 0; i < 10 && opened < 0; i++) if (gate.feed(1 / 60, cam(35))) opened = i;
  assert.equal(opened, model.SAILBOAT_START_STILL_FRAMES);
  assert.equal(gate.reason, 'settled');
  assert.ok(opened / 60 <= 2 / timing.fps, 'sting start within 2 timing frames of settle');
}
{ // hitches do not count as still frames; timeout fallback still starts the transition
  const gate = model.createSailboatStartGate();
  const still = { position: [1, 2, 3], forward: [0, 0, -1] };
  for (let i = 0; i < 20; i++) assert.equal(gate.feed(0.2, still) && gate.reason === 'settled', false);
  assert.equal(gate.open, true); assert.equal(gate.reason, 'timeout');
  assert.ok(gate.waitedSec >= model.SAILBOAT_START_TIMEOUT_SEC - 1e-9);
}
{ // the cloud-hold fade can only engage at the scene-swap frame, under full cover, never earlier
  for (const step of [1 / 60, 1 / 30, 1 / 20, 0.1]) {
    const playback = model.createSailboatPlayback(timing);
    playback.begin();
    let fadeFrame = -1; let view = null;
    for (let i = 0; i < 400 && fadeFrame < 0; i++) {
      const s = playback.advance(step, { meadowReady: false });
      view = s.view;
      if (s.commands.some(c => c.kind === 'cine-fade')) fadeFrame = view.frame;
    }
    assert.equal(fadeFrame, timing.sceneSwapFrame, 'hold fade at swap frame (step ' + step + ')');
    assert.equal(view.cloud, 1);
    assert.ok(fadeFrame >= timing.cloud.fullFrom);
  }
}
{ // ready meadow: 5.2 s from begin() to done, no hold, at any frame rate the driver's cap allows
  assert.ok(model.SAILBOAT_MAX_FRAME_DT >= 0.2);
  for (const step of [1 / 60, 1 / 30, 1 / 24]) {
    const playback = model.createSailboatPlayback(timing);
    playback.begin();
    let t = 0; let held = false; let v = null;
    while (t < 10) { const s = playback.advance(step, { meadowReady: true }); t += step; v = s.view; if (v.holding) held = true; if (v.phase === 'done') break; }
    assert.equal(held, false);
    assert.ok(Math.abs(t - timing.durationSec) <= step + 1e-6, 'duration ' + t);
  }
}
console.log('r3 start gate / hold timing: ok');

// Cloud-hold sting guard: short hold no fade; long hold fades after 250 ms over 0.4 s; leaving mid-fade restores.
function holdAt(dtFrame) {
  const p = model.createSailboatPlayback(timing);
  p.begin();
  let s = null;
  for (let left = timing.durationSec + 1; left > 1e-8; left -= dtFrame) {
    s = p.advance(dtFrame, { meadowReady: false });
    if (s.view.phase === 'holding') break;
  }
  assert.equal(s.view.phase, 'holding');
  assert.equal(kinds(s.commands).includes('cine-fade'), false);
  return p;
}
{
  const p = holdAt(1 / 60);
  let all = [];
  for (let t = 0; t < 0.24; t += 1 / 60) all = all.concat(p.advance(1 / 60, { meadowReady: false }).commands);
  assert.equal(kinds(all).includes('cine-fade'), false, 'no fade within 250 ms of hold');
  const out = p.advance(1 / 60, { meadowReady: true });
  assert.equal(kinds(out.commands).includes('cine-restore'), false);
  assert.equal(kinds(out.commands).includes('cine-stop'), false);
  const rest = [];
  let s = out;
  for (let i = 0; i < 600 && s.view.phase !== 'done'; i++) { s = p.advance(1 / 60, { meadowReady: true }); rest.push(...s.commands); }
  assert.equal(kinds(rest).some(k => k.startsWith('cine-')), false, 'sting plays out untouched');
  console.log('PASS short hold (<250ms) never fades the sting');
}
{
  const p = holdAt(1 / 60);
  let fadeAt = null; let t = 0;
  for (let i = 0; i < 60; i++) {
    const s = p.advance(1 / 60, { meadowReady: false });
    t += 1 / 60;
    const f = s.commands.find(c => c.kind === 'cine-fade');
    if (f) { assert.equal(fadeAt, null); fadeAt = t; assert.equal(f.seconds, 0.4); }
  }
  assert.ok(fadeAt > 0.25 && fadeAt <= 0.25 + 1 / 60 + 1e-9, 'fade starts right after 250 ms: ' + fadeAt);
  console.log('PASS long hold fades after 250ms over 0.4s');
}
{
  const p = holdAt(1 / 60);
  let faded = false;
  for (let i = 0; i < 16 + 12; i++) faded = p.advance(1 / 60, { meadowReady: false }).commands.some(c => c.kind === 'cine-fade') || faded;
  assert.ok(faded);
  const out = p.advance(0, { meadowReady: true });
  assert.deepEqual(kinds(out.commands).filter(k => k.startsWith('cine-')), ['cine-restore']);
  assert.equal(out.view.swapped, true);
  // after restore, a tap skip can fade it again (state is playing)
  const tap = p.advance(0, { meadowReady: true, tap: true });
  assert.equal(tap.commands.find(c => c.kind === 'cine-fade').seconds, timing.skipFadeSec);
  console.log('PASS leaveHold mid-fade restores the sting');
}
{
  const p = holdAt(1 / 60);
  const s = p.advance(0.1, { meadowReady: false, tap: true });
  assert.equal(s.view.phase, 'skip-fade');
  assert.equal(s.commands.find(c => c.kind === 'cine-fade').seconds, timing.skipFadeSec);
  const more = p.advance(0.5, { meadowReady: false });
  assert.equal(kinds(more.commands).includes('cine-fade'), false);
  console.log('PASS skip during hold keeps the 0.3s skip fade only');
}
