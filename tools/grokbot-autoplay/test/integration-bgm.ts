/** BGM observers against the REAL GameAudio.ts from GB_INT_DIR (v0.4+: setMusic(path,bundle?) + two-source crossfade loop + scene crossfade).
 *  autoplay=observe (T0 drives nothing). Fake player: currentTime follows the fake clock and wraps when loop=true.
 *  Checks: one audio:bgm-playing for the whole loop phase (no bgm-stopped across loop crossfades), one audio:bgm-loop-seam per pass,
 *  GameAudio itself completed the crossfades, never more than 2 music voices, bgm-set for the bundle call and the old 1-arg call,
 *  and the new track playing after the scene crossfade. */
import {run,marks} from './harness';
import {clock} from './setup';
import {director,AudioSource,AudioClip,resources,assetManager} from 'cc';
import {GameAudio} from '#gameaudio';
const fail=(m:string)=>{console.error('FAIL: '+m+'\n'+marks().join('\n'));process.exit(1);};
(async()=>{
 (GameAudio as any).now=()=>clock.ms;
 GameAudio.ensure();(director as any)._launch?.();const A:any=GameAudio.instance;const R:any=resources,AM:any=assetManager,S:any=AudioSource;
 if(typeof A.setMusic!=='function'||A.setMusic.length<1)fail('no setMusic');
 const DUR=10;let maxVoices=0;
 const tick=()=>{for(const s of S._all){if(!s.playing||!s.clip)continue;const t=(clock.ms-s._t)/1000;s.currentTime=s.loop?t%s.clip.duration:Math.min(t,s.clip.duration);}
  S.__advance();A.update?.(1/60);const music=[...S._all].filter((s:any)=>s.playing&&s.clip&&/^bgm_/.test(s.clip.name)).length;maxVoices=Math.max(maxVoices,music);};
 const bgm=R.loads.find((l:any)=>/audio_bgm\/bgm_main/.test(l.path));if(!bgm)fail('GameAudio did not request resources audio_bgm/bgm_main');
 bgm.cb(null,new (AudioClip as any)('bgm_main',DUR));A.onGesture?.();
 await run(36,()=>false,tick);
 const L1=marks(),passes=L1.filter(l=>l.includes(' audio:bgm-loop-seam ')).length,xf=A.musicDiagnostics()?.loopCrossfade?.completed;
 if(L1.filter(l=>l.includes(' audio:bgm-playing ')).length!==1)fail('bgm-playing count during loop phase');
 if(L1.some(l=>l.includes(' audio:bgm-stopped ')))fail('bgm-stopped across a loop crossfade');
 if(!(passes>=3))fail('loop seams '+passes);if(xf!==undefined&&!(xf>=3))fail('GameAudio loopCrossfade.completed '+xf);
 if(!L1.some(l=>/ audio:bgm-playing .*clip=bgm_main .*loop=1 /.test(l)))fail('bgm-playing detail');
 // scene switch through the new optional bundle arg
 A.setMusic('audio/bgm_skycity','region_skycity');
 const bl=AM.bundleLoads.find((b:any)=>b.name==='region_skycity');if(!bl)fail('no loadBundle(region_skycity)');
 const loads:any[]=[];const bundle={load:(p:string,_t:any,cb:any)=>loads.push({p,cb})};AM.bundles.set('region_skycity',bundle);bl.cb(null,bundle);
 if(!loads.length||loads[0].p!=='audio/bgm_skycity')fail('bundle.load path');loads[0].cb(null,new (AudioClip as any)('bgm_skycity',DUR));
 await run(3,()=>false,tick);
 const sc=A.loopSource;if(!sc?.playing||sc.clip?.name!=='bgm_skycity')fail('skycity not playing after scene crossfade');
 // old one-arg call (resources) still works
 A.setMusic('audio_bgm/bgm_main');const back=R.loads.filter((l:any)=>/audio_bgm\/bgm_main/.test(l.path));if(back.length<2)fail('1-arg setMusic did not load from resources');
 back[back.length-1].cb(null,new (AudioClip as any)('bgm_main',DUR));await run(3,()=>false,tick);
 const L=marks();
 if(!L.some(l=>/ audio:bgm-set .*path=audio\/bgm_skycity/.test(l))||!L.some(l=>/ audio:bgm-set .*path=audio_bgm\/bgm_main/.test(l)))fail('bgm-set marks');
 if(A.loopSource?.clip?.name!=='bgm_main'||!A.loopSource.playing)fail('back to bgm_main');
 if(maxVoices>2)fail('music voices '+maxVoices);
 if(L.some(l=>l.includes('unregistered=1')))fail('unregistered mark');
 console.error(L.filter(l=>/ audio:bgm/.test(l)).join('\n'));
 console.error(`PASS integration bgm (real GameAudio v0.4: loop seams=${passes} crossfades=${xf} maxMusicVoices=${maxVoices}; bundle + 1-arg setMusic)`);
})().catch(e=>fail(String(e?.stack||e)));
