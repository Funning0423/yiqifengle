'use strict';
var Session=require('./regional-session'),copy=Session.copy,freeze=Session.freeze,P=Session.prototype;
// Lakeside (风铃湖畔, region 'lake') joins the catalog from its own data file; catalog-data.js stays byte-identical.
// Coast visual kit (BoardProjection.coastBoardKitFromFlag) is a separate switch. Registering this one stage does not
// mean COAST_KIT is on, and turning the kit on does not register r06-coast-02..09.
var stages=Session.freeze(require('./catalog-data').concat(require('./lakeside-levels-data')));
// COAST01 only. Source row: origin/scene/b19-coast-scene @ 41947e21 coast-levels-data.js (ported 2026-10-29 from
// legacy src/commonr2/x/fixed/shared/coastal-content.js, which is NOT in this tree). Moves 20 are that port's draft
// (legacyMoves 26). Historical calibrate.cjs win rates were not copied and are not remeasured here.
var COAST01=freeze({
  id:'r06-coast-01',region:'coast',ordinal:1,name:'寄给海风',contentRevision:'port-2026-10-29',intendedBand:'introduce',
  designIntent:'收集贝壳，给今天留一声问候。',
  config:{moves:20,goals:{type5:18},moss:[],roots:[],starters:[{index:10,special:'column'}]},
  rules:{},tool:null,seedBank:[22,9,13],legacyMoves:26,chapterName:'海岸漫游',
  note:'今天不用走很远，听见海风就很好。',
  failHint:'先找贝壳多的地方，消除它们下方也能带来新贝壳。',
  calibration:{status:'draft-moves-untested',legacyMoves:26,meaning:'moves copied from port-2026-10-29; win rate not measured on this candidate'}
});
// Not exported as allStages: island journey denominator stays the shipped catalog (12 + 6 lake). Chapter grid does not list this row.
var coastPlayable=freeze([COAST01]);
function getStage(id){return stages.find(function(s){return s.id===id;})||coastPlayable.find(function(s){return s.id===id;})||null;}
function coastSignature(stage){return JSON.stringify([stage.id,stage.contentRevision,stage.config,stage.rules,stage.tool]);}
// regional-session.js stays tide/meadow/sky/lake only. Coast runs that tide shell machine with shells:[] (no pearls)
// so engine goals (type5 here) are the rules. No new mechanic.
function coastAlias(stage){var a=copy(stage);a.region='tide';a.rules={shells:[]};return freeze(a);}
function withAlias(s,fn){var st=s.stage;s.stage=s._coastAlias;try{return fn();}finally{s.stage=st;}}
function dropPearls(s){if(s.pieces.length)return;delete s.engine.goals.pearls;if(s.engine.initialGoals)delete s.engine.initialGoals.pearls;}
function coastGuide(stage){
  var g=stage.config.goals||{};
  if(g.beacons)return {title:'沿着海岸点亮灯标',goalName:'灯标',rule:'亮框里的当前灯标格发生消除才会点亮，同一波最多一盏。',tool:'本关没有道具。'};
  return {title:stage.name,goalName:'贝壳',rule:'消除贝壳（逻辑类型 5）。本关没有苔藓、根须，也没有道具。',tool:'本关没有道具。'};
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
// Descriptor only. Not a player button, not an approved mainline-star gate, not coast-dev.
// JourneyCore still treats coast as 远方; do not push this id into the journey-bar stage list.
function coastPlayerEntry(opts){
  opts=opts||{};
  var stage=getStage('r06-coast-01');
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
    registeredStages:coastPlayable.length,specChapterStages:9,includeInJourneyBar:false,
    enter:null,enterRegion:null,exit:'exitLevel',selectionRegion:'island',
    route:null,stamp:false,
    missing:'No approved player entry. selectionRegion has no coast arm. A mainline-star index and a book button are not product gates.'
  };
}
module.exports={packId:'regional-r05',catalog:stages,coastPlayable:coastPlayable,getStage:getStage,createSession:createSession,restore:restore,coastPlayerEntry:coastPlayerEntry};
