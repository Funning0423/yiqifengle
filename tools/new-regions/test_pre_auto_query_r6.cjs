'use strict';
// journal-r6 J6 (6c28894f chainJ6 J390A): harness launchQuery '?qfHooks=1&camTrace=1&qfPre=journal-sky-gated' never auto-ran.
// Root cause: qf-autoplay.js only patched location when location.search was empty (never in the DevTools worker, which has
// '?contextName=game&id=2'), and qfPre (PreTransitionKeys.preSearch) never read globalThis.__qfQuery (camTrace did, via DebugQuery).
// Gate: harness always sets __qfQuery; qfPre reads it (src=global); the boot prints '[QF_PRE] auto key=<k|none> src=<query|global|none>';
// the harness marks the run INCOMPLETE when launchQuery has qfPre=X and no 'auto key=X' line appears. Negatives on 6c28894f code.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),{createHarness}=require('../board-ui/harness.cjs');
const ROOT=path.resolve(__dirname,'../..'),HP=path.join(ROOT,'tools/wx-autoplay/qf-autoplay.js'),OLD='6c28894f';
const oldSrc=f=>cp.execFileSync('git',['show',OLD+':'+f],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
const LQ='?qfHooks=1&camTrace=1&qfPre=journal-sky-gated',DT='?contextName=game&id=2';
function runHarness(src,{launchQuery=LQ,gameLine=null}={}){
 const files=new Map(),U='wxfile://usr',infos=[];
 const fsm={readFileSync:p=>{if(files.has(p))return files.get(p);throw Error('ENOENT '+p);},writeFileSync:(p,s)=>files.set(p,s),appendFileSync:(p,s)=>files.set(p,(files.get(p)||'')+s),mkdirSync(){},rmdirSync(){},copyFileSync(){},unlinkSync(){}};
 const wx={env:{USER_DATA_PATH:U},getFileSystemManager:()=>fsm,getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:3}),onMemoryWarning(){},
  getLaunchOptionsSync:()=>({query:{}}),getEnterOptionsSync:()=>({query:{}})};
 for(const k of ['TouchStart','TouchMove','TouchEnd','TouchCancel']){wx['on'+k]=()=>{};wx['off'+k]=()=>{};}
 files.set('qf-autoplay/script.json',JSON.stringify({launchQuery,steps:[{op:'wait',ms:20}]}));
 const g={wx,location:{search:DT},console:{log(){},info:(...a)=>infos.push(a.join(' ')),warn(){},error(){}},setTimeout,setInterval,clearInterval,Promise,Date,JSON,Math,Number,String,Array,Object,Error,isFinite,RegExp};
 g.GameGlobal=g;g.globalThis=g;vm.createContext(g);vm.runInContext(src,g);g.__worldIntegration={snapshot:()=>({state:'home'})};
 if(gameLine)g.console.info(gameLine);
 return {g,files,U};
}
const result=async r=>{for(let i=0;i<200;i++){const s=r.files.get(r.U+'/qf-autoplay/out/result.json');if(s)return JSON.parse(s);await new Promise(f=>setTimeout(f,20));}throw Error('no result.json');};
(async()=>{
 const H=createHarness({debug:false}),K=H.load('world-r2/PreTransitionKeys'),curH=fs.readFileSync(HP,'utf8'),oldH=oldSrc('tools/wx-autoplay/qf-autoplay.js');
 // 1. harness → global: current sets __qfQuery even with DevTools' non-empty location.search; 6c28894f harness did not (negative)
 const cur=runHarness(curH,{gameLine:'[QF_PRE] auto key=journal-sky-gated src=global'}),old=runHarness(oldH);
 assert.equal(cur.g.__qfQuery,LQ,'harness sets __qfQuery');assert.equal(old.g.__qfQuery,undefined,'negative: 6c28894f harness never set __qfQuery');
 assert.equal(old.g.location.search,DT,'negative: 6c28894f harness left DevTools location untouched (launchQuery lost)');
 // 2. reader: current qfPre reads __qfQuery (src=global); 6c28894f reader (qaQuery only) → null on the same host (negative)
 assert.equal(K.preTransitionKey(null,cur.g),'journal-sky-gated','qfPre from harness __qfQuery');assert.equal(K.preKeySource(cur.g),'global');assert.equal(K.preTransitionEnabled(null,cur.g),true);
 const Q=H.load('world-r2/QaSkip');assert.equal(K.preTransitionKey(Q.qaQuery(cur.g),cur.g),null,'negative: 6c28894f reader (location+launch only) misses it');
 assert.equal(K.preTransitionKey(null,old.g),null,'negative: old harness + any reader → no key');assert.equal(K.preKeySource(old.g),'none');
 const ok=/qaQuery\(host\);/.test(oldSrc('creator-build-project/assets/scripts/world-r2/PreTransitionKeys.ts'))&&!/__qfQuery/.test(oldSrc('creator-build-project/assets/scripts/world-r2/PreTransitionKeys.ts'));assert(ok,'6c28894f preSearch = qaQuery only');
 // launch-query source still works (DevTools 编译模式) and reports src=query; nothing → none; release never
 const lh={location:{search:DT},wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getLaunchOptionsSync:()=>({query:{qfHooks:'1',qfPre:'journal-sky-gated'}})}};
 assert.equal(K.preTransitionKey(null,lh),'journal-sky-gated');assert.equal(K.preKeySource(lh),'query');
 assert.equal(K.preKeySource({location:{search:DT}}),'none');
 const rel={__qfQuery:LQ,wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}})}};assert.equal(K.preTransitionKey(null,rel),null,'release: __qfQuery inert');assert.equal(K.preTransitionEnabled(null,rel),false);
 // 3. startup line in probe code, after the release gate, before registration
 const run=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/world-r2/PreTransitionRun.ts'),'utf8');
 const i=run.indexOf("console.info('[QF_PRE] auto key='"),g0=run.indexOf('if(!qaSkipAllowed())return false;'),pb=run.lastIndexOf('/*QF_PROBE_BEGIN*/',i),pe=run.indexOf('/*QF_PROBE_END*/',i);
 assert(i>g0&&g0>0&&pb>g0&&pe>i,'auto line inside a probe region right after the release gate');assert(/src='\+preKeySource\(\)/.test(run.slice(i,pe)));
 // 4. harness INCOMPLETE: qfPre=X without 'auto key=X' → INCOMPLETE; with it → ok; wrong key → INCOMPLETE; no qfPre → no check
 const rOk=await result(cur);assert.equal(rOk.ok,true,JSON.stringify(rOk.failReason));assert.deepEqual(rOk.preAuto,{want:'journal-sky-gated',seen:['journal-sky-gated@global']});
 const rMiss=await result(runHarness(curH));assert.equal(rMiss.status,'INCOMPLETE');assert.equal(rMiss.ok,false);assert.match(rMiss.failReason,/no \[QF_PRE\] auto key=journal-sky-gated line \(seen: none\)/);
 const rNone=await result(runHarness(curH,{gameLine:'[QF_PRE] auto key=none src=none'}));assert.equal(rNone.status,'INCOMPLETE');assert.match(rNone.failReason,/seen: none@none/);
 const rNo=await result(runHarness(curH,{launchQuery:'?qfHooks=1'}));assert.equal(rNo.ok,true);assert.equal(rNo.status,undefined);
 const rOld=await result(runHarness(oldH));assert.equal(rOld.ok,true,'negative: 6c28894f harness reported ok with no auto line (the J390A blind spot)');assert.equal(rOld.status,undefined);
 process.exitCode=0;console.log(`PASS pre-auto-query-r6: harness __qfQuery=${cur.g.__qfQuery} → qfPre key journal-sky-gated src=global; launch src=query; release inert; INCOMPLETE on missing/none line; negatives on ${OLD}: harness left DevTools location '${DT}' and set no __qfQuery, reader (qaQuery only) → null, harness ok=true with no auto line`);
})().then(()=>process.exit(0),e=>{console.error('FAIL',e);process.exit(1);});/* harness intervals would keep the loop alive */
