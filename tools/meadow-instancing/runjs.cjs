// node runjs.cjs <base> <inj.js> <out.json>：无头 chrome 跑注入脚本，等 __snow.ready，导出 __snow
const {chromium}=require('/workspace/tmp-exp/node_modules/playwright-core');const fs=require('fs');const [,,base,inj,out]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto(`${base}/index.html?snowshot=1&inj=${inj}`,{timeout:120000});await p.waitForFunction(()=>window.__snow&&window.__snow.ready,null,{timeout:400000,polling:500});
fs.writeFileSync(out,JSON.stringify(await p.evaluate(()=>window.__snow)));await b.close();})();
