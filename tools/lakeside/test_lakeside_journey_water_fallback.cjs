// r4 journey fix 1 (GGbot): the journey lake's water-material failure path is loud, not silent. loadLakesideWaterAsset rejects with the
// reason + asset path (it used to resolve null), the adapter catch logs one always-on [QF_LAKE] journey-water-fallback warn and keeps the
// old look (waterAsset=null, no throw); cancellation still propagates; the success path prints nothing.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
let bundleMode='ok',materialMode='fail';const loads=[];
class Material{constructor(){this.refs=0;}addRef(){this.refs++;}decRef(){this.refs--;}}
const bundle={load(p,T,cb){loads.push(p);setTimeout(()=>materialMode==='ok'?cb(null,new Material()):materialMode==='null'?cb(null,null):cb(Error('404 Not Found')),0);}};
const assetManager={loadBundle(name,cb){setTimeout(()=>bundleMode==='ok'?cb(null,bundle):cb(Error('bundle '+name+' unreachable')),0);}};
const cc=new Proxy({Material,assetManager,isValid:o=>!!o,gfx:{}},{get:(t,k)=>k in t?t[k]:class{static ProjectionType={};static FOVAxis={};static ClearFlag={};}});
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
 const req=spec=>spec==='cc'?cc:spec==='cc/env'?{DEBUG:false}:spec.endsWith('.js')?require(path.resolve(path.dirname(file),spec)):load(path.resolve(path.dirname(file),spec)+'.ts');
 vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,req,m);return m.exports;}
const B=load(S+'region/LakesideBoardBackground.ts'),W=load(S+'region/LakesideJourneyWater.ts'),D=load(S+'region/LakesideSceneData.ts'),F=load(S+'world-r1/WorldFlowCore.ts');
const P=D.LAKESIDE_DIR_LIGHT_PARAMS,held=[],take=a=>{a.addRef();held.push(a);return a;};
const capture=async f=>{const lines=[],w=console.warn;console.warn=(...a)=>lines.push(a.join(' '));try{return {r:await f(),lines};}finally{console.warn=w;}};
// the adapter's catch, verbatim semantics (also locked against the source below)
async function journeyWater(token){let waterAsset=null,dead=false;try{waterAsset=await B.loadLakesideWaterAsset(token,take);}catch(error){if(token.cancelled||dead)throw error;W.logLakesideJourneyWaterFallback(error);waterAsset=null;}token.check();return waterAsset;}
const tests=[];const t=(n,f)=>tests.push([n,f]);
t('material load fails → [QF_LAKE] warn with reason + asset path, old look (null), no throw',async()=>{
 materialMode='fail';const {r,lines}=await capture(()=>journeyWater(new F.Cancellation()));assert.equal(r,null);assert.equal(lines.length,1,lines.join('\n'));
 assert(lines[0].startsWith('[QF_LAKE] '));const j=JSON.parse(lines[0].slice(10));assert.equal(j.event,'journey-water-fallback');assert.equal(j.asset,P.waterMaterialPath);assert.equal(j.bundle,D.LAKESIDE_BUNDLE);
 assert.match(j.reason,/404 Not Found/);assert(j.reason.includes(P.waterMaterialPath),'reason names the path');assert.deepEqual(loads.slice(-1),[P.waterMaterialPath]);});
t('loader returns no asset → same warn (reason "no asset"), no throw',async()=>{materialMode='null';const {r,lines}=await capture(()=>journeyWater(new F.Cancellation()));assert.equal(r,null);assert.equal(lines.length,1);assert.match(JSON.parse(lines[0].slice(10)).reason,/no asset/);});
t('bundle fails → same warn with the bundle reason',async()=>{bundleMode='fail';try{const {r,lines}=await capture(()=>journeyWater(new F.Cancellation()));assert.equal(r,null);assert.equal(lines.length,1);assert.match(JSON.parse(lines[0].slice(10)).reason,/unreachable/);}finally{bundleMode='ok';}});
t('normal run: material loads → held, no [QF_LAKE] line',async()=>{materialMode='ok';const n=held.length;const {r,lines}=await capture(()=>journeyWater(new F.Cancellation()));assert(r instanceof Material);assert.equal(held.length,n+1);assert.equal(r.refs,1);assert.equal(lines.length,0);});
t('cancelled journey: rethrows, no fallback log',async()=>{materialMode='fail';const tok=new F.Cancellation();const p=capture(()=>journeyWater(tok).then(()=>'resolved',e=>'threw'));tok.cancel();const {r,lines}=await p;assert.equal(r,'threw');assert.equal(lines.length,0);});
t('logger never throws (console.warn throwing, odd errors)',async()=>{const w=console.warn;console.warn=()=>{throw Error('x');};try{assert.equal(W.logLakesideJourneyWaterFallback({get message(){throw Error('y');}}),'unknown');assert.equal(W.logLakesideJourneyWaterFallback(null),'null');}finally{console.warn=w;}});
t('wiring: the adapter catch logs + keeps the old look; the loader rejects instead of resolving null',async()=>{
 const ja=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8'),bg=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8');
 assert.match(ja,/try\{waterAsset=await loadLakesideWaterAsset\(token,take\);\}catch\(error\)\{if\(token\.cancelled\|\|dead\)throw error;logLakesideJourneyWaterFallback\(error\);waterAsset=null;\}token\.check\(\);/);
 assert.match(bg,/waitRegionAsset\(loadMaterialOrReason\(bundle,LAKESIDE_DIR_LIGHT_PARAMS\.waterMaterialPath\),token\);token\.check\(\);return take\(a\);\}/);});
(async()=>{let fail=0;for(const [n,f] of tests){try{await f();console.log('PASS',n);}catch(e){fail++;console.log('FAIL',n,'\n',e.stack||e);}}
 console.log(fail?'FAIL '+fail:'lakeside journey water fallback OK');process.exit(fail?1:0);})();
