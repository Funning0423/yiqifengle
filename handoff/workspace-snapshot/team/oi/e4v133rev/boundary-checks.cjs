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
// Separate boundary extension. Original 15-case runner above remains byte-for-byte unchanged.
{
 const e=environment();let checked=0,ok=true;
 for(let n=0;n<=31;n++)for(const ratio of [-1,0,.01,.3,.5,.99,1,2])for(const anchored of [false,true]){
  const clumps=Array.from({length:n},(_,i)=>({x:i,z:i%3}));
  const a=e.F.selectFallbackClumps(clumps,{keepRatio:ratio,views:anchored?[{x:0,z:0}]:[]});
  const target=Math.round(n*Math.max(0,Math.min(1,ratio)));
  if(a.kept!==target||a.keep.filter(Boolean).length!==target||a.keep.length!==n)ok=false;checked++;
 }
 record('both selection branches round/clamp and handle empty inputs',ok,{cases:checked});
}
{
 const e=environment(true),t=e.build(true);const own=[...t.c.forcedVariants.values()];
 record('forced fallback leaves original asset instancing enabled',t.base.passes[0].defines.USE_INSTANCING===true);
 let allFalse=true;for(const q of [0,2,1]){e.Q.applyGrassWindQuality(t.rs,q);allFalse&&=t.rs.every(r=>r.sharedMaterial.passes[0].defines.USE_INSTANCING===false);}
 record('quality toggles preserve forced non-instancing for grass and flowers',allFalse);
 const families=own.flatMap(m=>e.Q.getGrassWindMaterialFamily(m));t.c.onDestroy();
 record('forced base copies and quality copies all destroyed without original asset',families.every(m=>m.destroyed)&&t.base.isValid,{copies:families.length,originalValid:t.base.isValid});
}
function sharedRegion(e,base,name){
 const root=new e.cc.Node(name);e.scene.addChild(root);const template=new e.cc.Node('grass_template');root.addChild(template);const mr=template.addComponent(e.cc.MeshRenderer);mr.mesh={struct:{}};mr.setSharedMaterial(base,0);
 const c=root.addComponent(e.M.MeadowInstancer);c.instances={json:{groups:[{node:template.name,template:'grass_shared',count:10,t:new Array(30).fill(0),attrs:{_ROOT_COLOR:new Array(30).fill(.2)}}]}};c.start();return {root,c,rs:root.getComponentsInChildren(e.cc.MeshRenderer).filter(r=>r.node.parent?.name.endsWith('_expanded'))};
}
{
 const e=environment(),base=new e.cc.Material(),a=sharedRegion(e,base,'a'),b=sharedRegion(e,base,'b');
 e.Q.applyGrassWindQuality([...a.rs,...b.rs],2);const variant=b.rs[0].sharedMaterial;
 record('two regions register same material root twice',e.Q.grassWindMaterialUsers(base)===2);
 a.c.onDestroy();record('first region unload preserves live shared variant',!variant.destroyed&&e.Q.grassWindMaterialUsers(base)===1&&b.rs.every(r=>r.sharedMaterial.isValid));
 b.c.onDestroy();record('last region unload releases variant but preserves asset',variant.destroyed&&e.Q.grassWindMaterialUsers(base)===0&&base.isValid);
}
{
 const e=environment(),t=e.build();let refresh=0;t.c.onWindChanged=()=>refresh++;
 e.director.emit(e.Director.EVENT_BEFORE_DRAW);e.director.emit(e.Director.EVENT_BEFORE_DRAW);
 record('unchanged scale does not repeatedly refresh',refresh===0,{refresh});
 e.scene.setScale(.25,.5,.75);e.director.emit(e.Director.EVENT_BEFORE_DRAW);e.director.emit(e.Director.EVENT_BEFORE_DRAW);
 record('ancestor nonuniform scale triggers one refresh',refresh===1,{refresh});
 t.c.markBoundsDirty();e.director.emit(e.Director.EVENT_BEFORE_DRAW);t.c.onEnable();e.director.emit(e.Director.EVENT_BEFORE_DRAW);
 record('explicit dirty and re-enable each refresh once',refresh===3,{refresh});
 t.c.onDestroy();const remaining=e.director.events.filter(x=>x.t===t.c).length;record('teardown removes continuous bounds listener',remaining===0,{remaining});
}
{
 const e=environment(),sky=new e.cc.Node('sky'),camera=new e.cc.Node('camera');e.scene.addChild(sky);e.scene.addChild(camera);const c=sky.addComponent(e.S.SkyFollowCamera);c.cameraNode=camera;c.onEnable();
 e.director.on(e.Director.EVENT_BEFORE_DRAW,()=>{camera.setWorldPosition(900,0,900);e.S.SkyFollowCamera.syncAll();});
 e.director.emit(e.Director.EVENT_BEFORE_DRAW);e.director.emit(e.Director.EVENT_BEFORE_COMMIT);
 record('late BEFORE_DRAW writer using syncAll respects contract',sky.worldPosition.x===900&&c.lateWrites===0,{skyX:sky.worldPosition.x,lateWrites:c.lateWrites});c.onDisable();
}
console.log(JSON.stringify({scope:'independent boundary extension with cc mocks; not actual engine or shader execution',passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail').length,results},null,2));
