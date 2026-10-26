'use strict';
// 运镜bot full9(b): FAIL if region/SkyResumePlans.ts is stale vs the source hash (SkycityLensOccluders.ts + env_skycity.glb + offline voxels) / walk paths / planner constants (rebake = byte-identical),
// and every start node with a walk has a baked plan that the runtime picks (skyResumePlanFor → baked:true).
const fs=require('fs'),assert=require('node:assert/strict');const ROOT=process.cwd();const {build,decodedMismatch}=require('./bake_sky_resume_plans.cjs');
const b=build(),cur=fs.readFileSync(ROOT+'/creator-build-project/assets/scripts/region/SkyResumePlans.ts','utf8');
assert.equal(cur,b.src,'SkyResumePlans.ts is stale — rerun node tools/skycity-walk/bake_sky_resume_plans.cjs');
const mis=decodedMismatch(b);assert.deepEqual(mis,[],'decoded mm-delta plans differ from the fresh plans: '+mis.join(','));/* full9b: decode exact */
assert.ok(!fs.existsSync(ROOT+'/creator-build-project/assets/scripts/region/SkyLensVoxels.ts'),'SkyLensVoxels.ts must not ship (package budget)');
const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');const H=createHarness(),SP=H.load('region/SkyLakePreWalk.ts'),S=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),RN=H.load('region/RegionNodes.ts'),RS=H.load('region/SkyResumeLens.ts');const M=TS.TRANSITION_STAGING.skyMooring5a;const ms=[];
for(const n of RN.REGION_NODES.skycity.nodes){const pre=SP.skyLakePreWalk(S.skyLocalToWorld(M,n.at),M);if(!pre)continue;const t0=process.hrtime.bigint(),r=RS.skyResumePlanFor(pre.path,q=>RS.skyWorldToLocal(M,q));ms.push([n.key,Number(process.hrtime.bigint()-t0)/1e6]);assert.ok(r.baked,n.key+': runtime would plan live');}
console.log(JSON.stringify({test:'sky-resume-plans-fresh',plans:b.plans.length,srcHash:b.srcHash,decodedEqual:true,bytes:cur.length,runtimeMs:ms.map(([k,v])=>[k,+v.toFixed(2)]),status:'PASS'}));
