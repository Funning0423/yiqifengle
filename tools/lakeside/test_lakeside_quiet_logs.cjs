// r4.2 item 3 (Mac r4 2153a65: backgrounding during the lakeside arrival printed an ERROR `[QF_LAKE] lakeside journey not reached:
// cancelled` (B-class +1 for a normal user action), and normal runs printed the info `journey-water-prewarm`). Now: a normal run
// (with __worldFlowLog on, as the Mac harness sets it) prints no [QF_LAKE] line at all; cancellation prints nothing; ERROR level is
// kept only for real failures (water fallback, prepare failure, lakeside fallback, land fill, ambience).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const run=async(n,f)=>{await f();console.log('PASS',n);};
function walk(d,out=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,out);else if(/\.(ts|js)$/.test(e.name))out.push(p);}return out;}
(async()=>{
 await run('no info/log/debug-level [QF_LAKE] line anywhere in the game scripts (only warn/error for real failures)',()=>{
  const hits=[];for(const f of walk(S)){const s=fs.readFileSync(f,'utf8');const re=/console\.(info|log|debug)\(\s*['"`]\[QF_LAKE\]/g;let m;while((m=re.exec(s)))hits.push(path.relative(S,f)+':'+m[1]);}
  assert.deepEqual(hits,[]);});
 await run('journey water prewarm (success, skip) prints nothing even with __worldFlowLog on; result kept for diagnostics',async()=>{
  class Node{constructor(n){this.name=n;this.children=[];this.comps=[];this.layer=1;}addChild(c){this.children.push(c);}setPosition(){}setScale(){}addComponent(C){const c=new C();this.comps.push(c);return c;}destroy(){this.dead=true;}}
  class MeshRenderer{setSharedMaterial(){}}
  const cc={Node,MeshRenderer,director:{once:(e,f)=>setImmediate(f)},isValid:o=>!!o&&!o.dead};
  const out=ts.transpileModule(fs.readFileSync(S+'region/LakesideJourneyWater.ts','utf8'),{compilerOptions:{module:1,target:7}}).outputText;const m={exports:{}};
  vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,s=>s==='cc'?cc:{LAKESIDE_BUNDLE:'region_lakeside',LAKESIDE_DIR_LIGHT_PARAMS:{waterMaterialPath:'x'}},m);
  const logs=[];const keep={info:console.info,log:console.log,warn:console.warn,error:console.error};for(const k of Object.keys(keep))console[k]=(...a)=>logs.push(k+' '+a.join(' '));
  globalThis.__worldFlowLog=true;
  try{const cam={node:new Node('cam'),near:.1},src={node:new Node('w'),mesh:{struct:{minPosition:{x:0,y:0,z:0},maxPosition:{x:10,y:1,z:10}}},sharedMaterials:[{}],shadowCastingMode:0,receiveShadow:false};
   const w=m.exports.prewarmLakesideWaterDraw(cam,{},src,{frames:2});assert.equal(await w.done,true);
   assert.equal(await m.exports.prewarmLakesideWaterDraw(cam,null,src).done,false);assert.equal(await m.exports.prewarmLakesideWaterDraw(null,{},src).done,false);}
  finally{Object.assign(console,keep);delete globalThis.__worldFlowLog;}
  assert.deepEqual(logs.filter(l=>l.includes('[QF_LAKE]')),[]);assert.equal(m.exports.lastLakesideWaterPrewarm.ok,true);});
 await run('cancellation logs nothing: soft journey stops in the composition, cancelled journey prepare',()=>{
  const comp=fs.readFileSync(S+'world-r2/WorldNativeComposition.ts','utf8'),ja=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
  assert.doesNotMatch(comp,/lakeside journey not reached/);
  assert.match(comp,/if\(region==='lakeside'&&!LAKESIDE_SOFT_REASONS\.includes\(String\(arrived\.reason\)\)\)return this\.lakesideFallback\('journey',arrived\.reason\);return arrived;/);
  assert.match(ja,/if\(!token\.cancelled&&\(error as any\)\?\.name!=='Cancelled'\)\{try\{console\.error\('\[QF_LAKE\] island→lakeside journey prepare failed: /);});
})().catch(e=>{console.error(e);process.exit(1);});
