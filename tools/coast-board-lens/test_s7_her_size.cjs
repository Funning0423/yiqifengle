'use strict';
// Coast S7: her on-screen size (real model + skeletal pose, in-game lens; numbers from tools/coast-transition-draft/s7_her_height.py -> s7_her_size.json).
// Grok Bot 2026-10-30（方案① 最终版 (a)）：她的屏上高度 ≥0.06 且 ≥40 px 只算到 38.867 s（7 屏）；390x520 短屏例外 ≥38.5 px（比例仍 ≥0.06）；38.867 s 之后按棋盘构图验收，不设门限。
// Grok Bot 2026-10-30 (option 1, final (a)): for t <=38.867 s on all 7 screens her height fraction >=0.06 and >=40 px, except 390x520 >=38.5 px (fraction still >=0.06);
// after 38.867 s the board landing is judged on board composition (not gated).
// The camera digest is recomputed from ref_transition.json rows at the sample frames, so the numbers must belong to the lens under test.
const fs=require('fs'),path=require('path');
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'s7_her_size.json'),'utf8'));
const CUTOFF=38.867,FRAC=0.06,PX=40,EXC={'390x520':38.5},SCREENS=['390x844','414x896','360x780','375x667','320x568','390x520','768x1024'];
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}};
function gate(screen,samples){const px=EXC[screen]??PX,bad=[];for(const [t,f,p] of samples){if(t>CUTOFF+1e-6)continue;if(!(f>=FRAC)||!(p>=px))bad.push([t,f,p]);}return bad;}
const R=JSON.parse(fs.readFileSync(path.join(__dirname,'ref_transition.json'),'utf8'));
const dec=(a,n,f0)=>{const cols=[];for(let c=0;c<7;c++){let v=0;const col=[];for(let i=0;i<n;i++){v+=a[c*n+i];col.push(v);}cols.push(col);}return Array.from({length:n},(_,i)=>[f0+i,...cols.map(c=>c[i])]);};
const shared=dec(R.shared,R.n_shared,0);
ok(H.cutoff===CUTOFF&&H.frac_min===FRAC&&H.px_min===PX&&H.exc['390x520']===38.5,'rule constants in s7_her_size.json');
for(const s of SCREENS){const S=H.screens[s];ok(!!S,s+' missing');if(!S)continue;
 const rows=shared.concat(dec(R.s7[s],R.s7_len[s],R.n_shared-1).slice(1)),byF=new Map(rows.map(r=>[r[0],r]));const dig=[0,0,0,0,0,0,0];let miss=0;
 for(const [t] of S.samples){const r=byF.get(Math.round(t*60));if(!r){miss++;continue;}for(let k=0;k<7;k++)dig[k]+=r[k+1];}
 ok(miss===0&&dig.every((v,k)=>v===S.cam_digest[k]),`${s} camera digest ${JSON.stringify(dig)} != measured ${JSON.stringify(S.cam_digest)} (miss ${miss})`);
 const g=S.samples.filter(x=>x[0]<=CUTOFF+1e-6);ok(g.length>=Math.floor((CUTOFF-S.samples[0][0])*30)&&g[g.length-1][0]>=CUTOFF-1e-3,s+' samples do not cover S7 start..'+CUTOFF);
 const bad=gate(s,S.samples),mf=g.reduce((a,b)=>b[1]<a[1]?b:a),mp=g.reduce((a,b)=>b[2]<a[2]?b:a);
 ok(bad.length===0,`${s} her size below the line at ${JSON.stringify(bad.slice(0,3))} (need >=${FRAC} and >=${EXC[s]??PX} px for t<=${CUTOFF})`);
 console.log(`${bad.length?'FAIL':'ok  '} ${s} t<=${CUTOFF}: min fraction ${mf[1]} @${mf[0]} s, min ${mp[2]} px @${mp[0]} s (line ${EXC[s]??PX} px); ${S.samples.length} samples`);}
// self-tests
ok(gate('390x844',[[38.9,0.01,5],[38.8675,0.01,5],[40,0.0,0]]).length===0,'selftest: samples after the cutoff must not fail');
ok(gate('390x844',[[38.5,0.0599,60]]).length===1,'selftest: fraction <0.06 before the cutoff must fail');
ok(gate('390x844',[[38.5,0.07,39.9]]).length===1,'selftest: <40 px before the cutoff must fail');
ok(gate('390x520',[[38.5,0.07,38.4]]).length===1,'selftest: 390x520 <38.5 px before the cutoff must fail');
ok(gate('390x520',[[38.5,0.07,38.6]]).length===0,'selftest: 390x520 38.6 px passes the short-screen exception');
ok(gate('390x520',[[38.5,0.0599,45]]).length===1,'selftest: 390x520 fraction <0.06 still fails');
ok(gate('390x844',[[CUTOFF,0.0599,60]]).length===1,'selftest: the cutoff sample itself is gated');
ok(gate('390x520',[[38.8667,0.07,38.4]]).length===1,'selftest: the last frame before the cutoff (38.8667 s) is gated');
console.log((fails?'':'ok   ')+'self-tests (after-cutoff ignored; <0.06 / <40 px / 390x520 <38.5 px before cutoff FAIL)');
if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-s7-her-size');
