'use strict';
/* full9c skyframe gate (运镜bot: sail chain put env_skycity at seam+Δ, Δ≈(−0.386,−0.187,+26.619); every downstream consumer — post-seam
 * flight keys, touchdown, S0_GAME, skyMooring5a, the baked sky plans — is in flightpath seam.skycityRootWorld).
 * 1) placeLiveSkycity (real code, real GLB anchors) with the meadow at the bridge root AND at sailMeadowRoot(): root == seam within 1 cm, yaw within 0.05°.
 * 2) the real runSkyFinale end vs skyMooring5a S6 is REPORTED (toS6M); its ≤0.3 m assertion lands with the playFinale end-pose change
 *    (运镜bot's recommended pose), set SKYFRAME_FINALE_MAX_M to enforce early.
 * SKYFRAME_SCRIPTS=<dir> runs it against another scripts tree (fail-before evidence). */
const J=require('./journey-scene.cjs');const {H,meadowNodes,skyNodes,nodePos,rotY,assert}=J;
// harness cc has no Vec3.transformQuat (worldYawDeg): standard quaternion rotate
if(!H.cc.Vec3.transformQuat)H.cc.Vec3.transformQuat=(o,a,q)=>{const ix=q.w*a.x+q.y*a.z-q.z*a.y,iy=q.w*a.y+q.z*a.x-q.x*a.z,iz=q.w*a.z+q.x*a.y-q.y*a.x,iw=-q.x*a.x-q.y*a.y-q.z*a.z;o.x=ix*q.w+iw*-q.x+iy*-q.z-iz*-q.y;o.y=iy*q.w+iw*-q.y+iz*-q.x-ix*-q.z;o.z=iz*q.w+iw*-q.z+ix*-q.y-iy*-q.x;return o;};
const S=process.env.SKYFRAME_SCRIPTS?process.env.SKYFRAME_SCRIPTS.replace(/\/?$/,'/'):J.S;
const BT=H.load(S+'region/BalloonTransit.ts'),BF=H.load(S+'region/BalloonFlight.ts'),TL=H.load(S+'region/TransportLeg.ts'),Lay=H.load(S+'region/RegionJourneyLayout.ts');
const NP=H.load(S+'region/RegionNodePlay.ts'),TS=H.load(S+'region/TransitionStaging.ts'),SP=H.load(S+'region/SkyLakePreWalk.ts');
const doc=JSON.parse(require('fs').readFileSync(J.B+'region_transit_balloon/balloon_flightpath.json','utf8')),seam=doc.seam.skycityRootWorld;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],len=v=>Math.hypot(...v);
const V=(x,y,z)=>({x,y,z});
function rig(name,yaw,origin,anchors){const n={name,children:[],_yaw:yaw,_o:origin.slice(),setRotationFromEuler(_x,y){n._yaw=y;},
 get worldPosition(){return V(...n._o);},setWorldPosition(x,y,z){n._o=[x,y,z];},
 get worldRotation(){const h=n._yaw*Math.PI/360;return {x:0,y:Math.sin(h),z:0,w:Math.cos(h)};}};
 for(const [k,l] of anchors)n.children.push({name:k,children:[],get worldPosition(){return V(...add(rotY(n._yaw,l),n._o));}});return n;}
const skyA=['anchor_cloudbridge_end','anchor_cloudbridge_start'].map(k=>[k,nodePos(skyNodes,k)]);
const mA=[];for(let i=2;i<=Lay.REGION_JOURNEY_LAYOUT.meadowExitPathIndex;i++){const k='walk_path_'+String(i).padStart(2,'0');mA.push([k,nodePos(meadowNodes,k)]);}
const bridgeRoot=sub(add(Lay.islandApproach(J.anchorsIslandStart??JSON.parse(require('fs').readFileSync(J.B+'region_island/combined_anchors_m.json','utf8')).anchors.find(a=>a.name==='exit_path_17').position_world_m).at(-1),Lay.REGION_JOURNEY_LAYOUT.meadowOffset),rotY(180,nodePos(meadowNodes,'player_spawn')));
const chains={bridge:bridgeRoot,sail:TL.sailMeadowRoot()};
const M5=TS.TRANSITION_STAGING.skyMooring5a,s6=M5.walkWorld[0],out={};let ok=true;
// her finale end (skycity local) from the real runSkyFinale
let walks=[];const ch={perform:(a)=>{walks.push(a.path);return Promise.resolve('done');},cancelAndReset(){}};
(async()=>{
 await NP.runSkyFinale(ch,p=>p.map(v=>v.slice()),2000);const endL=walks.at(-1).at(-1);
 for(const [k,root] of Object.entries(chains)){
  const meadow=rig('env_meadow',180,root,mA),model=rig('env_skycity',0,[0,0,0],skyA);
  const start=add(rotY(180,mA[0][1]),root);let r;try{r=BT.placeLiveSkycity(model,meadow,start,doc);}catch(e){r=BT.placeLiveSkycity(model,meadow,start);}
  const d=sub(r.origin,seam.translation),dy=((r.yawDeg-seam.yawDeg)%360+540)%360-180;
  const endW=add(rotY(r.yawDeg,endL),r.origin),pre=len(sub(endW,s6)),preM=pre<=SP.SKY_LAKE_AT_S6_M?0:pre;
  out[k]={meadowRoot:root.map(v=>+v.toFixed(3)),skyRoot:r.origin.map(v=>+v.toFixed(3)),deltaM:d.map(v=>+v.toFixed(3)),errM:+len(d).toFixed(4),yawErrDeg:+dy.toFixed(3),finaleEndLocal:endL.map(v=>+v.toFixed(3)),finaleEndWorld:endW.map(v=>+v.toFixed(3)),toS6M:+pre.toFixed(3),prewalkM:+preM.toFixed(3)};
  const fm=process.env.SKYFRAME_FINALE_MAX_M?+process.env.SKYFRAME_FINALE_MAX_M:Infinity;if(!(len(d)<=0.01&&Math.abs(dy)<=0.05&&pre<=fm))ok=false;}
 console.log(JSON.stringify(out,null,1));
 assert(ok,'skycity root must equal seam.skycityRootWorld (≤1 cm, ≤0.05°) in every chain (and finale ≤ SKYFRAME_FINALE_MAX_M from S6 when set)');
 console.log('skycity-root-frame: PASS');
})().catch(e=>{console.error(e.message);process.exit(1);});
