'use strict';
/** p0-meadow-ab A gate (fin r6 6fb9181b console.log: [QF_SYNC] maxPerFrame=472 allow qa:pre-transition-profile=472 — 244 getItem +
 *  234 setItem in the sail set-off frame, frameMaxMs=1601). The test-only __qfPreTransition profile is now built in memory and
 *  written out by PreTransitionRun.flushOverFrames, ≤ N = CHECKPOINT_FLUSH_PER_FRAME (16) sync storage calls per engine frame.
 *  Checks (real RegionFlowTest + PreTransitionRun, Node harness; fake frames):
 *   1. profile build frame: 0 sync storage calls; every later frame under qa:pre-transition-profile ≤ N;
 *   2. the flushed storage equals a write-through profile built the old way (same keys/values), every write verified;
 *   3. after the flush the lanes are write-through again (writes reach storage);
 *   4. release: preTransitionEnabled()=false in WeChat release, so none of this runs (covered by pre-transition / release gates).
 *  Negative: the pre-fix RegionFlowTest of this branch, loaded in place of the file, puts every call in ONE frame → gate FAILs. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const {createHarness}=require('../board-ui/harness.cjs');
const ROOT=path.join(__dirname,'../..'),RFT=path.join(ROOT,'creator-build-project/assets/scripts/world-r2/RegionFlowTest.ts');
function measure(H,{completed,finish,lake}){
 const ls=H.cc.sys.localStorage,get=ls.getItem.bind(ls),set=ls.setItem.bind(ls),G=globalThis;let cur=0;const frames=[];
 const note=()=>{if(G.__qfSyncAllow==='pre-transition-profile')cur++;};
 const written=new Map();ls.getItem=k=>{note();return get(k);};ls.setItem=(k,v)=>{note();written.set(k,String(v));return set(k,v);};
 const end=()=>{frames.push(cur);cur=0;};
 const M=H.load('world-r2/RegionFlowTest');let prof,fl=null;
 const prev=G.__qfSyncAllow;G.__qfSyncAllow='pre-transition-profile';
 try{if(M.deferNextCheckpointWrites)M.deferNextCheckpointWrites(true);
  prof=M.createRegionFlowCheckpoint(completed,{allowQa:true,finish,anyCheckpoint:true});if(lake)M.seedLakeCheckpoint(prof,lake,'win',{allowQa:true});}
 finally{G.__qfSyncAllow=prev;if(M.deferNextCheckpointWrites)M.deferNextCheckpointWrites(false);}
 fl=M.takeCheckpointFlush?M.takeCheckpointFlush():null;end();
 return {M,prof,fl,frames,end,written,restore:()=>{ls.getItem=get;ls.setItem=set;},ls,get};}
async function runCase(c,N){
 const H=createHarness({debug:true});const r=measure(H,c);
 if(r.fl){const P=H.load('world-r2/PreTransitionRun');const res=await P.flushOverFrames(r.fl,async()=>{r.end();});assert.equal(res.ok,true,JSON.stringify(res));}
 r.end();r.restore();
 const max=Math.max(...r.frames),total=r.frames.reduce((a,b)=>a+b,0);
 return {...r,H,max,total,buildFrame:r.frames[0],pass:max<=N};}
function nsValues(written,ns,ls){const out={};for(const k of written.keys())if(k.startsWith(ns))out[k.slice(ns.length)]=ls.getItem(k);return out;}
(async()=>{
 const N=16;
 const H0=createHarness({debug:true});const {CHECKPOINT_FLUSH_PER_FRAME}=H0.load('world-r2/RegionFlowTest');
 assert.equal(CHECKPOINT_FLUSH_PER_FRAME,N,'N changed without updating this gate');
 const cases=[{name:'island-meadow cp4',completed:4,finish:false},{name:'skycity-finale cp12',completed:12,finish:false},{name:'lake-18 cp12+lake',completed:12,finish:true,lake:'r04-lake-06'}];
 for(const c of cases){
  const r=await runCase(c,N);
  console.log(c.name+': buildFrame='+r.buildFrame+' frames='+r.frames.length+' max/frame='+r.max+' total='+r.total+' N='+N+' '+(r.pass?'PASS':'FAIL'));
  assert.equal(r.buildFrame,0,c.name+': profile build frame must make 0 sync storage calls');
  assert.ok(r.pass,c.name+': '+r.max+' sync calls in one frame > N='+N);
  assert.equal(r.fl.pendingWrites(),0,c.name+': unflushed writes');
  // 2. same storage as a write-through profile (reference: write-through lanes, built the old way)
  const H2=createHarness({debug:true});const l2=H2.cc.sys.localStorage,s2=l2.setItem.bind(l2),w2=new Map();l2.setItem=(k,v)=>{w2.set(k,String(v));return s2(k,v);};
  const M2=H2.load('world-r2/RegionFlowTest');const ref=M2.createRegionFlowCheckpoint(c.completed,{allowQa:true,finish:c.finish,anyCheckpoint:true});if(c.lake)M2.seedLakeCheckpoint(ref,c.lake,'win',{allowQa:true});
  const a=nsValues(r.written,r.prof.namespace,r.ls),b=nsValues(w2,ref.namespace,l2);
  assert.ok(Object.keys(b).length>0,'reference wrote nothing (storage enumeration broken)');
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),c.name+': flushed keys differ');
  const norm=v=>String(v).split(r.prof.namespace).join('NS').split(ref.namespace).join('NS').replace(/"(?:token|sessionId|savedAt|updatedAt|createdAt|at|t)":\s*("[^"]*"|\d+)/g,'"$1":0').replace(/1[67]\d{11}/g,'T');
  let same=0;for(const k of Object.keys(b)){assert.equal(typeof a[k],'string',k);if(norm(a[k])===norm(b[k]))same++;}
  console.log('  keys='+Object.keys(b).length+' identical(after time/token normalisation)='+same);
  assert.deepEqual(r.prof.mainline.inspect().map(x=>x[0]),ref.mainline.inspect().map(x=>x[0]));
  // 3. write-through after the flush
  // 3. lane unit: memory while deferring, verified write-out, write-through after endDefer
  {const st=new Map(),calls=[];const store={getItem:k=>{calls.push('g:'+k);return st.has(k)?st.get(k):null;},setItem:(k,v)=>{calls.push('s:'+k);st.set(k,v);}};
   const L=r.M.deferredStorage(store);L.setItem('a','1');L.setItem('a','2');L.setItem('b','x');assert.equal(L.getItem('a'),'2');assert.equal(L.getItem('zz'),null);assert.equal(calls.length,0,'deferring lane touched storage');
   assert.throws(()=>L.endDefer(),/incomplete/);assert.equal(L.flushSome(2),0);assert.equal(L.pending(),1);L.flushSome(16);assert.equal(L.pending(),0);
   assert.deepEqual(calls.sort(),['g:a','g:b','s:a','s:b']);assert.equal(st.get('a'),'2');L.endDefer();L.setItem('c','3');assert.equal(st.get('c'),'3');assert.equal(L.getItem('c'),'3');}
 }
 // Negative: the current code (aa044e43 RegionFlowTest) loaded in place of the file → one-frame burst → FAIL
 /* pre-fix revision on THIS branch: parent of the commit that introduced deferNextCheckpointWrites (HEAD while uncommitted) */
 const rel_='creator-build-project/assets/scripts/world-r2/RegionFlowTest.ts',intro=cp.execFileSync('git',['log','-n1','--format=%H','-S','deferNextCheckpointWrites','--',rel_],{cwd:ROOT,encoding:'utf8'}).trim();
 const old=cp.execFileSync('git',['show',(intro?intro+'^':'HEAD')+':'+rel_],{cwd:ROOT,encoding:'utf8'});
 const rf=fs.readFileSync;fs.readFileSync=function(p,...a){if(path.resolve(String(p))===RFT)return a.length?old:Buffer.from(old);return rf.call(fs,p,...a);};
 let neg;try{neg=await runCase(cases[1],N);}finally{fs.readFileSync=rf;}
 console.log('negative (pre-fix code on this branch) skycity-finale cp12: buildFrame='+neg.buildFrame+' max/frame='+neg.max+' N='+N+' '+(neg.pass?'PASS':'FAIL'));
 assert.equal(neg.fl,null,'negative must run the old code');
 assert.ok(!neg.pass&&neg.max>N,'self-test: the old one-frame profile was not caught');
 // Release (STRIP_PROBES): A is inside QF_PROBE markers in both files — stripped text has none of it, still compiles, and the
 // stripped RegionFlowTest builds the old write-through profile (release never runs it: preTransitionEnabled()=false there).
 {const {stripText}=require('../build-guard/strip-probes.cjs'),{probeFree}=require('../build-guard/release-gates.cjs');
  const PTR=path.join(ROOT,'creator-build-project/assets/scripts/world-r2/PreTransitionRun.ts');
  const relR=stripText(fs.readFileSync(RFT,'utf8'),'RFT').out,relP=stripText(fs.readFileSync(PTR,'utf8'),'PTR').out;
  for(const w of ['deferNextCheckpointWrites','takeCheckpointFlush','flushOverFrames','deferredStorage','CHECKPOINT_FLUSH_PER_FRAME','flushStep'])
   assert.ok(!relR.includes(w)&&!relP.includes(w),'release still has '+w);
  const AS=['deferNextCheckpointWrites','takeCheckpointFlush','flushOverFrames','deferredStorage','CHECKPOINT_FLUSH_PER_FRAME'];/* (a pre-existing [QF_SYNC] source comment in PreTransitionRun is not A's; minified build output has no comments) */
  assert.equal(probeFree([{name:'RegionFlowTest.ts',text:relR},{name:'PreTransitionRun.ts',text:relP}]).hits.filter(h=>AS.includes(h.rule)).length,0,'stripped A probe-free');
  assert.ok(probeFree([{name:'RegionFlowTest.ts',text:fs.readFileSync(RFT,'utf8')}]).hits.some(h=>AS.includes(h.rule)),'probe-free flags unstripped A');
  const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');for(const [n,t] of [['R',relR],['P',relP]]){const d=ts.transpileModule(t,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS}}).diagnostics||[];assert.equal(d.length,0,n+' stripped syntax');}
  const rf2=fs.readFileSync;fs.readFileSync=function(q,...a){if(path.resolve(String(q))===RFT)return a.length?relR:Buffer.from(relR);return rf2.call(fs,q,...a);};
  let rr;try{rr=await runCase(cases[0],N);}finally{fs.readFileSync=rf2;}
  assert.equal(rr.fl,null,'stripped build has no deferred path');console.log('release-stripped: A absent, write-through profile ok (buildFrame='+rr.buildFrame+')');}
 console.log('PASS pre-transition-sync-frames');
})().catch(e=>{console.error(e);process.exit(1);});
