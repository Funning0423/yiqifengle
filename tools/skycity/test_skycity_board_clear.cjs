'use strict';
// Real base + live factories with asset/animation/pose doubles; no Cocos, browser or renderer.
const assert=require('node:assert/strict');
const {createHarness}=require('../board-ui/harness.cjs');
class Ambient {async prepare(){}setHostPaused(){}}
let H,refs=0,frames=0;
const prefab={addRef(){refs++;},decRef(){refs--;}};
H=createHarness({overrides:{
 'region/RegionLoader':{REGIONS:{skycity:{bundle:'region_skycity'}},loadRegionPrefab:async()=>prefab,mountRegion:(_def,_prefab,parent)=>{
  const model=new H.cc.Node('env_skycity');parent.addChild(model);model.addComponent(Ambient);
  for(const name of ['anchor_spawn_girl','anchor_starcourt_center'])model.addChild(new H.cc.Node(name));
  // Imported cameras must not overwrite the background.
  const imported=new H.cc.Node('ImportedCamera');model.addChild(imported);imported.addComponent(H.cc.Camera);
  return model;
 }},
 'region/RegionAmbientAnimation':{RegionAmbientAnimation:Ambient},
 'world-r1/CameraPose':{fromLookAt:p=>p,applyCameraPose:()=>{frames++;return true;}},
}});
H.cc.SphereLight=class {constructor(){this.luminance=1;}};
H.cc.Camera.FOVAxis={VERTICAL:0};
const L=H.load('region/SkycityBoardLive'),D=H.load('world-r1/DayNightContract');
const host=new H.cc.Node('host');H.cc._scene.addChild(host);
let snapshot={...D.resolveDayNight('night',true)};
globalThis.__worldDayNight={snapshot:()=>snapshot};
const rgb=c=>[c.clearColor.r,c.clearColor.g,c.clearColor.b];
(async()=>{try{
 const lease=await L.createSkycityBoardBackground({parent:host,token:{check(){},wait:p=>p,onCancel:()=>()=>{}}});
 const rig=host.getChildByName('SkycityLiveBackground'),camera=rig.getChildByName('SkycityBackgroundCamera').getComponent(H.cc.Camera);
 assert.equal(refs,1);assert.deepEqual(rgb(camera),[0,12,68],'night prewarm');
 assert.equal(rig.getChildByName('env_skycity').getComponentsInChildren(H.cc.Camera)[0].enabled,false);
 assert.equal(camera.priority,44);assert.equal(camera.clearFlags,H.cc.Camera.ClearFlag.SOLID_COLOR);assert.equal(camera.usePostProcess,false);assert.equal(camera.visibility,1<<20);
 // A changed snapshot without an event (hidden prewarm/resume) must not leave the night clear latched.
 snapshot=D.resolveDayNight('day',true);lease.setVisible(true);
 assert.deepEqual(rgb(camera),[156,202,223],'mode=day, skyNightBlend=0 => #9ccadf on first visible frame');
 assert.equal(camera.enabled,true);assert.equal(camera.clearColor.a,255);
 const dayColor=camera.clearColor;lease.frame(false,{width:390,height:844});assert.equal(camera.clearColor,dayColor,'steady day reuses Color');assert.equal(frames,1);
 assert.deepEqual(lease.diagnostics().skyClearColor,[156,202,223]);
 // Intermediate night weight must interpolate from the day colour, never jump to fixed navy.
 // cand-b18-stage5: while shown, b16 (f6ec5df9) fades day/night over 0.6 s (covered by tools/ui-b16-fixes); the endpoint/blend
 // mapping below is checked hidden, where the board snaps straight to the target.
 lease.setVisible(false);
 snapshot={...D.resolveDayNight('night',true),skyNightBlend:.5};D.emitDayNightChange('night');
 assert.deepEqual(rgb(camera),[78,107,146],'half blend from #9ccadf to #000c44');
 snapshot={...snapshot,skyNightBlend:0};lease.frame(false,{width:390,height:844});assert.deepEqual(rgb(camera),[156,202,223],'night blend 0 is day endpoint');
 snapshot={...snapshot,skyNightBlend:1};D.emitDayNightChange('night');assert.deepEqual(rgb(camera),[0,12,68]);
 D.emitDayNightChange('day');assert.deepEqual(rgb(camera),[156,202,223],'event mode is authoritative even before snapshot catches up');
 snapshot={mode:'day',skyNightBlend:1};lease.frame(false,{width:390,height:844});assert.deepEqual(rgb(camera),[156,202,223],'explicit day cannot be darkened by a stale blend');
 snapshot={mode:'night',skyNightBlend:NaN};D.emitDayNightChange('night');assert.deepEqual(rgb(camera),[0,12,68],'legacy/invalid night blend uses night endpoint');
 snapshot={mode:'night',skyNightBlend:2};D.emitDayNightChange('night');assert.deepEqual(rgb(camera),[0,12,68],'clamped night endpoint');
 delete globalThis.__worldDayNight;lease.setVisible(false);assert.deepEqual(rgb(camera),[156,202,223],'missing world defaults to day');
 lease.dispose();lease.dispose();assert.equal(refs,0);assert.equal(rig.isValid,false);
 snapshot=D.resolveDayNight('night',true);globalThis.__worldDayNight={snapshot:()=>snapshot};D.emitDayNightChange('night');assert.deepEqual(rgb(camera),[156,202,223],'disposed listener does not write');
 console.log('PASS skycity board clear: real base/live factories; day, prewarm/resume, toggles, blend 0/.5/1, day precedence, invalid/clamped blend, camera isolation, diagnostics and cleanup. No rendered acceptance.');
 }finally{delete globalThis.__worldDayNight;}
})().catch(e=>{console.error(e);process.exitCode=1;});
