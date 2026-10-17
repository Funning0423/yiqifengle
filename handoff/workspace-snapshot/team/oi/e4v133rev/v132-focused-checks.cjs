// Independent bounded logic harness. Not Creator, shader compilation or GPU testing.
// Runs only inspected runtime TS, removing type/decorator syntax; no supplied tests/installers.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=process.argv[2];if(!source)throw Error('Pass the verified package root');
const results=[];const record=(name,passed,detail)=>results.push({name,status:passed?'pass':'fail',detail});
function environment(hardware=true){
 class Events{constructor(){this.events=[];}on(e,f,t){this.events.push({e,f,t});}once(e,f,t){this.events.push({e,f,t,once:true});}off(e,f,t){this.events=this.events.filter(x=>!(x.e===e&&x.f===f&&x.t===t));}targetOff(t){this.events=this.events.filter(x=>x.t!==t);}emit(e,...a){for(const x of this.events.slice())if(x.e===e){if(x.once)this.off(e,x.f,x.t);x.f.apply(x.t,a);}}}
 class Vec3{constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){if(typeof x==='object')({x,y,z}=x);Object.assign(this,{x,y,z});return this;}static transformMat4(out,v,m){return out.set(m.p.x+v.x*m.s.x,m.p.y+v.y*m.s.y,m.p.z+v.z*m.s.z);}}
 class Vec4 extends Vec3{set(x,y,z,w){super.set(x,y,z);this.w=w;return this;}}
 class Component{constructor(){this.isValid=true;this.enabled=true;}get enabledInHierarchy(){return this.enabled&&this.node?.active;}}
 class Node extends Events{constructor(name=''){super();Object.assign(this,{name,children:[],parent:null,comps:[],position:new Vec3(),scale:new Vec3(1,1,1),rotation:{x:0,y:0,z:0,w:1},active:true,isValid:true,layer:1});}addChild(n){this.children.push(n);n.parent=this;}setPosition(...a){this.position.set(...a);}setScale(...a){this.scale.set(...a);this.emit('transform',4);}setRotation(q){this.rotation={...q};}get worldScale(){const s=this.parent?.worldScale||new Vec3(1,1,1);return new Vec3(s.x*this.scale.x,s.y*this.scale.y,s.z*this.scale.z);}get worldPosition(){const p=this.parent?.worldPosition||new Vec3(),s=this.parent?.worldScale||new Vec3(1,1,1);return new Vec3(p.x+this.position.x*s.x,p.y+this.position.y*s.y,p.z+this.position.z*s.z);}get worldMatrix(){return {p:this.worldPosition,s:this.worldScale};}setWorldPosition(x,y,z){const p=this.parent?.worldPosition||new Vec3(),s=this.parent?.worldScale||new Vec3(1,1,1);this.position.set((x-p.x)/s.x,(y-p.y)/s.y,(z-p.z)/s.z);}addComponent(C){const c=new C();c.node=this;this.comps.push(c);return c;}getComponent(C){return this.comps.find(x=>x instanceof C)||null;}getComponentsInChildren(C){return [...this.comps.filter(x=>x instanceof C),...this.children.flatMap(n=>n.getComponentsInChildren(C))];}destroy(){this.isValid=false;}}
 class Material{constructor(){this.effectAsset={};this.effectName='meadow-grass-wind';this.props={};this.isValid=true;this.name='base';this.passes=[{defines:{WIND_QUALITY:1,USE_INSTANCING:hardware,USE_INSTANCE_ROOT_COLOR:true},getHandle:()=>0}];}copy(m,o={}){this.effectName=m.effectName;this.props={...m.props};this.passes=[{...m.passes[0],defines:{...m.passes[0].defines,...o.defines}}];if(!hardware)this.passes[0].defines.USE_INSTANCING=false;}setProperty(k,v){this.props[k]=v;}destroy(){this.isValid=false;this.destroyed=true;}}
 class MeshRenderer extends Component{constructor(){super();this.sharedMaterials=[];this.attrs={};this.mesh=null;this.model=null;}static ShadowCastingMode={ON:1,OFF:0};get sharedMaterial(){return this.sharedMaterials[0];}setSharedMaterial(m,i){this.sharedMaterials[i]=m;this.attrs={};}setInstancedAttribute(k,v){if(this.sharedMaterial?.passes[0].defines.USE_INSTANCING)this.attrs[k]=Array.from(v);}getMaterialInstance(){return this.sharedMaterial;}}
 class Camera extends Component{priority=0;}
 class Color{constructor(r,g,b,a){Object.assign(this,{r,g,b,a});}}
 const director=new Events();director.root={device:{hasFeature:()=>hardware}};director.getScene=()=>scene;
 const Director={EVENT_BEFORE_DRAW:'beforeDraw',EVENT_BEFORE_COMMIT:'beforeCommit'};
 const cc={Node,Component,Material,MeshRenderer,Camera,Color,Vec3,Vec4,Quat:Vec4,JsonAsset:class{},Mesh:class{},Texture2D:class{},EventTarget:Events,NodeEventType:{TRANSFORM_CHANGED:'transform'},TransformBit:{SCALE:4},director,Director,gfx:{Feature:{INSTANCED_ARRAYS:1}},renderer:{MaterialInstance:class{}},_decorator:{}};
 const scene=new Node('scene'),cache={};
 function load(name){if(cache[name])return cache[name];let ts=fs.readFileSync(path.join(source,'runtime/scripts',name+'.ts'),'utf8');
  const names=[...ts.matchAll(/export\s+(?:async\s+)?(?:function|const|class|enum)\s+(\w+)/g)].map(m=>m[1]);
  ts=ts.replace(/@ccclass\([^)]*\)\s*/g,'').replace(/@property(?:\([^)]*\))?\s*/g,'');
  let js=stripTypeScriptTypes(ts,{mode:'transform'}).replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,(_,list,dep)=>`const {${list}}=require(${JSON.stringify(dep)});`).replace(/\bexport\s+/g,'');
  const module={exports:{}};const context={module,exports:module.exports,require:dep=>dep==='cc'?cc:load(dep.replace('./','')),console:{warn:()=>{}},setTimeout,clearTimeout};
  vm.runInNewContext(js+`\nmodule.exports={${names.join(',')}};`,context,{filename:name+'.review.js',timeout:1000});return cache[name]=module.exports;
 }
 const F=load('GrassFallback'),Q=load('GrassWindQuality'),M=load('MeadowInstancer'),S=load('SkyFollowCamera');
 function build(force=false){const root=new Node('meadow');scene.addChild(root);const groups=[];const base=new Material();for(const [template,count,mat]of[['grass_test',1000,base],['flower_test',150,Object.assign(new Material(),{effectName:'builtin-standard'})]]){const src=new Node(template+'_instances');root.addChild(src);const r=src.addComponent(MeshRenderer);r.mesh={struct:{}};r.setSharedMaterial(mat,0);groups.push({node:src.name,template,count,t:Array.from({length:count*3},(_,i)=>i%3===0?Math.floor(i/3):0),attrs:{}});}const c=root.addComponent(M.MeadowInstancer);c.instances={json:{groups}};c.forceNoInstancing=force;c.start();return {c,root,base,rs:root.getComponentsInChildren(MeshRenderer).filter(r=>r.node.parent?.name.endsWith('_expanded'))};}
 return {cc,scene,director,Director,F,Q,M,S,build,load};
}
// New v1.3.2 focused checks. These mocks do not assert Creator asset ownership.
function texture(name){return {name,refs:0,addRef(){this.refs++},decRef(){this.refs--}};}
function fixture(opts={}){const e=environment(),{BakedGroundSwap}=e.load('BakedGroundTexture');let original=texture('original'),slot=original,valid=true;const pending=[];const target={get:()=>slot,set:t=>{slot=t},valid:()=>valid};Object.assign(target,opts);const b=new BakedGroundSwap(target,(bundle,path,done)=>pending.push(done),'region_meadow','textures/tex_meadow_ground_grassoff_1024/texture');return {b,pending,original,slot:()=>slot,invalidate:()=>valid=false};}
{
 const t=fixture(),tex=texture('baked');record('ground never loaded at construction',t.pending.length===0&&t.b.state==='idle');t.b.setWanted(true);record('ground remains original while asynchronous load pending',t.pending.length===1&&t.slot()===t.original&&t.b.state==='loading');t.pending[0](null,tex);record('loaded ground replaces original and retains one ref',t.slot()===tex&&tex.refs===1&&t.b.state==='applied');t.b.setWanted(false);record('restore reinstates original and releases retained ref',t.slot()===t.original&&tex.refs===0&&t.b.state==='idle');
}
{
 const t=fixture(),a=texture('stale'),b=texture('current');t.b.setWanted(true);t.b.setWanted(false);t.b.setWanted(true);t.pending[1](null,b);t.pending[0](null,a);record('out of order old load does not overwrite current texture',t.slot()===b&&a.refs===0&&b.refs===1&&t.b.stats.stale===1);t.pending[1](null,b);record('duplicate callback ignored without extra retain',b.refs===1&&t.b.stats.applied===1);t.b.dispose();t.b.dispose();record('dispose idempotently restores and releases applied texture',b.refs===0&&t.slot()===t.original);
}
{
 const t=fixture(),tex=texture('late');t.b.setWanted(true);t.b.dispose();t.pending[0](null,tex);record('unload during load discards callback with balanced refs',t.slot()===t.original&&tex.refs===0&&t.b.stats.stale===1);t.b.setWanted(true);record('disposed swap will not launch further load',t.pending.length===1);
}
{
 const t=fixture();t.b.setWanted(true);t.pending[0](Error('test failure'),null);record('failed load leaves original intact and permits next off-on retry',t.slot()===t.original&&t.b.state==='failed');t.b.setWanted(false);t.b.setWanted(true);record('off-on retry launches second request',t.pending.length===2);
}
{
 const t=fixture(),tex=texture('target destroyed');t.b.setWanted(true);t.invalidate();t.pending[0](null,tex);record('invalid target ignores loaded texture with balanced refs',tex.refs===0&&t.slot()===t.original&&t.b.state==='failed');
}
function integration(hardware=true,force=false){const e=environment(hardware);e.cc.Material.prototype.getProperty=function(k){return this.props[k]??null};const t=e.build(force),g=new e.cc.Node('ground');e.scene.addChild(g);const gr=g.addComponent(e.cc.MeshRenderer),gm=new e.cc.Material(),original=texture('original'),pending=[];gm.setProperty('mainTexture',original);gr.setSharedMaterial(gm,0);t.c.groundRenderer=gr;t.c.groundTextureLoader=(bundle,path,done)=>pending.push({bundle,path,done});const grass=t.rs.filter(r=>r.node.name.startsWith('grass_')),flowers=t.rs.filter(r=>r.node.name.startsWith('flower_'));return {...t,e,gr,gm,original,pending,grass,flowers};}
for(const hardware of [true,false]){
 const t=integration(hardware);t.e.Q.applyGrassWindQuality(t.rs,0);record('WIND_QUALITY OFF leaves grass present and starts no ground request: hardware='+hardware,!t.c.grassOff&&t.grass.every(x=>x.enabled)&&t.pending.length===0&&t.grass.every(x=>x.sharedMaterial.passes[0].defines.WIND_QUALITY===0));
 for(let i=0;i<600;i++)t.c.update(1/60);for(let i=0;i<140;i++)t.c.update(.05);
 if(hardware)record('instanced mode does not monitor slow frames or switch ground',!t.c.grassOff&&t.pending.length===0);
 else{record('noninstancing sustained slow frames disable only grass and request ground once',t.c.grassOff&&t.c.grassOffReasons.has('budget')&&t.grass.every(x=>!x.enabled)&&t.flowers.every(x=>x.enabled)&&t.pending.length===1,{grass:t.grass.length,flowers:t.flowers.length,request:t.pending[0]&&{bundle:t.pending[0].bundle,path:t.pending[0].path}});const tex=texture('baked');t.pending[0].done(null,tex);t.e.Q.applyGrassWindQuality(t.rs,2);t.c.setGrassOff(false);record('budget remains sticky across quality changes and clearing manual reason',t.c.grassOff&&!t.grass.some(x=>x.enabled)&&tex.refs===1);t.c.onDestroy();record('MeadowInstancer unload restores ground and releases baked ref',t.gm.getProperty('mainTexture')===t.original&&tex.refs===0);}
}
{
 const t=integration();t.c.setGrassOff(true);record('manual API can still hide instanced grass (document default-only restriction)',t.c.grassOff&&t.pending.length===1);t.c.setGrassOff(false,'all');t.c.grassOffWhenWindQualityOff=true;t.e.Q.applyGrassWindQuality(t.rs,0);record('debug quality opt-in can still hide grass (must remain false in production)',t.c.grassOff&&t.pending.length===2);
}
{
 const t=integration(true,true);for(let i=0;i<240;i++)t.c.update(.05);record('forceNoInstancing deliberately activates budget fallback on capable hardware',t.c.grassOff&&t.pending.length===1);
}
{
 const t=fixture({get:()=>{throw Error('material getter failure')}}),tex=texture('getter failure');t.b.setWanted(true);let threw=false;try{t.pending[0](null,tex)}catch{threw=true}t.b.dispose();record('exception in target.get is caught and retained ref released',!threw&&tex.refs===0,{threw,remainingRefs:tex.refs,state:t.b.state});
}
const out={scope:'inspected E4 runtime logic with self-authored cc mocks, not Creator/GPU or actual asset release',passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail').length,results};console.log(JSON.stringify(out,null,2));
