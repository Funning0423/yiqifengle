'use strict';
// b19 (Grok Bot): regression for the skycity S2→S3 / S3→S4 edges that grazed the runtime-unwalkable stump cell at local (4.8,1.2).
// Every point of these baked edges (sampled every 5 cm) keeps ≥0.4 m box clearance from every runtime-unwalkable cell
// (RegionWalkable.walkFloorY === null). b19 s4-clearance: NO exemptions — S4 moved to (0.2,2.98,-5.4) after the wall-corner
// chamfers at (2.6,-6.2)/(3.4,-7.0); S4 node ≥0.5 m, every S4 edge (S3-S4,S4-S5,S4-S6) ≥0.4 m, turns ≤90°,
// S3→S4→S6 walk ≤ full8 baseline 48.902 m (17.382+31.52) so the S6 resume departure is not longer.
// Also: no null floor sample, no turn >90°, S2 node itself has ≥0.4 m clearance.
const assert=require('node:assert/strict');
const H=require('../board-ui/harness.cjs').createHarness();
const RN=H.load('region/RegionNodes.ts'),RW=H.load('region/RegionWalkable.ts');
const REG='skycity',CLEAR=0.4,NODE_CLEAR=0.5,S6_BASE_M=48.902,CELL=0.4,STEP=0.05;
const sky=RN.REGION_NODES[REG],node=k=>sky.nodes.find(n=>n.key===k).at;
const blocked=new Map();
function isNull(cx,cz){const k=cx+','+cz;if(!blocked.has(k))blocked.set(k,RW.walkFloorY(REG,cx,cz)===null);return blocked.get(k);}
// box distance from point to the 0.4 m cell centred on (cx,cz)
const boxD=(x,z,cx,cz)=>Math.hypot(Math.max(0,Math.abs(x-cx)-CELL/2),Math.max(0,Math.abs(z-cz)-CELL/2));
function clearAt(x,z){let best=Infinity;const r=Math.ceil((CLEAR+CELL)/CELL)+1;
 const gx=Math.round(x/CELL)*CELL,gz=Math.round(z/CELL)*CELL;
 for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){const cx=+(gx+i*CELL).toFixed(2),cz=+(gz+j*CELL).toFixed(2);if(isNull(cx,cz))best=Math.min(best,boxD(x,z,cx,cz));}
 return best;}
const turn=(a,b,c)=>{const u=[b[0]-a[0],b[2]-a[2]],v=[c[0]-b[0],c[2]-b[2]];const d=(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v));return Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI;};
const exempt={S2:0,S3:0,S4:0,S5:0,S6:0};
for(const [a,b] of [['S2','S3'],['S3','S4'],['S4','S5'],['S4','S6']]){
 const e=sky.edges.find(x=>x.a===a&&x.b===b);assert.ok(e,a+'-'+b+' edge exists');
 const P=e.path,A=node(a),B=node(b);let min=Infinity,minAt=null,nulls=0,maxT=0;
 for(let i=1;i<P.length-1;i++)maxT=Math.max(maxT,turn(P[i-1],P[i],P[i+1]));
 for(let i=0;i<P.length-1;i++){const p=P[i],q=P[i+1],L=Math.hypot(q[0]-p[0],q[2]-p[2]),n=Math.max(1,Math.ceil(L/STEP));
  for(let s=0;s<=n;s++){const t=s/n,x=p[0]+(q[0]-p[0])*t,z=p[2]+(q[2]-p[2])*t;
   if(RW.walkFloorY(REG,x,z)===null)nulls++;
   if(Math.hypot(x-A[0],z-A[2])<exempt[a]||Math.hypot(x-B[0],z-B[2])<exempt[b])continue;
   const c=clearAt(x,z);if(c<min){min=c;minAt=[+x.toFixed(2),+z.toFixed(2)];}}}
 assert.equal(nulls,0,a+'-'+b+': null floor samples');
 assert.ok(maxT<=90+1e-6,a+'-'+b+': turn '+maxT.toFixed(1)+'° > 90°');
 assert.ok(min>=CLEAR-1e-9,a+'-'+b+': clearance '+min.toFixed(3)+' m at '+minAt+' < '+CLEAR);
 console.log(a+'-'+b,'len',e.lengthM,'minClear',min.toFixed(3),'at',minAt,'maxTurn',maxT.toFixed(1));}
const s2=node('S2');assert.ok(clearAt(s2[0],s2[2])>=CLEAR-1e-9,'S2 node clearance');
const s4=node('S4'),c4=clearAt(s4[0],s4[2]);assert.ok(c4>=NODE_CLEAR-1e-9,'S4 node clearance '+c4.toFixed(3)+' < '+NODE_CLEAR);
const L=k=>sky.edges.find(x=>x.a+'-'+x.b===k).lengthM,s36=L('S3-S4')+L('S4-S6');
assert.ok(s36<=S6_BASE_M+1e-6,'S3>S4>S6 '+s36.toFixed(3)+' m > baseline '+S6_BASE_M);
const NWK=H.load('region/NodeWalker.ts');assert.equal(NWK.routeKeys(REG,'S4','S6').keys.join('>'),'S4>S6','S6 resume walks the direct S4-S6 edge (T-02 finale arrival)');
console.log('S4 node clear',c4.toFixed(3),'S3>S6',s36.toFixed(3),'(base',S6_BASE_M+')');
// the old graze point must stay away from both edges
for(const k of ['S2-S3','S3-S4']){const e=sky.edges.find(x=>x.a+'-'+x.b===k);for(const p of e.path)assert.ok(Math.hypot(p[0]-4.8,p[2]-1.2)>0.5,k+' vertex near old graze '+p);}
console.log('sky S2..S6 edge clearance ok (no exemptions)');
