'use strict';
// 运镜bot r5: home free-orbit lens poses for bl_room_keepinside.py render, from the real FreeOrbit.solve (pitch 10°, arm 3.35 m,
// keepInside only, like 场景特效bot's room 360 capture). node orbit_poses.cjs OUT.json  → after (current box) 8 yaws + before (old box) 270/315.
const fs=require('node:fs'),path=require('node:path');const {load}=require('../../region-nodes/load.cjs');
const C=load('region/FreeOrbit.ts'),R=load('world-r1/CharacterReference.ts'),seat=R.CHARACTER_REFERENCE.seatedRoot,L=C.ORBIT_LIMITS.home;
const OLD=Object.assign({},L,{keepInside:{min:[-1.85,0.7,-4.72],max:[1.05,2.2,-1.55]}});
function pose(name,yaw,limits){const o=new C.FreeOrbit('home');if(limits)o.limits=limits;o.yaw=yaw;o.pitch=10;o.dist=L.distMax;const p=o.solve([seat[0],seat[1],seat[2]],[],seat[1]);
 return {name,yaw,position:p.position.map(v=>+v.toFixed(4)),target:p.target.map(v=>+v.toFixed(4)),fov:p.fovVerticalDeg}}
const out=[];for(let y=0;y<360;y+=45)out.push(pose('after_yaw'+String(y).padStart(3,'0'),y));for(const y of [270,315])out.push(pose('before_yaw'+y,y,OLD));
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));console.log(out.map(p=>p.name+' '+p.position.join(',')).join('\n'));
