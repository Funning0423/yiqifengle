'use strict';
// 雪山山口: enter (journal gate + RegionLoader), finish (witness), save (journal receipt + cold restore), return (requestExit),
// and the board plane sitting on the measured snow shelf. Pure Node. No Cocos render, device, or WeChat.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets'),R=path.join(A,'scripts/regional-r05/runtime');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const API=require(R+'/index.js'),Journal=require(R+'/progress-journal.js'),Host=require(R+'/campaign-host.js');
const Lake=require(R+'/lakeside-levels-data.js'),Snow=require(R+'/snowpass-levels-data.js');
const WIT=JSON.parse(fs.readFileSync(path.join(__dirname,'witnesses.json'),'utf8'));
const LAKEW=JSON.parse(fs.readFileSync(path.join(__dirname,'../lakeside/calibration-report.json'),'utf8'));
let n=0;const t=(m,f)=>{f();n++;console.log('PASS',m);};
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
const journey=done=>({readOnly:false,records:Array.from({length:12},(_,i)=>({bestStars:i<done?2:0,clears:i<done?1:0}))});
function flush(c){let k=0;while(c.snapshot().visual){const tok=c.snapshot().visual.token;assert(c.finishVisualStep(tok).ok);assert(++k<200);}}
function play(c,actions){for(const a of actions){const q=c.previewAction(a);assert(q.ok,JSON.stringify(q));const r=c.commitAction(q.token);assert(r.ok&&r.saved,JSON.stringify(r));flush(c);}}
const Provider=require(R+'/board-session-provider.js');

t('six snow stages are playable data, off the shipped catalog, ids r06-snow-01..06',()=>{
  assert.equal(Snow.length,6);
  assert.deepEqual(Snow.map(s=>s.id),['r06-snow-01','r06-snow-02','r06-snow-03','r06-snow-04','r06-snow-05','r06-snow-06']);
  assert.deepEqual(Snow.map(s=>s.ordinal),[1,2,3,4,5,6]);
  assert.equal(API.catalog.some(s=>s.region==='snow'),false);
  assert.equal(API.allStages.filter(s=>s.region==='snow').length,6);
  assert.equal(API.catalog.length,API.allStages.filter(s=>s.region!=='snow'&&s.region!=='rail'&&s.region!=='cloud'&&s.region!=='spring'&&s.region!=='fjord'&&s.region!=='oasis'&&s.region!=='harbor').length);
  for(const s of Snow){
    assert.equal(s.region,'snow');assert(s.rules.chimes&&s.rules.chimes.length);assert.equal(s.tool,null);
    assert(!s.rules.phaseCycle&&!s.rules.windCycle&&!s.rules.beaconRoute);
    const run=API.createSession(s.id);assert.equal(run.snapshot().region,'snow');assert.equal(run.snapshot().guide.goalName,'风铃');
  }
});
t('witnesses win inside the move budget; level 2 stays locked until level 1 is saved',()=>{
  const store=mem(),platform=Host.createStorage(store),j=journey(12);
  const prov=new Provider({platform,journey:j});
  for(const lake of Lake){const w=LAKEW.find(x=>x.id===lake.id).witness[0];assert(prov.startStage(lake.id,{seed:w.seed}).ok,lake.id);play(prov,w.actions);assert.equal(prov.snapshot().result.completionRecorded,true,lake.id);}
  assert.equal(new Journal(platform,j).isUnlocked('r06-snow-01'),true);
  assert.equal(new Journal(platform,j).isUnlocked('r06-snow-02'),false);
  const before=new Journal(mem(),journey(12));
  assert.equal(before.isUnlocked('r06-snow-01'),false);
  const w0=WIT[0].witness[0];
  assert(prov.startStage('r06-snow-01',{seed:w0.seed}).ok);play(prov,w0.actions);
  assert.equal(prov.snapshot().active.status,'won');assert.equal(prov.snapshot().result.completionRecorded,true);
  assert.equal(prov.snapshot().progress.records['r06-snow-01'].clears,1);
  assert.equal(prov.requestExit().ok,true);
  const cold=new Provider({platform,journey:j});
  assert.equal(cold.snapshot().progress.records['r06-snow-01'].clears,1);
  assert.equal(new Journal(platform,j).isUnlocked('r06-snow-02'),true);
  for(const pack of WIT)for(const x of pack.witness){const s=API.createSession(pack.id,x.seed);for(const a of x.actions)assert(s.act(a),pack.id+' '+x.seed);assert.equal(s.engine.status,'won',pack.id+' '+x.seed);}
});
t('journey: snow is enterable after the lake, and 远方 only when the stage list has no snow',()=>{
  const J=H.load('ui/JourneyCore');
  const rec=k=>Array.from({length:12},(_,i)=>({bestStars:i<k?1:0}));
  const shipped=API.catalog.map(s=>({id:s.id,region:s.region}));
  const withSnow=API.allStages.map(s=>({id:s.id,region:s.region}));
  const far=J.regionRow('snow',{records:rec(12),regionDone:{lake:6},stages:shipped});
  assert.equal(far.state,'far');assert.equal(far.hasData,false);assert.equal(far.tappable,false);
  const locked=J.regionRow('snow',{records:rec(12),regionDone:{lake:5},stages:withSnow});
  assert.equal(locked.state,'locked');assert.equal(locked.hasData,true);
  const open=J.regionRow('snow',{records:rec(12),regionDone:{lake:6},stages:withSnow});
  assert.equal(open.state,'open');assert.equal(open.tappable,true);assert.equal(open.total,6);
  const done=J.regionRow('snow',{records:rec(12),regionDone:{lake:6,snow:6},stages:withSnow});
  assert.equal(done.state,'done');
  const bar=J.journeyProgress({records:rec(12),regionDone:{lake:6},stages:withSnow});
  assert.equal(bar.segments.some(s=>s.id==='snow'),true);
});
t('board plane is the snow shelf: no gap, no sink, footprint inside the flat pad',()=>{
  const D=H.load('region/SnowpassSceneData'),C=H.load('world-r1/CameraPose');
  assert.equal(D.snowpassBoardGap(),0);
  assert.equal(D.snowpassBoardOnShelf(),true);
  const y=D.SNOW_SHELF.y;
  for(let i=0;i<49;i++){const c=D.snowpassCellCenter(i);assert.equal(c[1],y);assert(c[0]>D.SNOW_SHELF.minX&&c[0]<D.SNOW_SHELF.maxX);assert(c[2]>D.SNOW_SHELF.minZ&&c[2]<D.SNOW_SHELF.maxZ);}
  const b=D.snowpassBoardBounds();
  assert.equal(b.min[1],y);assert.equal(b.max[1],y);
  assert(b.min[0]>D.SNOW_SHELF.minX&&b.max[0]<D.SNOW_SHELF.maxX&&b.min[2]>D.SNOW_SHELF.minZ&&b.max[2]<D.SNOW_SHELF.maxZ);
  for(const a of [9/19.5,9/16,3/4,1]){const look=D.snowpassBoardLook(a);assert.equal(C.validateCameraPose(C.fromLookAt(look)),null,String(a));}
});
t('wiring: RegionLoader, scene route, journey enter, return without the balloon leg',()=>{
  const LR=H.load('world-r2/LevelRegion'),RL=H.load('region/RegionLoader');
  const def=RL.REGIONS.snowpass;
  assert.equal(def.bundle,'region_snowpass');
  assert.equal(def.prefabName,'SP_snowpass');
  assert.equal(def.prefabUuid,'55d98240-cf8f-429b-8819-535f727fb02f@a9480');
  for(const s of Snow)assert(LR.requiresSnowpassScene({stageId:s.id}),s.id);
  for(const id of ['r04-lake-01','r05-tide-01','r05-meadow-01','r05-sky-01','mainline-12'])assert(!LR.requiresSnowpassScene({stageId:id}),id);
  const comp=fs.readFileSync(path.join(A,'scripts/world-r2/WorldNativeComposition.ts'),'utf8');
  const boot=fs.readFileSync(path.join(A,'scripts/WorldIntegrationBoot.ts'),'utf8');
  assert(/r06-snow-\\d\+/.test(comp)&&/createSnowpassBoardBackground\(context\)/.test(comp));
  assert(/requiresLakesideScene\(context\.selection\)\?createLakesideBoardBackground\(context\)/.test(comp));
  assert(/const onShelf=\/\^r06-snow-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r07-rail-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r08-cloud-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r09-spring-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)/.test(comp));
  assert(/if\(!onShelf\)\{const arrived=await this\.ensureRegion\(region\)/.test(comp));
  assert(/allStages\|\|\(RegionalAPI as any\)\.catalog/.test(comp));
  assert(/this\.button\('snow','雪山山口',\(\)=>this\.composition\.enterRegion\('snow'\)\)/.test(boot));
  assert(/this\.button\('lake','风铃湖畔',\(\)=>this\.composition\.enterRegion\('lake'\)\)/.test(boot));
  const balloon=fs.readFileSync(path.join(A,'scripts/region/LakesideBalloon.ts'),'utf8');
  assert(!/snowpass|r06-snow/.test(balloon));
});
console.log(JSON.stringify({status:'PASS',cases:n,scope:'Pure logic + Cocos doubles. Not a device render.'}));
