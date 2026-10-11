'use strict';
/** Shared harness for the gull tests / preview dump: loads render/GullFlockCore.ts (+ IslandAtmosphereFxCore.ts) through
 * TypeScript, builds GullCam from a camera-track frame, and provides an AmbienceAudio stub with Voice bot's final contract
 * (onGullCall(cb) -> unsubscribe; events scheduled -> start | cancelled with id/at/dist/yawWorldDeg/distM/durS/leadS/kind;
 * near yaw = camera yaw +-60 deg, on the turning side while the camera turns; requestGullCall(dist, yawWorldDeg) >= 2.5 s gap). */
const fs=require('fs'),path=require('path'),os=require('os');
const root=path.resolve(__dirname,'..','..'),scripts=path.join(root,'creator-build-project/assets/scripts');
function load(target){const ts=require('../qf-env.cjs').typescript(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gulls-'));
  for(const f of ['IslandAtmosphereFxCore','GullFlockCore'])fs.writeFileSync(path.join(tmp,f+'.js'),ts.transpileModule(fs.readFileSync(path.join(scripts,'render',f+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:target??ts.ScriptTarget.ES2020}}).outputText);
  return {F:require(path.join(tmp,'IslandAtmosphereFxCore.js')),C:require(path.join(tmp,'GullFlockCore.js'))};}
const qrot=(q,v)=>{const [x,y,z,w]=q,ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];};
function camOf(fr,aspect){return {pos:fr.position.slice(),fwd:qrot(fr.rotation,[0,0,-1]),up:qrot(fr.rotation,[0,1,0]),right:qrot(fr.rotation,[1,0,0]),tanY:Math.tan(fr.fovVerticalDeg*Math.PI/360),aspect};}
const camYaw=c=>{const d=Math.atan2(c.fwd[0],c.fwd[2])*180/Math.PI;return d<0?d+360:d;};
const wrap180=d=>{const r=((d%360)+360)%360;return r>180?r-360:r;};
/** AmbienceAudio stub. rnd: seeded. tick(dt, cam) emits due starts. */
function ambience(rnd){const ls=[];let clock=0,last=-9,id=1,yaw=null,rate=0;const pending=[];
  const emit=(c,phase)=>{const e={id:c.id,phase,at:c.at,dist:c.dist,yawWorldDeg:c.yaw,distM:c.distM,durS:3.3,leadS:phase==='scheduled'?Math.max(0,c.at-clock):0,kind:c.kind};for(const l of ls.slice())l(e);};
  const A={onGullCall(cb){ls.push(cb);return()=>{const i=ls.indexOf(cb);if(i>=0)ls.splice(i,1);};},gameTime:()=>clock,log:[],
    nearYaw(){if(yaw===null)return rnd()*360;if(Math.abs(rate)>4){const s=rate>0?1:-1;return (yaw+s*(5+rnd()*55)+360)%360;}return (yaw+(rnd()*2-1)*60+360)%360;},
    schedule(kind,dist,lead,y){if(pending.some(p=>Math.abs(p.at-(clock+lead))<2.5)||clock+lead-last<2.5)return null;const c={id:id++,kind,dist,at:clock+lead,yaw:+(y??(dist==='near'?A.nearYaw():rnd()*360)).toFixed(2),distM:dist==='near'?6+6*rnd():30+30*rnd()};
      pending.push(c);A.log.push(c);emit(c,'scheduled');return c;},
    requestGullCall(dist,y){if(clock-last<2.5)return null;const c=A.schedule('request',dist,0,y);if(!c)return null;pending.splice(pending.indexOf(c),1);last=clock;c.startAt=clock;emit(c,'start');return c.id;},
    tick(dt,cam){clock+=dt;if(cam){const y=camYaw(cam);if(yaw!==null&&dt>0){rate+=(wrap180(y-yaw)/dt-rate)*Math.min(1,dt*8);}yaw=y;}
      for(let i=pending.length-1;i>=0;i--)if(pending[i].at<=clock+1e-9){const c=pending.splice(i,1)[0];last=clock;c.startAt=clock;emit(c,'start');}}};
  return A;}
module.exports={load,camOf,camYaw,ambience,qrot,root};
