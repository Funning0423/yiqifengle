'use strict';
// b15 qaShot lakeside: route timing (journey-invalid-timing fix), reveal pose, phases, wiring. Node only.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const B=H.load('region/LakesideBalloon.ts'),LC=H.load('region/LakesideCameraLayout.ts'),BL=H.load('ui/BoardLayout.ts'),C=H.load('world-r1/RegionJourneyCore.ts'),Q=H.load('region/LakesideQaShot.ts');
const out={};
// 1) the summarised skycity → lakeside route timing passes journeyTimingOk (b15 7b0c1c90 failed: accel 3.65 > 3)
const L=LC.lakesideJourney([2,.58,63.2]);L.landing=LC.lakesideRouteLanding?LC.lakesideRouteLanding(L):L.landing;
const shore=L.arrival.at(-1),E=C.arrivalPose(L.arrival,L.focus,L.landing),land={position:E.position,target:E.target,fovVerticalDeg:L.landing.arrivalFovDeg};
const K=B.LAKESIDE_BALLOON_LANDING,m=B.lakesideBalloonMooring(shore,L.toWorld),R=B.lakesideBalloonRide([[2,.58,63.2],...K.walkLocal.slice(1).map(p=>L.toWorld([...p]))],L.toWorld([...K.launchLocal]),m.mooring,land);
const len=C.routeLength([...R.path,...m.walk]),T=R.T+m.timing.durationS;
const old={durationS:T,easeInS:K.walkEaseS,easeOutS:m.timing.easeOutS},fixed=B.lakesideRouteTiming(len,T,K.walkEaseS,m.timing.easeOutS);
out.timing={old:C.journeyTimingPeaks(len,old),oldOk:C.journeyTimingOk(len,old),fixed,fixedPeaks:C.journeyTimingPeaks(len,fixed)};
assert.equal(C.journeyTimingOk(len,fixed),true,'fixed lakeside route timing');assert.equal(fixed.durationS,T,'same duration');
assert(fixed.easeInS<=1.5&&fixed.easeOutS<=1.5,'ramps stay short');
// 2) phases
assert.equal(Q.lakesideQaPhase('walk'),'walk');assert.equal(Q.lakesideQaPhase('x'),'door');assert.equal(Q.lakesideQaPhase('reveal'),'reveal');
// 3) reveal pose from each portrait board lens (lake-local frame, her on the shore root, balloon at the mooring)
const o=L.toWorld([0,0,0]),zz=L.toWorld([0,0,1]),ly=Math.atan2(zz[0]-o[0],zz[2]-o[2]);
const toL=p=>{const d=[p[0]-o[0],p[1]-o[1],p[2]-o[2]],a=-ly;return [d[0]*Math.cos(a)+d[2]*Math.sin(a),d[1],-d[0]*Math.sin(a)+d[2]*Math.cos(a)];};
const her=toL(shore),moor=[...K.mooringLocal];
for(const [w,h] of [[390,844],[320,568],[390,520]]){const board=LC.lakesideAlignedLookAt(LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h)));
 const r=Q.lakesideRevealPose(board,her,moor,w/h);assert(r,`${w}x${h} reveal`);assert(r.maxNdc<=.98);
 assert(r.pose.fovVerticalDeg<=board.fovVerticalDeg+8+1e-9);out[w+'x'+h]={yawDeg:r.yawDeg,pitchDeg:r.pitchDeg,maxNdc:+r.maxNdc.toFixed(3),fov:+r.pose.fovVerticalDeg.toFixed(2)};}
// 4) wiring: qa-only entry, tail marks
const comp=fs.readFileSync('creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts','utf8'),ad=fs.readFileSync('creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts','utf8');
assert(/if\(MINIGAME\)return \{ok:false,reason:'player-build'\};\s*if\(spec\?\.region==='lakeside'\)return this\.qaShotLakeside/.test(comp),'lakeside entry after the player-build guard');
for(const k of ["lakesideDoorRideCamera(R,t,from)","lakesideDoorBlendPose(","qaMark('door')","qaMark('walk')","qaMark('shore')","qaMark0('out')","lakesideRouteTiming(","await out;","LAKESIDE_DOOR_HOLD.outM"])assert(ad.includes(k),k);

// 5) world-frame regression: the inputs logged from the 7b0c1c90 web build after the journey (Main Camera, her root, LakesideMooredBalloon)
{const cam={position:[16.6897,22.6533,132.6683],target:[18.1747,20.5556,142.3323],fovVerticalDeg:57.3526},r=Q.lakesideRevealPose(cam,[18.2397,19.6465,137.6432],[10.1345,19.6454,138.2321],390/844);
 assert(r&&r.maxNdc<=.98,'web-build lakeside reveal fits');assert(r.pose.fovVerticalDeg<=cam.fovVerticalDeg+8+1e-6);console.log('web',JSON.stringify({yawDeg:r.yawDeg,pitchDeg:r.pitchDeg,maxNdc:+r.maxNdc.toFixed(3),fov:+r.pose.fovVerticalDeg.toFixed(2)}));}
// 6) door hold: the basket lens is held until she is LAKESIDE_DOOR_HOLD.outM out (≥ door opening + step-out), and the
//    board still has ≥ 5 s of her offscreen walk to fade in over
{const DH=B.LAKESIDE_DOOR_HOLD,v=m.length/m.walkS,outAt=m.walkStartAt+DH.outM/v;assert(DH.outM>=1.4,'clear of the basket');
 assert(outAt>m.walkStartAt&&outAt>m.T0+.333+.5,'held through the door opening');
 const doorLens=B.lakesideDoorRideCamera(R,R.T,null),blendS=B.lakesideDoorBlendS(doorLens,land);
 assert(m.walkStartAt+m.walkS-outAt-blendS>=5,'board fade overlaps the offscreen walk');
 // the held lens frames the basket at touchdown (basket centre + door within the frame), unlike the old landing pose
 const FLb=require('../journey-integration/journey-framing-lib.cjs'),bk=R.vehicle(R.T),bc=[bk[0],bk[1]+.6,bk[2]],nd=FLb.ndc(doorLens,bc);
 assert(nd&&Math.abs(nd[0])<.9&&Math.abs(nd[1])<.9,'basket on screen in the door lens: '+JSON.stringify(nd));
 // continuous: the door lens equals the ride lens just before T (no cut at the hold)
 const pre=B.lakesideDoorRideCamera(R,R.T-1/60,null);assert(Math.hypot(...pre.position.map((x,i)=>x-doorLens.position[i]))<.2,'no jump into the hold');
 const blendPeak=5.7735*Math.hypot(...doorLens.position.map((x,i)=>x-land.position[i]))/(blendS*blendS);assert(blendPeak<=3+1e-9,'blend accel');
 out.doorHold={outM:DH.outM,outAtS:+outAt.toFixed(2),blendS:+blendS.toFixed(2),handoverS:+(outAt+blendS).toFixed(2),walkLeftAfterS:+(m.walkStartAt+m.walkS-outAt-blendS).toFixed(2),basketNdc:nd.map(x=>+(+x).toFixed(2)),blendAccel:+blendPeak.toFixed(2)};}
// 7) occlusion + composition on the web-build inputs: a canopy sphere in front of the envelope (where the 7b0c1c90 render showed one)
{const cam={position:[16.6897,22.6533,132.6683],target:[18.1747,20.5556,142.3323],fovVerticalDeg:57.3526},feet=[18.4345,19.6533,139.3320],bal=[10.1345,19.6454,138.2321];
 const plain=Q.lakesideRevealPose(cam,feet,bal,390/844);assert(plain&&plain.occludedFrac===0);
 const E=[bal[0],bal[1]+8.5,bal[2]],P0=plain.pose.position,C=P0.map((x,i)=>x+(E[i]-x)*.3),R=.45,seg=(a,b)=>{const d=b.map((x,i)=>x-a[i]),L2=d[0]*d[0]+d[1]*d[1]+d[2]*d[2],t=Math.max(0,Math.min(1,((C[0]-a[0])*d[0]+(C[1]-a[1])*d[1]+(C[2]-a[2])*d[2])/L2));return Math.hypot(a[0]+d[0]*t-C[0],a[1]+d[1]*t-C[1],a[2]+d[2]*t-C[2])<R;};
 const S=Q.lakesideRevealSamples(feet,bal),blocked=S.filter(p=>seg(plain.pose.position,p)).length/S.length;assert(blocked>.03,'the synthetic canopy blocks the occlusion-free pick');
 const r=Q.lakesideRevealPose(cam,feet,bal,390/844,.98,seg);assert(r&&r.occludedFrac<=.03,'occluded angle rejected');
 assert(Math.abs(r.composition.centre)<=.35&&r.composition.emptyBelow<=.45,'balanced, little empty foreground');
 out.occlusion={blockedPlain:+blocked.toFixed(3),pick:{yawDeg:r.yawDeg,pitchDeg:r.pitchDeg,occ:+r.occludedFrac.toFixed(3),centre:+r.composition.centre.toFixed(3),emptyBelow:+r.composition.emptyBelow.toFixed(3)}};}
console.log(JSON.stringify(out));console.log('PASS lakeside qaShot: route timing, phases, reveal pose, wiring');
