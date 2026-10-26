'use strict';
// full6 P0 gate (Mac full5 s2a/s2b): after L12 claim / skycity arrival, the REAL 继续旅程 tap path must reach
// composition.continueJourney(). Uses the real WorldNavigationLayout module and the exact guard/renew expressions
// extracted from WorldIntegrationBoot.ts (asserted verbatim), replayed frame-by-frame with the Mac state timeline.
const fs=require('fs'),path=require('path'),assert=require('assert'),{load,SRC}=require('../t9-island-props/load_ts.cjs');
const src=f=>fs.readFileSync(path.join(SRC,f),'utf8');let n=0;const ok=(name,fn)=>{fn();n++;console.log('PASS '+name);};
const N=load(['world-r2/WorldNavigationLayout']).WorldNavigationLayout,boot=src('WorldIntegrationBoot.ts'),comp=src('world-r2/WorldNativeComposition.ts');
ok('boot wiring unchanged: per-frame lock renew + touch guard + button → continueJourney',()=>{
 assert(/this\.mainlineLock=mainlineLockForState\(this\.mainlineLock,s\.state,Date\.now\(\)\);/.test(boot),'renew every frame');
 assert(/if\(id==='mainline'\)\{const now=Date\.now\(\);if\(!mainlineTapAllowed\(now,this\.mainlineLock,this\.busy\)\)return false;/.test(boot),'touch guard');
 assert(/this\.button\('mainline','继续旅程  →',\(\)=>this\.composition\.continueJourney\(\)\)/.test(boot),'button handler');
 assert(/continueJourney\(\)\{return this\.skyFinaleActive\(\)\?this\.continueFromSkyFinale\(\):this\.enterMainline\(\);\}/.test(comp));
 assert(/canEnterRegion\(s\.journey,'lakeside'\)\.ok\)return this\.enterRegion\('lake'\)/.test(comp),'completed:12 → lakeside');});
function replay(timeline){let lock=0,t=1e6,fired=0;const frame=st=>{lock=N.mainlineLockForState(lock,st,t);t+=16;};
 const tap=()=>{if(N.mainlineTapAllowed(t,lock,false)){lock=N.mainlineLockAfterTap(t);fired++;}};
 for(const [st,ms,taps] of timeline){for(let e=0;e<ms;e+=16)frame(st);for(const d of taps||[]){for(let e=0;e<d;e+=16)frame(st);tap();}}return fired;}
ok('L12 claim → board closes → skycity|arrived → tap fires (s2a: one tap after 1 s)',()=>{
 assert.equal(replay([['level',8000],['skycity',1000,[0]]]),1,'tap in skycity swallowed by the renewed lock (full5 P0)');});
ok('balloon arrival → skycity → two taps 4 s apart (s2b) → exactly one journey start (debounce kept)',()=>{
 assert.equal(replay([['region-travel',30000],['skycity',2000,[0,300]]]),1);
 assert.equal(replay([['region-travel',30000],['skycity',2000,[0,4000]]]),2,'second tap after the debounce must also reach the handler (busy guards a running journey)');});
ok('meadow / lakeside explore taps also reach the handler; level/loading/transit still locked',()=>{
 for(const st of ['meadow','lakeside','island'])assert.equal(replay([['level',3000],[st,1000,[0]]]),1,st);
 for(const st of ['level','level-loading','region-travel'])assert.equal(replay([[st,5000,[0,2000]]]),0,st);});
console.log(`${n} passed`);
