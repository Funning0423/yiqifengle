'use strict';
// 风铃湖畔 ambience (Voice Bot): lake loop starts on lakeside entry, sea waves stand down, restored on exit; mute/background,
// slider (A1c), seamless cross-loop; asset in the region_lakeside subpackage, ≤ 60 KB; no Set/Map spreads.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),S=ROOT+'/creator-build-project/assets/scripts/',B=ROOT+'/creator-build-project/assets/bundles/region_lakeside/';
const {createHarness}=require('./board-ui/harness.cjs'),H=createHarness(),M=H.load(S+'audio/LakeAmbienceCore.ts');
const {LAKE_AMB,LakeAmbienceCore,lakeAmbienceWanted}=M;let n=0;const t=(m,f)=>{f();n++;console.log('PASS',m);};
function src(){return {volume:0,playing:false,currentTime:0,plays:0,play(){this.playing=true;this.plays++;},pause(){this.playing=false;},stop(){this.playing=false;this.currentTime=0;}};}
const tick=(s,dt)=>{if(s.playing)s.currentTime+=dt;};
t('wanted: lakeside state, arrival stretch of island→lakeside, lakeside board; not island/home/meadow/skycity/other boards',()=>{
 assert.equal(lakeAmbienceWanted({state:'lakeside'}),true);
 assert.equal(lakeAmbienceWanted({state:'region-travel',journeyTarget:'lakeside',journeyPhase:'arrival'}),true);
 assert.equal(lakeAmbienceWanted({state:'region-travel',journeyTarget:'lakeside',journeyPhase:'bridge'}),false);
 assert.equal(lakeAmbienceWanted({state:'level',boardPresent:true,boardRegion:'lake'}),true);
 assert.equal(lakeAmbienceWanted({state:'level',boardPresent:true,boardStageId:'r04-lake-03'}),true);
 assert.equal(lakeAmbienceWanted({state:'level-loading',journeyRegion:'lakeside'}),true);
 for(const p of [{state:'island'},{state:'home'},{state:'meadow'},{state:'skycity'},{state:'level',boardPresent:true,boardRegion:'meadow'},{state:'level',boardPresent:true,boardStageId:'r05-tide-01',journeyRegion:'lakeside'},{state:'region-travel',journeyTarget:'meadow',journeyPhase:'arrival'}])assert.equal(lakeAmbienceWanted(p),false,JSON.stringify(p));});
t('entry: lake fades in and plays, sea waves suppressed; exit: lake fades out/pauses, waves released',()=>{
 const a=src(),b=src(),c=new LakeAmbienceCore(a,b);
 assert.equal(c.suppressWaves(true),false,'not before the clip is ready (waves stay on if the subpackage clip fails)');c.ready=true;
 for(let i=0;i<120;i++){c.step(1/60,true,true,1);tick(a,1/60);}
 assert.equal(c.suppressWaves(true),true);assert.equal(a.playing,true);assert(Math.abs(a.volume-LAKE_AMB.maxVol*(1/LAKE_AMB.fadeInS)*2)<.02||a.volume>=LAKE_AMB.maxVol-1e-9);
 for(let i=0;i<60;i++){c.step(1/60,true,true,1);tick(a,1/60);}assert(Math.abs(a.volume-LAKE_AMB.maxVol)<1e-9);
 assert.equal(c.suppressWaves(false),false,'waves come back as soon as lakeside is left');
 for(let i=0;i<90;i++){c.step(1/60,false,true,1);tick(a,1/60);}assert.equal(a.playing,false);assert.equal(a.volume,0);});
t('mute/background: silent at once, resumes on foreground; slider 0 silent, default 0.4 → full (A1c)',()=>{
 const a=src(),b=src(),c=new LakeAmbienceCore(a,b);c.ready=true;for(let i=0;i<120;i++)c.step(1/60,true,true,1);
 c.step(1/60,true,false,1);assert.equal(a.playing,false);assert.equal(a.volume,0);
 c.step(1/60,true,true,1);for(let i=0;i<90;i++)c.step(1/60,true,true,1);assert.equal(a.playing,true);
 c.step(1/60,true,true,0);assert.equal(a.playing,false);c.quiet();assert.equal(c.vol,0);
 const AA=fs.readFileSync(S+'audio/AmbienceAudio.ts','utf8');const bed=AA.match(/export function ambienceBedGain[\s\S]*?\n}/);assert(bed);assert.match(fs.readFileSync(S+'audio/LakeAmbience.ts','utf8'),/ambienceBedGain\(Number\(audio\.getMusicVolume\(\)\)/);});
t('cross-loop: partner at the circular period, linear crossfade past the encoder delay, then hand over; partner failure → platform loop',()=>{
 const a=src(),b=src(),c=new LakeAmbienceCore(a,b);c.ready=true;const dt=1/120;let swapped=false,maxSum=0,minSum=9;
 for(let i=0;i<120*21;i++){c.step(dt,true,true,1);tick(a,dt);tick(b,dt);if(b.playing&&a.playing&&b.currentTime>LAKE_AMB.encoderDelayS){const s=a.volume+b.volume;maxSum=Math.max(maxSum,s);minSum=Math.min(minSum,s);}if(!a.playing&&b.playing)swapped=true;}
 assert(swapped,'handed over');assert(Math.abs(maxSum-LAKE_AMB.maxVol)<1e-6&&Math.abs(minSum-LAKE_AMB.maxVol)<1e-6,'equal-gain over identical audio');
 const x=src(),y={...src(),play(){}},d=new LakeAmbienceCore(x,y);d.ready=true;for(let i=0;i<120*21;i++){d.step(dt,true,true,1);tick(x,dt);}assert.equal(d.diagnostics().xFailed,true);assert.equal(x.playing,true);});
t('wiring: AmbienceAudio stands down on lakeActive (waves + gulls via the no-world path); LakeAmbience registers mounter/quieter; [QF_LAKE] on load failure',()=>{
 const AA=fs.readFileSync(S+'audio/AmbienceAudio.ts','utf8'),LA=fs.readFileSync(S+'audio/LakeAmbience.ts','utf8');
 assert.match(AA,/static lakeActive = false;/);assert.match(AA,/const outdoor = AmbienceAudio\.lakeActive \? -1 : outdoorRaw;/);
 assert.match(LA,/AmbienceAudio\.lakeActive = core\.suppressWaves\(this\.wanted\);/);assert.match(LA,/ambienceQuieters\?\.push\(\(\) => LakeAmbience\.instance\?\.quiet\(\)\)/);
 assert.match(LA,/ambienceMounters\?\.push\(\(\) => LakeAmbience\.ensure\(\)\)/);assert.match(LA,/console\.error\('\[QF_LAKE\] lake ambience '/);
 for(const f of ['audio/LakeAmbience.ts','audio/LakeAmbienceCore.ts'])assert(!/\.\.\.\s*(new\s+(Set|Map)|[A-Za-z_$.]+\.(keys|values|entries)\(\))/.test(fs.readFileSync(S+f,'utf8')),f+' spread');
 const SM=fs.readFileSync(S+'audio/SceneMusic.ts','utf8');assert(!/lake/.test(SM.split('export function sceneTrackFor')[1].split('\n}')[0]),'BGM stays island');});
t('asset: region_lakeside/audio/amb_lake_loop.mp3 ≤ 60 KB, mono 24 kHz MPEG-2 L3, with meta',()=>{
 const f=B+'audio/amb_lake_loop.mp3',buf=fs.readFileSync(f);assert(buf.length<=60*1024,String(buf.length));assert(fs.existsSync(f+'.meta'));
 let i=0;if(buf.slice(0,3).toString()==='ID3')i=10+((buf[6]&127)<<21|(buf[7]&127)<<14|(buf[8]&127)<<7|(buf[9]&127));
 while(!(buf[i]===0xff&&(buf[i+1]&0xe0)===0xe0))i++;const h=buf.readUInt32BE(i),ver=(h>>19)&3,sr=(h>>10)&3,mode=(h>>6)&3;
 assert.equal(ver,2,'MPEG-2');assert.equal(sr,1,'24000 Hz');assert.equal(mode,3,'mono');
 assert.equal(JSON.parse(fs.readFileSync(f+'.meta','utf8')).importer,'audio-clip');});
console.log('OK',n);
