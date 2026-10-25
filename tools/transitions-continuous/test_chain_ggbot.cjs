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
const c0=r.cams[0];assert.deepEqual(c0.position,[5,3,5],'first frame = the live lens exactly (no cut)');
// P2 no hard cut / no empty frame: scenes shown before any frame, lens steps bounded while the ride writes its own pose
{const lease=mk(0);let shownAt=-1,calls=0;lease.show=v=>{if(v&&shownAt<0)shownAt=calls;};const orig=lease.ride;lease.ride=async(a,w)=>{let ft=1e6;const P=globalThis.performance;Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>ft}});for(let i=0;i<120;i++){calls++;ft+=1000/60;w.setCamera({position:[0,2,-3],target:[0,1,0],fovVerticalDeg:48});}Object.defineProperty(globalThis,'performance',{configurable:true,value:P});};
 const r2=await run(lease);assert.equal(shownAt,0,'journey scenes shown before the first ride frame');
 let maxStep=0;for(let i=1;i<Math.min(r2.cams.length,121);i++)maxStep=Math.max(maxStep,Math.hypot(...[0,1,2].map(j=>r2.cams[i].position[j]-r2.cams[i-1].position[j])));
 assert.ok(maxStep<0.2,'no hard cut: max lens step '+maxStep);out.handoff={maxStepM:+maxStep.toFixed(4),frames:r2.cams.length};}
// player anim probe
C.installPlayerAnimProbe({clock:{base:{clip:'walk_loop',loop:true,time:.3}},anim:{clips:[{name:'sit_hold'}],getState:()=>({isPlaying:false})}});
assert.equal(globalThis.__QF_PLAYER_ANIM.clip,'walk_loop');assert.deepEqual(globalThis.__QF_PLAYER_ANIM.engine,[]);
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
const D=C.BALLOON_DOOR;{const RD=H.load('region/BalloonFlight.ts').RIDE_DURATION;assert.ok(Math.abs(D.settleT1-RD)<1e-9&&Math.abs(D.settleT0-(RD-1))<1e-9,'settle = last 1 s of the ride clock');}assert.equal(C.doorAngleAt(0),0);assert.equal(C.doorAngleAt(D.openDelayS),0);
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
// 11 b19 staging data + duration table
const ST=H.load('region/TransitionStaging.ts'),tot=ST.segmentTotals();out.totals=tot;
const stances=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/transition-spaces/stances.json'),'utf8'));assert.ok(stances.segments['3_meadow_balloon_in']);
assert.deepEqual([...ST.TRANSITION_STAGING.basket.seat],[-0.032,0,0.099]);assert.equal(ST.TRANSITION_STAGING.basket.seatYawDeg,180);assert.deepEqual([...ST.TRANSITION_STAGING.basket.p0],[-0.03,0,-0.395]);assert.equal(ST.BASKET_RIDE_POSE.meadowSkycity.clip,'sit_hold');
// 12 compress (Grok Bot 2026-10-25): overlap-aware timeline within caps, actions untouched
{const TL=ST.transitionTimeline(),RT=ST.TRANSITION_RETIME,D=ST.TRANSITION_DURATIONS,tt=TL.totals;out.timeline=tt;
 assert.ok(tt.islandToMeadow<=RT.caps.islandToMeadow,'island→meadow '+tt.islandToMeadow);assert.ok(Math.abs(tt.islandToMeadow-44.57)<1e-6,'seg1/2 left as is');
 assert.ok(tt.meadowToSkycity<=RT.caps.meadowToSkycity,'meadow→skycity '+tt.meadowToSkycity);
 // skycity→lakeside recomputes from the real T-03 walk (mooring pending at 场景设计部): within cap, or flagged pending
 const LB=H.load('region/LakesideBalloon.ts');out.lakeWalkSource='TRANSITION_DURATIONS.seg5a.toBasket';
 const lk=tt.skycityToLakeside;out.lakeCap={total:lk,mooringPending:ST.TRANSITION_STAGING.skyMooring5a.pending,overBy:+(lk-RT.caps.skycityToLakeside).toFixed(2)};
 const opt=ST.TRANSITION_STAGING.skyMooring5a.option,cap=ST.skycityToLakesideCap(opt);out.lakeCap.option=opt;out.lakeCap.cap=cap;
 assert.equal(ST.skycityToLakesideCap('C'),50);assert.equal(ST.skycityToLakesideCap('pending'),null);
 const M5=ST.TRANSITION_STAGING.skyMooring5a;assert.equal(opt,'C');assert.equal(cap,50);out.lakeCap.provisional=M5.provisional;out.lakeCap.fits=lk<=cap;
 // her walk: natural 0.9 m/s, never sped up; seconds follow the (provisional) path; the in-basket turn is gone
 assert.equal(M5.walkMps,H.load('region/NodeWalker.ts').WALK_SPEED_MPS,'natural walk speed constant');assert.equal(M5.walkMps,1.2);assert.equal(D.seg5a.turn180,0);assert.equal(D.seg3.turn180,0,'no in-basket turn (meadow)');
 assert.equal(M5.provisional,false);assert.ok(Math.abs(ST.lakeBoardS()-3.56)<0.01,'boarding 3.56 s (场景设计部)');assert.ok(Math.abs(TL.beats.seg5a.find(b=>b.id==='toBasket').t1-M5.walkPathM/M5.walkMps)<0.01);
 assert.ok(lk<=cap,'skycity→lakeside '+lk+' over cap '+cap);
 const seg=(k,a,b)=>{const B=TL.beats[k],f=id=>B.find(x=>x.id===id);return +(f(b).t1-f(a).t0).toFixed(2);};
 out.measured={meadow:{boarding:seg('seg3','toBasket','sitDown'),flight:TL.beats.seg3.find(b=>b.id==='flight').t1-TL.beats.seg3.find(b=>b.id==='flight').t0,exit:tt.seg4,total:tt.meadowToSkycity},lake:{boarding:seg('seg5a','toBasket','sitDown'),flight:seg('seg5a','liftoff','flight'),exit:tt.seg5b,total:tt.skycityToLakeside}};
 // two-door lakeside exit: provisional block, legacy single door until the model is in
 {const LB=H.load('region/LakesideBalloon.ts'),BD=LB.BASKET_DOORS;assert.equal(BD.exit.wallSign,-1);assert.notEqual(BD.exit.node,BD.entry.node);
  assert.equal(BD.modelReady,true,'door2 model in');const xl=LB.lakesideExitDoor({...BD,modelReady:false}),xr=LB.lakesideExitDoor();assert.equal(xl.legacy,true);assert.equal(xr.legacy,false);assert.equal(xr.node,'basket_door_b');assert.deepEqual([...xr.startLocal],[-.03,0,-.395]);
  const tw=p=>p,m0=LB.lakesideBalloonMooring([0,0,10],tw,.7,xl),m1=LB.lakesideBalloonMooring([0,0,10],tw,.7,xr);
  assert.ok(Math.hypot(m0.start[0]-m1.start[0],m0.start[2]-m1.start[2])<0.07,'exit P0 on the exit-heading side either way');assert.ok(Math.abs(((m1.doorYawDeg-m0.doorYawDeg)%360+360)%360-180)<1e-6,'basket turned 180° so the exit door faces her heading');
  assert.ok(/find\(vehicle,moored\.exitDoorNode\)/.test(adp),'lakeside get-out animates the exit leaf');out.exitDoor={provisional:BD.provisional,modelReady:BD.modelReady};}
 // visible lake flight ≥ 8 s; meadow flight shortened from 30
 assert.ok(D.seg5a.flight>=8&&D.seg5a.flight===RT.lakeFlightS);assert.ok(D.seg3.flight<30&&D.seg3.flight===RT.meadowRideS);
 // overlaps: inflate inside the walk, no ignition wait after she sits, no dead pause after stand_up, door close inside sit_down
 const b3=Object.fromEntries(TL.beats.seg3.map(b=>[b.id,b]));assert.ok(b3.inflate.t0<b3.toBasket.t1&&b3.inflate.t1<=b3.sitDown.t1,'meadow inflate overlaps the walk');
 assert.equal(TL.igniteAfterSit.meadow,0);assert.equal(TL.igniteAfterSit.lake,0);assert.equal(D.seg4.pause,0);assert.equal(D.seg5b.pause,0);
 assert.ok(b3.doorClose.t0>=b3.sitDown.t0&&b3.doorClose.t1<=b3.sitDown.t1+1e-9&&b3.doorClose.t1<=b3.flight.t0+1e-9);
 assert.ok(b3.settle.t1===b3.flight.t1,'settle inside the flight (not added again)');
 const b5=Object.fromEntries(TL.beats.seg5a.map(b=>[b.id,b]));assert.ok(b5.inflate.t0<b5.sitDown.t0&&b5.inflate.t1>=b5.sitDown.t1-1e-9&&b5.inflate.t1<=b5.liftoff.t0+1e-9,'lake ignition overlaps sit_down, full before liftoff');
 // her actions keep natural speed: action beats identical to 59aa0bbc (b19 seconds), walk speeds unchanged
 const OLD={seg1:{nodeWalkI4toI6:15.6,a1DockWalk:3.0,a2Gangway:2.3,sitDown:1.2},seg2:{dockSettle:2.0,standUp:1.27,offBoat:2.7,jettyToM1:16.5},
  seg3:{toBasket:5.7,doorReach:1.8,intoBasket:2.6,sitDown:1.2,inflate:3.0},seg4:{settle:1.5,standUp:1.27,doorReach:1.8,stepDown:1.73,toPath:7.5},
  seg5a:{doorReach:1.8,sitDown:1.2,inflate:3.0},seg5b:{settle:1.5,standUp:1.27,doorReach:1.8,stepDown:1.73,walkOut:7.7}};
 for(const [sg,v] of Object.entries(OLD))for(const [k,x] of Object.entries(v))assert.equal(D[sg][k],x,'action '+sg+'.'+k+' unchanged (clip speed 1.0×)');
 assert.equal(ST.TRANSITION_STAGING.walkMps,0.9);assert.equal(ST.TRANSITION_STAGING.basketWalkMps,0.8);
 assert.ok(/inflateT<INFLATE\.durationS&&envHome\)\{if\(!inflateMarked\)/.test(bal),'B1 walk drives the inflate');
 assert.ok(/flightS:TRANSITION_RETIME\.lakeFlightS/.test(adp)&&/inflateTau0=/.test(adp),'lakeside retime + inflate during walk wired');}
assert.ok(/kind:'stand',seat:seatDef/.test(bal)&&/guardBeforeWalk\(anim,'B5 stand up'\)/.test(bal),'B5 stands up (guarded) before walking');
// 13 T-02 → seg 5 departure: gaze ≥ 2 s, cancel before walk, no interrupt after, 继续旅程 path
{const SD=H.load('region/SkyFinaleDeparture.ts');assert.ok(SD.finaleAutoContinueAtS(1.4)-1.4>=2-1e-9&&SD.finaleAutoContinueAtS(2.1)-2.1>=2-1e-9);
 let went=0;const a=new SD.FinaleDeparture(()=>went++);for(let i=0;i<600&&!went;i++)a.step(1/60);
 assert.equal(went,1);assert.equal(a.startedBy,'auto');assert.ok(a.gazedS()>=2-1e-6,'gazed '+a.gazedS());
 assert.equal(a.gesture('drag'),true,'drag after the walk started is swallowed');a.step(5);a.button();assert.equal(went,1,'walk not restarted / interrupted');
 const b=new SD.FinaleDeparture(()=>went++);b.step(1.0);assert.equal(b.gesture('tap'),false);for(let i=0;i<1200;i++)b.step(1/60);
 assert.equal(b.state,'held');assert.equal(went,1,'input before the walk cancels auto-continue: she keeps gazing');
 b.button();assert.equal(b.state,'walking');assert.equal(b.startedBy,'button');assert.equal(went,2,'继续旅程 starts the turn + walk');
 const c=new SD.FinaleDeparture(()=>went++);c.step(2.5);c.gesture('pinch');c.step(10);assert.equal(went,2,'pinch during the gaze also holds');
 const stg=src('world-r2/RegionNodeStage.ts');assert.ok(/finaleAutoContinueAtS\(this\.finaleApproachS\)\*1000/.test(stg),'stage auto-continue = ease-in + gaze');
 assert.ok(/onGesture\(gesture:Gesture,x:number,y:number\)\{\n  if\(\(this as any\)\.finaleDeparting\?\.\(\)\)return/.test(stg)&&/finaleDeparting\(now=Date\.now\(\)\)\{return SKY_DEPARTURE\.ignoreGesturesAfterWalk&&/.test(stg),'stage swallows gestures once she departs');
 assert.ok(/stage\?\.markFinaleDeparture\?\.\(\)/.test(comp),'auto and 继续旅程 both mark the departure (continueFromSkyFinale)');
 assert.ok(comp.includes('continueJourney(){return this.skyFinaleActive()?this.continueFromSkyFinale()'),'继续旅程 button kept');
 assert.ok(fs.existsSync(path.join(ROOT,'creator-build-project/assets/scripts/region/SkyFinaleDeparture.ts.meta'))&&!/@ccclass\(/.test(src('region/SkyFinaleDeparture.ts')));
 out.departure={autoContinueAtS:SD.finaleAutoContinueAtS(1.4),gazeS:+a.gazedS().toFixed(2),wasS:6.9};}
console.error=ce;console.warn=cw;console.log(JSON.stringify({ok:true,...out}));
})().catch(e=>{console.error=ce;console.warn=cw;console.error(e);process.exit(1);});
