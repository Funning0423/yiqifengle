'use strict';
const assert=require('node:assert/strict'),{createHarness}=require('./harness.cjs'),H=createHarness(),{chapterSummary}=H.load('ui/IslandPanels');
for(let completed=0;completed<=12;completed++){
 const records=Array.from({length:12},(_,i)=>({bestStars:i<completed?1:0}));for(let region=0;region<3;region++)assert.equal(chapterSummary({records,unlocked:completed},{},region).locked,completed<(region+1)*4);
}
assert(chapterSummary({records:Array.from({length:12},()=>({bestStars:1}))},{},1,{ok:false,reason:'completion-unsaved'}).locked);
console.log(JSON.stringify({status:'PASS',checkedCompletedCounts:13,cardMilestones:[4,8,12],actualProviderFailureOverridesCard:true},null,2));
