'use strict';
/** Front-hem re-bake (b21, Grok Bot option A + option-B helper).  Re-solves the front skirt curves of every clip in her GLB.
 *  Rig change (option B helper, bind pose unchanged): the lower front panel is split at the centre seam - her left half moves to
 *  skirt.front.low.mid (child of skirt.front.low, identity in every authored clip), see hem_lib.splitFront.
 *  Per 30 fps clip frame (every other joint exactly as authored) three pitches are solved:
 *    A  skirt.front      about the hips' lateral axis (+ = hem forward/up), cap FRONT_CAP.A
 *    B1 skirt.front.low  (her right half), B2 = B1 + skirt.front.low.mid (her left half); negative = drapes back toward the legs
 *  minimising the front-hem lift (drape/gravity term: lowest hem point, apron hem, single-vertex lift, flare) subject to NO
 *  leg/knee/shoe vertex crossing the dress or apron with a 6 mm margin (hem_lib limb-segment test).  No envelope floor: light
 *  smoothing (sigma 1 frame) then every frame AND every half frame is re-verified and bumped until clear.
 *  Seated clips (sit_down, sit_hold, stand_up) keep the authored seated drape unchanged.
 *  A second pass clears pre-existing leg pokes of the back/side panels (seat contact, back-swing shin) with the smallest
 *  outward pitch/roll of that panel (same verification).
 *  Modes:  --solve --clips a,b --curves out.json      (parallelisable)
 *          --assemble --curves c1.json,c2.json --out new.glb [--report r.json] */
const fs=require('fs'),H=require('./hem_lib.cjs'),GW=require('./glb_write.cjs');
const args=process.argv.slice(2),arg=(n,d)=>args.includes(n)?args[args.indexOf(n)+1]:d;
const IN=arg('--in',H.GLB);
const FRONT_CAP={A:24,B:36},B_MIN=-24,MARGIN=0.006,FPS=30,SEATED=new Set(['sit_down','sit_hold','stand_up']);
const R=H.load(IN);const SPLIT=H.splitFront(R);const S=H.sets(R),M=H.loadMeta();
const id=n=>R.byName[n];const iF=id('skirt.front'),iL=id('skirt.front.low'),iM=id('skirt.front.low.mid');
const aa=(ax,deg)=>{const h=deg*Math.PI/360,s=Math.sin(h);return [ax[0]*s,ax[1]*s,ax[2]*s,Math.cos(h)];};const NX=[-1,0,0],NZ=[0,0,1];
const rq=i=>R.rest[i].q;
function slerp(a,b,u){let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];const s=d<0?-1:1;d=Math.abs(d);let k0=1-u,k1=u;if(d<.9995){const th=Math.acos(d),sn=Math.sin(th);k0=Math.sin((1-u)*th)/sn;k1=Math.sin(u*th)/sn;}const r=[0,1,2,3].map(j=>a[j]*k0+s*b[j]*k1),l=Math.hypot(...r);return r.map(x=>x/l);}
const frontQ=(A,B1,B2)=>[H.qmul(aa(NX,A),rq(iF)),H.qmul(aa(NX,B1),rq(iL)),H.qmul(aa(NX,B2-B1),rq(iM))];
/* cloth sub-meshes: triangles touching the given joint set */
function sub(mesh,jset){const vs=new Set(),tris=[];for(let t=0;t<mesh.F.length;t+=3){let f=false;for(let k=0;k<3;k++){const i=mesh.F[t+k];for(let j=0;j<4;j++)if(mesh.W[i*4+j]>0&&jset.has(mesh.J[i*4+j]))f=true;}
    if(f){tris.push(mesh.F[t],mesh.F[t+1],mesh.F[t+2]);for(let k=0;k<3;k++)vs.add(mesh.F[t+k]);}}const ids=[...vs],loc=new Map(ids.map((v,k)=>[v,k]));return {mesh,ids,F:Int32Array.from(tris.map(v=>loc.get(v)))};}
const jk=re=>new Set(R.joints.map((j,k)=>re.test(R.nodes[j].name)?k:-1).filter(k=>k>=0));
const DR=R.meshes.LOD0_G2_DRESS,AP=R.meshes.LOD0_G2_APRON;
const FRONT=[sub(DR,jk(/^skirt\.front/)),sub(AP,jk(/^skirt\.front/))],ALL=[sub(DR,jk(/./)),sub(AP,jk(/./))];
function hits(subs,W,mw,margin){const legP=H.skinMesh(R,W,R.meshes.LOD0_G2_BODY,mw,S.legs),segs=H._limbSegs(R,S,W);let n=0;const by={};
  for(const sb of subs){const P=H.skinMesh(R,W,sb.mesh,mw,sb.ids);let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let q=0;q<P.length;q+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],P[q+k]);hi[k]=Math.max(hi[k],P[q+k]);}
    const grid=H._triGrid(P,sb.F);
    for(let q=0;q<S.legs.length;q++){const o=[legP[q*3],legP[q*3+1],legP[q*3+2]];if(o[0]<lo[0]-.1||o[0]>hi[0]+.1||o[1]<lo[1]-.1||o[1]>hi[1]+.1||o[2]<lo[2]-.1||o[2]>hi[2]+.1)continue;
      const sg=segs[S.legBone[q]],e=H._closestOnSeg(o,sg[0],sg[1]);const d=[o[0]-e[0],o[1]-e[1],o[2]-e[2]],l=Math.hypot(...d)||1;const o2=[o[0]+d[0]/l*margin,o[1]+d[1]/l*margin,o[2]+d[2]/l*margin];
      if(H._segHit(grid,o2,e)>0){n++;const t=grid.lastTri,mm=sb.mesh;const acc={};for(let k=0;k<3;k++){const vi=sb.ids[sb.F[t+k]];for(let j=0;j<4;j++){const w=mm.W[vi*4+j];if(w>0){const nm=R.nodes[R.joints[mm.J[vi*4+j]]].name;acc[nm]=(acc[nm]||0)+w;}}}
        const b=Object.entries(acc).sort((a,c)=>c[1]-a[1])[0][0];by[b]=(by[b]||0)+1;}}}return {n,by};}
/** pose = authored clip at t, then overrides {nodeIndex: quat}. */
function pose(clip,t,ov){H.applyClip(R,clip,t);for(const k in ov)R.nodes[k].q=ov[k];return H.world(R);}
function metrics(clip,t,ov,mw){pose(clip,t,ov);return H.hemMetrics(R,S,mw);}
const J=m=>Math.max(0,m.dress.lift-0.025)*10+Math.max(0,m.apron.lift-0.025)*10+Math.max(0,Math.max(m.dress.maxVertLift,m.apron.maxVertLift)-0.045)*5+Math.max(0,Math.max(m.dress.flare,m.apron.flare)-0.27)*5+Math.max(0,0.05-m.dress.belowKnee)*10+(Math.max(0,m.dress.lift)+Math.max(0,m.apron.lift))*0.5;
const ovOf=(A,B1,B2)=>{const q=frontQ(A,B1,B2);return {[iF]:q[0],[iL]:q[1],[iM]:q[2]};};
function okFront(clip,t,ov,mw){return hits(FRONT,pose(clip,t,ov),mw,MARGIN).n===0;}
function solveFrame(clip,t,mw){let best=null;const capA=SEATED.has(clip)?50:FRONT_CAP.A;
  for(let A=0;A<=capA;A+=2){// minimal feasible B for each half: scan B upward with the other half parked forward (B=cap)
    const minB=which=>{for(let B=B_MIN;B<=FRONT_CAP.B;B+=3){const ov=which===1?ovOf(A,B,FRONT_CAP.B):ovOf(A,FRONT_CAP.B,B);if(okFront(clip,t,ov,mw))return B;}return null;};
    const b1=minB(1);if(b1===null)continue;const b2=minB(2);if(b2===null)continue;
    for(let B1=b1;B1<=Math.min(FRONT_CAP.B,b1+24);B1+=3)for(let B2=b2;B2<=Math.min(FRONT_CAP.B,b2+24);B2+=3){const m=metrics(clip,t,ovOf(A,B1,B2),mw);const j=J(m)+0.0003*(Math.abs(A)+Math.abs(B1)+Math.abs(B2));
      if(!best||j<best.j)best={A,B1,B2,j};}}
  if(!best)return {A:FRONT_CAP.A,B1:FRONT_CAP.B,B2:FRONT_CAP.B,ok:false};
  // the half minima were found with the other half parked: confirm jointly, bump both lowers if needed
  for(let k=0;k<12&&!okFront(clip,t,ovOf(best.A,best.B1,best.B2),mw);k++){best.B1=Math.min(FRONT_CAP.B,best.B1+2);best.B2=Math.min(FRONT_CAP.B,best.B2+2);}
  return {A:best.A,B1:best.B1,B2:best.B2,ok:true};}
function gauss(x,sig,periodic){const n=x.length,o=new Array(n);for(let i=0;i<n;i++){let s=0,w=0;for(let k=-3;k<=3;k++){let j=i+k;if(periodic)j=(j+n-1)%(n-1);else if(j<0||j>=n)continue;const g=Math.exp(-0.5*(k/sig)**2);s+=g*x[j];w+=g;}o[i]=s/w;}return o;}
const OTHER=['skirt.back','skirt.back.low','skirt.left','skirt.left.low','skirt.right','skirt.right.low'];
function solveClip(clip){const C=R.clips[clip],dur=C.duration,n=Math.round(dur*FPS),loop=!!(M.clips[clip]&&M.clips[clip].loop);const ts=[];for(let k=0;k<=n;k++)ts.push(Math.min(k/FPS,dur));
  const mw=ts.map(t=>H.clipMorph(M,clip,t)),mwAt=t=>H.clipMorph(M,clip,t);
  const old=ts.map(t=>{H.applyClip(R,clip,t);const o={};for(const i of [iF,iL,iM])o[i]=R.nodes[i].q.slice();return o;});
  // which frames are re-solved: non-seated clips -> every frame unless the authored clip already meets every target (then the
  // clip is kept byte-identical in pose); seated clips -> only frames with the thigh within 32 deg of vertical (the gate's checked
  // range) ... seated clips are left as authored.
  const meetsAll=k=>{const m=metrics(clip,ts[k],{},mw[k]);return m.dress.lift<=0.025&&m.apron.lift<=0.025&&Math.max(m.dress.maxVertLift,m.apron.maxVertLift)<=0.045&&Math.max(m.dress.flare,m.apron.flare)<=0.27&&m.dress.belowKnee>=0.05&&hits(FRONT,pose(clip,ts[k],{}),mw[k],0).n===0;};
  let blend;if(!SEATED.has(clip)){const keep=ts.every((t,k)=>meetsAll(k));blend=ts.map(()=>keep?0:1);}
  else blend=ts.map(()=>0);// seated clips keep the authored seated drape (task 03 morph + skirt pose); a partial re-solve made the lap pokes worse (try3)
  const t0=Date.now();let A=ts.map(()=>0),B1=ts.map(()=>0),B2=ts.map(()=>0),unsolved=0;
  for(let k=0;k<ts.length;k++){if(blend[k]<=0)continue;const r=solveFrame(clip,ts[k],mw[k]);A[k]=r.A;B1[k]=r.B1;B2[k]=r.B2;if(!r.ok)unsolved++;}
  const raw={A:A.slice(),B1:B1.slice(),B2:B2.slice()};
  // smoothing only inside solved runs
  const sm=x=>{const g=gauss(x,1,loop);return x.map((v,k)=>blend[k]>0?g[k]:v);};A=sm(A);B1=sm(B1);B2=sm(B2);
  if(loop){A[n]=A[0];B1[n]=B1[0];B2[n]=B2[0];}
  const ovK=k=>{if(blend[k]<=0)return old[k];const nw=ovOf(A[k],B1[k],B2[k]);if(blend[k]>=1)return nw;const o={};for(const i of [iF,iL,iM])o[i]=slerp(old[k][i],nw[i],blend[k]);return o;};
  const mid=(a,b)=>{const o={};for(const i in a)o[i]=slerp(a[i],b[i],.5);return o;};
  const bump=k=>{if(blend[k]<1)return;if(B1[k]<FRONT_CAP.B||B2[k]<FRONT_CAP.B){B1[k]=Math.min(FRONT_CAP.B,B1[k]+1);B2[k]=Math.min(FRONT_CAP.B,B2[k]+1);}else A[k]=Math.min(FRONT_CAP.A,A[k]+1);if(loop&&(k===0||k===n)){A[0]=A[n]=A[k];B1[0]=B1[n]=B1[k];B2[0]=B2[n]=B2[k];}};
  let bumps=0;for(let pass=0;pass<60;pass++){let bad=0;
    for(let k=0;k<ts.length;k++){if(blend[k]<=0&&(k===n||blend[k+1]<=0))continue;if(!okFront(clip,ts[k],ovK(k),mw[k])){if(blend[k]>=1){bad++;bumps++;bump(k);}}
      if(k<n){const tm=(ts[k]+ts[k+1])/2;if(!okFront(clip,tm,mid(ovK(k),ovK(k+1)),mwAt(tm))&&(blend[k]>=1||blend[k+1]>=1)){bad++;bumps++;bump(k);bump(k+1);}}}
    if(!bad)break;}
  // pass 2: other panels (pre-existing seat / back-swing pokes), smallest outward pitch/roll, full cloth check
  const extra={};for(const b of OTHER)extra[id(b)]=ts.map(()=>({x:0,z:0}));
  const ovFull=k=>{const o=Object.assign({},ovK(k));for(const b of OTHER){const i=id(b),d=extra[i][k];if(d.x||d.z){H.applyClip(R,clip,ts[k]);o[i]=H.qmul(H.qmul(aa(NZ,d.z),aa(NX,d.x)),R.nodes[i].q);}}return o;};
  const ovMid=(k,tm)=>{const a=ovFull(k),b=ovFull(k+1),o={};H.applyClip(R,clip,tm);const keys=new Set([...Object.keys(a),...Object.keys(b)]);for(const i of keys){const qa=a[i]||R.nodes[i].q,qb=b[i]||R.nodes[i].q;o[i]=slerp(qa,qb,.5);}return o;};
  let fixes=0;const fixFrame=(k,res)=>{// pick the most-hit non-front bone and step it
    const ent=Object.entries(res.by).filter(([b])=>OTHER.includes(b)).sort((a,b)=>b[1]-a[1]);if(!ent.length)return false;const i=id(ent[0][0]);let bestD=null,bestN=res.n;
    for(const [ax,s] of [['x',1],['x',-1],['z',1],['z',-1]]){const d=extra[i][k];d[ax]+=s*2;const r=hits(ALL,pose(clip,ts[k],ovFull(k)),mw[k],0.002);d[ax]-=s*2;if(r.n<bestN){bestN=r.n;bestD=[ax,s];}}
    if(!bestD){extra[i][k].x+=2;return true;}extra[i][k][bestD[0]]+=bestD[1]*2;fixes++;return true;};
  let otherLeft=0;for(let pass=0;pass<(SEATED.has(clip)?0:25);pass++){let bad=0;
    for(let k=0;k<ts.length;k++){const r=hits(ALL,pose(clip,ts[k],ovFull(k)),mw[k],0);if(r.n){bad++;fixFrame(k,hits(ALL,pose(clip,ts[k],ovFull(k)),mw[k],0.002));}
      if(k<n){const tm=(ts[k]+ts[k+1])/2;const r2=hits(ALL,pose(clip,tm,ovMid(k,tm)),mwAt(tm),0);if(r2.n){bad++;const r3=hits(ALL,pose(clip,tm,ovMid(k,tm)),mwAt(tm),0.002);fixFrame(k,r3);fixFrame(k+1,r3);}}}
    otherLeft=bad;if(!bad)break;}
  const qs={};const all=[iF,iL,iM,...OTHER.map(id)];for(const i of all)qs[i]=[];
  for(let k=0;k<ts.length;k++){const o=ovFull(k);H.applyClip(R,clip,ts[k]);for(const i of all)qs[i].push(...(o[i]||R.nodes[i].q));}
  const touched=all.filter(i=>i===iF||i===iL||i===iM||extra[i].some(d=>d.x||d.z));
  return {clip,ts,loop,touched,qs:Object.fromEntries(touched.map(i=>[R.nodes[i].name,qs[i]])),A,B1,B2,raw,blend,unsolved,bumps,fixes,otherLeft,
    extra:Object.fromEntries(OTHER.map(b=>[b,extra[id(b)].map(d=>[d.x,d.z])]).filter(([,v])=>v.some(d=>d[0]||d[1]))),seconds:(Date.now()-t0)/1000};}
if(args.includes('--solve')){const out=arg('--curves');const res=[];for(const c of arg('--clips').split(',')){const r=solveClip(c);res.push(r);
    console.log(c.padEnd(22),JSON.stringify({s:r.seconds,unsolved:r.unsolved,bumps:r.bumps,fixes:r.fixes,otherLeft:r.otherLeft,A:[Math.min(...r.A).toFixed(1),Math.max(...r.A).toFixed(1)],B1:[Math.min(...r.B1).toFixed(1),Math.max(...r.B1).toFixed(1)],B2:[Math.min(...r.B2).toFixed(1),Math.max(...r.B2).toFixed(1)],extra:Object.keys(r.extra)}));}
  fs.writeFileSync(out,JSON.stringify(res));}
if(args.includes('--assemble')){const res=arg('--curves').split(',').flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8')));const edits=[];
  for(const r of res)for(const [name,vals] of Object.entries(r.qs))edits.push({anim:r.clip,node:id(name),path:'rotation',times:r.ts,values:vals});
  const attrs=[];for(const [mesh,v] of Object.entries(SPLIT)){attrs.push({mesh,attr:'JOINTS_0',data:v.J},{mesh,attr:'WEIGHTS_0',data:v.W});}
  const out=GW.rewrite(R.buf,edits,attrs);fs.writeFileSync(arg('--out'),out);
  const rep={in:IN,bytes:{in:R.buf.length,out:out.length},split:Object.fromEntries(Object.entries(SPLIT).map(([k,v])=>[k,v.moved])),cap:FRONT_CAP,margin:MARGIN,clips:res.map(r=>({clip:r.clip,unsolved:r.unsolved,bumps:r.bumps,fixes:r.fixes,otherLeft:r.otherLeft,touched:Object.keys(r.qs),A:r.A,B1:r.B1,B2:r.B2,extra:r.extra}))};
  if(arg('--report'))fs.writeFileSync(arg('--report'),JSON.stringify(rep,null,1));console.log('wrote',arg('--out'),R.buf.length,'->',out.length);}
