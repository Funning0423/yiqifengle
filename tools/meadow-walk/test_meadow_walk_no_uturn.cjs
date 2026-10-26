'use strict';
// Grok Bot 2026-10-26 (gate handoff): no in-place turn > 90° on any meadow walk path or handoff.
// Real RegionNodes / NodeWalker / BalloonB1Start / TransitionStaging modules.
const assert=require('node:assert/strict');
const H=require('../board-ui/harness.cjs').createHarness();
const NW=H.load('region/NodeWalker.ts'),PW=H.load('region/BalloonB1Start.ts'),RN=H.load('region/RegionNodes.ts'),TS=H.load('region/TransitionStaging.ts');
const S=TS.TRANSITION_STAGING,M=S.meadow,B=S.basket,yaw=M.basketYawLocalDeg*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw);
const W=l=>[M.launch[0]+l[0]*c+l[2]*s,M.launch[1]+l[1],M.launch[2]-l[0]*s+l[2]*c],OUT=W(B.outside),DOOR=W(B.doorOut);
const MAX=PW.MAX_TURN_DEG;assert.equal(MAX,90);const bad=[];const chk=(name,p)=>{const t=PW.maxTurnDeg(p);if(t>MAX+1e-6)bad.push(name+' '+t.toFixed(1)+'°');return t;};
// 1) every meadow edge as walked (both directions)
for(const e of RN.REGION_NODES.meadow.edges){chk('edge '+e.a+'→'+e.b,e.path);chk('edge '+e.b+'→'+e.a,[...e.path].reverse());}
// 2) every node→node route the game can play, as cut by the departure rule, + its handoff into B1 when it ends at the gate
const keys=RN.REGION_NODES.meadow.nodes.map(n=>n.key),out={};
for(const a of keys)for(const b of keys){if(a===b)continue;const full=NW.routeKeys('meadow',a,b).path,p=PW.meadowDepartureCut('meadow',b,'skycity',full);
 const ends=JSON.stringify(p.at(-1))===JSON.stringify(PW.B1_HANDOFF);const door=ends?PW.b1DoorPath(p.at(-1),OUT,DOOR):null;
 const walk=ends?[...p,...door.slice(1)]:p;out[a+'→'+b]=+chk('route '+a+'→'+b+(ends?' +B1':''),walk).toFixed(1);}
// 3) chained journey: sail M1 → prewalk → gate → B1 (and an old save standing at M6)
const TL=H.load('region/TransportLeg.ts');
for(const [name,here] of [['A6 end M1',TL.SAIL_M1_LOCAL],['standing at M6',RN.REGION_NODES.meadow.nodes.find(n=>n.key==='M6').at],['standing at M4',RN.REGION_NODES.meadow.nodes.find(n=>n.key==='M4').at]]){
 const pre=PW.b1PreWalk(here,OUT),start=pre?pre.path.at(-1):here,door=PW.b1DoorPath(start,OUT,DOOR),walk=pre?[...pre.path,...door.slice(1)]:door;out[name]=+chk('chained '+name,walk).toFixed(1);}
// 4) normal flow (post-L8 departure M4→M6) ends at the gate and B1 starts there with no pre-walk
const dep=PW.meadowDepartureCut('meadow','M6','skycity',NW.routeKeys('meadow','M4','M6').path);
assert.deepEqual(dep.at(-1),PW.B1_HANDOFF,'M4→M6 departure is cut at the gate');assert.equal(PW.b1PreWalk(dep.at(-1),OUT),null,'normal flow: no pre-walk');
assert.equal(PW.b1PreWalk(PW.B1_HANDOFF,OUT),null);
console.log(JSON.stringify({maxTurnDeg:out},null,0));
assert.deepEqual(bad,[],'in-place turns > 90°: '+bad.join('; '));
console.log('PASS meadow walks + handoffs: no in-place turn > 90°');
