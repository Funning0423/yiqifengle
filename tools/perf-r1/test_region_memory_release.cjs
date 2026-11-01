'use strict';
/** perf-r1 item 3 gate: after a region round-trip (island→meadow→skycity→meadow→island-like) memory returns near the
 *  baseline, a released region reloads correctly on return, mounted/target/preload regions are never released, and a
 *  negative case (no release) shows memory growing past the bound. Mock host models bundle cache + GPU bytes. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const full=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/RegionLoader.ts'),'utf8');const src=full.slice(full.indexOf('/* ===== perf-r1 #3 region asset release ===== */'));
assert.ok(!/unlink|rmSync|removeSync|deleteFile|fs\./.test(src),'never deletes content files');
const js=ts.transpileModule('const assetManager=null;'+src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
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
console.log(`PASS region-memory-release round-trip delta=${on.h.mem-on.base} (negative ${off.h.mem-off.base}), reload on return, keep target/preload/mounted`);
