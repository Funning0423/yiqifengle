'use strict';
// full9b P0 (Mac dc86ade2 cam-multiwrite: MULTI=2 ×762, MULTI=3 ×459): ONE camera writer per engine frame on the balloon legs.
// Writers named from the Mac CALLER stacks:
//  lakeside leg  #1 RegionJourneyCore.observe → lease.onFrame() (RegionJourneyAdapter lakeside lease: returned lastPose WITHOUT the C2 close-up)
//                #2 LakesideBalloonTicker.lateUpdate → ticker.step → apply() → world.setCamera   (CALLER Ye.step → s)
//                #3 EVENT_BEFORE_DRAW beforeDraw → apply() → world.setCamera                       (CALLER $e → s)
//  meadow leg    BalloonTransit flight: driver.step → apply() and beforeDraw → apply()             (CALLER M → rn)
// The frame model below is built FROM THE SOURCE (the writer guards are evaluated, not assumed), produces a camTrace with fr=,
// and is judged by the same gate the Mac trace uses (check-cam-writers-per-frame.cjs). Fails on dc86ade2, passes after the fix.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os'),assert=require('node:assert/strict');
const root=process.env.QF_JOURNEY_SOURCE_ROOT||path.resolve(__dirname,'../..'),S=root+'/creator-build-project/assets/scripts/';
const src=f=>fs.readFileSync(S+f,'utf8');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const {RegionJourneyController}=H.load(S+'world-r1/RegionJourneyCore.ts');
const rja=src('region/RegionJourneyAdapter.ts'),bt=src('region/BalloonTransit.ts');
// --- evaluate the guards from source
const onFrameM=rja.match(/progress\(d\)\{[^]*?\},onFrame\(\)\{return ([^;]+);\}/);assert.ok(onFrameM,'lakeside lease onFrame found');
const onFrame=new Function('rideCam','lastPose','return '+onFrameM[1]+';');
const lkApplyDecl=/const apply=\((writeCam=true)?\)=>\{/.exec(rja.slice(rja.indexOf('lastPose=sl?sl.cam')-4000));
const lkGuard=/if\(writeCam\)world\.setCamera\(sl\?c2Lens/.test(rja);
const lkTick=[...rja.slice(rja.indexOf('ticker.step=(dt)=>{\n     const hidden'),rja.indexOf('offSkip();\n   rideToken.check();')).matchAll(/\n\s+apply\(([^)]*(?:\([^)]*\))?[^)]*)\)/g)].map(m=>m[1]);
const hasRideCam=/let rideCam=false/.test(rja)&&/rideCam=true;/.test(rja)&&/rideOver=true;rideCam=false;/.test(rja);
const btApplyDecl=/const apply=\(writeCam=true\)=>\{/.test(bt),btGuard=/if\(writeCam\)\{camTag\('BalloonTransit:flight'\);world\.setCamera\(pose\);\}/.test(bt);
const btTick=(bt.match(/\n\s+const t=apply\(([^;]*)\)(?:\/\*[^*]*\*\/)?;if\(inflateT/)||[])[1]??'';
// --- frame model: lateUpdate (ticker) → observe (controller) → before-draw
function lakesideFrames(n){const lines=[];let f=0;const pose={position:[0,1,2],target:[0,1,3]};
 const c=new RegionJourneyController({prepare:async()=>null,readCamera:()=>pose});
 let fr=0;const world={setCamera:p=>{f++;lines.push(`2026-10-26T00:00:00.000Z log [QF_CAM_TRACE] f=${f} t=0 pos=${p.position.join(',')} yaw=0 pitch=0 fov=48 w=${tag} fr=${fr}`);}};let tag='';
 const rideCam=hasRideCam;const lp=pose;
 c.lease={onFrame:()=>onFrame(rideCam,lp)};c.rideHold=false;
 for(fr=1;fr<=n;fr++){const last=fr===n;
  tag='lake:ticker';const tickerGuarded=lkGuard&&lkTick.length>0&&lkTick.every(x=>/R\.T/.test(x));if(!tickerGuarded||last)world.setCamera(pose);
  tag='RegionJourneyCore:onFrame';c.observe({walkProgress:()=>null},world,1/60);
  if(!last){tag='lake:beforeDraw';world.setCamera(pose);}}
 return lines;}
function meadowFrames(n){const lines=[];let f=0;for(let fr=1;fr<=n;fr++){const last=fr===n;
  const stepWrites=!(btApplyDecl&&btGuard&&btTick&&/plan\.total/.test(btTick))||last;
  if(stepWrites)lines.push(`x log [QF_CAM_TRACE] f=${++f} t=0 pos=0,0,0 w=BalloonTransit:flight fr=${1000+fr}`);
  if(!last)lines.push(`x log [QF_CAM_TRACE] f=${++f} t=0 pos=0,0,0 w=BalloonTransit:flight fr=${1000+fr}`);}
 return lines;}
const gate=f=>{const r=cp.spawnSync(process.execPath,[path.join(__dirname,'check-cam-writers-per-frame.cjs'),f],{encoding:'utf8'});return {code:r.status,out:JSON.parse(r.stdout.trim())};};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qf-csw-')),results=[];
for(const [id,lines] of [['lakeside-ride',lakesideFrames(120)],['meadow-flight',meadowFrames(120)]]){
 const p=path.join(tmp,id+'.txt');fs.writeFileSync(p,lines.join('\n')+'\n');const g=gate(p);results.push({id,status:g.code===0?'PASS':'FAIL',frames:g.out.frames,multiWriterFrames:g.out.multiWriterFrames,writerSets:g.out.writerSets});}
// controller sanity (real TS): a lease onFrame that returns a pose IS a writer, undefined is not
{const c=new RegionJourneyController({prepare:async()=>null,readCamera:()=>null});let w=0;const world={setCamera:()=>w++};
 c.lease={onFrame:()=>({position:[0,0,0],target:[0,0,1]})};c.rideHold=false;c.observe({walkProgress:()=>null},world,1/60);
 c.lease={onFrame:()=>undefined};c.observe({walkProgress:()=>null},world,1/60);
 results.push({id:'controller-onFrame-writer',status:w===1?'PASS':'FAIL',writes:w});}
// CamTraceLog: plain camTrace = MULTI only (no per-write stack, cheap); stacks only with camTraceStacks=1 / __QF_CAM_TRACE_STACKS
{const C=H.load(S+'region/CamTraceLog.ts'),g0=globalThis.cc;globalThis.cc={director:{getTotalFrames:()=>7}};
 const run=(q,g={})=>{C.camLogReset();const out=[];C.camLog.out=x=>out.push(x);C.camLogStart(q,g);const P={position:[0,0,0],rotation:[0,0,0,1],fovVerticalDeg:48};C.camLogWrite(null,P,'a');C.camLogWrite(null,P,'b');C.camLogReset();return out[1]||'';};
 const plain=run('camTrace=1'),q=run('camTrace=1&camTraceStacks=1'),gl=run('camTrace=1',{__QF_CAM_TRACE_STACKS:1}),off=run('camTraceStacks=1');globalThis.cc=g0;
 results.push({id:'cam-trace-stacks-opt-in',status:/MULTI=2/.test(plain)&&!/CALLER=/.test(plain)&&/CALLER=/.test(q)&&/CALLER=/.test(gl)&&off===''?'PASS':'FAIL'});}
fs.rmSync(tmp,{recursive:true,force:true});
const status=results.every(r=>r.status==='PASS')?'PASS':'FAIL';
console.log(JSON.stringify({test:'cam-single-writer',status,guards:{lakesideOnFrame:onFrameM[1],lakesideApplyCam:!!(lkApplyDecl&&lkApplyDecl[1]),lakesideGuard:lkGuard,lakesideTickerArgs:lkTick,rideCam:hasRideCam,balloonApplyCam:btApplyDecl,balloonGuard:btGuard,balloonTickArg:btTick},results},null,1));
process.exit(status==='PASS'?0:1);
