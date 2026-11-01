'use strict';
/* r17 (运镜bot) — 界面验收部 Mac web check of c5889aa2, reproduced through the real code path (explore-stage-harness: real ExploreInput →
 * RegionNodeStage.onGesture / aimOrbit / tickLens / writeOrbit / occlude, real FreeOrbit + LensGuard). The gap our r14–r16 tests had:
 * they seeded the orbit from the close follow lens and gave it NO renderer AABBs. In the engine explore opens on the far board /
 * finale lens, and refreshOrbitBoxes hands FreeOrbit.clearPose every MeshRenderer AABB ≤ 14 m within 28 m — grass patches and her
 * own body boxes contain her feet but not the lens, so clearPose pulled the lens toward her look point down to 0.8 m.
 *  A1 first drag → arm: per region, explore opened (openExplore) on a far low lens (30 m, 8°: the finale / board-exit lens) with engine-like boxes round her
 *     (a field of 4×4 m grass clumps 0.9 m tall, her body 0.6×1.7 m, two props 3–5 m off): after a 120 pt drag and 3 s, the lens-to-look arm stays in
 *     [ARM_MIN 3.5 m − LensGuard pull-in (≥ 1.6 m hard)… ARM_MAX 12 m] every written frame (no frame < 1.6 m, settled ≥ 3.5 m on
 *     meadow / skycity, ≤ 12.5 m settled: ground/deck guards may lift past 12); the first drag glides (≤ 3 s) from the far lens instead of cutting — peak lens speed
 *     ≤ 9 m/s, or 2·d₀/3 for a far-lens (d₀ m) takeover capped at 3 s.
 *  A2 island distance: same with the island board lens 34 m away → settled arm ≤ 12 m.
 *  A3 walk end keeps the yaw: drag while ground-walking, the walk ends (groundWalking false, MapExplore), 3 s later the lens
 *     azimuth round her is within 4° of the player's orbit yaw (lakeside + every region).
 *  A4 walking yaw: after a drag on the island, a 6 s walk past palms (LensGuard live): lens azimuth drift ≤ 6° from the player's yaw. */
const fs=require('node:fs'),path=require('node:path');
const {FO,E,Gate,rig,inputFor,wrap}=require('./explore-stage-harness.cjs');
const DT=1/30,rows=[];let fails=0;
// the meadow / skycity copies sit far off the origin in the live journey scene (model-local graph): the r16 harness had them at 0
const MODEL_AT={meadow:[182,0,-64],skycity:[-150,24,236]},STAND=r=>MODEL_AT[r]?MODEL_AT[r].slice():null;
const far=(d,el,yaw)=>h=>{const e=el*Math.PI/180,y=yaw*Math.PI/180;const look=[h[0],h[1]+1.15,h[2]];return {position:[look[0]-Math.sin(y)*Math.cos(e)*d,look[1]+Math.sin(e)*d,look[2]-Math.cos(y)*Math.cos(e)*d],target:look,fovVerticalDeg:45};};
// engine-like renderer AABBs: a field of 4×4 m grass clumps (0.9 m tall) round her (nearest 32 kept, as refreshOrbitBoxes), her body, two props
const grassAt=h=>{const g=[];for(let x=-24;x<24;x+=4)for(let z=-24;z<24;z+=4)g.push({min:[h[0]+x,h[1]-0.1,h[2]+z],max:[h[0]+x+4,h[1]+0.9,h[2]+z+4]});
 return g.sort((a,b)=>Math.hypot(a.min[0]+2-h[0],a.min[2]+2-h[2])-Math.hypot(b.min[0]+2-h[0],b.min[2]+2-h[2])).slice(0,28);};
const boxesAt=h=>[...grassAt(h),{min:[h[0]-0.3,h[1],h[2]-0.3],max:[h[0]+0.3,h[1]+1.7,h[2]+0.3]},
 {min:[h[0]+3,h[1],h[2]+1],max:[h[0]+4,h[1]+2.5,h[2]+2]},{min:[h[0]-5,h[1],h[2]-2],max:[h[0]-4,h[1]+3,h[2]-1]}];
const armOf=(c,h,lookM)=>Math.hypot(c.position[0]-h[0],c.position[1]-(h[1]+lookM),c.position[2]-h[2]);
const azOf=(c,h)=>Math.atan2(h[0]-c.position[0],h[2]-c.position[2])*180/Math.PI;
for(const region of ['island','meadow','skycity','lakeside']){
 const L=FO.ORBIT_LIMITS[region],seedD=region==='island'?34:30;
 // A1 / A2
 {Gate.setExploreEnabled(true);const R=rig(region,'S1',STAND(region),{open:true,seed:far(seedD,8,20),modelAt:MODEL_AT[region]});R.st.refreshOrbitBoxes=()=>{R.st.orbitBoxes=boxesAt(R.her());};
  const I=inputFor(region,R.st);let minArm=1e9,maxMS=0,prev=R.cam();const h=R.her();
  for(let k=0;k<10;k++)R.st.tickLens(DT);
  const sample=()=>{const c=R.cam(),a=armOf(c,h,L.lookM);minArm=Math.min(minArm,a);maxMS=Math.max(maxMS,Math.hypot(...[0,1,2].map(i=>c.position[i]-prev.position[i]))/DT);prev=c;};
  prev=R.cam();I.start(150,400);for(let k=1;k<=12;k++){I.move(150+k*10,400);R.st.tickLens(DT);sample();}I.end(270,400);
  const glideS=R.st.entry?R.st.entry.T:0;for(let k=0;k<240;k++){R.st.tickLens(DT);sample();}
  const settled=armOf(R.cam(),h,L.lookM),ok=minArm>=1.6&&settled>=3.5-1e-6&&settled<=12.5&&maxMS<=Math.max(9,2*seedD/3);if(!ok)fails++;
  rows.push({id:'A1/A2 first drag',region,minArmM:+minArm.toFixed(2),settledArmM:+settled.toFixed(2),maxLensMS:+maxMS.toFixed(1),orbitDist:+R.orbit.dist.toFixed(2),firstDragGlideS:+glideS.toFixed(2),ok});Gate.setExploreEnabled(false);}
 // A3 walk end keeps the yaw
 {Gate.setExploreEnabled(true);const R=rig(region,'S2',STAND(region),{open:true,seed:far(9,25,0),modelAt:MODEL_AT[region]});const I=inputFor(region,R.st);
  for(let k=0;k<10;k++){R.st.tickLens(DT);R.walk(1.2*DT);}
  I.start(150,400);for(let k=1;k<=12;k++){I.move(150+k*10,400);R.st.tickLens(DT);R.walk(1.2*DT);}I.end(270,400);
  for(let k=0;k<45;k++){R.st.tickLens(DT);R.walk(1.2*DT);}
  R.st.groundWalking=false;R.st.lens='MapExplore';for(let k=0;k<90;k++)R.st.tickLens(DT);
  const gap=Math.abs(wrap(azOf(R.cam(),R.her())-(R.orbit.yaw+180))),ok=gap<=4&&R.orbit.engaged();if(!ok)fails++;
  rows.push({id:'A3 walk end',region,gapDeg:+gap.toFixed(1),engaged:R.orbit.engaged(),mode:R.orbit.mode,ok});Gate.setExploreEnabled(false);}
}
// A4 island walking yaw after a drag (palms on the way: LensGuard live)
{Gate.setExploreEnabled(true);const R=rig('island','S2',[-3.5,0,6.5],{open:true,seed:far(9,20,0)});const I=inputFor('island',R.st);
 I.start(150,400);for(let k=1;k<=12;k++){I.move(150+k*10,400);R.st.tickLens(DT);}I.end(270,400);for(let k=0;k<30;k++)R.st.tickLens(DT);
 let worst=0;for(let k=0;k<180;k++){R.st.tickLens(DT);R.walk(1.0*DT);const g=Math.abs(wrap(azOf(R.cam(),R.her())-(R.orbit.yaw+180)));if(k>15)worst=Math.max(worst,g);}
 const ok=worst<=6;if(!ok)fails++;rows.push({id:'A4 island walk yaw',region:'island',worstGapDeg:+worst.toFixed(1),ok});Gate.setExploreEnabled(false);}
console.table(rows);
fs.mkdirSync(path.join(__dirname,'../journey-integration/reports'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../journey-integration/reports/explore-arm.json'),JSON.stringify({status:fails?'FAIL':'PASS',rows},null,1)+'\n');
if(fails){console.error('explore-arm: FAIL',fails);process.exit(1);}console.log('explore-arm: ok');
