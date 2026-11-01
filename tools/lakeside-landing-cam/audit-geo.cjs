'use strict';
const Jn=require('../journey-integration/journey-scene.cjs'),LKS=require('../journey-integration/lakeside/lakeside-scene.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
const {load:loadGlb}=require('../journey-integration/occlusion/lib-glb.cjs'),{decode}=require('../camera-frame-test/glb_geometry.cjs');
const {H,S,rotY,add,sub,yaw:SKY_YAW,sOff}=Jn;
const LC=H.load(S+'region/LakesideCameraLayout.ts'),BL=H.load(S+'ui/BoardLayout.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts');
const SCREENS=[[390,844],[360,780],[768,1024]],GIRL_H=1.7253,GIRL_W=.3,UI_GAP=13,CLEAR=1.1,BANK_Z=42,LAKE_Y=.58;
const S6=add(rotY(SKY_YAW,[0.2,0.032,-27.8]),sOff),S4=add(rotY(SKY_YAW,[0.2,3.308,-5.8]),sOff);
const LJ=LC.lakesideJourney(S6),toLocal=p=>rotY(-LJ.yawDeg,sub(p,LJ.root)),bank=LJ.arrival[LJ.arrival.length-1];
// ---- geometry ----
async function geometry(){
 const lake=LKS.instances().map(i=>{const t=new Float64Array(i.tris.length);for(let k=0;k<t.length;k+=3){const w=LJ.toWorld([i.tris[k],i.tris[k+1],i.tris[k+2]]);t[k]=w[0];t[k+1]=w[1];t[k+2]=w[2];}return {tag:'lake',name:i.name,tris:t};});
 const g=await decode(Jn.ROOT+'/creator-build-project/assets/bundles/region_skycity/env_skycity.glb');if(!g)throw Error('draco3d not found: set DRACO3D');
 const sky=[];for(const name in g.meshes){if(/cloudsea|cumulus_far|cloud_small|Icosphere|_after/.test(name))continue;const tr=g.meshes[name],t=new Float64Array(tr.length*9);let o=0;
  for(const tri of tr)for(const v of tri){const w=add(rotY(SKY_YAW,v),sOff);t[o++]=w[0];t[o++]=w[1];t[o++]=w[2];}sky.push({tag:'sky',name,tris:t});}
 const bal=loadGlb(Jn.ROOT+'/creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb').filter(n=>n.tris&&n.tris.length&&!/flame/.test(n.name)).map(n=>({tag:'balloon',name:n.name,tris:Float64Array.from(n.tris)}));
 return {stat:FL.buildBvh([...lake,...sky]),bal,lakeN:lake.length,skyN:sky.length};
}
const balAt=(G,p)=>FL.buildBvh(G.bal.map(o=>{const t=new Float64Array(o.tris.length);for(let k=0;k<t.length;k+=3){t[k]=o.tris[k]+p[0];t[k+1]=o.tris[k+1]+p[1];t[k+2]=o.tris[k+2]+p[2];}return {tag:'balloon',name:o.name,tris:t};}));
// point-triangle distance (Ericson)
function ptTri(p,t){const a=[t[0],t[1],t[2]],b=[t[3],t[4],t[5]],c=[t[6],t[7],t[8]],ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
 const d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return Math.hypot(...ap);const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return Math.hypot(...bp);
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return Math.hypot(ap[0]-v*ab[0],ap[1]-v*ab[1],ap[2]-v*ab[2]);}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return Math.hypot(...cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return Math.hypot(ap[0]-w*ac[0],ap[1]-w*ac[1],ap[2]-w*ac[2]);}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6)),q=[b[0]+w*(c[0]-b[0]),b[1]+w*(c[1]-b[1]),b[2]+w*(c[2]-b[2])];return Math.hypot(...sub(p,q));}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return Math.hypot(ap[0]-ab[0]*v-ac[0]*w,ap[1]-ab[1]*v-ac[1]*w,ap[2]-ab[2]*v-ac[2]*w);}
function nearest(bvh,p,maxD=8){let best=maxD,who=null;if(!bvh.root)return {d:best,who};const st=[bvh.root];
 while(st.length){const n=st.pop();let dd=0;for(let c=0;c<3;c++){const e=Math.max(n.lo[c]-p[c],0,p[c]-n.hi[c]);dd+=e*e;}if(Math.sqrt(dd)>=best)continue;
  if(n.l){st.push(n.l,n.r);continue;}for(let k=n.s;k<n.e;k++){const i=bvh.idx[k],d=ptTri(p,bvh.tris[i]);if(d<best){best=d;who=bvh.tag[i].tag+':'+bvh.tag[i].name;}}}
 return {d:best,who};}
module.exports={geometry,balAt,nearest,ptTri,S6,S4,LJ,toLocal,bank,W:LJ.toWorld,SCREENS,GIRL_H,GIRL_W,UI_GAP,CLEAR,BANK_Z,LAKE_Y,LC,BL,Core,FL,H,S,rotY,add,sub};
