#!/usr/bin/env node
'use strict';
/** P0 freeze gate r2 (Mac chainJ 23267b2d camTrace ON: frozen JS stack = tools/wx-autoplay/qf-autoplay.js shot→take →
 *  canvas.toTempFilePathSync → WAGame b.toTempFilePathSync → appservice invoke → sync, called from cc.director EVENT_AFTER_DRAW).
 *  Sibling of test_no_sync_host_per_frame.cjs. AST based (TypeScript compiler API, also parses the JS harness).
 *  HOT ROOTS = code that runs every frame / every draw / on a timer during gameplay:
 *    - director/anything .on/.once(<EVENT_* | Director.*>, cb)   (EVENT_BEFORE_DRAW, EVENT_AFTER_DRAW, EVENT_AFTER_UPDATE, ...)
 *    - setInterval(cb), requestAnimationFrame(cb), *.schedule(cb) / *.scheduleOnce is NOT hot (one shot)
 *    - functions / methods named update | lateUpdate | camLogFrame | camLogActor | probe*
 *  A hot root, and every function it calls (same file by name, or imported by name from another game file), must not call a
 *  synchronous host API: any callee named *Sync (toTempFilePathSync, appendFileSync, getStorageSync, getSystemInfoSync, ...) or
 *  getSafeAreaRect / getWindowInfo / getMenuButtonBoundingClientRect / getDeviceInfo / getAppBaseInfo / getSystemSetting.
 *  Descending stops at the cached readers that test_no_sync_host_per_frame.cjs runtime-tests (hit host once, refresh on resize).
 *  Scope: creator-build-project/assets/scripts/**.ts (QF_PROBE blocks INCLUDED, they run in test builds) + tools/wx-autoplay/**.js.
 *  Harness extra rule: the harness runs only during gameplay, so ANY *Sync call in it must be boot-time (top level of the IIFE
 *  or an allowlisted boot reader). Negative self-tests: each rule must catch a mutant, incl. the old 23267b2d qf-autoplay shot code. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts'),H=path.join(ROOT,'tools/wx-autoplay');
const SYNC_NAME=/^(?:\w+Sync|getSafeAreaRect|getWindowInfo|getMenuButtonBoundingClientRect|getDeviceInfo|getAppBaseInfo|getSystemSetting)$/;
const FRAME=/^(update|lateUpdate|camLogFrame|camLogActor|probe\w*)$/;
/** cached / event-only readers (runtime-tested by test_no_sync_host_per_frame.cjs): calls into them are fine, we do not descend */
const CACHED=new Set(['cachedHostInfo','probeSafeArea','cachedWxQuery','transportQaEnabled','qaTransportEnabled','devPreviewBuild',
 'cloudTraceOn'/* region/CloudTrace.ts: memoized on host.__QF_CLOUD_TRACE_Q, host hit once */]);
/** harness boot-only readers (run once before run(); readWin is refreshed by wx.onWindowResize, never per step) */
const HARNESS_BOOT=new Set(['rd','readWin']);
const isFn=n=>n&&(ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)||ts.isGetAccessor(n)||ts.isConstructorDeclaration(n));
function calleeName(e){e=ts.isParenthesizedExpression(e)?e.expression:e;if(ts.isIdentifier(e))return e.text;if(ts.isPropertyAccessExpression(e)||ts.isPropertyAccessChain?.(e))return e.name.text;if(ts.isElementAccessExpression(e)&&ts.isStringLiteral(e.argumentExpression))return e.argumentExpression.text;return null;}
function parse(rel,src){const kind=/\.js$|\.cjs$/.test(rel)?ts.ScriptKind.JS:ts.ScriptKind.TS;const sf=ts.createSourceFile(rel,src,ts.ScriptTarget.ES2020,true,kind);
 const fns=new Map(),imports=new Set(),roots=[],syncCalls=[];const add=(n,f)=>{if(!n||!f)return;if(!fns.has(n))fns.set(n,[]);fns.get(n).push(f);};
 const line=n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
 (function visit(n){
  if(ts.isFunctionDeclaration(n)&&n.name)add(n.name.text,n);
  else if(ts.isMethodDeclaration(n)&&n.name&&ts.isIdentifier(n.name))add(n.name.text,n);
  else if((ts.isVariableDeclaration(n)||ts.isPropertyDeclaration(n)||ts.isPropertyAssignment(n))&&n.name&&ts.isIdentifier(n.name)&&n.initializer&&isFn(n.initializer))add(n.name.text,n.initializer);
  else if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&isFn(n.right)){const nm=calleeName(n.left);if(nm)add(nm,n.right);}
  if(ts.isImportDeclaration(n)&&n.importClause&&n.importClause.namedBindings&&ts.isNamedImports(n.importClause.namedBindings))for(const e of n.importClause.namedBindings.elements)imports.add(e.name.text);
  if(ts.isCallExpression(n)){const nm=calleeName(n.expression),a=n.arguments;
   if(nm&&SYNC_NAME.test(nm))syncCalls.push({name:nm,node:n,line:line(n)});
   let cb=null,why=null;
   if((nm==='on'||nm==='once')&&a.length>=2&&/EVENT_|Director\./.test(a[0].getText(sf))){cb=a[1];why=nm+'('+a[0].getText(sf)+')';}
   else if((nm==='setInterval'||nm==='requestAnimationFrame')&&a.length>=1&&ts.isIdentifier(n.expression)||(nm==='setInterval'&&a.length)){cb=a[0];why=nm;}
   else if(nm==='schedule'&&a.length>=1&&ts.isPropertyAccessExpression(n.expression)){cb=a[0];why='schedule';}
   if(cb)roots.push({cb,why,line:line(n)});}
  ts.forEachChild(n,visit);})(sf);
 for(const [nm,list] of fns)if(FRAME.test(nm)&&!CACHED.has(nm))for(const f of list)roots.push({cb:f,why:nm+'()',line:line(f),named:nm});
 return {rel,sf,fns,imports,roots,syncCalls,line};}
function resolveCb(P,cb){if(!cb)return [];if(ts.isCallExpression(cb)&&calleeName(cb.expression)==='bind'&&ts.isPropertyAccessExpression(cb.expression))return resolveCb(P,cb.expression.expression);
 if(isFn(cb))return [{f:cb,P,name:'<inline>'}];const nm=calleeName(cb);if(!nm)return [];return (P.fns.get(nm)||[]).map(f=>({f,P,name:nm}));}
/** all violations reachable from the hot roots of the given parsed files (global = name → [{f,P}] across game files for imports) */
function scan(parsed,global){const v=[];
 for(const P of parsed)for(const r of P.roots){const start=resolveCb(P,r.cb);const seen=new Set();const q=start.map(s=>[s,P.rel+':'+r.line+' '+r.why+(s.name!=='<inline>'?'→'+s.name:'')]);
  while(q.length){const [{f,P:FP,name},trail]=q.shift();if(seen.has(f))continue;seen.add(f);if(CACHED.has(name))continue;
   (function walk(n){if(ts.isCallExpression(n)){const nm=calleeName(n.expression);
     if(nm&&SYNC_NAME.test(nm))v.push(trail+' → '+nm+' @'+FP.rel+':'+FP.line(n));
     else if(nm&&!CACHED.has(nm)){/* resolve plain calls f() and this.f(); obj.f() on another object is not resolved by name (would alias e.g. a nav.start() to this file's start()) */
      const own=ts.isIdentifier(n.expression)||(ts.isPropertyAccessExpression(n.expression)&&n.expression.expression.kind===ts.SyntaxKind.ThisKeyword);
      let t=(FP.fns.get(nm)||[]).map(x=>({f:x,P:FP,name:nm}));
      if(!t.length&&ts.isIdentifier(n.expression)&&FP.imports.has(nm)&&global)t=(global.get(nm)||[]);
      if(own)for(const x of t)if(x.f!==f)q.push([x,trail+'→'+nm]);}}
    ts.forEachChild(n,walk);})(f.body||f);}}
 return v;}
/** harness rule: every *Sync call is boot-time (only the outer IIFE above it, or inside an allowlisted boot reader) */
function harnessBootOnly(P){const v=[];for(const c of P.syncCalls){let n=c.node.parent,depth=0,owner=null;
  while(n){if(isFn(n)){depth++;if(!owner){const p=n.parent;owner=ts.isFunctionDeclaration(n)&&n.name?n.name.text:(p&&ts.isVariableDeclaration(p)&&ts.isIdentifier(p.name)?p.name.text:null);}}n=n.parent;}
  if(depth<=1||(depth===2&&HARNESS_BOOT.has(owner)))continue;v.push(P.rel+':'+c.line+' '+c.name+' inside '+(owner||'<anonymous fn>')+' (harness runs during gameplay: use the async API)');}
 return v;}
function walkDir(d,re,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walkDir(p,re,o);else if(re.test(f.name)&&!/\.d\.ts$/.test(f.name))o.push(p);}return o;}
/* tester mode: `node test_no_sync_hot_callbacks.cjs --harness <fork.js>` checks a patched harness fork (e.g. Mac ~/qfap-run/pt/qf-autoplay.js) */
{const i=process.argv.indexOf('--harness');if(i>0){const f=process.argv[i+1];const P=parse('tools/wx-autoplay/'+path.basename(f),fs.readFileSync(f,'utf8'));const v=scan([P],null).concat(harnessBootOnly(P));
 if(v.length){console.error('FAIL harness '+f+'\n'+v.join('\n'));process.exit(1);}console.log('PASS harness '+f+' roots='+P.roots.length);process.exit(0);}}
const game=walkDir(S,/\.ts$/).map(p=>parse(path.relative(S,p).split(path.sep).join('/'),fs.readFileSync(p,'utf8')));
const global=new Map();for(const P of game)for(const [nm,list] of P.fns){if(!global.has(nm))global.set(nm,[]);for(const f of list)global.get(nm).push({f,P,name:nm});}
const harness=walkDir(H,/\.js$/).map(p=>parse('tools/wx-autoplay/'+path.relative(H,p).split(path.sep).join('/'),fs.readFileSync(p,'utf8')));
const vGame=scan(game,global),vHar=scan(harness,null),vBoot=harness.flatMap(harnessBootOnly);
assert.deepEqual(vGame,[],'game code: sync host call reachable from a per-frame / draw-event / interval callback:\n'+vGame.join('\n'));
assert.deepEqual(vHar,[],'harness: sync host call reachable from a draw-event / interval callback:\n'+vHar.join('\n'));
assert.deepEqual(vBoot,[],'harness: sync host call outside boot:\n'+vBoot.join('\n'));
const nRoots=game.reduce((a,P)=>a+P.roots.length,0),hRoots=harness.reduce((a,P)=>a+P.roots.length,0);
assert.ok(nRoots>=20,'scanner found '+nRoots+' game hot roots (expected the BalloonTransit/SailRide/TransitionPreload draw hooks and update()s)');
assert.ok(hRoots>=3,'scanner found '+hRoots+' harness hot roots (after-draw capture request, flush + state intervals)');
// pinned: the harness capture is the async API and the after-draw callback only requests it
const cur=fs.readFileSync(path.join(H,'qf-autoplay.js'),'utf8');
assert.match(cur,/cv\.toTempFilePath\(\{/);assert.doesNotMatch(cur.replace(/\/\*[\s\S]*?\*\//g,''),/toTempFilePathSync|copyFileSync|appendFileSync|unlinkSync/);
// ── negative self-tests ──
let caught=0;const expectCatch=(name,fn)=>{let ok=false;try{fn();}catch{ok=true;}assert.ok(ok,'self-test did not catch: '+name);caught++;};
const one=(rel,src,glob)=>{const P=parse(rel,src);const v=scan([P],glob||null).concat(/\.js$/.test(rel)?harnessBootOnly(P):[]);assert.deepEqual(v,[]);};
expectCatch('toTempFilePathSync injected into an after-draw handler (TS)',()=>one('x/A.ts',"import {director,Director} from 'cc';\nexport function arm(cv:any){director.on(Director.EVENT_AFTER_DRAW,()=>{const p=cv.toTempFilePathSync({});});}"));
expectCatch('after-draw → named helper → canvas *Sync',()=>one('x/B.ts',"function grab(cv:any){return cv.toDataURLSync?.();}\nexport function arm(cv:any){director.once(Director.EVENT_AFTER_DRAW,()=>grab(cv));}"));
expectCatch('once(EVENT, this.finish, this) method → getSystemInfoSync',()=>one('x/C.ts',"export class C{ go(){director.once(Director.EVENT_AFTER_DRAW,this.finish,this);} finish(){const i=wx.getSystemInfoSync();} }"));
expectCatch('before-draw tick → getSafeAreaRect',()=>one('x/D.ts',"const tick=()=>{const s=(sys as any).getSafeAreaRect();};director.on(Director.EVENT_BEFORE_DRAW,tick);"));
expectCatch('setInterval → helper → fs.appendFileSync',()=>one('x/E.ts',"function w(s:string){fs.appendFileSync('a',s);}\nsetInterval(()=>w('x'),1000);"));
expectCatch('this.schedule(cb) → getStorageSync',()=>one('x/F.ts',"export class F{ start(){this.schedule(this.tick,0.1);} tick(){wx.getStorageSync('k');} }"));
{const dep=parse('x/Dep.ts',"export function hostW(){return wx.getWindowInfo();}");const g=new Map([['hostW',[{f:dep.fns.get('hostW')[0],P:dep,name:'hostW'}]]]);
 expectCatch('update() → imported function in another file → getWindowInfo',()=>one('x/G.ts',"import {hostW} from './Dep';\nexport class G{ update(){ hostW(); } }",g));}
const old=cp.execFileSync('git',['show','23267b2d:tools/wx-autoplay/qf-autoplay.js'],{cwd:ROOT,encoding:'utf8'});
expectCatch('old 23267b2d qf-autoplay (shot→take toTempFilePathSync in EVENT_AFTER_DRAW)',()=>assert.deepEqual(scan([parse('tools/wx-autoplay/qf-autoplay.js',old)],null),[]));
{const v=scan([parse('tools/wx-autoplay/qf-autoplay.js',old)],null);assert.ok(v.some(x=>/once\(cc\.Director\.EVENT_AFTER_DRAW\)→take → toTempFilePathSync/.test(x)),'old shot path named in the trail: '+v.join(' | '));
 assert.ok(v.some(x=>/setInterval.*→flush→w2 → appendFileSync|setInterval.*→writeState→w2 → appendFileSync/.test(x)),'old sync log flush caught too: '+v.join(' | '));}
expectCatch('old shot() restored into the current harness',()=>{const i=old.indexOf('var shotN=0;'),j=old.indexOf("/* {op:'preTransition'");const i2=cur.indexOf('/* r2 (chainJ P0 freeze'),j2=cur.indexOf("/* {op:'preTransition'");
 assert.ok(i>0&&j>i&&i2>0&&j2>i2);const mut=cur.slice(0,i2)+old.slice(i,j)+cur.slice(j2);one('tools/wx-autoplay/qf-autoplay.js',mut);});
expectCatch('harness: sync call in a step handler (not boot)',()=>one('tools/wx-autoplay/m.js',"(function(){var fs=wx.getFileSystemManager();function step(){fs.readFileSync('a');}setTimeout(step,1);})();"));
// port-async-io.cjs (tester fork port): porting the old 23267b2d harness yields a harness that passes this gate
{const os=require('os');const d=fs.mkdtempSync(path.join(os.tmpdir(),'qf-port-'));const fo=path.join(d,'fork.js');fs.writeFileSync(fo,old);
 const r=cp.spawnSync(process.execPath,[path.join(H,'port-async-io.cjs'),fo,path.join(d,'out.js')],{encoding:'utf8'});assert.equal(r.status,0,'port-async-io failed: '+r.stderr);
 const ported=fs.readFileSync(path.join(d,'out.js'),'utf8');one('tools/wx-autoplay/qf-autoplay.js',ported);new Function(ported);
 assert.equal(cp.spawnSync(process.execPath,[path.join(H,'port-async-io.cjs'),path.join(d,'out.js'),path.join(d,'x.js')]).status,2,'already-ported fork is refused');fs.rmSync(d,{recursive:true,force:true});}
// clean controls pass through the same scanner
one('x/H.ts',"export class H{ update(){ const s=cachedHostInfo('a'); } go(){director.once(Director.EVENT_AFTER_DRAW,()=>cv.toTempFilePath({success(){},fail(){}}));} }");
one('tools/wx-autoplay/ok.js',"(function(){var e=wx.getAccountInfoSync();function rd(p){return fs.readFileSync(p);}var t=rd('x');setInterval(function(){fs.appendFile({filePath:'a',data:'b'});},1000);})();");
console.log('PASS host-sync-hot-callbacks gameFiles='+game.length+' gameRoots='+nRoots+' harnessRoots='+hRoots+' self-tests='+caught);
