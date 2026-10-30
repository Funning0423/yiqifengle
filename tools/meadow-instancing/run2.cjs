// node run2.cjs <base> <cam> <swap> <out.png> [cpuRate]
const {chromium}=require('/workspace/tmp-exp/node_modules/playwright-core');const fs=require('fs');
const [,,base,cam,swap,out,thr]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1})).newPage();p.on('console',m=>{if(/\[i2\]/.test(m.text()))console.log(m.text().slice(0,300));});
const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:+thr||1});
await p.goto(`${base}/index.html?snowshot=1&inj=inst/inst2shot.js&cam=${cam}&swap=${swap}`,{timeout:120000});
if(swap==='3'){await p.waitForFunction(()=>window.__snow&&window.__snow.phase==='A',null,{timeout:400000,polling:300});await (await p.$('canvas')).screenshot({path:out.replace('.png','_A.png')});await p.evaluate(()=>window.__next());}
await p.waitForFunction(()=>window.__snow&&window.__snow.ready,null,{timeout:400000,polling:500});
const st=await p.evaluate(()=>window.__snow);fs.writeFileSync(out+'.json',JSON.stringify(st,null,1));await (await p.$('canvas')).screenshot({path:out});await b.close();})();
