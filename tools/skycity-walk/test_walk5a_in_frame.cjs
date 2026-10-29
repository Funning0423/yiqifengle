'use strict';
// 运镜bot full9c: the 5a walk lens (T-02 finale → mooring C, SkyWalkShot as RegionJourneyAdapter builds it) keeps her inside the safe
// margins on all 7 screens for the WHOLE shot (30 Hz): herMargin ≥ 0.08. Before the cityPull fix (aim POINT lerped toward a city 60–80 m
// away) the view turned 30–50° off her from 4 s on (margin down to −1.6: she left the frame on every screen).
const H=require(process.cwd()+'/tools/board-ui/harness.cjs').createHarness();const SW=H.load('region/SkyWalkShot.ts'),FS=H.load('region/SkyFinaleShot.ts'),TS=H.load('region/TransitionStaging.ts'),AD=H.load('region/TransitionAnchorData.ts'),SO=H.load('region/SkycityLensOccluders.ts'),LS=H.load('region/LensSmooth.ts');
const M5=TS.TRANSITION_STAGING.skyMooring5a,L2W=q=>SW.skyLocalToWorld(M5,q),FL=FS.SKY_FINALE_POSE_LOCAL,fin={position:L2W(FL.position),target:L2W(FL.target),fovVerticalDeg:FL.fovVerticalDeg};
const BX=[...AD.transitionOccluderBoxes(),...SW.skyBoxesToWorld(M5,SO.SKYCITY_LENS_OCCLUDERS,M5.walkWorld)];
const W=SW.skyWalkShot(M5.walkWorld,M5.walkMps,2,BX,L2W(FS.SKY_FINALE_CITY_LOCAL),{...SW.SKY_WALK_SHOT,plan:AD.SKY_5A_WALK_PLAN},fin);
let min=1,at=0,scr='';for(let t=0;t<=W.total+1e-9;t+=1/30){const p=W.pose(t),f=W.her(t).feet;for(const s of LS.LENS_SMOOTH.screens){const m=LS.herMargin(p.position,p.target,p.fovVerticalDeg,f,[s]);if(m<min){min=m;at=t;scr=s.join('x');}}}
const ok=min>=0.08;console.log(JSON.stringify({test:'walk5a-in-frame',totalS:+W.total.toFixed(2),minMargin:+min.toFixed(3),atS:+at.toFixed(2),screen:scr,status:ok?'PASS':'FAIL'}));process.exit(ok?0:1);
