'use strict';
// Actual UI TS with Cocos node/event doubles. Provider durability is covered separately.
const assert=require('node:assert/strict');
const {createBoard}=require('./board-fixture.cjs');
(async()=>{
 const checks=[];
 for(const provider of ['mainline-v33','regional-r05']){
  const b=createBoard({provider});await b.H.flush();b.s.state='result.saved';b.s.active.status='lost';b.render();
  const replay=b.u.popups.find('ResultPanel').root.find('Replay');assert(replay,provider+' loss requires replay');
  b.H.tap(replay);assert.deepEqual(b.log.commands.at(-1),provider==='regional-r05'?['retryStage']:['startStage','test',{}]);
  checks.push(provider+' saved loss offers scoped retry');
 }
 for(const state of ['run.unsaved','result.unsaved','error.readonly']){
  const b=createBoard({provider:'regional-r05'});await b.H.flush();b.s.state=state;b.s.active.status='lost';b.render();
  assert(!b.u.popups.find('ResultPanel').root.find('Replay'),state+' must not offer retry');checks.push(state+' keeps retry unavailable');
 }
 const won=createBoard({provider:'regional-r05'});await won.H.flush();won.s.state='result.saved';won.s.active.status='won';won.render();assert(!won.u.popups.find('ResultPanel').root.find('Replay'));checks.push('won keeps receipt and has no loss retry');
 console.log(JSON.stringify({status:'PASS',scope:'Real UI TS plus node/event doubles, no Cocos rendering',checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
