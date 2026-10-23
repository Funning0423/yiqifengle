/**
 * b17r7 (运镜bot): follow / orbit lens occlusion for free walk. Pure, no cc (Node-tested by test-lakeside-lens-occlusion.cjs).
 * The lens sits on a ray from her head (pivot) to the desired lens. Every proxy box that the head is not inside is grown by
 * clearM; the arm is cut where the ray enters the first grown box (≥ clearM of clearance where possible) and never beyond the
 * first RAW box entry (the lens is never inside or behind an occluder, even mid-ease). The same is done for the line from her
 * chest. The arm follows that target with an asymmetric ease: in fast (inTauS), out slow (outTauS); orientation is untouched
 * (only the lens slides along its own pivot ray, so the view never snaps). minArmM is the floor; a target below it is reported
 * (blockedAtMin) instead of putting the lens into her.
 */
export type OccVec=readonly [number,number,number];
export type OccBox=Readonly<{min:OccVec;max:OccVec}>;
export type OccPose=Readonly<{position:OccVec;target:OccVec;fovVerticalDeg?:number}>;
export const LENS_OCC=Object.freeze({clearM:1.1,minArmM:1.6,inTauS:0.06,outTauS:0.6,headM:1.5,chestM:1.1});
const inside=(p:OccVec,b:OccBox,g=0)=>p[0]>=b.min[0]-g&&p[0]<=b.max[0]+g&&p[1]>=b.min[1]-g&&p[1]<=b.max[1]+g&&p[2]>=b.min[2]-g&&p[2]<=b.max[2]+g;
/** Parametric entry (0..1) of segment a→b into box b grown by g, or null. */
export function segEnter(a:OccVec,d:OccVec,len:number,b:OccBox,g:number):number|null{
 let t0=0,t1=len;
 for(let k=0;k<3;k++){const lo=b.min[k]-g,hi=b.max[k]+g;
  if(Math.abs(d[k])<1e-9){if(a[k]<lo||a[k]>hi)return null;continue;}
  let u=(lo-a[k])/d[k],v=(hi-a[k])/d[k];if(u>v){const s=u;u=v;v=s;}
  if(u>t0)t0=u;if(v<t1)t1=v;if(t0>t1)return null;}
 return t0;
}
export type OccTarget={arm:number;full:number;hardArm:number;dir:OccVec;pivot:OccVec;blockedAtMin:boolean};
/** Target arm along pivot→lens for one desired pose. */
export function occlusionTarget(her:OccVec,lens:OccVec,boxes:readonly OccBox[],o=LENS_OCC):OccTarget{
 const pivot:OccVec=[her[0],her[1]+o.headM,her[2]],chest:OccVec=[her[0],her[1]+o.chestM,her[2]];
 const v=[lens[0]-pivot[0],lens[1]-pivot[1],lens[2]-pivot[2]],full=Math.hypot(v[0],v[1],v[2])||1e-6,dir:OccVec=[v[0]/full,v[1]/full,v[2]/full];
 let arm=full,hard=full;
 for(const b of boxes){
  if(inside(pivot,b)||inside(chest,b))continue;
  const raw=segEnter(pivot,dir,full,b,0);if(raw!==null&&raw<hard)hard=raw;
  const gEnter=inside(pivot,b,o.clearM)?raw:segEnter(pivot,dir,full,b,o.clearM);
  if(gEnter!==null&&gEnter<arm)arm=gEnter;
  // chest line: she must stay visible from the lens too (chest→lens on the same arm, sampled at the current target)
 }
 for(let it=0;it<3;it++){const p:OccVec=[pivot[0]+dir[0]*arm,pivot[1]+dir[1]*arm,pivot[2]+dir[2]*arm];
  const w=[p[0]-chest[0],p[1]-chest[1],p[2]-chest[2]],L=Math.hypot(w[0],w[1],w[2])||1e-6,u:OccVec=[w[0]/L,w[1]/L,w[2]/L];let cut=false;
  for(const b of boxes){if(inside(pivot,b)||inside(chest,b))continue;const t=segEnter(chest,u,L,b,0);if(t!==null&&t<L-1e-3){arm=Math.max(0,arm*Math.min(.95,t/L));cut=true;}}
  if(!cut)break;}
 const blockedAtMin=Math.min(arm,hard)<o.minArmM&&full>o.minArmM;
 return {arm:Math.max(Math.min(o.minArmM,full),Math.min(arm,hard)),full,hardArm:Math.max(Math.min(o.minArmM,full),hard),dir,pivot,blockedAtMin};
}
/** Lens direction from the pivot raised by `upDeg` toward +Y and swung `swingDeg` about +Y. */
export function craneDir(d:OccVec,upDeg:number,swingDeg=0):OccVec{
 if(!upDeg&&!swingDeg)return d;const h=Math.hypot(d[0],d[2])||1e-6,el=Math.min(Math.atan2(d[1],h)+upDeg*Math.PI/180,80*Math.PI/180),az=Math.atan2(d[0],d[2])+swingDeg*Math.PI/180;
 return [Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)];
}
/** Lens follower. Target per frame: the lens pulled in along its pivot ray; when that leaves less than max(minArmM, keepShare ×
 *  arm), the lens cranes up and/or swings round her (cheapest of the candidates that keeps the arm). Arm, crane and swing each
 *  ease (toward safety fast, back slow) under rate caps (no snap), and the arm is capped at the raw occluder entry of the eased
 *  direction every frame (never inside or behind; that cap is the only step that can be fast). Looks at the desired target. */
export const LENS_CRANE=Object.freeze({keepShare:0.55,ups:[0,10,20,30,42,54,-10,-20],swings:[0,20,-20,40,-40,60,-60],upCost:1,swingCost:1.3,
 upTauS:0.15,downTauS:0.9,inMaxMS:9,outMaxMS:2.5,angInDegS:70,angOutDegS:25,hardInMS:27});
export class LensPullIn{
 private arm:number|null=null;private up=0;private swing=0;
 reset(){this.arm=null;this.up=0;this.swing=0;}
 apply(pose:OccPose,her:OccVec,boxes:readonly OccBox[],dt:number,o=LENS_OCC,c=LENS_CRANE):OccPose&{occ:OccTarget;craneDeg:number;swingDeg:number}{
  const pivot:OccVec=[her[0],her[1]+o.headM,her[2]],v=[pose.position[0]-pivot[0],pose.position[1]-pivot[1],pose.position[2]-pivot[2]],full=Math.hypot(v[0],v[1],v[2])||1e-6;
  // broadphase: only boxes that a lens ray of this length (any crane/swing) can reach
  const R=full+o.clearM;boxes=boxes.filter(b=>{let d=0;for(let k=0;k<3;k++){const q=pivot[k]<b.min[k]?b.min[k]-pivot[k]:pivot[k]>b.max[k]?pivot[k]-b.max[k]:0;d+=q*q;}return d<=R*R;});
  const d0:OccVec=[v[0]/full,v[1]/full,v[2]/full],keep=Math.min(full,Math.max(o.minArmM,c.keepShare*full));
  const at=(up:number,sw:number)=>{const d=craneDir(d0,up,sw);return occlusionTarget(her,[pivot[0]+d[0]*full,pivot[1]+d[1]*full,pivot[2]+d[2]*full],boxes,o);};
  let wantUp=0,wantSw=0;const base=at(0,0);
  if(base.arm<keep-1e-6){let best=Infinity,bestArm=base.arm,fbU=0,fbS=0,found=false;
   for(const u of c.ups)for(const sw of c.swings){if(!u&&!sw)continue;const cost=Math.abs(u)*c.upCost*(u<0?1.5:1)+Math.abs(sw)*c.swingCost;if(cost>=best)continue;const T=at(u,sw);
    if(T.arm>=keep-1e-6){best=cost;wantUp=u;wantSw=sw;found=true;}else if(!found&&T.arm>bestArm+0.25){bestArm=T.arm;fbU=u;fbS=sw;}}
   if(!found){wantUp=fbU;wantSw=fbS;}}
  const step=Math.max(0,Math.min(.25,dt||0)),first=this.arm===null;
  const ease=(cur:number,want:number,safer:boolean,tauIn:number,tauOut:number,capIn:number,capOut:number)=>{
   const d=(want-cur)*(1-Math.exp(-step/(safer?tauIn:tauOut))),cap=(safer?capIn:capOut)*step;return cur+Math.max(-cap,Math.min(cap,d));};
  if(first){this.up=wantUp;this.swing=wantSw;}
  else{this.up=ease(this.up,wantUp,wantUp>this.up,c.upTauS,c.downTauS,c.angInDegS,c.angOutDegS);
   this.swing=ease(this.swing,wantSw,Math.abs(wantSw)>Math.abs(this.swing)||Math.sign(wantSw)!==Math.sign(this.swing),c.upTauS,c.downTauS,c.angInDegS,c.angOutDegS);}
  const T=at(this.up,this.swing);
  let a=first?T.arm:Math.min(this.arm!,T.full);
  if(!first)a=ease(a,T.arm,T.arm<a,o.inTauS,o.outTauS,c.inMaxMS,c.outMaxMS);
  // the raw-entry cap only where it helps: when even the arm floor is behind the occluder (blockedAtMin) a jump to the floor
  // would still show the occluder, so the eased arm stands (no snap) and the frame counts as residual occlusion.
  // hard cap (raw entry): pulled in at up to hardInMS (just under the 1 m/frame snap line at 30 fps), never a teleport.
  const hard=T.blockedAtMin?T.full:T.hardArm;if(!first&&hard<a)a=Math.max(hard,a-c.hardInMS*step);else a=Math.min(a,hard);
  a=Math.min(a,T.full);this.arm=a;
  if(a>=T.full-1e-6&&Math.abs(this.up)<1e-3&&Math.abs(this.swing)<1e-3)return {...pose,occ:T,craneDeg:0,swingDeg:0};
  const p:OccVec=[T.pivot[0]+T.dir[0]*a,T.pivot[1]+T.dir[1]*a,T.pivot[2]+T.dir[2]*a];
  return {position:p,target:pose.target,fovVerticalDeg:pose.fovVerticalDeg,occ:T,craneDeg:this.up,swingDeg:this.swing};
 }
}
/** Proxy rows [minX,minY,minZ,maxX,maxY,maxZ] (region-local) → world AABBs through a point transform (rotation+scale ok). */
export function proxiesToWorld(rows:readonly (readonly number[])[],toWorld:(p:OccVec)=>OccVec):OccBox[]{
 return rows.map(r=>{const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  for(let m=0;m<8;m++){const w=toWorld([m&1?r[3]:r[0],m&2?r[4]:r[1],m&4?r[5]:r[2]]);for(let k=0;k<3;k++){if(w[k]<lo[k])lo[k]=w[k];if(w[k]>hi[k])hi[k]=w[k];}}
  return {min:[lo[0],lo[1],lo[2]] as OccVec,max:[hi[0],hi[1],hi[2]] as OccVec};});
}

/* ===================== b17r13 (运镜bot): LensGuard — replaces LensPullIn in the stage =====================
 * Mac r13b (6f03b4d0) failures of LensPullIn: the lens sat in canopies (ring trees had no proxies), dropped under the bridge deck
 * (negative crane, no floor), hugged her at the 1.6 m arm through the railings, and pulled in at 9 m/s (frame jumps).
 * LensGuard plans a pose OFFSET (crane up, swing round her, arm share) every PLAN_S from a candidate grid scored at her current
 * AND predicted positions (look-ahead along her walk velocity, so the move starts before an occluder arrives):
 *   head / chest line blocked, lens inside or < clearM from a proxy, near-lens clutter (a 3×3 ray fan over the view, ≤ nearM),
 *   lens below the floor (her feet + feetHeadroomM, walk floor + floorHeadroomM), plus the cost of leaving the designed lens.
 * The lens offset from the designed (raw) lens then follows the plan through a critically damped spring with a speed cap
 * (maxMS, extra to the raw lens's own motion) and an acceleration cap (maxAccMS2): no snap, no jump, ease in and out.
 * Aim: at her look point (the raw lens's look ray at her distance), so a craned / swung lens still frames her face and chest. */
export const LENS_GUARD=Object.freeze({clearM:1.1,headM:1.5,chestM:1.1,feetHeadroomM:1.2,floorHeadroomM:0.8,nearM:3,
 ups:[0,12,24,36,50,64],swings:[0,25,-25,50,-50,75,-75],shares:[1,0.78,0.58],lookAheadS:[0,0.6,1.2],planS:0.15,
 wHead:100,wChest:60,wInside:120,wClear:6,wClutter:40,wFloor:80,wUp:0.05,wSwing:0.06,wShare:10,hysteresis:2.5,
 maxMS:3.5,maxAccMS2:7,omega:4.5});
type V3=[number,number,number];
const vsub=(a:OccVec,b:OccVec):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];const vlen=(a:OccVec)=>Math.hypot(a[0],a[1],a[2]);
const vnorm=(a:OccVec):V3=>{const l=vlen(a)||1e-9;return [a[0]/l,a[1]/l,a[2]/l];};
const vcross=(a:OccVec,b:OccVec):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function boxDist(p:OccVec,b:OccBox){let d=0;for(let k=0;k<3;k++){const v=p[k]<b.min[k]?b.min[k]-p[k]:p[k]>b.max[k]?p[k]-b.max[k]:0;d+=v*v;}return Math.sqrt(d);}
function segBlocked(a:OccVec,b:OccVec,boxes:readonly OccBox[]):boolean{const d=vsub(b,a),L=vlen(d);if(L<1e-6)return false;const u:OccVec=[d[0]/L,d[1]/L,d[2]/L];
 for(const x of boxes){const t=segEnter(a,u,L,x,0);if(t!==null&&t>1e-3&&t<L-0.05)return true;}return false;}
export type GuardEval={cost:number;head:boolean;chest:boolean;inside:boolean;clutter:number;belowFloor:boolean;position:OccVec};
export type GuardParams={up:number;swing:number;share:number};
/** One candidate lens for her at `her`: position, and its scored problems. `floorAt` (world x,z → floor y | null) is optional. */
export function guardEval(raw:OccPose,her:OccVec,boxes:readonly OccBox[],p:GuardParams,floorAt?:(x:number,z:number)=>number|null,o=LENS_GUARD):GuardEval{
 const pivot:OccVec=[her[0],her[1]+o.headM,her[2]],chest:OccVec=[her[0],her[1]+o.chestM,her[2]];
 const v=vsub(raw.position,pivot),full=vlen(v)||1e-6,d=craneDir([v[0]/full,v[1]/full,v[2]/full],p.up,p.swing),arm=full*p.share;
 let pos:V3=[pivot[0]+d[0]*arm,pivot[1]+d[1]*arm,pivot[2]+d[2]*arm];
 const fl=floorAt?floorAt(pos[0],pos[2]):null,minY=Math.max(her[1]+o.feetHeadroomM,fl===null?-1e9:fl+o.floorHeadroomM);
 const belowFloor=pos[1]<minY-1e-6;if(belowFloor)pos=[pos[0],minY,pos[2]];
 const live=boxes.filter(b=>!inside(pivot,b)&&!inside(chest,b));
 const head=segBlocked(pos,pivot,live),ch=segBlocked(pos,chest,live);
 let ins=false,near=1e9;for(const b of live){const q=boxDist(pos,b);if(q<=0.3)ins=true;if(q<near)near=q;}
 // near-lens clutter: 3×3 ray fan over the view (±60 % of the half-FOV), each ray ≤ nearM (never past her)
 const f=vnorm(vsub(chest,pos)),r=vnorm(vcross(f,[0,1,0])),u=vcross(r,f),tv=Math.tan(((raw.fovVerticalDeg??45)*Math.PI/180)/2)*0.6,th=tv*0.6;
 let hits=0;const reach=Math.min(o.nearM,vlen(vsub(chest,pos))-0.4);
 if(reach>0.05)for(const sx of [-1,0,1])for(const sy of [-1,0,1]){const dd=vnorm([f[0]+r[0]*sx*th+u[0]*sy*tv,f[1]+r[1]*sx*th+u[1]*sy*tv,f[2]+r[2]*sx*th+u[2]*sy*tv]);
  for(const b of live){const t=segEnter(pos,dd,reach,b,0);if(t!==null){hits++;break;}}}
 const clutter=hits/9;
 const cost=(head?o.wHead:0)+(ch?o.wChest:0)+(ins?o.wInside:0)+(near<o.clearM?o.wClear*(1-near/o.clearM):0)+o.wClutter*clutter*clutter*2+(belowFloor?o.wFloor:0)
  +o.wUp*Math.abs(p.up)+o.wSwing*Math.abs(p.swing)+o.wShare*(1-p.share);
 return {cost,head,chest:ch,inside:ins,clutter,belowFloor,position:pos};
}
export class LensGuard{
 private params:GuardParams={up:0,swing:0,share:1};private off:V3|null=null;private vel:V3=[0,0,0];private planIn=0;private offYaw:number|null=null;
 private herPrev:OccVec|null=null;private herVel:V3=[0,0,0];
 last:{eval:GuardEval;params:GuardParams}|null=null;
 reset(){this.params={up:0,swing:0,share:1};this.off=null;this.vel=[0,0,0];this.planIn=0;this.offYaw=null;this.herPrev=null;this.herVel=[0,0,0];this.last=null;}
 private plan(raw:OccPose,her:OccVec,boxes:readonly OccBox[],floorAt:((x:number,z:number)=>number|null)|undefined,o:typeof LENS_GUARD,holdYaw=false){
  const swings=holdYaw?[0]:o.swings;if(holdYaw&&this.params.swing!==0)this.params={...this.params,swing:0};
  const samples=o.lookAheadS.map(s=>{const dx:V3=[this.herVel[0]*s,this.herVel[1]*s,this.herVel[2]*s];
   return {her:[her[0]+dx[0],her[1]+dx[1],her[2]+dx[2]] as OccVec,raw:{position:[raw.position[0]+dx[0],raw.position[1]+dx[1],raw.position[2]+dx[2]] as OccVec,target:raw.target,fovVerticalDeg:raw.fovVerticalDeg}};});
  const score=(p:GuardParams)=>{let c=0;for(let i=0;i<samples.length;i++){const w=i===0?1:0.6/i;c+=w*guardEval(samples[i].raw,samples[i].her,boxes,p,floorAt,o).cost;}return c;};
  const cur=score(this.params),base=score({up:0,swing:0,share:1});
  let best=this.params,bestC=cur-o.hysteresis;
  if(base<=bestC+o.hysteresis*0.5){best={up:0,swing:0,share:1};bestC=base;}
  if(base>o.wUp*1e-3+0.5||cur>0.5)for(const up of o.ups)for(const swing of swings)for(const share of o.shares){
   const p={up,swing,share},lb=o.wUp*Math.abs(up)+o.wSwing*Math.abs(swing)+o.wShare*(1-share);if(lb*1.6>=bestC)continue;
   const c=score(p);if(c<bestC){bestC=c;best=p;}}
  this.params=best;
 }
 /** One-shot planned pose (no spring) for a held / blended-to lens: the reward follow close-up blends to this. */
 solveStatic(raw:OccPose,her:OccVec,boxes:readonly OccBox[],floorAt?:(x:number,z:number)=>number|null,o=LENS_GUARD):OccPose&{eval:GuardEval;params:GuardParams}{
  this.reset();this.herPrev=null;const R=vlen(vsub(raw.position,her))+o.nearM+o.clearM+2;const near=boxes.filter(b=>boxDist(her,b)<=R);
  this.plan(raw,her,near,floorAt,o);const ev=guardEval(raw,her,near,this.params,floorAt,o),pos=ev.position;
  const rd=vnorm(vsub(raw.target,raw.position)),dist=vlen(vsub([her[0],her[1]+o.chestM,her[2]],raw.position)),look:V3=[raw.position[0]+rd[0]*dist,raw.position[1]+rd[1]*dist,raw.position[2]+rd[2]*dist];
  const nd=vnorm(vsub(look,pos));const params={...this.params};this.reset();
  return {position:pos,target:[pos[0]+nd[0]*10,pos[1]+nd[1]*10,pos[2]+nd[2]*10],fovVerticalDeg:raw.fovVerticalDeg,eval:ev,params};
 }
 /** holdYaw (P0 drag-rotate): the player owns the yaw (orbit engaged) → no swing; crane / pull-in only.
  * While held, the spring offset turns with the raw lens's yaw around her, so a drag rotates it with the lens (never pulls the yaw back). */
 apply(raw0:OccPose,her:OccVec,boxes:readonly OccBox[],dt:number,floorAt?:(x:number,z:number)=>number|null,o=LENS_GUARD,holdYaw=false):OccPose&{eval:GuardEval;params:GuardParams}{
  const step=Math.max(0,Math.min(0.1,dt||0));
  // floor first, on the designed lens itself (continuous: her feet / the floor move smoothly), so the spring never fights it
  const f0=floorAt?floorAt(raw0.position[0],raw0.position[2]):null,minY0=Math.max(her[1]+o.feetHeadroomM,f0===null?-1e9:f0+o.floorHeadroomM);
  const raw:OccPose=raw0.position[1]>=minY0?raw0:{position:[raw0.position[0],minY0,raw0.position[2]],target:[raw0.target[0],raw0.target[1]+(minY0-raw0.position[1]),raw0.target[2]],fovVerticalDeg:raw0.fovVerticalDeg};
  if(this.herPrev&&step>0){const k=1-Math.exp(-step/0.25);for(let i=0;i<3;i++)this.herVel[i]+=((her[i]-this.herPrev[i])/step-this.herVel[i])*k;}
  this.herPrev=[her[0],her[1],her[2]];
  const R=vlen(vsub(raw.position,her))+o.nearM+o.clearM+2;const near=boxes.filter(b=>boxDist(her,b)<=R);
  this.planIn-=step;if(this.off===null||this.planIn<=0||(holdYaw&&this.params.swing!==0)){this.plan(raw,her,near,floorAt,o,holdYaw);this.planIn=o.planS;}
  const ev=guardEval(raw,her,near,this.params,floorAt,o);
  // while the player holds the yaw, the offset turns with the raw lens around her (a drag rotates it exactly, never fights it)
  const ry=Math.atan2(raw.position[0]-her[0],raw.position[2]-her[2]);
  if(holdYaw&&this.off&&this.offYaw!==null){const d=ry-this.offYaw,c=Math.cos(d),sn=Math.sin(d),rot=(w:V3):V3=>[w[0]*c+w[2]*sn,w[1],-w[0]*sn+w[2]*c];this.off=rot(this.off);this.vel=rot(this.vel);}
  this.offYaw=ry;
  const want=vsub(ev.position,raw.position);
  if(this.off===null){this.off=[0,0,0];this.vel=[0,0,0];}
  else if(step>0){const w=o.omega;let a:V3=[0,0,0];for(let i=0;i<3;i++)a[i]=w*w*(want[i]-this.off[i])-2*w*this.vel[i];
   const al=vlen(a);if(al>o.maxAccMS2)a=[a[0]*o.maxAccMS2/al,a[1]*o.maxAccMS2/al,a[2]*o.maxAccMS2/al];
   for(let i=0;i<3;i++)this.vel[i]+=a[i]*step;const vl=vlen(this.vel);if(vl>o.maxMS)this.vel=[this.vel[0]*o.maxMS/vl,this.vel[1]*o.maxMS/vl,this.vel[2]*o.maxMS/vl];
   for(let i=0;i<3;i++)this.off[i]+=this.vel[i]*step;}
  let pos:V3=[raw.position[0]+this.off[0],raw.position[1]+this.off[1],raw.position[2]+this.off[2]];
  // hard floor backstop 0.25 m under the planned floor (the plan + the lifted raw keep it from binding in normal motion)
  const fl=floorAt?floorAt(pos[0],pos[2]):null,minY=Math.max(her[1]+o.feetHeadroomM-0.25,fl===null?-1e9:fl+o.floorHeadroomM-0.25);if(pos[1]<minY)pos=[pos[0],minY,pos[2]];
  // aim: the raw lens's look point at her distance
  const rd=vnorm(vsub(raw.target,raw.position)),dist=vlen(vsub([her[0],her[1]+o.chestM,her[2]],raw.position)),look:V3=[raw.position[0]+rd[0]*dist,raw.position[1]+rd[1]*dist,raw.position[2]+rd[2]*dist];
  const nd=vnorm(vsub(look,pos));this.last={eval:ev,params:{...this.params}};
  return {position:pos,target:[pos[0]+nd[0]*10,pos[1]+nd[1]*10,pos[2]+nd[2]*10],fovVerticalDeg:raw.fovVerticalDeg,eval:ev,params:{...this.params}};
 }
}
