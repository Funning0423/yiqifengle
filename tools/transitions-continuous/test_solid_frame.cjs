'use strict';
// 运镜bot full7-cam: solid-colour / sky-only frame gate (Grok Bot 2026-10-26).
// Proxy (this test): every visible frame of the approved transition shots (route-legs sail / balloon / lakeside, 7 screens, every
// 0.25 s, full-black cover frames excluded) casts a 9×16 lens-ray grid against that time's real geometry (leg.los: islands, meadow,
// city, islets, transit clouds, lakeside; the flat backdrops env_sky_dome / cloudsea / cumulus_far are NOT geometry). A frame fails
// when no ray hits anything. Runtime half (camera enabled + world layer on each frame) = cam-trace CAM_OFF / WORLD_LAYER_OFF lines.
// Engine pixel rule (captures): fail when ≥92 % of pixels are within ΔE<6 of the frame median. Flat-sky sub-check (proposal, not on):
// a connected region ≥40 % of the frame with ΔE<2 to its own mean AND |luma gradient| <0.5 %/100 px across it = "flat clear colour".
// Mode: hard gate (QF_SOLID_GATE=report for a report-only run). Sweep: sail 170, balloon 145, lakeside 137 frames × 7 screens, 0 solid; min hit rays 87 / 5 / 126 of 144.
const R=require('../journey-integration/route/route-legs.cjs'),{add,sub}=R.J;
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const GATE=(process.env.QF_SOLID_GATE||'gate')==='gate';// sweep 2026-10-26: 0 false positives on 21 leg×screen rows (3,024 frames) → hard gate
function rays(p,w,h){const f=sub(p.target,p.position),n=Math.hypot(...f),F=f.map(v=>v/n),r=[F[2],0,-F[0]],rn=Math.hypot(r[0],r[2]);r[0]/=rn;r[2]/=rn;
 const u=[F[1]*r[2]-F[2]*r[1],F[2]*r[0]-F[0]*r[2],F[0]*r[1]-F[1]*r[0]],th=Math.tan(p.fovVerticalDeg*Math.PI/360),asp=w/h,out=[];
 for(let j=0;j<16;j++)for(let i=0;i<9;i++){const x=((i+.5)/9*2-1)*th*asp,y=((j+.5)/16*2-1)*th;const d=[F[0]-r[0]*x+u[0]*y,F[1]-r[1]*x+u[1]*y,F[2]-r[2]*x+u[2]*y],m=Math.hypot(...d);out.push(d.map(v=>v/m));}return out;}
// proxy frame verdict: hits / 144 (0 = solid-colour frame)
function frameHits(leg,t,p,w,h,far=3000){let k=0;for(const d of rays(p,w,h)){if(leg.los(t,p.position,add(p.position,d.map(v=>v*far))))k++;}return k;}
module.exports={rays,frameHits};
if(require.main===module)(async()=>{const geo=await R.geometry(),rows=[],fails=[];
 const only=process.env.QF_SOLID_LEGS?process.env.QF_SOLID_LEGS.split(','):null;
 for(const mk of R.legs)for(const scr of SCREENS){const leg=mk(geo,scr);if(only&&!only.some(s=>leg.id.includes(s)))continue;let n=0,bad=0,minHit=145,first=null;
  for(let t=0;t<=leg.T+1e-9;t+=.25){if(leg.black&&leg.black(t))continue;const p=leg.cam(t);const k=frameHits(leg,t,p,scr[0],scr[1]);n++;minHit=Math.min(minHit,k);if(k===0){bad++;if(first===null)first=+t.toFixed(2);}}
  const row={shot:leg.id,scr:scr.join('x'),frames:n,solid:bad,firstAt:first??'-',minHitRays:minHit};rows.push(row);if(bad)fails.push(row);}
 // full8: windmill→balloon (pre-walk follow → B1 start) explicitly, 7 screens, every 0.25 s (Mac m1 579–581 grey)
 const WB=require('./lib-prewalk-cams.cjs');if(!only||only.some(s=>'windmill-balloon'.includes(s)))for(const scr of SCREENS){const leg=WB.windmillBalloonLeg(geo,scr);let n=0,bad=0,minHit=145,first=null;
  for(const q of leg.poses){const k=frameHits(leg,q.t,q.pose,scr[0],scr[1]);n++;minHit=Math.min(minHit,k);if(k===0){bad++;if(first===null)first=+q.t.toFixed(2);}}
  const row={shot:leg.id,scr:scr.join('x'),frames:n,solid:bad,firstAt:first??'-',minHitRays:minHit};rows.push(row);if(bad)fails.push(row);}
 const wbRows=rows.filter(r=>r.shot==='windmill-balloon').length;
 console.table(rows);
 // reproduction of the Mac failures in the proxy: (a) lens in empty sky (sky-only / flat clear colour), (b) no geometry for the frame
 // (region swap, grey clear frame), (c) the camera / world layer off — the runtime half, asserted by test-cam-trace-log state lines.
 const leg=R.legs[1](geo,[390,844]),p=leg.cam(5),up={position:p.position,target:add(p.position,[0,100,0.01]),fovVerticalDeg:40};
 const nowhere={...leg,los:()=>null};
 const repro={skyOnly:frameHits(leg,5,up,390,844)===0,regionSwapGrey:frameHits(nowhere,5,p,390,844)===0,approvedFrameHits:frameHits(leg,5,p,390,844)};
 const ok=fails.length===0&&(only||wbRows===SCREENS.length)&&repro.skyOnly&&repro.regionSwapGrey&&repro.approvedFrameHits>0;
 console.log(JSON.stringify({test:'solid-frame',mode:GATE?'gate':'report-only',falsePositiveRows:fails.length,windmillBalloonRows:wbRows,repro,status:ok?'PASS':(GATE?'FAIL':'BELOW (report-only)')}));
 process.exit(GATE&&!ok?1:0);})().catch(e=>{console.error(e);process.exit(1);});
