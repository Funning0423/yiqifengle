/** T9 named prop targets end-to-end: REAL T9 IslandJourneyOverlay + REAL IslandPropTaps (+ real T1 IslandHomeInteraction from the same
 *  tree) behind the fake engine touch pipeline, injected through the REAL prelude. Expects ui:tap press/confirm per target. */
import {run,marks,calls,engine,env,loadingGate} from './harness';
const fail=(m:string)=>{console.error('FAIL: '+m+'\n'+marks().join('\n'));process.exit(1);};
(async()=>{
 const ap=()=>(globalThis as any).__GB_AUTOPLAY;
 await run(600,()=>ap()&&ap().phase()==='done');
 const L=marks(),res=ap().touchResults();console.error(L.filter(l=>/ui:tap|touch:(start|scenario-result)/.test(l)).join('\n'));
 if(!L.some(l=>l.includes(' ui:tap-hooked ')&&l.includes('source=__worldIntegration.onPropTap')))fail('ui:tap-hooked');
 if(env.loading)loadingGate(L,fail);
 if(res.length!==4||res.some((r:any)=>r.verdict!=='PASS'))fail('results '+JSON.stringify(res));
 const taps=L.filter(l=>l.includes(' ui:tap ')).map(l=>l.slice(l.indexOf('target=')));
 const want=['target=bag phase=press blocked=0 props=0','target=bag phase=confirm blocked=0 props=0','target=book phase=press blocked=0 props=0','target=book phase=confirm blocked=0 props=0',
  'target=settings phase=press blocked=0 props=0','target=settings phase=confirm blocked=0 props=0','target=signpost phase=press blocked=0 props=0'];
 if(JSON.stringify(taps)!==JSON.stringify(want))fail('ui:tap sequence '+JSON.stringify(taps));
 for(const t of ['bag','book','settings','signpost'])if(!L.some(l=>l.includes('touch:start')&&l.includes('target='+t)))fail('touch:start target='+t);
 if(calls.mainline!==0)fail('signpost press+cancel must not enter the level');
 if(engine.buttonPresses.join(',')!=='Island-bag,Island-journal,Island-settings')fail('presses '+engine.buttonPresses);
 console.error('PASS t9 props: 4 scenarios PASS, ui:tap press/confirm for bag/book/settings, signpost press only (no level), presses='+engine.buttonPresses.join(','));
})().catch(e=>fail(String(e?.stack||e)));
