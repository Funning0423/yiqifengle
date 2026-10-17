'use strict';
// node rec11.cjs <day|night> WxH <chest|next|home>
const fs=require('fs'),path=require('path');
const {chromium}=require('/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/cursor-worktree/tools/qf-env.cjs').playwright();
const [mode,wh,act]=process.argv.slice(2);const [VW,VH]=wh.split('x').map(Number);const VP={width:VW,height:VH};VPH=VH;
const OUT=path.join(__dirname,'raw');fs.mkdirSync(OUT,{recursive:true});const tag=`rs_${mode}_${wh}_${act}`;
const marks=[],logs=[],errors=[],net=[],motion=[];let t0=Date.now();const T=()=>+((Date.now()-t0)/1000).toFixed(3);const M=(k,v)=>{marks.push([T(),k,v]);console.log(tag,T(),k,v!==undefined?JSON.stringify(v).slice(0,400):'');};
let b,ctx,p;
(async()=>{try{
b=await chromium.launch({executablePath:process.env.QF_CHROMIUM_EXECUTABLE,args:['--autoplay-policy=no-user-gesture-required']});
const want=mode==='day'?12:23;const u=new Date().getUTCHours();let off=((want-u)%24+24)%24;if(off>12)off-=24;const TZ=off===0?'Etc/GMT':'Etc/GMT'+(off>0?'-':'+')+Math.abs(off);
ctx=await b.newContext({viewport:VP,deviceScaleFactor:2,hasTouch:true,timezoneId:TZ,recordVideo:{dir:OUT+'/tmp-'+tag,size:VP}});
p=await ctx.newPage();await p.addInitScript(()=>{globalThis.__worldFlowLog=true;});await p.addInitScript({path:__dirname+'/audio-init.js'});await p.addInitScript({path:__dirname+'/raf-init.js'});
p.on('console',m=>logs.push([T(),m.type(),m.text().slice(0,1500)]));p.on('pageerror',e=>errors.push([T(),String(e).slice(0,400)]));p.on('response',r=>{if(r.status()>=400)net.push([T(),r.status(),r.url().replace(/^https?:\/\/[^/]+/,'')])});
t0=Date.now();T0abs=t0;M("tz",TZ);
const sleep=ms=>p.waitForTimeout(ms);const ev=f=>p.evaluate(f).catch(e=>'ERR '+e.message);
const st=()=>ev(()=>{try{return __worldIntegration.snapshot().state}catch(e){return 'NA'}});
const waitSt=async(s,to)=>{const a=Date.now();while(Date.now()-a<to){if(await st()===s)return true;await sleep(250)}return false};
const shot=n=>p.screenshot({path:OUT+'/'+tag+'_'+n+'.png'}).catch(()=>{});
mon=true;(async()=>{let last='';while(mon){const r=await ev(()=>{try{const s=__worldIntegration.snapshot();return JSON.stringify([s.state,(s.journey&&s.journey.region)||'',(s.journey&&s.journey.phase)||''])}catch(e){return 'NA'}});if(r!==last){motion.push([T(),r]);last=r;}await sleep(200);}})();
const nodes=(popup)=>p.evaluate(async(popup)=>{const {director,UITransform,Label}=await System.import('cc');const W=innerWidth,H=innerHeight,out=[];
 const visit=(n,inP,d)=>{if(!n.activeInHierarchy)return;const here=inP||!popup||n.name===popup;if(here){const t=n.getComponent(UITransform);if(t){const own=n.getComponent(Label);const bb=t.getBoundingBoxToWorld();out.push({n:n.name,d,l:own?own.string:'',x:+(bb.x+W/2).toFixed(1),y:+(H/2-bb.y-bb.height).toFixed(1),w:+bb.width.toFixed(1),h:+bb.height.toFixed(1)});}}for(const c of n.children)visit(c,here,here?d+1:0);};
 visit(director.getScene(),false,0);return out;},popup).catch(e=>[]);
const bs=()=>ev(()=>{const b=__worldIntegration.board();if(!b||!b.snapshot)return null;const a=b.snapshot.active;return {st:b.snapshot.state,status:a.status,moves:a.moves,t:a.board.map(c=>c?c.type:-9),pop:b.popups,tiles:b.layout.tiles,tg:b.layout.targets,stage:a.stageId}});
await p.goto('http://127.0.0.1:8899/',{waitUntil:'commit'});M('goto');
if(!await waitSt('home',120000))M('homeFail');M('home');
await sleep(6000);await shot('home_sign');
const gs=await ev(()=>JSON.stringify(__worldIntegration.glassSign&&__worldIntegration.glassSign()));M('glassDiag',gs);
const dprv=await p.evaluate(()=>devicePixelRatio);let signOut=false;
try{const g=JSON.parse(gs);if(g&&g.box){const b=g.box;const cx=(b.l+b.r)/2/dprv,cy=VPH-((b.t+b.b)/2)/dprv;M('signBoxCss',{l:b.l/dprv,r:b.r/dprv,top:VPH-b.t/dprv,bot:VPH-b.b/dprv,cx,cy});await p.touchscreen.tap(cx,cy);M('tapSign',[cx,cy]);await sleep(150);await shot('sign_tap150');await sleep(250);await shot('sign_tap400');
 for(let i=0;i<20;i++){const s=await st();if(s!=='home'){signOut=true;M('signLeaveState',s);break;}await sleep(250);}}}catch(e){M('signErr',String(e))}
if(!signOut){await p.touchscreen.tap(195,160);M('realTapHome',[195,160]);}
await sleep(signOut?1000:6000);await shot('home12s');M('homeHold12s');
if(!signOut)M('leave',await ev(()=>JSON.stringify(__worldIntegration.leave())));
if(process.env.VIS){(async()=>{await sleep(21000);M('visHide');await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await sleep(4000);M('visShow');await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'));});await sleep(3000);M('muteOn',await p.evaluate(async()=>{const cc=await System.import('cc');const G=cc.js.getClassByName('GameAudio');const i=G&&(G.instance||(G.ensure&&G.ensure()));if(!i)return 'noGA';i.setMuted(true);return 'ok'}).catch(e=>'ERR '+e.message));await sleep(3000);M('muteOff',await p.evaluate(async()=>{const cc=await System.import('cc');const G=cc.js.getClassByName('GameAudio');const i=G&&G.instance;if(!i)return 'noGA';i.setMuted(false);return 'ok'}).catch(e=>'ERR '+e.message));})();}
if(!await waitSt('island',240000))M('islandFail');M('island');await sleep(2500);await shot('island');
for(let k=0;k<4&&await st()==='island';k++){const q=await ev(()=>__worldIntegration.layout().targets.mainline);await p.touchscreen.tap(q.x,q.y);M('tapMainline',q);await sleep(7000);}
for(let i=0;i<60;i++){const x=await bs();if(x&&x.st==='run.ready')break;await sleep(1000);}
let x=await bs();M('board',{stage:x&&x.stage,moves:x&&x.moves});
const best=(t)=>{const N=7;let bs=null,bv=-1;const g=(a,r,c)=>r<0||c<0||r>=N||c>=N?-99:a[r*N+c];for(let r=0;r<N;r++)for(let c=0;c<N;c++)for(const[dr,dc]of[[0,1],[1,0]]){const r2=r+dr,c2=c+dc;if(r2>=N||c2>=N)continue;const a=t.slice();const i1=r*N+c,i2=r2*N+c2;if(a[i1]<0||a[i2]<0)continue;[a[i1],a[i2]]=[a[i2],a[i1]];let v=0;for(const[rr,cc]of[[r,c],[r2,c2]]){const X=a[rr*N+cc];let h=1,k=1;while(g(a,rr,cc-k)===X){h++;k++}k=1;while(g(a,rr,cc+k)===X){h++;k++}let w=1;k=1;while(g(a,rr-k,cc)===X){w++;k++}k=1;while(g(a,rr+k,cc)===X){w++;k++}if(h>=3)v+=h*(X===0?10:1);if(w>=3)v+=w*(X===0?10:1);}if(v>bv){bv=v;bs=[i1,i2]}}return bv>0?bs:null};
const cdp=await ctx.newCDPSession(p);const tp=(type,pt)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pt?[{x:pt.x,y:pt.y}]:[]});
for(let n=0;n<40;n++){x=await bs();if(!x||x.status!=='playing')break;if(x.pop&&x.pop.length&&x.tg.GotIt){await p.touchscreen.tap(x.tg.GotIt.x,x.tg.GotIt.y);await sleep(1500);continue;}
 const m=best(x.t);if(!m){await sleep(1500);continue}const A=x.tiles[m[0]],B=x.tiles[m[1]];await tp('touchStart',A);for(let s=1;s<=5;s++)await tp('touchMove',{x:A.x+(B.x-A.x)*s/5,y:A.y+(B.y-A.y)*s/5});await tp('touchEnd');await sleep(2300);if(n===2)await shot('level');}
x=await bs();M('levelEnd',{st:x&&x.st,status:x&&x.status,moves:x&&x.moves,pop:x&&x.pop});
await sleep(2500);await shot('result_closed');
const LS=()=>p.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k)}return o});
const S0=await LS();const N0=await nodes('ResultPanel');fs.writeFileSync(OUT+'/'+tag+'_result_nodes.json',JSON.stringify(N0));
const face=(lab)=>{const N=N0;const hb=N.filter(n=>n.l===lab)[0];if(!hb)return null;const f=N.filter(n=>n.n==='Face'&&n.x<=hb.x&&n.x+n.w>=hb.x+hb.w&&n.y<=hb.y&&n.y+n.h>=hb.y+hb.h)[0]||hb;return {x:f.x+f.w/2,y:f.y+f.h/2}};
let S1,S2;
if(act==='chest'){const ch=N0.filter(n=>/chest/i.test(n.n)).sort((a,b)=>b.w*b.h-a.w*a.h)[0];const c={x:ch.x+ch.w/2,y:ch.y+ch.h/2};await p.touchscreen.tap(c.x,c.y);M('tapChest1',c);await sleep(3500);await shot('result_open');S1=await LS();M('pop1',(await bs())?.pop);await p.touchscreen.tap(c.x,c.y);M('tapChest2');await sleep(2500);S2=await LS();M('pop2',(await bs())?.pop);await shot('result_open2');fs.writeFileSync(OUT+'/'+tag+'_result_nodes_open.json',JSON.stringify(await nodes('ResultPanel')));}
else{const f=face(act==='next'?'下一关':'回小岛');M('tapBtn',f);await p.touchscreen.tap(f.x,f.y);for(let i=0;i<12;i++){await sleep(300);const po=(await bs())?.pop;if(po&&po.some(x=>/Reward/.test(x)))M('REWARDPANEL',po);}await sleep(3000);M('stateAfter',await st());M('popAfter',(await bs())?.pop);await shot('after');S1=await LS();
 await p.reload({waitUntil:'commit'});await waitSt('home',120000);await sleep(2000);S2=await LS();M('reloaded');}
const diff=(A,B)=>{const o={};for(const k of new Set([...Object.keys(A),...Object.keys(B)]))if(A[k]!==B[k])o[k]=[(A[k]||'').slice(0,1500),(B[k]||'').slice(0,1500)];return o};
fs.writeFileSync(OUT+'/'+tag+'_storage.json',JSON.stringify({S0,S1,S2,d01:diff(S0,S1),d12:diff(S1,S2)},null,1));M('storageDiffKeys',{d01:Object.keys(diff(S0,S1)),d12:Object.keys(diff(S1,S2))});
M('end');
}catch(e){M('FAIL',String(e).slice(0,300));}finally{
mon=false;try{const b64=await p.evaluate(()=>window.__rec.stop());fs.writeFileSync(OUT+'/'+tag+'.audio.webm',Buffer.from(b64,'base64'));M('audioSaved',await p.evaluate(()=>({start:window.__rec.startEpoch,run:window.__rec.runningEpoch,first:window.__rec.firstSoundEpoch,err:window.__rec.err})).then(o=>({startMs:o.start-T0abs,runMs:(o.run||0)-T0abs,firstMs:(o.first||0)-T0abs,err:o.err})).catch(e=>String(e)))}catch(e){M('audioFail',String(e).slice(0,200))}
fs.writeFileSync(OUT+'/'+tag+'.json',JSON.stringify({marks,errors,net,motion},null,0));fs.writeFileSync(OUT+'/'+tag+'_worldFlowLog.txt',logs.map(l=>l.join('\t')).join('\n'));
try{await ctx.close();await b.close()}catch{}
try{const d=OUT+'/tmp-'+tag;for(const f of fs.readdirSync(d))fs.renameSync(d+'/'+f,OUT+'/'+tag+'.webm');fs.rmdirSync(d)}catch{}process.exit(0);}
})();
var night,T0abs;
var mon;

var VPH;
