'use strict';
// Flat triangle BVH (median split, leaf <= 4) with any-hit segment queries. Float64 throughout.
function build(tris){ // tris Float64Array [n*9]
 const n=tris.length/9,idx=new Uint32Array(n),cx=new Float64Array(n*3);for(let i=0;i<n;i++){idx[i]=i;for(let a=0;a<3;a++)cx[i*3+a]=(tris[i*9+a]+tris[i*9+3+a]+tris[i*9+6+a])/3;}
 const bmin=[],bmax=[],left=[],start=[],count=[];
 function node(s,e){const id=bmin.length;let mn=[1e30,1e30,1e30],mx=[-1e30,-1e30,-1e30];
  for(let k=s;k<e;k++){const t=idx[k]*9;for(let v=0;v<9;v+=3)for(let a=0;a<3;a++){const x=tris[t+v+a];if(x<mn[a])mn[a]=x;if(x>mx[a])mx[a]=x;}}
  bmin.push(mn);bmax.push(mx);left.push(-1);start.push(s);count.push(e-s);
  if(e-s<=4)return id;
  let cm=[1e30,1e30,1e30],cM=[-1e30,-1e30,-1e30];for(let k=s;k<e;k++)for(let a=0;a<3;a++){const x=cx[idx[k]*3+a];if(x<cm[a])cm[a]=x;if(x>cM[a])cM[a]=x;}
  let ax=0;for(let a=1;a<3;a++)if(cM[a]-cm[a]>cM[ax]-cm[ax])ax=a;
  const sub=Array.from(idx.subarray(s,e)).sort((p,q)=>cx[p*3+ax]-cx[q*3+ax]);idx.set(sub,s);const m=(s+e)>>1;
  const l=node(s,m);node(m,e);left[id]=l;count[id]=0;return id;}
 node(0,n);const N=bmin.length,B=new Float64Array(N*6),L=new Int32Array(N),S=new Uint32Array(N),C=new Uint32Array(N);
 for(let i=0;i<N;i++){B.set(bmin[i],i*6);B.set(bmax[i],i*6+3);L[i]=left[i];S[i]=start[i];C[i]=count[i];}
 // right child of an inner node = the node after the whole left subtree: store explicitly
 const R=new Int32Array(N).fill(-1);(function fix(i){if(C[i])return i;const l=L[i];const end=fix(l);R[i]=end+1;return fix(end+1);})(0);
 return {tris,idx,B,L,R,S,C};
}
// true if the segment o + d*t, t in (tmin, tmax), hits a triangle
function anyHit(bv,o,d,tmin,tmax){
 const {tris,idx,B,L,R,S,C}=bv,inv=[1/d[0],1/d[1],1/d[2]],st=new Int32Array(128);let sp=0;st[sp++]=0;
 while(sp){const i=st[--sp];let t0=tmin,t1=tmax,ok=true;
  for(let a=0;a<3;a++){let ta=(B[i*6+a]-o[a])*inv[a],tb=(B[i*6+3+a]-o[a])*inv[a];if(ta>tb){const x=ta;ta=tb;tb=x;}if(ta>t0)t0=ta;if(tb<t1)t1=tb;if(t0>t1){ok=false;break;}}
  if(!ok)continue;
  if(C[i]){for(let k=S[i],e=S[i]+C[i];k<e;k++){const t=idx[k]*9;
    const e1x=tris[t+3]-tris[t],e1y=tris[t+4]-tris[t+1],e1z=tris[t+5]-tris[t+2],e2x=tris[t+6]-tris[t],e2y=tris[t+7]-tris[t+1],e2z=tris[t+8]-tris[t+2];
    const px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(det>-1e-12&&det<1e-12)continue;const id=1/det;
    const sx=o[0]-tris[t],sy=o[1]-tris[t+1],sz=o[2]-tris[t+2],u=(sx*px+sy*py+sz*pz)*id;if(u<0||u>1)continue;
    const qx=sy*e1z-sz*e1y,qy=sz*e1x-sx*e1z,qz=sx*e1y-sy*e1x,v=(d[0]*qx+d[1]*qy+d[2]*qz)*id;if(v<0||u+v>1)continue;
    const tt=(e2x*qx+e2y*qy+e2z*qz)*id;if(tt>tmin&&tt<tmax)return true;}}
  else{st[sp++]=L[i];st[sp++]=R[i];}}
 return false;
}
// first hit distance (lens guard), Infinity if none
function firstHit(bv,o,d,tmax){let lo=0,hi=tmax;if(!anyHit(bv,o,d,1e-4,hi))return Infinity;for(let k=0;k<20;k++){const m=(lo+hi)/2;if(anyHit(bv,o,d,1e-4,m))hi=m;else lo=m;}return hi;}
module.exports={build,anyHit,firstHit};
