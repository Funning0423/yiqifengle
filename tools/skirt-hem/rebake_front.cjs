'use strict';
/** Front-hem re-bake v2 (b21 run 4, Grok Bot option A + option-B helper).  Input = the 773c061e character GLB (--in, required:
 *  `git show 773c061e:<glb> > base.glb`).  Rig: hem_lib.splitFront (lower front panel split at the centre seam, the thigh.R side
 *  moves to skirt.front.low.mid; bind/rest mesh unchanged).  No new joints.
 *  Why v2: v1 pitched the front panel about the hips' lateral axis only.  In her walk the hips roll ~6 deg, so the rigid front
 *  panel hung sideways off the forward knee and its bell stood 30-35 cm in front of the knees.  v2 adds the roll back toward
 *  gravity (RZ) and the upper panel (F), per 30 fps key:
 *    A skirt.front pitch, RZ skirt.front roll about her forward axis, F skirt.front.mid pitch, B1 skirt.front.low pitch,
 *    B2 = B1 + skirt.front.low.mid pitch   (deg; + pitch = hem forward/up)
 *  Objective (evolution strategy, seeded from the previous key): penetration depth of every leg/knee/shoe vertex through the
 *  front cloth with a 6 mm margin (limb-segment test) and pass-through hits (hem_lib.axisHits), the gate targets with headroom
 *  (lift <= 2.8 cm, apron <= 2.8, >= 4.7 cm below the knee, single vertex <= 4.8 cm, flare <= 26.5 cm), forward flare, a pull
 *  toward rest and toward the previous key.  A key is accepted only with zero hits; then every quarter key is re-verified
 *  (margin 0, all limits) and failing neighbours are re-solved with a wider margin.  Pass 2 (v1): pre-existing back/side panel
 *  pokes get the smallest outward pitch/roll of that panel.
 *  stand_up (seated): keys with the thigh within 34 deg of vertical are solved, 34-42 deg blend from the authored seated drape;
 *  pass 2 also clears the seated thigh / back-panel contact.  sit_down / sit_hold stay as authored.
 *  Modes:  --solve --in base.glb --clips a,b --curves out.json      (parallelisable)
 *          --assemble --in base.glb --curves c1.json,c2.json --out new.glb [--report r.json] */
const fs=require('fs'),H=require('./hem_lib.cjs'),GW=require('./glb_write.cjs');
const args=process.argv.slice(2),arg=(n,d)=>args.includes(n)?args[args.indexOf(n)+1]:d;
const IN=arg('--in');if(!IN)throw Error('--in <773c061e base glb> is required');
const FPS=30,MARGIN=0.006,TGT={lift:0.028,apron:0.028,bk:0.047,vert:0.048,flare:0.265};
const R=H.load(IN);const SPLIT=H.splitFront(R);const S=H.sets(R),M=H.loadMeta();
const id=n=>R.byName[n];const iF=id('skirt.front'),iFm=id('skirt.front.mid'),iL=id('skirt.front.low'),iM=id('skirt.front.low.mid');
const NX=[-1,0,0],NZ=[0,0,1],aa=(ax,deg)=>{const h=deg*Math.PI/360,s=Math.sin(h);return [ax[0]*s,ax[1]*s,ax[2]*s,Math.cos(h)];};const rq=i=>R.rest[i].q;
function slerp(a,b,u){let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];const s=d<0?-1:1;d=Math.abs(d);let k0=1-u,k1=u;if(d<.9995){const th=Math.acos(d),sn=Math.sin(th);k0=Math.sin((1-u)*th)/sn;k1=Math.sin(u*th)/sn;}const r=[0,1,2,3].map(j=>a[j]*k0+s*b[j]*k1),l=Math.hypot(...r);return r.map(x=>x/l);}
const K=['A','RZ','F','B1','B2'],LO={A:-10,RZ:-16,F:-15,B1:-45,B2:-45},HI={A:30,RZ:16,F:35,B1:40,B2:40};
const clampP=p=>{const o={};for(const k of K)o[k]=Math.min(HI[k],Math.max(LO[k],p[k]));return o;};
const REST_P={A:0,RZ:0,F:0,B1:0,B2:0};
const ovOf=p=>({[iF]:H.qmul(H.qmul(aa(NZ,p.RZ),aa(NX,p.A)),rq(iF)),[iFm]:H.qmul(aa(NX,p.F),rq(iFm)),[iL]:H.qmul(aa(NX,p.B1),rq(iL)),[iM]:H.qmul(aa(NX,p.B2-p.B1),rq(iM))});
function sub(mesh,jset){const vs=new Set(),tris=[];for(let t=0;t<mesh.F.length;t+=3){let f=false;for(let k=0;k<3;k++){const i=mesh.F[t+k];for(let j=0;j<4;j++)if(mesh.W[i*4+j]>0&&jset.has(mesh.J[i*4+j]))f=true;}
    if(f){tris.push(mesh.F[t],mesh.F[t+1],mesh.F[t+2]);for(let k=0;k<3;k++)vs.add(mesh.F[t+k]);}}const ids=[...vs],loc=new Map(ids.map((v,k)=>[v,k]));return {mesh,ids,F:Int32Array.from(tris.map(v=>loc.get(v)))};}
const jk=re=>new Set(R.joints.map((j,k)=>re.test(R.nodes[j].name)?k:-1).filter(k=>k>=0));
const DR=R.meshes.LOD0_G2_DRESS,AP=R.meshes.LOD0_G2_APRON;
const FRONT=[sub(DR,jk(/^skirt\.front/)),sub(AP,jk(/^skirt\.front/))],ALL=[sub(DR,jk(/./)),sub(AP,jk(/./))];
/** cloth sub-meshes vs legs: {n hits, d summed depth (m), by cloth bone}.  margin pushes each leg vertex outward. */
function hits(subs,W,mw,margin,axis){const legP=H.skinMesh(R,W,R.meshes.LOD0_G2_BODY,mw,S.legs),segs=H._limbSegs(R,S,W);let n=0,d=0;const by={};const skinned=[];
  for(const sb of subs){const P=H.skinMesh(R,W,sb.mesh,mw,sb.ids);skinned.push([sb.mesh.name,sb.mesh,P,sb.F]);let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let q=0;q<P.length;q+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],P[q+k]);hi[k]=Math.max(hi[k],P[q+k]);}
    const grid=H._triGrid(P,sb.F);
    for(let q=0;q<S.legs.length;q++){const o=[legP[q*3],legP[q*3+1],legP[q*3+2]];if(o[0]<lo[0]-.1||o[0]>hi[0]+.1||o[1]<lo[1]-.1||o[1]>hi[1]+.1||o[2]<lo[2]-.1||o[2]>hi[2]+.1)continue;
      const sg=segs[S.legBone[q]],e=H._closestOnSeg(o,sg[0],sg[1]);const dv=[o[0]-e[0],o[1]-e[1],o[2]-e[2]],l=Math.hypot(...dv)||1;const o2=[o[0]+dv[0]/l*margin,o[1]+dv[1]/l*margin,o[2]+dv[2]/l*margin];
      const h=H._segHit(grid,o2,e);if(h>0){n++;d+=Math.max(0.001,l+margin-h);const t=grid.lastTri,mm=sb.mesh;const acc={};for(let k=0;k<3;k++){const vi=sb.ids[sb.F[t+k]];for(let j=0;j<4;j++){const w=mm.W[vi*4+j];if(w>0){const nm=R.nodes[R.joints[mm.J[vi*4+j]]].name;acc[nm]=(acc[nm]||0)+w;}}}
        const b=Object.entries(acc).sort((a,c)=>c[1]-a[1])[0][0];by[b]=(by[b]||0)+1;}}}
  if(axis&&H.thighFromVertical(R,W)<=30){const a=H.axisHits(R,S,mw,W,legP,skinned);if(a.n){n+=a.n;d+=a.n*0.01;by.axis=a.n;}}return {n,d,by};}
/** pose = authored clip at t, then rotation overrides {node: quat} */
function pose(clip,t,ov){H.applyClip(R,clip,t);for(const k in ov)R.nodes[k].q=ov[k];return H.world(R);}
const vals=m=>({lift:m.dress.lift,apron:m.apron.lift,bk:m.dress.belowKnee,flare:Math.max(m.dress.flare,m.apron.flare),vert:Math.max(m.dress.maxVertLift,m.apron.maxVertLift)});
const over=v=>Math.max(0,v.lift-TGT.lift)+Math.max(0,v.apron-TGT.apron)+Math.max(0,TGT.bk-v.bk)+Math.max(0,v.vert-TGT.vert)+Math.max(0,v.flare-TGT.flare);
function score(clip,t,p,mw,margin,prev){const W=pose(clip,t,ovOf(p));const h=hits(FRONT,W,mw,margin,true);const v=vals(H.hemMetrics(R,S,mw));
  let c=300*h.d+100*over(v)+v.flare+0.0002*K.reduce((s,k)=>s+Math.abs(p[k]),0);if(prev)c+=0.0015*K.reduce((s,k)=>s+Math.abs(p[k]-prev[k]),0);return {c,n:h.n,v};}
function lcgR(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
/** (1+1)-ES with per-run step adaptation; returns the best zero-hit point if any (else the best point) */
function es(clip,t,p0,mw,margin,prev,iters,rng,sig0=6){const g=()=>{let u=rng()||1e-9,v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  let p=clampP(p0),cur=score(clip,t,p,mw,margin,prev),sig=sig0,evals=1;let bestOk=cur.n===0?{p,s:cur}:null;
  for(let it=0;it<iters;it++){const q={};for(const k of K)q[k]=p[k]+(rng()<0.6?g()*sig:0);const qc=clampP(q),r=score(clip,t,qc,mw,margin,prev);evals++;
    if(r.c<cur.c){p=qc;cur=r;sig=Math.min(12,sig*1.2);if(r.n===0&&(!bestOk||r.c<bestOk.s.c))bestOk={p:qc,s:r};}else sig=Math.max(0.15,sig*0.97);}
  return {best:bestOk||{p,s:cur},ok:!!bestOk,evals};}
const SEATED=new Set(['sit_down','sit_hold','stand_up']);
function solveClip(clip){const C=R.clips[clip],dur=C.duration,n=Math.round(dur*FPS),loop=!!(M.clips[clip]&&M.clips[clip].loop);const ts=[];for(let k=0;k<=n;k++)ts.push(Math.min(k/FPS,dur));const t0=Date.now();
  const mw=ts.map(t=>H.clipMorph(M,clip,t)),mwAt=t=>H.clipMorph(M,clip,t);const rng=lcgR(clip.length*977+31);
  const auth=ts.map(t=>{H.applyClip(R,clip,t);const o={};for(const i of [iF,iFm,iL,iM])o[i]=R.nodes[i].q.slice();return o;});
  const thigh=ts.map(t=>{H.applyClip(R,clip,t);return H.thighFromVertical(R,H.world(R));});
  let blend;if(clip==='stand_up')blend=thigh.map(d=>d<=34?1:d>=42?0:(42-d)/8);
  else if(SEATED.has(clip))blend=ts.map(()=>0);
  else{const meets=k=>{const W=pose(clip,ts[k],auth[k]);if(hits(FRONT,W,mw[k],0,true).n)return false;const v=vals(H.hemMetrics(R,S,mw[k]));return over(v)===0;};blend=ts.every((t,k)=>meets(k))?ts.map(()=>0):ts.map(()=>1);}
  const P=ts.map(()=>null),margin=ts.map(()=>MARGIN);let unsolved=0,evals=0;
  const solveKey=(k,seeds,iters)=>{const prev=k>0&&P[k-1]?P[k-1]:null;let best=null;
    for(const s of seeds.filter(Boolean)){const r=es(clip,ts[k],s,mw[k],margin[k],prev,iters,rng,s===REST_P?6:2);evals+=r.evals;if(r.ok&&(!best||r.best.s.c<best.s.c))best=r.best;}
    if(!best){for(const sd of [REST_P,{A:12,RZ:6,F:10,B1:-10,B2:10},{A:18,RZ:-6,F:10,B1:-20,B2:0}]){const r=es(clip,ts[k],sd,mw[k],margin[k],prev,900,rng,6);evals+=r.evals;if(r.ok&&(!best||r.best.s.c<best.s.c))best=r.best;}}
    if(!best){unsolved++;return false;}P[k]=best.p;P[k].v=best.s.v;return true;};
  let first=true;for(let k=0;k<=n;k++){if(blend[k]<=0)continue;if(first){solveKey(k,[REST_P,{A:12,RZ:6,F:10,B1:-10,B2:10},{A:12,RZ:-6,F:10,B1:10,B2:-10}],900);first=false;}
    else if(!solveKey(k,[P[k-1]],260))solveKey(k,[P[k-1],k>1&&P[k-2]],700);
    if(!P[k])P[k]=k>0&&P[k-1]?{...P[k-1]}:{...REST_P};if(process.env.RB_LOG)console.error(clip,k,ts[k].toFixed(3),P[k].v&&JSON.stringify(Object.fromEntries(Object.entries(P[k].v).map(([a,b])=>[a,+(b*100).toFixed(1)]))));}
  if(loop&&blend[0]>0)P[n]={...P[0]};
  const ovK=k=>{if(blend[k]<=0||!P[k])return auth[k];const nw=ovOf(P[k]);if(blend[k]>=1)return nw;const o={};for(const i in nw)o[i]=slerp(auth[k][i],nw[i],blend[k]);return o;};
  const lerpOv=(a,b,u)=>{const o={};for(const i in a)o[i]=slerp(a[i],b[i],u);return o;};
  const limitsOk=(W,mwx)=>{const d=H.thighFromVertical(R,W);if(SEATED.has(clip)&&d>30)return true;const v=vals(H.hemMetrics(R,S,mwx));return v.lift<=0.03&&v.apron<=0.03&&v.bk>=0.045&&v.flare<=0.28&&v.vert<=0.05;};
  let fixes=0,left=0;for(let pass=0;pass<8;pass++){let bad=0;
    for(let k=0;k<=n;k++){const act=blend[k]>0||(k<n&&blend[k+1]>0);if(!act)continue;
      const W=pose(clip,ts[k],ovK(k));if(hits(FRONT,W,mw[k],0,true).n||!limitsOk(W,mw[k])){bad++;fixes++;if(blend[k]>0&&blend[k]<1)blend[k]=1;else if(blend[k]>=1){margin[k]+=0.004;solveKey(k,[P[k],k>0&&P[k-1]],500);}}
      if(k<n)for(const u of [0.25,0.5,0.75]){const tm=ts[k]+(ts[k+1]-ts[k])*u,Wm=pose(clip,tm,lerpOv(ovK(k),ovK(k+1),u)),mwm=mwAt(tm);
        if(hits(FRONT,Wm,mwm,0,true).n||!limitsOk(Wm,mwm)){bad++;fixes++;for(const j of [k,k+1]){if(blend[j]<=0)continue;if(blend[j]<1){blend[j]=1;continue;}margin[j]+=0.004;solveKey(j,[P[j],j>0&&P[j-1],j<n&&P[j+1]],500);}break;}}}
    if(loop&&blend[0]>0)P[n]={...P[0]};left=bad;if(!bad)break;}
  // pass 2 (v1): other panels, smallest outward pitch/roll, full cloth check (pass-through too while standing)
  const OTHER=['skirt.back','skirt.back.low','skirt.left','skirt.left.low','skirt.right','skirt.right.low'];const allowOther=!SEATED.has(clip)||clip==='stand_up';
  const extra={};for(const b of OTHER)extra[id(b)]=ts.map(()=>({x:0,z:0}));
  const ovFull=k=>{const o=Object.assign({},ovK(k));for(const b of OTHER){const i=id(b),d=extra[i][k];if(d.x||d.z){H.applyClip(R,clip,ts[k]);o[i]=H.qmul(H.qmul(aa(NZ,d.z),aa(NX,d.x)),R.nodes[i].q);}}return o;};
  const ovMid=(k,tm,u)=>{const a=ovFull(k),b=ovFull(k+1),o={};H.applyClip(R,clip,tm);const keys=new Set([...Object.keys(a),...Object.keys(b)]);for(const i of keys){o[i]=slerp(a[i]||R.nodes[i].q,b[i]||R.nodes[i].q,u);}return o;};
  let pfix=0;const fixFrame=(k,res)=>{const ent=Object.entries(res.by).filter(([b])=>OTHER.includes(b)).sort((a,b)=>b[1]-a[1]);if(!ent.length)return false;const i=id(ent[0][0]);let bestD=null,bestN=res.n;
    for(const [ax,s] of [['x',1],['x',-1],['z',1],['z',-1]]){const d=extra[i][k];d[ax]+=s*2;const r=hits(ALL,pose(clip,ts[k],ovFull(k)),mw[k],0.002,true);d[ax]-=s*2;if(r.n<bestN){bestN=r.n;bestD=[ax,s];}}
    if(!bestD){extra[i][k].x+=2;return true;}extra[i][k][bestD[0]]+=bestD[1]*2;pfix++;return true;};
  let otherLeft=0;for(let pass=0;pass<(allowOther?30:0);pass++){let bad=0;
    for(let k=0;k<=n;k++){const r=hits(ALL,pose(clip,ts[k],ovFull(k)),mw[k],0,true);if(r.n){bad++;fixFrame(k,hits(ALL,pose(clip,ts[k],ovFull(k)),mw[k],0.002,true));}
      if(k<n)for(const u of [0.5]){const tm=ts[k]+(ts[k+1]-ts[k])*u;const r2=hits(ALL,pose(clip,tm,ovMid(k,tm,u)),mwAt(tm),0,true);if(r2.n){bad++;const r3=hits(ALL,pose(clip,tm,ovMid(k,tm,u)),mwAt(tm),0.002,true);fixFrame(k,r3);fixFrame(k+1,r3);}}}
    if(loop)for(const b of OTHER){const i=id(b);extra[i][n]={...extra[i][0]};}otherLeft=bad;if(!bad)break;}
  const solvedAny=blend.some(b=>b>0);const touchedOther=OTHER.map(id).filter(i=>extra[i].some(d=>d.x||d.z));const nodes=[...(solvedAny?[iF,iFm,iL,iM]:[]),...touchedOther];
  const qs={};for(const i of nodes)qs[R.nodes[i].name]=[];for(let k=0;k<=n;k++){const o=ovFull(k);H.applyClip(R,clip,ts[k]);for(const i of nodes)qs[R.nodes[i].name].push(...(o[i]||R.nodes[i].q));}
  return {clip,ts,loop,qs,P:P.map(p=>p&&Object.fromEntries(K.map(k=>[k,+p[k].toFixed(3)]))),blend,unsolved,fixes,left,pfix,otherLeft,evals,
    extra:Object.fromEntries(OTHER.map(b=>[b,extra[id(b)].map(d=>[d.x,d.z])]).filter(([,v])=>v.some(d=>d[0]||d[1]))),seconds:(Date.now()-t0)/1000};}
if(args.includes('--solve')){const out=arg('--curves');const res=[];for(const c of arg('--clips').split(',')){const r=solveClip(c);res.push(r);fs.writeFileSync(out,JSON.stringify(res));
    const rg=k=>{const v=r.P.filter(Boolean).map(p=>p[k]);return v.length?[Math.min(...v),Math.max(...v)].map(x=>+x.toFixed(1)):null;};
    console.log(c.padEnd(22),JSON.stringify({s:r.seconds,unsolved:r.unsolved,fixes:r.fixes,left:r.left,pfix:r.pfix,otherLeft:r.otherLeft,evals:r.evals,ranges:Object.fromEntries(K.map(k=>[k,rg(k)])),extra:Object.keys(r.extra)}));}}
if(args.includes('--assemble')){const res=arg('--curves').split(',').flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8')));const edits=[];
  for(const r of res)for(const [name,v] of Object.entries(r.qs))edits.push({anim:r.clip,node:id(name),path:'rotation',times:r.ts,values:v});
  const attrs=[];for(const [mesh,v] of Object.entries(SPLIT))attrs.push({mesh,attr:'JOINTS_0',data:v.J},{mesh,attr:'WEIGHTS_0',data:v.W});
  const out=GW.rewrite(R.buf,edits,attrs);fs.writeFileSync(arg('--out'),out);
  const rep={in:IN,bytes:{in:R.buf.length,out:out.length},split:Object.fromEntries(Object.entries(SPLIT).map(([k,v])=>[k,v.moved])),targets:TGT,margin:MARGIN,fps:FPS,
    clips:res.map(r=>({clip:r.clip,unsolved:r.unsolved,fixes:r.fixes,left:r.left,pfix:r.pfix,otherLeft:r.otherLeft,seconds:r.seconds,touched:Object.keys(r.qs),P:r.P,blend:r.blend,extra:r.extra}))};
  if(arg('--report'))fs.writeFileSync(arg('--report'),JSON.stringify(rep));console.log('wrote',arg('--out'),R.buf.length,'->',out.length);}
module.exports={solveClip,R,S,M,ovOf,pose,hits,vals,FRONT,REST_P};
