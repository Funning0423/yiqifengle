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
for(const k of ["qaMark('door')","qaMark('walk')","qaMark('shore')","lakesideRouteTiming("])assert(ad.includes(k),k);

// 5) world-frame regression: the inputs logged from the 7b0c1c90 web build after the journey (Main Camera, her root, LakesideMooredBalloon)
{const cam={position:[16.6897,22.6533,132.6683],target:[18.1747,20.5556,142.3323],fovVerticalDeg:57.3526},r=Q.lakesideRevealPose(cam,[18.2397,19.6465,137.6432],[10.1345,19.6454,138.2321],390/844);
 assert(r&&r.maxNdc<=.98,'web-build lakeside reveal fits');assert(r.pose.fovVerticalDeg<=cam.fovVerticalDeg+8+1e-6);console.log('web',JSON.stringify({yawDeg:r.yawDeg,pitchDeg:r.pitchDeg,maxNdc:+r.maxNdc.toFixed(3),fov:+r.pose.fovVerticalDeg.toFixed(2)}));}
console.log(JSON.stringify(out));console.log('PASS lakeside qaShot: route timing, phases, reveal pose, wiring');
