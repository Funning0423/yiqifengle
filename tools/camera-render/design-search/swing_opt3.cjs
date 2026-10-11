// CAMERA_TEST_DIR 指向 tools/camera-frame-test/（结尾带 /），默认值为原路径
const D=process.env.CAMERA_TEST_DIR||'/workspace/yiqifengle/work/运镜bot-wind/tools/camera-frame-test/';
const S=require(D+'flow_sim.cjs'),G=require(D+'glb_geometry.cjs'),K=require(D+'metrics.cjs'),T9=require(D+'t9_props.cjs'),LR=require(D+'lens_rays.cjs'),fs=require('fs');
(async()=>{
const base=S.create(),M=base.M,C=base.C,R=M.FirstsliceRoutes,TC0=M.RegionCameraData.TRANSITION_CAMERA;
const geo=await T9.merged(await G.decode()),I=G.index(geo);
const FIELDS=['distance','height','lead','look','targetHeight','fovVerticalDeg'];
const toTC=P=>({...TC0,railOut:P.keys.map((k,i)=>({progress:k.progress,side:-1,distance:k.distance,height:k.height,lead:k.lead,look:k.look,targetHeight:k.targetHeight,fovVerticalDeg:k.fovVerticalDeg,...(i===P.keys.length-2?{frontal:true}:{})})),
  crane:{...TC0.crane,startProgress:P.keys[P.keys.length-1].progress,settleSeconds:P.settle},...(P.co?{crossOutEnd:{...TC0.crossOutEnd,...P.co}}:{})});
async function evalP(P,detail){
  M.RegionCameraData.TRANSITION_CAMERA=toTC(P);let cfg;try{cfg=R.createFirstsliceRoutes(M.FirstsliceFacts.FIRSTSLICE,M.CharacterReference.CHARACTER_REFERENCE);}catch(e){return {cost:1e9,err:e.message};}
  const env={...base,cfg};let run;try{run=await S.run(env,{script:['leaveHome']});}catch(e){return {cost:1e9,err:e.message};}
  const F=run.frames,dt=run.dt;const i0=F.findIndex(f=>f.state==='crossing-out');const i1=F.findIndex(f=>f.state==='island');if(i0<0||i1<0)return {cost:1e9,err:'no states'};
  const W=F.slice(i0,i1+1),kin=K.kinematics(C,W,dt);
  let marg=0,minM=1,clr=1,occ=0,occHead=0,occBy={};
  W.forEach((f,i)=>{const m=K.framing(C,f),mm=m.behind?-1:Math.min(m.topMargin,m.bottomMargin,m.sideMargin);minM=Math.min(minM,mm);if(mm<.01)marg+=(.01-mm);
    if(i%2===0){const c=I.clearance(f.cam.position).d;clr=Math.min(clr,c);const r=f.root;
      for(const [h,w] of [[1.6,1],[1.0,1],[1.3,1]]){const o=I.occluded(f.cam.position,[r[0],r[1]+h,r[2]]);if(o){occ++;if(h===1.6)occHead++;occBy[o]=(occBy[o]||0)+1;}}}});
  let lens=0;W.forEach((f,i)=>{if(i%2)return;const R=LR.rays(C,f.cam,586/1266),p=f.cam.position;for(const d of R){const h=I.occluded(p,[p[0]+d[0]*1.15,p[1]+d[1]*1.15,p[2]+d[2]*1.15]);if(h&&!LR.ARCH.test(h))lens++;}});let lin=0,ang=0;kin.forEach(k=>{lin=Math.max(lin,Math.abs(k.dv||0));ang=Math.max(ang,Math.abs(k.dw||0));});
  // frontal: walk-time of the frontal key and hold end on toIsland
  const a=env.W.pathDuration(cfg.outCrossing,cfg.speed),b=env.W.pathDuration(cfg.toIsland,cfg.speed);
  const tStart=W[0].t,tF=tStart+a+P.keys[P.keys.length-2].progress*b,tH=tStart+a+P.keys[P.keys.length-1].progress*b;
  const front=f=>{const fx=Math.sin(f.yaw),fz=Math.cos(f.yaw),dx=f.cam.position[0]-f.root[0],dz=f.cam.position[2]-f.root[2],l=Math.hypot(dx,dz)||1;return Math.acos(Math.max(-1,Math.min(1,(fx*dx+fz*dz)/l)))*180/Math.PI;};
  const at=t=>W.reduce((b,f)=>Math.abs(f.t-t)<Math.abs(b.t-t)?f:b,W[0]);
  const fF=at(tF),errF=front(fF);let errH=0;W.filter(f=>f.t>=tF&&f.t<=tH).forEach(f=>{errH=Math.max(errH,front(f));});
  const mF=K.framing(C,fF),sizeF=(mF.feetPx-mF.hatTopPx)/1266;
  let cost=lens*2+marg*400+Math.max(0,.2-clr)*800+occ*3+Math.max(0,lin-13.5)*20+Math.max(0,ang-330)*.5+Math.max(0,errF-15)*4+Math.max(0,errH-35)*2+Math.max(0,.38-sizeF)*200;
  // soft: prefer shorter moves
  cost+=P.settle*.05;
  const res={cost,lens,minM:+minM.toFixed(4),clr:+clr.toFixed(3),occ,occHead,occBy,lin:+lin.toFixed(2),ang:+ang.toFixed(1),errF:+errF.toFixed(1),errH:+errH.toFixed(1),sizeF:+sizeF.toFixed(3),tFrontal:+(tF).toFixed(2),tHoldEnd:+tH.toFixed(2)};
  return res;}
module.exports={evalP,TC0};
if(require.main===module){
  const init=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));let P=init,best=await evalP(P);console.log('init',JSON.stringify(best));
  const iters=+process.argv[3]||300;let step=1;const rnd=()=>Math.random()*2-1;
  const sc={distance:.4,height:.3,lead:.5,look:.2,targetHeight:.1,fovVerticalDeg:4,progress:.03,settle:.4};
  for(let it=0;it<iters;it++){const Q=JSON.parse(JSON.stringify(P));const nk=1+Math.floor(Math.random()*3);if(!Q.co)Q.co={distance:TC0.crossOutEnd.distance,height:TC0.crossOutEnd.height,lead:TC0.crossOutEnd.lead,look:TC0.crossOutEnd.look,targetHeight:TC0.crossOutEnd.targetHeight,fovVerticalDeg:TC0.crossOutEnd.fovVerticalDeg};
    for(let n=0;n<nk;n++){const NK=Q.keys.length,ki=3+Math.floor(Math.random()*2);if(ki===NK+1){const f=FIELDS[Math.floor(Math.random()*6)];Q.co[f]+=rnd()*sc[f]*step;if(f==='fovVerticalDeg')Q.co[f]=Math.max(40,Math.min(75,Q.co[f]));if(f==='distance')Q.co[f]=Math.max(0,Q.co[f]);continue;}if(ki===NK){Q.settle=Math.max(2,Math.min(6,Q.settle+rnd()*sc.settle*step));continue;}
      const k=Q.keys[ki],f=[...FIELDS,'progress'][Math.floor(Math.random()*7)];k[f]+=rnd()*sc[f]*step;
      if(f==='fovVerticalDeg')k[f]=Math.max(40,Math.min(72,k[f]));if(f==='distance')k[f]=Math.max(.3,k[f]);if(f==='height')k[f]=Math.max(.8,k[f]);}
    const ps=Q.keys.map(k=>k.progress),L=ps.length;if(!(ps[0]>.02&&ps.every((p,i)=>!i||p>ps[i-1]+.04)&&ps[L-1]<.9&&ps[L-1]-ps[L-2]>=.12))continue;
    const r=await evalP(Q);if(r.cost<best.cost){best=r;P=Q;console.log(it,JSON.stringify(r));fs.writeFileSync(process.argv[2].replace('.json','.best.json'),JSON.stringify(P,null,1));}
    if(it%100===99)step*=.8;}
  console.log('BEST',JSON.stringify(best));console.log(JSON.stringify(P));}
})();
