#!/usr/bin/env node
'use strict';
/* v3.2 night sea. Regression for the Mac review of 764dcd8: the v3.1 tint never reached the pixels (night journey sea
 * Y 0.43–0.50, hue 199–204°, same as before). Real SeaNightTint.ts against a fake renderer that reproduces the release
 * conditions the v3.1 one-shot getProperty(Color) binder could not survive:
 *  S1 RoomLightingRig's instance appears only AFTER the props bind; S2 mainColor is only a linear pass uniform
 *  (getProperty returns nothing); S3 the instance is swapped mid-journey; S4 nobody ever instances the sea;
 *  S5 day writes the authored uniform back exactly; S6 predicted night-journey sea brightness ≤ 0.25 from the measured
 *  Mac pixels (logs/sea_hsv.txt) and the island night unchanged in design (#7f9fb3). */
const assert=require('assert/strict'),path=require('path'),fs=require('fs');
const {load}=require('./load_ts.cjs');
const M=load(['world-r1/CameraPose','world-r2/IslandPropsLayout','world-r2/SeaNightTint'],{cc:path.join(__dirname,'fake_cc_sea.cjs')});
const {SeaNightTint,seaLinearFactor}=M.SeaNightTint,{ISLAND_PROPS:P,srgbToLinear}=M.IslandPropsLayout,{Vec4,MeshRenderer}=require('./fake_cc_sea.cjs');
const results=[];const ok=(id,fn)=>{try{fn();results.push(id);console.log('PASS',id);}catch(e){console.log('FAIL',id);console.error(e);process.exitCode=1;}};
const AUTH=[0.82,0.93,1,1];
function mat(name,u=AUTH){const m={name,u:u.slice(),props:{},passes:[{getHandle:k=>k==='mainColor'?1:0,getUniform:(h,v)=>{v.x=m.u[0];v.y=m.u[1];v.z=m.u[2];v.w=m.u[3];return v;}}],
 getProperty:()=>undefined,/* S2: no Color property, uniform only */setProperty(k,v){assert.equal(k,'mainColor');assert(v instanceof Vec4,'writes a linear Vec4, not a byte Color');m.u=[v.x,v.y,v.z,v.w];}};return m;}
function world(){const shared=mat('shared');let render=shared;const r=new MeshRenderer();r.enabled=true;
 r.getSharedMaterial=()=>shared;r.getRenderMaterial=()=>render;r.getMaterialInstance=()=>{if(render===shared)render=mat('own');return render;};r.setSharedMaterial=(m)=>{render=m;};
 const sea={name:P.seaNight.node,children:[],activeInHierarchy:true,getComponent:()=>r};r.node=sea;const root={name:'scene',children:[sea],getComponent:()=>null};
 return {root,r,shared,instance:(m)=>{render=m;return m;},render:()=>render};}
const lin2s=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055,Y=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
ok('S1 late RoomLightingRig instance: binder waits, then tints that instance (v3.1 bound once and stayed off)',()=>{
 const W=world(),t=new SeaNightTint(()=>W.root,2);t.tick(1,1,.1);assert.equal(t.state,'waiting-instance');assert.deepEqual(W.shared.u,AUTH,'shared never written');
 const inst=W.instance(mat('rlr'));t.tick(1,1,.1);assert.equal(t.state,'instance-tint');const f=seaLinearFactor(1,1);
 assert.deepEqual(inst.u.map(x=>+x.toFixed(5)),[AUTH[0]*f[0],AUTH[1]*f[1],AUTH[2]*f[2],1].map(x=>+x.toFixed(5)));assert.deepEqual(W.shared.u,AUTH);});
ok('S3 instance swapped mid-journey: re-binds and re-tints the new instance',()=>{
 const W=world(),t=new SeaNightTint(()=>W.root);W.instance(mat('a'));t.tick(1,1,.1);const b=W.instance(mat('b'));t.tick(1,1,.1);assert.equal(t.rebinds,1);assert(b.u[2]<.5,'new instance dark');});
ok('S4 nobody instances the sea: own instance after the grace period, shared untouched',()=>{
 const W=world(),t=new SeaNightTint(()=>W.root,2);for(let i=0;i<19;i++)t.tick(1,0,.1);assert.equal(t.state,'waiting-instance');t.tick(1,0,.2);assert.equal(t.state,'own-instance-tint');assert.deepEqual(W.shared.u,AUTH);assert.notEqual(W.render(),W.shared);});
ok('S5 day = authored uniform exactly, whatever the journey weight; restore puts authored back',()=>{
 const W=world(),t=new SeaNightTint(()=>W.root);const i=W.instance(mat('rlr'));t.tick(1,1,.1);for(const j of [0,.5,1]){t.tick(0,j,.1);assert.deepEqual(i.u,AUTH);}t.tick(1,1,.1);t.restore();assert.deepEqual(i.u,AUTH);});
ok('S6 night journey sea Y ≤ 0.25 from the measured Mac night pixels; island night = #7f9fb3 multiply; monotone',()=>{
 const f=seaLinearFactor(1,1),fi=seaLinearFactor(1,0);assert.deepEqual(fi.map(x=>+x.toFixed(3)),srgbToLinear(P.seaNight.tint).map(x=>+x.toFixed(3)));
 const measured=[[66,140,185],[51,134,182],[48,120,168],[34,134,181],[92,138,172]],out=[];
 for(const c of measured){const p=c.map((v,i)=>lin2s(srgbToLinear('#'+c.map(x=>x.toString(16).padStart(2,'0')).join(''))[i]*f[i]));out.push(+Y(p).toFixed(3));}
 assert(Math.max(...out)<=.25,'predicted night journey sea Y '+out);assert(Math.min(...out)>=.12,'still reads as sea, not black '+out);
 let prev=9;for(const j of [0,.25,.5,.75,1]){const v=Y(seaLinearFactor(1,j));assert(v<prev);prev=v;}console.log('   predicted Y',out);});
ok('Boot wiring: IslandProps ticks the sea every sync with the journey weight',()=>{const {SRC}=require('./load_ts.cjs'),s=fs.readFileSync(path.join(SRC,'world-r2/IslandProps.ts'),'utf8'),b=fs.readFileSync(path.join(SRC,'WorldIntegrationBoot.ts'),'utf8');assert(/\n    this\.tickSea\(this\.nightW\);/.test(s));assert(/t\.tick\(w, this\.journeyW, dt\)/.test(s));assert(/journey:s\.state==='region-travel'/.test(b));});
console.log(JSON.stringify({passed:results.length}));
