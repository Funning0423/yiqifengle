'use strict';
// 风铃湖畔 playable-region wiring: catalog entry, unlock gate, chapter card, stage→scene routing, board background data
// (camera / lights / instances / bundle completeness). Real sources; Cocos only through tools/board-ui/harness.cjs doubles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets'),R=path.join(A,'scripts/regional-r05/runtime');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const API=require(R+'/index.js'),Journal=require(R+'/progress-journal.js'),Host=require(R+'/campaign-host.js'),L=require(R+'/lakeside-levels-data.js');
let n=0;const t=(m,f)=>{f();n++;console.log('PASS',m);};
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
const journey=done=>({readOnly:false,records:Array.from({length:12},(_,i)=>({bestStars:i<done?2:0}))});
// new-regions: once coast (r06-coast-01..09) joins the catalog the count becomes 12 + 6 + 9 (CoastWinWitnesses.ts must exist then).
t('regional catalog = shipped 12 + 6 lakeside stages (+ 9 coast once shipped), ordinals 1..6, region lake, ids unique',()=>{
 const lake=API.catalog.filter(s=>s.region==='lake'),coast=API.catalog.filter(s=>s.region==='coast');assert.equal(lake.length,6);assert([0,9].includes(coast.length),'coast 0 or 9');assert.equal(API.catalog.length-lake.length-coast.length,12);
 if(coast.length){const fs=require('node:fs'),p=require('node:path').resolve(__dirname,'../../creator-build-project/assets/scripts/world-r2/CoastWinWitnesses.ts');assert(fs.existsSync(p),'coast in catalog needs CoastWinWitnesses.ts (tools/pre-transition/gen_coast_witnesses.cjs)');}
 assert.deepEqual(lake.map(s=>s.ordinal),[1,2,3,4,5,6]);assert.deepEqual(lake.map(s=>s.id),L.map(s=>s.id));assert.equal(new Set(API.catalog.map(s=>s.id)).size,API.catalog.length);
 for(const s of lake){const run=API.createSession(s.id);assert.equal(run.snapshot().region,'lake');assert.equal(run.snapshot().guide.goalName,'风铃');}});
t('lake unlock gate: locked until mainline 12 (record 11), then stage 1 opens and stage 2 waits for stage 1',()=>{
 assert.equal(Journal.LAKE_GATE_RECORD,11);assert.equal(Journal.LAKE_STAGE_COUNT,6);
 for(const done of [0,4,8,11]){const p=Host.createPersistence(mem(),journey(done));assert.equal(Host.inspectSelection(p,{stageId:'r04-lake-01',seed:L[0].seedBank[0]}).reason,'stage-locked',String(done));}
 const p=Host.createPersistence(mem(),journey(12));assert.deepEqual(Host.inspectSelection(p,{stageId:'r04-lake-01',seed:L[0].seedBank[0]}),{ok:true,resume:false});
 assert.equal(Host.inspectSelection(p,{stageId:'r04-lake-02',seed:L[1].seedBank[0]}).reason,'stage-locked');
 assert.equal(Host.inspectSelection(p,{stageId:'r04-lake-01',seed:999}).reason,'unverified-r5-stage-or-seed');});
t('real provider opens lake stage 1 (region lake listed); witness wins it; stage 2 stays locked without a record; memento needs all 6',()=>{
 const Provider=require(R+'/board-session-provider.js'),W=JSON.parse(fs.readFileSync(path.join(__dirname,'calibration-report.json'),'utf8'));
 const store=mem(),platform=Host.createStorage(store),j=journey(12),w=W.find(x=>x.id==='r04-lake-01').witness[0];
 const prov=new Provider({platform,journey:j,stageId:'r04-lake-01',seed:w.seed});assert(!prov.error,JSON.stringify(prov.error));
 const s0=prov.snapshot();assert.equal(s0.active.region,'lake');assert(s0.regions.includes('lake'));
 const run=API.createSession('r04-lake-01',w.seed);for(const a of w.actions)assert(run.act(a));assert.equal(run.engine.status,'won');
 const jr=new Journal(platform,j);assert.equal(jr.isUnlocked('r04-lake-02'),false);
 assert.equal(jr.claim('lake').reason,'region-incomplete');});
t('stage → scene routing: lake ids use the lakeside lease and board chapter, others unchanged',()=>{
 const LR=H.load('world-r2/LevelRegion'),BA=H.load('ui/BoardArt'),D=H.load('region/LakesideSceneData');
 for(const s of L){assert(LR.requiresLakesideScene({stageId:s.id}));assert(D.isLakesideStage(s.id));assert(!LR.requiresMeadowScene({stageId:s.id}));assert(!LR.requiresSkycityScene({stageId:s.id}));assert.equal(BA.boardChapter({stageId:s.id}),'lake');}
 for(const id of ['r05-tide-01','r05-meadow-01','r05-sky-01','mainline-05','mainline-09'])assert(!LR.requiresLakesideScene({stageId:id}),id);
 const comp=fs.readFileSync(path.join(A,'scripts/world-r2/WorldNativeComposition.ts'),'utf8');
 assert(/requiresLakesideScene\(context\.selection\)\?createLakesideBoardBackground\(context\)/.test(comp),'composition routes lake to the lakeside lease');
 assert(/challenges:Record<string,number>=\{tide:0,meadow:0,sky:0,lake:0,coast:0,snow:0\}/.test(comp));
 assert(/'region_lakeside'/.test(fs.readFileSync(path.join(A,'scripts/SharedBundles.ts'),'utf8')),'region_lakeside loads shared_effects first');
 assert(/enterRegion\('lake'\)/.test(fs.readFileSync(path.join(A,'scripts/WorldIntegrationBoot.ts'),'utf8')));});
t('journey book: 4th chapter 风铃湖畔, x/6 challenges, no mainline stars, milestone 12, chapter art present',()=>{
 const P=H.load('ui/IslandPanels');assert.deepEqual(P.CHAPTERS.map(c=>c.id),['tide','meadow','sky','lake','coast','snow']);
 const all=Array.from({length:12},()=>({bestStars:3}));
 assert.equal(P.chapterSummary({records:all},{lake:9},3).challenges,6);assert.equal(P.chapterSummary({records:all},{lake:2},3).stars,0);
 assert.equal(P.chapterSummary({records:all.map((r,i)=>i<11?r:{bestStars:0})},{},3).locked,true);assert.equal(P.chapterSummary({records:all},{},3).locked,false);
 assert.equal(P.chapterMilestone(3),12);assert.deepEqual([0,1,2].map(P.chapterMilestone),[4,8,12]);
 assert.equal(P.chapterSummary({records:all},{},3,{ok:false,reason:'stage-locked'}).locked,true);
 for(const f of ['r2/region_lake.png','r2/chapter_lake.png','popup/reward_seal_lake.png']){const p=path.join(A,'bundles/board_art',f);assert(fs.existsSync(p)&&fs.existsSync(p+'.meta'),f);}});
t('board camera = handoff §4 at 720×1280; taller screens keep horizontal coverage; pose passes the camera contract',()=>{
 const D=H.load('region/LakesideSceneData'),C=H.load('world-r1/CameraPose'),lit=JSON.parse(fs.readFileSync(path.join(A,'bundles/region_lakeside/scene_r5h3_lighting.json'),'utf8'));
 const p=D.lakesideBoardPose(720/1280);assert.deepEqual(p.position,lit.camera.position);assert.deepEqual(p.rotation,lit.camera.rotationXYZW);assert.equal(p.fovVerticalDeg,lit.camera.fovVerticalDeg);
 assert.equal(D.LAKESIDE_BOARD_CAMERA.near,lit.camera.near);assert.equal(D.LAKESIDE_BOARD_CAMERA.far,lit.camera.far);
 for(const a of [9/19.5,9/16,3/4,1])assert.equal(C.validateCameraPose(D.lakesideBoardPose(a)),null,String(a));
 const tall=D.lakesideBoardPose(9/19.5),hf=f=>2*Math.atan(Math.tan(f*Math.PI/360)*a)*180/Math.PI;let a=9/19.5;const h1=hf(tall.fovVerticalDeg);a=720/1280;assert(Math.abs(h1-hf(61.928))<.01);
 // board stays in view: all 4 board corners project inside the frustum at the reference aspect
 const q=p.rotation,rot=v=>{const[x,y,z,w]=q,ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];};
 const fwd=rot([0,0,-1]);for(let i=0;i<3;i++)assert(Math.abs(fwd[i]-lit.camera.forward[i])<2e-3,'forward '+fwd);
 const b=D.LAKESIDE_BOARD_BOUNDS,inv=[-q[0],-q[1],-q[2],q[3]],rotInv=v=>{const s=q.slice();q.splice(0,4,...inv);const r=rot(v);q.splice(0,4,...s);return r;};
 for(const c of [[b.min[0],0,b.min[2]],[b.max[0],0,b.min[2]],[b.min[0],0,b.max[2]],[b.max[0],0,b.max[2]]]){const v=rotInv([c[0]-p.position[0],c[1]-p.position[1],c[2]-p.position[2]]);assert(v[2]<0);
  const ty=Math.tan(p.fovVerticalDeg*Math.PI/360),tx=ty*720/1280;assert(Math.abs(v[1]/-v[2])<ty&&Math.abs(v[0]/-v[2])<tx,'corner in view '+c);}});
t('lights follow scene_r5h3_lighting.json (direction, colour, ratios); the MTN_RECV-only sun is not placed',()=>{
 const D=H.load('region/LakesideSceneData'),lit=JSON.parse(fs.readFileSync(path.join(A,'bundles/region_lakeside/scene_r5h3_lighting.json'),'utf8'));
 assert.deepEqual(D.LAKESIDE_LIGHTS.map(l=>[l.name,l.forward,l.colorLinear,l.ratio]),lit.lights.map(l=>[l.name,l.forward,l.colorLinear,l.illuminanceRatio]));
 for(const l of D.LAKESIDE_LIGHTS){const p=D.lakesideLightPosition(l),c=D.LAKESIDE_BOARD_BOUNDS.center,d=[c[0]-p[0],c[1]-p[1],c[2]-p[2]],len=Math.hypot(...d);for(let i=0;i<3;i++)assert(Math.abs(d[i]/len-l.forward[i]/Math.hypot(...l.forward))<1e-3);assert(p[1]>0,'sun above board');}
 const bg=fs.readFileSync(path.join(A,'scripts/region/LakesideBoardBackground.ts'),'utf8');assert(/if\(l\.onlyLayer\)continue;/.test(bg));assert(/camera\.priority=44/.test(bg));assert(/LAKESIDE_LAYER=1<<20/.test(bg));});
t('scene instances: every kept GLB is in the subpackage (with .meta), 3D pieces / shadows / ripples / frame dropped',()=>{
 const D=H.load('region/LakesideSceneData'),tr=JSON.parse(fs.readFileSync(path.join(A,'bundles/region_lakeside/scene_r5h_slim_transforms.json'),'utf8'));
 const keep=D.lakesideSceneInstances(tr.instances),models=path.join(A,'bundles/region_lakeside/models');
 assert.equal(keep.length,813,'802 + 11 b16 boardwalk segments');assert.equal(keep.filter(i=>/^LK_seal_bush_/.test(i.name)).length,67,'场景特效bot r5 S3 fix_r2 free-cam seal bushes (lakeside_under_seal.cjs + lakeside_seal_settle.py)');assert.equal(keep.filter(i=>/^LK_seal_rock_/.test(i.name)).length,0);assert.equal(keep.filter(i=>/^LK_scatter_/.test(i.name)).length,275,'场景特效bot r5 S3 near-lawn tufts / flowers / rocks (lakeside_near_scatter.cjs)');assert.equal(keep.filter(i=>/^LK_ring_/.test(i.name)).length,29,'场景特效bot r5 S2 far-ring tree / bush / rock clusters (lakeside_far_ring.py)');assert(!keep.some(i=>/^LK_piece_|LK_contact_shadow|LK_ripple_ring|LK_board_frame/.test(i.glb)));
 assert(keep.some(i=>i.glb==='LK_lilypad.glb')&&keep.some(i=>i.glb==='LK_chime_raft.glb'));
 for(const g of new Set(keep.map(i=>i.glb))){assert(fs.existsSync(path.join(models,g)),g);assert(fs.existsSync(path.join(models,g+'.meta')),g+'.meta');}
 for(const i of keep){assert.equal(i.pos.length,3);assert.equal(i.rot_quat_xyzw.length,4);assert(Math.abs(Math.hypot(...i.rot_quat_xyzw)-1)<1e-3,i.name);}
 // r5h3 ASSETS-collection templates (name == GLB basename, at the origin) are not placed: no house/pavilion on the bridge.
 // Since the art/tools/export_region.py re-export the JSON itself carries no templates (581 instances, + 29 far-ring clusters + 275 near scatter + 67 seal bushes = 952; + 11 b16 LK_boardwalk_b16_* walk segments = 963); the runtime filter stays as a guard.
 const tpl=tr.instances.filter(i=>i.name===i.glb.replace(/\.glb$/,''));assert.equal(tpl.length,0);assert.equal(tr.instances.length,963);assert.equal(tr.instances.filter(i=>/^LK_boardwalk_b16_/.test(i.name)).length,11);
 assert(!keep.some(i=>D.isLakesideAssetTemplate(i)));assert(!keep.some(i=>/LK_(house_[ABC]|pavilion)\.glb/.test(i.glb)&&Math.hypot(...i.pos)<5),'nothing house-like within 5 m of the bridge origin');
 assert.equal(keep.filter(i=>i.glb==='LK_pavilion.glb').length,1);assert.equal(keep.filter(i=>i.glb==='LK_lake.glb').length,1);assert.equal(keep.filter(i=>i.glb==='LK_bridge.glb').length,1);
 assert.deepEqual(D.lakesideCellCenter(0),[-3.3,0,8.7]);assert.deepEqual(D.lakesideCellCenter(48),[3.3,0,15.3]);assert.throws(()=>D.lakesideCellCenter(49));
 for(const s of L)for(const c of s.rules.chimes)D.lakesideCellCenter(c.index);});
console.log(JSON.stringify({status:'PASS',cases:n,scope:'Pure logic + Cocos doubles. Not rendering, Creator import, device or WeChat.'}));
