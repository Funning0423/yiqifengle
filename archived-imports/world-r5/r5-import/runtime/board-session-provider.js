'use strict';
// Board-only R4-shaped seam. It owns no book navigation, progression or rewards.
var API=require('./index'),Session=require('./regional-session');var nextProvider=0;
var KEY='forest-regional-r05-active';
function clone(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
function serial(x){return x===undefined?'undefined':JSON.stringify(x);}
function thenable(x){if(x&&typeof x.then==='function'){if(typeof x.catch==='function')x.catch(function(){});return true;}return false;}
function BoardSessionProvider(options){options=options||{};this.platform=options.platform;this.session=null;this.readOnly=false;this.error=null;this.dirty=null;this.frames=[];this.frameIndex=0;this.generation=0;this.id=++nextProvider;this.hidden=false;this.paused=true;this.disk=undefined;this.revision=0;
 if(!this.platform||typeof this.platform.load!=='function'||typeof this.platform.save!=='function')throw Error('Synchronous load/save platform required');
 try{var raw=this.platform.load(KEY);if(thenable(raw))throw Error('Async storage is unsupported');this.disk=clone(raw);var record=typeof raw==='string'?JSON.parse(raw):raw;
  if(record!==undefined&&record!==null){if(!record||record.version!==1||record.packId!=='regional-r05'||!Number.isSafeInteger(record.revision)||record.revision<1||!record.checkpoint||!(record.pendingAction===null||Array.isArray(record.pendingAction)))throw Error('Unknown or corrupt active record');
   this.session=API.restore(record.checkpoint);this.revision=record.revision;if(options.stageId&&options.stageId!==this.session.stage.id)throw Error('A different active regional stage must be explicitly closed first');
   if(record.pendingAction){if(!this.session.act(record.pendingAction))throw Error('Invalid durable action intent');this.dirty=this._record(null);this.error={code:'recovered-intent-needs-save',retryable:true};}
  }else{this.session=API.createSession(options.stageId,options.seed);this.dirty=this._record(null);if(this._write(this.dirty)){this.dirty=null;this.paused=false;}}
 }catch(e){this.readOnly=true;this.error={code:'preserved-data-error',detail:String(e.message||e),retryable:false};}
}
BoardSessionProvider.KEY=KEY;
BoardSessionProvider.prototype._record=function(action){return {version:1,packId:'regional-r05',revision:this.revision+1,checkpoint:clone(this.session.checkpoint()),pendingAction:action? action.slice():null};};
BoardSessionProvider.prototype._write=function(record){if(this.readOnly)return false;var current;
 try{current=this.platform.load(KEY);if(thenable(current))throw Error('Async read');if(serial(current)!==serial(this.disk)){this.readOnly=true;this.error={code:'concurrent-write',retryable:false};return false;}
  var result;try{result=this.platform.save(KEY,clone(record));}catch(e){}if(thenable(result))throw Error('Async write');var back=this.platform.load(KEY);if(thenable(back))throw Error('Async read-back');
  var decoded=typeof back==='string'?JSON.parse(back):back;
  if(serial(decoded)===serial(record)){this.disk=clone(back);this.revision=record.revision;this.error=null;return true;}
  if(serial(back)===serial(this.disk)){this.error={code:'save-failed',retryable:true};return false;}
  this.readOnly=true;this.error={code:'unexpected-stored-data',retryable:false};return false;
 }catch(e){this.readOnly=true;this.error={code:'unverifiable-storage',detail:String(e.message||e),retryable:false};return false;}
};
BoardSessionProvider.prototype._state=function(){if(this.readOnly)return 'error.readonly';if(this.dirty)return 'run.unsaved';if(!this.session)return 'error.readonly';if(this.frames.length)return 'run.resolving';if(this.session.engine.status!=='playing')return 'result.session-saved';return this.paused||this.hidden?'run.paused':'run.ready';};
BoardSessionProvider.prototype.snapshot=function(){var snap=this.session?this.session.snapshot():null,visual=null;if(this.frames.length){visual=clone(this.frames[this.frameIndex]);visual.token='r5v:'+this.id+':'+this.generation+':'+this.frameIndex;if(visual.kind==='action'&&visual.action[0]==='swap')visual.tiles=[{id:visual.before[visual.action[1]].id,from:visual.action[1],to:visual.action[2]},{id:visual.before[visual.action[2]].id,from:visual.action[2],to:visual.action[1]}];}
 var active=snap?{stageId:snap.stageId,region:snap.region,theme:{tide:'seaBeach',meadow:'orchard',sky:'autumn'}[snap.region],seed:snap.seed,board:snap.board,goals:snap.goals,moves:snap.moves,score:snap.score,status:snap.status,moss:snap.moss,roots:snap.roots,bombs:0,regionPieces:snap.pieces,scene:snap.scene,tool:snap.tool}:null;
 return Session.freeze({provider:'regional-r05',storageKey:KEY,state:this._state(),active:active,visual:visual,hidden:this.hidden,error:clone(this.error),result:snap&&snap.status!=='playing'?{outcome:snap.status,sessionSaved:!this.dirty&&!this.readOnly,completionRecorded:false}:null});
};
BoardSessionProvider.prototype.previewAction=function(action){if(this._state()!=='run.ready')return {ok:false,reason:'input-disabled'};return this.session.preview(action);};
BoardSessionProvider.prototype.cancelPreview=function(token){var p=this.session&&this.session.pending;if(this._state()!=='run.ready'||!p||p.token!==token)return {ok:false,reason:'stale-token'};this.session.cancelPreview();return {ok:true};};
BoardSessionProvider.prototype.commitAction=function(token){if(this._state()!=='run.ready')return {ok:false,reason:'input-disabled'};var p=this.session.pending;if(!p||p.token!==token||p.state!==JSON.stringify(this.session._export()))return {ok:false,reason:'stale-token'};
 var intent=this._record(p.action);if(!this._write(intent))return {ok:false,reason:this.error.code};var done=this.session.commit(token);if(!done.ok){this.readOnly=true;this.error={code:'durable-intent-resolution-error',retryable:false};return done;}
 this.dirty=this._record(null);if(!this._write(this.dirty)){this.paused=true;return {ok:true,saved:false,reason:this.error.code};}this.dirty=null;this.frames=clone(this.session.frames);this.frameIndex=0;this.generation++;return {ok:true,saved:true};
};
BoardSessionProvider.prototype.finishVisualStep=function(token){var v=this.snapshot().visual;if(!v||v.token!==token)return {ok:false,reason:'stale-token'};this.frameIndex++;if(this.frameIndex>=this.frames.length){this.frames=[];this.frameIndex=0;this.generation++;}return {ok:true};};
BoardSessionProvider.prototype.pause=function(){if(this.session)this.session.cancelPreview();this.frames=[];this.frameIndex=0;this.generation++;this.paused=true;return {ok:!this.dirty&&!this.readOnly};};
BoardSessionProvider.prototype.onHide=function(){this.hidden=true;return this.pause();};
BoardSessionProvider.prototype.onShow=function(){this.hidden=false;return {ok:true};};
BoardSessionProvider.prototype.resume=function(){if(this.hidden||this.dirty||this.readOnly||!this.session)return {ok:false,reason:'resume-blocked'};this.paused=false;return {ok:true};};
BoardSessionProvider.prototype.requestExit=function(){return this.pause();};
BoardSessionProvider.prototype.retrySave=function(){if(this.readOnly||!this.dirty)return {ok:false,reason:'nothing-retryable'};if(!this._write(this.dirty))return {ok:false,reason:this.error.code};this.dirty=null;this.paused=true;return {ok:true};};
module.exports=BoardSessionProvider;
