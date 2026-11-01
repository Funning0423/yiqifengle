'use strict';
// b17: 「主页」 while her lakeside exit walk (walk tail) still runs. Order must be: cover fades to full black -> journey
// release ends the tail (TailToken cancel + endTail, synchronous) -> the same-tick restore places her at home
// (cancelAndReset NOT skipped by a stale __qfWalkTail) -> cover fades back in. The 7b9ba1d6 build left the mark set until a
// microtask later, so restore() skipped her: home showed without her and no reset happened under the black. Node only.
const assert=require('node:assert/strict'),fs=require('node:fs');
const H=require('../board-ui/harness.cjs').createHarness();
const T=H.load('region/WalkTail.ts'),{runHomeTransition,HOME_FADE}=H.load('world-r2/HomeTransition');
const HOME={kind:'seated',controllerRoot:[0,0,0],yawRad:0};
function actor(){const a={pos:[5,0,5],job:null,resets:[],
 perform(action,tk){return new Promise((ok,bad)=>{const j={ok,bad};a.job=j;tk.onCancel(()=>{if(a.job===j){a.job=null;bad(Error('cancelled'));}});});},
 cancelAndReset(p){a.resets.push(p);if(a.job){const j=a.job;a.job=null;j.bad(Error('reset'));}a.pos=p.controllerRoot.slice();}};return a;}
// WorldFlowCore.restore (stable home), reduced to the guarded line
const flowRestore=a=>{if(!a.__qfWalkTail)a.cancelAndReset(HOME);};
(async()=>{
 // 1) endTail is synchronous and only clears an existing mark
 const a=actor(),tk=new T.TailToken();const tail=(async()=>{await a.perform({kind:'walk'},tk);})();T.beginTail(a,tail,[9,0,9]);
 assert.ok(a.__qfWalkTail,'tail marked');
 const tailStop=()=>{tk.cancel();T.endTail(a);};
 // 2) the transition: act (returnToIsland -> release -> tailStop; then restore) only runs once the cover is fully black
 let now=0,alpha=0;const log=[];
 const host={now:()=>now,wait:s=>new Promise(()=>{}),
  cover:(to,s)=>{log.push(['cover',to,s]);now+=s;alpha=to;},audioOut(){},audioIn(){},audioRestore(){},
  act:async()=>{log.push(['act',alpha]);tailStop();flowRestore(a);log.push(['placed',alpha,a.resets.length]);return {ok:true};},state:()=>'home'};
 const r=await runHomeTransition(host,HOME_FADE);
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.deepEqual(log[0],['cover',1,HOME_FADE.outS]);
 assert.deepEqual(log[1],['act',1],'act only under a full-black cover');
 assert.deepEqual(log[2],['placed',1,1],'she is placed at home while the cover is black (reset not skipped)');
 assert.deepEqual(log[3],['cover',0,HOME_FADE.inS]);
 assert.ok(HOME_FADE.outS>=.3&&HOME_FADE.outS<=.5&&HOME_FADE.inS>=.3&&HOME_FADE.inS<=.5);
 assert.deepEqual(a.pos,[0,0,0]);assert.equal(a.__qfWalkTail,undefined);
 await tail.catch(()=>{});await new Promise(r=>setImmediate(r));assert.equal(a.resets.length,1,'the cancelled tail never resets her again');
 // 3) without endTail (7b9ba1d6) the same-tick restore was skipped: guard against regressions
 const b=actor(),tk2=new T.TailToken();const t2=(async()=>{await b.perform({},tk2);})();T.beginTail(b,t2,[1,0,1]);tk2.cancel();flowRestore(b);
 assert.equal(b.resets.length,0,'reference: the stale mark skips the reset');await t2.catch(()=>{});
 // 4) endTail on an actor without a tail is a no-op; a tail still running keeps protection (walk-tail untouched)
 const c=actor();T.endTail(c);T.endTail(null);const tk3=new T.TailToken();T.beginTail(c,(async()=>{await c.perform({},tk3);})(),[0,0,0]);flowRestore(c);assert.equal(c.resets.length,0,'running tail still protected');tk3.cancel();
 // 5) the adapter's owner stop is synchronous
 const src=fs.readFileSync(__dirname+'/../../creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts','utf8');
 assert.match(src,/tailStop=\(\)=>\{(?:released=true;)?tailToken\.cancel\(\);endTail\(actor\);\}/)/* b16 P1-3a: released marks a journey release (no walkable snap) */;
 console.log(JSON.stringify({ok:true,log}));
})().catch(e=>{console.error(e);process.exit(1);});
