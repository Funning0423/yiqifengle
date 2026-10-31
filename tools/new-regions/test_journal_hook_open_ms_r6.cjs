'use strict';
// journal r6 P1/P3: every journal-sky hook's setup (what PreTransitionRun runs before it opens the panel: profile → just-won → sky
// seed) must stay inside the open budget, and the sky seed must not step presentation frames through snapshot().
//  - seedMs per hook ≤ SEED_BUDGET_MS (box/node; a5cf58fa 4/4 = ~5.9 s here vs 11.2 s on device → ≤800 ms here ≈ ≤1.5 s device worst
//    case on top of the ~1.3–1.7 s every checkpoint-12 hook pays for its profile, keeping openMs < 2.5 s)
//  - provider snapshot() calls during seedSkyChallengeWins(n) ≤ n (one result check per stage)
//  - writes to the profile's real R5 storage during the seed ≤ 3 (one per R5 key; was 90 sync device writes for 4/4)
//  - saved R5 store after the seed is identical to the old frame-stepping replay (same save writes, same records/attempts)
//  - negative: the a5cf58fa frame-stepping loop (copied verbatim below) must FAIL the snapshot bound and the time budget for 4/4.
const assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
const SEED_BUDGET_MS=800,REAL_WRITES_MAX=3;
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
  assert(seedMs<=SEED_BUDGET_MS,`${k}: seed ${seedMs.toFixed(0)} ms > ${SEED_BUDGET_MS} ms`);
  assert(w<=REAL_WRITES_MAX,`${k}: ${w} real storage writes during the seed > ${REAL_WRITES_MAX}`);
}
// saved data equivalence + negative case on the old loop (4/4)
c.preTransitionProfile(12,true);RF.seedSkyChallengeWins(c.testProfile,4,{allowQa:true});const nNew=norm(c.testProfile);
c.preTransitionProfile(12,true);let ow=0;{const pf=c.testProfile.r5.platform,os=pf.save;pf.save=function(){ow++;return os.apply(this,arguments);};}snaps=0;const t=performance.now();oldSeed(c.testProfile,4);const oldMs=performance.now()-t,oldSnaps=snaps;const nOld=norm(c.testProfile);
const strip=s=>s.replace(/dot-region-flow-test-[^"]*?:/g,'NS:');
assert.equal(strip(nNew),strip(nOld),'saved R5 store after the seed must equal the old frame-stepping replay');
assert(oldSnaps>4,'negative: old loop must exceed the snapshot bound (got '+oldSnaps+')');
assert(oldMs>SEED_BUDGET_MS,'negative: old loop must exceed the budget (got '+oldMs.toFixed(0)+' ms)');
assert(ow>REAL_WRITES_MAX,'negative: old loop must exceed the real-write bound (got '+ow+')');
console.log(rows.map(r=>`${r.k}: n=${r.n} setup ${r.setupMs} ms (seed ${r.seedMs} ms, snapshot ${r.seedSnaps}, real writes ${r.w})`).join('\n'));
console.log(`negative a5cf58fa loop 4/4: seed ${oldMs.toFixed(0)} ms, snapshot ${oldSnaps}, real writes ${ow} → FAILS all three (≤${SEED_BUDGET_MS} ms, ≤4, ≤${REAL_WRITES_MAX})`);
console.log('PASS journal-hook-open-ms-r6');process.exit(0);
})().catch(e=>{console.error('FAIL',e&&e.stack||e);process.exit(1);});
