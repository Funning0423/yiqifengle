'use strict';
// b18 lakeside retune (L13 r04-lake-01, L15 r04-lake-03): new rules are in place, the bank seeds still have greedy witnesses, and a
// save written under the old draft-2026-10-16 rules (fixture: L13–L15 cleared by the pre-b18 runtime) still loads with its clears.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),R=path.join(ROOT,'creator-build-project/assets/scripts/regional-r05/runtime');
const API=require(R+'/index.js'),Journal=require(R+'/progress-journal.js'),Host=require(R+'/campaign-host.js'),L=require(R+'/lakeside-levels-data.js');
const W=JSON.parse(fs.readFileSync(path.join(__dirname,'calibration-report.json'),'utf8'));
let n=0;const t=(m,f)=>{f();n++;console.log('PASS',m);};
const journey=()=>({readOnly:false,records:Array.from({length:12},()=>({bestStars:2}))});
const mem=entries=>{const m=new Map(entries||[]);return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
t('L13 / L15 retuned: 14 / 13 moves, every chime 6 hits, new revision, old revision listed as legacy',()=>{
 const a=L.find(s=>s.id==='r04-lake-01'),c=L.find(s=>s.id==='r04-lake-03');
 assert.equal(a.config.moves,14);assert.equal(c.config.moves,13);for(const s of [a,c]){assert(s.rules.chimes.every(x=>x.hits===6));assert.equal(s.contentRevision,'draft-2026-10-25');assert.deepEqual(s.legacyRevisions,{'draft-2026-10-16':{moves:s.id==='r04-lake-01'?25:24}});}});
t('every seedBank seed of every lake stage has a greedy witness that wins within moves',()=>{
 for(const s of L){const w=W.find(x=>x.id===s.id);assert.deepEqual(w.seedBank,s.seedBank,s.id);
  for(const x of w.witness){const run=API.createSession(s.id,x.seed);for(const a of x.actions)assert(run.act(a),s.id);assert.equal(run.engine.status,'won',s.id+':'+x.seed);assert(x.actions.length<=s.config.moves);}}});
t('old save (L13–L15 cleared under draft-2026-10-16) loads writable, keeps the clears, L16 open, and a new L13 clear still records',()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-lake-journal-draft-2026-10-16.json'),'utf8'));
 const store=mem(raw),j=new Journal(Host.createStorage(store),journey());
 assert.equal(j.store.readOnly,false,JSON.stringify(j.store.error));
 for(const id of ['r04-lake-01','r04-lake-02','r04-lake-03'])assert(j.data.records[id],id);
 assert.equal(j.data.records['r04-lake-01'].contentRevision,'draft-2026-10-16');
 assert.equal(j.isUnlocked('r04-lake-04'),true);assert.equal(j.isUnlocked('r04-lake-01'),true);
 const w=W.find(x=>x.id==='r04-lake-01').witness[0],run=API.createSession('r04-lake-01',w.seed);
 const r=j.reserve({stageId:'r04-lake-01',seed:w.seed,checkpoint:run.checkpoint(),pendingAction:null,source:'new',origin:'new:'+j.data.sequence+':none:r04-lake-01:'+w.seed},null);assert(r.ok,JSON.stringify(r));
 for(const a of w.actions)run.act(a);assert(j.complete({attemptId:r.reservation.id,checkpoint:run.checkpoint(),pendingAction:null}).ok);
 assert.equal(j.data.records['r04-lake-01'].clears,2);
 assert.equal(new Journal(Host.createStorage(store),journey()).store.readOnly,false,'reload after a new-revision clear');});
t('a revision that is not listed is still refused (no blanket trust)',()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-lake-journal-draft-2026-10-16.json'),'utf8'));
 raw[0][1]=raw[0][1].split('draft-2026-10-16').join('draft-1999-01-01');
 assert.equal(new Journal(Host.createStorage(mem(raw)),journey()).store.readOnly,true);});
console.log('lakeside-retune-b18',n,'PASS');
t('lost lake board: caption = the stage failHint (≤16 字), other regions keep the old caption',()=>{
 for(const s of L){assert(typeof s.failHint==='string'&&s.failHint.length>0&&[...s.failHint].length<=16,s.id);
  const p=Host.resultPresentation({state:'result.saved',result:{outcome:'lost'},active:{stageId:s.id,region:'lake'}});assert.equal(p.uiResultTitle,'再试一阵风');assert.equal(p.uiResultCaption,s.failHint);assert.match(p.uiStatus,/未通关/);}
 const tide=API.catalog.find(s=>s.region==='tide');
 assert.deepEqual(Host.resultPresentation({state:'result.saved',result:{outcome:'lost'},active:{stageId:tide.id,region:'tide'}}),{uiResultTitle:'再试一阵风',uiResultCaption:'本局已保存，可以重新挑战',uiStatus:'未通关 · 不发奖励'});});
console.log('lakeside-retune-b18 hints PASS');
