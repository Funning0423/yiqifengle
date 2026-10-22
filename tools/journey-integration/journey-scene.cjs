'use strict';
/* Shared journey scene fixture: real TS layout + real GLB triangles with island, meadow and skycity placed where the live game
 * places them. b16: the walking legs (04→05 / 08→09 rainbow-bridge routes) and their checks were removed. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createHarness}=require('../board-ui/harness.cjs'),{load:loadGlb}=require('./occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../..'),B=ROOT+'/creator-build-project/assets/bundles/',S=ROOT+'/creator-build-project/assets/scripts/';
const H=createHarness(),Lay=H.load(S+'region/RegionJourneyLayout.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts'),Cam=H.load(S+'world-r1/RegionCameraData.ts'),Visit=H.load(S+'region/SkycityVisitPose.ts');
const L=Lay.REGION_JOURNEY_LAYOUT,{sampleRoute,routeLength,journeyCamera,JOURNEY_CAMERA}=Core;
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
// ---------- geometry ----------
const meta=JSON.parse(fs.readFileSync(__dirname+'/occlusion/fixture-occluders.json','utf8')),bin=zlib.gunzipSync(fs.readFileSync(__dirname+'/occlusion/fixture-occluders.bin.gz'));
assert.equal(crypto.createHash('sha256').update(bin).digest('hex'),meta.binSha256,'fixture body corrupt');
const f32=new Float32Array(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength));
const local={};for(const s of meta.sources){assert.equal(sha(B+s.glb),s.sha256,s.glb+' changed since the occlusion fixture was built; rerun occlusion/build-fixture.cjs');local[s.id]=s.objects.map(o=>({name:o.name,tris:Float64Array.from(f32.subarray(o.offset/4,o.offset/4+o.count*9))}));}
const meadowNodes=loadGlb(B+'region_meadow/env_meadow.glb');local.meadow=meadowNodes.filter(n=>n.tris&&n.tris.length&&!/meadow_sky_dome|meadow_far_hills|meadow_clouds_near/.test(n.path)).map(n=>({name:n.name,tris:n.tris}));
const skyNodes=loadGlb(B+'region_skycity/env_skycity.glb',{tris:false});
const rotY=(deg,p)=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
const place=(objs,tag,yaw=0,scale=1,off=[0,0,0])=>objs.map(o=>{const t=new Float64Array(o.tris.length);for(let k=0;k<t.length;k+=3){const r=rotY(yaw,[o.tris[k]*scale,o.tris[k+1]*scale,o.tris[k+2]*scale]);t[k]=r[0]+off[0];t[k+1]=r[1]+off[1];t[k+2]=r[2]+off[2];}return {tag,name:o.name,tris:t};});
const nodePos=(nodes,name)=>{const n=nodes.find(x=>x.name===name);assert(n,'anchor '+name);return n.world.slice(12,15);};
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
// Island props layout is read from the production table (IslandPropsLayout.ts) so a palm move re-runs this contract.
const props=H.load(S+'world-r2/IslandPropsLayout.ts').ISLAND_PROPS.palms;
const island=[...place(local.island,'island'),...props.flatMap(p=>place(local[p.prefab==='beach_palm_tall'?'palm_tall':'palm_short'],p.prefab,p.yawDeg,p.scale,p.position))];
const anchorsIsland=JSON.parse(fs.readFileSync(B+'region_island/combined_anchors_m.json','utf8')).anchors,start=anchorsIsland.find(a=>a.name==='exit_path_17').position_world_m;
// ---------- region placement (as the live game places the regions; the old walking routes are gone since b16) ----------
const mp=n=>nodePos(meadowNodes,n);
// Meadow copy: island approach end + meadowOffset, yaw 180 (TransportLeg / LakesideCameraLayout keep this frame).
const edge1=Lay.islandApproach(start).at(-1),mOff=sub(add(edge1,L.meadowOffset),rotY(180,mp('player_spawn')));
const meadow=place(local.meadow,'meadow',180,1,mOff),mA=n=>add(rotY(180,mp(n)),mOff);
// Skycity copy: rim landing = meadow walk_path_<meadowExitPathIndex> + skycityOffset (BalloonTransit's live placement).
const edge2=mA('walk_path_'+String(L.meadowExitPathIndex).padStart(2,'0'));
const sp=n=>nodePos(skyNodes,n),yaw=Lay.skycityYawDeg(sp('anchor_cloudbridge_end'),sp('anchor_cloudbridge_start'));
const deck0=Lay.skyDeckRoute(rotY(yaw,sp('anchor_cloudbridge_end')),rotY(yaw,sp('anchor_cloudbridge_start'))),sOff=sub(add(edge2,L.skycityOffset),deck0.rim);
const sky=place(local.skycity,'skycity',yaw,1,sOff),sA=n=>add(rotY(yaw,sp(n)),sOff);
// ---------- ray tests ----------
function bbox(t){const a=[1e9,1e9,1e9],b=[-1e9,-1e9,-1e9];for(let k=0;k<t.length;k++){const c=k%3;if(t[k]<a[c])a[c]=t[k];if(t[k]>b[c])b[c]=t[k];}return [a,b];}
function segBox(o,e,[a,b]){let t0=0,t1=1;for(let c=0;c<3;c++){const d=e[c]-o[c];if(Math.abs(d)<1e-12){if(o[c]<a[c]||o[c]>b[c])return false;continue;}let p=(a[c]-o[c])/d,q=(b[c]-o[c])/d;if(p>q)[p,q]=[q,p];t0=Math.max(t0,p);t1=Math.min(t1,q);if(t0>t1)return false;}return true;}
function rayHit(o,d,maxT,t){let best=null;for(let k=0;k<t.length;k+=9){const ax=t[k],ay=t[k+1],az=t[k+2],e1x=t[k+3]-ax,e1y=t[k+4]-ay,e1z=t[k+5]-az,e2x=t[k+6]-ax,e2y=t[k+7]-ay,e2z=t[k+8]-az,px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-12)continue;const iv=1/det,tx=o[0]-ax,ty=o[1]-ay,tz=o[2]-az,u=(tx*px+ty*py+tz*pz)*iv;if(u<0||u>1)continue;const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(d[0]*qx+d[1]*qy+d[2]*qz)*iv;if(v<0||u+v>1)continue;const s=(e2x*qx+e2y*qy+e2z*qz)*iv;if(s>1e-4&&s<maxT&&(best===null||s<best))best=s;}return best;}
function blockers(objs,o,e){const d=sub(e,o),l=Math.hypot(...d),u=d.map(x=>x/l),out=[];for(const ob of objs){ob.bb??=bbox(ob.tris);if(!segBox(o,e,ob.bb))continue;if(rayHit(o,u,l-.05,ob.tris)!==null)out.push(ob.tag+':'+ob.name);}return out;}
function ptTri(p,a,b,c){const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];const d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return a;const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return add(a,ab.map(x=>x*v));}const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return add(a,ac.map(x=>x*w));}const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/(d4-d3+d5-d6);return add(b,sub(c,b).map(x=>x*w));}const den=1/(va+vb+vc),v=vb*den,w=vc*den;return add(a,add(ab.map(x=>x*v),ac.map(x=>x*w)));}
function clearance(p,objs,cap=3){let best=cap,who=null;for(const o of objs){o.bb??=bbox(o.tris);let dd=0;for(let c=0;c<3;c++){const v=Math.max(o.bb[0][c]-p[c],0,p[c]-o.bb[1][c]);dd+=v*v;}if(Math.sqrt(dd)>=best)continue;const t=o.tris;for(let k=0;k<t.length;k+=9){if(Math.abs(t[k]-p[0])>best+25||Math.abs(t[k+2]-p[2])>best+25||Math.abs(t[k+1]-p[1])>best+25)continue;const q=ptTri(p,[t[k],t[k+1],t[k+2]],[t[k+3],t[k+4],t[k+5]],[t[k+6],t[k+7],t[k+8]]),d=Math.hypot(...sub(q,p));if(d<best){best=d;who=o.tag+':'+o.name;}}}return [best,who];}
const readPose=p=>{const f=sub(p.target,p.position),l=Math.hypot(...f);return {position:p.position,target:add(p.position,f.map(x=>x/l*8)),fovVerticalDeg:p.fovVerticalDeg};};
const start1=readPose(Cam.islandPoseEntry());
const skyFrame=place(local.skycity_frame||[],'skycity',yaw,1,sOff);
module.exports={fs,path,zlib,crypto,assert,createHarness,loadGlb,ROOT,B,S,H,Lay,Core,Cam,Visit,L,sampleRoute,routeLength,journeyCamera,JOURNEY_CAMERA,sha,meta,bin,f32,local,meadowNodes,skyNodes,rotY,place,nodePos,add,sub,props,island,anchorsIsland,start,mp,edge1,mOff,meadow,mA,edge2,sp,yaw,deck0,sOff,sky,sA,bbox,segBox,rayHit,blockers,ptTri,clearance,readPose,start1,skyFrame};
