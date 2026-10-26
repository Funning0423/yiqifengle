'use strict';
// 运镜bot full9c (Grok Bot option A): the skycity finale ends her AT S6, so the finale→lakeside leg never runs skyLakePreWalk (no fallback-live).
// HARD: stand = S6 node; stand ≤ 0.3 m from the mooring walk start (S6) and skyLakePreWalk(stand) === null (SKY_LAKE_AT_S6_M 0.6 m);
//       held T-02 pose (SKY_FINALE_POSE_LOCAL) on all 7 screens: her margin ≥ 0.08, face not under the WeChat capsule, head + chest seen
//       (real mesh), lens ≥ 1.1 m from the real mesh (26 rays) and nothing within 0.35 m.
// REPORT (until GGbot's playFinale end change lands; QF_FINALE_STAND_STRICT=1 makes it hard): where playFinale's planWalk tail ends today.
// Real mesh = route-legs skyJ (Cw frame = skyMooring5a), poses mapped skycity-local → world through skyMooring5a.
const ROOT=process.cwd();const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');const H=createHarness();
const F=H.load('region/SkyFinaleShot.ts'),NW=H.load('region/NodeWalker.ts'),RN=H.load('region/RegionNodes.ts'),SP=H.load('region/SkyLakePreWalk.ts'),S=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),LS=H.load('region/LensSmooth.ts');
const RL=require(ROOT+'/tools/journey-integration/route/route-legs.cjs');const M=TS.TRANSITION_STAGING.skyMooring5a;
const SCR=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]],d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const D26=[];for(const x of[-1,0,1])for(const y of[-1,0,1])for(const z of[-1,0,1])if(x||y||z){const L=Math.hypot(x,y,z);D26.push([x/L,y/L,z/L]);}
(async()=>{const geo=await RL.geometry(),hit=(a,b)=>RL.hit(geo.skyJ,a,b),W=p=>S.skyLocalToWorld(M,p);
 const s6=RN.REGION_NODES.skycity.nodes.find(n=>n.key==='S6').at,stand=s6,standW=W(stand),walk0=M.walkWorld[0];
 const segs=NW.planWalk('skycity','S4','S6').segments,tail=segs[segs.length-1].path,today=tail[tail.length-1],todayD=d3(W(today),walk0);
 const P=F.SKY_FINALE_POSE_LOCAL,pw=W(P.position),tw=W(P.target),head=W([stand[0],stand[1]+1.45,stand[2]]),chest=W([stand[0],stand[1]+1.05,stand[2]]),face=[stand[0],stand[1]+1.5,stand[2]];
 const scr=SCR.map(([w,h])=>{const m=LS.herMargin(P.position,P.target,P.fovVerticalDeg,stand,[[w,h]]),v=F.ndc(P.position,P.target,P.fovVerticalDeg,w,h,face),px=(v[0]+1)/2*w,py=(1-v[1])/2*h;return {screen:w+'x'+h,herMargin:+m.toFixed(3),facePx:[Math.round(px),Math.round(py)],underCapsule:px>=w-7-87-4&&py<=92};});
 const clr11=D26.filter(d=>hit(pw,pw.map((v,i)=>v+d[i]*1.15))).length,w035=D26.filter(d=>hit(pw,pw.map((v,i)=>v+d[i]*0.35))).length;
 const res={stand:{local:stand,distToS6M:+d3(standW,walk0).toFixed(3),prewalk:SP.skyLakePreWalk(standW,M)===null?'none':'TRIGGERED'},
  playFinaleEndToday:{local:today.map(v=>+v.toFixed(3)),distToS6M:+todayD.toFixed(3),prewalk:SP.skyLakePreWalk(W(today),M)===null?'none':'TRIGGERED',note:'GGbot moves this end to S6 (ggbot/full9c-skyframe)'},
  held:{pose:P,screens:scr,headBlockedBy:hit(pw,head)||'',chestBlockedBy:hit(pw,chest)||'',clr11Rays:clr11,within035Rays:w035}};
 const hard=res.stand.distToS6M<=0.3&&res.stand.prewalk==='none'&&scr.every(s=>s.herMargin>=0.08&&!s.underCapsule)&&!res.held.headBlockedBy&&!res.held.chestBlockedBy&&clr11===0&&w035===0;
 const strict=process.env.QF_FINALE_STAND_STRICT==='1',todayOk=todayD<=0.6&&res.playFinaleEndToday.prewalk==='none';
 const ok=hard&&(!strict||todayOk);console.log(JSON.stringify({test:'finale-stand',...res,todayOk,strict,status:ok?'PASS':'FAIL'},null,1));process.exit(ok?0:1);})().catch(e=>{console.error(e);process.exit(1);});
