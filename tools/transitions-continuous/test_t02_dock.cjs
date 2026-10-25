'use strict';
// 运镜bot full2-cam task 5.1: T-02 final shot + its walk handoff against the b19 sky-city dock models (8557f895):
// sky_mooring_props.glb triangles (deck, posts, landing rope, 5a stakes, 5a rope, 5a stool; draco-decoded, skycity local → world)
// and the transition-occluders rows sky_mooring_deck / sky_mooring_5a / basket_skycity_5a. Shots (per screen, 7):
//  approach  T-02 F4 orbit from her S4→S6 walk lens onto SKY_FINALE_POSE_LOCAL (SkyFinaleShot.skyFinaleApproachPose)
//  final     the T-02 hold pose
//  handoff   SkyWalkShot (finale → 5a walk, SKY_5A_WALK_PLAN) = the lake leg's walk lens, gaze + walk to the mooring-C door
// Gates: D1 lens never inside a dock box; D2 ≥1.1 m from every dock triangle (scripted shots); D3 face/chest hidden by the dock
// mesh (or her own S6 / walk stand vs. the basket at C) longest run ≤0.5 s.
const RL=require('../journey-integration/route/route-legs.cjs'),LD=require('./lib-dock-mesh.cjs'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),TS=H.load('region/TransitionStaging.ts'),SW=H.load('region/SkyWalkShot.ts'),AD=H.load('region/TransitionAnchorData.ts'),FS=H.load('region/SkyFinaleShot.ts'),
 SO=H.load('region/SkycityLensOccluders.ts'),C=H.load('region/ExploreCameraCore.ts'),NW=H.load('region/NodeWalker.ts');
const DT=1/60;let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
(async()=>{const M5=TS.TRANSITION_STAGING.skyMooring5a,W=p=>SW.skyLocalToWorld(M5,p),wp=p=>({position:W(p.position),target:W(p.target),fovVerticalDeg:p.fovVerticalDeg});
 const mesh=LD.group(await LD.glbTris('creator-build-project/assets/bundles/region_skycity/sky_mooring_props.glb',/sky_mooring|stool/,W));if(process.env.QF_DBG)console.log(mesh.G.map(g=>g.n+' '+g.bb.map(x=>x.toFixed(1))).join('\n'));
 const O=AD.TRANSITION_OCCLUDERS,dockBoxes=[...O.sky_mooring_deck,...O.sky_mooring_5a,...O.basket_skycity_5a];
 const B=SO.SKYCITY_LENS_OCCLUDERS.map(b=>({min:[b[0],b[1],b[2]],max:[b[3],b[4],b[5]]})),segs=NW.planWalk('skycity','S4','S6').segments,last=segs[segs.length-1].path,pa=last[last.length-2],feetL=last[last.length-1],face=Math.atan2(feetL[0]-pa[0],feetL[2]-pa[2]);
 const NEW=FS.SKY_FINALE_POSE_LOCAL,fin=wp(NEW),boxes=AD.transitionOccluderBoxes();
 const Wk=SW.skyWalkShot(M5.walkWorld,M5.walkMps,2,[...boxes,...SW.skyBoxesToWorld(M5,SO.SKYCITY_LENS_OCCLUDERS,M5.walkWorld)],SW.finaleCity(fin),{...SW.SKY_WALK_SHOT,plan:AD.SKY_5A_WALK_PLAN},fin);
 const rows=[];
 for(const [w,h] of RL.SCREENS){const from=C.followPose(feetL,face,w,h,8),ap=FS.skyFinaleApproach(from,NEW,feetL,B);
  const shots={approach:{T:ap.T,cam:t=>wp(FS.skyFinaleApproachPose(from,NEW,feetL,t,ap.T,ap.dir)),her:()=>RL.standPts(W(feetL))},
   final:{T:3,cam:()=>fin,her:()=>RL.standPts(W(feetL))},
   handoff:{T:Wk.gazeS+Wk.walkS,cam:s=>Wk.pose(s),her:s=>RL.standPts(Wk.her(s).feet)}};
  for(const [id,S] of Object.entries(shots)){let inB=0,clr=99,run=0,runMax=0,who=null,boxClr=99;
   for(let t=0;t<=S.T+1e-9;t+=DT){const p=S.cam(t),q=S.her(t);
    for(const b of dockBoxes){if(LD.inBox(p.position,b))inB++;else boxClr=Math.min(boxClr,LD.boxDist(p.position,b));}
    clr=Math.min(clr,mesh.dist(p.position,60));const hh=mesh.hit(p.position,q.face)||mesh.hit(p.position,q.chest);if(hh)who=hh;run=hh?run+DT:0;runMax=Math.max(runMax,run);}
   const r={shot:id,scr:`${w}x${h}`,T:+S.T.toFixed(2),inBoxFrames:inB,meshClearM:+clr.toFixed(2),boxClearM:+boxClr.toFixed(2),hiddenS:+runMax.toFixed(2),by:who||'-'};rows.push(r);
   ok(inB===0,`${id} ${r.scr} lens in dock box ${inB} frames`);ok(clr>=1.1,`${id} ${r.scr} dock mesh clearance ${r.meshClearM} <1.1`);ok(runMax<=.5,`${id} ${r.scr} face/chest hidden ${r.hiddenS}s by ${who}`);}}
 console.table(rows);console.log(fail?`t02-dock FAIL (${fail})`:'t02-dock PASS');process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
