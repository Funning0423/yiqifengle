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
 // cand8b: real dissolve on the mainline leases (sky finale / mainline-12 = withRegionBoardGuest(SkycityBoardLive(SkycityBoardBackground)))
 const sky=S('region/SkycityBoardBackground.ts'),live=S('region/SkycityBoardLive.ts'),guest=S('region/LakesideBoardGuest.ts'),comp=S('world-r2/WorldNativeComposition.ts');
 assert(/createSceneFade\(\(\)=>rig,\(\)=>camera,'skycity'\)/.test(sky)&&/setFade:a=>\{if\(!dead\)fade\(a\);\}/.test(sky),'skycity lease setFade');
 assert(/Object\.assign\(\{\},lease,/.test(live),'SkycityBoardLive keeps the inner setFade');assert(/setFade:\(a:number\)=>lease\.setFade!\(a\)/.test(guest),'guest wrapper forwards setFade');
 assert(/skycityBoardWithGuest=.*withRegionBoardGuest\('skycity'/.test(comp));
 for(const [f,tag] of [['region/MeadowBoardBackground.ts','meadow'],['region/LakesideBoardBackground.ts','lakeside']])assert(S(f).includes("createSceneFade(()=>rig,()=>camera,'"+tag+"')")&&/setFade:a=>/.test(S(f)),f);
 assert(/setFade: \(a: number\) =>[^\n]*UIOpacity/.test(S('world-r2/IslandBoardBackground.ts')),'island picture lease setFade');
 ok('setFade implemented by skycity (mainline 09–12 / T-02), meadow, lakeside, island leases and forwarded by every wrapper');
 // createSceneFade against a cc double: camera stops clearing colour, per-renderer instances blend, alpha written monotone
 class V4{constructor(x=0,y=0,z=0,w=0){Object.assign(this,{x,y,z,w});}}
 const sharedW=[];const mkPass=w=>{const u=new V4(.5,.6,.7,w);return {blendState:{targets:[{blendColorMask:15}]},getHandle:n=>n==='mainColor'?7:0,getUniform:(h,o)=>Object.assign(o,u),setUniform:(h,v)=>{u.x=v.x;u.y=v.y;u.z=v.z;u.w=v.w;},u};};
 const passes=[];class MR{constructor(){this.enabled=true;this.node={activeInHierarchy:true};this.sharedMaterials=[{},{}];}getMaterialInstance(){const p=mkPass(1);passes.push(p);return {passes:[p],overridePipelineStates:(st,i)=>{p.over=st;}};}}
 const cc={Camera:{ClearFlag:{DEPTH_ONLY:'depth',SOLID_COLOR:'solid'}},MeshRenderer:MR,Node:class{},Vec4:V4,gfx:{BlendOp:{ADD:0},BlendFactor:{SRC_ALPHA:2,ONE_MINUS_SRC_ALPHA:4,ZERO:0,ONE:1},ColorMask:{ALL:15}},isValid:x=>!!x};
 const fj=ts.transpileModule(S('region/BoardBackgroundFade.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
 const fm={exports:{}};new Function('module','exports','require',fj)(fm,fm.exports,n=>n==='cc'?cc:require(n));
 const cam={clearFlags:'solid'},rig={getComponentsInChildren:()=>[new MR(),new MR()]};const setF=fm.exports.createSceneFade(()=>rig,()=>cam,'t');
 setF(1);assert.equal(cam.clearFlags,'solid','no change at alpha 1');assert.equal(passes.length,0);
 const seen=[];for(let t=1/60;t<=0.3+1e-9;t+=1/60){setF(L.backgroundFadeAlpha(t));seen.push(passes.map(p=>p.u.w));}setF(0);seen.push(passes.map(p=>p.u.w));
 assert.equal(cam.clearFlags,'depth');assert.equal(passes.length,4,'one instance per renderer material');
 assert(passes.every(p=>p.over.blendState.targets[0].blend&&p.over.blendState.targets[0].blendSrc===2&&p.over.blendState.targets[0].blendDst===4));
 for(let i=1;i<seen.length;i++)for(let j=0;j<4;j++)assert(seen[i][j]<=seen[i-1][j]+1e-12,'alpha monotone');
 assert(seen.at(-1).every(w=>w===0)&&passes.every(p=>p.u.x===.5&&p.u.y===.6&&p.u.z===.7),'alpha reaches 0, rgb untouched');
 setF(0.8);assert(passes.every(p=>p.u.w===0),'fade never comes back');
 ok('createSceneFade: DEPTH_ONLY on the board camera, SRC_ALPHA/ONE_MINUS_SRC_ALPHA instances, mainColor.a monotone 1→0, rgb kept');
 console.log(JSON.stringify({result:'PASS',pass}));
})().catch(e=>{console.error(e);process.exitCode=1;});
