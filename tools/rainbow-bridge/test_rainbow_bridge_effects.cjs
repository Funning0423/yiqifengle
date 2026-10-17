#!/usr/bin/env node
'use strict';
/* r5 彩虹桥 effect structure lint + (optional) real Cocos 3.8.8 compile + (optional) WebGL1/WebGL2 driver compile.
 *  E1 static lint (always): technique / pass layout, priorities max-11 < max-10 < max-9, cull / depth / premultiplied blend,
 *     NO depthBias (no-op on 3.8.8 WebGL/WebGL2), derivatives only behind the GL_OES_standard_derivatives guard with a vertex-normal
 *     fallback, no white seam term, camera-offset depth fallback present, property / uniform names == what RainbowBridge.ts sets,
 *     band colours == RAINBOW_BANDS, metas valid with unique uuids, TS effect paths exist.
 *  E2 3.8.8 shdc (when QF_CC_SHDC or /workspace/wechat-game/team/ggbot/tools/cc-shdc-3.8.8 exists, else SKIP-as-PASS): no errors,
 *     priorities 244 / 245 / 246, glsl1 + glsl3 emitted, the GLSL1 frag carries the guarded #extension, no defines (one variant each).
 *  E3 headless Chrome (when E2 ran and Chrome exists, else SKIP-as-PASS): every variant compiles + links on WebGL1 without
 *     derivatives, WebGL1 with them, and WebGL2. Not a Creator build / phone GPU: the Mac + 真机 run stays the acceptance. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),P=path.join(ROOT,'creator-build-project/assets'),W=path.join(P,'resources/world'),S=path.join(P,'scripts/region');
const results=[];const check=(id,fn)=>{try{const r=fn()||{};results.push({id,status:r.skipped?'SKIP':'PASS',...r});}catch(e){results.push({id,status:'FAIL',error:String(e.stack||e)});}};
const read=f=>fs.readFileSync(f,'utf8');
const deck=read(path.join(W,'rainbow-bridge.effect')),ends=read(path.join(W,'rainbow-bridge-additive.effect'));
const rbTs=read(path.join(S,'RainbowBridge.ts')),meshTs=read(path.join(S,'RainbowBridgeMesh.ts'));
const yaml=src=>/CCEffect %\{([\s\S]*?)\}%/.exec(src)[1];
const programs=src=>{const o={};for(const m of src.matchAll(/CCProgram ([\w-]+) %\{([\s\S]*?)\}%/g))o[m[1]]=m[2];return o;};
const stripComments=s=>s.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');
let compiled=null;
check('E1 static lint: layout, order, states, derivative guard, no depthBias / seams, names == TS, bands, metas',()=>{
 const dy=yaml(deck),ey=yaml(ends);
 // layout + priorities
 assert.deepEqual([...dy.matchAll(/- name: (\w+)/g)].map(m=>m[1]),['transparent']);
 assert.deepEqual([...ey.matchAll(/- name: (\w+)/g)].map(m=>m[1]),['ground','motes'],'technique order == RainbowBridge.ts technique 0 / 1');
 assert.deepEqual([...dy.matchAll(/priority: (.*)/g)].map(m=>m[1].trim()),['max - 10']);
 assert.deepEqual([...ey.matchAll(/priority: (.*)/g)].map(m=>m[1].trim()),['max - 11','max - 9']);
 assert.match(dy,/vert: rb-vs:vert\s+frag: rb-fs:frag/);assert.match(ey,/vert: rbh-vs:vertGround\s+frag: rbh-fs:frag/);assert.match(ey,/vert: rbh-vs:vertMotes\s+frag: rbh-fs:frag/);
 // states
 for(const y of [dy,ey]){assert.doesNotMatch(y,/depthBias|polygonOffset/i,'depthBias is a no-op on 3.8.8 WebGL/WebGL2 — use the vertex camera offset');
  assert.match(y,/depthStencilState: \{ depthTest: true, depthWrite: false \}/);
  assert.match(y,/blendSrc: one\s+blendDst: one_minus_src_alpha\s+blendSrcAlpha: one\s+blendDstAlpha: one_minus_src_alpha/,'premultiplied blend');
  assert.doesNotMatch(y,/\t/,'YAML tabs');}
 assert.match(dy,/cullMode: back/);assert.equal((ey.match(/cullMode: none/g)||[]).length,2);
 assert.match(ey,/properties: &props/);assert.match(ey,/properties: \*props/);assert.match(ey,/blendState: &blend/);assert.match(ey,/blendState: \*blend/);
 // programs referenced exist
 const dp=programs(deck),ep=programs(ends);assert.deepEqual(Object.keys(dp).sort(),['rb-fs','rb-vs']);assert.deepEqual(Object.keys(ep).sort(),['rbh-fs','rbh-vs']);
 assert.match(dp['rb-vs'],/vec4 vert \(\)/);assert.match(dp['rb-fs'],/vec4 frag \(\)/);assert.match(ep['rbh-vs'],/vec4 vertGround \(\)/);assert.match(ep['rbh-vs'],/vec4 vertMotes \(\)/);assert.match(ep['rbh-fs'],/vec4 frag \(\)/);
 // derivatives: pragma + every dFdx/dFdy/fwidth inside the guard, with the vertex-normal fallback
 for(const [n,src] of Object.entries({...dp,...ep})){const code=stripComments(src),uses=(code.match(/\b(dFdx|dFdy|fwidth)\s*\(/g)||[]).length;if(!uses)continue;
  assert.match(code,/#pragma extension\(\[GL_OES_standard_derivatives, __VERSION__ < 300\]\)/,n+': derivatives without the 3.8.8 extension pragma');
  // walk the preprocessor: a derivative call is legal only in "#if __VERSION__ < 300 / #ifdef GL_OES_standard_derivatives" or in its "#else" (GLSL ES 3)
  const st=[];let guarded=0,fallback=false;
  for(const line of code.split('\n')){const t=line.trim();
   if(/^#if __VERSION__ < 300/.test(t))st.push('v1');else if(/^#ifdef GL_OES_standard_derivatives/.test(t))st.push('ext');else if(/^#if/.test(t))st.push('other');
   else if(/^#else/.test(t)){const top=st.pop();st.push(top==='v1'?'v3':top==='ext'?'noext':top);}else if(/^#endif/.test(t))st.pop();
   else{const k=(t.match(/\b(dFdx|dFdy|fwidth)\s*\(/g)||[]).length;if(k){assert(st.includes('ext')||st.includes('v3'),n+': unguarded derivative: '+t);assert(!st.includes('noext'));guarded+=k;}
    if(st.includes('noext')&&/v_normal/.test(t))fallback=true;}}
  assert.equal(guarded,uses);assert(fallback,n+': no vertex-normal fallback for WebGL1 without OES_standard_derivatives');}
 // no white seam term (the concept's 1.2 m horizontal light seams are removed), dissolve + streak present
 const df=stripComments(dp['rb-fs']);assert.doesNotMatch(df,/seam/i);assert.match(df,/fade < 0\.999/);assert.match(df,/streak/);
 // the depth fallback: distance-scaled step toward the camera in both vertex programs
 assert.match(stripComments(dp['rb-vs']),/toCam \/ dist \* min\(0\.04, 0\.0012 \* dist\) \* \(1\.0 - a_color\.b\)/);
 assert.match(stripComments(ep['rbh-vs']),/toCamera\(cc_matWorld \* vec4\(a_position, 1\.0\), 0\.003, 0\.06\)/);
 // property + uniform names == what the TS sets
 const props=y=>[...y.matchAll(/^\s+(\w+): \{ value:/gm)].map(m=>m[1]);
 assert.deepEqual(props(dy),['rbParams0','rbParams1']);assert.deepEqual(props(ey),['endParams']);
 assert.match(dp['rb-fs'],/uniform RainbowBridge \{ vec4 rbParams0; vec4 rbParams1; \};/);assert.match(ep['rbh-fs'],/uniform RainbowEnds \{ vec4 endParams; \};/);
 for(const n of ['rbParams0','rbParams1','endParams'])assert(rbTs.includes(`setProperty('${n}'`),n+' not set by RainbowBridge.ts');
 assert.match(rbTs,/technique:0/);assert.match(rbTs,/technique:1/);
 // band colours == RAINBOW_BANDS
 const bands=JSON.parse('['+/RAINBOW_BANDS:ReadonlyArray<Vec>=\[(.*?)\];/.exec(meshTs)[1].replace(/(^|[^\d])\./g,'$10.')+']');
 const glsl=[...df.matchAll(/c\d = vec3\(([\d.,\s]+)\)/g)].map(m=>m[1].split(',').map(Number));assert.equal(glsl.length,7);
 glsl.forEach((c,i)=>c.forEach((v,j)=>assert(Math.abs(v-bands[i][j])<1e-9,'band '+i)));
 // TS effect paths exist + metas
 const E=/RAINBOW_BRIDGE_EFFECTS=\{deck:'([^']+)',ends:'([^']+)'\}/.exec(rbTs);assert(E,'RAINBOW_BRIDGE_EFFECTS');
 for(const p of [E[1],E[2]])assert(fs.existsSync(path.join(P,'resources',p+'.effect')),p);
 const uuids=new Map();(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.meta')){const m=JSON.parse(read(f));if(m.uuid){assert(!uuids.has(m.uuid),'duplicate uuid '+m.uuid+' '+f+' / '+uuids.get(m.uuid));uuids.set(m.uuid,f);}}}})(P);
 const metas={};for(const f of ['resources/world/rainbow-bridge.effect','resources/world/rainbow-bridge-additive.effect','scripts/region/RainbowBridge.ts','scripts/region/RainbowBridgeMesh.ts','scripts/region/RainbowBridgeGround.ts']){
  const m=JSON.parse(read(path.join(P,f+'.meta')));assert.match(m.uuid,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);assert.equal(m.importer,f.endsWith('.effect')?'effect':'typescript');metas[f]=m.uuid;}
 return {metas,uuidsScanned:uuids.size};});
const SHDC=process.env.QF_CC_SHDC||'/workspace/wechat-game/team/ggbot/tools/cc-shdc-3.8.8';
check('E2 Cocos 3.8.8 effect compiler (shdc from the 3.8.8 editor + 3.8.8 chunks): no errors, priorities 244/245/246, glsl1 + glsl3',()=>{
 if(!fs.existsSync(path.join(SHDC,'compile.js')))return {skipped:true,reason:'no 3.8.8 shdc at '+SHDC+' (set QF_CC_SHDC)'};
 const build=require(path.join(SHDC,'compile.js')).make(path.join(SHDC,'engine'));compiled=[];const rows=[];
 for(const [f,want] of [['rainbow-bridge',{transparent:245}],['rainbow-bridge-additive',{ground:244,motes:246}]]){const r=build(path.join(W,f+'.effect'));
  assert.deepEqual(r.errors,[],f+' errors');const e=r.effect;
  assert.deepEqual(Object.fromEntries(e.techniques.map(t=>[t.name,t.passes[0].priority])),want);
  for(const t of e.techniques){const p=t.passes[0];assert.equal(p.depthStencilState.depthWrite,false);assert.equal(p.blendState.targets[0].blendSrc,1);assert.equal(p.blendState.targets[0].blendDst,4);assert(!('depthBias' in (p.rasterizerState||{})));}
  for(const s of e.shaders){assert.equal(s.defines.length,0,s.name+' has defines (variants)');assert(s.glsl1&&s.glsl1.vert&&s.glsl1.frag,s.name+' glsl1');assert(s.glsl3&&s.glsl3.vert&&s.glsl3.frag,s.name+' glsl3');
   if(/dFdx/.test(s.glsl1.frag))assert.match(s.glsl1.frag,/#ifdef GL_OES_standard_derivatives\s*\n\s*#extension GL_OES_standard_derivatives: enable/,'guarded #extension in GLSL1');
   compiled.push({name:s.name,glsl1:s.glsl1,glsl3:s.glsl3});rows.push({shader:s.name,glsl1:s.glsl1.vert.length+s.glsl1.frag.length,glsl3:s.glsl3.vert.length+s.glsl3.frag.length});}
  rows.push({effect:f,warnings:r.warnings.length,jsonBytes:JSON.stringify(e).length});}
 return {rows};});
check('E3 headless Chrome: every variant compiles + links on WebGL1 (no derivatives / derivatives) and WebGL2',()=>{
 if(!compiled)return {skipped:true,reason:'E2 did not run'};
 const r=require('./gl-compile-check.cjs').glCompileCheck(compiled);if(!r.ran)return {skipped:true,reason:r.reason};
 const bad=r.rows.filter(x=>!x.ok);assert.deepEqual(bad,[],'GL compile/link failures');
 const modes=[...new Set(r.rows.map(x=>x.mode))];assert(modes.includes('webgl1-noderivatives'));assert(modes.includes('webgl2'));
 return {modes,programs:r.rows.length};});
const out={suite:'rainbow-bridge-effects',results,summary:{total:results.length,passed:results.filter(r=>r.status!=='FAIL').length,skipped:results.filter(r=>r.status==='SKIP').length}};
console.log(JSON.stringify(out,null,1));if(out.summary.passed!==out.summary.total)process.exitCode=1;
