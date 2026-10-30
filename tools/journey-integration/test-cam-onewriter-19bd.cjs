'use strict';
// onewriter (Mac 19bd812a MULTI=2: finstart 12 frames, m 7): replays the Mac same-frame write pairs through the REAL applyCameraPose
// with an engine-frame clock and counts physical camera writes per frame. Must be 1 per frame; must FAIL with frame arbitration off
// (19bd812a behaviour); a genuinely different 2nd pose in one frame must still be written AND flagged (no masking of real conflicts).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.QF_JOURNEY_SOURCE_ROOT||path.resolve(__dirname,'../..'),S=root+'/creator-build-project/assets/scripts/';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();const CP=H.load(S+'world-r1/CameraPose.ts');
const D2R=Math.PI/180;
const parse=l=>{const m=/pos=([-\d.,]+) yaw=([-\d.]+) pitch=([-\d.]+) fov=([-\d.]+).* fr=(\d+)/.exec(l);const p=m[1].split(',').map(Number),y=+m[2]*D2R,pi=+m[3]*D2R;
 return {fr:+m[5],pose:CP.fromLookAt({position:p,target:[p[0]+Math.cos(pi)*Math.sin(y)*10,p[1]+Math.sin(pi)*10,p[2]-Math.cos(pi)*Math.cos(y)*10]},+m[4])};};
function replay(rows,arb){let fr=0,phys={};const cam={fov:0,node:{setWorldPosition(){phys[fr]=(phys[fr]||0)+1;},setWorldRotation(){}}};
 const g0=globalThis.cc;let k=0;globalThis.cc={director:{getTotalFrames:()=>arb?fr:--k}}/* off = a new frame per write (19bd812a) */;CP.cameraWriteLog.last=null;
 for(const r of rows){fr=r.fr;assert.ok(CP.applyCameraPose(cam,r.pose,'replay'));}
 globalThis.cc=g0;return Object.values(phys).filter(n=>n>1).length;}
const results=[];
for(const seg of ['finstart','m']){const rows=fs.readFileSync(path.join(__dirname,'fixtures/onewriter-19bd812a',seg+'-multi.txt'),'utf8').trim().split('\n').map(parse);
 const frames=new Set(rows.map(r=>r.fr)).size,before=replay(rows,false),after=replay(rows,true);
 results.push({id:seg,frames,multiBefore:before,multiAfter:after,status:before===frames&&after===0?'PASS':'FAIL'});}
{const a=CP.fromLookAt({position:[0,1,0],target:[0,1,5]},48),b=CP.fromLookAt({position:[0.5,1,0],target:[0,1,5]},48);
 results.push({id:'real-conflict-not-masked',status:replay([{fr:1,pose:a},{fr:1,pose:b}],true)===1?'PASS':'FAIL'});
 results.push({id:'next-frame-writes',status:replay([{fr:1,pose:a},{fr:2,pose:a}],true)===0?'PASS':'FAIL'});}
// ---- source mode: RAW writes per frame from the real source paths, merge DISABLED (no cc.director) — target 0 doubles at the root.
// Default root = this tree with the outbox GGbot diffs 05+ applied in a temp copy (until GGbot merges them); QF_ONEWRITER_SRC=<root> to
// judge another tree as is (e.g. 19bd812a → must FAIL).
function srcRoot(){if(process.env.QF_ONEWRITER_SRC)return process.env.QF_ONEWRITER_SRC;const cp=require('node:child_process'),os=require('node:os');
 const O=path.join(root,'team/cinematic/outbox/20261029-onewriter'),D=fs.readdirSync(O).filter(f=>/^(0[5-9]|[1-9]\d)-.*\.diff$/.test(f)).sort();
 const t=fs.mkdtempSync(path.join(os.tmpdir(),'qf-ow-'));fs.cpSync(S,path.join(t,'creator-build-project/assets/scripts'),{recursive:true});
 for(const d of D){const r=cp.spawnSync('git',['apply','--unsafe-paths','--directory=.','-p1',path.join(O,d)],{cwd:t,encoding:'utf8'});if(r.status){const ch=fs.readFileSync(path.join(O,d),'utf8');if(!/^\+\+\+ b\//m.test(ch))throw Error(d);/* already applied? */const rv=cp.spawnSync('git',['apply','-R','--check','-p1',path.join(O,d)],{cwd:t});if(rv.status)throw Error('diff does not apply: '+d+' '+r.stderr);}}
 return t;}
function sourceFrames(R){const S2=R+'/creator-build-project/assets/scripts/',H2=createHarness(),out={};const g0=globalThis.cc;delete globalThis.cc;
 const per=()=>{const m={};return {hit:f=>m[f]=(m[f]||0)+1,doubles:()=>Object.values(m).filter(n=>n>1).length};};
 try{
 // (a) WorldFlowComponent.run + createCameraTrack: hold write, track A (tick 0 sync), A end tick(1) + track B tick(0) in one frame
 {const CP2=H2.load(S2+'world-r1/CameraPose.ts'),c=per();let fr=1;const cam={fov:48,node:{setWorldPosition(){c.hit(fr);},setWorldRotation(){}}};
  const P=(z)=>({position:[0,1,z],target:[0,1,z+5],fovVerticalDeg:48});CP2.applyCameraPose(cam,CP2.fromLookAt(P(0),48),'hold');
  const A=CP2.createCameraTrack(cam,[P(0),P(1)],'A'),B=CP2.createCameraTrack(cam,[P(1),P(2)],'B');A.tick(0);
  for(let k=1;k<=3;k++){fr++;A.tick(k/3);}B.tick(0)/* same frame as A's end */;for(let k=1;k<=3;k++){fr++;B.tick(k/3);}out['track hold/start/end']=c.doubles();}
 // (b) RegionJourneyCore.observe: lease.onFrame + walk path in one frame
 {const J=H2.load(S2+'world-r1/RegionJourneyCore.ts'),c=new J.RegionJourneyController({prepare:async()=>null,readCamera:()=>null});let w=0;
  c.lease={onFrame:()=>({position:[0,1,0],target:[0,1,1]}),route:{path:[[0,0,0],[0,0,5]]}};c.rideHold=false;c.activePath=[[0,0,0],[0,0,5]];c.startCamera={position:[0,2,-3],target:[0,1,0]};c.startDistance=0;
  try{c.observe({walkProgress:()=>0.5},{setCamera:()=>w++},1/60);}catch{}out['observe onFrame+walk']=w>1?1:0;}
 // (c) regionBoardHandoff → regionLandingToBoard (WorldNativeComposition order), one frame per nextFrame
 {const B=H2.load(S2+'region/RegionBoardLanding.ts'),c=per();let fr=1,cur={position:[0,30,-40],target:[0,30,-30],fovVerticalDeg:48};const to={position:[0,5,0],target:[0,4,10],fovVerticalDeg:48};
  const deps={readCamera:()=>cur,viewport:()=>({width:390,height:844}),boardPose:()=>to,setCamera:p=>{c.hit(fr);cur=p;return true;},nextFrame:async()=>{fr++;return 1/60;},log:()=>{}};
  return Promise.resolve().then(async()=>{await B.regionBoardHandoff({region:'skycity',stageId:'s',deps});await B.regionLandingToBoard({region:'skycity',stageId:'s',deps});out['board handoff→landing']=c.doubles();
 // (d) RegionNodeStage lateUpdate anim tail (component needs the engine: the statement is evaluated from source)
 {const src=fs.readFileSync(S2+'world-r2/RegionNodeStage.ts','utf8'),m=/\n\s*(if\(this\.anim\)\{this\.anim\.t\+=dt;[^\n]*?\}\})/.exec(src);let n=0;
  const o={anim:{t:0,seconds:0.05,sample:()=>n++,done:()=>n++}};for(let k=0;k<5&&o.anim;k++){n=0;new Function('dt',m[1]).call(o,1/60);}out['node-lens blend end']=n>1?1:0;}
 // (e) structural, engine-bound paths (WorldFlowComponent setCamera adapter, ride end, walkContinuous first frame)
 {const wfc=fs.readFileSync(S2+'world-r1/WorldFlowComponent.ts','utf8'),rjc=fs.readFileSync(S2+'world-r1/RegionJourneyCore.ts','utf8');
  out['home placed twice']=/if\(pose===placed&&cameraWriteLog\.writes===placedN\)return/.test(wfc)?0:1;
  out['ride end re-write']=/finally\{this\.unpatch\?\.\(\);\}token\.check\(\);[^\n]*\n[^\n]*\n[^\n]*\n\s*if\(this\.camera\)world\.setCamera\(this\.camera\);/.test(rjc)?1:0;
  out['ride start live re-write']=/this\.patchCamera\(world,live,first,shotId\);world\.setCamera\(live\)/.test(rjc)?1:0;}
  return out;});}
 }finally{globalThis.cc=g0;}}
(async()=>{let R=null;try{R=srcRoot();const raw=await sourceFrames(R);const d=Object.values(raw).reduce((a,b)=>a+b,0);results.push({id:'source-raw-writes (merge off)',root:process.env.QF_ONEWRITER_SRC||'tree+outbox 05+',doubles:raw,status:d===0?'PASS':'FAIL'});}
 catch(e){results.push({id:'source-raw-writes (merge off)',status:'FAIL',error:String(e&&e.stack||e)});}
 finally{if(R&&!process.env.QF_ONEWRITER_SRC)fs.rmSync(R,{recursive:true,force:true});}
 const status=results.every(r=>r.status==='PASS')?'PASS':'FAIL';console.log(JSON.stringify({test:'cam-onewriter-19bd',status,results}));process.exit(status==='PASS'?0:1);})();
