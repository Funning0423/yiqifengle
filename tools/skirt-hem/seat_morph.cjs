'use strict';
/** Seated fix step 2 (b21 option A, 运镜bot): seated-only corrective shapes for leg penetration.
 *  New morph targets on LOD0_G2_DRESS / LOD0_G2_APRON named seat_fix_<clip>_<key>, one per 1/30 s key of sit_down / stand_up,
 *  each keyed in anim_meta ONLY in its own clip with a tent curve (0 at key-1/30, 1 at key, 0 at key+1/30): every other clip
 *  (walking, standing, sit_hold, wind) has weight 0, so rest pose and walking deformation are untouched.
 *  Solve: sample the clip at 120 Hz + the gate's 60/30/uneven frame times (and the runtime 'ride' frames, mapped back to the
 *  seated clip's own time); every leg vertex through the cloth (hem_lib limb-segment test, + pass-through test with thigh <= 30)
 *  pushes the hit triangle outward from the limb centre line by depth + MARGIN, spread to cloth vertices within RAD (rest
 *  distance, smooth falloff, both meshes so the apron follows the dress); the world push is mapped to bind space with the
 *  vertex's blended skin matrix and added to the tent keys.  Iterate until no hits.
 *  node seat_morph.cjs --in glb --out glb [--iters N] */
const fs=require('fs'),path=require('path'),H=require('./hem_lib.cjs'),GW=require('./glb_write.cjs');
const a=process.argv.slice(2),arg=(n,d)=>a.includes(n)?a[a.indexOf(n)+1]:d;const IN=arg('--in','/tmp/ss/lift.glb'),OUT=arg('--out','/tmp/ss/morph.glb');
const MARGIN=+arg('--margin',0.004),RAD=+arg('--rad',0.035),ITERS=+arg('--iters',30),DT=1/30;const CLIPS=['sit_down','stand_up'];
const R=H.load(IN),S=H.sets(R),META=H.loadMeta(path.join(path.dirname(IN),'anim_meta.json'));
const MESH=['LOD0_G2_DRESS','LOD0_G2_APRON'];const MS=MESH.map(k=>R.meshes[k]);
// rest positions of both cloth meshes for neighbourhoods
H.resetRest(R);const W0=H.world(R);const RP=MS.map(m=>H.skinMesh(R,W0,m,{}));
const CELL=RAD;const grid=new Map();RP.forEach((P,mi)=>{for(let i=0;i<P.length/3;i++){const k=[0,1,2].map(c=>Math.floor(P[i*3+c]/CELL)).join(',');let l=grid.get(k);if(!l)grid.set(k,l=[]);l.push([mi,i]);}});
const near=(mi,i)=>{const P=RP[mi],p=[P[i*3],P[i*3+1],P[i*3+2]],c=p.map(x=>Math.floor(x/CELL)),o=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const l=grid.get((c[0]+x)+','+(c[1]+y)+','+(c[2]+z));if(!l)continue;
  for(const [mj,j] of l){const Q=RP[mj],d=Math.hypot(Q[j*3]-p[0],Q[j*3+1]-p[1],Q[j*3+2]-p[2]);if(d<RAD)o.push([mj,j,d]);}}return o;};
const nearCache=new Map();const nearC=(mi,i)=>{const k=mi*100000+i;let v=nearCache.get(k);if(!v)nearCache.set(k,v=near(mi,i));return v;};
// targets: key -> per mesh Float64Array nv*3 (bind deltas)
const T={};const tname=(clip,k)=>'seat_fix_'+clip+'_'+String(k).padStart(2,'0');
const ensure=(clip,k)=>{const n=tname(clip,k);if(!T[n]){T[n]={clip,k,t:k*DT,D:MS.map(m=>new Float64Array(m.nv*3))};MS.forEach((m,mi)=>{m.targets.push(n);m.T.push(T[n].D[mi]);});}return T[n];};
const tents=(clip,t)=>{const k0=Math.floor(t/DT+1e-9),u=t/DT-k0;const o=[[k0,1-u]];if(u>1e-9)o.push([k0+1,u]);return o.filter(x=>x[1]>1e-9);};
const weights=(clip,t,scale=1)=>{const w=H.clipMorph(META,clip,t);for(const [k,v] of tents(clip,t)){const n=tname(clip,k);if(T[n])w[n]=v*scale;}return w;};
function skinMat(W){return R.joints.map((j,k)=>{const A=W[j],B=Array.from(R.ibm.subarray(k*16,k*16+16));const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=A[r]*B[c*4]+A[4+r]*B[c*4+1]+A[8+r]*B[c*4+2]+A[12+r]*B[c*4+3];return o;});}
function inv3(m){const [a,b,c,d,e,f,g,h,i]=m;const A=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g,det=a*A+b*B+c*C;return [A/det,-(b*i-c*h)/det,(b*f-c*e)/det,B/det,(a*i-c*g)/det,-(a*f-c*d)/det,C/det,-(a*h-b*g)/det,(a*e-b*d)/det];}
/** hits of the current pose with the push vectors */
function hitList(W,mw){const B=R.meshes.LOD0_G2_BODY,L=H.skinMesh(R,W,B,mw,S.legs),seg=H._limbSegs(R,S,W),out=[];const thighOk=H.thighFromVertical(R,W)<=30;const hp=H.jpos(R,W,'hips');
  MS.forEach((m,mi)=>{const P=H.skinMesh(R,W,m,mw),g=H._triGrid(P,m.F);let lo=Infinity;for(let q=1;q<P.length;q+=3)lo=Math.min(lo,P[q]);
    for(let q=0;q<S.legs.length;q++){const o=[L[q*3],L[q*3+1],L[q*3+2]],sg=seg[S.legBone[q]],e=H._closestOnSeg(o,sg[0],sg[1]);let h=H._segHit(g,o,e);
      if(h>0){const d=[o[0]-e[0],o[1]-e[1],o[2]-e[2]],l=Math.hypot(...d);out.push({mi,tri:g.lastTri,u:d.map(x=>x/l),amt:h+MARGIN,depth:h});}
      if(thighOk&&o[1]>=lo){const e2=[hp[0],o[1],hp[2]];h=H._segHit(g,o,e2);if(h>0){const d=[o[0]-e2[0],0,o[2]-e2[2]],l=Math.hypot(...d);out.push({mi,tri:g.lastTri,u:d.map(x=>x/l),amt:h+MARGIN,depth:h,axis:true});}}}});
  return out;}
/** world push field (per mesh map vertex->vec) from hits, projection-max combine with falloff */
function field(hits){const F=MS.map(()=>new Map());const add=(mi,i,u,amt)=>{let v=F[mi].get(i);if(!v)F[mi].set(i,v=[0,0,0]);const p=v[0]*u[0]+v[1]*u[1]+v[2]*u[2];if(p<amt){const k=amt-p;v[0]+=u[0]*k;v[1]+=u[1]*k;v[2]+=u[2]*k;}};
  for(const h of hits)for(let c=0;c<3;c++){const i=MS[h.mi].F[h.tri+c];for(const [mj,j,d] of nearC(h.mi,i)){const f=(1-d/RAD)**2*(3-2*0)/1;add(mj,j,h.u,h.amt*Math.min(1,f*1.0+(d<0.006?1:0)));}}return F;}
function addPush(F,W,clip,t,scale){const SM=skinMat(W);for(let mi=0;mi<MS.length;mi++){const m=MS[mi];for(const [i,v] of F[mi]){const M3=[0,0,0,0,0,0,0,0,0];
  for(let j=0;j<4;j++){const w=m.W[i*4+j];if(!(w>0))continue;const s=SM[m.J[i*4+j]];M3[0]+=w*s[0];M3[1]+=w*s[4];M3[2]+=w*s[8];M3[3]+=w*s[1];M3[4]+=w*s[5];M3[5]+=w*s[9];M3[6]+=w*s[2];M3[7]+=w*s[6];M3[8]+=w*s[10];}
  const I=inv3(M3),db=[I[0]*v[0]+I[1]*v[1]+I[2]*v[2],I[3]*v[0]+I[4]*v[1]+I[5]*v[2],I[6]*v[0]+I[7]*v[1]+I[8]*v[2]];
  for(const [k,u] of tents(clip,t)){const tg=ensure(clip,k);const D=tg.D[mi];const f=u/scale;D[i*3]+=db[0]*f;D[i*3+1]+=db[1]*f;D[i*3+2]+=db[2]*f;}}}}
const sampleTimes=clip=>{const d=R.clips[clip].duration,s=new Set();for(let t=0;t<=d+1e-9;t+=1/120)s.add(+Math.min(t,d).toFixed(6));for(const m of [60,30,'uneven'])for(const t of H.times(d,m,clip.length*31+7))s.add(+t.toFixed(6));return [...s].sort((x,y)=>x-y);};
const log=[];let it=0;
for(;it<ITERS;it++){let total=0,maxD=0;const per={};
  for(const clip of CLIPS){for(const t of sampleTimes(clip)){H.applyClip(R,clip,t);const W=H.world(R),mw=weights(clip,t);const hs=hitList(W,mw);if(!hs.length)continue;total+=hs.length;per[clip]=(per[clip]||0)+hs.length;for(const h of hs)maxD=Math.max(maxD,h.depth);
    addPush(field(hs),W,clip,t,4);}}
  log.push({it,total,maxCm:+(maxD*100).toFixed(3),per,targets:Object.keys(T).length});console.error(JSON.stringify(log[log.length-1]));if(!total)break;}
function writeOut(OUTP){const meta=JSON.parse(fs.readFileSync(path.join(path.dirname(IN),'anim_meta.json'),'utf8'));const tg=[];let nnz=0;
for(const n of Object.keys(T).sort()){const x=T[n];for(let mi=0;mi<MS.length;mi++){const D=x.D[mi],idx=[],val=[];for(let i=0;i<MS[mi].nv;i++){const m=Math.hypot(D[i*3],D[i*3+1],D[i*3+2]);if(m>5e-5){idx.push(i);val.push(D[i*3],D[i*3+1],D[i*3+2]);}}
  if(!idx.length)continue;nnz+=idx.length;tg.push({mesh:MESH[mi],name:n,idx:Uint16Array.from(idx),vals:Float32Array.from(val)});}
  const dur=R.clips[x.clip].duration;const pts=[[Math.max(0,x.t-DT),0],[x.t,1],[Math.min(dur,x.t+DT),0]].filter((p,i,arr)=>i===0||p[0]>arr[i-1][0]+1e-9);meta.clips[x.clip].morph.curves[n]=pts.map(p=>[+p[0].toFixed(6),p[1]]);}
const buf=GW.rewrite(R.buf,[],[],tg);const J=H.parseGlb(buf).json;for(const k of MESH){const m=J.meshes.find(z=>z.name===k);const map=meta.morph.meshes[k].targets;(m.extras.targetNames).forEach((n,i)=>{if(map[n]===undefined)map[n]=i;else if(map[n]!==i)throw Error('index clash '+n);});}
fs.mkdirSync(path.dirname(OUTP),{recursive:true});fs.writeFileSync(OUTP,buf);fs.writeFileSync(path.join(path.dirname(OUTP),'anim_meta.json'),JSON.stringify(meta,null,1)+'\n');return {nnz,bytes:buf.length};}
/* runtime pass: the real CharacterMotion crossfades of the ride scenario (sit_hold -> stand_up etc.): hits in frames that involve a
 * seated clip are pushed into that clip's keys, scaled by its crossfade weight. */
const RT=require('./runtime_eval.cjs');const SEATK=new Set(CLIPS);let rtLog=[];
for(let rp=0;rp<+arg('--rt',6);rp++){const tmp='/tmp/ss/rt_'+process.pid+'/c.glb';writeOut(tmp);let n=0;
  for(const mode of [60,30,'uneven'])RT.run(tmp,mode,{scenarios:['ride'],penetration:true,onFrame:(row,R2,mw)=>{if(!row.pen||!row.pen.count)return;
    let clip=null,t=0,w=0;if(SEATK.has(row.clip)){clip=row.clip;t=row.time;w=row.out?1-row.fade:1;}if(row.out&&SEATK.has(row.out)&&row.fade>w){clip=row.out;t=row.outTime;w=row.fade;}if(!clip||w<0.02){console.error('unattributed rt hit',row.T,row.clip,row.out);return;}
    R2.nodes.forEach((nd,i)=>{R.nodes[i].p=nd.p.slice();R.nodes[i].q=nd.q.slice();R.nodes[i].s=nd.s.slice();});const W=H.world(R);const hs=hitList(W,mw);n+=hs.length;if(hs.length)addPush(field(hs),W,clip,t,2*w);}});
  rtLog.push({rp,hits:n});console.error('rt',rp,n);if(!n)break;
  // re-verify clips after runtime pushes
  for(let k=0;k<10;k++){let tot=0;for(const clip of CLIPS)for(const t of sampleTimes(clip)){H.applyClip(R,clip,t);const W=H.world(R),mw=weights(clip,t);const hs=hitList(W,mw);if(!hs.length)continue;tot+=hs.length;addPush(field(hs),W,clip,t,4);}console.error('clip recheck',tot);if(!tot)break;}}
const res=writeOut(OUT);console.log(JSON.stringify({out:OUT,iters:it,last:log[log.length-1],rt:rtLog,targets:Object.keys(T).length,sparse:res.nnz,bytes:res.bytes}));
