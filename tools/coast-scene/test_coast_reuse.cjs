'use strict';
// coast-reuse gate (GGbot; r6 split by 场景设计部): every island-sourced reuse:true entry of bundles/region_coast/data/coast_layout.json must resolve to a node of the
// island prefab that is in the scene during the arrival (static_seat_preview/room/room_no_original_chair.glb). NO skips allowed
// (Grok Bot 2026-10-30): any unresolved entry fails. The node tree is read from the real glb (node names), not a hand list.
const fs=require('fs'),path=require('path'),ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets');
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
const mods={};function load(abs){if(mods[abs])return mods[abs].exports;const m={exports:{}};mods[abs]=m;const dir=path.dirname(abs);
 new Function('module','exports','require',tr(fs.readFileSync(abs+'.ts','utf8')))(m,m.exports,r=>r==='cc'?{Node:class{},Material:class{}}:r.endsWith('/CoastSceneLoader')?{}:r.startsWith('.')?load(path.resolve(dir,r)):require(r));return m.exports;}
const CAL=load(path.join(A,'bundles/region_coast/scripts/CoastArrivalLens')),SRC=load(path.join(A,'bundles/region_coast/scripts/CoastSceneLayout')).COAST_REUSE_SOURCES;
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}};
const b=fs.readFileSync(path.join(A,'bundles/static_seat_preview/room/room_no_original_chair.glb')),j=JSON.parse(b.slice(20,20+b.readUInt32LE(12)).toString());
const mk=i=>({name:j.nodes[i].name||'',children:(j.nodes[i].children||[]).map(mk)});
const island={name:'room',children:j.scenes[j.scene||0].nodes.map(mk)};
const L0=JSON.parse(fs.readFileSync(path.join(A,'bundles/region_coast/data/coast_layout.json'),'utf8')).layout.filter(e=>e.reuse);
// r6 (场景设计部 coast-reuse-bake): from:'island' -> island prefab (GGbot resolver); from:'region_coast' -> node src in models/coast_reuse.glb (loader)
const L=L0.filter(e=>SRC[e.mesh]&&SRC[e.mesh].from==='island'),LB=L0.filter(e=>SRC[e.mesh]&&SRC[e.mesh].from==='region_coast');
{const rb=fs.readFileSync(path.join(A,'bundles/region_coast/models/coast_reuse.glb')),rj=JSON.parse(rb.slice(20,20+rb.readUInt32LE(12)).toString()),have=new Set(rj.nodes.filter(n=>n.mesh!==undefined).map(n=>n.name));
 let other=0;for(const f of fs.readdirSync(path.join(A,'bundles/region_coast/models')).filter(f=>f.endsWith('.glb')&&f!=='coast_reuse.glb')){const b2=fs.readFileSync(path.join(A,'bundles/region_coast/models',f)),j2=JSON.parse(b2.slice(20,20+b2.readUInt32LE(12)).toString());for(const n of j2.nodes)if(have.has(n.name))other++;}
 const mb=LB.filter(e=>!have.has(SRC[e.mesh].src));console.log(`info baked reuse resolved ${LB.length-mb.length}/${LB.length} in models/coast_reuse.glb`);ok(mb.length===0,'baked reuse: every region_coast source node exists in coast_reuse.glb (missing '+mb.map(e=>e.mesh)+')');ok(other===0,'baked reuse node names unique across region_coast/models');}
const errs=[],ce=console.error;console.error=m=>errs.push(String(m));const res=CAL.createCoastReuseResolver(island,SRC);
const miss={};let hit=0;for(const e of L){const n=res(e.mesh);if(n)hit++;else miss[e.mesh]=(miss[e.mesh]||0)+1;}console.error=ce;
console.log(`info reuse resolved ${hit}/${L.length}; missing ${JSON.stringify(miss)}`);
ok(Object.values(SRC).reduce((a,x)=>a+x.count,0)===L0.length,'COAST_REUSE_SOURCES counts == layout');ok(L0.length===91&&L.length+LB.length===91,'reuse entries '+L0.length);ok(errs.length===Object.keys(miss).length,'every unresolved name logs console.error once');
// GGbot: our coast-first resolver (CoastArrivalLens default when the island is mounted) must also find every baked name in coast_reuse.glb
{const rb=fs.readFileSync(path.join(A,'bundles/region_coast/models/coast_reuse.glb')),rj=JSON.parse(rb.slice(20,20+rb.readUInt32LE(12)).toString()),CN=new Map();for(const n of rj.nodes)if(n.name&&n.mesh!==undefined&&!CN.has(n.name))CN.set(n.name,{name:n.name,children:[]});
 const e3=[],ce3=console.error;console.error=m=>e3.push(String(m));const r3=CAL.createCoastReuseResolver(island,Object.fromEntries(Object.entries(SRC).map(([k,v])=>[k,v.from==='region_coast'?{...v,src:v.src}:v])),n=>CN.get(SRC[n]&&SRC[n].src)||CN.get(n)||null);
 let h3=0;for(const e of LB)if(r3(e.mesh))h3++;console.error=ce3;console.log(`info GGbot coast-first resolveReuse found ${h3}/${LB.length} baked instances in coast_reuse.glb`);ok(h3===LB.length&&LB.length===88&&e3.length===0,'GGbot resolveReuse finds all 88 baked reuse instances in coast_reuse.glb ('+h3+'/'+LB.length+')');}
ok(hit===L.length,`reuse skips not allowed: ${L.length-hit} of ${L.length} have no island source`);
// self-test: a missing source must be caught
{const r=CAL.createCoastReuseResolver({name:'x',children:[]},SRC);const e2=[];console.error=m=>e2.push(m);const n=r('reuse_palm_tall');console.error=ce;ok(n===null&&e2.length===1,'selftest missing node');}
// resolveMaterial (Grok Bot 2026-10-30): every coast material key -> a material or console.error, never a silent null
{const LAY=load(path.join(A,'bundles/region_coast/scripts/CoastSceneLayout'));const layout=JSON.parse(fs.readFileSync(path.join(A,'bundles/region_coast/data/coast_layout.json'),'utf8'));
 const keys=new Map();for(const i of LAY.coastInstances(layout))if(!i.reuse)keys.set(i.mesh+'|'+i.kind+'|'+i.alpha,{mesh:i.mesh,kind:i.kind,alpha:i.alpha,emit:i.kind==='unlit'});
 const ISL=new Set(j.materials.map(m=>m.name)),mats={};const isl=n=>ISL.has(n)?(mats[n]||(mats[n]={name:n,isValid:true,island:true})):null;
 for(const [label,tex] of [['with coast palette',{tex:1}],['palette missing',null]]){const made=[];
  const R=CAL.createCoastMaterialResolver({islandMaterial:isl,coastPalette:()=>tex,makePalette:(src,t)=>{const m={name:'coast_palette',effectFrom:src.name,tex:t,destroyed:false,destroy(){this.destroyed=true;}};made.push(m);return m;}});
  let got=0,errd=0,silent=[],warns=[];const cw=console.warn;console.warn=m=>warns.push(m);const shared={};for(const k of keys.values()){const e=[];console.error=m=>e.push(m);const m=R(k);console.error=ce;
   if(m){got++;if(m.island)shared[k.mesh]=m.name;}else if(e.length)errd++;else silent.push(k.mesh);}
  console.warn=cw;ok(silent.length===0,label+': silent null for '+silent);ok(warns.filter(w=>/PLACEHOLDER/.test(w)).length===(CAL.COAST_MATERIAL_MODE==='island-placeholder'?1:0),label+': placeholder warn once only in placeholder mode');ok(made.length===0,label+': resolver creates no Material (the loader owns the coast_palette copy)');
  {const e5=[];console.error=m=>e5.push(m);const pm=R({mesh:'terrain',kind:'std',alpha:1,emit:false,palette:true});console.error=ce;ok(pm&&pm.name==='M_env_palette'&&pm.island,label+': palette:true -> island M_env_palette (shared)');}
  for(const [mesh,n] of Object.entries(CAL.COAST_SHARED_MATERIALS))if(n)ok(ISL.has(n),'mapped island material exists: '+mesh+' -> '+n);
  R.dispose();ok(Object.values(mats).every(m=>!m.destroyed),label+': island materials untouched by dispose');
  console.log(`info material ${label}: ${keys.size} keys, ${got} resolved, ${errd} console.error, 0 silent; shared ${JSON.stringify(shared)}`);}}
if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-reuse');
