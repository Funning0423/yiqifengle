'use strict';
// Per-frame camera + REAL RoomLightingRig state for the return (preview only). Mock/replay copied from GGbot tools/t5/test_return_character_light.cjs (read-only reuse).
// usage (cwd = worktree): node lightframes.cjs OUT.json [every=2] [day|night]
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const args=[],opt=()=>null;
const ROOT=process.cwd();
const SCRIPTS=path.join(ROOT,'creator-build-project/assets/scripts');
const S=require(path.join(ROOT,'tools/camera-frame-test/flow_sim.cjs'));
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript');
// ---------- minimal cc mock (same shapes as test_room_light_blend.cjs) ----------
class Color{constructor(r=255,g=255,b=255,a=255){if(typeof r==='string'){const h=r.replace('#','');this.r=parseInt(h.slice(0,2),16);this.g=parseInt(h.slice(2,4),16);this.b=parseInt(h.slice(4,6),16);this.a=255;}else Object.assign(this,{r,g,b,a});}
  set(c){this.r=c.r;this.g=c.g;this.b=c.b;this.a=c.a;return this;}clone(){return new Color(this.r,this.g,this.b,this.a);}
  static lerp(o,a,b,t){o.r=a.r+(b.r-a.r)*t;o.g=a.g+(b.g-a.g)*t;o.b=a.b+(b.b-a.b)*t;o.a=a.a+(b.a-a.a)*t;return o;}}
class Vec4{constructor(x=0,y=0,z=0,w=0){Object.assign(this,{x,y,z,w});}set(x,y,z,w){if(typeof x==='object'){({x,y,z,w}=x);}Object.assign(this,{x,y,z,w});return this;}clone(){return new Vec4(this.x,this.y,this.z,this.w);}
  static lerp(o,a,b,t){return o.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t,a.w+(b.w-a.w)*t);}}
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}clone(){return new Vec3(this.x,this.y,this.z);}}
class Quat{constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}set(q){Object.assign(this,{x:q.x,y:q.y,z:q.z,w:q.w});return this;}clone(){return new Quat(this.x,this.y,this.z,this.w);}
  static fromEuler(o){return o;}static multiply(o){return o;}
  static slerp(o,a,b,t){let c=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w,bx=b.x,by=b.y,bz=b.z,bw=b.w;if(c<0){c=-c;bx=-bx;by=-by;bz=-bz;bw=-bw;}
    let s0,s1;if(1-c>1e-6){const om=Math.acos(c),so=Math.sin(om);s0=Math.sin((1-t)*om)/so;s1=Math.sin(t*om)/so;}else{s0=1-t;s1=t;}
    o.x=s0*a.x+s1*bx;o.y=s0*a.y+s1*by;o.z=s0*a.z+s1*bz;o.w=s0*a.w+s1*bw;return o;}}
const rotate=(q,v)=>{const x=q.x??q[0],y=q.y??q[1],z=q.z??q[2],w=q.w??q[3];const t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])];
  return [v[0]+w*t[0]+y*t[2]-z*t[1],v[1]+w*t[1]+z*t[0]-x*t[2],v[2]+w*t[2]+x*t[1]-y*t[0]];};
function lookAtQuat(from,to){let f=[to[0]-from[0],to[1]-from[1],to[2]-from[2]];const n=Math.hypot(...f);f=f.map(v=>-v/n);
  let xA=[f[2],0,-f[0]];const xn=Math.hypot(...xA);xA=xA.map(v=>v/xn);const yA=[f[1]*xA[2]-f[2]*xA[1],f[2]*xA[0]-f[0]*xA[2],f[0]*xA[1]-f[1]*xA[0]];
  const m00=xA[0],m11=yA[1],m22=f[2],tr=m00+m11+m22;
  if(tr>0){const s=.5/Math.sqrt(tr+1);return new Quat((yA[2]-f[1])*s,(f[0]-xA[2])*s,(xA[1]-yA[0])*s,.25/s);}
  if(m00>m11&&m00>m22){const s=2*Math.sqrt(1+m00-m11-m22);return new Quat(.25*s,(yA[0]+xA[1])/s,(f[0]+xA[2])/s,(yA[2]-f[1])/s);}
  if(m11>m22){const s=2*Math.sqrt(1+m11-m00-m22);return new Quat((yA[0]+xA[1])/s,.25*s,(f[1]+yA[2])/s,(f[0]-xA[2])/s);}
  const s=2*Math.sqrt(1+m22-m00-m11);return new Quat((f[0]+xA[2])/s,(f[1]+yA[2])/s,.25*s,(xA[1]-yA[0])/s);}
class Node{constructor(name='n'){this.name=name;this.children=[];this.active=true;this.position=new Vec3();this.rotation=new Quat();this.scale=new Vec3(1,1,1);this._wp=[0,0,0];}
  addChild(c){this.children.push(c);}getComponentsInChildren(){return [];}getComponent(){return null;}addComponent(){return {};}
  setPosition(){}destroy(){}setWorldPosition(x,y,z){this._wp=[x,y,z];}lookAt(t){this.rotation=lookAtQuat(this._wp,[t.x,t.y,t.z]);}setRotation(q){this.rotation=q.clone();}}
const cc={Node,Scene:class{},DirectionalLight:class{},SpotLight:class{},MeshRenderer:{ShadowCastingMode:{ON:1,OFF:0},ShadowReceivingMode:{ON:1,OFF:0}},SkeletalAnimation:class{},Material:class{},Mesh:class{},Texture2D:class{},EffectAsset:{get:()=>null},
  Color,Vec3,Vec4,Quat,director:{root:{pipeline:{pipelineSceneData:{isHDR:true}}}},renderer:{scene:{ShadowType:{ShadowMap:1,Planar:0},PCFType:{HARD:0,SOFT:1,SOFT_2X:2}}},utils:{},isValid:o=>!!o};
const rigJs=ts.transpileModule(fs.readFileSync(path.join(SCRIPTS,'render/RoomLightingRig.ts'),'utf8').replace(/import \{[^}]*\} from 'cc';/,'').replace(/\bexport\s+/g,''),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None,useDefineForClassFields:false}}).outputText;
const rctx={...cc,console};vm.runInNewContext(rigJs+'\nthis.api={RoomLightingRig,ROOM_LIGHTING,mirroredKey:typeof mirroredKey==="function"?mirroredKey:null};',rctx);
const {RoomLightingRig,mirroredKey}=rctx.api;
const dnJs=ts.transpileModule(fs.readFileSync(path.join(SCRIPTS,'world-r1/DayNightContract.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const dnMod={exports:{}};new Function('module','exports',dnJs)(dnMod,dnMod.exports);const {resolveDayNight}=dnMod.exports;
// Scene-authored values (scenes/WorldR5Integration.scene: Main Light id 2/3, AmbientInfo id 8).
const AUTHORED_Q=new Quat(-.25,-.25,-.06698729810778066,.9330127018922194),LIGHT_HOME=125000;
function makeRig(){
  const sunNode=new Node('Main Light');sunNode.position=new Vec3(-2.955,3.412,5.118);sunNode.rotation=AUTHORED_Q.clone();
  const sun={node:sunNode,illuminance:LIGHT_HOME,color:new Color(255,255,255,255),shadowEnabled:false,shadowPcf:0,shadowBias:1e-5,shadowNormalBias:0,shadowSaturation:1,shadowFixedArea:false,shadowNear:.1,shadowFar:10,shadowOrthoSize:5,csmLevel:4,enableCSM:true};
  sunNode.getComponent=()=>sun;
  const ambient={skyIllum:20000,skyColorHDR:new Vec4(.2,.502,.8,1),groundAlbedoHDR:new Vec4(.2,.2,.2,1)};
  Object.defineProperty(ambient,'skyColor',{set(v){this._sky=v.clone();}});Object.defineProperty(ambient,'groundAlbedo',{set(v){this._ground=v.clone();}});
  Object.defineProperty(ambient,'skyLightingColor',{set(c){this._sky=new Vec4(c.r/255,c.g/255,c.b/255,c.a/255);}});Object.defineProperty(ambient,'groundLightingColor',{set(c){this._ground=new Vec4(c.r/255,c.g/255,c.b/255,c.a/255);}});
  ambient._sky=ambient.skyColorHDR.clone();ambient._ground=ambient.groundAlbedoHDR.clone();
  const scene={globals:{ambient,shadows:{enabled:true,type:1,shadowMapSize:512}},getChildByName:n=>n==='Main Light'?sunNode:null};
  return {rig:new RoomLightingRig(scene,new Node('model'),null),sun,ambient};
}
const luma=(r,g,b)=>.2126*r+.7152*g+.0722*b;
const rotate2=rotate;
(async()=>{const [out,everyS,modeS]=process.argv.slice(2),every=+(everyS||2),night=modeS==='night';
  const env=S.create(),run=await S.run(env),F=run.frames,dt=run.dt;
  const x=makeRig(),view=resolveDayNight(night?'night':'day',true);let last=null;const rows=[];
  const sitF=run.states.filter(s=>s.state==='sitting').map(s=>s.frame),sit0=sitF.length?sitF[sitF.length-1]:null;
  const homeF=run.states.filter(s=>s.state==='home').map(s=>s.frame),home1=homeF.length?homeF[homeF.length-1]:null;
  for(let i=0;i<F.length;i++){const f=F[i],L=f.layers||{interior:false,exterior:false,backdrop:false},sig=JSON.stringify(L);
    if(sig!==last){last=sig;x.sun.illuminance=LIGHT_HOME*resolveDayNight(night?'night':'day',!!L.exterior).lightScale;const c=view.lightColor;x.sun.color=new Color(c[0],c[1],c[2],255);
      x.rig.setView(!!L.interior,!!L.backdrop,night);if(L.interior)x.rig.setRoomLightWeight(1);}
    if(L.interior){x.rig.setRoomLightWeight(f.weight);if(typeof x.rig.setExteriorKey==='function')x.rig.setExteriorKey(f.key??0);}
    if(!String(f.op).startsWith('returnHome')||i%every)continue;
    let clip='walk_loop',ct=f.t,u=0;
    if(f.state==='sitting'&&sit0!==null){clip='sit_down';u=Math.min(1,(i-sit0)/Math.max(1,(home1>sit0?home1:i+1)-sit0));}
    if(f.state==='home'){clip='sit_down';u=1;}
    if(f.state==='closing-door'||f.state==='opening-door')clip='idle_breathing_loop';
    const Ld=rotate(x.sun.node.rotation,[0,0,-1]),a=x.ambient;
    rows.push({name:'f'+String(i).padStart(5,'0'),i,t:+f.t.toFixed(4),state:f.state,pos:f.cam.position,rot:f.cam.rotation,fov:f.cam.fovVerticalDeg,root:f.root,yaw:f.yaw,door:f.door,clip,clipTime:ct,clipU:u,
      layers:L,w:x.rig.getRoomLightWeight(),k:x.rig.getExteriorKey?x.rig.getExteriorKey():0,sunDir:Ld,sunI:x.sun.illuminance,sunC:[x.sun.color.r,x.sun.color.g,x.sun.color.b],shadowSat:x.sun.shadowSaturation,shadowOn:!!x.sun.shadowEnabled,
      amb:a.skyIllum,sky:[a._sky.x,a._sky.y,a._sky.z],ground:[a._ground.x,a._ground.y,a._ground.z]});}
  fs.writeFileSync(out,JSON.stringify(rows));console.log('wrote',rows.length,'frames',rows[0].t,'..',rows[rows.length-1].t);
})().catch(e=>{console.error(e);process.exit(1);});
