'use strict';
// 运镜bot full9c T-02: bakes SKY_FINALE_RAIL, the lens path for the finale's last run (cut → S6, the last segment of NodeWalker
// planWalk S4→S6). It is planned on the REAL env_skycity.glb mesh (lens-scene.cjs, the same solid set as lens-trajectory-clearance,
// floors and steps included).
// For every 0.25 m of her progress there are candidate lens spots round her (azimuth, distance, height). A spot is rejected when it is
// < 0.75 m from the mesh, has < 1.3 m of ground below it, is enclosed, or her chest or face is hidden by the mesh.
// Dynamic programming (Viterbi) then picks the smoothest path (≤ 0.45 m per 0.25 m of her walk), which ends ON SKY_FINALE_POSE_LOCAL
// at S6. The path is smoothed and re-verified densely. Output: model-local keyframes [s, x,y,z] → region/SkyFinaleRail.ts.
const fs=require('fs'),path=require('path'),L=require('../journey-integration/clip3/lens-scene.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),SW=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),NW=H.load('region/NodeWalker.ts'),F=H.load('region/SkyFinaleShot.ts');
const M5=TS.TRANSITION_STAGING.skyMooring5a,W=p=>SW.skyLocalToWorld(M5,p),SOFT=/foliage_cards|flowers|robot_gardener|cloud|cumulus/;
const R={clr:0.75,gnd:1.3,stepM:0.45,ds:0.25};
(async()=>{const objs=await L.skyObjs([0,0,0]),solid=[L.bvh(objs.filter(o=>!SOFT.test(o.name)))];
 const C0=H.load('region/ExploreCameraCore.ts'),segsAll=NW.planWalk('skycity','S4','S6').segments,RAILS=[];
 for(let si=0;si<segsAll.length;si++){const lastSeg=si===segsAll.length-1;
 const seg=segsAll[si].path,a=seg[0],b=seg.at(-1),Lm=Math.hypot(b[0]-a[0],b[2]-a[2]),hd=Math.atan2(b[0]-a[0],b[2]-a[2]);
 const her=s=>{const u=Math.min(1,s/Lm);return a.map((v,i)=>v+(b[i]-v)*u);};
 const vis=(p,h)=>[1.0,1.45].every(y=>{const pw=W(p),tw=W([h[0],h[1]+y,h[2]]),d=[tw[0]-pw[0],tw[1]-pw[1],tw[2]-pw[2]],l=Math.hypot(...d);return !FL.cast(solid[0],pw,d.map(v=>v/l),l-0.35);});
 const ok=(p,h)=>{const w=W(p);return L.clearance(solid,w,R.clr+0.2).m>=R.clr&&L.groundBelow(solid,w,R.gnd+0.1).m>=R.gnd&&!L.enclosed(solid,w)&&vis(p,h);};
 const fin=lastSeg?F.SKY_FINALE_POSE_LOCAL.position:null,st=si===0?(()=>{const q=NW.planWalk('skycity','S3','S4').segments.at(-1).path,e=q.at(-1),f=q.at(-2);return C0.followPose(e,Math.atan2(e[0]-f[0],e[2]-f[2]),390,844,0).position;})():null/* run 1 starts at (or as near as clear to) the S4 follow lens, the live lens there */,N=Math.ceil(Lm/R.ds),layers=[];
 for(let k=0;k<=N;k++){const s=Math.min(Lm,k*R.ds),h=her(s),C=[];
  if(k===N&&fin)C.push({p:fin.slice(),u:0});else{if(k===0&&st){const w=W(st);console.log('S3>S4 end lens: mesh',+L.clearance(solid,w,3).m.toFixed(2),'ground',+L.groundBelow(solid,w,40).m.toFixed(2),'ok',ok(st,h));const clr=L.clearance(solid,w,R.clr+0.2).m>=R.clr&&L.groundBelow(solid,w,R.gnd+0.1).m>=R.gnd&&!L.enclosed(solid,w);if(clr)C.push({p:st.slice(),u:-100})/* the live start lens: clearance only (its framing is the S3>S4 end shot, certified by sky-walk-endshots) */;}for(let az=-150;az<=150;az+=10)for(let d=3;d<=8.01;d+=.5)for(let y=1.3;y<=4.01;y+=.3){const A=hd+Math.PI+az*Math.PI/180,p=[h[0]+Math.sin(A)*d,h[1]+y,h[2]+Math.cos(A)*d];
   const soft=si===0&&s<1.2/* run 1 easing off the live lens: her visibility is a cost there, not a reject */;if(soft){const w=W(p);if(!(L.clearance(solid,w,R.clr+0.2).m>=R.clr&&L.groundBelow(solid,w,R.gnd+0.1).m>=R.gnd&&!L.enclosed(solid,w)))continue;}else if(!ok(p,h))continue;const hid=soft&&!vis(p,h)?3:0;const dF=fin?Math.hypot(p[0]-fin[0],p[1]-fin[1],p[2]-fin[2]):0;C.push({p,u:hid+0.02*Math.abs(d-5.5)+0.05*Math.abs(y-2)+0.15*dF*(k/N)+(k===0&&st?2*Math.hypot(p[0]-st[0],p[1]-st[1],p[2]-st[2]):0)});}}
  layers.push({s,C});if(!C.length){console.error('no clear spot at run',si,'s',s);process.exit(1);}}
 let prev=layers[0].C.map(c=>({cost:c.u,bp:-1}));const bps=[null];
 for(let k=1;k<layers.length;k++){const cur=layers[k].C.map(c=>{let best=Infinity,bi=-1;layers[k-1].C.forEach((q,j)=>{const dd=Math.hypot(c.p[0]-q.p[0],c.p[1]-q.p[1],c.p[2]-q.p[2]);if(dd>R.stepM)return;const v=prev[j].cost+dd*dd*4;if(v<best){best=v;bi=j;}});return {cost:best+c.u,bp:bi};});bps.push(cur);prev=cur;}
 let j=0,bc=Infinity;prev.forEach((c,i)=>{if(c.cost<bc){bc=c.cost;j=i;}});if(!isFinite(bc)){console.error('no feasible rail, run',si);process.exit(1);}
 const idx=[];for(let k=layers.length-1;k>=0;k--){idx.unshift(j);if(k>0)j=bps[k][j].bp;}
 let P=idx.map((j,k)=>layers[k].C[j].p.slice());
 for(let it=0;it<6;it++){const Q=P.map((p,k)=>k===0||k===P.length-1?p:p.map((v,i)=>(P[k-1][i]+2*v+P[k+1][i])/4));let good=true;
  for(let k=0;k<Q.length-1&&good;k++)for(let u=0;u<=1;u+=.25){const p=Q[k].map((v,i)=>v+(Q[k+1][i]-v)*u),s=layers[k].s+(layers[k+1].s-layers[k].s)*u;if(!(si===0&&s<1.2?(()=>{const w=W(p);return L.clearance(solid,w,R.clr+0.2).m>=R.clr&&L.groundBelow(solid,w,R.gnd+0.1).m>=R.gnd&&!L.enclosed(solid,w);})():ok(p,her(s)))){good=false;break;}}
  if(!good)break;P=Q;}
 RAILS.push({from:a.map(v=>+v.toFixed(4)),to:b.map(v=>+v.toFixed(4)),lengthM:+Lm.toFixed(4),keys:P.map((p,k)=>[+layers[k].s.toFixed(3),...p.map(v=>+v.toFixed(3))]),startsOnLive:!!(st&&layers[0].C[idx[0]].u===-100)});}
 const out=path.join(__dirname,'../../creator-build-project/assets/scripts/region/SkyFinaleRail.ts');
 fs.writeFileSync(out,['// GENERATED by tools/region-nodes/gen-sky-finale-rail.cjs (运镜bot full9c T-02). Do not edit.',
  '// Finale runs (planWalk S4→S6 segments, cut between): per run, lens keyframes [s m along her run, x,y,z model-local] planned on the real mesh',
  `// (≥ ${R.clr} m, ground ≥ ${R.gnd} m, her chest and face visible). Run 1 starts on the S4 follow lens; the last run ends on SKY_FINALE_POSE_LOCAL.`,
  `export const SKY_FINALE_RAILS:readonly {from:readonly number[];to:readonly number[];lengthM:number;keys:readonly (readonly number[])[]}[]=${JSON.stringify(RAILS.map(r=>({from:r.from,to:r.to,lengthM:r.lengthM,keys:r.keys})))};`,
  'export const SKY_FINALE_RAIL_RUN=SKY_FINALE_RAILS[SKY_FINALE_RAILS.length-1];','export const SKY_FINALE_RAIL=SKY_FINALE_RAIL_RUN.keys;',''].join('\n'));
 console.log(RAILS.map(r=>({len:r.lengthM,keys:r.keys.length,first:r.keys[0],last:r.keys.at(-1),startsOnLive:r.startsOnLive})));})();
