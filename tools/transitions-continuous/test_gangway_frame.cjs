'use strict';
// 运镜bot full2-cam task 5.3 (REPORT-ONLY gate, pending approval): the gangway reads in frame while she boards (island, deploy +23°)
// and disembarks (meadow, deploy −16°). Gangway = transition-occluders rows sail_gangway_island / sail_gangway_meadow (real
// triangles at the deployed angle). Metric per frame: projected bbox of the 8 corners (pinhole, fovV, w/h), clipped to the screen:
//   share = clipped area / screen area ; inFrame = clipped / unclipped area. Windows:
//   boarding  = LiveHandoff blend I6 lens → ride lens 0 (1.48 s, test live-start) then the ride lens 0 held over A1+A2 walk
//   disembark = sail ride S-f + S-g (stand, gangway off) on the ride lens.
// GATE (full6-cam, approved by Funning): min share ≥ 0.25 % of the frame AND inFrame ≥ 0.9 over each window.
const RL=require('../journey-integration/route/route-legs.cjs'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),AD=H.load('region/TransitionAnchorData.ts'),TS=H.load('region/TransitionStaging.ts'),EC=H.load('region/ExploreCameraCore.ts'),TC=H.load('region/TransitionCamera.ts'),N=H.load('region/RegionNodes.ts').REGION_NODES;
const FLOOR={share:.0025,inFrame:.9},STRICT=true;
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],nrm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function proj(p,b,w,h){const f=nrm(sub(p.target,p.position)),r=nrm(cross(f,[0,1,0])),u=cross(r,f),ty=Math.tan(p.fovVerticalDeg*Math.PI/360),tx=ty*w/h;let x0=9,x1=-9,y0=9,y1=-9;
 for(const X of [b[0],b[3]])for(const Y of [b[1],b[4]])for(const Z of [b[2],b[5]]){const d=sub([X,Y,Z],p.position),z=dot(d,f);if(z<=.05)return {share:0,inFrame:0};const x=dot(d,r)/z/tx,y=dot(d,u)/z/ty;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const A=(x1-x0)*(y1-y0),cx=Math.max(0,Math.min(1,x1)-Math.max(-1,x0)),cy=Math.max(0,Math.min(1,y1)-Math.max(-1,y0));return {share:cx*cy/4,inFrame:A>0?cx*cy/A:0};}
const union=bs=>[0,1,2].map(i=>Math.min(...bs.map(b=>b[i]))).concat([3,4,5].map(i=>Math.max(...bs.map(b=>b[i]))));
(async()=>{const G=await RL.geometry(),O=AD.TRANSITION_OCCLUDERS,gi=union(O.sail_gangway_island),gm=union(O.sail_gangway_meadow),rows=[];let fail=0;
 const at=k=>N.island.nodes.find(n=>n.key===k).at,i5=at('I5'),i6=at('I6');
 for(const [w,h] of RL.SCREENS){const leg=RL.sailLeg(G,[w,h]),ph=id=>leg.phases.find(p=>p.id===id),live=EC.followPose(i6,Math.atan2(i6[0]-i5[0],i6[2]-i5[2]),w,h,0),c0=leg.cam(0);
  const D=TS.TRANSITION_DURATIONS.seg1,walkS=(D.a1DockWalk||0)+(D.a2Gangway||0),bl=1.48;
  const win={boarding:{T:bl+walkS,cam:t=>t<bl?TC.blendPose(live,c0,TC.minJerk(t/bl)):c0,b:gi},disembark:{T:ph('S-g').t1-ph('S-f').t0,cam:t=>leg.cam(ph('S-f').t0+t),b:gm}};
  for(const [id,W] of Object.entries(win)){let sMin=9,sMax=0,fMin=9;for(let t=0;t<=W.T+1e-9;t+=1/30){const q=proj(W.cam(t),W.b,w,h);sMin=Math.min(sMin,q.share);sMax=Math.max(sMax,q.share);fMin=Math.min(fMin,q.inFrame);}
   const r={win:id,scr:`${w}x${h}`,T:+W.T.toFixed(2),shareMinPct:+(sMin*100).toFixed(2),shareMaxPct:+(sMax*100).toFixed(2),inFrameMin:+fMin.toFixed(2),floor:sMin>=FLOOR.share&&fMin>=FLOOR.inFrame?'meets':'BELOW'};rows.push(r);if(r.floor==='BELOW')fail++;}}
 console.table(rows);console.log(`gangway-frame ${fail?'BELOW floor in '+fail+' windows':'meets floor'} (gate)`);process.exit(STRICT&&fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
