'use strict';
// b19 full5 P1 (Mac 2026-10-26: B1 ~39 s walk, balloon leg 84.4 s > 50 s): B1 must stay within its 11.3 s budget from EVERY place
// the journey can hand her to the balloon leg — not only M6 after the M4→M6 reward walk (live-start), but also the A6 end (sail M1)
// when the island→skycity journey is chained without playing the meadow levels. Uses the runtime constants and the
// BalloonTransit B1 formula (walkS = max(toBasket*min(1,L/6), L/walkMps); + doorReach + intoBasket + sitDown).
const assert=require('node:assert/strict'),path=require('node:path');
const H=require('../board-ui/harness.cjs').createHarness();
const TS=H.load('region/TransitionStaging.ts'),TL=H.load('region/TransportLeg.ts'),PW=H.load('region/BalloonB1Start.ts'),NW=H.load('region/NodeWalker.ts');
const S=TS.TRANSITION_STAGING,D=TS.TRANSITION_DURATIONS.seg3,M=S.meadow,B=S.basket;
const yaw=M.basketYawLocalDeg*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw);
const W=l=>[M.launch[0]+l[0]*c+l[2]*s,M.launch[1]+l[1],M.launch[2]-l[0]*s+l[2]*c];
const len=p=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][2]-p[i-1][2]);return L;};
const nodes=require('../region-nodes/region-nodes.json'),N=Object.fromEntries((nodes.regions||nodes).meadow.nodes.map(n=>[n.key,n.at]));
const starts={'gate (M4→M6 departure cut at the gate, live-start)':PW.B1_HANDOFF,'A6 end = sail M1 (chained island→skycity, no meadow level)':TL.SAIL_M1_LOCAL};
const BUDGET=11.3+0.5,out={};let fail=[];
// full6 (Grok Bot 2026-10-26 decision a): far from M6 she first walks the node graph to M6 (region walking, 1.2 m/s, not in the cap); B1 starts at M6.
const pre={};
for(const [k,p0] of Object.entries(starts)){const pw=PW.b1PreWalk(p0,W(B.outside));pre[k]=pw?{from:pw.fromKey,m:+pw.lengthM.toFixed(2),s:+pw.durationS.toFixed(2)}:null;const p=pw?pw.path[pw.path.length-1]:p0;const toDoor=PW.b1DoorPath(p,W(B.outside),W(B.doorOut)),L=len(toDoor),walkS=Math.max(D.toBasket*Math.min(1,L/6),L/S.walkMps);
 const b1=walkS+D.doorReach+D.intoBasket+D.sitDown;out[k]={start:p,walkM:+L.toFixed(2),walkS:+walkS.toFixed(2),b1S:+b1.toFixed(2)};if(b1>BUDGET)fail.push(k);}
const dep=PW.meadowDepartureCut('meadow','M6','skycity',NW.routeKeys('meadow','M4','M6').path);assert.deepEqual(dep.at(-1),PW.B1_HANDOFF,'departure ends at the gate');
console.log(JSON.stringify({status:fail.length?'FAIL':'PASS',budgetS:BUDGET,preWalk:pre,b1:out,normalDepartureM4toGate:{m:+(()=>{let L=0;for(let i=1;i<dep.length;i++)L+=Math.hypot(dep[i][0]-dep[i-1][0],dep[i][1]-dep[i-1][1],dep[i][2]-dep[i-1][2]);return L;})().toFixed(2)}},null,1));
// normal flow (L5–L8 played, post-L8 departure M4→M6 cut at the gate): NO pre-walk; only the chained save (A6 end M1) walks M1→gate
assert.equal(PW.b1PreWalk(dep.at(-1),W(B.outside)),null,'normal flow must not pre-walk');
const pm=PW.b1PreWalk(TL.SAIL_M1_LOCAL,W(B.outside));assert(pm&&JSON.stringify(pm.path.at(-1))===JSON.stringify(PW.B1_HANDOFF),'chained save ends at the gate');
assert.equal(NW.WALK_SPEED_MPS,1.2,'natural speed, no speed-up');assert(Math.abs(pm.durationS-pm.lengthM/1.2)<1e-9);
// never through the yard fence (z −20.8…−21.3): any crossing of that band must be within the gate x∈[2.2,3.0] (gate 2.6,−20.8)
for(let i=1;i<pm.path.length;i++){const a=pm.path[i-1],b=pm.path[i];if((a[2]-(-21.05))*(b[2]-(-21.05))<0){const t=(-21.05-a[2])/(b[2]-a[2]),x=a[0]+(b[0]-a[0])*t;assert(x>=2.2&&x<=3.0,'fence crossed at x='+x.toFixed(2));}}
assert.equal(fail.length,0,'B1 over budget from: '+fail.join('; '));
