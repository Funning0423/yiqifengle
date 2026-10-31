'use strict';
// coast-dispose-region-change gate (GGbot, Grok Bot 2026-10-30): after a successful kit-on arrival, a region change disposes the coast
// scene handle exactly once (idempotent), every loader-instantiated node is destroyed and the layout + 4 glbs are decRef'd once; the
// watcher stops. Runs the APPLIED tree CoastArrivalLens.ts (hook 03 committed in f3e041ec; must be present). Negative self-test: the same
// file with the 03 block stripped (and byte-equal to the pre-03 lens of 6d477c44 when git has it) must FAIL the same verdict. Kit off: the hook lives in the region_coast
// bundle only (diff touches no main-package file) and WNC:156 loads nothing with the kit off (coast-arrival-single-writer).
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets'),REL='creator-build-project/assets/bundles/region_coast/scripts/CoastArrivalLens.ts';
const PRE='6d477c44'; // parent of f3e041ec (03 applied)
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}return c;};
const HOOK='03 dispose on region change';
function lensSource(withHook){const tree=fs.readFileSync(path.join(ROOT,REL),'utf8');if(!ok(tree.includes(HOOK),'hook 03 applied in the tree lens'))process.exit(1);if(withHook)return tree;
 const lines=tree.split('\n'),i=lines.findIndex(l=>l.includes(HOOK));ok(lines.filter(l=>l.includes(HOOK)).length===1,'exactly one 03 block');const neg=lines.slice(0,i).concat(lines.slice(i+5)).join('\n');
 ok(!neg.includes('reg()!==r0')&&!neg.includes('watch'),'stripped copy has no watcher');
 try{const pre=cp.execFileSync('git',['show',PRE+':'+REL],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']});ok(pre===neg,'tree lens == '+PRE+' lens + exactly the 03 block');}catch{console.log('info '+PRE+' not reachable; pre-03 equality skipped');}return neg;}
function loadLens(src,sceneStub){const mods={};const load=(abs,code)=>{if(mods[abs])return mods[abs].exports;const m={exports:{}};mods[abs]=m;const dir=path.dirname(abs);
  new Function('module','exports','require',tr(code??fs.readFileSync(abs+'.ts','utf8')))(m,m.exports,r=>r==='cc'?{}:r.endsWith('/CoastSceneLoader')?sceneStub:r.startsWith('.')?load(path.resolve(dir,r)):require(r));return m.exports;};
 return load(path.join(ROOT,REL.replace(/\.ts$/,'')),src);}
async function scenario(src){delete globalThis.__qfCoast;
 const nodes=[],assets=Array.from({length:5},(_,i)=>({name:i?'glb'+i:'layout',refs:1,decRef(){this.refs--;}}));let disposeCalls=0;
 const stub={coastIslandMaterial:()=>null,coastBundleNode:()=>null,loadCoastScene:async()=>{for(let i=0;i<12;i++)nodes.push({destroyed:false});
  return {root:{},placed:12,reusePlaced:0,errors:[],dispose(){disposeCalls++;if(disposeCalls>1)return;for(const n of nodes)n.destroyed=true;for(const a of assets)a.decRef();}};}};
 const L=loadLens(src,stub);let region='coast';const sched=new Map();
 const world={node:{isValid:true},worldCamera:{node:{setWorldPosition(){},setWorldRotation(){}},fov:45},commands:()=>({snapshot:()=>({journey:{region}})}),
  schedule(fn,iv){sched.set(fn,iv);},unschedule(fn){sched.delete(fn);},scheduleOnce(fn){fn(1/30);},coastArrivalAdapter:{node:null,perform:async()=>{}}};
 const ce=console.error,cw=console.warn;console.error=()=>{};console.warn=()=>{};
 const r=await L.runCoastArrival(world,{cancelled:()=>false,resolveReuse:()=>null,resolveMaterial:()=>null,viewport:()=>({width:390,height:844}),nextFrame:async()=>1/30});
 console.error=ce;console.warn=cw;
 const tick=()=>{for(const fn of [...sched.keys()])fn();};tick();const beforeChange=disposeCalls;region='meadow';tick();tick();const atChange=disposeCalls,nodesGoneAtChange=nodes.length>0&&nodes.every(n=>n.destroyed),releasedAtChange=assets.every(a=>a.refs===0);
 const h=r.scene;try{h?.dispose?.();h?.dispose?.();}catch{}
 return {ok:r.ok,beforeChange,atChange,afterChange:disposeCalls,nodesGone:nodesGoneAtChange,released:releasedAtChange,watchers:sched.size,current:globalThis.__qfCoast?.current??null};}
const verdict=x=>x.ok&&x.beforeChange===0&&x.atChange===1&&x.afterChange===1&&x.nodesGone&&x.released&&x.watchers===0&&x.current===null;
(async()=>{
 const withHook=await scenario(lensSource(true));
 ok(withHook.ok,'arrival ran');ok(withHook.beforeChange===0,'not disposed while the region is unchanged');
 ok(withHook.atChange===1&&withHook.afterChange===1,'region change -> dispose exactly once, 2 more dispose() calls are no-ops: '+withHook.atChange+'/'+withHook.afterChange);
 ok(withHook.nodesGone,'all loader nodes destroyed');ok(withHook.released,'layout + 4 glbs decRef once');ok(withHook.watchers===0,'watcher stopped');ok(withHook.current===null,'__qfCoast.current cleared');
 console.log('ok   hook 03: '+JSON.stringify(withHook));
 {const base=lensSource(false);const neg=await scenario(base.split('\n').join('\n'));
  // negative: without hook 03 nothing disposes on the region change (only the explicit dispose() calls at the end would) -> verdict must fail
  ok(!verdict(neg),'selftest: lens without hook 03 must fail the verdict '+JSON.stringify(neg));
  console.log('ok   negative: lens without hook 03 -> no dispose on region change -> verdict FAILS as required');}
 if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-dispose-region-change');
})().catch(e=>{console.log('FAIL '+(e&&e.stack||e));process.exit(1);});
