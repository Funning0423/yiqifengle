'use strict';
// b15 qaShot lakeside: route timing (journey-invalid-timing fix), reveal pose, phases, wiring. Node only.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const B=H.load('region/LakesideBalloon.ts'),LC=H.load('region/LakesideCameraLayout.ts'),BL=H.load('ui/BoardLayout.ts'),C=H.load('world-r1/RegionJourneyCore.ts'),Q=H.load('region/LakesideQaShot.ts');
const out={};
// 1) the summarised skycity → lakeside route timing passes journeyTimingOk (b15 7b0c1c90 failed: accel 3.65 > 3)
const L=LC.lakesideJourney([2,.58,63.2]);L.landing=LC.lakesideScreenLanding(L,LC.lakesideScreenFrame(390,844,BL.boardSafeInsets(390,844)),LC.LAKESIDE_CAMERA_LAYOUT.stopLocal)/* b18 v4 stop */;
const shore=L.arrival.at(-1),stopW=L.toWorld([...LC.LAKESIDE_CAMERA_LAYOUT.stopLocal]),E=C.arrivalPose([shore,stopW],L.focus,L.landing),land={position:E.position,target:E.target,fovVerticalDeg:L.landing.arrivalFovDeg};
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
const her=toL(stopW),moor=[...K.mooringLocal];
for(const [w,h] of [[390,844],[320,568],[390,520]]){const board=LC.lakesideAlignedLookAt(LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h)));
 const r=Q.lakesideRevealPose(board,her,moor,w/h);assert(r,`${w}x${h} reveal`);assert(r.maxNdc<=.98);
 assert(r.pose.fovVerticalDeg<=board.fovVerticalDeg+8+1e-9);out[w+'x'+h]={yawDeg:r.yawDeg,pitchDeg:r.pitchDeg,maxNdc:+r.maxNdc.toFixed(3),fov:+r.pose.fovVerticalDeg.toFixed(2)};}
// 4) wiring: qa-only entry, tail marks
const comp=fs.readFileSync('creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts','utf8'),ad=fs.readFileSync('creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts','utf8');
assert(/if\(MINIGAME\)return \{ok:false,reason:'player-build'\};\s*if\(spec\?\.region==='lakeside'\)return this\.qaShotLakeside/.test(comp),'lakeside entry after the player-build guard');
for(const k of ["lakesideDoorRideCamera(R,doorLens,t,from)","lakesideDoorLens(moored.walk,moored.mooring,","lakesideDoorBlendPose(","qaMark('door')","qaMark('walk')","qaMark('shore')","qaMark0('out')","lakesideRouteTiming(","await out;","LAKESIDE_DOOR_HOLD.outM"])assert(ad.includes(k),k);

// 5) world-frame regression: the inputs logged from the 7b0c1c90 web build after the journey (Main Camera, her root, LakesideMooredBalloon)
{const cam={position:[16.6897,22.6533,132.6683],target:[18.1747,20.5556,142.3323],fovVerticalDeg:57.3526},r=Q.lakesideRevealPose(cam,[18.2397,19.6465,137.6432],[10.1345,19.6454,138.2321],390/844);
 assert(r&&r.maxNdc<=.98,'web-build lakeside reveal fits');assert(r.pose.fovVerticalDeg<=cam.fovVerticalDeg+8+1e-6);console.log('web',JSON.stringify({yawDeg:r.yawDeg,pitchDeg:r.pitchDeg,maxNdc:+r.maxNdc.toFixed(3),fov:+r.pose.fovVerticalDeg.toFixed(2)}));}
// 6) door hold: the basket lens is held until she is LAKESIDE_DOOR_HOLD.outM out (≥ door opening + step-out), and the
//    board still has ≥ 5 s of her offscreen walk to fade in over
{const DH=B.LAKESIDE_DOOR_HOLD,v=m.length/m.walkS,outAt=m.walkStartAt+DH.outM/v;assert(DH.outM>=1.4,'clear of the basket');
 assert(outAt>m.walkStartAt&&outAt>m.T0+.333+.5,'held through the door opening');
 const doorLens=B.lakesideDoorLens(m.walk,m.mooring,390/844),blendS=B.lakesideDoorBlendS(doorLens,land);
 // b18 path v4: the walk is 6.36 m and ends IN the board frame, so the ≥ 5 s offscreen overlap of b15 no longer applies; the door →
 // board blend (one game-time length, lakesideDoorBlendDurS) must end by the time she stops
 const entryM=B.lakesideBoardEntryM(m.walk,land,390/844,DH.outM),durS=B.lakesideDoorBlendDurS(blendS,DH.outM,entryM,v);
 assert(durS>=blendS&&m.walkStartAt+m.walkS-outAt-durS>=-1e-6,'door → board blend ends by her stop: '+(m.walkStartAt+m.walkS-outAt-durS));
 // the held lens frames the basket at touchdown (basket centre + door within the frame), unlike the old landing pose
 const FLb=require('../journey-integration/journey-framing-lib.cjs'),bk=R.vehicle(R.T),bc=[bk[0],bk[1]+.6,bk[2]],nd=FLb.ndc(doorLens,bc);
 assert(nd&&Math.abs(nd[0])<.9&&Math.abs(nd[1])<.9,'basket on screen in the door lens: '+JSON.stringify(nd));
 // her door path (P0 → outM, feet + head) stays in frame, and the lens is on the door (shore) side of the basket
 const q=C.sampleRoute(m.walk,DH.outM);for(const p of [m.walk[0],q])for(const y of [0,1.65]){const n2=FLb.ndc(doorLens,[p[0],p[1]+y,p[2]]);assert(n2&&Math.abs(n2[0])<.9&&Math.abs(n2[1])<.95,'her door path in frame '+JSON.stringify(n2));}
 const dir=[q[0]-m.walk[0][0],q[2]-m.walk[0][2]],toCam=[doorLens.position[0]-bk[0],doorLens.position[2]-bk[2]];assert(dir[0]*toCam[0]+dir[1]*toCam[1]>0,'lens on the door side');
 // the turn-in orbit starts on the ride lens (no cut) and keeps clear of the basket/envelope
 const o0=R.T-B.LAKESIDE_DOOR_LENS.turnInS,ob=R.T-B.LAKESIDE_BALLOON_LANDING.blendOutS,c0=B.lakesideDoorRideCamera(R,doorLens,ob+1e-4,null),c1=B.lakesideDoorRideCamera(R,doorLens,ob-1e-4,null)/* b16 item 6: the ride lens is lakesideDoorRideCamera all through the flight (rim lift on R.camera) */;assert(Math.hypot(...c0.position.map((x,i)=>x-c1.position[i]))<.01,'door ending starts on the ride lens');
 let minD=1e9,maxStep=0,prevP=null;for(let t=ob;t<=R.T;t+=1/60){const c=B.lakesideDoorRideCamera(R,doorLens,t,null),v=R.vehicle(t);minD=Math.min(minD,Math.hypot(c.position[0]-v[0],c.position[2]-v[2]));if(prevP)maxStep=Math.max(maxStep,Math.hypot(...c.position.map((x,i)=>x-prevP[i])));prevP=c.position;}
 assert(minD>3.4,'clear of the basket/envelope (r 2.9 m): '+minD);assert(maxStep*60<6,'turn-in speed '+maxStep*60);
 // continuous: the door lens equals the ride lens just before T (no cut at the hold)
 const pre=B.lakesideDoorRideCamera(R,doorLens,R.T-1/60,null);assert(Math.hypot(...pre.position.map((x,i)=>x-doorLens.position[i]))<.2,'no jump into the hold');
 const blendPeak=5.7735*Math.hypot(...doorLens.position.map((x,i)=>x-land.position[i]))/(blendS*blendS);assert(blendPeak<=3+1e-9,'blend accel');
 out.doorHold={turnInS:B.LAKESIDE_DOOR_LENS.turnInS,doorLens,outM:DH.outM,outAtS:+outAt.toFixed(2),blendS:+blendS.toFixed(2),handoverS:+(outAt+blendS).toFixed(2),walkLeftAfterS:+(m.walkStartAt+m.walkS-outAt-blendS).toFixed(2),blendDurS:+durS.toFixed(2),walkLeftAfterBlendS:+(m.walkStartAt+m.walkS-outAt-durS).toFixed(3),basketNdc:nd.map(x=>+(+x).toFixed(2)),blendAccel:+blendPeak.toFixed(2)};}
// 7) occlusion + composition on the web-build inputs: a canopy sphere in front of the envelope (where the 7b0c1c90 render showed one)
{const cam={position:[16.6897,22.6533,132.6683],target:[18.1747,20.5556,142.3323],fovVerticalDeg:57.3526},feet=[18.4345,19.6533,139.3320],bal=[10.1345,19.6454,138.2321];
 const plain=Q.lakesideRevealPose(cam,feet,bal,390/844);assert(plain&&plain.occludedFrac===0);
 const E=[bal[0],bal[1]+8.5,bal[2]],P0=plain.pose.position,C=P0.map((x,i)=>x+(E[i]-x)*.3),R=.45,seg=(a,b)=>{const d=b.map((x,i)=>x-a[i]),L2=d[0]*d[0]+d[1]*d[1]+d[2]*d[2],t=Math.max(0,Math.min(1,((C[0]-a[0])*d[0]+(C[1]-a[1])*d[1]+(C[2]-a[2])*d[2])/L2));return Math.hypot(a[0]+d[0]*t-C[0],a[1]+d[1]*t-C[1],a[2]+d[2]*t-C[2])<R;};
 const S=Q.lakesideRevealSamples(feet,bal),blocked=S.filter(p=>seg(plain.pose.position,p)).length/S.length;assert(blocked>.03,'the synthetic canopy blocks the occlusion-free pick');
 const r=Q.lakesideRevealPose(cam,feet,bal,390/844,.98,seg);assert(r&&r.occludedFrac<=.03,'occluded angle rejected');
 assert(Math.abs(r.composition.centre)<=.35&&r.composition.emptyBelow<=.45,'balanced, little empty foreground');
 out.occlusion={blockedPlain:+blocked.toFixed(3),pick:{yawDeg:r.yawDeg,pitchDeg:r.pitchDeg,occ:+r.occludedFrac.toFixed(3),centre:+r.composition.centre.toFixed(3),emptyBelow:+r.composition.emptyBelow.toFixed(3)}};}
// 8) b16 edge rule: a near tree canopy (sphere) straddling the right frame edge of the plain pick is rejected
{const cam={position:[16.6897,22.6533,132.6683],target:[18.1747,20.5556,142.3323],fovVerticalDeg:57.3526},feet=[18.4345,19.6533,139.3320],bal=[10.1345,19.6454,138.2321],asp=390/844;
 const plain=Q.lakesideRevealPose(cam,feet,bal,asp),P=plain.pose,fw=P.target.map((x,i)=>x-P.position[i]),fl=Math.hypot(...fw),f=fw.map(x=>x/fl),r=[-f[2],0,f[0]],rl=Math.hypot(r[0],r[2]);r[0]/=rl;r[2]/=rl;
 const th=Math.tan(P.fovVerticalDeg*Math.PI/360),D=9,C=[0,1,2].map(i=>P.position[i]+f[i]*D+r[i]*D*th*asp+[0,1,0][i]*D*th*.5),RAD=.8;
 const ray=(o,d,max)=>{const oc=o.map((x,i)=>x-C[i]),b=oc[0]*d[0]+oc[1]*d[1]+oc[2]*d[2],c=oc[0]**2+oc[1]**2+oc[2]**2-RAD*RAD,disc=b*b-c;if(disc<0)return null;const t=-b-Math.sqrt(disc);return t>0&&t<max?{t,ground:false}:null;};
 assert(Q.lakesideEdgeCut(P,asp,ray)>0,'the synthetic canopy straddles the plain pick edge');
 const occ=(a,b2)=>{const d=b2.map((x,i)=>x-a[i]),L=Math.hypot(...d);const h=ray(a,d.map(x=>x/L),L);return !!h;};
 const e=Q.lakesideRevealPose(cam,feet,bal,asp,.98,occ,.03,ray);assert(e&&e.edgeCuts===0&&e.occludedFrac<=.03,'edge-clean pick');
 assert(Q.lakesideEdgeCut(e.pose,asp,ray)===0);
 // ground hits never count
 assert.equal(Q.lakesideEdgeCut(P,asp,()=>({t:1,ground:true})),0);
 out.edge={plain:{yawDeg:plain.yawDeg,pitchDeg:plain.pitchDeg,centre:+plain.composition.centre.toFixed(3),emptyBelow:+plain.composition.emptyBelow.toFixed(3)},pick:{yawDeg:e.yawDeg,pitchDeg:e.pitchDeg,centre:+e.composition.centre.toFixed(3),emptyBelow:+e.composition.emptyBelow.toFixed(3)}};
 assert(Math.abs(plain.composition.centre)<=.1&&plain.composition.emptyBelow<=.2,'subject roughly centred, little foreground (revealLift)');}
// 9) b16 board entry: through the door → board blend (driven by her walk) she stays inside the frame, and at the hand-over
//    her whole body is inside 0.85 of the board frame (no right-edge cut during the fade-in)
{const FLc=require('../journey-integration/journey-framing-lib.cjs'),asp=FLc.ASPECT,DH=B.LAKESIDE_DOOR_HOLD,door=B.lakesideDoorLens(m.walk,m.mooring,390/844),v=m.length/m.walkS;
 const entry=B.lakesideBoardEntryM(m.walk,land,asp,DH.outM),blendS=B.lakesideDoorBlendS(door,land);assert(entry>DH.outM&&entry<=m.length+1e-9,'entry inside the walk');const durS=B.lakesideDoorBlendDurS(blendS,DH.outM,entry,v)/* b18: v4 stop sits at the board frame's lower right (≈ 0.9 NDC), so entry may be the stop itself */;
 let worst=0,el=0,u=0,pd=null,pw=null,wMax=0,aMax=0;for(let sM=DH.outM;u<1;sM+=v/60,el+=1/60){u=Math.min(1,el/durS)/* b18: pure game time */;const p=C.sampleRoute(m.walk,Math.min(sM,m.length)),P=B.lakesideDoorBlendPose(door,land,u,p);
  const dv=P.target.map((x,i)=>x-P.position[i]),dl=Math.hypot(...dv),dn=dv.map(x=>x/dl);if(pd){const w=Math.acos(Math.min(1,dn[0]*pd[0]+dn[1]*pd[1]+dn[2]*pd[2]))*180/Math.PI*60;wMax=Math.max(wMax,w);if(pw!==null)aMax=Math.max(aMax,Math.abs(w-pw)*60);pw=w;}pd=dn;
  for(const y of [0,.9,1.65]){const n=FLc.ndc(P,[p[0],p[1]+y,p[2]]);assert(n&&n[2]>0,'in front');worst=Math.max(worst,Math.abs(n[0]),Math.abs(n[1]));}}
 assert(wMax<=110&&aMax<=360,'blend motion bars '+wMax+' '+aMax);
 assert(worst<=.95,'her body stays in frame through the blend: '+worst);
 const left=m.walkStartAt+m.walkS-(m.walkStartAt+DH.outM/v)-durS;assert(left>=-1e-6,'blend ends by her stop: '+left);out.blendB18={durS:+durS.toFixed(3),entryM:+entry.toFixed(3),wMaxDegS:+wMax.toFixed(2),aMaxDegS2:+aMax.toFixed(1),worstNdc:+worst.toFixed(3),leftS:+left.toFixed(3)};
 assert.equal(B.lakesideDoorBlendU(DH.outM+.01,DH.outM,entry,100,blendS)<1,true);assert.equal(B.lakesideDoorBlendU(entry,DH.outM,entry,0.5,blendS)<1,true,'never faster than the SPEC blend');
 out.boardEntry={entryM:+entry.toFixed(2),blendDurS:+durS.toFixed(2),specBlendS:+blendS.toFixed(2),worstNdc:+worst.toFixed(3),viewDegS:+wMax.toFixed(1),viewDegS2:+aMax.toFixed(1),walkLeftAfterS:+left.toFixed(2)};}
// 10) b16 real-build fixes: marks only move forward; the door blend never re-installs the cleared tail step; skycity retry
{let k=null;for(const m2 of ['door','walk','shore','out','walk'])k=Q.lakesideQaAdvance(k,m2);assert.equal(k,'shore','late out/walk never overwrite shore');
 assert.equal(Q.lakesideQaAdvance('door','out'),'out');
 assert(/try\{await out;rideToken\.check\(\);qaMark0\('out'\)/.test(ad),'out marked when she is out');
 assert(ad.includes("ticker.step=tailDone?()=>{}:prevStep")&&ad.includes("if(!tailDone)prevStep(dt)")&&ad.includes("ticker.step=()=>{};tailDone=true;"),'cleared tail step stays cleared');
 assert(!/rideToken\.check\(\);qaMark0\('out'\);\n  \};/.test(ad),'no post-blend out mark');
 assert(comp.includes("reason!=='return-route-not-yet-available'"),'skycity entry retried');
 // simulate the tail/blend ticker interplay: shore during the blend
 const ticker={step:null};let tailDone=false,tailSteps=0;ticker.step=()=>{tailSteps++;};const prev=ticker.step;let u=0;
 ticker.step=dt=>{if(!tailDone)prev(dt);u+=dt/3;if(u>=1){ticker.step=tailDone?()=>{}:prev;}};
 for(let i=0;i<60;i++)ticker.step(1/60);ticker.step=()=>{};tailDone=true;/* tail ends: but the blend wrapper was replaced -> model the real order */
 const t2={step:null};let td=false,n2=0;const tailStep=()=>{n2++;};t2.step=tailStep;const p2=t2.step;let u2=0;const wrap=dt=>{if(!td)p2(dt);u2+=dt/3;if(u2>=1){t2.step=td?()=>{}:p2;}};t2.step=wrap;
 for(let i=0;i<90;i++)t2.step(1/60);td=true/* shore: the tail clears ... */;const before=n2;for(let i=0;i<200;i++)t2.step(1/60);assert.equal(n2,before,'tail step not revived after shore');}
// 11) committed door → board blend replayed numerically: no distance/aim jump, last frame lands on the board pose
{const DH=B.LAKESIDE_DOOR_HOLD,door=B.lakesideDoorLens(m.walk,m.mooring,390/844),FLd=require('../journey-integration/journey-framing-lib.cjs'),entry=B.lakesideBoardEntryM(m.walk,land,FLd.ASPECT,DH.outM),minS=B.lakesideDoorBlendS(door,land),v=m.length/m.walkS;
 const dir=P=>{const d=P.target.map((x,i)=>x-P.position[i]),l=Math.hypot(...d);return d.map(x=>x/l);};let el=0,u=0,prev=null,maxV=0,maxW=0,lastV=0,lastW=0;
 for(let sM=DH.outM;;sM+=v/60,el+=1/60){u=Math.max(u,B.lakesideDoorBlendU(sM,DH.outM,entry,el,minS));const p=C.sampleRoute(m.walk,sM),P=u>=1?land:B.lakesideDoorBlendPose(door,land,u,p);
  if(prev){const a2=dir(P),b2=dir(prev);lastV=Math.hypot(...P.position.map((x,i)=>x-prev.position[i]))*60;lastW=Math.acos(Math.min(1,a2[0]*b2[0]+a2[1]*b2[1]+a2[2]*b2[2]))*180/Math.PI*60;maxV=Math.max(maxV,lastV);maxW=Math.max(maxW,lastW);}prev=P;if(u>=1)break;}
 assert(maxV<=3&&maxW<=110,'blend continuous: '+maxV+' m/s '+maxW+' deg/s');assert(lastV<=maxV+1e-9&&lastW<=maxW+1e-9,'no jump on the hand-over frame');
 out.blendReplay={maxMps:+maxV.toFixed(2),maxDegS:+maxW.toFixed(2),lastMps:+lastV.toFixed(2),lastDegS:+lastW.toFixed(2)};}
// 12) b16 distance search: near tall scenery cut at the edges for every lens closer than 9 m forces a pull-back; the nearest
//     passing distance wins
{const cam={position:[16.6897,22.6533,132.6683],target:[18.1747,20.5556,142.3323],fovVerticalDeg:57.3526},feet=[18.4345,19.6533,139.3320],bal=[10.1345,19.6454,138.2321];
 const ray=(o)=>Math.hypot(o[0]-feet[0],o[2]-feet[2])<9?{t:3,ground:false}:null;const r=Q.lakesideRevealPose(cam,feet,bal,390/844,.98,undefined,.03,ray);
 assert(r&&r.distM>=9-1e-6&&r.distM<9.9,'nearest passing distance: '+(r&&r.distM));assert(r.pose.fovVerticalDeg<=cam.fovVerticalDeg+8+1e-6);
 const n=Q.lakesideRevealPose(cam,feet,bal,390/844);assert(n.distM<7.2,'no reason to pull back: seeded distance kept');
 out.distance={forced:{distM:+r.distM.toFixed(2),yawDeg:r.yawDeg,pitchDeg:r.pitchDeg,centre:+r.composition.centre.toFixed(3),emptyBelow:+r.composition.emptyBelow.toFixed(3)},free:+n.distM.toFixed(2)};}
// 13) b16 door lens retune: whole basket + her door path inside 0.9, lowest point near the bottom (little empty ground)
{const FLe=require('../journey-integration/journey-framing-lib.cjs'),D=B.lakesideDoorLens(m.walk,m.mooring,390/844),pts=B.lakesideDoorFramePoints(m.walk,m.mooring);
 let ymn=9,ymx=-9,xmx=0;for(const p of pts){const n=FLe.ndc(D,p);assert(n&&n[2]>0);xmx=Math.max(xmx,Math.abs(n[0]));ymn=Math.min(ymn,n[1]);ymx=Math.max(ymx,n[1]);}
 assert(xmx<=.9+1e-9&&ymx<=.9+1e-9&&ymn>=-.9-1e-9,'basket + her inside 0.9');assert(ymn<=-.65,'little empty ground below: '+ymn);
 out.doorLens={pos:D.position.map(x=>+x.toFixed(2)),fov:D.fovVerticalDeg,xMax:+xmx.toFixed(2),yMin:+ymn.toFixed(2),yMax:+ymx.toFixed(2)};}
// 14) b15 handover: restore() must not cancel/snap her while the ride tail still walks her to the stand point (no
//     teleport under the board fade-in; 'shore' gets written), and qaShot exits a level before routing on
{const core=fs.readFileSync('creator-build-project/assets/scripts/world-r1/RegionJourneyCore.ts','utf8');
 assert(/restore\(actor:CharacterAdapter,world:WorldLease,visible:boolean\):void\{if\(this\.root&&!\(this\.lease as any\)\?\.tail&&!\(actor as any\)\.__qfWalkTail\)actor\.cancelAndReset/.test(core),'restore respects the tail');
 assert(/exit-current-level-first'\)\{[^}]*exitLevel\(\)/.test(comp),'qaShot lakeside exits the level first');
 assert(/state==='lakeside'\)\{try\{\(this\.world\.commands\(\) as any\)\.abandonLakesideJourney/.test(comp),'qaShot lakeside from the lakeside: back to the island first');}
// 15) b15 handover: an everywhere-occluded stand point must not stall the page (in-game rays are cc rayModel casts):
//     the ray checks are budgeted and the least-occluded composition is returned
{const cam={position:[16.6897,22.6533,132.6683],target:[18.1747,20.5556,142.3323],fovVerticalDeg:57.3526},feet=[18.4345,19.6533,139.3320],bal=[10.1345,19.6454,138.2321];
 let rays=0;const r=Q.lakesideRevealPose(cam,feet,bal,390/844,.98,()=>{rays++;return true},.03);
 assert(r&&r.maxNdc<=.98,'fallback still framed');const n=Q.lakesideRevealSamples(feet,bal).length;assert(rays<=Q.LAKESIDE_REVEAL_RAY_BUDGET*n,'ray budget: '+rays);out.rayBudget={rays,cap:Q.LAKESIDE_REVEAL_RAY_BUDGET*n};}
console.log(JSON.stringify(out));console.log('PASS lakeside qaShot: route timing, phases, reveal pose, wiring');
