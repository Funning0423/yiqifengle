// CAMERA_TEST_DIR 指向 tools/camera-frame-test/（结尾带 /），默认值为原路径
const D=process.env.CAMERA_TEST_DIR||'/workspace/yiqifengle/work/运镜bot/tools/camera-frame-test/';
const S=require(D+'flow_sim.cjs'),G=require(D+'glb_geometry.cjs'),K=require(D+'metrics.cjs'),T9=require(D+'t9_props.cjs'),fs=require('fs');
(async()=>{
const base=S.create(),M=base.M,C=base.C,R=M.FirstsliceRoutes,TC0=M.RegionCameraData.TRANSITION_CAMERA;
const I=G.index(await T9.merged(await G.decode()));const FIELDS=['distance','height','lead','look','targetHeight','fovVerticalDeg'];
const toTC=P=>({...TC0,railIn:[{...P.k,progress:P.end}],craneDown:{...TC0.craneDown,endProgress:P.end,leadSeconds:P.lead}});
async function evalP(P){M.RegionCameraData.TRANSITION_CAMERA=toTC(P);let cfg;try{cfg=R.createFirstsliceRoutes(M.FirstsliceFacts.FIRSTSLICE,M.CharacterReference.CHARACTER_REFERENCE);}catch(e){return {cost:1e9,err:e.message};}
  let run;try{run=await S.run({...base,cfg});}catch(e){return {cost:1e9,err:e.message};}const F=run.frames,dt=run.dt;
  const i0=F.findIndex(f=>f.state==='walking-home'),i1=F.findIndex(f=>f.state==='closing-door');if(i0<0||i1<0)return {cost:1e9,err:'states'};
  const W=F.slice(i0-5,i1),kin=K.kinematics(C,W,dt);let marg=0,minM=1,clr=1,occ=0,by={};
  W.forEach((f,i)=>{const m=K.framing(C,f),mm=m.behind?-1:Math.min(m.topMargin,m.bottomMargin,m.sideMargin);minM=Math.min(minM,mm);if(mm<.01)marg+=(.01-mm);
    if(i%2===0){clr=Math.min(clr,I.clearance(f.cam.position).d);for(const h of [1.0,1.3,1.6]){const o=I.occluded(f.cam.position,[f.root[0],h,f.root[2]]);if(o){occ++;by[o]=(by[o]||0)+1;}}}});
  let lin=0,ang=0;kin.forEach(k=>{lin=Math.max(lin,Math.abs(k.dv||0));ang=Math.max(ang,Math.abs(k.dw||0));});
  const cost=marg*400+Math.max(0,.2-clr)*800+occ*3+Math.max(0,lin-13.5)*20+Math.max(0,ang-330)*.5+P.lead*.05;
  return {cost,minM:+minM.toFixed(4),clr:+clr.toFixed(3),occ,by,lin:+lin.toFixed(2),ang:+ang.toFixed(1)};}
const P0=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));let P=P0,best=await evalP(P);console.log('init',JSON.stringify(best));
const sc={distance:.4,height:.3,lead:.5,look:.2,targetHeight:.1,fovVerticalDeg:4};let step=1;const rnd=()=>Math.random()*2-1;
for(let it=0;it<(+process.argv[3]||300);it++){const Q=JSON.parse(JSON.stringify(P));const n=1+Math.floor(Math.random()*3);
  for(let j=0;j<n;j++){const r=Math.random();if(r<.1)Q.end=Math.max(.25,Math.min(.55,Q.end+rnd()*.04*step));else if(r<.18)Q.lead=Math.max(.4,Math.min(2.5,Q.lead+rnd()*.3*step));else{const f=FIELDS[Math.floor(Math.random()*6)];Q.k[f]+=rnd()*sc[f]*step;}}
  Q.k.fovVerticalDeg=Math.max(40,Math.min(72,Q.k.fovVerticalDeg));Q.k.distance=Math.max(.5,Q.k.distance);if(Q.end>=.6)continue;
  const r=await evalP(Q);if(r.cost<best.cost){best=r;P=Q;console.log(it,JSON.stringify(r));fs.writeFileSync(process.argv[2].replace('.json','.best.json'),JSON.stringify(P,null,1));}if(it%100===99)step*=.8;}
console.log('BEST',JSON.stringify(best));console.log(JSON.stringify(P));})();
