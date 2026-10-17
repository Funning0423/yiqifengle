// usage: node run.cjs <mode before|after|shot> <w> <h> <tag> [caption]
const {chromium}=require('/workspace/wechat-game/yiqifengle/node_modules/playwright');
const H=require('/workspace/wechat-game/yiqifengle/tools/task21-ui/harness.cjs');
const fs=require('fs');const [mode,W,Hh,tag,caption]=[process.argv[2],+process.argv[3],+process.argv[4],process.argv[5],process.argv[6]||''];
const OUT='/tmp/wte/rec/'+tag;fs.mkdirSync(OUT,{recursive:true});const T0=Date.now();const marks=[];const M=k=>{const t=(Date.now()-T0)/1000;marks.push([k,t]);console.log(k,t);};
(async()=>{const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:W,height:Hh},deviceScaleFactor:2,hasTouch:false,...(mode!=='shot'?{recordVideo:{dir:OUT,size:{width:W*2,height:Hh*2}}}:{})});
const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',String(e).slice(0,200)));
await p.goto('http://127.0.0.1:18790/?testNamespace=wte-'+tag+Date.now(),{waitUntil:'commit'});
await p.waitForFunction(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false;}catch{return false;}},{},{timeout:900000,polling:1000});
await p.waitForTimeout(7000);M('home');await p.screenshot({path:OUT+'/01-home.png'});
const cdp=await ctx.newCDPSession(p);const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
if(mode==='before'){
 let found=[];for(let i=0;i<6&&!found.length;i++){M('drag'+i);await p.mouse.move(W*0.8,Hh*0.55);await p.mouse.down();for(let k=1;k<=12;k++){await p.mouse.move(W*0.8-k*W*0.05,Hh*0.55);await p.waitForTimeout(30);}await p.mouse.up();await p.waitForTimeout(700);
  found=(await H.nodes(p,{name:'DoorHandleInvitation'})).filter(n=>n.cx>0);}
 M('door');await p.screenshot({path:OUT+'/02-door.png'});console.log('doorNode',JSON.stringify(found));
 await p.waitForTimeout(800);const n=found[found.length-1];if(n){await p.mouse.click(n.cx,n.cy);}else{await p.evaluate(()=>__worldIntegration.leave());}
 M('tap');await p.waitForTimeout(9000);await p.screenshot({path:OUT+'/03-after-exit.png'});M('end');
}
if(mode==='after'){
 const g=JSON.parse(process.env.GUIDE);// {x,y} fraction of viewport, window center
 await p.evaluate(([g,cap])=>{const st=document.createElement('style');st.textContent=`@keyframes br{0%,100%{transform:translate(-50%,-50%) scale(.9);opacity:.6}50%{transform:translate(-50%,-50%) scale(1.1);opacity:1}}
 #wg{position:fixed;left:${g.x*100}%;top:${g.y*100}%;width:0;height:0;z-index:99999;pointer-events:auto}
 #wg .ring{position:absolute;left:0;top:0;width:76px;height:76px;border-radius:50%;border:3px solid rgba(255,242,207,.95);box-shadow:0 0 18px 6px rgba(255,230,170,.55),inset 0 0 14px rgba(255,240,200,.6);animation:br 1.6s ease-in-out infinite}
 #wg .ico{position:absolute;left:0;top:0;transform:translate(-50%,-50%);font-size:34px;line-height:1;filter:drop-shadow(0 1px 2px rgba(33,45,45,.8))}
 #wg .cap{position:absolute;left:0;top:50px;transform:translateX(-50%);white-space:nowrap;font:13px/18px sans-serif;color:#fff2cf;text-shadow:0 0 2px rgba(33,45,45,.9),0 1px 2px rgba(33,45,45,.9);animation:cf 1.6s ease-in-out infinite}
 @keyframes cf{0%,100%{opacity:.75}50%{opacity:1}}`;document.head.appendChild(st);
 const d=document.createElement('div');d.id='wg';d.innerHTML='<div class="ring"></div><div class="ico">🍃</div><div class="cap"></div>';d.querySelector('.cap').textContent=cap;document.body.appendChild(d);},[g,caption]);
 await p.waitForTimeout(3300);M('guide');await p.screenshot({path:OUT+'/02-guide.png'});
 const r=await p.evaluate(()=>{const a=[...document.querySelectorAll('#wg .ring,#wg .cap')].map(e=>e.getBoundingClientRect());return {l:Math.min(...a.map(x=>x.left)),t:Math.min(...a.map(x=>x.top)),r:Math.max(...a.map(x=>x.right)),b:Math.max(...a.map(x=>x.bottom)),vw:innerWidth,vh:innerHeight};});console.log('guideBox',JSON.stringify(r));fs.writeFileSync(OUT+'/guide-box.json',JSON.stringify(r));
 if(process.env.TAP!=='0'){await p.mouse.click(g.x*W,g.y*Hh);await p.evaluate(()=>{const d=document.getElementById('wg');d.style.transition='opacity .25s';d.style.opacity=0;});await p.evaluate(()=>{__worldIntegration.leave();});M('tap');await p.waitForTimeout(9000);await p.screenshot({path:OUT+'/03-after-exit.png'});}
 M('end');
}
fs.writeFileSync(OUT+'/marks.json',JSON.stringify(marks));await ctx.close();await b.close();})().catch(e=>{console.log('FATAL',e);process.exit(1)});
