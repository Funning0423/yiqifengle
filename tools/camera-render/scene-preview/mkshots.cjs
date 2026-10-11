// node mkshots.cjs <camera-frame-test dir> <out.json> name:t[:label] ...   (t = seconds since leaveHome)
const [dir,out,...spec]=process.argv.slice(2);const S=require(dir+'/flow_sim.cjs');
(async()=>{const env=S.create(),run=await S.run(env),F=run.frames,lh=F.findIndex(f=>f.state==='standing');const shots=[];
 for(const sp of spec){const [name,ts,label]=sp.split('|');const t=+ts;const f=F.reduce((b,x)=>Math.abs(x.t-F[lh].t-t)<Math.abs(b.t-F[lh].t-t)?x:b,F[0]);
  const fdeg=(()=>{const fx=Math.sin(f.yaw),fz=Math.cos(f.yaw),dx=f.cam.position[0]-f.root[0],dz=f.cam.position[2]-f.root[2],l=Math.hypot(dx,dz)||1;return Math.acos(Math.max(-1,Math.min(1,(fx*dx+fz*dz)/l)))*180/Math.PI;})();
  shots.push({name,label:(label||name)+' t='+(f.t-F[lh].t).toFixed(2)+'s '+f.state+' wind='+f.wind.toFixed(2)+' front='+fdeg.toFixed(0)+'deg',t:+(f.t-F[lh].t).toFixed(3),pos:f.cam.position,rot:f.cam.rotation,fov:f.cam.fovVerticalDeg,root:f.root,yaw:f.yaw,clip:f.state==='island'?'idle_breathing_loop':'walk_loop',frame:Math.round((f.t*30))%30});}
 require('fs').writeFileSync(out,JSON.stringify(shots,null,1));console.log(out,shots.map(s=>s.label).join('\n'));})();
