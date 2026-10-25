'use strict';
// T-03 风铃湖畔 arrival (SPEC §6): sign timing/placement, skip badge window + seen flag, ride-skip API, WindWipe 'ride' wiring. Pure logic.
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness();const A=H.load('region/LakesideArrivalCore'),B=H.load('region/LakesideBalloon'),W=H.load('world-r2/WindWipeCore');
const S='creator-build-project/assets/scripts/',src=f=>fs.readFileSync(S+f,'utf8');let pass=0;const ok=m=>{pass++;console.log('PASS',m);};
(async()=>{
 const K=B.LAKESIDE_TOUCHDOWN;
 // 1 sign timing from the constants (not hard-coded): in 0.3, hold, out 0.3, total signS
 {const an=A.arrivalAnchor(10,'touchdown',K,{atS:21.3});assert.equal(an.signAtS,K.signAtS);assert.equal(an.signS,K.signS);
  assert.equal(A.signState(K.signAtS-.01,an).visible,false);const a=A.signState(K.signAtS+.15,an);assert(a.alpha>0&&a.alpha<1&&a.dy>0);
  assert.equal(A.signState(K.signAtS+1.5,an).alpha,1);assert.equal(A.signState(K.signAtS+K.signS+.01,an).done,true);
  const ev=A.arrivalAnchor(0,'touchdown',K,{signAtS:2.0,signS:2.5});assert.equal(ev.signAtS,2.0);assert.equal(ev.signS,2.5);
  const sk=A.arrivalAnchor(0,'skip',K);assert.equal(sk.signAtS,.3);
  assert(K.signAtS+K.signS+K.boardWithinS<=B.lakesideBoardByS()+1e-9);ok('sign: touchdown+'+K.signAtS+' for '+K.signS+' s (event can retime; skip reveal +0.3)');}
 // 2 placement: SPEC centre y 139 on 390×844 (capsule bottom 88); moves below when it would cover her / the balloon
 {const p=A.signPlacement(390,844,88);assert.equal(p.cy,139);assert.equal(p.cx,195);assert.equal(p.moved,'spec');
  const q=A.signPlacement(390,844,88,[{x:150,y:100,w:90,h:120}]);assert.equal(q.moved,'below');assert(!A.rectsOverlap(q.rect,{x:150,y:100,w:90,h:120}));
  const s=A.signPlacement(320,568,null);assert(s.cy>0&&s.rect.x>=16);ok('placement: 390×844 cy 139; avoids balloon/her rects');}
 // 3 skip badge: bottom-right 16/16, hit 88×48, window flight+3 → touchdown−1, never on first viewing
 {const p=A.skipPlacement(390,844,34);assert.equal(p.hit.x+p.hit.w,374);assert.equal(p.hit.y+p.hit.h,844-34-16);assert.equal(p.hit.w,88);assert.equal(p.hit.h,48);
  assert.equal(A.skipAlpha(10,5,21.3,false),0);assert.equal(A.skipAlpha(7.9,5,21.3,true),0);assert.equal(A.skipAlpha(12,5,21.3,true),1);assert.equal(A.skipAlpha(20.5,5,21.3,true),0);
  ok('badge: bottom-right 16 pt, 88×48 hit, only from 2nd viewing, flight+3 s … touchdown−1 s');}
 // 4 seen flag in the normal save
 {const m=new Map(),kv={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)};assert.equal(A.seenT03(kv),false);A.markSeenT03(kv);assert.equal(A.seenT03(kv),true);ok('seenT03 flag');}
 // 5 ride-skip API: one skip, only while skippable
 {let n=0;A.publishLakesideRide({t:12,flightAt:5,touchdownAt:21.3,skippable:true,landed:false,skipped:false});const off=A.registerLakesideRideSkip(async()=>{n++;});
  assert.equal(A.canSkipLakesideRide(),true);assert.equal((await A.runLakesideRideSkip()).ok,true);assert.equal((await A.runLakesideRideSkip()).ok,false);assert.equal(n,1);off();A.publishLakesideRide(null);
  assert.equal(A.canSkipLakesideRide(),false);ok('ride skip runs once (no double transition)');}
 // 6 skip under a WindWipe 'ride': work under full cover, reveal waits for the landed state
 {let t=0,landed=false,coverFullAt=-1,workAt=-1;const h={now:()=>t,wait:async s=>{t+=s;},frame:async()=>{t+=1/60;},cover:async(a,s)=>{t+=s;if(a===1)coverFullAt=t;}};
  const r=await W.runWindWipe(h,{kind:'ride',content:W.wipeContentFor('lakeside',true),work:async()=>{workAt=t;landed=true;},ready:()=>landed});assert(r.ok&&workAt>=coverFullAt);ok("skip runs under WindWipe kind 'ride'");}
 // 7 wiring (source): adapter registers skip + publishes ride + preloads the board at set-off; boot builds the UI with kind 'ride'
 {const ad=src('region/RegionJourneyAdapter.ts'),bt=src('WorldIntegrationBoot.ts');
  assert(/registerLakesideRideSkip\(/.test(ad)&&/publishLakesideRide\(/.test(ad)&&/arrivalMark\('ride-start'\);void preloadLakesideBoard\(\)/.test(ad));
  assert(/markSeenT03\(/.test(ad)&&/signAtS:LAKESIDE_TOUCHDOWN\.signAtS/.test(ad));assert(/new LakesideArrivalUI\(/.test(bt)&&/kind:'ride'/.test(bt));
  for(const f of ['region/LakesideArrivalCore.ts','ui/LakesideArrivalUI.ts'])assert(fs.existsSync(S+f+'.meta'),f+'.meta');ok('wiring + .meta');}
 console.log('t03-arrival: '+pass+' passed');
})().catch(e=>{console.error('FAIL',e&&e.stack||e);process.exit(1);});
