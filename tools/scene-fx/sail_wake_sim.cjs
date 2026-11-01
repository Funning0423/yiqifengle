#!/usr/bin/env node
'use strict';
/**
 * r5 S1 stern wake — offline driver. Runs the REAL SailWakeCore on the REAL sail timeline (TransportLeg sailVehicle /
 * sailCamera) at 60 Hz, the same inputs SailArt.sync gets in game (wake_root world pos, boat forward, v.speed, night).
 * Exported for test_sail_wake.cjs and for the Blender proxy renderer (dump mode).
 *   node sail_wake_sim.cjs dump out.json [--night] [--fps 15] [--from t0] [--to t1] [--shots]
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
function load(rel,req){
 const file=path.join(S,rel);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:process.env.QF_TS_TARGET==='ES5'?ts.ScriptTarget.ES5:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:req||(()=>({})),console,Math,Float32Array,Uint16Array,isFinite},{filename:file});return m.exports;
}
const layout=load('region/RegionJourneyLayout.ts');
const landing=load('region/SailLanding.ts');
const leg=load('region/TransportLeg.ts',s=>s.includes('RegionJourneyLayout')?layout:s.includes('SailLanding')?landing:{});
const shot=load('region/SailShot.ts',s=>s.includes('TransportLeg')?leg:{});
const core=load('region/SailWakeCore.ts');
const WAKE_ROOT_Z=-2.2;
function journey(){const route=leg.sailRoute();return {route,tl:leg.sailBeats(route.length)};}
/** Simulate to time `until` (Build05 s) at `hz`; onFrame(t,v,trail) after each step. */
function simulate({night=false,hz=60,until,onFrame}){
 const {route,tl}=journey();
 const tr=core.createWakeTrail(),dt=1/hz;
 const end=until??tl.build05S;
 for(let i=0;;i++){
  const t=i*dt;if(t>end+1e-9)break;
  const v=leg.sailVehicle(tl,route.samples,t);
  const fx=Math.sin(v.yaw),fz=Math.cos(v.yaw);
  core.stepWakeTrail(tr,v.pos[0]+fx*WAKE_ROOT_Z,v.pos[2]+fz*WAKE_ROOT_Z,fx,fz,v.speed,i?dt:0,night);
  if(onFrame)onFrame(t,v,tr,route,tl);
 }
 return {route,tl,trail:tr};
}
function geometry(tr){const b=core.createWakeBuffers();const peak=core.buildWakeGeometry(tr,leg.SAIL_SEA_Y+core.SAIL_WAKE.lift,b);return {b,peak};}
module.exports={leg,shot,core,journey,simulate,geometry,WAKE_ROOT_Z};
if(require.main===module&&process.argv[2]==='dump'){
 const out=process.argv[3],night=process.argv.includes('--night');
 const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>=0?+process.argv[i+1]:d;};
 const fps=arg('--fps',15);
 const {tl}=journey();
 const sc=tl.beats.find(b=>b.id==='S-c'),sf=tl.beats.find(b=>b.id==='S-f');
 const from=arg('--from',sc.t0-0.5),to=arg('--to',sf.t1);
 const want=[];
 if(process.argv.includes('--shots'))for(const k of [2,3,4,5,7]){const s=shot.sailShotTime(k);want.push({name:'K'+k,t:s.t});}
 else for(let t=from;t<=to+1e-6;t+=1/fps)want.push({name:'f'+String(want.length).padStart(4,'0'),t});
 want.sort((a,b)=>a.t-b.t);
 const frames=[];let wi=0;
 simulate({night,until:want[want.length-1].t+1/30,onFrame:(t,v,tr,route)=>{
  while(wi<want.length&&want[wi].t<=t+1e-6){
   const cam=leg.sailCamera(tl,route.samples,t,{w:390,h:844});
   const g=geometry(tr);
   frames.push({name:want[wi].name,t,boat:{pos:v.pos,yaw:v.yaw,roll:v.roll,speed:v.speed,sail:v.sail},cam,
    oldAlpha:Math.min(1,v.speed/4.4)*0.72,ringTint:core.hullFoamTint(tr.night),
    wake:{positions:Array.from(g.b.positions),uvs:Array.from(g.b.uvs),colors:Array.from(g.b.colors),indices:Array.from(g.b.indices),peak:g.peak,visibleM:core.wakeVisibleM(tr),night:tr.night}});
   wi++;
  }
 }});
 fs.writeFileSync(out,JSON.stringify({night,fps,seaY:leg.SAIL_SEA_Y,route:journey().route.samples,frames}));
 console.log('frames',frames.length,'->',out);
}
