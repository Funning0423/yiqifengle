#!/usr/bin/env node
'use strict';
/** P0 freeze gate r3 (Mac chainL b9fe8f39 camTrace ON, CDP stack): cc update → ManagedMobileBoardUI update/finishVisual → render →
 *  paintToolTray → barTools → toolCatalog → tools → (R5 provider) snapshot → isUnlocked → (getter) readOnly/records → snapshot →
 *  inspect → load → localStorage.getItem → wx.getStorageSync. The r2 gates resolved only same-object calls, so this multi-hop,
 *  cross-object, getter-crossing chain was invisible.
 *  This gate is TRANSITIVE and over-approximating: from every hot root (update / lateUpdate / render / paint* / draw* / camLogFrame /
 *  probe*, director EVENT_* handlers, setInterval / requestAnimationFrame / schedule callbacks) it follows EVERY call by name to EVERY
 *  definition of that name in game code (.ts AND the vendored .js runtimes, resolved globally, any receiver), plus property reads of
 *  names that are getters (get x(){}, Object.defineProperty(o,'x',{get}), ['a','b'].forEach(k=>Object.defineProperty(o,k,{get}))).
 *  SINKS: any *Sync host call, getSafeAreaRect / getWindowInfo / getMenuButtonBoundingClientRect / getDeviceInfo / getAppBaseInfo /
 *  getSystemSetting, and any getItem / setItem / removeItem / clear on a receiver whose text contains `localStorage`.
 *  CUTS (named reasons, each pinned below): cached readers runtime-tested elsewhere, and storage adapters whose production injection is
 *  the write-through cache. Negative self-tests: the exact chainL chain (fixture) and the pre-fix PersistentMainlinePort. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
const SYNC=/^(?:\w+Sync|getSafeAreaRect|getWindowInfo|getMenuButtonBoundingClientRect|getDeviceInfo|getAppBaseInfo|getSystemSetting)$/;
const STORE=/^(getItem|setItem|removeItem|clear)$/;
/** per-frame engine events only (EVENT_HIDE / EVENT_SHOW / touch events are one-shot, not hot) */
const FRAME_EVENT=/EVENT_(BEFORE|AFTER)_(DRAW|UPDATE|RENDER|PHYSICS|SCENE_LAUNCH_NEVER)|EVENT_(BEFORE|AFTER)_COMMIT|EVENT_END_FRAME|EVENT_BEGIN_FRAME|EVENT_UPDATE/;
const ROOTNAME=/^(update|lateUpdate|render|paint\w*|draw\w*|camLogFrame|camLogActor|probe\w*)$/;
/** names never followed (pure data helpers whose every definition is storage-free; following them only aliases unrelated code) */
const GENERIC=new Set(['push','pop','map','filter','forEach','find','some','every','reduce','slice','concat','join','indexOf','includes','keys','values','entries','assign','freeze','stringify','parse','call','apply','bind','then','catch','resolve','reject','toString','floor','min','max','abs','round','sqrt','hypot','atan2','sin','cos','set','get','has','add','delete','log','warn','error','info','emit','on','off','once','now','clone','copy','random','String','Number','Boolean','Array','Object','Error','Map','Set','sort','splice','fill','trim','replace','split','test','exec','match']);
/** CUT: function name@file → reason. Calls into these are not descended. */
const CUT={
 'cachedHostInfo@ui/BoardLayout.ts':'host info cache (refresh on wx.onWindowResize); runtime-tested by host-sync-per-frame',
 'probeSafeArea@region/CamTraceLog.ts':'safe-area cache (refresh on canvas-resize); host-sync-per-frame',
 'cachedWxQuery@region/DebugQuery.ts':'launch query read once per wx; host-sync-per-frame',
 'getItem@world-r2/PersistentMainlinePort.ts':'writeThroughStorage: storage hit once per key, then memory (storage-cache test)',
 'setItem@world-r2/PersistentMainlinePort.ts':'writeThroughStorage write path (writes are not per frame; [QF_SYNC] runtime gate)',
 'load@mainline-r1/adapter/mainline-port.js':'createSynchronousStorage(localStorage): production injection is writeThroughStorage (pinned: PersistentMainlinePort passes the cache)',
};
const isFn=n=>n&&(ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)||ts.isGetAccessor(n)||ts.isConstructorDeclaration(n));
function nameOf(e){e=ts.isParenthesizedExpression(e)?e.expression:e;if(ts.isIdentifier(e))return e.text;if(ts.isPropertyAccessExpression(e))return e.name.text;if(ts.isElementAccessExpression(e)&&ts.isStringLiteral(e.argumentExpression))return e.argumentExpression.text;return null;}
function parse(rel,src){const sf=ts.createSourceFile(rel,src,ts.ScriptTarget.ES2020,true,/\.js$/.test(rel)?ts.ScriptKind.JS:ts.ScriptKind.TS);
 const fns=[],getters=[],roots=[];const line=n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
 const def=(name,f,getter)=>{if(name&&f)(getter?getters:fns).push({name,f,rel,line:line(f)});};
 (function visit(n){
  if(ts.isFunctionDeclaration(n)&&n.name)def(n.name.text,n);
  else if(ts.isMethodDeclaration(n)&&n.name&&(ts.isIdentifier(n.name)||ts.isStringLiteral(n.name)))def(n.name.text,n);
  else if(ts.isGetAccessor(n)&&n.name&&ts.isIdentifier(n.name))def(n.name.text,n,true);
  else if((ts.isVariableDeclaration(n)||ts.isPropertyDeclaration(n)||ts.isPropertyAssignment(n))&&n.name&&(ts.isIdentifier(n.name)||ts.isStringLiteral(n.name))&&n.initializer&&isFn(n.initializer)){
   if(ts.isPropertyAssignment(n)&&n.name.text==='get'){/* defineProperty descriptor */
    const call=n.parent&&n.parent.parent;if(call&&ts.isCallExpression(call)&&nameOf(call.expression)==='defineProperty'&&call.arguments.length>=3){const key=call.arguments[1];
     if(ts.isStringLiteral(key))def(key.text,n.initializer,true);
     else if(ts.isIdentifier(key)){/* ['a','b'].forEach(function(key){Object.defineProperty(o,key,{get})}) */let p=call.parent;while(p&&!(ts.isCallExpression(p)&&nameOf(p.expression)==='forEach'))p=p.parent;
      if(p&&ts.isPropertyAccessExpression(p.expression)&&ts.isArrayLiteralExpression(p.expression.expression))for(const el of p.expression.expression.elements)if(ts.isStringLiteral(el))def(el.text,n.initializer,true);}}}
   else def(n.name.text,n.initializer);}
  else if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&isFn(n.right)){const nm=nameOf(n.left);if(nm)def(nm,n.right);}
  if(ts.isCallExpression(n)){const nm=nameOf(n.expression),a=n.arguments;let cb=null,why=null;
   if((nm==='on'||nm==='once')&&a.length>=2&&FRAME_EVENT.test(a[0].getText(sf))){cb=a[1];why=nm+'('+a[0].getText(sf)+')';}
   else if((nm==='setInterval'||nm==='requestAnimationFrame')&&a.length){cb=a[0];why=nm;}
   else if(nm==='schedule'&&a.length&&ts.isPropertyAccessExpression(n.expression)){cb=a[0];why='schedule';}
   if(cb)roots.push({cb,why:rel+':'+line(n)+' '+why});}
  ts.forEachChild(n,visit);})(sf);
 for(const d of fns)if(ROOTNAME.test(d.name))roots.push({fn:d,why:rel+':'+d.line+' '+d.name+'()'});
 return {rel,sf,fns,getters,roots,line};}
function owner(n){for(let p=n.parent;p;p=p.parent){if(!isFn(p))continue;if((ts.isFunctionDeclaration(p)||ts.isMethodDeclaration(p)||ts.isGetAccessor(p))&&p.name)return p.name.text;const q=p.parent;
  if(q&&(ts.isPropertyAssignment(q)||ts.isVariableDeclaration(q)||ts.isPropertyDeclaration(q))&&q.name&&(ts.isIdentifier(q.name)||ts.isStringLiteral(q.name)))return q.name.text;if(q&&ts.isBinaryExpression(q)){const nm=nameOf(q.left);if(nm)return nm;}}return '<top>';}
/** SINKS reviewed as NOT per frame (the over-approximating name graph reaches them through aliased names). Key rel#function#call.
 *  Adding a key needs a reason; any OTHER sink reachable from a hot root fails. Runtime proof on device: [QF_SYNC] (steady frames = 0). */
const SINK_OK={
 'r4-cloud-compat/adapter/cocos-port.js#load#getItem':'R4 store load: read in the R4 Store constructor only (challenge gates on island/board entry, a tap)',
 'regional-r05/runtime/campaign-host.js#load#getItem':'R5 Store load: read in the R5 Store constructor only (provider created on board entry)',
 'world-r2/PersistentR5Port.ts#getItem#getItem':'R5 platform getItem: Store constructor + inspect() (QA probe / save drain), not render',
 'world-r2/WorldNativeComposition.ts#getItem#getItem':'R4 platform getItem (frozen WNC:234): R4 Store constructor only',
 'world-r2/RegionFlowTest.ts#getItem#getItem':'QA flow-test lanes, tap-driven',
 'world-r2/R5PersistenceProbe.ts#read#getItem':'QA persistence probe API, harness-called',
 'world-r2/R5PersistenceProbe.ts#createIsolatedTestPort#getItem':'QA persistence probe API, harness-called',
 'mainline-r1/adapter/mainline-port.js#save#setItem':'mainline save (write path: commit / chest / claim), not per frame',
 'r4-cloud-compat/adapter/cocos-port.js#save#setItem':'R4 save (write path)',
 'world-r1/WorldFlowComponent.ts#reportRuntime#setItem':"diagnostic write guarded by event!=='tick' (door-shut / hide / show); timed by [QF_STORAGE]",
 'region/RegionValidation.ts#capture#setItem':'skycity diagnostic capture on board arm (one-shot)',
 'audio/GameAudio.ts#setSfxMuted#setItem':'settings toggle (tap)','audio/GameAudio.ts#setMusicVolume#setItem':'settings change (tap)',
 'ui/EndingScreen.ts#markJourneyComplete#setItem':'ending (one-shot)',
 'world-r2/IslandHomeInteraction.ts#safe#getWindowInfo':'pointer down/up only','world-r2/IslandHomeInteraction.ts#safe#getSystemInfoSync':'pointer down/up only','world-r2/IslandHomeInteraction.ts#safe#getMenuButtonBoundingClientRect':'pointer down/up only',
 'regional-r05/runtime/campaign-host.js#save#setItem':'R5 save (write path)',
 'world-r2/R5PersistenceProbe.ts#getItem#getItem':'QA persistence probe port, harness-called',
 'world-r2/PersistentR5Port.ts#setItem#setItem':'R5 write path','world-r2/RegionFlowTest.ts#setItem#setItem':'QA flow-test write path','world-r2/WorldNativeComposition.ts#setItem#setItem':'R4 write path (frozen WNC:234)',
 /* reached via aliased getItem/setItem from guarded callers: LakesideArrivalUI.update reads seenT03 once per ride start (lastRide edge);
    ManagedMobileBoardUI.maybeShowRegionTitle reads/writes qfl.ui.seenRegionTitle once per stage change (titleStage edge) */
 'world-r2/QaSkip.ts#qaSkipAllowed#getAccountInfoSync':'QA gate; hot callers go through cachedWxQuery / memoized flags',
 'world-r2/QaSkip.ts#qaQuery#getEnterOptionsSync':'QA query; boot / tap','world-r2/QaSkip.ts#qaQuery#getLaunchOptionsSync':'QA query; boot / tap',
 'region/JourneyTransport.ts#transportQaEnabled#getAccountInfoSync':'QA entry gate (boot / tap)','region/JourneyTransport.ts#qaTransportEnabled#getAccountInfoSync':'QA entry gate (boot / tap)',
};
function index(files){const F=new Map(),G=new Map();for(const P of files){for(const d of P.fns){if(!F.has(d.name))F.set(d.name,[]);F.get(d.name).push({...d,P});}for(const d of P.getters){if(!G.has(d.name))G.set(d.name,[]);G.get(d.name).push({...d,P});}}return {F,G};}
function scan(files,cut=CUT,sinkOk=SINK_OK){const {F,G}=index(files);const v=new Map();
 for(const P of files)for(const r of P.roots){let start=[];
  if(r.fn)start=[{...r.fn,P}];else{let cb=r.cb;if(ts.isCallExpression(cb)&&nameOf(cb.expression)==='bind')cb=cb.expression.expression;if(isFn(cb))start=[{name:'<cb>',f:cb,rel:P.rel,P}];else{const nm=nameOf(cb);if(nm)start=(F.get(nm)||[]).map(d=>d);}}
  const seen=new Set(),q=start.map(s=>[s,r.why+(s.name!=='<cb>'&&!r.fn?'→'+s.name:'')]);
  while(q.length){const [d,trail]=q.shift();if(seen.has(d.f))continue;seen.add(d.f);if(cut[d.name+'@'+d.rel])continue;const DP=d.P;
   (function walk(n){
    if(n!==d.f&&isFn(n)){const p=n.parent;/* nested defs (declarations, methods, o.x=function, {x:function}, const x=()=>) are separate nodes, reached only when called; inline callbacks passed as arguments are walked */
     if(!(ts.isArrowFunction(n)||ts.isFunctionExpression(n))||(p&&(ts.isPropertyAssignment(p)||ts.isVariableDeclaration(p)||ts.isPropertyDeclaration(p)||(ts.isBinaryExpression(p)&&p.right===n))))return;}
    if(ts.isCallExpression(n)){const nm=nameOf(n.expression);const recv=ts.isPropertyAccessExpression(n.expression)?n.expression.expression.getText(DP.sf):'';
     if(nm&&(SYNC.test(nm)||(STORE.test(nm)&&/localStorage/.test(recv)))){const k=trail+' → '+(recv?recv+'.':'')+nm+' @'+DP.rel+':'+DP.line(n);const sk=DP.rel+'#'+owner(n)+'#'+nm;if(!(sinkOk||{})[sk]&&!v.has(sk))v.set(sk,k+'  ['+sk+']');}
     else if(nm&&!GENERIC.has(nm))for(const t of F.get(nm)||[])if(t.f!==d.f)q.push([t,trail+'→'+nm]);}
    else if(ts.isPropertyAccessExpression(n)&&!(n.parent&&ts.isCallExpression(n.parent)&&n.parent.expression===n)){const nm=n.name.text;for(const t of G.get(nm)||[])q.push([t,trail+'→get '+nm]);}
    ts.forEachChild(n,walk);})(d.f.body||d.f);}}
 return [...v.values()];}
function walkDir(d,re,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walkDir(p,re,o);else if(re.test(f.name)&&!/\.d\.ts$/.test(f.name))o.push(p);}return o;}
const files=walkDir(S,/\.(ts|js)$/).map(p=>parse(path.relative(S,p).split(path.sep).join('/'),fs.readFileSync(p,'utf8')));
if(process.argv.includes('--list')){for(const x of scan(files))console.log(x);process.exit(0);}
const v=scan(files);
assert.deepEqual(v,[],'storage read / sync host call reachable from a per-frame / render / draw / timer callback:\n'+v.join('\n'));
// pins for the cuts
const pm=fs.readFileSync(path.join(S,'world-r2/PersistentMainlinePort.ts'),'utf8');
function pinMainline(src){assert.match(src,/const ls=writeThroughStorage\(/,'PersistentMainlinePort builds the write-through cache');assert.match(src,/MainlinePort\.createPort\(ls\)/,'mainline port gets the cache, not sys.localStorage');
 assert.doesNotMatch(src.replace(/export function writeThroughStorage[\s\S]*$/,''),/createPort\(\{getItem/,'raw localStorage injected');}
pinMainline(pm);
const roots=files.reduce((a,P)=>a+P.roots.length,0);assert.ok(roots>=30,'roots '+roots);
// ── negative self-tests ──
let caught=0;const neg=(n,f)=>{let ok=false;try{f();}catch{ok=true;}assert.ok(ok,'self-test missed: '+n);caught++;};
const fx=(m)=>Object.entries(m).map(([rel,src])=>parse(rel,src));
const chainL={
 'ManagedMobileBoardUI.ts':"export class ManagedMobileBoardUI{ update(dt:number){ if(this.visualLeft<=0)this.finishVisual(); } private finishVisual(){ this.render(); } render(){ this.paintToolTray(); } private paintToolTray(){ for(const t of this.barTools()){} } private barTools(){ return this.toolCatalog(); } private toolCatalog(){ return this.managed?.tools?.()||[]; } }",
 'world-r2/ManagedBoardSession.ts':"export function bind(controller:any){ return { tools:()=>managedTools(controller.snapshot()) }; }",
 'regional-r05/runtime/board-session-provider.js':"Provider.prototype.snapshot=function(){var self=this;return API.catalog.map(function(stage){return self.progress.isUnlocked(stage.id);});};",
 'regional-r05/runtime/progress-journal.js':"Journal.prototype.isUnlocked=function(id){if(!this.journey||this.journey.readOnly)return false;return !!this.journey.records;};",
 'mainline-r1/runtime/journey-bridge.js':"JourneyBridge.prototype.inspect=function(){return inspect(this.platform);};\nfunction inspect(platform){return platform.load('k');}\nJourneyBridge.prototype.snapshot=function(){return this.inspect().view;};\nJourneyBridge.prototype.readOnlyView=function(){var self=this,view={};['readOnly','records'].forEach(function(key){Object.defineProperty(view,key,{enumerable:true,get:function get(){var s=self.snapshot();return s[key];}});});return Object.freeze(view);};",
 'mainline-r1/adapter/mainline-port.js':"function createSynchronousStorage(localStorage){return {load:function load(k){return localStorage.getItem(k);}};}",
};
neg('exact chainL multi-hop chain (render→…→isUnlocked→getter readOnly→snapshot→inspect→load→localStorage.getItem), no cut',()=>{const r=scan(fx(chainL),{},{});assert.deepEqual(r,[]);});
{const r=scan(fx(chainL),{},{});assert.ok(r.some(x=>/update\(\)→finishVisual→render→paintToolTray→barTools→toolCatalog→tools→snapshot→.*load → localStorage\.getItem/.test(x)),'trail names the chain: '+r.join(' | '));}
{const m={...chainL,'mainline-r1/runtime/journey-bridge.js':"JourneyBridge.prototype.peek=function(){return readRaw(this.platform);};\nfunction readRaw(platform){return platform.load('k');}\nJourneyBridge.prototype.readOnlyView=function(){var self=this,view={};['readOnly','records'].forEach(function(key){Object.defineProperty(view,key,{enumerable:true,get:function get(){return self.peek()[key];}});});return Object.freeze(view);};"};
 const r=scan(fx(m),{},{});assert.ok(r.some(x=>/isUnlocked→get readOnly→peek→readRaw→load/.test(x)),'getter hop: '+r.join(' | '));neg('chainL where the ONLY link is the defineProperty getter (journey.readOnly → bridge view)',()=>assert.deepEqual(r,[]));}
neg('same chain via wx.getStorageSync directly',()=>{const m={...chainL,'mainline-r1/adapter/mainline-port.js':"function createSynchronousStorage(){return {load:function load(k){return wx.getStorageSync(k);}};}"};assert.deepEqual(scan(fx(m),{},{}),[]);});
neg('pre-fix PersistentMainlinePort (raw sys.localStorage injected)',()=>pinMainline(cp.execFileSync('git',['show','b9fe8f39:creator-build-project/assets/scripts/world-r2/PersistentMainlinePort.ts'],{cwd:ROOT,encoding:'utf8'})));
neg('setInterval → helper → sys.localStorage.getItem',()=>assert.deepEqual(scan(fx({'x/A.ts':"function rd(){return sys.localStorage.getItem('k');}\nsetInterval(()=>rd(),100);"})),[]));
neg('director EVENT_AFTER_DRAW → class getter → getSystemInfoSync',()=>assert.deepEqual(scan(fx({'x/B.ts':"class H{ get info(){ return wx.getSystemInfoSync(); } }\ndirector.on(Director.EVENT_AFTER_DRAW,()=>{ const w=h.info; });"})),[]));
// clean control
assert.deepEqual(scan(fx({'x/C.ts':"export class C{ update(){ const v=this.cache.get('k'); } }"})),[]);
console.log('PASS host-sync-hot-transitive files='+files.length+' roots='+roots+' self-tests='+caught);
