// node dump_frames.cjs <repoRoot> <out.json> : outbound frames (crossing-out) with cam, root, yaw, door, wind. 60 fps constant walk.
const path=require('path');const S=require(path.join(process.argv[2],'tools/camera-frame-test/flow_sim.cjs'));
(async()=>{const env=S.create(),run=await S.run(env,{script:['leaveHome'],fps:60}),F=run.frames,C=env.C;
 const o=F.filter(f=>f.state==='crossing-out'),t0=o[0].t;
 const fr=o.map(f=>({t:+(f.t-t0).toFixed(4),pos:f.cam.position,fwd:C.rotate(f.cam.rotation,[0,0,-1]),fov:f.cam.fovVerticalDeg,root:f.root,yaw:f.yaw,door:f.door,wind:f.wind}));
 const ev=(run.cameraEvents||[]).map(e=>({kind:e.kind,place:e.place||null,t:+(e.t-t0).toFixed(4)}));
 require('fs').writeFileSync(process.argv[3],JSON.stringify({t0_sim:t0,events:ev,frames:fr}));console.log('frames',fr.length,'events',JSON.stringify(ev));})();
