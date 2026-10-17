'use strict';
// node lk.cjs <day|night|probe|fail> ; env URLQ (e.g. ?lakemerge=off), TAG, PORT
const fs=require('fs'),path=require('path');
const {chromium}=require('/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/cursor-worktree/tools/qf-env.cjs').playwright();
const mode=process.argv[2];const VP={width:+(process.env.VW||390),height:+(process.env.VH||844)};const PORT=process.env.PORT||8899;const URLQ=process.env.URLQ||'';
const tag='lk_'+mode+(process.env.TAG||'')+(process.env.VW?'_'+process.env.VW+'x'+process.env.VH:'');const OUT=path.join(__dirname,'raw');fs.mkdirSync(OUT,{recursive:true});
const marks=[],logs=[],errors=[],net=[],failed=[],ok200=[],scriptErr=[];let t0=Date.now();const T=()=>+((Date.now()-t0)/1000).toFixed(3);
const M=(k,v)=>{marks.push([T(),k,v]);console.log(tag,T(),k,v!==undefined?JSON.stringify(v).slice(0,600):'');};
let ctx,p;
(async()=>{try{
const night=mode==='night'||process.env.NIGHT==='1';const want=night?23:12;const u=new Date().getUTCHours();let off=((want-u)%24+24)%24;if(off>12)off-=24;const TZ=off===0?'Etc/GMT':'Etc/GMT'+(off>0?'-':'+')+Math.abs(off);
ctx=await chromium.launchPersistentContext(path.join(__dirname,'prof'),{executablePath:process.env.QF_CHROMIUM_EXECUTABLE,args:['--autoplay-policy=no-user-gesture-required','--enable-precise-memory-info'],viewport:VP,deviceScaleFactor:2,hasTouch:true,timezoneId:TZ,recordVideo:{dir:OUT+'/tmp-'+tag,size:VP}});
p=ctx.pages()[0]||await ctx.newPage();
await p.addInitScript(()=>{globalThis.__worldFlowLog=true;try{const k='dot-mainline-r1-isolated-20261009:forest-v3-completed';if(!localStorage.getItem(k)&&!localStorage.getItem('dot-mainline-r1-isolated-20261009:forest-v33-journey'))localStorage.setItem(k,'12');}catch(e){}});await p.addInitScript({path:__dirname+'/audio-init.js'});
await p.addInitScript(()=>{window.__fr=[];let l=0;const f=t=>{if(l)window.__fr.push([t,t-l]);l=t;requestAnimationFrame(f)};requestAnimationFrame(f);});
p.on('console',m=>logs.push([T(),m.type(),m.text().slice(0,1500)]));p.on('pageerror',e=>errors.push([T(),String(e).slice(0,400)]));
p.on('response',r=>{const u=r.url().replace(/^https?:\/\/[^/]+/,'');if(r.status()>=400)net.push([T(),r.status(),u]);else if(r.status()<300)ok200.push([T(),u]);});
p.on('requestfailed',r=>failed.push([T(),r.url().replace(/^https?:\/\/[^/]+/,''),(r.failure()||{}).errorText]));
M('tz',TZ);
const sleep=ms=>p.waitForTimeout(ms);const ev=(f,a)=>p.evaluate(f,a).catch(e=>'ERR '+e.message);
const st=()=>ev(()=>{try{return __worldIntegration.snapshot().state}catch(e){return 'NA'}});
const waitSt=async(s,to)=>{const a=Date.now();while(Date.now()-a<to){if(await st()===s)return true;await sleep(250)}return false};
const shot=n=>p.screenshot({path:OUT+'/'+tag+'_'+n+'.png'}).catch(()=>{});
const nodes=()=>p.evaluate(async()=>{const {director,UITransform,Label}=await System.import('cc');const W=innerWidth,H=innerHeight,out=[];const visit=(n,d)=>{if(!n.activeInHierarchy)return;const t=n.getComponent(UITransform);if(t){const own=n.getComponent(Label);const bb=t.getBoundingBoxToWorld();out.push({n:n.name,d,l:own?own.string:'',x:+(bb.x+W/2).toFixed(1),y:+(H/2-bb.y-bb.height).toFixed(1),w:+bb.width.toFixed(1),h:+bb.height.toFixed(1)});}for(const c of n.children)visit(c,d+1)};visit(director.getScene(),0);return out;}).catch(e=>[]);
const tapNode=async(name,filt)=>{const N=await nodes();const n=N.filter(x=>x.n===name&&(!filt||filt(x))).sort((a,b)=>b.w*b.h-a.w*a.h)[0];if(!n){M('noNode',name);return false}const pt={x:n.x+n.w/2,y:n.y+n.h/2};await p.touchscreen.tap(pt.x,pt.y);M('tap',{name,pt});return true;};
const labels=async()=>(await nodes()).filter(n=>n.l).map(n=>n.l);
const light=()=>ev(async()=>{const cc=await System.import('cc');const sc=cc.director.getScene();const r=x=>x&&+(+x).toFixed(3);const col=c=>c?[c.r,c.g,c.b].join('/'):null;
 const dl=sc.getComponentsInChildren(cc.DirectionalLight).filter(l=>l.enabledInHierarchy).map(l=>({n:l.node.name,color:col(l.color),illum:r(l.illuminance),euler:[r(l.node.eulerAngles.x),r(l.node.eulerAngles.y)]}));
 const g=sc.globals,a=g&&g.ambient,f=g&&g.fog;const cams=sc.getComponentsInChildren(cc.Camera).filter(c=>c.enabledInHierarchy).map(c=>({n:c.node.name,clear:col(c.clearColor),flags:c.clearFlags,prio:c.priority}));
 return {dl,amb:a&&{sky:a.skyColor&&[a.skyColor.x,a.skyColor.y,a.skyColor.z].map(r),ground:a.groundAlbedo&&[a.groundAlbedo.x,a.groundAlbedo.y,a.groundAlbedo.z].map(r),skyIllum:r(a.skyIllum)},fog:f&&{on:f.enabled,type:f.type,color:col(f.fogColor),start:r(f.fogStart),end:r(f.fogEnd),dens:r(f.fogDensity)},cams,dn:(globalThis.__worldDayNight&&__worldDayNight.snapshot&&__worldDayNight.snapshot().mode)};});
const perf=(ms)=>ev(async(ms)=>{const cc=await System.import('cc');const d=cc.director,dev=d.root.device;const s=[];const h=()=>{s.push([dev.numDrawCalls,dev.numTris,performance.now()])};d.on(cc.Director.EVENT_AFTER_DRAW,h);await new Promise(r=>setTimeout(r,ms));d.off(cc.Director.EVENT_AFTER_DRAW,h);const dc=s.map(x=>x[0]).sort((a,b)=>a-b),tr=s.map(x=>x[1]).sort((a,b)=>a-b);const ms_=s.length>1?(s[s.length-1][2]-s[0][2]):1;const mem=performance.memory?performance.memory.usedJSHeapSize:null;const ms2=dev.memoryStatus||{};return {frames:s.length,fps:+((s.length-1)/ms_*1000).toFixed(1),dcMed:dc[dc.length>>1],dcMax:dc[dc.length-1],trisMed:tr[tr.length>>1],heapMB:mem&&+(mem/1048576).toFixed(1),texMB:ms2.textureSize!=null?+(ms2.textureSize/1048576).toFixed(1):null,bufMB:ms2.bufferSize!=null?+(ms2.bufferSize/1048576).toFixed(1):null}},ms);
const startSampler=()=>ev(async()=>{const cc=await System.import('cc');const d=cc.director,dev=d.root.device;window.__smp=[];window.__smpH=()=>{let j=null;try{j=__worldIntegration.journey()}catch(e){}const m2=dev.memoryStatus||{};window.__smp.push([performance.now(),dev.numDrawCalls,dev.numTris,j?+(+j.distance).toFixed(2):null,j?j.total:null,j?j.phase:null,(()=>{try{return __worldIntegration.snapshot().state}catch(e){return ''}})(),performance.memory?performance.memory.usedJSHeapSize:null,m2.textureSize??null,m2.bufferSize??null,(()=>{const o={};for(const c of cc.director.getScene().getComponentsInChildren(cc.Camera)){if(!c.enabledInHierarchy||/UI|Navigation/.test(c.node.name))continue;const p=c.node.worldPosition;o[c.node.name]=[+c.fov.toFixed(2),+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3),c.priority]}return o})()])};d.on(cc.Director.EVENT_AFTER_DRAW,window.__smpH);return 'ok'});
const stopSampler=()=>ev(async()=>{const cc=await System.import('cc');cc.director.off(cc.Director.EVENT_AFTER_DRAW,window.__smpH);return window.__smp});
const camsOff=(off)=>ev(async(off)=>{const cc=await System.import('cc');const r=[];for(const c of cc.director.getScene().getComponentsInChildren(cc.Camera)){if(c.node.name==='LakesideBackgroundCamera')continue;if(off){if(c.enabled){c.enabled=false;(window.__offc=window.__offc||[]).push(c);r.push(c.node.name)}}}if(!off){for(const c of window.__offc||[])c.enabled=true;window.__offc=[]}return r},off);
const frMax=(fromT)=>ev((a)=>{const f=window.__fr.filter(x=>x[0]>=a);let m=[0,0];for(const x of f)if(x[1]>m[1])m=x;return {n:f.length,maxMs:+m[1].toFixed(1),at:+m[0].toFixed(0),over100:f.filter(x=>x[1]>100).length,over50:f.filter(x=>x[1]>50).length}},fromT);

if(mode==='fail'){await p.route(/\/assets\/region_lakeside\//,r=>{M('abortReq',r.request().url().replace(/^https?:\/\/[^/]+/,''));return r.abort('failed')});}
await p.goto('http://127.0.0.1:'+PORT+'/'+URLQ,{waitUntil:'commit'});M('goto',URLQ);
if(!await waitSt('home',120000))M('homeFail');M('home');await sleep(4000);
M('leave',await ev(()=>__worldIntegration.leave()));if(!await waitSt('island',90000))M('islandFail',await st());M('island');await sleep(3000);
if(mode==='probe'){M('lsKeys',await ev(()=>Object.keys(localStorage).map(k=>[k,localStorage.getItem(k).length])));M('mainline',await ev(()=>JSON.stringify(__worldIntegration.mainline()).slice(0,800)));M('gates',await ev(()=>JSON.stringify(__worldIntegration.gates()).slice(0,800)));}
// progress seed (test data only, no code change): legacy completed=12 in the mainline namespace
M('cleared',await ev(()=>{try{return __worldIntegration.mainline().stages.filter(s=>s.record&&s.record.bestStars>0||s.cleared).length}catch(e){return 'ERR'}}));
M('lakeUnlocked',await ev(()=>{try{return JSON.stringify(__worldIntegration.mainline().stages.slice(-1)[0]).slice(0,300)}catch(e){return 'ERR'}}));
if(mode==='probe'){M('end');return;}
M('lightIsland',await light());M('perfIsland',await perf(3000));await shot('island');
// open journal → lake chapter → continue
await tapNode('Island-journal');await sleep(2000);await tapNode('Chapter-lake');await sleep(2000);M('chapterTexts',await labels());await shot('chapter_lake');
const tStart=await ev(()=>performance.now());await startSampler();
await tapNode('Continue-lake');M('tapContinue');
const jshots=[[8,'j08'],[16,'j16'],[24,'j24'],[30,'j30'],[36,'j36']];let ji=0;let window_ll=0;const a0=Date.now();let lastSt='';
while(Date.now()-a0<90000){const s=await st();if(s!==lastSt){M('state',s);lastSt=s;}let j=null;try{j=await p.evaluate(()=>__worldIntegration.journey())}catch(e){}
 if(j&&ji<jshots.length&&j.distance>=jshots[ji][0]){await shot(jshots[ji][1]);M('jshot',[jshots[ji][1],j.distance,j.total,j.phase]);if(ji===3)M('lightJ30',await light());ji++;}
 if(mode==='fail'&&s==='island'&&Date.now()-a0>1500){await sleep(600);await shot('fail_toast');M('failLabels',await labels());await sleep(1500);await shot('fail_toast2');break;}
 const b=await ev(()=>{const b=__worldIntegration.board();return b&&b.snapshot&&b.snapshot.active?b.snapshot.active.stageId:null});if(b&&s==='level'){M('board',b);break;}if(s==='level-loading'&&!window_ll){window_ll=1;M('llmark');}await sleep(100);}
const smp=await stopSampler();fs.writeFileSync(OUT+'/'+tag+'_journey_samples.json',JSON.stringify(smp));M('entryFrames',await frMax(tStart));
if(mode==='fail'){M('end');return;}
await sleep(1500);for(let k=0;k<3;k++){const g=await ev(()=>{const b=__worldIntegration.board();return b&&b.popups&&b.popups.length&&b.layout&&b.layout.targets&&b.layout.targets.GotIt||null});if(!g||typeof g!=='object')break;await p.touchscreen.tap(g.x,g.y);M('gotIt',g);await sleep(1500);}await shot('board');M('boardDiag',await ev(()=>JSON.stringify((__worldIntegration.board()||{}).background||null).slice(0,1500)));
M('lightBoard',await light());M('perfBoard',await perf(4000));
if(process.env.QUICK){M('end');return;}await p.setViewportSize({width:360,height:640});await sleep(2500);await shot('board_360');M('perfBoard360',await perf(3000));
M('camsOff',await camsOff(true));await sleep(800);await shot('bgonly_360');M('perfBg',await perf(3000));for(let i=0;i<8;i++){await shot('bgflick_'+i);await sleep(400);}
await camsOff(false);await p.setViewportSize(VP);await sleep(1500);
// day/night toggle on the board
M('toggle1',await ev(()=>{__worldDayNight.toggle();return __worldDayNight.snapshot().mode}));await sleep(3000);await shot('board_toggled');M('lightToggled',await light());
await p.setViewportSize({width:360,height:640});await sleep(1500);await camsOff(true);await sleep(800);await shot('bgonly_360_toggled');await camsOff(false);await p.setViewportSize(VP);await sleep(1200);
M('toggle2',await ev(()=>{__worldDayNight.toggle();return __worldDayNight.snapshot().mode}));await sleep(3000);await shot('board_back');M('lightBack',await light());
// leave: exit level -> lakeside -> home(island)
M('exitLevel',await ev(async()=>{const cc=await System.import('cc');const C=cc.js.getClassByName('WorldIntegrationBoot');const c=cc.director.getScene().getComponentsInChildren(C)[0];const r=await c.composition.worldCommands().exitLevel();return JSON.stringify(r)}));
await sleep(4000);M('afterExit',await st());await shot('after_exit');M('afterExitLabels',(await labels()).slice(0,30));
const okHome=await tapNode('home');if(!okHome)M('returnHome',await ev(()=>JSON.stringify(__worldIntegration.returnHome())));
const b0=Date.now();while(Date.now()-b0<60000){const s=await st();if(s==='island')break;await sleep(300);}M('backState',await st());if(await st()==='home'){await sleep(6000);await shot('home_after');M('leave2',await ev(()=>__worldIntegration.leave()));await waitSt('island',90000);M('island3',await st());}await sleep(4000);await shot('island_after');M('lightIslandAfter',await light());M('perfIslandAfter',await perf(2000));
M('end');
}catch(e){M('FAIL',String(e).slice(0,300));scriptErr.push(String(e).slice(0,300));}finally{
try{const b64=await p.evaluate(()=>window.__rec.stop());fs.writeFileSync(OUT+'/'+tag+'.audio.webm',Buffer.from(b64,'base64'));}catch(e){M('audioFail',String(e).slice(0,200))}
fs.writeFileSync(OUT+'/'+tag+'.json',JSON.stringify({marks,errors,net,failed,ok200,scriptErr},null,0));fs.writeFileSync(OUT+'/'+tag+'_worldFlowLog.txt',logs.map(l=>l.join('\t')).join('\n'));
try{await ctx.close()}catch{}
try{const d=OUT+'/tmp-'+tag;for(const f of fs.readdirSync(d))fs.renameSync(d+'/'+f,OUT+'/'+tag+'.webm');fs.rmdirSync(d)}catch{}process.exit(0);}
})();
