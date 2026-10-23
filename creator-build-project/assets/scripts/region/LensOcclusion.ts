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
