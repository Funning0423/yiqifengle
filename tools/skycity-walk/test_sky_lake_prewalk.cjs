'use strict';
// full7 option (a) (Grok Bot 2026-10-26): skycity→lakeside counted from S6; from anywhere else she walks the skycity node path to
// S6 first (region walking). Asserts on every start node + the Mac S0 case: no in-place turn > 90°, every 0.1 m sample on the
// skycity walkable grid (full8: no tolerance any more (场景设计部 b863f120 moved S2, edges keep ≥0.4 m from unwalkable cells); no point inside rock/terrace colliders, no straight segment through terrain), floor step ≤ 0.45 m
// (stairs), the old straight line WAS off-grid (regression evidence), S6 → no prewalk, counted leg keys unchanged.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('../board-ui/harness.cjs').createHarness();
const TS=H.load('region/TransitionStaging.ts'),PW=H.load('region/SkyLakePreWalk.ts'),SK=H.load('region/SkyWalkShot.ts'),RN=H.load('region/RegionNodes.ts'),RW=H.load('region/RegionWalkable.ts'),B1=H.load('region/BalloonB1Start.ts'),NW=H.load('region/NodeWalker.ts');
const M5=TS.TRANSITION_STAGING.skyMooring5a,toW=p=>SK.skyLocalToWorld(M5,p);
// world → skycity local (inverse of skyLocalToWorld)
const r=(M5.worldYawDeg-M5.yawDeg)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),l=M5.pos,o=[M5.world[0]-(c*l[0]+s*l[2]),M5.world[1]-l[1],M5.world[2]-(-s*l[0]+c*l[2])];
const toL=p=>{const x=p[0]-o[0],z=p[2]-o[2];return [c*x-s*z,p[1]-o[1],s*x+c*z];};
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const node=k=>RN.REGION_NODES.skycity.nodes.find(n=>n.key===k).at;
assert.ok(d3(toW(node('S6')),M5.walkWorld[0])<0.05,'S6 = counted-leg start');
assert.equal(PW.skyLakePreWalk(M5.walkWorld[0],M5),null,'at S6: no prewalk');
assert.equal(NW.WALK_SPEED_MPS,1.2);
function sweep(P,tag){let off=0,step=0,pf=null,n=0;for(let i=1;i<P.length;i++){const a=toL(P[i-1]),b=toL(P[i]),m=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/0.1));
 for(let k=0;k<=m;k++){const x=a[0]+(b[0]-a[0])*k/m,z=a[2]+(b[2]-a[2])*k/m,f=RW.walkFloorY('skycity',x,z);n++;if(f===null&&RW.nearestWalkable("skycity",[x,a[1]+(b[1]-a[1])*k/m,z],1e-6)){pf=null;continue;}if(f===null&&!RW.nearestWalkable("skycity",[x,a[1]+(b[1]-a[1])*k/m,z],1e-6)){off++;if(process.env.DBG&&tag)console.log("off",tag,x,z,a[1]+(b[1]-a[1])*k/m,JSON.stringify(RW.nearestWalkable("skycity",[x,a[1],z],0.5)));pf=null;continue;}if(pf!==null)step=Math.max(step,Math.abs(f-pf));pf=f;}}return {off,step,n};}
const out={},bad=[];
for(const k of ['S0','S1','S2','S3','S4','S5']){const st=toW(node(k)),pre=PW.skyLakePreWalk(st,M5);assert.ok(pre,k+' needs a prewalk');
 const turn=B1.maxTurnDeg(pre.path),sw=sweep(pre.path,k),old=sweep([st,M5.walkWorld[1]]);
 out[k]={keys:pre.keys.join('>'),m:+pre.lengthM.toFixed(1),s:+pre.durationS.toFixed(1),turn:+turn.toFixed(1),off:sw.off,stepM:+sw.step.toFixed(2),oldStraightM:+d3(st,M5.walkWorld[1]).toFixed(1),oldOff:old.off};
 if(turn>90+1e-6)bad.push(k+' turn '+turn.toFixed(1));if(sw.off)bad.push(k+' '+sw.off+' samples off walkable');if(sw.step>0.45)bad.push(k+' floor step '+sw.step.toFixed(2));
 assert.ok(d3(pre.path.at(-1),M5.walkWorld[0])<1e-6,k+' ends at S6');}
// the handoff into the counted walk: last prewalk heading → first counted heading ≤ 90°
for(const k of ['S0','S4']){const p=PW.skyLakePreWalk(toW(node(k)),M5).path;const t=B1.maxTurnDeg([p.at(-2),M5.walkWorld[0],M5.walkWorld[1]]);out[k].handoffTurn=+t.toFixed(1);if(t>90)bad.push(k+' handoff turn '+t.toFixed(1));}
assert.ok(out.S0.oldOff>0,'regression evidence: the old straight S0 line leaves the walkable grid');
// wiring: the counted ride always starts at S6 under mooring C; the prewalk reads her live position
const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts'),'utf8');
assert.match(src,/R=lakesideBalloonRide\(atC\?\[\[M5\.walkWorld\[0\]\[0\],M5\.walkWorld\[0\]\[1\],M5\.walkWorld\[0\]\[2\]\] as Vec/);
assert.match(src,/skyPre=atC\?skyLakePreWalk\(g00\?\[g00\.x,g00\.y,g00\.z\]:start,M5 as any\):null/);
assert.match(src,/legClock\.stop\(\{to:'touchdown'/);
// item 5: leg timing = wall + game time + fps, sustained < 15 fps flagged (dt cap 0.1 kept in the ride clocks)
const LT=H.load('region/LegTiming.ts');const lo=LT.legStats('x',10000,[...Array(20).fill(1/6),...Array(200).fill(1/30)]);
assert.ok(Math.abs(lo.gameS-(20/6+200/30))<1e-6&&lo.gameCappedS<lo.gameS&&lo.lowFpsFlag===true&&lo.frames===220,'leg stats');
assert.equal(LT.legStats('y',5000,Array(300).fill(1/60)).lowFpsFlag,false);
console.log(JSON.stringify(out));
assert.deepEqual(bad,[],bad.join('; '));
console.log('PASS skycity → S6 prewalk: graph path, walkable, no turn > 90°');
