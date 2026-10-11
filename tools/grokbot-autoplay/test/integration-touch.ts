/** touch mode end-to-end with the REAL T1 IslandHomeInteraction (l123 or l12) behind a fake engine touch pipeline. */
import {run,marks,calls,env,engine} from './harness';
const fail=(m:string)=>{console.error('FAIL: '+m+'\n'+marks().join('\n'));process.exit(1);};
(async()=>{
 const ap=()=>(globalThis as any).__GB_AUTOPLAY;
 await run(600,()=>ap()&&ap().phase()==='done');
 const L=marks();console.error(L.filter(l=>/touch:(scenario|suite|cocos-seen)|tap-door|prepare/.test(l)).join('\n'));
 const res=ap().touchResults();console.error(JSON.stringify(res));
 if(!env.t1){if(!res.length||!res.every((r:any)=>r.verdict==='SKIP'||r.name==='t1-tap-sea'))fail('no-T1 should skip lighthouse scenarios');if(res.find((r:any)=>r.name==='t1-tap-sea')?.verdict!=='PASS')fail('tap-sea');console.error('PASS touch no-T1 (lighthouse scenarios SKIP)');return;}
 if(process.env.GB_EXPORT){const w=L.filter(l=>l.includes('touch:wx-script'));console.error(w.join('\n'));if(w.length!==8)fail('export count');if(!w.find(l=>l.includes('name=t1-single-tap-lighthouse supported=1'))||!w.find(l=>l.includes('name=t1-hold-hud supported=0')))fail('export flags');if(!w.find(l=>l.includes('t1-single-tap-lighthouse'))!.includes('ga --action touchstart --x 293 --y 506'))fail('export coords');if(calls.ret!==0||!res.every((r:any)=>r.verdict==='SKIP'))fail('only must not inject');console.error('PASS gbExport=only: 8 scripts, single-finger supported, multi-finger flagged, nothing injected');return;}
 if(process.env.GB_INERT_BUTTON){console.error('NEG '+JSON.stringify(res));if(res.length!==1||res[0].verdict!=='PASS')fail('neg control '+JSON.stringify(res));console.error(`PASS custom-JSON scenario neg-same-frame-inert t1=${env.t1} actual=${res[0].actual}`);return;}
 if(res.length!==8)fail('expected 8 results');
 const bad=res.filter((r:any)=>r.verdict!=='PASS');if(bad.length)fail('non-pass '+JSON.stringify(bad));
 const returns=res.filter((r:any)=>r.actual==='return').length;if(calls.ret!==returns)fail(`returnHome calls ${calls.ret} != returns ${returns}`);
 if(!L.some(l=>l.includes('touch:cocos-seen')))fail('cocos never saw injected touches');
 if(!L.some(l=>l.includes('touch:suite-done pass=8')||/touch:suite-done \d+ .*pass=8 fail=0/.test(l)))fail('suite-done');
 console.error(`PASS touch t1=${env.t1} variant=${process.env.GB_QUERY} presses=${engine.buttonPresses.join(',')}`);
})().catch(e=>fail(String(e?.stack||e)));
