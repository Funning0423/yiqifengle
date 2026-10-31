#!/usr/bin/env node
'use strict';
/** P0 freeze gate (Mac 7e0f2c72 clean run, CDP stack: lateUpdate → camLogFrame → cc getSafeAreaRect → WAGameSubContext →
 *  appservice sync = a synchronous IPC to the WeChat host every frame, mach_msg block ~6 s after the skycity balloon start).
 *  1. STATIC: no sync wx / view-info host call (getSafeAreaRect, getSystemInfoSync, getWindowInfo, getMenuButtonBoundingClientRect,
 *     getDeviceInfo, getAppBaseInfo, getSystemSetting, wx.*Sync, qaQuery/qaSkipAllowed) inside a per-frame body — update / lateUpdate,
 *     camLogFrame / camLogActor / probe* — nor in a same-file function those bodies call (transitive).
 *  2. STATIC: every sync host call in game code sits in an allowlisted, cached or event-only reader.
 *  3. RUNTIME: the cached readers hit the host once for N calls and re-read only after wx.onWindowResize.
 *  Negative self-tests: each check must catch a mutant. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts');
const L=require('../transitions/sail_farsea_lib.cjs');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript'),vm=require('vm');
/** Load a script into a sandbox whose globalThis carries the fake wx. */
function loadIn(rel,sandbox,req,src){const file=path.join(S,rel);const js=ts.transpileModule(src||fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};vm.runInContext(js,Object.assign(sandbox,{module:m,exports:m.exports,require:req||(()=>({})),console}),{filename:file});return m.exports;}

const SYNC=/\b(getSafeAreaRect|getSystemInfoSync|getWindowInfo|getMenuButtonBoundingClientRect|getDeviceInfo|getAppBaseInfo|getSystemSetting|getAccountInfoSync|getLaunchOptionsSync|getEnterOptionsSync|qaQuery|qaSkipAllowed|wx\??\.\w+Sync)\b/;
const FRAME=/^(update|lateUpdate|camLogFrame|camLogActor|probe\w*)$/;
/** Allowed sync readers: file → function names (all cached or event-only). */
const ALLOW={
 'ui/BoardLayout.ts':['cachedHostInfo'],
 'region/CamTraceLog.ts':['probeSafeArea'],
 'region/DebugQuery.ts':['cachedWxQuery'],
 'world-r2/IslandHomeInteraction.ts':['safe'],
 'region/JourneyTransport.ts':['transportQaEnabled','qaTransportEnabled'],/* QA entry / boot query gates only */
 'ui/DevPreviewMark.ts':['devPreviewBuild'],/* constructor default, once *//* pointer down/up only */
 'region/CloudTrace.ts':['*'],/* cached on host.__QF_CLOUD_TRACE_Q */
 'world-r2/QaSkip.ts':['*'],'world-r2/PreTransitionKeys.ts':['*'],'world-r2/PreTransitionRun.ts':['*'],/* QA key / boot paths, never per frame (static check 1 enforces) */
 'WorldIntegrationBoot.ts':['*'],'world-r2/WorldNativeComposition.ts':['*'],/* frozen: boot-time qaQuery only; per-frame bodies checked by 1 */
};
function strip(s){return s.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/(^|[^:'"])\/\/[^\n]*/g,(m,a)=>a+' '.repeat(m.length-a.length)).replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g,m=>m.replace(/[^\n]/g,' '));}
/** Named function / method bodies: [{name,start,end,body}]. */
function bodies(src){const s=strip(src),out=[];const re=/(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:^|[\s;{}])(?:(?:private|public|protected|static|async|override)\s+)*([A-Za-z_$][\w$]*)\s*\([^()]*(?:\([^()]*\)[^()]*)*\)\s*(?::\s*[^{;=]+)?\{|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>\s*\{)/gm;let m;
 while((m=re.exec(s))){const name=m[1]||m[2]||m[3];if(['if','for','while','switch','catch','function','return'].includes(name))continue;let i=s.indexOf('{',m.index+m[0].length-1);if(m[1]){i=s.indexOf('{',s.indexOf(')',m.index));}
  let d=0,j=i;for(;j<s.length;j++){if(s[j]==='{')d++;else if(s[j]==='}'){d--;if(!d)break;}}out.push({name,start:i,end:j,body:s.slice(i,j+1)});}
 return out;}
function enclosing(bs,pos){let best=null;for(const b of bs)if(b.start<=pos&&pos<=b.end&&(!best||b.start>best.start))best=b;return best;}
function scanFile(rel,src){const v=[];const s=strip(src),bs=bodies(src);const byName=new Map();for(const b of bs)if(!byName.has(b.name))byName.set(b.name,b);
 // 1. per-frame bodies + same-file transitive callees
 const seen=new Set(),queue=bs.filter(b=>FRAME.test(b.name)).map(b=>[b,b.name]);
 while(queue.length){const [b,trail]=queue.shift();const k=b.name+'@'+b.start;if(seen.has(k))continue;seen.add(k);
  const m=SYNC.exec(b.body);if(m&&!(ALLOW[rel]||[]).includes(b.name))v.push(rel+': per-frame '+trail+' → '+m[1]);
  for(const c of b.body.matchAll(/(?:\bthis\.|(?<![.\w$]))([A-Za-z_$][\w$]*)\s*\(/g)){const t=byName.get(c[1]);if(t&&t!==b)queue.push([t,trail+'→'+t.name]);}}
 // 2. every sync call sits in an allowlisted reader
 const g=new RegExp(SYNC.source,'g');let m;while((m=g.exec(s))){if(/^(qaQuery|qaSkipAllowed)$/.test(m[1])&&/import\s*\{[^}]*$/.test(s.slice(Math.max(0,m.index-200),m.index)))continue;
  const e=enclosing(bs,m.index),allow=ALLOW[rel]||[];if(allow.includes('*'))continue;if(!e||!allow.includes(e.name))v.push(rel+': '+m[1]+' in '+(e?e.name:'<top>')+' (not an allowlisted cached reader)');}
 return v;}
function walk(d,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p,o);else if(/\.ts$/.test(f.name)&&!/\.d\.ts$/.test(f.name))o.push(p);}return o;}
const files=walk(S);let viol=[];for(const p of files)viol.push(...scanFile(path.relative(S,p).split(path.sep).join('/'),fs.readFileSync(p,'utf8')));
assert.deepEqual(viol,[],'sync host calls on per-frame / uncached paths:\n'+viol.join('\n'));
// pinned: the CDP culprit path now reads the cache
const cam=fs.readFileSync(path.join(S,'region/CamTraceLog.ts'),'utf8');
assert.match(cam,/const sa=probeSafeArea\(\);/);assert.match(cam,/view\.on\('canvas-resize'/);
assert.doesNotMatch(strip(cam).replace(/function probeSafeArea[\s\S]*?return probeSa;\}/,''),/getSafeAreaRect/,'getSafeAreaRect outside the cached reader');
// 3. runtime: counting host
function host(){const n={win:0,sys:0,cap:0,acct:0,launch:0,enter:0},cbs=[];return {n,cbs,wx:{getWindowInfo:()=>(n.win++,{windowWidth:390,windowHeight:844,safeArea:{left:0,right:390,top:47,bottom:810}}),getSystemInfoSync:()=>(n.sys++,{}),getMenuButtonBoundingClientRect:()=>(n.cap++,{left:300,right:380,top:50,bottom:82,width:80,height:32}),onWindowResize:f=>cbs.push(f),
 getAccountInfoSync:()=>(n.acct++,{miniProgram:{envVersion:'develop'}}),getLaunchOptionsSync:()=>(n.launch++,{query:{camTrace:'1'}}),getEnterOptionsSync:()=>(n.enter++,{query:{}})}};}
function runtime(boardSrc){
 const h=host();const box=vm.createContext({});box.globalThis=box;box.wx=h.wx;
 const BL=loadIn('ui/BoardLayout.ts',box,undefined,boardSrc);
 const FT=loadIn('world-r2/FlowTestLayout.ts',box,s=>s.includes('BoardLayout')?BL:{});
 try{const a=BL.boardSafeInsets(390,844);for(let i=0;i<300;i++){assert.deepEqual(BL.boardSafeInsets(390,844),a);FT.readFlowTestHost();}
  assert.equal(h.n.win,1,'getWindowInfo hit '+h.n.win+'× for 600 per-frame reads');assert.equal(h.n.cap,1,'capsule hit '+h.n.cap+'×');
  assert.ok(h.cbs.length>=1,'subscribed to wx.onWindowResize');h.cbs.forEach(f=>f());BL.boardSafeInsets(390,844);FT.readFlowTestHost();assert.equal(h.n.win,2,'re-read once after resize');
  BL.boardSafeInsets(844,390);assert.equal(h.n.win,3,'frame-size change re-reads');}
 finally{}
 return h;}
runtime();
const Q=L.load('region/DebugQuery.ts',s=>s.includes('QaSkip')?L.load('world-r2/QaSkip.ts'):{});
{const h=host();const g={wx:h.wx};for(let i=0;i<300;i++)assert.ok(Q.debugSearch(g).includes('camTrace=1'));
 assert.ok(h.n.acct<=2&&h.n.launch<=1&&h.n.enter<=1,'debugSearch host hits '+JSON.stringify(h.n));}
// ── negative self-tests ──
let caught=0;const expectCatch=(name,fn)=>{let ok=false;try{fn();}catch{ok=true;}assert.ok(ok,'self-test did not catch: '+name);caught++;};
expectCatch('update() calls wx.getSystemInfoSync',()=>assert.deepEqual(scanFile('x/A.ts',"export class A{ update(dt:number){const w=(globalThis as any).wx;const i=w.getSystemInfoSync();} }"),[]));
expectCatch('lateUpdate → helper → getSafeAreaRect',()=>assert.deepEqual(scanFile('x/B.ts',"function sa(){return (sys as any).getSafeAreaRect();}\nexport class B{ lateUpdate(){ sa(); } }"),[]));
expectCatch('camLogFrame → getWindowInfo',()=>assert.deepEqual(scanFile('x/C.ts',"export function camLogFrame(c:any){const i=wx.getWindowInfo();}"),[]));
expectCatch('the original CamTraceLog probe (uncached getSafeAreaRect)',()=>assert.deepEqual(scanFile('region/CamTraceLog.ts',cam.replace('const sa=probeSafeArea();',"let sa:any=null;try{sa=(sys as any).getSafeAreaRect?.();}catch{}")),[]));
expectCatch('non-allowlisted file reading host info',()=>assert.deepEqual(scanFile('ui/Other.ts',"export function f(){return wx.getMenuButtonBoundingClientRect();}"),[]));
const board=fs.readFileSync(path.join(S,'ui/BoardLayout.ts'),'utf8');
expectCatch('BoardLayout cache removed',()=>runtime(board.replace('if (hostCache) { if (key) hostCache.key = key; return hostCache; }','')));
expectCatch('no resize subscription',()=>runtime(board.replace('wx.onWindowResize?.(invalidateHostInfo);','')));
// clean control must pass through the same scanner
assert.deepEqual(scanFile('x/D.ts',"export class D{ update(){ const s=cachedHostInfo('a'); } }"),[]);
console.log('PASS host-sync-per-frame files='+files.length+' self-tests='+caught);
