// node run3.cjs <W> <H> <tag> ; env VIDEO=1 records + taps the glass to start the exit. Test banner hidden at runtime (mockup only).
const {chromium}=require('/workspace/wechat-game/yiqifengle/node_modules/playwright');const fs=require('fs');
const [W,Hh,tag]=[+process.argv[2],+process.argv[3],process.argv[4]];const OUT='/tmp/wte/rec3/'+tag;fs.mkdirSync(OUT,{recursive:true});
const chk=JSON.parse(fs.readFileSync('/workspace/wechat-game/team/cinematic/work/window-tap-exit/v3-sill/shots/sill_projection_check.json')).find(c=>c.viewport[0]===W);
const T0=Date.now(),marks=[];const M=k=>{const t=(Date.now()-T0)/1000;marks.push([k,t]);console.log(k,t);fs.writeFileSync(OUT+'/marks.json',JSON.stringify(marks));};
(async()=>{const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:W,height:Hh},deviceScaleFactor:2,hasTouch:false,...(process.env.VIDEO?{recordVideo:{dir:OUT,size:{width:W,height:Hh}}}:{})});
const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',String(e).slice(0,200)));
await p.goto('http://127.0.0.1:18790/?testNamespace=wte3-'+tag+Date.now(),{waitUntil:'commit'});
await p.waitForFunction(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false;}catch{return false;}},{},{timeout:900000,polling:1000});
// wait for the loading veil to be gone
await p.waitForTimeout(25000);M('home');
const SH=async n=>{try{await p.screenshot({path:OUT+'/'+n+'.png',timeout:120000});}catch{console.log('shotfail',n)}};
const hidden=await p.evaluate(async()=>{const cc=await System.import('cc');const out=[];const op=n=>{(n.getComponent(cc.UIOpacity)||n.addComponent(cc.UIOpacity)).opacity=0;};
 const f=n=>{const l=n.getComponent(cc.Label);if(l&&/测试包|地区流程测试/.test(l.string)){let t=n;while(t.parent&&t.parent.getComponent(cc.UITransform)&&t.parent.children.length<=3&&t.parent.name!=='WorldNavigationCanvas')t=t.parent;op(t);out.push(t.name+':'+l.string);}n.children.forEach(f);};f(cc.director.getScene());return out;});
console.log('banner hidden',JSON.stringify(hidden));await p.waitForTimeout(1500);
await SH('before_default-window');
await p.evaluate(async c=>{const cc=await System.import('cc');const f=n=>{if(n.name==='RoomLookGuide')(n.getComponent(cc.UIOpacity)||n.addComponent(cc.UIOpacity)).opacity=0;n.children.forEach(f);};f(cc.director.getScene());
 const t=c.tip_screen,st=document.createElement('style');st.textContent=`@keyframes br{0%,100%{transform:scale(.9);opacity:.6}50%{transform:scale(1.1);opacity:1}}
 #tip{position:fixed;left:${t.l}px;top:${t.top}px;width:${t.w}px;height:${t.h}px;border-radius:13px;background:rgba(20,32,32,.47);display:flex;align-items:center;box-sizing:border-box;padding:0 10px;z-index:99999}
 #tip .ring{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,242,207,.94);background:rgba(255,236,180,.24);box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;animation:br 1.6s ease-in-out infinite;flex:none}
 #tip .cap{margin-left:6px;font:13px/26px sans-serif;color:#fff2cf;white-space:nowrap;text-shadow:0 0 1px #212d2d}`;document.head.appendChild(st);
 const d=document.createElement('div');d.id='tip';d.innerHTML='<div class="ring">🍃</div><div class="cap">出发去看海</div>';document.body.appendChild(d);},chk);
await p.waitForTimeout(3000);await SH('after_sill-tip');M('tip');
const box=await p.evaluate(()=>{const r=document.getElementById('tip').getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,vw:innerWidth,vh:innerHeight};});fs.writeFileSync(OUT+'/tip-box-rendered.json',JSON.stringify(box));
if(process.env.VIDEO){await p.waitForTimeout(3000);const g=chk.glass_screen;const x=(g.l+g.r)/2,y=(g.top+g.bottom)/2;
 await p.evaluate(([x,y])=>{const d=document.createElement('div');d.style.cssText=`position:fixed;left:${x-22}px;top:${y-22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.55);z-index:99999;transition:all .4s`;document.body.appendChild(d);setTimeout(()=>{d.style.opacity=0;d.style.transform='scale(1.6)'},50);},[x,y]);
 await p.mouse.click(x,y);await p.evaluate(()=>{document.getElementById('tip').style.display='none';__worldIntegration.leave();});M('tap');
 await p.waitForFunction(()=>__worldIntegration.snapshot().state==='walking-out',{},{timeout:900000,polling:250});M('walking');await p.waitForTimeout(6000);M('end');}
await ctx.close();await b.close();})().catch(e=>{console.log('FATAL',String(e).slice(0,400));process.exit(1)});
