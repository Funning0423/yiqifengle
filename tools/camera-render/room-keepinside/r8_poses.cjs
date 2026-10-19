'use strict';
// 运镜bot r8 acceptance poses from the real FreeOrbit (home, world collider boxes):
//   node r8_poses.cjs OUTDIR   → contact_8yaw.json (pitch 10, default arm), contact_minpinch.json (pitch 10, distMin),
//                                seq_sweep90.json (rest at yaw 330, 90°/s drag through the orbit-her zone to yaw 15, stop,
//                                1.4 s still; every 0.1 s) and seq_sweep90_trace.json (every frame, 60 fps: input weight w,
//                                view blend s, view / input / look-at directions, her centre, position goal).
const fs=require('node:fs'),path=require('node:path');const {load}=require('../../region-nodes/load.cjs');
const C=load('region/FreeOrbit.ts'),R=load('world-r1/CharacterReference.ts'),seat=R.CHARACTER_REFERENCE.seatedRoot,L=C.ORBIT_LIMITS.home;
const boxes=JSON.parse(fs.readFileSync(path.join(__dirname,'../../region-nodes/fixtures/room-keepinside/world_boxes.json'),'utf8')).boxes;
const HER_C=(()=>{const pts=JSON.parse(fs.readFileSync(path.join(__dirname,'../../region-nodes/fixtures/room-keepinside/her_seated_points.json'),'utf8')).points,mn=[9,9,9],mx=[-9,-9,-9];for(const q of pts)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],q[k]);mx[k]=Math.max(mx[k],q[k])}return [0,1,2].map(k=>(mn[k]+mx[k])/2)})();   // her body centre (same as test_room_keepinside)
const feet=[seat[0],seat[1],seat[2]],out=process.argv[2];fs.mkdirSync(out,{recursive:true});
const P=(name,p,extra)=>Object.assign({name,position:p.position.map(v=>+v.toFixed(4)),target:p.target.map(v=>+v.toFixed(4)),fov:p.fovVerticalDeg},extra||{});
function stat(prefix,dist){const r=[];for(let y=0;y<360;y+=45){const o=new C.FreeOrbit('home');o.yaw=y;o.pitch=10;o.dist=dist;const p=o.solve(feet,boxes,seat[1]);r.push(P(`${prefix}_yaw${String(y).padStart(3,'0')}`,p,{yaw:y,dist,w:+o.roomWeight.toFixed(3),s:+o.roomViewBlend.toFixed(3)}))}return r}
fs.writeFileSync(path.join(out,'contact_8yaw.json'),JSON.stringify(stat('arm',L.distMax),null,1));
fs.writeFileSync(path.join(out,'contact_minpinch.json'),JSON.stringify(stat('pinch',L.distMin),null,1));
{const o=new C.FreeOrbit('home'),dt=1/60;o.yaw=330;o.pitch=10;o.dist=L.distMax;o.solve(feet,boxes,seat[1]);
 for(let i=0;i<120;i++){o.step(dt);o.solve(feet,boxes,seat[1])}   // settled at rest
 const tr=[],seq=[];let t=0;const rate=90,tMove=45/rate;
 const rec=(moving)=>{const p=o.solve(feet,boxes,seat[1]),g=o.roomGoalAt(o.orbitPivot(feet),o.yaw,o.pitch,o.dist,boxes,seat[1]);
  tr.push({t:+t.toFixed(4),moving,fov:p.fovVerticalDeg,yaw:+o.yaw.toFixed(3),wIn:g.w,s:o.roomViewBlend,p:p.position,target:p.target,goal:g.pos,goalDir:g.dir,herC:HER_C});
  const k=Math.round(t*60);if(k%6===0)seq.push(P(`seq_t${String(Math.round(t*1000)).padStart(4,'0')}${moving?'':'_still'}`,p,{t:+t.toFixed(2),yaw:+o.yaw.toFixed(1),s:+o.roomViewBlend.toFixed(2),lagM:+Math.hypot(p.position[0]-g.pos[0],p.position[1]-g.pos[1],p.position[2]-g.pos[2]).toFixed(3)}))};
 rec(false);
 for(let i=0;i<Math.round(tMove/dt);i++){o.drag(rate*dt/C.ORBIT_FEEL.yawPerScreen,0,dt);o.step(dt);t+=dt;rec(true)}
 const tStop=t;for(let i=0;i<Math.round(1.4/dt);i++){o.drag(0,0,dt);o.step(dt);t+=dt;rec(false)}
 fs.writeFileSync(path.join(out,'seq_sweep90.json'),JSON.stringify(seq,null,1));fs.writeFileSync(path.join(out,'seq_sweep90_trace.json'),JSON.stringify({rate,tStop,fps:60,frames:tr}));
 console.log('seq',seq.length,'tStop',tStop.toFixed(3),'yaw end',o.yaw.toFixed(1))}
