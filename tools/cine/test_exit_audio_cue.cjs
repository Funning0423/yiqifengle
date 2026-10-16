'use strict';
// Exit shot sound wiring (Voice Bot B5.3 convention). Model + static wiring checks; not a listening test.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const src = fs.readFileSync('creator-build-project/assets/scripts/cine/ExitAudioCue.ts', 'utf8');
const m = { exports: {} };
new Function('module', 'exports', stripTypeScriptTypes(src, { mode: 'transform' }).replace(/^export /gm, '') +
  '\nmodule.exports={createExitAudioCue,EXIT_AUDIO_PATH,EXIT_AUDIO_BUNDLE,EXIT_AUDIO_SKIP_FADE_S};')(m, m.exports);
const { createExitAudioCue, EXIT_AUDIO_PATH, EXIT_AUDIO_BUNDLE, EXIT_AUDIO_SKIP_FADE_S } = m.exports;
let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('ok', name); };
const kinds = c => c.map(x => x.kind + (x.seconds !== undefined ? ':' + x.seconds : ''));
const exitRun = cue => ['home', 'standing', 'turning-out', 'walking-out', 'opening-door', 'crossing-out'].map(s => cue.state(s));

t('frame 0: play on entering standing, from region_island', () => {
  const cue = createExitAudioCue(); assert.deepEqual(cue.state('home'), []);
  const c = cue.state('standing'); assert.deepEqual(c, [{ kind: 'play', path: EXIT_AUDIO_PATH, bundle: EXIT_AUDIO_BUNDLE }]);
  assert.equal(EXIT_AUDIO_BUNDLE, 'region_island'); assert.equal(EXIT_AUDIO_PATH, 'audio_cine/sfx_exit_outbound');
  for (const s of ['turning-out', 'walking-out', 'opening-door', 'crossing-out']) assert.deepEqual(cue.state(s), []);
});
t('natural end at island: no fade, no stop', () => {
  const cue = createExitAudioCue(); exitRun(cue); assert.deepEqual(cue.state('island'), []); assert.equal(cue.playing, false);
  assert.deepEqual(cue.skip(), []); assert.deepEqual(cue.background(), []);
});
t('skip: 0.3 s fade + releaseExitDuck, once', () => {
  const cue = createExitAudioCue(); exitRun(cue); assert.equal(EXIT_AUDIO_SKIP_FADE_S, 0.3);
  assert.deepEqual(kinds(cue.skip()), ['fade:0.3', 'release-duck']); assert.deepEqual(cue.skip(), []); assert.deepEqual(cue.state('island'), []);
});
t('cancel/error mid-exit counts as skip', () => {
  for (const s of ['home', 'error', 'disposed']) { const cue = createExitAudioCue(); exitRun(cue); assert.deepEqual(kinds(cue.state(s)), ['fade:0.3', 'release-duck']); }
});
t('background: stop + release, later paused state adds nothing', () => {
  const cue = createExitAudioCue(); exitRun(cue);
  assert.deepEqual(kinds(cue.background()), ['stop', 'release-duck']); assert.deepEqual(cue.state('paused'), []); assert.deepEqual(cue.background(), []);
});
t('a second exit plays again from frame 0', () => {
  const cue = createExitAudioCue(); exitRun(cue); cue.state('island'); cue.state('walking-home'); cue.state('home');
  assert.equal(cue.state('standing')[0].kind, 'play');
});
t('no commands outside the exit (does not touch the sailboat sting slot)', () => {
  const cue = createExitAudioCue(); for (const s of ['island', 'level-loading', 'level']) assert.deepEqual(cue.state(s), []);
  assert.deepEqual(cue.skip(), []); assert.deepEqual(cue.background(), []);
});
const wf = fs.readFileSync('creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts', 'utf8');
const drv = fs.readFileSync('creator-build-project/assets/scripts/cine/SailboatTransitionDriver.ts', 'utf8');
t('WorldFlowComponent feeds every state, hides before flow.hide, maps commands', () => {
  assert.match(wf, /onChange:s=>\{[^}]*this\.applyExitAudio\(this\.exitAudio\.state\(s\.state\)\)/);
  assert.match(wf, /private onHide\(\):void \{this\.applyExitAudio\(this\.exitAudio\.background\(\)\);[^\n]*this\.flow\?\.hide\(\)/);
  assert.match(wf, /c\.kind==='release-duck'\)\{WindAudio\.releaseExitDuck\(\)/);
  assert.match(wf, /playCineSlot\(c\.path,c\.bundle\)/); assert.match(wf, /fadeCineSlot\(c\.seconds\)/); assert.match(wf, /stopCineSlot\(\)/);
});
t('sailboat gate open releases the duck', () => {
  const i = drv.indexOf("console.log('[sailboat] gate open'"), j = drv.indexOf('this.apply(this.playback.begin())');
  assert.ok(i > 0 && j > i && drv.slice(i, j).includes('WindAudio.releaseExitDuck()'));
});
t('mp3 + .meta live in region_island bundle', () => {
  const d = 'creator-build-project/assets/bundles/region_island/audio_cine/';
  assert.ok(fs.existsSync(d + 'sfx_exit_outbound.mp3') && fs.existsSync(d + 'sfx_exit_outbound.mp3.meta'));
  const b = JSON.parse(fs.readFileSync('creator-build-project/assets/bundles/region_island.meta', 'utf8'));
  assert.equal(b.userData.isBundle, true);
  assert.ok(!fs.existsSync('creator-build-project/assets/resources/audio_cine/sfx_exit_outbound.mp3'));
});
console.log(`exit audio cue: ${pass}/${pass} passed`);
