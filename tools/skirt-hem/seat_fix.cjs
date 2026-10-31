'use strict';
/** Seated-phase clearance pass (b21, 运镜bot): node seat_fix.cjs --in <773c061e glb> --clip <clip> [--curves solved.json] --out fixed.json
 *  The authored seated drape (sit_down / stand_up) already lets the thighs poke through the back / side panels and, while the thigh is
 *  still near vertical, lets a shin pass behind the front panel.  Starting from the solved front curves (or the authored ones), every
 *  skirt joint gets an additive outward rotation per 30 fps key.  Verification is at 120 Hz on the interpolated (slerped) keys - exactly
 *  what the runtime samples - so no between-key pokes survive.  For each poking sample the panel that owns the hit gets +1 deg on its
 *  bracketing keys in the direction (pitch / roll, +/-) that removes the most hits, then the offsets are dilated by one key so the
 *  curve stays smooth.  Front-hem limits are re-checked (thigh <= 30 deg) and a step that breaks them is rejected. */
const fs=require('fs');const argv=process.argv.slice(2),arg=(n,d)=>argv.includes(n)?argv[argv.indexOf(n)+1]:d;
const RB=require('./rebake_front.cjs');const {R,S,M,pose,hits,vals,ALL,H}=RB;
const CLIP=arg('--clip'),CUR=arg('--curves'),OUT=arg('--out');const FPS=30,HZ=120;
const C=R.clips[CLIP],dur=C.duration,n=Math.round(dur*FPS);const ts=[];for(let k=0;k<=n;k++)ts.push(Math.min(k/FPS,dur));
const PANELS=['skirt.front','skirt.front.mid','skirt.front.low','skirt.front.low.mid','skirt.back','skirt.back.low','skirt.left','skirt.left.low','skirt.right','skirt.right.low'].filter(b=>R.byName[b]!==undefined);
const id=b=>R.byName[b];
// base quats per key: solved curves if given, else authored
const base=ts.map((t,k)=>{H.applyClip(R,CLIP,t);const o={};for(const b of PANELS)o[b]=R.nodes[id(b)].q.slice();return o;});
if(CUR){const r=JSON.parse(fs.readFileSync(CUR,'utf8')).find(x=>x.clip===CLIP);if(r){if(r.ts.length!==ts.length)throw Error('key count');for(const [b,v] of Object.entries(r.qs))for(let k=0;k<=n;k++)base[k][b]=v.slice(k*4,k*4+4);}}
const aa=(ax,deg)=>{const h=deg*Math.PI/360,s=Math.sin(h);return [ax[0]*s,ax[1]*s,ax[2]*s,Math.cos(h)];};
const AX={x:[-1,0,0],z:[0,0,1]};
const off=ts.map(()=>Object.fromEntries(PANELS.map(b=>[b,{x:0,z:0}])));
const keyQ=(k,b)=>{const d=off[k][b];let q=base[k][b];if(d.x||d.z)q=H.qmul(H.qmul(aa(AX.z,d.z),aa(AX.x,d.x)),q);return q;};
function slerp(a,b,u){let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];let bb=b;if(d<0){d=-d;bb=b.map(x=>-x);}if(d>0.9995){const o=a.map((x,i)=>x+(bb[i]-x)*u),l=Math.hypot(...o);return o.map(x=>x/l);}
  const th=Math.acos(d),s=Math.sin(th);return a.map((x,i)=>(x*Math.sin((1-u)*th)+bb[i]*Math.sin(u*th))/s);}
const ovAt=t=>{const f=Math.min(t*FPS,n),k=Math.min(Math.floor(f),n-1),u=f-k;const o={};for(const b of PANELS)o[id(b)]=slerp(keyQ(k,b),keyQ(k+1,b),u);return {o,k,u};};
const samples=[];for(let t=0;t<=dur+1e-9;t+=1/HZ)samples.push(Math.min(t,dur));
const evalT=t=>{const {o,k,u}=ovAt(t);const W=pose(CLIP,t,o);const mw=H.clipMorph(M,CLIP,t);const h=hits(ALL,W,mw,0,true);const th=H.thighFromVertical(R,W);
  let lim=null;if(th<=30){const v=vals(H.hemMetrics(R,S,mw));lim=v;}return {h,th,lim,k,u};};
const limOk=v=>!v||(v.lift<=0.03&&v.apron<=0.03&&v.bk>=0.045&&v.flare<=0.28&&v.vert<=0.05);
const limOver=v=>!v?0:Math.max(0,v.lift-0.03)+Math.max(0,v.apron-0.03)+Math.max(0,0.045-v.bk)+Math.max(0,v.flare-0.28)+Math.max(0,v.vert-0.05);
const FRONTB=['skirt.front','skirt.front.mid','skirt.front.low','skirt.front.low.mid'];
let it=0,log=[];const LOCK={};
for(;it<120;it++){let bad=[];for(const t of samples){const e=evalT(t);if(e.h.n||!limOk(e.lim))bad.push([t,e]);}
  const tot=bad.reduce((s,[,e])=>s+e.h.n,0);log.push({it,badSamples:bad.length,hits:tot});console.error(CLIP,'it',it,'bad',bad.length,'hits',tot);if(!bad.length)break;
  for(const [t,e] of bad){const cur=evalT(t);if(!cur.h.n&&limOk(cur.lim))continue;
    let cands;if(cur.h.n){const ent=Object.entries(cur.h.by).sort((a,b)=>b[1]-a[1]);const top=ent[0][0];cands=top==='axis'?FRONTB:PANELS.includes(top)?[top]:PANELS;}else cands=FRONTB;
    const score=x=>x.h.n*10+limOver(x.lim)*1000;let best=null,bs=score(cur);
    for(const b of cands)for(const ax of ['x','z'])for(const s of (LOCK[b+ax]?[LOCK[b+ax]]:[1,-1])){const ks=cur.u<1e-6?[cur.k]:[cur.k,cur.k+1];for(const k of ks)off[k][b][ax]+=s*1.5;const x=evalT(t),sc=score(x);for(const k of ks)off[k][b][ax]-=s*1.5;if(sc<bs){bs=sc;best={b,ax,s,ks};}}
    if(best){LOCK[best.b+best.ax]=best.s;for(const k of best.ks){off[k][best.b][best.ax]+=best.s*1.5;for(const j of [k-1,k+1])if(j>=0&&j<=n){const d=off[j][best.b][best.ax],dk=off[k][best.b][best.ax];if(Math.abs(d)<Math.abs(dk)*0.5)off[j][best.b][best.ax]=dk*0.5;}}}}}
const qs={};const touched=PANELS.filter(b=>CUR&&FRONTB.includes(b)||off.some(o=>o[b].x||o[b].z));for(const b of touched){qs[b]=[];for(let k=0;k<=n;k++)qs[b].push(...keyQ(k,b));}
const out=[{clip:CLIP,ts,loop:false,qs,P:[],blend:[],unsolved:0,fixes:it,left:0,pfix:0,otherLeft:0,evals:0,extra:{},seat_fix:{log,offsets:off.map(o=>Object.fromEntries(Object.entries(o).filter(([,d])=>d.x||d.z).map(([b,d])=>[b,[d.x,d.z]])))},seconds:0}];
fs.writeFileSync(OUT,JSON.stringify(out));console.log(CLIP,JSON.stringify(log[log.length-1]));
