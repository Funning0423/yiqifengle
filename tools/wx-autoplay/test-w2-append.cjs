'use strict';
// r3 (chainL): w2() must be append-only. Under appendFile failures no console.log / state.jsonl line may be lost or reordered, and
// result.json must be written (done and abandon). Negative self-test: the b9fe8f39 harness (append fail -> writeFile overwrite)
// loses lines under the same failure pattern.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const H=path.join(__dirname,'qf-autoplay.js');
function run(src,failPct,opt={}){
  const files=new Map(),U='wxfile://usr';let seed=11;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed%100;};let appendFails=0;
  const fsm={readFileSync:p=>{if(files.has(p))return files.get(p);throw Error('ENOENT '+p);},mkdirSync(){},rmdirSync:p=>{for(const k of [...files.keys()])if(k.startsWith(p))files.delete(k);},
    appendFile:o=>setTimeout(()=>{if(!files.has(o.filePath)||rnd()<failPct){appendFails++;return o.fail&&o.fail({errMsg:'appendFile:fail injected'});}files.set(o.filePath,files.get(o.filePath)+o.data);o.success&&o.success();},0),
    writeFile:o=>setTimeout(()=>{files.set(o.filePath,o.data);o.success&&o.success();},0),
    readFile:o=>setTimeout(()=>files.has(o.filePath)?o.success({data:files.get(o.filePath)}):o.fail({errMsg:'nofile'}),0),
    copyFile:o=>setTimeout(()=>o.success&&o.success(),1),unlink:o=>setTimeout(()=>o.success&&o.success(),0)};
  fsm.appendFileSync=fsm.writeFileSync=()=>{throw Error('sync write');};
  const wx={env:{USER_DATA_PATH:U},getFileSystemManager:()=>fsm,getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:3}),onMemoryWarning(){},onHide(f){wx._hide=f;}};
  for(const k of ['TouchStart','TouchMove','TouchEnd','TouchCancel']){wx['on'+k]=()=>{};wx['off'+k]=()=>{};}
  const steps=Array.from({length:30},(_,i)=>({op:'wait',ms:20+i%3}));files.set('qf-autoplay/script.json',JSON.stringify({steps}));
  const g={wx,console:{log(){},info(){},warn(){},error(){}},setTimeout,setInterval,clearInterval,clearTimeout,Promise,Date,JSON,Math,Number,String,Array,Object,Error,isFinite,canvas:{width:1170,height:2532,toTempFilePath(){}}};
  g.GameGlobal=g;g.globalThis=g;vm.createContext(g);vm.runInContext(src,g);g.__worldIntegration={snapshot:()=>({state:'home'})};
  return {g,files,U,wx,get appendFails(){return appendFails;}};}
const wait=ms=>new Promise(s=>setTimeout(s,ms));
/* r4: result.json now exists from the start as a running snapshot; settle on the final document (exit done/error) */
const fin=r=>{try{const t=r.files.get(r.U+'/qf-autoplay/out/result.json');return t&&!/"exit": "running"/.test(t);}catch{return false;}};
async function settle(r){for(let i=0;i<400&&!fin(r);i++)await wait(50);await wait(3000);}
function check(r){const log=r.files.get(r.U+'/qf-autoplay/out/console.log')||'';const steps=[...log.matchAll(/\[QF_AUTOPLAY\] step (\{.*\})/g)].map(m=>JSON.parse(m[1]).i);
  assert.deepEqual(steps,Array.from({length:30},(_,i)=>i),'every step line present once, in order (got '+steps.length+')');
  const st=(r.files.get(r.U+'/qf-autoplay/out/state.jsonl')||'').trim().split('\n').filter(Boolean);assert.ok(st.length>=30,'state.jsonl lines '+st.length);
  const res=JSON.parse(r.files.get(r.U+'/qf-autoplay/out/result.json'));return res;}
(async()=>{
  const src=fs.readFileSync(H,'utf8');
  const r=run(src,35);await settle(r);const res=check(r);
  assert.ok(r.appendFails>5,'failures injected: '+r.appendFails);assert.ok(res.writeStats.appendFail>0&&res.writeStats.retries>0,'counted: '+JSON.stringify(res.writeStats));
  assert.equal(res.writeStats.lostBytes,0);assert.equal(res.exit,'done');
  // abandon: hide mid-run writes a partial result.json
  {const a=run(src,0);for(let i=0;i<40&&!a.wx._hide;i++)await wait(100);a.wx._hide();await wait(300);const pr=JSON.parse(a.files.get(a.U+'/qf-autoplay/out/result.json'));assert.equal(pr.partial,'hide');assert.equal(pr.ok,false);assert.equal(pr.exit,'abandon');await settle(a);}
  // steady-frame sync stats fail the run
  {const s2=run(src,0);s2.g.__qfSyncStats=()=>({steadyCalls:3,steadySamples:[{api:'getItem',key:'k'}]});await settle(s2);const r2=check(s2);assert.equal(r2.ok,false);assert.match(r2.failReason,/\[QF_SYNC\] 3 sync/);}
  // negative self-test: the old harness loses lines under the same failure pattern
  const old=cp.execFileSync('git',['show','b9fe8f39:tools/wx-autoplay/qf-autoplay.js'],{cwd:path.join(__dirname,'../..'),encoding:'utf8'});
  const o=run(old,35);await settle(o);let caught=false;try{check(o);}catch{caught=true;}assert.ok(caught,'self-test: old w2 (writeFile fallback) must lose lines');
  console.log('PASS w2-append-only appendFails='+r.appendFails+' retries='+res.writeStats.retries+' concat='+res.writeStats.concatFallback+' (old harness lost lines: caught)');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
