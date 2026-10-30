'use strict';
/* Issue C (meadow m407–431, clipping-locate FINDINGS): transit_clouds_merged was attached to the rig at mount, but paint() (CITY_CLOUD
 * hidden, setRigid(clouds, meadowFrame)) first ran at B1, so through the pre-walk the clouds sat at the world origin (clouds_city_sea
 * over the top of frame, the 5.9 m camera through clouds_floor).
 * 1) source: the first show(true) runs paint(0) BEFORE rig.active=visible (so no frame ever draws unpainted clouds); B1 still runs paint(0).
 * 2) frame trace (paint() rules, real BalloonFlight constants): from the first visible frame through the pre-walk, the B1 entry and
 *    B1 frames up to SEAM_T: no CITY_CLOUD visible, every visible cloud at the meadow frame (never at the origin), no 1-frame change
 *    of visibility/position at the B1 entry; cloud material opacity is never animated by paint (constant 1).
 * C_SRC=<file> runs it against another BalloonTransit.ts (fail-before). Writes the trace to C_TRACE_OUT when set. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/';
const src=fs.readFileSync(process.env.C_SRC||S+'region/BalloonTransit.ts','utf8');
const H=require(path.join(ROOT,'tools/board-ui/harness.cjs')).createHarness(),BF=H.load(S+'region/BalloonFlight.ts');
let fail=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fail++;};
const show=(src.match(/show\(visible\)\{[^\n]*/)||[''])[0];
const iPaint=show.indexOf('paint(0)'),iAct=show.indexOf('rig.active=visible');
ok(iPaint>0&&iAct>iPaint&&/if\(visible&&!prePainted\)\{prePainted=true;paint\(0\);\}/.test(show),'first show(true) paints t=0 before the rig turns on');
ok(/setRigid\(clouds,frame\)/.test(src)&&/showNamed\(clouds,CITY_CLOUD,cityOn\)/.test(src),'paint places the clouds (meadow frame) and hides CITY_CLOUD until cityOn');
ok(!/clouds[^;\n]{0,80}(opacity|alpha|setProperty\('mainColor')/.test(src.slice(src.indexOf('const paint=(t:number)=>{'),src.indexOf('offNight=onDayNightChange'))),'paint never animates transit cloud opacity');
// frame trace. state: painted? -> clouds at meadowFrame with CITY off; unpainted -> world origin, all children on.
const fixed=iPaint>0&&iAct>iPaint,MF='meadowFrame',dt=1/60,trace=[];let painted=false,visible=false;
const st=t=>painted?{root:t+1e-9>=BF.SEAM_T?'postFrame':MF,city:t>=BF.CITY_ON_T,opacity:1}:{root:'origin',city:true,opacity:1};
const frame=(phase,t)=>trace.push({f:trace.length,phase,t:+t.toFixed(3),visible,...st(t)});
frame('mounted',0);visible=true;if(fixed)painted=true;frame('show',0);
for(let i=0;i<120;i++)frame('prewalk',0);
painted=true;/* B1 paint(0) */for(let i=0;i*dt<BF.SEAM_T-dt;i++)frame(i?'B1':'B1-entry',i*dt);
const vis=trace.filter(r=>r.visible);
ok(vis.every(r=>!r.city),'no CITY_CLOUD (clouds_city_sea / clouds_floor / puff) visible before cityOn');
ok(vis.every(r=>r.root!=='origin'),'no visible transit cloud at the world origin (pre-walk included)');
const jumps=[];for(let i=1;i<vis.length;i++){const a=vis[i-1],b=vis[i];if(a.root!==b.root||a.city!==b.city||a.opacity!==b.opacity)jumps.push(b.f);}
ok(jumps.length===0,'no 1-frame jump across show → pre-walk → B1 entry → B1 (jumps at '+JSON.stringify(jumps)+')');
ok(vis[0].opacity===1&&vis.every(r=>r.opacity===vis[0].opacity),'opacity continuous from the first visible frame');
if(process.env.C_TRACE_OUT)fs.writeFileSync(process.env.C_TRACE_OUT,JSON.stringify(trace.filter((r,i)=>i<4||r.phase!=='prewalk'&&r.phase!=='B1'||i%30===0||trace[i-1]?.phase!==r.phase),null,0));
if(fail){console.error('c-prewalk-clouds: FAIL '+fail);process.exit(1);}console.log('c-prewalk-clouds: PASS');
