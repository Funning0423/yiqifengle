'use strict';
// r2 (B360 481c599c: camTrace wanted, zero [QF_GPU] / [QF_SYNC] lines, run reported PASS). The harness copies the game's
// globalThis.__qfCamStart into result.json; a run that wants the probe (launchQuery camTrace=1 or requireProbe) without enabled
// camTrace + installed GPU probe ends NOPROBE = INCOMPLETE (ok=false). Negative: the same harness with the r2 block removed
// (= 481c599c behaviour) reports ok=true for that run.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function run(src,script,camStart){const files=new Map(),U='wxfile://usr';const R=U+'/qf-autoplay/out/result.json';
  const later=(f,o)=>setTimeout(f,o||0);
  const fsm={readFileSync:p=>{if(files.has(p))return files.get(p);throw Error('ENOENT '+p);},mkdirSync(){},rmdirSync(){},
    appendFile:o=>later(()=>{files.set(o.filePath,(files.get(o.filePath)||'')+o.data);o.success&&o.success();}),
    writeFile:o=>later(()=>{files.set(o.filePath,o.data);o.success&&o.success();},2),
    rename:o=>later(()=>{files.set(o.newPath,files.get(o.oldPath));files.delete(o.oldPath);o.success&&o.success();},2),
    readFile:o=>later(()=>files.has(o.filePath)?o.success({data:files.get(o.filePath)}):o.fail({errMsg:'nofile'})),
    copyFile:o=>later(()=>o.success&&o.success(),1),unlink:o=>later(()=>o.success&&o.success())};
  fsm.appendFileSync=fsm.writeFileSync=()=>{throw Error('sync write');};
  const wx={env:{USER_DATA_PATH:U},getFileSystemManager:()=>fsm,getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:3}),onMemoryWarning(){},onHide(){}};
  for(const k of ['TouchStart','TouchMove','TouchEnd','TouchCancel']){wx['on'+k]=()=>{};wx['off'+k]=()=>{};}
  files.set('qf-autoplay/script.json',JSON.stringify(script));
  const g={wx,console:{log(){},info(){},warn(){},error(){}},setTimeout,setInterval,clearInterval,clearTimeout,Promise,Date,JSON,Math,Number,String,Array,Object,Error,isFinite,canvas:{width:1170,height:2532,toTempFilePath(){}}};
  g.GameGlobal=g;g.globalThis=g;if(camStart)g.__qfCamStart=camStart;vm.createContext(g);vm.runInContext(src,g);g.__worldIntegration={snapshot:()=>({state:'island'})};
  return {files,R,g};}
const wait=ms=>new Promise(s=>setTimeout(s,ms));
async function done(r){for(let i=0;i<400;i++){await wait(25);const t=r.files.get(r.R);if(t&&JSON.parse(t).exit==='done')return JSON.parse(t);}throw Error('no done result');}
(async()=>{
  const src=fs.readFileSync(path.join(__dirname,'qf-autoplay.js'),'utf8');
  const want={steps:[{op:'wait',ms:20}],launchQuery:'?camTrace=1',allowConsoleErrors:true};
  let d=await done(run(src,want,null));assert.equal(d.ok,false);assert.equal(d.probeVerdict,'NOPROBE');assert.equal(d.incomplete,true);assert.match(d.failReason,/NOPROBE = INCOMPLETE .*no \[QF_CAM\] startup line/);
  d=await done(run(src,{steps:want.steps,requireProbe:true,allowConsoleErrors:true},{line:'x',enabled:true,src:'global',gpu:'not-installed:no-device'}));assert.equal(d.probeVerdict,'NOPROBE');assert.equal(d.ok,false);
  d=await done(run(src,want,{line:'x',enabled:false,src:'none',gpu:'off'}));assert.equal(d.probeVerdict,'NOPROBE');
  for(const gpu of ['module','deferred']){d=await done(run(src,want,{line:'[QF_CAM] enabled=1',enabled:true,src:'query',gpu}));assert.equal(d.probeVerdict,'OK');assert.equal(d.camStart.gpu,gpu);assert.ok(!/NOPROBE/.test(d.failReason||''),d.failReason);}
  d=await done(run(src,{steps:[{op:'wait',ms:20}],allowConsoleErrors:true},null));assert.equal(d.probeVerdict,undefined);assert.ok(!/NOPROBE/.test(d.failReason||''));
  const old=src.replace(/\n  \/\* r2 \(B360[\s\S]*?\}catch\(e\)\{\}/,'');assert.notEqual(old,src,'r2 block found');
  d=await done(run(old,want,null));assert.equal(d.ok,true,'self-test: old harness passes a probe-less camTrace run');assert.equal(d.probeVerdict,undefined);
  console.log('PASS harness NOPROBE = INCOMPLETE (no status / not installed / off), OK module+deferred, unwanted untouched; old harness caught (ok=true)');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
