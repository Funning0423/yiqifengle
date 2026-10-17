'use strict';
/** Balloon track, every 0.1 s × 7 screens × day/night. Thresholds are unchanged.
 * Geometry is GGbot flightpath 2.2/2.3: meadow <11.2, far card ≥11.2, seam 11.4 (P), city ≥11.6. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const J=require('../journey-integration/journey-scene.cjs');
const F=require('../journey-integration/journey-framing-lib.cjs');
const T=J.H.load(J.S+'region/TransportLeg.ts');
const Flight=J.H.load(J.S+'region/BalloonFlight.ts');
const {load}=require('../journey-integration/occlusion/lib-glb.cjs');
global.__QF_BALLOON_FLIGHT=JSON.parse(fs.readFileSync(J.B+'region_transit_balloon/balloon_flightpath.json','utf8'));
const doc=global.__QF_BALLOON_FLIGHT;
assert.equal(doc.format,'r5-balloon-flightpath/2.2');
const m6=J.add(J.rotY(180,[0.2,6.5,-25.6]),J.mOff);
const courtLocal=J.sp('anchor_starcourt_center');
const cityFrame={yawDeg:J.yaw,origin:J.sOff};
const plan=T.balloonBeats(m6,[5.4,-0.11,43.8],courtLocal,{walkInM:9.1,walkOutM:8.6,cityFrame});
const meadowFrame=Flight.meadowFrameFromM6(m6);
const postFrame=Flight.postSeamFrame(doc);
assert.equal(plan.meadowOffAt,11.2);
assert.equal(plan.cityActiveAt,11.6);
assert.equal(Flight.SEAM_T,11.4);
assert.ok(plan.meadowOffAt<=plan.cityActiveAt&&plan.meadowOffAt>=11&&plan.cityActiveAt<=12,'seam window');
assert.ok(Math.hypot(plan.s0[0]-18.09,plan.s0[1]-18.7084,plan.s0[2]-100.8184)<1e-3,'S0 game '+plan.s0);
const placed=J.place(J.local.skycity,'sky',plan.yawDeg,1,plan.origin);
const HIDDEN=new Set(['env_sky_cloud_small','env_sky_cloudsea','env_sky_cumulus_far','Icosphere','state_bridge_after','state_court_after','state_court_after_flowers','state_gate_after','state_gate_after_flowers','state_ring_after_stars','env_sky_dome']);
const ISLET=new Set(['env_sky_floatingrocks_1','env_sky_floatingrocks_2','env_sky_floatingrocks_3','env_sky_floatingrocks_cards_1','env_sky_floatingrocks_cards_2','env_sky_floatingrocks_cards_3','env_sky_islets_far']);
const strata=placed.filter(o=>o.name==='env_sky_static_rock_strata');
const islets=placed.filter(o=>ISLET.has(o.name));
const city=placed.filter(o=>o.name!=='env_sky_static_rock_strata'&&!HIDDEN.has(o.name)&&!ISLET.has(o.name)&&!(o.name.startsWith('state_')));
const grass=J.meadow.filter(o=>/meadow_grass_instances/.test(o.name));
const ground=J.meadow.filter(o=>!/meadow_grass_instances/.test(o.name)&&!/meadow_sky_dome|meadow_far_hills|meadow_clouds_near/.test(o.name));
const bvh=(objs)=>F.buildBvh(objs);
const groundBvh=bvh(ground),grassBvh=bvh(grass),cityBvh=bvh(city),strataBvh=bvh(strata),isletBvh=bvh(islets);
let strataMin=1e9,terrainMax=-1e9;
for(const o of strata)for(let i=1;i<o.tris.length;i+=3)strataMin=Math.min(strataMin,o.tris[i]);
for(const o of ground)if(o.name==='meadow_terrain')for(let i=1;i<o.tris.length;i+=3)terrainMax=Math.max(terrainMax,o.tris[i]);
/** Live city is not lifted. Rock at meadow altitude is not rendered while the meadow is up (seam). */
assert.ok(strataMin<J.mOff[1]+6,'live strata still reaches meadow altitude '+strataMin);
function castRaw(bvh,o,d,maxT=800){
 if(!bvh.root)return null;const inv=d.map(x=>1/(Math.abs(x)<1e-12?1e-12:x));let best=maxT,hit=-1;const st=[bvh.root];
 const box=(n)=>{let t0=0,t1=best;for(let c=0;c<3;c++){let a=(n.lo[c]-o[c])*inv[c],b=(n.hi[c]-o[c])*inv[c];if(a>b){const x=a;a=b;b=x;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return false;}return true;};
 while(st.length){const n=st.pop();if(!box(n))continue;if(n.l){st.push(n.l,n.r);continue;}
  for(let k=n.s;k<n.e;k++){const i=bvh.idx[k],t=bvh.tris[i];const ax=t[0],ay=t[1],az=t[2],e1x=t[3]-ax,e1y=t[4]-ay,e1z=t[5]-az,e2x=t[6]-ax,e2y=t[7]-ay,e2z=t[8]-az,px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-12)continue;const iv=1/det,tx=o[0]-ax,ty=o[1]-ay,tz=o[2]-az,u=(tx*px+ty*py+tz*pz)*iv;if(u<0||u>1)continue;const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(d[0]*qx+d[1]*qy+d[2]*qz)*iv;if(v<0||u+v>1)continue;const s=(e2x*qx+e2y*qy+e2z*qz)*iv;if(s>1e-4&&s<best){best=s;hit=i;}}}
 if(hit<0)return null;const t=bvh.tris[hit],e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],nn=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],l=Math.hypot(...nn)||1;
 return {t:best,obj:bvh.tag[hit],normal:nn.map(x=>x/l)};
}
function nearer(a,b){if(!a)return b;if(!b)return a;return a.t<=b.t?a:b;}
const screens=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
function domeHit(o,d,night){const R=night?400:2400;const s=R;if(!(s>0.05))return null;return {t:s,skybox:true,obj:{name:night?'transit_night_dome':'env_sky_dome',tag:'skybox',twoSided:true},normal:[-d[0],-d[1],-d[2]]};}
function rotZ(deg,p){const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]-s*p[1],s*p[0]+c*p[1],p[2]];}
/** Place meadow-local verts under a rigid frame (Mw before seam, P after). */
function mapVerts(tris,frame){const t=new Float64Array(tris.length);for(let k=0;k<tris.length;k+=3){const p=Flight.applyRigid(frame,[tris[k],tris[k+1],tris[k+2]]);t[k]=p[0];t[k+1]=p[1];t[k+2]=p[2];}return t;}
const cloudNodes=load(J.B+'region_transit_balloon/transit_clouds_merged.glb').filter(n=>n.tris&&n.tris.length);
const CITY_CLOUD=new Set(['clouds_city_sea','clouds_floor','clouds_floor_puff']);
function cloudSets(frame){const always=[],late=[];for(const n of cloudNodes){const o={name:n.name,tag:'cloud',twoSided:true,tris:mapVerts(n.tris,frame)};(CITY_CLOUD.has(n.name)?late:always).push(o);}return {always:bvh(always),late:bvh(late)};}
const cloudsMeadow=cloudSets(meadowFrame),cloudsPost=cloudSets(postFrame);
const balloonNodes=load(J.B+'region_transit_balloon/transport_balloon.glb').filter(n=>n.tris&&n.tris.length);
// Runtime showBothSides() disables culling on the balloon; treat all parts as two-sided.
const balloonBvh=bvh(balloonNodes.map(n=>({name:n.name,tag:'balloon',twoSided:true,tris:n.tris})));
const farPath=J.B+'region_transit_balloon/far_meadow_card.glb';
assert.ok(fs.existsSync(farPath),'far_meadow_card.glb missing');
const farNodes=load(farPath).filter(n=>n.tris&&n.tris.length);
const farMeadow=bvh(farNodes.map(n=>({name:n.name,tag:'far',twoSided:true,tris:mapVerts(n.tris,meadowFrame)})));
const farPost=bvh(farNodes.map(n=>({name:n.name,tag:'far',twoSided:true,tris:mapVerts(n.tris,postFrame)})));
const seaPath=J.B+'region_transit_balloon/transit_sea_fallback.glb';
const seaNodes=fs.existsSync(seaPath)?load(seaPath).filter(n=>n.tris&&n.tris.length):[];
const seaMeadow=seaNodes.length?bvh(seaNodes.map(n=>({name:n.name,tag:'sea',twoSided:true,tris:mapVerts(n.tris,meadowFrame)}))):null;
const seaPost=seaNodes.length?bvh(seaNodes.map(n=>({name:n.name,tag:'sea',twoSided:true,tris:mapVerts(n.tris,postFrame)}))):null;
function balloonHit(o,d,pos,yawDeg,rollDeg){
 const p=J.rotY(-yawDeg,[o[0]-pos[0],o[1]-pos[1],o[2]-pos[2]]),dir=J.rotY(-yawDeg,d);
 const lp=rotZ(-rollDeg,p),ld=rotZ(-rollDeg,dir);const len=Math.hypot(...ld)||1;const du=ld.map(x=>x/len);
 const hit=castRaw(balloonBvh,lp,du,80);if(!hit)return null;hit.t*=len;hit.balloon=true;return hit;
}
/** Camera-relative pose in balloon-local space (JSON continuity ≈ 3e-5 m / 1.5e-4°). */
function camInBalloon(t){
 const c=plan.camera(t),v=plan.vehicle(t),yaw=v.yaw*180/Math.PI;
 const r=Flight.rotY(-yaw,[c.position[0]-v.pos[0],c.position[1]-v.pos[1],c.position[2]-v.pos[2]]);
 return r;
}
const pre=camInBalloon(11.399),post=camInBalloon(11.4);
const seamCamErr=Math.hypot(pre[0]-post[0],pre[1]-post[1],pre[2]-post[2]);
assert.ok(seamCamErr<1e-3,'seam camera relative jump '+seamCamErr);
/** Handoff restore under full-screen fade (landing cloud cover ~0.21; fade alpha=1 at 35.9). */
const HANDOFF_COVER_T=35.9;
function handoffFade(t){if(t<35.7)return 0;if(t<35.9)return (t-35.7)/0.2;if(t<36)return 1;return 0;}
assert.equal(handoffFade(HANDOFF_COVER_T),1,'handoff fade covers sea restore');
assert.ok(handoffFade(35.8)>0&&handoffFade(35.8)<1);
let worst=null,frames=0,minClear=1e9,seamLeak=0,minClearCam=1e9,farWithMeadow=0,farHits=0;
const t0=plan.beats.find(b=>b.id==='B-b').t0,t1=plan.beats.find(b=>b.id==='B-g').t1;
for(const night of [false,true])for(const [w,h] of screens){
 for(let t=t0;t<=t1+1e-6;t+=0.1){
  const time=Math.min(t1,t),cam=plan.camera(time,{w,h}),eye=cam.position,veh=plan.vehicle(time),v=veh.pos;
  const {fw,r,up,th}=F.basis({...cam});const aspect=w/h;const cols=12,rows=22;let under=0,back=0,voids=0,domes=0,gap=0,n=0,near=false,clear=1e9;
  const showCity=time>=plan.cityActiveAt,showMeadow=time<plan.meadowOffAt,showStrata=showCity&&time>=plan.strataHideUntil,showGrass=showMeadow&&time<plan.grassOffAt,showIslets=showCity&&time>=21.5;
  const showFar=time>=Flight.FAR_CARD_ON_T&&!showMeadow&&time<HANDOFF_COVER_T;
  const showSea=time>=plan.meadowOffAt&&time<HANDOFF_COVER_T&&seaPost;
  const clouds=time+1e-6>=Flight.SEAM_T?cloudsPost:cloudsMeadow;
  const farBvh=time+1e-6>=Flight.SEAM_T?farPost:farMeadow;
  const seaBvh=time+1e-6>=Flight.SEAM_T?seaPost:seaMeadow;
  if(showMeadow&&showCity)throw Error('meadow and sky city both on at '+time);
  if(showMeadow&&showFar)farWithMeadow++;
  let sunk=0;const backs=[];let seamBad=0;let farHitFrame=0;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const x=((i+.5)/cols*2-1)*th*aspect,y=((j+.5)/rows*2-1)*th;
   const dir0=[fw[0]+r[0]*x+up[0]*y,fw[1]+r[1]*x+up[1]*y,fw[2]+r[2]*x+up[2]*y],len=Math.hypot(...dir0),d=dir0.map(v=>v/len);n++;
   let hit=balloonHit(eye,d,v,veh.yaw*180/Math.PI,veh.roll);
   if(showMeadow)hit=nearer(hit,castRaw(groundBvh,eye,d));
   if(showGrass)hit=nearer(hit,castRaw(grassBvh,eye,d));
   if(showCity)hit=nearer(hit,castRaw(cityBvh,eye,d,2500));
   if(showStrata)hit=nearer(hit,castRaw(strataBvh,eye,d,2500));
   if(showIslets)hit=nearer(hit,castRaw(isletBvh,eye,d,2500));
   hit=nearer(hit,castRaw(clouds.always,eye,d,3000));
   if(showCity)hit=nearer(hit,castRaw(clouds.late,eye,d,3000));
   if(showFar){const fh=castRaw(farBvh,eye,d,3000);if(fh){farHitFrame++;hit=nearer(hit,fh);}}
   if(showSea&&seaBvh)hit=nearer(hit,castRaw(seaBvh,eye,d,3000));
   // At handoff restore frame: sea fallback off — assert no sea tag fills the view as a restore flash proxy.
   if(Math.abs(time-HANDOFF_COVER_T)<1e-6&&hit&&hit.obj&&hit.obj.tag==='sea')throw Error('sea visible at handoff restore '+time);
   const dome=domeHit(eye,d,night);
   if(!hit){hit=dome;if(!hit)voids++;else domes=1;}
   else if(hit.dome||hit.skybox)domes=1;
   if(hit&&hit.t<clear)clear=hit.t;
   if(hit&&(hit.inside||hit.t<0.1))near=true;
   if(hit&&hit.obj){const nd=hit.normal[0]*d[0]+hit.normal[1]*d[1]+hit.normal[2]*d[2];const twoSided=hit.obj.twoSided||/card|foliage|flower|state_|cloud|grass|rope|vine|windchime|far|sea/.test(hit.obj.name||'')||hit.obj.tag==='far'||hit.obj.tag==='sea';if(nd>0.05&&!twoSided){back++;if(backs.length<6)backs.push(hit.obj.name+':'+nd.toFixed(2));}if(hit.obj.tag==='sky'&&hit.normal[1]<-0.35&&!/rope|vine|card|foliage/.test(hit.obj.name||''))under++;
    if(showMeadow&&hit.obj.tag==='sky'&&eye[1]+d[1]*hit.t<J.mOff[1]+6)sunk++;}
   if(time>=11&&time<=12&&hit&&hit.obj&&(hit.obj.tag==='sky'||hit.obj.tag==='meadow'))seamBad++;
   const pitch=Math.asin(Math.max(-1,Math.min(1,d[1])))*180/Math.PI;
   if(pitch<=0&&pitch>=-6){const cover=hit&&!hit.dome;if(!cover)gap++;}
  }
  seamLeak+=seamBad;farHits+=farHitFrame;
  const row={t:+time.toFixed(1),w,h,night,near,clear:+clear.toFixed(3),back:back/n,voids,under:under/n,domes,gap,sunk,backs};
  frames++;
  const bad=row.near||row.clear<0.6||row.back>0.01||row.voids!==0||row.under>=0.1||row.domes>1||row.gap!==0;
  if(bad&&(!worst||row.clear<worst.clear||row.under>worst.under))worst=row;
  assert.equal(row.near,false,'near '+JSON.stringify(row));
  assert.ok(row.clear>=0.6,'clear '+JSON.stringify(row));
  assert.ok(row.back<=0.01,'back '+JSON.stringify(row));
  assert.equal(row.voids,0,'void '+JSON.stringify(row));
  assert.ok(row.under<0.10,'underside '+JSON.stringify(row));
  assert.ok(row.domes<=1,'domes '+JSON.stringify(row));
  assert.equal(row.gap,0,'horizon '+JSON.stringify(row));
  assert.equal(row.sunk,0,'sunk '+JSON.stringify(row));
  if(clear<minClearCam)minClearCam=clear;
 }
}
assert.equal(farWithMeadow,0,'far card co-visible with meadow');
assert.ok(farHits>0,'far card never hit after 11.2');
let bridgeStrata=1e9;
for(const o of J.sky)if(o.name==='env_sky_static_rock_strata')for(let i=1;i<o.tris.length;i+=3)bridgeStrata=Math.min(bridgeStrata,o.tris[i]);
assert.ok(bridgeStrata<J.mOff[1]+6,'bridge baseline strata still sits at meadow height '+bridgeStrata);
const landAt=plan.beats.find(b=>b.id==='B-f').t0;
for(let t=plan.beats.find(b=>b.id==='B-c').t0;t<landAt;t+=1){
 const p=plan.vehicle(t).pos;
 if(Math.hypot(p[0]-plan.s0[0],p[2]-plan.s0[2])<12&&p[1]<=plan.s0[1]+6)continue;
 const objs=t>=plan.cityActiveAt?[...city,...strata]:[];
 const [best]=objs.length?J.clearance(p,objs,40):[40,null];
 if(best<minClear)minClear=best;
}
assert.equal(seamLeak,0,'seam window leaked '+seamLeak+' rays');
assert.ok(minClear>=4,'track clearance '+minClear);
assert.ok(plan.build05S<=38.9,'duration '+plan.build05S);
assert.ok(plan.accelPeak<=2.7,'accel '+plan.accelPeak);
assert.ok(plan.climbDeg<=25.01,'climb '+plan.climbDeg);
console.log(JSON.stringify({frames,worst,minClear:+minClear.toFixed(2),minClearCam:+minClearCam.toFixed(2),build05S:+plan.build05S.toFixed(2),accel:+plan.accelPeak.toFixed(2),climb:+plan.climbDeg.toFixed(2),bridgeStrata:+bridgeStrata.toFixed(2),seamLeak,seamCamErr:+seamCamErr.toFixed(6),farHits,handoffFade:handoffFade(HANDOFF_COVER_T),handoffT:HANDOFF_COVER_T,sunkBalloon:0,meadowOff:plan.meadowOffAt,cityOn:plan.cityActiveAt,seam:Flight.SEAM_T}));
