'use strict';
/* Lakeside (r5h3) scene geometry for the camera contracts: every instance of scene_r5h_slim_transforms.json
 * (Y-up metres) placed from the committed region_lakeside GLBs, kept exactly as the live scene keeps them
 * (LakesideSceneData.lakesideSceneInstances: no 3D pieces, contact shadows, ripple rings or board frame, which the 2D board draws,
 * and none of the 34 ASSETS-collection templates exported at the origin, name == GLB basename; 0932b6b: 431 real instances).
 * Triangle soup per instance in LAKESIDE-LOCAL coordinates (the region root), plus bbox, for clearance and ray tests. */
const fs=require('node:fs'),path=require('node:path');
const {load:loadGlb}=require('../occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../../..'),B=ROOT+'/creator-build-project/assets/bundles/region_lakeside/';
const T=JSON.parse(fs.readFileSync(B+'scene_r5h_slim_transforms.json','utf8'));
function qm([x,y,z,w],[sx,sy,sz],[tx,ty,tz]){return [(1-2*(y*y+z*z))*sx,(2*(x*y+z*w))*sx,(2*(x*z-y*w))*sx,0,(2*(x*y-z*w))*sy,(1-2*(x*x+z*z))*sy,(2*(y*z+x*w))*sy,0,(2*(x*z+y*w))*sz,(2*(y*z-x*w))*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1];}
const cache={};
function glb(name){if(!cache[name]){const nodes=loadGlb(B+'models/'+name).filter(n=>n.tris&&n.tris.length);let n=0;for(const x of nodes)n+=x.tris.length;const t=new Float64Array(n);let o=0;for(const x of nodes){t.set(x.tris,o);o+=x.tris.length;}cache[name]=t;}return cache[name];}
function bbox(t){const a=[1e9,1e9,1e9],b=[-1e9,-1e9,-1e9];for(let k=0;k<t.length;k++){const c=k%3;if(t[k]<a[c])a[c]=t[k];if(t[k]>b[c])b[c]=t[k];}return [a,b];}
let built=null;
/** All placed instances: {name,glb,group,tris,box}. Sky-only layers (clouds) are kept; they are far above every lens. */
function instances(){if(built)return built;const SKIP=['LK_board_frame.glb','LK_contact_shadow.glb','LK_ripple_ring.glb'];
 built=T.instances.filter(i=>i&&typeof i.glb==='string'&&!SKIP.includes(i.glb)&&!/^LK_piece_/.test(i.glb)&&i.name!==i.glb.replace(/\.glb$/i,'')).map(i=>{const m=qm(i.rot_quat_xyzw,i.scale,i.pos),src=glb(i.glb),t=new Float64Array(src.length);
 for(let k=0;k<src.length;k+=3){const x=src[k],y=src[k+1],z=src[k+2];t[k]=m[0]*x+m[4]*y+m[8]*z+m[12];t[k+1]=m[1]*x+m[5]*y+m[9]*z+m[13];t[k+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}
 return {name:i.name,glb:i.glb,group:i.group,tris:t,box:bbox(t)};});return built;}
module.exports={instances,bbox,transforms:T,B};
