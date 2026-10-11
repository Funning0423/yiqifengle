// shots for return-entry previews: node shots.cjs out.json t1,t2,... [--every 1/15 from-to]
const S=require(process.cwd()+'/tools/camera-frame-test/flow_sim.cjs');
(async()=>{const [out,spec,label]=process.argv.slice(2);const env=S.create(),run=await S.run(env),F=run.frames,dt=run.dt;
 let times;if(spec.startsWith('range:')){const [a,b,step]=spec.slice(6).split(',').map(Number);times=[];for(let t=a;t<=b+1e-9;t+=step)times.push(+t.toFixed(4));}else times=spec.split(',').map(Number);
 const sitStart=run.states.find(s=>s.state==='sitting').frame*dt;
 const shots=times.map((t,k)=>{const i=Math.min(F.length-1,Math.round(t/dt)),f=F[i];let clip='walk_loop',ct=t;
  if(f.state==='closing-door')clip='idle_breathing_loop';
  if(f.state==='sitting'){const u=t-sitStart;if(u<1.5){clip='idle_breathing_loop';}else{clip='sit_down';ct=u-1.5;}}
  if(f.state==='home'){clip='sit_hold';ct=0;}
  return {name:(spec.startsWith('range:')?'f':'')+String(k).padStart(4,'0'),label:(label||'')+' t='+f.t.toFixed(2)+'s '+f.state,t:f.t,state:f.state,pos:f.cam.position,rot:f.cam.rotation,fov:f.cam.fovVerticalDeg,root:f.root,yaw:f.yaw,door:f.door,clip,clipTime:ct};});
 require('fs').writeFileSync(out,JSON.stringify(shots,null,1));console.log('wrote',shots.length);})();
