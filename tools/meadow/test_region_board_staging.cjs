// r5 G1: meadow / sky-city live board staging (RegionBoardStaging, wired in withRegionBoardGuest). Fake engine with a frame clock:
// a model is made when an enabled MeshRenderer is active in the hierarchy (Cocos 3.8.8 MeshRenderer.onEnable → _updateModels);
// a renderer's variants compile on the first frame an enabled camera draws it (WebGL2Shader.gpuShader is lazy). Renderer and
// material counts come from the real env_meadow.glb / env_skycity.glb (+ her 4 skinned renderers). Prints per-frame work
// (models made, new variant keys compiled) for the r4.2 board flow (host on one frame after enter, reveal ~48 frames later)
// before (no frame clock → old path) and after staging, and checks the b07-wip flow (reveal before the host is on) is unchanged.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../../creator-build-project/assets/'),S=ROOT+'scripts/';
const run=async(n,f)=>{const r=await f();console.log('PASS',n+(r?' '+JSON.stringify(r):''));};
// ---------- fake engine ----------
const W={frame:0,made:[],compiled:[],cams:[],seen:new Set(),listeners:[]};
const bump=(a)=>{a[W.frame]=(a[W.frame]||0)+1;};
class Component{constructor(){this._enabled=true;}get enabled(){return this._enabled;}set enabled(v){const was=this._enabled&&this.node&&this.node.activeInHierarchy;this._enabled=!!v;const now=this._enabled&&this.node&&this.node.activeInHierarchy;if(!was&&now)this.onEnable();}onEnable(){}}
class MeshRenderer extends Component{constructor(){super();this.model=null;this.sharedMaterials=[];this.mesh=null;}onEnable(){if(!this.model){this.model={r:this,drawn:false};bump(W.made);}}}
class SkinnedMeshRenderer extends MeshRenderer{}
class Rect{constructor(x,y,w,h){this.x=x;this.y=y;this.width=w;this.height=h;}}
class Camera extends Component{constructor(){super();this._enabled=false;this.rect=new Rect(0,0,1,1);this.clearFlags=7;}onEnable(){}}
Camera.ClearFlag={SKYBOX:7,SOLID_COLOR:7,DEPTH_ONLY:6,DONT_CLEAR:0};
class Node{constructor(name){this.name=name;this.children=[];this.parent=null;this.comps=[];this.valid=true;this._active=true;}
 get activeInHierarchy(){return this._active&&(!this.parent||this.parent.activeInHierarchy);}
 get active(){return this._active;}set active(v){const was=this.activeInHierarchy;this._active=!!v;if(!was&&this.activeInHierarchy)this.walk(n=>{for(const c of n.comps)if(c._enabled)c.onEnable();});}
 walk(f){f(this);for(const c of this.children)if(c._active)c.walk(f);}
 addChild(c){c.parent=this;this.children.push(c);}getChildByName(n){return this.children.find(c=>c.name===n)||null;}
 addComponent(C){const c=new C();c.node=this;this.comps.push(c);return c;}getComponent(C){return this.comps.find(c=>c instanceof C)||null;}
 getComponentsInChildren(C){const out=[];const walk=n=>{for(const c of n.comps)if(c instanceof C)out.push(c);n.children.forEach(walk);};walk(this);return out;}
 destroy(){this.valid=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}}
let scene;let clock=true;
const director={getScene:()=>scene,get on(){return clock?(e,f)=>{assert.equal(e,'director_after_draw');W.listeners.push(f);}:undefined},get off(){return clock?(e,f)=>{W.listeners=W.listeners.filter(x=>x!==f);}:undefined}};
const cc={Component,MeshRenderer,SkinnedMeshRenderer,SkeletalAnimation:class extends Component{},Camera,Rect,Node,Quat:class{},Vec3:class{},instantiate:n=>n,director,game:{canvas:{width:780,height:1688}},isValid:o=>!!o&&o.valid!==false&&(!o.node||o.node.valid!==false)};
// draw: every enabled camera in an active node draws every made model under its rig once; first draw compiles its new variant keys
function draw(){const work={newKeys:0,firstDraws:0};for(const cam of W.cams){if(!cam._enabled||!cam.node.activeInHierarchy)continue;
 for(const r of cam.node.parent.getComponentsInChildren(MeshRenderer)){if(!r.model||!r._enabled||!r.node.activeInHierarchy||r.model.drawn)continue;r.model.drawn=true;work.firstDraws++;
  for(const k of r.keys)if(!W.seen.has(k)){W.seen.add(k);work.newKeys++;}}}
 if(work.newKeys)W.compiled[W.frame]=(W.compiled[W.frame]||0)+work.newKeys;}
function frame(){draw();for(const f of W.listeners.slice())f();W.frame++;}
const load=(f)=>{const out=ts.transpileModule(fs.readFileSync(S+f,'utf8'),{compilerOptions:{module:1,target:1,downlevelIteration:false}}).outputText;const E={};
 vm.runInThisContext('(function(exports,require){'+out+'\n})')(E,s=>s==='cc'?cc:s==='./RegionBoardStaging'?STG:null);return E;};
const STG=load('region/RegionBoardStaging.ts'),G=load('region/LakesideBoardGuest.ts');
function glb(f){const d=fs.readFileSync(ROOT+f),L=d.readUInt32LE(12);return JSON.parse(d.subarray(20,20+L).toString('utf8'));}
const HER='bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb';
function addRenderers(parent,j,Kind,tag){const mats=(j.materials||[]).map((m,i)=>({tag:tag+':'+i}));let n=0;
 for(const nd of j.nodes){if(!('mesh' in nd))continue;const m=j.meshes[nd.mesh];const node=new Node(nd.name||'m');parent.addChild(node);const r=node.addComponent('skin' in nd?Kind:MeshRenderer);
  r.sharedMaterials=m.primitives.map(p=>mats[p.material||0]);const morph=m.primitives.some(p=>p.targets&&p.targets.length);r.mesh=morph?{struct:{morph:{}}}:null;
  r.keys=[...new Set(r.sharedMaterials.map(x=>('skin' in nd?'S':'M')+(morph?'+':'')+x.tag))];n++;}return n;}
function world(region){W.frame=0;W.made=[];W.compiled=[];W.cams=[];W.seen=new Set();W.listeners=[];
 const name=region==='meadow'?'env_meadow':'env_skycity',rigName=region==='meadow'?'MeadowLiveScene':'SkycityLiveBackground',camName=region==='meadow'?'MeadowBackgroundCamera':'SkycityBackgroundCamera';
 scene=new Node('scene');const jr=new Node('RegionJourney-'+region);scene.addChild(jr);jr.addChild(new Node(name));
 const host=new Node('ManagedNativeBoardHost');host._active=false;scene.addChild(host);const j=glb('bundles/region_'+region+'/'+name+'.glb'),her=glb(HER);let counts=null;
 const factory=async({parent})=>{const rig=new Node(rigName);rig._active=false;parent.addChild(rig);const cam=rig.addComponent?null:null;
  const cn=new Node(camName);rig.addChild(cn);const c=cn.addComponent(Camera);W.cams.push(c);
  const model=new Node(name);rig.addChild(model);const nm=addRenderers(model,j,SkinnedMeshRenderer,region);
  const imported=new Node('GLB_Camera');model.addChild(imported);const ic=imported.addComponent(Camera);W.cams.push(ic);
  const guest=new Node('LakesideBoardGuest');model.addChild(guest);const ng=addRenderers(guest,her,SkinnedMeshRenderer,'her');counts={region:nm,her:ng};
  rig.active=true;// r4.2 factory: rig on under the (inactive) host
  return {frame(){},setVisible(v){c.enabled=v;},setPaused(){},diagnostics:()=>({region}),dispose(){rig.destroy();}};};
 return {host,factory,rigName,get counts(){return counts;},get cam(){return W.cams[0];},get imported(){return W.cams[1];}};}
// r4.2 flow: enter (frame 0) builds the lease; host on at frame 1 (prewarmPresentation); reveal at frame 49 (Mac r4: 71.074→71.887 s)
async function flow(region,{staged,r42=true,reveal=49,end=60}){clock=staged;const w=world(region);
 const lease=await G.withRegionBoardGuest(region,w.rigName,1<<20,w.factory)({parent:w.host,selection:{},token:{}});
 if(!r42)lease.setVisible(true);// b07-wip: adapter shows the background at the end of enter, host still inactive
 const cams=[];for(let f=0;f<end;f++){if(f===1&&r42)w.host.active=true;if(f===reveal){if(r42)lease.setVisible(true);else w.host.active=true;}
  cams.push({f,on:w.cam._enabled,rect:w.cam.rect.width,clear:w.cam.clearFlags});frame();}
 const per=a=>Array.from({length:end},(_,i)=>a[i]||0);return {w,lease,made:per(W.made),compiled:per(W.compiled),cams};}
const max=a=>Math.max(...a),nz=a=>a.map((v,i)=>v?i+':'+v:null).filter(Boolean).join(' ');
(async()=>{
await run('pure helpers: tiny corner rect ≈ viewportPx device pixels, clamped; batches take ≤per renderers and ≤fresh new variant keys',()=>{
 const r=STG.stagingRect(2,780,1688);assert.equal(r.x,0);assert.equal(r.y,0);assert(Math.abs(r.width*780-2)<1e-9&&Math.abs(r.height*1688-2)<1e-9);
 assert.equal(STG.stagingRect(2,10,10).width,.02);assert.equal(STG.stagingRect(2,1e6,1e6).width,.0005);
 const q=['a','a','b','c','a','b'],seen=[];const b1=STG.nextBatch(q,x=>[x],seen,4,1);assert.deepEqual(b1,['a','a','a']);
 const b2=STG.nextBatch(q,x=>[x],seen,4,1);assert.deepEqual(b2,['b','b']);assert.deepEqual(STG.nextBatch(q,x=>[x],seen,4,1),['c']);assert.equal(q.length,0);});
for(const region of ['meadow','skycity'])await run(region+' r4.2 flow: before = all models on the host-on frame + all variants on the swap frame; after = ≤4 models and ≤1 new material/kind per frame, done before the reveal, swap frame makes/compiles nothing',async()=>{
 const b=await flow(region,{staged:false}),a=await flow(region,{staged:true});const n=a.w.counts.region+a.w.counts.her;
 assert.equal(b.lease.diagnostics().staging,null,'no frame clock → old path');
 assert.equal(b.made[1],n,'before: every model is made on the host-on frame');assert.equal(b.compiled.slice(0,49).reduce((x,y)=>x+y,0),0,'before: nothing drawn until the reveal');assert(b.compiled[49]>=3,'before: all variants on the swap frame');
 assert(max(a.made)<=4,'after: ≤4 models a frame');assert.equal(a.made.reduce((x,y)=>x+y,0),n,'every model made once');
 const s=a.lease.diagnostics().staging;assert.equal(s.done,true);assert.equal(s.reason,'staged');assert.equal(s.flushed,0);assert.equal(s.parked,n);assert.equal(s.camera,a.w.rigName==='MeadowLiveScene'?'MeadowBackgroundCamera':'SkycityBackgroundCamera');
 const last=a.made.reduce((m,v,i)=>v?i:m,0);assert(last<49,'staging ends before the reveal');assert.equal(a.made[49],0);assert.equal(a.compiled[49],0,'after: swap frame compiles nothing new');
 assert.equal(a.compiled.reduce((x,y)=>x+y,0),b.compiled.reduce((x,y)=>x+y,0),'same variants overall');
 // per-frame new keys: ≤ the keys of one fresh renderer (a renderer with several materials brings them together)
 const maxKeys=Math.max(...a.w.host.getComponentsInChildren(MeshRenderer).map(r=>r.keys.length));assert(max(a.compiled)<=maxKeys,'≤1 fresh renderer per frame');
 // camera: tiny depth-only corner while staging, back to off / full / original clear before the reveal, never touched imported cams
 const st=a.cams.filter(c=>c.on&&c.f<49);assert(st.length>0);for(const c of st){assert(c.rect<.01);assert.equal(c.clear,6);}
 const pre=a.cams[48];assert.deepEqual([pre.on,pre.rect,pre.clear],[false,1,7]);assert.equal(a.cams[50].on,true);assert.equal(a.w.imported._enabled,false);
 assert.equal(W.listeners.length,0,'unsubscribed');for(const r of a.w.host.getComponentsInChildren(MeshRenderer))assert.equal(r._enabled,true);
 a.lease.dispose();b.lease.dispose();
 return {renderers:n,before:{models:nz(b.made),variants:nz(b.compiled)},after:{models:nz(a.made),variants:nz(a.compiled),frames:s.frames}};});
await run('b07-wip flow (no r4.2: reveal before the host is on): staging finishes at the reveal → identical per-frame work to before',async()=>{
 const b=await flow('meadow',{staged:false,r42:false}),a=await flow('meadow',{staged:true,r42:false});
 assert.deepEqual(a.made,b.made);assert.deepEqual(a.compiled,b.compiled);const s=a.lease.diagnostics().staging;assert.equal(s.reason,'reveal');assert.equal(s.frames,0);
 assert.equal(W.listeners.length,0);a.lease.dispose();b.lease.dispose();});
await run('short level-loading (reveal at frame 4): remaining renderers switched on at the reveal, camera restored, nothing left off',async()=>{
 const a=await flow('skycity',{staged:true,reveal:4,end:10});const s=a.lease.diagnostics().staging;assert.equal(s.reason,'reveal');assert(s.flushed>0);
 assert.deepEqual([a.cams[5].on,a.cams[5].rect,a.cams[5].clear],[true,1,7]);for(const r of a.w.host.getComponentsInChildren(MeshRenderer))assert.equal(r._enabled,true);a.lease.dispose();});
await run('dispose mid-staging (level left / cancelled): listener removed, camera restored, no later work',async()=>{
 clock=true;const w=world('meadow');const lease=await G.withRegionBoardGuest('meadow',w.rigName,1<<20,w.factory)({parent:w.host,selection:{},token:{}});
 w.host.active=true;frame();frame();frame();assert.equal(w.cam._enabled,true);lease.dispose();assert.equal(W.listeners.length,0);assert.equal(w.cam._enabled,false);assert.equal(w.cam.clearFlags,7);assert.equal(w.cam.rect.width,1);
 assert.equal(lease.diagnostics().staging.reason,'disposed');});
await run('hidden host mid-staging (app paused / board hidden): steps wait, no throw; reveal finishes',async()=>{
 clock=true;const w=world('meadow');const lease=await G.withRegionBoardGuest('meadow',w.rigName,1<<20,w.factory)({parent:w.host,selection:{},token:{}});
 w.host.active=true;frame();frame();w.host.active=false;const f0=lease.diagnostics().staging.frames;frame();frame();assert.equal(lease.diagnostics().staging.frames,f0);
 w.host.active=true;lease.setVisible(true);assert.equal(lease.diagnostics().staging.reason,'reveal');assert.equal(w.cam.rect.width,1);lease.dispose();});
await run('loose-ES5: RegionBoardStaging has no for-of / spread over Map or Set (no Map/Set at all), transpiles at ES5 without downlevelIteration',()=>{
 const src=fs.readFileSync(S+'region/RegionBoardStaging.ts','utf8');assert.doesNotMatch(src,/\bnew (Map|Set)\b/);assert.doesNotMatch(src,/for\s*\(\s*(const|let|var)\s+[^;]*\bof\b/);
 // TS 6 deprecates ES5; keep testing that target while retaining compatibility with older compilers.
 const r=ts.transpileModule(src,{compilerOptions:{module:1,target:1,...(ts.version.startsWith('6.')?{ignoreDeprecations:'6.0'}:{})},reportDiagnostics:true});assert.equal((r.diagnostics||[]).length,0);});
})().catch(e=>{console.error(e);process.exit(1);});
