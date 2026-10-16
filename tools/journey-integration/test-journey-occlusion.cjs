#!/usr/bin/env node
'use strict';
/* Build05 journey occlusion contract (Oi FAIL 2026-10-16: 04→05 palm close-up at 3.32 m; 08→09 character under
 * env_sky_static_palette, invisible at 32.22 m). Rebuilds both legs exactly as RegionJourneyAdapter does, from the real
 * TypeScript (RegionJourneyLayout, RegionJourneyCore.journeyCamera, RegionCameraData) and the real GLB geometry
 * (meadow read directly; Draco GLBs via the SHA-pinned fixture in occlusion/). Samples every 0.05 m and asserts:
 *   O1 character not occluded: camera→body segments at 0.15/0.5/0.9/1.25/1.6 m (Möller–Trumbore); chest and head must
 *      be visible and at most one low point may graze an edge (grazes are listed in the report)
 *   O2 lens clearance ≥ 1 m from all geometry (no near-plane close-ups)
 *   O3 foot point is above the sky platform/rock top along bridge + deck; bridge corridor (2.1 m × 2 m) is free
 *   O4 09 arrival: the board background (own camera, SkycityVisitPose) pose is byte-for-byte the Build05 pose and
 *      still frames the plaza; the arrival root relative to the city is unchanged.
 * Exemption, reported not hidden: leg 04→05 samples with d < 1.25 m, where the lens is still ≥80% the authored
 * island pose (v24-readable). That pose is unchanged by this fix and owned by the island camera work.
 * No browser, engine or rendering. A pass is geometric evidence, not native visual acceptance. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createHarness}=require('../board-ui/harness.cjs'),{load:loadGlb}=require('./occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../..'),B=ROOT+'/creator-build-project/assets/bundles/',S=ROOT+'/creator-build-project/assets/scripts/';
const H=createHarness(),Lay=H.load(S+'region/RegionJourneyLayout.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts'),Cam=H.load(S+'world-r1/RegionCameraData.ts'),Visit=H.load(S+'region/SkycityVisitPose.ts');
const L=Lay.REGION_JOURNEY_LAYOUT,{sampleRoute,routeLength,journeyCamera,JOURNEY_CAMERA}=Core;
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const results=[];const check=(id,fn)=>{try{results.push({id,status:'PASS',...fn()});}catch(e){results.push({id,status:'FAIL',error:String(e.stack||e)});}};
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
// ---------- routes, exactly as RegionJourneyAdapter.prepare ----------
const mp=n=>nodePos(meadowNodes,n);
const appr1=Lay.islandApproach(start),edge1=appr1.at(-1),mOff=sub(add(edge1,L.meadowOffset),rotY(180,mp('player_spawn')));
const meadow=place(local.meadow,'meadow',180,1,mOff),mA=n=>add(rotY(180,mp(n)),mOff);
const bridge1=Lay.bridgePath(edge1,mA('player_spawn'),L.meadowBridgeArchM),leg1=[...appr1,...bridge1.slice(1),mA('walk_path_01'),mA('walk_path_02')];
const appr2=[leg1.at(-1)];for(let i=3;i<=L.meadowExitPathIndex;i++)appr2.push(mA('walk_path_'+String(i).padStart(2,'0')));const edge2=appr2.at(-1);
const sp=n=>nodePos(skyNodes,n),yaw=Lay.skycityYawDeg(sp('anchor_cloudbridge_end'),sp('anchor_cloudbridge_start'));
const deck0=Lay.skyDeckRoute(rotY(yaw,sp('anchor_cloudbridge_end')),rotY(yaw,sp('anchor_cloudbridge_start'))),sOff=sub(add(edge2,L.skycityOffset),deck0.rim);
const sky=place(local.skycity,'skycity',yaw,1,sOff),sA=n=>add(rotY(yaw,sp(n)),sOff);
const deck=Lay.skyDeckRoute(sA('anchor_cloudbridge_end'),sA('anchor_cloudbridge_start')),bridge2=Lay.bridgePath(edge2,deck.rim,L.skyBridgeArchM);
const leg2=[...appr2,...bridge2.slice(1),...deck.deck,deck.arrival],focus2=sA('anchor_starcourt_center');
// ---------- ray tests ----------
function bbox(t){const a=[1e9,1e9,1e9],b=[-1e9,-1e9,-1e9];for(let k=0;k<t.length;k++){const c=k%3;if(t[k]<a[c])a[c]=t[k];if(t[k]>b[c])b[c]=t[k];}return [a,b];}
function segBox(o,e,[a,b]){let t0=0,t1=1;for(let c=0;c<3;c++){const d=e[c]-o[c];if(Math.abs(d)<1e-12){if(o[c]<a[c]||o[c]>b[c])return false;continue;}let p=(a[c]-o[c])/d,q=(b[c]-o[c])/d;if(p>q)[p,q]=[q,p];t0=Math.max(t0,p);t1=Math.min(t1,q);if(t0>t1)return false;}return true;}
function rayHit(o,d,maxT,t){let best=null;for(let k=0;k<t.length;k+=9){const ax=t[k],ay=t[k+1],az=t[k+2],e1x=t[k+3]-ax,e1y=t[k+4]-ay,e1z=t[k+5]-az,e2x=t[k+6]-ax,e2y=t[k+7]-ay,e2z=t[k+8]-az,px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-12)continue;const iv=1/det,tx=o[0]-ax,ty=o[1]-ay,tz=o[2]-az,u=(tx*px+ty*py+tz*pz)*iv;if(u<0||u>1)continue;const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(d[0]*qx+d[1]*qy+d[2]*qz)*iv;if(v<0||u+v>1)continue;const s=(e2x*qx+e2y*qy+e2z*qz)*iv;if(s>1e-4&&s<maxT&&(best===null||s<best))best=s;}return best;}
function blockers(objs,o,e){const d=sub(e,o),l=Math.hypot(...d),u=d.map(x=>x/l),out=[];for(const ob of objs){ob.bb??=bbox(ob.tris);if(!segBox(o,e,ob.bb))continue;if(rayHit(o,u,l-.05,ob.tris)!==null)out.push(ob.tag+':'+ob.name);}return out;}
function ptTri(p,a,b,c){const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];const d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return a;const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return add(a,ab.map(x=>x*v));}const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return add(a,ac.map(x=>x*w));}const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/(d4-d3+d5-d6);return add(b,sub(c,b).map(x=>x*w));}const den=1/(va+vb+vc),v=vb*den,w=vc*den;return add(a,add(ab.map(x=>x*v),ac.map(x=>x*w)));}
function clearance(p,objs,cap=3){let best=cap,who=null;for(const o of objs){o.bb??=bbox(o.tris);let dd=0;for(let c=0;c<3;c++){const v=Math.max(o.bb[0][c]-p[c],0,p[c]-o.bb[1][c]);dd+=v*v;}if(Math.sqrt(dd)>=best)continue;const t=o.tris;for(let k=0;k<t.length;k+=9){if(Math.abs(t[k]-p[0])>best+25||Math.abs(t[k+2]-p[2])>best+25||Math.abs(t[k+1]-p[1])>best+25)continue;const q=ptTri(p,[t[k],t[k+1],t[k+2]],[t[k+3],t[k+4],t[k+5]],[t[k+6],t[k+7],t[k+8]]),d=Math.hypot(...sub(q,p));if(d<best){best=d;who=o.tag+':'+o.name;}}}return [best,who];}
const readPose=p=>{const f=sub(p.target,p.position),l=Math.hypot(...f);return {position:p.position,target:add(p.position,f.map(x=>x/l*8)),fovVerticalDeg:p.fovVerticalDeg};};
const STEP=+(process.env.QF_OCCLUSION_STEP||.05),EXEMPT=1.25,HEIGHTS=[.15,.5,.9,1.25,1.6];
const start1=readPose(Cam.islandPoseEntry()),legs=[{id:'04-05',path:leg1,objs:[...island,...meadow],start:start1,exempt:EXEMPT,bridge:bridge1},{id:'08-09',path:leg2,objs:[...island,...meadow,...sky],start:readPose(journeyCamera(leg1,routeLength(leg1),start1)),exempt:0,bridge:bridge2,focus:focus2}];
const profile={};
for(const leg of legs){const T=routeLength(leg.path),fails=[],exempted=[],grazes=[],rows=[];let minLens=9;
 for(let i=0;i*STEP<=T+1e-9;i++){const d=Math.min(T,i*STEP),p=sampleRoute(leg.path,d),c=journeyCamera(leg.path,d,leg.start,leg.focus),hit=HEIGHTS.map(h=>blockers(leg.objs,c.position,[p[0],p[1]+h,p[2]])),[lens,lensObj]=clearance(c.position,leg.objs),hidden=hit.filter(h=>h.length).length;
  if(d>=leg.exempt)minLens=Math.min(minLens,lens);// Occluded = chest (0.9 m) or head (1.6 m) hidden, or more than one of the five body points hidden. A lone graze of
  // one low point by a pebble/grass edge is reported in partialGrazes, not failed.
  const rec={d:+d.toFixed(2),hidden:Object.fromEntries(HEIGHTS.map((h,k)=>[h,hit[k]]).filter(x=>x[1].length)),lens:+lens.toFixed(2),lensObj};
  const bad=hit[2].length>0||hit[4].length>0||hidden>1||lens<1;
  if(bad)(d<leg.exempt?exempted:fails).push(rec);else if(hidden)grazes.push(rec);
  if(Math.abs(d/.5-Math.round(d/.5))<1e-6||i*STEP>T-STEP)rows.push({d:+d.toFixed(2),x:+p[0].toFixed(3),y:+p[1].toFixed(3),z:+p[2].toFixed(3),cam:c.position.map(v=>+v.toFixed(2))});}
 profile[leg.id]={total:+T.toFixed(4),rows};
 check(`O1/O2 ${leg.id} character visible + lens ≥1 m every ${STEP} m`,()=>{assert.deepEqual(fails,[],JSON.stringify(fails.slice(0,8)));return {total:+T.toFixed(4),samples:Math.floor(T/STEP)+1,minLensM:+minLens.toFixed(2),exemptedAuthoredIslandPoseSamples:exempted,partialGrazes:grazes};});}
// O3 foot above platform/rock top, bridge corridor free
const solidSky=sky.filter(o=>/static_palette|rock_strata|ruins|foliage/.test(o.name));
check('O3 08-09 foot above env_sky_static_palette top on bridge+deck',()=>{const T=routeLength(leg2),b0=routeLength(appr2),worst={d:0,clear:1e9};const rows=[];
 for(let d=b0;d<=T+1e-9;d+=STEP){const p=sampleRoute(leg2,d);let top=-1e9,who=null;for(const o of solidSky){o.bb??=bbox(o.tris);if(p[0]<o.bb[0][0]||p[0]>o.bb[1][0]||p[2]<o.bb[0][2]||p[2]>o.bb[1][2])continue;const t=rayHit([p[0],p[1]+6,p[2]],[0,-1,0],80,o.tris);if(t!==null&&p[1]+6-t>top){top=p[1]+6-t;who=o.name;}}
  const clear=top>-1e8?p[1]-top:null;if(clear!==null&&clear<worst.clear)Object.assign(worst,{d:+d.toFixed(2),clear:+clear.toFixed(3),who});if(clear!==null)rows.push(clear);assert(clear===null||clear>=-.03,`foot ${clear?.toFixed(3)} m vs ${who} top at d=${d.toFixed(2)}`);}
 return {worstFootClearanceM:worst,deckSamples:rows.length,oiReference:'Build05: −2.27 m at 32.22 m (Oi); this harness measured −6.11 m at 32.0 m on the old route'};});
for(const [id,br,objs] of [['04-05',bridge1,[...island,...meadow]],['08-09',bridge2,[...island,...meadow,...sky]]])check(`O3 ${id} bridge corridor 2.1 m wide, 0.35–2.0 m above deck, is free`,()=>{const hits=[];
 for(let i=1;i<br.length;i++){const a=br[i-1],b=br[i],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,n=[dz/l,0,-dx/l];for(const side of [-1.05,-.5,0,.5,1.05])for(const h of [.35,1,2]){const o=add(a,[n[0]*side,h,n[2]*side]),e=add(b,[n[0]*side,h,n[2]*side]),hit=blockers(objs,o,e).filter(x=>!/grass|flower/.test(x));if(hit.length)hits.push({seg:i,side,h,hit});}}
 assert.deepEqual(hits,[],JSON.stringify(hits.slice(0,6)));return {segments:br.length-1};});
// O5 duration budget and arrival framing (lead feedback on d28ee16: +13.7 s rejected)
const BUILD05_0809_M=42.865,ASPECT=390/844;
check('O5 08-09 extra walk time vs Build05 ≤ 3 s at the unchanged speed',()=>{assert.equal(L.speedMps,1.2,'speed must stay 1.2 m/s');const T=routeLength(leg2),extra=(T-BUILD05_0809_M)/L.speedMps;assert(extra<=3,`08-09 is ${T.toFixed(2)} m, +${extra.toFixed(2)} s over Build05`);return {totalM:+T.toFixed(3),build05M:BUILD05_0809_M,extraS:+extra.toFixed(2),durationS:+(T/L.speedMps).toFixed(2)};});
check('O5 08-09 city centre (anchor_starcourt_center) near screen centre over the final 3 m (390×844)',()=>{const T=routeLength(leg2),start=legs[1].start,rows=[];
 for(let d=T-3;d<=T+1e-9;d+=.1){const c=journeyCamera(leg2,Math.min(T,d),start,focus2),f=sub(c.target,c.position),fl=Math.hypot(...f),fw=f.map(x=>x/fl),r=[fw[2],0,-fw[0]].map(x=>x/Math.hypot(fw[2],fw[0])),up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]],th=Math.tan(c.fovVerticalDeg*Math.PI/360),v=sub(focus2,c.position),z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2],x=(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*ASPECT),y=(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th);
  const p=sampleRoute(leg2,Math.min(T,d)),hz=sub([p[0],p[1]+.9,p[2]],c.position),hzz=hz[0]*fw[0]+hz[1]*fw[1]+hz[2]*fw[2],hx=(hz[0]*r[0]+hz[1]*r[1]+hz[2]*r[2])/(hzz*th*ASPECT),hy=(hz[0]*up[0]+hz[1]*up[1]+hz[2]*up[2])/(hzz*th);
  rows.push({d:+d.toFixed(2),cityNdc:[+x.toFixed(3),+y.toFixed(3)],herChestNdc:[+hx.toFixed(3),+hy.toFixed(3)]});assert(z>0&&Math.abs(x)<=.15&&Math.abs(y)<=.35,`city off centre at d=${d.toFixed(2)}: ${x.toFixed(3)},${y.toFixed(3)}`);assert(hzz>0&&Math.abs(hx)<=.9&&Math.abs(hy)<=.9,`character out of frame at d=${d.toFixed(2)}: ${hx.toFixed(3)},${hy.toFixed(3)}`);}
 return {samples:rows.length,first:rows[0],last:rows.at(-1)};});
// O4 09 arrival composition
check('O4 09 board background pose unchanged and plaza in frame',()=>{
 const base=JSON.parse(fs.readFileSync(__dirname+'/occlusion/build05-arrival-baseline.json','utf8'));
 for(const [f,h] of Object.entries(base.sourceSha256))assert.equal(sha(S+f),h,f+' changed: the 09 plaza composition must stay Build05');
 const pose=Visit.skycityVisitPose(sp('anchor_spawn_girl'),sp('anchor_starcourt_center'),390/844);assert.deepEqual(pose,base.pose390x844);
 const f=sub(pose.target,pose.position),fl=Math.hypot(...f),fw=f.map(x=>x/fl),r=[fw[2],0,-fw[0]].map(x=>x/Math.hypot(fw[2],fw[0])),up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]],th=Math.tan(pose.fovVerticalDeg*Math.PI/360),aspect=390/844;
 const ndc=p=>{const v=sub(p,pose.position),z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2];return [(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*aspect),(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th),z];};
 const plaza=[sp('anchor_starcourt_center'),...[[-4.8,-4.8],[4.8,-4.8],[-4.8,4.8],[4.8,4.8]].map(([x,z])=>[x,0,30+z])].map(ndc);for(const [x,y,z] of plaza)assert(z>0&&Math.abs(x)<=1.05&&Math.abs(y)<=1,'plaza out of frame '+[x,y]);
 const rel=sub(deck.arrival,sA('anchor_cloudbridge_end')),relModel=rotY(-yaw,rel),relBase=base.arrivalFromEndModel;assert(Math.hypot(...sub(relModel,relBase))<1e-6,'arrival root moved relative to the city');
 return {pose:pose,plazaNdc:plaza.map(p=>p.map(v=>+v.toFixed(3))),arrivalFromEndModel:relModel.map(v=>+v.toFixed(4))};});
const report={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',timeUTC:new Date().toISOString(),scope:'Geometry contract on real GLB triangles + real TS. Not a rendered, device or Cocos acceptance.',camera:JOURNEY_CAMERA,layout:L,skyYawDeg:+yaw.toFixed(4),placement:{meadowRootWorld:mOff,meadowYawDeg:180,skycityRootWorld:sOff,skycityYawDeg:yaw,phases:{'04-05':{bridgeStart:routeLength(appr1),bridgeEnd:routeLength([...appr1,...bridge1.slice(1)])},'08-09':{bridgeStart:routeLength(appr2),bridgeEnd:routeLength([...appr2,...bridge2.slice(1)])}}},checks:results,routeProfile:profile};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/journey-occlusion.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status,error:r.error&&r.error.split('\n')[0].slice(0,400)}))},null,1));if(report.status!=='PASS')process.exitCode=1;
