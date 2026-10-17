'use strict';
// node lk4.cjs <day|night|fail|failwater|probe> ; env REGION(lake|meadow|sky) URLQ TAG PORT VW VH QUICK CAP BG SKY FAILPAT PROF
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.QF_ENV_CJS || (process.env.QF_REPO + '/tools/qf-env.cjs')).playwright();
const mode=process.argv[2];const VP={width:+(process.env.VW||390),height:+(process.env.VH||844)};const PORT=process.env.PORT||8899;const URLQ=process.env.URLQ||'';
const REGION=process.env.REGION||'lake';const CAP=!!process.env.CAP;const BG=+(process.env.BG||0);const SKY=REGION==='lake'&&process.env.SKY!=='0';
const tag='lk4_'+REGION+'_'+mode+(process.env.TAG||'')+(process.env.VW?'_'+process.env.VW+'x'+process.env.VH:'');const OUT=path.join(__dirname,'raw');fs.mkdirSync(OUT,{recursive:true});
const marks=[],logs=[],errors=[],net=[],failed=[],ok200=[],scriptErr=[];let t0=Date.now();const T=()=>+((Date.now()-t0)/1000).toFixed(3);
const M=(k,v)=>{marks.push([T(),k,v]);console.log(tag,T(),k,v!==undefined?JSON.stringify(v).slice(0,700):'');};
let ctx,p,ctxEpoch=0;
(async()=>{try{
const night=mode==='night'||process.env.NIGHT==='1';const want=night?23:12;const u=new Date().getUTCHours();let off=((want-u)%24+24)%24;if(off>12)off-=24;const TZ=off===0?'Etc/GMT':'Etc/GMT'+(off>0?'-':'+')+Math.abs(off);
ctxEpoch=Date.now();
ctx=await chromium.launchPersistentContext(path.join(__dirname,process.env.PROF||'prof'),{executablePath:process.env.QF_CHROMIUM_EXECUTABLE,args:['--autoplay-policy=no-user-gesture-required','--enable-precise-memory-info'],viewport:VP,deviceScaleFactor:2,hasTouch:true,timezoneId:TZ,recordVideo:{dir:OUT+'/tmp-'+tag,size:VP}});
p=ctx.pages()[0]||await ctx.newPage();M('ctxEpoch',ctxEpoch);
await p.addInitScript((SEED)=>{globalThis.__worldFlowLog=true;try{const k='dot-mainline-r1-isolated-20261009:forest-v3-completed';if(!localStorage.getItem(k)&&!localStorage.getItem('dot-mainline-r1-isolated-20261009:forest-v33-journey'))localStorage.setItem(k,SEED);}catch(e){}
 window.__vis=[];document.addEventListener('visibilitychange',()=>window.__vis.push([Date.now(),performance.now(),document.visibilityState]));window.__navEpoch=Date.now()-performance.now();},process.env.SEED||'12');
await p.addInitScript({path:__dirname+'/audio-init.js'});
await p.addInitScript(()=>{window.__fr=[];let l=0;const f=t=>{if(l)window.__fr.push([t,t-l]);l=t;requestAnimationFrame(f)};requestAnimationFrame(f);});
p.on('console',m=>logs.push([T(),m.type(),m.text().slice(0,2000)]));p.on('pageerror',e=>errors.push([T(),String(e).slice(0,400)]));
p.on('response',r=>{const u=r.url().replace(/^https?:\/\/[^/]+/,'');if(r.status()>=400)net.push([T(),r.status(),u]);else if(r.status()<300)ok200.push([T(),u]);});
p.on('requestfailed',r=>failed.push([T(),r.url().replace(/^https?:\/\/[^/]+/,''),(r.failure()||{}).errorText]));
M('tz',TZ);
const sleep=ms=>p.waitForTimeout(ms);const ev=(f,a)=>p.evaluate(f,a).catch(e=>'ERR '+e.message);
const st=()=>ev(()=>{try{return __worldIntegration.snapshot().state}catch(e){return 'NA'}});
const waitSt=async(s,to)=>{const a=Date.now();while(Date.now()-a<to){if(await st()===s)return true;await sleep(250)}return false};
const shot=n=>p.screenshot({path:OUT+'/'+tag+'_'+n+'.png'}).catch(()=>{});
const nodes=()=>p.evaluate(async()=>{const {director,UITransform,Label}=await System.import('cc');const W=innerWidth,H=innerHeight,out=[];const visit=(n,d)=>{if(!n.activeInHierarchy)return;const t=n.getComponent(UITransform);if(t){const own=n.getComponent(Label);const bb=t.getBoundingBoxToWorld();out.push({n:n.name,d,l:own?own.string:'',x:+(bb.x+W/2).toFixed(1),y:+(H/2-bb.y-bb.height).toFixed(1),w:+bb.width.toFixed(1),h:+bb.height.toFixed(1)});}for(const c of n.children)visit(c,d+1)};visit(director.getScene(),0);return out;}).catch(e=>[]);
const tapNode=async(name,filt)=>{const N=await nodes();const n=N.filter(x=>x.n===name&&(!filt||filt(x))).sort((a,b)=>b.w*b.h-a.w*a.h)[0];if(!n){M('noNode',name);return false}const pt={x:n.x+n.w/2,y:n.y+n.h/2};await p.touchscreen.tap(pt.x,pt.y);M('tap',{name,pt,epoch:Date.now()});return true;};
const labels=async()=>(await nodes()).filter(n=>n.l).map(n=>n.l);
const light=()=>ev(async()=>{const cc=await System.import('cc');const sc=cc.director.getScene();const r=x=>x&&+(+x).toFixed(3);const col=c=>c?[c.r,c.g,c.b].join('/'):null;
 const dl=sc.getComponentsInChildren(cc.DirectionalLight).filter(l=>l.enabledInHierarchy).map(l=>{const f=l.node.forward;return {n:l.node.name,color:col(l.color),illum:r(l.illuminance),euler:[r(l.node.eulerAngles.x),r(l.node.eulerAngles.y)],fwd:[r(f.x),r(f.y),r(f.z)]}});
 const g=sc.globals,a=g&&g.ambient,f=g&&g.fog;const cams=sc.getComponentsInChildren(cc.Camera).filter(c=>c.enabledInHierarchy).map(c=>({n:c.node.name,clear:col(c.clearColor),flags:c.clearFlags,prio:c.priority}));
 return {dl,amb:a&&{skyIllum:r(a.skyIllum)},fog:f&&{on:f.enabled,type:f.type,color:col(f.fogColor),start:r(f.fogStart),end:r(f.fogEnd)},cams,dn:(globalThis.__worldDayNight&&__worldDayNight.snapshot&&__worldDayNight.snapshot().mode)};});
const perf=(ms)=>ev(async(ms)=>{const cc=await System.import('cc');const d=cc.director,dev=d.root.device;const s=[];const h=()=>{s.push([dev.numDrawCalls,dev.numTris,performance.now()])};d.on(cc.Director.EVENT_AFTER_DRAW,h);await new Promise(r=>setTimeout(r,ms));d.off(cc.Director.EVENT_AFTER_DRAW,h);const dc=s.map(x=>x[0]).sort((a,b)=>a-b),tr=s.map(x=>x[1]).sort((a,b)=>a-b);const ms_=s.length>1?(s[s.length-1][2]-s[0][2]):1;const mem=performance.memory?performance.memory.usedJSHeapSize:null;const ms2=dev.memoryStatus||{};return {frames:s.length,fps:+((s.length-1)/ms_*1000).toFixed(1),dcMed:dc[dc.length>>1],dcMax:dc[dc.length-1],trisMed:tr[tr.length>>1],heapMB:mem&&+(mem/1048576).toFixed(1),texMB:ms2.textureSize!=null?+(ms2.textureSize/1048576).toFixed(1):null,bufMB:ms2.bufferSize!=null?+(ms2.bufferSize/1048576).toFixed(1):null}},ms);
const startSampler=(cap)=>ev(async(cap)=>{const cc=await System.import('cc');const d=cc.director,dev=d.root.device;window.__smp=[];window.__cap=[];let after=0;const cv=document.createElement('canvas');cv.width=390;cv.height=Math.round(390*cc.game.canvas.height/cc.game.canvas.width);const cx=cv.getContext('2d');
 window.__smpH=()=>{let j=null;try{j=__worldIntegration.journey()}catch(e){}const m2=dev.memoryStatus||{};const s=(()=>{try{return __worldIntegration.snapshot().state}catch(e){return ''}})();const sc=cc.director.getScene();
  const cams={};for(const c of sc.getComponentsInChildren(cc.Camera)){if(!c.enabledInHierarchy||/UI|Navigation/.test(c.node.name))continue;const p=c.node.worldPosition;cams[c.node.name]=[+c.fov.toFixed(2),+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3),c.priority]}
  let sun=null;const L=sc.getComponentsInChildren(cc.DirectionalLight).filter(l=>l.enabledInHierarchy);if(L.length){const f=L[0].node.forward;sun=[L[0].node.name,+f.x.toFixed(3),+f.y.toFixed(3),+f.z.toFixed(3)]}
  const now=performance.now();window.__smp.push([now,dev.numDrawCalls,dev.numTris,j?+(+j.distance).toFixed(2):null,j?j.total:null,j?j.phase:null,s,performance.memory?performance.memory.usedJSHeapSize:null,m2.textureSize??null,m2.bufferSize??null,cams,sun,window.__skyW??null]);
  if(cap){const near=j&&j.total&&(j.total-j.distance)<2.5;const on=(near||s==='lakeside'||s==='level-loading'||s==='level'||(j&&j.phase==='arrived'));if(s==='level')after++;if(on&&after<25&&window.__cap.length<400){try{cx.drawImage(cc.game.canvas,0,0,cv.width,cv.height);window.__cap.push([now,s,j?j.phase:null,Object.keys(cams).join('+'),cv.toDataURL('image/jpeg',0.85)])}catch(e){}}}};
 d.on(cc.Director.EVENT_AFTER_DRAW,window.__smpH);return 'ok'},cap);
const stopSampler=()=>ev(async()=>{const cc=await System.import('cc');cc.director.off(cc.Director.EVENT_AFTER_DRAW,window.__smpH);const c=window.__cap;window.__cap=[];return {smp:window.__smp,cap:c}});
const camsOff=(off)=>ev(async(off)=>{const cc=await System.import('cc');const r=[];for(const c of cc.director.getScene().getComponentsInChildren(cc.Camera)){if(c.node.name==='LakesideBackgroundCamera')continue;if(off){if(c.enabled){c.enabled=false;(window.__offc=window.__offc||[]).push(c);r.push(c.node.name)}}}if(!off){for(const c of window.__offc||[])c.enabled=true;window.__offc=[]}return r},off);
const frStats=(fromT,toT)=>ev((a)=>{const f=window.__fr.filter(x=>x[0]>=a[0]&&(!a[1]||x[0]<=a[1]));const d=f.map(x=>x[1]).sort((x,y)=>x-y);let m=[0,0];for(const x of f)if(x[1]>m[1])m=x;const q=k=>d.length?+d[Math.min(d.length-1,Math.floor(d.length*k))].toFixed(1):null;return {n:f.length,maxMs:+m[1].toFixed(1),at:+m[0].toFixed(0),p50:q(.5),p95:q(.95),p99:q(.99),over16_7:f.filter(x=>x[1]>17.5).length,over33:f.filter(x=>x[1]>34).length,over50:f.filter(x=>x[1]>50).length,over100:f.filter(x=>x[1]>100).length}},[fromT,toT]);
const hideShow=async(sec)=>{const h0=Date.now();let method='tab';const p2=await ctx.newPage();await p2.goto('about:blank').catch(()=>{});await p2.bringToFront();await sleep(400);let vs=await ev(()=>document.visibilityState);
 if(vs!=='hidden'){method='override';await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));});}
 const hideEpoch=method==='tab'?h0:Date.now();M('bgHide',{method,vs,epoch:hideEpoch});await new Promise(r=>setTimeout(r,sec*1000));
 if(method==='override'){await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'));});}
 await p.bringToFront();await p2.close().catch(()=>{});M('bgShow',{epoch:Date.now(),vis:await ev(()=>window.__vis)});};
if(mode==='fail'){await p.route(/\/assets\/region_lakeside\//,r=>{M('abortReq',r.request().url().replace(/^https?:\/\/[^/]+/,''));return r.abort('failed')});}
if(mode==='failwater'){const re=new RegExp(process.env.FAILPAT);await p.route(u=>re.test(u.toString()),r=>{M('abortReq',r.request().url().replace(/^https?:\/\/[^/]+/,''));return r.abort('failed')});M('failPat',process.env.FAILPAT);}
await p.goto('http://127.0.0.1:'+PORT+'/'+URLQ,{waitUntil:'commit'});M('goto',URLQ);
if(!await waitSt('home',120000))M('homeFail');M('home');await sleep(4000);
M('leave',await ev(()=>__worldIntegration.leave()));if(!await waitSt('island',90000))M('islandFail',await st());M('island');await sleep(3000);
M('cleared',await ev(()=>{try{return __worldIntegration.mainline().stages.filter(s=>s.record&&s.record.bestStars>0||s.cleared).length}catch(e){return 'ERR'}}));
if(mode==='probe'){M('gates',await ev(()=>JSON.stringify(__worldIntegration.gates()).slice(0,1500)));}
M('lightIsland',await light());if(!process.env.QUICK)M('perfIsland',await perf(3000));await shot('island');
const ENTRY=process.env.ENTRY||'chapter';M('mainlineNext',await ev(()=>{try{const s=__worldIntegration.mainline();return JSON.stringify({next:s.nextStageId,active:s.active&&s.active.stageId})}catch(e){return 'ERR'}}));
if(ENTRY==='chapter'){await tapNode('Island-journal');await sleep(2000);await tapNode('Chapter-'+REGION);await sleep(2000);M('chapterTexts',await labels());await shot('chapter');}
const tStart=await ev(()=>performance.now());await startSampler(CAP);
await ev(()=>{const w=globalThis.__worldDayNight;if(w&&w.skyFollow&&!w.__wrapped){const o=w.skyFollow;w.skyFollow=(t,x,f)=>{window.__skyW=x;window.__skyF=f;return o(t,x,f)};w.__wrapped=1}return !!w});
if(ENTRY==='chapter'){await tapNode('Continue-'+REGION);M('tapContinue');}else{const q=await ev(()=>__worldIntegration.layout().targets.mainline);M('mainlineTarget',q);if(q&&q.x){await p.touchscreen.tap(q.x,q.y);M('tapMainline',{q,epoch:Date.now()});}}
const jshots=[[8,'j08'],[16,'j16'],[24,'j24'],[30,'j30'],[36,'j36']];let ji=0;let ll=0;const a0=Date.now();let lastSt='',lastPh='';const skyT=[0.6,0.8,0.95];let si=0;let bgDone=false;let tLevel=null;let labelsDone=false;
while(Date.now()-a0<120000){const s=await st();let j=null;try{j=await p.evaluate(()=>{const j=__worldIntegration.journey();return j&&{distance:j.distance,total:j.total,phase:j.phase,w:window.__skyW,f:window.__skyF}})}catch(e){}
 if(s!==lastSt){M('state',s);lastSt=s;}if(j&&j.phase!==lastPh){M('phase',[j.phase,j.distance]);lastPh=j.phase;}
 if(j&&!labelsDone&&j.distance>=10){labelsDone=true;M('journeyLabels',await labels());await shot('journey_ui');}
 if(SKY&&j&&si<skyT.length&&j.w!=null&&j.w>=skyT[si]){await shot('sky_w'+skyT[si]);M('skyShot',[skyT[si],j.w,j.f,j.distance]);si++;}
 if(!SKY&&j&&ji<jshots.length&&j.distance>=jshots[ji][0]){await shot(jshots[ji][1]);ji++;}
 if(BG&&!bgDone&&j&&j.phase==='arrival'){bgDone=true;await hideShow(BG);}
 if(mode==='fail'&&s==='island'&&Date.now()-a0>1500){await sleep(600);await shot('fail_toast');M('failLabels',await labels());break;}
 const b=await ev(()=>{const b=__worldIntegration.board();return b&&b.snapshot&&b.snapshot.active?b.snapshot.active.stageId:null});if(b&&s==='level'){M('board',b);tLevel=Date.now();break;}if(s==='level-loading'&&!ll){ll=1;M('llmark');}await sleep(80);}
await sleep(300);const SS=await stopSampler();const smp=SS.smp||[];fs.writeFileSync(OUT+'/'+tag+'_journey_samples.json',JSON.stringify(smp));
if(CAP&&SS.cap){const d=OUT+'/'+tag+'_cap';fs.mkdirSync(d,{recursive:true});const idx=[];SS.cap.forEach((c,i)=>{fs.writeFileSync(d+'/c'+String(i).padStart(3,'0')+'.jpg',Buffer.from(c[4].split(',')[1],'base64'));idx.push([i,+c[0].toFixed(1),c[1],c[2],c[3]])});fs.writeFileSync(d+'/index.json',JSON.stringify(idx));M('capN',idx.length);}
M('entryFrames',await frStats(tStart));
// swap frame: first sample in state level (or LakesideBackgroundCamera / board camera present)
try{let k=smp.findIndex(x=>x[6]==='level');if(k>0){const dur=i=>+(smp[i][0]-smp[i-1][0]).toFixed(1);M('swapFrames',{k,durPrev:dur(k-1),durSwap:dur(k),durNext:k+1<smp.length?dur(k+1):null,next3:[k+1,k+2,k+3].filter(i=>i<smp.length).map(dur),camsPrev:smp[k-1][10],camsSwap:smp[k][10],sunPrev:smp[k-1][11],sunSwap:smp[k][11]});}}catch(e){M('swapErr',String(e))}
M('frJourney',await frStats(tStart));M('vis',await ev(()=>window.__vis));M('navEpoch',await ev(()=>window.__navEpoch));
if(mode==='fail'){M('end');return;}
await sleep(1200);M('popupsPre',await ev(()=>{const b=__worldIntegration.board()||{};return {popups:b.popups,keys:Object.keys((b.layout&&b.layout.targets)||{})}}));await shot('board_landed');
for(let k=0;k<4;k++){const g=await ev(()=>{const b=__worldIntegration.board()||{};if(!b.popups||!b.popups.length)return null;const t=(b.layout&&b.layout.targets)||{};const key=Object.keys(t).find(x=>/resume|continue|继续|gotit/i.test(x));return key?Object.assign({key},t[key]):{none:Object.keys(t)}});if(!g||g.none){M('popupNoResume',g);break;}await p.touchscreen.tap(g.x,g.y);M('dismissTap',g);await sleep(1500);}
M('popupsPost',await ev(()=>{const b=__worldIntegration.board()||{};return {popups:b.popups}}));
await shot('board');M('boardDiag',await ev(()=>JSON.stringify((__worldIntegration.board()||{}).background||null).slice(0,1500)));
M('lightBoard',await light());M('perfBoard',await perf(4000));
if(process.env.QUICK||REGION!=='lake'){M('end');return;}
await p.setViewportSize({width:360,height:640});await sleep(2500);M('perfBoard360',await perf(3000));
M('camsOff',await camsOff(true));await sleep(800);await shot('bgonly_360');M('perfBg',await perf(3000));
await camsOff(false);await p.setViewportSize(VP);await sleep(1500);
M('toggle1',await ev(()=>{__worldDayNight.toggle();return __worldDayNight.snapshot().mode}));await sleep(3000);await shot('board_toggled');M('lightToggled',await light());M('perfToggled',await perf(3000));
await p.setViewportSize({width:360,height:640});await sleep(1500);await camsOff(true);await sleep(800);await shot('bgonly_360_toggled');await camsOff(false);await p.setViewportSize(VP);await sleep(1200);
M('toggle2',await ev(()=>{__worldDayNight.toggle();return __worldDayNight.snapshot().mode}));await sleep(3000);M('lightBack',await light());
M('exitLevel',await ev(async()=>{const cc=await System.import('cc');const C=cc.js.getClassByName('WorldIntegrationBoot');const c=cc.director.getScene().getComponentsInChildren(C)[0];const r=await c.composition.worldCommands().exitLevel();return JSON.stringify(r)}));
await sleep(4000);M('afterExit',await st());M('afterExitLabels',(await labels()).slice(0,30));
const okHome=await tapNode('home');if(!okHome)M('returnHome',await ev(()=>JSON.stringify(__worldIntegration.returnHome())));
const b0=Date.now();while(Date.now()-b0<60000){const s=await st();if(s==='island')break;await sleep(300);}M('backState',await st());if(await st()==='home'){await sleep(6000);M('leave2',await ev(()=>__worldIntegration.leave()));await waitSt('island',90000);M('island3',await st());}await sleep(4000);await shot('island_after');M('lightIslandAfter',await light());
M('end');
}catch(e){M('FAIL',String(e).slice(0,300));scriptErr.push(String(e).slice(0,300));}finally{
try{const r=await p.evaluate(async()=>{const b64=await window.__rec.stop();return {b64,rec:window.__rec.recorderStartEpoch,first:window.__rec.firstSoundEpoch,running:window.__rec.runningEpoch}});fs.writeFileSync(OUT+'/'+tag+'.audio.webm',Buffer.from(r.b64,'base64'));M('audioEpochs',{rec:r.rec,first:r.first,running:r.running});}catch(e){M('audioFail',String(e).slice(0,200))}
fs.writeFileSync(OUT+'/'+tag+'.json',JSON.stringify({marks,errors,net,failed,ok200,scriptErr},null,0));fs.writeFileSync(OUT+'/'+tag+'_worldFlowLog.txt',logs.map(l=>l.join('\t')).join('\n'));
let vp=null;try{vp=await p.video().path()}catch{}
try{await ctx.close()}catch{}
try{const d=OUT+'/tmp-'+tag;if(vp&&fs.existsSync(vp))fs.renameSync(vp,OUT+'/'+tag+'.webm');fs.rmSync(d,{recursive:true,force:true})}catch{}process.exit(0);}
})();
