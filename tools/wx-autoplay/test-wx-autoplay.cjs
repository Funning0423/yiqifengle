'use strict';
// Box test: script parsing, design->client mapping, raw wx touch injection reaching engine listeners registered AFTER the
// harness (as in game.js order), file outputs + caps, release gate, injector/check-release on a fake build output.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),cp=require('node:child_process');
const H=path.join(__dirname,'qf-autoplay.js'),api=require(H);
// parsing
assert.throws(()=>api.parseScript('{}'),/steps/);
assert.throws(()=>api.parseScript({steps:[{op:'fly'}]}),/unknown op/);
assert.throws(()=>api.parseScript({steps:[{op:'tap',x:500,y:1}]}),/outside/);
assert.throws(()=>api.parseScript({steps:Array.from({length:21},(_, i)=>({op:'screenshot',name:'s'+i}))}),/20 screenshots/);
assert.throws(()=>api.parseScript({launchQuery:'?a=<x>',steps:[]}),/launchQuery/);
for(const f of fs.readdirSync(path.join(__dirname,'examples')))api.parseScript(fs.readFileSync(path.join(__dirname,'examples',f),'utf8'));
assert.deepEqual(api.toClient(195,422,{w:390,h:844}),{x:195,y:422});
assert.deepEqual(api.toClient(390,844,{w:375,h:812}),{x:375,y:812});
const pts=api.dragPoints({x1:0,y1:0,x2:100,y2:0,ms:160},16);assert.equal(pts.length,10);assert.deepEqual(pts.at(-1),[100,0]);
// runtime in a fake mini-game
function runFake(script,env='develop',withCc){
  const files=new Map(),events=[],raw=[];const U='wxfile://usr';
  const fsm={readFileSync:p=>{if(files.has(p))return files.get(p);throw Error('ENOENT '+p);},writeFileSync:(p,s)=>files.set(p,s),appendFileSync:(p,s)=>files.set(p,(files.get(p)||'')+s),
    mkdirSync(){},rmdirSync:p=>{for(const k of [...files.keys()])if(k.startsWith(p))files.delete(k);},copyFileSync:(a,b)=>files.set(b,'JPG'),unlinkSync(){}};
  const real={};const wx={env:{USER_DATA_PATH:U},getFileSystemManager:()=>fsm,getAccountInfoSync:()=>({miniProgram:{envVersion:env}}),getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:3}),onMemoryWarning(){}};
  for(const k of ['TouchStart','TouchMove','TouchEnd','TouchCancel']){real[k]=[];wx['on'+k]=f=>real[k].push(f);wx['off'+k]=f=>{};}
  files.set('qf-autoplay/script.json',JSON.stringify(script));files.set(U+'/qf-autoplay/out/stale.jpg','old');
  const g={wx,console:{log(){},info(){},warn(){},error(){}},setTimeout,setInterval,clearInterval,Promise,Date,JSON,Math,Number,String,Array,Object,Error,isFinite,
    canvas:{width:1170,height:2532,toTempFilePathSync:o=>{assert.equal(o.fileType,'jpg');assert.equal(o.quality,0.6);assert(o.destWidth<=195);return 'tmp://x';}}};
  g.GameGlobal=g;g.globalThis=g;vm.createContext(g);vm.runInContext(fs.readFileSync(H,'utf8'),g);
  // engine + a full-screen swallowing node registered after the harness, like the Cocos adapter / IslandLighthouseTouch
  let state='home';g.__worldIntegration={snapshot:()=>({state})};
  if(withCc){const nil=[];const scene={getComponentsInChildren:t=>{if(!t){nil.push(1);g.console.error('Error 3804, please go to EngineErrorMap.md#3804');}return [];}};
    g.cc={director:{getScene:()=>scene,getTotalFrames:()=>1},Camera:function Camera(){},Layers:{Enum:{UI_2D:1}},Vec3:function(){},js:{getClassByName:()=>undefined}};g.__nil=nil;}
  g.wx.onTouchStart(e=>{events.push(['S',e.changedTouches[0].clientX,e.changedTouches[0].clientY]);if(e.touches[0].clientY>300)state='island';});
  g.wx.onTouchMove(e=>events.push(['M',e.changedTouches[0].clientX]));g.wx.onTouchEnd(e=>{events.push(['E',e.touches.length]);});
  g.wx.onTouchStart(e=>raw.push('raw'));
  return {g,files,events,raw,real,U};
}
(async()=>{
  const r=runFake({steps:[{op:'waitState',name:'home',timeoutMs:3000},{op:'tap',x:195,y:560},{op:'waitState',name:'island',timeoutMs:3000},{op:'drag',x1:10,y1:400,x2:100,y2:400,ms:100},{op:'screenshot',name:'a'},{op:'waitState',name:'never',timeoutMs:300,stopOnFail:false},{op:'wait',ms:10}]});
  assert(r.g.__QF_AUTOPLAY,'harness active in develop');
  for(let i=0;i<60&&!r.files.has(r.U+'/qf-autoplay/out/result.json');i++)await new Promise(s=>setTimeout(s,100));
  await new Promise(s=>setTimeout(s,1200));
  const res=JSON.parse(r.files.get(r.U+'/qf-autoplay/out/result.json'));
  assert.equal(res.ok,false,'unmatched waitState marks ok=false');assert.equal(res.steps.length,7);assert.equal(res.steps[2].matched,true);
  assert.deepEqual(r.events[0],['S',195,560]);assert(r.events.filter(e=>e[0]==='M').length>=2);assert.equal(r.events.filter(e=>e[0]==='E').length,2);
  assert.equal(r.raw.length,2,'raw wx listeners (IslandHomeInteraction path) also receive injected touches');
  assert.equal(r.real.TouchStart.length,2,'real wx registrations forwarded');
  assert(!r.files.has(r.U+'/qf-autoplay/out/stale.jpg'),'previous run output cleared');
  assert(r.files.has(r.U+'/qf-autoplay/out/shots/01-a.jpg'));
  const st=r.files.get(r.U+'/qf-autoplay/out/state.jsonl').trim().split('\n').map(JSON.parse);assert(st.some(s=>s.state==='island'));assert('fps' in st[0]&&'memory' in st[0]&&'onWater' in st[0]);
  assert(r.files.get(r.U+'/qf-autoplay/out/console.log').includes('[QF_AUTOPLAY]'));
  // Error 3804 regression: WeChat cc namespace lacks SkinnedMeshRenderer; harness must never pass undefined to getComponent*
  const c=runFake({steps:[{op:'waitState',name:'home',timeoutMs:1000},{op:'wait',ms:50}]},'develop',true);
  for(let i=0;i<40&&!c.files.has(c.U+'/qf-autoplay/out/result.json');i++)await new Promise(s=>setTimeout(s,100));
  const cres=JSON.parse(c.files.get(c.U+'/qf-autoplay/out/result.json'));
  assert.equal(c.g.__nil.length,0,'no getComponent*(undefined) call (Error 3804)');assert.equal(cres.consoleErrors,0);assert.equal(cres.ok,true);
  const cst=c.files.get(c.U+'/qf-autoplay/out/state.jsonl').trim().split('\n').map(JSON.parse);assert(cst.every(s=>s.characterErr==='cc.SkinnedMeshRenderer unavailable'&&!s.ccErr));
  // a game-side console error fails the run (acceptance: DevTools Console Error count = 0)
  const e=runFake({steps:[{op:'wait',ms:50}]});e.g.console.error('Error 3804 from game');
  for(let i=0;i<40&&!e.files.has(e.U+'/qf-autoplay/out/result.json');i++)await new Promise(s=>setTimeout(s,100));
  const eres=JSON.parse(e.files.get(e.U+'/qf-autoplay/out/result.json'));assert.equal(eres.ok,false);assert.equal(eres.consoleErrors,1);assert.match(eres.failReason,/console errors: 1/);
  // journey phase=failed / snapshot error / HUD-suppressed error fail the run even with 0 console errors (38699944 windSource P0)
  {const f=runFake({steps:[{op:'wait',ms:50}]});const err="TypeError: Cannot set properties of undefined (setting 'windSource')";
   f.g.__worldIntegration={snapshot:()=>({state:'meadow',error:err,journey:{phase:'failed',region:'meadow',target:'skycity',error:err}})};f.g.console.info('[OI_HUD] suppressed {"kind":"error","text":"x"}');
   for(let i=0;i<40&&!f.files.has(f.U+'/qf-autoplay/out/result.json');i++)await new Promise(s=>setTimeout(s,100));
   const fr=JSON.parse(f.files.get(f.U+'/qf-autoplay/out/result.json'));assert.equal(fr.consoleErrors,0);assert.equal(fr.ok,false);
   assert.equal(fr.journeyFailures.length,1);assert.match(fr.journeyFailures[0],/meadow>skycity: TypeError/);assert.equal(fr.snapshotErrors.length,1);assert.equal(fr.hudSuppressedErrors.length,1);assert.match(fr.failReason,/game failures: 3/);}
  // preTransition op: enables the hook (no launch params), runs setup, then a normal synthetic touch on the returned point
  assert.equal(api.parseScript({steps:[{op:'preT',key:'home-island'}]}).steps[0].op,'preTransition','preT alias');
  assert.throws(()=>api.parseScript({steps:[{op:'preTransition',key:'Bad Key'}]}),/bad key/);
  const pt=runFake({steps:[{op:'preTransition',key:'island-board',tap:true,recordMs:20,timeoutMs:5000},{op:'preT',key:'nope',timeoutMs:2000,stopOnFail:false}]});
  const calls=[];pt.g.__qfPreTransition=async k=>{calls.push([k,pt.g.__qfHooksEnable]);if(k==='enable')return {ok:true};if(k==='island-board')return {ok:true,state:'island',tap:{kind:'control',point:{x:175,y:458}},frame:{width:390,height:844}};return {ok:false,reason:'unknown-key'};};
  for(let i=0;i<60&&!pt.files.has(pt.U+'/qf-autoplay/out/result.json');i++)await new Promise(s=>setTimeout(s,100));
  const pres=JSON.parse(pt.files.get(pt.U+'/qf-autoplay/out/result.json'));
  assert.deepEqual(calls[0],['enable',true],'enable first (flag set)');assert.equal(calls[1][0],'island-board');
  assert.equal(pres.steps[0].ready,true);assert.deepEqual(pres.steps[0].tapped,{x:175,y:458});assert.ok(pt.events.some(e=>e[0]==='S'&&e[1]===175&&e[2]===458),'touch at returned point');
  assert.equal(pres.steps[1].ready,false);assert.equal(pres.ok,false,'failed setup marks ok=false');
  const rel=runFake({steps:[{op:'tap',x:1,y:1}]},'release');assert(!rel.g.__QF_AUTOPLAY,'release envVersion -> harness refuses');
  // injector + release check on a fake output
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'qfap-'));fs.writeFileSync(path.join(d,'game.js'),"require('./adapter');\n");
  const chk=a=>cp.spawnSync(process.execPath,[path.join(__dirname,'check-release.cjs'),d,...a]).status;
  assert.equal(chk([]),0,'clean before inject');
  assert.equal(cp.spawnSync(process.execPath,[path.join(__dirname,'inject.cjs'),d]).status,0);
  assert(fs.readFileSync(path.join(d,'game.js'),'utf8').startsWith("require('./qf-autoplay.js')"),'harness is first line of game.js');
  assert.equal(chk([]),1,'injected output is NOT clean');assert.equal(chk(['--expect-present']),0);
  assert.equal(cp.spawnSync(process.execPath,[path.join(__dirname,'inject.cjs'),d,'--remove']).status,0);assert.equal(chk([]),0,'clean after remove');
  fs.rmSync(d,{recursive:true,force:true});
  // the game source tree carries nothing from the harness
  const src=path.resolve(__dirname,'../../creator-build-project');const g2=cp.spawnSync('grep',['-rIlE','QF_AUTOPLAY|qf-autoplay',src+'/assets',src+'/build-templates',src+'/settings']);assert.equal(String(g2.stdout).trim(),'','game project has no harness reference');
  console.log('PASS wx-autoplay');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
