import type { RouteConfig, Vec, Pose } from './WorldFlowCore';
import { pointOnPath } from './WorldFlowCore';
import { islandPoseEntry, homePoseEntry, characterPoseEntry, REGION_CAMERA, INTERIOR_CAMERA_CLEARANCE, TRANSITION_CAMERA } from './RegionCameraData';
import type { RailKey } from './RegionCameraData';
import { assertAuthoredPose, invertProgress } from './CameraPose';
/** v1.3: authored poses must carry position+target+fovVerticalDeg; validated (finite, roll 0, fov range) at route creation. */
const dataPose=(e:any,name:string):Pose=>{const a=assertAuthoredPose(e,name);return {position:[a.position[0],a.position[1],a.position[2]],target:[a.target[0],a.target[1],a.target[2]],fovVerticalDeg:a.fovVerticalDeg};};
/** T2+ pure: unit XZ walk tangent at progress (central difference along arclength). */
export function walkTangent(route:readonly Vec[],progress:number):[number,number] {
  const a=pointOnPath(route,Math.max(0,progress-.03)),b=pointOnPath(route,Math.min(1,progress+.03)),dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz);
  if(!(l>1e-9))throw Error('Degenerate walk tangent');return [dx/l,dz/l];
}
/** T2+ pure: rail lens beside the walk (see RegionCameraData RailKey). */
export function railPose(route:readonly Vec[],k:RailKey):Pose {
  const r=pointOnPath(route,k.progress),[tx,tz]=walkTangent(route,k.progress),nx=k.side*tz,nz=-k.side*tx;
  return {position:[r[0]+nx*k.distance+tx*k.lead,r[1]+k.height,r[2]+nz*k.distance+tz*k.lead],
    target:[r[0]+tx*k.look,r[1]+k.targetHeight,r[2]+tz*k.look],fovVerticalDeg:k.fovVerticalDeg,progress:k.progress};
}
/** T2+ pure: crane pose at u (0 = rail pose `a` about root ra, 1 = pose `b` about root rb), lens orbiting the girl's
 *  CURRENT root: direction slerp, log-distance, target eased (u^1.6) from the rail target to b.target, fov linear. */
export function cranePose(a:Pose,ra:Vec,b:Pose,rb:Vec,root:Vec,u:number,progress:number):Pose {
  const va=[a.position[0]-ra[0],a.position[1]-ra[1],a.position[2]-ra[2]],vb=[b.position[0]-rb[0],b.position[1]-rb[1],b.position[2]-rb[2]];
  const la=Math.hypot(va[0],va[1],va[2]),lb=Math.hypot(vb[0],vb[1],vb[2]),ua=va.map(v=>v/la),ub=vb.map(v=>v/lb);
  const om=Math.acos(Math.max(-1,Math.min(1,ua[0]*ub[0]+ua[1]*ub[1]+ua[2]*ub[2]))),so=Math.sin(om);
  const d=so<1e-6?ua.map((v,i)=>v+(ub[i]-v)*u):ua.map((v,i)=>(Math.sin((1-u)*om)*v+Math.sin(u*om)*ub[i])/so);
  const L=la*Math.pow(lb/la,u),w=Math.pow(u,1.6);
  const ta=[a.target[0]-ra[0]+root[0],a.target[1]-ra[1]+root[1],a.target[2]-ra[2]+root[2]];
  return {position:[root[0]+d[0]*L,root[1]+d[1]*L,root[2]+d[2]*L],target:[ta[0]+(b.target[0]-ta[0])*w,ta[1]+(b.target[1]-ta[1])*w,ta[2]+(b.target[2]-ta[2])*w],
    fovVerticalDeg:a.fovVerticalDeg!+(b.fovVerticalDeg!-a.fovVerticalDeg!)*u,progress};
}
/** Source samples are preserved. Only explicit, documented joins are authored here. */
/** WALK-DURATION CONTRACT (lead-approved; final profile owner: 角色动画bot). walkDuration(path) is the ONE source of walk
 * time for character, camera, room light, crane mark and settle timing. Default = constant speed (pathDuration at
 * WALK_SPEED), i.e. behaviour unchanged. The animation bot replaces the body (e.g. + ~0.3 s accel/decel) and reports the
 * distance-travelled fraction via CharacterAdapter.walkProgress(); camera progress then follows distance, not time. */
export const WALK_SPEED = .7;
export function walkDuration(path: readonly Vec[]): number { let L = 0; for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]); return L / WALK_SPEED; }
export function createFirstsliceRoutes(facts:any,reference:{seatedRoot:Vec;standingRoot:Vec;walkEndRoot:Vec;seatYawRad:number},options?:{walkDuration?:(path:readonly Vec[])=>number}):RouteConfig {
  const walkDurationFn=options?.walkDuration??walkDuration;
  if(facts.units!=='m'||facts.up!=='+Y'||facts.outdoorForward!=='+Z')throw Error('Unsupported asset axes/units');
  const a=(name:string):Vec=>{const p=facts.anchors[name]?.position;if(!p||p.length!==3||!p.every(Number.isFinite))throw Error('Missing anchor '+name);return [...p] as unknown as Vec;};
  const range=(prefix:string,first:number,last:number):Vec[]=>Array.from({length:last-first+1},(_,i)=>a(prefix+'_'+String(i+first).padStart(2,'0')));
  // 0007 v1.2: home/island stable poses are DATA (RegionCameraData.ts, homePoseSource/islandPoseSource switches).
  const home=homePoseEntry(),island=islandPoseEntry(),girl=characterPoseEntry();
  const cameraHome:Pose=dataPose(home,'home');
  const toDoor:Vec[]=[reference.standingRoot,reference.walkEndRoot,...range('exit_path',3,4),a('door_stand_point')];
  const lengths=toDoor.slice(1).map((p,i)=>Math.hypot(p[0]-toDoor[i][0],p[2]-toDoor[i][2]));
  const total=lengths.reduce((a,b)=>a+b,0);let travelled=0;
  // Only lens positions change: preserve source target, arclength progress and 60-degree FOV.
  if(toDoor.length!==INTERIOR_CAMERA_CLEARANCE.followPositions.length)throw Error('Interior clearance route needs re-audit');
  const cameraToDoor:Pose[]=toDoor.map((p,i)=>{
    if(i>0)travelled+=lengths[i-1];
    return {position:INTERIOR_CAMERA_CLEARANCE.followPositions[i],target:[p[0],.85,p[2]],fovVerticalDeg:60,progress:travelled/total};
  });
  const cameraInside:Pose=cameraToDoor[cameraToDoor.length-1];
  // Retain both approved stable cameras. This close follow pose stays behind the moving actor,
  // rather than putting the lens beside her at the old outdoor threshold.
  const cameraOutside:Pose={position:[-.35,1.35,-.9],target:[-.3,.86,1.3],fovVerticalDeg:72};
  const outCrossing:Vec[]=[a('door_stand_point'),a('exit_point'),...range('exit_path',6,7)];
  const toIsland:Vec[]=range('exit_path',7,17);
  const toThreshold:Vec[]=[a('exit_path_17'),...range('return_path',0,7)];
  const inCrossing:Vec[]=[a('return_path_07'),a('return_path_08'),a('entrance_point')];
  const follow=(route:readonly Vec[],progress:number,position:Vec,fovVerticalDeg:number):Pose=>{
    const p=pointOnPath(route,progress);return {position,target:[p[0],p[1]+.86,p[2]],fovVerticalDeg,progress};
  };
  const cameraIsland:Pose=dataPose(island,'island');
  const cameraCharacter:Pose=dataPose(girl,'character');
  // Intermediate targets/FOV remain on the ORIGINAL linear blend at their original total progress.
  // Inherited outside FOV is 60 on exit but island FOV (42) on return; do not turn return into a zoom jump.
  const guarded=(start:Pose,end:Pose,guards:readonly {position:Vec;progress:number}[],fallbackFov:number):Pose[]=>[
    {...start,progress:0},
    ...guards.map(g=>({position:g.position,progress:g.progress,
      target:start.target.map((v,i)=>v+(end.target[i]-v)*g.progress) as unknown as Vec,
      fovVerticalDeg:(start.fovVerticalDeg??fallbackFov)+((end.fovVerticalDeg??fallbackFov)-(start.fovVerticalDeg??fallbackFov))*g.progress})),
    {...end,progress:1},
  ];
  const cameraHomeToDoor=REGION_CAMERA.homePoseSource==='sitting-room'
    ? guarded(cameraHome,cameraToDoor[0],[INTERIOR_CAMERA_CLEARANCE.homeGuard],cameraHome.fovVerticalDeg!)
    : [cameraHome,cameraToDoor[0]];
  const cameraCrossOut:Pose[]=[{...cameraInside,progress:0},
    follow(outCrossing,.35,[-.65,1.5,-1.45],70),follow(outCrossing,.55,[-.4,1.45,-1.2],72),{...cameraOutside,progress:1}];
  const cameraCrossIn:Pose[]=[{...cameraOutside,progress:0},
    follow(inCrossing,.45,[-.4,1.45,-1.2],72),follow(inCrossing,.65,[-.65,1.5,-1.45],70),{...cameraInside,progress:1}];
  // Clear the portal before the orbit; elevated middle keys also avoid the foreground tree.
  const cameraToIsland:Pose[]=[{...cameraOutside,progress:0},
    follow(toIsland,.4,[-.3,1.55,1.05],72),follow(toIsland,.65,[-6.3,6.3,3],60),{...cameraIsland,progress:1}];
  const cameraToThreshold:Pose[]=[{...cameraIsland,progress:0},
    follow(toThreshold,.35,[-6.3,6.3,3],60),follow(toThreshold,.6,[-.3,1.55,1.05],72),{...cameraOutside,progress:1}];
  const toSeat:Vec[]=[a('entrance_point'),...range('return_path',10,15),reference.standingRoot];

  // T2/T3a: data-driven transition keys (RegionCameraData.TRANSITION_CAMERA). Junction keys are shared between moves so
  // every hand-off is C0; walkSpan makes crossOut+toIsland and toThreshold+crossIn single C1 tracks.
  const t2=TRANSITION_CAMERA?.enabled&&REGION_CAMERA.homePoseSource==='sitting-room'?(()=>{
    const K=TRANSITION_CAMERA.keys;
    const key=(name:string,route:readonly Vec[],progress:number):Pose=>{const k=K[name];if(!k)throw Error('Missing transition camera key '+name);
      const p=pointOnPath(route,progress);return {position:[...k.position] as unknown as Vec,target:[p[0],p[1]+k.targetHeight,p[2]],fovVerticalDeg:k.fovVerticalDeg,progress};};
    const at=(name:string,progress:number,root:Vec):Pose=>{const k=K[name];return {position:[...k.position] as unknown as Vec,target:[root[0],root[1]+k.targetHeight,root[2]],fovVerticalDeg:k.fovVerticalDeg,progress};};
    const dp=cameraToDoor.map(k=>k.progress!);
    const D=['D0','D1','D2','D3','D4'].map((n,i)=>key(n,toDoor,dp[i]));
    // T2+ rail + crane (data: TRANSITION_CAMERA.railOut/railIn/crane/craneDown). Off while the rail lists are empty.
    const T=TRANSITION_CAMERA,railOn=T.railOut.length>0&&T.railIn.length>0;
    // T2+: crossing-out ends on a lens just behind her in the doorway (generated, not the old in-room 'O' key).
    const inside=D[4],outside=railOn?railPose(outCrossing,{...T.crossOutEnd,progress:1}):key('O',outCrossing,1),insideReturn=key('IR',inCrossing,1),outsideReturn=key('OR',toThreshold,1);
    const walkS=walkDurationFn; // shared walk-duration contract (see walkDuration)
    const outboundRail=():Pose[]=>{const cs=T.crane.startProgress,rail=T.railOut.filter(k=>k.progress<=cs).map(k=>railPose(toIsland,k));
      const start=rail[rail.length-1];if(!start||Math.abs(start.progress!-cs)>1e-9)throw Error('railOut must end on crane.startProgress');
      const w=walkS(toIsland),total=(1-cs)*w+T.crane.settleSeconds,ra=pointOnPath(toIsland,cs),rb=toIsland[toIsland.length-1],keys:Pose[]=[];
      for(let i=1;i<=T.crane.steps;i++){const p=cs+(1-cs)*i/T.crane.steps;keys.push(cranePose(start,ra,cameraIsland,rb,pointOnPath(toIsland,p),(p-cs)*w/total,p));}
      return [{...outside,progress:0},...rail,...keys,{...cameraIsland,progress:1}];};
    const inboundRail=():Pose[]=>{const ce=T.craneDown.endProgress,rail=T.railIn.map(k=>railPose(toThreshold,k)),end=rail[0];
      if(!end||Math.abs(end.progress!-ce)>1e-9)throw Error('railIn must start on craneDown.endProgress');
      const w=walkS(toThreshold),turn=1.5+T.craneDown.leadSeconds,total=turn+ce*w,ra=pointOnPath(toThreshold,ce),rb=toThreshold[0],keys:Pose[]=[];
      for(let i=1;i<T.craneDown.steps;i++){const q=ce*i/T.craneDown.steps,u=1-(turn+q*w)/total;keys.push(cranePose(end,ra,cameraIsland,rb,pointOnPath(toThreshold,q),u,q));}
      // Door approach: authored absolute keys (doorstep, doorway; lens passes the narrow gap between jamb and open leaf
      // below the doorway palm) BEFORE she reaches the door, so she is framed from inside as she walks in.
      const door=T.railInDoor.map(d=>key(d.key,toThreshold,d.progress));
      if(door.length&&rail.some(r=>r.progress!>=door[0].progress!))throw Error('railIn keys must precede railInDoor');
      return [{...cameraIsland,progress:0},...keys,...rail,...door,{...outsideReturn,progress:1}];};
    return {
      cameraToDoor:D,cameraInside:inside,
      cameraHomeToDoor:[{...cameraHome,progress:0},at('G',.5,reference.standingRoot),{...D[0],progress:1}],
      cameraCrossOut:[{...inside,progress:0},key('X1',outCrossing,.35),key('X2',outCrossing,.55),{...outside,progress:1}],
      cameraToIsland:railOn?outboundRail():[{...outside,progress:0},key('I1',toIsland,.4),follow(toIsland,.65,[-6.3,6.3,3],60),{...cameraIsland,progress:1}],
      cameraToThreshold:railOn?inboundRail():[{...cameraIsland,progress:0},follow(toThreshold,.35,[-6.3,6.3,3],60),key('T2',toThreshold,.6),{...outsideReturn,progress:1}],
      ...(TRANSITION_CAMERA.standTurn&&K[TRANSITION_CAMERA.standTurn.key]?{cameraStandTurn:[{...cameraHome,progress:0},
        at(TRANSITION_CAMERA.standTurn.key,TRANSITION_CAMERA.standTurn.mid,reference.standingRoot),{...D[0],progress:1}]}:{}),
      ...(railOn?{crane:{startProgress:T.crane.startProgress,settleSeconds:T.crane.settleSeconds,returnLeadSeconds:T.craneDown.leadSeconds,
        // crane-start mark: outbound span = crossing-out walk + toIsland walk + settle (all known here); eased track time of the key.
        startSeconds:(()=>{const a=walkS(outCrossing),b=walkS(toIsland),total=a+b+T.crane.settleSeconds;return total*invertProgress((a+T.crane.startProgress*b)/total,T.tracks.outbound as any);})()}}:{}),
      cameraCrossIn:[{...outsideReturn,progress:0},key('C1',inCrossing,.3),key('C2',inCrossing,.55),key('C3',inCrossing,.8),{...insideReturn,progress:1}],
      cameraToSeat:[{...insideReturn,progress:0},key('S1',toSeat,.14),key('S2',toSeat,.28),key('S3',toSeat,.42),key('S4',toSeat,.57),key('S5',toSeat,.71),key('S6',toSeat,.86),{...cameraHome,progress:1}],
      cameraTracks:TRANSITION_CAMERA.tracks as RouteConfig['cameraTracks'],
      interiorLighting:TRANSITION_CAMERA.lighting,
      // T2+ wind channel: keys in outbound-span key progress (crossing-out walk + toIsland walk + settle, all from walkDuration).
      ...(railOn&&T.windOut?{wind:{outbound:(()=>{const W=T.windOut,a=walkS(outCrossing),b=walkS(toIsland),tot=a+b+T.crane.settleSeconds;
        const f=T.railOut.filter(k=>k.frontal);if(f.length!==1)throw Error('railOut needs exactly one frontal key');
        const fp=f[0].progress,he=T.crane.startProgress;if(!(W.swingStart<fp&&fp<he))throw Error('wind: swingStart < frontal < crane.startProgress');
        const out=(q:number)=>q*a/tot,isl=(p:number)=>(a+p*b)/tot;
        const keys:Array<readonly [number,number]>=[[0,0],[out(W.doorProgress),W.base],[isl(W.swingStart),W.base],[isl(fp),1],[isl(he),1],[1,0]];
        for(let i=1;i<keys.length;i++)if(!(keys[i][0]>keys[i-1][0]))throw Error('wind keys must increase');return keys;})()}}:{}),
    };
  })():null;

  return {
    seat:{position:a('seat_anchor'),back:a('seat_back'),yawRad:facts.anchors.seat_anchor.properties.yaw_rad,seatedFoot:a('seated_foot_anchor'),standingFoot:a('stand_up_foot_anchor'),seatedControllerRoot:reference.seatedRoot,standingControllerRoot:reference.standingRoot},
    // Use the audited lower-reference controller route, never use a foot anchor as root/pelvis.
    toDoor,
    outCrossing,
    toIsland,
    // Preserve the real 2.97 mm endpoint gap as an explicit connector, never rename the anchors.
    toThreshold,
    inCrossing,
    toSeat,
    walkDuration:walkDurationFn,cameraHome,cameraHomeToDoor,cameraToDoor,cameraInside,cameraOutside,cameraCrossOut,cameraCrossIn,cameraIsland,cameraCharacter,cameraToIsland,cameraToThreshold,openDeg:facts.door.openDeg,speed:WALK_SPEED,
    islandYawRad:(island.characterYawDeg??0)*Math.PI/180,
    ...(t2??{}),
  };
}
