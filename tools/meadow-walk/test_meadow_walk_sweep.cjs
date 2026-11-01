'use strict';
// 场景设计部 2026-10-26 (complements meadow-walk-colliders [points only] and meadow-walk-no-uturn [turns]): SWEEP every
// meadow walk the game plays — each RegionNodes edge, the chained prewalk (A6 end / M4 / M6 → gate) and B1's door path —
// at 0.1 m steps with body r 0.3 m (axis 0.3/0.9/1.5 m above the real floor) against real env_meadow triangles, plus:
// every sample on the walkable grid, floor step between samples ≤ 0.12 m. Basket disc not checked (explicit paths).
const assert=require('node:assert/strict');const G=require('./lib/meadow-geo.cjs');
const H=require('../board-ui/harness.cjs').createHarness();
const PW=H.load('region/BalloonB1Start.ts'),RN=H.load('region/RegionNodes.ts'),TS=H.load('region/TransitionStaging.ts'),TL=H.load('region/TransportLeg.ts');
const S=TS.TRANSITION_STAGING,M=S.meadow,B=S.basket,yaw=M.basketYawLocalDeg*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw);
const W=l=>[M.launch[0]+l[0]*c+l[2]*s,M.launch[1]+l[1],M.launch[2]-l[0]*s+l[2]*c],OUT=W(B.outside),DOOR=W(B.doorOut);
const R=0.3,bad=[],out={};
function sweep(name,P){let minC=9,mesh=null,off=0,step=0;for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/0.1));let pf=null;
 for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[2]+(b[2]-a[2])*k/n;if(!G.walkable(x,z))off++;const q=G.clearance(x,z);if(q.d<minC){minC=q.d;mesh=q.mesh;}if(pf!==null&&q.floor!==null)step=Math.max(step,Math.abs(q.floor-pf));pf=q.floor;}}
 out[name]={minClearM:+minC.toFixed(3),mesh,offWalk:off,maxStepM:+step.toFixed(3)};
 if(minC<R)bad.push(`${name}: ${minC.toFixed(3)} m from ${mesh}`);if(off)bad.push(`${name}: ${off} samples off walkable`);if(step>0.12)bad.push(`${name}: floor step ${step.toFixed(3)}`);}
for(const e of RN.REGION_NODES.meadow.edges)sweep(`edge ${e.a}-${e.b}`,e.path);
const node=k=>RN.REGION_NODES.meadow.nodes.find(n=>n.key===k).at;
for(const [name,here] of [['A6 end M1',TL.SAIL_M1_LOCAL],['standing at M4',node('M4')],['standing at M6',node('M6')],['standing at M5',node('M5')]]){
 const pre=PW.b1PreWalk(here,OUT),start=pre?pre.path.at(-1):here,door=PW.b1DoorPath(start,OUT,DOOR);sweep(`chained ${name} prewalk+B1`,pre?[...pre.path,...door.slice(1)]:door);}
console.log(JSON.stringify(out));
assert.deepEqual(bad,[],'meadow walk sweep: '+bad.join('; '));
console.log('PASS meadow walk sweep (body r 0.3 m, walkable, floor step)');
