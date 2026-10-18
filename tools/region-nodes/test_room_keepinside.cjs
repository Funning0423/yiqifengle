'use strict';
// 运镜bot r5: the home free orbit never puts the lens through the room's inner walls (old keepInside went black at yaw 270/315).
// Inner walls: fixtures/room-keepinside/inner_walls.json, measured by tools/camera-render/room-keepinside/bl_room_keepinside.py
// (rays from the room centre every 2°, nearest wall hit over lens heights 0.85..2.2 m; chords between hits stay inside a convex
// room, so the polygon is conservative). Checks the real FreeOrbit.solve with ORBIT_LIMITS.home.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('./load.cjs');
const C=load('region/FreeOrbit.ts'),R=load('world-r1/CharacterReference.ts');
const W=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/room-keepinside/inner_walls.json'),'utf8'));
const BOX_MARGIN=0.30,LENS_MARGIN=0.25,NEAR=0.1;
const poly=W.polygonXZ;
function inside(x,z){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
function edgeGap(x,z){let m=1e9;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L));m=Math.min(m,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz))}return m}
function wallGap(p){if(!inside(p[0],p[2]))return -edgeGap(p[0],p[2]);return Math.min(edgeGap(p[0],p[2]),p[1]-W.floorY,W.ceilingY-p[1])}
const keep=C.ORBIT_LIMITS.home.keepInside,seat=R.CHARACTER_REFERENCE.seatedRoot;
// 1) the bounds themselves sit inside the inner walls with BOX_MARGIN (corners + edges sampled every 5 cm; the room is convex)
let boxGap=1e9;
for(let x=keep.min[0];x<=keep.max[0]+1e-9;x+=0.05)for(const z of [keep.min[2],keep.max[2]])for(const y of [keep.min[1],keep.max[1]])boxGap=Math.min(boxGap,wallGap([x,y,z]));
for(let z=keep.min[2];z<=keep.max[2]+1e-9;z+=0.05)for(const x of [keep.min[0],keep.max[0]])for(const y of [keep.min[1],keep.max[1]])boxGap=Math.min(boxGap,wallGap([x,y,z]));
assert.ok(boxGap>=BOX_MARGIN,'keepInside box is '+boxGap.toFixed(3)+' m from the inner walls (< '+BOX_MARGIN+')');
// 2) every yaw: clamped lens inside the inner walls with LENS_MARGIN, at the far, mid and near arm and the pitch limits
const L=C.ORBIT_LIMITS.home,rows=[];let worst=null;
function lens(yaw,pitch,dist,limits){const o=new C.FreeOrbit('home');if(limits)o.limits=limits;o.yaw=yaw;o.pitch=pitch;o.dist=dist;return o.solve([seat[0],seat[1],seat[2]],[],seat[1])}
for(let yaw=0;yaw<360;yaw+=15)for(const pitch of [L.pitchMinDeg,10,L.pitchMaxDeg])for(const dist of [L.distMin,2.3,L.distMax]){
 const p=lens(yaw,pitch,dist),g=wallGap(p.position),arm=Math.hypot(p.position[0]-p.target[0],p.position[1]-p.target[1],p.position[2]-p.target[2]);
 assert.ok(g>=LENS_MARGIN,`yaw ${yaw} pitch ${pitch} dist ${dist}: lens ${p.position.map(v=>v.toFixed(2))} is ${g.toFixed(3)} m from the inner walls`);
 assert.ok(arm>NEAR*4,'lens not inside her');
 if(!worst||g<worst.g)worst={yaw,pitch,dist,g:+g.toFixed(3)};
 if(yaw%45===0&&pitch===10&&dist===L.distMax)rows.push({yaw,lens:p.position.map(v=>+v.toFixed(3)),armM:+arm.toFixed(2),wallGapM:+g.toFixed(3),inBox:[0,1,2].every(k=>p.position[k]>=keep.min[k]-1e-6&&p.position[k]<=keep.max[k]+1e-6)});}
// 3) regression: the old box put the yaw-270 lens through the round wall
const oldLimits=Object.assign({},L,{keepInside:{min:[-1.85,0.7,-4.72],max:[1.05,2.2,-1.55]}});
const old270=wallGap(lens(270,10,L.distMax,oldLimits).position);
assert.ok(old270<LENS_MARGIN,'old box fails at yaw 270 ('+old270.toFixed(3)+')');
console.log(JSON.stringify({status:'PASS',keepInside:keep,boxMarginM:+boxGap.toFixed(3),lensMarginM:LENS_MARGIN,worstLens:worst,old270WallGapM:+old270.toFixed(3),yaws:rows},null,1));
