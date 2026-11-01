import {SKY_RAILS as R,SKY_JOINS as J} from './SkyFinaleRail';
import {mmDecode} from './SkyResumeLens';
import {SKY_FINALE_POSE_LOCAL as F} from './SkyFinaleShot';
import {planWalk} from './NodeWalker';
export type RailPose={position:number[];target:number[];fovVerticalDeg:number};
const C={},f='fovVerticalDeg',M=Math,H=M.hypot,cl=x=>M.max(0,M.min(1,x)),ss=x=>(x=cl(x))*x*x*(x*(x*6-15)+10),
g=(s,n)=>{const a=mmDecode(s),o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n).map(v=>v*10));return o;},
len=(P,y=0)=>{const c=[0];for(let i=1;i<P.length;i++)c.push(c[i-1]+H(P[i][0]-P[i-1][0],(P[i][1]-P[i-1][1])*y,P[i][2]-P[i-1][2]));return c;},
mx=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u),sb=(b,a)=>b.map((v,i)=>v-a[i]),un=v=>{const n=H(v[0],v[1],v[2])||1;return v.map(x=>x/n);},
at=(P,c,e)=>{const L=c[c.length-1]*e;let i=1;while(i<P.length-1&&c[i]<L)i++;return mx(P[i-1],P[i],cl((L-c[i-1])/(c[i]-c[i-1]||1)));},
lk=(p,d,f):RailPose=>{const u=un(d);return {position:p,target:p.map((v,i)=>v+u[i]*8),fovVerticalDeg:f};},
ch=h=>[h[0],h[1]+1.3,h[2]],D=p=>un(sb(p.target,p.position)),
runs=w=>C[w]||(C[w]=(R[w]||[]).map((r,i)=>{const P=planWalk('skycity',w.slice(0,2),w.slice(3)).segments[i].path.map(p=>[p[0],p[1],p[2]]);return {P,c:len(P),K:g(r,4)};}));
function rail(w,h){const Q=runs(w);if(!Q.length)return null;let r=0,s=0,e=1/0;
 Q.forEach((q,j)=>{for(let i=1;i<q.P.length;i++){const a=q.P[i-1],b=q.P[i],d=sb(b,a),u=cl(((h[0]-a[0])*d[0]+(h[2]-a[2])*d[2])/(d[0]*d[0]+d[2]*d[2]||1)),x=H(...sb(h,mx(a,b,u)));if(x<e){e=x;r=j;s=q.c[i-1]+(q.c[i]-q.c[i-1])*u;}}});
 const {K,c}=Q[r],L=c[c.length-1];let k=0;while(k<K.length-2&&K[k+1][0]<s)k++;
 const G=w=='S4>S6'&&r==Q.length-1?ss((s-L)/1.05+1):0,P=G>.999?F.position.slice():mx(K[k].slice(1),K[k+1].slice(1),cl((s-K[k][0])/(K[k+1][0]-K[k][0]||1)));
 return {p:lk(P,mx(un(sb(ch(h),P)),D(F),G),48+(F[f]-48)*G),r,l:(L-s)/1.2};}
export const skyRailHas=w=>runs(w).length>0,skyRailPose=(w,h)=>rail(w,h)?.p??null;
export function skyRailJoinPlan(w,a,b,o=false){const s=J[w]?.[o?'o':'i'];if(!s)return null;const P=[a.position,...g(s,3),b.position],c=len(P,1);return {P,c,a,b,T:M.max(.6,c[c.length-1]/4)};}
export function skyRailJoin(j,x,h?){const e=ss(x),p=at(j.P,j.c,e),u=M.min(.4,.6/j.T);
 return lk(p,mx(mx(h?un(sb(ch(h),p)):mx(D(j.a),D(j.b),e),D(j.a),1-ss(x/u)),D(j.b),ss((x-1+u)/u)),j.a[f]+(j.b[f]-j.a[f])*e);}
export function skyRailFollow(w){let r=-1,q,h0,j,t=0,Z=0;
 return (h,dt)=>{const x=rail(w,h);if(!x)return null;if(x.r!=r)Z=0;const S=Z?lk(F.position,D(F),F[f]):x.p,X=S.position;
  if(!j&&q&&(x.r!=r||H(...sb(X,q.position))>.6)){const k=x.r==r+1&&x.l<2&&J[w]?.k,m=k||x.r==r+1&&J[w]?.m;if(k)Z=1;const E=k?F.position:X,P=[q.position,...(m?g(m,3):[]),E],c=len(P,1),a=un(sb(ch(h0),q.position)),b=un(sb(ch(h),q.position));
   j={P,c,e:E,A:ch(h0),T:M.max(.6,M.min(c[c.length-1]/4,M.max(x.l-1,1.5))),U:M.max(.3,M.acos(M.max(-1,M.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))*.54)};t=0;}
  r=x.r;h0=h;const Y=Z?lk(F.position,D(F),F[f]):x.p,V=Y.position;if(j){t+=dt;const e=ss(t/j.T);if(e<1){const p=at(j.P,j.c,e).map((v,i)=>v+(V[i]-j.e[i])*e);return q=lk(p,sb(mx(j.A,mx(ch(h),Y.target,e),ss(t/j.U)),p),Y[f]+(Z?(x.p[f]-Y[f])*(1-e):0));}j=null;}
  return q=Y;};}
