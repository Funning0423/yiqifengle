#!/usr/bin/env node
'use strict';
/** chainL root fix: PersistentMainlinePort serves the isolated mainline namespace from a write-through cache.
 *  1. Hot path: 1000 journey getter reads (what isUnlocked does per stage per redraw) hit storage once per key.
 *  2. Golden: random op sequences incl. throwing and silently dropped writes — after EVERY op the cached read equals storage.
 *  3. Save semantics: the real mainline port on a cached vs raw storage, same writes through platform.save → identical storage
 *     bytes and identical journey snapshots. Negative self-tests: a read cache without write-through / without the post-write
 *     re-read is caught. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts');
const MainlinePort=require(path.join(S,'mainline-r1/adapter/mainline-port.js'));
const SRC=fs.readFileSync(path.join(S,'world-r2/PersistentMainlinePort.ts'),'utf8');
function load(src,ls){const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,console,require:s=>s==='cc'?{sys:{localStorage:ls}}:/mainline-port/.test(s)?MainlinePort:{}});return m.exports;}
function store(){const d=new Map();const o={reads:0,writes:0,fail:null,getItem(k){o.reads++;return d.has(k)?d.get(k):null;},setItem(k,v){o.writes++;if(o.fail==='throw')throw Error('quota');if(o.fail==='drop')return;d.set(k,String(v));},d};return o;}
function check(src){
 // 1. hot path
 {const ls=store();const M=load(src,ls);const port=M.createPersistentMainlinePort();ls.reads=0;
  for(let i=0;i<1000;i++){void port.journey.readOnly;void port.journey.records;}
  assert.ok(ls.reads<=8,'storage reads for 2000 journey getter reads: '+ls.reads);}
 // 2. golden random ops
 {let seed=7;const rnd=n=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed%n;};
  for(let run=0;run<40;run++){const raw=store();const M=load(src,raw);const c=M.writeThroughStorage(raw);const keys=['a','b','c'];
   for(let i=0;i<60;i++){const k=keys[rnd(3)],op=rnd(5);raw.fail=op===3?'throw':op===4?'drop':null;
    if(op===0)c.getItem(k);else{try{c.setItem(k,'v'+i);}catch{}}raw.fail=null;
    for(const kk of keys)assert.equal(c.getItem(kk),raw.d.has(kk)?raw.d.get(kk):null,'cache == storage after op '+i+' run '+run);
    if(rnd(7)===0)raw.d.set('ext','x');}}}
 // 3. save semantics vs raw port
 {const A=store(),B=store();const M=load(src,A);const pa=M.createPersistentMainlinePort();const ns='dot-mainline-r1-isolated-20261009:';
  const pb=MainlinePort.createPort({getItem:k=>B.getItem(ns+k),setItem:(k,v)=>B.setItem(ns+k,v)});
  const writes=[['forest-v33-journey',{v:1,records:[]}],['forest-v3-progress',{x:2}],['forest-v33-journey',{v:1,records:[{bestStars:3}]}],['forest-v3-completed',[1,2]]];
  for(const [k,v] of writes){pa.platform.save(k,v);pb.platform.save(k,v);
   assert.deepEqual([...A.d].sort(),[...B.d].sort(),'storage bytes identical after save '+k);
   assert.deepEqual(JSON.parse(JSON.stringify(pa.journeySnapshot())),JSON.parse(JSON.stringify(pb.journeySnapshot())),'journey snapshot identical after save '+k);
   assert.equal(JSON.stringify(pa.inspect()),JSON.stringify(MAIN_KEYS(B,ns)),'inspect() identical');}}}
const MAIN_KEYS=(B,ns)=>['forest-mainline-cocos-r1-active','forest-v33-journey','forest-v3-progress','forest-v3-completed'].map(k=>[k,B.d.has(ns+k)?B.d.get(ns+k):null]);
check(SRC);
let caught=0;const neg=(n,f)=>{let ok=false;try{f();}catch{ok=true;}assert.ok(ok,'self-test missed: '+n);caught++;};
neg('read cache without write-through (stale after save)',()=>check(SRC.replace("setItem(k:string,v:string){cache.delete(k);try{store.setItem(k,v);}finally{try{cache.set(k,store.getItem(k));}catch{cache.delete(k);}}},","setItem(k:string,v:string){store.setItem(k,v);},")));
neg('write-through that caches the intended value (silently dropped write reads back wrong)',()=>check(SRC.replace("finally{try{cache.set(k,store.getItem(k));}catch{cache.delete(k);}}","finally{cache.set(k,v);}")));
neg('pre-fix port (raw sys.localStorage, every getter hits storage)',()=>check(require('child_process').execFileSync('git',['show','b9fe8f39:creator-build-project/assets/scripts/world-r2/PersistentMainlinePort.ts'],{cwd:path.join(S,'../../..'),encoding:'utf8'})+"\nexport function writeThroughStorage(s:any){return s;}"));
console.log('PASS mainline-storage-cache self-tests='+caught);
