// node run-measure.cjs <web根URL> <mode> <cpuThrottle>  → 打印 window.__snow；需要 playwright-core + chrome
const {chromium}=require('/workspace/tmp-exp/node_modules/playwright-core');const fs=require('fs'),path=require('path');
const [,,base,mode,thr,il]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-precise-memory-info','--js-flags=--expose-gc']});
const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
// 先把 expand.js+instproto.js 拼成 <web根>/inst/instproto.js，经 index.js 的 ?inj= 注入
p.on('console',m=>{if(/\[inst\]|error/i.test(m.text()))console.log('C',m.text().slice(0,600));});
const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:+thr||1});
await p.goto(base+'/index.html?snowshot=1&inj=inst/instproto.js&mode='+mode+(il?'&il=1':''),{timeout:120000});await p.waitForFunction(()=>window.__snow&&window.__snow.ready,null,{timeout:300000,polling:500});
console.log('RESULT',thr,mode,JSON.stringify(await p.evaluate(()=>{const s=Object.assign({},window.__snow);delete s.log;return s;})));await b.close();})();
