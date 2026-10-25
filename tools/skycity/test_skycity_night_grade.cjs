'use strict';
// b16 (Grok Bot build16 acceptance): the sky city at night read almost as bright as by day. Locks the night brightness:
//  * SkycityNightGrade is derived from the island's global night (DayNightContract): key light x lightScale + moon colour,
//    self-lit clouds lit like everything else, warm accents kept but dimmed; day (w=0) is exactly the old look.
//  * Brightness window: night/day luminance of the key-lit city and of the self-lit clouds 0.15..0.40 (not black, not day),
//    within 2x of the meadow's journey-night grade; warm accents stay the brightest thing (a few warm lamps).
//  * Every self-lit material in env_skycity.glb is graded (no emissive material left at day strength).
//  * Real SkycityBoardLive on the board-ui harness: night prewarm dims key light + cloud emissive, day restores them, toggles.
//  * r2: lit ground / foliage / rock (ambient-lit, ambient is not dimmed outdoors) take the meadow night albedo grade, the robot
//    the meadow prop grade, the soft cloud sea a moon-blue grade; lamps keep their albedo.
//  * BalloonTransit grades the journey city while it is on (also after landing).
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {createHarness}=require('../board-ui/harness.cjs');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/';
class Ambient {async prepare(){}setHostPaused(){}}
let H;const mats=[];
const fakeMat=(name,props)=>({name,props:{...props},getProperty(k){return this.props[k];},setProperty(k,v){this.props[k]=v;}});
const prefab={addRef(){},decRef(){}};
H=createHarness({overrides:{
 'region/RegionLoader':{REGIONS:{skycity:{bundle:'region_skycity'}},loadRegionPrefab:async()=>prefab,mountRegion:(_d,_p,parent)=>{
  const model=new H.cc.Node('env_skycity');parent.addChild(model);model.addComponent(Ambient);
  for(const name of ['anchor_spawn_girl','anchor_starcourt_center'])model.addChild(new H.cc.Node(name));
  for(const [node,mat,props] of [['env_sky_cloud_small','M_sky_cloud',{emissiveScale:new H.cc.Vec3(1,1,1),mainTexture:'tex'}],['env_sky_ruins','M_sky_palette_emissive',{emissiveScale:new H.cc.Vec3(3,3,3)}],['env_sky_static_palette','M_sky_palette',{}],['chr_robot_gardener_mesh','M_sky_palette',{}]]){
   const n=new H.cc.Node(node);model.addChild(n);const r=n.addComponent(H.cc.MeshRenderer),sm=fakeMat(mat,props);r.setSharedMaterial(sm,0);
   const inst=fakeMat(mat+'#inst',{});r.getMaterialInstance=()=>{r.inst=inst;return inst;};mats.push({node,r,sm});}
  const soft=new H.cc.Node('SkycityCloudseaSoft');parent.addChild(soft);const sn=new H.cc.Node('env_sky_cloudsea_soft');soft.addChild(sn);
  {const r=sn.addComponent(H.cc.MeshRenderer),sm=fakeMat('M_sky_palette',{});r.setSharedMaterial(sm,0);const inst=fakeMat('sea#inst',{});r.getMaterialInstance=()=>{r.inst=inst;return inst;};mats.push({node:'soft_sea',r,sm});}
  return model;}},
 'region/RegionAmbientAnimation':{RegionAmbientAnimation:Ambient},
 'world-r1/CameraPose':{fromLookAt:p=>p,applyCameraPose:()=>true},
}});
H.cc.Camera.FOVAxis={VERTICAL:0};
const D=H.load('world-r1/DayNightContract'),G=H.load('region/SkycityNightGrade'),MB=H.load('region/MeadowBoardBackground');
const N=D.resolveDayNight('night',true),checks=[];const ok=(c,m)=>{assert(c,m);checks.push(m);};
// 1. derived from the global night
ok(G.SKYCITY_NIGHT.keyLightScale===N.lightScale,'key light scale = island night lightScale '+N.lightScale);
ok(JSON.stringify(G.SKYCITY_NIGHT.keyLightColor)===JSON.stringify(N.lightColor),'key light colour = island moon colour');
const d=G.skycityNightScale(0);ok(d.key===1&&d.lamp===1&&d.cloud.every(x=>x===1)&&d.keyColor.every(x=>x===255),'day unchanged');
// 2. brightness window
const n=G.skycityNightScale(1),key=n.key*G.lum(n.keyColor.map(c=>c/255)),cloud=G.lum(n.cloud),meadow=G.lum(MB.MEADOW_NIGHT_LINEAR);
const lamp=3*n.lamp;
ok(key>=.15&&key<=.40,'key-lit city night/day '+key.toFixed(3)+' in 0.15..0.40');
ok(cloud>=.15&&cloud<=.40,'self-lit clouds night/day '+cloud.toFixed(3)+' in 0.15..0.40');
ok(Math.abs(cloud-key)<.02,'clouds as lit as the rest of the city at night');
ok(key/meadow>=.5&&key/meadow<=2,'within 2x of the meadow journey-night grade '+meadow.toFixed(3));
ok(n.lamp>=.3&&n.lamp<=.6&&lamp>1,'warm accents kept, dimmed (x'+n.lamp+', effective '+lamp.toFixed(2)+')');
const h=G.skycityNightScale(.5);ok(h.key<1&&h.key>n.key,'blend 0.5 between day and night');
ok(G.SKYCITY_NIGHT.groundAlbedo.every((k,i)=>k<=MB.MEADOW_NIGHT_LINEAR[i]*.75),'r5: ground grade <= 0.75x the meadow constant: board foreground must read as night');
ok(Math.abs(G.SKYCITY_NIGHT.propAlbedo-Math.pow(MB.MEADOW_PROP_NIGHT[0],2.2))<1e-3,'props/characters = meadow prop grade x0.6 sRGB');
const amb=G.lum(n.ground),sea=G.lum(n.sea);ok(amb>=.13&&amb<=.15,'ground albedo night/day '+amb.toFixed(3)+' in 0.13..0.15 (ambient is not dimmed outdoors)');
const lit=n.ground.map((k,i)=>k*(N.lightScale*N.lightColor[i]/255*3.18+[.2,.5,.8][i]*.508)/(3.18+[.2,.5,.8][i]*.508)),litL=G.lum(lit);
ok(litL>=.045&&litL<=.065,'engine-equivalent lit ground (main 125000 lux x0.35 moon + ambient 20000 sky, EV15) night/day '+litL.toFixed(3)+' in 0.045..0.065');
ok(n.ground[2]>n.ground[0],'moon-blue tint on the ground');ok(sea>amb*2.5&&sea<=.45,'cloud sea '+sea.toFixed(3)+' above the ground, <= 0.45');ok(n.prop>amb,'characters/props stay brighter than the ground');
ok(G.skycityNightScale(0).ground.every(x=>x===1)&&G.skycityNightScale(0).sea.every(x=>x===1),'day albedo unchanged');
const und=G.lum(n.underside);ok(G.skycityNightKind('M_sky_rock_strata','env_sky_static_rock_strata')==='underside','island underside (rock strata) has its own grade');
ok(und>amb*3.5&&und<=.65&&n.underside[2]>n.underside[0],'underside '+und.toFixed(3)+' lighter than the ground (arrival lower half), <=0.65, moon blue');
ok(G.skycityNightScale(0).underside.every(x=>x===1),'day underside unchanged');
{const m=JSON.parse(fs.readFileSync(ROOT+'/docs/b16/skycity-night/skycity_night_before_after_sheet_r5.json','utf8')),r=m['arrival/frame/night_after'].linear/m['arrival/frame/night_before'].linear;ok(r>=.25,'r5: arrival frame after/before (linear, measured r5 sheet) '+r.toFixed(3)+' >= 0.25');ok(m['board/grass/night_after'].linear<m['board/grass/day'].linear*.25,'r5: measured board grass still night');}
ok(G.skycityNightScale(NaN).key===1&&G.skycityNightScale(7).key===n.key,'invalid/clamped weight');
// 3. every self-lit material of the real GLB is graded
{const b=fs.readFileSync(ROOT+'/creator-build-project/assets/bundles/region_skycity/env_skycity.glb'),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 const lit=j.materials.filter(m=>(m.emissiveFactor||[0,0,0]).some(x=>x>0)||m.emissiveTexture);ok(lit.length>=2,'glb has self-lit materials');
 for(const m of lit)ok(G.skycityNightKind(m.name)!==null,'graded: '+m.name);
 for(const m of j.materials.filter(m=>!lit.includes(m)))ok(G.skycityNightKind(m.name,'env_sky_static_palette')===(/rock_strata/.test(m.name)?'underside':'ground'),'lit, albedo graded: '+m.name);
 // r3: every mesh the board shows (state_* hidden except state_bridge_after) has a night grade; the lawn / court / foliage /
 // rock / floor seal are 'ground' (no ungraded material on the foreground).
 for(const nd of j.nodes.filter(x=>'mesh' in x&&(!x.name.startsWith('state_')||x.name==='state_bridge_after')))for(const p of j.meshes[nd.mesh].primitives){
  const k=G.skycityNightKind(j.materials[p.material].name,nd.name);ok(k!==null,'graded at night: '+nd.name+' / '+j.materials[p.material].name);}
 for(const nm of ['env_sky_static_palette','env_sky_static_foliage_cards','env_sky_floor_seal','env_sky_greattree_canopy_cards']){const nd=j.nodes.find(x=>x.name===nm);
  for(const p of j.meshes[nd.mesh].primitives)ok(G.skycityNightKind(j.materials[p.material].name,nm)==='ground','foreground ground grade: '+nm);}
 ok(G.skycityNightKind('M_sky_palette','chr_robot_gardener_mesh')==='prop'&&G.skycityNightKind('M_sky_palette','x',true)==='sea'&&G.skycityNightKind('M_other')===null,'kinds');}
// 4. real board lease
const L=H.load('region/SkycityBoardLive');
let snap={...N};globalThis.__worldDayNight={snapshot:()=>snap};
(async()=>{try{
 const host=new H.cc.Node('host');H.cc._scene.addChild(host);
 const lease=await L.createSkycityBoardBackground({parent:host,token:{check(){},wait:p=>p,onCancel:()=>()=>{}}});
 const rig=host.getChildByName('SkycityLiveBackground'),light=rig.getChildByName('SkycityBackgroundKey').getComponent(H.cc.SphereLight);
 const home=12; // Build05 lease: luminance (1 in the harness) x12
 ok(Math.abs(light.luminance-home*N.lightScale)<1e-9,'night prewarm: key light '+light.luminance.toFixed(2)+' = x'+N.lightScale);
 ok(light.color.r===Math.round(0xff*N.lightColor[0]/255)&&light.color.b===Math.round(0xda*N.lightColor[2]/255),'night key light takes the moon colour');
 const c=mats.find(m=>m.node==='env_sky_cloud_small'),r=mats.find(m=>m.node==='env_sky_ruins'),p=mats.find(m=>m.node==='env_sky_static_palette');
 ok(Math.abs(c.r.inst.props.emissiveScale.x-G.SKYCITY_NIGHT.cloudEmissive[0])<1e-9&&c.r.inst.props.mainTexture==='tex','cloud emissive graded, albedo map rebound');
 ok(Math.abs(r.r.inst.props.emissiveScale.x-3*G.SKYCITY_NIGHT.lampEmissive)<1e-9,'accents x'+G.SKYCITY_NIGHT.lampEmissive);
 const rb=mats.find(m=>m.node==='chr_robot_gardener_mesh'),sw=mats.find(m=>m.node==='soft_sea');
 ok(Math.abs(p.r.inst.props.albedoScale.x-G.SKYCITY_NIGHT.groundAlbedo[0])<1e-9&&Math.abs(p.r.inst.props.albedoScale.z-G.SKYCITY_NIGHT.groundAlbedo[2])<1e-9,'board lawn / court (env_sky_static_palette) albedo graded');
ok(Math.abs(rb.r.inst.props.albedoScale.x-G.SKYCITY_NIGHT.propAlbedo)<1e-9,'robot: prop grade');
 ok(Math.abs(sw.r.inst.props.albedoScale.z-G.SKYCITY_NIGHT.cloudseaAlbedo[2])<1e-9,'soft cloud sea graded as sea (not ground)');
 ok(!r.r.inst.props.albedoScale,'lamps keep their albedo');
 snap={...D.resolveDayNight('day',true)};lease.setVisible(true);
 ok(light.luminance===home&&light.color.r===0xff&&light.color.b===0xda,'day restores the key light');
 ok(c.r.inst.props.emissiveScale.x===1&&r.r.inst.props.emissiveScale.x===3,'day restores the emissive');
 ok(p.r.inst.props.albedoScale.x===1&&sw.r.inst.props.albedoScale.x===1,'day restores the albedo');
 snap={...N,skyNightBlend:.5};lease.setVisible(false);lease.setVisible(true);/* b16: re-show snaps; a shown toggle fades 0.6 s */ok(light.luminance<home&&light.luminance>home*N.lightScale,'blend 0.5');
 const dg=lease.diagnostics();ok(typeof dg.keyLuminance==='number','diagnostics expose key luminance');
 lease.dispose();
 // 5. journey wiring
 const bt=fs.readFileSync(S+'region/BalloonTransit.ts','utf8');
 ok(/if\(model&&cityOn\)\{const w=night\?\(arrived\?1:[^;]*nightCityBlend\(t\)[^;]*\):0;[^}]*gradeSkycityNight\(model,w\);gradeSkycityCloudsea\(model\.parent,w\);\}/.test(bt),'balloon journey grades the city while on (landing included; b17r10: night weight blends in over NIGHT_BLEND_S)');
 console.log(JSON.stringify({status:'PASS',checks:checks.length,night:{groundAlbedo:+amb.toFixed(3),underside:+und.toFixed(3),engineLitGround:+litL.toFixed(3),cloudsea:+sea.toFixed(3),keyLitCity:+key.toFixed(3),selfLitClouds:+cloud.toFixed(3),warmAccents:+lamp.toFixed(2),meadowRef:+meadow.toFixed(3)}}));
}catch(e){console.error(e);process.exit(1);}})();
