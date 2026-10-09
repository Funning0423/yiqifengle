(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ForestProgression=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const KEY='forest-v33-journey',PROGRESS='forest-v3-progress',COMPLETED='forest-v3-completed',COUNT=12,ATTEMPT_LIMIT=128,ERROR_LIMIT=24;
const integer=(value,max,fallback=0)=>{if((typeof value!=='number'&&typeof value!=='string')||value==='')return fallback;const n=Number(value);return Number.isFinite(n)&&n>=0?Math.min(max,Math.floor(n)):fallback;};
const metric=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const empty=()=>({bestStars:0,bestScore:null,bestMoves:null,clears:0});
const clone=value=>JSON.parse(JSON.stringify(value));
const LEGACY_TOOLS=['windBell','tideBottle'],REGION_TOOLS=['tideNet','sunSeed','starShears'],TOOLS=LEGACY_TOOLS.concat(REGION_TOOLS);const validRegion=i=>Number.isInteger(i)&&i>=0&&i<3;
const REWARDS=[
 [{kind:'charm',id:'seaRibbon',count:1}], [{kind:'tool',id:'windBell',count:1}],
 [{kind:'tool',id:'tideBottle',count:1}], [{kind:'charm',id:'paperPlane',count:1}],
 [{kind:'tool',id:'windBell',count:1}], [{kind:'tool',id:'tideBottle',count:1}],
 [{kind:'charm',id:'pairedBells',count:1}], [{kind:'tool',id:'tideBottle',count:1}],
 [{kind:'tool',id:'windBell',count:1}], [{kind:'charm',id:'cloudCrown',count:1}],
 [{kind:'tool',id:'tideBottle',count:1}], [{kind:'charm',id:'starBrooch',count:1},{kind:'tool',id:'windBell',count:1}]
];
const validLevel=level=>Number.isInteger(level)&&level>=0&&level<COUNT;

class Progression{
 constructor(platform){
  this.platform=platform||{};this.persistenceErrors=[];this._readOnly=false;
  const read=key=>{try{let value=this.platform.load?this.platform.load(key):null;
   if(value===null||value===undefined||value==='')return{missing:true,value:null};
   if(typeof value==='string'){try{value=JSON.parse(value);}catch(error){if(key===KEY)throw error;}}
   return{missing:false,value};
  }catch(error){this._recordError({operation:'load',key,message:String(error)});return{failed:true,value:null};}};
  const authoritative=read(KEY),loaded=authoritative.value;
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const bounded=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
  const validRecord=r=>object(r)&&bounded(r.bestStars,3)&&bounded(r.clears,Number.MAX_SAFE_INTEGER)&&(r.bestScore===null||metric(r.bestScore)!==null)&&(r.bestMoves===null||metric(r.bestMoves)!==null);
  let valid=object(loaded)&&(loaded.version===undefined||loaded.version===1||loaded.version===2||loaded.version===3);
  if(valid){
   // Accept historical partial record arrays, but do not replace structurally corrupt save data.
   valid=(!('records'in loaded)||(Array.isArray(loaded.records)&&loaded.records.length<=COUNT&&loaded.records.every(r=>r===null||validRecord(r))))&&
    (!('completed'in loaded)||bounded(loaded.completed,COUNT))&&(!('unlocked'in loaded)||bounded(loaded.unlocked,COUNT-1))&&
    ('records'in loaded||'completed'in loaded||'unlocked'in loaded);
   if(loaded.version>=2)valid=valid&&Array.isArray(loaded.records)&&loaded.records.length===COUNT&&loaded.records.every(validRecord)&&Array.isArray(loaded.openedChests)&&loaded.openedChests.every(validLevel)&&
    (!('toolsSpent'in loaded)||(object(loaded.toolsSpent)&&(loaded.version===3?TOOLS:LEGACY_TOOLS).every(id=>bounded(loaded.toolsSpent[id],Number.MAX_SAFE_INTEGER))));
   if(loaded.version!==2&&loaded.version!==3&&('openedChests'in loaded||'toolsSpent'in loaded))valid=false;
   if(loaded.version===3)valid=valid&&Array.isArray(loaded.regionClaims)&&loaded.regionClaims.length===3&&loaded.regionClaims.every(x=>typeof x==='boolean');
  }
  if(authoritative.failed||(!authoritative.missing&&!valid)){
   this._readOnly=true;
   if(!authoritative.failed)this._recordError({operation:'load',key:KEY,message:'Unsupported or corrupt journey data; original save was preserved.'});
  }
  const data=object(loaded)?loaded:{};
  this.records=Array.from({length:COUNT},(_,i)=>{const r=Array.isArray(data.records)&&data.records[i];if(!r||typeof r!=='object')return empty();const stars=integer(r.bestStars,3),clears=integer(r.clears,Number.MAX_SAFE_INTEGER);return stars||clears?{bestStars:Math.max(1,stars),bestScore:metric(r.bestScore),bestMoves:metric(r.bestMoves),clears:Math.max(1,clears)}:empty();});
  // Unlocking level N proves that earlier stages were cleared, but says nothing about performance.
  const legacyProgress=read(PROGRESS),legacyCompletion=read(COMPLETED);
  if(authoritative.missing&&(legacyProgress.failed||legacyCompletion.failed))this._readOnly=true;
  const legacyUnlocked=integer(legacyProgress.value,11),legacyCompleted=integer(legacyCompletion.value,12);
  const knownCompleted=Math.max(legacyUnlocked,legacyCompleted,integer(data.completed,12),integer(data.unlocked,11),this.records.reduce((last,r,i)=>r.bestStars?i+1:last,0));
  for(let i=0;i<knownCompleted;i++)if(!this.records[i].bestStars)this.records[i]={bestStars:1,bestScore:null,bestMoves:null,clears:1};
  this._mementos=new Set(Array.isArray(data.mementos)?data.mementos.filter(id=>Number.isInteger(id)&&id>=0&&id<3):[]);
  this._attempts=new Map();
  if(Array.isArray(data.attempts))for(const entry of data.attempts.slice(-ATTEMPT_LIMIT)){if(entry&&typeof entry.id==='string'&&Number.isInteger(entry.level)&&entry.level>=0&&entry.level<12&&entry.result&&typeof entry.result==='object')this._attempts.set(entry.id,{level:entry.level,result:entry.result});}
  this._refresh();this._award();
  // Old saves prove clears, never claims. Version 2 claims are restricted to earned chests.
  this._opened=new Set(data.version>=2&&Array.isArray(data.openedChests)?data.openedChests.filter(level=>validLevel(level)&&this.records[level].bestStars>0):[]);
  this._regionClaims=Array.from({length:3},(_,i)=>data.version===3&&data.regionClaims?.[i]===true&&this.records[i*4].bestStars>0);
  this._spent=Object.fromEntries(TOOLS.map(id=>[id,0]));
  const grants=this._grants();
  for(const id of TOOLS){
   if(data.version!==2&&data.version!==3)continue;
   const spent=data.toolsSpent&&data.toolsSpent[id];
   if(Number.isSafeInteger(spent)&&spent>=0)this._spent[id]=Math.min(grants.tools[id],spent);
   else if(!Object.prototype.hasOwnProperty.call(data,'toolsSpent')){
    // Transitional v2 saves may carry balances only; clamp them to proven claims.
    const balance=data.inventory&&data.inventory.tools&&data.inventory.tools[id];
    this._spent[id]=grants.tools[id]-(Number.isSafeInteger(balance)&&balance>=0?Math.min(grants.tools[id],balance):0);
   }else this._spent[id]=grants.tools[id]; // Corrupt spend data cannot mint tools.
  }
  this._equipped=typeof data.equippedCharm==='string'&&grants.charms.includes(data.equippedCharm)?data.equippedCharm:null;
  this._save(false);
 }
 _refresh(){this.completed=this.records.filter(r=>r.bestStars>0).length;let frontier=0;while(frontier<COUNT&&this.records[frontier].bestStars>0)frontier++;this.unlocked=Math.min(11,frontier);}
 _award(){const added=[];for(let chapter=0;chapter<3;chapter++)if(this.completed>=(chapter+1)*4&&!this._mementos.has(chapter)){this._mementos.add(chapter);added.push(chapter);}return added;}
 _recordError(error){this.persistenceErrors.push(error);if(this.persistenceErrors.length>ERROR_LIMIT)this.persistenceErrors.splice(0,this.persistenceErrors.length-ERROR_LIMIT);}
 _save(includeLegacy){
  if(this._readOnly)return false;
  const entries=[[KEY,this.export()]];if(includeLegacy)entries.push([PROGRESS,this.unlocked],[COMPLETED,this.completed]);
  for(const [key,value]of entries){try{
   if(typeof this.platform.save!=='function'||this.platform.save(key,value)===false)throw Error('Save did not succeed');
   if(key===KEY)this._authoritativeFailure=false;
  }catch(error){this._recordError({operation:'save',key,message:String(error)});if(key===KEY){this._authoritativeFailure=true;return false;}}}
  return true;
 }
 get readOnly(){return this._readOnly;}
 get retryRequired(){return this._readOnly;}
 get storageWarning(){if(this._readOnly)return 'Saved progress could not be read safely. Rewards and saving are paused. Reload to retry; your existing save has been preserved.';return this._authoritativeFailure?'Progress could not be fully saved. Keep this session open and try again.':null;}
 _grants(){const inventory={tools:Object.fromEntries(TOOLS.map(id=>[id,0])),charms:[]};for(let i=0;i<3;i++)if(this._regionClaims?.[i])inventory.tools[REGION_TOOLS[i]]=1;for(const level of Array.from(this._opened).sort((a,b)=>a-b))for(const reward of REWARDS[level]){if(reward.kind==='tool')inventory.tools[reward.id]+=reward.count;else if(!inventory.charms.includes(reward.id))inventory.charms.push(reward.id);}return inventory;}
 get inventory(){const inventory=this._grants();for(const id of TOOLS)inventory.tools[id]-=this._spent[id];return inventory;}
 get equippedCharm(){return this._equipped;}
 chests(){return REWARDS.map((rewards,level)=>({level,earned:this.records[level].bestStars>0,opened:this._opened.has(level),rewards:clone(rewards)}));}
 openChest(level){
  if(!validLevel(level))throw new RangeError('Level must be an integer from 0 to 11.');
  const duplicate=this._opened.has(level),result={level,rewards:[],newlyGrantedRewards:[],duplicate,opened:duplicate};
  if(this._readOnly)return{...result,persistenceError:true,readOnly:true};
  if(duplicate||!this.records[level].bestStars)return result;
  this._opened.add(level);
  // Claims and use commit only if the authoritative save succeeds; never show a reward that can be claimed again on reload.
  if(!this._save(false)){this._opened.delete(level);return{...result,persistenceError:true};}
  return{...result,rewards:clone(REWARDS[level]),newlyGrantedRewards:clone(REWARDS[level]),opened:true};
 }
 regionUnlocked(region){return validRegion(region)&&this.records[region*4].bestStars>0;}
 regionClaimed(region){return validRegion(region)&&this._regionClaims[region]===true;}
 claimRegion(region){
  const duplicate=this.regionClaimed(region),base={region,claimed:duplicate,duplicate,newlyGrantedRewards:[]};
  if(this._readOnly)return {...base,claimed:false,persistenceError:true,readOnly:true};
  if(!this.regionUnlocked(region)||duplicate)return base;
  this._regionClaims[region]=true;
  if(!this._save(false)){this._regionClaims[region]=false;return {...base,persistenceError:true};}
  return {...base,claimed:true,newlyGrantedRewards:[{kind:'tool',id:REGION_TOOLS[region],count:1}]};
 }
 equipCharm(id){if(this._readOnly)return false;if(id!==null&&!this.inventory.charms.includes(id))return false;const previous=this._equipped;this._equipped=id;if(!this._save(false)){this._equipped=previous;return false;}return true;}
 consumeTool(id){if(this._readOnly)return false;if(!TOOLS.includes(id)||this.inventory.tools[id]<1)return false;this._spent[id]++;if(!this._save(false)){this._spent[id]--;return false;}return true;}
 totalStars(){return this.records.reduce((sum,r)=>sum+r.bestStars,0);}
 mementos(){return Array.from({length:3},(_,chapter)=>({chapter,unlocked:this._mementos.has(chapter),completedCount:this.records.slice(chapter*4,chapter*4+4).filter(r=>r.bestStars>0).length,total:4,unlockedAt:(chapter+1)*4}));}
 export(){return{version:3,regionClaims:this._regionClaims.slice(),openedChests:Array.from(this._opened).sort((a,b)=>a-b),toolsSpent:{...this._spent},inventory:this.inventory,equippedCharm:this._equipped,unlocked:this.unlocked,completed:this.completed,records:clone(this.records),mementos:Array.from(this._mementos).sort(),attempts:Array.from(this._attempts).map(([id,entry])=>({id,level:entry.level,result:clone(entry.result)}))};}
 recordWin(level,details){
  if(!Number.isInteger(level)||level<0||level>=COUNT)throw new RangeError('Level must be an integer from 0 to 11.');
  if(level>this.unlocked)throw new RangeError('Cannot complete a locked level.');
  if(this._readOnly)return{earnedStars:1,previousStars:this.records[level].bestStars,improvement:0,newMementos:[],totalStars:this.totalStars(),duplicate:false,chestAwarded:false,newChest:null,persistenceError:true,readOnly:true};
  details=details||{};const id=typeof details.attemptId==='string'&&details.attemptId.length?details.attemptId:null;
  if(id&&this._attempts.has(id)){const previous=this._attempts.get(id);if(previous.level!==level)throw new Error('Attempt ID already belongs to another level.');return{...clone(previous.result),newMementos:[],chestAwarded:false,newChest:null,totalStars:this.totalStars(),duplicate:true};}
  if(level>this.unlocked)throw new RangeError('Cannot complete a locked level.');
  const backup={records:clone(this.records),mementos:new Set(this._mementos),attempts:new Map(this._attempts)};
  const r=this.records[level],previousStars=r.bestStars,previousScore=r.bestScore,score=metric(details.score),moves=metric(details.movesRemaining),total=metric(details.totalMoves);
  // Invalid or impossible move counts never manufacture performance stars.
  const ratio=total!==null&&total>0&&moves!==null&&moves<=total?moves/total:0;
  const earnedStars=1+(ratio>=.25?1:0)+(ratio>=.5?1:0);
  r.bestStars=Math.max(r.bestStars,earnedStars);if(score!==null)r.bestScore=r.bestScore===null?score:Math.max(r.bestScore,score);if(moves!==null&&total!==null&&moves<=total)r.bestMoves=r.bestMoves===null?moves:Math.max(r.bestMoves,moves);r.clears=Math.min(Number.MAX_SAFE_INTEGER,r.clears+1);
  this._refresh();const result={chestAwarded:previousStars===0,newChest:previousStars===0?level:null,earnedStars,previousStars,previousScore,bestScore:r.bestScore,scoreImproved:score!==null&&(previousScore===null||score>previousScore),improvement:r.bestStars-previousStars,newMementos:this._award(),totalStars:this.totalStars(),duplicate:false};
  if(id)this._attempts.set(id,{level,result:clone(result)});
  while(this._attempts.size>ATTEMPT_LIMIT)this._attempts.delete(this._attempts.keys().next().value);
  if(!this._save(true)){this.records=backup.records;this._mementos=backup.mementos;this._attempts=backup.attempts;this._refresh();return{...result,chestAwarded:false,newChest:null,newMementos:[],improvement:0,scoreImproved:false,bestScore:previousScore,totalStars:this.totalStars(),persistenceError:true};}
  return result;
 }
}
Progression.KEY=KEY;Progression.REGION_TOOLS=REGION_TOOLS;Progression.SAVE_VERSION=3;Progression.ATTEMPT_LIMIT=ATTEMPT_LIMIT;Progression.ERROR_LIMIT=ERROR_LIMIT;return Progression;
});
