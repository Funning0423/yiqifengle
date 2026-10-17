// r4 sky-city figure: the teal figure on 星庭 is the robot gardener (chr_robot_gardener in env_skycity.glb). It is part of the
// region model, so it is in BOTH the journey copy and the board copy (nothing hides it); the board copy now continues the
// journey copy's ambient animation times on its first frame (robot_idle + sky_ambient_loop), so it carries straight over the swap.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../../creator-build-project/assets/'),S=ROOT+'scripts/';
const run=async(n,f)=>{await f();console.log('PASS',n);};
// --- engine stand-ins (only what LakesideBoardGuest touches) ---
class Component{constructor(){this.enabled=true;}}class MeshRenderer extends Component{}
class State{constructor(name){this.name=name;this.isPlaying=false;this.time=0;this.sampled=0;}play(){this.isPlaying=true;}setTime(t){this.time=t;}sample(){this.sampled++;}}
class SkeletalAnimation extends Component{constructor(){super();this.clips=[];this.states=new Map();}getState(n){return this.states.get(n)||null;}
 add(name,playing,time){this.clips.push({name});const s=new State(name);s.isPlaying=playing;s.time=time;this.states.set(name,s);return s;}}
class Node{constructor(name){this.name=name;this.children=[];this.parent=null;this.comps=[];this.valid=true;}
 addChild(c){c.parent=this;this.children.push(c);}getChildByName(n){return this.children.find(c=>c.name===n)||null;}
 addComponent(C){const c=new C();c.node=this;this.comps.push(c);return c;}getComponent(C){return this.comps.find(c=>c instanceof C)||null;}
 getComponentsInChildren(C){const out=[];const walk=n=>{for(const c of n.comps)if(c instanceof C)out.push(c);n.children.forEach(walk);};walk(this);return out;}
 destroy(){this.valid=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}}
let scene;const cc={Component,MeshRenderer,SkeletalAnimation,Node,Quat:class{},Vec3:class{},instantiate:n=>n,director:{getScene:()=>scene},isValid:o=>!!o&&o.valid!==false};
const out=ts.transpileModule(fs.readFileSync(S+'region/LakesideBoardGuest.ts','utf8'),{compilerOptions:{module:1,target:7}}).outputText;
const G={};vm.runInThisContext('(function(exports,require){'+out+'\n})')(G,s=>s==='cc'?cc:null);
(async()=>{
await run('figure = robot gardener: real env_skycity.glb has chr_robot_gardener (skinned) under anchor_robot_root, ≤5 m from anchor_starcourt_center; robot_idle + sky_ambient_loop are the skycity ambient clips',()=>{
 const d=fs.readFileSync(ROOT+'bundles/region_skycity/env_skycity.glb'),L=d.readUInt32LE(12),j=JSON.parse(d.subarray(20,20+L).toString('utf8'));
 const idx=n=>j.nodes.findIndex(x=>x.name===n),root=j.nodes[idx('anchor_robot_root')],court=j.nodes[idx('anchor_starcourt_center')];
 const rig=j.nodes[idx('chr_robot_gardener_rig')],mesh=j.nodes[idx('chr_robot_gardener_mesh')];assert(root&&court&&rig&&mesh);assert('skin' in mesh,'skinned robot');
 assert(root.children.includes(idx('chr_robot_gardener_rig'))&&rig.children.includes(idx('chr_robot_gardener_mesh')));
 const a=root.translation,b=court.translation;assert(Math.hypot(a[0]-b[0],a[2]-b[2])<=5,'robot stands on the court');
 assert.deepEqual(j.animations.map(x=>x.name).sort(),['robot_give_flower','robot_idle','robot_watering','sky_ambient_loop']);
 assert.match(fs.readFileSync(S+'region/RegionLoader.ts','utf8'),/skycity:\{[^}]*ambientClips:\['sky_ambient_loop','robot_idle'\]/);});
await run('kept on both copies: journey and board mount the whole region model; no code hides / deactivates the robot or its rig',()=>{
 const files=['region/SkycityBoardBackground.ts','region/RegionJourneyAdapter.ts','region/LakesideBoardGuest.ts','region/RegionBoardLanding.ts','world-r2/WorldNativeComposition.ts','world-r1/WorldFlowComponent.ts'];
 const code=t=>t.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 for(const f of files.filter(f=>fs.existsSync(S+f)/* RegionBoardLanding arrives with 运镜bot's region hooks */))assert.doesNotMatch(code(fs.readFileSync(S+f,'utf8')),/chr_robot|anchor_robot_root/,f+' must not single out the robot');
 assert.match(fs.readFileSync(S+'region/SkycityBoardBackground.ts','utf8'),/const model=mountRegion\(REGIONS\.skycity,prefab,rig\);setLayer\(model\);/);});
function pair(){scene=new Node('scene');const jr=new Node('RegionJourney-skycity');scene.addChild(jr);const jm=new Node('env_skycity');jr.addChild(jm);jr.addChild(new Node('RainbowBridgeStrip0'));
 const ja=jm.addComponent(SkeletalAnimation);ja.add('sky_ambient_loop',true,13.37);ja.add('robot_idle',true,1.9);ja.add('robot_watering',false,0);ja.add('robot_give_flower',false,0);
 const parent=new Node('ManagedNativeBoardHost');scene.addChild(parent);let ba=null,visible=false,disposed=0;
 const factory=async({parent})=>{const rig=new Node('SkycityLiveBackground');parent.addChild(rig);const bm=new Node('env_skycity');rig.addChild(bm);rig.addChild(new Node('SkycityBackgroundCamera'));
  ba=bm.addComponent(SkeletalAnimation);for(const n of ['sky_ambient_loop','robot_idle','robot_watering','robot_give_flower'])ba.add(n,false,0);
  // like RegionAmbientAnimation: the ambient loops start from 0 when the rig first activates (setVisible(true))
  return {frame(){},setVisible(v){visible=v;if(v)for(const n of ['sky_ambient_loop','robot_idle']){const s=ba.getState(n);if(!s.isPlaying){s.isPlaying=true;s.time=0;}}},setPaused(){},diagnostics:()=>({region:'skycity'}),dispose(){disposed++;rig.destroy();}};};
 return {jm,ja,parent,factory,get ba(){return ba;},get visible(){return visible;},get disposed(){return disposed;}};}
await run('swap: on the board copy\'s first frame robot_idle and sky_ambient_loop take the journey copy\'s times (sampled); gestures not started; once only',async()=>{
 const w=pair();const lease=await G.withRegionBoardGuest('skycity','SkycityLiveBackground',1<<20,w.factory)({parent:w.parent,selection:{},token:{}});
 assert(lease&&lease!==null);assert.equal(w.ba.getState('robot_idle').time,0,'not touched before it shows');
 lease.setVisible(true);assert.equal(w.visible,true);
 assert.equal(w.ba.getState('robot_idle').time,1.9);assert.equal(w.ba.getState('sky_ambient_loop').time,13.37);
 assert(w.ba.getState('robot_idle').sampled>=1&&w.ba.getState('sky_ambient_loop').sampled>=1);
 assert.equal(w.ba.getState('robot_watering').isPlaying,false);assert.equal(w.ba.getState('robot_give_flower').isPlaying,false);
 assert.equal(lease.diagnostics().ambientSynced,2);assert.equal(lease.diagnostics().region,'skycity');
 w.ja.getState('robot_idle').time=0.2;lease.setVisible(false);lease.setVisible(true);assert.equal(w.ba.getState('robot_idle').time,1.9,'later shows keep their own clock');
 lease.dispose();assert.equal(w.disposed,1);});
await run('no journey copy (level opened from the map): lease returned unchanged; journey gone before the swap: no sync, no throw',async()=>{
 const w=pair();w.jm.parent.children=[];const inner=await w.factory({parent:new Node('x')});const lease=await G.withRegionBoardGuest('skycity','SkycityLiveBackground',1<<20,async()=>inner)({parent:w.parent,selection:{},token:{}});assert.equal(lease,inner);
 const w2=pair();const l2=await G.withRegionBoardGuest('skycity','SkycityLiveBackground',1<<20,w2.factory)({parent:w2.parent,selection:{},token:{}});w2.jm.destroy();l2.setVisible(true);assert.equal(l2.diagnostics().ambientSynced,0);assert.equal(w2.ba.getState('robot_idle').time,0);});
await run('pure helper: missing animation on either side → 0',()=>{assert.equal(G.syncRegionAmbient(null,new Node('b')),0);assert.equal(G.syncRegionAmbient(new Node('a'),new Node('b')),0);});
})().catch(e=>{console.error(e);process.exit(1);});
