'use strict';
/** Strategy B / Mac 587b73d3: warmSampleStandUp fully stripped vs ac48372e.
 *  Prior tip kept warmSample off TransitionShaderWarm but Mac still FAIL setCamera 268 / board-bg 245.
 *  Standup warm reopens only on an isolated tip after gates return ≈0 (fb74d437). */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..','..');
const S=path.join(ROOT,'creator-build-project/assets/scripts');
const boot=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');
const ad=fs.readFileSync(path.join(S,'region/RegionJourneyAdapter.ts'),'utf8');
const cm=fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8');
const warm=fs.readFileSync(path.join(S,'region/TransitionShaderWarm.ts'),'utf8');
assert.doesNotMatch(boot,/warmSampleStandUp/);
assert.doesNotMatch(boot,/standup-warm-sample/);
assert.doesNotMatch(boot,/standUpWarmPrimed/);
assert.doesNotMatch(ad,/warmSampleStandUp/);
assert.doesNotMatch(cm,/起身段无整表清零重写/);
assert.match(cm,/MORPH_EPS/); // baseline EPS already in ac48372e; no standup-only change
assert.doesNotMatch(warm,/armStandupShaderBurst/);
assert.doesNotMatch(warm,/burstLeft/);
assert.doesNotMatch(boot,/armStandupShaderBurst/);
{const pb=boot.slice(boot.indexOf("if(action.kind==='stand')"),boot.indexOf("if(action.kind==='stand')")+400);
 assert.doesNotMatch(pb,/repairStates|requireDirectTrsStates|new AnimRig/);
 assert.doesNotMatch(pb,/warmSampleStandUp/);}
console.log(JSON.stringify({status:'PASS',strategy:'B_full_strip_warmSample_vs_ac48372e',deferred:'standup-warm isolated tip after gates≈0',hard_keep:['setCamera≈0','board-bg≈0','BalloonTransit','K.s1','TransitionShaderWarm==ac48372e']},null,1));
