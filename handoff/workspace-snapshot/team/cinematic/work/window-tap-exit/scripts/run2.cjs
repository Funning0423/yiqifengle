// node run2.cjs <W> <H> <tag> : full flow: window-guide tap -> full exit w/ skip button -> skip -> returnHome -> 2nd exit quick (runtime emulation of the patch)
const {chromium}=require('/workspace/wechat-game/yiqifengle/node_modules/playwright');const fs=require('fs');
const [W,Hh,tag]=[+process.argv[2],+process.argv[3],process.argv[4]];const OUT='/tmp/wte/rec2/'+tag;fs.mkdirSync(OUT,{recursive:true});
const T0=Date.now();const marks=[];const M=async(k,p)=>{const g=p?await p.evaluate(()=>window.__gt||0).catch(()=>0):0;const t=(Date.now()-T0)/1000;marks.push([k,t,g]);console.log(k,'wall',t,'game',g.toFixed?g.toFixed(2):g);fs.writeFileSync(OUT+'/marks.json',JSON.stringify(marks));};
(async()=>{const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:W,height:Hh},deviceScaleFactor:1,hasTouch:false,recordVideo:{dir:OUT,size:{width:W,height:Hh}}});
const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',String(e).slice(0,200)));p.on('console',m=>{if(/skip|quick|WTE/.test(m.text()))console.log('PAGE',m.text().slice(0,200));});
await p.goto('http://127.0.0.1:18790/?testNamespace=wte2-'+tag+Date.now(),{waitUntil:'commit'});
await p.waitForFunction(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false;}catch{return false;}},{},{timeout:900000,polling:1000});
// game clock = sum of the dt the engine actually feeds the scene; locate the flow core
const info=await p.evaluate(async()=>{const cc=await System.import('cc');window.__cc=cc;window.__gt=0;cc.director.on(cc.Director.EVENT_AFTER_UPDATE,()=>{window.__gt+=cc.director.getDeltaTime();});
 const all=[];const f=n=>{for(const c of n.components)all.push(c);n.children.forEach(f);};f(cc.director.getScene());const comp=all.find(c=>c&&c.flow&&typeof c.flow.leaveHome==='function');window.__wfc=comp;
 const fl=comp?.flow;return {found:!!comp,name:comp?.constructor?.name,priv:fl?['invalidate','restore','change','cameraEvent','operate','action','world','config','stable'].map(k=>k+':'+typeof fl[k]).join(' '):null};});
console.log('core',JSON.stringify(info));if(!info.found)throw Error('flow core not found');
await p.waitForTimeout(8000);await M('home',p);
const SH=async n=>{try{await p.screenshot({path:OUT+'/'+n+'.png',timeout:90000});}catch{console.log('shotfail',n)}};
// mockup UI layer (same numbers as the patch): window guide + 跳过 button; hide old hint
await p.evaluate(()=>{const cc=window.__cc;const f=n=>{if(n.name==='RoomLookGuide')(n.getComponent(cc.UIOpacity)||n.addComponent(cc.UIOpacity)).opacity=0;n.children.forEach(f);};f(cc.director.getScene());
 const st=document.createElement('style');st.textContent=`@keyframes br{0%,100%{transform:translate(-50%,-50%) scale(.9);opacity:.6}50%{transform:translate(-50%,-50%) scale(1.1);opacity:1}}
 #wg{position:fixed;width:0;height:0;z-index:99999}#wg .ring{position:absolute;left:0;top:0;width:76px;height:76px;border-radius:50%;border:3px solid rgba(255,242,207,.95);box-shadow:0 0 18px 6px rgba(255,230,170,.55),inset 0 0 14px rgba(255,240,200,.6);animation:br 1.6s ease-in-out infinite}
 #wg .ico{position:absolute;left:0;top:0;transform:translate(-50%,-50%);font-size:34px}#wg .cap{position:absolute;left:0;top:50px;transform:translateX(-50%);white-space:nowrap;font:13px/18px sans-serif;color:#fff2cf;text-shadow:0 0 2px #212d2d,0 1px 2px #212d2d}
 #skip{position:fixed;right:16px;top:64px;width:88px;height:44px;border-radius:22px;background:rgba(20,32,32,.59);border:1.5px solid rgba(255,242,207,.78);color:#fff2cf;font:15px/44px sans-serif;text-align:center;z-index:99999;display:none;box-sizing:border-box}`;document.head.appendChild(st);
 const d=document.createElement('div');d.id='wg';d.innerHTML='<div class="ring"></div><div class="ico">🍃</div><div class="cap">出发去看海</div>';document.body.appendChild(d);
 const s=document.createElement('div');s.id='skip';s.textContent='跳过  ›';document.body.appendChild(s);
 const fl=window.__wfc.flow;setInterval(()=>{const st=fl.snapshot().state;const leaving=['standing','turning-out','walking-out','opening-door','crossing-out'].includes(st)&&!!fl.current;s.style.display=leaving&&!window.__noskip?'block':'none';},50);
 // runtime emulation of the patch's WorldFlowCore.skipLeave() using the build's own private methods
 window.__skip=()=>{fl.invalidate();fl.stable='island';fl.restore();fl.change('island');fl.cameraEvent({kind:'settled',place:'island'});console.log('WTE skip done',fl.snapshot().state);return true;};
 // runtime emulation of leaveHomeRun({quick:true})
 window.__quick=()=>fl.operate('standing',async t=>{const c=fl.config;await fl.action({kind:'stand',seat:c.seat},t);t.check();fl.change('crossing-out');fl.world.setLayers({interior:true,exterior:true,door:true,backdrop:true});fl.world.setRoomLightWeight?.(1);fl.world.setDoor(c.openDeg);
   const co=c.cameraCrossOut??[c.cameraInside,c.cameraOutside];await t.wait(fl.world.animateCamera([c.cameraHome,...co,c.cameraIsland],3.6,t));t.check();fl.stable='island';fl.restore();fl.change('island');fl.cameraEvent({kind:'settled',place:'island'});});
});
const place=async()=>p.evaluate(([W,Hh])=>{const x=Math.max(96,Math.min(W-96,0.356*W*(W/Hh<0.6?1:0)+(W/Hh<0.6?0:0.412*W))),y=0.397*Hh;const d=document.getElementById('wg');d.style.left=x+'px';d.style.top=y+'px';d.style.display='block';return {x,y};},[W,Hh]);
let g=await place();await p.waitForTimeout(4000);await SH('a1-guide');
// ===== first exit: full, skip button visible, skip tap during walking-out =====
if(process.env.NOSKIP)await p.evaluate(()=>{window.__noskip=1;document.getElementById('wg').remove();});
await p.mouse.click(g.x,g.y);await p.evaluate(()=>{const w=document.getElementById('wg');if(w)w.style.display='none';__worldIntegration.leave();});await M('exit1-start',p);
if(process.env.NOSKIP){await p.waitForFunction(()=>__worldIntegration.snapshot().state==='island',{},{timeout:1500000,polling:100});await M('exit1-island-full',p);await p.waitForTimeout(3000);await SH('f-island');await M('end',p);await ctx.close();await b.close();return;}
await p.waitForFunction(()=>__worldIntegration.snapshot().state==='walking-out',{},{timeout:600000,polling:250});await M('exit1-walking',p);await p.waitForTimeout(1500);await SH('a2-skip-visible');
const sb=await p.evaluate(()=>{const r=document.getElementById('skip').getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,vw:innerWidth,vh:innerHeight};});fs.writeFileSync(OUT+'/skip-box.json',JSON.stringify(sb));
await p.mouse.click((sb.l+sb.r)/2,(sb.t+sb.b)/2);await p.evaluate(()=>window.__skip());await M('exit1-skipped',p);
await p.waitForTimeout(4000);await SH('a3-after-skip-island');
const s1=await p.evaluate(()=>{const fl=window.__wfc.flow;return {state:fl.snapshot().state,stable:fl.stable,current:!!fl.current};});console.log('afterSkip',JSON.stringify(s1));
// ===== back home, then second exit: quick =====
await p.evaluate(()=>__worldIntegration.returnHome());await p.waitForFunction(()=>__worldIntegration.snapshot().state==='home',{},{timeout:900000,polling:500});await M('home2',p);await p.waitForTimeout(3000);
g=await place();await p.waitForTimeout(3000);await SH('b1-guide-2nd');
await p.mouse.click(g.x,g.y);await p.evaluate(()=>{document.getElementById('wg').style.display='none';window.__qp=window.__quick();});await M('exit2-start',p);
await p.waitForFunction(()=>__worldIntegration.snapshot().state==='island',{},{timeout:600000,polling:100});await M('exit2-island',p);await p.waitForTimeout(3000);await SH('b2-quick-island');
await M('end',p);await ctx.close();await b.close();})().catch(e=>{console.log('FATAL',String(e).slice(0,500));process.exit(1)});
