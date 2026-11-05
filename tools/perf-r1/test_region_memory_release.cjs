'use strict';
/** perf-r1 item 3 gate: after a region round-trip (island→meadow→skycity→meadow→island-like) memory returns near the
 *  baseline, a released region reloads correctly on return, mounted/target/preload regions are never released, and a
 *  negative case (no release) shows memory growing past the bound. Mock host models bundle cache + GPU bytes. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const full=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/RegionLoader.ts'),'utf8');const src=full.slice(full.indexOf('/* ===== perf-r1 #3 region asset release ===== */'));
assert.ok(!/unlink|rmSync|removeSync|deleteFile|fs\./.test(src),'never deletes content files');
const js=ts.transpileModule('const assetManager=null;const isValid=(n)=>!!n&&!n.destroyed;'+src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const m={exports:{}};new Function('module','exports','console',js)(m,m.exports,{log(){},warn(){}});const R=m.exports;
const SIZE={region_meadow:40,region_skycity:30,region_lakeside:25};
function host(){const cache=new Map();let mem=0;return{get mem(){return mem},cache,
  load(n){if(!cache.has(n)){const b={name:n,loaded:true,releaseAll(){if(this.loaded){mem-=SIZE[n];this.loaded=false;}}};mem+=SIZE[n];cache.set(n,b);}return cache.get(n);},
  getBundle(n){return cache.get(n)||null},removeBundle(b){cache.delete(b.name)}};}
function trip(release){const h=host(),base=h.mem,mounted=new Set();const go=(t)=>{mounted.clear();if(SIZE['region_'+t])h.load('region_'+t);mounted.add(t);if(release)R.releaseRegionsExcept(t,{keep:[],mounted:r=>mounted.has(r)&&r!==t?true:false,host:h});};
  for(const t of ['island','meadow','skycity','lakeside','meadow','skycity','island'])go(t);return{h,base};}
const on=trip(true);assert.ok(on.h.mem-on.base<=0,`release: memory back to baseline on island (delta ${on.h.mem-on.base})`);
const off=trip(false);assert.ok(off.h.mem-off.base>40,'negative: without release memory stays grown ('+(off.h.mem-off.base)+')');
// return to a released region reloads (fresh bundle object, loaded)
{const h=host();const a=h.load('region_meadow');R.releaseRegionsExcept('skycity',{keep:[],mounted:()=>false,host:h});assert.equal(h.getBundle('region_meadow'),null);const b=h.load('region_meadow');assert.ok(b!==a&&b.loaded,'reload on return');}
// never target, preload keep, or mounted
assert.deepEqual(R.planRegionRelease('meadow',{keep:['skycity'],mounted:()=>false}),['lakeside']);
assert.deepEqual(R.planRegionRelease('island',{mounted:r=>r==='meadow'}),['skycity','lakeside'],'mounted (e.g. resume/board bg) kept');
assert.ok(!Object.values(R.REGION_RELEASE_BUNDLES).flat().some(n=>/static_seat_preview|transit|sail|board_art/.test(n)),'shared bundles never released');
// a throwing host never throws out
assert.deepEqual(R.releaseRegionsExcept('island',{keep:[],mounted:()=>false,host:{getBundle(){throw Error('x')},removeBundle(){}}}),[]);
// Grok Bot (a) key normalisation
assert.equal(R.regionKey('region_meadow'),'meadow');assert.equal(R.regionKey('Skycity'),'skycity');assert.equal(R.regionKey('static_seat_preview'),'');
assert.deepEqual(R.planRegionRelease('region_meadow',{keep:['region_skycity'],mounted:()=>false}),['lakeside'],'bundle-name keys match');
// (b)+(c) registry: a still-mounted (even inactive) root is never released; destroyed root frees it
{const h=host();h.load('region_meadow');const node={active:false};R.registerRegionRoot('region_meadow',node);
 assert.deepEqual(R.releaseRegionsExcept('skycity',{keep:[],host:h}),[],'negative: mounted meadow root (inactive) never released');assert.ok(h.getBundle('region_meadow').loaded);
 node.destroyed=true;assert.deepEqual(R.releaseRegionsExcept('skycity',{keep:[],host:h}),['region_meadow'],'destroyed root → released');}
// (c) round-trip island→meadow→skycity→meadow renders: region nodes present, their assets valid
{const h=host(),nodes={};const enter=(t)=>{for(const k of Object.keys(nodes))if(k!==t){nodes[k].destroyed=true;delete nodes[k];}
   if(SIZE['region_'+t]){const b=h.load('region_'+t);const n={bundle:b};R.registerRegionRoot(t,n);nodes[t]=n;}R.releaseRegionsExcept(t,{keep:[],host:h});};
 for(const t of ['island','meadow','skycity','meadow']){enter(t);for(const [k,n] of Object.entries(nodes))assert.ok(n.bundle.loaded&&h.getBundle('region_'+k)===n.bundle,`${t}: ${k} node present with valid assets`);}
 assert.ok(nodes.meadow&&!nodes.skycity,'back on meadow: meadow mounted');assert.equal(h.getBundle('region_skycity'),null,'skycity released after leaving');
 // negative: releasing while the node is still mounted would leave invalid assets (what the registry prevents)
 const bad=nodes.meadow.bundle;bad.releaseAll();assert.equal(bad.loaded,false,'negative model: forced release invalidates a live node');}
// (c) resumed save in each region loads from a cold cache (everything else released)
for(const t of ['meadow','skycity','lakeside']){const h=host();for(const r of Object.keys(SIZE))h.load(r);R.releaseRegionsExcept('island',{keep:[],mounted:()=>false,host:h});
 const b=h.load('region_'+t);assert.ok(b.loaded,'resume in '+t+' loads');}
console.log(`PASS region-memory-release round-trip delta=${on.h.mem-on.base} (negative ${off.h.mem-off.base}), reload on return, keep target/preload/mounted`);
