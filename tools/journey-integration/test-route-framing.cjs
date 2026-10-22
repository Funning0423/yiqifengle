#!/usr/bin/env node
'use strict';
/* b16 route framing contract (运镜bot; replaces test-journey-framing.cjs, deleted with the rainbow bridge in f678c084).
 * Same legs/frames as test-route-occlusion (route/route-legs.cjs, 7 portrait screens, every 1/30 s, black frames skipped).
 * Her screen box = the projected corners of her body box (standing 0.6 × 1.7253 × 0.6 m; seated box on the sail bench / in the
 * basket), aspect = the screen's own w/h.
 *  F1 in frame: every box corner in front of the lens and inside the viewport (|ndc x|,|ndc y| ≤ 1).
 *  F2 ≤ 80 % of the width (camera rule, F9 of the old test): the right edge of her box ≤ 80 % of the screen width
 *     (ndc x ≤ 0.60), checked on every visible frame. Her box width / screen width is reported too.
 *  F3 no UI overlap: her box stays inside the safe area and clear of the WeChat capsule (BoardLayout.boardSafeInsets; during
 *     the journey no board UI is shown). Gap < 0 fails; frames under the team's 13 pt margin are reported.
 *  F4 board end: the final frame of each leg is the region's board camera; the board UI (tray, toolbar, hint banner with
 *     GGbot's UI footprints) vs her stand is the existing board-hint-above-tray / region-landing-hook contract; its status is
 *     read from tools/board-ui/test_board_hint_above_tray.cjs (run here) and copied into this report.
 * Not a render or device acceptance. */
const fs=require('node:fs'),cp=require('node:child_process'),R=require('./route/route-legs.cjs'),F=R.F,BL=R.BL;
const FPS=+(process.env.QF_ROUTE_FPS||30),UI_GAP=13;
const screens=process.env.QF_ROUTE_SCREENS?JSON.parse(process.env.QF_ROUTE_SCREENS):R.SCREENS;
function proj(pose,aspect,p){const {fw,r,up,th}=F.basis(pose),v=[p[0]-pose.position[0],p[1]-pose.position[1],p[2]-pose.position[2]],z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2];return [(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*aspect),(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th),z];}
(async()=>{const G=await R.geometry(),results=[];
 for(const mk of R.legs)for(const [w,h] of screens){const leg=mk(G,[w,h]),a=w/h,ins=BL.boardSafeInsets(w,h),cap=ins.capsule;
  const bad={F1:[],F2:[],F3:[]};let skipped=0,n=0,minGap=1e9,gapAt=null,under13=0,maxX=-9,maxXAt=null,maxW=0,minH=9;
  for(let i=0;i/FPS<=leg.T+1e-9;i++){const t=i/FPS;if(leg.black(t))continue;if(leg.herValid&&!leg.herValid(t)){skipped++;continue;}n++;const c=leg.cam(t),b=leg.her(t),P=b.box.map(p=>proj(c,a,p));
   const behind=P.some(p=>p[2]<=.05),xs=P.map(p=>p[0]),ys=P.map(p=>p[1]);
   if(behind||Math.min(...xs)<-1||Math.max(...xs)>1||Math.min(...ys)<-1||Math.max(...ys)>1)bad.F1.push(+t.toFixed(2));
   if(behind)continue;const xr=Math.max(...xs);if(xr>maxX){maxX=xr;maxXAt=+t.toFixed(2);}if(xr>.6)bad.F2.push(+t.toFixed(2));
   const px=[(Math.min(...xs)+1)/2*w,(1-Math.max(...ys))/2*h,(xr+1)/2*w,(1-Math.min(...ys))/2*h];maxW=Math.max(maxW,(px[2]-px[0])/w);minH=Math.min(minH,(px[3]-px[1])/h);
   const edge=Math.min(px[0]-ins.left,w-ins.right-px[2],px[1]-ins.top,h-ins.bottom-px[3]),capGap=cap?Math.max(cap.left-px[2],px[0]-cap.right,cap.top-px[3],px[1]-cap.bottom):1e9,gap=Math.min(edge,capGap);
   if(gap<minGap){minGap=gap;gapAt=+t.toFixed(2);}if(gap<0)bad.F3.push(+t.toFixed(2));else if(gap<UI_GAP)under13++;}
  const ph=t=>(leg.phases.find(p=>t>=p.t0&&t<p.t1)||leg.phases.at(-1)).id,sp=ts=>{const o=[];for(const t of ts){const l=o.at(-1);if(l&&t-l[1]<=1.5/FPS)l[1]=t;else o.push([t,t]);}return o.map(([x,y])=>({t0:x,t1:y,phase:ph(x)}));};
  results.push({leg:leg.id,screen:`${w}x${h}`,frames:n,herNotModelledFrames:skipped,F1:bad.F1.length?'FAIL':'PASS',F2:bad.F2.length?'FAIL':'PASS',F3:bad.F3.length?'FAIL':'PASS',
   outOfFrame:{frames:bad.F1.length,spans:sp(bad.F1).slice(0,12)},rightOf80pct:{frames:bad.F2.length,spans:sp(bad.F2).slice(0,12),maxRightEdgePctOfWidth:+((maxX+1)/2*100).toFixed(1),atS:maxXAt},
   ui:{minGapPt:+minGap.toFixed(1),atS:gapAt,phase:gapAt==null?null:ph(gapAt),overlapFrames:bad.F3.length,spans:sp(bad.F3).slice(0,12),framesUnder13pt:under13},maxWidthFrac:+maxW.toFixed(3),minHeightFrac:+minH.toFixed(4)});
  const r=results.at(-1);console.error(r.leg,r.screen,r.F1,r.outOfFrame.frames,r.F2,r.rightOf80pct.frames,r.rightOf80pct.maxRightEdgePctOfWidth,r.F3,r.ui.minGapPt);}
 let board={status:'NOT RUN'};try{const out=cp.execFileSync(process.execPath,[__dirname+'/../board-ui/test_board_hint_above_tray.cjs'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:process.env});board={status:'PASS',tail:out.trim().split('\n').slice(-3)};}catch(e){board={status:'FAIL',tail:String(e.stdout||'').trim().split('\n').slice(-5),err:String(e.stderr||e).slice(0,600)};}
 const status=results.every(r=>r.F1==='PASS'&&r.F2==='PASS'&&r.F3==='PASS')&&board.status==='PASS'?'PASS':'FAIL';
 const report={status,timeUTC:new Date().toISOString(),fps:FPS,F4_boardEnd:board,scope:'Projected body box on real TS cameras; journey UI = safe area + capsule; board-end UI = board-hint-above-tray. Not a render.',results};
 fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/route-framing.json',JSON.stringify(report,null,1)+'\n');
 console.log(JSON.stringify({status,F4:board.status,rows:results.map(r=>[r.leg,r.screen,r.F1,r.F2,r.F3])}));require('./route/route-gate.cjs').gate('test-route-framing.cjs',[...results.flatMap(r=>['F1','F2','F3'].filter(k=>r[k]==='FAIL').map(check=>({leg:r.leg,check}))),...(board.status==='PASS'?[]:['sail','→skycity','lakeside'].map(leg=>({leg,check:'F4'})))]);
})().catch(e=>{console.error(e);process.exit(2);});
