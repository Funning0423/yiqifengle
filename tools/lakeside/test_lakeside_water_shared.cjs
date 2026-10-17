// r4 (VB): ONE source for the lakeside water + reflected-sky values (LakesideSceneData LAKESIDE_WATER_SKY), read by the board
// background's lake AND the island->lakeside journey's lake through the one writer applyLakesideWaterUniforms (LakesideWaterUniforms.ts).
// Locks: (1) the writer puts exactly lakesideWaterUniforms(mode) = LAKESIDE_WATER_SKY on the material, day and night; (2) both paths use
// it (board: applyDir + shadeLakesideWater; journey: shadeLakesideWater + show + day/night toggle); (3) no other file writes a water uniform
// or holds a water number.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
class Vec4{constructor(x=0,y=0,z=0,w=0){Object.assign(this,{x,y,z,w});}}
const cc={Vec4},cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
 vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,spec=>spec==='cc'?cc:load(path.resolve(path.dirname(file),spec)+'.ts'),m);return m.exports;}
const D=load(S+'region/LakesideSceneData.ts'),WU=load(S+'region/LakesideWaterUniforms.ts'),W=D.LAKESIDE_WATER_SKY;
const run=(n,f)=>{f();console.log('PASS',n);};
run('writer = lakesideWaterUniforms(mode) = LAKESIDE_WATER_SKY, day and night',()=>{
 for(const mode of ['day','night']){const got={};WU.applyLakesideWaterUniforms({setProperty:(k,v)=>{assert(v instanceof Vec4,k+' as Vec4');got[k]=[v.x,v.y,v.z,v.w];}},mode);
  const U=D.lakesideWaterUniforms(mode),M=W[mode],Sh=W.shared;assert.deepEqual(Object.keys(got).sort(),[...D.LAKESIDE_WATER_UNIFORM_NAMES].sort(),mode+' all 8 uniforms');
  for(const k of D.LAKESIDE_WATER_UNIFORM_NAMES)assert.deepEqual(got[k],U[k],mode+' '+k);
  assert.deepEqual(got.waterTint,[...M.tintLinear,1]);assert.deepEqual(got.skyZenith,[...M.sky.zenithLinear,1]);assert.deepEqual(got.skyLow,[...M.sky.lowLinear,1]);assert.deepEqual(got.skyHorizon,[...M.sky.horizonLinear,1]);
  assert.deepEqual(got.fresnelParams,[Sh.fresnelPower,Sh.fresnelF0,Sh.fresnelMax,M.skyStrength]);assert.deepEqual(got.specParams,[Sh.specExponent,Sh.specIntensity,Sh.specNoise,M.skyReflectFloor]);
  assert.deepEqual(got.waveParams,[Sh.waveTilt,Sh.waveFreq,Sh.waveSpeed,0]);assert.deepEqual(got.lightParams,[M.mainLightScale,M.ambientScale,Sh.waveFadeStart,Sh.waveFadeEnd]);}
 assert.equal(WU.isLakesideWaterGlb('LK_lake.glb'),true);assert.equal(WU.isLakesideWaterGlb('LK_terrain.glb'),false);});
const bg=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8'),ad=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
run('board and journey reach the lake through the same writer',()=>{
 assert(/if\(waterMat\)applyLakesideWaterUniforms\(waterMat,mode\);/.test(bg),'board applyDir (every light apply / toggle)');
 assert(/const water=new Material\(\);water\.copy\(waterAsset\);applyLakesideWaterUniforms\(water,lakesideDayNightMode\(\)\);/.test(bg),'shadeLakesideWater = the one copy+uniforms path');
 assert(/shadeLakesideWater\(scenery,waterAsset,'board'\)/.test(bg),'board lake');
 assert(/shadeLakesideWater\(model,await loadLakesideWater\(token,take\),'journey'\)/.test(ad),'journey lake: same material asset, same path');
 assert(/offWater=onDayNightChange\(\(\)=>\{if\(!dead&&water\)applyLakesideWaterUniforms\(water,lakesideDayNightMode\(\)\);\}\);/.test(ad),'journey lake follows the day/night toggle');
 assert(/if\(visible\)\{atmosphere\.prime\(\);if\(water\)applyLakesideWaterUniforms\(water,lakesideDayNightMode\(\)\);\}/.test(ad),'journey lake re-applied when shown');
 assert(/owned\.push\(sh\.water\)/.test(ad),'journey water copy destroyed with the journey lease');});
run('no second source: no water uniform writes or water numbers anywhere else',()=>{
 const files=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.ts'))files.push(p);}};walk(S);
 const UNI=/setProperty\(\s*'(waterTint|skyZenith|skyLow|skyHorizon|fresnelParams|specParams|waveParams|lightParams)'/,OLD=/\bwater(TintLinear|Sky\w+|MainLightScale|AmbientScale|Fresnel\w+|Spec\w+|Wave\w+|Glbs|MaterialPath)\b/;
 for(const f of files){const src=fs.readFileSync(f,'utf8'),rel=path.relative(S,f);
  if(rel!==path.join('region','LakesideWaterUniforms.ts'))assert(!UNI.test(src),rel+' writes a water uniform outside applyLakesideWaterUniforms');
  assert(!OLD.test(src),rel+' still holds a pre-r4 water param name');}
 const sd=fs.readFileSync(S+'region/LakesideSceneData.ts','utf8');assert.equal((sd.match(/export const LAKESIDE_WATER_SKY\b/g)||[]).length,1);});
console.log('lakeside water shared source OK');
