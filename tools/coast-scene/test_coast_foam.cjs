'use strict';
// coast-foam gate (GGbot, Grok Bot 2026-10-30): the sea foam around the arrival steps (foam, foam_inner) must draw with the island's
// TRANSPARENT M_env_sea_foam, not the opaque palette clone. Checks: (1) island glb M_env_sea_foam is alphaMode BLEND; (2) layout instances
// foam/foam_inner are palette:false (so the loader uses the resolveMaterial result as is - see coast-scene-loader "translucent/unlit: as is")
// with alpha<1; (3) our resolveMaterial returns exactly the island M_env_sea_foam object for them, in both palette modes, no copy;
// self-test: forcing foam onto the palette (alpha 1) must be caught. Rendered look (no white slab) stays a Mac step (MAC_STEPS).
const fs=require('fs'),path=require('path'),ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets');
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
const mods={};function load(abs){if(mods[abs])return mods[abs].exports;const m={exports:{}};mods[abs]=m;const dir=path.dirname(abs);
 new Function('module','exports','require',tr(fs.readFileSync(abs+'.ts','utf8')))(m,m.exports,r=>r==='cc'?{Node:class{},Material:class{}}:r.endsWith('/CoastSceneLoader')?{}:r.startsWith('.')?load(path.resolve(dir,r)):require(r));return m.exports;}
const S=path.join(A,'bundles/region_coast/scripts'),CAL=load(path.join(S,'CoastArrivalLens')),LAY=load(path.join(S,'CoastSceneLayout'));
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}return c;};
const b=fs.readFileSync(path.join(A,'bundles/static_seat_preview/room/room_no_original_chair.glb')),j=JSON.parse(b.slice(20,20+b.readUInt32LE(12)).toString());
const fm=j.materials.find(m=>m.name==='M_env_sea_foam');ok(fm&&fm.alphaMode==='BLEND','island M_env_sea_foam alphaMode BLEND ('+(fm&&fm.alphaMode)+')');
const layout=JSON.parse(fs.readFileSync(path.join(A,'bundles/region_coast/data/coast_layout.json'),'utf8'));
function check(insts,tag){const F=insts.filter(i=>/^foam/.test(i.mesh));let bad=[];const ISL=new Set(j.materials.map(m=>m.name)),mats={};
 const R=CAL.createCoastMaterialResolver({islandMaterial:n=>ISL.has(n)?(mats[n]||(mats[n]={name:n,isValid:true})):null,coastPalette:()=>({tex:1}),makePalette:()=>({name:'clone'})});
 const cw=console.warn;console.warn=()=>{};for(const i of F){const m=R({mesh:i.mesh,kind:i.kind,alpha:i.alpha,emit:false});if(i.palette||!(i.alpha<1)||m!==mats.M_env_sea_foam)bad.push(i.mesh+(i.palette?' palette':'')+' alpha='+i.alpha+' mat='+(m&&m.name));}console.warn=cw;
 return {n:F.length,bad};}
const r=check(LAY.coastInstances(layout));ok(r.n>=2&&r.bad.length===0,'foam instances -> transparent island M_env_sea_foam: '+r.n+' checked, bad '+JSON.stringify(r.bad));
console.log('info foam instances '+r.n+' -> M_env_sea_foam (BLEND), palette:false');
const forced=LAY.coastInstances(layout).map(i=>/^foam/.test(i.mesh)?{...i,palette:true,alpha:1}:i);ok(check(forced).bad.length===r.n,'selftest: foam forced opaque/palette must be caught');console.log('ok   selftest: forced-opaque foam caught');
if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-foam');
