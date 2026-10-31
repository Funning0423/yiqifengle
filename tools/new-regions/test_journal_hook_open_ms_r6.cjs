'use strict';
// journal r6 P1/P3: every journal-sky hook's setup (what PreTransitionRun runs before it opens the panel: profile → just-won → sky
// seed) must stay inside the open budget, and the sky seed must not step presentation frames through snapshot().
//  - seed per hook ≤ 2,000 ms absolute backstop; new 4/4 seed ≤ 15 % of the a5cf58fa loop timed in the same process (r6c)
//  - provider snapshot() calls during seedSkyChallengeWins(n) ≤ n (one result check per stage)
//  - writes to the profile's real R5 storage during the seed ≤ 3 (one per R5 key; was 90 sync device writes for 4/4)
//  - saved R5 store after the seed is identical to the old frame-stepping replay (same save writes, same records/attempts)
//  - negative: the a5cf58fa frame-stepping loop (copied verbatim below) must FAIL the snapshot bound and the time budget for 4/4.
const assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
/* r6c (界面验收部 8dc998a8: the absolute 800 ms hit 975 ms on a busy box). Hard limits are now the COUNTS (status reads ≤ levels,
 * real writes ≤ 3, saved data identical) plus a SAME-PROCESS relative check: new 4/4 seed ≤ 15 % of the a5cf58fa loop measured right
 * after it. Why 15 %: idle box = ~0.4 s vs ~5.9 s (≈ 7 %); load slows both loops alike, so the ratio is stable — 15 % is ~2× headroom
 * on that ratio, while bringing back per-frame snapshot stepping (the 11.2 s bug) lands at ~100 %. Plus one absolute backstop of
 * 2,000 ms per hook seed (Grok Bot) so a gross regression fails even if the old loop got slower too. */
const SEED_BACKSTOP_MS=2000,REL_MAX=0.15,REAL_WRITES_MAX=3;
(async()=>{
const H=createHarness({debug:false}),K=H.load('world-r2/PreTransitionKeys'),RF=H.load('world-r2/RegionFlowTest'),UP=H.load('ui/UiPrefs');
const R5=require('../../creator-build-project/assets/scripts/regional-r05/runtime/board-session-provider.js'),PP=(R5.default||R5).prototype;
let snaps=0;const oSnap=PP.snapshot;PP.snapshot=function(){snaps++;return oSnap.apply(this,arguments);};
const C=H.load('world-r2/WorldNativeComposition').WorldNativeComposition,c=new C();c.world={commands:()=>({snapshot:()=>({state:'island'})})};globalThis.location={search:'?qfHooks=1'};
// old a5cf58fa loop, verbatim (negative case)
function oldSeed(profile,count){const P=new (R5.default||R5)({platform:profile.r5.platform,journey:profile.r5.journey});const ok=(r,w)=>{if(!r?.ok)throw Error('old '+w);};
 for(const w of RF.SKY_CHALLENGE_WITNESSES.slice(0,count)){ok(P.startStage(w.stageId,{seed:w.seed}),'start');P.resume();
  for(const a of w.actions){const p=P.previewAction(a);ok(p,'preview');ok(P.commitAction(p.token),'commit');let v=P.snapshot().visual;while(v){ok(P.finishVisualStep(v.token),'visual');v=P.snapshot().visual;}}
  const s=P.snapshot();if(s.state!=='result.saved'||!s.result?.completionRecorded)throw Error('old unregistered');}}
const norm=prof=>JSON.stringify(prof.r5.inspect().map(([k,v])=>[k,v==null?null:String(v).replace(/"(attemptId|id)":"[^"]*"/g,'"$1":"*"')]));
const KEYS=['journal-sky-gated','journal-sky-just-unlocked','journal-sky-open','journal-sky-progress','journal-sky-cleared','journal-sky-focus'];
const rows=[];
for(const k of KEYS){const sp=K.preSpec(k);assert(sp,k);const t0=performance.now();
  const prof=c.preTransitionProfile(sp.checkpoint,sp.finish);assert.equal(prof.ok,true,k);
  if(sp.justWon)RF.finishPausedMainlineWin(c.testProfile,prof.lastAction,{allowQa:true});
  let w=0;const pf=c.testProfile.r5.platform,os=pf.save;pf.save=function(){w++;return os.apply(this,arguments);};
  snaps=0;const t1=performance.now();if(sp.skyChallenges)RF.seedSkyChallengeWins(c.testProfile,sp.skyChallenges,{allowQa:true});const seedMs=performance.now()-t1,seedSnaps=snaps;pf.save=os;
  UP.setLastRegion(sp.focusSky?'sky':'');const setupMs=performance.now()-t0;
  rows.push({k,n:sp.skyChallenges||0,setupMs:Math.round(setupMs),seedMs:Math.round(seedMs),seedSnaps,w});
  assert(seedSnaps<=(sp.skyChallenges||0),`${k}: ${seedSnaps} snapshot() calls during the seed > ${sp.skyChallenges||0}`);
  assert(seedMs<=SEED_BACKSTOP_MS,`${k}: seed ${seedMs.toFixed(0)} ms > backstop ${SEED_BACKSTOP_MS} ms`);
  assert(w<=REAL_WRITES_MAX,`${k}: ${w} real storage writes during the seed > ${REAL_WRITES_MAX}`);
}
// saved data equivalence + negative case on the old loop (4/4)
c.preTransitionProfile(12,true);const tn=performance.now();RF.seedSkyChallengeWins(c.testProfile,4,{allowQa:true});const newMs=performance.now()-tn;const nNew=norm(c.testProfile);
c.preTransitionProfile(12,true);let ow=0;{const pf=c.testProfile.r5.platform,os=pf.save;pf.save=function(){ow++;return os.apply(this,arguments);};}snaps=0;const t=performance.now();oldSeed(c.testProfile,4);const oldMs=performance.now()-t,oldSnaps=snaps;const nOld=norm(c.testProfile);
const strip=s=>s.replace(/dot-region-flow-test-[^"]*?:/g,'NS:');
assert.equal(strip(nNew),strip(nOld),'saved R5 store after the seed must equal the old frame-stepping replay');
assert(oldSnaps>4,'negative: old loop must exceed the snapshot bound (got '+oldSnaps+')');
const ratio=newMs/oldMs;assert(ratio<=REL_MAX,`new 4/4 seed ${newMs.toFixed(0)} ms = ${(100*ratio).toFixed(1)} % of the old loop ${oldMs.toFixed(0)} ms > ${100*REL_MAX} %`);
assert(oldMs>SEED_BACKSTOP_MS,'negative: old loop must exceed the backstop (got '+oldMs.toFixed(0)+' ms)');
assert(ow>REAL_WRITES_MAX,'negative: old loop must exceed the real-write bound (got '+ow+')');
console.log(rows.map(r=>`${r.k}: n=${r.n} setup ${r.setupMs} ms (seed ${r.seedMs} ms, snapshot ${r.seedSnaps}, real writes ${r.w})`).join('\n'));
console.log(`relative (same process): new 4/4 seed ${newMs.toFixed(0)} ms / old ${oldMs.toFixed(0)} ms = ${(100*newMs/oldMs).toFixed(1)} % (limit ${100*REL_MAX} %)`);
console.log(`negative a5cf58fa loop 4/4: seed ${oldMs.toFixed(0)} ms, snapshot ${oldSnaps}, real writes ${ow} → FAILS reads (≤4), writes (≤${REAL_WRITES_MAX}), backstop (≤${SEED_BACKSTOP_MS} ms), relative (100 %)`);
console.log('PASS journal-hook-open-ms-r6');process.exit(0);
})().catch(e=>{console.error('FAIL',e&&e.stack||e);process.exit(1);});
