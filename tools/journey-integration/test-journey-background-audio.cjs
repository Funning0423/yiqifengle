'use strict';
// Journey cutscene audio across a background trip, now that the cutscene resumes by itself on return (2c12565).
// What the island→lakeside journey actually sounds on this line: no cue/voice track and no cue timing.json (the only
// timeline track, audio_cine/sfx_exit_outbound, belongs to the home exit and has its own restart rule), so the sound
// that must survive is the bed: amb_lake_loop on the arrival stretch (+ wind/waves/BGM loops in GameAudio, paused/resumed
// by suspend('hidden')). This locks: the lake loop is PAUSED (position kept, never stopped) while hidden, resumes from
// that position once the auto-resumed cutscene is back on the arrival stretch (offset 0 ms vs its pre-hide position),
// never two sources at once outside the loop crossfade, at several hide points incl. mid-crossfade. Also a tripwire:
// a journey cue track or cue timing.json added later must come with timeline-synced resume (this test then fails).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const {LAKE_AMB,LakeAmbienceCore,lakeAmbienceWanted}=H.load(S+'audio/LakeAmbienceCore.ts');
function src(name){return {name,volume:0,playing:false,currentTime:0,plays:0,stops:0,play(){this.playing=true;this.plays++;},pause(){this.playing=false;},stop(){this.playing=false;this.currentTime=0;this.stops++;}};}
const DT=1/60;
const run=(hideAtS,hiddenS)=>{
 const a=src('a'),b=src('b'),core=new LakeAmbienceCore(a,b);core.ready=true;
 let snap={state:'region-travel',hidden:false,needsResume:false,journey:{target:'lakeside',phase:'arrival'}},hidden=false;
 const probe=()=>({state:snap.state,journeyTarget:snap.journey?.target,journeyPhase:snap.journey?.phase});
 const frame=(canSound=!hidden)=>{core.step(DT,lakeAmbienceWanted(probe()),canSound,1);for(const s of [a,b])if(s.playing)s.currentTime+=DT;
  const both=a.playing&&b.playing;if(both)assert(core.diagnostics().xfading,'two lake sources only inside the loop crossfade');};
 for(let t=0;t<hideAtS;t+=DT)frame();
 const pos=()=>[a,b].map(s=>+s.currentTime.toFixed(6)),before=pos(),playingBefore=[a.playing,b.playing],stopsBefore=a.stops+b.stops;
 // wx.onHide: GameAudio.onHide -> quietAmbience('hide') -> core.quiet(); WorldFlow.hide(): state paused, needsResume.
 core.quiet();hidden=true;snap={state:'paused',hidden:true,needsResume:true,journey:{target:'lakeside',phase:'paused'}};
 for(let t=0;t<hiddenS;t+=DT)frame(false);
 assert(!a.playing&&!b.playing,'silent while hidden');assert.deepEqual(pos(),before,'paused, not stopped: position kept while hidden');assert.equal(a.stops+b.stops,stopsBefore,'no stop() on hide');
 // wx.onShow: shown but still paused for one frame, then the Boot auto-resumes the cutscene (journey-cutscene-ui locks that).
 hidden=false;snap={state:'paused',hidden:false,needsResume:true,journey:{target:'lakeside',phase:'paused'}};frame();
 snap={state:'region-travel',hidden:false,needsResume:false,journey:{target:'lakeside',phase:'arrival'}};
 const resumed=[];let first=null;for(let t=0;t<2;t+=DT){const p0=pos();frame();if(first===null&&(a.playing||b.playing)){first=p0;}resumed.push(a.playing||b.playing);}
 assert(resumed.some(Boolean),'lake loop sounds again after the return');
 // Offset: the resumed source picks up exactly where it was paused (no restart from 0, no skip).
 for(let i=0;i<2;i++)if(playingBefore[i])assert(Math.abs(first[i]-before[i])*1000<=50,'resume offset ≤ 50 ms: source '+i+' '+first[i]+' vs '+before[i]);
 assert.equal(a.stops+b.stops,stopsBefore+(core.diagnostics().xfading?0:(playingBefore[0]&&playingBefore[1]?1:0)),'no restart: only the crossfade handover may stop a source');
 for(let t=0;t<LAKE_AMB.fadeInS+.5;t+=DT)frame();assert(Math.abs(core.diagnostics().heard-LAKE_AMB.maxVol)<1e-6,'back to full level after the fade-in');
 return {hideAtS,hiddenS,positionAtHide:before,positionOnResume:first,offsetMs:Math.max(...[0,1].filter(i=>playingBefore[i]).map(i=>Math.abs(first[i]-before[i])*1000))};
};
const cases=[run(2,5),run(9.5,1),run(LAKE_AMB.loopS+.05,3),run(LAKE_AMB.loopS+LAKE_AMB.encoderDelayS+.08,0.5),run(30,10)];
// Muted / gated: no sound and no position drift while ambience cannot play (GameAudio.canPlayAmbience covers mute + background).
{const a=src('a'),b=src('b'),c=new LakeAmbienceCore(a,b);c.ready=true;for(let i=0;i<120;i++){c.step(DT,true,true,1);if(a.playing)a.currentTime+=DT;}const p=a.currentTime;for(let i=0;i<120;i++)c.step(DT,true,false,1);assert.equal(a.playing,false);assert.equal(a.currentTime,p);}
// SFX gates unchanged: exactly the 3 sfxMuted gates the suite expects (play, playCheer, exit cine); this commit adds none.
const GA=fs.readFileSync(S+'audio/GameAudio.ts','utf8');assert.equal((GA.match(/this\.muted \|\| this\.sfxMuted \|\| this\.reasons\.size > 0/g)||[]).length,3,'3 sfxMuted gates');
// Tripwire: no journey cue track / cue timing on this line. Add one -> give it timeline-synced pause/resume and update this test.
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const assets=walk(ROOT+'/creator-build-project/assets');
assert.deepEqual(assets.filter(f=>/timing\.json$/i.test(f)).map(f=>path.relative(ROOT,f)),[],'a cue timing.json is in the package: wire its timeline-synced resume');
assert.deepEqual(assets.filter(f=>/audio_cine\/.*\.mp3$/.test(f)).map(f=>path.basename(f)),['sfx_exit_outbound.mp3'],'a new cutscene cue track: wire its timeline-synced resume');
const scripts=assets.filter(f=>/\.ts$/.test(f)).map(f=>fs.readFileSync(f,'utf8')).join('\n');assert.deepEqual([...new Set(scripts.match(/audio_cine\/[\w]+/g)||[])],['audio_cine/sfx_exit_outbound']);
console.log(JSON.stringify({status:'PASS',cases,checks:['lake loop paused (not stopped) while hidden, position kept','resumes from that position after the auto-resume (offset ≤ 50 ms; measured 0)','no double sources outside the crossfade, incl. hide mid-crossfade','full level after fade-in','muted/gated: silent, no drift','3 sfxMuted gates unchanged','tripwire: no journey cue track / timing.json on this line'],scope:'LakeAmbienceCore + fake AudioSource (Cocos 3.8 AudioSource.play resumes a paused clip); no device audio'},null,2));
