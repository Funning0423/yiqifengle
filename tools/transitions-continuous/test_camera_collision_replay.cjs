'use strict';
// 运镜bot full8: camera-collision gate replay of the Mac m2 camTrace (full7 cand-23bae2d6, 2026-10-26 07:14 EDT), writers
// BalloonTransit:prewalk + BalloonTransit:B1 (fixtures/m2-camtrace-prewalk-b1.txt = the raw [QF_CAM_TRACE] lines). Each traced lens
// position goes through the SAME check as test_camera_collision (1.1 m ray clearance + 20 m enclosure) against the meadow at t=0 of the
// balloon leg, in route-legs world coordinates (= the trace's world: lens ground clearance 0.75–3 m along the whole walk).
// Expectation (regression case): the gate MUST flag the m2 lens inside windmill_static_merged during the pre-walk (t≈125.8–129.2 s) —
// FRAME CAVEAT (full8): in this frame the m2 pre-walk lens sits only 0.75–3 m above meadow_path (a follow lens is 3.4 m above her),
// and aligning the trace on B1 c0 (runtime (−20.6,8.25,89.6) vs route-legs plan.camera(0) (−20.2,8.44,63.0), Δz 26.6 m) clears every pose —
// the runtime meadow placement is NOT verified to equal route-legs J.mOff. Not in the suite until a runtime meadow-root transform is logged.
const fs=require('fs'),path=require('path');const R=require('../journey-integration/route/route-legs.cjs'),{add}=R.J;
const C=require('./test_camera_collision.cjs');
(async()=>{const geo=await R.geometry(),bl=R.balloonLeg(geo,[390,844]);
 const L=fs.readFileSync(path.join(__dirname,'fixtures/m2-camtrace-prewalk-b1.txt'),'utf8').split('\n').map(l=>l.match(/f=(\d+) t=([\d.]+) pos=([-\d.,]+) .*w=(\S+)/)).filter(Boolean).map(m=>({f:+m[1],t:+m[2],p:m[3].split(',').map(Number),w:m[4]}));
 const bad=[];for(const q of L){const r=C.check(bl.los,0,q.p);if(r.clr||r.enc)bad.push({t:q.t,w:q.w,p:q.p,clr:r.clr,enc:r.enc,inBox:r.inBox});}
 const wm=bad.filter(b=>/windmill/.test(b.clr||'')||b.inBox.includes('windmill_static_merged'));
 const span=a=>a.length?[a[0].t,a[a.length-1].t]:null;
 console.log(JSON.stringify({poses:L.length,flagged:bad.length,windmill:wm.length,windmillSpanS:span(wm),enclosed:bad.filter(b=>b.enc).length,firstWindmill:wm[0]||null}));
 const ok=L.length>500&&wm.length>0;console.log(JSON.stringify({test:'camera-collision-replay-m2',status:ok?'PASS (gate catches m2)':'FAIL (gate misses m2 windmill)'}));process.exit(ok?0:1);})().catch(e=>{console.error(e);process.exit(1);});
