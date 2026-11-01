'use strict';
// Robot prop lens (b11 fix): front three-quarter from the robot's facing, ≥1.1 m clearance, never behind it.
const assert=require('node:assert/strict');const {load}=require('./load.cjs');
const C=load('region/ExploreCameraCore.ts');
const p=[3.6,-0.07,28.2],fwd=[-0.67,0,0.74];   // env_skycity anchor_robot_root (glb local), +Z facing
const girls=[[1.73,-0.07,30.28],[3.6+0.67*3,-0.07,28.2-0.74*3],[3.6+4,-0.07,28.2],[3.6-4,-0.07,28.2],[3.6-0.67*0.8,-0.07,28.2+0.74*0.8]];
for(const g of girls){
 const q=C.propFacingPose(p,fwd,g,C.ROBOT_FACING);
 const dx=q.position[0]-p[0],dz=q.position[2]-p[2],L=Math.hypot(dx,dz),fl=Math.hypot(fwd[0],fwd[2]);
 const cos=(dx*fwd[0]+dz*fwd[2])/(L*fl);
 assert.ok(cos>=Math.cos(40*Math.PI/180)-1e-9,'lens in front of the robot, got cos '+cos);
 assert.ok(L>=C.PROP_CLEAR_M,'robot clearance');
 const gd=Math.hypot(q.position[0]-g[0],q.position[1]-(g[1]+1),q.position[2]-g[2]);
 assert.ok(gd>=C.PROP_CLEAR_M-1e-9,'her clearance '+gd);
 assert.ok(q.target[1]>p[1]+1,'aim at the robot body');
}
// side follows her
const l=C.propFacingPose(p,fwd,[3.6+5,0,28.2],C.ROBOT_FACING),r=C.propFacingPose(p,fwd,[3.6-5,0,28.2],C.ROBOT_FACING);
assert.ok(l.position[0]>r.position[0],'side nearer her');
console.log('test_prop_facing OK');
