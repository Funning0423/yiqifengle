/* QF_AUTOPLAY test harness (GGbot, b17r16). TEST BUILDS ONLY.
 * inject.cjs copies this file into a WeChat build output and puts `require('./qf-autoplay.js')` as the FIRST line of
 * game.js, so it runs before the Cocos adapter/engine call wx.onTouchStart/Move/End/Cancel. It records those
 * listeners (forwarding to the real wx unchanged) and replays synthetic raw wx touch events into exactly the listeners a
 * real finger reaches: Cocos input -> node hit-test / swallowing (e.g. IslandLighthouseTouch) -> ExploreInput, plus raw
 * wx listeners (IslandHomeInteraction.listenRaw). No game logic API is called to perform an action.
 * Release builds never contain this file (check-release.cjs fails on any QF_AUTOPLAY marker). Second gate at runtime:
 * refuses when wx envVersion is 'release'. No on-screen marker is drawn. */
(function(){
'use strict';
var g=typeof GameGlobal!=='undefined'?GameGlobal:globalThis;var wx=g.wx;
var DESIGN_W=390,DESIGN_H=844,MAX_SHOTS=20,SHOT_W=195,SHOT_Q=0.6,LOG_CAP=2*1024*1024,STATE_CAP=2*1024*1024,STEP_CAP=500;
var OPS={tap:['x','y'],drag:['x1','y1','x2','y2','ms'],wait:['ms'],waitState:['name'],screenshot:['name'],preTransition:['key'],preT:['key']};
function parseScript(text){
  var s=typeof text==='string'?JSON.parse(text):text;
  if(!s||typeof s!=='object'||!Array.isArray(s.steps))throw Error('script must be {"steps":[...]}');
  if(s.steps.length>STEP_CAP)throw Error('too many steps (max '+STEP_CAP+')');
  if(s.launchQuery!=null&&!/^\?[A-Za-z0-9=&_-]*$/.test(String(s.launchQuery)))throw Error('bad launchQuery');
  var shots=0;
  var steps=s.steps.map(function(st,i){
    var op=st&&st.op,need=OPS[op];if(!need)throw Error('step '+i+': unknown op '+op);
    need.forEach(function(k){if(k==='name'){if(typeof st.name!=='string'||!/^[A-Za-z0-9:_.-]{1,40}$/.test(st.name))throw Error('step '+i+': bad name');}
      else if(k==='key'){}else if(typeof st[k]!=='number'||!isFinite(st[k]))throw Error('step '+i+': '+k+' must be a number');});
    if(op==='tap'||op==='drag'){['x','x1','x2'].forEach(function(k){if(k in st&&(st[k]<0||st[k]>DESIGN_W))throw Error('step '+i+': '+k+' outside 0..390');});
      ['y','y1','y2'].forEach(function(k){if(k in st&&(st[k]<0||st[k]>DESIGN_H))throw Error('step '+i+': '+k+' outside 0..844');});}
    if((op==='wait'&&(st.ms<0||st.ms>600000))||(op==='drag'&&(st.ms<16||st.ms>10000)))throw Error('step '+i+': ms out of range');
    if(op==='waitState'&&st.timeoutMs!=null&&(typeof st.timeoutMs!=='number'||st.timeoutMs<0||st.timeoutMs>600000))throw Error('step '+i+': bad timeoutMs');
    if((op==='preTransition'||op==='preT')){if(!/^[a-z0-9-]{1,40}$/.test(String(st.key)))throw Error('step '+i+': bad key');
      ['timeoutMs','recordMs'].forEach(function(k){if(st[k]!=null&&(typeof st[k]!=='number'||st[k]<0||st[k]>600000))throw Error('step '+i+': bad '+k);});}
    if(op==='screenshot'&&++shots>MAX_SHOTS)throw Error('more than '+MAX_SHOTS+' screenshots');
    var o={op:op==='preT'?'preTransition':op};for(var k in st)if(k!=='op')o[k]=st[k];return o;});
  return {launchQuery:s.launchQuery||null,allowConsoleErrors:s.allowConsoleErrors===true,stateEveryMs:Math.max(500,Number(s.stateEveryMs)||2000),steps:steps};
}
/* design (390x844, top-left origin, y down) -> wx clientX/Y (window CSS px). Per-axis scale; identity on a 390x844 device. */
function toClient(x,y,win){return {x:x*win.w/DESIGN_W,y:y*win.h/DESIGN_H};}
function dragPoints(st,frameMs){var n=Math.max(2,Math.round(st.ms/(frameMs||16))),p=[];for(var i=1;i<=n;i++){var t=i/n;p.push([st.x1+(st.x2-st.x1)*t,st.y1+(st.y2-st.y1)*t]);}return p;}
function stateNames(snap){var n=[];if(!snap)return n;if(snap.state)n.push(String(snap.state));if(snap.region)n.push('region:'+snap.region);if(snap.phase)n.push('phase:'+snap.phase);if(snap.exploreOpen)n.push('explore');if(snap.lakesideMark)n.push('lakeside:'+snap.lakesideMark);return n;}
/* touch recorder: must be installed before the engine registers listeners */
function installTouch(w){
  var L={},ok=true;['TouchStart','TouchMove','TouchEnd','TouchCancel'].forEach(function(k){var on=w['on'+k],off=w['off'+k],set=L[k]=[];
    if(typeof on!=='function'){ok=false;return;}
    var onW=function(f){if(typeof f==='function'&&set.indexOf(f)<0)set.push(f);return on.apply(w,arguments);};
    var offW=function(f){if(typeof f==='function'){var i=set.indexOf(f);if(i>=0)set.splice(i,1);}else set.length=0;return typeof off==='function'?off.apply(w,arguments):undefined;};
    try{w['on'+k]=onW;w['off'+k]=offW;}catch(e){}if(w['on'+k]!==onW)ok=false;});
  var id=900;
  return {ok:ok,listeners:L,nextId:function(){return ++id;},emit:function(k,x,y,tid){var t={identifier:tid,clientX:x,clientY:y,pageX:x,pageY:y,force:1};
    var ev={touches:(k==='TouchEnd'||k==='TouchCancel')?[]:[t],changedTouches:[t],timeStamp:Date.now()};var l=(L[k]||[]).slice();
    for(var i=0;i<l.length;i++){try{l[i](ev);}catch(e){console.error('[QF_AUTOPLAY] listener error',e&&e.message);}}return l.length;}};
}
var api={parseScript:parseScript,toClient:toClient,dragPoints:dragPoints,stateNames:stateNames,installTouch:installTouch,DESIGN_W:DESIGN_W,DESIGN_H:DESIGN_H,MAX_SHOTS:MAX_SHOTS,qfSer:qfSer};
if(typeof module!=='undefined'&&module.exports&&!wx){module.exports=api;return;}
if(!wx||g.__QF_AUTOPLAY)return;
try{var env=wx.getAccountInfoSync&&wx.getAccountInfoSync().miniProgram.envVersion;if(env==='release'){return;}}catch(e){}
var fs=wx.getFileSystemManager(),ROOT=wx.env.USER_DATA_PATH+'/qf-autoplay',OUT=ROOT+'/out',script=null,err=null;
function rd(p){try{return fs.readFileSync(p,'utf8');}catch(e){return null;}}
var text=rd(ROOT+'/script.json')||rd('qf-autoplay/script.json');
if(!text)return; /* no script -> harness idle, game unchanged */
try{script=parseScript(text);}catch(e){err=e.message;}
try{fs.rmdirSync(OUT,true);}catch(e){}try{fs.mkdirSync(OUT+'/shots',true);}catch(e){}
var logBuf=[],logBytes=0,stateBytes=0;
/* r2 (chainJ P0): every write during gameplay is ASYNC and serialized (one in flight, FIFO). The old appendFileSync from
 * setInterval(flush)/writeState was a synchronous appservice IPC every 1-2 s, same class as the toTempFilePathSync freeze. */
var wq=[],wBusy=false;
function w2(file,s){wq.push([OUT+'/'+file,s]);pump();}
function pump(){if(wBusy||!wq.length)return;wBusy=true;var it=wq.shift(),p=it[0],s=it[1];
  var done=function(){wBusy=false;pump();};
  var put=function(){try{fs.writeFile({filePath:p,data:s,encoding:'utf8',success:done,fail:done});}catch(x){done();}};
  try{fs.appendFile({filePath:p,data:s,encoding:'utf8',success:done,fail:put});}catch(e){put();}}
function flush(){if(!logBuf.length)return;var s=logBuf.join('');logBuf=[];if(logBytes>LOG_CAP)return;logBytes+=s.length;w2('console.log',s+(logBytes>LOG_CAP?'[QF_AUTOPLAY] log cap reached\n':''));}
var consoleErrors=0,errorSamples=[];
function qfSer(v){if(typeof v==='string')return v;if(v&&typeof v==='object'&&(v instanceof Error||(typeof v.message==='string'&&('stack' in v||'name' in v)))){return (v.name||'Error')+': '+v.message+(v.stack?'\n'+v.stack:'');}try{var j=JSON.stringify(v);if(j==='{}'&&v&&typeof v==='object'){var t=String(v);if(t!=='[object Object]')return t;}return j;}catch(e){return String(v);}}
['log','info','warn','error'].forEach(function(lv){var o=console[lv];console[lv]=function(){try{var a=[].slice.call(arguments).map(qfSer).join(' ');logBuf.push(new Date().toISOString()+' '+lv+' '+a.slice(0,4000)+'\n');if(a.indexOf('[OI_HUD] suppressed')>=0&&a.indexOf('"kind":"error"')>=0)noteFail('hudSuppressed',a.slice(a.indexOf('[OI_HUD]')));if(lv==='error'&&a.indexOf('[QF_AUTOPLAY]')!==0){consoleErrors++;if(errorSamples.length<5)errorSamples.push(a.slice(0,300));}}catch(e){}return o.apply(console,arguments);};});
var tick=setInterval(flush,1000);
/* run failures that never reach console.error: journey phase=failed, snapshot world/journey error, wx.onError / unhandled rejections, HUD-suppressed errors */
var gameFail={journeyFailed:[],snapshotErrors:[],uncaught:[],hudSuppressed:[]};function noteFail(k,t){t=String(t).slice(0,300);var l=gameFail[k];if(l.indexOf(t)<0&&l.length<10)l.push(t);}
try{wx.onError&&wx.onError(function(r){var m=r&&typeof r==='object'?((r.message||'')+(r.stack?'\n'+r.stack:'')):qfSer(r);console.error('[QF_AUTOPLAY] wx.onError '+m);noteFail('uncaught',m||qfSer(r));});}catch(e){}
try{wx.onUnhandledRejection&&wx.onUnhandledRejection(function(r){var x=r&&r.reason;var m='unhandledrejection: '+qfSer(x);console.error('[QF_AUTOPLAY] '+m);noteFail('uncaught',m);});}catch(e){}
function scanState(s){if(!s)return;try{var w=s.world||{},j=w.journey||{};if(s.journeyPhase==='failed'||j.phase==='failed')noteFail('journeyFailed',(j.region||'?')+'>'+(j.target||'?')+': '+(j.error||w.error||'failed'));if(w.error)noteFail('snapshotErrors',w.error);if(s.error)noteFail('snapshotErrors',s.error);if(s.snapErr)noteFail('snapshotErrors','snapshot threw: '+s.snapErr);}catch(e){}}
var touch=installTouch(wx);g.__QF_AUTOPLAY={touch:touch,api:api};g.__QF_AUTOPLAY_SHOT=function(n){return shot(n);};Object.defineProperty(g,'__QF_AUTOPLAY_SHOT_STATS',{get:function(){return shotStats;},configurable:true});
if(err){console.error('[QF_AUTOPLAY] script rejected: '+err);w2('result.json',JSON.stringify({ok:false,error:err}));flush();return;}
if(script.launchQuery){try{if(!g.location||!g.location.search)g.location={search:script.launchQuery,href:'game.js'+script.launchQuery};}catch(e){console.warn('[QF_AUTOPLAY] launchQuery not applied');}}
var memWarn=0;try{wx.onMemoryWarning(function(r){memWarn++;console.warn('[QF_AUTOPLAY] memory warning',r&&r.level);});}catch(e){}
var fpsT=Date.now(),fpsF=0,fps=null;function frames(){var cc=g.cc;try{return cc&&cc.director?cc.director.getTotalFrames():null;}catch(e){return null;}}
/* window size: read ONCE (boot, before run()) and refreshed only by wx.onWindowResize; never a sync host call per step/tap. */
var winC=null;function readWin(){try{var i=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();winC={w:i.windowWidth,h:i.windowHeight,dpr:i.pixelRatio};}catch(e){winC={w:DESIGN_W,h:DESIGN_H,dpr:1};}}
readWin();try{wx.onWindowResize&&wx.onWindowResize(function(r){var s=r&&(r.size||r);if(s&&s.windowWidth)winC={w:s.windowWidth,h:s.windowHeight,dpr:winC?winC.dpr:1};});}catch(e){}
function win(){return winC;}
/* Resolve an engine class without ever passing undefined to getComponent*: in the WeChat build some classes (e.g.
 * SkinnedMeshRenderer) are not on the global cc namespace, and getComponentsInChildren(undefined) logs Cocos
 * Error 3804 "getComponent: Type must be non-nil" on every call (b17r16 DevTools run: 170-228 errors). */
function ccClass(cc,name){var c=null;try{c=cc[name]||(cc.js&&cc.js.getClassByName&&cc.js.getClassByName('cc.'+name))||null;}catch(e){c=null;}return typeof c==='function'?c:null;}
function v3(v){return v?[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)]:null;}
function snapshot(light){
  var s={t:Date.now()},wi=g.__worldIntegration,cc=g.cc;
  try{var w=wi&&wi.snapshot();if(w){s.state=w.state;s.region=w.region||w.activeRegion||null;s.phase=w.phase||null;s.world=w;}}catch(e){s.snapErr=String(e);}
  try{var j=wi&&wi.journey&&wi.journey();if(j)s.journeyPhase=j.phase||j.state||null;}catch(e){}
  var ex=g.__qfExploreSync;if(ex){s.exploreOpen=!!ex.open;s.exploreRegion=ex.region;}
  var tap=g.__qfGroundTap;if(tap){s.lastGroundTap={kind:tap.kind,region:tap.region,at:tap.at,t:tap.t};}
  var lq=g.__qaLakeside;if(lq&&lq.mark)s.lakesideMark=lq.mark;
  if(light)return s;
  try{var CAM=cc&&ccClass(cc,'Camera'),SKIN=cc&&ccClass(cc,'SkinnedMeshRenderer');if(cc&&!SKIN)s.characterErr='cc.SkinnedMeshRenderer unavailable';
    if(cc&&cc.director&&cc.director.getScene()){var cams=!CAM?[]:cc.director.getScene().getComponentsInChildren(CAM).filter(function(c){return c.enabled&&c.node.activeInHierarchy&&c.node.layer!==cc.Layers.Enum.UI_2D;});
    var c=cams.sort(function(a,b){return a.priority-b.priority;})[0];if(c){var e=c.node.worldRotation.getEulerAngles(new cc.Vec3());s.camera={pos:v3(c.node.worldPosition),euler:v3(e),fov:c.fov};}
    /* full9c: her = the game's explicit reference (CamTraceLog __QF_PROBE_HER, camTrace mode). The old "first enabled skinned mesh,
       climb while the parent has the same skinned count" guess hit the cat's bones or the floating platform (39/173 on her). */
    var her=typeof g.__QF_PROBE_HER==='function'?g.__QF_PROBE_HER():null;
    if(her){s.character={node:her.name,pos:v3(her.worldPosition),ref:'explicit',skinned:SKIN?her.getComponentsInChildren(SKIN).length:-1};}else s.characterErr=s.characterErr||'no explicit her ref (run with camTrace=1)';}}catch(e){s.ccErr=String(e);}
  /* on-water: the game has no global "character on water" flag; this is the last ground tap kind (water/walk/none) only. */
  s.onWater=tap?tap.kind==='water':null;s.onWaterSource='lastGroundTap.kind';
  var f=frames(),now=Date.now();if(f!=null){if(now>fpsT){fps=+((f-fpsF)*1000/(now-fpsT)).toFixed(1);}fpsF=f;fpsT=now;}s.fps=fps;
  try{var pm=(g.performance&&g.performance.memory)||null;s.memory=pm?{usedJSHeapMB:+(pm.usedJSHeapSize/1048576).toFixed(1),totalJSHeapMB:+(pm.totalJSHeapSize/1048576).toFixed(1)}:null;}catch(e){s.memory=null;}
  s.memoryWarnings=memWarn;return s;
}
function pnow(){try{return +g.performance.now().toFixed(1);}catch(e){return Date.now();}}
function writeState(tag){if(stateBytes>STATE_CAP)return;var s=snapshot();s.tag=tag;s.pn=pnow();var line=JSON.stringify(s,function(k,v){return typeof v==='function'?undefined:v;})+'\n';stateBytes+=line.length;w2('state.jsonl',line);scanState(s);return s;}
/* r2 (chainJ P0 freeze: shot→take→canvas.toTempFilePathSync inside cc.director EVENT_AFTER_DRAW = sync appservice IPC that hung
 * the DevTools runtime 8 s after skycity arrival). Now fully async: the after-draw callback only REQUESTS the capture with
 * canvas.toTempFilePath (non-blocking, success/fail callbacks), the copy into out/shots is fs.copyFile (async), and the temp file
 * is removed with fs.unlink (async). At most ONE capture in flight; an overlapping request is skipped (resolves null, counted in
 * result.json shotsSkipped). A capture whose callbacks never come back is abandoned after SHOT_TIMEOUT_MS (shotTimeouts) so the
 * script never hangs on it. File names unchanged: out/shots/NN-<name>.jpg, NN = completed-shot counter (padStart 2). */
var shotN=0,shotBusy=false,shotStats={requested:0,skipped:0,failed:0,timeouts:0,maxMs:0},SHOT_TIMEOUT_MS=5000;
function shotFail(where,e){shotStats.failed++;console.warn('[QF_AUTOPLAY] screenshot failed',where,e&&(e.errMsg||e.message));}
function shot(name){return new Promise(function(res){var cv=g.canvas,cc=g.cc;if(!cv||typeof cv.toTempFilePath!=='function'||shotN>=MAX_SHOTS){res(null);return;}
  if(shotBusy){shotStats.skipped++;res(null);return;}
  shotBusy=true;shotStats.requested++;var t0=Date.now(),over=false;
  var end=function(f){if(over)return;over=true;clearTimeout(to);shotBusy=false;var ms=Date.now()-t0;if(ms>shotStats.maxMs)shotStats.maxMs=ms;res(f);};
  var to=setTimeout(function(){if(over)return;shotStats.timeouts++;console.warn('[QF_AUTOPLAY] screenshot timeout '+SHOT_TIMEOUT_MS+'ms '+name);end(null);},SHOT_TIMEOUT_MS);
  var request=function(){if(over)return;try{var h=Math.round(SHOT_W*cv.height/cv.width);
    cv.toTempFilePath({destWidth:SHOT_W,destHeight:h,fileType:'jpg',quality:SHOT_Q,
      success:function(r){if(over)return;var tmp=r&&r.tempFilePath;var dst=OUT+'/shots/'+String(shotN+1).padStart(2,'0')+'-'+name+'.jpg';
        try{fs.copyFile({srcPath:tmp,destPath:dst,success:function(){if(over)return;shotN++;try{fs.unlink({filePath:tmp,fail:function(){}});}catch(e){}end(dst);},fail:function(e){shotFail('copy',e);end(null);}});}catch(e){shotFail('copy',e);end(null);}},
      fail:function(e){shotFail('capture',e);end(null);}});}catch(e){shotFail('capture',e);end(null);}};
  /* after-draw: only enqueue the async request for the frame just drawn; nothing in this callback waits on the host. */
  try{if(cc&&cc.director&&cc.Director)cc.director.once(cc.Director.EVENT_AFTER_DRAW,request);else request();}catch(e){request();}});}
/* {op:'preTransition',key,timeoutMs?=90000,tap?:true,recordMs?}: enables the test hook (no launch params needed; DevTools
 * cli open ignores 启动参数), waits for __qfPreTransition, runs the key's SETUP only. tap:true then touches r.tap.point with a
 * normal synthetic touch (the transition under test plays through the real input path); recordMs waits afterwards. */
function preTransition(st,rec,res,W){var to=st.timeoutMs==null?90000:st.timeoutMs,t0=Date.now();
  return new Promise(function(r){(function wait(){if(typeof g.__qfPreTransition==='function')r(true);else if(Date.now()-t0>=to)r(false);else setTimeout(wait,250);})();})
  .then(function(have){if(!have){rec.ready=false;rec.reason='no __qfPreTransition (not a test build?)';res.ok=false;return;}
    g.__qfHooksEnable=true;
    return Promise.resolve(g.__qfPreTransition('enable')).then(function(){return Promise.race([g.__qfPreTransition(st.key),sleep(Math.max(1000,to-(Date.now()-t0))).then(function(){return {ok:false,reason:'timeout'};})]);})
    .then(function(out){rec.ready=!!(out&&out.ok);rec.pre=out&&{ok:out.ok,reason:out.reason,state:out.state,trigger:out.trigger,tap:out.tap};if(!rec.ready){res.ok=false;return;}
      var pt=out.tap&&out.tap.point,f=out.frame||{width:DESIGN_W,height:DESIGN_H};
      if(st.tap){if(!pt){rec.tapped=false;rec.reason='tap point null (node '+(out.tap&&out.tap.node)+')';res.ok=false;return;}
        var x=pt.x*DESIGN_W/(f.width||DESIGN_W),y=pt.y*DESIGN_H/(f.height||DESIGN_H),c=toClient(x,y,W),id=touch.nextId();touch.emit('TouchStart',c.x,c.y,id);rec.tapped={x:Math.round(x),y:Math.round(y)};
        return sleep(60).then(function(){touch.emit('TouchEnd',c.x,c.y,id);return st.recordMs?sleep(st.recordMs):null;});}
      return st.recordMs?sleep(st.recordMs):null;});});}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function run(){
  var res={ok:true,steps:[],startedAt:new Date().toISOString(),design:[DESIGN_W,DESIGN_H],window:win(),listeners:{}};
  for(var k in touch.listeners)res.listeners[k]=touch.listeners[k].length;
  var stTimer=setInterval(function(){writeState('periodic');},script.stateEveryMs);
  var i=0;
  function next(){if(i>=script.steps.length)return Promise.resolve();var st=script.steps[i++],t0=Date.now(),W=win(),rec={i:i-1,op:st.op};
    var p;
    if(st.op==='tap'){var c=toClient(st.x,st.y,W),id=touch.nextId();rec.listeners=touch.emit('TouchStart',c.x,c.y,id);p=sleep(60).then(function(){touch.emit('TouchEnd',c.x,c.y,id);});}
    else if(st.op==='drag'){var pts=dragPoints(st,16),id2=touch.nextId(),a=toClient(st.x1,st.y1,W);rec.listeners=touch.emit('TouchStart',a.x,a.y,id2);var dt=st.ms/pts.length;
      p=pts.reduce(function(pr,pt){return pr.then(function(){return sleep(dt);}).then(function(){var q=toClient(pt[0],pt[1],W);touch.emit('TouchMove',q.x,q.y,id2);});},Promise.resolve()).then(function(){var b=toClient(st.x2,st.y2,W);touch.emit('TouchEnd',b.x,b.y,id2);});}
    else if(st.op==='wait')p=sleep(st.ms);
    else if(st.op==='waitState'){var to=st.timeoutMs==null?90000:st.timeoutMs;p=new Promise(function(r){(function poll(){var names=stateNames(snapshot(true));if(names.indexOf(st.name)>=0){rec.matched=true;r();}else if(Date.now()-t0>=to){rec.matched=false;rec.lastNames=names;res.ok=false;r();}else setTimeout(poll,200);})();});}
    else if(st.op==='preTransition')p=preTransition(st,rec,res,W);
    else if(st.op==='screenshot'){rec.pn=pnow();p=shot(st.name).then(function(f){rec.file=f;rec.pnDone=pnow();});}
    return p.then(function(){rec.ms=Date.now()-t0;var s=writeState('after:'+st.op+(st.name?':'+st.name:''));rec.state=s&&s.state;res.steps.push(rec);console.info('[QF_AUTOPLAY] step '+JSON.stringify(rec));
      if((st.op==='waitState'&&rec.matched===false||st.op==='preTransition'&&rec.ready===false)&&st.stopOnFail!==false){res.stoppedAt=rec.i;return;}return next();});}
  return next().then(function(){clearInterval(stTimer);res.finishedAt=new Date().toISOString();res.shots=shotN;res.shotsRequested=shotStats.requested;res.shotsSkipped=shotStats.skipped;res.shotsFailed=shotStats.failed;res.shotTimeouts=shotStats.timeouts;res.shotMaxMs=shotStats.maxMs;res.screenshotApi='toTempFilePath-async';res.consoleErrors=consoleErrors;res.consoleErrorSamples=errorSamples;
    /* acceptance rule: DevTools Console Error count must be 0 */
    writeState('final');res.journeyFailures=gameFail.journeyFailed;res.snapshotErrors=gameFail.snapshotErrors;res.uncaughtErrors=gameFail.uncaught;res.hudSuppressedErrors=gameFail.hudSuppressed;
    var gf=gameFail.journeyFailed.length+gameFail.snapshotErrors.length+gameFail.uncaught.length+gameFail.hudSuppressed.length;res.gameFailures=gf;
    if(gf>0&&script.allowGameFailures!==true){res.ok=false;res.failReason=(res.failReason?res.failReason+'; ':'')+'game failures: '+gf+' (journey failed '+gameFail.journeyFailed.length+', snapshot errors '+gameFail.snapshotErrors.length+', uncaught '+gameFail.uncaught.length+', hud-suppressed '+gameFail.hudSuppressed.length+')';}
    if(consoleErrors>0&&script.allowConsoleErrors!==true){res.ok=false;res.failReason=(res.failReason?res.failReason+'; ':'')+'console errors: '+consoleErrors;}console.info('[QF_AUTOPLAY] done ok='+res.ok);flush();/* FIFO write queue: result.json lands LAST, after the final log chunk */w2('result.json',JSON.stringify(res,null,1));},
    function(e){clearInterval(stTimer);res.ok=false;res.error=String(e);flush();w2('result.json',JSON.stringify(res,null,1));});
}
/* start once the world integration hook exists (or after 60 s regardless) */
var t0=Date.now();(function waitBoot(){if(g.__worldIntegration||Date.now()-t0>60000){console.info('[QF_AUTOPLAY] start, out='+OUT);run();}else setTimeout(waitBoot,500);})();
})();
