'use strict';
var Session=require('./regional-session');
// Lakeside (风铃湖畔, region 'lake') joins the catalog from its own data file; catalog-data.js stays byte-identical.
// catalog stays the shipped 12 + lakeside (+ coast when that file is concatenated elsewhere). Snow joins allStages
// so journey hasData can see it without changing catalog-length gates.
var shipped=require('./catalog-data').concat(require('./lakeside-levels-data'));
var stages=Session.freeze(shipped);
var allStages=Session.freeze(shipped.concat(require('./snowpass-levels-data')));
function getStage(id){return allStages.find(function(s){return s.id===id;})||null;}
function createSession(id,seed){var s=getStage(id);if(!s)throw Error('Unknown stage ID');return new Session(s,seed===undefined?s.seedBank[0]:seed);}
function restore(data){var s=data&&getStage(data.stageId);if(!s)throw Error('Unknown checkpoint stage');return Session.restore(s,data);}
module.exports={packId:'regional-r05',catalog:stages,allStages:allStages,getStage:getStage,createSession:createSession,restore:restore};
