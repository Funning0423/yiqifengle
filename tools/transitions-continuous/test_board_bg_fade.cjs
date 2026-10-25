#!/usr/bin/env node
/** cand8 (Grok Bot ③): the board's 3D background fades out over 0.3 s after the 2D board fade instead of switching off on
 *  dispose. Pure runtime checks on LevelBackgroundBinding.fadeOut + backgroundFadeAlpha, and the adapter wiring contract. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..'),S=p=>fs.readFileSync(path.join(root,'creator-build-project/assets/scripts',p),'utf8');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const js=ts.transpileModule(S('world-r2/LevelBackground.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
const m={exports:{}};new Function('module','exports','require',js)(m,m.exports,require);const L=m.exports;let pass=0;const ok=s=>{pass++;console.log('PASS '+s);};
(async()=>{
 assert.strictEqual(L.BACKGROUND_FADE_SECONDS,0.3);let prev=1;for(let t=0;t<=0.3001;t+=1/60){const a=L.backgroundFadeAlpha(t);assert(a<=prev+1e-12&&a>=0&&a<=1);prev=a;}
 assert.strictEqual(L.backgroundFadeAlpha(0),1);assert.strictEqual(L.backgroundFadeAlpha(0.3),0);ok('alpha smoothstep 1→0 over 0.3 s, monotone');
 const calls=[];const lease={frame(){},setVisible:v=>calls.push(['vis',v]),setFade:a=>calls.push(['fade',a]),dispose:()=>calls.push(['dispose'])};
 const b=new L.LevelBackgroundBinding({stageId:'S'});const tok={check(){},cancelled:false,wait:p=>p,onCancel:()=>()=>{}};
 await b.load(()=>lease,{},tok);b.setVisible(true);calls.length=0;
 let tick=null;const p=b.fadeOut(0.3,t=>{tick=t;});let frames=0;while(!tick(1/60)){frames++;assert(!calls.some(c=>c[0]==='dispose'),'disposed before alpha 0');}
 await p;const fades=calls.filter(c=>c[0]==='fade').map(c=>c[1]);
 assert(frames>=16&&frames<=19,'frames '+frames);assert(!calls.some(c=>c[0]==='vis'),'no visibility toggle (blank frame) during the fade');
 assert.strictEqual(fades.at(-1),0);assert.strictEqual(calls.at(-1)[0],'dispose');assert.strictEqual(calls.filter(c=>c[0]==='dispose').length,1);
 assert.strictEqual(b.diagnostics().state,'disposed');b.dispose();assert.strictEqual(calls.filter(c=>c[0]==='dispose').length,1);
 ok('fadeOut: '+(frames+1)+' frames at 60 fps, setFade every frame, never hidden, disposed once on the alpha-0 frame');
 const b2=new L.LevelBackgroundBinding({stageId:'S'});const l2={frame(){},setVisible(){},dispose(){l2.d=(l2.d||0)+1;}};await b2.load(()=>l2,{},tok);
 let t2;const p2=b2.fadeOut(0.3,t=>{t2=t;});t2(1/60);b2.dispose();assert(t2(1/60));await p2;assert.strictEqual(l2.d,1);ok('dispose mid-fade (leave/cancel) disposes once and ends the fade; lease without setFade keeps drawing until alpha 0');
 const ad=S('world-r2/NativeWorldLevelAdapter.ts');assert(/background\.fadeOut\(BACKGROUND_FADE_SECONDS/.test(ad)&&/boardFadeOpacity\(a0,t,seconds\)[\s\S]*background\.fadeOut/.test(ad));
 ok('adapter: lease.fadeOut runs the 2D board fade, then the 0.3 s background fade, before WorldFlow disposes the lease');
 console.log(JSON.stringify({result:'PASS',pass}));
})().catch(e=>{console.error(e);process.exitCode=1;});
