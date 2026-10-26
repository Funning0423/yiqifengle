'use strict';
// 运镜bot full8: camera-collision gate on REAL Mac camTrace poses (Grok Bot 2026-10-26: rules 1+2 hard, AABB report-only).
// Usage: node tools/journey-integration/collision-gate.cjs --trace <camtrace.txt|console.log> [--expect-fail] [--require-plan-agree] [--json out.json]
// Every [QF_CAM_TRACE] write line is read (f, t, pos, writer). Geometry is placed in the RUNTIME world frame = the node placement
// (route-legs J.mOff / rotY 180: M6 world (−1.514, 5.33, 77.281), the same frame the runtime meadow node renders the windmill in; the
// stale M6_LOCAL only fed the camera plan). Writers → scene at that moment:
//   BalloonTransit:prewalk, BalloonTransit:B1  → meadow at the balloon leg t=0 (terrain, fence, trees, windmill_static_merged + sails, basket)
//   other writers → no proxy scene yet: counted as UNCHECKED (listed, never dropped silently).
// Rules (same as test_camera_collision): (1) no surface within 1.1 m (26 rays) — HARD; (2) not enclosed: one of 14 rays of 20 m escapes — HARD;
// (3) inside a solid object's AABB — report only. Capture frames ↔ trace: m2 report maps 594 = B1 wide (c0 hold from t≈140.46) at ≈3.66 shots/s.
const fs=require('fs');const R=require('./route/route-legs.cjs');const C=require('../transitions-continuous/test_camera_collision.cjs');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
const file=arg('--trace'),expectFail=process.argv.includes('--expect-fail');if(!file){console.error('usage: --trace <camtrace.txt>');process.exit(2);}
const MEADOW=/^BalloonTransit:(prewalk|B1)$/;
(async()=>{const geo=await R.geometry(),bl=R.balloonLeg(geo,[390,844]);
 const L=fs.readFileSync(file,'utf8').split('\n').map(l=>l.match(/\[QF_CAM_TRACE\] f=(\d+) t=([\d.]+) pos=([-\d.e,]+).*? w=(\S+)/)).filter(Boolean).map(m=>({f:+m[1],t:+m[2],p:m[3].split(',').map(Number),w:m[4]}));
 const viol=[],unchecked={};let checked=0,aabb=0;
 for(const q of L){if(!MEADOW.test(q.w)){unchecked[q.w]=(unchecked[q.w]||0)+1;continue;}checked++;const r=C.check(bl.los,0,q.p);if(r.inBox.length)aabb++;
  if(r.clr||r.enc)viol.push({f:q.f,t:q.t,w:q.w,pos:q.p,clr:r.clr,enc:r.enc,inBox:r.inBox});}
 const spans=[];for(const v of viol){const s=spans[spans.length-1];if(s&&v.t-s.t1<0.3&&s.w===v.w)Object.assign(s,{t1:v.t,f1:v.f,n:s.n+1,enc:s.enc+(v.enc?1:0),tags:[...new Set([...s.tags,(v.clr||'').split(':')[1]||'',...v.inBox.filter(b=>/windmill/.test(b))])]});else spans.push({w:v.w,t0:v.t,t1:v.t,f0:v.f,f1:v.f,n:1,enc:v.enc?1:0,tags:[(v.clr||'').split(':')[1]||'',...v.inBox.filter(b=>/windmill/.test(b))]});}
 // proxy ↔ Mac agreement: first B1 write vs route-legs plan.camera(0) (runtime c0). --require-plan-agree fails when > PLAN_TOL_M.
 const PLAN_TOL_M=0.5,b1=L.find(q=>q.w==='BalloonTransit:B1'),c0=bl.cam(0).position,planGapM=b1?+Math.hypot(...b1.p.map((v,i)=>v-c0[i])).toFixed(3):null;
 const out={tool:'collision-gate',planAgree:{traceB1First:b1?b1.p:null,proxyC0:c0.map(v=>+v.toFixed(3)),gapM:planGapM,tolM:PLAN_TOL_M,ok:planGapM!==null&&planGapM<=PLAN_TOL_M},trace:file,writes:L.length,checked,unchecked,violations:viol.length,enclosed:viol.filter(v=>v.enc).length,aabbReport:aabb,spans:spans.map(s=>({...s,tags:s.tags.filter(Boolean)}))};
 console.log(JSON.stringify(out,null,1));if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify({...out,viol},null,1));
 const failed=viol.length>0||(process.argv.includes('--require-plan-agree')&&!out.planAgree.ok);
 if(expectFail){const ok=failed&&out.enclosed>0;console.log(JSON.stringify({status:ok?'PASS (must-fail trace is caught)':'FAIL (gate misses a known penetration)'}));process.exit(ok?0:1);}
 console.log(JSON.stringify({status:failed?'FAIL':'PASS'}));process.exit(failed?1:0);})().catch(e=>{console.error(e);process.exit(1);});
