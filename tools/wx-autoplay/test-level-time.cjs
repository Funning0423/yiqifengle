'use strict';
// fg-leveltime: per-level wall time in the wx-autoplay harness. Pure tracker + harness run in a fake mini-game.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const H=path.join(__dirname,'qf-autoplay.js'),api=require(H);
assert.equal(typeof api.levelTimer,'function','harness exports levelTimer (fails on old harness)');
const A=(stageId,attemptId,status,moves)=>({active:{stageId,attemptId,status,moves,region:'meadow'}});
{const out=[];const L=api.levelTimer(r=>out.push(r));
 L.observe(null,0,0);L.observe(A('mainline-05','a1','playing',20),1000,60);L.observe(A('mainline-05','a1','playing',12),5000,300);
 L.observe(A('mainline-05','a1','won',9),9250,555);L.observe(A('mainline-05','a1','won',9),9500,570);// result screen: no second record
 L.observe(null,10000,600);L.observe(A('r04-lake-01','b1','playing',14),12000,700);L.observe(A('r04-lake-01','b1','lost',0),20000,1180);
 L.observe(A('r04-lake-01','b2','playing',14),21000,1240);L.observe(null,22000,1300);// left mid-level
 L.observe(A('mainline-06','c1','playing',18),23000,1360);const all=L.finish(24000,1420);
 assert.equal(out.length,4);assert.equal(all.length,4);
 assert.deepEqual(all.map(r=>[r.stageId,r.result,r.wallMs]),[['mainline-05','won',8250],['r04-lake-01','lost',8000],['r04-lake-01','abandoned',1000],['mainline-06','unfinished',1000]]);
 assert.equal(all[0].frames,495);assert.equal(all[0].moves,9);assert.equal(all[0].region,'meadow');}
assert.equal(api.parseScript({steps:[]}).levelTimeEveryMs,250);assert.equal(api.parseScript({levelTimeEveryMs:0,steps:[]}).levelTimeEveryMs,0);
assert.equal(api.parseScript({levelTimeEveryMs:5,steps:[]}).levelTimeEveryMs,100);
// harness run: board snapshot from __worldIntegration.board().snapshot -> result.json levelTimes + [QF_LEVEL_TIME] log lines
(async()=>{
  const files=new Map(),U='wxfile://usr',logs=[];
  const fsm={readFileSync:p=>{if(files.has(p))return files.get(p);throw Error('ENOENT '+p);},writeFileSync:(p,s)=>files.set(p,s),appendFileSync:(p,s)=>files.set(p,(files.get(p)||'')+s),mkdirSync(){},rmdirSync(){},copyFileSync(){},unlinkSync(){}};
  const wx={env:{USER_DATA_PATH:U},getFileSystemManager:()=>fsm,getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:3}),onMemoryWarning(){}};
  for(const k of ['TouchStart','TouchMove','TouchEnd','TouchCancel']){wx['on'+k]=()=>{};wx['off'+k]=()=>{};}
  files.set('qf-autoplay/script.json',JSON.stringify({levelTimeEveryMs:100,steps:[{op:'wait',ms:900}]}));
  let snap=null;const g={wx,console:{log(){},info:(...a)=>logs.push(a.join(' ')),warn(){},error(){}},setTimeout,setInterval,clearInterval,Promise,Date,JSON,Math,Number,String,Array,Object,Error,isFinite};
  g.__worldIntegration={snapshot:()=>({state:'board'}),board:()=>({snapshot:snap})};
  g.GameGlobal=g;g.globalThis=g;vm.createContext(g);vm.runInContext(fs.readFileSync(H,'utf8'),g);
  setTimeout(()=>{snap=A('mainline-02','x','playing',10);},150);setTimeout(()=>{snap=A('mainline-02','x','won',3);},550);
  for(let i=0;i<60&&!files.has(U+'/qf-autoplay/out/result.json');i++)await new Promise(s=>setTimeout(s,100));
  const res=JSON.parse(files.get(U+'/qf-autoplay/out/result.json'));
  assert.equal(res.levelTimes.length,1);const r=res.levelTimes[0];assert.equal(r.stageId,'mainline-02');assert.equal(r.result,'won');
  assert(r.wallMs>=250&&r.wallMs<=650,'wallMs ~400 within one poll: '+r.wallMs);assert.equal(res.levelTimeEveryMs,100);
  const line=logs.find(l=>l.startsWith('[QF_LEVEL_TIME] '));assert(line,'log line');assert.equal(JSON.parse(line.slice(16)).stageId,'mainline-02');
  console.log('PASS level-time '+JSON.stringify(r));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
