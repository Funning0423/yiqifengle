'use strict';
/** r2: churn verdict must never PASS without probe output (B360 481c599c: persec=0 NOPROBE was a PASS). */
const assert=require('node:assert/strict'),{verdict}=require('./gpu-churn-verdict.cjs');
const sec=(s,live,mb)=>'[QF_GPU] s='+s+' fr=1 dc=1/1 tri=1 inst=0 texMB=1.0 bufMB=1.0 raf=17/17/16.7 long=0 uploads=0/0.0 shaders=0 live='+live+' liveMB='+mb+' cre=0 des=0 churn=- regions={} w=x';
const head='[QF_CAM] enabled=1 src=query query=?camTrace=1\n[QF_GPU] probe installed at=deferred frame=2\n';
// NEGATIVE 1: B360 shape — only autoplay / boot lines, zero QF_GPU → NOPROBE = INCOMPLETE, never PASS
const b360='[QF_AUTOPLAY] start\n[QF_BOOT] x\n[QF_PRE] key=home-island\n[QF_JOURNEY_UI] y';
let r=verdict(b360);assert.equal(r.verdict,'NOPROBE');assert.equal(r.incomplete,true);assert.match(r.reason,/no \[QF_CAM\]/);assert.match(r.reason,/0 \[QF_GPU\] per-second/);
// NEGATIVE 2: per-second lines but no 'probe installed' line (old build) → still NOPROBE
r=verdict([1,2,3].map(s=>sec(100+s,10,40)).join('\n'));assert.equal(r.verdict,'NOPROBE');assert.match(r.reason,/probe installed/);
// NEGATIVE 3: installed but zero per-second lines → NOPROBE
r=verdict(head);assert.equal(r.verdict,'NOPROBE');
// NEGATIVE 4: probe NOT installed line is reported
r=verdict('[QF_CAM] enabled=1 src=query query=?camTrace=1\n[QF_GPU] probe NOT installed reason=no-device frames=600');assert.equal(r.verdict,'NOPROBE');assert.match(r.notInstalled,/no-device/);
// PASS: flat live after warmup, ≤1 1024 create per second
let t=head;for(let s=0;s<20;s++){if(s<3)t+='[QF_GPU] TEX op=create 1024x1024 fmt=35 MB=4.00 ms=0.0 w=x\n[QF_GPU] TEX op=create 1024x1024 fmt=55 MB=4.00 ms=0.0 w=x\n';t+=sec(1000+s,12,48)+'\n';}
r=verdict(t);assert.equal(r.verdict,'PASS',JSON.stringify(r));assert.ok(r.persec===20&&r.steadySeconds===15);
// FAIL: churn shape (2 creates every steady second) on current-code style log
t=head;for(let s=0;s<20;s++){t+='[QF_GPU] TEX op=create 1024x1024 fmt=35 MB=4.00 ms=0.0 w=x\n[QF_GPU] TEX op=create 1024x1024 fmt=55 MB=4.00 ms=0.0 w=x\n'+sec(1000+s,12,48)+'\n';}
r=verdict(t);assert.equal(r.verdict,'FAIL');assert.ok(r.bad.length>=15);
// FAIL: leak shape (liveMB rising)
t=head;for(let s=0;s<20;s++)t+=sec(1000+s,12+s,48+4*s)+'\n';r=verdict(t);assert.equal(r.verdict,'FAIL');assert.ok(r.bad.some(b=>/liveMB/.test(b)));
console.log('PASS gpu-churn-verdict (NOPROBE x4 incomplete, PASS flat, FAIL churn, FAIL leak)');
