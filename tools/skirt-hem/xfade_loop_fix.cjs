'use strict';
/** Crossfade fix at the source (b21, 运镜bot; Grok Bot option (a), 2026-10-31).
 *  The ride scenario fades walk_loop (phase ~1.07 s) into walk_stop_bodyL over 0.2 s; the blended pose puts the shin through the
 *  lower front panel.  This adds a local forward pitch bump to skirt.front.low.mid of walk_loop (cosine window, centre C, half
 *  width HW, amplitude D deg) and judges the result on the REAL runtime blend (runtime_eval, ride at 60/30/uneven) plus walk_loop
 *  alone at 120 Hz against every strict limit.
 *  node xfade_loop_fix.cjs --in glb --d D --c C --hw HW [--out glb] */
const fs=require('fs'),path=require('path'),H=require('./hem_lib.cjs'),GW=require('./glb_write.cjs'),RT=require('./runtime_eval.cjs'),SR=require('./seated_ratchet.cjs');
const a=process.argv.slice(2),arg=(n,d)=>a.includes(n)?a[a.indexOf(n)+1]:d;const IN=arg('--in',H.GLB),D=+arg('--d',0),C=+arg('--c',1.07),HW=+arg('--hw',0.2);
const JN=(arg('--joints','skirt.front.low.mid')).split(',');
const R=H.load(IN),CL=R.clips.walk_loop;const edits=[];
for(const jn of JN){const c=CL.channels.find(x=>x.path==='rotation'&&x.node===R.byName[jn]);if(!c)throw Error('no channel '+jn);
  for(let k=0;k<c.inp.length;k++){const t=c.inp[k];let u=Math.abs(t-C);u=Math.min(u,CL.duration-u);const w=u>=HW?0:0.5*(1+Math.cos(Math.PI*u/HW));const h=D*w*Math.PI/360;
    c.out.set(H.qmul([-Math.sin(h),0,0,Math.cos(h)],Array.from(c.out.slice(k*4,k*4+4))),k*4);}
  edits.push({anim:CL.name||'walk_loop',node:R.byName[jn],path:'rotation',times:Float32Array.from(c.inp),values:Float32Array.from(c.out)});}
const OUT=arg('--out','/tmp/sk/xl_'+process.pid+'.glb');fs.writeFileSync(OUT,GW.rewrite(R.buf,edits,[]));
const dir=path.dirname(OUT);if(!fs.existsSync(path.join(dir,'anim_meta.json')))fs.copyFileSync(path.join(path.dirname(IN),'anim_meta.json'),path.join(dir,'anim_meta.json'));
const R2=H.load(OUT),S=H.sets(R2),M=H.loadMeta(path.join(dir,'anim_meta.json'));let lim=0,pen=0;const mx={lift:-9,apron:-9,flare:-9,vert:-9,bk:9};
for(let t=0;t<CL.duration;t+=1/120){H.applyClip(R2,'walk_loop',t);const W=H.world(R2),mw=H.clipMorph(M,'walk_loop',t);pen+=H.penetration(R2,S,mw,W).count;const m=H.hemMetrics(R2,S,mw);
  const v={lift:m.dress.lift,apron:m.apron.lift,bk:m.dress.belowKnee,flare:Math.max(m.dress.flare,m.apron.flare),vert:Math.max(m.dress.maxVertLift,m.apron.maxVertLift)};for(const k in v)mx[k]=k==='bk'?Math.min(mx[k],v[k]):Math.max(mx[k],v[k]);
  if(v.lift>0.03||v.apron>0.03||v.bk<0.045||v.flare>0.28||v.vert>0.05)lim++;}
const ride={};for(const m of [60,30,'uneven']){const rows=SR.markRuntime(RT.run(OUT,m,{scenarios:['ride']}));const seg=rows.filter(r=>r.ratchet);ride[m]=SR.penAgg(seg);
  ride[m].strictPenOutside=rows.filter(r=>!r.ratchet&&r.pen&&r.pen.count).length;}
console.log(JSON.stringify({D,C,HW,JN,out:OUT,loop:{lim,pen,mx:Object.fromEntries(Object.entries(mx).map(([k,v])=>[k,+(v*100).toFixed(2)]))},ride:Object.fromEntries(Object.entries(ride).map(([m,r])=>[m,{hits:r.hits,axis:(r.panels['axis:dress']||{}).n,low:r.panels['dress:skirt.front.low'],out:r.strictPenOutside}]))}));
