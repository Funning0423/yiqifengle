'use strict';
/** Frame-accurate simulation of the REAL WorldFlow state machine (WorldFlowCore.ts), REAL routes (FirstsliceRoutes.ts)
 * and REAL camera tracks (CameraPose.createCameraTrack + applyCameraPose). The lease/clock below mirrors
 * WorldFlowComponent.run()/update(): one job list, tick(0) at creation, elapsed += dt (dt capped 0.1), tick(min(1,e/s)).
 * Character: mirrors FlowReferenceStandin (pointOnPath(path, elapsed/duration), yaw from path tangent).
 * Engine-free; no rendering. Native visual acceptance remains separate. */
const {load}=require('./load_ts.cjs');
/** opts.walkDuration: override the shared walk-duration contract; opts.walkProfile(p)->distance fraction for the sim
 *  character (default linear = constant speed). The character reports walkProgress() = that distance fraction. */
function create(opts={}){
  const M=load();const C=M.CameraPose,W=M.WorldFlowCore,R=M.FirstsliceRoutes,F=M.FirstsliceFacts,REF=M.CharacterReference;
  const cfg=R.createFirstsliceRoutes(F.FIRSTSLICE,REF.CHARACTER_REFERENCE,opts.walkDuration?{walkDuration:opts.walkDuration}:undefined);
  return {M,C,W,cfg,REF,walkProfile:opts.walkProfile||null,reportWalkProgress:opts.reportWalkProgress!==false};
}
async function run(env,{fps=60,script=['leaveHome','returnHome'],standSeconds=1.0,sitSeconds=1.0}={}){
  const {C,W,cfg}=env;const dt=1/fps;
  const cam={fov:55,p:[0,0,0],q:[0,0,0,1],node:{setWorldPosition(x,y,z){cam.p=[x,y,z]},setWorldRotation(x,y,z,w){cam.q=[x,y,z,w]}}};
  const jobs=new Set();
  const runJob=(seconds,token,tick)=>{token.check();if(!Number.isFinite(seconds)||seconds<=0){tick(1);return Promise.resolve();}
    return new Promise((resolve,reject)=>{const job={elapsed:0,seconds,tick,resolve,reject,off:()=>{}};job.off=token.onCancel(()=>{jobs.delete(job);reject(new W.Cancelled());});jobs.add(job);try{tick(0);}catch(e){jobs.delete(job);job.off();reject(e);}});};
  const world={weight:1,layers:null,door:0,events:[]};
  const log=(kind,data)=>world.events.push({frame,kind,data});
  const lease={
    // Mirrors GGbot T5 RoomLightingRig: interior view on -> weight 1, off -> 0; writes ignored while off.
    setLayers(l){const was=!!world.layers?.interior;world.layers={...l};if(l.interior!==was)world.weight=l.interior?1:0;log('layers',{...l});},
    setDoor(a){world.door=a;},
    setCamera(p){C.applyCameraPose(cam,C.fromLookAt(p,cam.fov),'sim.setCamera');log('setCamera',null);},
    animateDoor:(from,to,seconds,t)=>runJob(seconds,t,p=>{world.door=from+(to-from)*p;}),
    animateCamera:(path,seconds,t,options,progress)=>{const tr=C.createCameraTrack(cam,path,'sim.animateCamera',options);log('track',{keys:path.length,seconds,options:options||null,byDistance:!!progress});
      // mirrors WorldFlowComponent: CameraPose.createProgressFollower (smoothed distance correction, monotone, ends on 1)
      if(!progress)return runJob(seconds,t,tr.tick);const follow=C.createProgressFollower(seconds);return runJob(seconds,t,p=>tr.tick(follow(p,progress())));},
    // T5 133018c contract: clamp 0..1, effective only with the interior view on (else false / get 0); linear cancellable blend.
    setRoomLightWeight(w){if(!world.layers?.interior||!Number.isFinite(w))return false;world.weight=Math.max(0,Math.min(1,w));log('weight',w);return true;},
    getRoomLightWeight:()=>world.layers?.interior?world.weight:0,
    blendRoomLight:(from,to,seconds,t)=>runJob(seconds,t,p=>{if(world.layers?.interior)world.weight=Math.max(0,Math.min(1,from+(to-from)*p));}),
    wait:(seconds,t)=>runJob(seconds,t,()=>{}),
    cancelTransient(){for(const j of Array.from(jobs)){j.off();j.reject(new W.Cancelled());}jobs.clear();},
    assertStaticWorld(){},dispose(){},
  };
  const ch={root:[...cfg.seat.seatedControllerRoot],yaw:cfg.seat.yawRad,job:null,
    calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:cfg.seat.standingControllerRoot,seatedRoot:cfg.seat.seatedControllerRoot,seatYawRad:cfg.seat.yawRad,clearanceRadiusM:.15},
    advance(s){const j=ch.job;if(!j)return;j.elapsed=Math.min(j.duration,j.elapsed+Math.min(s,.1));const p=j.elapsed/j.duration,a=j.action;
      if(a.kind==='walk'){const s=env.walkProfile?env.walkProfile(p,j.duration,a.path):p;j.distance=s;ch.root=[...W.pointOnPath(a.path,s)];const u=W.pointOnPath(a.path,Math.max(0,p-.0001)),v=W.pointOnPath(a.path,Math.min(1,p+.0001));if(Math.hypot(v[0]-u[0],v[2]-u[2])>1e-8)ch.yaw=Math.atan2(v[0]-u[0],v[2]-u[2]);}
      else if(a.kind==='turn')ch.yaw=a.fromYawRad+Math.atan2(Math.sin(a.toYawRad-a.fromYawRad),Math.cos(a.toYawRad-a.fromYawRad))*p;
      else{const target=a.kind==='stand'?a.seat.standingControllerRoot:a.seat.seatedControllerRoot;ch.root=j.from.map((x,i)=>x+(target[i]-x)*p);}
      if(j.elapsed>=j.duration){ch.job=null;j.off();j.resolve();}},
    perform(action,token){token.check();if(action.kind==='sit'){const d=Math.atan2(Math.sin(action.seat.yawRad-ch.yaw),Math.cos(action.seat.yawRad-ch.yaw));if(Math.abs(d)>.001)return ch.perform({kind:'turn',controllerRoot:action.seat.standingControllerRoot,fromYawRad:ch.yaw,toYawRad:ch.yaw+d,direction:'left'},token).then(()=>ch.perform(action,token));}
      const duration=action.kind==='stand'?standSeconds:action.kind==='sit'?sitSeconds:action.kind==='walk'?action.duration:1.5;
      return new Promise((resolve,reject)=>{const j={action,duration,from:[...ch.root],elapsed:0,resolve,reject,off:()=>{}};ch.job=j;j.off=token.onCancel(()=>{if(ch.job===j)ch.job=null;reject(new W.Cancelled());});});},
    cancelAndReset(pose){ch.job=null;ch.root=[...(pose.kind==='seated'?pose.seat.seatedControllerRoot:pose.controllerRoot)];ch.yaw=pose.kind==='seated'?pose.seat.yawRad:pose.yawRad;},
    setVisible(){},dispose(){},
    walkProgress:env.reportWalkProgress?()=>{const j=ch.job;return j&&j.action.kind==='walk'?(j.distance??0):null;}:undefined};
  const states=[];let frame=0,state='';
  const flow=new W.WorldFlow({config:cfg,mode:'motion',character:ch,levels:{enter:async()=>{throw Error('unused')}},loadWorld:async()=>lease,onChange:s=>{state=s.state;states.push({frame,state:s.state});log('state',s.state);}});
  const frames=[];
  const snap=()=>({frame,t:frame*dt,state,cam:{position:[...cam.p],rotation:[...cam.q],fovVerticalDeg:cam.fov},root:[...ch.root],yaw:ch.yaw,weight:world.weight,layers:world.layers?{...world.layers}:null,door:world.door});
  const tick=async()=>{await new Promise(r=>setImmediate(r));};
  if(!(await flow.load()).ok)throw Error('load failed');
  const results=[];
  const cameraEvents=[];flow.onCameraEvent(e=>cameraEvents.push({frame,t:frame*dt,...e}));
  // script entries: 'op' or ['op', arg] (e.g. ['leaveHome',{from:pose}] = leave from a dragged room view)
  for(const entry of script){const [op,arg]=Array.isArray(entry)?entry:[entry];
    let done=false,result=null;const pr=flow[op](arg).then(r=>{done=true;result=r;});
    await tick();frames.push({...snap(),op});
    let guard=0;
    while(!done){frame++;ch.advance(dt);for(const j of Array.from(jobs)){if(!jobs.has(j))continue;j.elapsed+=Math.min(dt,.1);try{j.tick(Math.min(1,j.elapsed/j.seconds));if(j.elapsed>=j.seconds){jobs.delete(j);j.off();j.resolve();}}catch(e){jobs.delete(j);j.off();j.reject(e);}}
      await tick();await tick();frames.push({...snap(),op});if(++guard>60*120)throw Error('flow did not finish: '+op);}
    await pr;results.push({op,result});
    // hold a few stable frames after arrival (camera must not move)
    for(let k=0;k<10;k++){frame++;await tick();frames.push({...snap(),op:op+':hold'});}
  }
  return {frames,states,results,events:world.events,cameraEvents,dt};
}
module.exports={create,run};
