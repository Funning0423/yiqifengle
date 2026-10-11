/** out-and-back end-to-end + observers (audio/app/segments/camera-settled). */
import {run,marks,names,calls,states,env,flow,game,Game,FakeGameAudio,FakeCheerTextHost,engine} from './harness';
const fail=(m:string)=>{console.error('FAIL: '+m+'\n'+marks().join('\n'));process.exit(1);};
(async()=>{
 const ap=()=>(globalThis as any).__GB_AUTOPLAY;
 await run(240,()=>ap()&&(ap().phase()==='done'||ap().phase()==='failed'));
 // after the autoplay: observers must keep logging (manual play by Voice bot)
 const A:any=FakeGameAudio.instance;const T6=new FakeCheerTextHost();A.onBoardFrame({kind:'action'});A.onBoardFrame({kind:'clear'});A.onBoardFrame({kind:'clear'});A.onBoardFrame({kind:'clear'});T6.show(0,{kind:'clear',wave:{removed:[{index:0}]}});T6.show(1,{kind:'clear',wave:{removed:[]}});T6.show(0,undefined);A.onRender('result.saved',true);A.onChestResult({newlyGrantedRewards:[1]});A.onClaimResult({ok:true});A.setMusic('audio_bgm/bgm_main');
 A.setMusicVolume(0.5);A.loopSource.playing=true;A.loopSource.currentTime=47.9;await run(0.1,()=>false);A.loopSource.currentTime=0.05;await run(0.05,()=>false);A.setMuted(true);A.play('sfx_ui_click',0.8);A.setMuted(false);(game as any).emit(Game.EVENT_HIDE);A.loopSource.playing=false;await run(0.1,()=>false);(game as any).emit(Game.EVENT_SHOW);(globalThis as any).__wxHide?.();(globalThis as any).__wxShow?.();
 // walk driver marks via __worldIntegration.onFoot / onApronLift (fake emitter with the real payload shape)
 {let foot:any=null,apron:any=null;(globalThis as any).__worldIntegration={onFoot:(cb:any)=>{foot=cb;return ()=>{foot=null;};},onApronLift:(cb:any)=>{apron=cb;return ()=>{apron=null;};}};await run(0.05,()=>false);
  if(!foot||!apron)fail('anim hooks not installed');foot({event:'foot:R',bone:'foot.R',body:'L',clip:'walk_loop',phase:0,time:0,cycle:3,pos:[1.23456,0,-2.5]});apron('full',1.6);}
 const L=marks(),N=names();console.error(L.join('\n'));
 if(ap().phase()!=='done')fail('phase '+ap().phase());
 if(calls.leave!==1||calls.ret!==1)fail('calls '+JSON.stringify(calls));
 const need=['standing','turning-out','walking-out','opening-door','crossing-out','island','walking-home','crossing-in','closing-door','walking-to-seat','sitting','home'];
 const seen=states.slice(states.indexOf('standing'));if(JSON.stringify(seen)!==JSON.stringify(need))fail('flow states '+JSON.stringify(seen));
 const order=['autoplay-installed','autoplay-armed','world-ready','tap-door','state:standing','seg:toDoor:start','seg:toDoor:end','state:opening-door','seg:crossing-out:start','seg:crossing-out:end','seg:toIsland:start','seg:toIsland:end','state:island','island-arrived','hold-start','hold-end','tap-return','state:walking-home','seg:toThreshold:end','seg:crossing-in:start','seg:crossing-in:end','state:closing-door','seg:toSeat:start','seg:toSeat:end','state:sitting','home-seated','autoplay-done'];
 const idx=order.map(o=>N.indexOf(o));if(idx.some(i=>i<0)||idx.some((v,i)=>i&&v<idx[i-1]))fail('order '+JSON.stringify(order.map((o,i)=>o+'@'+idx[i])));
 for(const st of ['state:crossing-out','state:crossing-in','state:walking-to-seat'])if(!N.includes(st))fail('missing '+st);
 if(!N.includes('seg:toThreshold:start')||N.indexOf('seg:toThreshold:start')<N.indexOf('hold-end'))fail('toThreshold start');
 const ms=(n:string)=>Number(L.find(l=>l.split(' ')[1]===n)!.split(' ')[2]);if(ms('hold-end')-ms('hold-start')<3000||ms('hold-end')-ms('hold-start')>3100)fail('hold');
 if(!L.every(l=>/^GB_MARK \S+ \d+ wall=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d epoch=\d+ frame=-?\d+ state=\S+/.test(l)))fail('format');
 const settleSrc=env.cameraHook?'source=hook':'source=fallback-velocity';
 for(const p of ['island','home'])if(!L.some(l=>l.includes(' camera-settled:'+p+' ')&&l.includes(settleSrc)))fail('camera-settled:'+p+' '+settleSrc);
 if(!env.cameraHook&&!N.includes('camera:settle-hook'))fail('no unavailable notice');
 if(ms('camera-settled:island')<ms('state:island'))fail('settle before island');
 for(const n of ['audio:hooked','audio:combo-reset','audio:clear','audio:level-complete','audio:chest','audio:bgm-set','audio:bgm-playing','audio:bgm-stopped','app:hide','app:show','app:wx-hide','app:wx-show'])if(!N.includes(n))fail('missing '+n);
 if(!L.some(l=>l.includes('audio:clear')&&l.includes('wave=3 tier=combo_2')))fail('combo tier');
 const C=L.filter(l=>l.includes(' ui:cheer-text '));if(C.length!==3||!/tier=0 word=Great! decision=show source=clear x=-96 y=84 replaced=-1/.test(C[0])||!/tier=1 .*decision=replace source=center .*replaced=0/.test(C[1])||!/tier=0 .*decision=skip/.test(C[2]))fail('ui:cheer-text '+C.join(' | '));
 if(!L.some(l=>l.includes('audio:chest')&&l.includes('source=chest'))||!L.some(l=>l.includes('audio:chest')&&l.includes('source=claim')))fail('chest source');
 if(JSON.stringify(A.played)!==JSON.stringify(['sfx_match_normal','sfx_combo_1','sfx_combo_2','sfx_level_clear','sfx_chest_open','sfx_chest_open','sfx_ui_click']))fail('audio behaviour changed '+A.played);
 if(!L.some(l=>/ anim:foot \d+ .* event=foot:R bone=foot\.R body=L clip=walk_loop phase=0\.000 cycle=3 pos=1\.235,-2\.500$/.test(l)))fail('anim:foot line');
 if(!L.some(l=>/ anim:apron-lift \d+ .* strength=full dur=1\.600$/.test(l))||!N.includes('anim:hooked'))fail('anim:apron-lift / anim:hooked');
 if(!L.some(l=>/audio:sfx .*name=sfx_combo_1 accepted=1 clip=sfx_combo_1 vol=1 effVol=1 loop=0 dur=0.8/.test(l)))fail('sfx detail');
 if(!L.some(l=>/audio:sfx .*name=sfx_ui_click accepted=0 .*effVol=0 .*muted=1/.test(l)))fail('muted sfx');
 if(!L.some(l=>/audio:bgm-playing .*clip=bgm_main vol=0.5 musicVolume=0.5 effVol=0.5 loop=1 pos=47.9 dur=48/.test(l)))fail('bgm detail');
 if(!L.some(l=>/audio:bgm-loop-seam .*before=47.9 after=0.05/.test(l)))fail('loop seam');
 if(!N.includes('audio:bgm-volume')||!N.includes('audio:muted'))fail('volume/mute');
 if(L.some(l=>l.includes('unregistered=1')))fail('unregistered mark '+L.find(l=>l.includes('unregistered=1')));
 if(env.cameraHook){if(!L.some(l=>/ crane-start .*source=hook segment=toIsland/.test(l)))fail('crane hook');if(N.indexOf('crane-start')>N.indexOf('camera-settled:island'))fail('crane after settle');}else if(!L.some(l=>/camera:crane-hook .*status=unavailable/.test(l)))fail('crane unavailable');
 const via=L.find(l=>l.includes(' tap-door '))!;const want=env.door==='hidden'?'RoomExploreOverlay.leave(door-offscreen)':'RoomExploreOverlay.down+up(synthetic-touch@handle)';if(!via.includes(want))fail('door via');
 const rv=L.find(l=>l.includes(' tap-return '))!;
 if(env.t1){if(!rv.includes('lighthouse-touch(wx-prelude)'))fail('T1 return via '+rv);if(N.includes('open-return-panel')&&!L.find(l=>l.includes(' open-return-panel '))!.includes('skipped(T1'))fail('panel');}
 else if(!rv.includes('IslandJourneyOverlay.dispatch(returnHome)'))fail('return via '+rv);
 if(env.door==='reveal-by-drag'&&(calls.look<1||!N.includes('door-revealed')))fail('drag');
 void flow;void engine;
 console.error(`PASS integration out-and-back door=${env.door} t1=${env.t1||'-'} cameraHook=${env.cameraHook}`);
})().catch(e=>fail(String(e?.stack||e)));
