// r4-prep D (lead): the journey end and the board use ONE sky and water parameter source. Water: both take their own copy of
// lakeside-water.mtl written only by lakesideWaterMaterial (LAKESIDE_DIR_LIGHT_PARAMS) + applyLakesideWaterMode (lakesideModeLighting),
// so whatever Voice Bot sets there shows on both sides of the swap (no values chosen here). Sky: see lakeside-far-view (the island
// props fade out, the sky is the camera clear colour, which both take from lakesideModeLighting(mode).clearColor).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
class Vec4{constructor(x=0,y=0,z=0,w=0){Object.assign(this,{x,y,z,w});}}
let copies=0;
class Material{constructor(){this.props={};this.src=null;}copy(a){this.src=a;copies++;}setProperty(k,v){this.props[k]=[v.x,v.y,v.z,v.w];}}
const cc=new Proxy({Vec4,Material,isValid:o=>!!o,gfx:{}},{get:(t,k)=>k in t?t[k]:class{static ProjectionType={};static FOVAxis={};static ClearFlag={};}});
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
 const req=spec=>spec==='cc'?cc:spec==='cc/env'?{DEBUG:false}:spec.endsWith('.js')?require(path.resolve(path.dirname(file),spec)):load(path.resolve(path.dirname(file),spec)+'.ts');
 vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,req,m);return m.exports;}
const B=load(S+'region/LakesideBoardBackground.ts'),D=load(S+'region/LakesideSceneData.ts');
const P=D.LAKESIDE_DIR_LIGHT_PARAMS,run=(n,f)=>{f();console.log('PASS',n);};
const asset={name:'lakeside-water.mtl'};
run('one source: two copies (journey, board) carry identical params straight from LAKESIDE_DIR_LIGHT_PARAMS, asset untouched',()=>{
 const j=B.lakesideWaterMaterial(asset),b=B.lakesideWaterMaterial(asset);assert.equal(copies,2);assert.equal(j.src,asset);assert.notEqual(j,b);assert.deepEqual(j.props,b.props);
 assert.deepEqual(j.props.waterTint,[...P.waterTintLinear,1]);assert.deepEqual(j.props.skyZenith,[...P.waterSkyZenithLinear,1]);assert.deepEqual(j.props.skyLow,[...P.waterSkyLowLinear,1]);assert.deepEqual(j.props.skyHorizon,[...P.waterSkyHorizonLinear,1]);
 assert.deepEqual(j.props.specParams,[P.waterSpecExponent,P.waterSpecIntensity,P.waterSpecNoise,P.waterSkyReflectFloor]);assert.deepEqual(j.props.waveParams,[P.waterWaveTilt,P.waterWaveFreq,P.waterWaveSpeed,0]);
 assert.equal(Object.keys(asset).length,1);});
run('day/night: applyLakesideWaterMode writes lakesideModeLighting(mode) on either copy, identically',()=>{
 for(const m of ['day','night']){const M=D.lakesideModeLighting(m),j=B.lakesideWaterMaterial(asset),b=B.lakesideWaterMaterial(asset);B.applyLakesideWaterMode(j,m);B.applyLakesideWaterMode(b,m);
  assert.deepEqual(j.props,b.props);assert.deepEqual(j.props.lightParams,[M.waterMainLightScale,M.waterAmbientScale,P.waterWaveFadeStart,P.waterWaveFadeEnd]);
  assert.deepEqual(j.props.fresnelParams,[P.waterFresnelPower,P.waterFresnelF0,P.waterFresnelMax,M.waterSkyStrength]);}});
run('wiring: board and journey both use the helpers; journey follows the toggle, frees its copy and listener once',()=>{
 const bg=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8'),ja=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
 assert.match(bg,/water=lakesideWaterMaterial\(waterAsset\)/);assert.match(bg,/if\(waterMat\)applyLakesideWaterMode\(waterMat,mode\);/);
 assert.doesNotMatch(bg.slice(bg.indexOf('export const createLakesideBoardBackground')),/setProperty\('(waterTint|lightParams|fresnelParams)'/,'no second writer in the board');
 assert.match(ja,/waterAsset=await loadLakesideWaterAsset\(token,take\)/);assert.match(ja,/const water=lakesideWaterMaterial\(waterAsset\);owned\.push\(water\);applyLakesideWaterMode\(water,lakesideDayNightMode\(\)\);useLakesideWater\(model,water\);/);
 assert.match(ja,/offWater=onDayNightChange\(\(\)=>\{if\(!dead\)applyLakesideWaterMode\(water,lakesideDayNightMode\(\)\);\}\);/);assert.match(ja,/const release=\(\)=>\{if\(dead\)return;dead=true;offWater\(\);/);
 assert.doesNotMatch(ja,/setProperty\('(waterTint|lightParams|fresnelParams)'/,'journey writes nothing of its own');
 assert.match(bg,/export function useLakesideWater\(root:Node,water:Material\):number\{let n=0;\n for\(const child of root\.children\)if\(isLakesideWaterNode\(child\)\)/);});
