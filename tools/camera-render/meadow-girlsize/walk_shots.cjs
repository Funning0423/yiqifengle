#!/usr/bin/env node
'use strict';
/** Follow-walk lens on the meadow (default yaw/pitch) at 7.36 m (default, from her 1.2 m point), 9 m (proposed cap), 14 m (ORBIT_LIMITS max), plus D bend at 9 m.
 *  node walk_shots.cjs OUT_SHOTS.json  → also prints height % and UI gap (walk UI: pause button, safe bands, capsule). */
const fs=require('node:fs');const {load}=require('../../region-nodes/load.cjs');
const O=load('region/MeadowGirlSizeOptions.ts'),RB=load('region/RegionBoardLanding.ts'),BL=load('ui/BoardLayout.ts'),N=load('region/RegionNodes.ts'),C=load('region/ExploreCameraCore.ts');
const w=390,h=844,safe=BL.boardSafeInsets(w,h),ui=RB.girlStandUi(w,h,safe).slice(6);
const e=N.REGION_NODES.meadow.edges.find(x=>x.a==='M1'&&x.b==='M2')||N.REGION_NODES.meadow.edges.find(x=>x.b==='M2'),pts=e.path,i=Math.floor(pts.length/2),foot=pts[i],nx=pts[i+1];
const yaw=Math.atan2(nx[0]-foot[0],nx[2]-foot[2]),base=C.followPose(foot,yaw,w,h),piv=[foot[0],foot[1]+1.2,foot[2]];
const off=[0,1,2].map(k=>base.position[k]-piv[k]),d0=Math.hypot(...off),dir=[0,1,2].map(k=>base.target[k]-base.position[k]);
const shots=[],rows=[];
for(const [id,dist,bend] of [['walk_7.36',d0,null],['walk_9',9,null],['walk_14',14,null],['walk_9_D',9,{mode:'sphere',cx:foot[0],cz:foot[2],R:O.MEADOW_GIRLSIZE.dBendR}]]){
 const p=[0,1,2].map(k=>piv[k]+off[k]*dist/d0),cam={position:p,target:[0,1,2].map(k=>p[k]+dir[k]),fovVerticalDeg:base.fovVerticalDeg};
 const b=RB.girlBoxPt(cam,foot,w,h);let gap=Infinity,cover=false;
 for(const q of ui){const ox=Math.min(b.r,q.r)-Math.max(b.l,q.l),oy=Math.min(b.b,q.b)-Math.max(b.t,q.t);if(ox>0&&oy>0)cover=true;else gap=Math.min(gap,Math.hypot(Math.max(q.l-b.r,b.l-q.r,0),Math.max(q.t-b.b,b.t-q.b,0)));}
 const row={id,distM:+dist.toFixed(2),heightFrac:+((b.b-b.t)/h).toFixed(4),uiGapPt:cover?-1:+gap.toFixed(1),box:[b.l,b.t,b.r,b.b].map(v=>+v.toFixed(1))};rows.push(row);
 console.log(id,row.distM+'m',(row.heightFrac*100).toFixed(1)+'%','gap',row.uiGapPt);
 shots.push({name:id,node:'M1-M2',w,h,foot,faceDeg:yaw*180/Math.PI,cam,ui,box:row.box,bend,metrics:row});}
fs.writeFileSync(process.argv[2],JSON.stringify({edge:e.a+'-'+e.b,yawDeg:+(yaw*180/Math.PI).toFixed(1),shots},null,1));
