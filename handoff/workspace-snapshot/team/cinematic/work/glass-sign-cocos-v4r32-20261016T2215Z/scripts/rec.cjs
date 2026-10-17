// node rec.cjs <port> <W> <H> <out.png> : DPR2 home still; logs glass sign diagnostics
const {chromium}=require('/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright');const fs=require('fs');
const [port,W,H,out]=[process.argv[2],+process.argv[3],+process.argv[4],process.argv[5]];
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/home/box/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell'});
const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,timezoneId:'Asia/Shanghai'});const p=await ctx.newPage();
p.on('console',m=>{if(/GLASS|error/i.test(m.text()))console.log('CONSOLE',m.text().slice(0,300));});p.on('pageerror',e=>console.log('ERR',String(e).slice(0,300)));
await p.goto(`http://127.0.0.1:${port}/?testNamespace=glass${Date.now()}`,{waitUntil:'commit'});
await p.waitForFunction(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false;}catch{return false;}},{},{timeout:900000,polling:1000});
await p.waitForTimeout(25000);
await p.evaluate(async()=>{const cc=await System.import('cc');const op=n=>{(n.getComponent(cc.UIOpacity)||n.addComponent(cc.UIOpacity)).opacity=0;};
 const f=n=>{const l=n.getComponent(cc.Label);if(l&&/测试包|地区流程测试/.test(l.string)){let t=n;while(t.parent&&t.parent.getComponent(cc.UITransform)&&t.parent.children.length<=3&&t.parent.name!=='WorldNavigationCanvas')t=t.parent;op(t);}
 if(n.name==='RoomLookGuide')op(n);n.children.forEach(f);};f(cc.director.getScene());});
await p.waitForTimeout(1500);
const diag=await p.evaluate(()=>({g:__worldIntegration.glassSign?__worldIntegration.glassSign():null,cw:document.querySelector('canvas').width,ch:document.querySelector('canvas').height}));
await p.screenshot({path:out,timeout:300000});fs.writeFileSync(out.replace('.png','.json'),JSON.stringify(diag));console.log(JSON.stringify(diag));
if(process.env.TAP&&diag.g&&diag.g.box){const bx=diag.g.box,s=diag.cw/W;await p.mouse.click((bx.l+bx.r)/2/s,H-(bx.t+bx.b)/2/s);await p.waitForTimeout(400);await p.screenshot({path:out.replace('.png','_tap.png')});await p.waitForTimeout(4000);console.log('after tap',JSON.stringify(await p.evaluate(()=>({st:__worldIntegration.snapshot().state,g:__worldIntegration.glassSign()}))));}
await b.close();})().catch(e=>{console.log('FATAL',String(e).slice(0,400));process.exit(1)});
