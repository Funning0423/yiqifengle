'use strict';
// GGbot transitions-continuous: chain order, 3 s logged fallback (no loading card), inflate, door after settle, anim guards,
// preload plan + calls, sky-finale registration. Harness-compiled TS, no engine; source checks for cc-side wiring.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),C=H.load('region/TransitionChain.ts'),J=H.load('world-r1/RegionJourneyCore.ts'),SC=H.load('world-r1/ScreenCover.ts'),REG=H.load('region/SkyLakeRegister.ts');
const ROOT=path.resolve(__dirname,'../..'),src=f=>fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts',f),'utf8');
const out={};const errs=[],warns=[];const ce=console.error,cw=console.warn;console.error=(...a)=>{errs.push(a.join(' '));};console.warn=(...a)=>{warns.push(a.join(' '));};
(async()=>{
// 1 segment order
C.resetChainTrace();for(const s of C.CHAIN_SEGMENTS.sail)assert.ok(C.chainMark('sail',s));
assert.ok(C.chainOrderOk('sail',C.chainEvents('sail').map(e=>e.seg)));
assert.equal(C.chainMark('balloon','B3-flight'),false,'out-of-order flagged');
assert.deepEqual(C.CHAIN_SEGMENTS.balloon,['B1-basket-in','B2-ignite-inflate','B3-flight','B4-settle','B5-door-walk-out']);
// 2 fallback only after 3 s, logged with warn
assert.equal(C.fallbackDecision(2.99,false),'wait');assert.equal(C.fallbackDecision(3,false),'fallback');assert.equal(C.fallbackDecision(10,true),'go');
C.resetChainTrace();
// 3 controller: continuous ride, no cover / no card when ready
const contents=[];SC.setCoverContentHost(c=>contents.push(c));
const mk=(readyAfter)=>{let calls=0;const lease={route:{from:'island',to:'meadow',path:[[0,0,0],[0,0,5]],bridgeStart:1,bridgeEnd:2,speed:1.2,startBlendM:0},
  startPose:()=>({position:[0,2,-3],target:[0,1,0],fovVerticalDeg:48}),show(){},dispose(){},ready:()=>++calls>readyAfter,ride:async(a,w)=>{w.setCamera({position:[0,2,-3],target:[0,1,0],fovVerticalDeg:48});lease.rode=true;}};return lease;};
const run=async(lease)=>{const fades=[],cams=[];let waited=0;
 const ctl=new J.RegionJourneyController({prepare:async()=>lease,readCamera:()=>({position:[5,3,5],target:[0,1,0],fovVerticalDeg:45})});
 const tok={cancelled:false,check(){},wait:p=>p,onCancel:()=>()=>{}};
 const world={setCamera:p=>cams.push(p),fadeCover:(a,s)=>{fades.push([a,s]);},wait:async(s)=>{waited+=s;}};
 const actor={walkProgress:()=>0,cancelAndReset(){},perform:async()=>{},setVisible(){}};
 await ctl.prepare('meadow',[0,0,0],tok);await ctl.walk(actor,world,tok);return {fades,cams,ctl,waited};};
let r=await run(mk(0));
assert.equal(r.fades.length,0,'no WindWipe on a ready continuous ride');assert.ok(contents.every(c=>c===null),'no loading card');
assert.equal(C.fallbackCount(),0);assert.ok(r.cams.length>0);
// the first written camera is the LIVE lens blend start (not the ride pose): continuous
const c0=r.cams[0];assert.ok(Math.hypot(c0.position[0]-0,c0.position[2]+3)>0.5,'blend starts at the live lens');
// 4 slow lease: waits visibly, fallback only after 3 s, warn not error, content null
r=await run(mk(1e9));
assert.equal(C.fallbackCount(),1,'one logged trigger');assert.ok(r.waited>=3-1e-6&&r.waited<3.1,'waited 3 s first: '+r.waited);
assert.ok(r.fades.some(f=>f[0]===1),'fallback cover');assert.ok(contents.every(c=>c===null),'fallback has no loading card');
assert.ok(warns.some(w=>w.includes('[QF_TRANSITION] WindWipe fallback')));assert.equal(errs.filter(e=>e.includes('QF_TRANSITION')).length,0);
out.fallback={waitedS:+r.waited.toFixed(3),count:C.fallbackCount()};
// 5 inflate curve
const I=C.INFLATE;assert.equal(I.durationS,3);const a=C.inflateAt(0),m=C.inflateAt(1.2),e=C.inflateAt(3);
assert.ok(a.sy<0.2&&a.sxz<0.6);assert.ok(Math.abs(e.sy-1)<1e-9&&Math.abs(e.sxz-1)<1e-9&&e.done);
assert.ok((m.sy-I.flatY)/(1-I.flatY)>(m.sxz-I.flatXZ)/(1-I.flatXZ),'vertical first');
let peak=0;for(let t=0;t<=3;t+=1/60){const f=C.inflateAt(t);peak=Math.max(peak,f.sy,f.sxz);assert.ok(f.flame>=0);}
assert.ok(peak>1&&peak<1.08,'slight rebound '+peak);assert.ok(C.inflateAt(.3).flame>C.inflateAt(3).flame,'burner bright while filling');
out.inflate={durationS:I.durationS,peak:+peak.toFixed(4)};
// 6 door after settle
const D=C.BALLOON_DOOR;assert.ok(D.settleT1>=30-1e-9&&D.settleT0===29);assert.equal(C.doorAngleAt(0),0);assert.equal(C.doorAngleAt(D.openDelayS),0);
assert.ok(Math.abs(C.doorAngleAt(D.openDelayS+D.openS)-D.openDeg)<1e-9);assert.ok(C.doorOpensAfterSettle());
// 7 anim guards
const st={isPlaying:true,stop(){this.isPlaying=false;}};assert.equal(C.guardBeforeWalk({clips:[{name:'sit_hold'},{name:'walk_loop'}],getState:n=>n==='sit_hold'?st:{isPlaying:false,stop(){}}},'t'),1);assert.equal(st.isPlaying,false);
const sail=src('region/SailRide.ts');for(const tag of ['A1 pier walk','A2 gangplank','A5 gangplank off','A6 meadow first stop'])assert.ok(sail.includes("guardBeforeWalk(anim0,'"+tag)||sail.includes("guardBeforeWalk(anim,'"+tag),'guard '+tag);
const bal=src('region/BalloonTransit.ts');for(const tag of ['B1 walk to basket','B1 step into basket','B5 walk out'])assert.ok(bal.includes(tag));
for(const s of C.CHAIN_SEGMENTS.balloon)assert.ok(bal.includes("'"+s+"'"),'balloon marks '+s);
const adp=src('region/RegionJourneyAdapter.ts');for(const s of C.CHAIN_SEGMENTS.lakeside)assert.ok(adp.includes("'"+s+"'"),'lakeside marks '+s);
assert.ok(/wipeOn=!contLake&&/.test(adp),'lakeside: no WindWipe boarding in continuous mode');
// 8 preload
assert.equal(C.preloadTargetForStage('mainline-04'),'meadow');assert.equal(C.preloadTargetForStage('mainline-08'),'skycity');assert.equal(C.preloadTargetForStage('mainline-12'),'lakeside');
const mb=k=>C.PRELOAD_PLAN[k].items.reduce((n,i)=>n+i.bytes,0)/1048576;out.preloadMB={meadow:+mb('meadow').toFixed(2),skycity:+mb('skycity').toFixed(2),lakeside:+mb('lakeside').toFixed(2)};
assert.ok(mb('meadow')<C.PRELOAD_MEMORY_BUDGET_MB+.5);
assert.ok(src('world-r2/WorldNativeComposition.ts').includes('preloadTargetForStage(selection.stageId)'));assert.ok(src('world-r1/WorldFlowComponent.ts').includes('warmTransition('));
// 9 sky finale: registration + auto-continue reaches the continuous segment
const comp=src('world-r2/WorldNativeComposition.ts');assert.ok(/registerSkyLakeContinuous\(this/.test(comp),'registered at start()');
const handlers=[];let entered=0;const host={onSkyFinaleContinue(h){handlers.push(h);return ()=>{};},enterMainline(){entered++;return Promise.resolve({ok:true});}};
REG.registerSkyLakeContinuous(host);
const cont=async(cam)=>{for(const h of handlers)if(h(cam)===true)return 'continuous';await host.enterMainline();return 'fallback';};// = continueFromSkyFinale
assert.equal(await cont({position:[0,1,2],target:[0,1,3],fovVerticalDeg:48}),'continuous');assert.equal(entered,1);
assert.ok(comp.includes("stage.armFinaleContinue?.(()=>{void this.continueFromSkyFinale();})"),'auto-continue calls continueFromSkyFinale');
// 10 no ccclass in new pure files, metas present
for(const f of ['TransitionChain','TransitionStaging','TransitionStagingMath','TransitionProps','TransitionPreload','SkyLakeRegister']){assert.ok(fs.existsSync(path.join(ROOT,'creator-build-project/assets/scripts/region',f+'.ts.meta')),f+' meta');assert.ok(!/@ccclass\(/.test(src('region/'+f+'.ts')));}
console.error=ce;console.warn=cw;console.log(JSON.stringify({ok:true,...out}));
})().catch(e=>{console.error=ce;console.warn=cw;console.error(e);process.exit(1);});
