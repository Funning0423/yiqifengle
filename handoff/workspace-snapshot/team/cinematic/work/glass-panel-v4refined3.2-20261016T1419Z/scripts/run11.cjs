// node run6.cjs <W> <H> <v4|v6> ; deterministic 30fps overlay mockup over real 5c54f7a web build (运镜bot v6)
const {chromium}=require('/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright');const fs=require('fs');
const [W,Hh,V]=[+process.argv[2],+process.argv[3],process.argv[4]];const tag=V+'_'+W+(process.env.FLOAT?'_float':'')+(process.env.DPR&&process.env.DPR!='1'?'_dpr'+process.env.DPR:'');const OUT='/tmp/wte32/rec/'+tag;fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT+'/frames',{recursive:true});
const LEFT=+(process.env.V6_LEFT||0.42);
const MINHIT=JSON.parse(process.env.MINHIT||'[0,0]');const PANEL={minHit:MINHIT,c:[0.05,1.02,-4.70],w:0.80,h:0.28,bobAmp:0.012,bobPeriod:3.2,variant:V,left:LEFT,oa:+(process.env.OA||.43),ta:process.env.TA||'.8',tw:+(process.env.TW||1.2),og:+(process.env.OG||.6),tg:+(process.env.TG||.6)};
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/home/box/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell'});
const ctx=await b.newContext({viewport:{width:W,height:Hh},deviceScaleFactor:+(process.env.DPR||1),timezoneId:'Asia/Shanghai'});
const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',String(e).slice(0,200)));
await p.goto('http://127.0.0.1:18790/?testNamespace=wte6-'+tag+Date.now(),{waitUntil:'commit'});
await p.waitForFunction(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false;}catch{return false;}},{},{timeout:900000,polling:1000});
await p.waitForTimeout(25000);
await p.evaluate(async()=>{const cc=await System.import('cc');const op=n=>{(n.getComponent(cc.UIOpacity)||n.addComponent(cc.UIOpacity)).opacity=0;};
 const f=n=>{const l=n.getComponent(cc.Label);if(l&&/测试包|地区流程测试/.test(l.string)){let t=n;while(t.parent&&t.parent.getComponent(cc.UITransform)&&t.parent.children.length<=3&&t.parent.name!=='WorldNavigationCanvas')t=t.parent;op(t);}
 if(n.name==='RoomLookGuide')op(n);n.children.forEach(f);};f(cc.director.getScene());});
await p.evaluate(async P=>{const cc=await System.import('cc');
 const cams=[];const f=n=>{const c=n.getComponent(cc.Camera);if(c&&c.enabled&&n.activeInHierarchy&&c.projection===1)cams.push(c);n.children.forEach(f);};f(cc.director.getScene());
 cams.sort((a,b)=>b.priority-a.priority);const cam=cams.find(c=>!(c.node.name||'').match(/UI|Canvas/i))||cams[0];
 let fc=null;const g2=n=>{for(const c of n.components)if(typeof c.lookRoom==='function')fc=c;n.children.forEach(g2);};g2(cc.director.getScene());window.__fc=fc;
 const chars=[];const g3=n=>{if(/^LOD0_G2_/.test(n.name)){const m=n.getComponent(cc.MeshRenderer)||n.getComponent(cc.SkinnedMeshRenderer);if(m)chars.push(m);}n.children.forEach(g3);};g3(cc.director.getScene());
 const N=cam.node,cp=N.worldPosition.clone();const R0=N.right.clone(),U0=N.up.clone(),F0=N.forward.clone();
 // axes: v4 = world-axis plane (as v4); v6 = plane facing the home camera (axes = home camera right/up), centre moved left along camera-right
 let C,AX,AY;if(P.variant!=='v6'){C=new cc.Vec3(...P.c);AX=new cc.Vec3(1,0,0);AY=new cc.Vec3(0,1,0);}
 else{const c4=new cc.Vec3(...P.c);C=new cc.Vec3(c4.x-R0.x*P.left,c4.y-R0.y*P.left,c4.z-R0.z*P.left);AX=R0;AY=U0;}
 window.__v6={variant:P.variant,cam:N.name,camPos:[cp.x,cp.y,cp.z],camFwd:[F0.x,F0.y,F0.z],panelCentre:[C.x,C.y,C.z],axisX:[AX.x,AX.y,AX.z],axisY:[AY.x,AY.y,AY.z],size_m:[P.w,P.h],chars:chars.length};
 const st=document.createElement('style');st.textContent=`
 #gp{position:fixed;left:0;top:0;width:280px;height:100px;transform-origin:0 0;z-index:99999}
 #gp .card{position:absolute;inset:0;border-radius:50px;background:linear-gradient(160deg,rgba(255,255,255,.34),rgba(255,255,255,.10) 55%,rgba(255,255,255,.18));
  backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border:1.5px solid rgba(255,255,255,.75);
  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.9),inset 0 -6px 14px rgba(255,255,255,.12),0 10px 24px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;
  font:600 34px/1 "Noto Sans CJK SC",sans-serif;color:#fff;letter-spacing:4px;text-shadow:0 1px 6px rgba(0,40,60,.45)}
 #gp .card span.lf{font-size:30px;margin-right:12px}
 #gp .ring{position:absolute;inset:-4px;border-radius:54px;border:4px solid rgba(255,248,220,0);pointer-events:none}
 #gp .rip{position:absolute;inset:0;border-radius:50px;border:3px solid rgba(255,255,255,.9);opacity:0;pointer-events:none}
 #gp.r{will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden}
 #gp.r .card{border:0;box-shadow:inset 0 0 .9px 1.3px rgba(255,255,255,.72),inset 0 1.5px .6px rgba(255,255,255,.85),inset 0 -6px 14px rgba(255,255,255,.12),0 0 .9px .4px rgba(255,255,255,.45)}
 #gp.r .shadow{position:absolute;inset:0;border-radius:50px;box-shadow:0 10px 24px rgba(0,0,0,.22);pointer-events:none}
 #gp.r2{will-change:transform;backface-visibility:hidden}
 #gp.r2 .card{border:0;box-shadow:inset 0 -6px 14px rgba(255,255,255,.12)}
 #gp.r2 .shadow{position:absolute;inset:0;border-radius:50px;box-shadow:0 10px 24px rgba(0,0,0,.22);pointer-events:none}
 #gps{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:100000;pointer-events:none;overflow:visible}`;document.head.appendChild(st);
 const d=document.createElement('div');d.id='gp';d.innerHTML='<div class="rip"></div><div class="card"><span class="lf">🍃</span>出发去看海</div><div class="ring"></div>';if(P.variant==='v4r2'||P.variant==='v4r32'||(P.variant==='v4r3'||P.variant==='v4r31')){d.className='r2';d.insertAdjacentHTML('afterbegin','<div class="shadow"></div>');const sv=document.createElementNS('http://www.w3.org/2000/svg','svg');sv.id='gps';sv.innerHTML='<path fill="none" stroke="rgba(255,255,255,'+P.oa+')" stroke-width="1.3" shape-rendering="geometricPrecision" stroke-linejoin="round"/><path fill="none" stroke="rgba(255,255,255,'+P.ta+')" stroke-width="'+P.tw+'" stroke-linecap="round" shape-rendering="geometricPrecision"/>';document.body.appendChild(sv);window.__gpPath=sv.firstChild;}
 if(P.variant==='v4r'){d.className='r';d.insertAdjacentHTML('afterbegin','<div class="shadow"></div>');}document.body.appendChild(d);
 function H(src,dst){const A=[],B=[];for(let i=0;i<4;i++){const[x,y]=src[i],[u,v]=dst[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);B.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);B.push(v);}
  for(let i=0;i<8;i++){let m=i;for(let j=i+1;j<8;j++)if(Math.abs(A[j][i])>Math.abs(A[m][i]))m=j;[A[i],A[m]]=[A[m],A[i]];[B[i],B[m]]=[B[m],B[i]];for(let j=i+1;j<8;j++){const k=A[j][i]/A[i][i];for(let c=i;c<8;c++)A[j][c]-=k*A[i][c];B[j]-=k*B[i];}}
  const h=Array(8);for(let i=7;i>=0;i--){let s=B[i];for(let c=i+1;c<8;c++)s-=A[i][c]*h[c];h[i]=s/A[i][i];}return h;}
 const cv=document.querySelector('canvas');{let g=null;try{g=cv.getContext('webgl2')||cv.getContext('webgl');}catch(e){}window.__v6.canvasAA=g&&g.getContextAttributes?g.getContextAttributes():null;}const o=new cc.Vec3();window.__t0=performance.now();window.__gpState={hidden:false,box:null};
 const proj=v=>{cam.camera.worldToScreen(o,v);const r=cv.getBoundingClientRect();return [r.left+o.x/cv.width*r.width,r.top+(1-o.y/cv.height)*r.height,o.z];};
 window.__charBox=()=>{let l=1e9,r=-1e9,t=1e9,bb=-1e9;for(const m of chars){const mdl=m.model;if(!mdl||!mdl.worldBounds)continue;const wb=mdl.worldBounds,c=wb.center,h=wb.halfExtents;
  for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1]){const q=proj(new cc.Vec3(c.x+sx*h.x,c.y+sy*h.y,c.z+sz*h.z));l=Math.min(l,q[0]);r=Math.max(r,q[0]);t=Math.min(t,q[1]);bb=Math.max(bb,q[1]);}}return {l,r,t,b:bb};};
 const card=d.querySelector('.card'),ring=d.querySelector('.ring'),rip=d.querySelector('.rip');
 const cl=x=>Math.max(0,Math.min(1,x)),eo=x=>1-Math.pow(1-x,3);
 const fb=()=>{const T=window.__gpState.tapAt;if(T==null)return;const f=(performance.now()-T)*30/1000;
  const sc=f<4?1-0.08*eo(f/4):(f<10?0.92+0.05*Math.sin(cl((f-4)/6)*Math.PI/2):0.97);card.style.transform=`scale(${sc})`;card.style.filter=`brightness(${f<4?1+0.15*f/4:1.15-0.15*cl((f-4)/10)})`;
  const g=f<3?0:(f<10?(f-3)/7:1-cl((f-10)/9));ring.style.borderColor=`rgba(255,248,220,${g})`;ring.style.boxShadow=`0 0 ${24+16*cl((f-10)/9)}px ${6+6*cl((f-10)/9)}px rgba(255,236,180,${0.85*g})`;
  const r=cl((f-6)/18);rip.style.opacity=f<6?0:0.9*(1-r);rip.style.transform=`scale(${1+0.9*eo(r)},${1+1.6*eo(r)})`;
  const fo=cl((f-16)/10);d.style.opacity=1-fo;
  if(f>=27&&!window.__gpState.left){window.__gpState.left=true;window.__gpState.hidden=true;d.style.display='none';if(window.__gpPath)window.__gpPath.parentNode.style.display='none';__worldIntegration.leave();}};
 const loop=()=>{fb();if(!window.__gpState.hidden){const t=(performance.now()-window.__t0)/1000,bob=P.bobAmp*Math.sin(2*Math.PI*t/P.bobPeriod);
  const hw=P.w/2,hh=P.h/2;const pt=(sx,sy)=>new cc.Vec3(C.x+AX.x*sx*hw+AY.x*(sy*hh+bob),C.y+AX.y*sx*hw+AY.y*(sy*hh+bob),C.z+AX.z*sx*hw+AY.z*(sy*hh+bob));
  let ok=true;const dst=[pt(-1,1),pt(1,1),pt(1,-1),pt(-1,-1)].map(v=>{const q=proj(v);if(q[2]<0||q[2]>1)ok=false;return [q[0],q[1]];});
  d.style.display=ok?'block':'none';if(window.__gpPath)window.__gpPath.parentNode.style.display=ok?'block':'none';if(ok){const h=H([[0,0],[280,0],[280,100],[0,100]],dst);d.style.transform=`matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
  const xs=dst.map(q=>q[0]),ys=dst.map(q=>q[1]);const bx={l:Math.min(...xs),r:Math.max(...xs),t:Math.min(...ys),b:Math.max(...ys)};window.__gpState.box=bx;if((P.variant==='v4r3'||P.variant==='v4r31')&&!window.__m3){window.__m3=1;const sc=(bx.r-bx.l)/280,i=0.9/sc,sg=0.45/sc;const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='280' height='100'><filter id='f' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='${sg.toFixed(3)}'/></filter><rect x='${i.toFixed(3)}' y='${i.toFixed(3)}' width='${(280-2*i).toFixed(3)}' height='${(100-2*i).toFixed(3)}' rx='${(50-i).toFixed(3)}' fill='white' filter='url(%23f)'/></svg>`;const u='url("data:image/svg+xml,'+svg.replace(/"/g,"'")+'")';for(const el of [card]){el.style.webkitMaskImage=u;el.style.maskImage=u;el.style.webkitMaskSize='100% 100%';el.style.maskSize='100% 100%';}window.__v6.mask={sc,inset_local:i,sigma_local:sg};}window.__gpState.h=h;window.__gpState.sc=parseFloat((card.style.transform.match(/scale\(([\d.]+)/)||[0,1])[1]);if(window.__gpPath){const sc=window.__gpState.sc,ins=0.75,R=50-ins,pts=[];const mp=(x,y)=>{x=140+sc*(x-140);y=50+sc*(y-50);const w=h[6]*x+h[7]*y+1;return [(h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w];};for(let i=0;i<=24;i++){const a=Math.PI/2+Math.PI*i/24;pts.push(mp(50+R*Math.cos(a),50+R*Math.sin(a)));}for(let x=50;x<=230;x+=6)pts.push(mp(x,ins));for(let i=0;i<=24;i++){const a=-Math.PI/2+Math.PI*i/24;pts.push(mp(230+R*Math.cos(a),50+R*Math.sin(a)));}for(let x=230;x>=50;x-=6)pts.push(mp(x,100-ins));window.__gpPath.setAttribute('d','M'+pts.map(q=>q[0].toFixed(3)+' '+q[1].toFixed(3)).join('L')+'Z');{const tp=[];for(let i=0;i<=16;i++){const a=-Math.PI/2-0.9*Math.PI/2*(16-i)/16;tp.push(mp(50+(50-2.2)*Math.cos(a),50+(50-2.2)*Math.sin(a)));}for(let x=56;x<=224;x+=6)tp.push(mp(x,2.2));for(let i=0;i<=16;i++){const a=-Math.PI/2+0.9*Math.PI/2*i/16;tp.push(mp(230+(50-2.2)*Math.cos(a),50+(50-2.2)*Math.sin(a)));}window.__gpPath.nextSibling.setAttribute('d','M'+tp.map(q=>q[0].toFixed(3)+' '+q[1].toFixed(3)).join('L'));if(P.variant==='v4r31'||P.variant==='v4r32'){const tl=window.__gpPath.nextSibling;if(!window.__tg){const sv=tl.ownerSVGElement;const df=document.createElementNS('http://www.w3.org/2000/svg','defs');df.innerHTML=`<linearGradient id='tg' gradientUnits='userSpaceOnUse'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='0.15' stop-color='#fff' stop-opacity='${P.ta}'/><stop offset='0.85' stop-color='#fff' stop-opacity='${P.ta}'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>`;sv.insertBefore(df,sv.firstChild);tl.setAttribute('stroke','url(#tg)');window.__tg=df.firstChild;}const g=window.__tg,p0=tp[0],p1=tp[tp.length-1];g.setAttribute('x1',p0[0]);g.setAttribute('y1',p0[1]);g.setAttribute('x2',p1[0]);g.setAttribute('y2',p1[1]);}}{const r=(bx.r-bx.l)/123.2;window.__gpPath.setAttribute('stroke','rgba(255,255,255,'+Math.min(1,P.oa*Math.pow(r,P.og)).toFixed(3)+')');window.__gpPath.nextSibling.setAttribute('stroke-width',(P.tw*Math.pow(r,P.tg)).toFixed(3));}window.__gpPath.parentNode.style.opacity=d.style.opacity||1;}const mw=P.minHit[0],mh=P.minHit[1],cxx=(bx.l+bx.r)/2,cyy=(bx.t+bx.b)/2,ww=Math.max(bx.r-bx.l,mw),hh2=Math.max(bx.b-bx.t,mh);window.__gpState.hit={l:cxx-ww/2,r:cxx+ww/2,t:cyy-hh2/2,b:cyy+hh2/2};}}requestAnimationFrame(loop);};loop();},PANEL);
await p.waitForTimeout(2500);
const info=await p.evaluate(()=>({...window.__v6,mask:window.__v6.mask,box:window.__gpState.box,hit:window.__gpState.hit,charBox:window.__charBox(),viewport:[innerWidth,innerHeight]}));console.log(tag,JSON.stringify(info));fs.writeFileSync(OUT+'/info.json',JSON.stringify(info,null,1));
await p.evaluate(()=>{document.getElementById('gp').style.visibility='hidden';if(window.__gpPath)window.__gpPath.parentNode.style.visibility='hidden'});await p.screenshot({path:OUT+'/mask_with_char.png',timeout:300000});
await p.evaluate(async()=>{const cc=await System.import('cc');window.__hid=[];const g=n=>{if(/^LOD0_G2_/.test(n.name)&&n.active){n.active=false;window.__hid.push(n);}n.children.forEach(g);};g(cc.director.getScene());});await p.waitForTimeout(300);await p.screenshot({path:OUT+'/mask_no_char.png',timeout:300000});
await p.evaluate(()=>{window.__hid.forEach(n=>n.active=true);document.getElementById('gp').style.visibility='visible';if(window.__gpPath)window.__gpPath.parentNode.style.visibility='visible'});await p.waitForTimeout(300);await p.screenshot({path:OUT+'/home.png',timeout:300000});
if(process.env.PROBE){await p.screenshot({path:OUT+'/probe.png',timeout:300000});await b.close();return;}
await p.evaluate(()=>{const fg=document.createElement('div');fg.id='fg';fg.style.cssText='position:fixed;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.45);border:2px solid rgba(255,255,255,.8);z-index:100000;display:none;transform:translate(-50%,-50%)';document.body.appendChild(fg);});
await p.clock.install();await p.clock.pauseAt(Date.now()+15000);await p.evaluate(()=>{window.__t0=performance.now();});
let fn=0;const log=[];const FR=OUT+'/frames';
const step=async()=>{await p.clock.runFor(1000/30);await p.screenshot({path:`${FR}/${String(fn).padStart(5,'0')}.png`,timeout:300000});
 log.push(await p.evaluate(()=>({st:__worldIntegration.snapshot().state,hidden:window.__gpState.hidden,box:window.__gpState.box,h:window.__gpState.h,ch:window.__charBox()})));fn++;};
if(process.env.FLOAT){for(let i=0;i<110;i++)await step();fs.writeFileSync(OUT+'/framelog.json',JSON.stringify(log));await ctx.close();await b.close();return;}
const cx=W/2,cy=Hh*0.62;
const plan=[[0,15],[-0.22,30],[0,15],[0.44,45],[0,15],[-0.22,30],[0,20]];
for(const [frac,n] of plan){let last=0;for(let i=1;i<=n;i++){if(frac){const k=i/n,e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,dd=frac*e-last;last=frac*e;
  await p.evaluate(([dd,x,y])=>{window.__fc.lookRoom(dd,0);const fg=document.getElementById('fg');fg.style.display='block';fg.style.left=x+'px';fg.style.top=y+'px';},[dd,cx+(frac*e)*W,cy]);}
  else await p.evaluate(()=>{document.getElementById('fg').style.display='none';});await step();}}
for(let i=0;i<15;i++)await step();
const bx=await p.evaluate(()=>({...(window.__gpState.hit||window.__gpState.box)}));fs.writeFileSync(OUT+'/tap-box.json',JSON.stringify(bx));
await p.evaluate(([x,y])=>{const fg=document.getElementById('fg');fg.style.display='block';fg.style.left=x+'px';fg.style.top=y+'px';window.__gpState.tapAt=performance.now();setTimeout(()=>fg.style.display='none',200);},[(bx.l+bx.r)/2,(bx.t+bx.b)/2]);
const tapF=fn;for(let i=0;i<330;i++){await step();if(i%60==0)console.log(tag,'f',fn,log[log.length-1].st);}
fs.writeFileSync(OUT+'/seg.json',JSON.stringify({seg1_frames:170,tap_frame:tapF,total:fn}));fs.writeFileSync(OUT+'/framelog.json',JSON.stringify(log));
await ctx.close();await b.close();})().catch(e=>{console.log('FATAL',String(e).slice(0,400));process.exit(1)});
