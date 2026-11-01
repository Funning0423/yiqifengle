/** p0drag7 (Mac p0drag6 trace_lake_walkdrag 203.6 / 205.7 / 207.9 s: the written orbit arm flipped 9.1 ↔ 5.7 m in ONE frame, standing,
 *  as FreeOrbit.clearPose's renderer-AABB pull-in switched on/off with the dragged yaw). The arm the stage writes goes through:
 *  hysteresis — a new goal more than `bandM` from the current one must persist `holdN` frames (pull-in) and, for a push-out, the last
 *  switch must be ≥ `dwellS` old; then a critically damped spring (ω) with a rate limit (in / out m/s). Small changes track directly. */
export const ARM_SMOOTH=Object.freeze({bandM:0.35,holdN:4,dwellS:0.45,omega:7,inMS:6,outMS:3});
export class ArmSmoother{
 private a:number|null=null;private v=0;private goal=0;private cand:number|null=null;private n=0;private since=1e9;
 clear():void{this.a=null;this.v=0;this.cand=null;this.n=0;this.since=1e9;}
 /** Snap to `arm` (entry glide owns the lens). */
 reset(arm:number):void{this.a=arm;this.goal=arm;this.v=0;this.cand=null;this.n=0;}
 get arm():number|null{return this.a;}
 step(target:number,dt:number):number{
  const C=ARM_SMOOTH,t=Number.isFinite(dt)&&dt>0?Math.min(0.1,dt):0;
  if(this.a===null||!Number.isFinite(this.a)){this.reset(target);return target;}
  this.since+=t;
  if(Math.abs(target-this.goal)<=C.bandM){this.goal=target;this.cand=null;this.n=0;}
  else{
   if(this.cand!==null&&Math.abs(target-this.cand)<=C.bandM)this.n++;else{this.cand=target;this.n=1;}
   const pullIn=target<this.goal;
   if(this.n>=C.holdN&&(pullIn||this.since>=C.dwellS)){this.goal=target;this.cand=null;this.n=0;this.since=0;}
  }
  if(t<=0)return this.a;
  const w=C.omega,x=this.a-this.goal,acc=-w*w*x-2*w*this.v;this.v+=acc*t;
  const lim=this.v<0?C.inMS:C.outMS;if(this.v<-lim)this.v=-lim;if(this.v>lim)this.v=lim;
  let n=this.a+this.v*t;if((this.a-this.goal)*(n-this.goal)<0){n=this.goal;this.v=0;}
  this.a=n;return n;
 }
}
