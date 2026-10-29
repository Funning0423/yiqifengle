'use strict';
// 运镜bot clip3: must-fail fixtures — the whole-trajectory lens gate has to catch all three 9ec5323c penetrations
// (skycity→lakeside opening, balloon lift-off, T-02 steps). Exit 0 only when every case is caught.
const cp=require('child_process'),path=require('path');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'lens-clearance-gate.cjs'),'--must-fail-9ec'],{stdio:'inherit',env:process.env});process.exit(r.status===0?0:1);
