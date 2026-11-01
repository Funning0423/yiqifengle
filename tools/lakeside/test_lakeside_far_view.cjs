// r4-prep C/D (lead): far view = the same set on both sides of the journey→board swap. The lakeside far hills come IN with the
// blend first; the island-only sky dome, cloud layer and gulls fade OUT over ISLAND_SKY_FADE (done before the landing), so the
// journey end sky is the shared clear colour; one draw each (instance pass re-stated, no new node/material), restored on leave.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const run=(name,f)=>{f();console.log('PASS',name);};
const tr=src=>ts.transpileModule(src,{compilerOptions:{module:1,target:7}}).outputText;
const K={};vm.runInThisContext('(function(exports){'+tr(fs.readFileSync(S+'world-r1/SkyFollowCore.ts','utf8'))+'\n})')(K);
run('schedule: island props fully shown until w=0.6, gone from w=0.95 (before the landing at w=1), monotonic, no pop at 60 Hz',()=>{
 assert.equal(K.islandSkyFade(0),1);assert.equal(K.islandSkyFade(.6),1);assert.equal(K.islandSkyFade(.95),0);assert.equal(K.islandSkyFade(1),0);assert.equal(K.islandSkyFade(NaN),1);
 let prev=1,max=0;for(let i=0;i<=470;i++){const v=K.islandSkyFade(i/470);assert(v<=prev+1e-12);max=Math.max(max,prev-v);prev=v;}assert(max<.012,'per-frame step '+max);
 assert(K.ISLAND_SKY_FADE.start>=.5,'the lakeside far hills come in (fog thins with w) before the island props start to go');});
// ---- bindUnlitBackdrop extracted from WorldFlowComponent with fakes (the real function text, not a copy)
const W=fs.readFileSync(S+'world-r1/WorldFlowComponent.ts','utf8');
const src=W.slice(W.indexOf('type UnlitBackdropBinding'),W.indexOf('/** Add to a NEW, identity scene-root sibling'));
class Vec4{constructor(x=0,y=0,z=0,w=0){Object.assign(this,{x,y,z,w});}}
const gfx={BlendOp:{ADD:0},BlendFactor:{ZERO:0,ONE:1,SRC_ALPHA:2,ONE_MINUS_SRC_ALPHA:4},AttributeName:{ATTR_COLOR:'a_color',ATTR_POSITION:'a_position'}};
function mkPass(){return {defines:{USE_VERTEX_COLOR:true},rasterizerState:{cullMode:0},depthStencilState:{depthTest:true,depthWrite:true,depthFunc:4},blendState:{targets:[{blend:false,blendEq:0,blendSrc:1,blendDst:0,blendAlphaEq:0,blendSrcAlpha:1,blendDstAlpha:0}]},
 u:new Vec4(1,1,1,1),getHandle:()=>1,getUniform(h,v){Object.assign(v,this.u);return v;}};}
function mkRenderer(name){const shared={effectName:'builtin-unlit',passes:[mkPass()]};const inst={passes:[mkPass()],overrides:[],props:[],
  overridePipelineStates(o,i){this.overrides.push(JSON.parse(JSON.stringify(o)));},setProperty(k,v){this.props.push([k,v]);if(k==='mainColor')this.passes[0].u=v;},destroy(){}};
 const r={node:{name},mesh:{readAttribute:(i,a)=>a==='a_color'?new Float32Array([.5,.5,.5,.5,.5,.5]):new Float32Array(6)},shared,inst,sets:0,
  getSharedMaterial:()=>shared,getRenderMaterial:()=>shared,getMaterialInstance:()=>inst,setSharedMaterial(){this.sets++;}};return r;}
const mod={};vm.runInThisContext('(function(exports,Vec4,gfx,isValid,skyFollowColor,vertexColorAverageLinear,console){'+tr(src)+'\nexports.bind=bindUnlitBackdrop;})')(mod,Vec4,gfx,o=>!!o,K.skyFollowColor,K.vertexColorAverageLinear,{info(){},warn(){}});
const target=[28,143,184];
run('dome: fade<1 switches only this instance to alpha blend (no depth write, cull kept); alpha follows; fade 1 restores the shared states exactly',()=>{
 const r=mkRenderer('env_sky_dome'),b=mod.bind(r);b.setNight(false);
 b.setFollow(target,.5,1);assert.equal(r.inst.overrides.length,0,'no re-state before the fade window');
 b.setFollow(target,.8,.4);assert.equal(r.inst.overrides.length,1);const o=r.inst.overrides[0];
 assert.equal(o.blendState.targets[0].blend,true);assert.equal(o.blendState.targets[0].blendSrc,gfx.BlendFactor.SRC_ALPHA);assert.equal(o.blendState.targets[0].blendDst,gfx.BlendFactor.ONE_MINUS_SRC_ALPHA);
 assert.equal(o.depthStencilState.depthWrite,false);assert.equal(o.rasterizerState.cullMode,0);assert(Math.abs(r.inst.passes[0].u.w-.4)<1e-9);
 b.setFollow(target,1,0);assert.equal(r.inst.overrides.length,1,'one re-state for the whole window');assert.equal(r.inst.passes[0].u.w,0);
 b.setFollow(null,0,1);assert.equal(r.inst.overrides.length,2);const back=r.inst.overrides[1],sp=r.shared.passes[0];
 assert.deepEqual(back.blendState.targets[0],sp.blendState.targets[0]);assert.equal(back.depthStencilState.depthWrite,true);assert.equal(back.depthStencilState.depthFunc,4);
 assert.deepEqual([r.inst.passes[0].u.x,r.inst.passes[0].u.y,r.inst.passes[0].u.z,r.inst.passes[0].u.w],[1,1,1,1],'day island look back');
 b.setFollow(null,0,1);assert.equal(r.inst.overrides.length,2,'restored once');assert.equal(r.sets,0,'shared material never swapped back (binding kept)');});
run('night: toggling inside the fade keeps the alpha; cloud layer behaves the same; sea foam ignores follow',()=>{
 const r=mkRenderer('env_cloud_layer'),b=mod.bind(r);b.setNight(true);b.setFollow(target,.9,.25);b.setNight(false);b.setNight(true);assert(Math.abs(r.inst.passes[0].u.w-.25)<1e-9);
 b.setFollow(null,0,1);assert.equal(r.inst.passes[0].u.w,1);const u=r.inst.passes[0].u;assert(u.x<.5,'night tint back');
 const f=mkRenderer('env_sea_foam'),fb=mod.bind(f);assert.equal(fb.setFollow,undefined);});
run('wiring: journey lighting sends islandSkyFade(w); skyFollow fans the fade to the gulls; leave sends fade 1; gulls scale/hide',()=>{
 const L=fs.readFileSync(S+'region/LakesideJourneyLighting.ts','utf8');assert.match(L,/skyFollow\?\.\(k\?target:null,k\?w:0,k\?islandSkyFade\(w\):1\)/);
 assert.match(W,/private skyFollow\(target:readonly number\[\]\|null,w:number,fade=1\):number\{let n=0;const f=target\?fade:1;/);assert.match(W,/this\.atmosphere\?\.setIslandFade\(f\)/);
 const A=fs.readFileSync(S+'render/IslandAtmosphereFx.ts','utf8');assert.match(A,/setIslandFade\(f: number\): void \{ if \(this\.gulls\) this\.gulls\.setFade\(f\); \}/);
 const G=fs.readFileSync(S+'render/GullFlock.ts','utf8');assert.match(G,/const vis = s\.visible && this\.fade > 1e-3, k = s\.size \* this\.fade;/);assert.match(G,/if \(this\.fade <= 1e-3\) continue;/,'no gull calls while gone');
 // geometry facts (glb accessors, 2026-10-17): lakeside far hills sit inside the island dome (r 283) and the cloud ring (r <= 190),
 // so in the journey they are hidden only by the island props; the board camera sees them against its clear colour.
 const hillsFar=108,landingFromIsland=40;assert(hillsFar+landingFromIsland<283);});
