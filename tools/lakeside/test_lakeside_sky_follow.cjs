// r4-prep (lead): during the lakeside blend the island sky dome (+ cloud layer) follows the blended lakeside sky instead of
// covering it: w=0 exactly the island look (no pop), w=1 the dome average = lakeside end clear, day and night, no new draw, freed once.
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
const K=load(S+'world-r1/SkyFollowCore.ts');
const run=(name,f)=>{f();console.log('PASS',name);};
const sky=[];globalThis.__worldDayNight.skyFollow=(t,w)=>{sky.push(t?{t:[...t],w}:null);return 2;};
const lin=K.srgb8ToLinear;
const clearOf=m=>{const c=new Color(D.lakesideModeLighting(m).clearColor);return [c.r,c.g,c.b];};
// Real island dome / cloud vertex colours (room_no_original_chair.glb is Draco-compressed; decoded offline with DracoPy 2026-10-17):
// mean SRGBToLinear(COLOR_0) — the runtime reads the same stream from the imported mesh (backdropAverage).
const REAL={env_sky_dome:{count:1376,avg:[0.0247,0.142,0.2784]},env_cloud_layer:{count:16292,avg:[0.5138,0.5832,0.6169]}};
run('pure: w=0 is exactly the island base (day 1, night tint); w=1 maps the dome average onto the lakeside end clear (linear)',()=>{
 const avg=[0.2,0.4,0.8],night=[.18,.24,.46];
 assert.deepEqual(K.skyFollowColor([1,1,1],clearOf('day'),avg,0),[1,1,1]);assert.deepEqual(K.skyFollowColor(night,clearOf('night'),avg,0),night);assert.deepEqual(K.skyFollowColor(night,null,avg,1),night);
 for(const m of ['day','night']){const c=K.skyFollowColor([1,1,1],clearOf(m),avg,1);for(let i=0;i<3;i++)assert(Math.abs(c[i]*avg[i]-lin(clearOf(m)[i]))<1e-9,m+' channel '+i);}
 // continuity at 60 Hz over the 7.8 s blend: no pop anywhere
 let prev=K.skyFollowColor([1,1,1],clearOf('day'),avg,0),maxStep=0;for(let i=1;i<=470;i++){const c=K.skyFollowColor([1,1,1],clearOf('day'),avg,i/470);maxStep=Math.max(maxStep,...c.map((v,k)=>Math.abs(v-prev[k])));prev=c;}assert(maxStep<0.01,'per-frame step '+maxStep);});
run('real island dome / cloud vertex colours: the day/night gains stay inside the clamp (no saturation); colour stream averaging',()=>{
 for(const [name,{avg}] of Object.entries(REAL)){for(const m of ['day','night'])for(let i=0;i<3;i++){const g=lin(clearOf(m)[i])/avg[i];assert(g>0&&g<K.SKY_FOLLOW_MAX_GAIN,name+' '+m+' gain '+g);}
  console.log('  '+name+' -> day gain '+clearOf('day').map((c,i)=>(lin(c)/avg[i]).toFixed(2)).join('/')+', night gain '+clearOf('night').map((c,i)=>(lin(c)/avg[i]).toFixed(2)).join('/'));}
 const f=K.vertexColorAverageLinear([1,0,0.5,0.5,1,0],3,false);assert(Math.abs(f[0]-(1+K.srgbToLinear(.5))/2)<1e-12);assert.deepEqual(K.vertexColorAverageLinear(null,3),[1,1,1]);
 const u=K.vertexColorAverageLinear(new Uint8Array([255,255,255,255]),4,true);assert(u.every(v=>Math.abs(v-1)<1e-12));});
// journey: the lighting drives skyFollow with the blend weight and the CURRENT mode's lakeside clear
let J=Lt.lakesideJourneyAtmosphere(camera,()=>-0.58);
run('prime / w=0: the dome is never touched (island look, no pop at the start)',()=>{J.prime();J.apply(0);assert.equal(sky.length,0);});
run('blend: target = lakeside DAY end clear (28/143/184), w = blend weight; repeated identical frames are not re-sent',()=>{J.apply(0.25);J.apply(0.25);J.apply(1);assert.equal(sky.length,2);assert.deepEqual(sky[0],{t:clearOf('day'),w:0.25});assert.deepEqual(sky[1],{t:[28,143,184],w:1});});
run('toggle in lakeside: the dome follows the NIGHT lakeside clear, then back to day',()=>{globalThis.__worldDayNight.toggle();assert.deepEqual(sky.at(-1),{t:clearOf('night'),w:1});globalThis.__worldDayNight.toggle();assert.deepEqual(sky.at(-1),{t:clearOf('day'),w:1});});
run('leave: exactly one restore (null) and nothing after; a second restore does nothing',()=>{const n=sky.length;J.restore();assert.equal(sky.length,n+1);assert.equal(sky.at(-1),null);J.restore();globalThis.__worldDayNight.toggle();globalThis.__worldDayNight.toggle();assert.equal(sky.length,n+1);});
run('journey at night: target is the night clear from the first blended frame',()=>{globalThis.__worldDayNight.toggle();J=Lt.lakesideJourneyAtmosphere(camera,()=>-0.58);J.prime();J.apply(0.5);assert.deepEqual(sky.at(-1),{t:clearOf('night'),w:0.5});J.restore();assert.equal(sky.at(-1),null);globalThis.__worldDayNight.toggle();});
run('wiring: WorldFlowComponent moves only the existing dome/cloud instances (no node, no renderer, no pass) and exposes skyFollow',()=>{
 const w=fs.readFileSync(S+'world-r1/WorldFlowComponent.ts','utf8'),b=w.slice(w.indexOf('function bindUnlitBackdrop'),w.indexOf('/** Add to a NEW, identity scene-root sibling'));
 assert.match(w,/skyFollow:\(target:readonly number\[\]\|null,w:number\)=>self\.skyFollow\(target,w\)/);assert.match(b,/const follows=name==='env_sky_dome'\|\|name==='env_cloud_layer'/);
 assert.doesNotMatch(b,/new Node|addComponent|overridePipelineStates|new Material/,'no new draw / pass');assert.match(b,/if\(follow\)\{if\(value!==last\)\{last=value;try\{followWrite\(\);\}/,'a toggle during the follow re-bases the blend instead of snapping to the island look');});
