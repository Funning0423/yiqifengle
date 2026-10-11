/* Independent challenge journal. Never reads/writes legacy journey keys or inventory. */
'use strict';
const KEY='forest-challenges-c01',VERSION=1,ATTEMPT_LIMIT=192;
const clone=x=>JSON.parse(JSON.stringify(x)),plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),metric=x=>Number.isSafeInteger(x)&&x>=0;
class ChallengeProgress{
 constructor(platform,journey,catalog){this.p=platform||{};this.journey=journey;this.catalog=catalog;this.key=ChallengeProgress.keyForPack(catalog.packId);this.records={};this.claimedRegions=[];this.attempts=[];this.readOnly=false;this.lastError=null;
  try{let d=this.p.load?.(this.key);if(d==null||d==='')return;if(typeof d==='string')d=JSON.parse(d);
   if(!plain(d)||d.version!==VERSION||d.packId!==catalog.packId||!plain(d.records)||!Array.isArray(d.claimedRegions)||!Array.isArray(d.attempts)||d.attempts.length>ATTEMPT_LIMIT)throw Error('Unsupported challenge journal');
   for(const[id,x]of Object.entries(d.records)){const stage=catalog.get(id);if(!stage||!plain(x)||!Number.isInteger(x.bestStars)||x.bestStars<1||x.bestStars>3||!metric(x.bestScore)||!metric(x.bestMoves)||x.bestMoves>stage.config.moves||!metric(x.clears)||x.clears<1||x.contentRevision!==stage.contentRevision)throw Error('Invalid challenge record');}
   if(new Set(d.claimedRegions).size!==d.claimedRegions.length||!d.claimedRegions.every(k=>['tide','meadow','sky'].includes(k)&&catalog.stages.filter(s=>s.region===k).every(s=>d.records[s.id]?.bestStars>0)))throw Error('Unproven challenge memento');
   for(const a of d.attempts)if(!plain(a)||typeof a.id!=='string'||!a.id||a.id.length>160||!catalog.get(a.stageId)||!plain(a.result)||!d.records[a.stageId]||a.result.saved!==true||a.result.stageId!==a.stageId||typeof a.result.firstClear!=='boolean'||a.result.duplicate!==false||!Number.isInteger(a.result.stars)||a.result.stars<1||a.result.stars>3||!Number.isInteger(a.result.bestStars)||a.result.bestStars<1||a.result.bestStars>3||!metric(a.result.bestScore))throw Error('Invalid challenge attempt');
   if(new Set(d.attempts.map(a=>a.id)).size!==d.attempts.length)throw Error('Duplicate challenge attempt');
   this.records=clone(d.records);this.claimedRegions=d.claimedRegions.slice();this.attempts=clone(d.attempts);
  }catch(error){this.readOnly=true;this.lastError=String(error.message||error);}
 }
 get blocked(){return this.readOnly||!this.journey||this.journey.readOnly;}
 export(){return {version:VERSION,packId:this.catalog.packId,records:clone(this.records),claimedRegions:this.claimedRegions.slice(),attempts:clone(this.attempts)};}
 _save(){try{if(this.blocked||typeof this.p.save!=='function'||this.p.save(this.key,this.export())===false)throw Error('Challenge save did not succeed');this.lastError=null;return true;}catch(error){this.lastError=String(error.message||error);return false;}}
 isUnlocked(id){const stage=this.catalog.get(id);if(!stage||!stage.qualified||!stage.seedBank?.length||this.blocked)return false;const region=['tide','meadow','sky'].indexOf(stage.region);
  if(!this.journey.records?.[region*4+3]?.bestStars)return false;if(stage.ordinal===1)return true;const previous=this.catalog.stages.find(s=>s.region===stage.region&&s.ordinal===stage.ordinal-1);return !!previous&&!!this.records[previous.id]?.bestStars;
 }
 recordWin(id,details){const stage=this.catalog.get(id),base={saved:false,firstClear:false,duplicate:false};if(!stage)return {...base,reason:'unknown-stage'};if(this.blocked)return {...base,readOnly:true};
  const attemptId=details?.attemptId;if(typeof attemptId!=='string'||!attemptId||attemptId.length>160)return {...base,reason:'attempt-id-required'};
  const oldAttempt=this.attempts.find(a=>a.id===attemptId);if(oldAttempt){if(oldAttempt.stageId!==id)return {...base,reason:'attempt-id-conflict'};return {...clone(oldAttempt.result),saved:true,firstClear:false,duplicate:true};}
  if(!this.isUnlocked(id))return {...base,reason:'locked'};
  if(!metric(details.score)||!metric(details.movesRemaining)||details.totalMoves!==stage.config.moves||details.movesRemaining>details.totalMoves||!stage.seedBank.includes(details.seed))return {...base,reason:'invalid-result'};
  const before=this.export(),previous=this.records[id],ratio=details.movesRemaining/details.totalMoves,stars=1+(ratio>=.25?1:0)+(ratio>=.5?1:0);
  this.records[id]={contentRevision:stage.contentRevision,bestStars:Math.max(previous?.bestStars||0,stars),bestScore:Math.max(previous?.bestScore||0,details.score),bestMoves:Math.max(previous?.bestMoves||0,details.movesRemaining),clears:Math.min(Number.MAX_SAFE_INTEGER,(previous?.clears||0)+1)};
  const result={saved:true,firstClear:!previous,duplicate:false,stageId:id,stars,bestStars:this.records[id].bestStars,bestScore:this.records[id].bestScore};
  this.attempts.push({id:attemptId,stageId:id,result:clone(result)});if(this.attempts.length>ATTEMPT_LIMIT)this.attempts.splice(0,this.attempts.length-ATTEMPT_LIMIT);
  if(!this._save()){this.records=before.records;this.claimedRegions=before.claimedRegions;this.attempts=before.attempts;return {...base,persistenceError:true};}return result;
 }
 claimRegionMemento(region){const duplicate=this.claimedRegions.includes(region),base={claimed:duplicate,duplicate,newlyGranted:[]};if(this.blocked)return {...base,claimed:false,readOnly:true};if(duplicate)return base;
  const stages=this.catalog.stages.filter(s=>s.region===region);if(stages.length!==(this.catalog.perRegion||12)||!stages.every(s=>this.records[s.id]?.bestStars))return base;
  this.claimedRegions.push(region);if(!this._save()){this.claimedRegions.pop();return {...base,persistenceError:true};}return {...base,claimed:true,newlyGranted:[{kind:'challenge-memento',id:region+'-'+this.catalog.packId+'-complete',count:1}]};
 }
}
ChallengeProgress.keyForPack=packId=>{if(typeof packId!=='string'||!/^c[0-9]{2,4}$/.test(packId))throw Error('Invalid challenge pack ID');return 'forest-challenges-'+packId;};ChallengeProgress.KEY=KEY;ChallengeProgress.VERSION=VERSION;ChallengeProgress.ATTEMPT_LIMIT=ATTEMPT_LIMIT;module.exports=ChallengeProgress;
