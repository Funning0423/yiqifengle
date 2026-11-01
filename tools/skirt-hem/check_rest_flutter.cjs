'use strict';
/** Rest / wind check for the front-hem re-bake (b21): node check_rest_flutter.cjs <base 773c061e glb> [new glb]
 *  1) rest (bind) pose: every mesh skinned at rest, max vertex distance new vs base (limit 0.1 mm);
 *  2) wind_flutter_loop: every skirt.back* channel (and the whole clip) sampled at 120 Hz identical to the base (max component diff);
 *  3) skirt.back* channels of every other clip identical unless the re-bake report lists them (pass-2 poke fixes). */
const H=require('./hem_lib.cjs');const [base,cur=H.GLB]=process.argv.slice(2);const A=H.load(base),B=H.load(cur);
H.resetRest(A);H.resetRest(B);const WA=H.world(A),WB=H.world(B);let rest=0;const per={};
for(const k of Object.keys(A.meshes)){const a=H.skinMesh(A,WA,A.meshes[k],{}),b=H.skinMesh(B,WB,B.meshes[k],{});let m=0;for(let i=0;i<a.length;i+=3)m=Math.max(m,Math.hypot(a[i]-b[i],a[i+1]-b[i+1],a[i+2]-b[i+2]));per[k]=+(m*1000).toFixed(4);rest=Math.max(rest,m);}
const chanDiff=(clip,re)=>{const ca=A.clips[clip],cb=B.clips[clip];let m=0,n=0;for(const c of ca.channels){const nm=A.nodes[c.node].name;if(!re.test(nm))continue;const d=cb.channels.find(x=>B.nodes[x.node].name===nm&&x.path===c.path);if(!d)return {missing:nm};n++;
  for(let t=0;t<=ca.duration+1e-9;t+=1/120){const va=H.sampleChannel(c,t),vb=H.sampleChannel(d,t);const sg=c.path==='rotation'&&va.reduce((s,x,i)=>s+x*vb[i],0)<0?-1:1;const e=Math.max(...va.map((x,i)=>Math.abs(x-sg*vb[i])));m=Math.max(m,e);}}return {channels:n,max:+m.toFixed(6)};};
const out={restMaxMm:+(rest*1000).toFixed(4),restPerMeshMm:per,restOk:rest<=1e-4,flutterBack:chanDiff('wind_flutter_loop',/^skirt\.back/),flutterAll:chanDiff('wind_flutter_loop',/./),
  backPerClip:Object.fromEntries(Object.keys(A.clips).map(c=>[c,chanDiff(c,/^skirt\.back/)]))};
console.log(JSON.stringify(out,null,1));process.exitCode=out.restOk&&out.flutterAll.max===0?0:1;
