'use strict';
/** GGbot HUD API test (ui/StatusHud.ts): hide()/slideIn() idempotency, camera-relative fallback paths, interruptions,
 * capsule inset, Boot wiring, and a replay of the REAL WorldFlow timeline (tools/camera-frame-test/flow_sim.cjs).
 * Run: QF_TYPESCRIPT_MODULE=<vendor-node>/node_modules/typescript node tools/hud/test_status_hud.cjs */
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
process.exitCode=1;
const root=path.resolve(__dirname,'..','..'),S=path.join(root,'creator-build-project/assets/scripts');
const ts=require('../qf-env.cjs').typescript();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'status-hud-'));
fs.writeFileSync(path.join(tmp,'StatusHud.js'),ts.transpileModule(fs.readFileSync(path.join(S,'ui/StatusHud.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
const H=require(path.join(tmp,'StatusHud.js'));
let pass=0;const results=[];
async function t(name,fn){try{await fn();pass++;results.push(['PASS',name]);console.log('PASS',name);}catch(e){results.push(['FAIL',name,String(e&&e.stack||e)]);console.log('FAIL',name,'\n ',e&&e.message);}}
function rig(hasHooks){const logs=[];const log=(m,d)=>logs.push({m,...d});const hud=new H.StatusHud(log);const d=new H.StatusHudDriver(hud,{hasHooks},log);
  const r={hud,d,logs,now:0,step(sec,fps=60){const n=Math.round(sec*fps);for(let i=0;i<n;i++){d.tick(1/fps);r.now+=1/fps;}},
    slides:()=>logs.filter(l=>l.m==='gate-open'),moves:()=>logs.filter(l=>l.m==='slideIn'||l.m==='slideOut'),hides:()=>logs.filter(l=>l.m==='hide')};return r;}
const OUT=['standing','turning-out','walking-out','opening-door','crossing-out'];
// 运镜bot T2+ timeline (seconds from crossing-out start): crane 4.93 s, lasting 7.68 s, settled 12.6 s.
function outboundTo(r,{crane=true}={}){for(const s of OUT){r.d.onState(s);r.step(.5);} if(crane){r.step(4.93);r.d.onCraneStart({segment:'toIsland'});} }
(async()=>{
await t('gate hide/slideIn idempotent; empty content never shows; no double slide; position-only, monotone',()=>{const r=rig(true);
  assert.strictEqual(r.hud.state,'out','boot: no content -> off-screen');assert.strictEqual(r.hud.visible(),false);
  assert.strictEqual(r.hud.hide('a'),true);assert.strictEqual(r.hud.hide('b'),false);assert.strictEqual(r.hud.outFraction(),1);
  assert.strictEqual(r.hud.slideIn('x'),true);assert.strictEqual(r.hud.slideIn('y'),false);
  r.hud.tick(0);assert.deepStrictEqual(r.logs.filter(l=>l.m==='stay-hidden').map(l=>l.reason+':'+l.path),['empty:direct']);assert.strictEqual(r.hud.state,'out');assert.strictEqual(r.moves().length,0);
  for(let i=0;i<30;i++)r.hud.tick(1/60);assert.strictEqual(r.hud.visible(),false,'empty gate-open stays hidden');
  assert.strictEqual(r.hud.setContent(true),true);assert.strictEqual(r.hud.setContent(true),false);assert.strictEqual(r.hud.state,'sliding-in');
  let last=1;for(let i=0;i<30;i++){r.hud.tick(1/60);const f=r.hud.outFraction();assert.ok(f<=last+1e-12);last=f;}
  assert.strictEqual(r.hud.state,'shown');assert.strictEqual(r.hud.outFraction(),0);assert.strictEqual(r.hud.offsetY(100,26),0);
  assert.deepStrictEqual(r.moves().map(l=>l.m+':'+l.reason),['slideIn:content']);
  r.hud.setContent(false);assert.strictEqual(r.hud.state,'sliding-out');assert.strictEqual(r.hud.visible(),true);last=0;
  for(let i=0;i<30;i++){r.hud.tick(1/60);const f=r.hud.outFraction();assert.ok(f>=last-1e-12);last=f;}
  assert.strictEqual(r.hud.state,'out');assert.strictEqual(r.hud.visible(),false);assert.deepStrictEqual(r.moves().map(l=>l.m+':'+l.reason+':'+l.path),['slideIn:content:content-change','slideOut:empty:content-change']);
  r.hud.hide('c');assert.strictEqual(r.hud.offsetY(100,26),134);
  assert.ok(!/opacity|UIOpacity/.test(fs.readFileSync(path.join(S,'ui/StatusHud.ts'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'')));});
await t('content gating: content during cutscene stays hidden; gate opens with content -> slideIn(path); flicker reverses smoothly',()=>{const r=rig(true);
  r.d.onState('standing');r.hud.setContent(true);/* transition text */r.step(1);assert.strictEqual(r.hud.visible(),false,'gate closed hides transition text');
  for(const s of OUT.slice(1))r.d.onState(s);r.d.onSettled('island');r.d.onState('island');/* text still non-empty (e.g. error) */r.hud.setContent(true);
  assert.deepStrictEqual(r.moves().map(l=>l.m+':'+l.reason+':'+l.path),['slideIn:content:settled']);r.step(.5);assert.strictEqual(r.hud.state,'shown');
  r.hud.setContent(false);r.step(.1);const mid=r.hud.outFraction();assert.ok(mid>0&&mid<1);r.hud.setContent(true);r.hud.tick(1/60);const after=r.hud.outFraction();
  assert.ok(Math.abs(after-mid)<.1,'reversal is continuous');r.step(.5);assert.strictEqual(r.hud.state,'shown');
  assert.strictEqual(r.moves().length,3,'in, out, in — one log per direction change');
  r.hud.setContent(false);r.hud.setContent(false);r.step(.5);assert.strictEqual(r.hud.state,'out');assert.strictEqual(r.moves().length,4);});
await t('stale cutscene text at the settle callback never flashes the plate (gate resolves on next frame content)',()=>{const r=rig(true);
  r.d.onState('island');r.d.onState('walking-home');r.hud.setContent(true);for(const st of ['crossing-in','closing-door','walking-to-seat','sitting'])r.d.onState(st);
  r.d.onSettled('home');r.d.onState('home');/* callback-time content is still 'sitting' text */assert.strictEqual(r.hud.visible(),false);
  r.hud.setContent(false);r.hud.tick(1/60);assert.strictEqual(r.hud.visible(),false);assert.strictEqual(r.moves().length,0);
  assert.deepStrictEqual(r.logs.filter(l=>l.m==='stay-hidden').map(l=>l.path),['settled']);});
await t('content appears later while settled -> slides in then; gate re-closes on next cutscene (jump, no slide)',()=>{const r=rig(true);
  for(const s of OUT)r.d.onState(s);r.d.onSettled('island');r.d.onState('island');r.step(2);assert.strictEqual(r.hud.visible(),false,'island w/o text: hidden');
  r.hud.setContent(true);assert.strictEqual(r.hud.state,'sliding-in');r.step(.3);assert.strictEqual(r.hud.state,'shown');
  r.d.onState('walking-home');assert.strictEqual(r.hud.state,'hidden');assert.strictEqual(r.hud.outFraction(),1);});
await t('outbound hooks: settled BEFORE Boot polls island (real T2+ order) -> path=settled, no timer',()=>{const r=rig(true);outboundTo(r);
  r.step(12.6-4.93-0.5);assert.strictEqual(r.hud.gated,true);r.d.onSettled('island');assert.strictEqual(r.hud.gated,true,'not before island state');
  r.step(1/60);r.d.onState('island');assert.strictEqual(r.slides().length,1);assert.strictEqual(r.slides()[0].path,'settled');});
await t('outbound hooks: island EARLY (mid-crane), settle later -> waits for settle (no mid-crane slide)',()=>{const r=rig(true);outboundTo(r);
  r.step(2);r.d.onState('island');/* t=6.93 s after crossing-out */ r.step(5.6);assert.strictEqual(r.hud.gated,true,'still hidden mid-crane');
  r.d.onSettled('island');assert.strictEqual(r.slides()[0].path,'settled');});
await t('outbound hooks + crane, settle never comes -> timeout = crane remaining + 2 s (path=timeout-crane, logged)',()=>{const r=rig(true);outboundTo(r);
  r.step(2);r.d.onState('island');const wait=r.logs.find(l=>l.m==='await-settle');assert.strictEqual(wait.path,'timeout-crane');
  assert.ok(Math.abs(wait.timeout-(7.68-2+2))<.05,'remaining(5.68)+2='+wait.timeout);
  r.step(wait.timeout-.05);assert.strictEqual(r.hud.gated,true);r.step(.1);assert.strictEqual(r.hud.gated,false);
  const f=r.logs.find(l=>l.m==='fallback');assert.strictEqual(f.path,'timeout-crane');assert.ok(f.afterTarget>=7.6);});
await t('outbound hooks + crane: fallback capped at 10 s after island',()=>{const r=rig(true);for(const s of OUT){r.d.onState(s);r.step(.1);}r.d.onCraneStart({});
  r.d.onState('island');const w=r.logs.find(l=>l.m==='await-settle');assert.ok(Math.abs(w.timeout-9.68)<.05);
  const r2=rig(true);for(const s of OUT){r2.d.onState(s);}r2.d.onCraneStart({});r2.d.onState('island');/* remaining 7.68+2=9.68 <10 */
  // force a long crane estimate: crane fired, then island observed immediately -> still <= cap
  assert.ok(r2.logs.find(l=>l.m==='await-settle').timeout<=H.HUD_CRANE_CAP_SECONDS);
  const r3=rig(true);for(const s of OUT)r3.d.onState(s);r3.d.onCraneStart({});r3.d.onState('island');r3.step(10.05);assert.strictEqual(r3.hud.gated,false);});
await t('no T2+ hooks (no onCameraSettled API) -> 2 s after island (path=timeout-nohooks)',()=>{const r=rig(false);outboundTo(r,{crane:false});r.step(3);
  r.d.onState('island');assert.strictEqual(r.logs.find(l=>l.m==='await-settle').path,'timeout-nohooks');r.step(1.95);assert.strictEqual(r.hud.gated,true);r.step(.1);
  assert.strictEqual(r.hud.gated,false);assert.strictEqual(r.logs.find(l=>l.m==='fallback').path,'timeout-nohooks');});
await t('hooks but no crane (fixed mode) -> 2 s (path=timeout-nocrane)',()=>{const r=rig(true);outboundTo(r,{crane:false});r.d.onState('island');
  assert.strictEqual(r.logs.find(l=>l.m==='await-settle').path,'timeout-nocrane');r.step(2.05);assert.strictEqual(r.logs.find(l=>l.m==='fallback').path,'timeout-nocrane');});
await t('return: hide on walking-home; home after sitting + settled(home) -> settled; without settle -> 2 s; no hooks -> 2 s',()=>{
  for(const [hooks,settle,path] of [[true,true,'settled'],[true,false,'timeout-nocrane'],[false,false,'timeout-nohooks']]){const r=rig(hooks);
    r.d.onState('island');for(const s of ['walking-home','crossing-in','closing-door','walking-to-seat','sitting']){r.d.onState(s);r.step(1);}
    assert.strictEqual(r.hides().length,1);assert.strictEqual(r.hides()[0].reason,'walking-home');
    if(settle)r.d.onSettled('home');r.d.onState('home');if(!settle){r.step(1.9);assert.strictEqual(r.hud.gated,true);r.step(.2);}
    assert.strictEqual(r.hud.gated,false);assert.strictEqual(r.slides()[0].path,path,String([hooks,settle]));}});
await t('interruptions: cancelled leave -> home, paused, error, bounce standing->home->standing',()=>{
  for(const s of ['home','paused','error','level','skycity']){const r=rig(true);r.d.onState('standing');r.d.onState('walking-out');r.d.onState(s);
    assert.strictEqual(r.hud.gated,false,s);assert.strictEqual(r.slides()[0].path,'interrupt');}
  const r=rig(true);r.d.onState('standing');r.d.onState('home');r.d.onState('standing');assert.strictEqual(r.hud.gated,true);
  for(const s of OUT.slice(1))r.d.onState(s);r.d.onSettled('island');r.d.onState('island');assert.strictEqual(r.slides().length,2);assert.strictEqual(r.slides()[1].path,'settled');
  const c=rig(true);c.d.onState('island');c.d.onState('walking-home');c.d.onState('island');/* cancelled return */assert.strictEqual(c.slides()[0].path,'interrupt');});
await t('stale/foreign settles ignored; settle from a previous run cannot release the next hide',()=>{const r=rig(true);
  r.d.onSettled('island');r.d.onState('standing');r.d.onSettled('home');r.step(1);assert.strictEqual(r.hud.gated,true);
  for(const s of OUT.slice(1))r.d.onState(s);r.d.onState('island');assert.strictEqual(r.hud.gated,true,'island-run settle from before standing must not count');});
await t('never stuck: 60 s max hidden (path=timeout-max)',()=>{const r=rig(true);r.d.onState('standing');r.d.onState('walking-out');r.step(59.9,10);assert.strictEqual(r.hud.gated,true);r.step(.2,10);
  assert.strictEqual(r.hud.gated,false);assert.strictEqual(r.slides()[0].path,'timeout-max');});
await t('topInset: WeChat capsule bottom + 4 (canvas px), safe-area fallback, 0 off-WeChat',()=>{delete globalThis.wx;assert.strictEqual(H.topInset(800),0);
  globalThis.wx={getWindowInfo:()=>({windowHeight:400,safeArea:{top:20}}),getMenuButtonBoundingClientRect:()=>({top:24,bottom:56,left:280,right:367})};
  assert.strictEqual(H.topInset(800),120);globalThis.wx.getMenuButtonBoundingClientRect=()=>{throw Error('x');};assert.strictEqual(H.topInset(800),40);delete globalThis.wx;});
await t('Boot wiring: driver on state poll, plate slide per frame, hooks bound after ready, unsubscribed on destroy',()=>{
  const b=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8'),c=fs.readFileSync(path.join(S,'world-r1/WorldFlowComponent.ts'),'utf8');
  assert.ok(/import \{StatusHud,StatusHudDriver,topInset\} from '\.\/ui\/StatusHud'/.test(b));
  assert.ok(/private trackTransitionHud\(state:string\)\{[^}]*this\.islandEntrance=0;\s*this\.hudDriver\.onState\(state\);/.test(b));
  assert.ok(b.includes('this.trackTransitionHud(s.state);this.applyStatusHud(dt);'));
  assert.ok(b.includes("this.ready=true;girl.active=true;this.error='';this.bindHudHooks();"));
  assert.ok(/onDestroy\(\)\{for\(const off of this\.hudHooksOff\)/.test(b));
  assert.ok(/w\.onCameraSettled\(\(place:string\)=>this\.hudDriver\.onSettled\(place\)\)/.test(b)&&/w\.onCraneStart\(/.test(b));
  assert.ok(!/hudTransition\(/.test(b),'T2+ no-op stub replaced');
  assert.ok(b.includes('this.statusHud.setContent(!!this.statusText)')&&b.includes('plate.active=this.statusHud.visible()'),'content-gated plate');
  assert.ok(!b.includes("this.status.node.parent!.active=!!this.error||!!transitionText")&&!b.includes("if(s.state==='skycity')this.status.node.parent!.active=true"),'old per-frame active rule removed');
  assert.ok(/onCameraSettled\(listener/.test(c)&&/onCraneStart\(listener/.test(c),'T2+ hooks on WorldFlowComponent');
  assert.ok(/update\(dt:number\)\{[^}]*this\.paintNavigation\(dt\)/.test(b));});
await t('replay REAL WorldFlow (flow_sim, T2+ routes, 60 fps): hide at standing, slideIn exactly at settled island/home, never mid-crane',async()=>{
  const sim=require('../camera-frame-test/flow_sim.cjs');const env=sim.create();const out=await sim.run(env,{fps:60});
  const ev=out.cameraEvents,crane=ev.find(e=>e.kind==='crane-start'),setI=ev.find(e=>e.kind==='settled'&&e.place==='island'),setH=ev.find(e=>e.kind==='settled'&&e.place==='home');
  assert.ok(crane&&setI&&setH,'T2+ emits crane-start + settled island/home');
  // The sim holds only 10 frames on the island before returnHome; insert 15 s of island idle (a player looking around)
  // so the outbound fallback has room to fire. Everything after the island arrival hold shifts by IDLE frames.
  const IDLE=900,islandF=out.states.find(x=>x.state==='island').frame,shift=f=>f>islandF+5?f+IDLE:f;
  const st=out.states.map(x=>({...x,frame:shift(x.frame)}));for(const e of ev)e.frame=shift(e.frame);
  const frameOf=s=>st.find(x=>x.state===s).frame,co=frameOf('crossing-out');
  console.log('  timeline (s from crossing-out): crane',((crane.frame-co)/60).toFixed(2),'settled',((setI.frame-co)/60).toFixed(2));
  for(const variant of ['real','settle-late-2s','settle-lost']){
    const r=rig(true);const evs=[];
    for(const e of ev){if(e.kind==='settled'&&e.place==='island'){if(variant==='settle-lost')continue;evs.push({...e,frame:e.frame+(variant==='settle-late-2s'?120:0)});}else evs.push(e);}
    const last=Math.max(...out.frames.map(f=>f.frame))+IDLE+240;let si=0,polled=null,slideFrame=null,hideFrame=null;const byFrame=new Map();for(const f of st)byFrame.set(f.frame,f.state);
    let cur='';for(let f=0;f<=last;f++){const was=r.hud.gated;for(const e of evs)if(e.frame===f){e.kind==='crane-start'?r.d.onCraneStart(e):r.d.onSettled(e.place);}
      if(byFrame.has(f))cur=byFrame.get(f);/* Boot polls the snapshot once per frame (after the flow's sync change) */
      r.d.onState(cur);r.d.tick(1/60);if(!was&&r.hud.gated&&hideFrame===null)hideFrame=f;if(was&&!r.hud.gated&&slideFrame===null)slideFrame=f;}
    assert.strictEqual(hideFrame,frameOf('standing'),variant+' hide on standing');
    const sl=r.slides();assert.strictEqual(sl.length,2,variant+' one slide per transition: '+JSON.stringify(sl));
    if(variant==='real'){assert.strictEqual(slideFrame,setI.frame,'slide in the settle frame');assert.strictEqual(sl[0].path,'settled');}
    if(variant==='settle-late-2s'){assert.strictEqual(slideFrame,setI.frame+120);assert.strictEqual(sl[0].path,'settled');}
    if(variant==='settle-lost'){assert.strictEqual(sl[0].path,'timeout-crane');assert.ok(slideFrame>=crane.frame+Math.round(7.68*60),'not before crane end');}
    assert.ok(slideFrame>crane.frame+Math.round(7*60),variant+' never mid-crane');
    assert.strictEqual(sl[1].path,'settled',variant+' home settle');}});
console.log(`\n${pass}/${results.length} passed`);
fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results','status-hud.json'),JSON.stringify({pass,total:results.length,results},null,1)+'\n');
process.exitCode=pass===results.length?0:1;
})();
