'use strict';
// 运镜bot full9: FAIL if region/SkyResumePlans.ts is stale vs the current SkyLensVoxels / walk paths / planner constants (rebake = byte-identical),
// and every start node with a walk has a baked plan that the runtime picks (skyResumePlanFor → baked:true).
const fs=require('fs'),assert=require('node:assert/strict');const ROOT=process.cwd();const {build}=require('./bake_sky_resume_plans.cjs');
const b=build(),cur=fs.readFileSync(ROOT+'/creator-build-project/assets/scripts/region/SkyResumePlans.ts','utf8');
assert.equal(cur,b.src,'SkyResumePlans.ts is stale — rerun node tools/skycity-walk/bake_sky_resume_plans.cjs');
const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');const H=createHarness(),SP=H.load('region/SkyLakePreWalk.ts'),S=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),RN=H.load('region/RegionNodes.ts'),RS=H.load('region/SkyResumeLens.ts');const M=TS.TRANSITION_STAGING.skyMooring5a;const ms=[];
for(const n of RN.REGION_NODES.skycity.nodes){const pre=SP.skyLakePreWalk(S.skyLocalToWorld(M,n.at),M);if(!pre)continue;const t0=process.hrtime.bigint(),r=RS.skyResumePlanFor(pre.path,q=>RS.skyWorldToLocal(M,q));ms.push([n.key,Number(process.hrtime.bigint()-t0)/1e6]);assert.ok(r.baked,n.key+': runtime would plan live');}
console.log(JSON.stringify({test:'sky-resume-plans-fresh',plans:b.plans.length,voxHash:b.voxHash,runtimeMs:ms.map(([k,v])=>[k,+v.toFixed(2)]),status:'PASS'}));
