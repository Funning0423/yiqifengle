'use strict';
/* Shared coast-board evaluation for board-kit-camera / coast-tap-area (P1). Pure numbers; gates live in the tests. */
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const FAR_MIN_PT=28,TAP_JITTER_PT=8;
function farRow(B,b){return [0,1,2,3,4,5,6].map(i=>({i,...B.effectiveTapSize(b,i)}));}
/* smallest/largest distance (m, 0.01 steps) at which the edge rule AND far row ≥28 hold, for a HUD variant and look-at offset */
function feasible(K,B,kit,w,h,variant,offset){const hud=B.kitHudLimits(kit,w,h,variant);if(hud.variant!==variant)return null;let lo=null,hi=null,best=null;
 for(let d=10;d<=32.0001;d+=0.01){const b=B.projectBoard(kit,w,h,{distanceM:d,lookAtOffsetM:offset});if(!b)continue;const e=B.edgeReport(b,hud),f=Math.min(...farRow(B,b).map(x=>x.short));
  if(!e.problems.length&&f>=FAR_MIN_PT){if(lo===null){lo=d;best={d,far:f,e};}hi=d;}}
 return {hud,lo,hi,best};}
module.exports={SCREENS,FAR_MIN_PT,TAP_JITTER_PT,farRow,feasible};
