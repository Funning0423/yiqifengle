'use strict';
// fullN gate (Mac dedf8853, raw/ev/tint1-3: `f=634 fr=817 w=world.setCamera` (restore, JUMP 0) then a ~0.6 s stall, then
// `f=635 fr=817 w=enter-level CHANGE<-world.setCamera JUMP=0.259m MULTI=2`, 3/3 cold starts).
// Runs WorldFlowComponent's REAL source (setCamera + holds, run(), the update() job loop, the playEnterLevel tick) against a
// stub camera/director and replays: island walk track ends on path[0] (fr 816) -> restore() re-places the same pose (fr 817)
// -> playEnterLevel starts (fr 817) -> stall: the update of fr 817 runs with dt 0.6 (capped 0.1) before any draw -> fr 818.
// Asserts: exactly one camera write in fr 817, and the first written enter-level sample is p=0 (= path[0]). FAILs on dedf8853.
const assert=require('assert'),fs=require('fs'),path=require('path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const F=process.env.QF_WFC_FILE||path.resolve(__dirname,'../../creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts'),src=fs.readFileSync(F,'utf8');
const cut=(a,b,from=0)=>{const i=src.indexOf(a,from);assert.ok(i>=0,'source moved: '+a);const j=src.indexOf(b,i);assert.ok(j>i,'source moved: '+b);return src.slice(i,j+b.length);};
const setCam=cut('const setCamera=(pose:Pose)=>{','};\n'),holds=src.includes('const holds=(cp:CameraPose)')?cut('const holds=(cp:CameraPose)','};\n'):'';
const runM=cut('  private run(seconds:number','\n  }\n').replace('private run','run');
const loop=cut('    for(const j of Array.from(this.jobs)) {','\n    }\n');
const enterTick=cut("return this.run(ENTER_LEVEL_SHOT_S,token,p=>{this.noteCinematic();camTag('enter-level');",');\n').replace(/^return /,'');
const code=`class W{constructor(){this.jobs=new Set();}noteCinematic(){}get roomLook(){return {reset(){}};}get islandRail(){return {reset(){}};}
 ${runM}
 step(frameDt){${loop}}
 build(camera,track,token){let placed=null,placedN=-1;${holds}${setCam}const ENTER_LEVEL_SHOT_S=0.78;
  return {setCamera,play:()=>${enterTick}};}}
module.exports=W;`;
const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
function harness(){
 const writes=[];const director={fr:816,getTotalFrames(){return this.fr;}};const log={writes:0};
 const node={isValid:true,worldPosition:{x:0,y:0,z:0},worldRotation:{x:0,y:0,z:0,w:1}};const camera={node,fov:45};
 const apply=(cam,p,source)=>{node.worldPosition={x:p.position[0],y:p.position[1],z:p.position[2]};node.worldRotation={x:p.rotation[0],y:p.rotation[1],z:p.rotation[2],w:p.rotation[3]};cam.fov=p.fovVerticalDeg;log.writes++;writes.push({fr:director.fr,source,pos:p.position});return true;};
 let tag='';const m={exports:{}};
 new Function('module','director','applyCameraPose','cameraWriteLog','toCameraPose','Camera','camTag','Cancelled',js)(m,director,apply,log,p=>p,{FOVAxis:{VERTICAL:0}},n=>{tag=n;},class extends Error{});
 return {W:m.exports,writes,director,apply,camera,tagOf:()=>tag};
}
const Q=(q=>{const l=Math.hypot(...q);return q.map(x=>x/l);})([-0.146,0.131,0.0195,0.98]);const P0={position:[-12,15.5,48],rotation:Q,fovVerticalDeg:42},P1={position:[-11.1,14.4,45.6],rotation:P0.rotation,fovVerticalDeg:36};
const lerp=(a,b,p)=>a.map((x,i)=>x+(b[i]-x)*p);
const token={check(){},onCancel(){return ()=>{};}};
{const h=harness(),w=new h.W();
 const samples=[];const track={tick:p=>{samples.push(p);h.apply(h.camera,{position:lerp(P0.position,P1.position,p),rotation:P0.rotation,fovVerticalDeg:P0.fovVerticalDeg+(P1.fovVerticalDeg-P0.fovVerticalDeg)*p},'world.enterLevel');}};
 const lease=w.build(h.camera,track,token);
 h.apply(h.camera,P0,'world.animateCamera');            // fr 816: island walk track ends on path[0]
 h.director.fr=817;lease.setCamera({...P0});             // fr 817: restore() re-places the shown pose
 lease.play();                                           // fr 817: enter-level starts (tick(0))
 w.step(Math.min(0.6,0.1));                              // fr 817: the stalled frame's update, still no draw
 const f817=h.writes.filter(x=>x.fr===817);
 assert.equal(f817.length,1,'fr 817 has '+f817.length+' camera writes ('+f817.map(x=>x.source).join(', ')+'); exactly one writer allowed');
 assert.equal(samples[0],0,'first enter-level sample p='+samples[0]+' (must be 0)');
 assert.deepEqual(f817[0].pos,P0.position,'fr 817 writes '+f817[0].pos+' not path[0]');
 assert.ok(samples.every(p=>p===0),'shot advanced before the first draw: '+samples.join(','));
 h.director.fr=818;w.step(1/60);assert.ok(samples[samples.length-1]>0&&samples[samples.length-1]<0.05,'clock must start on fr 818: p='+samples[samples.length-1]);
 for(let i=0;i<200&&w.jobs.size;i++){h.director.fr++;w.step(1/60);}assert.equal(samples[samples.length-1],1,'shot never completed');
 console.log('ok   stall before first draw: fr 817 = 1 write (path[0], p=0); clock starts on fr 818; shot completes');}
{const h=harness(),w=new h.W(),lease=w.build(h.camera,{tick(){}},token);// stable pose differs from the live camera: still written
 h.apply(h.camera,P1,'x');h.director.fr=900;lease.setCamera({...P0});assert.equal(h.writes.filter(x=>x.fr===900).length,1,'stable pose not written when camera elsewhere');
 h.camera.fov=50;h.director.fr=901;lease.setCamera({...P0});assert.equal(h.writes.filter(x=>x.fr===901).length,1,'fov-only change must write');
 console.log('ok   restore still writes when the live camera is elsewhere (pose or fov)');}
console.log('enter-level-single-writer: PASS');
