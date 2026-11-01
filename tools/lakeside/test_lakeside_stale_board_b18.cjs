'use strict';
// b18: an unfinished lake board saved under older rules (L13/L14/L15 draft-2026-10-16 from 02ee45fd, L16 draft-2026-10-16 from
// 7648e410^) is dropped alone on upgrade: the save stays writable, clears / other stages / other keys are untouched, a light notice
// is offered. Corrupt saves are still read-only protected.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),R=path.join(ROOT,'creator-build-project/assets/scripts/regional-r05/runtime');
const API=require(R+'/index.js'),Journal=require(R+'/progress-journal.js'),Host=require(R+'/campaign-host.js'),Provider=require(R+'/board-session-provider.js');
let n=0;const t=(m,f)=>{f();n++;console.log('PASS',m);};
const journey=()=>({readOnly:false,records:Array.from({length:12},()=>({bestStars:2}))});
const load=s=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/stale-board-'+s+'.json'),'utf8'));
const mem=entries=>{const m=new Map(entries);return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
const NOTICE='关卡已调整，从头开始';const Store=require(R+'/durable-store.js');
for(const id of ['r04-lake-01','r04-lake-02','r04-lake-03','r04-lake-04']){
 t(id+': old unfinished board dropped alone; save writable; clears and other keys intact; notice; replay of the stage starts fresh',()=>{
  Store.clearRepairs();const fx=load(id),store=mem(fx.storage),before=new Map(fx.storage),oldJ=JSON.parse(before.get(Journal.KEY)),stage=API.getStage(id);
  assert.notEqual(fx.made.contentRevision,stage.contentRevision,'fixture really is from older rules');
  assert(oldJ.openAttempt||before.get(Provider.KEY),'fixture has an unfinished board');
  const prov=new Provider({platform:Host.createStorage(store),journey:journey()});
  assert.equal(prov.readOnly,false);assert.equal(prov.progress.store.readOnly,false,JSON.stringify(prov.progress.store.error));assert.equal(prov.store.readOnly,false,JSON.stringify(prov.store.error));
  const s=prov.snapshot();assert.equal(s.error,null);assert(!s.active,'the old board is gone (not started)');
  assert.equal(s.notice.text,NOTICE);assert([...s.notice.text].length<=14);assert(s.notice.stageIds.includes(id));
  const nowJ=JSON.parse(store.m.get(Journal.KEY));assert.equal(nowJ.openAttempt,null);
  assert.deepEqual(nowJ.records,oldJ.records,'every clear kept');assert.deepEqual(nowJ.attempts,oldJ.attempts);assert.deepEqual(nowJ.claimedRegions,oldJ.claimedRegions);
  for(const k of ['forest-v33-journey','forest-v3-progress'])assert.equal(store.m.get(k),before.get(k),k+' untouched');
  assert.equal(JSON.parse(store.m.get(Provider.KEY)),null);
  for(const c of Object.keys(oldJ.records))assert.equal(prov.progress.isUnlocked(c),true,c);
  const r=prov.startStage(id,{seed:stage.seedBank[0]});assert(r.ok,JSON.stringify(r));
  Store.clearRepairs()/* = a restart: the pool is in memory only */;const again=new Provider({platform:Host.createStorage(store),journey:journey()});assert.equal(again.readOnly,false);assert.equal(again.snapshot().active.stageId,id);assert.equal(again.snapshot().notice,null,'notice only once');
 });}
t('corrupt saves stay read-only: broken record aggregate, and a stale board next to a broken record',()=>{
 for(const mut of [j=>{const k=Object.keys(j.records)[0]||'r04-lake-01';j.records[k]={bestStars:3,bestScore:1,bestMoves:1,clears:9,contentRevision:'x'};},j=>{j.records['r04-lake-05']={bestStars:3,bestScore:1,bestMoves:1,clears:1,contentRevision:'x'};}]){
  const fx=load('r04-lake-03'),m=new Map(fx.storage),j=JSON.parse(m.get(Journal.KEY));mut(j);m.set(Journal.KEY,JSON.stringify(j));
  const store=mem([...m]),raw=store.m.get(Journal.KEY),jr=new Journal(Host.createStorage(store),journey());
  assert.equal(jr.store.readOnly,true);assert.equal(store.m.get(Journal.KEY),raw,'protected data not rewritten');}
 // garbage active record (not a stale checkpoint) is still protected
 const fx=load('r04-lake-01'),m=new Map(fx.storage);m.set(Provider.KEY,JSON.stringify({version:2,packId:'regional-r05',revision:1,checkpoint:{version:1,packId:'regional-r05',stageId:'nope'}}));
 const p=new Provider({platform:Host.createStorage(mem([...m])),journey:journey()});assert.equal(p.readOnly,true);});
t('a current-rules unfinished board is kept (no repair on a valid save)',()=>{Store.clearRepairs();
 const store=mem([]),platform=Host.createStorage(store),st=API.getStage('r04-lake-01');const p=new Provider({platform,journey:journey(),stageId:st.id,seed:st.seedBank[0]});assert(!p.error);
 const a=API.createSession(st.id,st.seedBank[0]).legalActions({tools:false})[0],pv=p.previewAction(a);assert(pv.ok);assert(p.commitAction(pv.token).ok);
 const p2=new Provider({platform,journey:journey()});assert.equal(p2.snapshot().active.stageId,st.id);assert.equal(p2.snapshot().notice,null);});
console.log('lakeside-stale-board-b18',n,'PASS');
