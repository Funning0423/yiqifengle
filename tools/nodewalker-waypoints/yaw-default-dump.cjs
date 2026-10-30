// b21b proof tool: sha256 of her (x,y,z,yaw) per frame for every baked default walk (planWalk without a route) on a clock (60 | 30 | jit = uniform 1/90…1/45 s, fixed seed), plus yaw-accel p99. Used to show the YawFollower dt fix is byte-identical on a steady clock. Usage: node yaw-default-dump.cjs 60
// dump yaw/position sequences of every baked default walk (planWalk without route) at a clock; sha256 + p99 accel
const H=require('../board-ui/harness.cjs').createHarness(),W=H.load('region/NodeWalker.ts'),CM=H.load('CharacterMotion.ts'),N=H.load('region/RegionNodes.ts').REGION_NODES;
const crypto=require('crypto'),clock=process.argv[2];const R=180/Math.PI;
const mk=()=>{if(clock==='60')return ()=>1/60;if(clock==='30')return ()=>1/30;let x=20261030;return ()=>{x=(Math.imul(x,1103515245)+12345)>>>0;return 1/90+(1/45-1/90)*x/4294967296;};};
const h=crypto.createHash('sha256'),acc=[];let walks=0;
for(const reg of Object.keys(N))for(const a of N[reg].nodes)for(const b of N[reg].nodes){if(a.key===b.key)continue;let plan;try{plan=W.planWalk(reg,a.key,b.key)}catch(e){continue}walks++;
 const yf=new CM.YawFollower(),next=mk();let wPrev=null,hPrev=null;
 for(const seg of plan.segments){const P=seg.path,L=W.pathLength(P),D=seg.duration;const a0=W.pointAlong(P,Math.min(L,CM.WALK_YAW_LOOKAHEAD_M));yf.reset(Math.atan2(a0[0]-P[0][0],a0[2]-P[0][2]));let first=true;
  for(let t=0,dt=1/60;t<=D+1e-9;dt=next(),t+=dt){const s=L*Math.min(1,t/D),q=W.pointAlong(P,s),ah=W.pointAlong(P,Math.min(L,s+CM.WALK_YAW_LOOKAHEAD_M));
   const tgt=s+CM.WALK_YAW_LOOKAHEAD_M<=L+1e-9&&Math.hypot(ah[0]-q[0],ah[2]-q[2])>1e-4?Math.atan2(ah[0]-q[0],ah[2]-q[2]):yf.yaw;const py=yf.yaw,y=first?yf.yaw:yf.step(tgt,dt);
   h.update(Float64Array.of(q[0],q[1],q[2],y));
   if(!first){const w=Math.abs(CM.wrapAngle(y-py))/dt*R;if(wPrev!==null)acc.push(Math.abs(w-wPrev)/((dt+hPrev)/2));wPrev=w;hPrev=dt;}first=false;}}}
acc.sort((x,y)=>x-y);console.log(JSON.stringify({clock,walks,frames:acc.length,sha256:h.digest('hex'),accP99:+acc[Math.floor(.99*acc.length)].toFixed(1),accP999:+acc[Math.floor(.999*acc.length)].toFixed(1),accMax:+acc[acc.length-1].toFixed(1)}));
