'use strict';
// 运镜bot full9c: tools model of the skycity walk lens (RegionNodeStage.playReward/playFinale + SkyRunLens), model-local, 60 Hz.
// Entry: the board lens (skycityVisitPose per screen, the pose RegionBoardLanding hands the world lens) → skyRailJoin (SKY_JOINS.i,
// mesh-planned) → the walk rail at her start; every planWalk run at 1.2 m/s on skyRailPose (part = run: the runs are separated by the
// walk plan's own skip — the lens follows skyRailFollow, which takes the baked SKY_JOINS.m path across it, join:'skip'); fromS6 = planSkip: board → rail at S4, then she is skipped to 1.2 m before S6; exit: skyRailJoin (SKY_JOINS.o) back to the board lens (none for S4>S6: 1 s stand hold). Samples {part,h,p,join}.
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),RL=H.load('region/SkyRunLens.ts'),NW=H.load('region/NodeWalker.ts'),F=H.load('region/SkyFinaleShot.ts'),V=H.load('region/SkycityVisitPose.ts');
const WALKS=['S1>S2','S2>S3','S3>S4','S4>S5','S4>S6'],SPEED=1.2,SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const board=([w,h])=>V.skycityVisitPose([-1.4,-0.07,32.6],[0,-0.068,30],w/h)/* anchor_spawn_girl / anchor_starcourt_center, model-local */;
const segsOf=w=>{const [a,b]=w.split('>');return NW.planWalk('skycity',a,b).segments;};
const along=(P,d)=>{let acc=0;for(let i=1;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]);if(acc+l>=d||i===P.length-1){const u=Math.max(0,Math.min(1,(d-acc)/(l||1)));return P[i-1].map((v,k)=>v+(P[i][k]-v)*u);}acc+=l;}return P[0];};
const plen=P=>{let l=0;for(let i=1;i<P.length;i++)l+=Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]);return l;};
function samples(w,screen,{fromS6=false,exit=true}={}){const s=segsOf(w),out=[],B=board(screen),f=RL.skyRailFollow(w),DT=1/60;
 {const h=s[0].path[0],j=RL.skyRailJoinPlan(w,B,f(h,0));for(let i=0;i<=Math.ceil(j.T*60);i++)out.push({part:0,h,p:RL.skyRailJoin(j,Math.min(1,i/60/j.T),h),join:'in'});}
 const put=(h,part)=>{const p=f(h,DT),r=RL.skyRailPose(w,h),sk=Math.hypot(...p.position.map((v,k)=>v-r.position[k]))>1e-9||Math.hypot(...p.target.map((v,k)=>v-r.target[k]))>1e-9;out.push({part,h,p,...(sk?{join:'skip'}:{})});};
 s.forEach((sg,si)=>{if(fromS6&&si<s.length-1)return;const L=plen(sg.path);for(let d=fromS6?Math.max(0,L-1.2):0;d<=L+1e-9;d+=SPEED/60)put(along(sg.path,d),si);});
 const h=s.at(-1).path.at(-1),pt=out.at(-1).part;
 if(w==='S4>S6'){for(let i=0;i<60;i++)put(h,pt);}
 else if(exit){const j=RL.skyRailJoinPlan(w,out.at(-1).p,B,true);for(let i=0;i<=Math.ceil(j.T*60);i++)out.push({part:pt,h,p:RL.skyRailJoin(j,Math.min(1,i/60/j.T),h),join:'out'});}
 return out;}
module.exports={WALKS,SCREENS,board,samples,segsOf,RL,F,H};
