/* QF_AUTOPLAY test harness (GGbot, b17r16; r2 = Mac pt fork md5 1512d393 merged + async I/O). TEST BUILDS ONLY.
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
var DESIGN_W=390,DESIGN_H=844,MAX_SHOTS=1500,SHOT_W=195,SHOT_Q=0.6,LOG_CAP=60*1024*1024,STATE_CAP=2*1024*1024,STEP_CAP=500;
var OPS={tapEnding:[],dayNight:['night'],autoPlay:['maxMs'],burst:['ms'],dumpTap:[],tap:['x','y'],drag:['x1','y1','x2','y2','ms'],wait:['ms'],waitState:['name'],screenshot:['name'],preTransition:['key'],preT:['key'],continueJourney:[],untilLake:[]};
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
    if(op==='continueJourney'){var fx=st.fallbackX==null?288:st.fallbackX,fy=st.fallbackY==null?578:st.fallbackY;if(typeof fx!=='number'||typeof fy!=='number'||fx<0||fx>DESIGN_W||fy<0||fy>DESIGN_H)throw Error('step '+i+': bad fallback');if(st.timeoutMs!=null&&(typeof st.timeoutMs!=='number'||st.timeoutMs<1000||st.timeoutMs>60000))throw Error('step '+i+': bad timeoutMs');}
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
var wq=[],wBusy=false,wFail=0;
function w2(file,s){wq.push([OUT+'/'+file,s]);pump();}
function pump(){if(wBusy||!wq.length)return;wBusy=true;var it=wq.shift(),p=it[0],s=it[1];
  var done=function(){wBusy=false;pump();};var bad=function(e){wFail++;try{if(wFail<=5)console.warn('[QF_AUTOPLAY] WRITEFAIL '+p+' '+(e&&(e.errMsg||e.message)));}catch(x){}done();};
  var put=function(){try{fs.writeFile({filePath:p,data:s,encoding:'utf8',success:done,fail:bad});}catch(x){bad(x);}};
  try{fs.appendFile({filePath:p,data:s,encoding:'utf8',success:done,fail:put});}catch(e){put();}}
function flush(){if(!logBuf.length)return;var s=logBuf.join('');logBuf=[];if(logBytes>LOG_CAP)return;logBytes+=s.length;w2('console.log',s+(logBytes>LOG_CAP?'[QF_AUTOPLAY] log cap reached\n':''));}
var consoleErrors=0,errorSamples=[];
function qfSer(v){if(typeof v==='string')return v;if(v&&typeof v==='object'&&(v instanceof Error||(typeof v.message==='string'&&('stack' in v||'name' in v)))){return (v.name||'Error')+': '+v.message+(v.stack?'\n'+v.stack:'');}try{var j=JSON.stringify(v);if(j==='{}'&&v&&typeof v==='object'){var t=String(v);if(t!=='[object Object]')return t;}return j;}catch(e){return String(v);}}
['log','info','warn','error'].forEach(function(lv){var o=console[lv];console[lv]=function(){try{var a=[].slice.call(arguments).map(qfSer).join(' ');logBuf.push(new Date().toISOString()+' '+lv+' '+a.slice(0,4000)+'\n');if(a.indexOf('[QF_LAKESIDE_ARRIVAL] touchdown')>=0&&!g.__qfTouchdownAt)g.__qfTouchdownAt=Date.now();if(a.indexOf('[OI_HUD] suppressed')>=0&&a.indexOf('"kind":"error"')>=0)noteFail('hudSuppressed',a.slice(a.indexOf('[OI_HUD]')));if(lv==='error'&&a.indexOf('[QF_AUTOPLAY]')!==0){consoleErrors++;if(errorSamples.length<5)errorSamples.push(a.slice(0,300));}}catch(e){}return o.apply(console,arguments);};});
var tick=setInterval(flush,1000);
/* run failures that never reach console.error: journey phase=failed, snapshot world/journey error, wx.onError / unhandled rejections, HUD-suppressed errors */
var gameFail={journeyFailed:[],snapshotErrors:[],uncaught:[],hudSuppressed:[]};function noteFail(k,t){t=String(t).slice(0,300);var l=gameFail[k];if(l.indexOf(t)<0&&l.length<10)l.push(t);}
try{wx.onError&&wx.onError(function(r){var m=r&&typeof r==='object'?((r.message||'')+(r.stack?'\n'+r.stack:'')):qfSer(r);console.error('[QF_AUTOPLAY] wx.onError '+m);noteFail('uncaught',m||qfSer(r));});}catch(e){}
try{wx.onUnhandledRejection&&wx.onUnhandledRejection(function(r){var x=r&&r.reason;var m='unhandledrejection: '+qfSer(x);console.error('[QF_AUTOPLAY] '+m);noteFail('uncaught',m);});}catch(e){}
function scanState(s){if(!s)return;try{var w=s.world||{},j=w.journey||{};if(s.journeyPhase==='failed'||j.phase==='failed')noteFail('journeyFailed',(j.region||'?')+'>'+(j.target||'?')+': '+(j.error||w.error||'failed'));if(w.error)noteFail('snapshotErrors',w.error);if(s.error)noteFail('snapshotErrors',s.error);if(s.snapErr)noteFail('snapshotErrors','snapshot threw: '+s.snapErr);}catch(e){}}
var touch=installTouch(wx);g.__QF_AUTOPLAY={touch:touch,api:api};g.__QF_AUTOPLAY_SHOT=function(n){return shot(n);};Object.defineProperty(g,'__QF_AUTOPLAY_SHOT_STATS',{get:function(){return shotStats;},configurable:true});
if(err){console.error('[QF_AUTOPLAY] script rejected: '+err);w2('result.json',JSON.stringify({ok:false,error:err}));flush();return;}
if(script.launchQuery&&/camTrace=1/.test(script.launchQuery)){g.__QF_CAM_TRACE=true;console.info('[QF_AUTOPLAY] __QF_CAM_TRACE=true');g.__qfQuery=script.launchQuery;}if(script.launchQuery){try{if(!g.location||!g.location.search)g.location={search:script.launchQuery,href:'game.js'+script.launchQuery};}catch(e){console.warn('[QF_AUTOPLAY] launchQuery not applied');}}
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
    var sk=!SKIN?[]:cc.director.getScene().getComponentsInChildren(SKIN).filter(function(r){return r.enabled&&r.node.activeInHierarchy;});
    if(sk.length){var n=sk[0].node;while(n.parent&&n.parent.getComponentsInChildren(SKIN).length===n.getComponentsInChildren(SKIN).length&&n.parent.parent)n=n.parent;s.character={node:n.name,pos:v3(n.worldPosition)};}}}catch(e){s.ccErr=String(e);}
  /* on-water: the game has no global "character on water" flag; this is the last ground tap kind (water/walk/none) only. */
  s.onWater=tap?tap.kind==='water':null;s.onWaterSource='lastGroundTap.kind';
  var f=frames(),now=Date.now();if(f!=null){if(now>fpsT){fps=+((f-fpsF)*1000/(now-fpsT)).toFixed(1);}fpsF=f;fpsT=now;}s.fps=fps;
  try{var pm=(g.performance&&g.performance.memory)||null;s.memory=pm?{usedJSHeapMB:+(pm.usedJSHeapSize/1048576).toFixed(1),totalJSHeapMB:+(pm.totalJSHeapSize/1048576).toFixed(1)}:null;}catch(e){s.memory=null;}
  s.memoryWarnings=memWarn;return s;
}
function writeState(tag){if(stateBytes>STATE_CAP)return;var s=snapshot();s.tag=tag;var line=JSON.stringify(s,function(k,v){return typeof v==='function'?undefined:v;})+'\n';stateBytes+=line.length;w2('state.jsonl',line);scanState(s);return s;}
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
        try{fs.copyFile({srcPath:tmp,destPath:dst,success:function(){if(over)return;shotN++;try{fs.unlink({filePath:tmp,fail:function(){try{fs.unlink({filePath:String(tmp).replace(/^http:\/\/tmp\//,wx.env.USER_DATA_PATH.replace(/usr$/,'tmp')+'/'),fail:function(){}});}catch(x){}}});}catch(e){}end(dst);},fail:function(e){shotFail('copy',e);end(null);}});}catch(e){shotFail('copy',e);end(null);}},
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

function qfDump(tag){var o={tag:tag,t:Date.now()};try{o.snap=snapshot(true);}catch(e){o.err=String(e);}try{var W=g.__worldIntegration,S=W&&W.snapshot&&W.snapshot();o.journey=S&&S.journey;o.world=S;try{var cc=g.cc,sc=cc.director.getScene(),an=[];(function wk(n,d){if(d>12||an.length>6)return;var c=n.getComponent&&(n.getComponent('cc.SkeletalAnimation')||n.getComponent('cc.Animation'));if(c&&n.activeInHierarchy){var st=null;try{var cl=c.defaultClip;var ss=c._nameToState||{};for(var k in ss){if(ss[k].isPlaying)st=(st?st+',':'')+k;}}catch(e){}an.push({node:n.name,playing:st});}n.children.forEach(function(ch){wk(ch,d+1);});})(sc,0);o.anims=an;}catch(e){o.animErr=String(e);}}catch(e){}
 o.groundTap=g.__qfGroundTap||null;o.lakesideArrival=g.__qfLakesideArrival===undefined?'undef':g.__qfLakesideArrival;o.windWipe=g.__qfWindWipe===undefined?'undef':g.__qfWindWipe;o.windWipeLog=g.__qfWindWipeLog||null;var ct=g.__QF_CLOUD_TRACE;try{o.ending=g.__qfEnding||null;}catch(e){}o.cloudTrace=ct?{frames:ct.frames,jumps:ct.jumps.length,first:ct.jumps.slice(0,5)}:null;try{var TF=g.__QF_TRANSITION_FALLBACK;o.fallback=TF?{count:TF.count,last:(TF.events||[]).slice(-3)}:'undef';var CH=g.__QF_CHAIN;o.chain=CH?{bad:CH.bad,n:(CH.events||[]).length,last:(CH.events||[]).slice(-3)}:'undef';o.playerAnim=g.__QF_PLAYER_ANIM===undefined?'undef':g.__QF_PLAYER_ANIM;var PL=g.__QF_PRELOAD;o.preload=PL?{bytes:PL.bytes,n:(PL.events||[]).length}:'undef';var mem={};try{var pm=(typeof performance!=='undefined'&&performance.memory)||null;if(pm)mem.perfMemory={used:pm.usedJSHeapSize,total:pm.totalJSHeapSize};}catch(e){}try{var wp=g.wx&&wx.getPerformance&&wx.getPerformance();if(wp&&wp.memory)mem.wxPerfMemory={used:wp.memory.usedJSHeapSize,total:wp.memory.totalJSHeapSize};}catch(e){}try{if(g.wx&&wx.getAppBaseInfo)0;}catch(e){}o.mem=mem;}catch(e){o.qfErr=String(e);}
 console.info('[QF_DUMP] '+JSON.stringify(o,function(k,v){return typeof v==='function'?undefined:v;}));return o;}
function burst(st){var t0=Date.now(),end=t0+st.ms,every=st.everyMs||400,n=0,last='',lastDump=0,nm=st.name||'b';
 function key(){try{var x=snapshot(true);return [x.state,x.region,x.phase,x.journeyPhase,x.exploreOpen].join('|');}catch(e){return 'err';}}
 return (function f(){var k=key();if(k!==last){console.info('[QF_BURST] '+nm+' +'+((Date.now()-t0)/1000).toFixed(1)+'s '+k);last=k;}
  if(Date.now()-lastDump>=(st.dumpMs||5000)){lastDump=Date.now();qfDump(nm+'+'+((Date.now()-t0)/1000).toFixed(0)+'s');}
  if(Date.now()>end)return Promise.resolve();n++;var ts=Date.now();return shot(nm+'-'+('000'+n).slice(-3)).then(function(){return sleep(Math.max(0,every-(Date.now()-ts)));}).then(f);})();}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}

function autoPlay(st,rec){var W0=g.__worldIntegration,t0=Date.now(),lastDump=0,lastSid=null,sFails=0,skips=[],burstUntil=0,stageT0=0,firstSwapLogged=true,lastSt='',lastShot=0,log=[],wins=0,fails=0,swaps=0,stopAt=st.stopState||null,shotMs=st.shotEveryMs||500;
 function tapD(x,y){var W=win(),c=toClient(x,y,W),id=touch.nextId();touch.emit('TouchStart',c.x,c.y,id);return sleep(60).then(function(){touch.emit('TouchEnd',c.x,c.y,id);});}
 function dragD(x1,y1,x2,y2){var W=win(),id=touch.nextId(),a=toClient(x1,y1,W);touch.emit('TouchStart',a.x,a.y,id);var k=0;return (function step(){if(k>=6){var b=toClient(x2,y2,W);touch.emit('TouchEnd',b.x,b.y,id);return Promise.resolve();}k++;return sleep(16).then(function(){var q=toClient(x1+(x2-x1)*k/6,y1+(y2-y1)*k/6,W);touch.emit('TouchMove',q.x,q.y,id);return step();});})();}
 function best(a,v){var B0=a.board.map(function(c){return c?c.type:-1;}),N=Math.round(Math.sqrt(B0.length)),goals=a.goals||{},gt=Object.keys(goals).filter(function(k){return k.indexOf('type')===0&&goals[k]>0;}).map(function(k){return +k.slice(4);});
  var moss=[].concat(a.moss||[],(a.roots||[]).map(function(r){return Array.isArray(r)?r[0]:r;})),ch=(a.regionPieces||[]).filter(function(r){return !r.done;}).map(function(r){return r.index;});
  function score(B){var s=0,mk={};for(var r=0;r<N;r++)for(var c=0;c<N;c++){var t=B[r*N+c];if(t<0)continue;if(c<N-2&&B[r*N+c+1]==t&&B[r*N+c+2]==t){mk[r*N+c]=1;mk[r*N+c+1]=1;mk[r*N+c+2]=1;}if(r<N-2&&B[(r+1)*N+c]==t&&B[(r+2)*N+c]==t){mk[r*N+c]=1;mk[(r+1)*N+c]=1;mk[(r+2)*N+c]=1;}}
   if(goals.specials>0){for(var r2=0;r2<N;r2++)for(var c2=0;c2<N;c2++){var t2=B[r2*N+c2];if(t2<0)continue;var h=0;while(c2+h<N&&B[r2*N+c2+h]==t2)h++;var vv=0;while(r2+vv<N&&B[(r2+vv)*N+c2]==t2)vv++;if(h>=4||vv>=4)s+=60;}}
   Object.keys(mk).forEach(function(k){var i=+k;s+=gt.indexOf(B[i])>=0?10:1;[0,1,-1,N,-N].forEach(function(d){if(moss.indexOf(i+d)>=0)s+=d?6:25;if(d&&ch.indexOf(i+d)>=0)s+=40;});});return s;}
  var bb=null,bs=0;for(var r=0;r<N;r++)for(var c=0;c<N;c++)[[0,1],[1,0]].forEach(function(d){var r2=r+d[0],c2=c+d[1];if(r2>=N||c2>=N)return;var i=r*N+c,j=r2*N+c2;if(B0[i]<0||B0[j]<0)return;var B=B0.slice();var t=B[i];B[i]=B[j];B[j]=t;var sc=score(B);if(sc>bs){bs=sc;bb=[i,j];}});
  if(!bb&&v.hintCells&&v.hintCells.length==2)bb=v.hintCells;return bb;}
 function loop(){var W=g.__worldIntegration;if(!W){return sleep(500).then(loop);}var S,v;try{S=W.snapshot();v=W.board();}catch(e){return sleep(500).then(loop);}
  var j=S.journey||{},key=S.state+'|'+j.phase+'|'+j.region+'>'+j.target+'|'+(v&&v.snapshot&&v.snapshot.state);
  if(key!==lastSt){console.info('[QF_AUTO] '+((Date.now()-t0)/1000).toFixed(1)+'s '+key);log.push(((Date.now()-t0)/1000).toFixed(1)+' '+key);lastSt=key;writeState('auto:'+key.slice(0,60));}
  if(Date.now()-t0>st.maxMs||(stopAt&&S.state===stopAt)||(st.maxFails&&fails>=st.maxFails)){rec.stuckAt=key;console.info('[QF_AUTO] STOP fails='+fails+' at '+key);rec.log=log;rec.wins=wins;rec.fails=fails;rec.swaps=swaps;return Promise.resolve();}
  if(st.dumpMs&&Date.now()-lastDump>=st.dumpMs){lastDump=Date.now();try{qfDump('auto');}catch(e){}}
  var sid=v&&v.snapshot&&v.snapshot.active&&v.snapshot.active.stageId||null;
  if(sid!==lastSid){lastSid=sid;if(sid){sFails=0;burstUntil=Date.now()+3500;stageT0=Date.now();firstSwapLogged=false;}console.info('[QF_AUTO] stage '+sid+' at '+((Date.now()-t0)/1000).toFixed(1)+'s');try{qfDump('stage-'+sid);}catch(e){}}
  var SKM={'r04-lake-01':'lake-13-14','r04-lake-02':'lake-14-15','r04-lake-03':'lake-15-16','r04-lake-04':'lake-16-17','r04-lake-05':'lake-17-18','r04-lake-06':'ending'};
  if(st.stageFails&&sFails>=st.stageFails&&SKM[sid]){var kk=SKM[sid],sr={};sFails=0;skips.push(sid+'->'+kk);rec.skips=skips;console.info('[QF_AUTO] SKIP '+sid+' via preTransition '+kk);qfDump('skip-'+sid);
    return preTransition({op:'preTransition',key:kk,tap:true,timeoutMs:300000},sr,{steps:[]},win()).then(function(){console.info('[QF_AUTO] SKIPDONE '+JSON.stringify(sr).slice(0,300));}).then(loop);}
  if(g.__qfEnding&&g.__qfEnding.shown){console.info('[QF_AUTO] STOP ending shown');rec.log=log;rec.wins=wins;rec.fails=fails;rec.swaps=swaps;rec.skips=skips;rec.ending=true;return Promise.resolve();}
  if(st.key&&sid===st.key&&Date.now()>burstUntil){console.info('[QF_AUTO] STOP at stage '+sid);rec.log=log;rec.wins=wins;rec.fails=fails;rec.swaps=swaps;rec.stopStage=sid;return Promise.resolve();}
  if(Date.now()<burstUntil&&Date.now()-lastShot>=shotMs){lastShot=Date.now();shot('ls-'+sid);}
  var moving=['home','island','meadow','skycity','lakeside','level'].indexOf(S.state)<0||(j.phase&&['idle','arrived'].indexOf(j.phase)<0);
  if(moving&&Date.now()-lastShot>=shotMs){lastShot=Date.now();return shot('tr-'+S.state+'-'+(j.region||'')+'-'+(j.target||'')).then(function(){return sleep(50);}).then(loop);}
  if(moving)return sleep(80).then(loop);
  var a=v&&v.snapshot&&v.snapshot.active,vs=v&&v.snapshot&&v.snapshot.state;
  if(S.state==='level'&&v){
   if(vs==='run.paused')return tapD(195,497).then(function(){return sleep(1500);}).then(loop);
   if(v.popups&&v.popups.length&&v.popups.indexOf('ResultPanel')<0){return tapD(195,554).then(function(){return sleep(1200);}).then(function(){if(W.board()&&W.board().popups.length)return tapD(195,512).then(function(){return sleep(1200);});}).then(loop);}
   if(vs&&vs.indexOf('result')===0){var fail=a&&Object.keys(a.goals||{}).some(function(k){return a.goals[k]>0;});if(fail){fails++;sFails++;}else wins++;
     return shot('result-'+(a&&a.stageId)).then(function(){return fail?tapD(122,555):tapD(122,710).then(function(){return sleep(1500);}).then(function(){var s2=W.board()&&W.board().snapshot.state;if(s2&&s2.indexOf('result')===0)return tapD(123,528);});}).then(function(){return sleep(2500);}).then(loop);}
   if(vs==='run.ready'&&v.inputGate&&v.inputGate.state==='run.ready'&&a){var bb=best(a,v);if(bb){var A=v.layout.tiles[bb[0]],B=v.layout.tiles[bb[1]];swaps++;if(!firstSwapLogged){firstSwapLogged=true;console.info('[QF_AUTO] firstSwap '+sid+' +'+(Date.now()-stageT0)+'ms');shot('fs-'+sid);}return dragD(A.x,A.y,B.x,B.y).then(function(){return sleep(1800);}).then(loop);}}
   return sleep(800).then(loop);}
  if(S.state==='home')return tapD(175,458).then(function(){return sleep(3000);}).then(loop);
  if(S.state==='island'&&!v)return sleep(2500).then(function(){return tapD(282,575);}).then(function(){return sleep(4000);}).then(loop);
  if(['skycity','meadow','lakeside'].indexOf(S.state)>=0&&j.phase==='arrived'&&!v){var tr=null;try{tr=W.layout().targetRects;}catch(e){}if(tr&&tr.mainline){var R=tr.mainline;return sleep(4000).then(function(){return shot('arrived-'+S.state);}).then(function(){return tapD(R.x+R.width/2,R.y+R.height/2);}).then(function(){return sleep(4000);}).then(loop);}}
  return sleep(800).then(loop);}
 return loop();}

/* {op:'continueJourney',fallbackX?=288,fallbackY?=578,timeoutMs?=10000,stopAfter?:bool}
 * locate 继续旅程: 1) W.layout().targetRects key matching continue/journey/resume/mainline (design px)  2) cc scene-tree node
 * whose name matches /continue|journey|resume|jixu|继续/ with UITransform -> world bbox -> design px  3) fallback point.
 * Screenshot before tap (evidence), tap, then within timeoutMs the game must leave island-idle (state!=island or journey.phase!=idle);
 * else rec.ok=false, failReason CONTINUE_FAILED, segment stops. stopAfter:true ends the script after success (starter mode). */
function findContinue(){var RX=/continue|journey|resume|jixu|继续/i;
  try{var W=g.__worldIntegration,tr=W&&W.layout&&W.layout().targetRects;if(tr)for(var k in tr){var R=tr[k];if(R&&RX.test(k)&&R.width>0&&R.height>0)return {x:R.x+R.width/2,y:R.y+R.height/2,src:'targetRects.'+k,rect:R};}}catch(e){}
  try{var cc=g.cc,sc=cc&&cc.director&&cc.director.getScene();if(sc){var C=null,cands=[];
    (function fc(n,d){if(C||!n||d>6)return;var cv=n.getComponent&&n.getComponent('cc.Canvas'),u=cv&&n.getComponent('cc.UITransform');if(u){C=u.getBoundingBoxToWorld();return;}(n.children||[]).forEach(function(c){fc(c,d+1);});})(sc,0);
    if(C&&C.width>0){(function walk(n,d){if(!n||d>40)return;if(n.activeInHierarchy&&RX.test(n.name||'')){var ui=n.getComponent&&n.getComponent('cc.UITransform');if(ui){var b=ui.getBoundingBoxToWorld(),ar=b.width*b.height/(C.width*C.height);
      if(b.width>4&&b.height>4&&ar<0.25){var cx=b.x+b.width/2,cy=b.y+b.height/2;cands.push({x:(cx-C.x)/C.width*DESIGN_W,y:DESIGN_H-(cy-C.y)/C.height*DESIGN_H,src:'node:'+n.name,rect:{x:b.x,y:b.y,width:b.width,height:b.height},pri:/continue|继续|jixu/i.test(n.name)?0:1});}}}
      (n.children||[]).forEach(function(c){walk(c,d+1);});})(sc,0);
      cands=cands.filter(function(h){return h.x>=0&&h.x<=DESIGN_W&&h.y>=0&&h.y<=DESIGN_H;}).sort(function(a,b){return a.pri-b.pri;});if(cands.length)return cands[0];}}}catch(e){}
  return null;}
function continueJourney(st,rec,res,W){var to=st.timeoutMs||10000,f=findContinue();
  if(!f)f={x:st.fallbackX==null?288:st.fallbackX,y:st.fallbackY==null?578:st.fallbackY,src:'fallback'};rec.point={x:Math.round(f.x),y:Math.round(f.y)};rec.source=f.src;rec.rect=f.rect||null;
  var s0=snapshot(true);rec.before=stateNames(s0);console.info('[QF_CONTINUE] target '+JSON.stringify({p:rec.point,src:rec.source,rect:rec.rect}));
  return shot('pre-continue-tap').then(function(fl){rec.preShot=fl;var c=toClient(f.x,f.y,W),id=touch.nextId();rec.listeners=touch.emit('TouchStart',c.x,c.y,id);return sleep(60).then(function(){touch.emit('TouchEnd',c.x,c.y,id);});})
  .then(function(){var t1=Date.now();return new Promise(function(r){(function poll(){var s=snapshot(true),j=(s&&s.journey)||{},left=s&&(s.state!=='island'||(j.phase&&j.phase!=='idle'));
    if(left){rec.ok=true;rec.after=stateNames(s);rec.journey={phase:j.phase,region:j.region,target:j.target};rec.leftMs=Date.now()-t1;r();}
    else if(Date.now()-t1>=to){rec.ok=false;rec.after=stateNames(s);rec.journey={phase:j.phase,region:j.region,target:j.target};r();}else setTimeout(poll,200);})();});})
  .then(function(){if(rec.ok){console.info('[QF_CONTINUE] OK '+JSON.stringify(rec.journey)+' +'+rec.leftMs+'ms');return shot('post-continue').then(function(fl){rec.postShot=fl;});}
    res.ok=false;res.failReason=(res.failReason?res.failReason+'; ':'')+'CONTINUE_FAILED';console.warn('[QF_CONTINUE] CONTINUE_FAILED '+JSON.stringify(rec));return shot('continue-failed').then(function(fl){rec.failShot=fl;});});}

/* {op:'untilLake',timeoutMs?=420000,shotEveryMs?=300,stopAfter?:bool} follow the real flow after the finale:
 * auto balloon -> lakeside = success; if island-idle shows up (继续旅程) for >3 s, run continueJourney once (fixed locator) and keep following.
 * lakeside-fallback / journey failed / timeout -> res.ok=false (LAKE_FAILED / LAKE_TIMEOUT). Never uses qfSkip/teleport. */
function untilLake(st,rec,res,W){var to=st.timeoutMs||420000,t0=Date.now(),idleSince=0,used=false,lastShot=0,se=st.shotEveryMs||300;rec.seen=[];
  return new Promise(function(done){(function poll(){var s=snapshot(true)||{},j=s.journey||(s.world&&s.world.journey)||{},k=s.state+'|'+j.phase+'|'+j.region+'>'+j.target;
    if(rec.seen[rec.seen.length-1]!==k){rec.seen.push(k);console.info('[QF_UNTIL_LAKE] '+((Date.now()-t0)/1000).toFixed(1)+'s '+k);}
    if(gameFail.journeyFailed.length){rec.ok=false;rec.reason='journey failed';done();return;}
    if(s.state==='lakeside'||(j.region==='lakeside'&&j.phase==='arrived')){rec.ok=true;rec.lakeMs=Date.now()-t0;rec.afterTouchdownMs=g.__qfTouchdownAt?Date.now()-g.__qfTouchdownAt:null;rec.journeySrc=s.journey?'top':(s.world&&s.world.journey?'world':'none');done();return;}
    if(Date.now()-t0>to){rec.ok=false;rec.reason='timeout';done();return;}if(g.__qfTouchdownAt&&!rec.touchdownAt)rec.touchdownAt=new Date(g.__qfTouchdownAt).toISOString();if(g.__qfTouchdownAt&&Date.now()-g.__qfTouchdownAt>90000){rec.ok=false;rec.reason='NOT_LAKESIDE_90s_after_touchdown:'+k;done();return;}
    if(s.state==='island'&&(!j.phase||j.phase==='idle')){if(!idleSince)idleSince=Date.now();if(!used&&Date.now()-idleSince>3000){used=true;var r2={};rec.continue=r2;continueJourney({timeoutMs:10000},r2,{},win()).then(function(){if(!r2.ok){rec.ok=false;rec.reason='CONTINUE_FAILED';done();}else setTimeout(poll,200);});return;}}else idleSince=0;
    if(Date.now()-lastShot>=se){lastShot=Date.now();shot('ul-'+s.state).then(function(){setTimeout(poll,100);});return;}
    setTimeout(poll,150);})();}).then(function(){var f=rec.ok?'':(rec.reason==='CONTINUE_FAILED'?'CONTINUE_FAILED':'LAKE_FAILED:'+rec.reason);
      if(!rec.ok){res.ok=false;res.failReason=(res.failReason?res.failReason+'; ':'')+f;}return shot(rec.ok?'lake-arrived':'lake-failed').then(function(fl){rec.endShot=fl;});});}
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
    else if(st.op==='continueJourney')p=continueJourney(st,rec,res,W);
    else if(st.op==='untilLake')p=untilLake(st,rec,res,W);
    else if(st.op==='dayNight'){p=Promise.resolve().then(function(){var o=g.__worldDayNight&&g.__worldDayNight.owner;rec.before=g.__worldDayNight&&g.__worldDayNight.snapshot();try{o.setDayNight(st.night?'night':'day',true);}catch(e){rec.err=String(e);}return sleep(2500);}).then(function(){rec.after=g.__worldDayNight.snapshot();console.info('[QF_DAYNIGHT] '+JSON.stringify(rec.after));});}
    else if(st.op==='tapEnding'){p=Promise.resolve().then(function(){var E=g.__qfEndingScreen&&g.__qfEndingScreen();rec.endingScreen=E&&{night:E.night,ready:E.ready,loaded:E.loaded,failed:E.failed,size:E.size,buttonCy:E.layout&&E.layout.buttonCy,checks:E.checks};rec.ending=g.__qfEnding;if(!E||!E.layout){rec.tapped=false;return;}var W=win(),y=E.layout.buttonCy*DESIGN_W/(E.size&&E.size[0]||DESIGN_W),c=toClient(195,y,W),id=touch.nextId();touch.emit('TouchStart',c.x,c.y,id);rec.tapped={x:195,y:Math.round(y)};return sleep(60).then(function(){touch.emit('TouchEnd',c.x,c.y,id);});});}
    else if(st.op==='burst')p=burst(st);
    else if(st.op==='dumpTap')p=Promise.resolve(qfDump(st.name||'tap'));
    else if(st.op==='autoPlay')p=autoPlay(st,rec);
    else if(st.op==='screenshot')p=shot(st.name).then(function(f){rec.file=f;});
    return p.then(function(){rec.ms=Date.now()-t0;var s=writeState('after:'+st.op+(st.name?':'+st.name:''));rec.state=s&&s.state;res.steps.push(rec);console.info('[QF_AUTOPLAY] step '+JSON.stringify(rec));
      if((st.op==='waitState'&&rec.matched===false||st.op==='preTransition'&&rec.ready===false)&&st.stopOnFail!==false){res.stoppedAt=rec.i;return;}
      if(st.op==='continueJourney'&&rec.ok===false){res.stoppedAt=rec.i;res.continueFailed=true;return;}if(st.op==='untilLake'&&rec.ok===false){res.stoppedAt=rec.i;return;}if(st.op==='untilLake'&&st.stopAfter){res.starterDone=true;res.stoppedAt=rec.i;return;}if(st.op==='continueJourney'&&st.stopAfter){res.starterDone=true;res.stoppedAt=rec.i;return;}return next();});}
  return next().then(function(){clearInterval(stTimer);res.finishedAt=new Date().toISOString();res.shots=shotN;res.shotsRequested=shotStats.requested;res.shotsSkipped=shotStats.skipped;res.shotsFailed=shotStats.failed;res.shotTimeouts=shotStats.timeouts;res.shotMaxMs=shotStats.maxMs;res.screenshotApi='toTempFilePath-async';res.consoleErrors=consoleErrors;res.consoleErrorSamples=errorSamples;
    /* acceptance rule: DevTools Console Error count must be 0 */
    writeState('final');res.journeyFailures=gameFail.journeyFailed;res.snapshotErrors=gameFail.snapshotErrors;res.uncaughtErrors=gameFail.uncaught;res.hudSuppressedErrors=gameFail.hudSuppressed;
    var gf=gameFail.journeyFailed.length+gameFail.snapshotErrors.length+gameFail.uncaught.length+gameFail.hudSuppressed.length;res.gameFailures=gf;
    if(gf>0&&script.allowGameFailures!==true){res.ok=false;res.failReason=(res.failReason?res.failReason+'; ':'')+'game failures: '+gf+' (journey failed '+gameFail.journeyFailed.length+', snapshot errors '+gameFail.snapshotErrors.length+', uncaught '+gameFail.uncaught.length+', hud-suppressed '+gameFail.hudSuppressed.length+')';}
    if(consoleErrors>0&&script.allowConsoleErrors!==true){res.ok=false;res.failReason=(res.failReason?res.failReason+'; ':'')+'console errors: '+consoleErrors;}try{res.camTraceStats=JSON.parse(JSON.stringify(globalThis.__qfCamTraceStats||null))}catch(_e){};console.info('[QF_AUTOPLAY] done ok='+res.ok);flush();w2('result.json',JSON.stringify(res,null,1));},
    function(e){clearInterval(stTimer);res.ok=false;res.error=String(e);try{res.camTraceStats=JSON.parse(JSON.stringify(globalThis.__qfCamTraceStats||null))}catch(_e){};flush();w2('result.json',JSON.stringify(res,null,1));});
}
/* start once the world integration hook exists (or after 60 s regardless) */
var t0=Date.now();(function waitBoot(){if(g.__worldIntegration||Date.now()-t0>60000){console.info('[QF_AUTOPLAY] start, out='+OUT);run();}else setTimeout(waitBoot,500);})();
})();
