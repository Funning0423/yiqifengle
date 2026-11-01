'use strict';
// 运镜bot clip19 R4: the meadow B1 pre-walk lens as the game runs it (BalloonTransit preDraw: b1PreWalk path at 1.2 m/s →
// b1PreWalkLens → lensClearStep(sail sweep boxes incl. the raised disc, walk floor, MeadowLensVoxels)), meadow bridge frame
// (runtime sail frame TransportLeg.sailMeadowRoot, yaw 180), from every meadow node start, per screen. Returns world samples {t,p,target,her}.
const L=require('../transitions/sail_farsea_lib.cjs'),J=require('./journey-scene.cjs');
const LC=L.load('region/LensClear.ts'),RW=L.load('region/RegionWalkable.ts',s=>s.includes('RegionWalkableData')?L.load('region/RegionWalkableData.ts'):{}),MB=L.load('region/MeadowLensBoxes.ts'),LV=L.load('region/LensVoxels.ts',s=>s.includes('MeadowLensVoxels')?L.load('region/MeadowLensVoxels.ts'):s.includes('MeadowLensBoxes')?MB:{});
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),B1=H.load('region/BalloonB1Start.ts'),RN=H.load('region/RegionNodes.ts');
const rotY=(d,p)=>{const t=d*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
function run([w,h],c0,O){const toW=p=>{const r=rotY(180,p);return [r[0]+O[0],r[1]+O[1],r[2]+O[2]];},unW=w=>rotY(-180,[w[0]-O[0],w[1]-O[1],w[2]-O[2]]);
 const boxes=LV.sailSweepBoxesWorld(toW),ground=w=>{const l=unW(w),f=RW.walkFloorY('meadow',l[0],l[2]);return f===null?null:f+O[1];},grid=LV.meadowVox(),solid=(w,c)=>LV.voxClear(grid,unW(w),c);const out=[],seen=new Set();
 for(const n of RN.REGION_NODES.meadow.nodes){const pre=B1.b1PreWalk(n.at);if(!pre||seen.has(pre.fromKey))continue;seen.add(pre.fromKey);
  const P=pre.path.map(toW),seg=[];let acc=0;for(let i=1;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]);seg.push([acc,l,P[i-1],P[i]]);acc+=l;}
  const at=d=>{for(const [a,l,p,q] of seg)if(d<=a+l||seg.at(-1)[2]===p){const u=l?Math.min(1,Math.max(0,(d-a)/l)):0;return {p:p.map((v,k)=>v+(q[k]-v)*u),yaw:Math.atan2(-(q[0]-p[0]),-(q[2]-p[2]))};}};
  const E=at(acc),C0=c0||B1.b1PreWalkLens({her:E.p,yawRad:E.yaw,w,h,dt:0,t:9,durationS:1e9,live:null,c0:null,prev:null}).pose/* no B1 plan in the model: c0 = her end follow pose */;
  let fol=null;const st={pull:0},live=null;
  for(let t=0;t<=pre.durationS;t+=1/60){const g=at(t*acc/pre.durationS),r=B1.b1PreWalkLens({her:g.p,yawRad:g.yaw,w,h,dt:1/60,t,durationS:pre.durationS,live,c0:C0,prev:fol});fol=r.state;
   const q=LC.lensClearStep(r.pose,boxes,1/60,st,undefined,ground,solid);out.push({from:pre.fromKey,t,p:q.position,target:q.target,fov:q.fovVerticalDeg,her:g.p});}}
 return out;}
module.exports={run};
