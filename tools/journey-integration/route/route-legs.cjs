'use strict';
/* b16 route fixture (运镜bot, replaces the rainbow-bridge walking legs of journey-scene.cjs for the three route tests).
 * The b16 journey has no walking legs: island→meadow is the SAIL, meadow→skycity and skycity→lakeside are BALLOONS
 * (JourneyTransport.ts). For each leg and each portrait screen this builds, from the real TypeScript:
 *   cam(t)      the pose the game writes each frame (sailCamera / sailFollowCamera, BalloonFlight plan.camera,
 *               lakesideDoorRideCamera → door hold → lakesideDoorBlendPose), on the leg's own game clock;
 *   her(t)      her root and face/head/chest points (seated on the sail bench, standing on the balloon stand_point, walking);
 *   black(t)    true while a full-screen cover is at alpha 1 (nothing is visible);
 *   los(t,a,b)  first solid blocker between two points, against the FULL scene geometry live at that time
 *               (island + palms, meadow, sailboat at its pose; meadow → full Draco-decoded skycity at the flight frames;
 *               full skycity + all lakeside instances + the balloon prefab at its pose);
 *   segs        continuous camera segments (a new segment starts at a cut that the game hides or at a coordinate re-root);
 *   handoffs    camera hand-offs that must be seamless (≤0.1°, ≤1 cm).
 * Approximations (reported in every report): her walk positions on the dock/shore walks are path-linear at the walk speed
 * (no clip root motion); the balloon roll is applied to her points; clouds are reported as soft occluders, not solids.
 * Day/night: none of these camera functions takes the day/night mode (asserted in test-route-continuity), so the
 * geometric checks are the same frames for day and night; the background check is run per mode. */
const fs=require('node:fs'),path=require('node:path');
const J=require('../journey-scene.cjs'),F=require('../journey-framing-lib.cjs');
const {load:loadGlb}=require('../occlusion/lib-glb.cjs'),{decode}=require('../../camera-frame-test/glb_geometry.cjs');
const LKS=require('../lakeside/lakeside-scene.cjs');
const {H,S,B,add,sub,rotY,routeLength,sampleRoute}=J;
const T=H.load(S+'region/TransportLeg.ts'),SL=H.load(S+'region/SailLanding.ts'),RB=H.load(S+'region/RegionBoardLanding.ts'),Fl=H.load(S+'region/BalloonFlight.ts');
const TSG=H.load(S+'region/TransitionStaging.ts'),LB=H.load(S+'region/LakesideBalloon.ts'),LC=H.load(S+'region/LakesideCameraLayout.ts'),BL=H.load(S+'ui/BoardLayout.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts');
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const STAND={chest:1.2,face:1.5,head:1.6,top:1.7253,halfW:.3},SEAT={head:[0,1.06,-.55],face:[0,.98,-.47],chest:[0,.71,-.55],top:[0,1.18,-.55],feet:[0,.05,.05]};
const bvhOf=(objs)=>F.buildBvh(objs.filter(o=>o.tris&&o.tris.length));
function hit(bvh,a,b){if(!bvh||!bvh.root)return null;const d=sub(b,a),L=Math.hypot(...d);if(L<1e-6)return null;const u=d.map(x=>x/L),h=F.cast(bvh,a,u,L-.05);return h?h.obj.tag+':'+h.obj.name:null;}
const smoother=u=>{const t=Math.min(1,Math.max(0,u));return t*t*t*(t*(t*6-15)+10);};
// b16 item 6: seated body points sampled from the shipped rig (chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb, clip
// sit_hold, frames 0 and 1 identical; skinned verts + joints, root space, +z = facing; tools: /tmp/skel/pose.cjs in the b16 outbox):
// joints head 0.887 / neck 0.845 / chest 0.741 (z -0.02); skinned extent x -0.279..0.211, y 0..1.200, z -0.206..0.657 (knees/feet fwd).
// face = eyes (head joint +0.11 up, +0.10 fwd), head = skull centre, chest = sternum (chest joint +0.06 up, +0.08 fwd).
const SIT_HOLD={face:[0,1.0,.10],head:[-.005,1.04,-.02],chest:[-.005,.80,.06],top:1.2,
 box:[[-.279,0,-.206],[.211,0,-.206],[-.279,0,.657],[.211,0,.657],[-.279,.55,.657],[.211,.55,.657],[-.279,1.2,-.206],[.211,1.2,-.206],[-.279,1.2,.20],[.211,1.2,.20]]};
const standPts=(r)=>({root:r,face:add(r,[0,STAND.face,0]),head:add(r,[0,STAND.head,0]),chest:add(r,[0,STAND.chest,0]),box:boxPts(r,STAND.top),pose:'stand'});
function boxPts(r,top){const o=[];for(const dx of[-STAND.halfW,STAND.halfW])for(const dz of[-STAND.halfW,STAND.halfW])for(const y of[0,top])o.push([r[0]+dx,r[1]+y,r[2]+dz]);return o;}
// ---------- full skycity (Draco) ----------
let skyCache=null;
async function skyLocal(){if(skyCache)return skyCache;const g=await decode(B+'region_skycity/env_skycity.glb');if(!g)throw Error('draco3d not found: set DRACO3D');
 skyCache=Object.entries(g.meshes).map(([name,tr])=>{const t=new Float64Array(tr.length*9);let o=0;for(const tri of tr)for(const v of tri){t[o++]=v[0];t[o++]=v[1];t[o++]=v[2];}return {name,tris:t};});return skyCache;}
const rigid=(objs,tag,frame)=>objs.map(o=>{const t=new Float64Array(o.tris.length);for(let k=0;k<t.length;k+=3){const p=Fl.applyRigid(frame,[o.tris[k],o.tris[k+1],o.tris[k+2]]);t[k]=p[0];t[k+1]=p[1];t[k+2]=p[2];}return {tag,name:o.name,tris:t};});
// ---------- vehicles in their own frame (ray transformed into the vehicle) ----------
const boatNodes=loadGlb(B+'transport_sail/sailboat.glb').filter(n=>n.tris&&n.tris.length&&n.name!=='sail_furled');
const boatBvh=bvhOf(boatNodes.map(n=>({tag:'sailboat',name:n.name,tris:n.tris})));
const balloonNodes=loadGlb(B+'region_transit_balloon/transport_balloon.glb').filter(n=>n.tris&&n.tris.length);
const balloonBvh=bvhOf(balloonNodes.map(n=>({tag:'balloon',name:n.name,tris:n.tris})));
const STAND_POINT=balloonNodes.length?(loadGlb(B+'region_transit_balloon/transport_balloon.glb').find(n=>n.name==='stand_point')||{world:[0,0,0,0,0,0,0,0,0,0,0,0,0,.1,0]}).world.slice(12,15):[0,.1,0];
const rotZ=(deg,p)=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]-s*p[1],s*p[0]+c*p[1],p[2]];};
function boatToWorld(v,p){const c=Math.cos(v.yaw),s=Math.sin(v.yaw);return [v.pos[0]+c*p[0]+s*p[2],v.pos[1]+p[1],v.pos[2]-s*p[0]+c*p[2]];}
function boatHit(v,a,b){const c=Math.cos(-v.yaw),s=Math.sin(-v.yaw),loc=p=>{const q=sub(p,v.pos);return [c*q[0]+s*q[2],q[1],-s*q[0]+c*q[2]];};return hit(boatBvh,loc(a),loc(b));}
// balloon world = pos + rotY(yawDeg, rotZ(roll, local))
const balToWorld=(pos,yawDeg,roll,p)=>add(pos,rotY(yawDeg,rotZ(roll,p)));
function balHit(pos,yawDeg,roll,a,b){const loc=p=>rotZ(-roll,rotY(-yawDeg,sub(p,pos)));return hit(balloonBvh,loc(a),loc(b));}
// ======================= LEG 1: sail island → meadow =======================
function sailLeg(geo,[w,h]){
 const sr=T.sailRoute(),tl=T.sailBeats(sr.length),root=T.sailMeadowRoot(),m0=T.sailM0World(),m1=T.sailM1World(),berth=T.sailBerthWorld();
 const step=SL.meadowLocalToWorld(SL.SAIL_LANDING_STEP_LOCAL,root),walk=SL.SAIL_LANDING_WALK_LOCAL.map(p=>SL.meadowLocalToWorld(p,root));
 const start=J.start,built=T.sailJourneyPath(start,m0,m1,[...sr.samples,...walk]);
 const src={region:'meadow',map:{toJourney:p=>add(rotY(180,p),root),toBoard:p=>rotY(-180,sub(p,root))}};
 const be=RB.regionBoardEnd(src,w/h,{width:w,height:h}),board={position:be.position,target:be.target,fovVerticalDeg:be.fovVerticalDeg};
 const vEnd=T.sailVehicle(tl,sr.samples,tl.beats.find(b=>b.id==='S-e').t1),onBoat=l=>{const c=Math.cos(vEnd.yaw),s=Math.sin(vEnd.yaw);return [berth[0]+l[0]*c+l[2]*s,berth[1]+l[1],berth[2]-l[0]*s+l[2]*c];};
 const standAt=T.seatFromBench(onBoat([0,.06,-.07]),vEnd.yaw),port=onBoat(SL.SAIL_PORT_STEP_LOCAL),v0=T.sailVehicle(tl,sr.samples,0),p0=sr.samples[0];
 const sit=T.seatFromBench([p0[0]-Math.sin(v0.yaw)*.55,p0[1]+.06,p0[2]-Math.cos(v0.yaw)*.55],v0.yaw),dock=[T.SAIL_I6[0]+.75,-.18,p0[2]];
 const boardWalk=[start,[T.SAIL_I6[0],start[1],T.SAIL_I6[2]],dock,sit.seatedFoot],disembark=[standAt.standingFoot,port,step],arrival=[step,...walk.slice(1),m0,m1];
 const B05=tl.build05S,bt=id=>tl.beats.find(b=>b.id===id),arrL=routeLength(arrival),arrS=Math.max(.5,arrL/1.2),HOLD=2,TT=B05+arrS+HOLD;
 // the shore follow lens is stateful (yaw rate-limited): precompute at 60 fps, like the driver's onFrame
 const from=T.sailCamera(tl,sr.samples,B05,{w,h}),st={yaw:null},FOL=[];for(let i=0;i*(1/60)<=arrS+HOLD+1e-9;i++){const e=i/60;FOL.push(T.sailFollowCamera(arrival,Math.min(1,e/arrS),from,board,st));}
 // b16 item 2: sailFollowCamera is stateless, so sample it at the exact time (FOL[round] duplicated/skipped frames → fake accel).
 const cam=t=>t<=B05?T.sailCamera(tl,sr.samples,t,{w,h}):T.sailFollowCamera(arrival,Math.min(1,(t-B05)/arrS),from,board,{yaw:null});
 const her=t=>{
  if(t<bt('S-b').t0){const L=routeLength(boardWalk);return standPts(sampleRoute(boardWalk,Math.min(L,t*1.2)));}
  if(t<bt('S-f').t0){const v=T.sailVehicle(tl,sr.samples,t),W=p=>boatToWorld(v,p);return {root:W([0,0,-.55]),face:W(SEAT.face),head:W(SEAT.head),chest:W(SEAT.chest),box:[W(SEAT.feet),W(SEAT.top),W([-.3,.05,-.85]),W([.3,.05,-.85]),W([-.3,1.18,-.25]),W([.3,1.18,-.25])],pose:'seated',v};}
  if(t<=B05){const u=(t-bt('S-f').t0)/(B05-bt('S-f').t0),L=routeLength(disembark);return standPts(sampleRoute(disembark,Math.min(L,Math.max(0,u)*L)));}
  return standPts(sampleRoute(arrival,Math.min(arrL,(t-B05)*1.2)));};
 const los=(t,a,b)=>{const x=hit(geo.sail,a,b);if(x)return x;const v=T.sailVehicle(tl,sr.samples,Math.min(t,B05));return boatHit(v,a,b);};
 const jc0=Core.journeyCamera(built.path,0,J.start1,undefined,undefined,0,undefined,{...be});
 return {id:'sail island→meadow',T:TT,cam,her,black:()=>false,los,
  segs:[[0,B05],[B05,TT]],
  arrival,arrS,B05,arcWin:T.sailArcWindow?T.sailArcWindow(tl):{t0:bt('S-c').t0,t1:bt('S-d').t1},
  handoffs:[{name:'sail S-g end → shore follow (beginArrival)',a:T.sailCamera(tl,sr.samples,B05,{w,h}),b:FOL[0]},{name:'shore follow end → meadow board camera',a:FOL[Math.round(arrS*60)],b:board}],
  start:{name:'island lens → sail K1 (set-off; ride lease: no set-off fade)',from:J.start1,controller:jc0,ride:cam(0)},
  phases:tl.beats.map(b=>({id:b.id,t0:b.t0,t1:b.t1})).concat([{id:'shore-walk',t0:B05,t1:B05+arrS},{id:'board-hold',t0:B05+arrS,t1:TT}]),board};
}
// ======================= LEG 2: balloon meadow → skycity =======================
function balloonLeg(geo,[w,h]){
 global.__QF_BALLOON_FLIGHT=geo.flight;
 const m6=add(rotY(180,[0.2,6.5,-25.6]),J.mOff),plan=T.balloonBeats(m6,[5.4,-0.11,43.8],J.sp('anchor_starcourt_center'),{walkInM:0,walkOutM:0,cityFrame:{yawDeg:J.yaw,origin:J.sOff}});
 const TT=plan.total,GY=-76.6;
 // b19: she rides SEATED (TransitionStaging BASKET_RIDE_POSE.meadowSkycity: sit_hold, root (.032,0,-.099) in the basket-root frame, yaw 0)
 const RP=TSG.BASKET_RIDE_POSE.meadowSkycity;void GY;
 const her=t=>{const v=plan.vehicle(t),yd=v.yaw*180/Math.PI,W=p=>balToWorld(v.pos,yd+RP.yawDeg,v.roll,add(RP.offset,p)),K=SIT_HOLD;
  return {root:W([0,0,0]),face:W(K.face),head:W(K.head),chest:W(K.chest),box:K.box.map(W),pose:'seated(basket, sit_hold skeleton)',v};};
 const fade=t=>t<35.7?0:t<35.9?(t-35.7)/.2:t<36?1:0;// test_frame_background handoffFade (landing cloud cover)
 const los=(t,a,b)=>{const solid=[t<Fl.MEADOW_OFF_T?geo.meadow:null,t>=Fl.CITY_ON_T?geo.cityB:null,t>=Fl.ISLETS_ON_T?geo.isletsB:null].filter(Boolean);
  for(const g of solid){const x=hit(g,a,b);if(x)return x;}const v=plan.vehicle(t);return balHit(v.pos,v.yaw*180/Math.PI,v.roll,a,b);};
 const soft=(t,a,b)=>hit(t<Fl.SEAM_T?geo.cloudsPre:geo.cloudsPost,a,b);
 const route=T.balloonRoutePoints(J.mA('player_spawn'),plan);
 return {id:'balloon meadow→skycity',T:TT,cam:t=>plan.camera(t,{w,h})/* runtime passes the view size (BalloonTransit) */,her,black:t=>fade(t)>=.999,los,soft,
  segs:[[0,Fl.SEAM_T-1e-6],[Fl.SEAM_T,TT]],revealWin:{t0:5.8,t1:27}/* B-d city reveal (flight beats) */,seam:{t:Fl.SEAM_T,rel:t=>{const c=plan.camera(t),v=plan.vehicle(t),y=v.yaw*180/Math.PI;return {position:rotY(-y,sub(c.position,v.pos)),target:rotY(-y,sub(c.target,v.pos)),fovVerticalDeg:c.fovVerticalDeg};}},
  handoffs:[],start:{name:'controller journeyCamera(d=0) → balloon ride camera(0)',from:null,controller:null,ride:plan.camera(0),routeStart:route[0]},
  phases:plan.beats.map(b=>({id:b.id,t0:b.t0,t1:b.t1})),plan};
}
// ======================= LEG 3: balloon skycity → lakeside =======================
function lakeLeg(geo,[w,h]){
 const S6=add(rotY(J.yaw,[0.2,0.032,-27.8]),J.sOff),S4=add(rotY(J.yaw,[0.2,3.308,-5.8]),J.sOff),L=LC.lakesideJourney(S6),K=LB.LAKESIDE_BALLOON_LANDING,DH=LB.LAKESIDE_DOOR_HOLD,SD=LB.LAKESIDE_STEPDOWN;
 const shore=L.arrival[L.arrival.length-1],fr=LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h)),lan=LC.lakesideScreenLanding(L,fr,LC.LAKESIDE_CAMERA_LAYOUT.stopLocal);
 const E=Core.arrivalPose([shore,L.toWorld([...LC.LAKESIDE_CAMERA_LAYOUT.stopLocal])],L.focus,lan),land={position:E.position,target:E.target,fovVerticalDeg:lan.arrivalFovDeg};
 const M=LB.lakesideBalloonMooring(shore,L.toWorld),R=LB.lakesideBalloonRide([S6,...K.walkLocal.slice(1).map(p=>L.toWorld([p[0],p[1],p[2]]))],L.toWorld([K.launchLocal[0],K.launchLocal[1],K.launchLocal[2]]),M.mooring,land);
 // T-03: the adapter's wide touchdown lens (fallback: the b16 door lens) held under the sign; option B board blend from touchdown + lakesideBoardBlendAtS() until her walk reaches the board entry distance
 const wide=LB.lakesideDoorWideLens(M.walk,M.mooring,land,w/h,{...BL.boardSafeInsets(w,h),h}),door=wide?wide.lens:LB.lakesideDoorLens(M.walk,M.mooring,w/h,undefined,undefined,{...BL.boardSafeInsets(w,h),h});
 // skycity follow camera at set-off (free-camera SPEC default, as the lakeside-landing-cam audit): pitch 17°, 7.36 m, FOV 48
 const f=sub(S6,S4),hl=Math.hypot(f[0],f[2]),yy=Math.atan2(f[0]/hl,f[2]/hl),c0=[S6[0],S6[1]+1,S6[2]],pp=17*Math.PI/180,D=7.36;
 const from={position:[c0[0]-Math.sin(yy)*Math.cos(pp)*D,c0[1]+Math.sin(pp)*D,c0[2]-Math.cos(yy)*Math.cos(pp)*D],target:c0,fovVerticalDeg:48};
 // exit: door hold until outT, then ONE game-time door → board blend (durS); timings as test-lakeside-landing-board-progress
 const blendS=LB.lakesideDoorBlendS(door,land),entryM=LB.lakesideBoardEntryM(M.walk,land,w/h,DH.outM),mean=M.length/M.walkS,durS0=LB.lakesideDoorBlendDurS(blendS,DH.outM,entryM,mean);
 const walkAt=M.walkStartAt+SD.durationS,outT0=Math.min(M.walkStartAt+DH.outM/mean+DH.capPadS,walkAt+Math.max(0,DH.outM-SD.forwardEnd)/K.exitWalkMps),Wl=routeLength(M.walk);;
 const exitS=t=>t<M.walkStartAt?0:t<walkAt?SD.forwardEnd*(t-M.walkStartAt)/SD.durationS:Math.min(Wl,SD.forwardEnd+(t-walkAt)*K.exitWalkMps);
 const outT=wide?LB.lakesideBoardBlendAtS():outT0,walkedB=exitS(outT),durS=wide?LB.lakesideBoardBlendDurS(door,land,walkedB,LB.lakesideBoardEntryM(M.walk,land,w/h,walkedB),K.exitWalkMps):durS0;
 const TT=R.T+outT+durS+1;
 const herAt=t=>t<=R.T?R.girl(t):sampleRoute(M.walk,exitS(t-R.T));
 const cam=t=>{if(t<=R.T)return LB.lakesideDoorRideCamera(R,door,t,from);const e=t-R.T;if(e<outT)return door;if(e<outT+durS){const p=herAt(t);return LB.lakesideDoorBlendPose(door,land,(e-outT)/durS,[p[0],p[1]+1.2,p[2]],wide?LB.LAKESIDE_TOUCHDOWN.blendAimPull:undefined);}return land;};
 // aboard (cutT…T) she rides SEATED at stand_point local (.032,-.1,-.099) (b15 stand-up v1b), basket at the door yaw for the whole ride
 const seatLocal=add(STAND_POINT,[.032,-.1,-.099]);
 const herSeated=t=>{const v=t<R.cutT?R.flight.vehicle(t-R.liftT)/* lift-off shown by SkyLakeContinuous: flight clock */:R.vehicle(t),W=p=>balToWorld(v,M.doorYawDeg,0,add(seatLocal,p)),K=SIT_HOLD;return {root:W([0,0,0]),face:W(K.face),head:W(K.head),chest:W(K.chest),box:K.box.map(W),pose:'seated(basket, sit_hold skeleton)',aboard:true};};
 const her=t=>{if(!(t>=R.cutT&&t<=R.T)){const s=standPts(herAt(t));return s;}const v=R.vehicle(t),W=p=>balToWorld(v,M.doorYawDeg,0,add(seatLocal,p)),K=SIT_HOLD;
  return {root:W([0,0,0]),face:W(K.face),head:W(K.head),chest:W(K.chest),box:K.box.map(W),pose:'seated(basket, sit_hold skeleton)',aboard:true};};
 const los=(t,a,b)=>{const x=hit(geo.lake,a,b);if(x)return x;const v=t<=R.T?R.vehicle(t):M.mooring;return balHit(v,M.doorYawDeg,0,a,b);};
 return {id:'balloon skycity→lakeside',T:TT,cam,her,herSeated,
  /* after the door hold the controller arrives and the board fades in over her exit walk (b15: 'still overlapping the rest of her
     (offscreen) walk'); the path-v4 walk to the board stop is not modelled here, so her-based checks stop at R.T+outT. */
  herValid:t=>t<=R.T+outT+(wide?durS-LB.LAKESIDE_TOUCHDOWN.blendPadS:0)/* T-03: her framing/occlusion is checked through the option-B blend too, up to the last blendPadS where the lens settles onto the accepted board view (her stop at its lower right is that view's own composition) */,black:t=>t<=R.T&&R.cover(t)>=.999,los,
  segs:[[0,R.cutT-1e-6],[R.cutT+1e-6,TT]],cut:{t:R.cutT,underBlack:R.cover(R.cutT)>=.999},
  handoffs:[{name:'ride end → door lens (touchdown)',a:LB.lakesideDoorRideCamera(R,door,R.T-1e-6,from),b:door},{name:'door→board blend end → lakeside board camera',a:LB.lakesideDoorBlendPose(door,land,1,herAt(R.T+outT+durS)),b:land}],
  start:{name:'skycity follow lens → ride camera(0)',from,controller:null,ride:cam(0)},
  phases:[{id:'walk-to-basket',t0:0,t1:R.cutT},{id:'flight',t0:R.cutT,t1:R.T},{id:'door-hold',t0:R.T,t1:R.T+outT},{id:'door→board blend',t0:R.T+outT,t1:R.T+outT+durS},{id:'board',t0:R.T+outT+durS,t1:TT}],
  toLocal:p=>rotY(-L.yawDeg,sub(p,L.root)),L,land,timing:{rideT:R.T,cutT:R.cutT,outT,durS},ride:R,door/* transitions segment 6 test */};
}
// ======================= geometry =======================
async function geometry(){
 const sky=await skyLocal();
 const sf=require('../../transitions/sail_farsea_lib.cjs').scene();
 const sail=bvhOf([...J.island,...sf.meadow.map(o=>({tag:'meadow',name:o.name,tris:o.tris}))]);
 const flight=JSON.parse(fs.readFileSync(B+'region_transit_balloon/balloon_flightpath.json','utf8'));global.__QF_BALLOON_FLIGHT=flight;
 const m6=add(rotY(180,[0.2,6.5,-25.6]),J.mOff),plan=T.balloonBeats(m6,[5.4,-0.11,43.8],J.sp('anchor_starcourt_center'),{walkInM:0,walkOutM:0,cityFrame:{yawDeg:J.yaw,origin:J.sOff}});
 const HIDDEN=/^(env_sky_cloud_small|env_sky_cloudsea|env_sky_cumulus_far|Icosphere|env_sky_dome)$|^state_/,ISLET=new Set(Fl.ISLET_NODES);
 const cityObjs=rigid(sky.filter(o=>!HIDDEN.test(o.name)&&!ISLET.has(o.name)),'skycity',{yawDeg:plan.yawDeg,origin:plan.origin});
 const isletObjs=rigid(sky.filter(o=>ISLET.has(o.name)),'skycity',{yawDeg:plan.yawDeg,origin:plan.origin});
 const meadow=bvhOf(J.meadow);
 const clouds=loadGlb(B+'region_transit_balloon/transit_clouds_merged.glb').filter(n=>n.tris&&n.tris.length);
 const cloudsPre=bvhOf(rigid(clouds.filter(n=>!Fl.CITY_CLOUD.includes(n.name)),'cloud',Fl.meadowFrameFromM6(m6))),cloudsPost=bvhOf(rigid(clouds,'cloud',Fl.postSeamFrame(flight)));
 // lakeside leg: full skycity at the journey placement + every lakeside instance at lakesideJourney(S6)
 const S6=add(rotY(J.yaw,[0.2,0.032,-27.8]),J.sOff),L=LC.lakesideJourney(S6);
 const lakeObjs=LKS.instances().map(i=>{const t=new Float64Array(i.tris.length);for(let k=0;k<t.length;k+=3){const p=L.toWorld([i.tris[k],i.tris[k+1],i.tris[k+2]]);t[k]=p[0];t[k+1]=p[1];t[k+2]=p[2];}return {tag:'lake',name:i.name,tris:t};});
 const skyJ=rigid(sky.filter(o=>!/cloudsea|cumulus_far|cloud_small|Icosphere|_after|env_sky_dome/.test(o.name)),'skycity',{yawDeg:J.yaw,origin:J.sOff});
 return {sail,meadow,cityB:bvhOf(cityObjs),isletsB:bvhOf(isletObjs),cloudsPre,cloudsPost,flight,lake:bvhOf([...lakeObjs,...skyJ]),lakeOnly:bvhOf(lakeObjs),skyJ:bvhOf(skyJ),
  info:{skycityMeshes:sky.length,skycityTris:sky.reduce((a,o)=>a+o.tris.length/9,0),lakesideInstances:lakeObjs.length,islandObjs:J.island.length,meadowObjs:J.meadow.length,balloonParts:balloonNodes.length,boatParts:boatNodes.length,standPoint:STAND_POINT}};
}
module.exports={skyLocal,rigid,balToWorld,balHit,SIT_HOLD,STAND_POINT,standPts,SCREENS,STAND,geometry,sailLeg,balloonLeg,lakeLeg,legs:[sailLeg,balloonLeg,lakeLeg],F,J,BL,hit};
