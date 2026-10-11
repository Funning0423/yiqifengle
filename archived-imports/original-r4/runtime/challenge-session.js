/* Headless, replayable challenge session. UI integration is a separate acceptance step. */
'use strict';
const Engine=require('./engine');
function seededRandom(seed){let value=seed>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
function stateOf(e){return JSON.stringify({board:e.board,moves:e.moves,bombs:e.bombs,score:e.score,goals:e.goals,moss:[...e.moss],roots:[...e.roots],cursor:e.beaconCursor,status:e.status});}
class ChallengeSession{
 constructor(progress,id,{seed,attemptId}={}){this.progress=progress;this.stage=progress.catalog.get(id);if(!progress.isUnlocked(id))throw Error('Challenge is locked or unavailable');
  this.seed=seed===undefined?this.stage.seedBank[0]:seed;if(!this.stage.seedBank.includes(this.seed))throw Error('Use a verified seed from this challenge');
  this.attemptId=attemptId||id+':'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2);if(typeof this.attemptId!=='string'||!this.attemptId||this.attemptId.length>160)throw Error('Invalid attempt ID');
  this.engine=new Engine(['tide','meadow','sky'].indexOf(this.stage.region)*4,seededRandom(this.seed),this.stage.config);this.engine.bombs=0;this.actions=[];this.error=null;
 }
 act(action){const e=this.engine;if(this.error||!action||e.status!=='playing'||!e._canStart())return false;const a=Array.isArray(action)?action:null;if(!a)return false;let accepted=false;
  if(a[0]==='swap'&&a.length===3)accepted=e.swap(a[1],a[2]);else if(a[0]==='activate'&&a.length===2)accepted=e.activate(a[1]);else if(a[0]==='bomb'&&a.length===2)accepted=e.bomb(a[1]);if(!accepted)return false;
  try{for(let n=0;n<Engine.MAX_CASCADES;n++){const wave=e.nextWave();if(!wave.indexes.size)break;if(!e.clearWave(wave))throw Error('Challenge wave rejected');e.fall();if(n===Engine.MAX_CASCADES-1)e.shuffle();}e.settleDone();this.actions.push(a.slice());return true;}
  catch(error){this.error=String(error.message||error);return false;}
 }
 finish(){if(this.error||this.engine.status!=='won')return {saved:false,reason:this.error?'run-error':'not-won'};return this.progress.recordWin(this.stage.id,{attemptId:this.attemptId,seed:this.seed,score:this.engine.score,movesRemaining:this.engine.moves,totalMoves:this.stage.config.moves});}
 checkpoint(){const e=this.engine;if(this.error||e._turnActive||e._pendingPlan||e.board.some(t=>!t)||e.matches().size)throw Error('Checkpoint only at a settled boundary');return {version:1,stageId:this.stage.id,contentRevision:this.stage.contentRevision,seed:this.seed,attemptId:this.attemptId,actions:this.actions.map(x=>x.slice()),expectedState:stateOf(e)};}
 static restore(progress,data){if(!data||data.version!==1||!Array.isArray(data.actions)||typeof data.expectedState!=='string'||data.expectedState.length>100000||typeof data.attemptId!=='string'||!data.attemptId||!Number.isInteger(data.seed)||data.seed<0||data.seed>0xffffffff)throw Error('Invalid challenge checkpoint');const stage=progress.catalog.get(data.stageId);if(!stage||data.contentRevision!==stage.contentRevision||data.actions.length>stage.config.moves+2)throw Error('Checkpoint is not compatible with this stage');
  const run=new ChallengeSession(progress,data.stageId,{seed:data.seed,attemptId:data.attemptId});for(const action of data.actions)if(!run.act(action))throw Error('Invalid checkpoint action');if(stateOf(run.engine)!==data.expectedState)throw Error('Checkpoint state failed deterministic replay');return run;
 }
}
ChallengeSession.seededRandom=seededRandom;ChallengeSession.stateOf=stateOf;module.exports=ChallengeSession;
