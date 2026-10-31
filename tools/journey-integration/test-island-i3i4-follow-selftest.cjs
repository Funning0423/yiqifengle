'use strict';
// 运镜bot b21: negative self-test for island-i3i4-follow. The same gate with the pre-fix lens (FOLLOW_HEADING=raw: the follow lens hangs
// rigidly off her heading, as on dc69e994) must FAIL on I3>I4 (speed/turn/margin), and the wired FollowHeading lens must PASS on the subset.
const cp=require('child_process'),path=require('path');const G=path.join(__dirname,'test-island-i3i4-follow.cjs');
const run=env=>cp.spawnSync(process.execPath,[G],{env:{...process.env,SCREENS:'390x844,375x667',MODES:'30',OUT:'reports/island-i3i4-follow-selftest.json',...env},encoding:'utf8'});
const raw=run({FOLLOW_HEADING:'raw'}),fixed=run({});let fail=0;
const rawOut=raw.stdout||'';/* b21: on the final route (05702f02) the rigid lens fails on motion (speed/step/yaw/accel); margin is reported but no longer route-forced */
if(raw.status!==1||!/FAIL .* speed /.test(rawOut)||!/FAIL .* (yaw\/pitch|accel p99) /.test(rawOut)){fail++;console.log('FAIL raw (unfixed) lens did not fail the gate',raw.status,rawOut.slice(-400));}
if(fixed.status!==0||!/"followHeading":true|island-i3i4-follow: PASS/.test(fixed.stdout||'')){fail++;console.log('FAIL fixed lens did not pass',fixed.status,(fixed.stdout||'').slice(-400));}
if(fail){console.log('island-i3i4-follow-selftest: FAIL',fail);process.exit(1);}console.log('island-i3i4-follow-selftest: PASS (raw fails:',(rawOut.match(/^FAIL/mg)||[]).length,')');
