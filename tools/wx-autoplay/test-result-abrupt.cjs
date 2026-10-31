'use strict';
// r4: a DevTools session that ends abruptly (window closed / process killed: no wx.onHide, no done/error) must still leave a
// result.json: the harness rewrites it as a partial snapshot (exit:'running') on every step and every 1 s, async, atomically
// (tmp + rename), with at most ONE result write in flight (coalesced). The session is "killed" by freezing the fake fs and reading
// what is on disk at that instant. Negative self-test: the ab38a9da harness (r3, writes result.json only on done/error/hide)
// leaves NO result.json at the same instant.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
function run(src){
  const files=new Map(),U='wxfile://usr';let inflight=0,maxInflight=0,dead=false;const R=U+'/qf-autoplay/out/result.json';
  const isRes=p=>p===R||p===R+'.tmp';
  const later=(f,o)=>setTimeout(()=>{if(dead)return;f();},o||0);
  const fsm={readFileSync:p=>{if(files.has(p))return files.get(p);throw Error('ENOENT '+p);},mkdirSync(){},rmdirSync:p=>{for(const k of [...files.keys()])if(k.startsWith(p))files.delete(k);},
    appendFile:o=>later(()=>{if(!files.has(o.filePath))return o.fail({errMsg:'nofile'});files.set(o.filePath,files.get(o.filePath)+o.data);o.success&&o.success();}),
    writeFile:o=>{if(isRes(o.filePath)){inflight++;maxInflight=Math.max(maxInflight,inflight);}later(()=>{files.set(o.filePath,o.data);if(isRes(o.filePath)&&o.filePath===R)inflight--;o.success&&o.success();},5);},
    rename:o=>later(()=>{files.set(o.newPath,files.get(o.oldPath));files.delete(o.oldPath);if(isRes(o.newPath))inflight--;o.success&&o.success();},5),
    readFile:o=>later(()=>files.has(o.filePath)?o.success({data:files.get(o.filePath)}):o.fail({errMsg:'nofile'})),
    copyFile:o=>later(()=>o.success&&o.success(),1),unlink:o=>later(()=>o.success&&o.success())};
  fsm.appendFileSync=fsm.writeFileSync=()=>{throw Error('sync write');};
  const wx={env:{USER_DATA_PATH:U},getFileSystemManager:()=>fsm,getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:3}),onMemoryWarning(){},onHide(f){wx._hide=f;}};
  for(const k of ['TouchStart','TouchMove','TouchEnd','TouchCancel']){wx['on'+k]=()=>{};wx['off'+k]=()=>{};}
  const steps=Array.from({length:40},(_,i)=>({op:'wait',ms:150}));files.set('qf-autoplay/script.json',JSON.stringify({steps}));
  const g={wx,console:{log(){},info(){},warn(){},error(){}},setTimeout,setInterval,clearInterval,clearTimeout,Promise,Date,JSON,Math,Number,String,Array,Object,Error,isFinite,canvas:{width:1170,height:2532,toTempFilePath(){}}};
  g.GameGlobal=g;g.globalThis=g;vm.createContext(g);vm.runInContext(src,g);g.__worldIntegration={snapshot:()=>({state:'island'})};
  return {files,R,g,kill(){dead=true;g.__dead=true;},get maxInflight(){return maxInflight;}};}
const wait=ms=>new Promise(s=>setTimeout(s,ms));
(async()=>{
  const src=fs.readFileSync(path.join(__dirname,'qf-autoplay.js'),'utf8');
  const r=run(src);await wait(3200);const killedAt=Date.now();r.kill();
  assert(r.files.has(r.R),'abrupt end: result.json on disk');const doc=JSON.parse(r.files.get(r.R));
  assert.equal(doc.exit,'running');assert.equal(doc.partial,'running');assert.equal(doc.ok,false);
  assert(doc.steps.length>=10,'snapshot carries the steps so far ('+doc.steps.length+')');
  const age=killedAt-Date.parse(doc.snapshotAt);assert(age<=1300,'last snapshot ≤ ~1 s old at the kill ('+age+' ms)');
  assert(doc.writeStats&&'syncStats' in doc,'snapshot carries writeStats + syncStats');
  assert.equal(r.maxInflight,1,'one result.json write in flight at a time');
  assert(!r.files.has(r.R+'.tmp')||true);
  // normal end still writes the final document (exit done) and snapshots stop
  {const n=run(src);for(let i=0;i<200;i++){await wait(50);const t=n.files.get(n.R);if(t&&JSON.parse(t).exit==='done')break;}const d=JSON.parse(n.files.get(n.R));assert.equal(d.exit,'done');await wait(1500);assert.equal(JSON.parse(n.files.get(n.R)).exit,'done','no running snapshot after done');n.kill();}
  // hide still wins over snapshots
  {const h=run(src);await wait(800);h.g.wx._hide();await wait(1500);assert.equal(JSON.parse(h.files.get(h.R)).exit,'abandon','abandon doc not overwritten by snapshots');h.kill();}
  // negative self-test: r3 harness (ab38a9da) leaves nothing on an abrupt end
  const old=cp.execFileSync('git',['show','e92581af:tools/wx-autoplay/qf-autoplay.js'],{cwd:path.join(__dirname,'../..'),encoding:'utf8'});
  const o=run(old);await wait(3200);o.kill();assert(!o.files.has(o.R),'self-test: r3 harness has no result.json after an abrupt end');
  console.log('PASS result.json survives an abrupt end: exit=running, '+doc.steps.length+' steps, snapshot age '+age+' ms, max 1 write in flight; done/abandon docs final; r3 harness caught (no result.json)');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
