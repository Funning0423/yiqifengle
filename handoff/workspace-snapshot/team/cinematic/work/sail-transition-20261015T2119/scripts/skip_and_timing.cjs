const fs=require('fs'),path=require('path');const {stripTypeScriptTypes}=require('node:module');
const root=process.argv[2],out=process.argv[3];
const M=new Function(stripTypeScriptTypes(fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/cine/SailboatTransitionModel.ts'),'utf8').replace(/^export /gm,''),{mode:'transform'})+'\nreturn {parseSailboatTiming,createSailboatPlayback,sailboatCoverAlpha};')();
const T=M.parseSailboatTiming(JSON.parse(fs.readFileSync(path.join(root,'creator-build-project/assets/resources/cine/transition_island_to_meadow.timing.json'),'utf8')));
// Skip: tap at frame N (relative to sail start); readyAt = frame the warmed meadow becomes ready (null = already).
function run(tapF,readyAt){const p=M.createSailboatPlayback(T,{startFov:42});p.begin();let f=0,maxCover=0,phases=[];
 for(let k=0;k<600;k++){const ready=readyAt==null||k>=readyAt;const s=p.advance(1/30,{meadowReady:ready,tap:k===tapF});const c=M.sailboatCoverAlpha(s.view);maxCover=Math.max(maxCover,c);if(!phases.length||phases[phases.length-1]!==s.view.phase)phases.push(s.view.phase);
  if(s.view.phase==='done')return {tapFrame:tapF,tapSec:+(tapF/30).toFixed(3),readyAtFrame:readyAt,doneAfterFrames:k+1,doneSec:+((k+1)/30).toFixed(3),phases,maxCover:+maxCover.toFixed(3)};}
 return {tapFrame:tapF,stuck:true,phases};}
const cases=[[3,null],[9,null],[15,null],[45,null],[70,null],[81,null],[100,null],[140,null],[15,120],[200,null]].map(([a,b])=>run(a,b));
const noTap=run(-1,null),lateLoad=run(-1,180);
const fps=T.fps,c=T.cloud,fr=x=>({frame:x,sec:+(x/fps).toFixed(4)});
const base={clip:T.clip,fps,frameConvention:'frame 0 = sail start (S1 hold on island final pose begins); measured = game timing model SailboatTransitionModel.ts at 04632a6/41f47f7 tree ea9456c, meadow warmed in time',
 sailStart:fr(0),setSail:fr(T.shots[1].startFrame),cloudMaskInStart:fr(c.inStartFrame),fullCover:fr(c.fullFrom),sceneSwap:fr(T.sceneSwapFrame),dissolveStart:fr(c.fullTo),revealEnd:fr(c.outEndFrame),total:fr(T.lastFrame),
 shots:T.shots,skipEnabledFrom:fr(T.skipEnabledFromFrame),skipFadeSec:T.skipFadeSec,
 windSfxSync:{suggestedStartFrame:0,lengthSec:5.2,peakFrames:[c.fullFrom,c.fullTo],note:'5.2 s one-shot from sail start; loudest under full cover 78–84; if the meadow is late the clip pauses at sceneSwap and amb_wind_soft_loop holds (see holdBehaviour)'},
 holdBehaviour:'if the warmed meadow is not ready at sceneSwap the model pauses there (cover full, cine sfx paused, wind loop on) and resumes when ready; total = 5.2 s + hold'};
const doc={day:{...base,recordingSailStartSec_r2:29.53,note:'same timing day and night; the night difference is only the cloud tint'},night:{...base,recordingSailStartSec_r2:'~32.0 (estimated, r2 night recording ended at 35.2 s)'}};
fs.mkdirSync(out+'/timing',{recursive:true});fs.writeFileSync(out+'/timing/sail_transition.timing.json',JSON.stringify(doc,null,1));
fs.writeFileSync(out+'/timing/skip_verification.json',JSON.stringify({noTap,lateLoad180:lateLoad,cases},null,1));
console.log(JSON.stringify({noTap,lateLoad},null,0));for(const x of cases)console.log(JSON.stringify(x));
