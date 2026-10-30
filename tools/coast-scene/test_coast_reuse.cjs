'use strict';
// coast-reuse gate (GGbot): every reuse:true entry of bundles/region_coast/data/coast_layout.json must resolve to a node of the
// island prefab that is in the scene during the arrival (static_seat_preview/room/room_no_original_chair.glb). NO skips allowed
// (Grok Bot 2026-10-30): any unresolved entry fails. The node tree is read from the real glb (node names), not a hand list.
const fs=require('fs'),path=require('path'),ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets');
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
const mods={};function load(abs){if(mods[abs])return mods[abs].exports;const m={exports:{}};mods[abs]=m;const dir=path.dirname(abs);
 new Function('module','exports','require',tr(fs.readFileSync(abs+'.ts','utf8')))(m,m.exports,r=>r.startsWith('.')?load(path.resolve(dir,r)):require(r));return m.exports;}
const CAL=load(path.join(A,'bundles/region_coast/scripts/CoastArrivalLens'));
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}};
const b=fs.readFileSync(path.join(A,'bundles/static_seat_preview/room/room_no_original_chair.glb')),j=JSON.parse(b.slice(20,20+b.readUInt32LE(12)).toString());
const mk=i=>({name:j.nodes[i].name||'',children:(j.nodes[i].children||[]).map(mk)});
const world={node:{name:'world',children:[{name:'room',children:j.scenes[j.scene||0].nodes.map(mk)}]}};
const L=JSON.parse(fs.readFileSync(path.join(A,'bundles/region_coast/data/coast_layout.json'),'utf8')).layout.filter(e=>e.reuse);
const errs=[],ce=console.error;console.error=m=>errs.push(String(m));const res=CAL.createCoastReuseResolver(world);
const miss={};let hit=0;for(const e of L){const n=res(e.mesh);if(n)hit++;else miss[e.mesh]=(miss[e.mesh]||0)+1;}console.error=ce;
console.log(`info reuse resolved ${hit}/${L.length}; missing ${JSON.stringify(miss)}`);
ok(L.length===96,'reuse entries '+L.length);ok(errs.length===Object.keys(miss).length,'every unresolved name logs console.error once');
ok(hit===L.length,`reuse skips not allowed: ${L.length-hit} of ${L.length} have no island source`);
// self-test: a missing source must be caught
{const r=CAL.createCoastReuseResolver({node:{name:'x',children:[]}});const e2=[];console.error=m=>e2.push(m);const n=r('reuse_palm_tall');console.error=ce;ok(n===null&&e2.length===1,'selftest missing node');}
if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-reuse');
