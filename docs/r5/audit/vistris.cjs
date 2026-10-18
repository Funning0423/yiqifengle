// Per-frame visible triangles (Cocos culls per model by world AABB vs frustum) along the current legs, 390x844, day.
const W='/workspace/gh/wt-skyb';const J=require(W+'/tools/journey-integration/journey-scene.cjs'),F=require(W+'/tools/journey-integration/journey-framing-lib.cjs');const {load}=require(W+'/tools/journey-integration/occlusion/lib-glb.cjs');
const take=(f,skip)=>load(f).filter(n=>n.tris&&n.tris.length&&!(skip&&skip.test(n.name))).map(n=>({name:n.name,tris:Float64Array.from(n.tris)}));
const island=J.place(take((process.env.ROOM_GLB||'/workspace/gh/scratch/dec/room.glb'),/^env_interior_|^env_int_/),'island'),meadow=J.place(take(W+'/creator-build-project/assets/bundles/region_meadow/env_meadow.glb',/^meadow_sky_dome|^meadow_far_hills/),'meadow',180,1,J.mOff),sky=J.place(take((process.env.SKY_GLB||'/workspace/gh/scratch/dec/skycity.glb')),'skycity',J.yaw,1,J.sOff);
const SETS={'04-05':[...island,...meadow],'08-09':[...island,...meadow,...sky]};
const bb=t=>{const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<t.length;i+=3)for(let c=0;c<3;c++){lo[c]=Math.min(lo[c],t[i+c]);hi[c]=Math.max(hi[c],t[i+c]);}return [lo,hi];};
for(const k in SETS)for(const o of SETS[k])o.box??=bb(o.tris);
const out={};for(const leg of J.legs){const T=J.routeLength(leg.path);let mx=0,at=0,sum=0,n=0;
 for(let d=0;d<=T;d+=.5){const c=J.journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM),{fw,r,up,th}=F.basis(c),tx=th*390/844;let tri=0;
  for(const o of SETS[leg.id]){const [lo,hi]=o.box;let inside=true;// test 4 side planes + near on the 8 corners (conservative: object culled only if all corners outside one plane)
   const pl=[[fw,0.1],[fw.map((v,i)=>v*tx+r[i]),0],[fw.map((v,i)=>v*tx-r[i]),0],[fw.map((v,i)=>v*th+up[i]),0],[fw.map((v,i)=>v*th-up[i]),0]];
   for(const [nrm,off] of pl){let any=false;for(let m=0;m<8;m++){const p=[m&1?hi[0]:lo[0],m&2?hi[1]:lo[1],m&4?hi[2]:lo[2]],v=[p[0]-c.position[0],p[1]-c.position[1],p[2]-c.position[2]];if(v[0]*nrm[0]+v[1]*nrm[1]+v[2]*nrm[2]>=off){any=true;break;}}if(!any){inside=false;break;}}
   if(inside)tri+=o.tris.length/9;}
  if(tri>mx){mx=tri;at=d;}sum+=tri;n++;}
 out[leg.id]={maxTris:mx,atS:+(at/1.2).toFixed(1),meanTris:Math.round(sum/n)};}
console.log(JSON.stringify(out));
