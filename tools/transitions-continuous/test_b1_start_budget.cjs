'use strict';
// b19 full5 P1 (Mac 2026-10-26: B1 ~39 s walk, balloon leg 84.4 s > 50 s): B1 must stay within its 11.3 s budget from EVERY place
// the journey can hand her to the balloon leg — not only M6 after the M4→M6 reward walk (live-start), but also the A6 end (sail M1)
// when the island→skycity journey is chained without playing the meadow levels. Uses the runtime constants and the
// BalloonTransit B1 formula (walkS = max(toBasket*min(1,L/6), L/walkMps); + doorReach + intoBasket + sitDown).
const assert=require('node:assert/strict'),path=require('node:path');
const H=require('../board-ui/harness.cjs').createHarness();
const TS=H.load('region/TransitionStaging.ts'),TL=H.load('region/TransportLeg.ts');
const S=TS.TRANSITION_STAGING,D=TS.TRANSITION_DURATIONS.seg3,M=S.meadow,B=S.basket;
const yaw=M.basketYawLocalDeg*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw);
const W=l=>[M.launch[0]+l[0]*c+l[2]*s,M.launch[1]+l[1],M.launch[2]-l[0]*s+l[2]*c];
const len=p=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][2]-p[i-1][2]);return L;};
const nodes=require('../region-nodes/region-nodes.json'),N=Object.fromEntries((nodes.regions||nodes).meadow.nodes.map(n=>[n.key,n.at]));
const starts={'M6 (M4→M6 reward walk, live-start)':N.M6,'A6 end = sail M1 (chained island→skycity, no meadow level)':TL.SAIL_M1_LOCAL};
const BUDGET=11.3+0.5,out={};let fail=[];
for(const [k,p] of Object.entries(starts)){const toDoor=[p,W(B.outside),W(B.doorOut)],L=len(toDoor),walkS=Math.max(D.toBasket*Math.min(1,L/6),L/S.walkMps);
 const b1=walkS+D.doorReach+D.intoBasket+D.sitDown;out[k]={start:p,walkM:+L.toFixed(2),walkS:+walkS.toFixed(2),b1S:+b1.toFixed(2)};if(b1>BUDGET)fail.push(k);}
console.log(JSON.stringify({status:fail.length?'FAIL':'PASS',budgetS:BUDGET,b1:out},null,1));
assert.equal(fail.length,0,'B1 over budget from: '+fail.join('; '));
