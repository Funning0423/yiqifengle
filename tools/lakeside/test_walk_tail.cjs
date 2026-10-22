'use strict';
// b15 handover: while her lakeside exit walk (the "walk tail") still runs under the board (board input enabled), every
// player path — tap, match/clear, level start, level complete, exit level, re-enter, pause/resume — must leave her walk
// alone: continuous position (step <= v*dt + eps), one walk completion, 'shore' once, board state untouched. Node only.
const assert=require('node:assert/strict'),fs=require('node:fs');
const H=require('../board-ui/harness.cjs').createHarness();
const T=H.load('region/WalkTail.ts'),C=H.load('world-r1/RegionJourneyCore.ts'),P=H.load('region/RegionNodePlay.ts');
const V=.8,DT=1/60,EPS=1e-6,out={};
const path=[[0,0,0],[3,0,0],[3,0,4]],len=7,walkS=len/V,end=path[2];
function at(d){if(d<=3)return [d,0,0];return [3,0,Math.min(4,d-3)];}
function actorSim(){
 const a={pos:[0,0,0],visible:true,job:null,completions:0,resets:[],performs:0,log:[],
  perform(action,token){a.performs++;if(a.job)a.job.fail(Error('superseded'));return new Promise((ok,bad)=>{const job={d:0,ok,fail:bad,action};a.job=job;
   token&&token.onCancel&&token.onCancel(()=>{if(a.job===job){a.job=null;bad(Error('cancelled'));}});});},
  cancelAndReset(p){a.resets.push(p);if(a.job){const j=a.job;a.job=null;j.fail(Error('reset'));}a.pos=p.controllerRoot.slice();},
  setVisible(v){a.visible=v;},
  tick(dt){const j=a.job;if(j&&j.action.kind==='walk'&&j.action.path===path){j.d=Math.min(len,j.d+V*dt);a.pos=at(j.d);if(j.d>=len){a.job=null;a.completions++;j.ok();}}
   else if(j&&j.action.kind==='walk'){a.job=null;j.ok();}a.log.push({p:a.pos.slice(),vis:a.visible});}};
 return a;}
// the adapter's tail, reduced: own TailToken (ride token only aborts it before the ride resolved), 'shore' once at the end
function startTail(a,rideToken){const tk=new T.TailToken();let rideOver=false;rideToken.onCancel(()=>{if(!rideOver)tk.cancel();});
 const marks=[];const tail=(async()=>{await a.perform({kind:'walk',path,duration:walkS},tk);tk.check();marks.push('shore');
  a.cancelAndReset({kind:'standing',controllerRoot:end.slice(),yawRad:0});})();
 const lease={tail};T.beginTail(a,tail,end);tail.catch(()=>{}).then(()=>{if(lease.tail===tail)lease.tail=null;});
 return {tail,marks,lease,rideOver:()=>{rideOver=true;},stop:()=>tk.cancel()};}
function token(){const l=[];return {cancelled:false,onCancel(f){l.push(f);return ()=>{};},cancel(){this.cancelled=true;l.splice(0).forEach(f=>f());},check(){}};}
const restore=(a,lease,visible)=>C.RegionJourneyController.prototype.restore.call({root:{},lease,camera:null,position:()=>({kind:'standing',controllerRoot:end.slice(),yawRad:0}),show(){}},a,{setCamera(){}},visible);
const flush=()=>new Promise(r=>setImmediate(r));
async function run(name,events){
 const a=actorSim(),ride=token(),s=startTail(a,ride);s.rideOver();
 const board={taps:0,cleared:0,level:null,frozenAt:null};const boardBefore=JSON.stringify(board);let rewardStartedAt=null,rewardDone=false;
 for(let f=0;f<Math.ceil(walkS/DT)+90;f++){
  const ev=events[f];if(ev)await ev({a,s,ride,board,f,setReward:(p)=>{p.then(()=>{rewardDone=true;});}, mark:()=>{rewardStartedAt=f;}});
  a.tick(DT);await flush();}
 await flush();await flush();
 let maxStep=0;for(let i=1;i<a.log.length;i++){const p=a.log[i-1].p,q=a.log[i].p,d=Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]);if(a.log[i].vis&&a.log[i-1].vis)maxStep=Math.max(maxStep,d);}
 assert(maxStep<=V*DT+EPS,`${name}: per-frame step ${maxStep} > v*dt`);
 assert.equal(a.completions,1,`${name}: one walk completion`);assert.deepEqual(s.marks,['shore'],`${name}: shore once`);
 const last=a.log[a.log.length-1].p;assert(Math.hypot(last[0]-end[0],last[2]-end[2])<1e-9,`${name}: ends on the stand point`);
 assert(a.resets.every(r=>Math.hypot(r.controllerRoot[0]-end[0],r.controllerRoot[2]-end[2])<1e-9),`${name}: no reset off the stand point`);
 assert.equal(T.tailOf(a),null,`${name}: tail released`);
 out[name]={maxStep:+maxStep.toFixed(5),cap:+(V*DT).toFixed(5),resets:a.resets.length,performs:a.performs};
 return {a,board,boardBefore,rewardStartedAt};}
(async()=>{
 const mid=Math.floor(walkS/DT/2);
 // tap / match / clear: board-only state changes, never touch her
 {const r=await run('tap+match',{[mid-30]:({board})=>{board.taps++;},[mid]:({board})=>{board.taps++;board.cleared+=3;}});
  assert.deepEqual({taps:r.board.taps,cleared:r.board.cleared},{taps:2,cleared:3},'board state is exactly what the taps did');}
 // level start (flow restore, hidden) and exit level (restore, visible) mid-walk; pause cancels the old flow token
 {const r=await run('level enter+exit',{[mid-40]:({a,s})=>restore(a,s.lease,false),[mid+20]:({a,s})=>restore(a,s.lease,true),[mid+25]:({ride})=>ride.cancel()});}
 // re-enter: exit then a second level start before she arrives, then a third restore after she arrived
 {const r=await run('re-enter',{[mid-40]:({a,s})=>restore(a,s.lease,false),[mid-10]:({a,s})=>restore(a,s.lease,true),[mid]:({a,s})=>restore(a,s.lease,false),[mid+30]:({a,s})=>restore(a,s.lease,true)});}
 // level complete mid-walk: the reward walk waits for the tail (no cut, no re-walk); it starts only after she arrived
 {let started=null,doneF=null;const n=Math.ceil(walkS/DT);
  const r=await run('level complete',{[mid]:({a})=>{T.afterTail(a).then(()=>{started=a.log.length;});}});
  assert(started!==null&&started>=n-2,'reward waits for the tail: started at frame '+started+' of '+n);out['level complete'].rewardStartFrame=started;}
 // runRewardWalk itself waits (real module): no perform/reset before the tail ends
 {const a=actorSim(),s=startTail(a,token());s.rideOver();let first=null;const wrap={perform:(x,t)=>{if(first===null)first=a.log.length;return Promise.resolve();},cancelAndReset:(p)=>{if(first===null)first=a.log.length;}};
  T.beginTail(wrap,s.tail,end)/* the adapter registers the same actor object the flow passes */;const p=P.runRewardWalk(wrap,'mainline-01','mainline-02').catch(()=>{});for(let f=0;f<Math.ceil(walkS/DT)+10;f++){a.tick(DT);await flush();}await p;
  assert(first===null||first>=Math.ceil(walkS/DT)-1,'runRewardWalk touched her mid-tail at '+first);out.runRewardWalk={firstTouch:first};}
 // leaving the region: the journey owner ends the tail (release); only then may a reset happen
 {const a=actorSim(),s=startTail(a,token());s.rideOver();for(let f=0;f<60;f++){a.tick(DT);await flush();}s.stop();await flush();await flush();
  assert.equal(T.tailOf(a),null);assert.deepEqual(s.marks,[],'released: no shore mark');restore(a,{tail:null},false);assert.equal(a.resets.length,1,'reset after release');}
 // wiring: every flow reset site is tail-aware
 const src=f=>fs.readFileSync('creator-build-project/assets/scripts/'+f,'utf8');
 assert(/characterReady\(\)&&!\(this\.character as any\)\.__qfWalkTail\)this\.character!\.cancelAndReset/.test(src('world-r1/WorldFlowCore.ts')));
 assert.equal((src('world-r1/RegionJourneyCore.ts').match(/!\(actor as any\)\.__qfWalkTail\)actor\.cancelAndReset/g)||[]).length,3);
 assert(/async playReward\([^)]*\)\{\n  await \(character as any\)\.__qfWalkTail\?\.done/.test(src('world-r2/RegionNodeStage.ts')));
 assert(/async playFinale\([^)]*\)\{\n  await \(character as any\)\.__qfWalkTail\?\.done/.test(src('world-r2/RegionNodeStage.ts')));
 assert((src('world-r2/WorldNativeComposition.ts').match(/await \(this\.boundCharacter as any\)\.__qfWalkTail\?\.done/g)||[]).length===2);
 const ad=src('region/RegionJourneyAdapter.ts');assert(/const rideToken=tailToken as any as Cancellation;/.test(ad)&&/beginTail\(actor,tail,/.test(ad)&&/dead=true;tailStop\(\);/.test(ad)&&/rideOver=true;/.test(ad));
 console.log(JSON.stringify(out));console.log('PASS walk tail: tap/match/level enter/exit/re-enter/complete/pause keep her walk continuous; shore once');
})().catch(e=>{console.error(e);process.exit(1);});
