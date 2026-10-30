'use strict';
// Coast (海岸支线, region 'coast') kit layer. regional-session.js and rule-guide.js stay frozen byte-for-byte;
// coast support only exists here and only when the coast kit flag is on (globalThis.__qfCoastBoardKit === true or
// '?qfcoastkit=1' in the page URL, same test as BoardProjection.coastBoardKitFromFlag on ggbot/coast-kit-int).
// Flag off: create/restore delegate to the frozen RegionalSession unchanged (a coast stage throws 'Unknown region', as frozen).
// Flag on: a coast stage runs the frozen tide machinery through a 'tide' alias of the stage; coast-only differences
// (no shells -> no pearls goal, no tool -> no tool actions, coast rule-guide text, snapshot region 'coast') are applied here.
var Session=require('./regional-session'),ruleGuide=require('./rule-guide'),copy=Session.copy,freeze=Session.freeze,P=Session.prototype;
var COAST_RULE={title:'沿着海岸点亮灯标',goal:'灯标',rule:'亮框里的当前灯标格发生消除才会点亮，并前进到下一盏；同一波（含特殊爆炸）最多点亮一盏。贝壳、苔藓、根须和直线奇果目标照常计数。',tool:'本地区暂无道具。'};
function enabled(){var g=typeof globalThis!=='undefined'?globalThis:{};if(g.__qfCoastBoardKit===true)return true;
 try{var s=g.location&&g.location.search;return typeof s==='string'&&/[?&]qfcoastkit=1(&|$)/.test(s);}catch(e){return false;}}
function signature(stage){return JSON.stringify([stage.id,stage.contentRevision,stage.config,stage.rules,stage.tool]);}
function alias(stage){var a=copy(stage);a.region='tide';a.rules=a.rules||{};if(!a.rules.shells)a.rules.shells=[];return freeze(a);}
function withAlias(s,fn){var st=s.stage;s.stage=s._coastAlias;try{return fn();}finally{s.stage=st;}}
function dropPearls(s){if(s.pieces.length||s._coastHasPearls)return;delete s.engine.goals.pearls;if(s.engine.initialGoals)delete s.engine.initialGoals.pearls;}
function guide(s){var g=withAlias(s,function(){return ruleGuide(s);}),o=copy(g);o.title=COAST_RULE.title;o.goalName=COAST_RULE.goal;o.rule=COAST_RULE.rule;o.tool.description=COAST_RULE.tool;return o;}
function patch(s,stage){
 Object.defineProperty(s,'_coastAlias',{value:alias(stage),enumerable:true,writable:true});s._coastHasPearls=!!(stage.config.goals&&'pearls' in stage.config.goals);
 s.stage=freeze(copy(stage));dropPearls(s);
 s._regional=function(w){var self=this,r=withAlias(this,function(){return P._regional.call(self,w);});dropPearls(this);return r;};
 s.legalActions=function(o){if(this.stage.tool)return P.legalActions.call(this,o);var oo=Object.assign({},o||{},{tools:false});return P.legalActions.call(this,oo);};
 s.snapshot=function(){var self=this,v=copy(withAlias(this,function(){return P.snapshot.call(self);}));v.region='coast';v.activeRelay=null;v.guide=guide(this);return freeze(v);};
 return s;}
function create(stage,seed,options){if(!stage||stage.region!=='coast'||!enabled())return new Session(stage,seed,options);
 var s=new Session(alias(stage),seed,options);return patch(s,stage);}
function restore(stage,data,options){if(!stage||stage.region!=='coast'||!enabled())return Session.restore(stage,data,options);
 if(!data||data.version!==1||data.packId!=='regional-r05'||data.stageId!==stage.id||data.contentRevision!==stage.contentRevision||data.contentSignature!==signature(stage)||!Array.isArray(data.actions)||data.actions.length>stage.config.moves||typeof data.expectedState!=='string'||data.expectedState.length>30000)throw Error('Incompatible checkpoint');
 var s=create(stage,data.seed,options);for(var i=0;i<data.actions.length;i++)if(!s.act(data.actions[i]))throw Error('Illegal checkpoint action');if(JSON.stringify(s._export())!==data.expectedState)throw Error('Checkpoint replay mismatch');s.frames=[];return s;}
module.exports={enabled:enabled,create:create,restore:restore,guide:guide,COAST_RULE:COAST_RULE};
