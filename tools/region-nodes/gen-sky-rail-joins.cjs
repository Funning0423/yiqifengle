'use strict';
// 运镜bot full9c: bakes the skycity board ⇄ rail joins on the REAL env_skycity.glb mesh (lens-trajectory-clearance solid set) → SKY_JOINS in
// region/SkyFinaleRail.ts. The board lens (skycityVisitPose, model-local) lies on one ray from the court on every screen; Q0 = that ray
// at the nearest (wide-screen) distance, so each screen's board lens → Q0 is a straight dolly along its own view line. Entry i: Q0 → the
// walk's rail start; exit o: rail end → Q0 (none for S4>S6). Heap A* on a 0.75 m grid (mesh ≥ 1.0 m, ground below ≥ 2.0 m or none at the grid nodes; every 0.1 m of the final path ≥ 1.5 m (travel rule); a step from which her chest/face is hidden costs 4× (25× within 12 m of her)),
// string-pulled with every 0.2 m re-checked, then the enclosed test on the final path. Integer-mm text (SkyResumeLens.mmDecode).
const fs=require('fs'),path=require('path'),L=require('../journey-integration/clip3/lens-scene.cjs');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),SW=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),NW=H.load('region/NodeWalker.ts'),RL=H.load('region/SkyRunLens.ts'),V=H.load('region/SkycityVisitPose.ts');
const M5=TS.TRANSITION_STAGING.skyMooring5a,W=p=>SW.skyLocalToWorld(M5,p),SOFT=/foliage_cards|flowers|robot_gardener|cloud|cumulus/,G=0.75,CLR=1.0,GND=2.0;
const MM64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const enc=a=>{let o='',p=0;for(const v of a){const n=Math.round(v*1000),d=n-p;p=n;let z=d<0?-2*d-1:2*d;while(z>=32){o+=MM64[32+(z&31)];z=Math.floor(z/32);}o+=MM64[z];}return o;};
const Q0=V.skycityVisitPose([-1.4,-0.07,32.6],[0,-0.068,30],390/520).position;
const hp=(h,x)=>{h.push(x);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;[h[p],h[i]]=[h[i],h[p]];i=p;}};
const pop=h=>{const top=h[0],last=h.pop();if(h.length){h[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===i)break;[h[m],h[i]]=[h[i],h[m]];i=m;}}return top;};
(async()=>{const objs=await L.skyObjs([0,0,0]),solid=[L.bvh(objs.filter(o=>!SOFT.test(o.name)))],memo=new Map();
 const clear=(p,gn=GND)=>{const k=p.map(v=>v.toFixed(2)).join()+gn;let r=memo.get(k);if(r===undefined){const w=W(p);r=L.clearance(solid,w,CLR+0.05).m>=CLR&&L.groundBelow(solid,w,40).m>=gn;memo.set(k,r);}return r;};
 const segOk=(a,b,gn=GND)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.max(1,Math.ceil(l/(gn<GND?0.05:0.2)));for(let i=0;i<=n;i++){const p=a.map((v,k)=>v+(b[k]-v)*i/n);if(!clear(p,gn))return false;}return true;};
 function plan(A,B,H0){const FL=require('../journey-integration/journey-framing-lib.cjs'),vm=new Map(),seen=p=>{const k=p.join();let r=vm.get(k);if(r===undefined){const a=W(p);r=[1.05,1.45].every(y=>{const b=W([H0[0],H0[1]+y,H0[2]]),d=b.map((v,i)=>v-a[i]),l=Math.hypot(...d);return !FL.cast(solid[0],a,d.map(v=>v/l),l-0.3);});vm.set(k,r);}return r;};const lo=[0,1,2].map(i=>Math.min(A[i],B[i])-8),hi=[0,1,2].map(i=>Math.max(A[i],B[i])+(i===1?14:8)),key=q=>q.join(),P=q=>q.map((v,i)=>lo[i]+v*G);
  const near=X=>{let best=null,bd=Infinity;const c=X.map((v,i)=>Math.round((v-lo[i])/G));for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(let dz=-2;dz<=2;dz++){const q=[c[0]+dx,c[1]+dy,c[2]+dz],p=P(q),d=Math.hypot(...p.map((v,i)=>v-X[i]));if(d<bd&&clear(p)&&segOk(X,p,1.55)){bd=d;best=q;}}return best;};
  const s=near(A),t=near(B);if(!s||!t)throw Error('no grid start/end '+A+' → '+B);const Pt=P(t),hh=q=>Math.hypot(...P(q).map((v,i)=>v-Pt[i]));
  const open=[[hh(s),0,s]],g=new Map([[key(s),0]]),par=new Map();let it=0,done=false;
  while(open.length){const [,gc,q]=pop(open);if(key(q)===key(t)){done=true;break;}if(gc>g.get(key(q)))continue;if(++it>200000)throw Error('A* budget');
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){if(!dx&&!dy&&!dz)continue;const n=[q[0]+dx,q[1]+dy,q[2]+dz];if(n.some((v,i)=>v<0||lo[i]+v*G>hi[i]))continue;
    const c=gc+Math.hypot(dx,dy,dz)*G*(seen(P(n))?1:Math.hypot(...P(n).map((v,i)=>v-H0[i]-(i===1?1.3:0)))<12?25:4);if(c>=(g.get(key(n))??Infinity))continue;if(!clear(P(n))||!segOk(P(q),P(n)))continue;g.set(key(n),c);par.set(key(n),q);hp(open,[c+1.5*hh(n),c,n]);}}
  if(!done)throw Error('A* no path');const raw=[B];for(let q=t;q;q=par.get(key(q)))raw.unshift(P(q));raw.unshift(A);
  const out=[raw[0]];let i=0;while(i<raw.length-1){let j=raw.length-1;while(j>i+1&&!(segOk(raw[i],raw[j],(i===0||j===raw.length-1)?1.55:GND)&&[.25,.5,.75].every(u=>seen(raw[i].map((v,m)=>v+(raw[j][m]-v)*u))||!seen(raw[i])||!seen(raw[j]))))j--;out.push(raw[j]);i=j;}
  for(let k=0;k<out.length-1;k++)for(let u=0;u<=1;u+=.1){const p=out[k].map((v,m)=>v+(out[k+1][m]-v)*u);if(L.enclosed(solid,W(p)))throw Error('enclosed on path');for(let k=0;k<out.length-1;k++){const l=Math.hypot(...out[k].map((v,m)=>v-out[k+1][m])),n=Math.ceil(l/0.1);for(let q=0;q<=n;q++){const p=out[k].map((v,m)=>v+(out[k+1][m]-v)*q/n),gb=L.groundBelow(solid,W(p),40).m;if(gb<1.5&&!(k===out.length-2&&q===n))throw Error('ground '+gb.toFixed(2)+' on path seg '+k+'/'+(out.length-1)+' at '+p.map(v=>v.toFixed(2))+' from '+out[k].map(v=>v.toFixed(2))+' to '+out[k+1].map(v=>v.toFixed(2)));}}}
  console.log(' ',it,'expanded',out.length,'pts');return out;}
 const J={};for(const w of ['S1>S2','S2>S3','S3>S4','S4>S5','S4>S6']){const [a,b]=w.split('>'),sg=NW.planWalk('skycity',a,b).segments,st=RL.skyRailPose(w,sg[0].path[0]).position,en=RL.skyRailPose(w,sg.at(-1).path.at(-1)).position;
  console.log(w);const i=plan(Q0,st,sg[0].path[0]).slice(0,-1),o=w==='S4>S6'?null:plan(en,Q0,sg.at(-1).path.at(-1)).slice(1);J[w]={i:enc(i.flat()),o:o?enc(o.flat()):''};}
 const dst=path.join(__dirname,'../../creator-build-project/assets/scripts/region/SkyFinaleRail.ts');let src=fs.readFileSync(dst,'utf8').replace(/\nexport const SKY_JOINS[^\n]*/,'');
 fs.writeFileSync(dst,src.trimEnd()+`\nexport const SKY_JOINS:Readonly<Record<string,{i:string;o:string}>>=${JSON.stringify(J).replace(/"([io])":/g,'$1:').replace(/"/g,"'")};\n`);console.log('done');})().catch(e=>{console.error(e);process.exit(1);});
