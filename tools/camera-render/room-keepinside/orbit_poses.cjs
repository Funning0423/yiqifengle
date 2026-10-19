'use strict';
// 运镜bot r5: home free-orbit lens poses for bl_room_keepinside.py render, from the real FreeOrbit.solve (pitch 10°, arm 3.35 m,
// with the world's collider boxes as WorldFlowComponent.fillBoxes builds them: fixtures/room-keepinside/world_boxes.json).
// node orbit_poses.cjs OUT.json [prefix]   → 8 yaws (static goal: room look blend, keepInside, colliders).
const fs=require('node:fs'),path=require('node:path');const {load}=require('../../region-nodes/load.cjs');
const C=load('region/FreeOrbit.ts'),R=load('world-r1/CharacterReference.ts'),seat=R.CHARACTER_REFERENCE.seatedRoot,L=C.ORBIT_LIMITS.home;
const boxes=JSON.parse(fs.readFileSync(path.join(__dirname,'../../region-nodes/fixtures/room-keepinside/world_boxes.json'),'utf8')).boxes;
const prefix=process.argv[3]||'orbit';
function pose(name,yaw){const o=new C.FreeOrbit('home');o.yaw=yaw;o.pitch=10;o.dist=L.distMax;const p=o.solve([seat[0],seat[1],seat[2]],boxes,seat[1]);
 return {name,yaw,w:+o.roomWeight.toFixed(3),position:p.position.map(v=>+v.toFixed(4)),target:p.target.map(v=>+v.toFixed(4)),fov:p.fovVerticalDeg}}
const out=[];for(let y=0;y<360;y+=45)out.push(pose(prefix+'_yaw'+String(y).padStart(3,'0'),y));
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));console.log(out.map(p=>p.name+' w'+p.w+' '+p.position.join(',')).join('\n'));
