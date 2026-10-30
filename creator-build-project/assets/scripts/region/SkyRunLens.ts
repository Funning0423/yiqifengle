import {SKY_RAILS,SKY_JOINS} from './SkyFinaleRail';
import {mmDecode} from './SkyResumeLens';
import {SKY_FINALE_POSE_LOCAL} from './SkyFinaleShot';
type V3=[number,number,number];type Run={P:number[][];c:number[];K:number[][]};
export type RailPose={position:V3;target:V3;fovVerticalDeg:number};
export const SKY_RAIL_APPROACH_M=1.05;
const C:Record<string,Run[]>={};
const grp=(a:number[],n:number)=>{const o:number[][]=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;};
const len=(P:number[][],y=0)=>{const c=[0];for(let i=1;i<P.length;i++)c.push(c[i-1]+Math.hypot(P[i][0]-P[i-1][0],(P[i][1]-P[i-1][1])*y,P[i][2]-P[i-1][2]));return c;};
function runs(w:string):Run[]{return C[w]||(C[w]=(SKY_RAILS[w]||[]).map(r=>{const P=grp(mmDecode(r.p),3);return {P,c:len(P),K:grp(mmDecode(r.k),4)};}));}
export function skyRailHas(w:string):boolean{return runs(w).length>0;}
const ss=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(t*(t*6-15)+10);};
const unit=(a:readonly number[],b:readonly number[])=>{const v=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],n=Math.hypot(v[0],v[1],v[2])||1;return v.map(x=>x/n);};
const mix=(a:readonly number[],b:readonly number[],u:number)=>[0,1,2].map(i=>a[i]+(b[i]-a[i])*u) as V3;
export function skyRailPose(w:string,h:readonly number[]):RailPose|null{const R=runs(w);if(!R.length)return null;let best={r:0,s:0,e:Infinity};
 R.forEach((q,r)=>{for(let i=1;i<q.P.length;i++){const a=q.P[i-1],b=q.P[i],dx=b[0]-a[0],dz=b[2]-a[2],l2=dx*dx+dz*dz||1,u=Math.max(0,Math.min(1,((h[0]-a[0])*dx+(h[2]-a[2])*dz)/l2)),
  e=Math.hypot(h[0]-a[0]-dx*u,h[1]-a[1]-(b[1]-a[1])*u,h[2]-a[2]-dz*u);if(e<best.e)best={r,s:q.c[i-1]+(q.c[i]-q.c[i-1])*u,e};}});
 const q=R[best.r],K=q.K,s=best.s;let k=0;while(k<K.length-2&&K[k+1][0]<s)k++;const u=Math.max(0,Math.min(1,(s-K[k][0])/((K[k+1][0]-K[k][0])||1)));
 const P=mix(K[k].slice(1),K[k+1].slice(1),u),T=SKY_FINALE_POSE_LOCAL,e=w==='S4>S6'&&best.r===R.length-1?ss((s-(q.c[q.c.length-1]-SKY_RAIL_APPROACH_M))/SKY_RAIL_APPROACH_M):0;
 const d0=unit(P,[h[0],h[1]+1.3,h[2]]),d1=unit(T.position,T.target),w0=Math.acos(Math.max(-1,Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2])));
 const D=w0<1e-4?d1:d0.map((x,i)=>(x*Math.sin((1-e)*w0)+d1[i]*Math.sin(e*w0))/Math.sin(w0));
 return {position:P,target:[P[0]+D[0]*8,P[1]+D[1]*8,P[2]+D[2]*8],fovVerticalDeg:48+(T.fovVerticalDeg-48)*e};}
export type RailJoin={P:number[][];c:number[];a:RailPose;b:RailPose;T:number};
export function skyRailJoinPlan(w:string,a:RailPose,b:RailPose,out=false):RailJoin|null{const j=SKY_JOINS[w],s=j&&(out?j.o:j.i);if(!s)return null;
 const P=[a.position.slice(),...grp(mmDecode(s),3),b.position.slice()],c=len(P,1);return {P,c,a,b,T:Math.max(.6,c[c.length-1]/4)};}
export function skyRailJoin(j:RailJoin,x:number):RailPose{const e=ss(x),L=j.c[j.c.length-1]*e;let i=1;while(i<j.P.length-1&&j.c[i]<L)i++;
 const p=mix(j.P[i-1],j.P[i],Math.max(0,Math.min(1,(L-j.c[i-1])/((j.c[i]-j.c[i-1])||1)))),d=mix(unit(j.a.position,j.a.target),unit(j.b.position,j.b.target),e),n=Math.hypot(d[0],d[1],d[2])||1;
 return {position:p,target:[p[0]+d[0]/n*8,p[1]+d[1]/n*8,p[2]+d[2]/n*8],fovVerticalDeg:j.a.fovVerticalDeg+(j.b.fovVerticalDeg-j.a.fovVerticalDeg)*e};}
