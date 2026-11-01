'use strict';
// full8b P0 (Mac afb9a70c, 全流程测试部 finstart-r2): L12 claim → sky finale → auto-continue (by design: SkyFinaleDeparture,
// 1.4 s approach + 2 s gaze) → balloon prepare → `[QF_LAKE] lakeside-fallback … journey-invalid-continuity` → island.
// Module replay of RegionJourneyController.prepare's check on the skycity→lakeside lease route, built exactly as
// RegionJourneyAdapter.prepareLakesideJourney does (mooring C: counted path starts at S6 = walkWorld[0]), from the journey
// checkpoint the meadow→skycity balloon leaves (B5 deck walk → b19 new S0), from every skycity node (finale / explore stands),
// and from S6 itself. Must FAIL on afb9a70c (route has no checkpoint→S6 lead-in), PASS after the fix. Continuity is NOT loosened:
// same 1e-4 m, now over checkpoint → entry (the node walk the ride already plays) → S6 → counted leg.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('../board-ui/harness.cjs').createHarness();
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const TS=H.load('region/TransitionStaging.ts'),SK=H.load('region/SkyWalkShot.ts'),RN=H.load('region/RegionNodes.ts'),PW=H.load('region/SkyLakePreWalk.ts');
const Core=H.load('world-r1/RegionJourneyCore.ts');
let SE=null;try{SE=H.load('region/SkyLakeEntry.ts');}catch(e){SE=null;}
const M5=TS.TRANSITION_STAGING.skyMooring5a,toW=p=>SK.skyLocalToWorld(M5,p),d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const counted=M5.walkWorld.map(p=>[p[0],p[1],p[2]]),tail=[[counted.at(-1)[0]+5,counted.at(-1)[1],counted.at(-1)[2]+5]]/* stands in for flight+mooring walk: continuity only looks at path[0] */;
const route=(start,withEntry)=>{const path=[...counted,...tail],L=Core.routeLength(path),entry=withEntry&&SE?SE.skyLakeEntry(start,M5):null;
 return {from:'skycity',to:'lakeside',...(entry?{entry}:{}),path,bridgeStart:L*.5,bridgeEnd:L*.6,speed:1.2};};
const err=f=>{try{f();return null;}catch(e){return String(e.message||e);}};
// 0) the Mac failure, replayed: checkpoint = where the meadow→skycity balloon leaves her (B5 walk end = b19 new S0)
const s0=toW(TS.TRANSITION_STAGING.skycity.s0New);
assert.equal(err(()=>Core.validateJourneyRoute(route(s0,false),s0)),'journey-invalid-continuity','afb9a70c route (no lead-in) reproduces the Mac error');
// 1) adapter wiring (absent on afb9a70c → this gate fails there)
assert.ok(SE,'region/SkyLakeEntry.ts missing (afb9a70c: no checkpoint→S6 lead-in)');
const ad=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
assert.match(ad,/const entry=atC\?skyLakeEntry\(start,M5 as any\):null/);assert.match(ad,/let route:JourneyRoute=\{from,to:'lakeside',\.\.\.\(entry\?\{entry\}:\{\}\),path,/);
// 2) every checkpoint: S0 (balloon arrival), each skycity node (finale/explore stands), S6, an off-node stand
const starts=[['S0-new',s0],...RN.REGION_NODES.skycity.nodes.map(n=>[n.key,toW(n.at)]),['S6-exact',counted[0]],['near-S6',[counted[0][0]+.3,counted[0][1],counted[0][2]]]];
for(const [k,st] of starts){const r=route(st,true);assert.equal(err(()=>Core.validateJourneyRoute(r,st)),null,k+': continuity');
 if(d3(st,counted[0])>1e-4){assert.ok(r.entry&&d3(r.entry[0],st)===0&&d3(r.entry.at(-1),counted[0])===0,k+': entry = checkpoint → S6');
  const pre=PW.skyLakePreWalk(st,M5);if(pre)assert.deepEqual(r.entry,pre.path,k+': entry IS the walk the ride plays (skyLakePreWalk)');}
 else assert.equal(r.entry,undefined,k+': on S6 no lead-in');}
// 3) not loosened: a broken lead-in / a checkpoint elsewhere still fails
const bad=route(s0,true);assert.equal(err(()=>Core.validateJourneyRoute({...bad,entry:[[s0[0]+1,s0[1],s0[2]],...bad.entry.slice(1)]},s0)),'journey-invalid-continuity');
assert.equal(err(()=>Core.validateJourneyRoute({...bad,entry:[...bad.entry.slice(0,-1),[counted[0][0]+.01,counted[0][1],counted[0][2]]]},s0)),'journey-invalid-continuity');
assert.equal(err(()=>Core.validateJourneyRoute({...route(s0,false)},s0)),'journey-invalid-continuity');
// 4) the counted leg is unchanged (distance/timing still from S6)
assert.equal(Core.routeLength(route(s0,true).path),Core.routeLength(route(s0,false).path));
console.log('PASS lake-continuity '+JSON.stringify({starts:starts.length,s0:s0.map(v=>+v.toFixed(3)),S6:counted[0],leadInM:+Core.routeLength(route(s0,true).entry).toFixed(2)}));
