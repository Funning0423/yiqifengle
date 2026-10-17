'use strict';
// A conservative closed support volume follows the same physical chair spec.
// Cloth may rest on the seat or hang outside its rounded edges, never through it.
const Chair=require('./reading-chair'),Alignment=require('./original-room-alignment'),R=Chair.registration(Alignment.getRegistration()),SCALE=R.girlScale,C=R.anchors.seat,spec=Chair.spec,cy=Math.cos(spec.yaw),sy=Math.sin(spec.yaw),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function prepare(p,lod){const root=p.root;if(!root)return null;const x=root.position[0]*SCALE,z=root.position[2]*SCALE;if(Math.hypot(x-C[0],z-C[2])>1.8)return null;const c=Math.cos(root.yaw),s=Math.sin(root.yaw);return{root,c,s,far:lod==='far'};}
function apply(v,q,layer){if(!q||!layer)return;const r=q.root,c=q.c,s=q.s,wx=(c*v[0]+s*v[2]+r.position[0])*SCALE-C[0],wy=(v[1]+r.position[1])*SCALE,wz=(-s*v[0]+c*v[2]+r.position[2])*SCALE-C[2];let x=cy*wx-sy*wz,y=wy,z=sy*wx+cy*wz;const rx=spec.width/2+.10,rz=spec.depth/2+.10,top=C[1]+.025+(layer===2?.008:0);
// Continuous support heightfield: a hem crossing the seat edge lifts over it
// and then drops outside, instead of choosing discontinuous nearest box faces.
const outside=Math.max(Math.abs(x)-(spec.width/2+.045),Math.abs(z)-(spec.depth/2+.045),0),support=top-3.5*outside;
if(y<support&&y>-.03)y=support;
// Back frame: leave the original rear outline visible, drape in front of posts.
if(Math.abs(x)<rx&&y>C[1]+.03&&y<spec.backHeight+.03){const back=-spec.depth/2+.02-(y-C[1])/(spec.backHeight-C[1])*(.02+spec.backLean),clear=back+.058;if(z<clear&&z>back-.11)z=clear;}
const dx=cy*x+sy*z+C[0],dz=-sy*x+cy*z+C[2],lx=dx/SCALE-r.position[0],lz=dz/SCALE-r.position[2];v[0]=c*lx-s*lz;v[1]=y/SCALE-r.position[1];v[2]=s*lx+c*lz;
}
module.exports={prepare,apply};
