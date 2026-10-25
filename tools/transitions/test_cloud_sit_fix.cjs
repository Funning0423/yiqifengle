#!/usr/bin/env node
'use strict';
/* fix-cloud-sit (GGbot, 2026-10-25): island→meadow sail
 *  A. env_cloud_layer single writer during the sail: SailArt.sync (update) moves it over the lens, RoomLightingRig.advance
 *     (lateUpdate, 30 Hz) must YIELD while __QF_SAIL_HOLD_ISLAND_FX. Real RoomLightingRig.advance under a stub 'cc', real
 *     update→lateUpdate ordering, position traced with the real CloudTrace (jump > 5 m = flicker).
 *  B. sail disembark stops engine-played states (no skel.resume()); the rig guard runs before every stand / walk.
 *  C. SailArt: no per-frame scene walk, shore renderers toggle only on change, meadow_clouds_near has one colour owner. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const src=rel=>fs.readFileSync(path.join(S,rel),'utf8');
function load(rel,req,extra={}){
 const js=ts.transpileModule(src(rel),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;
 const m={exports:{}};const g=Object.assign({module:m,exports:m.exports,require:req,console},extra);g.globalThis=g;
 vm.runInNewContext(js,g,{filename:rel});return {exports:m.exports,global:g};
}
const qa=load('world-r2/QaSkip.ts',()=>({})).exports;
// ---------- A ----------
const anyStub=new Proxy(function(){},{get:(t,k)=>k==='prototype'?{}:anyStub,apply:()=>anyStub,construct:()=>({})});
const cc=new Proxy({},{get:(t,k)=>k==='isValid'?(n=>!!n&&n.valid!==false):k==='Quat'?{fromEuler(){},multiply(){}}:anyStub});
function run(hold){
 const rigMod=load('render/RoomLightingRig.ts',s=>s==='cc'?cc:{});
 const trace=load('region/CloudTrace.ts',s=>s.includes('QaSkip')?qa:{},{console:{...console,warn(){}}});
 const host=rigMod.global;host.__QF_CLOUD_TRACE_ON=true;
 const Rig=rigMod.exports.RoomLightingRig;assert(Rig,'RoomLightingRig export');
 const rig=Object.create(Rig.prototype);
 const node={valid:true,p:[0,30,0],setPosition(x,y,z){this.p=[x,y,z];},setWorldPosition(x,y,z){this.p=[x,y,z];}};
 Object.assign(rig,{disposed:false,paused:false,interior:false,backdrop:true,time:0,seaDetailTime:0,accumulator:0,updates:0,sailYields:0,
  seaDetail:null,sea:{node:{valid:true,setPosition(){}},position:{x:0,y:0,z:0}},clouds:{node,position:{x:0,y:30,z:0}}});
 let jumps=0;
 for(let f=0;f<600;f++){                       // 10 s at 60 fps; the boat/lens moves 4.4 m/s away from the island
  const cam=[f*4.4/60+40,0,-f*1.1/60];
  host.__QF_SAIL_HOLD_ISLAND_FX=hold;
  node.setWorldPosition(cam[0],30,cam[2]);     // update: SailArt.sync (SailArt.ts cloudLayer.setWorldPosition)
  rig.advance(1/60);                            // lateUpdate: WorldFlowComponent → RoomLightingRig.advance
  trace.exports.traceCloudLayer(node.p[0],node.p[1],node.p[2],'test',host); // EVENT_BEFORE_DRAW
  if(hold)assert.deepEqual(node.p,[cam[0],30,cam[2]],'frame '+f+': cloud layer left the lens');
 }
 jumps=host.__QF_CLOUD_TRACE.jumps.length;
 return {jumps,yields:rig.sailYields,updates:rig.updates};
}
const before=run(false),after=run(true);
assert(before.jumps>100,'control: without the yield the cloud layer must jump (test sensitivity) '+before.jumps);
assert.equal(after.jumps,0,'with the sail hold: no cloud-layer jump');
assert(after.yields>200,'rig yielded its 30 Hz backdrop ticks '+after.yields);
// trace off by default (no query, no flag): no state written
{const h={};load('region/CloudTrace.ts',s=>s.includes('QaSkip')?qa:{}).exports.traceCloudLayer(0,0,0,'x',h);assert.equal(h.__QF_CLOUD_TRACE,undefined,'trace off by default');
 const w={wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}}),getLaunchOptionsSync:()=>({query:{cloudTrace:'1'}})}};
 const ct=load('region/CloudTrace.ts',s=>s.includes('QaSkip')?qa:{}).exports;assert.equal(ct.cloudTraceOn(w),false,'WeChat release never traces');}
// ---------- B ----------
const eas=load('region/EngineAnimStop.ts',()=>({})).exports;
{const states={sit_hold:{isPlaying:true,stop(){this.isPlaying=false;}},walk_loop:{isPlaying:false,stop(){throw Error('not playing');}}};
 const anim={clips:[{name:'sit_hold'},null,{name:'walk_loop'}],getState:n=>states[n]};
 const quiet={...console,warn(){}};
 const n=load('region/EngineAnimStop.ts',()=>({}),{console:quiet}).exports.stopEngineStates(anim,'t');
 assert.equal(n,1);assert.equal(states.sit_hold.isPlaying,false,'sit_hold stopped at disembark');
 assert.equal(eas.stopEngineStates(null),0);}
const ride=src('region/SailRide.ts');
const rel=ride.slice(ride.indexOf('releaseRider(){'),ride.indexOf('beginArrival('));
assert(!/\.resume\(\)/.test(rel),'releaseRider must not resume() the engine sit_hold');
assert(/stopEngineStates\(/.test(rel),'releaseRider stops engine states');
const beats=ride.slice(ride.indexOf('export async function playSailBeats'));
assert(/stopEngineStates\(anim,'sail stand'\);\n await actor\.perform\(\{kind:'stand'/.test(beats),'guard before stand_up');
assert(/stopEngineStates\(anim,'sail walk'\);\n await walk\(plan\.disembark/.test(beats),'guard before the disembark walk');
const play=src('region/RegionNodePlay.ts');const pb=play.slice(play.indexOf('export async function performBounded'));
assert(pb.indexOf('stopEngineStates(')>0&&pb.indexOf('stopEngineStates(')<pb.indexOf('character.perform'),'guard before every region-node (meadow) walk');
for(const f of ['region/BalloonTransit.ts','region/RegionJourneyAdapter.ts','region/LakesideBalloon.ts','region/SailRide.ts'])
 assert(!/(skel|anim|Animation)\??\.resume\(\)/.test(src(f)),f+': no engine-animation resume() on a ride exit');
// ---------- C ----------
const art=src('region/SailArt.ts');
const sync=art.slice(art.indexOf('  sync(v,cam,dt,night'),art.indexOf('  dispose(){',art.indexOf('  sync(v,cam,dt,night')));
assert(!/walk\(sceneNow/.test(sync),'no per-frame full-scene walk in sync');
const shore=art.slice(art.indexOf('const hideCloseShore='),art.indexOf('const applyOverride='));
assert(!/walk\(/.test(shore),'hideCloseShore uses the cached prop list');
assert(!/for\(const r of shoreHidden\)if\(r\.isValid\)r\.enabled=true;/.test(shore),'no blanket per-frame re-enable');
assert(/underMeadowClouds\(r\.node\)\)continue/.test(art),'SailArt grade skips meadow_clouds_near (MeadowSceneMotion owns it)');
assert(/meadowCloudMaterials\(find\(model,'meadow_clouds_near'\)\)/.test(src('region/RegionJourneyAdapter.ts')),'journey meadow motion owns meadow_clouds_near');
assert(/__QF_SAIL_HOLD_ISLAND_FX\)\s*\{\s*this\.sailYields\+\+;\s*return;/.test(src('render/RoomLightingRig.ts')),'rig yield present');
console.log('cloud-sit-fix ok',JSON.stringify({before,after}));
// ---------- D (P2: one day frame at night before the set-off cover) ----------
{const a=src('region/SailArt.ts');
 const look=a.indexOf('const nightLook=('),call=a.indexOf('if(worldNight())nightLook(true);'),ret=a.indexOf(' return {\n  boat,seat');
 assert(look>0&&call>look&&call<ret,'mount applies the current night look before returning (no day sea_plane frame)');
 const sy=a.slice(a.indexOf('  sync(v,cam,dt,night'),a.indexOf('  dispose(){',a.indexOf('  sync(v,cam,dt,night')));
 assert(/nightLook\(night\);/.test(sy)&&!/seaMat\.setProperty\('mainColor'/.test(sy),'sync uses the same single night-look writer');}
console.log('cloud-sit-fix P2 ok');
