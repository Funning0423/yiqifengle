'use strict';
// Actual WorldFlow methods with a level lease double; no device/render claim.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const src=fs.readFileSync('creator-build-project/assets/scripts/world-r1/WorldFlowCore.ts','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const WorldFlow=vm.runInNewContext(stripTypeScriptTypes(src,{mode:'transform'})+';WorldFlow',{CameraTrackFailure:class extends Error{}});
const rows=[];
for(const settled of [true,false]){
 let shows=0,resumes=0;const events=[];
 const flow=Object.create(WorldFlow.prototype);
 Object.assign(flow,{state:'paused',stable:'level',mode:'motion',hidden:true,needsResume:true,error:null,world:null,
 level:{showPaused(){shows++;},isSettledResult:()=>settled,resume(){resumes++;return {ok:true};}},
 characterReady:()=>true,emit:s=>events.push(s),restore(){},change(state){this.state=state;this.emit(this.snapshot());}});
 for(let i=0;i<5;i++){
  flow.hidden=true;flow.needsResume=true;flow.state='paused';flow.show();
  assert.equal(flow.snapshot().hidden,false);
  assert.equal(flow.snapshot().needsResume,!settled,settled?'Settled reward page must return without world pause gate':'Playing attempt must require explicit resume');
  assert.equal(flow.snapshot().state,settled?'level':'paused');flow.show();
 }
 assert.equal(shows,5);assert.equal(resumes,0,'Returning result must not issue a gameplay resume');
 if(!settled){assert(flow.resume().ok);assert.equal(resumes,1);assert.equal(flow.snapshot().needsResume,false);}
 rows.push({settled,duplicateShowsIdempotent:true,cycles:5,gameplayResumeDuringShow:0,events:events.length});
}
console.log(JSON.stringify({status:'PASS',scope:'Production WorldFlow show/resume methods; lease double. No Cocos UI, native wx lifecycle or physical lockscreen acceptance.',rows},null,2));
