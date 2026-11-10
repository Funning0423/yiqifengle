'use strict';
var Session=require('./regional-session'),copy=Session.copy,freeze=Session.freeze,P=Session.prototype;
// Lakeside (风铃湖畔, region 'lake') joins the catalog from its own data file; catalog-data.js stays byte-identical.
// Coast visual kit (BoardProjection.coastBoardKitFromFlag) is a separate switch. Registering coast stages does not
// mean COAST_KIT is on, and turning the kit on does not by itself invent r06-coast-04..09 rows.
var stages=Session.freeze(require('./catalog-data').concat(require('./lakeside-levels-data')));
// Coast chapter target length (通关 / rail unlock). Playable rows grow over M1..M4; claim stays incomplete until 9 clear.
var COAST_STAGE_COUNT=9;
// COAST01 descriptor unchanged from 17e478ea (moves:20, seedBank:[22,9,13], legacyMoves:26).
// COAST02/03: design-package rows with ordinal swap (beacon before moss) so 1→2 is not meadow's type→moss.
// Moves/seedBank for 02/03 filled by tools/coast calibration; placeholders below are overwritten in the same commit
// once seeds are found (see PROGRESS.md). Proposed CONCEPT (退潮铃 / shells layers / sea-glass art) omitted.
var coastPlayable=freeze([
  freeze({
    id:'r06-coast-01',region:'coast',ordinal:1,name:'寄给海风',contentRevision:'port-2026-10-29',intendedBand:'introduce',
    designIntent:'收集贝壳，给今天留一声问候。',
    config:{moves:19,goals:{type5:18},moss:[],roots:[],starters:[{index:10,special:'column'}]},
    rules:{},tool:null,seedBank:[22,9,13],legacyMoves:26,chapterName:'海岸漫游',
    note:'今天不用走很远，听见海风就很好。',
    failHint:'先找贝壳多的地方，消除它们下方也能带来新贝壳。',
    calibration:{status:'draft-moves-untested',legacyMoves:26,meaning:'moves 20→19 (m1b) on seedBank[0]=22 for random N=200 ~0.865 in 0.85–0.88; goals/seed/layout unchanged; legacyMoves 26 kept'}
  }),
  freeze({
    id:'r06-coast-02',region:'coast',ordinal:2,name:'椰影风铃',contentRevision:'m1-2026-11-09',intendedBand:'beacon-lesson',
    designIntent:'顺着三盏灯，在椰影间接通风铃。',
    config:{moves:24,goals:{beacons:3,lines:1,type1:10},moss:[],roots:[],beacons:[23,24,25],starters:[{index:9,special:'column'}]},
    rules:{},tool:null,seedBank:[3,4,1],chapterName:'海岸漫游',
    note:'风铃不催你，它只是陪你。',
    failHint:'消除亮框内的果实，灯标才会前进；每波只点亮一盏。',
    designRowSource:'COAST01-09-rows.json COAST03',
    sequenceNote:'Swapped ahead of moss so coast 1–2 is type→beacon, not meadow-like type→moss',
    balanceNote:'Design moves 36/goals lines2 type1:16 retuned to moves 24 / lines 1 / type1 10 for random-play band 0.6–0.9'
  }),
  freeze({
    id:'r06-coast-03',region:'coast',ordinal:3,name:'沙滩小径',contentRevision:'m1-2026-11-09',intendedBand:'moss-path',
    designIntent:'沿两条沙径清除苔藓，拾起莓果。',
    config:{moves:24,goals:{moss:6,type0:6},moss:[7,8,9,37,38,39],roots:[],starters:[{index:24,special:'bomb'}]},
    rules:{},tool:null,seedBank:[2,4,1],chapterName:'海岸漫游',
    note:'小小的一步，也会留下一枚足迹。',
    failHint:'在带苔藓的格子上消除；一颗星光能照亮周围九格。',
    designRowSource:'COAST01-09-rows.json COAST02',
    sequenceNote:'Was design ordinal 2; placed at 3 after beacon lesson',
    balanceNote:'Design moves 29/moss10 type0:12 retuned to moves 24 / moss 6 (twin short bands 7-9 & 37-39) / type0 6 for random-play ~0.61'
  }),
  freeze({
    id:'r06-coast-04',region:'coast',ordinal:4,name:'小蟹回家',contentRevision:'m2-2026-11-09',intendedBand:'roots-corridor',
    designIntent:'解开岸边根须，为小蟹留出通道。',
    config:{moves:23,goals:{roots:8,type5:12},moss:[],roots:[{index:7,layers:2},{index:13,layers:2},{index:14,layers:2},{index:20,layers:2},{index:28,layers:2},{index:34,layers:2},{index:35,layers:2},{index:41,layers:2}],starters:[{index:22,special:'row'}]},
    rules:{},tool:null,seedBank:[2,18,10],chapterName:'海岸漫游',
    note:'回家的路，有人慢慢陪你走。',
    failHint:'在根须旁边消除也有效；双层根须要分两波解开。',
    designRowSource:'COAST01-09-rows.json COAST04 (full 8-root belt; type5 14->12, moves 33->22)',
    sequenceNote:'roots after moss; coast 1-4 = type->beacon->moss->roots',
    balanceNote:'random N=200 = 0.605 dip after 0.665; moves 23'
  }),
  freeze({
    id:'r06-coast-05',region:'coast',ordinal:5,name:'潮池星灯',contentRevision:'m2-2026-11-09',intendedBand:'return-lamps',
    designIntent:'循着折返灯路，点亮潮池四角。',
    config:{moves:24,goals:{beacons:3,moss:3,specials:1,type3:6},moss:[16,17,18],roots:[],beacons:[16,17,18],starters:[{index:9,special:'column'}]},
    rules:{},tool:null,seedBank:[1,3,2],chapterName:'海岸漫游',
    note:'你留下的微光，比想象中亮。',
    failHint:'亮框内消除才点灯；苔藓叠在灯格上，清灯也清苔。',
    designRowSource:'COAST01-09-rows.json COAST05 adapted: 4 corner lamps -> 3 lamps on row2 [16,17,18] (!=COAST02 [23,24,25]); moss colocated with lamps; keep specials+type3; starter column',
    sequenceNote:'beacons+moss+specials after roots; moss-on-beacons distinct from COAST02/03',
    balanceNote:'random N=200 = 0.830 rise after 0.605'
  })
]);

function coastStages(){return coastPlayable;}
function coastByOrdinal(n){return coastPlayable.find(function(s){return s.ordinal===n;})||null;}
function getStage(id){return stages.find(function(s){return s.id===id;})||coastPlayable.find(function(s){return s.id===id;})||null;}
// catalog + registered coast (and later snow) for journey hasData / progress denominators that read actual rows
var allStages=freeze(stages.concat(coastPlayable));
function coastSignature(stage){return JSON.stringify([stage.id,stage.contentRevision,stage.config,stage.rules,stage.tool]);}
// regional-session.js stays tide/meadow/sky/lake only. Coast runs that tide shell machine with shells:[] (no pearls)
// so engine goals are the rules. No new mechanic.
function coastAlias(stage){var a=copy(stage);a.region='tide';a.rules={shells:[]};return freeze(a);}
function withAlias(s,fn){var st=s.stage;s.stage=s._coastAlias;try{return fn();}finally{s.stage=st;}}
function dropPearls(s){if(s.pieces.length)return;delete s.engine.goals.pearls;if(s.engine.initialGoals)delete s.engine.initialGoals.pearls;}
function coastGuide(stage){
  var g=stage.config.goals||{},parts=[];
  if(g.beacons)parts.push('亮框里的当前灯标格发生消除才会点亮，同一波最多一盏');
  if(g.moss)parts.push('在带苔藓的格子上消除以清除苔藓');
  if(g.roots)parts.push('在根须格或其邻格消除可削一层根须');
  if(g.lines)parts.push('用横/竖奇果计入直线目标');
  if(g.specials)parts.push('触发奇果计入奇果目标');
  var typeKey=Object.keys(g).find(function(k){return /^type[0-5]$/.test(k);});
  if(typeKey)parts.push(typeKey==='type5'?'消除贝壳（逻辑类型 5）':'收集逻辑类型 '+typeKey.slice(4)+' 的果实');
  if(!parts.length)parts.push('完成关卡目标');
  var goalName=g.beacons?'灯标':g.moss?'苔藓':typeKey==='type5'?'贝壳':stage.name;
  return {title:stage.name,goalName:goalName,rule:parts.join('；')+'。',tool:'本关没有道具。'};
}
function patchCoast(s,stage){
  Object.defineProperty(s,'_coastAlias',{value:coastAlias(stage),enumerable:true,writable:true});
  s.stage=freeze(copy(stage));dropPearls(s);
  s._regional=function(w){var self=this,r=withAlias(this,function(){return P._regional.call(self,w);});dropPearls(this);return r;};
  s.legalActions=function(o){if(this.stage.tool)return P.legalActions.call(this,o);return P.legalActions.call(this,Object.assign({},o||{},{tools:false}));};
  s.snapshot=function(){var self=this,v=copy(withAlias(this,function(){return P.snapshot.call(self);}));v.region='coast';v.activeRelay=null;var guide=coastGuide(this.stage);v.guide=Object.assign({},v.guide,{title:guide.title,goalName:guide.goalName,rule:guide.rule,tool:Object.assign({},v.guide.tool,{kind:null,charges:0,description:guide.tool})});return freeze(v);};
  return s;
}
function createCoast(stage,seed,options){var s=new Session(coastAlias(stage),seed,options);return patchCoast(s,stage);}
function restoreCoast(stage,data,options){
  if(!data||data.version!==1||data.packId!=='regional-r05'||data.stageId!==stage.id||data.contentRevision!==stage.contentRevision||data.contentSignature!==coastSignature(stage)||!Array.isArray(data.actions)||data.actions.length>stage.config.moves||typeof data.expectedState!=='string'||data.expectedState.length>30000)throw Error('Incompatible checkpoint');
  var s=createCoast(stage,data.seed,options);for(var i=0;i<data.actions.length;i++)if(!s.act(data.actions[i]))throw Error('Illegal checkpoint action');if(JSON.stringify(s._export())!==data.expectedState)throw Error('Checkpoint replay mismatch');s.frames=[];return s;
}
function createSession(id,seed){var s=getStage(id);if(!s)throw Error('Unknown stage ID');var use=seed===undefined?s.seedBank[0]:seed;return s.region==='coast'?createCoast(s,use):new Session(s,use);}
function restore(data){var s=data&&getStage(data.stageId);if(!s)throw Error('Unknown checkpoint stage');return s.region==='coast'?restoreCoast(s,data):Session.restore(s,data);}
// Descriptor for the chapter entry surface. Still keyed on ordinal-1 for product messaging; unlock chain is ordinal-based in the journal.
function coastPlayerEntry(opts){
  opts=opts||{};
  var stage=coastByOrdinal(1);
  if(!stage||stage.id!=='r06-coast-01'||stage.region!=='coast')return {ok:false,reason:'coast01-not-registered'};
  var inCatalog=stages.some(function(s){return s.id===stage.id;});
  var rec=opts.journalRecord||null;
  var clears=rec&&Number(rec.clears)||0;
  if(!Number.isFinite(clears)||clears<0)clears=0;
  return {
    ok:true,kind:'coast01-descriptor',stageId:stage.id,name:stage.name,
    seed:stage.seedBank[0],moves:stage.config.moves,goalType5:stage.config.goals&&stage.config.goals.type5,
    legacyMoves:stage.legacyMoves,inCatalog:inCatalog,devEntry:false,devKey:null,
    productApproved:false,officialGate:null,tappable:false,unlocked:false,state:'not-a-player-entry',
    clears:clears,bestMoves:rec&&rec.bestMoves!=null?rec.bestMoves:null,
    registeredStages:coastPlayable.length,specChapterStages:COAST_STAGE_COUNT,includeInJourneyBar:false,
    enter:null,enterRegion:null,exit:'exitLevel',selectionRegion:'island',
    route:null,stamp:false,
    missing:'No approved player entry. selectionRegion has no coast arm. A mainline-star index and a book button are not product gates.'
  };
}
module.exports={packId:'regional-r05',catalog:stages,allStages:allStages,coastPlayable:coastPlayable,coastStages:coastStages,COAST_STAGE_COUNT:COAST_STAGE_COUNT,getStage:getStage,createSession:createSession,restore:restore,coastPlayerEntry:coastPlayerEntry};
