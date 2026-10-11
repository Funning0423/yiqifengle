'use strict';
// T5-material room-light API test (no Cocos runtime). Parts:
//  A) real type-stripped WorldFlowCore: does NOT drive w (API-final), older adapters fine.
//  B) real RoomLightingRig (TS-transpiled) with a minimal 'cc' mock: set/get, clamp, reject non-finite, endpoints exact,
//     idempotency, setView transitions.
//  C) the real WorldFlowComponent run()/job loop/blendRoomLight source text (extracted verbatim) driving the real rig:
//     blend endpoints, frame stepping, cancellation keeps last w.
//  D) jump estimate when w is driven by a simulated camera-segment progress (what 运镜bot will wire).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),Module=require('node:module');
const {stripTypeScriptTypes}=Module;
const root=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const results=[];const test=async(name,fn)=>{if(process.env.T5_TRACE)console.error("start",name);try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:String(e&&e.stack||e)});}};

// ---------- A) flow ----------
const coreSrc=fs.readFileSync(path.join(root,'world-r1/WorldFlowCore.ts'),'utf8');
const coreJs=stripTypeScriptTypes(coreSrc,{mode:'strip'}).replace(/import \{ CameraTrackFailure \} from '\.\/CameraPose';/,'class CameraTrackFailure extends Error {}').replace(/\bexport\s+/g,'');
const ctx={};vm.runInNewContext(coreJs+'\nthis.api={WorldFlow,Cancellation,layerStates,pathDuration};',ctx);const {WorldFlow,layerStates,pathDuration}=ctx.api;
function fixture({withBlend=true,withSet=false,blendImpl,levelLease,skycityLease}={}){
  const zero=[0,0,0],one=[0,0,1],far=[0,0,4],pose={position:[0,2,3],target:zero};
  const seat={position:zero,back:zero,yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:zero};
  const log=[];
  const config={seat,toDoor:[zero,one],outCrossing:[one,one],toIsland:[one,far],toThreshold:[far,one],inCrossing:[one,one],toSeat:[one,zero],cameraHome:pose,cameraToDoor:[pose,pose],cameraInside:pose,cameraOutside:pose,cameraIsland:pose,openDeg:60,speed:.5};
  const name=l=>Object.entries(layerStates).find(([,v])=>JSON.stringify(v)===JSON.stringify(l))[0];
  const world={setLayers:x=>log.push('layers:'+name(x)),setDoor(){},setCamera(){},animateDoor:async()=>{},animateCamera:async()=>{log.push('camera');},cancelTransient(){},assertStaticWorld(){},dispose(){}};
  if(withSet)world.setRoomLightWeight=v=>{log.push('w:'+v);return true;};
  if(withBlend)world.blendRoomLight=blendImpl||(async(from,to,seconds)=>{log.push(`blend:${from}->${to}@${seconds}`);});
  const character={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:zero,seatedRoot:zero,seatYawRad:0,clearanceRadiusM:.15},advance(){},perform:async a=>{log.push('act:'+a.kind);},cancelAndReset(){},setVisible(){},dispose(){}};
  const f=new WorldFlow({config,character,skycity:skycityLease?{enter:async()=>skycityLease}:undefined,levels:{enter:async()=>{if(levelLease)return levelLease;throw Error('no');}},loadWorld:async()=>world});
  return {f,log,config};
}
const run=async()=>{
await test('A1 pre-T2 routes (no config.interiorLighting): Core makes no blend calls',async()=>{
  const calls=[];const x=fixture({blendImpl:async(...a)=>{calls.push(a);}});
  await x.f.load();assert.equal((await x.f.leaveHome()).ok,true);assert.equal((await x.f.returnHome()).ok,true);
  assert.equal(calls.length,0);assert.ok(!x.log.some(v=>v.startsWith('blend')));
  const L=x.log.filter(v=>v.startsWith('layers:'));assert.ok(L.includes('layers:BOTH')&&L.includes('layers:ISLAND')&&L.at(-1)==='layers:HOME',JSON.stringify(L));
});
await test('adapter without the optional light API still completes both flows',async()=>{
  const x=fixture({withBlend:false});await x.f.load();assert.equal((await x.f.leaveHome()).ok,true);assert.equal((await x.f.returnHome()).ok,true);assert.equal(x.f.snapshot().state,'home');
});
await test('A4 levels/skycity/hide keep the world loaded but setLayers(NONE) -> isWorldVisible must gate w=0',async()=>{
  const lease=()=>({show(){},hide(){},showPaused(){},resume(){return {ok:true};},requestExit(){return {ok:true};},dispose(){}});
  const x=fixture({levelLease:lease(),skycityLease:lease()});await x.f.load();await x.f.leaveHome();
  const last=()=>x.log.filter(v=>v.startsWith('layers:')).at(-1);assert.equal(last(),'layers:ISLAND');
  assert.equal((await x.f.enterLevel('s1')).ok,true);assert.equal(last(),'layers:NONE');assert.equal(x.f.exitLevel().ok,true);assert.equal(last(),'layers:ISLAND');
  assert.equal((await x.f.enterSkycity()).ok,true);assert.equal(last(),'layers:NONE');assert.equal(x.f.exitSkycity().ok,true);assert.equal(last(),'layers:ISLAND');
  x.f.hide();assert.equal(last(),'layers:NONE');x.f.show();assert.equal(last(),'layers:NONE');assert.equal(x.f.resume().ok,true);assert.equal(last(),'layers:ISLAND');
});
// T2+ legitimately keeps changing WorldFlowCore (4bead5a: walk-duration contract, distance-driven camera), so the old
// whole-file pin (sha256 9798…cc47 of 7f2b623/932570a) is retired. A5 now pins only the T5 lighting-blend parts, which
// are byte-identical (comments/whitespace ignored) from 7f2b623 through 运镜bot-int 4bead5a:
//   WorldLease T5 API block, RouteConfig.interiorLighting, walkLight(), roomLightRamp()
// plus the structural rule that walk() runs the light ramp on the SAME duration as the walk action and camera.
// Any later edit to those parts fails here: review against docs/T5-material-swap.md "API", then re-pin T5_PARTS_SHA256.
const T5_PARTS_SHA256='58f22e0c5260db005671d799c835b0b257166ef89c4ab05f6e4d23ad75f9eec7';
function t5Parts(src){const code=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const method=name=>{const i=code.search(new RegExp('\\n\\s*private (?:async )?'+name+'\\('));assert.ok(i>=0,'WorldFlowCore.'+name+'() missing');
    let k=code.indexOf('{',code.indexOf(')',i)),d=0;for(;k<code.length;k++){if(code[k]==='{')d++;else if(code[k]==='}'&&!--d)break;}return code.slice(i,k+1);};
  const api=code.match(/setRoomLightWeight\?\(weight:number\):boolean;[\s\S]*?blendRoomLight\?\([^;]*;/);assert.ok(api,'WorldLease T5 room-light API block missing');
  const cfg=code.match(/interiorLighting\?:Readonly<\{[^}]*\}>;/);assert.ok(cfg,'RouteConfig.interiorLighting missing');
  return {code,parts:{api:api[0],cfg:cfg[0],ramp:null,walkLight:method('walkLight'),roomLightRamp:method('roomLightRamp'),walk:method('walk')}};}
await test('A5 WorldFlowCore T5 lighting-blend parts intact (API block, interiorLighting, walkLight, roomLightRamp; same-duration rule)',async()=>{
  const {parts}=t5Parts(coreSrc),norm=x=>x===null?'':x.replace(/\s+/g,'');
  const sha=require('node:crypto').createHash('sha256').update([parts.api,parts.cfg,parts.ramp,parts.walkLight,parts.roomLightRamp].map(norm).join('\n')).digest('hex');
  assert.equal(sha,T5_PARTS_SHA256,'T5 lighting-blend parts of WorldFlowCore changed: review the w contract, then re-pin');
  const w=norm(parts.walk);
  assert.match(w,/constduration=[^,;]+,track=this\.walkTrack\(path\),light=this\.walkLight\(path\)/,'walk(): one duration shared by walk/camera/light');
  assert.ok(w.includes('this.roomLightRamp(light,duration,token)'),'walk(): light ramp uses the walk duration');
  assert.ok(w.includes("this.action({kind:'walk',path,duration},token)"),'walk(): walk action uses the same duration');
  assert.ok(/light&&this\.world!\.blendRoomLight\?/.test(w),'walk(): ramp only when the lease has blendRoomLight (older adapters fine)');
  // negative control: the check really sees a change inside the pinned parts
  const tampered=coreSrc.replace('e=Math.max(s,Math.min(1,r.end))','e=Math.max(s,Math.min(.9,r.end))');assert.notEqual(tampered,coreSrc);
  const t=t5Parts(tampered).parts;assert.notEqual(require('node:crypto').createHash('sha256').update([t.api,t.cfg,t.ramp,t.walkLight,t.roomLightRamp].map(norm).join('\n')).digest('hex'),T5_PARTS_SHA256);
});
await test('A6 Core touches w only via the WorldLease API, at the documented call sites (no rig import, no photometry)',async()=>{
  const code=coreSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  assert.ok(!/RoomLightingRig|render\/|illuminance|skyIllum|ambient|roomWeight/.test(code),'Core must not own lighting state');
  const sites=[...code.matchAll(/this\.world!?\.(setRoomLightWeight|blendRoomLight)[?!]?\.?\(([^)]*)\)/g)].map(m=>m[1]+'('+m[2]+')');
  assert.deepEqual(sites,["setRoomLightWeight(this.stable==='home'?1:0)","blendRoomLight(r.from,r.to,(e-s)" /* regex stops at the first ) */,"setRoomLightWeight(r.to)","setRoomLightWeight(1)","setRoomLightWeight(0)","setRoomLightWeight(1)"],JSON.stringify(sites));
  assert.ok(!/getRoomLightWeight\(/.test(code),'Core never reads w back (no feedback loop)');
});
await test('A7 pre-T2 routes (no interiorLighting): no blends; only endpoint writes 0/1 (restore, setLayers(BOTH) outbound, HOME)',async()=>{
  const calls=[];const x=fixture({withSet:true,blendImpl:async(...a)=>{calls.push(['blend',...a]);}});await x.f.load();
  assert.equal((await x.f.leaveHome()).ok,true);assert.equal((await x.f.returnHome()).ok,true);
  const w=x.log.filter(v=>v.startsWith('w:')).map(v=>+v.slice(2));assert.equal(calls.length,0);assert.ok(w.length>0&&w.every(v=>v===0||v===1),JSON.stringify(w));
  const L=x.log.filter(v=>v.startsWith('layers:')||v.startsWith('w:'));
  const iB=L.indexOf('layers:BOTH');assert.equal(L[iB+1],'w:1','setLayers(BOTH) on the way out is followed by w=1 in the same sync step');
  const iI=L.indexOf('layers:ISLAND');assert.equal(L[iI+1],'w:0','restore(ISLAND) lands on w=0');
  assert.equal(L.at(-1),'w:1');
});
// ---------- B) rig photometry ----------
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
const rotate=(q,v)=>{const {x,y,z,w}=q,[vx,vy,vz]=v;const ix=w*vx+y*vz-z*vy,iy=w*vy+z*vx-x*vz,iz=w*vz+x*vy-y*vx,iw=-x*vx-y*vy-z*vz;
  return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];};
function lookAtQuat(from,to){ // Cocos Node.lookAt: -Z towards target, up +Y
  let f=[to[0]-from[0],to[1]-from[1],to[2]-from[2]];const n=Math.hypot(...f);f=f.map(v=>-v/n); // z axis = -forward
  let xA=[f[2],0,-f[0]];const xn=Math.hypot(...xA);xA=xA.map(v=>v/xn);const yA=[f[1]*xA[2]-f[2]*xA[1],f[2]*xA[0]-f[0]*xA[2],f[0]*xA[1]-f[1]*xA[0]];
  const m00=xA[0],m11=yA[1],m22=f[2],tr=m00+m11+m22;let q;
  if(tr>0){const s=.5/Math.sqrt(tr+1);q=new Quat((yA[2]-f[1])*s,(f[0]-xA[2])*s,(xA[1]-yA[0])*s,.25/s);}
  else if(m00>m11&&m00>m22){const s=2*Math.sqrt(1+m00-m11-m22);q=new Quat(.25*s,(yA[0]+xA[1])/s,(f[0]+xA[2])/s,(yA[2]-f[1])/s);}
  else if(m11>m22){const s=2*Math.sqrt(1+m11-m00-m22);q=new Quat((yA[0]+xA[1])/s,.25*s,(f[1]+yA[2])/s,(f[0]-xA[2])/s);}
  else{const s=2*Math.sqrt(1+m22-m00-m11);q=new Quat((f[0]+xA[2])/s,(f[1]+yA[2])/s,.25*s,(xA[1]-yA[0])/s);}return q;}
class Node{constructor(name='n'){this.name=name;this.children=[];this.active=true;this.position=new Vec3();this.rotation=new Quat();this.scale=new Vec3(1,1,1);this._wp=[0,0,0];}
  addChild(c){this.children.push(c);}getComponentsInChildren(){return [];}getComponent(){return null;}addComponent(){return {};}
  setPosition(){}destroy(){}setWorldPosition(x,y,z){this._wp=[x,y,z];}lookAt(t){this.rotation=lookAtQuat(this._wp,[t.x,t.y,t.z]);}setRotation(q){this.rotation=q.clone();}}
const MeshRenderer={ShadowCastingMode:{ON:1,OFF:0},ShadowReceivingMode:{ON:1,OFF:0}};
const cc={Node,Scene:class{},DirectionalLight:class{},SpotLight:class{},MeshRenderer,SkeletalAnimation:class{},Material:class{},Mesh:class{},Texture2D:class{},EffectAsset:{get:()=>null},
  Color,Vec3,Vec4,Quat,director:{root:{pipeline:{pipelineSceneData:{isHDR:true}}}},renderer:{scene:{ShadowType:{ShadowMap:1,Planar:0},PCFType:{HARD:0,SOFT:1,SOFT_2X:2}}},utils:{},isValid:o=>!!o};
const rigSrc=fs.readFileSync(path.join(root,'render/RoomLightingRig.ts'),'utf8');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||path.resolve(__dirname,'../../../GGbot/tools/vendor-node/node_modules/typescript'));
const rigJs=ts.transpileModule(rigSrc.replace(/import \{[^}]*\} from 'cc';/,'').replace(/\bexport\s+/g,''),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None,useDefineForClassFields:false}}).outputText;
const rctx={...cc,console};vm.runInNewContext(rigJs+'\nthis.api={RoomLightingRig,ROOM_LIGHTING};',rctx);const {RoomLightingRig,ROOM_LIGHTING}=rctx.api;
function makeRig(){
  // Scene-authored values from scenes/WorldR5Integration.scene (Main Light id 2/3, AmbientInfo id 8, ShadowsInfo id 9).
  const sunNode=new Node('Main Light');sunNode.position=new Vec3(-2.955,3.412,5.118);sunNode.rotation=new Quat(-.25,-.25,-.06698729810778066,.9330127018922194);
  const sun={node:sunNode,illuminance:125000,color:new Color(255,255,255,255),shadowEnabled:false,shadowPcf:0,shadowBias:1e-5,shadowNormalBias:0,shadowSaturation:1,shadowFixedArea:false,shadowNear:.1,shadowFar:10,shadowOrthoSize:5,csmLevel:4,enableCSM:true};
  sunNode.getComponent=()=>sun;
  const ambient={skyIllum:20000,skyColorHDR:new Vec4(.2,.502,.8,1),groundAlbedoHDR:new Vec4(.2,.2,.2,1)};
  Object.defineProperty(ambient,'skyColor',{set(v){this._sky=v.clone();}});Object.defineProperty(ambient,'groundAlbedo',{set(v){this._ground=v.clone();}});
  Object.defineProperty(ambient,'skyLightingColor',{set(c){this._sky=new Vec4(c.r/255,c.g/255,c.b/255,c.a/255);}});Object.defineProperty(ambient,'groundLightingColor',{set(c){this._ground=new Vec4(c.r/255,c.g/255,c.b/255,c.a/255);}});
  ambient._sky=ambient.skyColorHDR.clone();ambient._ground=ambient.groundAlbedoHDR.clone();
  const scene={globals:{ambient,shadows:{enabled:true,type:1,shadowMapSize:512}},getChildByName:n=>n==='Main Light'?sunNode:null};
  const rig=new RoomLightingRig(scene,new Node('model'),null);return {rig,sun,ambient,scene};
}
// Facade radiance proxy for the front faces the island camera sees (normal ~ +Z): Lambert sun + hemispheric ambient.
const luma=v=>.2126*v.x+.7152*v.y+.0722*v.z;
function facade({sun,ambient}){const d=rotate(sun.node.rotation,[0,0,-1]);const nl=Math.max(0,-d[2]);const c=luma(new Vec4(sun.color.r/255,sun.color.g/255,sun.color.b/255));
  return sun.illuminance*c*nl*(1-sun.shadowSaturation*0)+ambient.skyIllum*(.5*luma(ambient._sky)+.5*luma(ambient._ground));}
const ISLAND_Q=new Quat(-.25,-.25,-.06698729810778066,.9330127018922194),ROOM_Q=lookAtQuat([.8,6.6,-7],[-.4,.6,-2]);
const qeq=(a,b,eps=1e-12)=>['x','y','z','w'].every(k=>Math.abs(a[k]-b[k])<eps);
const snap=x=>JSON.stringify({i:x.sun.illuminance,c:[x.sun.color.r,x.sun.color.g,x.sun.color.b,x.sun.color.a],q:x.sun.node.rotation,sat:x.sun.shadowSaturation,a:x.ambient.skyIllum,sky:x.ambient._sky,gr:x.ambient._ground});
await test('B1 w=1 on entering interior == legacy room photometry exactly; get()=1',async()=>{
  const x=makeRig();assert.equal(x.rig.getRoomLightWeight(),0);x.rig.setView(true,true,false);assert.equal(x.rig.getRoomLightWeight(),1);
  assert.equal(x.sun.illuminance,125000*ROOM_LIGHTING.daylightScale);assert.deepEqual([x.sun.color.r,x.sun.color.g,x.sun.color.b],[0xff,0xf4,0xde]);
  assert.equal(x.ambient.skyIllum,125000*ROOM_LIGHTING.ambientToMainDay);assert.equal(x.sun.shadowSaturation,ROOM_LIGHTING.shadowSaturationDay);
  assert.deepEqual(x.ambient._sky,new Vec4(0xb4/255,0xc8/255,0xdd/255,1));assert.ok(qeq(x.sun.node.rotation,ROOM_Q));
  assert.equal(x.sun.shadowEnabled,true);assert.equal(x.scene.globals.shadows.shadowMapSize,1024);
});
await test('B2 w=0 == scene island light exactly; restore(ISLAND) afterwards changes no photometry',async()=>{
  const x=makeRig();x.rig.setView(true,true,false);assert.equal(x.rig.setRoomLightWeight(0),true);assert.equal(x.rig.getRoomLightWeight(),0);
  assert.equal(x.sun.illuminance,125000);assert.deepEqual([x.sun.color.r,x.sun.color.g,x.sun.color.b],[255,255,255]);
  assert.equal(x.ambient.skyIllum,20000);assert.deepEqual(x.ambient._sky,new Vec4(.2,.502,.8,1));assert.deepEqual(x.ambient._ground,new Vec4(.2,.2,.2,1));
  assert.equal(x.sun.shadowSaturation,0);assert.ok(qeq(x.sun.node.rotation,ISLAND_Q,1e-9));
  const before=facade(x);x.sun.illuminance=125000;x.rig.setView(false,true,false);assert.ok(Math.abs(facade(x)-before)/before<1e-9);assert.equal(x.rig.getRoomLightWeight(),0);
});
await test('B3 clamp and reject: -1->0, 2->1, NaN/Infinity rejected (false, unchanged)',async()=>{
  const x=makeRig();x.rig.setView(true,true,false);
  assert.equal(x.rig.setRoomLightWeight(-1),true);assert.equal(x.rig.getRoomLightWeight(),0);
  assert.equal(x.rig.setRoomLightWeight(2),true);assert.equal(x.rig.getRoomLightWeight(),1);
  x.rig.setRoomLightWeight(.25);const s0=snap(x);
  for(const bad of [NaN,Infinity,-Infinity])assert.equal(x.rig.setRoomLightWeight(bad),false);
  assert.equal(x.rig.getRoomLightWeight(),.25);assert.equal(snap(x),s0);
});
await test('B4 idempotent: same w -> identical state; path independence (0.3 via 0.9 == direct 0.3)',async()=>{
  const x=makeRig();x.rig.setView(true,true,false);x.rig.setRoomLightWeight(.3);const a=snap(x);x.rig.setRoomLightWeight(.3);assert.equal(snap(x),a);
  x.rig.setRoomLightWeight(.9);x.rig.setRoomLightWeight(.3);assert.equal(snap(x),a);
  x.rig.setRoomLightWeight(1);const legacy=makeRig();legacy.rig.setView(true,true,false);assert.equal(snap(x),snap(legacy));
});
await test('B5 outside interior / after dispose: set=false, get=0; setView(true) again keeps w (day/night toggle)',async()=>{
  const x=makeRig();assert.equal(x.rig.setRoomLightWeight(.5),false);assert.equal(x.rig.getRoomLightWeight(),0);
  x.rig.setView(true,true,false);x.rig.setRoomLightWeight(.4);x.rig.setView(true,true,true);assert.equal(x.rig.getRoomLightWeight(),.4);
  x.rig.setView(false,true,true);assert.equal(x.rig.getRoomLightWeight(),0);x.rig.setView(true,true,false);assert.equal(x.rig.getRoomLightWeight(),1);
  x.rig.dispose();assert.equal(x.rig.setRoomLightWeight(.5),false);assert.equal(x.rig.getRoomLightWeight(),0);
});

// ---------- C) real WorldFlowComponent job runner + blendRoomLight lambda, extracted verbatim ----------
const compSrc=fs.readFileSync(path.join(root,'world-r1/WorldFlowComponent.ts'),'utf8');
const grab=(re,what)=>{const m=compSrc.match(re);assert.ok(m,'cannot extract '+what);return m[0];};
const runSrc=grab(/  private run\(seconds:number[\s\S]*?\n  \}\n/,'run()');
const cancelSrc=grab(/  private cancelJobs\(\):void \{[^\n]*\n/,'cancelJobs()');
const loopSrc=grab(/    for\(const j of Array\.from\(this\.jobs\)\) \{\n[\s\S]*?\n    \}\n/,'job loop');
const blendSrc=grab(/blendRoomLight:\(from,to,seconds,t\)=>[^\n]*\n/,'blendRoomLight').trim().replace(/,$/,'');
const passSrc=grab(/  setRoomLightWeight\(weight:number\):boolean \{[^\n]*\n[\s\S]*?  isWorldVisible\(\):boolean \{[^\n]*\n/,'passthroughs');
const harnessTs=`class Harness { jobs=new Set(); roomLighting:any=null; disposed=false; interiorVisible=false; exteriorVisible=false;\n${runSrc}${cancelSrc}${passSrc}  step(frameDt:number){\n${loopSrc}  }\n  lease(){return {${blendSrc}};}\n}`;
const harnessJs=ts.transpileModule(harnessTs,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None,useDefineForClassFields:false}}).outputText;
const hctx={Cancelled:ctx.api.Cancelled||class Cancelled extends Error{},console};
vm.runInNewContext(coreJs+'\nthis.Cancelled=Cancelled;this.Cancellation=Cancellation;',hctx);
vm.runInNewContext(harnessJs+'\nthis.Harness=Harness;',hctx);
const mk=()=>{const x=makeRig();x.rig.setView(true,true,false);const h=new hctx.Harness();h.roomLighting=x.rig;return {x,h,lease:h.lease(),token:new hctx.Cancellation()};};
await test('C1 blend: writes `from` synchronously, linear per frame, resolves on exactly `to`',async()=>{
  const {x,h,lease,token}=mk();let done=false;const p=lease.blendRoomLight(1,0,1,token).then(()=>{done=true;});
  assert.equal(x.rig.getRoomLightWeight(),1);for(let i=1;i<=9;i++){h.step(.1);assert.ok(Math.abs(x.rig.getRoomLightWeight()-(1-i/10))<1e-9);}
  h.step(.1);if(!done)h.step(.1); /* float accumulation: 10x0.1 < 1, real loop also finishes next frame */await p;assert.equal(done,true);assert.equal(x.rig.getRoomLightWeight(),0);assert.equal(h.jobs.size,0);
});
await test('C2 seconds<=0 or non-finite -> jumps to `to` and resolves',async()=>{
  for(const s of [0,-1,NaN]){const {x,lease,token}=mk();await lease.blendRoomLight(1,.2,s,token);assert.ok(Math.abs(x.rig.getRoomLightWeight()-.2)<1e-12);}
});
await test('C3 cancel (token or cancelJobs) rejects Cancelled, keeps last w, no further writes',async()=>{
  {const {x,h,lease,token}=mk();const p=lease.blendRoomLight(1,0,1,token);h.step(.3);token.cancel();await assert.rejects(p,e=>e instanceof hctx.Cancelled);
   const w=x.rig.getRoomLightWeight();assert.ok(Math.abs(w-.7)<1e-9);h.step(.5);assert.equal(x.rig.getRoomLightWeight(),w);}
  {const {x,h,lease,token}=mk();const p=lease.blendRoomLight(0,1,1,token);h.step(.4);h.cancelJobs();await assert.rejects(p,e=>e instanceof hctx.Cancelled);assert.ok(Math.abs(x.rig.getRoomLightWeight()-.4)<1e-9);}
  {const {lease,token}=mk();token.cancel();assert.throws(()=>lease.blendRoomLight(0,1,1,token));}
});
await test('B6 rig hasRoomLight(): true while alive (any view), false after dispose',async()=>{
  const x=makeRig();assert.equal(x.rig.hasRoomLight(),true);x.rig.setView(false,true,false);assert.equal(x.rig.hasRoomLight(),true);assert.equal(x.rig.getRoomLightWeight(),0);
  x.rig.dispose();assert.equal(x.rig.hasRoomLight(),false);
});
await test('C5 hasRoomLight/isWorldVisible passthroughs + consumer pattern',async()=>{
  const outdoor=h=>(!h||!h.hasRoomLight()||!h.isWorldVisible())?null:1-h.getRoomLightWeight(); // null = indoor/silent
  assert.equal(outdoor(null),null);
  const none=new hctx.Harness();assert.equal(none.hasRoomLight(),false);assert.equal(none.isWorldVisible(),false);assert.equal(outdoor(none),null);
  const {x,h}=mk();h.interiorVisible=true;h.exteriorVisible=false;assert.equal(outdoor(h),0);           // HOME, w=1
  x.rig.setView(false,true,false);h.interiorVisible=false;h.exteriorVisible=true;assert.equal(outdoor(h),1); // ISLAND, w=0 -> waves full
  h.exteriorVisible=false;assert.equal(h.hasRoomLight(),true);assert.equal(h.getRoomLightWeight(),0);assert.equal(outdoor(h),null); // level/skycity: NONE
  h.exteriorVisible=true;h.disposed=true;assert.equal(h.hasRoomLight(),false);assert.equal(outdoor(h),null);
  h.disposed=false;x.rig.dispose();assert.equal(h.hasRoomLight(),false);assert.equal(outdoor(h),null);
});
await test('C4 component passthroughs: get=0 / set=false without rig',async()=>{
  const h=new hctx.Harness();assert.equal(h.getRoomLightWeight(),0);assert.equal(h.setRoomLightWeight(.5),false);
  const {h:h2}=mk();assert.equal(h2.setRoomLightWeight(.5),true);assert.equal(h2.getRoomLightWeight(),.5);
});

// ---------- D) jump estimate, w driven by simulated camera-segment progress ----------
const metrics={};
await test('D jump estimate (proxy calibrated to video lumas): undriven one-frame jump > 8%; segment-driven < 8%/frame',async()=>{
  // Display-luma estimate L = a*R^(1/2.2)+b, fitted so endpoints equal tower ROI luma in 08-outbound-motion.mp4
  // (room 151.3 @22.733 s, island 203.4 @22.750 s). Estimate only, not a render.
  const x=makeRig();x.rig.setView(true,true,false);const room=facade(x);x.rig.setRoomLightWeight(0);const island=facade(x);
  const g=v=>Math.pow(v,1/2.2),a=(203.4-151.3)/(g(island)-g(room)),b=151.3-a*g(room),L=v=>a*g(v)+b;
  metrics.undrivenJumpPct=(L(island)-L(room))/L(room)*100;assert.ok(metrics.undrivenJumpPct>8);
  // simulated segments: 53 frames (gate), toIsland 6.263 s and toThreshold 7.047 s at 60 fps (tools/t5/print_walk_durations.cjs)
  for(const [name,frames,from,to] of [['53f',53,1,0],['toIsland',Math.round(6.263*60),1,0],['toThreshold',Math.round(7.047*60),0,1]]){
    let worst=0,prev=null;for(let i=0;i<=frames;i++){const progress=i/frames;x.rig.setRoomLightWeight(from+(to-from)*progress);const v=L(facade(x));if(prev!==null)worst=Math.max(worst,Math.abs(v-prev)/Math.min(v,prev)*100);prev=v;}
    metrics['worstPerFramePct@'+name]=worst;assert.ok(worst<8,`${name}: ${worst}`);}
});

// ---------- E) T2+ contract: REAL WorldFlowCore + REAL FirstsliceRoutes (interiorLighting ramps) + REAL rig + verbatim job runner ----------
await test('E1 T2+ segment driver: w monotone per segment, <=0.006/frame, endpoints exact, restore()->0, BOTH->1 unless overridden same step',async()=>{
  const M=require('../camera-frame-test/load_ts.cjs').load();const W=M.WorldFlowCore,C=M.CameraPose;
  const cfg=M.FirstsliceRoutes.createFirstsliceRoutes(M.FirstsliceFacts.FIRSTSLICE,M.CharacterReference.CHARACTER_REFERENCE);
  assert.ok(cfg.interiorLighting&&cfg.interiorLighting.toIsland&&cfg.interiorLighting.toThreshold,'T2+ routes carry interiorLighting');
  const x=makeRig();const h=new hctx.Harness();h.roomLighting=x.rig;const rig=x.rig;
  const writes=[];let frame=0;const lw=h.lease();
  const cam={fov:55,node:{setWorldPosition(){},setWorldRotation(){}}};
  // Mirrors WorldFlowComponent lease: setLayers -> applyDayNight -> rig.setView(interior,...) ; if(interior) w:=1.
  const lease={setLayers(l){writes.push({frame,kind:'layers',l:{...l}});h.interiorVisible=l.interior;h.exteriorVisible=l.exterior;rig.setView(l.interior,l.backdrop,false);if(l.interior)rig.setRoomLightWeight(1);},
    setRoomLightWeight(v){writes.push({frame,kind:'set',v});return h.setRoomLightWeight(v);},getRoomLightWeight:()=>h.getRoomLightWeight(),
    blendRoomLight(a,b,sec,t){writes.push({frame,kind:'blend',a,b,sec});return lw.blendRoomLight(a,b,sec,t);},
    setDoor(){},setCamera(){},assertStaticWorld(){},cancelTransient(){h.cancelJobs();},dispose(){},
    animateDoor:(a,b,sec,t)=>h.run(sec,t,()=>{}),wait:(sec,t)=>h.run(sec,t,()=>{}),
    animateCamera:(path,sec,t,o)=>{const tr=C.createCameraTrack(cam,path,'t5.animateCamera',o);return h.run(sec,t,tr.tick);}};
  const character={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:cfg.seat.standingControllerRoot,seatedRoot:cfg.seat.seatedControllerRoot,seatYawRad:cfg.seat.yawRad,clearanceRadiusM:.15},advance(){},
    perform:(a,t)=>h.run(a.kind==='walk'?a.duration:a.kind==='turn'?1.5:1,t,()=>{}),cancelAndReset(){},setVisible(){},dispose(){}};
  const states=[];let state='';
  const flow=new W.WorldFlow({config:cfg,mode:'motion',character,levels:{enter:async()=>{throw Error('unused');}},loadWorld:async()=>lease,onChange:sn=>{state=sn.state;states.push({frame,state});}});
  const tick=()=>new Promise(r=>setImmediate(r));const samples=[];
  assert.equal((await flow.load()).ok,true);assert.equal(rig.getRoomLightWeight(),1,'home start w=1');
  for(const op of ['leaveHome','returnHome']){let done=false;const pr=flow[op]().then(r=>{done=true;assert.equal(r.ok,true,op+' '+JSON.stringify(r));});
    await tick();samples.push({frame,state,w:rig.getRoomLightWeight(),op});let g=0;
    while(!done){frame++;h.step(1/60);await tick();await tick();samples.push({frame,state,w:rig.getRoomLightWeight(),op});if(++g>60*120)throw Error('stuck '+op);}await pr;
    if(op==='leaveHome'){assert.equal(state,'island');assert.equal(rig.getRoomLightWeight(),0,'island endpoint exactly 0');}
    else{assert.equal(state,'home');assert.equal(rig.getRoomLightWeight(),1,'home endpoint exactly 1');}}
  // per-frame step and per-segment monotonicity (outbound non-increasing, return non-decreasing)
  let worst=0;for(const op of ['leaveHome','returnHome']){const S=samples.filter(q=>q.op===op);for(let i=1;i<S.length;i++){const d=S[i].w-S[i-1].w;worst=Math.max(worst,Math.abs(d));
    if(op==='leaveHome')assert.ok(d<=1e-12,`outbound w rose at frame ${S[i].frame} (${S[i].state})`);else assert.ok(d>=-1e-12,`return w fell at frame ${S[i].frame} (${S[i].state})`);}}
  metrics['T2+maxDeltaWPerFrame']=worst;assert.ok(worst<=.006,'per-frame dw '+worst);
  // the ramp really comes from Core's segment driver (not a jump at restore)
  assert.ok(writes.some(q=>q.kind==='blend'&&q.a===1&&q.b===0)&&writes.some(q=>q.kind==='blend'&&q.a===0&&q.b===1),'toIsland 1->0 and toThreshold 0->1 blends');
  // restore() at island arrival: ISLAND layers then set(0) in the same sync step, and w was already 0 (nothing visible changes)
  const iIsl=writes.findIndex(q=>q.kind==='layers'&&!q.l.interior&&q.l.exterior);assert.ok(iIsl>0);const next=writes[iIsl+1];
  assert.equal(next.kind,'set');assert.equal(next.v,0);assert.equal(next.frame,writes[iIsl].frame);
  const arrive=samples.find(q=>q.state==='island');const before=samples[samples.indexOf(arrive)-1];assert.equal(before.w,0,'w already 0 the frame before restore()');
  // setLayers(BOTH): outbound -> w=1 explicitly (same step); return -> overridden to 0 in the same sync step (no lit-room flash)
  const both=writes.map((q,i)=>[q,i]).filter(([q])=>q.kind==='layers'&&q.l.interior&&q.l.exterior);assert.equal(both.length,2);
  const [o,oi]=both[0],[r,ri]=both[1];assert.deepEqual([writes[oi+1].kind,writes[oi+1].v,writes[oi+1].frame],['set',1,o.frame]);
  assert.deepEqual([writes[ri+1].kind,writes[ri+1].v,writes[ri+1].frame],['set',0,r.frame]);
  const rs=samples.find(q=>q.op==='returnHome');assert.equal(rs.w,0,'first observed return frame keeps island light');
});
console.log(JSON.stringify({scope:'API-final + T2+: real WorldFlowCore (stripped) + real RoomLightingRig + verbatim WorldFlowComponent job/blend source with cc mock; jump figures are a proxy, not a render',metrics,cases:results.length,pass:results.every(r=>r.pass),results},null,1));
process.exitCode=results.every(r=>r.pass)?0:1;
};
process.exitCode=1; // stays 1 if a test hangs and the loop drains before the summary
run().catch(e=>{console.error(e);process.exitCode=1;});
