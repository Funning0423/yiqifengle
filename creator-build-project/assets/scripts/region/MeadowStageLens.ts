import {stageNode} from './RegionNodeProgress';

/** 运镜bot b20 meadow-board-lens: which meadow node the board lens frames. 场景设计部 moved M1–M3 (scene/b20-meadow-walk-fixes);
 *  one shared lens on M1 left stage 06 (M2) off-screen on 390×844. Each meadow board 05–08 now frames ITS OWN node with the
 *  same solver (meadowFramedPose: same view direction, pitch and FOV as the shared lens, only the position slides).
 *  05 → M1 keeps the reviewed pose. Unknown / non-meadow stage → M1 (the sail arrival end). Pure state, no camera writes. */
export const MEADOW_STAGE_LENS={fallback:'M1',nodes:['M1','M2','M3','M4']} as const;
let current:string=MEADOW_STAGE_LENS.fallback;
export function meadowLensNodeFor(stageId:string|null|undefined):string{
 const k=stageId?stageNode(stageId):null;
 return k&&(MEADOW_STAGE_LENS.nodes as readonly string[]).indexOf(k)>=0?k:MEADOW_STAGE_LENS.fallback;
}
/** Called when a meadow board is about to be shown (reward walk target, level entry). */
export function setMeadowBoardStage(stageId:string|null|undefined):string{current=meadowLensNodeFor(stageId);return current;}
export function meadowBoardNode():string{return current;}
export function resetMeadowBoardStage():void{current=MEADOW_STAGE_LENS.fallback;}
type P=Readonly<{position:readonly number[];target:readonly number[];fovVerticalDeg?:number}>;
/** Approved gate (Grok Bot, Oct 30), with headroom: a smootherstep blend (ExploreCameraCore.blendPose) of distance d / view angle θ
 *  / FOV Δ over T s peaks at 1.875·d/T, 1.875·θ/T, |e''|max 5.774·θ/T², 1.875·Δ/T. T is the shortest that keeps every peak under
 *  its cap (8 m/s → 6.0 (her 1.2 m/s walk rides on the live follow target), 90°/s → 50 (jitter headroom for the 200°/s² p99), 200°/s² → 120 (real-dt jitter headroom), 1.5°/frame at 30 fps → 40°/s), never below `minS` (the authored BLEND_S) nor floorS (real-dt jitter on the 768×1024 short blends measured p99 > 200°/s² at 0.75 s). */
export const MEADOW_BLEND_CAPS={mps:6.0,degPerS:50,degPerS2:120,fovDegPerS:40,floorS:1.2} as const;
export function meadowBlendSeconds(from:P,to:P,minS:number):number{
 const C=MEADOW_BLEND_CAPS,u=(p:P)=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(d[0],d[1],d[2])||1;return [d[0]/l,d[1]/l,d[2]/l];};
 const a=u(from),b=u(to),th=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))*180/Math.PI;
 const d=Math.hypot(to.position[0]-from.position[0],to.position[1]-from.position[1],to.position[2]-from.position[2]),df=Math.abs((to.fovVerticalDeg??48)-(from.fovVerticalDeg??48));
 return Math.max(minS,C.floorS,1.875*d/C.mps,1.875*th/C.degPerS,Math.sqrt(5.774*th/C.degPerS2),1.875*df/C.fovDegPerS);
}
type V3=[number,number,number];
/** r2 (Grok Bot: worst case ≤ 7.5 m/s with headroom, no fade, no pause, inside the reward walk). The meadow board lens is ONE offset
 *  from her stand on every node (meadowFramedPose only translates), so the walk rides that offset: lens = her + board offset, eased
 *  toward the follow lens (fixed walk heading) and back by w(t) = k·bump(t/walkS) (smootherstep up over the first half, down over the
 *  second). Speed ≤ her walk + k·|follow−board|·1.875/(walkS/2); view rate ≤ k·θ·1.875/(walkS/2). k is the largest ≤ 1 under the caps
 *  (FOLD_CAPS). t = 0: the board lens she left (first frame = live lens); t = walkS: the next board lens, exactly where she stops. */
export const FOLD_CAPS={mps:6.0,herMps:1.25,degPerS:45,degPerS2:120,fovDegPerS:20} as const;
export type FoldPlan=Readonly<{walkS:number;k:number;aspect:number;board:Readonly<{dp:V3;dir:V3;fov:number;ndc:readonly [number,number]}>;follow:Readonly<{dp:V3;dir:V3;fov:number;ndc:readonly [number,number]}>}>;
const dirOf=(p:P):V3=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(d[0],d[1],d[2])||1;return [d[0]/l,d[1]/l,d[2]/l];};
const smooth=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(u*(u*6-15)+10);};
/** her chest (0.86 m over the root, as meadowFramedPose) is the framing anchor */
const CHEST=0.86;
function ndcOf(pos:readonly number[],f:readonly number[],fov:number,aspect:number,x:readonly number[]):[number,number]{
 const r0=[-f[2],0,f[0]],rl=Math.hypot(r0[0],r0[2])||1,r=[r0[0]/rl,0,r0[2]/rl],u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const d=[x[0]-pos[0],x[1]-pos[1],x[2]-pos[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2],tv=Math.tan(fov*Math.PI/360);
 return [(d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/z/(tv*aspect),(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z/tv];}
const fromYP=(y:number,p:number):V3=>[Math.cos(p)*Math.sin(y),Math.sin(p),Math.cos(p)*Math.cos(y)];
/** the view direction from `pos` that puts point x at screen point ndc (no roll): 2×2 Newton on yaw / pitch from `guess`. */
function aimAt(pos:readonly number[],x:readonly number[],ndc:readonly [number,number],fov:number,aspect:number,guess:readonly number[]):V3{
 let y=Math.atan2(guess[0],guess[2]),p=Math.asin(Math.max(-1,Math.min(1,guess[1])));
 for(let it=0;it<6;it++){const e0=ndcOf(pos,fromYP(y,p),fov,aspect,x),h=1e-4,ey=ndcOf(pos,fromYP(y+h,p),fov,aspect,x),ep=ndcOf(pos,fromYP(y,p+h),fov,aspect,x);
  const a=(ey[0]-e0[0])/h,b=(ep[0]-e0[0])/h,c=(ey[1]-e0[1])/h,d=(ep[1]-e0[1])/h,det=a*d-b*c;if(Math.abs(det)<1e-12)break;
  const rx=ndc[0]-e0[0],ry=ndc[1]-e0[1];y+=(d*rx-b*ry)/det;p+=(-c*rx+a*ry)/det;if(Math.abs(rx)+Math.abs(ry)<1e-9)break;}
 return fromYP(y,p);}
/** board: the board lens at her start stand `start`; follow: the follow lens there (fixed walk heading); aspect = w/h of this screen. */
export function meadowFoldPlan(board:P,follow:P,start:readonly number[],walkS:number,aspect:number):FoldPlan{
 const C=FOLD_CAPS,half=Math.max(.5,walkS/2),X=[start[0],start[1]+CHEST,start[2]];
 const pack=(q:P)=>{const dir=dirOf(q),fov=q.fovVerticalDeg??48;return {dp:[q.position[0]-start[0],q.position[1]-start[1],q.position[2]-start[2]] as V3,dir,fov,ndc:ndcOf(q.position,dir,fov,aspect,X)};};
 const b=pack(board),f=pack(follow);
 const D=Math.hypot(f.dp[0]-b.dp[0],f.dp[1]-b.dp[1],f.dp[2]-b.dp[2]),th=Math.acos(Math.max(-1,Math.min(1,b.dir[0]*f.dir[0]+b.dir[1]*f.dir[1]+b.dir[2]*f.dir[2])))*180/Math.PI,df=Math.abs(f.fov-b.fov);
 let k=1;const lim=(need:number,cap:number)=>{if(need>1e-9)k=Math.min(k,cap/need);};
 lim(1.875*D/half,C.mps-C.herMps);lim(1.875*th/half,C.degPerS);lim(5.774*th/(half*half),C.degPerS2);lim(1.875*df/half,C.fovDegPerS);
 return {walkS,k:Math.max(0,k),aspect,board:b,follow:f};
}
export function meadowFoldWeight(plan:FoldPlan,t:number):number{const h=plan.walkS/2;return plan.k*(t<=h?smooth(t/h):smooth((plan.walkS-t)/h));}
/** The lens at walk time t with her root at `her`: the offset is eased board → follow by w, and the view is solved so her chest
 *  sits on the eased screen point (board spot → follow spot), so she never drifts out of frame mid-move. w = 0: the board lens. */
export function meadowFoldPose(plan:FoldPlan,her:readonly number[],t:number):{position:V3;target:V3;fovVerticalDeg:number}{
 const w=meadowFoldWeight(plan,t),B=plan.board,F=plan.follow,p:V3=[0,1,2].map(i=>her[i]+B.dp[i]+(F.dp[i]-B.dp[i])*w) as V3,fov=B.fov+(F.fov-B.fov)*w;
 let d:V3=B.dir;
 if(w>1e-9){const c=Math.max(-1,Math.min(1,B.dir[0]*F.dir[0]+B.dir[1]*F.dir[1]+B.dir[2]*F.dir[2])),th=Math.acos(c),sn=Math.sin(th);
  const k0=th>1e-6?Math.sin((1-w)*th)/sn:1-w,k1=th>1e-6?Math.sin(w*th)/sn:w,g=[0,1,2].map(i=>B.dir[i]*k0+F.dir[i]*k1);
  d=aimAt(p,[her[0],her[1]+CHEST,her[2]],[B.ndc[0]+(F.ndc[0]-B.ndc[0])*w,B.ndc[1]+(F.ndc[1]-B.ndc[1])*w],fov,plan.aspect,g);}
 return {position:p,target:[p[0]+d[0]*10,p[1]+d[1]*10,p[2]+d[2]*10],fovVerticalDeg:fov};
}
