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
type PaceOpts=Readonly<{sampleMetres:number;craneRampSeconds:number;course?:readonly (readonly [number,number,number])[];sampleDt?:number;tSlow?:number;vSlow?:number;tCruise?:number;easeOut?:number;tFront?:number;lookTau?:number;lookHandoff?:number;lookBlendStart?:number;fovWide?:number;fovWideSeconds?:number;fovZoomStart?:number;fovZoomSpan?:number}>;
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
 * Outbound lens along a centripetal spline through the authored span knots (crossing, railOut, equal-u crane steps,
 * cameraIsland). pchip on the five rail poses zeroed the reversing axis at the swing (~4.9 → ~2 → ~4.9 m/s); the spline
 * does not, and arc-length samples between those knots keep each knot on its walk progress (frontal pose, wind, crane
 * mark). From the crane knot the same spline is retimed with a smoothstep off the rail speed, then the track ease-out
 * settles it — the old one-segment settle climbed ~3 → ~12 m/s. Zoom is not that spline: a 1-D centripetal curve kinks
 * the fov rate at each rail knot (~−15 → ~−8 deg/s in one frame). Fov is a scalar pchip of the knot fovs against span
 * progress, so the rate stays continuous and every knot keeps its authored fov. She does not wait.
 */
function paceOutbound(opts:PaceOpts,span:readonly Pose[],cut:Readonly<{qCrossEnd:number;qCrane:number;qWalkEnd:number;frontalQ:number}>,track:Readonly<{easeIn?:number;easeOut?:number}>,totalSeconds:number,island:Pose):{cross:Pose[];toIsland:Pose[];settle:Pose[];frontalProgress:number}{
  const qOf=(k:Pose)=>k.progress??0;
  if(span.length<6||Math.abs(qOf(span[0]))>1e-9||Math.abs(qOf(span[span.length-1])-1)>1e-9)throw Error('outbound pace: span keys');
  const posAt=centripetal(span.map(k=>k.position)),tgtAt=centripetal(span.map(k=>k.target));
  const fovOfQ=pchipScalar(span.map(qOf),span.map(k=>k.fovVerticalDeg??50));
  const per=24,pts:{pose:Look;s:number;knot:number}[]=[];let sAcc=0;
  const at=(i:number,u:number,knot:number):Look=>{if(knot>=0)return span[knot];
    return {position:posAt(i,u),target:tgtAt(i,u),fovVerticalDeg:fovOfQ(qOf(span[i])+(qOf(span[i+1])-qOf(span[i]))*u)};};
  for(let i=0;i<span.length-1;i++)for(let j=0;j<=per;j++){if(j===0&&i>0)continue;const u=j/per,knot=j===0?i:j===per?i+1:-1,pose=at(i,u,knot);
    if(pts.length){const p=pts[pts.length-1].pose.position,q=pose.position;sAcc+=Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]);}
    pts.push({pose,s:sAcc,knot});}
  const knotS=span.map((_,i)=>{const p=pts.find(x=>x.knot===i);if(!p)throw Error('outbound pace: knot arc');return p.s;});
  const poseAtS=(s:number):Look=>{if(s<=0)return pts[0].pose;if(s>=sAcc)return pts[pts.length-1].pose;let lo=0,hi=pts.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].s<s)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi],u=(s-a.s)/((b.s-a.s)||1);
    if(a.knot>=0&&u<1e-4)return a.pose;if(b.knot>=0&&u>1-1e-4)return b.pose;
    const pa=a.pose.position,pb=b.pose.position,ta=a.pose.target,tb=b.pose.target;
    return {position:[pa[0]+(pb[0]-pa[0])*u,pa[1]+(pb[1]-pa[1])*u,pa[2]+(pb[2]-pa[2])*u],target:[ta[0]+(tb[0]-ta[0])*u,ta[1]+(tb[1]-ta[1])*u,ta[2]+(tb[2]-ta[2])*u],
      fovVerticalDeg:(a.pose.fovVerticalDeg??50)+((b.pose.fovVerticalDeg??50)-(a.pose.fovVerticalDeg??50))*u};};
  const posed=(src:Look,progress:number):Pose=>({position:[src.position[0],src.position[1],src.position[2]],target:[src.target[0],src.target[1],src.target[2]],
    fovVerticalDeg:Math.min(74.9,Math.max(30.1,src.fovVerticalDeg??50)),progress});
  let ic=0;for(let i=0;i<span.length;i++)if(qOf(span[i])<=cut.qCrane+1e-8)ic=i;
  if(ic<2||Math.abs(qOf(span[ic])-cut.qCrane)>1e-4)throw Error('outbound pace: crane key missing');
  const step=Math.max(.05,opts.sampleMetres),out:Pose[]=[];
  const withFov=(src:Look,q:number):Look=>({position:src.position,target:src.target,fovVerticalDeg:fovOfQ(q)});
  const push=(src:Look,q:number)=>{if(out.length&&q<=(out[out.length-1].progress??0)+1e-6)return;out.push(posed(withFov(src,q),q));};
  // Arc vs span-progress through the knots up to the crane. All slopes are positive, so this pchip keeps d(arc)/dq
  // continuous and non-zero: a per-interval constant speed stepped at each knot, and the runtime pchip then spiked.
  const qK=span.slice(0,ic+1).map(qOf),SK=knotS.slice(0,ic+1),SOfQ=pchipScalar(qK,SK);
  push(span[0],0);
  for(let i=0;i<ic;i++){let q=qK[i];
    while(q<qK[i+1]){const target=SOfQ(q)+step;if(target>=SK[i+1]-step*.35)break;
      let a=q,b=qK[i+1];for(let k=0;k<24;k++){const m=(a+b)/2;if(SOfQ(m)<target)a=m;else b=m;}
      const nq=(a+b)/2;if(!(nq>q+1e-5&&nq<qK[i+1]-1e-5))break;q=nq;push(poseAtS(SOfQ(q)),q);}
    push(span[i+1],qK[i+1]);}
  const q0=qK[ic],sStart=knotS[ic],L=knotS[span.length-1]-sStart,D=1-q0;
  const C0=Math.max(1e-3,(SOfQ(q0)-SOfQ(q0-1e-4))/1e-4);
  const slope=(remapProgress(.5,track)-remapProgress(.4,track))/.1;
  let qr=opts.craneRampSeconds*slope/totalSeconds;qr=Math.min(Math.max(qr,.02),D*.7);
  const Cc=C0+(L-C0*D)/(D-.5*qr);
  if(!(C0>0&&Cc>0&&L>0&&Number.isFinite(Cc)))throw Error('outbound pace: crane speed');
  const sFromQ=(q:number)=>{const x=q-q0;if(x<=0)return 0;if(q>=1)return L;
    if(x<qr){const u=x/qr;return C0*x+(Cc-C0)*qr*(u*u*u-.5*u*u*u*u);}
    return C0*qr+(Cc-C0)*qr*.5+Cc*(x-qr);};
  const qFromS=(s:number)=>{if(s<=0)return q0;if(s>=L-1e-9)return 1;let lo=q0,hi=1;for(let k=0;k<48;k++){const m=(lo+hi)/2;if(sFromQ(m)<s)lo=m;else hi=m;}return (lo+hi)/2;};
  const nC=Math.max(1,Math.ceil(L/step));
  for(let j=1;j<=nC;j++){const s=L*j/nC;push(j===nC?island:poseAtS(sStart+s),j===nC?1:qFromS(s));}
  const {qCrossEnd,qWalkEnd,frontalQ}=cut;
  if(!(qCrossEnd>0&&qCrossEnd<q0&&q0<qWalkEnd&&qWalkEnd<1))throw Error('outbound pace: segment cuts');
  const near=(q:number)=>{let best=out[0],e=1e9;for(const k of out){const d=Math.abs((k.progress??0)-q);if(d<e){e=d;best=k;}}if(e>1e-3)throw Error('outbound pace: missing boundary');return best;};
  const door=near(qCrossEnd),bound=withFov(poseAtS(sStart+sFromQ(qWalkEnd)),qWalkEnd);
  const locC=(q:number)=>q/qCrossEnd,locI=(q:number)=>(q-qCrossEnd)/(qWalkEnd-qCrossEnd),locS=(q:number)=>(q-qWalkEnd)/(1-qWalkEnd);
  const cross:Pose[]=out.filter(k=>(k.progress??0)<qCrossEnd-1e-6).map(k=>({...k,progress:locC(k.progress!)}));
  cross.push({...door,progress:1});
  const toIsland:Pose[]=[{...door,progress:0}];
  for(const k of out){const q=k.progress!;if(q>qCrossEnd+1e-6&&q<qWalkEnd-2e-4)toIsland.push({...k,progress:locI(q)});}
  toIsland.push(posed(bound,1));
  const settle:Pose[]=[posed(bound,0)];
  for(const k of out){const q=k.progress!;if(q>qWalkEnd+2e-4&&q<1-1e-6)settle.push({...k,progress:locS(q)});}
  settle.push({position:[...island.position] as unknown as Vec,target:[...island.target] as unknown as Vec,fovVerticalDeg:island.fovVerticalDeg,progress:1});
  const mono=(name:string,keys:Pose[])=>{for(let i=1;i<keys.length;i++)if(!((keys[i].progress??0)>(keys[i-1].progress??0)))throw Error('outbound pace: '+name+' keys not increasing');};
  mono('cross',cross);mono('toIsland',toIsland);mono('settle',settle);
  const frontalProgress=locI(frontalQ);
  if(!(frontalProgress>0&&frontalProgress<locI(q0)-1e-4))throw Error('outbound pace: frontal key must stay before the crane');
  return {cross,toIsland,settle,frontalProgress};
}
/** Outbound lens on one centripetal course. Poses are stored at eased span progress, so the track ease plays them back
 *  on the clock below: slow through the doorway, one smoothstep onto a flat cruise while yaw, retreat, and height move
 *  together, then easeOut seconds to rest on cameraIsland. Wind is 1 at tFront. */
function paceCourse(opts:PaceOpts,track:Readonly<{easeIn?:number;easeOut?:number}>,inside:Pose,island:Pose,outCrossing:readonly Vec[],toIslandRoute:readonly Vec[],seconds:Readonly<{cross:number;walk:number;settle:number}>):{cross:Pose[];toIsland:Pose[];settle:Pose[];frontalProgress:number}{
  const courseIn=opts.course,t1=opts.tSlow,V1=opts.vSlow,t2=opts.tCruise,easeOut=opts.easeOut,tFront=opts.tFront;
  if(!(courseIn&&courseIn.length>=4&&t1&&V1&&t2&&easeOut&&tFront&&t2>t1&&V1>0&&easeOut>0))throw Error('outbound course pace');
  const a=seconds.cross,b=seconds.walk,settleS=seconds.settle,T=a+b+settleS;
  if(!(a>0&&b>0&&settleS>0&&t2+easeOut<T&&tFront>a&&tFront<a+b))throw Error('outbound course pace: schedule');
  const course:Vec[]=[];
  for(let i=0;i<courseIn.length;i++)course.push([courseIn[i][0],courseIn[i][1],courseIn[i][2]]);
  course[0]=[inside.position[0],inside.position[1],inside.position[2]];
  course[course.length-1]=[island.position[0],island.position[1],island.position[2]];
  const atSeg=centripetal(course),raw:Vec[]=[],per=24;
  for(let i=0;i<course.length-1;i++)for(let j=0;j<=per;j++){if(j===0&&i>0)continue;raw.push(atSeg(i,j/per));}
  const arc:number[]=[0];
  for(let i=1;i<raw.length;i++){const p=raw[i-1],q=raw[i];arc.push(arc[i-1]+Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]));}
  const L=arc[arc.length-1];
  const pointAt=(s:number):Vec=>{if(s<=0)return raw[0];if(s>=L)return raw[raw.length-1];let lo=0,hi=raw.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(arc[m]<s)lo=m;else hi=m;}
    const u=(s-arc[lo])/((arc[hi]-arc[lo])||1),A=raw[lo],B=raw[hi];return [A[0]+(B[0]-A[0])*u,A[1]+(B[1]-A[1])*u,A[2]+(B[2]-A[2])*u];};
  const d1=V1*t1*0.5,dt=t2-t1,tc=T-t2-easeOut,coef=dt/2+tc+easeOut/2,V=(L-(d1+V1*dt/2))/coef;
  if(!(V>V1&&Number.isFinite(V)))throw Error('outbound course pace: cruise speed');
  const arcAt=(t:number)=>{if(t<=0)return 0;if(t>=T)return L;
    if(t<t1){const u=t/t1;return V1*t1*(u*u*u-.5*u*u*u*u);}
    if(t<t2){const u=(t-t1)/dt;return d1+V1*(t-t1)+(V-V1)*dt*(u*u*u-.5*u*u*u*u);}
    if(t<T-easeOut)return d1+(V1+V)/2*dt+V*(t-t2);
    const u=(t-(T-easeOut))/easeOut;return d1+(V1+V)/2*dt+V*(T-easeOut-t2)+V*easeOut*(u-(u*u*u-.5*u*u*u*u));};
  const endRoot=toIslandRoute[toIslandRoute.length-1];
  const rootAt=(t:number):Vec=>t<=a?pointOnPath(outCrossing,t/a):t<=a+b?pointOnPath(toIslandRoute,(t-a)/b):endRoot;
  const sm=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*(3-2*u);};
  const tau=opts.lookTau&&opts.lookTau>0?opts.lookTau:.05,handoff=opts.lookHandoff&&opts.lookHandoff>0?opts.lookHandoff:.4,blendStart=opts.lookBlendStart??5.5,blendEnd=T-easeOut;
  const fov0=inside.fovVerticalDeg??68,fovWide=opts.fovWide??74,fovWideS=opts.fovWideSeconds&&opts.fovWideSeconds>0?opts.fovWideSeconds:1.2,fovEnd=island.fovVerticalDeg??42;
  const z0=opts.fovZoomStart??.15,zSpan=opts.fovZoomSpan&&opts.fovZoomSpan>0?opts.fovZoomSpan:.7;
  const step=opts.sampleDt&&opts.sampleDt>0?opts.sampleDt:1/60;
  const tCross=invertProgress(a/T,track)*T,tWalk=invertProgress((a+b)/T,track)*T;
  const times:number[]=[0];
  const mark=(m:number)=>{for(let i=0;i<times.length;i++){if(Math.abs(times[i]-m)<=1e-4){times[i]=m;return;}if(times[i]>m){times.splice(i,0,m);return;}}times.push(m);};
  for(let i=1;i*step<T-1e-6;i++)times.push(i*step);
  mark(tCross);mark(tWalk);if(times[times.length-1]<T-1e-8)times.push(T);else times[times.length-1]=T;
  let look:Vec=[inside.target[0],inside.target[1],inside.target[2]];
  const samples:{t:number;q:number;pose:Pose}[]=[];
  for(let i=0;i<times.length;i++){const t=times[i],s=arcAt(t),root=rootAt(Math.max(0,Math.min(a+b,t))),chest:Vec=[root[0],1.02,root[2]],isl=island.target;
    const w=sm((t-blendStart)/((blendEnd-blendStart)||1)),raw:Vec=[chest[0]+(isl[0]-chest[0])*w,chest[1]+(isl[1]-chest[1])*w,chest[2]+(isl[2]-chest[2])*w],hand=sm(t/handoff);
    const aim:Vec=[inside.target[0]+(raw[0]-inside.target[0])*hand,inside.target[1]+(raw[1]-inside.target[1])*hand,inside.target[2]+(raw[2]-inside.target[2])*hand];
    if(i>0){const k=1-Math.exp(-(t-times[i-1])/tau);look=[look[0]+(aim[0]-look[0])*k,look[1]+(aim[1]-look[1])*k,look[2]+(aim[2]-look[2])*k];}
    const wide=fov0+(fovWide-fov0)*sm(Math.min(1,t/fovWideS)),zoom=sm(Math.max(0,Math.min(1,(s/L-z0)/zSpan)));
    let position=pointAt(s),target=look,fov=wide+(fovEnd-wide)*zoom;
    if(t<=1e-9){position=[inside.position[0],inside.position[1],inside.position[2]];target=[inside.target[0],inside.target[1],inside.target[2]];fov=fov0;}
    if(t>=T-1e-9){position=[island.position[0],island.position[1],island.position[2]];target=[island.target[0],island.target[1],island.target[2]];fov=fovEnd;}
    const q=t<=1e-9?0:t>=T-1e-9?1:remapProgress(t/T,track);
    if(samples.length&&!(q>samples[samples.length-1].q+1e-12))throw Error('outbound course pace: progress');
    samples.push({t,q,pose:{position,target,fovVerticalDeg:Math.min(74.9,Math.max(30.1,fov))}});}
  const qCross=a/T,qWalk=(a+b)/T,cross:Pose[]=[],islandKeys:Pose[]=[],settleKeys:Pose[]=[];
  for(let i=0;i<samples.length;i++){const q=Math.abs(samples[i].t-tCross)<=1e-8?qCross:Math.abs(samples[i].t-tWalk)<=1e-8?qWalk:samples[i].q,pose=samples[i].pose;
    if(Math.abs(q-qCross)<=1e-8){cross.push({...pose,progress:1});islandKeys.push({...pose,progress:0});}
    else if(Math.abs(q-qWalk)<=1e-8){islandKeys.push({...pose,progress:1});settleKeys.push({...pose,progress:0});}
    else if(q<qCross)cross.push({...pose,progress:q/qCross});
    else if(q<qWalk)islandKeys.push({...pose,progress:(q-qCross)/(qWalk-qCross)});
    else if(q<1-1e-12)settleKeys.push({...pose,progress:(q-qWalk)/(1-qWalk)});
    else settleKeys.push({...pose,progress:1});}
  const mono=(name:string,keys:Pose[])=>{if(keys.length<2)throw Error('outbound course pace: '+name);for(let i=1;i<keys.length;i++)if(!((keys[i].progress??0)>(keys[i-1].progress??0)))throw Error('outbound course pace: '+name+' keys not increasing');};
  mono('cross',cross);mono('toIsland',islandKeys);mono('settle',settleKeys);
  const last=settleKeys[settleKeys.length-1];
  if(Math.abs(last.position[0]-island.position[0])+Math.abs(last.position[1]-island.position[1])+Math.abs(last.position[2]-island.position[2])>1e-6)throw Error('outbound course pace: island pose');
  const frontalProgress=(remapProgress(tFront/T,track)*T-a)/b;
  if(!(frontalProgress>0&&frontalProgress<1))throw Error('outbound course pace: frontal');
  return {cross,toIsland:islandKeys,settle:settleKeys,frontalProgress};
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
  const c0seat=()=>({standingControllerRoot:reference.standingRoot,seatedControllerRoot:reference.seatedRoot});
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
    const crossOutPoses:Pose[]=[{...inside,progress:0},key('X1',outCrossing,.35),key('X2',outCrossing,.55),{...outside,progress:1}];
    const outboundPaced=railOn?(()=>{const cs=T.crane.startProgress,rail=T.railOut.filter(k=>k.progress<=cs).map(k=>railPose(toIsland,k));
      const start=rail[rail.length-1];if(!start||Math.abs(start.progress!-cs)>1e-9)throw Error('railOut must end on crane.startProgress');
      const fr=T.railOut.find(k=>k.frontal&&k.progress<=cs);if(!fr)throw Error('railOut needs a frontal key before the crane');
      const pace=T.crane.pace;if(!pace)throw Error('outbound crane pace missing');
      const a=walkS(outCrossing),b=walkS(toIsland),settleS=T.crane.settleSeconds,tot=a+b+settleS;
      if(pace.course&&pace.course.length>=4){const paced=paceCourse(pace,T.tracks.outbound,inside,cameraIsland,outCrossing,toIsland,{cross:a,walk:b,settle:settleS});
        if(!(Math.abs(paced.frontalProgress-fr.progress)<1e-6))throw Error('railOut frontal progress must match the outbound course');return paced;}
      const ra=pointOnPath(toIsland,cs),rb=toIsland[toIsland.length-1],crane:Pose[]=[];
      for(let i=1;i<=T.crane.steps;i++){const p=cs+(1-cs)*i/T.crane.steps;crane.push(cranePose(start,ra,cameraIsland,rb,pointOnPath(toIsland,p),(p-cs)*b/tot,p));}
      const original:Pose[]=[{...outside,progress:0},...rail,...crane,{...cameraIsland,progress:1}];
      const span=spanCameraKeys([{seconds:a,cameras:crossOutPoses},{seconds:b,cameras:original.slice(0,-1)},{seconds:settleS,cameras:[{...cameraIsland,progress:1}]}]);
      return paceOutbound(pace,span,{qCrossEnd:a/tot,qCrane:(a+cs*b)/tot,qWalkEnd:(a+b)/tot,frontalQ:(a+fr.progress*b)/tot},T.tracks.outbound,tot,cameraIsland);})():null;
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
      ...(outboundPaced?{cameraSettle:outboundPaced.settle,crane:{startProgress:T.crane.startProgress,settleSeconds:T.crane.settleSeconds,returnLeadSeconds:T.craneDown.leadSeconds,
        // crane-start mark: outbound span = crossing-out walk + toIsland walk + settle (all known here); eased track time of the key.
        startSeconds:(()=>{const a=walkS(outCrossing),b=walkS(toIsland),total=a+b+T.crane.settleSeconds;return total*invertProgress((a+T.crane.startProgress*b)/total,T.tracks.outbound as any);})()}}:{}),
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
        const f=T.railOut.filter(k=>k.frontal);if(f.length!==1)throw Error('railOut needs exactly one frontal key');
        // frontalProgress is the toIsland progress whose eased span key is tFront, so wind is 1 on that pose.
        const fp=outboundPaced!.frontalProgress,he=T.crane.startProgress;if(!(W.swingStart<fp&&fp<he))throw Error('wind: swingStart < frontal < crane.startProgress');
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
