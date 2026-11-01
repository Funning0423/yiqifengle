#!/usr/bin/env node
'use strict';
/** 运镜bot full9-skyfollow: conservative 0.5 m occupancy grid of the REAL skycity mesh (the exact objects test_sky_resume_follow /
 *  route-legs skyJ test: everything but clouds / dome / *_after) in SKYCITY MODEL-LOCAL space around the resume walks (S0/S3/S5 → S6).
 *  Same marking as tools/b1-lens/make_lens_voxels.cjs (barycentric sampling ≤ 0.2 m), closed interiors flood-filled.
 *  "box distance to every occupied voxel ≥ 1.1 m" ⇒ true surface clearance ≥ 1.1 m. Writes tools/skycity-walk/sky_lens_voxels.json (offline, for bake_sky_resume_plans.cjs). */
const fs=require('fs'),path=require('path');const R=require('../journey-integration/route/route-legs.cjs');
const OUT=path.join(__dirname,'sky_lens_voxels.json');/* full9b: offline bake input only — never under assets (package budget) */
const S=0.5,O=[-22,-4,-40],MAX=[24,18,52],N=MAX.map((v,i)=>Math.ceil((v-O[i])/S));
const bits=new Uint8Array(Math.ceil(N[0]*N[1]*N[2]/8));let set=0;
const mark=p=>{const i=Math.floor((p[0]-O[0])/S),j=Math.floor((p[1]-O[1])/S),k=Math.floor((p[2]-O[2])/S);if(i<0||j<0||k<0||i>=N[0]||j>=N[1]||k>=N[2])return;const n=(k*N[1]+j)*N[0]+i;if(!(bits[n>>3]&(1<<(n&7)))){bits[n>>3]|=1<<(n&7);set++;}};
R.skyLocal().then(sky=>{const names={};
 for(const o of sky){if(/cloudsea|cumulus_far|cloud_small|Icosphere|_after|env_sky_dome/.test(o.name)||!o.tris)continue;const T=o.tris;
  for(let t=0;t<T.length;t+=9){const a=[T[t],T[t+1],T[t+2]],b=[T[t+3],T[t+4],T[t+5]],c=[T[t+6],T[t+7],T[t+8]];
   if(Math.max(a[0],b[0],c[0])<O[0]||Math.min(a[0],b[0],c[0])>MAX[0]||Math.max(a[2],b[2],c[2])<O[2]||Math.min(a[2],b[2],c[2])>MAX[2]||Math.max(a[1],b[1],c[1])<O[1]||Math.min(a[1],b[1],c[1])>MAX[1])continue;
   const L=Math.max(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),Math.hypot(a[0]-c[0],a[1]-c[1],a[2]-c[2]),Math.hypot(b[0]-c[0],b[1]-c[1],b[2]-c[2])),n=Math.max(1,Math.ceil(L/0.2));
   for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){const u=i/n,v=j/n,w=1-u-v;mark([a[0]*w+b[0]*u+c[0]*v,a[1]*w+b[1]*u+c[1]*v,a[2]*w+b[2]*u+c[2]*v]);}
   names[o.name]=(names[o.name]||0)+1;}}
 const N3=N[0]*N[1]*N[2],seen=new Uint8Array(N3),occ=n=>bits[n>>3]&(1<<(n&7)),st=[];
 for(let k=0;k<N[2];k++)for(let j=0;j<N[1];j++)for(let i=0;i<N[0];i++)if(i==0||j==N[1]-1||k==0||i==N[0]-1||k==N[2]-1){const n=(k*N[1]+j)*N[0]+i;if(!occ(n)){seen[n]=1;st.push(n);}}
 while(st.length){const n=st.pop(),i=n%N[0],j=((n/N[0])|0)%N[1],k=(n/(N[0]*N[1]))|0;for(const [a,b,c] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const x=i+a,y=j+b,z=k+c;if(x<0||y<0||z<0||x>=N[0]||y>=N[1]||z>=N[2])continue;const m=(z*N[1]+y)*N[0]+x;if(!seen[m]&&!occ(m)){seen[m]=1;st.push(m);}}}
 let filled=0;for(let n=0;n<N3;n++)if(!seen[n]&&!occ(n)){bits[n>>3]|=1<<(n&7);filled++;set++;}
 const b64=Buffer.from(bits).toString('base64');
 fs.writeFileSync(OUT,JSON.stringify({size:S,origin:O,dims:N,count:set,bits:b64})+'\n');
 console.log(JSON.stringify({filled,origin:O,dims:N,occupied:set,bytes:b64.length,objs:Object.keys(names).length}));});
