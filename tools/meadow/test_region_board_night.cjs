'use strict';
// r4.2 item 9 (Mac r4 2153a65 swap/meadow_sky_boards_night_day.jpg: at night the meadow and sky-city journeys are night scenes,
// but the board behind them turned into a daytime sky + bright meadow on the swap frame and stayed so). The boards now honour
// the world day/night mode: board sky (clear colour) eases to the journey's night sky, the meadow board grades grass/ground/
// clouds/props exactly like the journey copy and its own sky dome takes the night picture; day is byte-for-byte unchanged.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness}=require('../board-ui/harness.cjs');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const run=(n,f)=>{f();console.log('PASS',n);};
const H=createHarness();if(!H.cc.Vec4)H.cc.Vec4=class{constructor(x=0,y=0,z=0,w=0){Object.assign(this,{x,y,z,w});}};const N=H.load('region/RegionBoardNight');
run('helper: day weight 0 = the authored day colour, weight 1 = the journey night sky, eased in between; written only on change',()=>{
 assert.deepEqual(N.regionBoardClear([0x87,0xbf,0xc9],0),[0x87,0xbf,0xc9]);assert.deepEqual(N.regionBoardClear([0x9c,0xca,0xdf],1),[0,12,68]);
 const mid=N.regionBoardClear([0x87,0xbf,0xc9],.5);assert.deepEqual(mid,[68,102,135]);
 // r4 Mac journey night sky samples ~ (0,10-13,63-74)
 const n=N.REGION_BOARD_NIGHT_CLEAR;assert(n[0]<=4&&n[1]>=10&&n[1]<=13&&n[2]>=63&&n[2]<=74);
 const cam={clearColor:{r:0x87,g:0xbf,b:0xc9,a:255}};let made=0;const mk=(r,g,b)=>{made++;return {r,g,b,a:255};};
 assert.equal(N.writeRegionBoardClear(cam,[0x87,0xbf,0xc9],0,mk),false);assert.equal(made,0,'steady day: no write');
 assert.equal(N.writeRegionBoardClear(cam,[0x87,0xbf,0xc9],1,mk),true);assert.deepEqual([cam.clearColor.r,cam.clearColor.g,cam.clearColor.b],[0,12,68]);
 globalThis.__worldDayNight={snapshot:()=>({mode:'night'})};assert.equal(N.regionNightNow(),true);globalThis.__worldDayNight={snapshot:()=>({mode:'day'})};assert.equal(N.regionNightNow(),false);delete globalThis.__worldDayNight;assert.equal(N.regionNightNow(),false);});
run('meadow motion: board camera clear colour follows the UI night weight; ground/cloud grade identical to the journey copy; day untouched',()=>{
 const M=H.load('region/MeadowBoardBackground');const m=new M.MeadowSceneMotion();m.node=new H.cc.Node('rig');
 const cam={clearColor:new H.cc.Color(0x87,0xbf,0xc9,255)};m.boardCamera=cam;m.dayClear=[0x87,0xbf,0xc9];m.journeyNight=true;
 const props=[];const mat={setProperty:(k,v)=>props.push([k,v])};m.grounds=[{m:mat,base:[1,1,1,1]}];m.clouds=[mat];
 globalThis.__worldDayNight={snapshot:()=>({mode:'day'})};m.update(1/60);
 assert.deepEqual([cam.clearColor.r,cam.clearColor.g,cam.clearColor.b],[0x87,0xbf,0xc9],'day sky unchanged');
 const g0=props.find(p=>p[0]==='mainColor');assert.deepEqual([g0[1].x,g0[1].y,g0[1].z],[1,1,1],'day ground factor 1');
 globalThis.__worldDayNight={snapshot:()=>({mode:'night'})};{const t0=Date.now();let last=0;while(Date.now()-t0<3000&&cam.clearColor.b!==68){if(Date.now()-last>=16){last=Date.now();m.update(1/60);}}}
 assert.deepEqual([cam.clearColor.r,cam.clearColor.g,cam.clearColor.b],[0,12,68],'night board sky = journey night sky');
 const k=M.meadowGroundFactor(1);props.length=0;m.update(1/60);const g1=props.find(p=>p[0]==='mainColor');assert.deepEqual([g1[1].x,g1[1].y,g1[1].z],k.map(v=>v*1),'night ground grade = journey');
 delete globalThis.__worldDayNight;});
run('wiring: meadow board grades like the journey, mounts a night dome only at night, follows toggles and frees its listener; sky city too',()=>{
 const md=fs.readFileSync(S+'region/MeadowBoardBackground.ts','utf8'),sk=fs.readFileSync(S+'region/SkycityBoardLive.ts','utf8'),ja=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
 const f=md.slice(md.indexOf('export const createMeadowBoardBackground'));
 assert.match(f,/motion\.journeyNight=true;motion\.clouds=meadowCloudMaterials\(find\(model,'meadow_clouds_near'\)\);/);
 assert.match(ja,/motion\.journeyNight=true;motion\.clouds=meadowCloudMaterials\(find\(model,'meadow_clouds_near'\)\);/,'same lists as the journey');
 assert.match(f,/motion\.grounds=meadowGroundMaterials\(\[find\(model,'meadow_terrain'\),find\(model,'meadow_river_bank'\)\]\);/);
 assert.match(f,/meadowGroundMaterials\(\[find\(model,'meadow_path'\),find\(model,'windmill_static_merged'\),find\(model,'windmill_sails'\)\],MEADOW_PROP_NIGHT\)/);
 assert.match(f,/if\(night&&!nightSky\)nightSky=mountMeadowBoardNightSky\(model\);/,'night picture loads only once night is on');
 assert.match(f,/offNight=onDayNightChange\(syncNight\);/);assert.match(f,/disposed=true;offCancel\(\);offNight\(\);/);
 assert.doesNotMatch(md.slice(md.indexOf('export function mountMeadowBoardNightSky'),md.indexOf('export const createMeadowBoardBackground')),/__qfNightOnly/,'board dome stays its day sky');
 assert.match(sk,/writeRegionBoardClear\(camera,SKYCITY_BOARD_DAY_CLEAR,skyNightBlend/);assert.match(sk,/offNight=onDayNightChange\(syncNight\);/);assert.match(sk,/dead=true;offNight\(\);\}lease\.dispose\(\);/);
 assert.doesNotMatch(fs.readFileSync(S+'region/SkycityBoardBackground.ts','utf8'),/RegionBoardNight|onDayNightChange/,'Build05 sky-city lease untouched (sha-pinned by test-journey-occlusion)');});
(async()=>{
 // behaviour of the sky-city wrapper on a fake Build05 lease (same rig/camera names and clear colour)
 let cam=null,disposed=0;const fake={createSkycityBoardBackground:async({parent})=>{const rig=new H2.cc.Node('SkycityLiveBackground');parent.addChild(rig);
  const cn=new H2.cc.Node('SkycityBackgroundCamera');rig.addChild(cn);cam=cn.addComponent(H2.cc.Camera);cam.clearColor=new H2.cc.Color(0x9c,0xca,0xdf,255);
  return {frame(){},setVisible(v){rig.active=v;cam.enabled=v;},setPaused(){},diagnostics:()=>({}),dispose(){disposed++;}};}};
 const H2=createHarness({overrides:{'region/SkycityBoardBackground':fake}});
 const L=H2.load('region/SkycityBoardLive'),D=H2.load('world-r1/DayNightContract'),host=new H2.cc.Node('host');H2.cc._scene.addChild(host);
 const rgb=()=>[cam.clearColor.r,cam.clearColor.g,cam.clearColor.b];
 globalThis.__worldDayNight={snapshot:()=>({mode:'night'})};const lease=await L.createSkycityBoardBackground({parent:host,token:{check(){},onCancel:()=>()=>{}}});
 assert.deepEqual(rgb(),[0,12,68],'built at night: night sky');
 globalThis.__worldDayNight={snapshot:()=>({mode:'day'})};D.emitDayNightChange('day');assert.deepEqual(rgb(),[0x9c,0xca,0xdf],'toggle to day: the Build05 day sky');
 globalThis.__worldDayNight={snapshot:()=>({mode:'night'})};D.emitDayNightChange('night');assert.deepEqual(rgb(),[0,12,68],'toggle back to night');
 lease.dispose();assert.equal(disposed,1);globalThis.__worldDayNight={snapshot:()=>({mode:'day'})};D.emitDayNightChange('day');assert.deepEqual(rgb(),[0,12,68],'listener freed on dispose');
 delete globalThis.__worldDayNight;console.log('PASS sky city wrapper: board sky follows the day/night mode and its toggles; listener freed on dispose');
})().catch(e=>{console.error(e);process.exitCode=1;});
