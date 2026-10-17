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
// Sky checks use separate shared/instance material objects and injected async loader.
function tex(name){return {name,refs:0,addRef(){this.refs++},decRef(){this.refs--}}}
function setup({device={getFormatFeatures:()=>1},blend=1,sync=false,prebound=null,missingMaterial=false}={}){
 const e=environment();e.cc.gfx.Format={ASTC_RGBA_4X4:101};e.cc.gfx.FormatFeatureBit={SAMPLED_TEXTURE:1};e.cc.Material.prototype.getProperty=function(k){return this.props[k]??null};
 const S=e.load('SkyNightTexture'),node=new e.cc.Node('sky'),r=node.addComponent(e.cc.MeshRenderer),base=new e.cc.Material(),mi=new e.cc.Material();base.effectName=mi.effectName='sky-unlit';base.setProperty('nightBlend',blend);base.setProperty('nightTexture',prebound);mi.copy(base);r.setSharedMaterial(base,0);r.getMaterialInstance=()=>missingMaterial?null:mi;
 const c=node.addComponent(S.SkyNightTexture),pending=[],texture=tex('selected-night');c.skyRenderer=r;c.device=device;c.loader=(bundle,path,done)=>{pending.push({bundle,path,done});if(sync)done(null,texture)};
 return {e,S,c,r,base,mi,pending,texture};
}
{
 const t=setup(),cases=[['yes',{getFormatFeatures:()=>1},'yes'],['no',{getFormatFeatures:()=>0},'no'],['other features',{getFormatFeatures:()=>2},'no'],['missing device',null,'unknown'],['missing function',{},'unknown'],['bad type',{getFormatFeatures:()=>null},'unknown'],['exception',{getFormatFeatures:()=>{throw Error('device lost')}},'unknown']];
 for(const [name,dev,expected]of cases){const r=t.S.detectAstcSupport(dev);record('ASTC capability: '+name,r.support===expected,r)}
 for(const support of ['yes','no','unknown'])record('path choice '+support,t.S.selectNightSkyPath(support).path.includes(support==='yes'?'2048x1024':'1024x512'));
}
for(const [label,device]of [['ASTC',{getFormatFeatures:()=>1}],['no ASTC',{getFormatFeatures:()=>0}],['unknown',null]]){
 const t=setup({device});t.c.onLoad();record(label+' onLoad starts one chosen request and gradient state',t.pending.length===1&&t.c.texMix===0&&t.mi.getProperty('nightTexMix')===0&&t.mi.getProperty('nightTexture')===null&&t.mi.getProperty('nightHorizon').x>0,{path:t.pending[0].path});
 t.pending[0].done(null,t.texture);record(label+' load retains one texture but keeps mix zero until update',t.texture.refs===1&&t.c.texMix===0&&t.mi.getProperty('nightTexture')===t.texture);t.c.update(.1);const a=t.c.texMix;t.c.update(.1);const b=t.c.texMix;t.c.update(.1);record(label+' fade reaches one monotonically in .3 seconds',Math.abs(a-1/3)<1e-10&&Math.abs(b-2/3)<1e-10&&t.c.texMix===1&&!t.c.fading&&t.c.switchMode==='fade',{a,b,end:t.c.texMix});t.c.onDestroy();record(label+' destroy restores empty slot and balances texture ref',t.mi.getProperty('nightTexture')===null&&t.texture.refs===0&&t.c.texMix===0);
}
{
 const t=setup({blend:0});t.c.onLoad();t.pending[0].done(null,t.texture);t.c.update(1/60);record('daytime arrival switches immediately',t.c.texMix===1&&t.c.switchMode==='day');t.c.setNightBlend(.6);record('setNightBlend updates same instance, not shared material',t.c.nightBlend===.6&&t.mi.getProperty('nightBlend')===.6&&t.base.getProperty('nightBlend')===0);t.base.setProperty('nightBlend',1);record('shared material changes do not update owned instance (integration contract)',t.c.nightBlend===.6);t.c.onDestroy();
}
{
 const t=setup({sync:true});t.c.onLoad();record('cached synchronous load renders first frame at full texture mix',t.c.texMix===1&&t.c.switchMode==='sync'&&t.texture.refs===1);t.c.onDestroy();
}
{
 const t=setup();t.c.onLoad();t.pending[0].done(null,t.texture);t.c.update(.1);t.c.setNightBlend(0);t.c.update(.1);t.c.setNightBlend(1);t.c.update(.1);record('day-night changes during fade do not restart it',t.c.texMix===1&&t.c.switchMode==='fade');t.c.onDestroy();t.c.update(10);record('update after destroy performs no further load or fade',t.c.texMix===0&&t.pending.length===1&&t.texture.refs===0);
}
{
 const t=setup();t.c.onLoad();t.c.onDestroy();t.pending[0].done(null,t.texture);record('late successful callback after destroy discarded with balanced ref',t.texture.refs===0&&t.mi.getProperty('nightTexture')===null&&t.c.texMix===0);
}
{
 const t=setup();t.c.retryDelaySeconds=.1;t.c.onLoad();t.pending[0].done(Error('load failed'),null);t.c.update(.05);record('failed load keeps gradient and waits retry delay',t.c.texMix===0&&t.pending.length===1&&t.c.state.state==='failed');t.c.update(.05);record('failure launches one delayed retry',t.pending.length===2&&t.c.retries===1);t.pending[1].done(null,t.texture);t.c.update(.3);record('successful retry fades into texture',t.c.texMix===1&&t.texture.refs===1);t.c.onDestroy();
}
{
 const t=setup();t.c.retryDelaySeconds=.1;t.c.maxRetries=3;t.c.onLoad();for(let i=0;i<4;i++){t.pending[i].done(Error('fail'),null);t.c.update(.1)}t.c.update(100);record('retry cap is initial request plus three retries',t.pending.length===4&&t.c.retries===3&&t.c.texMix===0);t.c.onDestroy();
}
{
 const t=setup();t.c.onLoad();t.pending[0].done(null,t.texture);t.pending[0].done(null,t.texture);t.c.update(.1);t.c.onDestroy();record('duplicate callback and destruction midfade leave zero retained refs',t.texture.refs===0&&t.mi.getProperty('nightTexture')===null&&t.c.texMix===0);
}
{
 const t=setup();t.c.onLoad();const original=t.mi.getProperty.bind(t.mi);t.mi.getProperty=k=>{if(k==='nightTexture')throw Error('injected material getter failure');return original(k)};let threw=false;try{t.pending[0].done(null,t.texture)}catch{threw=true}t.c.onDestroy();record('SkyNightTexture reused swap cleans up failing texture getter',!threw&&t.texture.refs===0,{threw,remainingRefs:t.texture.refs});
}
{
 const t=setup({missingMaterial:true});t.c.onLoad();t.pending[0].done(null,t.texture);t.c.update(.3);record('missing material must not claim applied texture',t.c.state.state!=='applied',{state:t.c.state.state,texMix:t.c.texMix,note:'configuration preflight needed: valid renderer is not enough'});t.c.onDestroy();
}
const out={scope:'independent inspected runtime with self-authored cc mocks, no Creator/GPU/real textures loaded by engine',passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail').length,results};console.log(JSON.stringify(out,null,2));
