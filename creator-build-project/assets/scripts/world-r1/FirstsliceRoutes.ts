import type { RouteConfig, Vec, Pose } from './WorldFlowCore';
import { pointOnPath, pathDuration, spanCameraKeys } from './WorldFlowCore';
import { islandPoseEntry, homePoseEntry, characterPoseEntry, REGION_CAMERA, INTERIOR_CAMERA_CLEARANCE, TRANSITION_CAMERA } from './RegionCameraData';
import type { RailKey } from './RegionCameraData';
import { assertAuthoredPose, invertProgress, remapProgress } from './CameraPose';
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
 *  CURRENT root: direction slerp, log-distance (or linear: linearDistance), target eased (u^1.6) from the rail target to b.target, fov linear. */
export function cranePose(a:Pose,ra:Vec,b:Pose,rb:Vec,root:Vec,u:number,progress:number,linearDistance=false):Pose {
  const va=[a.position[0]-ra[0],a.position[1]-ra[1],a.position[2]-ra[2]],vb=[b.position[0]-rb[0],b.position[1]-rb[1],b.position[2]-rb[2]];
  const la=Math.hypot(va[0],va[1],va[2]),lb=Math.hypot(vb[0],vb[1],vb[2]),ua=va.map(v=>v/la),ub=vb.map(v=>v/lb);
  const om=Math.acos(Math.max(-1,Math.min(1,ua[0]*ub[0]+ua[1]*ub[1]+ua[2]*ub[2]))),so=Math.sin(om);
  const d=so<1e-6?ua.map((v,i)=>v+(ub[i]-v)*u):ua.map((v,i)=>(Math.sin((1-u)*om)*v+Math.sin(u*om)*ub[i])/so);
  const L=linearDistance?la+(lb-la)*u*u*(2-u):la*Math.pow(lb/la,u),w=Math.pow(u,1.6); // linearDistance (follow crane): even speed from the island, eases onto the follow rig
  const ta=[a.target[0]-ra[0]+root[0],a.target[1]-ra[1]+root[1],a.target[2]-ra[2]+root[2]];
  return {position:[root[0]+d[0]*L,root[1]+d[1]*L,root[2]+d[2]*L],target:[ta[0]+(b.target[0]-ta[0])*w,ta[1]+(b.target[1]-ta[1])*w,ta[2]+(b.target[2]-ta[2])*w],
    fovVerticalDeg:a.fovVerticalDeg!+(b.fovVerticalDeg!-a.fovVerticalDeg!)*u,progress};
}
type PaceOpts=Readonly<{sampleMetres:number;rampSeconds:number;cruiseMps:number;depart:Readonly<{turn?:-1|1;shiftX?:number;hop?:number;rayTau?:number;straightM?:number;rayMps?:number;preTurnDeg?:number;minZ?:number;blendMetres:number;aimDeg:number;radial:number;climb:number;seconds:number;handle:number;lead:readonly [number,number,number]}>;chest:number;frontalDeg:number;holdMaxDeg:number;b5?:B5Opts}>;
/** B5 exit (运镜bot 2026-10-16): follow her, then one minimum-jerk rise. All times in seconds after the doorway key. */
type B5Opts=Readonly<{smoothSeconds:number;followIn:number;riseAt:number;side:number;back:number;height:number;look:number;targetHeight:number;fovVerticalDeg:number;matchSeconds:number;turnShare:number;sideDelay:number;sideIn:number;heightShare:number}>;
type Look=Readonly<{position:Vec;target:Vec;fovVerticalDeg?:number}>;
/** Centripetal Catmull-Rom. Passes through every point; u=0 at points[i], u=1 at points[i+1]. */
function centripetal(points:readonly Vec[]):(seg:number,u:number)=>Vec{
  const n=points.length,pt=(i:number)=>points[Math.max(0,Math.min(n-1,i))];
  return (i,u)=>{const P0=pt(i-1),P1=pt(i),P2=pt(i+1),P3=pt(i+2);
    const tj=(a:Vec,b:Vec)=>{const d=Math.sqrt(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));return d<1e-6?1e-4:d;};
    const t0=0,t1=t0+tj(P0,P1),t2=t1+tj(P1,P2),t3=t2+tj(P2,P3),t=t1+(t2-t1)*u;
    const mix=(A:Vec,B:Vec,ta:number,tb:number):Vec=>[(A[0]*(tb-t)+B[0]*(t-ta))/(tb-ta),(A[1]*(tb-t)+B[1]*(t-ta))/(tb-ta),(A[2]*(tb-t)+B[2]*(t-ta))/(tb-ta)];
    const A1=mix(P0,P1,t0,t1),A2=mix(P1,P2,t1,t2),A3=mix(P2,P3,t2,t3);
    return mix(mix(A1,A2,t0,t2),mix(A2,A3,t1,t3),t1,t2);};
}
/** Scalar Fritsch-Carlson pchip. Same end conditions as CameraPose; used to keep outbound arc-speed continuous. */
function pchipScalar(t:readonly number[],y:readonly number[]):(x:number)=>number{
  const n=t.length,h:number[]=[],d:number[]=[],m=new Array<number>(n).fill(0);
  for(let i=0;i<n-1;i++){h.push(t[i+1]-t[i]);d.push((y[i+1]-y[i])/h[i]);}
  if(n<2)return ()=>y[0]??0;
  if(n===2)m[0]=m[1]=d[0];
  else{for(let i=1;i<n-1;i++){if(d[i-1]===0||d[i]===0||Math.sign(d[i-1])!==Math.sign(d[i]))m[i]=0;
    else{const w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i]);}}
    const end=(h0:number,h1:number,d0:number,d1:number)=>{let v=((2*h0+h1)*d0-h0*d1)/(h0+h1);if(Math.sign(v)!==Math.sign(d0))v=0;else if(Math.sign(d0)!==Math.sign(d1)&&Math.abs(v)>Math.abs(3*d0))v=3*d0;return v;};
    m[0]=end(h[0],h[1],d[0],d[1]);m[n-1]=end(h[n-2],h[n-3],d[n-2],d[n-3]);}
  return x=>{if(x<=t[0])return y[0];if(x>=t[n-1])return y[n-1];let i=0;while(i<n-2&&x>t[i+1])i++;
    const hh=t[i+1]-t[i],u=(x-t[i])/hh,u2=u*u,u3=u2*u;
    return (2*u3-3*u2+1)*y[i]+(u3-2*u2+u)*hh*m[i]+(-2*u3+3*u2)*y[i+1]+(u3-u2)*hh*m[i+1];};
}
/**
 * One outbound arc from the doorway pose to cameraIsland. Rotation (behind her → in front), dolly-back and the crane
 * lift share that arc. The orbit around her crosses the lighthouse wall, so the first metres are a doorway portal:
 * out through the opening, up over the open leaf, then a quintic blend onto that orbit once the orbit is outside.
 * One cubic then carries the same arc-length clock to the island. After the doorway a short smoothstep leaves the
 * follow speed and the turn holds one cruise (cruiseMps); the track ease-out is only the landing brake. The orbit
 * is baked against her position on that same progress. Fov eases along that same arc.
 * Wind is 1 at the first frontal sample and stays 1 only while she is still in front. She does not wait.
 */
function paceOutbound(opts:PaceOpts,door:readonly Pose[],cut:Readonly<{qCrossEnd:number;qWalkEnd:number}>,track:Readonly<{easeIn?:number;easeOut?:number}>,totalSeconds:number,island:Pose,actorAt:(q:number)=>{root:Vec;yaw:number}):{cross:Pose[];toIsland:Pose[];settle:Pose[];frontalQ:number;holdQ:number;frontalWalk:number;frontalSeconds:number}{
  const qOf=(k:Pose)=>k.progress??0;
  const {qCrossEnd,qWalkEnd}=cut;
  if(door.length<4||Math.abs(qOf(door[0]))>1e-9||Math.abs(qOf(door[door.length-1])-qCrossEnd)>1e-6)throw Error('outbound pace: door keys');
  if(!(qCrossEnd>0&&qCrossEnd<qWalkEnd&&qWalkEnd<1))throw Error('outbound pace: segment cuts');
  const posAt=centripetal(door.map(k=>k.position)),tgtAt=centripetal(door.map(k=>k.target));
  const fovOfQ=pchipScalar(door.map(qOf),door.map(k=>k.fovVerticalDeg??50));
  const per=24,pts:{pose:Look;s:number;knot:number}[]=[];let sAcc=0;
  const at=(i:number,u:number,knot:number):Look=>{if(knot>=0)return door[knot];
    return {position:posAt(i,u),target:tgtAt(i,u),fovVerticalDeg:fovOfQ(qOf(door[i])+(qOf(door[i+1])-qOf(door[i]))*u)};};
  for(let i=0;i<door.length-1;i++)for(let j=0;j<=per;j++){if(j===0&&i>0)continue;const u=j/per,knot=j===0?i:j===per?i+1:-1,pose=at(i,u,knot);
    if(pts.length){const p=pts[pts.length-1].pose.position,q=pose.position;sAcc+=Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]);}
    pts.push({pose,s:sAcc,knot});}
  const knotS=door.map((_,i)=>{let found=-1;for(let k=0;k<pts.length;k++)if(pts[k].knot===i){found=k;break;}if(found<0)throw Error('outbound pace: knot arc');return pts[found].s;});
  const doorAtS=(s:number):Look=>{if(s<=0)return pts[0].pose;if(s>=sAcc)return pts[pts.length-1].pose;let lo=0,hi=pts.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].s<s)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi],u=(s-a.s)/((b.s-a.s)||1);
    if(a.knot>=0&&u<1e-4)return a.pose;if(b.knot>=0&&u>1-1e-4)return b.pose;
    const pa=a.pose.position,pb=b.pose.position,ta=a.pose.target,tb=b.pose.target;
    return {position:[pa[0]+(pb[0]-pa[0])*u,pa[1]+(pb[1]-pa[1])*u,pa[2]+(pb[2]-pa[2])*u],target:[ta[0]+(tb[0]-ta[0])*u,ta[1]+(tb[1]-ta[1])*u,ta[2]+(tb[2]-ta[2])*u],
      fovVerticalDeg:(a.pose.fovVerticalDeg??50)+((b.pose.fovVerticalDeg??50)-(a.pose.fovVerticalDeg??50))*u};};
  const posed=(src:Look,progress:number):Pose=>({position:[src.position[0],src.position[1],src.position[2]],target:[src.target[0],src.target[1],src.target[2]],
    fovVerticalDeg:Math.min(74.9,Math.max(30.1,src.fovVerticalDeg??50)),progress});
  const step=Math.max(.05,opts.sampleMetres),out:Pose[]=[];
  const push=(src:Look,q:number)=>{if(out.length&&q<=(out[out.length-1].progress??0)+1e-6)return;out.push(posed(src,q));};
  const qK=door.map(qOf),SOfQ=pchipScalar(qK,knotS);
  push(door[0],0);
  for(let i=0;i<door.length-1;i++){let q=qK[i];
    while(q<qK[i+1]){const target=SOfQ(q)+step;if(target>=knotS[i+1]-step*.35)break;
      let a=q,b=qK[i+1];for(let k=0;k<24;k++){const m=(a+b)/2;if(SOfQ(m)<target)a=m;else b=m;}
      const nq=(a+b)/2;if(!(nq>q+1e-5&&nq<qK[i+1]-1e-5))break;q=nq;push(doorAtS(SOfQ(q)),q);}
    push(door[i+1],qK[i+1]);}
  const P0=door[door.length-1].position,P3=island.position,dep=opts.depart;
  if(!dep||!(dep.seconds>1)||!(dep.handle>0.5)||!(dep.blendMetres>=0)||!(dep.aimDeg>0)||dep.lead.length!==3)throw Error('exit arc: depart');
  const sm=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
  const sm5=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(t*(t*6-15)+10);};
  const back=doorAtS(Math.max(0,sAcc-.05)).position,tdx=P0[0]-back[0],tdy=P0[1]-back[1],tdz=P0[2]-back[2],tl=Math.hypot(tdx,tdy,tdz)||1;
  const Tdir:Vec=[tdx/tl,tdy/tl,tdz/tl];
  if(opts.b5)return paceB5(opts.b5);
  /** B5: C(t) = H(t) + cyl(bearing, radius, height)(t) + e(t). H = her root low-passed in time (Gaussian, C-inf);
   *  the offset moves door -> follow (smootherstep over followIn) -> cameraIsland (smootherstep from riseAt to the end),
   *  so position, velocity and acceleration are continuous everywhere and zero-jerk-step at both blends.
   *  e(t) carries the doorway key's velocity and acceleration into the follow and fades out over matchSeconds. */
  function paceB5(b:B5Opts){
    const T=totalSeconds,tC=invertProgress(qCrossEnd,track)*T,tE=T,span=tE-tC;
    if(!(b.followIn>0.3&&b.riseAt>=b.followIn&&span-b.riseAt>=2&&b.smoothSeconds>0&&b.matchSeconds>0&&b.turnShare>0.3&&b.turnShare<=1&&b.sideDelay>=0&&b.sideIn>0.3&&b.heightShare>0.3&&b.heightShare<=1&&(span-b.riseAt)*Math.min(b.heightShare,b.turnShare)>=2))throw Error('B5: timing (rise must last >= 2 s)');
    const qOfT=(t:number)=>remapProgress(Math.max(0,Math.min(1,t/T)),track);
    const rootT=(t:number):Vec=>actorAt(qOfT(t)).root;
    const sg=b.smoothSeconds,nK=12;
    const H=(t:number):Vec=>{let x=0,y=0,z=0,w=0;for(let k=-nK;k<=nK;k++){const u=k/nK*2.5,wt=Math.exp(-.5*u*u),r=rootT(Math.max(0,Math.min(tE,t+u*sg)));x+=r[0]*wt;y+=r[1]*wt;z+=r[2]*wt;w+=wt;}return [x/w,y/w,z/w];};
    const s5=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(t*(t*6-15)+10);};
    const doorT0=door[door.length-1].target,f0=door[door.length-1].fovVerticalDeg??50,f1=island.fovVerticalDeg??42;
    const H0=H(tC),HE=H(tE);
    // follow frame: her mean heading over the follow window (fixed, so the offset itself never yaws)
    const Ha=H(tC+b.riseAt),hx=Ha[0]-H0[0],hz=Ha[2]-H0[2],hl=Math.hypot(hx,hz)||1,fx=hx/hl,fz=hz/hl;
    const rx=-fz,rz=fx; // her right (+x = left when she faces +z)
    const cyl=(p:Vec,h:Vec)=>{const dx=p[0]-h[0],dz=p[2]-h[2];return {b:Math.atan2(dx,dz),r:Math.hypot(dx,dz),y:p[1]};};
    const c0=cyl(P0,H0),cf=cyl([H0[0]+rx*b.side-fx*b.back,b.height,H0[2]+rz*b.side-fz*b.back],H0),c3=cyl(island.position,HE);
    // bearings unwrapped so the sweep goes through her right side (never across her back to the left)
    const unwrapNear=(a:number,ref:number)=>{while(a-ref>Math.PI)a-=2*Math.PI;while(a-ref<-Math.PI)a+=2*Math.PI;return a;};
    const bf=unwrapNear(cf.b,c0.b);let b3=unwrapNear(c3.b,bf);const rightB=Math.atan2(rx,rz);
    const passR=unwrapNear(rightB,bf);if(!(Math.min(bf,b3)<=passR&&passR<=Math.max(bf,b3)))b3+=b3<bf?2*Math.PI:-2*Math.PI;
    const raw=(tau:number):{p:Vec;tg:Vec;fov:number}=>{const t=tC+tau,h=H(t),w1=s5(tau/b.followIn),w2=s5((tau-b.riseAt)/(span-b.riseAt)),wb=s5((tau-b.riseAt)/((span-b.riseAt)*b.turnShare));
      const wS=s5((tau-b.sideDelay)/b.sideIn),be=c0.b+(bf-c0.b)*wS+(b3-bf)*wb,ra=c0.r+(cf.r-c0.r)*wS+(c3.r-cf.r)*w2,wy=s5((tau-b.riseAt)/((span-b.riseAt)*b.heightShare)),yy=c0.y+(cf.y-c0.y)*w1+(c3.y-cf.y)*wy;
      const p:Vec=[h[0]+Math.sin(be)*ra,yy,h[2]+Math.cos(be)*ra];
      const lk:Vec=[h[0]+fx*b.look,h[1]+b.targetHeight,h[2]+fz*b.look];
      const m:Vec=[doorT0[0]+(lk[0]-doorT0[0])*w1,doorT0[1]+(lk[1]-doorT0[1])*w1,doorT0[2]+(lk[2]-doorT0[2])*w1];
      const it=island.target,tg:Vec=[m[0]+(it[0]-m[0])*w2,m[1]+(it[1]-m[1])*w2,m[2]+(it[2]-m[2])*w2];
      const fv=f0+(b.fovVerticalDeg-f0)*w1+(f1-b.fovVerticalDeg)*w2;return {p,tg,fov:fv};};
    // doorway key motion (the door spline in time), backward differences over 1/30 s
    const dH=1/30,doorAtT=(t:number):Look=>doorAtS(SOfQ(Math.min(qCrossEnd,qOfT(t))));
    const d0=doorAtT(tC),d1=doorAtT(tC-dH),d2=doorAtT(tC-2*dH),r0=raw(0),r1=raw(dH),r2=raw(2*dH);
    const V=(a:Vec,b2:Vec)=>[(a[0]-b2[0])/dH,(a[1]-b2[1])/dH,(a[2]-b2[2])/dH];
    const Ac=(a:Vec,m:Vec,c:Vec)=>[(a[0]-2*m[0]+c[0])/(dH*dH),(a[1]-2*m[1]+c[1])/(dH*dH),(a[2]-2*m[2]+c[2])/(dH*dH)];
    const corr=(dp:Vec[],rp:Vec[])=>{const vD=V(dp[0],dp[1]),aD=Ac(dp[0],dp[1],dp[2]),vR=V(rp[1],rp[0]),aR=Ac(rp[2],rp[1],rp[0]);
      const e0=[dp[0][0]-rp[0][0],dp[0][1]-rp[0][1],dp[0][2]-rp[0][2]];return {e0,dv:[vD[0]-vR[0],vD[1]-vR[1],vD[2]-vR[2]],da:[aD[0]-aR[0],aD[1]-aR[1],aD[2]-aR[2]]};};
    const cP=corr([d0.position,d1.position,d2.position],[r0.p,r1.p,r2.p]),cT=corr([d0.target,d1.target,d2.target],[r0.tg,r1.tg,r2.tg]);
    const fade=(tau:number)=>{const g=1-s5(tau/b.matchSeconds);return g;};
    const add=(v:Vec,c:{e0:number[];dv:number[];da:number[]},tau:number):Vec=>{const g=fade(tau);return [0,1,2].map(k=>v[k]+(c.e0[k]+c.dv[k]*tau+.5*c.da[k]*tau*tau)*g) as unknown as Vec;};
    const atTau=(tau:number):Look=>{if(tau>=span-1e-9)return {position:[...island.position] as unknown as Vec,target:[...island.target] as unknown as Vec,fovVerticalDeg:f1};
      const r=raw(tau);return {position:add(r.p,cP,tau),target:add(r.tg,cT,tau),fovVerticalDeg:r.fov};};
    const tOfQ=(q:number)=>invertProgress(q,track)*T;
    const poseQ=(q:number):Look=>q<=qCrossEnd?doorAtS(SOfQ(q)):atTau(tOfQ(q)-tC);
    const nS=Math.ceil(span*60);for(let j=1;j<=nS;j++){const t=tC+span*j/nS,q=j===nS?1:qOfT(t);push(poseQ(q),q);}
    const angAt=(q:number)=>{const pose=poseQ(q),actor=actorAt(q),dx=pose.position[0]-actor.root[0],dz=pose.position[2]-actor.root[2],dist=Math.hypot(dx,dz)||1;
      return {ang:Math.acos(Math.max(-1,Math.min(1,(Math.sin(actor.yaw)*dx+Math.cos(actor.yaw)*dz)/dist)))*180/Math.PI,dist,t:tOfQ(q)};};
    let qFr=-1,qHold=-1,tFr=0,minD=99;
    for(let i=0;i<=320;i++){const q=qCrossEnd+(1-qCrossEnd)*i/320,m=angAt(q);if(m.dist<minD)minD=m.dist;
      if(qFr<0&&m.ang<=opts.frontalDeg){qFr=q;tFr=m.t;qHold=q;}else if(qFr>=0&&m.ang<=opts.holdMaxDeg&&m.t<=tFr+1.6)qHold=q;}
    if(qFr<0){qFr=1-1e-4;qHold=1-5e-5;tFr=tOfQ(qFr);}
    if(!(minD>=1.7))throw Error('B5: lens crowds her '+minD.toFixed(2));
    const bound=poseQ(qWalkEnd);
    const locC=(q:number)=>q/qCrossEnd,locI=(q:number)=>(q-qCrossEnd)/(qWalkEnd-qCrossEnd),locS=(q:number)=>(q-qWalkEnd)/(1-qWalkEnd);
    const cross:Pose[]=out.filter(k=>(k.progress??0)<qCrossEnd-1e-6).map(k=>({...k,progress:locC(k.progress!)}));cross.push(posed(poseQ(qCrossEnd),1));
    const toIsland:Pose[]=[posed(poseQ(qCrossEnd),0)];
    for(const k of out){const q=k.progress!;if(q>qCrossEnd+1e-6&&q<qWalkEnd-2e-4)toIsland.push({...k,progress:locI(q)});}
    toIsland.push(posed(bound,1));
    const settle:Pose[]=[posed(bound,0)];
    for(const k of out){const q=k.progress!;if(q>qWalkEnd+2e-4&&q<1-1e-6)settle.push({...k,progress:locS(q)});}
    settle.push({position:[island.position[0],island.position[1],island.position[2]],target:[island.target[0],island.target[1],island.target[2]],fovVerticalDeg:island.fovVerticalDeg,progress:1});
    const walkStart=qCrossEnd*T,walkStop=qWalkEnd*T,frontalWalk=tFr<=walkStart?0:tFr>=walkStop?1:(tFr-walkStart)/(walkStop-walkStart);
    return {cross,toIsland,settle,frontalQ:qFr,holdQ:qHold,frontalWalk,frontalSeconds:tFr};
  }
  const D=1-qCrossEnd,C0=Math.max(1e-3,(SOfQ(qCrossEnd)-SOfQ(qCrossEnd-1e-4))/1e-4);
  // Cruise is an arc-length clock, not the doorway follow. A short smoothstep leaves that follow speed, then
  // ds/dq stays at Cc so the turn and the lift hold one speed. Ease-out (on the track) is the only later brake.
  // Her root at arc length s is the root at the progress that clock will actually play.
  // The game follows walk distance, not this span's time. The island stop is slower than the 0.7 m/s
  // walkDuration, so the middle of that walk advances distance ~1.176× faster than time. cruiseMps is the
  // speed on that distance clock. The constant-time playback is shallower by the same factor.
  const distanceRate=1.176;
  const slope=(remapProgress(.5,track)-remapProgress(.4,track))/.1;
  const cruise=opts.cruiseMps;
  if(!(typeof cruise==='number'&&cruise>=6&&cruise<=8&&opts.rampSeconds>0.4&&opts.rampSeconds<1.05))throw Error('outbound pace: cruise target');
  let qr=opts.rampSeconds*slope/totalSeconds;qr=Math.min(Math.max(qr,.012),D*.28);
  const aimBear=dep.aimDeg*Math.PI/180,doorActor=actorAt(qCrossEnd);
  const r0=Math.max(1.95,Math.hypot(P0[0]-doorActor.root[0],P0[2]-doorActor.root[2]));
  const bear0=Math.atan2(P0[0]-doorActor.root[0],P0[2]-doorActor.root[2]);
  const turnDir=dep.turn??-1;let bear1=-aimBear;if(turnDir<0){while(bear1>bear0-.05)bear1-=Math.PI*2;}else{while(bear1<bear0+.05)bear1+=Math.PI*2;}
  let arcPts:Vec[]=[],arcS:number[]=[0],arcL=0,Cc=cruise*totalSeconds/slope;
  arcL=Math.max(1,Cc*D-(Cc-C0)*qr*.5);
  const sAt=(q:number,L:number,C:number)=>{const x=q-qCrossEnd;if(x<=0)return 0;if(q>=1)return L;
    if(x<qr){const u=x/qr;return C0*x+(C-C0)*qr*(u*u*u-.5*u*u*u*u);}return C0*qr+(C-C0)*qr*.5+C*(x-qr);};
  const qAtS=(s:number,L:number,C:number)=>{if(s<=0)return qCrossEnd;if(s>=L-1e-9)return 1;let lo=qCrossEnd,hi=1;for(let k=0;k<40;k++){const m=(lo+hi)/2;if(sAt(m,L,C)<s)lo=m;else hi=m;}return (lo+hi)/2;};
  for(let pass=0;pass<4;pass++){
    const qAt=(s:number)=>qAtS(s,arcL,Cc);
    const slot=(tau:number,sNow:number):Vec=>{const h=actorAt(qAt(sNow)).root;
      const rv0=dep.rayMps??1.35,tS=(dep.straightM??0)/rv0,tt=Math.max(0,tau-tS),t=Math.max(0,Math.min(1,tt/(dep.seconds-tS))),uB=1-(1-t)*(1-t),bS=bear0+Math.sign(bear1-bear0)*Math.min(Math.abs(bear1-bear0),(dep.preTurnDeg??0)*Math.PI/180),bear=bS+(bear1-bS)*uB,rad=r0+dep.radial*tau;
      const uH=t<=.62?0:Math.min(1,(t-.62)/.38),integ=uH-.7*(uH*uH*uH-.5*uH*uH*uH*uH);
      const yLin=Math.min(P3[1]-1.6,P0[1]+dep.climb*dep.seconds*(.62*Math.min(1,t/.62)+.38*integ));
      // Ease the climb off the door tangent. A full-rate rise during the fillet pitches the look
      // up and then dumps that rate once the orbit's horizontal swing starts.
      const yDoor=P0[1]+Tdir[1]*1.35*tau,up=sm5(Math.min(1,tau/1.8));
      const y=yDoor+(yLin-yDoor)*up;
      // The raw orbit still crosses the jamb. Shift it seaward, up, and out, and blend onto that
      // shifted orbit with the fillet that leaves along the door tangent.
      // Horizontal shift holds through the doorway. The extra lift fades on its own so the climb
      // passes under the gull orbit instead of rising into the swept wings.
      const hFade=1-sm5(Math.max(0,Math.min(1,(tau-1.6)/2)));
      const vFade=1-sm5(Math.max(0,Math.min(1,(tau-.4)/2.6)));
      const orbit:Vec=[h[0]+Math.sin(bear)*rad+(dep.shiftX??-1.05)*hFade,y+1.05*vFade,Math.max(dep.minZ??-1e9,h[2]+Math.cos(bear)*rad+.5*hFade)];
      // The blend is still mostly on the door ray when that ray meets the open leaf, so the ray
      // itself rises over the leaf. The rise is a smootherstep (zero slope at the doorway).
      const hop=(dep.hop??1.32)*sm5(Math.min(1,tau/1.05));
      const rv=dep.rayMps??1.35,t0=(dep.straightM??0)/rv,k=sm5(Math.max(0,Math.min(1,(tau-t0)/(dep.rayTau??1.6)))),ray:Vec=[P0[0]+Tdir[0]*tau*rv,P0[1]+Tdir[1]*tau*rv+hop,P0[2]+Tdir[2]*tau*rv];
      return [ray[0]*(1-k)+orbit[0]*k,ray[1]*(1-k)+orbit[1]*k,ray[2]*(1-k)+orbit[2]*k];};
    const pts:Vec[]=[slot(0,0)];let pos:Vec=[pts[0][0],pts[0][1],pts[0][2]],tau=0,tang:Vec=[Tdir[0],Tdir[1],Tdir[2]],sNow=0;
    const stepS=.02;
    while(tau<dep.seconds-.001){
      let lo=0,hi=.04;
      for(let k=0;k<10;k++){const s=slot(Math.min(dep.seconds,tau+hi),sNow+stepS);if(Math.hypot(s[0]-pos[0],s[1]-pos[1],s[2]-pos[2])>=stepS*.98)break;hi*=1.7;if(tau+hi>=dep.seconds)break;}
      for(let k=0;k<16;k++){const mid=(lo+hi)/2,s=slot(Math.min(dep.seconds,tau+mid),sNow+stepS),d=Math.hypot(s[0]-pos[0],s[1]-pos[1],s[2]-pos[2]);if(d<stepS)lo=mid;else hi=mid;}
      const dTau=(lo+hi)/2;if(!(dTau>1e-5))break;
      tau=Math.min(dep.seconds,tau+dTau);const nxt=slot(tau,sNow+stepS);
      const mv:Vec=[nxt[0]-pos[0],nxt[1]-pos[1],nxt[2]-pos[2]],ml=Math.hypot(mv[0],mv[1],mv[2])||1;tang=[mv[0]/ml,mv[1]/ml,mv[2]/ml];
      sNow+=ml;pos=[nxt[0],nxt[1],nxt[2]];pts.push([pos[0],pos[1],pos[2]]);
      if(pts.length>8000)throw Error('outbound pace: fillet');}
    const Pend=pts[pts.length-1];
    const P1c:Vec=[Pend[0]+tang[0]*dep.handle,Pend[1]+tang[1]*dep.handle,Pend[2]+tang[2]*dep.handle];
    const P2c:Vec=[Pend[0]+(P3[0]-Pend[0])*dep.lead[0],Pend[1]+(P3[1]-Pend[1])*dep.lead[1],Pend[2]+(P3[2]-Pend[2])*dep.lead[2]];
    // Landing controls stay between the fillet end and the island, and in order, so this cubic cannot
    // dip or rise past cameraIsland. A concave suffix there fails the island pull at world load.
    const y0=Pend[1],y3=P3[1];
    if(y3>=y0){P1c[1]=Math.max(y0,Math.min(y3,P1c[1]));P2c[1]=Math.max(P1c[1],Math.min(y3,P2c[1]));}
    else{P1c[1]=Math.min(y0,Math.max(y3,P1c[1]));P2c[1]=Math.min(P1c[1],Math.max(y3,P2c[1]));}
    const bez=(g:number):Vec=>{const u=1-g,b0=u*u*u,b1=3*u*u*g,b2=3*u*g*g,b3=g*g*g;
      return [b0*Pend[0]+b1*P1c[0]+b2*P2c[0]+b3*P3[0],b0*Pend[1]+b1*P1c[1]+b2*P2c[1]+b3*P3[1],b0*Pend[2]+b1*P1c[2]+b2*P2c[2]+b3*P3[2]];};
    for(let i=1;i<=240;i++)pts.push(bez(i/240));
    const ss:number[]=[0];let L=0;for(let i=1;i<pts.length;i++){const p=pts[i-1],q=pts[i];L+=Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]);ss.push(L);}
    arcPts=pts;arcS=ss;arcL=L;Cc=(L-C0*qr*.5)/Math.max(1e-4,D-.5*qr);
  }
  const played=Cc*slope/totalSeconds,seen=played*distanceRate;
  if(!(C0>0&&Cc>C0&&arcL>0&&Number.isFinite(played)))throw Error('outbound pace: cruise speed');
  if(Math.abs(seen-cruise)>0.45)throw Error('outbound pace: cruise '+seen.toFixed(2)+' m/s on the walk clock, want '+cruise+' (time clock '+played.toFixed(2)+', arc '+arcL.toFixed(1)+' m, span '+totalSeconds.toFixed(2)+' s)');
  const posFromS=(s:number):Vec=>{if(s<=0)return arcPts[0];if(s>=arcL)return arcPts[arcPts.length-1];
    let lo=0,hi=arcS.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(arcS[m]<s)lo=m;else hi=m;}
    const u=(s-arcS[lo])/((arcS[hi]-arcS[lo])||1),pa=arcPts[lo],pb=arcPts[hi];
    return [pa[0]+(pb[0]-pa[0])*u,pa[1]+(pb[1]-pa[1])*u,pa[2]+(pb[2]-pa[2])*u];};
  // Short ramp off the doorway derivative, then one ds/dq. Ease-out is what slows the landing, not this clock.
  const sFromQ=(q:number)=>sAt(q,arcL,Cc);
  const doorT=door[door.length-1].target,f0=door[door.length-1].fovVerticalDeg??50,f1=island.fovVerticalDeg??42;
  const lookAt=(s:number,q:number):Look=>{
    const g=Math.max(0,Math.min(1,s/(arcL||1)));
    if(g>=1-1e-9)return {position:[P3[0],P3[1],P3[2]],target:[island.target[0],island.target[1],island.target[2]],fovVerticalDeg:f1};
    const root=actorAt(q).root,position=posFromS(s),chest:Vec=[root[0],root[1]+opts.chest,root[2]],toC=sm(Math.min(1,g/.1));
    // Hand the door target off across the first tenth of the arc. That handoff has barely started while the
    // fillet swings, so a short smootherstep nudge yaws a few degrees with it and keeps her off the portrait
    // edge. It is not a snap onto her chest.
    const vx=position[0]-root[0],vz=position[2]-root[2],vl=Math.hypot(vx,vz)||1,near=1-sm(Math.min(1,Math.max(0,(g-.015)/.06)));
    const aim:Vec=[chest[0]+vx/vl*.35*near+vz/vl*.4*near,chest[1]+.06*near,chest[2]+vz/vl*.35*near-vx/vl*.4*near];
    const pull=sm5(Math.min(1,s/.96)),nudge=.045*pull;
    const mid:Vec=[doorT[0]+(aim[0]-doorT[0])*toC+vz/vl*nudge,doorT[1]+(aim[1]-doorT[1])*toC,doorT[2]+(aim[2]-doorT[2])*toC-vx/vl*nudge];
    const toI=sm((g-.78)/.22),it=island.target;
    return {position,target:[mid[0]+(it[0]-mid[0])*toI,mid[1]+(it[1]-mid[1])*toI,mid[2]+(it[2]-mid[2])*toI],fovVerticalDeg:f0+(f1-f0)*Math.pow(g,1.15)};};
  const poseQ=(q:number):Look=>{if(q<=qCrossEnd)return doorAtS(SOfQ(q));if(q>=1-1e-9)return lookAt(arcL,1);return lookAt(sFromQ(q),q);};
  const qFromS=(s:number)=>{if(s<=0)return qCrossEnd;if(s>=arcL-1e-9)return 1;let lo=qCrossEnd,hi=1;for(let k=0;k<48;k++){const m=(lo+hi)/2;if(sFromQ(m)<s)lo=m;else hi=m;}return (lo+hi)/2;};
  const nC=Math.max(1,Math.ceil(arcL/step));
  for(let j=1;j<=nC;j++){const s=arcL*j/nC,q=j===nC?1:qFromS(s);push(poseQ(q),q);}
  const angAt=(q:number)=>{const pose=poseQ(q),actor=actorAt(q),dx=pose.position[0]-actor.root[0],dz=pose.position[2]-actor.root[2],dist=Math.hypot(dx,dz)||1;
    return {ang:Math.acos(Math.max(-1,Math.min(1,(Math.sin(actor.yaw)*dx+Math.cos(actor.yaw)*dz)/dist)))*180/Math.PI,y:pose.position[1],dist,t:invertProgress(q,track)*totalSeconds};};
  let qFr=-1,qHold=-1,tFr=0,y150=0,d150=0,y30=0,d30=0,saw150=false,saw30=false,minD=99;
  const nA=160;
  for(let i=0;i<=nA;i++){const q=qCrossEnd+(1-qCrossEnd)*i/nA,m=angAt(q);
    if(m.dist<minD)minD=m.dist;
    if(!saw150&&m.ang<=150){saw150=true;y150=m.y;d150=m.dist;}
    if(saw150&&!saw30&&m.ang<=30){saw30=true;y30=m.y;d30=m.dist;}
    if(qFr<0&&m.ang<=opts.frontalDeg){qFr=q;tFr=m.t;qHold=q;}
    else if(qFr>=0&&m.ang<=opts.holdMaxDeg&&m.t<=tFr+1.6)qHold=q;}
  if(!(qFr>qCrossEnd&&qHold>qFr+1e-4&&tFr>0))throw Error('outbound pace: frontal mark');
  if(!(saw150&&saw30&&y30-y150>=3&&d30-d150>=4))throw Error('outbound pace: rotate, dolly and lift must overlap');
  if(!(minD>=1.7))throw Error('outbound pace: lens crowds her');
  const bound=poseQ(qWalkEnd);
  const locC=(q:number)=>q/qCrossEnd,locI=(q:number)=>(q-qCrossEnd)/(qWalkEnd-qCrossEnd),locS=(q:number)=>(q-qWalkEnd)/(1-qWalkEnd);
  const cross:Pose[]=out.filter(k=>(k.progress??0)<qCrossEnd-1e-6).map(k=>({...k,progress:locC(k.progress!)}));
  cross.push(posed(poseQ(qCrossEnd),1));
  const toIsland:Pose[]=[posed(poseQ(qCrossEnd),0)];
  for(let i=0;i<out.length;i++){const q=out[i].progress!;if(q>qCrossEnd+1e-6&&q<qWalkEnd-2e-4)toIsland.push({...out[i],progress:locI(q)});}
  toIsland.push(posed(bound,1));
  const settle:Pose[]=[posed(bound,0)];
  for(let i=0;i<out.length;i++){const q=out[i].progress!;if(q>qWalkEnd+2e-4&&q<1-1e-6)settle.push({...out[i],progress:locS(q)});}
  settle.push({position:[island.position[0],island.position[1],island.position[2]],target:[island.target[0],island.target[1],island.target[2]],fovVerticalDeg:island.fovVerticalDeg,progress:1});
  const mono=(name:string,keys:Pose[])=>{for(let i=1;i<keys.length;i++)if(!((keys[i].progress??0)>(keys[i-1].progress??0)))throw Error('outbound pace: '+name+' keys not increasing');};
  mono('cross',cross);mono('toIsland',toIsland);mono('settle',settle);
  const walkStart=qCrossEnd*totalSeconds,walkStop=qWalkEnd*totalSeconds;
  const frontalWalk=tFr<=walkStart?0:tFr>=walkStop?1:(tFr-walkStart)/(walkStop-walkStart);
  return {cross,toIsland,settle,frontalQ:qFr,holdQ:qHold,frontalWalk,frontalSeconds:tFr};
}
/** Mac r4 pure: return FOLLOW rig (RegionCameraData returnFollow). `route` = her whole return walk (toThreshold + inCrossing +
 *  toSeat, joined); s = her arclength on it. The lens trails her own path (smoothed over `smoothing` m; before the start it
 *  extends straight back along her first heading) `distance` m behind her; target = smoothed path at s + look, + targetHeight.
 *  out/in parameters blend (smoothstep) over s in [sDoor+blend[0], sDoor+blend[1]]. */
export type FollowRig=Readonly<{distance:number;height:number;targetHeight:number;look:number;fovVerticalDeg:number}>;
export function createFollowRig(route:readonly Vec[],sDoor:number,F:Readonly<{out:FollowRig;in:FollowRig;blend:readonly [number,number];smoothing:number;settle?:number}>){
  const cum:number[]=[0];for(let i=1;i<route.length;i++)cum.push(cum[i-1]+Math.hypot(route[i][0]-route[i-1][0],route[i][2]-route[i-1][2]));const L=cum[cum.length-1];
  let h0=1;while(h0<route.length-1&&cum[h0]<.05)h0++;const d0=[(route[h0][0]-route[0][0])/(cum[h0]||1),(route[h0][2]-route[0][2])/(cum[h0]||1)];
  let h1=route.length-2;while(h1>0&&L-cum[h1]<.05)h1--;const n=route.length-1,d1=[(route[n][0]-route[h1][0])/((L-cum[h1])||1),(route[n][2]-route[h1][2])/((L-cum[h1])||1)];
  const raw=(s:number):[number,number]=>{if(s<=0)return [route[0][0]+d0[0]*s,route[0][2]+d0[1]*s];if(s>=L)return [route[n][0]+d1[0]*(s-L),route[n][2]+d1[1]*(s-L)];
    let i=1;while(i<n&&cum[i]<s)i++;const u=(s-cum[i-1])/((cum[i]-cum[i-1])||1);return [route[i-1][0]+(route[i][0]-route[i-1][0])*u,route[i-1][2]+(route[i][2]-route[i-1][2])*u];};
  // triangular-weighted average over +-smoothing/2 (C1 along s; exact on straight runs)
  const P=(s:number):[number,number]=>{const w=F.smoothing/2;if(!(w>0))return raw(s);let x=0,z=0,ws=0;for(let k=-8;k<=8;k++){const q=1-Math.abs(k)/9,p=raw(s+w*k/8);x+=p[0]*q;z+=p[1]*q;ws+=q;}return [x/ws,z/ws];};
  const sm=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
  const rig=(s:number):FollowRig=>{const b=sm((s-(sDoor+F.blend[0]))/((F.blend[1]-F.blend[0])||1)),m=(k:keyof FollowRig)=>F.out[k]+(F.in[k]-F.out[k])*b;
    return {distance:m('distance'),height:m('height'),targetHeight:m('targetHeight'),look:m('look'),fovVerticalDeg:m('fovVerticalDeg')};};
  // soft stop: the trailing point u = s - distance eases to rest over the last `settle` m (slope 1 -> 0, C1), ending settle/2 short
  const k=Math.max(0,F.settle??0),uEnd=L-rig(L).distance,trail=(s:number)=>{const u=s-rig(s).distance,x=uEnd-u;return k>0&&x<k?uEnd-k/2-Math.max(0,x)*Math.max(0,x)/(2*k):u;};
  const lens=(s:number):Vec=>{const r=rig(s),p=P(trail(s));return [p[0],r.height,p[1]];};
  const pose=(s:number,progress:number):Pose=>{const r=rig(s),p=P(trail(s)),t=P(s+r.look);
    return {position:[p[0],r.height,p[1]],target:[t[0],r.targetHeight,t[1]],fovVerticalDeg:r.fovVerticalDeg,progress};};
  return {length:L,cum,pose,lens,rig,point:P};
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
  // B5 (运镜bot 2026-10-16): she walks ~2.3 m straight out of the door first (x stays near the door, clear of the lighthouse
  // wall and palm_tall_01 on her right), then one gentle curve onto exit_path_17 (unchanged: island stop / return untouched).
  const EXIT_B4:Vec[]=[[-0.32,0,0.69],[-0.38,0,1.45],[-0.5,0,2.2],[-0.78,0,2.95],[-1.22,0,3.65],[-1.68,0,4.3],[-2.0,0,4.85]];
  const outCrossing:Vec[]=[a('door_stand_point'),a('exit_point'),EXIT_B4[0],EXIT_B4[1]];
  const toIsland:Vec[]=[EXIT_B4[1],...EXIT_B4.slice(2),a('exit_path_17')];
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
  const c0seat=()=>({standingControllerRoot:reference.standingRoot,seatedControllerRoot:reference.seatedRoot});
  const t2=TRANSITION_CAMERA?.enabled&&REGION_CAMERA.homePoseSource==='sitting-room'?(()=>{
    const K=TRANSITION_CAMERA.keys;
    const key=(name:string,route:readonly Vec[],progress:number):Pose=>{const k=K[name];if(!k)throw Error('Missing transition camera key '+name);
      const p=pointOnPath(route,progress);return {position:[...k.position] as unknown as Vec,target:[p[0],p[1]+k.targetHeight,p[2]],fovVerticalDeg:k.fovVerticalDeg,progress};};
    const at=(name:string,progress:number,root:Vec):Pose=>{const k=K[name];return {position:[...k.position] as unknown as Vec,target:[root[0],root[1]+k.targetHeight,root[2]],fovVerticalDeg:k.fovVerticalDeg,progress};};
    const dp=cameraToDoor.map(k=>k.progress!);
    const D=['D0','D1','D2','D3','D4'].map((n,i)=>key(n,toDoor,dp[i]));
    // T2+ return rail + outbound exit arc (data: TRANSITION_CAMERA.railIn/crane/craneDown). Off while the return rail is empty.
    const T=TRANSITION_CAMERA,railOn=T.railIn.length>0&&!!T.crossOutEnd;
    // T2+: crossing-out ends on a lens just behind her in the doorway (generated, not the old in-room 'O' key).
    const inside=D[4],outside=railOn?railPose(outCrossing,{...T.crossOutEnd,progress:1}):key('O',outCrossing,1),insideReturn=key('IR',inCrossing,1),outsideReturn=key('OR',toThreshold,1);
    const walkS=walkDurationFn; // shared walk-duration contract (see walkDuration)
    const crossOutPoses:Pose[]=[{...inside,progress:0},key('X1',outCrossing,.35),key('X2',outCrossing,.55),{...outside,progress:1}];
      const outboundPaced=railOn?(()=>{const pace=T.crane.pace;if(!pace||!pace.depart)throw Error('outbound exit arc missing');
      const a=walkS(outCrossing),b=walkS(toIsland),settleS=T.crane.settleSeconds,tot=a+b+settleS,qCross=a/tot,qWalk=(a+b)/tot;
      const door=crossOutPoses.map(k=>({...k,progress:(k.progress??0)*qCross}));
      const endYaw=(()=>{const u=pointOnPath(toIsland,.998),v=pointOnPath(toIsland,1);return Math.atan2(v[0]-u[0],v[2]-u[2]);})();
      const yawOf=(route:readonly Vec[],p:number)=>{const u=pointOnPath(route,Math.max(0,p-.002)),v=pointOnPath(route,Math.min(1,p+.002));return Math.atan2(v[0]-u[0],v[2]-u[2]);};
      const actorAt=(q:number)=>{const t=invertProgress(q,T.tracks.outbound as any)*tot;
        if(t<=a){const p=a>0?t/a:0;return {root:pointOnPath(outCrossing,p),yaw:yawOf(outCrossing,p)};}
        if(t<=a+b){const p=(t-a)/b;return {root:pointOnPath(toIsland,p),yaw:yawOf(toIsland,p)};}
        const u=Math.min(1,(t-a-b)/1.5),yaw=endYaw+Math.atan2(Math.sin(-endYaw),Math.cos(-endYaw))*u;
        return {root:toIsland[toIsland.length-1],yaw};};
      return paceOutbound(pace,door,{qCrossEnd:qCross,qWalkEnd:qWalk},T.tracks.outbound,tot,cameraIsland,actorAt);})():null;
    const inboundRail=():Pose[]=>{const ce=T.craneDown.endProgress,rail=T.railIn.map(k=>railPose(toThreshold,k)),end=rail[0];
      if(!end||Math.abs(end.progress!-ce)>1e-9)throw Error('railIn must start on craneDown.endProgress');
      const w=walkS(toThreshold),turn=1.5+T.craneDown.leadSeconds,total=turn+ce*w,ra=pointOnPath(toThreshold,ce),rb=toThreshold[0],keys:Pose[]=[];
      const via=T.craneDown.positions;if(via&&via.length!==T.craneDown.steps-1)throw Error('craneDown.positions needs steps-1 entries');
      for(let i=1;i<T.craneDown.steps;i++){const q=ce*i/T.craneDown.steps,u=1-(turn+q*w)/total,k=cranePose(end,ra,cameraIsland,rb,pointOnPath(toThreshold,q),u,q);keys.push(via?{...k,position:[via[i-1][0],via[i-1][1],via[i-1][2]]}:k);}
      // Door approach: authored absolute keys (doorstep, doorway; lens passes the narrow gap between jamb and open leaf
      // below the doorway palm) BEFORE she reaches the door, so she is framed from inside as she walks in.
      const door=T.railInDoor.map(d=>key(d.key,toThreshold,d.progress));
      if(door.length&&rail.some(r=>r.progress!>=door[0].progress!))throw Error('railIn keys must precede railInDoor');
      return [{...cameraIsland,progress:0},...keys,...rail,...door,{...outsideReturn,progress:1}];};
    // Mac r4 return FOLLOW (TRANSITION_CAMERA.returnFollow): crane-down onto a rig trailing her path, through the door, to
    // the seat; the sit move lands on cameraHome. Generates cameraToThreshold + cameraEntry (no stop at the entrance).
    const RF=(T as any).returnFollow,followOn=railOn&&!!RF?.enabled&&!!T.entry?.enabled;
    const follow=followOn?(()=>{const route:Vec[]=[...toThreshold,...inCrossing.slice(1),...toSeat.slice(1)],len=(p:readonly Vec[])=>pathDuration(p,1);
      const sThr=len(toThreshold),sCross=sThr+len(inCrossing),zDoor=facts.door.hinge[2];
      let sDoor=-1;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];if(a[2]>zDoor&&b[2]<=zDoor){const u=(a[2]-zDoor)/(a[2]-b[2]);sDoor=pathDuration(route.slice(0,i),1)+u*Math.hypot(b[0]-a[0],b[2]-a[2]);break;}}
      if(sDoor<0)throw Error('returnFollow: her return path never crosses the door plane');
      const R=createFollowRig(route,sDoor,RF),L=R.length,step=Math.max(.05,RF.keySpacing);
      // lens-z marks: first s where the trailing lens is at/inside z (door plane + offset)
      const lensAt=(z:number)=>{for(let x=0;x<=L+1e-9;x+=.01)if(R.lens(x)[2]<=z)return x;throw Error('returnFollow: lens never reaches z '+z);};
      const mark=(x:number)=>x<sThr?{seg:'threshold' as const,progress:x/sThr}:x<sCross?{seg:'cross' as const,progress:(x-sThr)/(sCross-sThr)}:{seg:'seat' as const,progress:(x-sCross)/(L-sCross)};
      const keysOn=(s0:number,s1:number,p0:number,includeStart:boolean)=>{const out:Pose[]=[],n=Math.max(1,Math.ceil((s1-s0)/step));
        for(let i=includeStart?0:1;i<=n;i++){const x=s0+(s1-s0)*i/n;out.push(R.pose(x,p0===0&&s1>s0?(x-s0)/(s1-s0):(x-s0)/(s1-s0)));}return out;};
      // crane-down: cameraIsland (her island root) -> rig pose at toThreshold progress craneEnd (spherical about her root)
      const qc=RF.craneEnd,w=walkS(toThreshold),turn=1.5+T.craneDown.leadSeconds,ctot=turn+qc*w,end={...R.pose(qc*sThr,qc)},ra=pointOnPath(toThreshold,qc),rb=toThreshold[0],crane:Pose[]=[];
      for(let i=1;i<RF.craneSteps;i++){const q=qc*i/RF.craneSteps;crane.push(cranePose(end,ra,cameraIsland,rb,pointOnPath(toThreshold,q),1-(turn+q*w)/ctot,q,true));}
      const thr=keysOn(qc*sThr,sThr,0,true).map(k=>({...k,progress:qc+(1-qc)*k.progress!}));
      const cross=keysOn(sThr,sCross,0,false),seat=keysOn(sCross,L,0,false);
      const dc=RF.doorClose,dcFrom=mark(lensAt(zDoor-dc.lensInside));
      // Room light w (unchanged T5 walk ramps, linear in her walk progress): 0 until she is roomLight.before m short of the
      // door plane, 1 when she ends the crossing (inCrossing end); one slope across toThreshold -> inCrossing (no kink).
      const sA=Math.max(0,sDoor-RF.roomLight.before),wJ=sThr>sA?(sThr-sA)/(sCross-sA):0;
      if(!(sCross>sA))throw Error('returnFollow: room-light ramp must start before the end of the crossing');
      const lighting={toThreshold:{from:0,to:wJ,start:Math.min(1,sA/sThr),end:1},crossIn:{from:wJ,to:1,start:sA>sThr?(sA-sThr)/(sCross-sThr):0,end:1}};
      if(dcFrom.seg!=='seat')throw Error('returnFollow: door close must start on the toSeat walk');

      return {cameraToThreshold:[{...cameraIsland,progress:0},...crane,...thr],
        cameraEntry:{cross,door:[] as Pose[],seat,sit:[{...cameraHome,progress:1}],doorSeconds:0,doorCloseFraction:T.entry.doorCloseFraction,
          doorClose:{from:dcFrom.progress,seconds:dc.seconds},noExteriorKey:true,
          remapAll:true,easeInSeconds:RF.easeInSeconds,easeOutSeconds:RF.easeOutSeconds},lighting};})():null;
    return {
      cameraToDoor:D,cameraInside:inside,
      cameraHomeToDoor:[{...cameraHome,progress:0},at('G',.5,reference.standingRoot),{...D[0],progress:1}],
      cameraCrossOut:outboundPaced?outboundPaced.cross:crossOutPoses,
      cameraToIsland:outboundPaced?outboundPaced.toIsland:[{...outside,progress:0},key('I1',toIsland,.4),follow(toIsland,.65,[-6.3,6.3,3],60),{...cameraIsland,progress:1}],
      cameraToThreshold:follow?follow.cameraToThreshold:railOn?inboundRail():[{...cameraIsland,progress:0},follow(toThreshold,.35,[-6.3,6.3,3],60),key('T2',toThreshold,.6),{...outsideReturn,progress:1}],
      ...(TRANSITION_CAMERA.standTurn&&K[TRANSITION_CAMERA.standTurn.key]?{cameraStandTurn:[{...cameraHome,progress:0},
        at(TRANSITION_CAMERA.standTurn.key,TRANSITION_CAMERA.standTurn.mid,reference.standingRoot),{...D[0],progress:1}]}:{}),
      ...(outboundPaced?{cameraSettle:outboundPaced.settle,crane:{startProgress:outboundPaced.frontalWalk,settleSeconds:T.crane.settleSeconds,returnLeadSeconds:T.craneDown.leadSeconds,
        // crane-start mark: the frontal beat on the one exit arc (rotation, dolly and lift are already underway).
        startSeconds:outboundPaced.frontalSeconds}}:{}),
      cameraCrossIn:[{...outsideReturn,progress:0},key('C1',inCrossing,.3),key('C2',inCrossing,.55),key('C3',inCrossing,.8),{...insideReturn,progress:1}],
      // T2+ return entry: ONE move OR -> crossing-in -> door close -> toSeat -> sit -> cameraHome (TRANSITION_CAMERA.entry).
      ...(follow?{remapProgress,cameraEntry:follow.cameraEntry}:railOn&&T.entry?.enabled?{remapProgress,cameraEntry:(()=>{const E=T.entry,seat=c0seat(),list=(g:string)=>E.keys.filter(k=>k.seg===g);
        const mk=(k:any,root:Vec):Pose=>({position:[k.position[0],k.position[1],k.position[2]],target:[root[0],root[1]+k.targetHeight,root[2]],fovVerticalDeg:k.fovVerticalDeg,progress:k.progress});
        const sitRoot=(p:number):Vec=>[seat.standingControllerRoot[0]+(seat.seatedControllerRoot[0]-seat.standingControllerRoot[0])*p,0,seat.standingControllerRoot[2]+(seat.seatedControllerRoot[2]-seat.standingControllerRoot[2])*p];
        const cross=list('cross').map(k=>mk(k,pointOnPath(inCrossing,k.progress))),door=list('door').map(k=>mk(k,inCrossing[inCrossing.length-1]));
        const seatK=list('seat').map(k=>mk(k,pointOnPath(toSeat,k.progress))),sit=[...list('sit').map(k=>mk(k,sitRoot(k.progress))),{...cameraHome,progress:1}];
        if(cross.some(k=>!(k.progress!>0)))throw Error('entry cross keys must be after the doorway key (progress > 0)');
        return {cross,door,seat:seatK,sit,doorSeconds:E.doorSeconds,doorCloseFraction:E.doorCloseFraction};})()}:{}),
      cameraToSeat:[{...insideReturn,progress:0},key('S1',toSeat,.14),key('S2',toSeat,.28),key('S3',toSeat,.42),key('S4',toSeat,.57),key('S5',toSeat,.71),key('S6',toSeat,.86),{...cameraHome,progress:1}],
      cameraTracks:TRANSITION_CAMERA.tracks as RouteConfig['cameraTracks'],
      interiorLighting:follow?{...TRANSITION_CAMERA.lighting,...follow.lighting}:TRANSITION_CAMERA.lighting,
      exteriorKey:TRANSITION_CAMERA.exteriorKey,
      // T2+ wind channel: keys in outbound-span key progress (crossing-out walk + toIsland walk + settle, all from walkDuration).
      ...(railOn&&T.doorDrift?{doorDrift:{...T.doorDrift}}:{}),
      ...(railOn&&T.windOut?{wind:{outbound:(()=>{const W=T.windOut,a=walkS(outCrossing),b=walkS(toIsland),tot=a+b+T.crane.settleSeconds;
        // Wind is 1 on the frontal sample of the one exit arc, and stays 1 only while the lens is still in front of her.
        const qFr=outboundPaced!.frontalQ,qHold=outboundPaced!.holdQ,out=(q:number)=>q*a/tot,qSwing=(a+W.swingStart*b)/tot;
        if(!(out(W.doorProgress)<qSwing&&qSwing<qFr&&qFr<qHold&&qHold<1))throw Error('wind: door < swing < frontal < hold');
        const keys:Array<readonly [number,number]>=[[0,0],[out(W.doorProgress),W.base],[qSwing,W.base],[qFr,1],[qHold,1],[1,0]];
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
