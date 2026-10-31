'use strict';
/** finU/finT: [QF_GPU]/[QF_SYNC] lines must survive a full trace sink. Flood: 400 camTrace + 100 HER lines + 30 GPU + 10 SYNC per flush
 *  window (caps 150 lines / 12 KB unchanged). 0 GPU/SYNC lines dropped; dropped count == lines pushed − lines emitted; per-tag counts
 *  correct in the flush tail and in __qfCamTraceStats. Negative: the e8cd7c1e sink drops GPU/SYNC lines in the same flood. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../..'),REL='creator-build-project/assets/scripts/region/CamTraceLog.ts';
function load(src){const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};const g={__QF_CAM_SINK:true};let now=1000;
 const cc={Director:{EVENT_AFTER_DRAW:'a'},director:{on(){}},sys:{},assetManager:{},Game:{},Input:{EventType:{}},game:{on(){}},input:{on(){}},screen:{},view:{},Vec3:class{},MeshRenderer:class{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,console,performance:{now:()=>now},setTimeout:()=>1,clearTimeout(){},Date:{now:()=>now},globalThis:g,
  require:s=>s==='cc'?cc:s.includes('DebugQuery')?{debugSearch:()=>''}:s.includes('CameraPose')?{cameraWriteHook:{}}:{}});
 return {M:m.exports,g,tick:ms=>{now+=ms;}};}
function flood(L){const {M}=L;const out=[];M.camSink.emit=s=>out.push(s);M.camSink.last=1000;let pushed={GPU:0,SYNC:0,low:0};
 for(let i=0;i<500;i++){M.camSinkPush((i%5===4?'[QF_HER_FRAME] fr='+i+' bbox=0,0,0,0 ':'[QF_CAM_TRACE] f='+i+' t=1.0 pos=1,2,3 yaw=4 pitch=5 fov=45 w=SkyWalkShot ')+'x'.repeat(40));pushed.low++;
  if(i%13===0&&pushed.GPU<30){M.camSinkPush('[QF_GPU] s='+i+' fr='+i+' dc=60/60 tri=1 raf=19/19/17 long=0 uploads=0/0.0 shaders=0 regions={} w=x');pushed.GPU++;}
  if(i%50===0){M.camSinkPush('[QF_SYNC] frames='+i+' calls=0 steadyCalls=0 verdict=PASS');pushed.SYNC++;}}
 L.tick(1000);M.camSinkFlush();const lines=out.join('\n').split('\n');
 const got=t=>lines.filter(l=>l.startsWith('[QF_'+t+']')).length;const tail=lines.find(l=>l.startsWith('[QF_CAM_LOG]'));
 const emitted=lines.filter(l=>!l.startsWith('[QF_CAM_LOG]')).length,total=pushed.GPU+pushed.SYNC+pushed.low;
 return {pushed,gpu:got('GPU'),sync:got('SYNC'),tail,emitted,total,M,L};}
const cur=fs.readFileSync(path.join(ROOT,REL),'utf8');
const r=flood(load(cur));
assert.equal(r.gpu,r.pushed.GPU,'GPU lines dropped');assert.equal(r.sync,r.pushed.SYNC,'SYNC lines dropped');
const dropped=r.total-r.emitted;assert.ok(dropped>0,'flood must overflow');
assert.match(r.tail,new RegExp(' DROPPED='+dropped+' totalDropped='+dropped+' '),'flush tail count: '+r.tail);
const dt=JSON.parse(/dropTags=(\{.*\})/.exec(r.tail)[1]);assert.equal((dt.QF_CAM_TRACE||0)+(dt.QF_HER_FRAME||0),dropped);assert.ok(!dt.QF_GPU&&!dt.QF_SYNC);
const st=r.L.g.__qfCamTraceStats;assert.equal(st.sinkDropped,dropped);assert.equal(st.sinkDroppedPriority,0);assert.equal(JSON.stringify(st.sinkDroppedByTag),JSON.stringify(dt));
assert.ok(r.emitted<=150,'line cap unchanged');
let caught=false;try{const b=flood(load(cp.execFileSync('git',['show','e8cd7c1e:'+REL],{cwd:ROOT,encoding:'utf8'})));assert.equal(b.gpu,b.pushed.GPU);assert.equal(b.sync,b.pushed.SYNC);}catch{caught=true;}
assert.ok(caught,'self-test: e8cd7c1e sink (drops GPU/SYNC) not caught');
console.log('PASS sink-priority dropped='+dropped+' gpu='+r.gpu+'/'+r.pushed.GPU+' sync='+r.sync+'/'+r.pushed.SYNC);
