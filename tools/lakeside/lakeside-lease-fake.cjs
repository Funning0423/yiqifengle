// r4.2: a small fake cc + loader that runs the REAL LakesideBoardBackground lease code (build, preload/adopt, setVisible, frame,
// day/night) with an empty scene list, so tests can watch what it does to the scene's shared main light and its own camera.
// Stubbed modules: camera pose/layout (no projection maths), the guest copy, the static merge, the asset deadline (pass-through).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
function createLakesideFake(opts={}){
 class Color{constructor(r=0,g=0,b=0,a=255){if(typeof r==='string'){const h=r.replace('#','');this.r=parseInt(h.slice(0,2),16);this.g=parseInt(h.slice(2,4),16);this.b=parseInt(h.slice(4,6),16);this.a=255;}else Object.assign(this,{r,g,b,a});}clone(){return new Color(this.r,this.g,this.b,this.a);}}
 class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}clone(){return new Vec3(this.x,this.y,this.z);}}
 class Vec4{constructor(x=0,y=0,z=0,w=0){Object.assign(this,{x,y,z,w});}}
 class Quat{constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}clone(){const q=new Quat(this.x,this.y,this.z,this.w);q.fwd=this.fwd;return q;}}
 class Component{constructor(){this.enabled=true;this.node=null;}get enabledInHierarchy(){return this.enabled&&!!this.node&&this.node.activeInHierarchy;}destroy(){this.enabled=false;}}
 const nodes=[];
 class Node{constructor(name=''){this.name=name;this.active=true;this.parent=null;this.children=[];this.components=[];this.layer=1;this.worldPosition=new Vec3();this.rotation=new Quat();this.destroyed=false;nodes.push(this);}
  get activeInHierarchy(){return !this.destroyed&&this.active&&(this.parent?this.parent.activeInHierarchy:this.isScene===true);}
  addChild(c){c.parent=this;this.children.push(c);}removeFromParent(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  destroy(){this.destroyed=true;this.removeFromParent();}
  addComponent(C){const c=new C();c.node=this;this.components.push(c);return c;}getComponent(C){return this.components.find(c=>c instanceof C)||null;}
  getComponentsInChildren(C){const out=[];const walk=n=>{for(const c of n.components)if(c instanceof C)out.push(c);for(const k of n.children)walk(k);};walk(this);return out;}
  getComponentInChildren(C){return this.getComponentsInChildren(C)[0]||null;}getChildByName(n){return this.children.find(c=>c.name===n)||null;}
  setPosition(){}setScale(){}setRotation(q){if(q instanceof Quat)this.rotation=q.clone();}
  lookAt(t){const w=this.worldPosition,d=[t.x-w.x,t.y-w.y,t.z-w.z],l=Math.hypot(...d)||1;this.rotation=new Quat(0,0,0,1);this.rotation.fwd=d.map(v=>v/l);this.looks=(this.looks||0)+1;}}
 class Camera extends Component{constructor(){super();this.visibility=0;this.priority=0;this.clearColor=new Color();}}
 Camera.ProjectionType={PERSPECTIVE:1};Camera.FOVAxis={VERTICAL:0};Camera.ClearFlag={SOLID_COLOR:7};
 class DirectionalLight extends Component{constructor(){super();this.color=new Color(255,255,255);this.illuminance=60000;this.visibility=0xffffffff;}}
 class SphereLight extends Component{constructor(){super();this.luminance=1;}}
 class MeshRenderer extends Component{}class Animation extends Component{}
 class Asset{constructor(){this.refs=0;}addRef(){this.refs++;return this;}decRef(){this.refs--;return this;}}
 class Material extends Asset{constructor(){super();this.props={};this.passes=[];}copy(src){this.src=src;}setProperty(k,v){this.props[k]=v;}destroy(){this.destroyed=true;}}
 class JsonAsset extends Asset{}class Prefab extends Asset{}class Mesh extends Asset{}
 const scene=new Node('Scene');scene.isScene=true;scene.globals={ambient:{skyLightingColor:new Color(200,220,255),groundLightingColor:new Color(120,110,90),skyIllum:20000},fog:{enabled:false,type:0,fogColor:new Color(200,200,200),fogStart:0,fogEnd:300,fogTop:4,fogRange:10,fogAtten:5}};
 const lightNode=new Node('Main Light');scene.addChild(lightNode);const light=lightNode.addComponent(DirectionalLight);
 const log={bundleLoads:0,materialLoads:0,downloads:[]};
 const TRANSFORMS=()=>Object.assign(new JsonAsset(),{json:{instances:[{name:'LK_tree_1',glb:'LK_tree.glb',pos:[1,0,1],rot_quat_xyzw:[0,0,0,1],scale:[1,1,1]}]}});
 const bundle={name:'region_lakeside',load(p,type,cb){if(type===Material){log.materialLoads++;const f=opts.materialLoad;if(f)return f(p,cb);return cb(null,new Material());}cb(null,TRANSFORMS());},
  loadDir(_p,_t,cb){cb(null,[Object.assign(new Prefab(),{name:'LK_tree'})]);},get(_p,type){return type===JsonAsset?TRANSFORMS():null;},getInfoWithPath:p=>opts.infoWithPath?opts.infoWithPath(p):null,getAssetInfo:u=>opts.assetInfo?opts.assetInfo(u):null};
 const afterDraw=[];
 const director={getScene:()=>scene,once(ev,fn){if(ev==='director_after_draw')afterDraw.push(fn);},root:null};
 const assetManager={loadBundle(name,cb){log.bundleLoads++;cb(null,bundle);},getBundle:()=>bundle,
  utils:{transform:(uuid,o)=>'remote/'+o.bundle+'/'+uuid+o.ext},downloader:{download:(id,url,type,o,cb)=>{log.downloads.push({id,url,type});(opts.download||((i,u,t,oo,c)=>c(null,{})))(id,url,type,o,cb);}}};
 const cc=new Proxy({Color,Vec3,Vec4,Quat,Node,Camera,DirectionalLight,SphereLight,MeshRenderer,Animation,Material,JsonAsset,Prefab,Mesh,Mat4:class{},director,assetManager,
  instantiate:p=>new Node(p.name),isValid:o=>!!o&&!o.destroyed,gfx:{AttributeName:{},Format:{},Attribute:class{}},utils:{createMesh:()=>new Mesh()},AssetManager:{}},
  {get:(t,k)=>k in t?t[k]:class{}});
 const stubs={
  'RegionAssetDeadline':{waitRegionAsset:p=>p},
  'CameraPose':{applyCameraPose:()=>true,CameraTrackFailure:class extends Error{}},
  'LakesideCameraLayout':{lakesideAlignedBoardPose:()=>({})},
  'LakesideBoardGuest':{mountLakesideGuest:()=>({renderers:0,dispose(){}})},
  'LakesideStaticMerge':{lakesideStaticMergeFromEnv:()=>false,lakesideMaterialKey:()=>'',lakesideMergePlan:()=>[],lakesideAttrToFloat:()=>[],lakesideAppendPiece:()=>{}},
 };
 const cache=new Map();
 function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
  const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
  const req=spec=>{if(spec==='cc')return cc;if(spec==='cc/env')return {DEBUG:false,BUILD:true};const base=path.basename(spec);if(stubs[base])return stubs[base];return load(path.resolve(path.dirname(file),spec)+'.ts');};
  vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,req,m);return m.exports;}
 const flushFrames=async(n=50)=>{for(let i=0;i<n;i++){const l=afterDraw.splice(0);for(const f of l)f();await new Promise(r=>setImmediate(r));}};
 return {cc,S,load,scene,light,lightNode,Node,Camera,Color,log,flushFrames,setMode(mode){globalThis.__worldDayNight={snapshot:()=>({mode}),reapply(){}};}};
}
module.exports={createLakesideFake};
