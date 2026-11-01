'use strict';
// 运镜bot b21: island walk-path clearance gate, TIERED per island-props-classes.json (Grok Bot final): replaces the old "merged props bbox = one
// solid" check. Every baked island edge (planWalk, sampled 5 cm) must keep each tier's keep-out (island-clearance-tiers.cjs KEEP); report
// per segment per tier min clearance + nearest object. Self-test (always runs): for each tier a probe point placed 0.05 m inside its keep-out
// must FAIL and 0.05 m outside must PASS (proves no tier is silently skipped). Report: reports/island-clearance-tiers.json.
const fs=require('fs'),path=require('path');const J=require('./journey-scene.cjs');const {H,S}=J;const T=require('./island-clearance-tiers.cjs');
const NW=H.load(S+'region/NodeWalker.ts');const items=T.build();
const EDGES=(process.env.EDGES||'I1>I2,I2>I3,I3>I4,I4>I5,I5>I6,I4>I6').split(',');
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};const report={keepM:T.KEEP,segments:{},selftest:{}};
for(const e of EDGES){const [a,b]=e.split('>'),pl=NW.planWalk('island',a,b),P=pl.segments.flatMap((s,i)=>i?s.path.slice(1):s.path),L=NW.pathLength(P);
 const min={};for(const k in T.KEEP)min[k]={m:9,who:null,atM:0};
 for(let d=0;d<=L+1e-9;d+=0.05){const q=NW.pointAlong(P,Math.min(d,L)),c=T.walkClear(q,items);for(const k in c)if(c[k][0]<min[k].m)min[k]={m:+c[k][0].toFixed(3),who:c[k][1],atM:+d.toFixed(2)};}
 report.segments[e]={lengthM:+L.toFixed(3),tiers:min};
 for(const k in T.KEEP)ok(min[k].m>=T.KEEP[k]-1e-9,`${e} ${k} ${min[k].m} m < ${T.KEEP[k]} (${min[k].who} @${min[k].atM} m)`);
 console.log(e,L.toFixed(3),Object.entries(min).map(([k,v])=>`${k}=${v.m>=3?'>3':v.m}`).join(' '));}
// negative / positive self-test per tier
for(const k in T.KEEP){const it=items.filter(i=>i.tier===k).sort((x,y)=>(y.bb[1][1]-y.bb[0][1])-(x.bb[1][1]-x.bb[0][1]))[0];if(!it){ok(false,'selftest no item for tier '+k);continue;}
 // probe on the +x side of the object's widest point at its mid band height
 const t=it.tris;let ix=0;for(let i=0;i<t.length;i+=3)if(t[i]>t[ix])ix=i;const ymid=Math.max(it.bb[0][1]-0.1,t[ix+1]-0.9);
 const res=s=>{const q=[t[ix]+s,ymid,t[ix+2]];return T.walkClear(q,[it])[k][0];};
 const inside=res(T.KEEP[k]-0.05),outside=res(T.KEEP[k]+0.05);report.selftest[k]={item:it.name,inside:+inside.toFixed(3),outside:+outside.toFixed(3)};
 ok(inside<T.KEEP[k],`selftest ${k}: violation not caught (${inside.toFixed(3)})`);ok(outside>=T.KEEP[k],`selftest ${k}: clean probe flagged (${outside.toFixed(3)})`);}
console.log('selftest',JSON.stringify(report.selftest));
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/island-clearance-tiers.json'),JSON.stringify(report,null,1));
if(fail){console.log('island-clearance-tiers: FAIL',fail);process.exit(1);}console.log('island-clearance-tiers: PASS');
