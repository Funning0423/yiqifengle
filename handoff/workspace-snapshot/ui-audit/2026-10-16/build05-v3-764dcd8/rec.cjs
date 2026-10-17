'use strict';
// usage: node rec.cjs <build:before|after|sail> <item> <day|night> <p750|se>
const fs=require('fs'),path=require('path');
const {chromium}=require('/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/cursor-worktree/tools/qf-env.cjs').playwright();
const [build,item,mode,size]=process.argv.slice(2);
const PORT={before:8801,after:8802,sail:8803,b05:8821,b05orig:8822,v3:8831}[build],BASE=`http://127.0.0.1:${PORT}/`;
const VP=size==='se'?{width:375,height:667}:{width:375,height:812};
const OUT=path.join(__dirname,'raw');fs.mkdirSync(OUT,{recursive:true});
const tag=`${item}_${build}_${mode}_${size}`;
const marks=[],checks={},errors=[];let t0=0;const M=k=>{marks.push([k,+((Date.now()-t0)/1000).toFixed(2)]);console.log(tag,k);};
/* 录屏方法修正 2026-10-16：audio-init.js 的 startEpoch 记在页面加载时，但 AudioContext 要等第一次点击才出数据，r4 音频因此比画面晚约 2.07s。
   音画对齐不要用 audioStartMs：优先用 [sailboat] sting start 日志和音轨里对应起音互相关，或用音轨第一个非静音块（audioFirstSoundMs/audioRunningMs 只作参考）。详见 team/voice-bot/outbox/20261016T0431Z-r4-sail-sfx-cut/ */
(async()=>{
const b=await chromium.launch({executablePath:process.env.QF_CHROMIUM_EXECUTABLE,args:['--autoplay-policy=no-user-gesture-required']});
const TZ=(()=>{const want=mode==='day'?12:23;const u=new Date().getUTCHours();let off=((want-u)%24+24)%24;if(off>12)off-=24;if(off<-12)off+=24;return off===0?'Etc/GMT':'Etc/GMT'+(off>0?'-':'+')+Math.abs(off);})();checks.tz=TZ;
const ctx=await b.newContext({viewport:VP,deviceScaleFactor:2,hasTouch:true,timezoneId:TZ,recordVideo:{dir:OUT+'/tmp-'+tag,size:{width:750,height:VP.height*2}}});
const p=await ctx.newPage();if(process.env.AUDIO)await p.addInitScript({path:__dirname+'/audio-init.js'});await p.addInitScript({path:__dirname+'/raf-init.js'});t0=Date.now();checks.net=[];const nb=u=>/\/assets\/[^/]+\/(config|index)[^/]*\.(json|js)/.test(u);p.on('request',r=>{if(nb(r.url()))checks.net.push([+((Date.now()-t0)/1000).toFixed(3),'req',r.url().replace(/^https?:\/\/[^/]+/,'')])});p.on('requestfinished',async r=>{if(nb(r.url())){const rs=await r.response().catch(()=>null);checks.net.push([+((Date.now()-t0)/1000).toFixed(3),'done',r.url().replace(/^https?:\/\/[^/]+/,''),rs?rs.status():0])}});p.on('requestfailed',r=>{if(nb(r.url()))checks.net.push([+((Date.now()-t0)/1000).toFixed(3),'FAIL',r.url()])});let FATAL=null;p.on('pageerror',e=>{errors.push(String(e).slice(0,300));if(/at most one Component|CCClass/.test(String(e)))FATAL=String(e).slice(0,200);});checks.logs=[];p.on('console',m=>{const t=m.text();if(/\[sailboat\]|\[meadow-preload\]|shared_effects|shared-effects/.test(t))checks.logs.push([+((Date.now()-t0)/1000).toFixed(3),m.type(),t.slice(0,400)]);if(m.type()==='error'||/sailboat/.test(t))errors.push(m.type()+': '+t.slice(0,200));if(/World startup failed|at most one Component/.test(t))FATAL=FATAL||t.slice(0,200);});
const sleep=ms=>p.waitForTimeout(ms);
const snap=()=>p.evaluate(()=>{try{return __worldIntegration.snapshot()}catch{return null}});
const waitState=async(s,to=180000)=>p.waitForFunction(s=>{try{return __worldIntegration.snapshot().state===s}catch{return false}},s,{timeout:to});
const nodes=(spec={})=>p.evaluate(async({popup,name,text})=>{const {director,UITransform,Label}=await System.import('cc');const W=innerWidth,H=innerHeight,out=[];
 const visit=(n,inP)=>{if(!n.activeInHierarchy)return;const here=inP||(!popup||n.name===popup);if(here){const t=n.getComponent(UITransform);if(t){const label=n.getComponentsInChildren(Label).map(l=>l.string).filter(Boolean).join('|');if((!name||n.name===name)&&(!text||label.includes(text))){const bb=t.getBoundingBoxToWorld();out.push({name:n.name,label:label.slice(0,80),x:bb.x+W/2,y:H/2-bb.y-bb.height,width:bb.width,height:bb.height,cx:bb.x+bb.width/2+W/2,cy:H/2-bb.y-bb.height/2});}}}for(const c of n.children)visit(c,here);};
 visit(director.getScene(),false);return out;},spec);
const tapNode=async(spec,to=30000)=>{const s=Date.now();let h=[];while(Date.now()-s<to){h=await nodes(spec);if(h.length)break;await sleep(200);}if(!h.length)throw Error('node not found '+JSON.stringify(spec));const n=h[h.length-1];await p.touchscreen.tap(n.cx,n.cy);return n;};
const board=()=>p.evaluate(()=>{try{return __worldIntegration.board()}catch{return null}});
const popups=async()=>((await board())?.popups)||[];
const nav=async(key,to=60000)=>{const s=Date.now();let prev=null;for(;;){const r=await p.evaluate(k=>{try{const r=__worldIntegration.layout().targetRects[k];return r&&r.width>0?r:null}catch{return null}},key);if(r&&prev&&Math.abs(r.x-prev.x)<.5&&Math.abs(r.y-prev.y)<.5)break;prev=r;if(Date.now()-s>to)throw Error('nav '+key);await sleep(150);}const q=await p.evaluate(k=>__worldIntegration.layout().targets[k],key);await p.touchscreen.tap(q.x,q.y);};
const textScan=async()=>{const all=await nodes({});return [...new Set(all.map(n=>n.label).filter(l=>/测试|test|Test|调试|debug|进度/.test(l)).flatMap(l=>l.split('|')).filter(l=>/测试|test|Test|调试|debug|进度/.test(l)))];};
const cdp=await ctx.newCDPSession(p);
const shot=async n=>{try{await p.screenshot({path:OUT+'/'+tag+'_'+n+'.png'})}catch{}};
const tri=async()=>{const pts=[[120,400],[190,420],[260,400]].map(([x,y],i)=>({x,y,id:i+1}));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pts});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
const triDouble=async()=>{await tri();await sleep(150);await tri();};
const ready=async()=>{const s0=Date.now();for(;;){const ok=await p.evaluate(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false}catch{return false}}).catch(()=>false);if(ok)return;if(FATAL){await sleep(2500);throw Error('STARTUP FATAL: '+FATAL);}if(Date.now()-s0>90000)throw Error('startup timeout 90s');await sleep(200);}};
const ns='task21-web-qa-'+Date.now();
const open=async(q='')=>{await p.goto(BASE+q,{waitUntil:'commit'});M('goto');await ready();M('home');};
const dismissTut=async()=>{const T={ToolIntroPanel:'GotIt',RuleGuidePanel:'GotIt'};for(let i=0;i<6;i++){await sleep(600);const pp=await popups();const top=pp.find(x=>T[x]);if(!top)break;checks.tutorials=(checks.tutorials||[]).concat(top);await tapNode({popup:top,name:T[top]});}};
const resume=async()=>{await dismissTut();const s=(await board())?.snapshot?.state;if(s==='run.paused'){await tapNode({popup:'PausePanel',name:'Resume'});}await p.waitForFunction(()=>{const b=__worldIntegration.board();return b&&b.snapshot.state==='run.ready'},{},{timeout:60000});await dismissTut();};
// enter checkpoint N "last step" using the build's own test entry
const enterLast=async(n)=>{
 if(build==='after'){await p.keyboard.press('Control+Shift+D');await sleep(800);await tapNode({name:'DebugJump',text:'主线'+String(n).padStart(2,'0')+'末步'});}
 else{await nav('flowTests');await nav('flowTest'+n);}
 await p.waitForFunction(n=>{const b=__worldIntegration.board();return b&&b.snapshot.active?.stageId==='mainline-'+String(n).padStart(2,'0')&&['run.paused','run.ready'].includes(b.snapshot.state)},n,{timeout:180000});M('board');};
const finalSwap=async()=>{const t=await p.evaluate(async()=>{if(__worldIntegration.regionFlowTest)return __worldIntegration.regionFlowTest();const cc=window.cc||await System.import('cc');const C=cc.js.getClassByName('WorldIntegrationBoot');const c=cc.director.getScene().getComponentsInChildren(C)[0];return c.composition.regionFlowTestStatus();});const a=t.lastAction;const L=(await board()).layout.tiles;await p.touchscreen.tap(L[a[1]].x,L[a[1]].y);await p.touchscreen.tap(L[a[2]].x,L[a[2]].y);await p.waitForFunction(()=>{const b=__worldIntegration.board();return b.snapshot.state==='result.saved'&&b.popups.includes('ResultPanel')},{},{timeout:60000});M('result');};
const q=build==='after'?'':'?testNamespace='+ns;
try{
 if(item==='01'||item==='05'){await open(q);await sleep(3000);M('end');checks.textScan=await textScan();}
 else if(item==='02'){await open(q);await p.evaluate(()=>__worldIntegration.leave());await waitState('island');M('island');await sleep(3000);M('watchStart');await sleep(12000);M('end');checks.textScan=await textScan();checks.props=await p.evaluate(()=>{try{return __worldIntegration.props()}catch{return null}});}
 else if(item==='03'){await open(q);await sleep(1000);M('triDouble1');await triDouble();await sleep(1500);checks.panelAfterTri1=(await nodes({name:'DebugJumpPanel'})).length;
   if(build==='after'){if(!checks.panelAfterTri1){await p.keyboard.press('Control+Shift+D');await sleep(1200);M('keyFallbackOpen');}checks.btns=(await nodes({name:'DebugJump'})).map(n=>[n.label,Math.round(n.width),Math.round(n.height)]);await tapNode({name:'DebugJump',text:'草甸'});await sleep(800);M('pickMeadow');await tapNode({name:'DebugJump',text:'草甸01'});M('jump');
     await p.waitForFunction(()=>{const b=__worldIntegration.board();return b&&b.snapshot.active?.stageId==='r05-meadow-01'},{},{timeout:180000});M('arrived');checks.arrivedStage=(await board()).snapshot.active.stageId;await sleep(2500);
     await triDouble();await sleep(800);checks.triOnBoard=(await nodes({name:'DebugJumpPanel'})).length;if(!checks.triOnBoard){await p.keyboard.press('Control+Shift+D');await sleep(800);}await tapNode({name:'DebugJump',text:'主页'});await waitState('home');M('backHome');await sleep(1500);
     await triDouble();await sleep(1200);checks.reopen=(await nodes({name:'DebugJumpPanel'})).length;M('reopened');await sleep(500);await triDouble();await sleep(1200);checks.closedAfterTri=(await nodes({name:'DebugJumpPanel'})).length;M('closedByTri');
     await p.keyboard.press('Control+Shift+D');await sleep(1200);checks.keyOpen=(await nodes({name:'DebugJumpPanel'})).length;M('keyOpen');await p.keyboard.press('Control+Shift+D');await sleep(1200);checks.keyClose=(await nodes({name:'DebugJumpPanel'})).length;M('keyClose');}
   else{await sleep(3000);await p.keyboard.press('Control+Shift+D');await sleep(1500);M('keyTried');}
   await sleep(1000);M('end');}
 else if(item==='04'){await open(q);await enterLast(4);await resume();await sleep(500);M('swap');await finalSwap();await sleep(2500);
   checks.result=(await nodes({popup:'ResultPanel'})).filter(n=>/Claim|chest|Next|Home|Score|ResultStars|PopupPanel/.test(n.name)).map(n=>[n.name,n.label,Math.round(n.x),Math.round(n.y),Math.round(n.width),Math.round(n.height)]);
   if(build==='after'){await tapNode({popup:'ResultPanel',name:'ClaimAll'});}else{await tapNode({popup:'ResultPanel',name:'Claim-chest'});}
   M('claim');await sleep(3000);checks.rewardPanels=(await popups()).filter(x=>x==='RewardPanel').length;checks.reward=(await nodes({popup:'RewardPanel'})).filter(n=>/Gain|Accept|ResultChest3D/.test(n.name)).map(n=>[n.name,n.label,Math.round(n.x),Math.round(n.y),Math.round(n.width),Math.round(n.height)]);
   await tapNode({popup:'RewardPanel',name:'Accept'});M('accept');await sleep(2500);checks.popupsAfter=await popups();
   checks.claimLeft=(await nodes({popup:'ResultPanel'})).filter(n=>/^Claim/.test(n.name)).map(n=>n.name);M('end');}
 else if(item==='06'||item==='08'){await open(q);await p.evaluate(()=>__worldIntegration.leave());await waitState('island');await sleep(3500);await tapNode({name:'Island-settings'});await sleep(1500);M('settings');
   const S=async()=>(await snap())?.mode;checks.mode0=await p.evaluate(()=>{try{return __worldIntegration.navigationStatus?.()}catch{return null}});
   if(item==='06'){const tgt=mode==='day'?'Night':'Day',back=mode==='day'?'Day':'Night';checks.popBefore=await popups();await tapNode({name:tgt});M('toggle1');checks.popTrace=[];for(let i=0;i<20;i++){checks.popTrace.push([i*100,(await popups()).join('|'),(await nodes({name:tgt})).length]);await sleep(100);}await sleep(1500);checks.night1=await p.evaluate(()=>{try{return __worldIntegration.props?.().night}catch{return null}});if(!(await nodes({name:back})).length){await tapNode({name:'Island-settings'});await sleep(1200);M('reopen');}await tapNode({name:back});M('toggle2');await sleep(2500);}
   else{for(const nm of [mode==='day'?'Night':'Day',mode==='day'?'Day':'Night']){const n=(await nodes({name:nm})).pop();const y=n.cy+ (n.height/2)-4;checks['rect_'+nm]=[Math.round(n.x),Math.round(n.y),Math.round(n.width),Math.round(n.height)];
     // edge tap: 10pt below the visual (visual ~62 design ≈ 32 css → half 16), i.e. cy+16+10 clipped inside node hit
     await p.touchscreen.tap(n.cx-n.width/2+6,n.cy+Math.min(n.height/2-2,26));M('edgeTap_'+nm);await sleep(1800);}}
   M('end');}
 else if(item==='07'){await open(q);await sleep(1000);M('leave');await p.evaluate(()=>__worldIntegration.leave());await waitState('island');M('island');await sleep(6000);M('end');}
 else if(item==='09'){await open(q);await enterLast(4);await resume();await sleep(800);const pz=(await board()).layout.pause;await p.touchscreen.tap(pz.x,pz.y);await sleep(600);M('pause');await sleep(3000);
   checks.pause=(await nodes({popup:'PausePanel'})).filter(n=>/Tile|Resume|Home|Toggle|Sfx|Music|PauseLine/.test(n.name)).map(n=>[n.name,n.label,Math.round(n.x),Math.round(n.y),Math.round(n.width),Math.round(n.height)]);
   await tapNode({popup:'PausePanel',name:'Tile-settings'}).catch(e=>checks.tileErr=String(e));await sleep(1500);M('settings');checks.settings=(await nodes({})).filter(n=>/MusicVolume|SfxToggle/.test(n.name)).map(n=>n.name);await sleep(1500);M('end');}
 else if(item==='10'){await open(q);await sleep(1000);M('watchStart');await sleep(15000);M('end');}
 else if(item==='11'){await open(q);await enterLast(4);M('entry1');const resumeIfPaused=async()=>{if((await popups()).includes('PausePanel'))await tapNode({popup:'PausePanel',name:'Resume'});};await sleep(800);await resumeIfPaused();M('resumed1');await sleep(1500);checks.entry1=await popups();await sleep(5000);checks.entry1b=await popups();await dismissTut();
   if(!(await popups()).includes('PausePanel')){const pz=(await board()).layout.pause;await p.touchscreen.tap(pz.x,pz.y);await sleep(800);}
   await tapNode({popup:'PausePanel',name:'Home'});await waitState('island');M('island');await sleep(2500);await nav('mainline');
   await p.waitForFunction(()=>{const b=__worldIntegration.board();return b&&b.snapshot.active?.stageId==='mainline-04'&&__worldIntegration.snapshot().state==='level'},{},{timeout:120000});M('entry2');await sleep(800);await resumeIfPaused();M('resumed2');await sleep(1500);checks.entry2=await popups();await sleep(5000);checks.entry2b=await popups();
   checks.bubbles=(await nodes({})).filter(n=>/Bubble|Hint|Toast|Tip/i.test(n.name)&&n.label).map(n=>[n.name,n.label]);M('end');
   checks.storage=await p.evaluate(()=>Object.keys(localStorage).filter(k=>/qfl\.ui/.test(k)));}
 else if(item==='17'){await open(q);await sleep(1500);M('triHome');await triDouble();await sleep(1500);checks.triHome=(await nodes({name:'DebugJumpPanel'})).length;if(!checks.triHome){await p.keyboard.press('Control+Shift+D');await sleep(1200);}await tapNode({name:'DebugJump',text:'草甸'});await sleep(800);await tapNode({name:'DebugJump',text:'草甸01'});M('jump');await p.waitForFunction(()=>{const b=__worldIntegration.board();return b&&b.snapshot.active?.stageId==='r05-meadow-01'},{},{timeout:180000});M('arrived');await sleep(2000);await resume();await sleep(1500);M('tutDismissed');checks.popsBefore=await popups();await triDouble();await sleep(1000);checks.triBoard=(await nodes({name:'DebugJumpPanel'})).length;if(!checks.triBoard){await p.keyboard.press('Control+Shift+D');await sleep(1000);}M('panel');await tapNode({name:'DebugJump',text:'主页'});M('tapHome');const t0=Date.now();checks.homeOk=await p.waitForFunction(()=>__worldIntegration.snapshot().state==='home',{},{timeout:30000}).then(()=>true).catch(()=>false);checks.homeMs=Date.now()-t0;M('afterHome');checks.stateAfter=await p.evaluate(()=>__worldIntegration.snapshot().state);checks.panelAfter=(await nodes({name:'DebugJumpPanel'})).length;await sleep(2000);M('end');}
 else if(item==='14'){await open(q);await enterLast(8);await resume();await sleep(500);M('watch');await sleep(10000);const pz=(await board()).layout.pause;await p.touchscreen.tap(pz.x,pz.y);await sleep(300);M('paused');await sleep(3000);await tapNode({popup:'PausePanel',name:'Resume'}).catch(e=>checks.resumeErr=String(e));M('resumed');await sleep(2500);M('end');checks.stage=(await board())?.snapshot?.active?.stageId;}
 else if(item==='15'){await open(q);await p.evaluate(()=>__worldIntegration.leave());await waitState('island');await sleep(3500);M('island');
   checks.rects=await p.evaluate(()=>{try{return __worldIntegration.layout().targetRects}catch(e){return String(e)}});await shot('island');
   const k=Object.keys(checks.rects||{}).find(k=>/bag|satchel|pack|inventory/i.test(k));checks.bagKey=k;if(k){const r=checks.rects[k];await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}await sleep(1500);M('bagPopup');checks.bagPopup=await popups();await shot('bag');
   checks.closeBtn=(await nodes({})).filter(n=>/Close/i.test(n.name)).map(n=>[n.name,Math.round(n.x),Math.round(n.y),Math.round(n.width),Math.round(n.height)]);
   await p.evaluate(()=>__worldIntegration.returnHome?.());await sleep(1500);await enterLast(4);await resume();await sleep(800);M('board2');await shot('board');checks.pauseBtn=(await board())?.layout?.pause;M('end');}
 else if(item==='16'){await open(q);await p.evaluate(()=>__worldIntegration.leave());await waitState('island');await sleep(3500);M('island');
   const drag=async(y0,y1)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:187,y:y0,id:1}]});for(let i=1;i<=30;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:187,y:y0+(y1-y0)*i/30,id:1}]});await sleep(50);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
   for(let r=0;r<3;r++){M('pull'+r);await drag(250,650);await sleep(1500);await shot('pull'+r);}
   M('pinch');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:400,id:1},{x:205,y:400,id:2}]});for(let i=1;i<=30;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:170-4*i,y:400,id:1},{x:205+4*i,y:400,id:2}]});await sleep(50);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(2000);await shot('pinch');
   M('release');await drag(650,250);await sleep(2500);M('end');}
 else if(item==='24'||item==='25'){await open('?testNamespace='+ns);
   const adv=()=>p.evaluate(async()=>{const cc=window.cc||await System.import('cc');const {js,director}=cc;const C=js.getClassByName('WorldIntegrationBoot');const c=director.getScene().getComponentsInChildren(C)[0];const r=await c.composition.advanceMainline();return JSON.stringify(r)});
   const leg=async(n,to)=>{await nav('flowTests');await nav('flowTest'+n);await p.waitForFunction(n=>{const b=__worldIntegration.board();return b&&b.snapshot.active?.stageId==='mainline-'+String(n).padStart(2,'0')&&['run.paused','run.ready'].includes(b.snapshot.state)},n,{timeout:180000});M('board'+n);await resume();await sleep(400);await finalSwap();M('result'+n);await sleep(1500);
     const pr=adv();const e=Date.now()+60000;while(Date.now()<e){const st=await p.evaluate(()=>__worldIntegration.snapshot().state);if(st==='region-travel')break;await p.waitForTimeout(20);}M('travelStart'+n);
     const e2=Date.now()+120000;while(Date.now()<e2){const st=await p.evaluate(()=>__worldIntegration.snapshot().state);if(st!=='region-travel')break;await p.waitForTimeout(20);}M('travelEnd'+n);checks['adv'+n]=await pr.catch(e=>String(e));
     await p.waitForFunction(to=>{const b=__worldIntegration.board();return b&&b.snapshot.active?.stageId==='mainline-'+to},to,{timeout:120000}).catch(()=>{});M('arrive'+to);await sleep(4000);M('arrived'+to+'+4s');};
   if(item==='24'){await leg(4,'05');M('end');}else
   await leg(8,'09');checks.night=await p.evaluate(()=>__worldIntegration.props?.()?.night);M('end');}
 else if(item==='22'||item==='23'){await open('?testNamespace='+ns);await nav('flowTests');await nav('flowTest8');M('enterTap');
   const sailInfo=()=>p.evaluate(async()=>{const {director}=await System.import('cc');let f=null;const v=n=>{if(f)return;if(n.name==='SailboatTransition'&&n.activeInHierarchy){f=n;return}n.children.forEach(v)};v(director.getScene());return !!f});
   const e=Date.now()+90000;while(Date.now()<e&&!(await sailInfo()))await p.waitForTimeout(20);M('sailStart');
   if(item==='23'){await p.waitForTimeout(1500);checks.sailBeforeTap=await sailInfo();await p.touchscreen.tap(187,500);M('skipTap');}
   const e2=Date.now()+30000;while(Date.now()<e2&&(await sailInfo()))await p.waitForTimeout(20);M('sailGone');
   await p.waitForFunction(()=>{const b=__worldIntegration.board();return b&&b.snapshot.active?.stageId==='mainline-08'},{},{timeout:180000});M('boardReady');checks.night=await p.evaluate(()=>__worldIntegration.props?.()?.night);await sleep(4000);M('audioTail');
   if(item==='22'){await resume();await sleep(500);M('swap');await finalSwap();M('resultOpen');await sleep(2500);await tapNode({popup:'ResultPanel',name:'Claim-chest'}).catch(async()=>{await tapNode({popup:'ResultPanel',name:'ClaimAll'})});M('chestOpen');await sleep(2500);checks.popupsEnd=await popups();}
   M('end');}
 else if(item==='12'||item==='13'){await open('?testNamespace='+ns);await nav('flowTests');await nav('flowTest8');M('enterTap');
   const sailInfo=()=>p.evaluate(async()=>{const {director}=await System.import('cc');let f=null;const v=n=>{if(f)return;if(n.name==='SailboatTransition'&&n.activeInHierarchy){f=n;return}n.children.forEach(v)};v(director.getScene());return f?{on:true}:{on:false,state:__worldIntegration.snapshot().state}});
   await p.waitForFunction(()=>__worldIntegration.snapshot().state!=='home',{},{timeout:60000});M('leftHome');
   const poll=async(to)=>{const e=Date.now()+to;while(Date.now()<e){if((await sailInfo()).on)return true;await p.waitForTimeout(30);}return false;};
   checks.sailSeen=await poll(60000);M('sailStart');
   if(item==='13'){const now=Date.now()-t0;const target=Math.max(30150,now+600);if(target>30900)checks.skipLate=target;await p.waitForTimeout(Math.max(0,target-(Date.now()-t0)));checks.sailBeforeTap=(await sailInfo()).on;await p.touchscreen.tap(187,500);M('skipTap');}
   const e2=Date.now()+30000;while(Date.now()<e2&&(await sailInfo()).on)await p.waitForTimeout(30);M('sailGone');
   await p.waitForFunction(()=>{const b=__worldIntegration.board();return b&&b.snapshot.active?.stageId==='mainline-08'},{},{timeout:180000});M('boardReady');await sleep(2000);M('end');}
}catch(e){M('ERROR '+String(e).slice(0,300));}
if(process.env.AUDIO){try{const b64=await p.evaluate(()=>window.__rec.stop());fs.writeFileSync(OUT+'/'+tag+'.audio.webm',Buffer.from(b64,'base64'));checks.audioStartMs=await p.evaluate(()=>window.__rec.startEpoch)-t0;checks.audioRunningMs=await p.evaluate(()=>window.__rec.runningEpoch||0)-t0;checks.audioFirstSoundMs=await p.evaluate(()=>window.__rec.firstSoundEpoch||0)-t0;checks.audioErr=await p.evaluate(()=>window.__rec.err);}catch(e){checks.audioSaveErr=String(e).slice(0,200)}}
try{checks.raf=await p.evaluate(()=>({epoch0:window.__raf.epoch0,t:window.__raf.t.map(x=>Math.round(x*10)/10)}));checks.raf.epoch0-=t0;}catch(e){checks.rafErr=String(e)}
const v=p.video();await ctx.close();await b.close();fs.renameSync(await v.path(),OUT+'/'+tag+'.webm');fs.rmSync(OUT+'/tmp-'+tag,{recursive:true,force:true});
fs.writeFileSync(OUT+'/'+tag+'.json',JSON.stringify({tag,marks,checks,errors},null,1));})();
