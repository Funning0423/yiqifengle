'use strict';
// r4.2 items 10/11 (Mac r4 2153a65: swap frame 29-42 ms, board UI and background appear on the same frame). The board UI is now built
// AND switched on hidden while the cover plays (prewarmPresentation: host active, board camera held, root at opacity 0, big subtrees a
// budget per frame); presentForPlay on the swap frame only toggles visibility: no node/component created, no subtree activation, no
// relayout. Real ManagedMobileBoardUI on the board-ui harness; wiring of the adapter and the three region backgrounds by source.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness}=require('./harness.cjs');
const MainPort=require('../../creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port.js');
const run=async(n,f)=>{await f();console.log('PASS',n);};
async function board(){
 const H=createHarness();H.cc.sys.localStorage.setItem('qfl.ui.seenTools',JSON.stringify(['starlight','windbell','tidebottle']));
 const mem=new Map(),port=MainPort.createPort({getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)}),c=port.createController();
 const {createManagedMainlineBinding}=H.load('world-r2/ManagedMainlineBinding'),{ManagedMobileBoardUI}=H.load('ManagedMobileBoardUI');
 const u=new ManagedMobileBoardUI();u.node=new H.cc.Node('ManagedNativeBoardHost');u.node.active=false;H.cc._scene.addChild(u.node);u.deferPresentation=true;
 assert(c.startStage('mainline-01',{seed:1}).ok);u.initializeManaged({},createManagedMainlineBinding(port,c,{exit:()=>({ok:true}),resume:()=>undefined}));await H.flush();assert.equal(u.snapshot.state,'run.ready');
 return {H,u,c};}
const count=n=>{let k=0,comps=0;n.walk(x=>{k++;comps+=x.components.length;});return {nodes:k,comps};};
function watch(H,u,fn){const flips=[];const emit=H.cc.Node.prototype.emit;H.cc.Node.prototype.emit=function(t,...a){if(t==='active-changed'&&this.activeInHierarchy)flips.push(this.name);return emit.call(this,t,...a);};
 let layouts=0;const lay=u.layout;u.layout=function(){layouts++;return lay.apply(this,arguments);};
 const before=count(u.node);try{fn();}finally{H.cc.Node.prototype.emit=emit;u.layout=lay;}const after=count(u.node);return {flips,layouts,before,after};}
(async()=>{
 let ref=0;
 await run('without the pre-activation (old path) the swap frame switches hundreds of nodes on and relays out',async()=>{
  const {H,u}=await board();const w=watch(H,u,()=>u.presentForPlay());ref=w.flips.length;assert(ref>150,'old swap activations '+ref);assert.equal(w.layouts,1);u.onDestroy();});
 await run('UI is constructed and active (hidden) before the swap; the swap creates nothing, activates only the UI camera, no relayout',async()=>{
  const {H,u}=await board();let go=null;u.prewarmPresentation(f=>{go=f;});assert.equal(typeof go,'function','waits for a later frame');assert.equal(u.node.active,false,'nothing on the level-loading start frame');
  go();assert.equal(u.node.activeInHierarchy,true,'host on, hidden');const cam=u.camera;assert.equal(cam.node.active,false,'board camera held');assert.equal(cam.visibility,0);
  const veil=u.root.getComponent(H.cc.UIOpacity);assert(veil&&veil.opacity===0,'root at opacity 0 (no other UI_2D camera batches it)');
  let frames=0;while(u.diagnostics().prewarm.pending>0||!u.diagnostics().prewarm.done){u.update(1/60);frames++;assert(frames<40,'prewarm finishes in a few frames');}
  assert(frames>=4,'spread over frames ('+frames+')');
  // every cell, layer, the HUD plate are switched on before the swap
  for(const n of u.cells)assert.equal(n.activeInHierarchy,true,'cell active before swap');for(const k of ['Bases','Moss','Under','Over','Covers'])assert.equal(u.layers[k].activeInHierarchy,true,k);
  assert.equal(u.plate.activeInHierarchy,true,'info plate active before swap');assert.equal(u.diagnostics().inputGate.presented,false,'input still held');
  const w=watch(H,u,()=>u.presentForPlay());
  assert.deepEqual(w.after,w.before,'swap: no node or component created');assert.equal(w.layouts,0,'swap: no relayout (same frame size)');
  assert(w.flips.length<=2&&w.flips.every(n=>n==='NativeUICamera'),'swap activates only the UI camera: '+w.flips.join(','));
  assert.equal(veil.opacity,255);assert.equal(cam.node.active,true);assert.equal(cam.enabled,true);assert.equal(u.diagnostics().inputGate.presented,true);
  console.log('  swap activations: old '+ref+' -> new '+w.flips.length+'; prewarm frames '+frames);u.onDestroy();});
 await run('a reveal before the pre-activation finished completes it synchronously (and lays out); before it started = old path',async()=>{
  const {H,u}=await board();let go=null;u.prewarmPresentation(f=>{go=f;});go();u.update(1/60);assert(u.diagnostics().prewarm.pending>0);
  const w=watch(H,u,()=>u.presentForPlay());assert.equal(w.layouts,1);assert(u.diagnostics().prewarm.flushed>0);for(const n of u.cells)assert.equal(n.activeInHierarchy,true);
  assert.equal(u.root.getComponent(H.cc.UIOpacity).opacity,255);u.onDestroy();
  const b=await board();let g2=null;b.u.prewarmPresentation(f=>{g2=f;});b.u.presentForPlay();g2();assert.equal(b.u.diagnostics().prewarm.started,false,'late frame after reveal does nothing');b.u.onDestroy();});
 await run('nothing runs before presentForPlay while the host is pre-activated (no hint clock, no intro popups)',async()=>{
  const {u}=await board();let go=null;u.prewarmPresentation(f=>{go=f;});go();for(let i=0;i<600;i++)u.update(1/60);assert.equal(u.hintClock.count(),0);assert.equal(u.popups.find('ToolIntroPanel'),null);u.onDestroy();});
 await run('a resize after the pre-activation still lays out on reveal',async()=>{
  const {H,u}=await board();let go=null;u.prewarmPresentation(f=>{go=f;});go();for(let i=0;i<40;i++)u.update(1/60);u.prewarmedFrame='1x1';const w=watch(H,u,()=>u.presentForPlay());assert.equal(w.layouts,1);u.onDestroy();});
 await run('sky city: the Build05 lease file stays pinned; the r4.2 wrapper keeps its scene active under the hidden host, swap = camera only',async()=>{
  // test-journey-occlusion pins region/SkycityBoardBackground.ts by sha256 (09 plaza composition), so r4.2 wraps it (SkycityBoardLive.ts).
  const S=path.join(__dirname,'../../creator-build-project/assets/scripts/'),wn=fs.readFileSync(S+'world-r2/WorldNativeComposition.ts','utf8');
  assert.match(wn,/^import \{ createSkycityBoardBackground \} from '\.\.\/region\/SkycityBoardLive';/m,'composition takes the wrapped sky-city factory');
  let inner=null;const fake={createSkycityBoardBackground:async({parent})=>{ // same visibility contract as the Build05 lease: setVisible toggles rig+camera
   const rig=new H0.cc.Node('SkycityLiveBackground');parent.addChild(rig);const cn=new H0.cc.Node('SkycityBackgroundCamera');rig.addChild(cn);const cam=cn.addComponent(H0.cc.Camera);cam.enabled=false;rig.active=false;let disposed=0;
   inner={rig,cam,get disposed(){return disposed;}};return {frame(){},setVisible(v){rig.active=v;cam.enabled=v;},setPaused(){},diagnostics:()=>({region:'skycity'}),dispose(){disposed++;rig.destroy();}};}};
  const H0=createHarness({overrides:{'region/SkycityBoardBackground':fake}});
  const {createSkycityBoardBackground}=H0.load('region/SkycityBoardLive');
  const host=new H0.cc.Node('ManagedNativeBoardHost');host.active=false;H0.cc._scene.addChild(host);
  const lease=await createSkycityBoardBackground({parent:host,token:{check(){},onCancel(){return ()=>{};}}});
  assert.equal(inner.rig.active,true,'scene active (under the hidden host) right after creation');
  lease.setVisible(false);assert.equal(inner.rig.active,true,'binding load setVisible(false) with the host hidden leaves the scene active');assert.equal(inner.cam.enabled,false);
  const flips=[];const emit=H0.cc.Node.prototype.emit;H0.cc.Node.prototype.emit=function(t,...a){if(t==='active-changed'&&this.activeInHierarchy)flips.push(this.name);return emit.call(this,t,...a);};
  try{host.active=true;const pre=flips.length;lease.setVisible(true);assert.equal(flips.length,pre,'reveal: no scene node switches on');}finally{H0.cc.Node.prototype.emit=emit;}
  assert(flips.includes('SkycityLiveBackground'),'the scene switched on with the host, before the reveal');assert.equal(inner.cam.enabled,true,'reveal = camera on');
  assert.equal(lease.diagnostics().region,'skycity');lease.dispose();assert.equal(inner.disposed,1);});
 await run('wiring: adapter pre-activates after initializeManaged and keeps the background invisible until reveal; region scenes stay active (camera = visibility)',()=>{
  const S=path.join(__dirname,'../../creator-build-project/assets/scripts/'),r=f=>fs.readFileSync(S+f,'utf8');
  const ad=r('world-r2/NativeWorldLevelAdapter.ts');
  assert.match(ad,/const prewarm=\(ui as any\)\.prewarmPresentation;if\(typeof prewarm==='function'\)prewarm\.call\(ui,afterFrame\);/);
  assert.match(ad,/director\.once\('director_after_draw' as any,run\)/);assert.match(ad,/ownedLease=lease;active=lease;/);
  assert.match(ad,/const reveal=\(\)=>\{if\(disposed\)return;root\.active=true;background\.setVisible\(true\);/,'reveal = visibility toggles');
  const md=r('region/MeadowBoardBackground.ts'),lk=r('region/LakesideBoardBackground.ts');
  for(const [n,s] of [['meadow',md],['lakeside',lk]]){const v=s.slice(s.indexOf('setVisible:value=>'));assert.doesNotMatch(v.slice(0,v.indexOf('},')),/rig!?\.active/,n+' setVisible does not (de)activate the scene');}
  assert.match(md,/rig\.active=true;\/\* r4\.2 items 10\/11/);assert.match(lk,/else rig\.active=true;\/\* r4\.2 items 10\/11/);});
})().catch(e=>{console.error(e);process.exitCode=1;});
