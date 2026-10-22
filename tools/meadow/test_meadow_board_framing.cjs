#!/usr/bin/env node
'use strict';
/** r5 meadow-girlsize (decision A): the meadow board camera frames her M1 stand clear of the board UI and bigger than before.
 *  Same camera for the lease (MeadowBoardBackground.frame), the journey end (regionBoardCamera with size) and the stand pick. */
const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
const {load,ROOT}=require('../region-nodes/load.cjs');
const RB=load('region/RegionBoardLanding.ts'),BL=load('ui/BoardLayout.ts'),N=load('region/RegionNodes.ts'),MS=load('region/MeadowSceneData.ts');
const node=k=>N.REGION_NODES.meadow.nodes.find(n=>n.key===k).at;
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[768,1024]];
/** ≥ 12% of the screen height on every screen, except 390×844 which is frozen at the reviewed 11.9% (Grok Bot: keep exactly as is). */
const MIN_FRAC=0.12,FROZEN={'390x844':0.1190,'414x896':0.1233,'768x1024':0.2223},EDGE_MIN=4;
const fails=[];
// default (no sail journey / bridge fallback) = the authored camera, unchanged
for(const [w,h] of [[390,844],[768,1024]])assert.deepEqual(RB.meadowBoardCamera(w,h),MS.meadowScenePose(w/h),'default framing = meadowScenePose');
RB.setMeadowBoardFraming('A');assert.equal(RB.meadowBoardFraming(),'A');
const src={region:'meadow',map:{toJourney:p=>p,toBoard:p=>p}};
for(const [w,h] of SCREENS){const k=w+'x'+h,safe=BL.boardSafeInsets(w,h),cam=RB.meadowBoardCamera(w,h),ui=RB.girlStandUi(w,h,safe),b=RB.girlBoxPt(cam,node('M1'),w,h);
 if(!b){fails.push(k+' M1 behind camera');continue;}
 // UI gap: every girlStandUi rect (tray, plate, tools + ring/badge, hint, pause, safe bands, capsule); edge: screen border.
 let gap=Infinity;for(const q of ui){const ox=Math.min(b.r,q.r)-Math.max(b.l,q.l),oy=Math.min(b.b,q.b)-Math.max(b.t,q.t);gap=ox>0&&oy>0?-1:Math.min(gap,Math.hypot(Math.max(q.l-b.r,b.l-q.r,0),Math.max(q.t-b.b,b.t-q.b,0)));}
 const edge=Math.min(b.l,w-b.r,b.t,h-b.b),frac=(b.b-b.t)/h,old=RB.girlBoxPt(MS.meadowScenePose(w/h),node('M1'),w,h);
 console.log(k,'M1 '+(frac*100).toFixed(2)+'% (was '+((old.b-old.t)/h*100).toFixed(1)+'%) UI gap '+gap.toFixed(1)+' pt, edge '+edge.toFixed(1)+' pt');
 if(gap<RB.GIRL_STAND.minGapPt)fails.push(k+' UI gap '+gap.toFixed(1));
 if(edge<EDGE_MIN)fails.push(k+' edge '+edge.toFixed(1));
 if(FROZEN[k]!==undefined){if(Math.abs(frac-FROZEN[k])>5e-4)fails.push(k+' changed: '+(frac*100).toFixed(2)+'% vs frozen '+FROZEN[k]*100);}
 else if(frac<MIN_FRAC)fails.push(k+' height '+(frac*100).toFixed(2)+'% < 12%');
 for(const n of ['M2','M3','M4'])if(!RB.girlBoxPt(cam,node(n),w,h))fails.push(k+' '+n+' behind camera');
 const viaSrc=RB.regionBoardCamera(src,w/h,{width:w,height:h});assert.deepEqual(viaSrc,cam,'journey end = lease camera '+k);}
// lease and journey both use meadowBoardCamera with the layout size
const lease=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/MeadowBoardBackground.ts'),'utf8'),comp=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts'),'utf8'),ad=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts'),'utf8');
if(!/meadowBoardCamera\(layout\.width,layout\.height\)/.test(lease))fails.push('lease does not use meadowBoardCamera');
if(!/regionBoardPose\(src,v\.width\/v\.height,v\)/.test(comp))fails.push('landing hook does not pass the viewport size');
if(!/regionBoardEnd\(boardSrc,v\.width\/v\.height,v\)/.test(ad))fails.push('journey end does not pass the viewport size');
if(!/setMeadowBoardFraming\('A'\);/.test(ad))fails.push('adapter does not pick framing A for the sail arrival');
if(fails.length){console.error('meadow-board-framing FAIL\n '+fails.join('\n '));process.exit(1);}
console.log('meadow-board-framing PASS');
