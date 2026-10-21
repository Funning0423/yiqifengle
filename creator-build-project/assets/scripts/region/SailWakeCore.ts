/**
 * Stern wake trail for the sail transit (r5 S1). Pure math, no `cc` import, so node tests run it as-is.
 * The trail is a world-space history of the stern (wake_root). Every frame the newest point is pinned to the
 * stern; a new point is laid every SAIL_WAKE.spacingM. Three ribbons are built along that history:
 *   - a centre wash (prop/turbulence), wide-ish and short-lived;
 *   - two Kelvin-style arms that open at armDeg from the stern and fade out over armM.
 * Alpha = emission speed × distance fade × age fade, so the wake shortens and dissolves as the boat slows or stops.
 * Foam UV v runs on the cumulative path distance, so the texture stays put on the water (no swimming, no flicker).
 * No Math.random, no Map/Set: loose-ES5 safe, deterministic for the QA capture.
 */
export const SAIL_WAKE={
 maxPoints:44,          // 44 × 0.6 m ≈ 26 m of history
 spacingM:0.6,
 cruiseMps:4.4,
 speedLo:0.35, speedHi:3.2,  // emission ramps in between (m/s)
 ageS:7.5,                   // a stopped boat's wake is gone after this
 washM:16, washHold:0.12, washHalf0:0.42, washGrow:0.075, washPeak:0.55,
 armM:24, armHold:0.35, armDeg:17, armOff0:0.62, armMaxOff:5.2, armHalf0:0.16, armGrow:0.032, armPeak:0.7,
 inM:0.7,                    // soft start just behind the transom
 vPerM:1/7,                  // foam texture repeats every 7 m along the path
 lift:0.05,                  // above SAIL_SEA_Y; hull_foam_ring sits at 0.02
 jumpM:4,                    // teleport guard: reset the history
 nightFadeS:0.5,
 day:[238,246,252] as [number,number,number],
 night:[160,186,218] as [number,number,number],
 nightAlpha:0.78,
} as const;
export type WakePoint={x:number;z:number;fx:number;fz:number;s:number;age:number;k:number};
export type WakeTrail={pts:WakePoint[];total:number;night:number;synced:boolean};
export function createWakeTrail():WakeTrail{return {pts:[],total:0,night:0,synced:false};}
function clamp01(v:number){return v<0?0:v>1?1:v;}
function smooth(e0:number,e1:number,x:number){const t=clamp01((x-e0)/(e1-e0));return t*t*(3-2*t);}
export function wakeEmission(speed:number):number{return smooth(SAIL_WAKE.speedLo,SAIL_WAKE.speedHi,Math.abs(speed));}
/** Advance the history. stern = wake_root world position (x,z); (fx,fz) = boat forward on the water; speed in m/s. */
export function stepWakeTrail(tr:WakeTrail,sx:number,sz:number,fx:number,fz:number,speed:number,dt:number,night:boolean):void{
 const fl=Math.sqrt(fx*fx+fz*fz);if(fl>1e-6){fx/=fl;fz/=fl;}else{fx=0;fz=1;}
 const step=dt>0&&isFinite(dt)?Math.min(dt,0.1):0;
 const target=night?1:0;
 if(!tr.synced){tr.night=target;tr.synced=true;}
 else{const d=step/SAIL_WAKE.nightFadeS;tr.night=tr.night<target?Math.min(target,tr.night+d):Math.max(target,tr.night-d);}
 const k=wakeEmission(speed);
 const pts=tr.pts;
 for(let i=0;i<pts.length;i++)pts[i].age+=step;
 if(pts.length){
  const h=pts[0],moved=Math.sqrt((sx-h.x)*(sx-h.x)+(sz-h.z)*(sz-h.z));
  if(moved>SAIL_WAKE.jumpM+Math.abs(speed)*step*2){pts.length=0;tr.total=0;}
 }
 if(!pts.length){pts.push({x:sx,z:sz,fx:fx,fz:fz,s:0,age:0,k:k},{x:sx,z:sz,fx:fx,fz:fz,s:0,age:0,k:k});return;}
 // pts[0] is the live stern; pts[1] is the last laid point.
 const head=pts[0],laid=pts[1];
 const d=Math.sqrt((sx-laid.x)*(sx-laid.x)+(sz-laid.z)*(sz-laid.z));
 if(d>=SAIL_WAKE.spacingM){
  pts.splice(1,0,{x:sx,z:sz,fx:fx,fz:fz,s:laid.s+d,age:0,k:k});
  if(pts.length>SAIL_WAKE.maxPoints)pts.length=SAIL_WAKE.maxPoints;
 }
 const ref=pts[1];
 head.x=sx;head.z=sz;head.fx=fx;head.fz=fz;head.age=0;head.k=k;
 head.s=ref.s+Math.sqrt((sx-ref.x)*(sx-ref.x)+(sz-ref.z)*(sz-ref.z));
 tr.total=head.s;
}
export const WAKE_RIBBONS=3;
export function wakeVertexCount(){return SAIL_WAKE.maxPoints*2*WAKE_RIBBONS;}
export function wakeIndexCount(){return (SAIL_WAKE.maxPoints-1)*6*WAKE_RIBBONS;}
export type WakeBuffers={positions:Float32Array;uvs:Float32Array;colors:Float32Array;indices:Uint16Array;min:number[];max:number[]};
export function createWakeBuffers():WakeBuffers{
 const nv=wakeVertexCount(),ni=wakeIndexCount(),idx=new Uint16Array(ni),N=SAIL_WAKE.maxPoints;
 let o=0;
 for(let r=0;r<WAKE_RIBBONS;r++){
  const base=r*N*2;
  for(let i=0;i<N-1;i++){
   const a=base+i*2,b=a+1,c=a+2,d=a+3;
   idx[o++]=a;idx[o++]=c;idx[o++]=b;idx[o++]=b;idx[o++]=c;idx[o++]=d;
  }
 }
 return {positions:new Float32Array(nv*3),uvs:new Float32Array(nv*2),colors:new Float32Array(nv*4),indices:idx,min:[0,0,0],max:[0,0,0]};
}
/** Fade along the trail: 0 at the transom, 1 after inM, held until `hold`·len, then a smooth tail to 0 at len. */
function along(dist:number,len:number,hold:number){
 if(dist>=len)return 0;
 return smooth(0,SAIL_WAKE.inM,dist)*(1-smooth(hold,1,dist/len));
}
function ageFade(age:number){return 1-smooth(SAIL_WAKE.ageS*0.45,SAIL_WAKE.ageS,age);}
/** Fill the vertex buffers. Returns the brightest vertex alpha (before the material colour), for QA. */
export function buildWakeGeometry(tr:WakeTrail,y:number,out:WakeBuffers):number{
 const N=SAIL_WAKE.maxPoints,pts=tr.pts,n=pts.length,P=out.positions,U=out.uvs,C=out.colors;
 const tanA=Math.tan(SAIL_WAKE.armDeg*Math.PI/180);
 let peak=0,mnx=1e9,mnz=1e9,mxx=-1e9,mxz=-1e9;
 const night=tr.night,nA=1+(SAIL_WAKE.nightAlpha-1)*night;
 const cr=(SAIL_WAKE.day[0]+(SAIL_WAKE.night[0]-SAIL_WAKE.day[0])*night)/255;
 const cg=(SAIL_WAKE.day[1]+(SAIL_WAKE.night[1]-SAIL_WAKE.day[1])*night)/255;
 const cb=(SAIL_WAKE.day[2]+(SAIL_WAKE.night[2]-SAIL_WAKE.day[2])*night)/255;
 for(let r=0;r<WAKE_RIBBONS;r++){
  const base=r*N*2;
  for(let i=0;i<N;i++){
   const j=i<n?i:n-1;
   let x=0,z=0,nx=1,nz=0,dist=0,a=0,s=0;
   if(j>=0){
    const p=pts[j];x=p.x;z=p.z;s=p.s;dist=pts[0].s-p.s;
    // Ribbon side = boat heading when this point was laid (robust when the stern sits on the last laid point).
    nx=p.fz;nz=-p.fx;
    const k=p.k*ageFade(p.age);
    if(r===0)a=SAIL_WAKE.washPeak*k*along(dist,SAIL_WAKE.washM,SAIL_WAKE.washHold);
    else a=SAIL_WAKE.armPeak*k*along(dist,SAIL_WAKE.armM,SAIL_WAKE.armHold);
    if(i>=n-1)a=0;            // the oldest point and the unused tail always close at zero
   }
   let off=0,half=0;
   if(r===0){half=SAIL_WAKE.washHalf0+dist*SAIL_WAKE.washGrow;}
   else{
    off=Math.min(SAIL_WAKE.armMaxOff,SAIL_WAKE.armOff0+dist*tanA)*(r===1?1:-1);
    half=SAIL_WAKE.armHalf0+dist*SAIL_WAKE.armGrow;
   }
   a*=nA;if(a>peak)peak=a;
   const lx=x+nx*(off-half),lz=z+nz*(off-half),rx=x+nx*(off+half),rz=z+nz*(off+half);
   const v0=base+i*2,v1=v0+1;
   P[v0*3]=lx;P[v0*3+1]=y;P[v0*3+2]=lz;P[v1*3]=rx;P[v1*3+1]=y;P[v1*3+2]=rz;
   // foam_strip: u runs along the strip (repeat), v across it.
   const u=s*SAIL_WAKE.vPerM+r*0.37;
   U[v0*2]=u;U[v0*2+1]=0.04;U[v1*2]=u;U[v1*2+1]=0.96;
   C[v0*4]=cr;C[v0*4+1]=cg;C[v0*4+2]=cb;C[v0*4+3]=a;
   C[v1*4]=cr;C[v1*4+1]=cg;C[v1*4+2]=cb;C[v1*4+3]=a;
   if(j>=0){
    mnx=Math.min(mnx,lx,rx);mxx=Math.max(mxx,lx,rx);mnz=Math.min(mnz,lz,rz);mxz=Math.max(mxz,lz,rz);
   }
  }
 }
 if(mnx>mxx){mnx=mxx=mnz=mxz=0;}
 out.min[0]=mnx;out.min[1]=y-0.01;out.min[2]=mnz;out.max[0]=mxx;out.max[1]=y+0.01;out.max[2]=mxz;
 return peak;
}
/** hull_foam_ring tint: stays white by day (unchanged look), eases to the wake's night foam with the same weight. */
export function hullFoamTint(night:number):[number,number,number]{
 const w=clamp01(night);
 return [Math.round(255+(SAIL_WAKE.night[0]-255)*w),Math.round(255+(SAIL_WAKE.night[1]-255)*w),Math.round(255+(SAIL_WAKE.night[2]-255)*w)];
}
/** Visible ribbon length for QA: the farthest distance along the trail whose arm alpha is still ≥ 0.05. */
export function wakeVisibleM(tr:WakeTrail):number{
 const pts=tr.pts;if(pts.length<2)return 0;
 let best=0;
 for(let i=0;i<pts.length-1;i++){
  const p=pts[i],dist=pts[0].s-p.s;
  const a=SAIL_WAKE.armPeak*p.k*ageFade(p.age)*along(dist,SAIL_WAKE.armM,SAIL_WAKE.armHold);
  if(a>=0.05&&dist>best)best=dist;
 }
 return best;
}
