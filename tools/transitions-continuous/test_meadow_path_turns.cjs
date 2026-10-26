#!/usr/bin/env node
'use strict';
/** b19 meadow gate-handoff: no path may turn > 90° in place, and no node / waypoint / segment may put her body (r 0.3 m,
 *  axis samples 0.3/0.9/1.5 m above the floor) into a real env_meadow triangle (fence, gate posts, windmill_static, trees,
 *  wind bells, river) or off the walkable grid.  Checks: every meadow RegionNode, every baked meadow edge path, and every
 *  route in meadow-gate-handoff.json.  FAILs on baf51b13 (M6 at (0.2,−25.6) clips windmill_static: 0.219 m < 0.3 m). */
const fs=require('fs'),path=require('path');const R=path.resolve(__dirname,'../..');
const G=require('./lib/meadow-geo.cjs');
const RN=JSON.parse(fs.readFileSync(path.join(R,'tools/region-nodes/region-nodes.json'),'utf8'));const MB=(RN.regions||RN).meadow;
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'meadow-gate-handoff.json'),'utf8'));
const BODY=H.bodyRadiusM,MAXT=H.maxTurnDeg;const fails=[],rep={nodes:{},routes:{}};
const hd=(a,b)=>Math.atan2(b[0]-a[0],b[2]-a[2])*180/Math.PI,dd=(a,b)=>((b-a+540)%360)-180;
const turns=P=>{const t=[];for(let i=1;i<P.length-1;i++){if(Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2])<1e-6||Math.hypot(P[i+1][0]-P[i][0],P[i+1][2]-P[i][2])<1e-6)continue;t.push(+dd(hd(P[i-1],P[i]),hd(P[i],P[i+1])).toFixed(1));}return t;};
function walkLine(name,P){let minC=9,off=0,step=0;for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/0.1));let pf=null;
 for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[2]+(b[2]-a[2])*k/n;if(!G.walkable(x,z))off++;const c=G.clearance(x,z);if(c.d<minC)minC=c.d;if(pf!==null&&c.floor!==null)step=Math.max(step,Math.abs(c.floor-pf));pf=c.floor;}}
 const t=turns(P),mt=Math.max(0,...t.map(Math.abs));
 if(mt>MAXT)fails.push(`${name}: turn ${mt}° > ${MAXT}°`);if(minC<BODY)fails.push(`${name}: body clearance ${minC.toFixed(3)} m < ${BODY}`);if(off)fails.push(`${name}: ${off} samples off walkable`);if(step>0.12)fails.push(`${name}: floor step ${step.toFixed(3)} m`);
 return {maxTurnDeg:mt,minBodyClearM:+minC.toFixed(3),offWalk:off,maxFloorStepM:+step.toFixed(3)};}
for(const n of MB.nodes){const c=G.clearance(n.at[0],n.at[2]);rep.nodes[n.key]={at:n.at,clearM:+c.d.toFixed(3),mesh:c.mesh,walkable:G.walkable(n.at[0],n.at[2])};
 if(c.d<BODY)fails.push(`node ${n.key} ${JSON.stringify(n.at)} in collision with ${c.mesh}: ${c.d.toFixed(3)} m < ${BODY}`);if(!rep.nodes[n.key].walkable)fails.push(`node ${n.key} off walkable`);}
for(const k of Object.keys(H.points)){const p=H.points[k];const c=G.clearance(p[0],p[2]);rep.nodes['handoff:'+k]={at:p,clearM:+c.d.toFixed(3),mesh:c.mesh};if(c.d<BODY)fails.push(`handoff ${k} in collision ${c.d.toFixed(3)}`);}
for(const e of MB.edges)rep.routes[`edge ${e.a}-${e.b}`]=walkLine(`edge ${e.a}-${e.b}`,e.path);
for(const [k,r] of Object.entries(H.routes))rep.routes[k]=walkLine(k,r.points);
// the route the node graph would give from M6 (normal flow resumes from M6) must reach the door without a U-turn
const m6=MB.nodes.find(n=>n.key==='M6').at,nm6=H.routes.normal_M6.points[0];
if(Math.hypot(m6[0]-nm6[0],m6[2]-nm6[2])>0.05)fails.push(`normal_M6 route starts at ${JSON.stringify(nm6)} but node M6 is ${JSON.stringify(m6)}`);
const out={status:fails.length?'FAIL':'PASS',fails,...rep};
if(process.argv.includes('--json'))console.log(JSON.stringify(out,null,1));else{console.log(JSON.stringify({status:out.status,fails,nodes:Object.fromEntries(Object.entries(rep.nodes).map(([k,v])=>[k,v.clearM]))}));}
process.exit(fails.length?1:0);
