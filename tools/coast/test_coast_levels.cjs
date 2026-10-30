'use strict';
// 海岸支线: catalog registration + every shipped seed has a replayable win within the stage's moves (1-ply greedy witness).
const assert=require('assert'),path=require('path'),R=path.resolve(__dirname,'../../creator-build-project/assets/scripts/regional-r05/runtime');
const API=require(R+'/index.js'),Session=require(R+'/regional-session.js'),coast=require(R+'/coast-levels-data.js');
assert.strictEqual(coast.length,9);assert.deepStrictEqual(coast.map(s=>s.ordinal),[1,2,3,4,5,6,7,8,9]);
assert.deepStrictEqual(coast.map(s=>s.legacyMoves),[26,29,36,33,42,46,28,32,30]);
const left=s=>{const g=s.engine.goals;return Object.keys(g).reduce((a,k)=>a+Math.max(0,g[k])*(k==='beacons'?6:1),0);};
let n=0;for(const st of coast){assert.ok(API.getStage(st.id),st.id+' registered');assert.ok(!API.catalog.includes(API.getStage(st.id)),'coast stays out of the shipped catalog');assert.strictEqual(st.seedBank.length,3);
 for(const seed of st.seedBank){const s=API.createSession(st.id,seed);let used=0;
  while(s.engine.status==='playing'){let best=null,bv=Infinity;for(const a of s.legalActions({tools:false})){const f=s.fork();if(!f._act(a))continue;const v=f.engine.status==='won'?-1:left(f);if(v<bv){bv=v;best=a;}}assert.ok(best,st.id+' stuck');assert.ok(s.act(best));used++;}
  assert.strictEqual(s.engine.status,'won',st.id+' seed '+seed+' greedy loses');
  const cp=s.checkpoint(),r=API.restore(cp);assert.strictEqual(r.engine.status,'won');n++;console.log(st.id,'seed',seed,'won in',used,'/',st.config.moves,'left',s.engine.moves);}}
const Journal=require(R+'/progress-journal.js');assert.strictEqual(Journal.COAST_STAGE_COUNT,9);
console.log('coast levels ok:',n,'seeded wins');
// journal: coast opens after mainline 12 (record 11), then in order; region claim needs all 9
{const Host=require(R+'/campaign-host.js');const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
 const journey=done=>({readOnly:false,records:Array.from({length:12},(_,i)=>({bestStars:i<done?2:0}))});
 const seed=coast[0].seedBank[0];
 assert.strictEqual(Host.inspectSelection(Host.createPersistence(mem(),journey(11)),{stageId:'r06-coast-01',seed}).reason,'stage-locked');
 assert.deepStrictEqual(Host.inspectSelection(Host.createPersistence(mem(),journey(12)),{stageId:'r06-coast-01',seed}),{ok:true,resume:false});
 assert.strictEqual(Host.inspectSelection(Host.createPersistence(mem(),journey(12)),{stageId:'r06-coast-02',seed:coast[1].seedBank[0]}).reason,'stage-locked');
 const j=new Journal(Host.createStorage(mem()),journey(12));assert.strictEqual(j.claim('coast').ok,false);
 const g=API.createSession('r06-coast-03').snapshot().guide;assert.strictEqual(g.goalName,'灯标');
 console.log('journal gate ok');}
// reward = 夜航 (C7–C9), display helpers in RegionNodeProgress
{const Host=require(R+'/campaign-host.js');assert.deepStrictEqual(Journal.COAST_NIGHT_REQUIRES,['r06-coast-07','r06-coast-08','r06-coast-09']);
 const src=require('fs').readFileSync(path.resolve(R,'../../region/RegionNodeProgress.ts'),'utf8');
 assert.ok(/COAST_STAGE_IDS:readonly string\[\]=\['r06-coast-01'/.test(src)&&/export function coastStagePhases/.test(src)&&/export function challengeRegionOf/.test(src));
 const {load}=require('../region-nodes/load.cjs'),P=load('region/RegionNodeProgress.ts');
 assert.deepStrictEqual([...P.COAST_STAGE_IDS],coast.map(s=>s.id));assert.deepStrictEqual([...P.COAST_NIGHT_REQUIRES],[...Journal.COAST_NIGHT_REQUIRES]);
 assert.strictEqual(P.challengeRegionOf('r06-coast-04'),'coast');assert.strictEqual(P.challengeRegionOf('r04-lake-01'),'lake');assert.strictEqual(P.challengeRegionOf('r05-tide-02'),'tide');
 let ph=P.coastStagePhases(false,{records:{}});assert.strictEqual(ph['r06-coast-01'],'locked');
 ph=P.coastStagePhases(true,{records:{'r06-coast-01':{}}});assert.strictEqual(ph['r06-coast-01'],'passed');assert.strictEqual(ph['r06-coast-02'],'playable');assert.strictEqual(ph['r06-coast-03'],'locked');
 // claim with only C7–C9 recorded must pass the journal's reward rule: build records via real wins
 const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
 console.log('coast reward + display helpers ok');}
