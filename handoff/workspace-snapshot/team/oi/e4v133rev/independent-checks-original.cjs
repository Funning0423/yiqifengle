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
{
 const e=environment(false),t=e.build();const grass=t.rs.filter(r=>r.node.name.startsWith('grass_')),flowers=t.rs.filter(r=>r.node.name.startsWith('flower_'));
 record('hardware fallback keeps 30 percent grass',grass.length===300,{grass:grass.length});
 record('requested flower 50 percent exists',flowers.length===75,{expected:75,actual:flowers.length,packageReadme:'flowers remain full density'});
 record('real no-instancing path uses uniform middle green',grass.every(r=>!r.sharedMaterial.passes[0].defines.USE_INSTANCING)&&t.base.props.rootColor?.r===96&&t.base.props.rootColor?.g===174&&t.base.props.rootColor?.b===50,t.base.props.rootColor);
}
{
 const e=environment(true),t=e.build(true),r=t.rs.find(r=>r.node.name.startsWith('grass_'));
 record('forceNoInstancing selects actual non-instanced shader branch',r.sharedMaterial.passes[0].defines.USE_INSTANCING===false,{USE_INSTANCING:r.sharedMaterial.passes[0].defines.USE_INSTANCING,rootAttribute:r.attrs.a_root_color||null,localFlag:t.c.instancing});
}
{
 const e=environment(true),t=e.build(),r=t.rs.find(r=>r.node.name.startsWith('grass_'));record('missing ROOT_COLOR is populated in real instancing path',r.attrs.a_root_color?.slice(0,3).every(x=>x>0),r.attrs.a_root_color);
 const a=e.F.validateRootColors([NaN,1,1],2);record('missing and invalid colors receive fallback',a.invalid===1&&a.missing===1&&a.colors.every(Number.isFinite),a);
 e.Q.applyGrassWindQuality(t.rs,2);const copy=r.sharedMaterial;t.c.onDestroy();record('destroy stops spawned nodes and releases variants',copy.destroyed===true&&t.rs.every(x=>!x.node.active)&&t.base.isValid,{variantDestroyed:copy.destroyed,baseValid:t.base.isValid});
}
{
 const e=environment(true);e.Q.applyGrassWindQuality([],2);const t=e.build();record('async/new instances inherit last quality',t.rs.filter(r=>r.node.name.startsWith('grass_')).every(r=>r.sharedMaterial.passes[0].defines.WIND_QUALITY===2));
 let refresh=0;t.c.onWindChanged=()=>refresh++;t.root.setScale(0.5,0.5,0.5);e.director.emit(e.Director.EVENT_BEFORE_DRAW);record('own meadow-root scale queues refresh',refresh===1,{refresh});
 refresh=0;e.scene.setScale(.5,.5,.5);e.director.emit(e.Director.EVENT_BEFORE_DRAW);record('ancestor-scale automatically queues grass bounds refresh',refresh>0,{refresh,listener:'only meadow root TRANSFORM_CHANGED'});
}
{
 const e=environment(true),sky=new e.cc.Node('sky'),camera=new e.cc.Node('camera');e.scene.addChild(sky);e.scene.addChild(camera);sky.setPosition(1,8,3);const c=sky.addComponent(e.S.SkyFollowCamera);c.cameraNode=camera;c.onEnable();camera.setWorldPosition(410,2,-250);e.director.emit(e.Director.EVENT_BEFORE_DRAW);const p=sky.worldPosition;record('main-camera sky sync before scene-update keeps Y',p.x===410&&p.z===-250&&p.y===8,p);
 camera.setWorldPosition(900,2,900);e.director.emit(e.Director.EVENT_BEFORE_COMMIT);record('late write is warning-only, not repaired',c.lateWrites===1&&sky.worldPosition.x===410,{lateWrites:c.lateWrites,skyX:sky.worldPosition.x,cameraX:camera.worldPosition.x});c.onDisable();record('sky cleanup removes listeners and active instance',e.director.events.length===0&&e.S.SkyFollowCamera.active.size===0);
}
{
 const e=environment();const m=new e.F.FrameBudgetMonitor();let count=0;for(let i=0;i<240;i++)if(m.push(.05))count++;record('frame-budget monitor triggers once on sustained 50ms frames',count===1,{count});const x=e.F.selectFallbackClumps(Array.from({length:5},(_,i)=>({x:i,z:0})));record('stride selection matches documented round(N*ratio)',x.kept===Math.round(5*.3),{expected:2,actual:x.kept});
}
const out={scope:'independent inspected-runtime logic with self-authored cc mocks; not Creator or GPU',passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail').length,results};console.log(JSON.stringify(out,null,2));
