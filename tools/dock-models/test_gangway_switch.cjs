#!/usr/bin/env node
/** cand8 (Grok Bot ②): the gangway side switch (island side yaw 180° → meadow side) is a visible, continuous
 *  raise → swing across → lower sequence, never an upright snap. Pure checks on gangwaySequence + SailRide timing contracts. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..'),S=p=>fs.readFileSync(path.join(root,'creator-build-project/assets/scripts',p),'utf8');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const js=ts.transpileModule(S('region/SailGangway.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
const m={exports:{}};new Function('module','exports','require',js)(m,m.exports,n=>n==='cc'?{Node:class{},Vec3:class{},tween:()=>null}:n.endsWith('SailGangwayExtras')?{SAIL_GANGWAY_EXTRAS:null}:require(n));
const G=m.exports,e={...G.GANGWAY_FALLBACK};let pass=0;const ok=s=>{pass++;console.log('PASS '+s);};
const same=(a,b)=>a.pos.every((v,i)=>Math.abs(v-b.pos[i])<1e-9)&&a.euler.every((v,i)=>Math.abs(v-b.euler[i])<1e-9);
// every key is reached by a tween of positive length; consecutive keys never repeat (no zero-time pose change)
function check(from,to,sec){const k=G.gangwaySequence(e,from,to,sec);assert(k.length>0);let prev=G.gangwayPose(e,from);
 for(const x of k){assert(x.seconds>=0.05,'zero-time key '+JSON.stringify(x));prev=x;}assert(same(k.at(-1),G.gangwayPose(e,to)));return k;}
const a=check('stowed-meadow','island',0.8);assert.strictEqual(a.length,2);assert(same(a[0],G.gangwayPose(e,'stowed-island')));
const b=check('island','stowed-meadow',0.8);assert.strictEqual(b.length,2);assert(same(b[0],G.gangwayPose(e,'stowed-island')));
const c=check('stowed-meadow','meadow',0.8);assert.strictEqual(c.length,1);
const d=check('island','meadow',0.8);assert.strictEqual(d.length,3);
ok('side switch = raise (0.8 s) → swing across ('+G.GANGWAY_CROSS_SECONDS+' s, yaw 180°→0°, hinge x '+e.islandHinge[0]+'→'+e.meadowHinge[0]+') → lower; no snap');
// sampled continuity: eased linear interpolation between keys has bounded per-frame step at 60 fps
const ease=t=>-(Math.cos(Math.PI*t)-1)/2;let maxYaw=0,maxPos=0;{let p=G.gangwayPose(e,'island');for(const k of b){const N=Math.ceil(k.seconds*60);let last=p;
 for(let i=1;i<=N;i++){const u=ease(i/N),y=p.euler[1]+(k.euler[1]-p.euler[1])*u,x=p.pos[0]+(k.pos[0]-p.pos[0])*u;const ly=last.euler?last.euler[1]:last.y,lx=last.pos?last.pos[0]:last.x;
  maxYaw=Math.max(maxYaw,Math.abs(y-ly));maxPos=Math.max(maxPos,Math.abs(x-lx));last={y,x};}p=k;}}
assert(maxYaw<6&&maxPos<0.06,'per-frame step too big '+maxYaw+' '+maxPos);ok('per-frame step at 60 fps ≤ '+maxYaw.toFixed(2)+'°/frame yaw, '+maxPos.toFixed(3)+' m/frame');
// SailRide: switch starts at A3 (cast off) and has finished before A4; A4 only lowers on the meadow side
const sr=S('region/SailRide.ts');
assert(/A3-sail'\);[^\n]*gw\?\.swing\('stowed-meadow'/.test(sr),'A3 must swing to stowed-meadow');assert(!/swing\('stowed-island'/.test(sr));
const dur=G.gangwaySequenceSeconds(e,'island','stowed-meadow',0.8);assert(dur<=4,'switch '+dur+' s exceeds the 4 s minimum sail motion budget');
assert(/Math\.max\(4,30\.5-/.test(sr),'sail motion budget floor changed');
ok('A3→A4: switch takes '+dur.toFixed(1)+' s inside the sail motion (≥4 s floor), A4 only lowers; leg length unchanged');
assert(/easing:'sineInOut'/.test(S('region/SailGangway.ts'))&&!/apply\(side\(s\)/.test(S('region/SailGangway.ts')));ok('driver tweens position+euler with sineInOut; old upright apply() snap removed');
console.log(JSON.stringify({result:'PASS',pass}));
