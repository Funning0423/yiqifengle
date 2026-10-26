#!/usr/bin/env node
'use strict';
// 运镜bot full9c: deliberately-penetrating SAIL-journey camTrace (must-fail fixture ii). Source = the real m2 Mac trace (sail placement,
// TransportLeg.sailMeadowRoot). Only BalloonTransit:prewalk/B1 lines are kept; prewalk writes with 137.0 ≤ t ≤ 138.0 are moved, in the
// SAIL world frame, onto a straight line through windmill_static_merged (tower centre) and then through the meadow_trees_merged canopy
// nearest the walk. Everything else (incl. the first B1 write = plan c0, so frame detection stays 'sail') is untouched.
// Usage: make_sail_penetrating_trace.cjs [in] [out]
const fs=require('fs'),path=require('path');const R=require('../journey-integration/route/route-legs.cjs');const J=R.J;
const IN=process.argv[2]||path.join(__dirname,'fixtures/m2-camtrace-full.txt'),OUT=process.argv[3]||path.join(__dirname,'fixtures/m2-sail-penetrating.txt');
const TL=J.H.load(J.S+'region/TransportLeg.ts'),SR=TL.sailMeadowRoot(),D=SR.map((v,i)=>v-J.mOff[i]);
const obj=n=>J.meadow.find(o=>o.name===n),bb=o=>J.bbox(o.tris),mid=b=>b[0].map((v,i)=>(v+b[1][i])/2);
const mill=bb(obj('windmill_static_merged')),A=[mid(mill)[0],mill[0][1]+3,mid(mill)[2]].map((v,i)=>+(v+D[i]).toFixed(3));// tower, 3 m above its base
// a canopy point: densest tree triangle centroid near the walk (bridge frame), shifted into the sail frame
const tr=obj('meadow_trees_merged').tris;let B=null,bd=1e9;for(let k=0;k<tr.length;k+=9){const c=[0,1,2].map(i=>(tr[k+i]+tr[k+3+i]+tr[k+6+i])/3);if(c[1]<J.mOff[1]+8)continue;const d=Math.hypot(c[0]-mid(mill)[0],c[2]-mid(mill)[2]);if(d<bd){bd=d;B=c;}}
B=B.map((v,i)=>+(v+D[i]).toFixed(3));
const out=[];let n=0;for(const l of fs.readFileSync(IN,'utf8').split('\n')){const m=l.match(/^(.*\[QF_CAM_TRACE\] f=\d+ t=)([\d.]+)( pos=)([-\d.e,]+)(.*? w=BalloonTransit:(prewalk|B1)\b.*)$/);if(!m)continue;
 const t=+m[2];if(m[6]==='prewalk'&&t>=137&&t<=138){const u=t-137,p=u<.5?A:B;out.push(m[1]+m[2]+m[3]+p.join(',')+m[5]+' SYNTH');n++;}else out.push(l);}
fs.writeFileSync(OUT,out.join('\n')+'\n');console.log(JSON.stringify({out:path.relative(process.cwd(),OUT),lines:out.length,synth:n,windmillPt:A,treePt:B,sailOffset:D.map(v=>+v.toFixed(3))}));
