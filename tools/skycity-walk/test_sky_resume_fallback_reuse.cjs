'use strict';
// 运镜bot full9b option A (Grok Bot): HARD gate for the runtime FALLBACK = the nearest start's baked plan (no runtime planner).
// Forces the fallback and runs test_sky_resume_follow (real skycity mesh, route-legs skyJ) in gate mode from all 6 starts S0–S5 and S0L (the
// balloon landing, where the resume really starts), each plus 8 offsets (E/N/W/S at R/2 and at the radius edge R = SkyResumeLens.SKY_RESUME_REUSE_M), on 7 screens:
// 0 clearance hits (1.15 m probe), 0 within 0.35 m, box/sky hidden ≤0.5 s, margin ≥0.08, yaw ≤120 °/s, p99 ≤300 °/s², no menu overlap.
// Device: the fallback logs one console.warn '[QF_SKY_RESUME] fallback-live'; Mac acceptance = 0 such warns.
const cp=require('node:child_process'),path=require('node:path');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'test_sky_resume_follow.cjs')],{cwd:process.cwd(),stdio:'inherit',env:{...process.env,QF_SKY_FORCE_FALLBACK:'1',QF_SKY_OFFSETS:'1',QF_FROM:'S0,S0L,S1,S2,S3,S4,S5',QF_S6_GATE:'gate',QF_LENS:''}});
process.exit(r.status==null?1:r.status);
