'use strict';
// 运镜bot full9b (Grok Bot, package budget): SkyLensVoxels no longer ships, so the runtime LIVE FALLBACK (no baked plan matches) plans on the
// SkycityLensOccluders boxes. HARD gate: force the fallback and run test_sky_resume_follow from all 6 start nodes S0–S5 on 7 screens,
// gate mode — real-mesh 1.1 m clearance 0 hits, 0 within 0.35 m, sky/box hidden ≤0.5 s, yaw caps, margin ≥0.08, no menu overlap.
// (On device the fallback logs one console.warn '[QF_SKY_RESUME] fallback-live'; Mac acceptance = 0 such warns.)
const cp=require('node:child_process'),path=require('node:path');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'test_sky_resume_follow.cjs')],{cwd:process.cwd(),stdio:'inherit',env:{...process.env,QF_SKY_FORCE_FALLBACK:'1',QF_FROM:'S0,S1,S2,S3,S4,S5',QF_S6_GATE:'gate',QF_LENS:''}});
process.exit(r.status==null?1:r.status);
