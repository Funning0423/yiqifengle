const {chromium}=require('/workspace/tmp-exp/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const qs of process.argv.slice(2)){const p=await b.newPage({viewport:{width:390,height:750}});let ne=0;p.on('pageerror',e=>{if(ne++<3)console.log('ERR',String(e.stack).slice(0,900));});p.on('console',m=>{if(/error|warn/i.test(m.type())&&ne<6){ne++;console.log('CON',m.text().slice(0,300));}});
await p.goto('http://127.0.0.1:8765/index.html?snowshot=1&inj=churn_repro.js&'+qs);await p.waitForFunction('window.__churn&&window.__churn.done',null,{timeout:+(process.env.TO||120000)}).catch(e=>console.log('TIMEOUT',qs));
await p.screenshot({path:'shot_'+qs.replace(/[^a-z0-9]/gi,'_')+'.png'});console.log(qs,JSON.stringify(await p.evaluate('window.__churn&&window.__churn.out')));await p.close();}
await b.close();})();
