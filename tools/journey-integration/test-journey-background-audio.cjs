'use strict';
// Journey cutscene audio across a background trip, now that the cutscene resumes by itself on return (2c12565).
// What the island→lakeside journey actually sounds on this line: no cue/voice track and no cue timing.json (the only
// timeline track, audio_cine/sfx_exit_outbound, belongs to the home exit and has its own restart rule), so the sound
// that must survive is the bed: amb_lake_loop on the arrival stretch (+ wind/waves/BGM loops in GameAudio, paused/resumed
// by suspend('hidden')). This locks: the lake loop is PAUSED (position kept, never stopped) while hidden, resumes from
// that position once the auto-resumed cutscene is back on the arrival stretch (offset 0 ms vs its pre-hide position),
// never two sources at once outside the loop crossfade, at several hide points incl. mid-crossfade. Also a tripwire:
// a journey cue track or cue timing.json added later must come with timeline-synced resume (this test then fails).
// r5: the sail segment track (transport_sail/audio_sail) is such a track - its timeline-synced resume is locked below.
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
// r5 sail track (Voice Bot): the sail segment now has audio (transport_sail/audio_sail, cue-driven by TransitAudioHooks). Its
// timeline-synced pause/resume is locked here: hidden -> every sounding voice PAUSED (position kept, never stopped) and the sail
// clock frozen like SailRide's t; shown -> each voice resumes at (clock - its cue time), offset <= 50 ms (measured 0); the hooks'
// re-sent 'sail-cruise-loop-start' (region 'resume') never restarts the bed; muted while the ride runs -> on unmute the voice
// jumps to its timeline position (or stays silent when that is past its end); loop-stop / skip fade out, never a hard cut.
const SA=H.load(S+'audio/SailAudioCore.ts'),HK=H.load(S+'region/TransitAudioHooks.ts'),TL=H.load(S+'region/TransportLeg.ts');
const {SAIL_AUDIO,SAIL_VOICES,SailAudioCore}=SA;
function ssrc(name){return {name,volume:0,loop:false,playing:false,currentTime:0,plays:0,stops:0,pauses:0,seeks:0,_t:0,
 get currentTime(){return this._t;},set currentTime(v){this._t=v;this.seeks++;},play(){this.playing=true;this.plays++;},pause(){this.playing=false;this.pauses++;},stop(){this.playing=false;this._t=0;this.stops++;}};}
const tl=TL.sailBeats(TL.sailRoute().length),beat=id=>tl.beats.find(b=>b.id===id);
assert(tl.build05S<=30.5,'sail segment stays within 30.5 s (camera / duration untouched)');
const sailRun=(hideAt,hiddenS,muteAt=null,muteS=0)=>{
 HK.resetTransitAudio();const S4={};for(const id of SAIL_VOICES)S4[id]=ssrc(id);const core=new SailAudioCore(S4);
 const heard=[];HK.onTransitCue((cue,info)=>{heard.push([cue,info.region]);core.cue(cue,info);});
 const cues=[[beat('S-b').t0,'sail-board'],[beat('S-c').t0,'sail-unfurl'],[beat('S-d').t0,'sail-cruise-loop-start'],[beat('S-d').t1,'sail-cruise-loop-stop'],[beat('S-e').t0,'sail-dock']];
 let t=0,hidden=false,muted=false,next=0,hideDone=false,muteDone=false,snap=null,check=null;const vols=[];
 const tick=()=>{ // one SailRide frame: hidden -> setTransitHidden(true), t frozen; else cues crossed this frame
  if(hidden){HK.setTransitHidden(true);}else{HK.setTransitHidden(false);t+=DT;while(next<cues.length&&cues[next][0]<=t+1e-9){HK.emitTransit(cues[next][1],{t,region:'meadow'});next++;}}
  core.step(DT,!HK.transitHidden(),!muted);for(const id of SAIL_VOICES)if(S4[id].playing)S4[id]._t+=DT;
  vols.push(S4.cruise.volume);};
 while(t<tl.build05S+5){
  if(!hideDone&&t>=hideAt){hideDone=true;tick();const pos=SAIL_VOICES.map(id=>S4[id].playing?+S4[id]._t.toFixed(6):null),stops=SAIL_VOICES.map(id=>S4[id].stops);hidden=true;
   for(let k=0;k<hiddenS/DT;k++)tick();
   for(const id of SAIL_VOICES)assert(!S4[id].playing,'silent while hidden: '+id);
   SAIL_VOICES.forEach((id,i)=>{if(pos[i]!==null){assert.equal(+S4[id]._t.toFixed(6),pos[i],'paused, position kept: '+id);assert.equal(S4[id].stops,stops[i],'no stop() on hide: '+id);}});
   hidden=false;tick();const off=SAIL_VOICES.map((id,i)=>pos[i]===null?null:Math.abs(S4[id]._t-DT-pos[i])*1000);
   SAIL_VOICES.forEach((id,i)=>{if(pos[i]!==null){assert(S4[id].playing,'sounds again after the return: '+id);assert(off[i]<=50,'resume offset ≤ 50 ms: '+id+' '+off[i]);assert.equal(S4[id].stops,stops[i],'no restart on resume: '+id);}});
   snap={hideAtS:+hideAt.toFixed(2),hiddenS,sounding:SAIL_VOICES.filter((id,i)=>pos[i]!==null),offsetMs:Math.max(0,...off.filter(x=>x!==null))};continue;}
  if(muteAt!==null&&!muteDone&&t>=muteAt){muteDone=true;muted=true;const t0=t;for(let k=0;k<muteS/DT;k++)tick();for(const id of SAIL_VOICES)assert(!S4[id].playing,'muted: silent '+id);
   muted=false;tick();for(const id of SAIL_VOICES){const p=core.position(id);if(p===null)continue;assert(S4[id].playing,'unmuted: '+id);assert(Math.abs(S4[id]._t-DT-p)<=0.05,'unmute lands on the timeline: '+id+' '+S4[id]._t+' vs '+p);}
   check={muteAtS:+muteAt.toFixed(2),muteS,positions:Object.fromEntries(SAIL_VOICES.map(id=>[id,core.position(id)===null?null:+core.position(id).toFixed(3)]))};continue;}
  tick();}
 // every cue heard exactly once in order (+ at most one 'resume' re-send of the bed), the bed never restarted
 const plain=heard.filter(h=>h[1]!=='resume').map(h=>h[0]);assert.deepEqual(plain,cues.map(c=>c[1]).filter(c=>plain.includes(c)));
 assert.equal(S4.cruise.plays-S4.cruise.pauses,1,'cruise bed: one start, every other play() is a resume');
 // loop-stop: the bed fades out over ~cruiseFadeOutS (monotonic, no step to 0)
 const iStop=Math.round(beat('S-d').t1/DT);let maxStep=0;for(let i=iStop;i<vols.length;i++)maxStep=Math.max(maxStep,vols[i-1]-vols[i]);
 if(!snap||snap.hideAtS>beat('S-d').t1+3||snap.hideAtS<beat('S-d').t1-0.5)assert(maxStep<=SAIL_AUDIO.vol.cruise*DT/SAIL_AUDIO.cruiseFadeOutS*1.6+1e-6,'cruise fade-out, no hard cut ('+maxStep+')');
 for(const id of SAIL_VOICES)assert(!core.active(id)&&!S4[id].playing,'all done after the ride: '+id);
 return snap||check;};
const sailCases=[sailRun(beat('S-b').t0+1.2,4),sailRun(beat('S-c').t0+0.7,2),sailRun(beat('S-d').t0+3.3,8),sailRun(beat('S-d').t1+0.4,1),sailRun(beat('S-e').t0+2.0,6),
 sailRun(99,0,beat('S-d').t0+2,3),sailRun(99,0,beat('S-c').t0+0.5,10)];
// loop-start swallowed while hidden (hidden before S-d, back after): the hooks re-send it on return and the bed starts then
{HK.resetTransitAudio();const S4={};for(const id of SAIL_VOICES)S4[id]=ssrc(id);const core=new SailAudioCore(S4);HK.onTransitCue((c,i)=>core.cue(c,i));
 HK.setTransitHidden(true);HK.emitTransit('sail-cruise-loop-start',{t:11.6,region:'meadow'});core.step(DT,!HK.transitHidden(),true);assert(!core.active('cruise'));
 HK.setTransitHidden(false);core.step(DT,!HK.transitHidden(),true);assert(core.active('cruise')&&S4.cruise.playing,'swallowed bed starts on return');}
// skip: everything fades within skipFadeS, no hard cut
{const S4={};for(const id of SAIL_VOICES)S4[id]=ssrc(id);const core=new SailAudioCore(S4);core.cue('sail-unfurl');core.cue('sail-cruise-loop-start');for(let i=0;i<120;i++)core.step(DT,true,true);
 const v0=S4.unfurl.volume;core.cue('transit-skip');core.step(DT,true,true);assert(S4.unfurl.volume>0&&S4.unfurl.volume<v0,'skip fades');for(let i=0;i<SAIL_AUDIO.skipFadeS/DT+2;i++)core.step(DT,true,true);assert(!core.active('unfurl')&&!core.active('cruise'),'skip: gone after the fade');}
// assets: exactly the 4 sail files, mono mp3 in transport_sail/audio_sail, wired only through SailAudioCore; component listens to the hooks
const sailMp3=assets.filter(f=>/audio_sail\/.*\.mp3$/.test(f));
assert.deepEqual(sailMp3.map(f=>path.relative(ROOT,f).replace(/\\/g,'/')).sort(),Object.keys(SAIL_AUDIO.clips).map(k=>'creator-build-project/assets/bundles/transport_sail/'+SAIL_AUDIO.clips[k]+'.mp3').sort(),'sail track files = SAIL_AUDIO.clips (timeline-synced resume above)');
const sailBytes=sailMp3.reduce((n,f)=>n+fs.statSync(f).size,0);assert(sailBytes<=200*1024,'sail audio ≤ 200 KB ('+sailBytes+')');
const SAc=fs.readFileSync(S+'audio/SailAudio.ts','utf8');assert.match(SAc,/onTransitCue\(/);assert.match(SAc,/core\.step\(dt, !transitHidden\(\), audible\)/);assert.match(SAc,/canPlayAmbience\(\)/);assert.match(SAc,/isSfxMuted\(\)/);
console.log(JSON.stringify({status:'PASS',cases,sailCases,sailBytes,checks:['lake loop paused (not stopped) while hidden, position kept','resumes from that position after the auto-resume (offset ≤ 50 ms; measured 0)','no double sources outside the crossfade, incl. hide mid-crossfade','full level after fade-in','muted/gated: silent, no drift','3 sfxMuted gates unchanged','tripwire: no journey cue track / timing.json on this line'],scope:'LakeAmbienceCore + fake AudioSource (Cocos 3.8 AudioSource.play resumes a paused clip); no device audio'},null,2));
