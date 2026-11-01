'use strict';
// meadow geometry helpers (model-local): obstacle triangles, floor height, walkable cells, body clearance
const fs=require('fs'),zlib=require('zlib');const R=require('path').resolve(__dirname,'../../..');
const {load}=require(R+'/tools/journey-integration/occlusion/lib-glb.cjs');
const nodes=load(R+'/creator-build-project/assets/bundles/region_meadow/env_meadow.glb').filter(n=>n.tris&&n.tris.length);
const OBST=/meadow_fence|meadow_trees|wind_bell|windmill_static|^meadow_river$/;
const obs=nodes.filter(n=>OBST.test(n.name)),floorN=nodes.filter(n=>/meadow_terrain|meadow_path|meadow_river_bank/.test(n.name));
const sub=(u,v)=>[u[0]-v[0],u[1]-v[1],u[2]-v[2]],dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
function ptTri(p,t,o){const a=[t[o],t[o+1],t[o+2]],b=[t[o+3],t[o+4],t[o+5]],cc=[t[o+6],t[o+7],t[o+8]];
 const ab=sub(b,a),ac=sub(cc,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return Math.hypot(...ap);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return Math.hypot(...bp);
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return Math.hypot(...sub(p,[a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v]));}
 const cp=sub(p,cc),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return Math.hypot(...cp);
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return Math.hypot(...sub(p,[a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w]));}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return Math.hypot(...sub(p,[b[0]+(cc[0]-b[0])*w,b[1]+(cc[1]-b[1])*w,b[2]+(cc[2]-b[2])*w]));}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return Math.hypot(...sub(p,[a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w]));}
function floorAt(x,z){let best=null;for(const n of floorN){const t=n.tris;for(let o=0;o<t.length;o+=9){
 const ax=t[o],az=t[o+2],bx=t[o+3],bz=t[o+5],cx=t[o+6],cz=t[o+8];if(Math.max(ax,bx,cx)<x||Math.min(ax,bx,cx)>x||Math.max(az,bz,cz)<z||Math.min(az,bz,cz)>z)continue;
 const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(det)<1e-12)continue;
 const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det,l3=1-l1-l2;if(l1<-1e-6||l2<-1e-6||l3<-1e-6)continue;
 const y=l1*t[o+1]+l2*t[o+4]+l3*t[o+7];if(best===null||y>best)best=y;}}return best;}
const w=JSON.parse(zlib.gunzipSync(fs.readFileSync(R+'/tools/region-nodes/fixtures/meadow-walkable.json.gz')));const cells=new Map();for(const [ci,,y] of w.cells)cells.set(ci,y);
const walkable=(x,z)=>cells.has(Math.floor((z-w.z0)/w.c)*w.W+Math.floor((x-w.x0)/w.c));
/** body clearance at (x,z): min distance from the body axis points (0.3/0.9/1.5 m above the floor) to obstacle triangles */
function clearance(x,z){const f=floorAt(x,z);const fy=f===null?0:f;let best={d:9,mesh:null};
 for(const n of obs){const t=n.tris;for(let o=0;o<t.length;o+=9){const xm=Math.min(t[o],t[o+3],t[o+6]),xM=Math.max(t[o],t[o+3],t[o+6]),zm=Math.min(t[o+2],t[o+5],t[o+8]),zM=Math.max(t[o+2],t[o+5],t[o+8]);
  if(xm>x+2||xM<x-2||zm>z+2||zM<z-2)continue;const ym=Math.min(t[o+1],t[o+4],t[o+7]),yM=Math.max(t[o+1],t[o+4],t[o+7]);if(yM<fy+0.15||ym>fy+1.75)continue;
  for(const h of [0.3,0.9,1.5]){const d=ptTri([x,fy+h,z],t,o);if(d<best.d)best={d,mesh:n.name};}}}
 return {...best,floor:f};}
module.exports={clearance,floorAt,walkable,obs,w};
