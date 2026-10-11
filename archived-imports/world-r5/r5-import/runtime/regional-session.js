'use strict';
// Additive regional rules. The compatibility Engine is vendored byte-for-byte.
// Internal Engine methods are only called here, never from a renderer.
var Engine = require('./vendor/engine');
var serial = 0;
function copy(x) { return JSON.parse(JSON.stringify(x)); }
function freeze(x) { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.keys(x).forEach(function(k){freeze(x[k]);}); Object.freeze(x); } return x; }
function rng(seed) { var f=function(){f.state=(Math.imul(f.state,1664525)+1013904223)>>>0;return f.state/4294967296;};f.state=seed>>>0;return f; }
function validIndex(i) { return Number.isInteger(i) && i>=0 && i<49; }
function neighbors(i) { return [i,i%7?i-1:-1,i%7<6?i+1:-1,i>=7?i-7:-1,i<42?i+7:-1].filter(validIndex); }
function goalKey(region) { return region==='tide'?'pearls':region==='meadow'?'blooms':'relays'; }
function signature(stage) { return JSON.stringify([stage.id,stage.contentRevision,stage.config,stage.rules,stage.tool]); }
function RegionalSession(stage, seed, options) {
 options=options||{};
 if(!stage || !['tide','meadow','sky'].includes(stage.region))throw Error('Unknown region');
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid seed');
 if(!options.authoring && !stage.seedBank.includes(seed))throw Error('Seed has no shipped witness');
 this.stage=freeze(copy(stage));this.seed=seed;this.random=rng(seed);this.actions=[];this.clock=0;this.hold=0;this.toolCharges=stage.tool.charges;this.tokenSerial=0;this.instance=++serial;this.pending=null;this.frames=[];
 this.pieces=copy(stage.rules.shells||stage.rules.blooms||stage.rules.relays).map(function(p){p.progress=0;p.done=false;p.shifted=false;return p;});
 this.cursor=0;var config=copy(stage.config);config.goals[goalKey(stage.region)]=this.pieces.length;
 this.engine=new Engine(0,this.random,config);this.engine.bombs=0;
}
RegionalSession.prototype.phase=function(){var r=this.stage.rules,cycle=r.phaseCycle||r.windCycle||r.polarityCycle;return cycle[this.clock%cycle.length];};
RegionalSession.prototype._export=function(){var e=this.engine;return {board:copy(e.board),moves:e.moves,goals:copy(e.goals),score:e.score,status:e.status,moss:Array.from(e.moss).sort(function(a,b){return a-b;}),roots:Array.from(e.roots).sort(function(a,b){return a[0]-b[0];}),nextId:e._nextId,version:e._version,random:this.random.state,clock:this.clock,hold:this.hold,charges:this.toolCharges,pieces:copy(this.pieces),cursor:this.cursor};};
RegionalSession.prototype.fork=function(){var s=Object.create(RegionalSession.prototype),e=this.engine;Object.keys(this).forEach(function(k){s[k]=this[k];},this);s.actions=this.actions.map(function(a){return a.slice();});s.pieces=copy(this.pieces);s.frames=[];s.pending=null;s.random=rng(this.random.state);s.engine=Object.create(Engine.prototype);Object.keys(e).forEach(function(k){s.engine[k]=e[k];});s.engine.board=copy(e.board);s.engine.goals=copy(e.goals);s.engine.initialGoals=copy(e.initialGoals);s.engine.moss=new Set(e.moss);s.engine.vines=s.engine.moss;s.engine.roots=new Map(e.roots);s.engine._random=s.random;s.engine._hintCache=null;s.engine._pendingPlan=null;return s;};
RegionalSession.prototype.snapshot=function(){var e=this.engine;return freeze({schemaVersion:1,packId:'regional-r05',stageId:this.stage.id,region:this.stage.region,seed:this.seed,turn:this.actions.length,board:copy(e.board),moves:e.moves,goals:copy(e.goals),status:e.status,score:e.score,moss:Array.from(e.moss),roots:Array.from(e.roots),pieces:copy(this.pieces),activeRelay:this.stage.region==='sky'?this.cursor:null,scene:{phase:this.phase(),clock:this.clock,heldTurns:this.hold},tool:{kind:this.stage.tool.kind,charges:this.toolCharges},frames:copy(this.frames)});};
RegionalSession.prototype._valid=function(a){var e=this.engine;if(!Array.isArray(a)||!e._canStart())return false;
 if(a[0]==='swap'&&a.length===3)return e.planSwap(a[1],a[2]).valid;
 if(a[0]==='activate'&&a.length===2)return e.planActivation(a[1]).valid;
 if(a[0]!=='tool'||this.toolCharges<1||a[1]!==this.stage.tool.kind)return false;
 if(a[1]==='tideAnchor')return a.length===2 && this.hold===0;
 if(a[1]==='sunSeed')return a.length===3&&validIndex(a[2])&&!e.board[a[2]].special;
 if(a[1]==='prismShift')return a.length===2&&this.cursor<this.pieces.length&&!this.pieces[this.cursor].shifted;
 return false;
};
RegionalSession.prototype.legalActions=function(options){var e=this.engine,a=e.possibleMoves().map(function(x){return ['swap',x[0],x[1]];});e.possibleActivations().forEach(function(i){a.push(['activate',i]);});
 if(!e._canStart())return [];
 if(!options||options.tools!==false){if(this.stage.tool.kind==='sunSeed'){for(var i=0;i<49;i++)if(this._valid(['tool','sunSeed',i]))a.push(['tool','sunSeed',i]);}else{var t=['tool',this.stage.tool.kind];if(this._valid(t))a.push(t);}}return a;
};
RegionalSession.prototype.preview=function(action){if(!this._valid(action))return freeze({ok:false,reason:'illegal-action'});var token='r5:'+this.instance+':'+(++this.tokenSerial);this.pending={token:token,action:action.slice(),state:JSON.stringify(this._export())};return freeze({ok:true,token:token,action:action.slice(),moveCost:1,phase:this.phase()});};
RegionalSession.prototype.cancelPreview=function(){this.pending=null;};
RegionalSession.prototype.commit=function(token){var p=this.pending;if(!p||p.token!==token||p.state!==JSON.stringify(this._export()))return freeze({ok:false,reason:'stale-preview'});this.pending=null;
 // Run on an isolated fork: rejected/failed rules cannot partially spend a move.
 var trial=this.fork();try{if(!trial._act(p.action))return freeze({ok:false,reason:'illegal-action'});}catch(error){return freeze({ok:false,reason:'resolution-error',detail:String(error.message||error)});}
 this.engine=trial.engine;this.random=trial.random;this.actions=trial.actions;this.clock=trial.clock;this.hold=trial.hold;this.toolCharges=trial.toolCharges;this.pieces=trial.pieces;this.cursor=trial.cursor;this.frames=trial.frames;return freeze({ok:true,snapshot:this.snapshot()});
};
RegionalSession.prototype.act=function(action){var p=this.preview(action);return p.ok?this.commit(p.token).ok:false;};
RegionalSession.prototype._regional=function(wave){var s=this,events=[],effects=[],phase=this.phase(),region=this.stage.region,removed=wave.removed;
 if(region==='tide')this.pieces.forEach(function(p){if(p.done||!removed.some(function(t){return t.index===p.index;}))return;
  if(phase==='ebb'&&p.progress<p.layers){p.progress++;events.push({kind:'shell-cracked',index:p.index,remaining:p.layers-p.progress});}
  else if(phase==='flood'&&p.progress===p.layers){p.done=true;events.push({kind:'pearl-collected',index:p.index});effects.push({kind:'tide-jet',index:p.index,cells:Array.from(s.engine._area('column',p.index))});}
 });
 else if(region==='meadow')this.pieces.forEach(function(p){if(p.done)return;var desired=p.pollen[p.progress];var valid=removed.some(function(t){var near=phase==='horizontal'?Math.floor(t.index/7)===Math.floor(p.index/7)&&Math.abs(t.index-p.index)<=1:t.index%7===p.index%7&&Math.abs(t.index-p.index)<=7;return near&&t.type===desired;});
  if(!valid)return;p.progress++;events.push({kind:'pollen-delivered',index:p.index,type:desired,step:p.progress});if(p.progress===p.pollen.length){p.done=true;events.push({kind:'bloom-opened',index:p.index});effects.push({kind:'wind-burst',index:p.index,axis:phase,cells:Array.from(s.engine._area(phase==='horizontal'?'row':'column',p.index))});}
 });
 else if(this.cursor<this.pieces.length){var p=this.pieces[this.cursor];if(phase===p.polarity&&removed.some(function(t){return t.index===p.index&&(p.type===undefined||t.type===p.type);})){p.progress++;events.push({kind:'relay-charged',index:p.index,step:p.progress});if(p.progress===p.hits){p.done=true;this.cursor++;events.push({kind:'relay-linked',index:p.index,partner:p.partner});effects.push({kind:'portal-echo',index:p.partner,cells:neighbors(p.partner)});}}}
 this.engine.goals[goalKey(region)]=this.pieces.filter(function(p){return !p.done;}).length;return {events:events,effects:effects};
};
RegionalSession.prototype._act=function(a){if(!this._valid(a))return false;var e=this.engine,phase=this.phase(),frames=[],queue=[],s=this;
 if(a[0]==='tool'){
  e.moves--;this.toolCharges--;e._version++;
  if(a[1]==='tideAnchor'){this.hold=2;frames.push({kind:'tool',tool:a[1],phase:phase,heldTurns:2});}
  else if(a[1]==='sunSeed'){e.board[a[2]].special='column';frames.push({kind:'tool',tool:a[1],index:a[2],tile:copy(e.board[a[2]])});}
  else{var p=this.pieces[this.cursor],from=p.index;p.index=p.partner;p.partner=from;p.shifted=true;frames.push({kind:'tool',tool:a[1],relay:this.cursor,from:from,to:p.index});}
 }else{
  var before=copy(e.board),accepted=a[0]==='swap'?e.swap(a[1],a[2]):e.activate(a[1]);if(!accepted)return false;
  frames.push({kind:'action',action:a.slice(),before:before,after:copy(e.board)});
  var rounds=0;
  while(true){var wave;
   // Normal cascades settle before queued regional effects. All effects then
   // use the board which is actually visible after those drops.
   wave=e.nextWave();
   if(!wave.indexes.size){if(!queue.length)break;var effect=queue.shift();wave=e._buildPlan(new Set(effect.cells),[],[copy(effect)],[],effect.kind);e._pendingPlan=wave;}
   if(++rounds>64)throw Error('Regional cascade cap exceeded');
   var display={kind:'clear',wave:{kind:wave.kind,removed:copy(wave.removed),created:copy(wave.created),effects:copy(wave.effects),obstacleHits:copy(wave.obstacleHits)},before:copy(e.board)};
   if(!e.clearWave(wave))throw Error('Base engine rejected regional wave');
   var regional=this._regional(wave);queue=queue.concat(regional.effects);display.events=regional.events;display.goalsAfter=copy(e.goals);display.piecesAfter=copy(this.pieces);display.after=copy(e.board);frames.push(display);
   var drops=e.fall();frames.push({kind:'drop',changes:copy(drops),board:copy(e.board)});
  }
  if(this.hold>0)this.hold--;else this.clock++;
 }
 e.settleDone();if(e.lastShuffle)frames.push({kind:'shuffle',changes:copy(e.lastShuffle),board:copy(e.board)});e.lastShuffle=null;
 frames.push({kind:'scene',before:phase,after:this.phase(),heldTurns:this.hold});this.actions.push(a.slice());this.frames=frames;return true;
};
RegionalSession.prototype.checkpoint=function(){return freeze({version:1,packId:'regional-r05',stageId:this.stage.id,contentRevision:this.stage.contentRevision,contentSignature:signature(this.stage),seed:this.seed,actions:this.actions.map(function(a){return a.slice();}),expectedState:JSON.stringify(this._export())});};
RegionalSession.restore=function(stage,data,options){if(!data||data.version!==1||data.packId!=='regional-r05'||data.stageId!==stage.id||data.contentRevision!==stage.contentRevision||data.contentSignature!==signature(stage)||!Array.isArray(data.actions)||data.actions.length>stage.config.moves||typeof data.expectedState!=='string'||data.expectedState.length>30000)throw Error('Incompatible checkpoint');
 var s=new RegionalSession(stage,data.seed,options);for(var i=0;i<data.actions.length;i++)if(!s.act(data.actions[i]))throw Error('Illegal checkpoint action');if(JSON.stringify(s._export())!==data.expectedState)throw Error('Checkpoint replay mismatch');s.frames=[];return s;
};
RegionalSession.copy=copy;RegionalSession.freeze=freeze;RegionalSession.goalKey=goalKey;module.exports=RegionalSession;
