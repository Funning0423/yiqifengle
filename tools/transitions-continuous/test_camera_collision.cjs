'use strict';
// 运镜bot full8: camera-collision gate (Grok Bot 2026-10-26, Mac m1 576–581: lens into the windmill → grey frames + hard cut).
// DEFINITION — every sampled lens pose (route-legs sail / balloon / lakeside + the windmill→balloon segment = pre-walk follow → B1,
// 7 screens, every 0.25 s; full-black cover frames are not rendered and are skipped; NO pose is ever dropped otherwise) must:
//  (1) CLEARANCE: no surface within CLR_M (1.1 m, scripted shots) — 26 rays (cube faces+edges+corners) of length CLR_M from the lens
//      against that time's full scene geometry (leg.los: meadow incl. windmill_static_merged + windmill_sails, islands, city, islets,
//      transit clouds, basket / boat parts, lakeside). Ray-sampled distance (≥ true distance ⇒ never a false PASS for faces ⟂ to a ray;
//      a thin edge between rays can be missed — conservative only in the FAIL direction).
//  (2) NOT ENCLOSED: of 14 rays (6 axes + 8 diagonals) of ENC_M = 20 m, at least one escapes (lens inside a closed mesh / room = all hit).
//      Sweep note: 400 m flagged the lakeside descent under the skycity island (up 10–30 m = island underside, sides = far hills 100–400 m)
//      on all 7 screens, t 3.0–4.5 s — open air, a false positive; 20 m = no room in these scenes is larger.
//  (3) AABB (report column): lens inside a solid object's world AABB (meadow + island named objects only; terrain / grass / flower /
//      path / river sheets excluded because their AABB is the whole map — listed as known false positives, not counted).
// Mode: REPORT-ONLY until Grok Bot approves (QF_COLLISION_GATE=gate makes (1)+(2) hard). Soft geometry tags (grass/flower cards,
// transit clouds) are listed per hit but counted — the sweep reports them so the gate definition can be decided, not tuned here.
const R=require('../journey-integration/route/route-legs.cjs'),J=R.J,{add}=R.J;const WB=require('./lib-prewalk-cams.cjs');
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]],CLR_M=1.1,ENC_M=20;
const GATE=process.env.QF_COLLISION_GATE==='gate';
const dirs=(k)=>{const o=[];for(const x of[-1,0,1])for(const y of[-1,0,1])for(const z of[-1,0,1]){const n=Math.abs(x)+Math.abs(y)+Math.abs(z);if(!n)continue;if(k==='enc'&&n===2)continue;const L=Math.hypot(x,y,z);o.push([x/L,y/L,z/L]);}return o;};
const D26=dirs('clr'),D14=dirs('enc');
const SHEET=/terrain|grass|flower|meadow_path|river|_sea|ocean|water/i;
const aabbs=[...J.meadow,...J.island].filter(o=>o.tris&&o.tris.length&&!SHEET.test(o.name||'')).map(o=>{const m=[1e9,1e9,1e9],M=[-1e9,-1e9,-1e9];for(let i=0;i<o.tris.length;i+=3)for(let a=0;a<3;a++){m[a]=Math.min(m[a],o.tris[i+a]);M[a]=Math.max(M[a],o.tris[i+a]);}return {name:o.name,m,M};});
function check(los,t,p){let clr=null;for(const d of D26){const h=los(t,p,add(p,d.map(v=>v*(CLR_M+.05))));if(h){clr=h;break;}}
 let esc=false;for(const d of D14){if(!los(t,p,add(p,d.map(v=>v*ENC_M)))){esc=true;break;}}
 const inBox=aabbs.filter(b=>p.every((v,a)=>v>b.m[a]&&v<b.M[a])).map(b=>b.name);return {clr,enc:!esc,inBox};}
module.exports={check,CLR_M,ENC_M};
if(require.main===module)(async()=>{const geo=await R.geometry(),rows=[],viol=[];
 const legsFor=scr=>[...R.legs.map(mk=>{const l=mk(geo,scr),poses=[];for(let t=0;t<=l.T+1e-9;t+=.25){if(l.black&&l.black(t))continue;poses.push({t,pose:l.cam(t)});}return {id:l.id,poses,los:l.los};}),WB.windmillBalloonLeg(geo,scr)];
 for(const scr of SCREENS)for(const leg of legsFor(scr)){let n=0,c=0,e=0,b=0;const tags={};
  for(const q of leg.poses){n++;const r=check(leg.los,q.t,q.pose.position);if(r.clr){c++;tags[r.clr.split(/[:@ ]/)[0]+':'+(r.clr.split(':')[1]||'').slice(0,28)]=1;}if(r.enc)e++;if(r.inBox.length){b++;r.inBox.forEach(x=>tags['aabb:'+x]=1);}
   if((r.clr||r.enc)&&viol.length<40)viol.push({shot:leg.id,scr:scr.join('x'),t:+q.t.toFixed(2),phase:q.phase||'',clr:r.clr,enc:r.enc,pos:q.pose.position.map(v=>+v.toFixed(2))});}
  rows.push({shot:leg.id,scr:scr.join('x'),poses:n,clrFail:c,enclosed:e,inAabb:b,tags:Object.keys(tags).join(' ').slice(0,90)});}
 console.table(rows);if(viol.length)console.log('VIOLATIONS (first 40)',JSON.stringify(viol,null,0));
 // repro: a lens inside the windmill (centre of windmill_static_merged) and 0.5 m off its wall must both be caught
 const wm=aabbs.find(b=>b.name==='windmill_static_merged'),ctr=wm.m.map((v,a)=>(v+wm.M[a])/2),bl=R.legs[1](geo,[390,844]);
 const rIn=check(bl.los,0,ctr),wall=[wm.m[0]-0.5,ctr[1]-3,ctr[2]],rWall=check(bl.los,0,wall);const repro={insideCaught:!!(rIn.clr||rIn.enc),nearWallCaught:!!rWall.clr};console.log('repro',JSON.stringify({ctr,rIn,wall,rWall}));
 const bad=rows.filter(r=>r.clrFail||r.enclosed).length,wb=rows.filter(r=>r.shot==='windmill-balloon').length;
 console.log(JSON.stringify({test:'camera-collision',mode:GATE?'gate':'report-only',clrM:CLR_M,rows:rows.length,windmillBalloonRows:wb,violatingRows:bad,repro,status:bad||wb!==7||!repro.insideCaught||!repro.nearWallCaught?(GATE?'FAIL':'BELOW (report-only)'):'PASS'}));
 process.exit(GATE&&(bad||wb!==7||!repro.insideCaught||!repro.nearWallCaught)?1:0);})().catch(e=>{console.error(e);process.exit(1);});
