const {chromium}=require('/workspace/tmp-exp/node_modules/playwright-core');const fs=require('fs');const [,,base,out,only]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();p.on('console',m=>{if(/\[g3\]/.test(m.text()))console.log(m.text().slice(0,400));});
await p.goto(base+'/index.html?snowshot=1&inj=inst/gate3.js'+(only?'&only='+only:''),{timeout:120000});await p.waitForFunction(()=>window.__snow&&window.__snow.ready,null,{timeout:600000,polling:500});
fs.writeFileSync(out,JSON.stringify(await p.evaluate(()=>window.__snow),null,1));await b.close();})();
