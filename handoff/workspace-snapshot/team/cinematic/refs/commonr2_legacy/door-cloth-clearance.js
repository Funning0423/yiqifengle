'use strict';
const R=require('./original-room-alignment').getRegistration(),scale=R.girlScale,w=R.door.width,h=R.door.height;
function prepare(p){if(!p.root||!Number.isFinite(p.doorAngle))return null;const r=p.root,px=r.position[0]*scale,pz=r.position[2]*scale;if(Math.hypot(px,pz)>2.4)return null;const a=p.doorAngle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),side=(px-w/2)*s+pz*c;return{r,c,s,cy:Math.cos(r.yaw),sy:Math.sin(r.yaw),side:side<=.05?-1:1};}
function apply(v,q,layer){if(!q||!layer)return;const {r,c,s,cy,sy,side}=q,x=(cy*v[0]+sy*v[2]+r.position[0])*scale,y=(v[1]+r.position[1])*scale,z=(-sy*v[0]+cy*v[2]+r.position[2])*scale,u=(w/2-x)*c+z*s;let d=(x-w/2)*s+z*c;if(u<-.045||u>w+.045||y<-.025||y>h+.025)return;const limit=side<0?-.062-(layer===2?.008:0):.15+(layer===2?.008:0);if(side<0?d<=limit:d>=limit)return;d=limit;const wx=w/2-u*c+d*s,wz=u*s+d*c,lx=wx/scale-r.position[0],lz=wz/scale-r.position[2];v[0]=cy*lx-sy*lz;v[2]=sy*lx+cy*lz;}
module.exports={prepare,apply};
