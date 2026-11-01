'use strict';
/** Crossfade clearance for walk_loop -> walk_stop_bodyL (b21, 运镜bot): node xfade_fix.cjs --in <glb> [--out <glb>]
 *  The runtime cross-fades 0.2 s from walk_loop (any phase) into walk_stop_bodyL.  Blending two clear poses can still put the shin
 *  through the lower front panel.  This pitches the lower front panel (skirt.front.low / .low.mid) of walk_stop_bodyL forward by d deg on
 *  its first keys (optionally the panel above, skirt.front.mid, by dUp to hold the flare) (cosine decay to 0 at 0.3 s) - the smallest d for which every walk_loop phase (1/60 s) x blend time (1/120 s) is clear
 *  and walk_stop_bodyL itself still meets every strict limit at 120 Hz. */
const fs=require('fs'),path=require('path'),H=require('./hem_lib.cjs'),GW=require('./glb_write.cjs');
const a=process.argv.slice(2),arg=n=>a.includes(n)?a[a.indexOf(n)+1]:null;const IN=arg('--in')||H.GLB;
const R=H.load(IN),S=H.sets(R),M=H.loadMeta(path.join(path.dirname(IN),'anim_meta.json'));const A='walk_loop',B='walk_stop_bodyL',FADE=0.2,SPAN=0.3;
const JN=['skirt.front.low','skirt.front.low.mid','skirt.front.mid'];const C=R.clips[B];
const chans=JN.map(n=>C.channels.find(c=>c.path==='rotation'&&c.node===R.byName[n]));if(chans.some(c=>!c))throw Error('missing channel');
const orig=chans.map(c=>Float64Array.from(c.out));
function slerp(x,y,u){let d=x[0]*y[0]+x[1]*y[1]+x[2]*y[2]+x[3]*y[3];let yy=y;if(d<0){d=-d;yy=y.map(v=>-v);}if(d>0.9995){const o=x.map((v,i)=>v+(yy[i]-v)*u),l=Math.hypot(...o);return o.map(v=>v/l);}const th=Math.acos(d),s=Math.sin(th);return x.map((v,i)=>(v*Math.sin((1-u)*th)+yy[i]*Math.sin(u*th))/s);}
const KEYS=arg('--keys')&&arg('--keys').split(',').map(Number);/* --keys: explicit low.mid pitch (deg) per 30 fps key from t=0 */
function setD(dLow,dMid,dUp=0){chans.forEach((c,j)=>{const d=[dLow,dMid,dUp][j];for(let k=0;k<c.inp.length;k++){const t=c.inp[k],w=t>=SPAN?0:0.5*(1+Math.cos(Math.PI*t/SPAN));let h=d*w*Math.PI/360;if(KEYS&&j===1){const kk=Math.round(t*30);h=(Math.abs(t*30-kk)<1e-3&&kk<KEYS.length?KEYS[kk]:0)*Math.PI/360;}const q=H.qmul([-Math.sin(h),0,0,Math.cos(h)],Array.from(orig[j].slice(k*4,k*4+4)));c.out.set(q,k*4);}});}
const snap=(c,t)=>{H.applyClip(R,c,t);return R.nodes.map(n=>({p:n.p.slice(),q:n.q.slice()}));};
function evalAll(){let hits=0,worst=0;for(let ta=0;ta<R.clips[A].duration;ta+=1/60)for(let tb=0;tb<=FADE+1e-9;tb+=1/120){const w=1-tb/FADE;const x=snap(A,(ta+tb)%R.clips[A].duration),y=snap(B,tb);
    R.nodes.forEach((n,i)=>{n.q=slerp(y[i].q,x[i].q,w);n.p=y[i].p.map((v,k)=>v+(x[i].p[k]-v)*w);});const p=H.penetration(R,S,H.clipMorph(M,B,tb),H.world(R));if(p.count){hits+=p.count;worst=Math.max(worst,p.maxDepth);}}
  let self=0,lim=0,mx={lift:-9,apron:-9,flare:-9,vert:-9,bk:9};for(let t=0;t<=C.duration+1e-9;t+=1/120){H.applyClip(R,B,t);const W=H.world(R),mw=H.clipMorph(M,B,t);self+=H.penetration(R,S,mw,W).count;const m=H.hemMetrics(R,S,mw);
    const v={lift:m.dress.lift,apron:m.apron.lift,bk:m.dress.belowKnee,flare:Math.max(m.dress.flare,m.apron.flare),vert:Math.max(m.dress.maxVertLift,m.apron.maxVertLift)};for(const k in v)mx[k]=k==='bk'?Math.min(mx[k],v[k]):Math.max(mx[k],v[k]);
    if(v.lift>0.03||v.apron>0.03||v.bk<0.045||v.flare>0.28||v.vert>0.05)lim++;}
  return {hits,worstCm:+(worst*100).toFixed(3),self,lim,mx:Object.fromEntries(Object.entries(mx).map(([k,v])=>[k,+(v*100).toFixed(2)]))};}
let best=null;const FORCE=arg('--force');if(FORCE){best=FORCE.split(',').map(Number);setD(...best);console.log('forced',best,JSON.stringify(evalAll()));}else for(const [dl,dm] of [[0,0],[0,2],[0,4],[2,2],[0,6],[3,3],[0,8],[4,4],[2,6],[5,5],[0,10],[6,6],[4,8],[8,8]]){setD(dl,dm);const r=evalAll();console.log(dl,dm,JSON.stringify(r));if(!r.hits&&!r.self&&!r.lim){best=[dl,dm];break;}}
if(best&&arg('--out')){setD(...best);const edits=chans.map((c,j)=>({anim:R.clips[B].name||B,node:R.byName[JN[j]],path:'rotation',times:Float32Array.from(c.inp),values:Float32Array.from(c.out)}));
  const out=GW.rewrite(R.buf,edits,[]);fs.writeFileSync(arg('--out'),out);console.log('chosen',best,'wrote',arg('--out'),out.length);}
else console.log('chosen',best);
