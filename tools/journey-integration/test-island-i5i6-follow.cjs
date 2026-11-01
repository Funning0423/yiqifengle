'use strict';
// 运镜bot b21: full camera-limit gate (island-i3i4-follow.cjs, all limits x 7 screens x 60/30/LCG) on the I5>I6 walk with the runtime writer
// (ISLAND_WALK_RAILS rail when wired, else FollowHeading follow). Report: reports/island-i5i6-follow.json.
const cp=require('child_process'),path=require('path');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'test-island-i3i4-follow.cjs')],{env:{...process.env,WALK:'I5>I6',OUT:'reports/island-i5i6-follow.json'},stdio:'inherit'});
process.exit(r.status===null?1:r.status);
