'use strict';
/* b16 P1-3a regression (运镜bot): an interrupted lakeside landing walk (pause / background / cancelled ride) never leaves her over
 * the water. 1) every exit-route vertex stands on LK_terrain (or bridge/steps) above the LK_lake water, measured on the placed
 * lake meshes; 2) lakesideNearestWalkable projects interrupted positions (script stop points ± the 0.15 m foot-lock cap, plus
 * points out over the water) onto the route; projected points are on land; 3) source contract: the adapter snaps her on a tail
 * interrupt (not on a journey release). Day and night (route + ground are mode independent; asserted identical). */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const B=H.load('region/LakesideBalloon.ts'),LC=H.load('region/LakesideCameraLayout.ts'),C=H.load('world-r1/RegionJourneyCore.ts');
const lake=require('../journey-integration/lakeside/lakeside-scene.cjs').instances();
const LAND=lake.filter(i=>/LK_(terrain|bridge|bridge_steps|porch_steps)\.glb/.test(i.glb)),WATER=lake.filter(i=>i.glb==='LK_lake.glb');
function topY(set,x,z){let best=-Infinity;for(const i of set){const [a,b]=i.box;if(x<a[0]||x>b[0]||z<a[2]||z>b[2])continue;const t=i.tris;
 for(let k=0;k<t.length;k+=9){const x0=t[k],z0=t[k+2],x1=t[k+3],z1=t[k+5],x2=t[k+6],z2=t[k+8],d=(z1-z2)*(x0-x2)+(x2-x1)*(z0-z2);if(Math.abs(d)<1e-12)continue;
  const l0=((z1-z2)*(x-x2)+(x2-x1)*(z-z2))/d,l1=((z2-z0)*(x-x2)+(x0-x2)*(z-z2))/d,l2=1-l0-l1;if(l0<-1e-9||l1<-1e-9||l2<-1e-9)continue;const y=l0*t[k+1]+l1*t[k+4]+l2*t[k+7];if(y>best)best=y;}}return best;}
const onLand=(x,z)=>{const g=topY(LAND,x,z),w=topY(WATER,x,z);return g>-Infinity&&g>=w-1e-3;};
const results={};
for(const mode of ['day','night']){globalThis.__worldDayNight={snapshot:()=>({mode})};
 const L=LC.lakesideJourney([2,.58,63.2]),M=B.lakesideBalloonMooring(L.arrival.at(-1),L.toWorld),root=L.toWorld([0,0,0]),yaw=L.yawDeg*Math.PI/180;
 const toLocal=p=>{const x=p[0]-root[0],z=p[2]-root[2],c=Math.cos(-yaw),s=Math.sin(-yaw);return [c*x+s*z,p[1]-root[1],-s*x+c*z];};
 const walk=M.walk.slice(1)/* [0] = P0 on the basket floor */;
 for(const p of walk){const q=toLocal(p);assert(onLand(q[0],q[2]),`${mode}: route vertex over water ${q.map(v=>v.toFixed(3))}`);}
 let worst=0,n=0;const len=C.routeLength(walk);
 for(let s=0;s<=len;s+=.05)for(const [ox,oz] of [[0,0],[.15,0],[-.15,0],[0,.15],[0,-.15],[1.5,0],[-1.5,0],[0,1.5],[0,-1.5],[4,4]]){
  const p=C.sampleRoute(walk,s),q=B.lakesideNearestWalkable(walk,[p[0]+ox,p[1]-.2,p[2]+oz]),l=toLocal(q.point);n++;
  assert(onLand(l[0],l[2]),`${mode}: projection over water at s=${s.toFixed(2)} off=${ox},${oz}`);
  assert(q.offM<=Math.hypot(ox,oz)+1e-9,'nearest is no farther than the source sample');
  const back=B.lakesideNearestWalkable(walk,q.point);worst=Math.max(worst,back.offM,Math.abs(back.point[1]-q.point[1]));}
 assert(worst<1e-6,'projected point lies on the route (idempotent), worst '+worst);
 results[mode]={vertices:walk.length,samples:n,routeM:+len.toFixed(3),idempotentErr:worst};}
assert.deepEqual(results.day,results.night,'day = night');
const src=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
assert(/tail\.catch\(\(\)=>\{if\(released\|\|dead\)return;[^\n]*lakesideNearestWalkable\(moored\.walk/.test(src),'tail interrupt snaps her to the nearest walkable point');
assert(/tailStop=\(\)=>\{released=true;/.test(src),'journey release does not snap (主页 places her at home)');
console.log(JSON.stringify(results));console.log('lakeside-landing-walk-interrupt: PASS');
