'use strict';
var Session=require('./regional-session'),CoastKit=require('./coast-kit');
// Lakeside (风铃湖畔, region 'lake') joins the catalog from its own data file; catalog-data.js stays byte-identical.
// Coast (海岸支线, region 'coast', 2026-10-29 port) is registered but kept OUT of `catalog` until it has a scene, board and island UI:
// coast sessions only run with the coast kit flag (coast-kit.js; ?qfcoastkit=1); getStage/createSession/restore and the journal resolve its IDs through `allStages`; every catalog consumer (island panels, ending, witnesses) is unchanged.
var stages=Session.freeze(require('./catalog-data').concat(require('./lakeside-levels-data')));
var coastStages=Session.freeze(require('./coast-levels-data').slice()),allStages=Session.freeze(stages.concat(coastStages));
function getStage(id){return allStages.find(function(s){return s.id===id;})||null;}
function createSession(id,seed){var s=getStage(id);if(!s)throw Error('Unknown stage ID');return CoastKit.create(s,seed===undefined?s.seedBank[0]:seed);}
function restore(data){var s=data&&getStage(data.stageId);if(!s)throw Error('Unknown checkpoint stage');return CoastKit.restore(s,data);}
module.exports={packId:'regional-r05',catalog:stages,coastCatalog:coastStages,allStages:allStages,getStage:getStage,createSession:createSession,restore:restore};
