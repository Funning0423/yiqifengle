'use strict';
const path=require('node:path'),fs=require('node:fs'),H=require('/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/cursor-worktree/tools/task21-ui/harness.cjs'),F=require('/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/cursor-worktree/tools/task21-ui/flows.cjs');
const OUT='/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/cursor-worktree/output/ui-audit-transfer/raw';
const DEV={
 'p750':{w:375,h:812,safe:[44,34]},
 'iphone15pro':{w:393,h:852,safe:[59,34]},
 'iphonese':{w:375,h:667,safe:[20,0]},
 'android360':{w:360,h:800,safe:[24,0]},
 'android412':{w:412,h:915,safe:[28,16]},
};
const dev=process.argv[2],mode=process.argv[3]||'day',D=DEV[dev],tag=dev+'-'+mode;
const log=[];const L=(k,v)=>{log.push({k,v});console.log(k,JSON.stringify(v)?.slice(0,600));};
(async()=>{
 const {chromium}=require('/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/cursor-worktree/tools/qf-env.cjs').playwright();const ns='audit-'+tag+'-'+H.runId();
 const browser=await chromium.launch({executablePath:require('/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/cursor-worktree/tools/qf-env.cjs').chromiumExecutable()});const ctx=await browser.newContext({viewport:{width:D.w,height:D.h},deviceScaleFactor:Number(process.env.DSF||2),hasTouch:true});
 const page=await ctx.newPage();page.on('crash',()=>L('CRASH',1));page.on('close',()=>L('CLOSE',1));const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(([t,b])=>{const s=()=>{const r=document.documentElement;r.style.setProperty('--safe-top',t+'px');r.style.setProperty('--safe-bottom',b+'px');};if(document.documentElement)s();else document.addEventListener('DOMContentLoaded',s);},D.safe);
 const shot=async n=>{const f=path.join(OUT,tag+'-'+n+'.png');await page.screenshot({path:f});L('shot',f);};
 const step=async(n,fn)=>{try{await fn();}catch(e){L('FAIL '+n,String(e).slice(0,400));try{await shot(n+'-FAIL');}catch{}}};
 await page.goto(H.BASE+'?testNamespace='+ns,{waitUntil:'commit'});
 await page.waitForFunction(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false;}catch{return false;}},{},{timeout:240000});
 await page.waitForTimeout(1000);
 await step('island',async()=>{await F.leaveHome(page);await page.waitForTimeout(3500);L('targets',await page.evaluate(()=>__worldIntegration.layout().targets));});
 if(mode==='night')await step('night',async()=>{
   let r=await page.evaluate(()=>{const t=__worldIntegration.layout().targets;return t.cabin||t.rest||null;});
   const pts=r?[r]:[[0.61,0.40],[0.64,0.42],[0.58,0.39],[0.66,0.45],[0.60,0.43]].map(([a,b])=>({x:a*D.w,y:b*D.h}));let ok=false;
   for(const q of pts){await page.touchscreen.tap(q.x,q.y);await page.waitForTimeout(1500);if((await H.nodes(page,{name:'DayNight'})).length){ok=true;L('cabinTap',q);break;}const st=await page.evaluate(()=>__worldIntegration.snapshot().state);if(st!=='island'){await page.evaluate(()=>__worldIntegration.leave());await H.waitState(page,'island');await page.waitForTimeout(2500);}}
   if(!ok)throw Error('cabin not found');await shot('03b-rest-panel-day');await H.tapNode(page,{popup:'RestPanel',name:'DayNight'});await page.waitForTimeout(4000);});
 await step('island-shot',async()=>{await shot('03-island');});
 await step('bag',async()=>{await H.tapNode(page,{name:'Island-bag'});await page.waitForTimeout(1500);await shot('04-island-bag');await H.tapNode(page,{name:'Close'});await page.waitForTimeout(900);});
 await step('settings',async()=>{await H.tapNode(page,{name:'Island-settings'});await page.waitForTimeout(1500);await shot('05-settings');await H.tapNode(page,{name:'Close'});await page.waitForTimeout(900);});
 await step('journal',async()=>{await H.tapNode(page,{name:'Island-journal'});await page.waitForTimeout(1500);await shot('06-journal');await H.tapNode(page,{name:'Chapter-sky'});await page.waitForTimeout(1200);await shot('06b-chapter-sky');await H.tapNode(page,{name:'Close'});await page.waitForTimeout(600);try{await H.tapNode(page,{name:'Close'},3000);}catch{}await page.waitForTimeout(800);});
 await step('board',async()=>{await page.evaluate(()=>__worldIntegration.returnHome?.());await page.waitForTimeout(500);
   const st=await page.evaluate(()=>__worldIntegration.snapshot().state);if(st!=='home'){await page.goto(H.BASE+'?testNamespace='+ns,{waitUntil:'commit'});await page.waitForFunction(()=>{try{return __worldIntegration.snapshot().state==='home';}catch{return false;}},{},{timeout:240000});await page.waitForTimeout(1500);}
   await F.enterCheckpoint(page,4);await page.waitForTimeout(1500);await shot('07-board');
   L('boardLayout',await page.evaluate(()=>{const b=__worldIntegration.board();return {targets:b.layout.targets,pause:b.layout.pause};}));
   L('boardNodes',(await H.nodes(page,{})).filter(n=>n.label||/Tool|Plate|Pause|Goal|Move/.test(n.name)).map(n=>[n.name,n.label,Math.round(n.x),Math.round(n.y),Math.round(n.width),Math.round(n.height)]));
   const p=(await H.board(page)).layout.pause;if(p){await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(1200);await shot('08-pause');await H.tapNode(page,{popup:'PausePanel',name:'Resume'});await page.waitForTimeout(1200);}});
 await step('result',async()=>{await F.finalSwap(page);await page.waitForTimeout(2500);await shot('09-result');
   L('resultNodes',(await H.nodes(page,{popup:'ResultPanel'})).map(n=>[n.name,n.label,Math.round(n.x),Math.round(n.y),Math.round(n.width),Math.round(n.height)]));
   await H.tapNode(page,{popup:'ResultPanel',name:'Claim-chest'});await page.waitForTimeout(2500);await shot('10-chest-reward');
   L('rewardNodes',(await H.nodes(page,{popup:'RewardPanel'})).map(n=>[n.name,n.label,Math.round(n.x),Math.round(n.y),Math.round(n.width),Math.round(n.height)]));
   await H.tapNode(page,{popup:'RewardPanel',name:'Accept'});await page.waitForTimeout(1500);await shot('11-result-after-claim');});
 await step('skycity',async()=>{await H.tapNode(page,{popup:'ResultPanel',name:'Home'});await H.waitState(page,'island');await page.waitForTimeout(1500);
   await H.tapNode(page,{name:'Island-journal'});await H.tapNode(page,{name:'Chapter-sky'});await H.tapNode(page,{popup:'ChapterPanel',name:'VisitSkycity'});await H.waitState(page,'skycity',180000);await page.waitForTimeout(4000);await shot('12-skycity');
   L('skyTargets',await page.evaluate(()=>__worldIntegration.layout().targets));});
 fs.writeFileSync(path.join(OUT,tag+'-log.json'),JSON.stringify({dev,D,mode,log,errors},null,1));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
