'use strict';
// 运镜bot full8: must-fail case for tools/journey-integration/collision-gate.cjs — the full7 m2 Mac camTrace (fixtures/m2-camtrace-full.txt,
// 5,689 writes) has the pre-walk lens inside windmill_static_merged (t 123.3–129.9, enclosed) and inside a meadow tree canopy at the
// pre-walk→B1 end blend (t 139.7–141.2 = capture 591–593 grey). The gate must flag it (enclosed > 0); a clean pass means the gate broke.
const cp=require('child_process'),path=require('path');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'../journey-integration/collision-gate.cjs'),'--trace',path.join(__dirname,'fixtures/m2-camtrace-full.txt'),'--expect-fail'],{encoding:'utf8',env:process.env,maxBuffer:64<<20});
const tail=(r.stdout||'').trim().split('\n').slice(-1)[0];console.log(tail);process.exit(r.status===0?0:1);
