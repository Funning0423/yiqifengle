'use strict';
// meadow obstacle triangles (model-local), same set as 场景设计部's tools/meadow-walk/lib/meadow-geo.cjs (e4ae91c1)
const R=require('path').resolve(__dirname,'../..');const {load}=require(R+'/tools/journey-integration/occlusion/lib-glb.cjs');
const OBST=/meadow_fence|meadow_trees|wind_bell|windmill_static|^meadow_river$/;
/* exact point-triangle distance (full8) */
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
function pointTriDist(p,t){const a=[t[0],t[1],t[2]],b=[t[3],t[4],t[5]],c=[t[6],t[7],t[8]];const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return Math.hypot(...ap);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return Math.hypot(...bp);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return Math.hypot(...sub(p,add(a,ab.map(x=>x*v))));}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return Math.hypot(...cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return Math.hypot(...sub(p,add(a,ac.map(x=>x*w))));}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return Math.hypot(...sub(p,add(b,sub(c,b).map(x=>x*w))));}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return Math.hypot(...sub(p,add(a,add(ab.map(x=>x*v),ac.map(x=>x*w)))));};

module.exports={pointTriDist,obs:load(R+'/creator-build-project/assets/bundles/region_meadow/env_meadow.glb').filter(n=>n.tris&&n.tris.length&&OBST.test(n.name))};
