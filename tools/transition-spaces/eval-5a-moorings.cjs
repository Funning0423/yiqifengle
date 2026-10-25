'use strict';
// b19 seg5a: candidate skycity balloon moorings — walk seconds from S6, sweep of basket+envelope along the lift-off (first ~5 s screen = 18 s T-03 flight, SkyLakeContinuous liftS 6 / flightSkipS 18) vs skycity triangles.
const fs=require('fs');const src=fs.readFileSync(__dirname+'/test-transition-spaces.cjs','utf8');
const pre=src.slice(0,src.indexOf('// ---------- balloon segments'))+src.slice(src.indexOf('// envelope profile'),src.indexOf("{const s=S['3_meadow_balloon_in'],b=s.balloon;const disc"));
eval(pre.replace(/^#!.*\n/,'')+`;globalThis.__E={R,parkClear,S,RW:typeof RW!=='undefined'?RW:null,floorAt}`);
const {R,parkClear,floorAt}=globalThis.__E;
const {load}=require('../region-nodes/load.cjs');const BF=load('region/BalloonFlight.ts'),LC=load('region/LakesideCameraLayout.ts'),LB=load('region/LakesideBalloon.ts'),RN=load('region/RegionNodes.ts');
const yr=d=>d*Math.PI/180,rot=(deg,p)=>{const c=Math.cos(yr(deg)),s=Math.sin(yr(deg));return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
const CW=BF.CW_JSON,skyToW=p=>{const r=rot(CW.yawDeg,p);return [r[0]+CW.origin[0],r[1]+CW.origin[1],r[2]+CW.origin[2]];},skyL=w=>rot(-CW.yawDeg,[w[0]-CW.origin[0],w[1]-CW.origin[1],w[2]-CW.origin[2]]);
const S6=RN.REGION_NODES.skycity.nodes.find(n=>n.key==='S6').at,L=LC.lakesideJourney(skyToW(S6)),K=LB.LAKESIDE_BALLOON_LANDING;
const shore=L.arrival[L.arrival.length-1],moored=LB.lakesideBalloonMooring(shore,L.toWorld);
const land={position:[0,0,0],target:[0,0,1],fovVerticalDeg:50};
const F=LB.lakesideBalloonFlight(L.toWorld(K.launchLocal),moored.mooring,land);
const launch=skyL(F.vehicle(0));const LIFT=18;const traj=[];for(let t=0;t<=LIFT+1e-6;t+=.25)traj.push(skyL(F.vehicle(t)).map((v,i)=>v-launch[i]));
const tris=process.env.WIDE?(()=>{const d=JSON.parse(fs.readFileSync(process.env.WIDE,'utf8')),o=[];for(const v of Object.values(d))for(let i=0;i+9<=v.length;i+=9)o.push(v.slice(i,i+9));return o;})():R.skycity;const yTop=Math.max(...tris.map(t=>Math.max(t[1],t[4],t[7])));
function sweep(root,dir){/* dir: null = existing T-03 shape translated; else yaw (deg) of a straight outward climb with the same height profile */
 let w=9,at=null;for(const [i,o] of traj.entries()){let d=o;if(dir!==null){const hz=Math.hypot(o[0],o[2]),q=rot(dir,[0,0,hz]);d=[q[0],o[1],q[2]];}
  const r=[root[0]+d[0],root[1]+d[1],root[2]+d[2]];const c=parkClear(tris.filter(t=>Math.max(t[1],t[4],t[7])>r[1]+.02),r);if(c<w){w=c;at=+(i*.25).toFixed(2);}}return {minClear:+w.toFixed(2),atFlightS:at};}
const walkS=(pts)=>{let l=0;for(let i=1;i<pts.length;i++)l+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][2]-pts[i-1][2]);return {m:+l.toFixed(2),s:+(l/1.2+.6).toFixed(2)};};
module.exports={tris,parkClear,floorAt,traj,S6,launch,rot,skyToW,L,K,LB,moored,F,envR};
if(require.main===module){const cands=JSON.parse(process.argv[2]||'[]');const out={S6,launchOld:launch.map(v=>+v.toFixed(3)),trajTop:traj[traj.length-1].map(v=>+v.toFixed(2)),fixtureYTop:+yTop.toFixed(2),cands:[]};
for(const c of cands){const g=floorAt(tris,c.root[0],c.root[2],1,.6);const r=[c.root[0],g!==null?g+.03:c.root[1],c.root[2]];
 out.cands.push({id:c.id,root:r.map(v=>+v.toFixed(3)),ground:g,walk:walkS([S6,...(c.via||[]),c.outside]),park:+parkClear(tris.filter(t=>Math.max(t[1],t[4],t[7])>r[1]+.02),r).toFixed(2),liftExisting:(process.env.NOLIFT?null:sweep(r,null)),...(c.dir!==undefined?{liftDir:c.dir,liftOut:sweep(r,c.dir)}:{})});}
console.log(JSON.stringify(out,null,1));}
if(process.env.PROFILE)for(const [i,o] of traj.entries())if(i%2===0)console.error('lake',i*.25,o[1].toFixed(2),Math.hypot(o[0],o[2]).toFixed(2));
