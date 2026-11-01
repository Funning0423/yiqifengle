'use strict';
/**
 * b20 exact clearance (场景设计部): horizontal (XZ) distance from the walked path (its straight segments, not samples) to mesh triangles,
 * each triangle first clipped to a height band [lo, hi] (Sutherland-Hodgman on horizontal planes), then projected to XZ.
 * distance(segment, polygon) = 0 when they overlap, else the min over polygon edges of segment-segment distance. Exact for the
 * piecewise-linear path the walker follows.
 */
const clipBand=(P,lo,hi)=>{const cut=(P,y,keepAbove)=>{const o=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],ia=keepAbove?a[1]>=y:a[1]<=y,ib=keepAbove?b[1]>=y:b[1]<=y;
  if(ia)o.push(a);if(ia!==ib){const t=(y-a[1])/(b[1]-a[1]);o.push([a[0]+(b[0]-a[0])*t,y,a[2]+(b[2]-a[2])*t]);}}return o;};
 let o=P;if(lo!=null)o=cut(o,lo,true);if(o.length&&hi!=null)o=cut(o,hi,false);return o;};
const cross=(ax,az,bx,bz,cx,cz)=>(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
const segPt=(ax,az,bx,bz,px,pz)=>{const dx=bx-ax,dz=bz-az,L=dx*dx+dz*dz;let t=L?((px-ax)*dx+(pz-az)*dz)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(ax+dx*t-px,az+dz*t-pz);};
const segSeg=(a,b,c,d)=>{const d1=cross(a[0],a[1],b[0],b[1],c[0],c[1]),d2=cross(a[0],a[1],b[0],b[1],d[0],d[1]),d3=cross(c[0],c[1],d[0],d[1],a[0],a[1]),d4=cross(c[0],c[1],d[0],d[1],b[0],b[1]);
 if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0)))return 0;
 return Math.min(segPt(a[0],a[1],b[0],b[1],c[0],c[1]),segPt(a[0],a[1],b[0],b[1],d[0],d[1]),segPt(c[0],c[1],d[0],d[1],a[0],a[1]),segPt(c[0],c[1],d[0],d[1],b[0],b[1]));};
const inPoly=(p,Q)=>{let s=0;for(let i=0;i<Q.length;i++){const a=Q[i],b=Q[(i+1)%Q.length],c=cross(a[0],a[1],b[0],b[1],p[0],p[1]);if(Math.abs(c)<1e-12)continue;const sg=c>0?1:-1;if(!s)s=sg;else if(s!==sg)return false;}return true;};
/** a,b: [x,z]; Q: convex XZ polygon [[x,z],...] */
const segPoly=(a,b,Q)=>{if(Q.length===1)return segPt(a[0],a[1],b[0],b[1],Q[0][0],Q[0][1]);if(Q.length>=3&&(inPoly(a,Q)||inPoly(b,Q)))return 0;let m=1e9;for(let i=0;i<Q.length;i++){const d=segSeg(a,b,Q[i],Q[(i+1)%Q.length]);if(d<m)m=d;if(!m)break;}return m;};
/** Index of triangles: items {v:[9 numbers], tag, band:(segYlo,segYhi,tri)=>[lo,hi]|null } in a 0.5 m XZ grid by bbox. */
function index(items){const B=.5,G=new Map();items.forEach((it,i)=>{const v=it.v;const xs=[v[0],v[3],v[6]],zs=[v[2],v[5],v[8]];it.bb=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
  for(let x=Math.floor(it.bb[0]/B);x<=Math.floor(it.bb[2]/B);x++)for(let z=Math.floor(it.bb[1]/B);z<=Math.floor(it.bb[3]/B);z++){const k=x+','+z;if(!G.has(k))G.set(k,[]);G.get(k).push(i);}});return {B,G,items};}
/** min distance from path polyline p ([[x,y,z],...]) to indexed triangles within search radius R; band(it, yA, yB) -> [lo,hi] (null = unbounded) */
function minDist(I,p,R,band,filter){let m={d:99};for(let s=1;s<p.length;s++){const A=p[s-1],Bp=p[s];const x0=Math.min(A[0],Bp[0])-R,x1=Math.max(A[0],Bp[0])+R,z0=Math.min(A[2],Bp[2])-R,z1=Math.max(A[2],Bp[2])+R;const seen=new Set();
  for(let x=Math.floor(x0/I.B);x<=Math.floor(x1/I.B);x++)for(let z=Math.floor(z0/I.B);z<=Math.floor(z1/I.B);z++){const L=I.G.get(x+','+z);if(!L)continue;for(const i of L){if(seen.has(i))continue;seen.add(i);const it=I.items[i];if(filter&&!filter(it))continue;
   if(it.bb[0]>x1||it.bb[2]<x0||it.bb[1]>z1||it.bb[3]<z0)continue;const [lo,hi]=band(it,A[1],Bp[1]);const v=it.v;const P=clipBand([[v[0],v[1],v[2]],[v[3],v[4],v[5]],[v[6],v[7],v[8]]],lo,hi);if(!P.length)continue;
   const d=segPoly([A[0],A[2]],[Bp[0],Bp[2]],P.map(q=>[q[0],q[2]]));if(d<m.d){const t=it;m={d,seg:s,at:[+((A[0]+Bp[0])/2).toFixed(2),+((A[2]+Bp[2])/2).toFixed(2)],who:t.tag,top:+Math.max(v[1],v[4],v[7]).toFixed(3)};}}}}return m;}
module.exports={clipBand,segPoly,index,minDist};
