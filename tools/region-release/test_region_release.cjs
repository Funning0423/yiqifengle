// P0 fin gate: regions she has left (meadow, sail) are released by refcount only, after the exit transition, after their nodes are
// destroyed, one drawn frame later; island / skycity / balloon never. Simulated engine refcount + live-node check, with mutant self-tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const coreSrc=fs.readFileSync(S+'region/RegionReleaseCore.ts','utf8');
const load=src=>{const m={exports:{}};new Function('module','exports',ts.transpileModule(src,{compilerOptions:{module:1,target:6}}).outputText)(m,m.exports);return m.exports;};
// ---- simulated engine: refcount + dependency cascade (Cocos releaseManager semantics: free at 0, then decRef deps) ----
function engine(){const freed=new Set(),nodes=[];
 const asset=(name,deps=[],bytes=1000)=>{const a={name,deps,bytes,refCount:0,addRef(){this.refCount++;},decRef(auto=true){this.refCount--;assert(this.refCount>=0,'refcount underflow '+name);if(auto&&this.refCount===0)free(this);}};for(const d of deps)d.refCount++;return a;};
 const free=a=>{freed.add(a);for(const d of a.deps)d.decRef(true);};
 const node=uses=>{const n={uses,alive:true,destroy(){this.alive=false;}};nodes.push(n);return n;};
 const referenced=a=>nodes.some(n=>n.alive&&n.uses.includes(a));
 const invariant=()=>{for(const a of freed)assert(!referenced(a),'GATE: freed asset still referenced by a live node: '+a.name);};
 return {asset,node,freed,referenced,invariant};}
async function scenario(lib,{transition=true,nodeAlive=false,destroyDuringFrame=false,reviveDuringFrame=false,region='meadow',hold=region}={}){
 const E=engine(),L=new lib.RegionReleaseLedger();const mesh1=E.asset('mesh1',[],4000),mesh2=E.asset('mesh2',[],6000),tex=E.asset('tex',[],2000);
 const prefab=E.asset('env_'+region,[mesh1,mesh2,tex],0);
 for(const a of [mesh1,mesh2,tex,prefab])L.hold(hold,a);L.hold(hold,prefab);// idempotent
 const n=E.node([prefab,mesh1]);if(!nodeAlive&&!destroyDuringFrame)n.destroy();
 let frames=0;const logs=[];
 const env={transitionDone:()=>transition,referenced:E.referenced,bytesEst:a=>a.bytes,log:l=>logs.push(l),
  nextFrame:async()=>{frames++;if(destroyDuringFrame)n.destroy();if(reviveDuringFrame)E.node([mesh2]);}};
 const r=await L.release(region,env);E.invariant();return {r,E,frames,logs,prefab,mesh1,mesh2,tex,L};}
async function gate(lib){
 // positive: everything met → released by refcount, one frame later, log line
 let s=await scenario(lib);assert.equal(s.r.reason,'released');assert.equal(s.frames,1,'waits one drawn frame');
 assert.equal(s.E.freed.size,4,'prefab + deps freed');assert.equal(s.r.bytesEst,12000);
 assert.deepEqual(JSON.parse(s.logs[0].replace('[QF_RELEASE] ','')),{region:'meadow',assets:4,bytesEst:12000});
 // someone else still holds a mesh → refcount keeps it
 {const E=engine(),L=new lib.RegionReleaseLedger(),m=E.asset('shared'),p=E.asset('p',[m]);L.hold('meadow',p);m.addRef();
  const r=await L.release('meadow',{transitionDone:()=>true,referenced:E.referenced,bytesEst:()=>0,log:()=>{},nextFrame:async()=>{}});
  assert.equal(r.reason,'released');assert(E.freed.has(p)&&!E.freed.has(m),'refcount only: a mesh another owner holds stays');}
 s=await scenario(lib,{transition:false});assert.equal(s.r.reason,'transition-pending');assert.equal(s.E.freed.size,0);assert.equal(s.frames,0);
 s=await scenario(lib,{nodeAlive:true});assert.equal(s.r.reason,'still-referenced');assert.equal(s.E.freed.size,0);
 s=await scenario(lib,{reviveDuringFrame:true});assert.equal(s.r.reason,'still-referenced','re-checked after the frame');assert.equal(s.E.freed.size,0);
 s=await scenario(lib,{destroyDuringFrame:true});assert.equal(s.r.reason,'still-referenced','nodes alive at request → not released this time');
 for(const region of ['island','skycity','balloon','lakeside']){s=await scenario(lib,{region});assert.equal(s.r.reason,'retained-region',region);assert.equal(s.E.freed.size,0,region);
  assert.equal(s.prefab.refCount,0,'retained regions are not even ref-tracked');}
 // a retained region's assets can never be freed through a releasable name either (ledger keyed by the loader's region)
 s=await scenario(lib,{region:'meadow',hold:'skycity'});assert.equal(s.r.reason,'nothing-held');assert.equal(s.E.freed.size,0);
 // release twice: second is a no-op (no double decRef)
 s=await scenario(lib);const again=await s.L.release('meadow',{transitionDone:()=>true,referenced:()=>false,bytesEst:()=>0,log:()=>{},nextFrame:async()=>{}});assert.equal(again.reason,'nothing-held');}
(async()=>{
 const lib=load(coreSrc);assert.deepEqual([...lib.RELEASABLE_REGIONS],['meadow','sail']);assert.deepEqual([...lib.RETAINED_REGIONS],['island','skycity','balloon','lakeside']);
 await gate(lib);console.log('PASS gate on the real RegionReleaseCore');
 // negative self-tests: each unsafe mutant must make the gate FAIL
 const mutants={
  'no transition check':coreSrc.replace("if(!env.transitionDone())return 'transition-pending';",''),
  'no node check':coreSrc.replace("for(const a of s)if(env.referenced(a))return 'still-referenced';",''),
  'no frame wait':coreSrc.replace('await env.nextFrame();',''),
  'no re-check after frame':coreSrc.replace('const again=check();if(again)return out(again);',''),
  'skycity releasable':coreSrc.replace("['meadow','sail']","['meadow','sail','skycity']").replace("['island','skycity','balloon','lakeside']","['island','balloon','lakeside']"),
  'forced release (ignores refcount)':coreSrc.replace('a.decRef(true);n++;','(a as any).refCount=1;a.decRef(true);n++;'),
 };
 for(const [name,src] of Object.entries(mutants)){assert.notEqual(src,coreSrc,'mutant applies: '+name);let failed=false;try{await gate(load(src));}catch{failed=true;}assert(failed,'self-test: gate must fail for mutant "'+name+'"');console.log('PASS self-test catches:',name);}
 // wiring (real sources)
 const rd=f=>fs.readFileSync(S+f,'utf8');const rr=rd('region/RegionRelease.ts'),sp=rd('region/SailPreload.ts'),rl=rd('region/RegionLoader.ts'),tv=rd('region/TransportVehicle.ts'),sa=rd('region/SailArt.ts'),bg=rd('region/LakesideBoardBackground.ts');
 assert.match(sp,/b\.load\(inf\.path,inf\.ctor,\(e:any,a:any\)=>\{if\(!e\)holdRegionAsset\('meadow',a\);r\(\);\}\)/,'meadow split assets held');
 assert.match(rl,/if\(def\.bundle==='region_meadow'\)holdRegionAsset\('meadow',prefab\);/,'meadow prefab held (only meadow)');
 for(const src of [tv,sa])assert.match(src,/else\{holdRegionAsset\('sail',p\);ok\(p as Prefab\);\}/,'sail prefab held');
 assert.match(bg,/void releaseLeftRegions\(\)/,'triggered once a lake board draws');
 assert.match(rr,/for\(const r of \['meadow','sail'\]\)\{if\(!transitionDone\(\)\)break;/);
 assert.match(rr,/return j\.phase==='arrived'&&j\.region==='lakeside'&&!j\.target&&wipeClear;/,'transition done = arrived at the lake, no target, WindWipe clear');
 assert.match(rr,/director\.once\(Director\.EVENT_AFTER_DRAW,go\)/,'drawn-frame wait');
 const all=fs.readdirSync(S+'region').filter(f=>f.endsWith('.ts')).map(f=>rd('region/'+f)).join('\n');
 assert(!/assetManager\.(releaseAsset|removeBundle|releaseUnusedAssets)|\.releaseAll\(/.test(all),'no forced release anywhere in region/');
 console.log('region release gate OK');
})().catch(e=>{console.error(e);process.exit(1);});
