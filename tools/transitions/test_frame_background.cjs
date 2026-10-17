'use strict';
/** Balloon track, every 0.1 s × 7 screens × day/night. Ray rules follow the audit (no normal flip). */
const assert=require('node:assert/strict');
const J=require('../journey-integration/journey-scene.cjs');
const F=require('../journey-integration/journey-framing-lib.cjs');
const T=J.H.load(J.S+'region/TransportLeg.ts');
const m6=J.add(J.rotY(180,[0.2,6.5,-25.6]),J.mOff);
const courtLocal=J.sp('anchor_starcourt_center');
const plan=T.balloonBeats(m6,[5.4,-0.11,43.8],courtLocal,{walkInM:9.1,walkOutM:8.6});
const placed=J.place(J.local.skycity,'sky',plan.yawDeg,1,plan.origin);
const strata=placed.filter(o=>o.name==='env_sky_static_rock_strata');
const city=placed.filter(o=>o.name!=='env_sky_static_rock_strata'&&!/cloudsea|env_sky_dome/.test(o.name)&&!(o.name.startsWith('state_')&&o.name!=='state_bridge_after'));
const grass=J.meadow.filter(o=>/meadow_grass_instances/.test(o.name));
const ground=J.meadow.filter(o=>!/meadow_grass_instances/.test(o.name));
const bvh=(objs)=>F.buildBvh(objs);
const groundBvh=bvh(ground),grassBvh=bvh(grass),cityBvh=bvh(city),strataBvh=bvh(strata);
let strataMin=1e9,terrainMax=-1e9;
for(const o of strata)for(let i=1;i<o.tris.length;i+=3)strataMin=Math.min(strataMin,o.tris[i]);
for(const o of ground)if(o.name==='meadow_terrain')for(let i=1;i<o.tris.length;i+=3)terrainMax=Math.max(terrainMax,o.tris[i]);
const gate=T.strataClearsGround(plan.origin[1],strataMin-plan.origin[1],terrainMax);
assert.equal(gate.ok,true,'strata ymin '+gate.ymin+' need '+gate.need);
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
const domeR=480;
function domeHit(o,d){const c=[o[0],o[1]+40,o[2]],oc=[o[0]-c[0],o[1]-c[1],o[2]-c[2]],b=oc[0]*d[0]+oc[1]*d[1]+oc[2]*d[2],h=b*b-(oc[0]*oc[0]+oc[1]*oc[1]+oc[2]*oc[2]-domeR*domeR);if(h<0)return null;const s=-b+Math.sqrt(h);if(!(s>0.05))return null;const p=[o[0]+d[0]*s,o[1]+d[1]*s,o[2]+d[2]*s];const n=[c[0]-p[0],c[1]-p[1],c[2]-p[2]],nl=Math.hypot(...n)||1;return {t:s,dome:true,normal:n.map(x=>x/nl)};}
function seaHit(o,d){if(Math.abs(d[1])<1e-8)return null;const t=(-0.92-o[1])/d[1];if(!(t>0.05))return null;return {t,sea:true,normal:[0,1,0]};}
function cloudHit(o,d,show){if(!show)return null;const y=plan.cloudY,t=(y-o[1])/d[1];if(!(t>0.05&&t<400))return null;const x=o[0]+d[0]*t,z=o[2]+d[2]*t,r=Math.hypot(x-plan.cloudAt[0],z-plan.cloudAt[2]);if(r<4.5||r>16)return null;return {t,cloud:true,normal:[0,d[1]>0?-1:1,0]};}
function cardHit(o,d){
 const R=150,a=d[0]*d[0]+d[2]*d[2];if(a<1e-8)return null;
 const b=2*(o[0]*d[0]+o[2]*d[2]),c=o[0]*o[0]+o[2]*o[2]-R*R,h=b*b-4*a*c;if(h<0)return null;
 const s1=(-b-Math.sqrt(h))/(2*a),s2=(-b+Math.sqrt(h))/(2*a),s=s1>0.05?s1:s2;if(!(s>0.05))return null;const y=o[1]+d[1]*s;if(y<-30||y>120)return null;
 return {t:s,card:true,normal:[0,1,0]};
}
function balloonHit(o,d,center){const oc=[o[0]-center[0],o[1]-center[1],o[2]-center[2]],b=oc[0]*d[0]+oc[1]*d[1]+oc[2]*d[2],c=oc[0]*oc[0]+oc[1]*oc[1]+oc[2]*oc[2]-3.2*3.2,h=b*b-c;if(h<0)return null;const s=-b-Math.sqrt(h);if(s>0.02)return {t:s,balloon:true,normal:[0,1,0]};if(c<0)return {t:0.01,balloon:true,inside:true,normal:[0,1,0]};return null;}
let worst=null,frames=0,minClear=1e9;
const t0=plan.beats.find(b=>b.id==='B-b').t0,t1=plan.beats.find(b=>b.id==='B-g').t1;
for(const night of [false,true])for(const [w,h] of screens){
 for(let t=t0;t<=t1+1e-6;t+=0.1){
  const time=Math.min(t1,t),cam=plan.camera(time,{w,h}),eye=cam.position,v=plan.vehicle(time).pos;
  const {fw,r,up,th}=F.basis({...cam});const aspect=w/h;const cols=12,rows=22;let under=0,back=0,voids=0,domes=0,gap=0,n=0,near=false,clear=1e9;
  const showCity=time>=plan.cityActiveAt,showStrata=time>=plan.strataHideUntil&&showCity,showGrass=time<plan.grassOffAt,showCloud=time>=plan.beats.find(b=>b.id==='B-d').t0&&time<=plan.beats.find(b=>b.id==='B-e').t1;
  const center=[v[0],v[1]+4.2,v[2]];let sunk=0;const backs=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const x=((i+.5)/cols*2-1)*th*aspect,y=((j+.5)/rows*2-1)*th;
   const dir0=[fw[0]+r[0]*x+up[0]*y,fw[1]+r[1]*x+up[1]*y,fw[2]+r[2]*x+up[2]*y],len=Math.hypot(...dir0),d=dir0.map(v=>v/len);n++;
   let hit=balloonHit(eye,d,center);
   hit=nearer(hit,castRaw(groundBvh,eye,d));
   if(showGrass)hit=nearer(hit,castRaw(grassBvh,eye,d));
   if(showCity)hit=nearer(hit,castRaw(cityBvh,eye,d));
   if(showStrata)hit=nearer(hit,castRaw(strataBvh,eye,d));
   hit=nearer(hit,cloudHit(eye,d,showCloud));
   hit=nearer(hit,cardHit(eye,d));
   hit=nearer(hit,seaHit(eye,d));
   const dome=domeHit(eye,d);
   if(!hit){hit=dome;if(!hit)voids++;else domes=1;}
   else if(hit.dome)domes=1;
   else if(dome&&!hit){hit=dome;domes=1;}
   if(hit&&hit.t<clear)clear=hit.t;
   if(hit&&(hit.inside||hit.t<0.1))near=true;
   if(hit&&hit.obj){const nd=hit.normal[0]*d[0]+hit.normal[1]*d[1]+hit.normal[2]*d[2];const twoSided=/card|foliage|flower|state_/.test(hit.obj.name||'');if(nd>0.05&&!twoSided){back++;if(backs.length<6)backs.push(hit.obj.name+':'+nd.toFixed(2));}if(hit.obj.tag==='sky'&&hit.normal[1]<-0.35)under++;
    if(hit.obj.tag==='sky'&&eye[1]+d[1]*hit.t<J.mOff[1]+6)sunk++;}
   const pitch=Math.asin(Math.max(-1,Math.min(1,d[1])))*180/Math.PI;
   if(pitch<=0&&pitch>=-6){const cover=hit&&!hit.dome;if(!cover)gap++;}
  }
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
 }
}
let bridgeStrata=1e9;
for(const o of J.sky)if(o.name==='env_sky_static_rock_strata')for(let i=1;i<o.tris.length;i+=3)bridgeStrata=Math.min(bridgeStrata,o.tris[i]);
assert.ok(bridgeStrata<J.mOff[1]+6,'bridge baseline strata still sits at meadow height '+bridgeStrata);
const landAt=plan.beats.find(b=>b.id==='B-f').t0;
for(let t=plan.beats.find(b=>b.id==='B-c').t0;t<landAt;t+=1){
 const p=plan.vehicle(t).pos;
 if(Math.hypot(p[0]-plan.s0[0],p[2]-plan.s0[2])<12&&p[1]<=plan.s0[1]+6)continue;
 const [best]=J.clearance(p,[...city,...strata],40);
 if(best<minClear)minClear=best;
}
assert.ok(minClear>=4,'track clearance '+minClear);
assert.ok(plan.build05S<=38.9,'duration '+plan.build05S);
assert.ok(plan.accelPeak<=2.7,'accel '+plan.accelPeak);
assert.ok(plan.climbDeg<=25.01,'climb '+plan.climbDeg);
console.log(JSON.stringify({frames,worst,minClear:+minClear.toFixed(2),build05S:+plan.build05S.toFixed(2),accel:+plan.accelPeak.toFixed(2),climb:+plan.climbDeg.toFixed(2),strata:gate,bridgeStrata:+bridgeStrata.toFixed(2),sunkBalloon:0}));
