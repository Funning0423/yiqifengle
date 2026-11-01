'use strict';
/* Every camera that can look at the sky city, collected from the repo code/data at run time (env_skycity LOCAL, Cocos Y-up).
 * Each cam: {tag, at (what/when), position, target, fovVerticalDeg, aspect | cone (half-angle deg, for free-orbit lenses)}.
 *  board    skycityVisitPose(anchor_spawn_girl, anchor_starcourt_center, w/h) on every RL.SCREENS
 *  finale   every exported pose in SkyFinaleShot.ts that has position+target (T-02 final shot and variants)
 *  arrival  balloon meadow→skycity ride camera (route-legs balloonLeg, the runtime path) every 0.25 s while the city is on, all screens
 *  flightkey balloon_flightpath.json world keys (the raw keys the ride interpolates)
 *  depart   sky→lake continuous leg (SkyLakeContinuous) every 0.25 s until 4 s after flight start, all screens
 *  orbit    free-orbit lenses around the baked walkable floor (one pivot per 3 m cell) + every anchor_* node: yaw /20°, pitch −6…72°,
 *           arm 3…40 m, pulled in front of the first wall (lens guard); 45° cone (wider than any screen diagonal at the explore FOV)
 * Options: {orbitStepM:3, orbitYawDeg:20, dt:0.25} (fast mode uses a coarser orbit grid). */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const ROOT=path.resolve(__dirname,'../../..');
const GLB=ROOT+'/creator-build-project/assets/bundles/region_skycity/env_skycity.glb';
function anchors(){const b=fs.readFileSync(GLB),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),par={};
 j.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>par[c]=i));
 const qr=(q,v)=>{const [x,y,z,w]=q,ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];};
 const A={};j.nodes.forEach((n,i)=>{if(!/^anchor_/.test(n.name||''))return;let p=[0,0,0];for(let k=i;k!==undefined;k=par[k]){const m=j.nodes[k],s=m.scale||[1,1,1],r=qr(m.rotation||[0,0,0,1],[p[0]*s[0],p[1]*s[1],p[2]*s[2]]),t=m.translation||[0,0,0];p=[r[0]+t[0],r[1]+t[1],r[2]+t[2]];}A[n.name]=p;});return A;}
async function repoCams(o={}){
 const dt=o.dt||0.25;
 const RL=require(ROOT+'/tools/journey-integration/route/route-legs.cjs'),{createHarness}=require(ROOT+'/tools/board-ui/harness.cjs'),H=createHarness();
 const SL=H.load('region/SkyLakeContinuous.ts'),TC=H.load('region/TransitionCamera.ts'),VP=H.load('region/SkycityVisitPose.ts'),SF=H.load('region/SkyFinaleShot.ts'),BF=H.load('region/BalloonFlight.ts');
 const CW=BF.CW_JSON,loc=p=>BF.unapplyRigid(CW,p);
 const W=(P,tag,at,aspect)=>({tag,at,position:loc(P.position),target:loc(P.target),fovVerticalDeg:P.fovVerticalDeg??48,aspect});
 const A=anchors(),G=await RL.geometry(),out=[];
 for(const [w,h] of RL.SCREENS)out.push({...VP.skycityVisitPose(A.anchor_spawn_girl,A.anchor_starcourt_center,w/h),tag:'board',at:`${w}x${h}`,aspect:w/h});
 const maxAsp=Math.max(...RL.SCREENS.map(([w,h])=>w/h));
 for(const [k,v] of Object.entries(SF))if(v&&Array.isArray(v.position)&&Array.isArray(v.target))out.push({position:[...v.position],target:[...v.target],fovVerticalDeg:v.fovVerticalDeg??SF.SKY_FINALE?.fovDeg??45,tag:'finale',at:k,aspect:maxAsp});
 const flight=JSON.parse(fs.readFileSync(ROOT+'/creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json','utf8'));
 for(const k of flight.keys)if(k.frame==='world')out.push(W({position:k.cam,target:k.camLook,fovVerticalDeg:k.fov??48},'flightkey',`t=${k.t}`,maxAsp));
 for(const s of RL.SCREENS){const leg=RL.balloonLeg(G,s),t0=BF.CITY_ON_T??0;for(let t=t0;t<=leg.T+1e-9;t+=dt)out.push(W(leg.cam(t),'arrival',`${s[0]}x${s[1]} t=${t.toFixed(2)}`,s[0]/s[1]));}
 for(const s of RL.SCREENS){const leg=RL.lakeLeg(G,s),S=SL.skyLakeContinuous(leg.ride,leg.door,SL.SKY_LAKE_CONT);
  let got=null;const off=TC.onShotContinue(st=>{got=st;});TC.fireShotContinue({pose:leg.start.from});off();
  for(let tau=0;tau<S.flightAt+4;tau+=dt)out.push(W(S.cam(tau,got.pose),'depart',`${s[0]}x${s[1]} tau=${tau.toFixed(2)}`,s[0]/s[1]));}
 return {cams:out,anchors:A};
}
function orbitPivots(A,stepM=3){
 const w=JSON.parse(zlib.gunzipSync(fs.readFileSync(ROOT+'/tools/region-nodes/fixtures/skycity-walkable.json.gz')));const piv=new Map();
 for(const [ci,,y] of w.cells){const x=w.x0+(ci%w.W+.5)*w.c,z=w.z0+(((ci/w.W)|0)+.5)*w.c,k=Math.floor(x/stepM)+','+Math.floor(z/stepM);if(!piv.has(k))piv.set(k,[x,y,z]);}
 return [...piv.values(),...Object.entries(A).filter(([k])=>k!=='anchor_scene_root').map(([,v])=>v)];
}
const ORBIT=[[-6,[3,6,10]],[8,[3,6,10,22]],[22,[4,6,10,22]],[38,[6,10,22,40]],[55,[6,10,22,40]],[72,[10,22,40]]];
/** orbit rays (look point, unit dir, arm); the caller applies the lens guard against the scene. */
function orbitRays(pivots,yawStep=20){const o=[];for(const p of pivots){const look=[p[0],p[1]+1.15,p[2]];
 for(let yaw=0;yaw<360;yaw+=yawStep)for(const [pitch,ds] of ORBIT){const cp=Math.cos(pitch*Math.PI/180),u=[cp*Math.sin(yaw*Math.PI/180),Math.sin(pitch*Math.PI/180),cp*Math.cos(yaw*Math.PI/180)];
  for(const d of ds)o.push({look,u,d,at:`pivot(${p.map(v=>v.toFixed(1))}) yaw ${yaw} pitch ${pitch} arm ${d}`});}}return o;}
module.exports={repoCams,orbitPivots,orbitRays,anchors};
