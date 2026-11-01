// journey-merge side branch (lead: apply if the Mac journey peak DC > 60): the island→lakeside journey copy of the r5h3 scene gets
// the board's instancing + static merge (water kept out), ?lakemerge=off keeps instancing only, and everything created is freed
// exactly once on leave / dispose / abandon / friendly fallback (all of them end in the lease's release()).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
function load(file){const m={exports:{}};const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
 vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,s=>{if(s==='cc')return {};return load(path.resolve(path.dirname(file),s)+'.ts');},m);return m.exports;}
const B=load(S+'region/LakesideJourneyBatching.ts'),SM=load(S+'region/LakesideStaticMerge.ts');
const checks=[];const pass=n=>{checks.push(n);console.log('PASS '+n);};
const mk=n=>({n,destroyed:0,destroy(){this.destroyed++;}});
function run(enabled){
 const log={instancing:0,merge:0,skipped:[]},mats=[mk('palette'),mk('rope')],meshes=[mk('chunk0'),mk('chunk1')];
 const model={children:[{name:'LK_water_01',water:true},{name:'LK_tree_01'}]};
 const b=B.applyLakesideJourneyBatching(model,{instancing:m=>{assert.equal(m,model);log.instancing++;return mats;},
  merge:(m,skip)=>{assert.equal(log.instancing,1,'merge runs after instancing');log.merge++;log.skipped=m.children.filter(skip).map(c=>c.name);return {meshes,stats:{chunks:2,pieces:430,vertices:58090,ms:1}};},
  mergeEnabled:()=>enabled,isWater:n=>!!n.water});
 return {b,log,mats,meshes};}
{const {b,log,mats,meshes}=run(true);
 assert.equal(log.instancing,1);assert.equal(log.merge,1);assert.deepEqual(log.skipped,['LK_water_01']);assert.equal(b.instancedMaterials,2);assert.equal(b.merged.chunks,2);
 assert([...mats,...meshes].every(x=>x.destroyed===0),'nothing freed while the journey runs');pass('merge applied on journey mount (after instancing, water skipped)');
 b.release();assert([...mats,...meshes].every(x=>x.destroyed===1),'merged meshes + instanced copies freed on leave');b.release();assert([...mats,...meshes].every(x=>x.destroyed===1),'freed exactly once');pass('freed on leave, exactly once');}
{const {b,log,mats,meshes}=run(false);assert.equal(log.instancing,1);assert.equal(log.merge,0);assert.equal(b.merged,null);assert(meshes.every(x=>x.destroyed===0));
 b.release();assert(mats.every(x=>x.destroyed===1));pass('?lakemerge=off: instancing only, no merge');}
{const mats=[mk('a')];assert.throws(()=>B.applyLakesideJourneyBatching({},{instancing:()=>mats,merge:()=>{throw Error('boom');},mergeEnabled:()=>true,isWater:()=>false}),/boom/);
 assert.equal(mats[0].destroyed,1);pass('a throw inside batching frees what it created');}
assert.equal(SM.lakesideStaticMergeEnabled('?lakemerge=off'),false);assert.equal(SM.lakesideStaticMergeEnabled(''),true);assert.equal(SM.lakesideStaticMergeEnabled(null),true);pass('off-switch parses ?lakemerge=off (default on)');
// wiring in the real adapter / board / core
const ad=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8'),bb=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8'),core=fs.readFileSync(S+'world-r1/RegionJourneyCore.ts','utf8'),flow=fs.readFileSync(S+'world-r1/WorldFlowCore.ts','utf8');
const prep=ad.slice(ad.indexOf('async function prepareLakesideJourney'));
assert(/await mountLakesideScenery\(model,token,take\);token\.check\(\);[\s\S]{0,300}batching=applyLakesideJourneyBatching\(model,\{instancing:enableLakesideInstancing,merge:mergeLakesideStatic,mergeEnabled:lakesideStaticMergeFromEnv,isWater:isLakesideWaterNode\}\)/.test(prep),'adapter batches right after the mount');
assert(/const release=\(\)=>\{if\(dead\)return;[^\n]*batching\?\.release\(\);batching=null;/.test(prep),'release() frees the batching');
assert(/dispose:release/.test(prep)&&/catch\(error\)\{[^\n]*release\(\);throw error;\}/.test(prep),'lease dispose + prepare failure use release()');
assert(/lakesideGlbOf\.set\(node,i\.glb\)/.test(bb)&&/export function isLakesideWaterNode/.test(bb),'water nodes tagged at mount');
assert(/returnToIsland\(\)[\s\S]{0,40}\{[^\n]*for\(const scene of this\.scenes\)scene\.dispose\(\)/.test(core)||/for\(const scene of this\.scenes\)scene\.dispose\(\);this\.scenes=\[\];this\.lease=null;this\.region='island'/.test(core),'leave disposes the journey scenes');
assert(/dispose\(\)\{[^\n]*for\(const scene of this\.scenes\)scene\.dispose\(\)/.test(core),'controller dispose disposes the scenes');
assert(/abandonLakesideJourney\(\)[\s\S]{0,400}j\.returnToIsland\(\)/.test(flow),'friendly fallback (abandonLakesideJourney) leaves through returnToIsland');
pass('wiring: mount → batch; leave / dispose / abandon / fallback → release');
console.log(JSON.stringify({test:'lakeside-journey-merge',status:'PASS',checks:checks.length}));
