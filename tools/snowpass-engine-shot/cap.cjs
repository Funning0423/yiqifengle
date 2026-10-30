const {chromium}=require('playwright-core');
const [,,url,out,W,H]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:+W||390,height:+H||844},deviceScaleFactor:1});const p=await ctx.newPage();
p.on('console',m=>console.log('C',m.type(),m.text().slice(0,300)));p.on('pageerror',e=>console.log('PE',String(e).slice(0,300)));
await p.goto(url,{timeout:120000});await p.waitForFunction(()=>window.__snow&&window.__snow.ready,null,{timeout:180000,polling:500});
await p.waitForTimeout(3000);const st=await p.evaluate(()=>window.__snow);require('fs').writeFileSync(out+'.json',JSON.stringify(st,null,1));
await (await p.$('canvas')).screenshot({path:out});await b.close();})();
