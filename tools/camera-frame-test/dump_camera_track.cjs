'use strict';
/** Per-frame camera pose track (60 fps flow_sim of the REAL WorldFlowCore/routes) for offline intersection tests by other bots
 * (e.g. 场景特效bot fx_ nodes). Usage: node dump_camera_track.cjs [out.json] [--walk-profile ...not supported: constant speed].
 * Frames: t (s since leaveHome), phase (outbound|islandIdle|return), state, position [x,y,z], rotation quat [x,y,z,w],
 * forward (unit, -Z of rotation), target (position + forward * distance to her chest), fovVerticalDeg, aspect 586/1266, root (her). */
const S=require('./flow_sim.cjs'),K=require('./metrics.cjs'),fs=require('fs');
(async()=>{const out=process.argv[2]||'camera-track.json',env=S.create(),run=await S.run(env),F=run.frames,C=env.C;
  const lh=F.findIndex(f=>f.state==='standing'),ph=s=>s==='crossing-out'?'outbound':s==='island'?'islandIdle':s==='walking-home'||s==='crossing-in'?'return':null,r=v=>+v.toFixed(5);
  const frames=[];for(const f of F){const p=ph(f.state);if(!p)continue;const fw=C.rotate(f.cam.rotation,[0,0,-1]),c=[f.root[0],f.root[1]+1,f.root[2]],d=Math.hypot(c[0]-f.cam.position[0],c[1]-f.cam.position[1],c[2]-f.cam.position[2]);
    frames.push({t:r(f.t-F[lh].t),phase:p,state:f.state,position:f.cam.position.map(r),rotation:f.cam.rotation.map(r),forward:fw.map(r),target:f.cam.position.map((v,k)=>r(v+fw[k]*d)),fovVerticalDeg:r(f.cam.fovVerticalDeg),root:f.root.map(r)});}
  const ip=C.fromLookAt(env.cfg.cameraIsland,env.cfg.cameraIsland.fovVerticalDeg);
  fs.writeFileSync(out,JSON.stringify({about:'OFFLINE flow_sim camera track (运镜bot T2+, constant-speed walkDuration). World space = Cocos (Y up, camera looks -Z). t = seconds since leaveHome.',
    fps:60,aspect:K.SCREEN.aspect,screen:[K.SCREEN.width,K.SCREEN.height],events:(run.cameraEvents||[]).map(e=>({kind:e.kind,place:e.place||null,t:r(e.t-F[lh].t)})),
    islandIdlePose:{position:ip.position.map(r),rotation:ip.rotation.map(r),fovVerticalDeg:ip.fovVerticalDeg},frames}));
  console.log('wrote',out,frames.length,'frames');})();
