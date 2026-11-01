#!/usr/bin/env node
'use strict';
/** full8 (Mac m1 frames 775–785, night skycity ground missing after landing; root cause 运镜bot: BalloonTransit dimCityNight swapped
 *  every non-emissive city mesh to an unlit (38,44,58) material and never put it back). Gate: after a night-flight landing — and on
 *  release/abort — every skycity renderer has its ORIGINAL shared material and its ORIGINAL instance object back (no instance
 *  destroyed), and the ground (env_sky_static_palette / env_sky_floor_seal) is never silhouetted. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
const grab=(re)=>{const m=re.exec(src);assert.ok(m,'missing '+re);return m[0];};
const code=[grab(/function dimOne\([\s\S]*?\n\}\n/),grab(/export function restoreCityNight\([\s\S]*?return n;\}\n/),grab(/export const CITY_NIGHT_KEEP=.*\n/),grab(/function dimCityNight\([\s\S]*?\n\}\n/)].join('\n').replace(/export /g,'');
const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
// cc stand-ins with Renderer.setSharedMaterial / setMaterialInstance semantics of Cocos 3.8 (setShared destroys a live instance)
let destroyed=0;
class Material{constructor(n){this.n=n;this.props={};this.dead=false;}initialize(){}setProperty(k,v){this.props[k]=v;}getProperty(k){return this.props[k];}destroy(){this.dead=true;destroyed++;}}
class Inst extends Material{constructor(p){super('inst');this.parent=p;}}
class MeshRenderer{constructor(node,shared,inst){this.node=node;this._materials=[shared];this._materialInstances=[inst||null];}
 getSharedMaterial(i){return this._materials[i];}setSharedMaterial(m,i){this._materials[i]=m;const x=this._materialInstances[i];if(x){x.destroy();this._materialInstances[i]=null;}}
 setMaterialInstance(i,m){if(m&&m.parent)this._materialInstances[i]=m;else this.setSharedMaterial(m,i);}}
class Color{constructor(...a){this.a=a;}}
const EffectAsset={get:()=>({})},isValid=()=>true,isTransitionPlaceholder=()=>false;
const names=['env_sky_static_palette','env_sky_floor_seal','env_sky_ruins','env_sky_static_rock_strata','env_sky_greattree_canopy_cards','env_sky_windchime_01','state_gate_after','window_glow'];
const nodes=names.map((n,i)=>{const node={name:n,children:[]};const sh=new Material(n);const r=new MeshRenderer(node,sh,i%2?new Inst(sh):null);node.getComponents=()=>[r];node.r=r;node.orig={sh,inst:r._materialInstances[0]};return node;});
const model={name:'root',children:nodes,getComponents:()=>[]};
const eachNamed=(root,fn)=>{const walk=n=>{fn(n);for(const c of n.children||[])walk(c);};walk(root);};
const F=new Function('MeshRenderer','Material','Color','EffectAsset','isValid','isTransitionPlaceholder','eachNamed',js+';return {dimCityNight,restoreCityNight,CITY_NIGHT_KEEP};')(MeshRenderer,Material,Color,EffectAsset,isValid,isTransitionPlaceholder,eachNamed);
const cache=new Map();
for(let f=0;f<5;f++)F.dimCityNight(model,true,cache);// per-frame calls during the flight
const dimmed=nodes.filter(n=>n.r.getSharedMaterial(0)!==n.orig.sh).map(n=>n.name);
assert.ok(dimmed.includes('env_sky_ruins')&&!dimmed.includes('env_sky_static_palette')&&!dimmed.includes('env_sky_floor_seal')&&!dimmed.includes('window_glow'),'dim set '+dimmed);
assert.equal(destroyed,0,'no instance destroyed while dimming');
const n=F.restoreCityNight(cache);assert.equal(n,dimmed.length);
for(const x of nodes){assert.equal(x.r.getSharedMaterial(0),x.orig.sh,x.name+' shared back');assert.equal(x.r._materialInstances[0],x.orig.inst,x.name+' instance back');if(x.orig.inst)assert.equal(x.orig.inst.dead,false,x.name+' instance alive');}
assert.equal(F.restoreCityNight(cache),0,'idempotent');
// wiring: touchdown and release both restore; cache exists before release()
assert.match(src,/arrived=true;\n\s*const restored=restoreCityNight\(cityNightDimmed\)/,'touchdown restore');
assert.match(src,/const cityNightDimmed:CityNightCache=new Map\(\)[^\n]*\n\s*const release=\(\)=>\{if\(dead\)return;dead=true;try\{restoreCityNight\(cityNightDimmed\);\}catch\{\}/,'release/abort restore');
console.log('PASS city-night-restore '+JSON.stringify({dimmed,restored:n}));
