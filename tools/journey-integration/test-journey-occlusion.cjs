#!/usr/bin/env node
'use strict';
/* Build05 journey occlusion contract (Oi FAIL 2026-10-16: 04→05 palm close-up at 3.32 m; 08→09 character under
 * env_sky_static_palette, invisible at 32.22 m). Rebuilds both legs exactly as RegionJourneyAdapter does, from the real
 * TypeScript (RegionJourneyLayout, RegionJourneyCore.journeyCamera, RegionCameraData) and the real GLB geometry
 * (meadow read directly; Draco GLBs via the SHA-pinned fixture in occlusion/). Samples every 0.05 m and asserts:
 *   O1 character not occluded: camera→body segments at 0.15/0.5/0.9/1.25/1.6 m (Möller–Trumbore); chest and head must
 *      be visible and at most one low point may graze an edge (grazes are listed in the report)
 *      v3.2: the face point (1.5 m) must be visible as well.
 *   O2 lens clearance ≥ 1 m from all geometry (no near-plane close-ups)
 *   O3 foot point is above the sky platform/rock top along bridge + deck; bridge corridor (2.1 m × 2 m) is free
 *   O4 09 arrival: the board background (own camera, SkycityVisitPose) pose is byte-for-byte the Build05 pose and
 *      still frames the plaza; the arrival root relative to the city is unchanged.
 * Exemption, reported not hidden: leg 04→05 samples with d < 1 m where ONLY her legs (0.15/0.5 m) are behind the island
 * prop strip (v3.2: the lens follows her from set-off; face/head/chest and clearance are never exempt).
 * No browser, engine or rendering. A pass is geometric evidence, not native visual acceptance. */
const {fs,path,zlib,crypto,assert,createHarness,loadGlb,ROOT,B,S,H,Lay,Core,Cam,Visit,L,sampleRoute,routeLength,journeyCamera,JOURNEY_CAMERA,sha,meta,bin,f32,local,meadowNodes,skyNodes,rotY,place,nodePos,add,sub,props,island,anchorsIsland,start,mp,appr1,edge1,mOff,meadow,mA,bridge1,leg1,appr2,edge2,sp,yaw,deck0,sOff,sky,sA,deck,bridge2,leg2,focus2,bbox,segBox,rayHit,blockers,ptTri,clearance,readPose,start1,legs}=require('./journey-scene.cjs');
const results=[];const check=(id,fn)=>{try{results.push({id,status:'PASS',...fn()});}catch(e){results.push({id,status:'FAIL',error:String(e.stack||e)});}};
const STEP=+(process.env.QF_OCCLUSION_STEP||.05),EXEMPT=1.25,HEIGHTS=[.15,.5,.9,1.25,1.6];
const profile={};
for(const leg of legs){const T=routeLength(leg.path),fails=[],exempted=[],grazes=[],rows=[];let minLens=9;
 for(let i=0;i*STEP<=T+1e-9;i++){const d=Math.min(T,i*STEP),p=sampleRoute(leg.path,d),c=journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM),hit=HEIGHTS.map(h=>blockers(leg.objs,c.position,[p[0],p[1]+h,p[2]])),[lens,lensObj]=clearance(c.position,leg.objs),hidden=hit.filter(h=>h.length).length;
  if(d>=leg.exempt)minLens=Math.min(minLens,lens);// Occluded = chest (0.9 m) or head (1.6 m) hidden, or more than one of the five body points hidden. A lone graze of
  // one low point by a pebble/grass edge is reported in partialGrazes, not failed.
  const rec={d:+d.toFixed(2),hidden:Object.fromEntries(HEIGHTS.map((h,k)=>[h,hit[k]]).filter(x=>x[1].length)),lens:+lens.toFixed(2),lensObj};
  const face=blockers(leg.objs,c.position,[p[0],p[1]+1.5,p[2]]);if(face.length)rec.face=face;// v3.2 camera rule: face (1.5 m) must be visible too
  const bad=hit[2].length>0||hit[4].length>0||face.length>0||hidden>1||lens<1;
  // v3.2: the start exemption only covers her LEGS (0.15/0.5 m) behind the island prop strip in the first metre; face, head,
  // chest and lens clearance are enforced from set-off.
  const legsOnly=!face.length&&!hit[2].length&&!hit[3].length&&!hit[4].length&&lens>=1;
  if(bad)(d<leg.exempt&&legsOnly?exempted:fails).push(rec);else if(hidden)grazes.push(rec);
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
check('O5 08-09 final frame: city centre centred (|x|≤0.1, -0.1≤y≤0.45); character in frame over the final 3 m (390×844)',()=>{const T=routeLength(leg2),start=legs[1].start,rows=[];
 for(let d=T-3;d<=T+1e-9;d+=.1){const c=journeyCamera(leg2,Math.min(T,d),start,focus2,legs[1].lens),f=sub(c.target,c.position),fl=Math.hypot(...f),fw=f.map(x=>x/fl),r=[fw[2],0,-fw[0]].map(x=>x/Math.hypot(fw[2],fw[0])),up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]],th=Math.tan(c.fovVerticalDeg*Math.PI/360),v=sub(focus2,c.position),z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2],x=(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*ASPECT),y=(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th);
  const p=sampleRoute(leg2,Math.min(T,d)),hz=sub([p[0],p[1]+.9,p[2]],c.position),hzz=hz[0]*fw[0]+hz[1]*fw[1]+hz[2]*fw[2],hx=(hz[0]*r[0]+hz[1]*r[1]+hz[2]*r[2])/(hzz*th*ASPECT),hy=(hz[0]*up[0]+hz[1]*up[1]+hz[2]*up[2])/(hzz*th);
  rows.push({d:+d.toFixed(2),cityNdc:[+x.toFixed(3),+y.toFixed(3)],herChestNdc:[+hx.toFixed(3),+hy.toFixed(3)]});if(d>T-.05)assert(z>0&&Math.abs(x)<=.1&&-y>=-.1&&-y<=.45,/* this basis has y down */`final city off centre: ${x.toFixed(3)},${y.toFixed(3)}`);assert(hzz>0&&Math.abs(hx)<=.9&&Math.abs(hy)<=.9,`character out of frame at d=${d.toFixed(2)}: ${hx.toFixed(3)},${hy.toFixed(3)}`);}
 return {samples:rows.length,first:rows[0],last:rows.at(-1)};});
// O4 09 arrival composition
check('O4 09 board background pose unchanged and plaza in frame',()=>{
 const base=JSON.parse(fs.readFileSync(__dirname+'/occlusion/build05-arrival-baseline.json','utf8'));
 for(const [f,h] of Object.entries(base.sourceSha256)){
  // r3 changes only the far plane: keep the original full composition hash after normalizing that one literal.
  let actual=sha(S+f);
  if(f==='region/SkycityBoardBackground.ts'){
   const source=fs.readFileSync(S+f,'utf8');assert(source.includes('camera.far=1200'),'soft cloud sea far plane');
   actual=crypto.createHash('sha256').update(source.replace('camera.far=1200','camera.far=1000')).digest('hex');
  }
  assert.equal(actual,h,f+' changed: the 09 plaza composition must stay Build05');
 }
 const pose=Visit.skycityVisitPose(sp('anchor_spawn_girl'),sp('anchor_starcourt_center'),390/844);assert.deepEqual(pose,base.pose390x844);
 const f=sub(pose.target,pose.position),fl=Math.hypot(...f),fw=f.map(x=>x/fl),r=[fw[2],0,-fw[0]].map(x=>x/Math.hypot(fw[2],fw[0])),up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]],th=Math.tan(pose.fovVerticalDeg*Math.PI/360),aspect=390/844;
 const ndc=p=>{const v=sub(p,pose.position),z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2];return [(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*aspect),(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th),z];};
 const plaza=[sp('anchor_starcourt_center'),...[[-4.8,-4.8],[4.8,-4.8],[-4.8,4.8],[4.8,4.8]].map(([x,z])=>[x,0,30+z])].map(ndc);/* b18 (approved skycity board recompose): the court centre must stay well inside (|x| ≤ 0.6); the synthetic ±4.8 m floor corners may
   run up to 0.2 past the side edge (flat floor at board height, no landmark), so the tree clump no longer cuts the left edge. */
 for(const [k,[x,y,z]] of plaza.entries())assert(z>0&&Math.abs(x)<=(k?1.2:.6)&&Math.abs(y)<=1,'plaza out of frame '+[x,y]);
 const rel=sub(deck.arrival,sA('anchor_cloudbridge_end')),relModel=rotY(-yaw,rel),relBase=base.arrivalFromEndModel;assert(Math.hypot(...sub(relModel,relBase))<1e-6,'arrival root moved relative to the city');
 return {pose:pose,plazaNdc:plaza.map(p=>p.map(v=>+v.toFixed(3))),arrivalFromEndModel:relModel.map(v=>+v.toFixed(4))};});
const report={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',timeUTC:new Date().toISOString(),fixture:(()=>{const o=__dirname+'/occlusion/';return {json:'occlusion/fixture-occluders.json',jsonSha256:sha(o+'fixture-occluders.json'),binGz:'occlusion/fixture-occluders.bin.gz',binGzSha256:sha(o+'fixture-occluders.bin.gz'),bytes:meta.bytes,binSha256:meta.binSha256,sources:meta.sources.map(s=>({id:s.id,glb:s.glb,sha256:s.sha256}))};})(),scope:'Geometry contract on real GLB triangles + real TS. Not a rendered, device or Cocos acceptance.',camera:JOURNEY_CAMERA,layout:L,skyYawDeg:+yaw.toFixed(4),placement:{meadowRootWorld:mOff,meadowYawDeg:180,skycityRootWorld:sOff,skycityYawDeg:yaw,phases:{'04-05':{bridgeStart:routeLength(appr1),bridgeEnd:routeLength([...appr1,...bridge1.slice(1)])},'08-09':{bridgeStart:routeLength(appr2),bridgeEnd:routeLength([...appr2,...bridge2.slice(1)])}}},checks:results,routeProfile:profile};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/journey-occlusion.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status,error:r.error&&r.error.split('\n')[0].slice(0,400)}))},null,1));if(report.status!=='PASS')process.exitCode=1;
