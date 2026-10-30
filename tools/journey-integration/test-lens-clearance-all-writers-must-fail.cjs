'use strict';
// onewriter: lens-trajectory-clearance covers EVERY camera writer (Mac 19bd812a finstart trace: 12 writer kinds were "unchecked").
// A sample 0.2 m above the skycity floor, labelled as each writer in turn, must be caught (S for standing, G for travel writers).
const cp=require('child_process'),path=require('path');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'lens-clearance-gate.cjs'),'--trace',path.join(__dirname,'fixtures/onewriter-19bd812a/finstart-camtrace.txt.gz'),'--must-fail-writers'],{stdio:'inherit',env:process.env});process.exit(r.status===0?0:1);
