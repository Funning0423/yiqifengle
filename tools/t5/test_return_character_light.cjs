'use strict';
// R3 (Mac round 3, "回家那段女孩几乎全黑"): effective lighting on the girl along the REAL return path.
// REAL WorldFlow + routes + camera tracks (tools/camera-frame-test/flow_sim.cjs, 60 fps, home -> island -> home) drive
// the REAL RoomLightingRig (TS-transpiled, minimal 'cc' mock as in test_room_light_blend.cjs) exactly like
// WorldFlowComponent does: applyDayNight() on every layer switch (Main Light illuminance/colour from DayNightContract,
// then rig.setView), setLayers(interior) -> w=1, then the flow's own w / exterior-key writes of that frame.
// Per frame it evaluates the radiance of the side of the girl the lens sees (normal = horizontal direction her root ->
// lens): Lambert sun (rig's Main Light rotation/illuminance/colour) + hemispheric ambient (rig's skyIllum, sky/ground).
// The follow lens stays behind her, so that side is her back under the authored sun (no exterior-key mirror, no fill).
// Reference = the approved outbound frontal hold (median over the settle before state 'island', same mode).
// FAIL (per day and night) when:
//   - on any in-shot exterior follow frame (walking-home, head in a 0.46-aspect frustum, lens <= 10 m, room weight
//     still 0) that side is below 56 % (day) or 62 % (night) of the outbound hold, or
//   - on any in-shot walking-home frame it is below 45 % of the w-linear expected level (hold at w=0, seated home
//     view at w=1) — this floor is not widened, or
//   - it dips: lower than 85 % of BOTH the best value before and the best value after it on the return (a valley), or
//   - the layers are not BOTH on the exterior part of the walk, or w/k are not 0 on the first return frame, or
//   - return house/terrain photometry (Main Light rotation, illuminance, colour, ambient) differs from a replay that
//     never applies the exterior key.
// The old mirror-timing check (key already 1 the first time the lens sees her front) is gone: this lens does not
// swing onto her front, and the key is not run.
// Plus rig unit checks of the R3 exterior key. usage: node test_return_character_light.cjs [--root <worktree>] [--json out]
//   --root: run against another worktree (e.g. 38b005f to reproduce the r3 failure; key API absent there = k ignored).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const args=process.argv.slice(2),opt=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const ROOT=path.resolve(opt('--root')||path.resolve(__dirname,'../..'));
const SCRIPTS=path.join(ROOT,'creator-build-project/assets/scripts');
const S=require(path.join(ROOT,'tools/camera-frame-test/flow_sim.cjs'));
const ts=require(process.env.QF_TYPESCRIPT_MODULE||path.resolve(__dirname,'../../../GGbot/tools/vendor-node/node_modules/typescript'));
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
/** Radiance proxy of a surface with normal n under the rig's current Main Light + ambient. */
function radiance(x,n){const L=rotate(x.sun.node.rotation,[0,0,-1]),nl=Math.max(0,-(L[0]*n[0]+L[1]*n[1]+L[2]*n[2]));
  const sunC=luma(x.sun.color.r/255,x.sun.color.g/255,x.sun.color.b/255),up=.5+.5*n[1],s=x.ambient._sky,g=x.ambient._ground;
  const hemi=luma(g.x+(s.x-g.x)*up,g.y+(s.y-g.y)*up,g.z+(s.z-g.z)*up);
  return {E:x.sun.illuminance*sunC*nl+x.ambient.skyIllum*hemi,nl,L};}
function inShot(f,aspect=.46){const head=[f.root[0],f.root[1]+1.3,f.root[2]],p=f.cam.position,d=[head[0]-p[0],head[1]-p[1],head[2]-p[2]],dist=Math.hypot(...d);if(dist>10)return false;
  const q=f.cam.rotation,inv=[-q[0],-q[1],-q[2],q[3]],c=rotate(inv,d);if(c[2]>=0)return false;const t=Math.tan(f.cam.fovVerticalDeg*Math.PI/360);
  return Math.abs(c[1]/-c[2])<=t&&Math.abs(c[0]/-c[2])<=t*aspect;}
/** Replays the simulated frames through the real rig like WorldFlowComponent (applyDayNight on layer switches).
 *  forceKey0: never write the flow's exterior key (house and terrain must match this replay on the return). */
function replay(frames,night,forceKey0){
  const x=makeRig(),hasKey=typeof x.rig.setExteriorKey==='function',view=resolveDayNight(night?'night':'day',true);let last=null;const out=[];
  for(const f of frames){const L=f.layers||{interior:false,exterior:false,backdrop:false},sig=JSON.stringify(L);
    if(sig!==last){last=sig;x.sun.illuminance=LIGHT_HOME*resolveDayNight(night?'night':'day',!!L.exterior).lightScale;const c=view.lightColor;x.sun.color=new Color(c[0],c[1],c[2],255);
      x.rig.setView(!!L.interior,!!L.backdrop,night);if(L.interior)x.rig.setRoomLightWeight(1);}
    if(L.interior){x.rig.setRoomLightWeight(f.weight);if(hasKey)x.rig.setExteriorKey(forceKey0?0:(f.key??0));}
    const toCam=[f.cam.position[0]-f.root[0],0,f.cam.position[2]-f.root[2]],n0=Math.hypot(toCam[0],toCam[2])||1,n=[toCam[0]/n0,0,toCam[2]/n0];
    const q=x.sun.node.rotation;
    out.push({t:f.t,op:f.op,state:f.state,w:x.rig.getRoomLightWeight(),k:hasKey?x.rig.getExteriorKey():0,layers:L,shot:inShot(f),n,root:f.root,yaw:f.yaw,cam:f.cam,
      sunI:x.sun.illuminance*luma(x.sun.color.r/255,x.sun.color.g/255,x.sun.color.b/255),sunC:[x.sun.color.r,x.sun.color.g,x.sun.color.b],amb:x.ambient.skyIllum,sky:[x.ambient._sky.x,x.ambient._sky.y,x.ambient._sky.z],ground:[x.ambient._ground.x,x.ambient._ground.y,x.ambient._ground.z],
      photo:{q:[q.x,q.y,q.z,q.w],I:x.sun.illuminance,c:[x.sun.color.r,x.sun.color.g,x.sun.color.b],amb:x.ambient.skyIllum,sky:[x.ambient._sky.x,x.ambient._sky.y,x.ambient._sky.z],ground:[x.ambient._ground.x,x.ambient._ground.y,x.ambient._ground.z]},...radiance(x,n)});}
  return {rows:out,hasKey};}
function samePhoto(a,b){const e=1e-9;if(!a||!b)return false;if(a.I!==b.I||a.amb!==b.amb)return false;
  if(a.c.some((v,i)=>v!==b.c[i]))return false;
  if(a.q.some((v,i)=>Math.abs(v-b.q[i])>e))return false;
  if(a.sky.some((v,i)=>Math.abs(v-b.sky[i])>e)||a.ground.some((v,i)=>Math.abs(v-b.ground[i])>e))return false;return true;}
const results=[];const test=async(name,fn)=>{try{const info=await fn();results.push({name,pass:true,info});}catch(e){results.push({name,pass:false,error:String(e&&e.message||e)});}};
(async()=>{
  const env=S.create(),run=await S.run(env),F=run.frames;
  const per={};
  for(const night of [false,true]){const mode=night?'night':'day';const floor=night?0.62:0.56;const {rows,hasKey}=replay(F,night);const bare=replay(F,night,true);per[mode]={rows,hasKey};
    const out=rows.filter(r=>r.op==='leaveHome'),ret=rows.filter(r=>r.op==='returnHome');
    // reference: outbound settle before 'island' (frontal hold, Funning-approved look), in-shot frames only
    const iIsl=out.findIndex(r=>r.state==='island'),hold=out.slice(0,iIsl<0?out.length:iIsl).filter(r=>r.shot).slice(-90).map(r=>r.E).sort((a,b)=>a-b);
    const ref=hold[Math.floor(hold.length/2)];
    // room end: the seated home view after the return (w=1, approved indoor look); the 45 % floor follows w between the two
    const homeE=rows.filter(r=>r.op==='returnHome:hold').map(r=>r.E).sort((a,b)=>a-b),refHome=homeE[Math.floor(homeE.length/2)];
    const expected=r=>(1-r.w)*ref+r.w*Math.min(ref,refHome);
    // exterior part of the return: walking-home, until crossing-in. Follow shot of her back is the w=0 stretch.
    const ext=ret.filter(r=>r.state==='walking-home');const shot=ext.filter(r=>r.shot),follow=shot.filter(r=>r.w<=1e-9);
    const ratio=r=>r.E/expected(r),minR=Math.min(...shot.map(ratio)),worst=shot.find(r=>ratio(r)===minR);
    const followRatio=r=>r.E/ref,minF=Math.min(...follow.map(followRatio)),worstF=follow.find(r=>followRatio(r)===minF);
    const dips=[];for(let i=0;i<shot.length;i++){const before=Math.max(...shot.slice(0,i+1).map(r=>r.E)),after=Math.max(...shot.slice(i).map(r=>r.E));if(shot[i].E<.85*Math.min(before,after))dips.push(shot[i]);}
    const bareRet=bare.rows.filter(r=>r.op==='returnHome');let photoMismatch=null;
    for(let i=0;i<ret.length;i++)if(!samePhoto(ret[i].photo,bareRet[i].photo)){photoMismatch={t:+(ret[i].t-ret[0].t).toFixed(2),k:ret[i].k,w:ret[i].w};break;}
    per[mode].summary={ref:+ref.toFixed(0),refHome:+refHome.toFixed(0),inShotFrames:shot.length,followFrames:follow.length,floor,minFollowRatio:+minF.toFixed(3),minRatio:+minR.toFixed(3),
      followWorst:worstF&&{t:+(worstF.t-ret[0].t).toFixed(2),w:+worstF.w.toFixed(2),nl:+worstF.nl.toFixed(2)},
      worstAt:worst&&{t:+(worst.t-ret[0].t).toFixed(2),w:+worst.w.toFixed(2),k:+worst.k.toFixed(2),nl:+worst.nl.toFixed(2)},
      dipFrames:dips.length,firstDip:dips[0]&&{t:+(dips[0].t-ret[0].t).toFixed(2),ratio:+(dips[0].E/ref).toFixed(3)},photoMismatch};
    await test(mode+': follow lens - the side it sees (her back, authored sun) >= '+(floor*100).toFixed(0)+' % of the outbound frontal hold on every in-shot frame while w=0',()=>{
      assert.ok(follow.length>=60,'too few exterior follow frames: '+follow.length);
      assert.ok(minF>=floor,`min ${(minF*100).toFixed(1)} % of the outbound hold at t=${per[mode].summary.followWorst.t}s (N.L=${per[mode].summary.followWorst.nl})`);
      return {followFrames:follow.length,minFollowRatio:per[mode].summary.minFollowRatio};});
    await test(mode+': return walk - lit side the lens sees >= 45 % of the expected level on every in-shot frame (outbound frontal hold at w=0, seated home view at w=1, linear in w)',()=>{
      assert.ok(shot.length>=60,'too few in-shot return frames: '+shot.length);
      assert.ok(minR>=.45,`min ${(minR*100).toFixed(1)} % of the expected level at t=${per[mode].summary.worstAt.t}s (w=${per[mode].summary.worstAt.w}, k=${per[mode].summary.worstAt.k}, N.L=${per[mode].summary.worstAt.nl})`);
      return per[mode].summary;});
    await test(mode+': return walk - no dip (no frame below 85 % of the best value both before and after it)',()=>{
      assert.equal(dips.length,0,`${dips.length} dip frames, first at t=${per[mode].summary.firstDip?.t}s (${(per[mode].summary.firstDip?.ratio*100).toFixed(1)} % of ref)`);});
    await test(mode+': layers/visibility - BOTH on the exterior walk, w=0 and k=0 on the first return frame, w stays 0 until the T5 ramp, outbound k always 0',()=>{
      for(const r of ext)assert.ok(r.layers.interior&&r.layers.exterior,'not BOTH at t='+r.t);
      assert.equal(ret[0].w,0);assert.equal(ret[0].k,0);
      const firstW=ext.findIndex(r=>r.w>0);assert.ok(firstW>ext.length*.4,'w rises too early: frame '+firstW+' of '+ext.length);
      for(const r of out)assert.equal(r.k,0,'k on the way out at t='+r.t);});
    await test(mode+': return house and terrain photometry matches a replay with the exterior key forced off',()=>{
      assert.equal(ret.length,bareRet.length,'return frame count');
      for(const r of ret)assert.equal(r.k,0,'exterior key written on the return at t='+r.t);
      assert.equal(photoMismatch,null,'sun/ambient diverged at t='+(photoMismatch&&photoMismatch.t)+'s');});
  }
  await test('rig: mirroredKey keeps elevation + x, mirrors z; k=0 exact authored, w=1 exact room (k ignored); k reset on setView switch; validity like w',()=>{
    assert.ok(mirroredKey,'mirroredKey missing (pre-R3 rig)');
    const d0=rotate(AUTHORED_Q,[0,0,-1]),d1=rotate(mirroredKey(AUTHORED_Q),[0,0,-1]);
    assert.ok(Math.abs(d1[0]-d0[0])<1e-9&&Math.abs(d1[1]-d0[1])<1e-9&&Math.abs(d1[2]+d0[2])<1e-9,JSON.stringify({d0,d1}));
    const x=makeRig();assert.equal(x.rig.setExteriorKey(1),false,'outside interior');assert.equal(x.rig.getExteriorKey(),0);
    x.rig.setView(true,true,false);const room=JSON.stringify([x.sun.node.rotation,x.sun.illuminance,x.ambient.skyIllum]);
    assert.equal(x.rig.setExteriorKey(1),true);assert.equal(JSON.stringify([x.sun.node.rotation,x.sun.illuminance,x.ambient.skyIllum]),room,'w=1 unaffected by k');
    x.rig.setRoomLightWeight(0);const k1=rotate(x.sun.node.rotation,[0,0,-1]);assert.ok(Math.abs(k1[2]+d0[2])<1e-9&&x.sun.illuminance===LIGHT_HOME,'k=1,w=0: mirrored sun, island photometry');
    x.rig.setExteriorKey(.5);const kh=rotate(x.sun.node.rotation,[0,0,-1]);assert.ok(Math.abs(kh[1]-d0[1])<1e-9,'elevation kept mid-swing');
    x.rig.setExteriorKey(0);assert.ok(['x','y','z','w'].every(c=>Math.abs(x.sun.node.rotation[c]-AUTHORED_Q[c])<1e-12),'k=0 exact authored');
    for(const bad of [NaN,Infinity])assert.equal(x.rig.setExteriorKey(bad),false);x.rig.setExteriorKey(2);assert.equal(x.rig.getExteriorKey(),1);x.rig.setExteriorKey(-1);assert.equal(x.rig.getExteriorKey(),0);
    x.rig.setExteriorKey(.7);x.rig.setView(true,true,true);assert.equal(x.rig.getExteriorKey(),.7,'day/night toggle keeps k');
    x.rig.setView(false,true,false);assert.equal(x.rig.getExteriorKey(),0);x.rig.setView(true,true,false);assert.equal(x.rig.getExteriorKey(),0,'reset on interior switch');
    x.rig.dispose();assert.equal(x.rig.setExteriorKey(1),false);assert.equal(x.rig.getExteriorKey(),0);});
  const pass=results.every(r=>r.pass);
  for(const r of results)console.log((r.pass?'PASS ':'FAIL ')+r.name+(r.pass?'':'\n     '+r.error));
  console.log('summary',JSON.stringify({root:ROOT,day:per.day.summary,night:per.night.summary,keyApi:per.day.hasKey}));
  if(opt('--json'))fs.writeFileSync(opt('--json'),JSON.stringify({root:ROOT,results,summary:{day:per.day.summary,night:per.night.summary},
    curve:Object.fromEntries(Object.entries(per).map(([m,v])=>[m,v.rows.filter(r=>r.op==='returnHome').map(r=>({t:+r.t.toFixed(3),state:r.state,w:+r.w.toFixed(3),k:+r.k.toFixed(3),E:+r.E.toFixed(0),shot:r.shot,nz:+r.n[2].toFixed(2),L:r.L.map(v=>+v.toFixed(4)),sunI:+r.sunI.toFixed(0),sunC:r.sunC.map(v=>Math.round(v)),amb:+r.amb.toFixed(0),sky:r.sky.map(v=>+v.toFixed(3)),ground:r.ground.map(v=>+v.toFixed(3)),root:r.root,yaw:r.yaw,cam:r.cam}))]))},null,1));
  console.log(pass?'ALL PASS return character light':'FAILED return character light');process.exit(pass?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
