const {chromium}=require('playwright');const D={p750:[375,812],iphone15pro:[393,852],iphonese:[375,667],android360:[360,800],android412:[412,915]};
(async()=>{for(const [k,[w,h]] of Object.entries(D)){const b=await chromium.launch({channel:'chromium'});const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:2});
await p.goto('http://127.0.0.1:8781/?testNamespace=load'+Date.now(),{waitUntil:'commit'});await p.waitForTimeout(1800);
try{await p.screenshot({path:`/workspace/wechat-game/ui-audit/2026-10-15/raw/${k}-01-loading.png`});console.log('ok',k);}catch(e){console.log('fail',k,e.message.slice(0,80));}await b.close();}})();
