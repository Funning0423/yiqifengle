/** BGM observers against the REAL GameAudio.ts from GB_INT_DIR (v0.4+: setMusic(path,bundle?) + two-source crossfade loop + scene crossfade).
 *  autoplay=observe (T0 drives nothing). Fake player: currentTime follows the fake clock and wraps when loop=true.
 *  Checks: one audio:bgm-playing for the whole loop phase (no bgm-stopped across loop crossfades), one audio:bgm-loop-seam per pass,
 *  GameAudio itself completed the crossfades, never more than 2 music voices, bgm-set for the bundle call and the old 1-arg call,
 *  and the new track playing after the scene crossfade. */
import {run,marks} from './harness';
import {clock} from './setup';
import {director,AudioSource,AudioClip,resources,assetManager,Node} from 'cc';
import {GameAudio} from '#gameaudio';
import * as GAM from '#gameaudio';
import {game,Game,js} from 'cc';
const N_idx=(L:string[],n:string)=>L.findIndex(l=>l.split(' ')[1]===n);
const fail=(m:string)=>{console.error('FAIL: '+m+'\n'+marks().join('\n'));process.exit(1);};
(async()=>{
 (GameAudio as any).now=()=>clock.ms;
 // harness.ts registers FakeGameAudio under 'GameAudio' AFTER the real class (RoomExploreOverlay -> AudioUnlock -> GameAudio is evaluated first
 // on int/v1 >= the audio-unlock merge): put the REAL class back so the observers wrap / read the real one.
 (js as any)._register('GameAudio',GameAudio);
 let refire:(()=>Promise<void>)|null=null;
 const G:any=globalThis,M:any=GAM,V5=typeof M.DEFAULT_BGM_BUNDLE==='string'&&typeof (GameAudio as any).onMusicStart==='function';
 const hookMode=process.env.GB_BGM_HOOK||'class',order=process.env.GB_BGM_ORDER||'unlock-first';
 // GB_BGM_HOOK: class (GameAudio.onMusicStart) | global (only __gameAudioMusic) | none (neither: GameAudio before v0.5) | late (both hidden until after the start -> replay)
 const origOn=(GameAudio as any).onMusicStart,origGlobal=G.__gameAudioMusic;
 const hide=()=>{Object.defineProperty(GameAudio,'onMusicStart',{value:undefined,configurable:true,writable:true});if(hookMode!=='global')delete G.__gameAudioMusic;else G.__gameAudioMusic={lastStart:origGlobal.lastStart,onMusicStart:(cb:any)=>origOn.call(GameAudio,cb)};};
 const restore=()=>{Object.defineProperty(GameAudio,'onMusicStart',{value:origOn,configurable:true,writable:true});G.__gameAudioMusic=origGlobal;};
 if(V5&&hookMode!=='class')hide();
 GameAudio.ensure();(director as any)._launch?.();const A:any=GameAudio.instance;const R:any=resources,AM:any=assetManager,S:any=AudioSource;
 if(typeof A.setMusic!=='function'||A.setMusic.length<1)fail('no setMusic');
 const DUR=10;let maxVoices=0;
 const tick=()=>{for(const s of S._all){if(!s.playing||!s.clip)continue;const t=(clock.ms-s._t)/1000;s.currentTime=s.loop?t%s.clip.duration:Math.min(t,s.clip.duration);}
  S.__advance();A.update?.(1/60);const music=[...S._all].filter((s:any)=>s.playing&&s.clip&&/^bgm_/.test(s.clip.name)).length;maxVoices=Math.max(maxVoices,music);};
 if(!V5){const bgm=R.loads.find((l:any)=>/audio_bgm\/bgm_main/.test(l.path));if(!bgm)fail('GameAudio did not request resources audio_bgm/bgm_main');
  bgm.cb(null,new (AudioClip as any)('bgm_main',DUR));A.onGesture?.();}
 else{
  // v0.5 (Voice bot 53f5999): nothing at startup; SceneMusic requests the island BGM (audio_bgm_island bundle, fadeIn) once
  // __worldLoading reports phase 'ready'. The boot stand-in is ready at 9.0 s; __worldLoading turns ready at 9.5 s (proves T0 prefers it).
  const READY_MS=9500,LOAD_BUNDLE_MS=800,LOAD_CLIP_MS=400,GESTURE_MS=order==='unlock-first'?3000:13000;
  G.__worldLoading={snapshot:()=>({phase:clock.ms>=READY_MS?'ready':'loading'})};
  let requested=-1,bundleDone=false,clipDone=false,gestured=false,lateRestored=false;const bl:any[]=[];
  const v5tick=()=>{tick();
   if(requested<0&&G.__worldLoading.snapshot().phase==='ready'){requested=clock.ms;A.setMusic(M.DEFAULT_BGM_PATH,M.DEFAULT_BGM_BUNDLE,{fadeIn:true});} // = SceneMusic.step first request
   if(!gestured&&clock.ms>=GESTURE_MS){gestured=true;const T=G.__gbTouch,e=(type:string)=>({type,touches:type==='touchstart'?[{identifier:7,clientX:30,clientY:120}]:[],changedTouches:[{identifier:7,clientX:30,clientY:120}],timeStamp:Date.now()});
    // blank-area raw touch through the prelude -> REAL AudioUnlock (wx.onTouchStart/End) -> GameAudio.notifyUserGesture(); else the GameAudio gesture directly
    if(T&&T.emit&&G.__audioUnlock){T.emit('onTouchStart',e('touchstart'));T.emit('onTouchEnd',e('touchend'));}else A.onGesture();}
   const b=AM.bundleLoads.find((x:any)=>x.name===M.DEFAULT_BGM_BUNDLE);
   if(b&&!bundleDone&&clock.ms>=requested+LOAD_BUNDLE_MS){bundleDone=true;const bundle={name:b.name,load:(p:string,_t:any,cb:any)=>bl.push({p,cb})};AM.bundles.set(b.name,bundle);b.cb(null,bundle);}
   if(bl.length&&!clipDone&&clock.ms>=requested+LOAD_BUNDLE_MS+LOAD_CLIP_MS){clipDone=true;if(bl[0].p!==M.DEFAULT_BGM_PATH)fail('bundle.load path '+bl[0].p);bl[0].cb(null,new (AudioClip as any)('bgm_main',DUR));}
   if(hookMode==='late'&&!lateRestored&&A.musicDiagnostics().lastStart&&clock.ms>=requested+3000){lateRestored=true;restore();}};
  await run(8,()=>false,v5tick);
  // board-ui 883dc9f loads board_art + ui/tools-original at startup: only audio requests count here
  if(R.loads.some((l:any)=>/bgm|audio/.test(l.path))||AM.bundleLoads.some((x:any)=>x.name===M.DEFAULT_BGM_BUNDLE||/audio|bgm/.test(x.name)))fail('music requested during the loading page: '+JSON.stringify({loads:R.loads.map((l:any)=>l.path),bundles:AM.bundleLoads.map((x:any)=>x.name)}));
  if(marks().some(l=>/ audio:bgm-(set|playing|start) /.test(l)))fail('bgm mark before room ready');
  await run(40,()=>false,v5tick);
  const L0=marks(),bs=L0.filter(l=>l.includes(' audio:bgm-start '));
  if(L0.some(l=>/ audio:bgm-set .*path=audio_bgm\//.test(l)))fail('old resources path requested');
  if(!L0.some(l=>/ audio:bgm-set .*path=audio\/bgm_main bundle=audio_bgm_island fadeIn=1/.test(l)))fail('bgm-set v0.5 fields');
  if(hookMode==='none'){if(bs.length||L0.some(l=>l.includes(' audio:bgm-start-hook ')))fail('bgm-start without onMusicStart API');}
  else{
   if(bs.length!==1)fail('audio:bgm-start count '+bs.length);const m=bs[0];const f=(k:string)=>{const r=new RegExp(' '+k+'=(\\S+)').exec(m);return r?r[1]:'';};
   const startMs=Number(f('startMs')),unlockMs=Number(((L0.find(l=>l.includes(' audio:unlock '))||'').split(' ')[2]));
   const via=hookMode==='global'?'__gameAudioMusic.onMusicStart':'GameAudio.onMusicStart';
   if(!new RegExp(` path=audio/bgm_main bundle=audio_bgm_island fadeIn=1 startMs=\\d+ `).test(m))fail('bgm-start path/bundle/fadeIn '+m);
   if(f('via')!==via||f('replay')!==(hookMode==='late'?'1':'0')||f('roomReadyVia')!=='__worldLoading'||f('unlocked')!=='1')fail('bgm-start via/replay/roomReadyVia/unlocked '+m);
   if(!(Math.abs(Number(f('requestToLoadMs'))-(LOAD_BUNDLE_MS+LOAD_CLIP_MS))<=34))fail('requestToLoadMs '+m);
   const rr=Number(f('roomReadyToRequestMs'));if(!(rr>=0&&rr<=20))fail('roomReadyToRequestMs '+m);
   const lts=Number(f('loadToStartMs')),rts=Number(f('roomReadyToStartMs')),uts=Number(f('unlockToStartMs')),qts=Number(f('requestToStartMs'));
   if(order==='unlock-first'){if(!(lts>=0&&lts<=20))fail('unlock-first: start should follow the load '+m);}
   else if(!(Math.abs(lts-(GESTURE_MS-(READY_MS+LOAD_BUNDLE_MS+LOAD_CLIP_MS)))<=40))fail('load-first: start should follow the gesture '+m);
   if(!(Math.abs(qts-(rts-rr))<=20))fail('requestToStartMs vs roomReady deltas '+m);
   if(!(Math.abs(uts-(startMs-unlockMs))<=20))fail('unlockToStartMs != startMs - unlock ms '+m);
   if(order==='load-first'&&!(uts>=0&&uts<=40))fail('load-first unlockToStartMs '+m);
   if(hookMode!=='late'&&N_idx(L0,'audio:bgm-start-hook')>N_idx(L0,'audio:bgm-start'))fail('hook after start');
   refire=async()=>{
   // background + back: GameAudio re-fires onMusicStart with first:false -> still ONE audio:bgm-start
   game.emit(Game.EVENT_HIDE);await run(1,()=>false,tick);game.emit(Game.EVENT_SHOW);await run(2,()=>false,tick);
   const ls=A.musicDiagnostics().lastStart;if(!ls||ls.first!==false)fail('expected a first:false re-fire after hide/show, lastStart='+JSON.stringify(ls));
   if(marks().filter(l=>l.includes(' audio:bgm-start ')).length!==1)fail('first:false re-fire logged');
   };
   console.error(m);}
 }
 if(!V5)await run(36,()=>false,tick);
 const L1=marks(),passes=L1.filter(l=>l.includes(' audio:bgm-loop-seam ')).length,xf=A.musicDiagnostics()?.loopCrossfade?.completed;
 if(L1.filter(l=>l.includes(' audio:bgm-playing ')).length!==1)fail('bgm-playing count during loop phase');
 if(L1.some(l=>l.includes(' audio:bgm-stopped ')))fail('bgm-stopped across a loop crossfade');
 if(!(passes>=3))fail('loop seams '+passes);if(xf!==undefined&&!(xf>=3))fail('GameAudio loopCrossfade.completed '+xf);
 if(!L1.some(l=>/ audio:bgm-playing .*clip=bgm_main .*loop=1 /.test(l)))fail('bgm-playing detail');
 // audio:peak-instances: 2 music voices during loop crossfades; GB_BGM_PEAK=1 adds 9 more playing AudioSources -> over=1
 if(V5&&process.env.GB_BGM_PEAK){const n=new (Node as any)('GB_TEST_PEAK');director.getScene()!.addChild(n);const extra:any[]=[];for(let i=0;i<9;i++){const a=n.addComponent(AudioSource);a.clip=new (AudioClip as any)('sfx_test_'+i,30);a.play();extra.push(a);}
  await run(1.5,()=>false,tick);for(const a of extra)a.stop();}
 if(V5){const P=marks().filter(l=>l.includes(' audio:peak-instances ')&&!l.includes('summary=1'));const top=P.length?Number(/ peak=(\d+)/.exec(P[P.length-1])![1]):0;
  const want=process.env.GB_BGM_PEAK?10:2;if(process.env.GB_BGM_PEAK?top<want:top!==want)fail('peak-instances max '+top+' want '+want+'\n'+P.join('\n'));
  if(!P.some(l=>/ peak=2 playing=2 clips=bgm_main,bgm_main limit=8 over=0 /.test(l)))fail('peak 2 during loop crossfade');
  if(process.env.GB_BGM_PEAK&&!/ limit=8 over=1 /.test(P[P.length-1]))fail('over=1 flag');}
 if(refire)await refire();
 if(V5&&refire){const S=marks().filter(l=>l.includes(' audio:peak-instances ')&&l.includes('summary=1'));if(S.length!==1||!/ reason=app-hide peak=\d+ /.test(S[0]))fail('peak summary at app hide '+S.join(' | '));
  if(process.env.GB_BGM_PEAK&&!/ over=1 overMs=(\d+)/.test(S[0]))fail('summary over');if(process.env.GB_BGM_PEAK&&!(Number(/ overMs=(\d+)/.exec(S[0])![1])>=1000))fail('overMs '+S[0]);
  console.error(S[0]);}
 // scene switch through the new optional bundle arg
 A.setMusic('audio/bgm_skycity','region_skycity');
 const bl=AM.bundleLoads.find((b:any)=>b.name==='region_skycity');if(!bl)fail('no loadBundle(region_skycity)');
 const loads:any[]=[];const bundle={load:(p:string,_t:any,cb:any)=>loads.push({p,cb})};AM.bundles.set('region_skycity',bundle);bl.cb(null,bundle);
 if(!loads.length||loads[0].p!=='audio/bgm_skycity')fail('bundle.load path');loads[0].cb(null,new (AudioClip as any)('bgm_skycity',DUR));
 await run(3,()=>false,tick);
 const sc=A.loopSource;if(!sc?.playing||sc.clip?.name!=='bgm_skycity')fail('skycity not playing after scene crossfade');
 // old one-arg call (resources) still works
 A.setMusic('audio_bgm/bgm_main');const back=R.loads.filter((l:any)=>/audio_bgm\/bgm_main/.test(l.path));if(back.length<(V5?1:2))fail('1-arg setMusic did not load from resources');
 back[back.length-1].cb(null,new (AudioClip as any)('bgm_main',DUR));await run(3,()=>false,tick);
 const L=marks();
 if(!L.some(l=>/ audio:bgm-set .*path=audio\/bgm_skycity/.test(l))||!L.some(l=>/ audio:bgm-set .*path=audio_bgm\/bgm_main/.test(l)))fail('bgm-set marks');
 if(A.loopSource?.clip?.name!=='bgm_main'||!A.loopSource.playing)fail('back to bgm_main');
 if(maxVoices>2)fail('music voices '+maxVoices);
 if(L.some(l=>l.includes('unregistered=1')))fail('unregistered mark');
 console.error(L.filter(l=>/ audio:bgm/.test(l)).join('\n'));
 console.error(`PASS integration bgm (real GameAudio ${V5?'v0.5 order='+order+' hook='+hookMode:'v0.4'}: loop seams=${passes} crossfades=${xf} maxMusicVoices=${maxVoices}; bundle + 1-arg setMusic)`);
})().catch(e=>fail(String(e?.stack||e)));
