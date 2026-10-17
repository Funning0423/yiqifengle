const {chromium}=require('/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/cursor-worktree/tools/qf-env.cjs').playwright();
(async()=>{const b=await chromium.launch({executablePath:process.env.QF_CHROMIUM_EXECUTABLE});const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});const p=await ctx.newPage();await p.addInitScript(()=>{globalThis.__worldFlowLog=true;});
const t0=Date.now();const T=()=>((Date.now()-t0)/1000).toFixed(2);const st=()=>p.evaluate(()=>{try{const s=__worldIntegration.snapshot();return s.state+'/'+s.needsResume}catch(e){return 'NA'}}).catch(()=>'NA');
await p.goto('http://127.0.0.1:8899/');while(!(await st()).startsWith('home'))await p.waitForTimeout(250);await p.waitForTimeout(5000);
const vis=h=>p.evaluate(h=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>h});document.dispatchEvent(new Event('visibilitychange'))},h);
console.log(T(),'hide',await st());await vis(true);await p.waitForTimeout(4000);await vis(false);await p.waitForTimeout(1500);console.log(T(),'afterShow',await st(),'sign',JSON.stringify(await p.evaluate(()=>__worldIntegration.glassSign().visible)));
await p.screenshot({path:'raw/cont_paused.png'});await p.touchscreen.tap(195,725);await p.waitForTimeout(1500);console.log(T(),'afterTapContinue',await st(),'sign',JSON.stringify(await p.evaluate(()=>__worldIntegration.glassSign().visible)));await p.screenshot({path:'raw/cont_resumed.png'});
const g=await p.evaluate(()=>__worldIntegration.glassSign());if(g.box){const d=2,bx=g.box;await p.touchscreen.tap((bx.l+bx.r)/2/d,844-((bx.t+bx.b)/2)/d);await p.waitForTimeout(2000);console.log(T(),'afterSignTap',await st());}
await b.close();})();
