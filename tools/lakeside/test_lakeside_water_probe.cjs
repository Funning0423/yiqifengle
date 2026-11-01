// r4.2 item 4 (Mac r4 fault injection, only region_lakeside/import/0e/0e32e8040.json blocked = the lakeside-water Material+Effect
// pack): B-class was +2 deduplicated (+6 raw) instead of exactly +1: next to [QF_LAKE] journey-water-fallback, every bundle.load of
// the water (journey 3, board 2) made the engine pack manager console.error 'download failed …'. Now the water pack is probed via
// assetManager.downloader.download (no engine log) and bundle.load is never called for it once the probe failed, so the fallback
// line is the only error. Real LakesideBoardBackground (+ the journey's real fallback logger) on a fake cc.
const assert=require('node:assert/strict');
const {createLakesideFake}=require('./lakeside-lease-fake.cjs');
const run=async(n,f)=>{await f();console.log('PASS',n);};
const PACK={uuid:'0e32e8040',packedUuids:['water-mtl','water-effect'],ext:'.json'};
function fake(download){
 const engineErrors=[];
 const F=createLakesideFake({infoWithPath:()=>({uuid:'water-mtl'}),assetInfo:u=>u==='water-mtl'?{packs:[PACK]}:null,download,
  materialLoad:(p,cb)=>{if(download===FAIL){engineErrors.push('download failed: assets/region_lakeside/import/0e/0e32e8040.json, status: 0(error)');cb(Error('download failed'));}else cb(null,new (F.cc.Material)());}});
 F.setMode('day');return {F,engineErrors};}
const FAIL=(id,url,type,o,cb)=>setImmediate(()=>cb(Error('download failed: '+url+', status: 0(error)'))),OK=(id,url,type,o,cb)=>setImmediate(()=>cb(null,{}));
async function flow(download){
 const {F,engineErrors}=fake(download);const B=F.load(F.S+'region/LakesideBoardBackground.ts'),Wt=F.load(F.S+'region/LakesideJourneyWater.ts'),W=F.load(F.S+'world-r1/WorldFlowCore.ts');
 const errors=[];const keep=console.error;console.error=(...a)=>errors.push(a.join(' '));
 try{
  await B.prewarmLakesideAssets();                                   // chapter page
  let water=null;try{water=await B.loadLakesideWaterAsset(new W.Cancellation(),a=>a);}catch(e){Wt.logLakesideJourneyWaterFallback(e);} // journey (its catch)
  const p=B.preloadLakesideBoard();await F.flushFrames();await p;      // board preload at w>=0.9
  const host=new F.Node('host');F.scene.addChild(host);const lease=await B.createLakesideBoardBackground({parent:host,selection:{stageId:'r04-lake-01'},token:new W.Cancellation()});
  const direct=await B.createLakesideBoardBackground({parent:host,selection:{stageId:'r04-lake-01'},token:new W.Cancellation()}); // a direct build too
  lease.dispose();direct.dispose();B.releaseLakesidePrewarm();
  return {F,water,errors:errors.concat(engineErrors),diag:lease.diagnostics()};}
 finally{console.error=keep;}}
(async()=>{
 await run('water pack blocked: exactly ONE B-class error (journey-water-fallback), no bundle.load of the water anywhere, journey+board fall back',async()=>{
  const r=await flow(FAIL);
  assert.equal(r.errors.length,1,JSON.stringify(r.errors));assert.match(r.errors[0],/^\[QF_LAKE\] \{"event":"journey-water-fallback"/);assert.match(r.errors[0],/lakeside-water-pack-unavailable/);
  assert.equal(r.F.log.materialLoads,0,'no engine load of the failed pack');assert.equal(r.water,null);
  assert(r.F.log.downloads.length>=1&&r.F.log.downloads.every(d=>d.id===PACK.uuid&&d.type==='.json'&&d.url==='remote/region_lakeside/0e32e8040.json'),JSON.stringify(r.F.log.downloads));
  assert.equal(r.F.log.downloads.length,1,'one probe shared by prewarm, journey, preload and board within the TTL');});
 await run('water pack fine: the material loads as before on every path; no error',async()=>{
  const r=await flow(OK);assert.deepEqual(r.errors,[]);assert(r.water,'journey water');assert(r.F.log.materialLoads>=3,'prewarm, journey, board load the water ('+r.F.log.materialLoads+')');});
 await run('not packed / no downloader API: unknown → the normal load (no behaviour change)',async()=>{
  const F=createLakesideFake({infoWithPath:()=>({uuid:'water-mtl'}),assetInfo:()=>({})});F.setMode('day');const B=F.load(F.S+'region/LakesideBoardBackground.ts');
  const bundle={getInfoWithPath:()=>({uuid:'x'}),getAssetInfo:()=>({}),name:'region_lakeside'};assert.equal((await B.probeLakesideWaterPack(bundle)).state,'unknown');
  const W=F.load(F.S+'world-r1/WorldFlowCore.ts');assert(await B.loadLakesideWaterAsset(new W.Cancellation(),a=>a));assert.equal(F.log.materialLoads,1);assert.equal(F.log.downloads.length,0);});
 await run('a failed probe is retried after the TTL (a recovered network loads the water again)',async()=>{
  let fail=true;const F=createLakesideFake({infoWithPath:()=>({uuid:'water-mtl'}),assetInfo:()=>({packs:[PACK]}),download:(i,u,t,o,cb)=>setImmediate(()=>cb(fail?Error('x'):null,{}))});
  const B=F.load(F.S+'region/LakesideBoardBackground.ts');const bundle={getInfoWithPath:()=>({uuid:'water-mtl'}),getAssetInfo:()=>({packs:[PACK]}),name:'region_lakeside'};
  assert.equal((await B.probeLakesideWaterPack(bundle)).state,'failed');fail=false;assert.equal((await B.probeLakesideWaterPack(bundle)).state,'failed','memoized');
  const now=Date.now;Date.now=()=>now()+B.LAKESIDE_WATER_PROBE_TTL_MS+1;try{assert.equal((await B.probeLakesideWaterPack(bundle)).state,'ok');}finally{Date.now=now;}});
})().catch(e=>{console.error(e);process.exit(1);});
