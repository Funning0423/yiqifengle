'use strict';
// T5-material: box-side test of the lighting blend (no Cocos runtime). Two parts:
//  A) real type-stripped WorldFlowCore: leaveHome/returnHome call order + cancellation + old adapters.
//  B) real type-stripped RoomLightingRig with a minimal 'cc' mock: weight 1 == legacy room values,
//     weight 0 == island values, and a facade-radiance proxy changes < 8% per frame (and over any 53-frame window per step).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),Module=require('node:module');
const {stripTypeScriptTypes}=Module;
const root=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const results=[];const test=async(name,fn)=>{try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:String(e&&e.stack||e)});}};

// ---------- A) flow ----------
const coreSrc=fs.readFileSync(path.join(root,'world-r1/WorldFlowCore.ts'),'utf8');
const coreJs=stripTypeScriptTypes(coreSrc,{mode:'strip'}).replace(/import \{ CameraTrackFailure \} from '\.\/CameraPose';/,'class CameraTrackFailure extends Error {}').replace(/\bexport\s+/g,'');
const ctx={};vm.runInNewContext(coreJs+'\nthis.api={WorldFlow,Cancellation,layerStates,pathDuration};',ctx);const {WorldFlow,layerStates,pathDuration}=ctx.api;
function fixture({withBlend=true,blendImpl}={}){
  const zero=[0,0,0],one=[0,0,1],far=[0,0,4],pose={position:[0,2,3],target:zero};
  const seat={position:zero,back:zero,yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:zero};
  const log=[];
  const config={seat,toDoor:[zero,one],outCrossing:[one,one],toIsland:[one,far],toThreshold:[far,one],inCrossing:[one,one],toSeat:[one,zero],cameraHome:pose,cameraToDoor:[pose,pose],cameraInside:pose,cameraOutside:pose,cameraIsland:pose,openDeg:60,speed:.5};
  const name=l=>Object.entries(layerStates).find(([,v])=>JSON.stringify(v)===JSON.stringify(l))[0];
  const world={setLayers:x=>log.push('layers:'+name(x)),setDoor(){},setCamera(){},animateDoor:async()=>{},animateCamera:async()=>{log.push('camera');},cancelTransient(){},assertStaticWorld(){},dispose(){}};
  if(withBlend)world.blendRoomLight=blendImpl||(async(from,to,seconds)=>{log.push(`blend:${from}->${to}@${seconds}`);});
  const character={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:zero,seatedRoot:zero,seatYawRad:0,clearanceRadiusM:.15},advance(){},perform:async a=>{log.push('act:'+a.kind);},cancelAndReset(){},setVisible(){},dispose(){}};
  const f=new WorldFlow({config,character,levels:{enter:async()=>{throw Error('no');}},loadWorld:async()=>world});
  return {f,log,config};
}
const run=async()=>{
await test('outbound: BOTH at door, blend 1->0 over exactly the toIsland walk, then ISLAND',async()=>{
  const x=fixture();await x.f.load();x.log.length=0;assert.equal((await x.f.leaveHome()).ok,true);
  const d=pathDuration(x.config.toIsland,x.config.speed);assert.ok(d>0);
  const iB=x.log.indexOf('layers:BOTH'),iL=x.log.indexOf(`blend:1->0@${d}`),iI=x.log.lastIndexOf('layers:ISLAND');
  assert.ok(iB>=0&&iL>iB&&iI>iL,JSON.stringify(x.log));
  // the blend starts after outCrossing walk (2nd walk) and together with the toIsland walk (3rd)
  const walks=x.log.map((v,i)=>v==='act:walk'?i:-1).filter(i=>i>=0);assert.ok(iL>walks.at(-2)&&iL<walks.at(-1),JSON.stringify(x.log));
});
await test('return: BOTH then blend 0->1 in the same synchronous step, over the toThreshold walk',async()=>{
  const x=fixture();await x.f.load();await x.f.leaveHome();x.log.length=0;assert.equal((await x.f.returnHome()).ok,true);
  const d=pathDuration(x.config.toThreshold,x.config.speed);
  assert.equal(x.log[0],'layers:BOTH');assert.equal(x.log[1],`blend:0->1@${d}`);assert.ok(x.log.includes('layers:HOME'));
});
await test('adapter without blendRoomLight (older leases) still completes both flows',async()=>{
  const x=fixture({withBlend:false});await x.f.load();assert.equal((await x.f.leaveHome()).ok,true);assert.equal((await x.f.returnHome()).ok,true);assert.equal(x.f.snapshot().state,'home');
});
await test('cancel mid-blend: no unhandled rejection, flow lands on a stable layer state',async()=>{
  let unhandled=0;const h=()=>unhandled++;process.on('unhandledRejection',h);
  const x=fixture({blendImpl:(f,t,s,token)=>new Promise((_,rej)=>token.onCancel(()=>rej(Error('Cancelled'))))});await x.f.load();
  const p=x.f.leaveHome();for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(x.f.cancelTransition().ok,true);const r=await p;assert.equal(r.ok,false);
  await new Promise(r=>setTimeout(r,20));process.off('unhandledRejection',h);assert.equal(unhandled,0);
  assert.ok(/^layers:(HOME|ISLAND)$/.test(x.log.filter(v=>v.startsWith('layers:')).at(-1)),JSON.stringify(x.log));
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
await test('weight 1 (setView interior) reproduces the legacy room photometry exactly',async()=>{
  const x=makeRig();x.rig.setView(true,true,false);
  assert.equal(x.sun.illuminance,125000*ROOM_LIGHTING.daylightScale);assert.deepEqual([x.sun.color.r,x.sun.color.g,x.sun.color.b],[0xff,0xf4,0xde]);
  assert.equal(x.ambient.skyIllum,125000*ROOM_LIGHTING.ambientToMainDay);assert.equal(x.sun.shadowSaturation,ROOM_LIGHTING.shadowSaturationDay);
  const want=lookAtQuat([.8,6.6,-7],[-.4,.6,-2]);for(const k of ['x','y','z','w'])assert.ok(Math.abs(x.sun.node.rotation[k]-want[k])<1e-12);
  assert.equal(x.sun.shadowEnabled,true);assert.equal(x.scene.globals.shadows.shadowMapSize,1024);
});
await test('weight 0 == island set (scene sun rotation, 125000 lx white, ambient 20000/raw colours, shadow strength 0)',async()=>{
  const x=makeRig();x.rig.setView(true,true,false);assert.equal(x.rig.setRoomLightWeight(0),true);
  assert.equal(x.sun.illuminance,125000);assert.deepEqual([x.sun.color.r,x.sun.color.g,x.sun.color.b],[255,255,255]);
  assert.equal(x.ambient.skyIllum,20000);assert.deepEqual(x.ambient._sky,new Vec4(.2,.502,.8,1));assert.equal(x.sun.shadowSaturation,0);
  for(const k of ['x','y','z','w'])assert.ok(Math.abs(x.sun.node.rotation[k]-new Quat(-.25,-.25,-.06698729810778066,.9330127018922194)[k])<1e-9);
  // then ISLAND restore(): no further photometric change (same values as weight 0 apart from shadow flags)
  const before=facade(x);x.sun.illuminance=125000;x.rig.setView(false,true,false);assert.ok(Math.abs(facade(x)-before)/before<1e-9);
});
await test('setRoomLightWeight is a no-op outside interior view and when disposed',async()=>{
  const x=makeRig();assert.equal(x.rig.setRoomLightWeight(.5),false);x.rig.setView(true,true,false);x.rig.dispose();assert.equal(x.rig.setRoomLightWeight(.5),false);
});
const metrics={};
await test('facade proxy calibrated to video lumas: legacy one-frame jump > 8%, blended worst frame < 8% (53 frames and real walk)',async()=>{
  // Display-luma estimate: L = a*R^(1/2.2)+b, a/b fitted so the two endpoints equal the measured tower ROI luma
  // in 08-outbound-motion.mp4 (room 151.3 at 22.733 s, island 203.4 at 22.750 s). Estimate only, not a render.
  const x=makeRig();x.rig.setView(true,true,false);const room=facade(x);x.rig.setRoomLightWeight(0);const island=facade(x);
  const g=v=>Math.pow(v,1/2.2),a=(203.4-151.3)/(g(island)-g(room)),b=151.3-a*g(room),L=v=>a*g(v)+b;
  metrics.legacyJumpPct=(L(island)-L(room))/L(room)*100;
  const walkFrames=Math.round(60*(Number(process.env.T5_TOISLAND_SECONDS)||0));
  for(const frames of [53,...(walkFrames>53?[walkFrames]:[])]){let worst=0,prev=null;for(let i=0;i<=frames;i++){x.rig.setRoomLightWeight(1-i/frames);const v=L(facade(x));if(prev!==null)worst=Math.max(worst,Math.abs(v-prev)/Math.min(v,prev)*100);prev=v;}
    metrics['worstPerFramePct@'+frames+'f']=worst;assert.ok(worst<8,`${frames}: ${worst}`);}
  assert.ok(metrics.legacyJumpPct>8);
});
console.log(JSON.stringify({scope:'type-stripped WorldFlowCore + RoomLightingRig with cc mock; proxy radiance, not a render',metrics,cases:results.length,pass:results.every(r=>r.pass),results},null,1));
if(!results.every(r=>r.pass))process.exitCode=1;
};
run().catch(e=>{console.error(e);process.exitCode=1;});
