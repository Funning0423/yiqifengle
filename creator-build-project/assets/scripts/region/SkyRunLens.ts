import {SKY_RAILS,SKY_JOINS} from './SkyFinaleRail';
import {mmDecode} from './SkyResumeLens';
import {SKY_FINALE_POSE_LOCAL as F} from './SkyFinaleShot';
import {planWalk} from './NodeWalker';
type V=number[];type Run={P:V[];c:V;K:V[]};export type RailPose={position:V;target:V;fovVerticalDeg:number};
export const SKY_RAIL_APPROACH_M=1.05;
const C:Record<string,Run[]>={},M=Math,cm=(s:string)=>mmDecode(s).map(v=>v*10),cl=(x:number)=>M.max(0,M.min(1,x)),
grp=(a:V,n:number)=>{const o:V[]=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;},
len=(P:V[],y=0)=>{const c=[0];for(let i=1;i<P.length;i++)c.push(c[i-1]+M.hypot(P[i][0]-P[i-1][0],(P[i][1]-P[i-1][1])*y,P[i][2]-P[i-1][2]));return c;},
ss=(x:number)=>{const t=cl(x);return t*t*t*(t*(t*6-15)+10);},mix=(a:V,b:V,u:number)=>a.map((v,i)=>v+(b[i]-v)*u),
at=(P:V[],c:V,L:number)=>{let i=1;while(i<P.length-1&&c[i]<L)i++;return mix(P[i-1],P[i],cl((L-c[i-1])/((c[i]-c[i-1])||1)));},
look=(p:V,d:V,f:number):RailPose=>{const n=M.hypot(d[0],d[1],d[2])||1;return {position:p,target:p.map((v,i)=>v+d[i]/n*8),fovVerticalDeg:f};},
sub=(b:V,a:V)=>b.map((v,i)=>v-a[i]),un=(v:V)=>{const n=M.hypot(v[0],v[1],v[2])||1;return v.map(x=>x/n);},chest=(h:V)=>[h[0],h[1]+1.3,h[2]];
function runs(w:string):Run[]{const k=SKY_RAILS[w];if(!k)return [];const [a,b]=w.split('>'),S=planWalk('skycity',a,b).segments;return C[w]||(C[w]=k.map((r,i)=>{const P=S[i].path.map(p=>[p[0],p[1],p[2]]);return {P,c:len(P),K:grp(cm(r),4)};}));}
export const skyRailHas=(w:string)=>runs(w).length>0;
function rail(w:string,h:V){const R=runs(w);if(!R.length)return null;let r=0,s=0,e=1/0;
 R.forEach((q,j)=>{for(let i=1;i<q.P.length;i++){const a=q.P[i-1],b=q.P[i],d=sub(b,a),u=cl(((h[0]-a[0])*d[0]+(h[2]-a[2])*d[2])/(d[0]*d[0]+d[2]*d[2]||1)),x=M.hypot(...sub(h,mix(a,b,u)));if(x<e){e=x;r=j;s=q.c[i-1]+(q.c[i]-q.c[i-1])*u;}}});
 const q=R[r],K=q.K,L=q.c[q.c.length-1];let k=0;while(k<K.length-2&&K[k+1][0]<s)k++;
 const g=w=='S4>S6'&&r==R.length-1?ss((s-L+SKY_RAIL_APPROACH_M)/SKY_RAIL_APPROACH_M):0,P=g>.999?F.position.slice():mix(K[k].slice(1),K[k+1].slice(1),cl((s-K[k][0])/((K[k+1][0]-K[k][0])||1)));
 return {p:look(P,mix(un(sub(chest(h),P)),un(sub(F.target,F.position)),g),48+(F.fovVerticalDeg-48)*g),r,left:(L-s)/1.2};}
export const skyRailPose=(w:string,h:V)=>rail(w,h)?.p??null;
export type RailJoin={P:V[];c:V;a:RailPose;b:RailPose;T:number};
export function skyRailJoinPlan(w:string,a:RailPose,b:RailPose,out=false):RailJoin|null{const j=SKY_JOINS[w],s=j&&(out?j.o:j.i);if(!s)return null;
 const P=[a.position,...grp(cm(s),3),b.position],c=len(P,1);return {P,c,a,b,T:M.max(.6,c[c.length-1]/4)};}
export function skyRailJoin(j:RailJoin,x:number,h?:V):RailPose{const e=ss(x),D=(p:RailPose)=>un(sub(p.target,p.position)),p=at(j.P,j.c,j.c[j.c.length-1]*e),u=M.min(.4,.6/j.T),wa=1-ss(x/u),wb=ss((x-1+u)/u),H=h?un(sub(chest(h),p)):mix(D(j.a),D(j.b),e);
 return look(p,mix(mix(H,D(j.a),wa),D(j.b),wb),j.a.fovVerticalDeg+(j.b.fovVerticalDeg-j.a.fovVerticalDeg)*e);}
export function skyRailFollow(w:string){let r=-1,q:RailPose|null=null,h0:V=[],j:{P:V[];c:V;e:V;A:V;T:number;U:number}|null=null,t=0;
 return (h:V,dt:number)=>{const x=rail(w,h);if(!x)return null;
  if(!j&&q&&(x.r!=r||M.hypot(...sub(x.p.position,q.position))>.6)){const m=x.r==r+1&&SKY_JOINS[w]?.m,P=[q.position,...(m?grp(cm(m),3):[]),x.p.position],c=len(P,1);j={P,c,e:x.p.position,A:chest(h0),T:M.max(.6,M.min(c[c.length-1]/4,M.max(x.left-1,1.5))),U:M.max(.3,M.acos(M.max(-1,M.min(1,un(sub(chest(h0),q.position)).reduce((a,v,i)=>a+v*un(sub(chest(h),q.position))[i],0))))*.54)};t=0;}
  r=x.r;h0=h;if(j){t+=dt;const e=ss(t/j.T);if(e<1){const J=j,p=at(J.P,J.c,J.c[J.c.length-1]*e).map((v,i)=>v+(x.p.position[i]-J.e[i])*e);return q=look(p,sub(mix(J.A,mix(chest(h),x.p.target,e),ss(t/J.U)),p),x.p.fovVerticalDeg);}j=null;}
  return q=x.p;};}
