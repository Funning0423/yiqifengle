// node run4.cjs <W> <H> <variant: sill|glass> ; records swipe-look then tap->exit. Overlay mockup over real 5c54f7a web build.
const {chromium}=require('/workspace/wechat-game/yiqifengle/node_modules/playwright');const fs=require('fs');
const [W,Hh,V]=[+process.argv[2],+process.argv[3],process.argv[4]];const tag=V+'_'+W;const OUT='/tmp/wte/rec4/'+tag;fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const chk=JSON.parse(fs.readFileSync('/workspace/wechat-game/team/cinematic/work/window-tap-exit/v3-sill/shots/sill_projection_check.json')).find(c=>c.viewport[0]===W);
const PANEL={c:[0.05,1.02,-4.70],w:0.80,h:0.28,bobAmp:0.012,bobPeriod:3.2};
const T0=Date.now(),marks=[];const M=k=>{const t=(Date.now()-T0)/1000;marks.push([k,t]);console.log(tag,k,t);fs.writeFileSync(OUT+'/marks.json',JSON.stringify(marks));};
(async()=>{const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:W,height:Hh},deviceScaleFactor:+(process.env.DPR||1),recordVideo:{dir:OUT,size:{width:W,height:Hh}}});
const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',String(e).slice(0,200)));
await p.goto('http://127.0.0.1:18790/?testNamespace=wte4-'+tag+Date.now(),{waitUntil:'commit'});
await p.waitForFunction(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false;}catch{return false;}},{},{timeout:900000,polling:1000});
await p.waitForTimeout(25000);
await p.evaluate(async()=>{const cc=await System.import('cc');const op=n=>{(n.getComponent(cc.UIOpacity)||n.addComponent(cc.UIOpacity)).opacity=0;};
 const f=n=>{const l=n.getComponent(cc.Label);if(l&&/测试包|地区流程测试/.test(l.string)){let t=n;while(t.parent&&t.parent.getComponent(cc.UITransform)&&t.parent.children.length<=3&&t.parent.name!=='WorldNavigationCanvas')t=t.parent;op(t);}
 if(n.name==='RoomLookGuide')op(n);n.children.forEach(f);};f(cc.director.getScene());});
if(V==='sill'){await p.evaluate(c=>{const t=c.tip_screen,st=document.createElement('style');st.textContent=`@keyframes br{0%,100%{transform:scale(.9);opacity:.6}50%{transform:scale(1.1);opacity:1}}
 #tip{position:fixed;left:${t.l}px;top:${t.top}px;width:${t.w}px;height:${t.h}px;border-radius:13px;background:rgba(20,32,32,.47);display:flex;align-items:center;box-sizing:border-box;padding:0 10px;z-index:99999;transition:opacity .25s}
 #tip .ring{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,242,207,.94);background:rgba(255,236,180,.24);box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;animation:br 1.6s ease-in-out infinite;flex:none}
 #tip .cap{margin-left:6px;font:13px/26px sans-serif;color:#fff2cf;white-space:nowrap;text-shadow:0 0 1px #212d2d}`;document.head.appendChild(st);
 const d=document.createElement('div');d.id='tip';d.innerHTML='<div class="ring">🍃</div><div class="cap">出发去看海</div>';document.body.appendChild(d);},chk);}
else{await p.evaluate(async P=>{const cc=await System.import('cc');
 const cams=[];const f=n=>{const c=n.getComponent(cc.Camera);if(c&&c.enabled&&n.activeInHierarchy&&c.projection===1)cams.push(c);n.children.forEach(f);};f(cc.director.getScene());
 cams.sort((a,b)=>b.priority-a.priority);const cam=cams.find(c=>!(c.node.name||'').match(/UI|Canvas/i))||cams[0];window.__cam=cam.node.name;
 const st=document.createElement('style');st.textContent=`
 #gp{position:fixed;left:0;top:0;width:280px;height:100px;transform-origin:0 0;z-index:99999;pointer-events:auto}
 #gp .card{position:absolute;inset:0;border-radius:50px;background:linear-gradient(160deg,rgba(255,255,255,.34),rgba(255,255,255,.10) 55%,rgba(255,255,255,.18));
  backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border:1.5px solid rgba(255,255,255,.75);
  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.9),inset 0 -6px 14px rgba(255,255,255,.12),0 10px 24px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;
  font:600 34px/1 "Noto Sans CJK SC",sans-serif;color:#fff;letter-spacing:4px;text-shadow:0 1px 6px rgba(0,40,60,.45);transition:transform .133s ease-out,filter .133s}
 #gp .card span.lf{font-size:30px;margin-right:12px}
 #gp .ring{position:absolute;inset:-4px;border-radius:54px;border:4px solid rgba(255,248,220,0);box-shadow:0 0 0 rgba(255,240,200,0);pointer-events:none}
 #gp .rip{position:absolute;inset:0;border-radius:50px;border:3px solid rgba(255,255,255,.9);opacity:0;pointer-events:none}`;document.head.appendChild(st);
 const d=document.createElement('div');d.id='gp';d.innerHTML='<div class="rip"></div><div class="card"><span class="lf">🍃</span>出发去看海</div><div class="ring"></div>';document.body.appendChild(d);
 // homography: map 280x100 rect to projected quad
 function H(src,dst){const A=[],B=[];for(let i=0;i<4;i++){const[x,y]=src[i],[u,v]=dst[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);B.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);B.push(v);}
  for(let i=0;i<8;i++){let m=i;for(let j=i+1;j<8;j++)if(Math.abs(A[j][i])>Math.abs(A[m][i]))m=j;[A[i],A[m]]=[A[m],A[i]];[B[i],B[m]]=[B[m],B[i]];for(let j=i+1;j<8;j++){const k=A[j][i]/A[i][i];for(let c=i;c<8;c++)A[j][c]-=k*A[i][c];B[j]-=k*B[i];}}
  const h=Array(8);for(let i=7;i>=0;i--){let s=B[i];for(let c=i+1;c<8;c++)s-=A[i][c]*h[c];h[i]=s/A[i][i];}return h;}
 const cv=document.querySelector('canvas');const o=new cc.Vec3();const t0=performance.now();window.__gpState={hidden:false,box:null};
 const loop=()=>{if(!window.__gpState.hidden){const t=(performance.now()-t0)/1000,bob=P.bobAmp*Math.sin(2*Math.PI*t/P.bobPeriod);
  const [cx,cy,cz]=P.c,hw=P.w/2,hh=P.h/2,cor=[[cx-hw,cy+hh+bob],[cx+hw,cy+hh+bob],[cx+hw,cy-hh+bob],[cx-hw,cy-hh+bob]];const r=cv.getBoundingClientRect();let ok=true;
  const dst=cor.map(([x,y])=>{cam.camera.worldToScreen(o,new cc.Vec3(x,y,cz));if(o.z<0||o.z>1)ok=false;return [r.left+o.x/cv.width*r.width,r.top+(1-o.y/cv.height)*r.height];});
  d.style.display=ok?'block':'none';if(ok){const h=H([[0,0],[280,0],[280,100],[0,100]],dst);d.style.transform=`matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
  const xs=dst.map(q=>q[0]),ys=dst.map(q=>q[1]);window.__gpState.box={l:Math.min(...xs),r:Math.max(...xs),t:Math.min(...ys),b:Math.max(...ys)};}}requestAnimationFrame(loop);};loop();},PANEL);
 console.log('cam',await p.evaluate(()=>window.__cam));}
await p.waitForTimeout(2500);M('seg1_start');
if(V==='glass')fs.writeFileSync(OUT+'/panel-box-home.json',JSON.stringify(await p.evaluate(()=>window.__gpState.box)));
// segment 1: swipe-look (drag right->left reveals door side, then back, then the other way, then home)
await p.evaluate(async()=>{const cc=await System.import('cc');let fc=null;const f=n=>{for(const c of n.components)if(typeof c.lookRoom==='function')fc=c;n.children.forEach(f);};f(cc.director.getScene());window.__fc=fc;
 const fg=document.createElement('div');fg.id='fg';fg.style.cssText='position:fixed;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.45);border:2px solid rgba(255,255,255,.8);z-index:100000;display:none;transform:translate(-50%,-50%)';document.body.appendChild(fg);});
const cx=W/2,cy=Hh*0.62;
// swipe via the game's own RoomLook path (WorldFlowComponent.lookRoom), with a finger marker drawn
const drag=async(frac,ms)=>{await p.evaluate(async([frac,ms,cx,cy,W])=>{const fg=document.getElementById('fg');fg.style.display='block';const n=Math.round(ms/33);let last=0;
 for(let i=1;i<=n;i++){const k=i/n,e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,d=frac*e-last;last=frac*e;window.__fc.lookRoom(d,0);fg.style.left=(cx+frac*e*W)+'px';fg.style.top=cy+'px';await new Promise(r=>setTimeout(r,33));}fg.style.display='none';},[frac,ms,cx,cy,W]);};
await drag(-0.22,1200);await p.waitForTimeout(700);await drag(0.44,1800);await p.waitForTimeout(700);
await drag(-0.22,1200);await p.waitForTimeout(1500);M('seg1_end');
console.log('look',JSON.stringify(await p.evaluate(()=>{try{return __worldIntegration.snapshot()}catch(e){return String(e)}})).slice(0,300));
// segment 2: tap
await p.waitForTimeout(1000);M('seg2_tap');
if(V==='sill'){const g=chk.glass_screen;const x=(g.l+g.r)/2,y=(g.top+g.bottom)/2;
 await p.evaluate(([x,y])=>{const d=document.createElement('div');d.style.cssText=`position:fixed;left:${x-22}px;top:${y-22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.55);z-index:99999;transition:all .4s`;document.body.appendChild(d);setTimeout(()=>{d.style.opacity=0;d.style.transform='scale(1.6)'},50);document.getElementById('tip').style.display='none';__worldIntegration.leave();},[x,y]);}
else{const bx=await p.evaluate(()=>window.__gpState.box);const x=(bx.l+bx.r)/2,y=(bx.t+bx.b)/2;
 await p.evaluate(([x,y])=>{const g=document.getElementById('gp'),c=g.querySelector('.card'),r=g.querySelector('.ring'),rp=g.querySelector('.rip');
  const ms=f=>f*1000/30;
  c.style.transform='scale(.92)';c.style.filter='brightness(1.15)';                                   // f0-4 press in
  setTimeout(()=>{c.style.transition='transform .2s cubic-bezier(.3,1.6,.5,1)';c.style.transform='scale(.97)';},ms(4));
  r.animate([{borderColor:'rgba(255,248,220,0)',boxShadow:'0 0 0 rgba(255,240,200,0)'},{borderColor:'rgba(255,248,220,1)',boxShadow:'0 0 24px 6px rgba(255,236,180,.85)',offset:.45},{borderColor:'rgba(255,248,220,0)',boxShadow:'0 0 40px 12px rgba(255,236,180,0)'}],{duration:ms(16),delay:ms(3),fill:'forwards'}); // f3-19 ring glow
  rp.animate([{transform:'scale(1)',opacity:.9},{transform:'scale(1.9,2.6)',opacity:0}],{duration:ms(18),delay:ms(6),easing:'cubic-bezier(.2,.6,.3,1)',fill:'forwards'}); // f6-24 ripple
  g.animate([{opacity:1,filter:'blur(0)'},{opacity:0,filter:'blur(4px)'}],{duration:ms(10),delay:ms(16),fill:'forwards'}); // f16-26 fade
  setTimeout(()=>{window.__gpState.hidden=true;g.style.display='none';__worldIntegration.leave();},ms(27)); // f27 exit starts
 },[x,y]);
 }
await p.waitForFunction(()=>__worldIntegration.snapshot().state==='walking-out',{},{timeout:900000,polling:100});M('walking');
await p.waitForTimeout(6500);M('end');
await ctx.close();await b.close();})().catch(e=>{console.log('FATAL',String(e).slice(0,400));process.exit(1)});
