'use strict';
// 运镜bot full9c: bakes the skycity walk lens rails (S1>S2, S2>S3, S3>S4, S4>S5, S4>S6; every planWalk run) on the REAL env_skycity.glb
// mesh (lens-scene.cjs, the lens-trajectory-clearance solid set) → SKY_RAILS in region/SkyFinaleRail.ts (SKY_JOINS kept).
// Per Lm/N (≤ 0.25 m) of her progress, candidate lens spots round her; hard reject: mesh < 0.75 m, ground below < 1.3 m, enclosed, her
// chest or face hidden by the mesh, her margin < 0.1 on any of the 7 screens (aim = chest). Viterbi for the smoothest path (≤ 0.45 m
// per step); S4>S6.s last run ends ON SKY_FINALE_POSE_LOCAL; run ends (the board joins meet them) keep ≥ 1.6 m of ground (travel rule). Smoothed, re-verified, stored as integer-mm text (SkyResumeLens.mmDecode); her path is planWalk's own (not stored).
const fs=require('fs'),path=require('path'),L=require('../journey-integration/clip3/lens-scene.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),SW=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),NW=H.load('region/NodeWalker.ts'),F=H.load('region/SkyFinaleShot.ts'),LS=H.load('region/LensSmooth.ts');
const M5=TS.TRANSITION_STAGING.skyMooring5a,W=p=>SW.skyLocalToWorld(M5,p),SOFT=/foliage_cards|flowers|robot_gardener|cloud|cumulus/;
const KEY_TOL=0.25,R={clr:0.75,gnd:1.3,stepM:0.45,ds:0.25,margin:0.1},WALKS=[['S1','S2'],['S2','S3'],['S3','S4'],['S4','S5'],['S4','S6']];
const MM64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const enc=a=>{let o='',p=0;for(const v of a){const n=Math.round(v*100)/* cm, read back as mmDecode ×10 */,d=n-p;p=n;let z=d<0?-2*d-1:2*d;while(z>=32){o+=MM64[32+(z&31)];z=Math.floor(z/32);}o+=MM64[z];}return o;};
(async()=>{const objs=await L.skyObjs([0,0,0]),solid=[L.bvh(objs.filter(o=>!SOFT.test(o.name)))],seeB=L.bvh(objs.filter(o=>!/cloud|cumulus/.test(o.name)))/* sight lines: foliage hides her too */;
 const clear=p=>{const w=W(p);return L.clearance(solid,w,R.clr+0.2).m>=R.clr&&L.groundBelow(solid,w,R.gnd+0.1).m>=R.gnd&&!L.enclosed(solid,w);};
 const vis=(p,h)=>[1.05,1.45].every(y=>{const pw=W(p),tw=W([h[0],h[1]+y,h[2]]),d=[tw[0]-pw[0],tw[1]-pw[1],tw[2]-pw[2]],l=Math.hypot(...d);return !FL.cast(seeB,pw,d.map(v=>v/l),l-0.35);});
 const frame=(p,h)=>{const t=[h[0],h[1]+1.3,h[2]];return LS.LENS_SMOOTH.screens.every(s=>LS.herMargin(p,t,48,h,[s])>=R.margin);};
 const frame2=(p,h,n)=>{const t=[h[0],h[1]+1.3,h[2]];return LS.LENS_SMOOTH.screens.every(s=>LS.herMargin(p,t,48,n,[s])>=R.margin);};
 const ok=(p,h)=>frame(p,h)&&vis(p,h)&&clear(p);
 const out={};
 for(const [wa,wb] of WALKS){const segs=NW.planWalk('skycity',wa,wb).segments,runs=[];
  for(let si=0;si<segs.length;si++){const P=segs[si].path,cum=[0];for(let i=1;i<P.length;i++)cum.push(cum[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));const Lm=cum.at(-1);
   const her=s=>{let i=1;while(i<P.length-1&&cum[i]<s)i++;const u=Math.max(0,Math.min(1,(s-cum[i-1])/((cum[i]-cum[i-1])||1)));return P[i-1].map((v,k)=>v+(P[i][k]-v)*u);};
   const hdAt=s=>{const a=her(Math.max(0,s-0.3)),b=her(Math.min(Lm,s+0.3));return Math.atan2(b[0]-a[0],b[2]-a[2]);};
   const nx=si<segs.length-1?segs[si+1].path[0]:null/* full9c skip: the run end also frames (and sees) her next-run start, so the skip join turns only between two in-frame spots */,fin=wa==='S4'&&wb==='S6'&&si===segs.length-1?F.SKY_FINALE_POSE_LOCAL.position:null,N=Math.ceil(Lm/R.ds),layers=[];
   for(let k=0;k<=N;k++){const s=k*Lm/N,h=her(s),hd=hdAt(s),C=[];
    if(k===N&&fin)C.push({p:fin.slice(),u:0});else for(let az=-150;az<=150;az+=10)for(let d=3;d<=8.01;d+=.5)for(let y=1.3;y<=4.01;y+=.3){const A=hd+Math.PI+az*Math.PI/180,p=[h[0]+Math.sin(A)*d,h[1]+y,h[2]+Math.cos(A)*d];
     if(!ok(p,h)||(k===0||k===N)&&(L.groundBelow(solid,W(p),40).m<2.0||L.clearance(solid,W(p),1.2).m<1.0)/* run ends: join rules (mesh ≥ 1.0, ground ≥ 2.0) so the SKY_JOINS A* can start/end there */||k===N&&nx&&!(frame2(p,h,nx)&&vis(p,nx)))continue;const dF=fin?Math.hypot(p[0]-fin[0],p[1]-fin[1],p[2]-fin[2]):0;C.push({p,u:0.02*Math.abs(d-5.5)+0.05*Math.abs(y-2)+0.003*Math.abs(az)+0.15*dF*(k/N)});}
    if(!C.length){console.error('no clear spot',wa,wb,'run',si,'s',s);process.exit(1);}layers.push({s,C});}
   let prev=layers[0].C.map(c=>({cost:c.u,bp:-1}));const bps=[null];
   for(let k=1;k<layers.length;k++){const cur=layers[k].C.map(c=>{let best=Infinity,bi=-1;layers[k-1].C.forEach((q,j)=>{const dd=Math.hypot(c.p[0]-q.p[0],c.p[1]-q.p[1],c.p[2]-q.p[2]);if(dd>R.stepM)return;const v=prev[j].cost+dd*dd*4;if(v<best){best=v;bi=j;}});return {cost:best+c.u,bp:bi};});bps.push(cur);prev=cur;}
   let j=0,bc=Infinity;prev.forEach((c,i)=>{if(c.cost<bc){bc=c.cost;j=i;}});if(!isFinite(bc)){console.error('no feasible rail',wa,wb,si);process.exit(1);}
   const idx=[];for(let k=layers.length-1;k>=0;k--){idx.unshift(j);if(k>0)j=bps[k][j].bp;}
   let Q=idx.map((j,k)=>layers[k].C[j].p.slice());
   for(let it=0;it<6;it++){const Z=Q.map((p,k)=>k===0||k===Q.length-1?p:p.map((v,i)=>(Q[k-1][i]+2*v+Q[k+1][i])/4));let good=true;
    for(let k=0;k<Z.length-1&&good;k++)for(let u=0;u<=1;u+=.25){const p=Z[k].map((v,i)=>v+(Z[k+1][i]-v)*u);if(!ok(p,her(layers[k].s+(layers[k+1].s-layers[k].s)*u))){good=false;break;}}
    if(!good)break;Q=Z;}
   const fit=(a,b)=>{for(let k=a+1;k<b;k++){const u=(layers[k].s-layers[a].s)/(layers[b].s-layers[a].s),p=Q[a].map((v,i)=>v+(Q[b][i]-v)*u);if(Math.hypot(...p.map((v,i)=>v-Q[k][i]))>KEY_TOL||!ok(p,her(layers[k].s)))return false;
     for(let m=0;m<4;m++){const s2=layers[k-1].s+(layers[k].s-layers[k-1].s)*m/4,u2=(s2-layers[a].s)/(layers[b].s-layers[a].s);if(!ok(Q[a].map((v,i)=>v+(Q[b][i]-v)*u2),her(s2)))return false;}}return true;};
   const ks=[0];for(let a=0,b=2;b<Q.length;b++)if(!fit(a,b)){ks.push(b-1);a=b-1;}ks.push(Q.length-1);/* greedy key thinning: every dropped layer within KEY_TOL of the linear key path, and the key path itself re-checked (ok) every 1/4 layer */
   runs.push(enc(ks.flatMap(k=>[layers[k].s,...Q[k]])));}
  out[wa+'>'+wb]=runs;console.log(wa+'>'+wb,runs.map(r=>r.length));}
 const dst=path.join(__dirname,'../../creator-build-project/assets/scripts/region/SkyFinaleRail.ts'),old=fs.existsSync(dst)?fs.readFileSync(dst,'utf8'):'',jl=(old.match(/\nexport const SKY_JOINS[^\n]*/)||[''])[0];
 const q=JSON.stringify(out).replace(/"/g,"'");
 fs.writeFileSync(dst,`export const SKY_RAILS:Readonly<Record<string,readonly string[]>>=${q};${jl}\n`);})().catch(e=>{console.error(e);process.exit(1);});
