'use strict';
/* Screen-space framing metrics for the journey lens (v3). Pure geometry: a BVH over the real region triangles, a grid of
 * camera rays per portrait frame (390×844, vertical FOV), and projections of the character and plaza. Not a renderer. */
const ASPECT=390/844,SEA_Y=-0.918;
function buildBvh(objs){const tris=[],tag=[];for(const o of objs){const t=o.tris;for(let k=0;k<t.length;k+=9){tris.push(t.subarray?t.subarray(k,k+9):t.slice(k,k+9));tag.push(o);}}
 const n=tris.length,cx=new Float64Array(n*3),lo=new Float64Array(n*3),hi=new Float64Array(n*3);
 for(let i=0;i<n;i++){const t=tris[i];for(let c=0;c<3;c++){const a=t[c],b=t[c+3],d=t[c+6];lo[i*3+c]=Math.min(a,b,d);hi[i*3+c]=Math.max(a,b,d);cx[i*3+c]=(a+b+d)/3;}}
 const idx=Int32Array.from({length:n},(_,i)=>i),nodes=[];
 function make(s,e){const node={lo:[1e9,1e9,1e9],hi:[-1e9,-1e9,-1e9],s,e,l:null,r:null};for(let k=s;k<e;k++){const i=idx[k];for(let c=0;c<3;c++){if(lo[i*3+c]<node.lo[c])node.lo[c]=lo[i*3+c];if(hi[i*3+c]>node.hi[c])node.hi[c]=hi[i*3+c];}}
  if(e-s>8){let ax=0,ext=-1;for(let c=0;c<3;c++)if(node.hi[c]-node.lo[c]>ext){ext=node.hi[c]-node.lo[c];ax=c;}
   const sub=Array.from(idx.subarray(s,e)).sort((a,b)=>cx[a*3+ax]-cx[b*3+ax]);idx.set(sub,s);const m=(s+e)>>1;node.l=make(s,m);node.r=make(m,e);}
  return node;}
 const root=n?make(0,n):null;return {root,tris,tag,idx};}
function boxT(o,inv,lo,hi,maxT){let t0=0,t1=maxT;for(let c=0;c<3;c++){let a=(lo[c]-o[c])*inv[c],b=(hi[c]-o[c])*inv[c];if(a>b){const x=a;a=b;b=x;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return false;}return true;}
function triT(o,d,t){const ax=t[0],ay=t[1],az=t[2],e1x=t[3]-ax,e1y=t[4]-ay,e1z=t[5]-az,e2x=t[6]-ax,e2y=t[7]-ay,e2z=t[8]-az,px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-12)return -1;const iv=1/det,tx=o[0]-ax,ty=o[1]-ay,tz=o[2]-az,u=(tx*px+ty*py+tz*pz)*iv;if(u<0||u>1)return -1;const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(d[0]*qx+d[1]*qy+d[2]*qz)*iv;if(v<0||u+v>1)return -1;const s=(e2x*qx+e2y*qy+e2z*qz)*iv;return s>1e-4?s:-1;}
function cast(bvh,o,d,maxT=600){if(!bvh.root)return null;const inv=d.map(x=>1/(Math.abs(x)<1e-12?1e-12:x));let best=maxT,hit=-1;const st=[bvh.root];
 while(st.length){const n=st.pop();if(!boxT(o,inv,n.lo,n.hi,best))continue;if(n.l){st.push(n.l,n.r);continue;}for(let k=n.s;k<n.e;k++){const i=bvh.idx[k],s=triT(o,d,bvh.tris[i]);if(s>0&&s<best){best=s;hit=i;}}}
 if(hit<0)return null;const t=bvh.tris[hit],e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],nn=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],l=Math.hypot(...nn)||1;
 let nrm=nn.map(x=>x/l);if(nrm[0]*d[0]+nrm[1]*d[1]+nrm[2]*d[2]>0)nrm=nrm.map(x=>-x);// face toward the camera (double sided)
 return {t:best,obj:bvh.tag[hit],normal:nrm};}
function basis(pose){const f=[pose.target[0]-pose.position[0],pose.target[1]-pose.position[1],pose.target[2]-pose.position[2]],fl=Math.hypot(...f),fw=f.map(x=>x/fl),rl=Math.hypot(fw[2],fw[0])||1,r=[-fw[2]/rl,0,fw[0]/rl],up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]];
 return {fw,r,up,th:Math.tan(pose.fovVerticalDeg*Math.PI/360)};}
/** NDC of a world point: x right, y up, z = view depth (m). */
function ndc(pose,p){const {fw,r,up,th}=basis(pose),v=[p[0]-pose.position[0],p[1]-pose.position[1],p[2]-pose.position[2]],z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2];
 return [(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*ASPECT),(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th),z];}
/** Ray grid classification. underside = hit on a sky-island mass whose camera-facing normal points down (ny < -0.35);
 * sky = ray escapes upward (night dome); sea = escapes downward. */
function coverage(pose,bvh,isMass,cols=13,rows=28){const {fw,r,up,th}=basis(pose);let under=0,sky=0,sea=0,n=0,underUL=0;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=((i+.5)/cols*2-1)*th*ASPECT,y=((j+.5)/rows*2-1)*th,d=[fw[0]+r[0]*x+up[0]*y,fw[1]+r[1]*x+up[1]*y,fw[2]+r[2]*x+up[2]*y],l=Math.hypot(...d),u=d.map(v=>v/l);n++;
  const h=cast(bvh,pose.position,u);if(!h){if(u[1]>0)sky++;else sea++;continue;}if(isMass(h.obj)&&h.normal[1]<-.35){under++;if(i<cols/2&&j>=rows/2)underUL++;}}
 return {underside:under/n,sky:sky/n,sea:sea/n,undersideUpperLeft:underUL/n};}
const angle=(a,b)=>{const d=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]));return Math.acos(d)*180/Math.PI;};
const dir=p=>{const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(...f);return f.map(x=>x/l);};
/** Character body in frame: feet (0.05 m) and head top (1.65 m) both inside |x|,|y| ≤ lim; height = screen fraction. */
function body(pose,root,lim=.85){const f=ndc(pose,[root[0],root[1]+.05,root[2]]),h=ndc(pose,[root[0],root[1]+1.65,root[2]]),c=ndc(pose,[root[0],root[1]+.9,root[2]]);
 const inFrame=[f,h].every(([x,y,z])=>z>0&&Math.abs(x)<=lim&&Math.abs(y)<=lim);return {inFrame,feet:f,head:h,chest:c,height:(h[1]-f[1])/2};}
module.exports={ASPECT,SEA_Y,buildBvh,cast,ndc,coverage,angle,dir,body,basis};
