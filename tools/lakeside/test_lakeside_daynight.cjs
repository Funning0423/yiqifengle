// build05-next r2 (lead): toggling day/night inside lakeside (the journey once its blend has started, and the board) applies
// lakeside's OWN day/night lighting (main light, ambient, clear colour, fog; board also the water-only light scales), consistent
// with the journey blend target; leaving restores the island and a toggle back on the island gives the island look again.
// Real TS (LakesideJourneyLighting + LakesideJourneyAtmosphere + DayNightContract + LakesideSceneData) on a fake cc and a fake
// world whose __worldDayNight does what WorldFlowComponent.applyDayNight does (island main light, then emitDayNightChange).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
// ---- fake cc
class Color{constructor(r=0,g=0,b=0,a=255){if(typeof r==='string'){const h=r.replace('#','');this.r=parseInt(h.slice(0,2),16);this.g=parseInt(h.slice(2,4),16);this.b=parseInt(h.slice(4,6),16);this.a=255;}else Object.assign(this,{r,g,b,a});}clone(){return new Color(this.r,this.g,this.b,this.a);}}
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;}}Vec3.UP=new Vec3(0,1,0);
class Quat{constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}clone(){return new Quat(this.x,this.y,this.z,this.w);}
 static fromViewUp(o){o.x=0.1;o.y=0.2;o.z=0.3;o.w=0.927;return o;}static slerp(o,a,b,t){o.x=a.x+(b.x-a.x)*t;o.y=a.y+(b.y-a.y)*t;o.z=a.z+(b.z-a.z)*t;o.w=a.w+(b.w-a.w)*t;return o;}}
class DirectionalLight{}
const light=Object.assign(new DirectionalLight(),{illuminance:0,color:new Color(255,255,255),node:{rotation:new Quat(),worldRotation:new Quat(),setRotation(q){this.rotation=q.clone();this.worldRotation=q.clone();},setWorldRotation(q){this.worldRotation=q.clone();}}});
const globals={ambient:{skyLightingColor:new Color(200,220,255),groundLightingColor:new Color(120,110,90),skyIllum:20000},fog:{enabled:false,type:0,fogColor:new Color(200,200,200),fogStart:0,fogEnd:300,fogTop:4,fogRange:10,fogAtten:5}};
const scene={globals,getChildByName:n=>n==='Main Light'?{getComponent:()=>light}:null,getComponentInChildren:()=>light};
const cc={Color,Vec3,Quat,DirectionalLight,Camera:class{},director:{getScene:()=>scene},isValid:o=>!!o};
// ---- tiny TS module loader (one instance per file, so the DayNightContract listener registry is shared)
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
 const req=spec=>spec==='cc'?cc:load(path.resolve(path.dirname(file),spec)+'.ts');
 vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,req,m);return m.exports;}
const DN=load(S+'world-r1/DayNightContract.ts'),D=load(S+'region/LakesideSceneData.ts'),A=load(S+'region/LakesideJourneyAtmosphere.ts'),Lt=load(S+'region/LakesideJourneyLighting.ts');
// ---- fake world: WorldFlowComponent.applyDayNight for the island main light (+ emit)
const lightHome=60000;let mode='day';const calls={reapply:0};
const applyDayNight=()=>{const v=DN.resolveDayNight(mode,true);light.illuminance=lightHome*v.lightScale;light.color=new Color(v.lightColor[0],v.lightColor[1],v.lightColor[2],255);DN.emitDayNightChange(mode);};
globalThis.__worldDayNight={snapshot:()=>({mode}),reapply:()=>{calls.reapply++;applyDayNight();},toggle:()=>{mode=mode==='night'?'day':'night';applyDayNight();}};
applyDayNight();
const camera={clearColor:new Color(51,51,51)};
const rgb=c=>[c.r,c.g,c.b],near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps*Math.max(1,Math.abs(b));
function expectLake(m,label){const M=D.lakesideModeLighting(m),isl=lightHome*DN.resolveDayNight(m,true).lightScale;
 assert(near(light.illuminance,isl*M.sunIlluminanceScale),label+' illum '+light.illuminance);assert.deepEqual(rgb(light.color),D.lakesideCocosLightColor(M.sunColorLinear),label+' sun colour');
 assert.deepEqual(rgb(globals.ambient.skyLightingColor),D.lakesideCocosLightColor(M.ambientSkyColorLinear),label+' ambient sky');assert.deepEqual(rgb(globals.ambient.groundLightingColor),D.lakesideCocosLightColor(M.ambientGroundColorLinear),label+' ambient ground');
 assert(near(globals.ambient.skyIllum,isl*M.ambientSkyIllumToSun),label+' skyIllum');assert.deepEqual(rgb(camera.clearColor),rgb(new Color(M.clearColor)),label+' clear');
 assert.deepEqual(rgb(globals.fog.fogColor),[...M.fogColorSrgb],label+' fog colour');assert.equal(globals.fog.type,3);assert.equal(globals.fog.enabled,true);}
function expectIsland(m,label,primed=false){const v=DN.resolveDayNight(m,true);assert(near(light.illuminance,lightHome*v.lightScale),label+' island illum '+light.illuminance);assert.deepEqual(rgb(light.color),[...v.lightColor],label+' island colour');
 assert.deepEqual(rgb(globals.ambient.skyLightingColor),[200,220,255],label+' island ambient');assert.equal(globals.ambient.skyIllum,20000);assert.deepEqual(rgb(camera.clearColor),[51,51,51],label+' island clear');
 if(primed){assert.equal(globals.fog.enabled,true);assert(globals.fog.fogRange>=D.LAKESIDE_LAYERED_FOG.fogRange*999,label+' primed fog ~invisible');}else{assert.equal(globals.fog.enabled,false,label+' island fog off');assert.equal(globals.fog.type,0);}}
const run=(name,f)=>{f();console.log('PASS',name);};
const N=D.lakesideModeLighting('night'),Dy=D.lakesideModeLighting('day');
run('night look differs from day and day is the unchanged r5h3 dusk',()=>{assert.notDeepEqual(D.lakesideCocosLightColor(N.sunColorLinear),D.lakesideCocosLightColor(Dy.sunColorLinear));assert.equal(Dy.clearColor,D.LAKESIDE_CLEAR_COLOR);
 assert.equal(Dy.waterMainLightScale,D.LAKESIDE_DIR_LIGHT_PARAMS.waterMainLightScale);assert.equal(Dy.waterSkyStrength,D.LAKESIDE_DIR_LIGHT_PARAMS.waterSkyStrength);assert(N.waterSkyStrength<Dy.waterSkyStrength);});
// journey 1: day -> lake -> night -> day -> night -> leave -> toggle back on the island
let J=Lt.lakesideJourneyAtmosphere(camera,()=>-0.58);J.prime();
run('before the blend (w=0) a toggle stays the island look',()=>{globalThis.__worldDayNight.toggle();expectIsland('night','pre-blend night',true);globalThis.__worldDayNight.toggle();expectIsland('day','pre-blend day',true);});
J.apply(0.4);J.apply(1);
run('blend done: lakeside day',()=>expectLake('day','lake day'));
run('toggle in lakeside day -> night: lakeside night',()=>{globalThis.__worldDayNight.toggle();expectLake('night','lake night');});
run('toggle in lakeside night -> day: lakeside day',()=>{globalThis.__worldDayNight.toggle();expectLake('day','lake day again');});
run('mid-blend toggle: blends toward the night target from the island night base',()=>{J.apply(0.5);globalThis.__worldDayNight.toggle();const isl=lightHome*0.35;assert(near(light.illuminance,isl+(isl*N.sunIlluminanceScale-isl)*0.5));J.apply(1);expectLake('night','night after mid-blend');});
run('leave in night (主页): island NIGHT look (world re-applies, no lock)',()=>{const r0=calls.reapply;J.restore();assert.equal(calls.reapply,r0+1,'reapply once');expectIsland('night','after leave');});
run('leave-then-toggle back on the island: island day, lakeside no longer writes',()=>{globalThis.__worldDayNight.toggle();expectIsland('day','island day');globalThis.__worldDayNight.toggle();expectIsland('night','island night');globalThis.__worldDayNight.toggle();expectIsland('day','island day 2');});
// journey 2: arrive in night; leave in the same mode -> no reapply
J=Lt.lakesideJourneyAtmosphere(camera,()=>-0.58);globalThis.__worldDayNight.toggle();J.prime();J.apply(1);
run('arrive at night: lakeside night; leave at night: captured island restored, no reapply needed',()=>{expectLake('night','arrive night');const r0=calls.reapply;J.restore();assert.equal(calls.reapply,r0);expectIsland('night','leave night');globalThis.__worldDayNight.toggle();expectIsland('day','toggle on island');});
// journey 3: board holds the lighting -> journey listener stands down; board hide -> journey re-applies the current mode
J=Lt.lakesideJourneyAtmosphere(camera,()=>-0.58);J.prime();J.apply(1);
run('board holding: journey does not write on toggle; on board hide reapplyLakesideJourney gives the current mode',()=>{A.setLakesideBoardHolding(true);globalThis.__worldDayNight.toggle();
 assert(near(light.illuminance,lightHome*0.35),'only the island writer ran (board would re-apply its own)');A.setLakesideBoardHolding(false);assert.equal(A.reapplyLakesideJourney(),true);expectLake('night','after board hide');
 assert(near(A.lakesideJourneyBaseIllum(),lightHome),'journey day base (illum / island scale)');J.restore();assert.equal(A.reapplyLakesideJourney(),false,'no journey -> board falls back to the world reapply');globalThis.__worldDayNight.toggle();expectIsland(mode,'island after');});
// board: same numbers as the journey target, in both modes (formula in LakesideBoardBackground.applyDir)
run('board applyDir = journey target in both modes; board re-applies on toggle and restores via journey/world',()=>{
 const bg=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8');
 for(const m of ['day','night']){const dayBase=lightHome,bi=dayBase*A.lakesideIslandLightScale(m),M=D.lakesideModeLighting(m);
  const t=A.lakesideAtmosphereTarget({illum:bi,color:[0,0,0],sky:[0,0,0],ground:[0,0,0],skyIllum:0,clear:[0,0,0]},m);assert(near(t.illum,bi*M.sunIlluminanceScale)&&near(t.skyIllum,bi*M.ambientSkyIllumToSun));}
 assert(/const offDayNight=onDayNightChange\(\(\)=>\{if\(visible&&!dead\)applyDir\(\);\}\);/.test(bg),'board re-applies on toggle');
 assert(/const dispose=\(\)=>\{if\(dead\)return;restoreDir\(\);dead=true;off\(\);offDayNight\(\);/.test(bg),'unsubscribed on dispose');
 assert(/M=lakesideModeLighting\(mode\)/.test(bg)&&/camera\.clearColor=new Color\(M\.clearColor\)/.test(bg),'board colours + clear per mode');
 assert(/waterMat\.setProperty\('lightParams',new Vec4\(M\.waterMainLightScale,M\.waterAmbientScale,P\.waterWaveFadeStart,P\.waterWaveFadeEnd\)\);waterMat\.setProperty\('fresnelParams',new Vec4\(P\.waterFresnelPower,P\.waterFresnelF0,P\.waterFresnelMax,M\.waterSkyStrength\)\);/.test(bg),'water-only light scales per mode');
 assert(/const c=lakesideModeLighting\(lakesideDayNightMode\(\)\)\.fogColorSrgb;/.test(bg),'fog colour per mode');
 assert(/restoreDir=\(\)=>\{restoreFog\(\);setLakesideBoardHolding\(false\);/.test(bg)&&/if\(!reapplyLakesideJourney\(\)&&s0\.mode!==lakesideDayNightMode\(\)\)\(globalThis as any\)\.__worldDayNight\?\.reapply\?\.\(\);/.test(bg),'restore-on-leave chain');
 const wf=fs.readFileSync(S+'world-r1/WorldFlowComponent.ts','utf8');assert(/emitDayNightChange\(this\.dayNightMode\);/.test(wf)&&/reapply:\(\)=>self\.applyDayNight\(\)/.test(wf),'world emits + non-locking reapply');});
console.log('lakeside day/night OK');
