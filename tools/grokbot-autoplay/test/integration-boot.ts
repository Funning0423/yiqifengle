/** GB_BOOT job: boot:* marks end-to-end (REAL prelude for __gbBoot + wx.loadSubpackage wrapper, REAL glue) on the fake engine with a fake
 *  epoch clock: scene events after T0 eval, game.totalTime, assetManager.loadBundle + bundle load/loadDir, resources.load, Boot loading
 *  layer (mask/backdrop/sprite/UIOpacity fade), status text, room first frame, summary; then out-and-back for camera-first-settled,
 *  camera-return-settled and home-seated inboundMs/capMs. */
import {run,marks,names,boot,scene} from './harness';
import {subLoads} from './setup';
import {director,game,Node,assetManager,resources} from 'cc';
const fail=(m:string)=>{console.error('FAIL: '+m+'\n'+marks().join('\n'));process.exit(1);};
const G:any=globalThis;
(async()=>{
 const D:any=director,AM:any=assetManager,R:any=resources,ap=()=>G.__GB_AUTOPLAY;
 D.scene=null;(game as any).totalTime=1200;(game as any).inited=false;(game as any).once=(t:string,f:any)=>(game as any).on(t,f);
 const B:any=boot,mask:any=new Node('LoadingOpaqueUntilWorldReady'),bd:any=new Node('ApprovedLoadingReference');B.loadingMask=mask;B.loadingBackdrop=bd;B.status={string:'正在准备海岛'};
 let bundle:any=null;const bl:any={dirs:[],loads:[]};
 await run(400,()=>ap()&&(ap().phase()==='done'||ap().phase()==='failed'),f=>{
  if(f===1){(game as any).emit('game_inited');D._emit('director_before_scene_loading','WorldR5Integration');D._emit('director_before_scene_launch',scene);D.scene=scene;D._emit('director_after_scene_launch',scene);}
  if(f===30){G.wx.loadSubpackage({name:'region_island',success:()=>{}});AM.loadBundle('region_island',(e:any,b:any)=>{bundle=b;});R.load('ui/loading-reference','ImageAsset',()=>{});}
  if(f===80)R.loads.find((l:any)=>l.path==='ui/loading-reference')?.cb(null,{width:710});
  if(f===90)bd._c.set('cc.Sprite',{spriteFrame:{}});
  if(f===300)subLoads[0].o.success({});
  if(f===310){const b={load(p:string,_t:any,cb:any){bl.loads.push({p,cb});},loadDir(p:string,_t:any,cb:any){bl.dirs.push({p,cb});}};AM.bundles.set('region_island',b);AM.bundleLoads.find((x:any)=>x.name==='region_island').cb(null,b);}
  if(f===312){bundle.loadDir('',null,()=>{});}
  if(f===360){bl.dirs[0].cb(null,[{},{}]);B.status.string='正在准备角色与动画';bundle.loadDir('character',null,()=>{});bundle.load('character/anim_meta',null,()=>{});}
  if(f===440){bl.dirs[1].cb(null,[{}]);bl.loads[0].cb(null,{});B.status.string='正在准备房间';}
  if(f===530)bd._c.set('cc.UIOpacity',{opacity:128});
  if(f===540){mask.active=false;bd.active=false;}});
 await run(1,()=>false); // fallback-velocity needs 10 still frames after home (autoplay stops at home-seated)
 const hook=!!process.env.GB_CAMERA_HOOK;
 const L=marks(),N=names(),get=(n:string)=>L.find(l=>l.split(' ')[1]===n)||'',t=(n:string)=>{const m=/ t=(-?\d+)/.exec(get(n));return m?Number(m[1]):NaN;};
 if(ap().phase()!=='done')fail('autoplay phase '+ap().phase());
 const order=['boot:game-js','boot:engine-init','boot:t0-eval','boot:game-inited','boot:scene-loading','boot:scene-launch-begin','boot:scene-launch-end','boot:boot-found','boot:world-loading','boot:loading-shown',
  'boot:bundle-begin:region_island','boot:loading-image','boot:subpackage:region_island','boot:bundle-end:region_island','boot:loading-fade-start','boot:world-ready','boot:loading-hidden','boot:room-first-frame','boot:summary',
  'boot:camera-first-settled','boot:camera-return-settled'];
 const idx=order.map(o=>N.indexOf(o));if(idx.some(i=>i<0)||idx.some((v,i)=>i&&v<idx[i-1]))fail('order '+JSON.stringify(order.map((o,i)=>o+'@'+idx[i])));
 if(!/origin=prelude-game.js .*sceneAtEval=0 .*prelude=1 subWrapped=1/.test(get('boot:t0-eval')))fail('t0-eval '+get('boot:t0-eval'));
 if(!/via=game.totalTime totalTimeMs=1200/.test(get('boot:engine-init'))||t('boot:t0-eval')-t('boot:engine-init')!==1200)fail('engine-init');
 if(!/scene=WorldR5Integration/.test(get('boot:scene-loading')))fail('scene-loading name');
 const near=(a:number,b:number,e=20)=>Math.abs(a-b)<=e;
 const sp=/beginT=(\d+) durMs=(\d+) ok=1/.exec(get('boot:subpackage:region_island'));if(!sp||!near(Number(sp[2]),4500))fail('subpackage '+get('boot:subpackage:region_island'));
 if(!/durMs=(\d+) ok=1/.test(get('boot:bundle-end:region_island'))||!near(Number(/durMs=(\d+)/.exec(get('boot:bundle-end:region_island'))![1]),4667))fail('bundle-end '+get('boot:bundle-end:region_island'));
 const A=L.filter(l=>l.includes(' boot:asset '));
 if(!A.some(l=>/bundle=resources fn=load path=ui\/loading-reference .*durMs=833 ok=1/.test(l)))fail('resources asset '+A.join(' | '));
 if(!A.some(l=>/bundle=region_island fn=loadDir path=character .*durMs=1333 ok=1 n=1/.test(l))||!A.some(l=>/bundle=region_island fn=loadDir path=- .*n=2/.test(l))||!A.some(l=>/fn=load path=character\/anim_meta/.test(l)))fail('island assets '+A.join(' | '));
 if(L.filter(l=>l.includes(' boot:status ')).length!==3)fail('status texts');
 if(!/opacity=128/.test(get('boot:loading-fade-start'))||!/fade=opacity/.test(get('boot:loading-hidden')))fail('fade');
 if(!/via=after-draw/.test(get('boot:room-first-frame'))||t('boot:room-first-frame')<t('boot:loading-hidden'))fail('first frame');
 const S=get('boot:summary');if(!/origin=prelude-game.js reason=room-first-frame /.test(S)||!/ d\.islandBundle=46\d\d /.test(S)||/incomplete=1/.test(S)||!/ total=\d+$/.test(S))fail('summary '+S);
 if(L.filter(l=>l.includes(' boot:summary ')).length!==1)fail('summary once');
 if(!new RegExp(hook?'place=island source=hook':'place=home source=fallback-velocity').test(get('boot:camera-first-settled')))fail('first settled '+get('boot:camera-first-settled'));
 const RS=L.filter(l=>l.includes(' boot:camera-return-settled '));if(RS.length!==1||!/n=1 sinceWalkingHomeMs=\d+/.test(RS[0]))fail('return settled '+RS.join(' | '));
 if(!/inboundMs=\d+ capMs=90000/.test(get('home-seated')))fail('home-seated '+get('home-seated'));
 if(!L.some(l=>/ boot:launch .*scene=1001 queryKeys=gbHold/.test(l))||!L.some(l=>/ boot:wx-perf .*now=\d+ perfNow=\d+ entries=0/.test(l)))fail('launch/wx-perf');
 if(!get('boot:splash-unavailable'))fail('splash-unavailable note');
 if(L.some(l=>l.includes('unregistered=1')))fail('unregistered '+L.find(l=>l.includes('unregistered=1')));
 // asset lines stop after the summary (boot window only)
 const si=L.indexOf(S);if(L.slice(si+1).some(l=>l.includes(' boot:asset ')))fail('asset after summary');
 console.error(L.filter(l=>/ boot:/.test(l)).map(l=>l.replace(/ wall=\S+ epoch=\d+/,'')).join('\n'));
 console.error(`PASS integration boot (prelude origin, ${A.length} asset lines, summary + return settle)`);
})().catch(e=>fail(String(e?.stack||e)));
