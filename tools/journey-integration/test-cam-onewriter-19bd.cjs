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
const status=results.every(r=>r.status==='PASS')?'PASS':'FAIL';
console.log(JSON.stringify({test:'cam-onewriter-19bd',status,results}));process.exit(status==='PASS'?0:1);
