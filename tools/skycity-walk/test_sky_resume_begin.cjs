'use strict';
// 运镜bot full9c: SkyResumeLens.skyResumeBegin (GGbot's finale-leg helper): exact S5 walk → baked:true exact; S5 + 0.5 m (inside the 0.75 m
// radius) → baked:true from 'S5' (nearest-start rule, no radius change); S5 + 2 m → null + ONE '[QF_SKY_RESUME] fallback-live' warn.
// step() is pure (returns a pose, never touches a camera): one writer per frame stays with the caller.
const assert=require('node:assert/strict');const ROOT=process.cwd();const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');
const H=createHarness(),SP=H.load('region/SkyLakePreWalk.ts'),S=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),RS=H.load('region/SkyResumeLens.ts');const M=TS.TRANSITION_STAGING.skyMooring5a;
const logs=[],ci=console.info,cw=console.warn;console.info=m=>logs.push(['info',String(m)]);console.warn=m=>logs.push(['warn',String(m)]);
const at=RS.skyResumeStarts(M).find(s=>s.key==='S5').at,walk=d=>SP.skyLakePreWalk([at[0]+d,at[1],at[2]],M).path;
let r;try{
 r=RS.skyResumeBegin(walk(0),M,null,{leg:'test',screen:{w:390,h:844}});assert.ok(r&&r.baked&&r.exact&&r.from==='S5','exact S5');
 const r2=RS.skyResumeBegin(walk(0.5),M,null);assert.ok(r2&&r2.baked&&!r2.exact&&r2.from==='S5'&&r2.dM<=RS.skyReuseRadius('S5'),'S5+0.5 m nearest-start');
 const p0=r.step(r.walk[0],1/60),p1=r.step(r.walk[0],1/60);assert.ok(p0.position.every(Number.isFinite)&&p1.position.every(Number.isFinite),'step poses');
 assert.equal(RS.skyResumeBegin(walk(2),M,null),null,'outside radius → null');assert.equal(RS.skyResumeBegin(walk(2.5),M,null),null);
}finally{console.info=ci;console.warn=cw;}
const lp=logs.filter(l=>/lens-plan/.test(l[1])),fl=logs.filter(l=>/fallback-live/.test(l[1]));
assert.equal(lp.length,2);assert.ok(lp.every(l=>l[0]==='info'&&/"baked":true/.test(l[1])&&/"from":"S5"/.test(l[1])));assert.equal(fl.length,1,'fallback-live warned once');assert.equal(fl[0][0],'warn');
console.log(JSON.stringify({test:'sky-resume-begin',logs:logs.map(l=>l[0]+' '+l[1].slice(0,110)),status:'PASS'}));
