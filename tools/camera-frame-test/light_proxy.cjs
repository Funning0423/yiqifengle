'use strict';
/** Screen-brightness proxy for the return (Funning, Mac r4: "从外面回到房间的时候，画面不能一亮一暗").
 * Drives the REAL RoomLightingRig (render/RoomLightingRig.ts, transpiled, minimal 'cc' mock - same shapes as GGbot's
 * tools/t5/test_return_character_light.cjs) exactly like WorldFlowComponent: applyDayNight on a layer switch (Main Light
 * illuminance/colour from DayNightContract), setView, setLayers(interior) -> w=1, then the frame's own w / exterior key.
 * Per frame it casts a COLSxROWS frustum grid into the decoded GLB (the layers the frame shows; door leaf analytic) and
 * shades each hit like the forward pipeline does: Lambert Main Light (rig rotation / illuminance / colour) with a real
 * shadow ray scaled by the rig's shadowSaturation, plus unoccluded hemisphere ambient (rig skyIllum, sky/ground colour);
 * normals from the neighbouring hits; uniform albedo; misses (sky/sea/cloud backdrops, unlit) a constant per day/night. Fixed camera
 * exposure (Cocos HDR default EV100 15) and an exponential tone curve -> mean in [0,1].
 * It is a PROXY of the picture (no textures, no GI): its job is to catch light-driver pops and bright/dark swings that a
 * camera move or a lighting ramp produces; the absolute look is checked with Blender (previews/运镜bot/return-follow). */
const fs=require('fs'),path=require('path'),vm=require('vm'),LT=require('./load_ts.cjs'),LR=require('./lens_rays.cjs');
class Color{constructor(r=255,g=255,b=255,a=255){if(typeof r==='string'){const h=r.replace('#','');this.r=parseInt(h.slice(0,2),16);this.g=parseInt(h.slice(2,4),16);this.b=parseInt(h.slice(4,6),16);this.a=255;}else{this.r=r;this.g=g;this.b=b;this.a=a;}}
  set(c){this.r=c.r;this.g=c.g;this.b=c.b;this.a=c.a;return this;}clone(){return new Color(this.r,this.g,this.b,this.a);}
  static lerp(o,a,b,t){o.r=a.r+(b.r-a.r)*t;o.g=a.g+(b.g-a.g)*t;o.b=a.b+(b.b-a.b)*t;o.a=a.a+(b.a-a.a)*t;return o;}}
class Vec4{constructor(x=0,y=0,z=0,w=0){this.x=x;this.y=y;this.z=z;this.w=w;}set(x,y,z,w){if(typeof x==='object'){w=x.w;z=x.z;y=x.y;x=x.x;}this.x=x;this.y=y;this.z=z;this.w=w;return this;}clone(){return new Vec4(this.x,this.y,this.z,this.w);}
  static lerp(o,a,b,t){return o.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t,a.w+(b.w-a.w)*t);}}
class Vec3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}clone(){return new Vec3(this.x,this.y,this.z);}}
class Quat{constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w;}set(q){this.x=q.x;this.y=q.y;this.z=q.z;this.w=q.w;return this;}clone(){return new Quat(this.x,this.y,this.z,this.w);}
  static fromEuler(o){return o;}static multiply(o){return o;}
  static slerp(o,a,b,t){let c=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w,bx=b.x,by=b.y,bz=b.z,bw=b.w;if(c<0){c=-c;bx=-bx;by=-by;bz=-bz;bw=-bw;}
    let s0,s1;if(1-c>1e-6){const om=Math.acos(c),so=Math.sin(om);s0=Math.sin((1-t)*om)/so;s1=Math.sin(t*om)/so;}else{s0=1-t;s1=t;}
    o.x=s0*a.x+s1*bx;o.y=s0*a.y+s1*by;o.z=s0*a.z+s1*bz;o.w=s0*a.w+s1*bw;return o;}}
const rotate=(q,v)=>{const x=q.x,y=q.y,z=q.z,w=q.w,t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])];
  return [v[0]+w*t[0]+y*t[2]-z*t[1],v[1]+w*t[1]+z*t[0]-x*t[2],v[2]+w*t[2]+x*t[1]-y*t[0]];};
function lookAtQuat(from,to){let f=[to[0]-from[0],to[1]-from[1],to[2]-from[2]];const n=Math.hypot(f[0],f[1],f[2]);f=f.map(v=>-v/n);
  let xA=[f[2],0,-f[0]];const xn=Math.hypot(xA[0],xA[1],xA[2]);xA=xA.map(v=>v/xn);const yA=[f[1]*xA[2]-f[2]*xA[1],f[2]*xA[0]-f[0]*xA[2],f[0]*xA[1]-f[1]*xA[0]];
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
let api=null;
function load(){if(api)return api;const ts=LT.typescript(),src=path.join(LT.root,'creator-build-project/assets/scripts');
  const js=ts.transpileModule(fs.readFileSync(path.join(src,'render/RoomLightingRig.ts'),'utf8').replace(/import \{[^}]*\} from 'cc';/,'').replace(/\bexport\s+/g,''),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None,useDefineForClassFields:false}}).outputText;
  const ctx=Object.assign({},cc,{console});vm.runInNewContext(js+'\nthis.api={RoomLightingRig};',ctx);
  api={RoomLightingRig:ctx.api.RoomLightingRig,resolveDayNight:LT.load(['DayNightContract']).DayNightContract.resolveDayNight};return api;}
// scenes/WorldR5Integration.scene: Main Light (id 2/3), AmbientInfo (id 8)
const AUTHORED_Q=[-.25,-.25,-.06698729810778066,.9330127018922194],LIGHT_HOME=125000,EXPOSURE=1/(1.2*Math.pow(2,15)),ALBEDO=.6,BACKDROP={day:.75,night:.25};
function makeRig(){const A=load(),sunNode=new Node('Main Light');sunNode.rotation=new Quat(AUTHORED_Q[0],AUTHORED_Q[1],AUTHORED_Q[2],AUTHORED_Q[3]);
  const sun={node:sunNode,illuminance:LIGHT_HOME,color:new Color(255,255,255,255),shadowEnabled:false,shadowPcf:0,shadowBias:1e-5,shadowNormalBias:0,shadowSaturation:1,shadowFixedArea:false,shadowNear:.1,shadowFar:10,shadowOrthoSize:5,csmLevel:4,enableCSM:true};
  sunNode.getComponent=()=>sun;
  const ambient={skyIllum:20000,skyColorHDR:new Vec4(.2,.502,.8,1),groundAlbedoHDR:new Vec4(.2,.2,.2,1)};
  Object.defineProperty(ambient,'skyColor',{set(v){this._sky=v.clone();}});Object.defineProperty(ambient,'groundAlbedo',{set(v){this._ground=v.clone();}});
  Object.defineProperty(ambient,'skyLightingColor',{set(c){this._sky=new Vec4(c.r/255,c.g/255,c.b/255,c.a/255);}});Object.defineProperty(ambient,'groundLightingColor',{set(c){this._ground=new Vec4(c.r/255,c.g/255,c.b/255,c.a/255);}});
  ambient._sky=ambient.skyColorHDR.clone();ambient._ground=ambient.groundAlbedoHDR.clone();
  const scene={globals:{ambient,shadows:{enabled:true,type:1,shadowMapSize:512}},getChildByName:n=>n==='Main Light'?sunNode:null};
  return {rig:new A.RoomLightingRig(scene,new Node('model'),null),sun,ambient};}
const luma=(r,g,b)=>.2126*r+.7152*g+.0722*b;
/** Light state per frame (replayed like WorldFlowComponent). */
function lights(F,night){const A=load(),x=makeRig(),view=A.resolveDayNight(night?'night':'day',true);let last=null;const out=[];
  for(const f of F){const L=f.layers||{interior:false,exterior:false,backdrop:false},sig=JSON.stringify(L);
    if(sig!==last){last=sig;x.sun.illuminance=LIGHT_HOME*A.resolveDayNight(night?'night':'day',!!L.exterior).lightScale;const c=view.lightColor;x.sun.color=new Color(c[0],c[1],c[2],255);
      x.rig.setView(!!L.interior,!!L.backdrop,night);if(L.interior)x.rig.setRoomLightWeight(1);}
    if(L.interior){x.rig.setRoomLightWeight(f.weight);if(typeof x.rig.setExteriorKey==='function')x.rig.setExteriorKey(f.key||0);}
    const s=x.ambient._sky,g=x.ambient._ground;
    out.push({L:rotate(x.sun.node.rotation,[0,0,-1]),sun:x.sun.illuminance*luma(x.sun.color.r/255,x.sun.color.g/255,x.sun.color.b/255)*EXPOSURE,sat:x.sun.shadowEnabled?x.sun.shadowSaturation:0,
      night:!!night,amb:x.ambient.skyIllum*EXPOSURE,sky:luma(s.x,s.y,s.z),ground:luma(g.x,g.y,g.z),w:x.rig.getRoomLightWeight(),k:x.rig.getExteriorKey?x.rig.getExteriorKey():0});}
  return out;}
const COLS=9,ROWS=19,FAR=80;
/** Mean tone-mapped brightness of one frame. I = {all, home} GLB indexes (home = interior + tower only, for HOME layers). */
function frame(C,I,f,l,aspect,openDeg){const p=f.cam.position,th=Math.tan(f.cam.fovVerticalDeg*Math.PI/360),idx=f.layers&&!f.layers.exterior?I.home:I.all,q=LR.doorQuad(f.door,openDeg);
  const hits=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const x=((c+.5)/COLS*2-1)*th*aspect,y=(1-(r+.5)/ROWS*2)*th,n=Math.hypot(x,y,1),d=C.rotate(f.cam.rotation,[x/n,y/n,-1/n]);
    const qt=LR.hitQuad(p,d,q),at=t=>[p[0]+d[0]*t,p[1]+d[1]*t,p[2]+d[2]*t];let t1=Math.min(FAR,qt),hit=qt<Infinity;
    if(idx.occluded(p,at(t1))){hit=true;let a=0,b=t1;for(let k=0;k<11;k++){const m=(a+b)/2;if(idx.occluded(p,at(m)))b=m;else a=m;}t1=b;}
    hits.push(hit?{p:at(t1),d}:{p:null,d});}
  let sum=0;const L=l.L;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const h=hits[r*COLS+c];if(!h.p){sum+=l.night?BACKDROP.night:BACKDROP.day;continue;}
    const nb=(dr,dc)=>{const rr=r+dr,cc_=c+dc;return rr>=0&&rr<ROWS&&cc_>=0&&cc_<COLS?hits[rr*COLS+cc_].p:null;};
    const a=nb(0,1)||nb(0,-1),b=nb(1,0)||nb(-1,0);let n=[-h.d[0],-h.d[1],-h.d[2]];
    if(a&&b){const u=[a[0]-h.p[0],a[1]-h.p[1],a[2]-h.p[2]],v=[b[0]-h.p[0],b[1]-h.p[1],b[2]-h.p[2]],cr=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],cl=Math.hypot(cr[0],cr[1],cr[2]),lu=Math.hypot(u[0],u[1],u[2]),lv=Math.hypot(v[0],v[1],v[2]);
      const dist=Math.hypot(h.p[0]-p[0],h.p[1]-p[1],h.p[2]-p[2]);if(cl>1e-9&&lu<.25*dist&&lv<.25*dist){n=cr.map(z=>z/cl);if(n[0]*h.d[0]+n[1]*h.d[1]+n[2]*h.d[2]>0)n=n.map(z=>-z);}}
    const nl=Math.max(0,-(L[0]*n[0]+L[1]*n[1]+L[2]*n[2]));let vis=1;
    if(nl>0&&l.sat>0){const o=[h.p[0]+n[0]*.04,h.p[1]+n[1]*.04,h.p[2]+n[2]*.04];vis=idx.occluded(o,[o[0]-L[0]*40,o[1]-L[1]*40,o[2]-L[2]*40])?0:1;}
    const up=.5+.5*n[1],hemi=l.ground+(l.sky-l.ground)*up,E=l.sun*nl*(1-l.sat*(1-vis))+l.amb*hemi;
    sum+=1-Math.exp(-ALBEDO*E);}
  return sum/(COLS*ROWS);}
module.exports={lights,frame,makeRig,COLS,ROWS,EXPOSURE};
/** Swing analysis of a brightness series: moving average over `win` samples, then a zigzag with hysteresis H.
 *  turns = interior extrema where the series reverses by >= H (a dip that recovers, or a bump that falls back):
 *  bright->dark->bright / dark->bright->dark. A monotone (within H) series has no turns. */
function swings(b,H,win){const n=b.length,h=Math.floor((win||1)/2),s=b.map((_,i)=>{let a=0,c=0;for(let k=Math.max(0,i-h);k<=Math.min(n-1,i+h);k++){a+=b[k];c++;}return a/c;});
  const turns=[];let dir=0,ext=0;
  for(let i=1;i<n;i++){
    if(dir===0){if(s[i]-s[0]>=H){dir=1;ext=i;}else if(s[0]-s[i]>=H){dir=-1;ext=i;}} // first move of >= H sets the direction (no turn)
    else if(dir>0){if(s[i]>s[ext])ext=i;else if(s[ext]-s[i]>=H){turns.push({i:ext,v:s[ext],dir:'peak'});dir=-1;ext=i;}}
    else{if(s[i]<s[ext])ext=i;else if(s[i]-s[ext]>=H){turns.push({i:ext,v:s[ext],dir:'valley'});dir=1;ext=i;}}}
  return {smooth:s,turns};}
module.exports.swings=swings;
