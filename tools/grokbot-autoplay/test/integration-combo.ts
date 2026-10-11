/** autoplay=combo end-to-end against the REAL int/v1 GameAudio.ts + REAL ui/CheerText.ts (+CheerTextModel) on the mocked engine:
 * home -> door -> island -> '继续旅程' button (injected touch / invoke fallback) -> level (board intro modal) -> feed -> combo:result. */
import {run,marks,names,calls,env,board,scene} from './harness';
import {clock} from './setup';
import {director,AudioSource,AudioClip,resources,js} from 'cc';
import {GameAudio} from '#gameaudio';
const fail=(m:string)=>{console.error('FAIL: '+m+'\n'+marks().join('\n'));process.exit(1);};
const CLIPS:[string,number][]=[['sfx_match_normal',0.35],['sfx_combo_1',0.6],['sfx_combo_2',0.6],['sfx_combo_3',0.6],['sfx_cheer_1_great',0.9],['sfx_cheer_2_excellent',1.0],['sfx_cheer_3_amazing',1.0],['sfx_cheer_4_unbelievable',1.2],['sfx_level_clear',2],['sfx_chest_open',1],['sfx_ui_click',0.2]];
const CHEERS=['sfx_cheer_1_great','sfx_cheer_2_excellent','sfx_cheer_3_amazing','sfx_cheer_4_unbelievable'];
(async()=>{
 const noT6=!!process.env.GB_NO_T6,muted=!!process.env.GB_COMBO_MUTED,expectFail=process.env.GB_EXPECT||'';
 (GameAudio as any).now=()=>clock.ms;
 if(!noT6)await import('#cheertext');
 // what AudioBridge/CheerText do after scene launch
 GameAudio.ensure();(director as any)._launch?.();const A:any=GameAudio.instance;
 const R:any=resources;for(const d of R.dirs)d.cb(null,CLIPS.map(([n,s])=>new (AudioClip as any)(n,s)));
 for(const l of R.loads.filter((x:any)=>/cheer-font/.test(x.path)))l.cb(new Error('no font in test'),null); // system-font look; position logic identical
 if(muted)A.setMuted(true);
 const ap=()=>(globalThis as any).__GB_AUTOPLAY;
 await run(300,()=>ap()&&(ap().phase()==='done'||ap().phase()==='failed'),()=>{(AudioSource as any).__advance();A.update?.();const H=(js.getClassByName('CheerTextHost') as any)?.instance;H?.update?.(1/60);});
 const L=marks(),N=names();console.error(L.join('\n'));
 const res=L.find(l=>l.includes(' combo:result '))||'';
 if(expectFail){if(!/ FAIL( |$)/.test(res)||!new RegExp(expectFail).test(res))fail('expected FAIL matching '+expectFail+' got '+res);console.error('PASS combo negative ('+expectFail+')');return;}
 if(ap().phase()!=='done')fail('phase '+ap().phase());
 const order=env.combo&&process.env.GB_QUERY?.includes('combo:here')?[]:['combo:armed','world-ready','tap-door','island-arrived','combo:enter-level','combo:board-ready','combo:start','combo:frame','combo:cheer','combo:done','combo:result'];
 const idx=order.map(o=>N.indexOf(o));if(idx.some(i=>i<0)||idx.some((v,i)=>i&&v<idx[i-1]))fail('order '+JSON.stringify(order.map((o,i)=>o+'@'+idx[i])));
 const via=L.filter(l=>l.includes(' combo:enter-level ')).join(' | ');const wantVia=!env.prelude?'via=WorldIntegrationBoot.invoke(composition.enterMainline) buttonFailed=no-touch-backend':env.deadButton?'retry=button-tap-had-no-effect':'via=mainline-button-touch(wx-prelude)@195,722';
 if(!via.includes(wantVia))fail('enter via '+via);if(calls.mainline!==1)fail('enterMainline calls '+calls.mainline);
 if(!board)fail('no board');
 const F=L.filter(l=>l.includes(' combo:frame '));if(F.length!==6||!F[0].includes('kind=action')||!F.slice(1).every((l,i)=>l.includes(`cascade=${i+1} `)))fail('frames');
 const fms=F.map(l=>Number(l.split(' ')[2]));if(!fms.slice(1).every((m,i)=>m-fms[i]>=400&&m-fms[i]<=420))fail('gaps '+fms);
 // per tier: onCheer -> cheer clip (unless muted) -> CheerText, in order, from the REAL modules
 const T=L.filter(l=>l.includes(' ui:cheer-text '));const C=L.filter(l=>l.includes(' combo:cheer '));
 if(C.map(l=>/level=(\d)/.exec(l)![1]).join()!=='0,1,2,3')fail('onCheer tiers');
 if(T.length!==4||!T.every((l,i)=>new RegExp(`tier=${i} word=${['Great!','Excellent!','Amazing!','Unbelievable!'][i]} decision=${i?'replace':'show'} source=clear x=0 y=${[108,60,12,-36][i]} replaced=${i-1}`).test(l)))fail('cheer text '+T.join(' | '));
 const S=L.filter(l=>/ audio:sfx .*name=sfx_cheer_/.test(l));
 if(muted){if(S.some(l=>l.includes('accepted=1')))fail('muted but cheer clip started');}
 else if(S.length!==4||!S.every((l,i)=>new RegExp(`name=${CHEERS[i]} accepted=1 clip=${CHEERS[i]} vol=1 effVol=1 loop=0`).test(l)))fail('cheer sfx '+S.join(' | '));
 // each cheer: after its frame and before the next one: combo:cheer (T0 listener), its clip, its text (CheerText subscribed first, so it may log first)
 for(let i=0;i<4;i++){const f=L.indexOf(F[i+2]),c=L.indexOf(C[i]),t=L.indexOf(T[i]),nx=i<3?L.indexOf(F[i+3]):L.length;const s=muted?c:L.indexOf(S[i]);if(!(f<c&&f<t&&f<s&&c<nx&&s<nx&&t<nx))fail('per-trigger order tier '+i);}
 const wantRes=muted?/^.* combo:result .*expect=0,1,2,3 tiers=0,1,2,3 sfx=skipped-by-GameAudio\(muted\) text=0,1,2,3 textSource=clear,clear,clear,clear muted=1 suspended=0 tiersOk=1 sfxOk=1 textOk=1 PASS$/
  :/^.* combo:result .*expect=0,1,2,3 tiers=0,1,2,3 sfx=sfx_cheer_1_great,sfx_cheer_2_excellent,sfx_cheer_3_amazing,sfx_cheer_4_unbelievable text=0,1,2,3 textSource=clear,clear,clear,clear muted=0 suspended=0 tiersOk=1 sfxOk=1 textOk=1 PASS$/;
 if(!wantRes.test(res))fail('result '+res);
 if(!L.some(l=>/ audio:clear .*wave=5 tier=combo_3 synthetic=1 token=gb-combo:5/.test(l)))fail('audio:clear synthetic tag');
 if(L.some(l=>l.includes('unregistered=1')))fail('unregistered '+L.find(l=>l.includes('unregistered=1')));
 void scene;
 console.error(`PASS integration combo prelude=${env.prelude} deadButton=${env.deadButton} muted=${muted} (real GameAudio + CheerText)`);
})().catch(e=>fail(String(e?.stack||e)));
