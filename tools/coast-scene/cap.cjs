// node cap.cjs <url> <out.png|outdir/> W H [frames fps]   frames>1 -> outdir/f_0000.png ... (deterministic setT per frame)
const {chromium}=require('playwright-core');const fs=require('fs');
const [,,url,out,W,H,FR,FPS]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:+W||390,height:+H||844},deviceScaleFactor:1});const p=await ctx.newPage();
p.on('console',m=>{const t=m.text();if(/coast|ERR|rror/.test(t))console.log('C',t.slice(0,300));});p.on('pageerror',e=>console.log('PE',String(e).slice(0,300)));
await p.goto(url,{timeout:120000});await p.waitForFunction(()=>window.__coast&&window.__coast.ready,null,{timeout:240000,polling:500});await p.waitForTimeout(1500);
const c=await p.$('canvas');const n=+FR||1,fps=+FPS||15;
if(n===1){await c.screenshot({path:out});}else{fs.mkdirSync(out,{recursive:true});for(let i=0;i<n;i++){await p.evaluate(t=>window.__coast.setT(t),i/fps);await p.waitForTimeout(120);await c.screenshot({path:out+'/f_'+String(i).padStart(4,'0')+'.png'});}}
fs.writeFileSync((n===1?out:out+'/log')+'.json',JSON.stringify(await p.evaluate(()=>window.__coast.log),null,1));await b.close();})();
