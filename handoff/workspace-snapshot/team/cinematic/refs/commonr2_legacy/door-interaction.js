'use strict';
/* Door-hand contact over the immutable R10 door and approved girl.
 * All exported navigation points are WORLD units. Pose joints/root remain
 * REFERENCE units, exactly like natural gait; apply root and SCALE only once.
 * This module does not change a camera, room, door, stool or character mesh.
 */
const Camera=require('./camera-aligned'),Alignment=require('./original-room-alignment');
const Girl=require('./natural-girl-posed'),Natural=require('./natural-gait-provider');
const R=Alignment.getRegistration(),RIG=Girl.getRestRig(),SCALE=R.girlScale,REST=RIG.joints;
const clone=x=>JSON.parse(JSON.stringify(x)),clamp=x=>Math.max(0,Math.min(1,x));
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len:a=>Math.hypot(...a),mix:(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t)};
V.unit=a=>V.mul(a,1/(V.len(a)||1));V.cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const yawRotate=(v,a)=>[v[0]*Math.cos(a)+v[2]*Math.sin(a),v[1],-v[0]*Math.sin(a)+v[2]*Math.cos(a)];
const timings=Object.freeze({approachStart:3.4,approachEnd:4.5,reachStart:4.25,contact:4.55,doorStart:4.70,release:5.28,retractEnd:5.72,doorEnd:5.9,routeJoin:6.2,routeSourceJoin:7.4,walkStop:17.2,duration:18});
const standWorld=Object.freeze([-.30,0,-.47]),releaseWorld=Object.freeze([-.30,0,.20]);
const gaitConfig=Object.freeze({initialTime:1.1,windows:[{name:'room-approach',start:1.1,end:4.5,steps:11},{name:'push-continue-outside',start:4.7,end:17.2,steps:22}]});
function assertTime(t){if(!Number.isFinite(t))throw TypeError('Door interaction requires finite absolute seconds');return Math.max(0,Math.min(timings.duration,t));}
function hermite(a,b,va,vb,u,duration){const u2=u*u,u3=u2*u;return a.map((v,i)=>(2*u3-3*u2+1)*v+(u3-2*u2+u)*duration*va[i]+(-2*u3+3*u2)*b[i]+(u3-u2)*duration*vb[i]);}
function doorAngleAt(t){t=assertTime(t);if(t<=timings.doorStart)return 0;if(t>=timings.doorEnd)return 86.4;
 // The first firm push creates clearance before the leading foot enters.
 // Match release angular velocity so the leaf never stops when the hand lets go.
 if(t<=timings.release)return hermite([0],[30],[0],[40],(t-timings.doorStart)/(timings.release-timings.doorStart),timings.release-timings.doorStart)[0];
 return hermite([30],[86.4],[40],[0],(t-timings.release)/(timings.doorEnd-timings.release),timings.doorEnd-timings.release)[0];
}
// Exactly buildDoor's transform: original-image left hinge is WORLD +X.
function doorTransform(p,angleDegrees){const a=angleDegrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return[R.door.width/2-p[0]*c+p[2]*s,p[1],p[0]*s+p[2]*c];}
function handleAt(t){return handleAtAngle(doorAngleAt(t));}
function handleAtAngle(angle){const a=angle*Math.PI/180,w=R.door.width,h=R.door.height;
 const source=[(118-7.8)/138*w,(1-123/232)*h,-.060],point=doorTransform(source,angle),normal=[Math.sin(a),0,Math.cos(a)];
 // Touch the near half of the real 0.016-radius brass tube with the existing
 // palm's +normal surface (0.015 ref-unit). This is a surface contact, not a
 // wrist-to-handle-center coincidence. Fingers stay along the ring in -Y.
 const direction=[0,-1,0],palm=V.sub(point,V.mul(normal,.016+.015*SCALE)),wrist=V.sub(palm,V.mul(direction,.027*SCALE));
 return{angle,source,point,normal,direction,palm,wrist,ringRadius:.016,contactRadius:.015*SCALE};
}
function sourceTime(t){const q=(timings.walkStop-t)/(timings.walkStop-timings.routeJoin);return t+(timings.routeSourceJoin-timings.routeJoin)*clamp(q);}
function create(baseCamera=Camera){
 if(!baseCamera||typeof baseCamera.sample!=='function')throw TypeError('Door camera wrapper requires sample(t)');
 const end=baseCamera.sample(timings.approachEnd).girl.position,correction=V.sub(standWorld,end),join=baseCamera.sample(timings.routeSourceJoin).girl.position;
 const dt=.0001,rate=(timings.walkStop-timings.routeSourceJoin)/(timings.walkStop-timings.routeJoin),joinVelocity=V.mul(V.sub(baseCamera.sample(timings.routeSourceJoin+dt).girl.position,baseCamera.sample(timings.routeSourceJoin-dt).girl.position),rate/(2*dt));
 function positionAt(t){
  t=assertTime(t);if(t<timings.approachStart)return baseCamera.sample(t).girl.position.slice();
  if(t<timings.approachEnd)return V.add(baseCamera.sample(t).girl.position,V.mul(correction,ease((t-timings.approachStart)/(timings.approachEnd-timings.approachStart))));
  if(t<timings.doorStart)return standWorld.slice();
  if(t<timings.release)return hermite(standWorld,releaseWorld,[0,0,0],[0,0,1.2],(t-timings.doorStart)/(timings.release-timings.doorStart),timings.release-timings.doorStart);
  if(t<timings.routeJoin)return hermite(releaseWorld,join,[0,0,1.2],joinVelocity,(t-timings.release)/(timings.routeJoin-timings.release),timings.routeJoin-timings.release);
  return baseCamera.sample(sourceTime(t)).girl.position.slice();
 }
 function sampleGirl(t,baseGirl){t=assertTime(t);baseGirl=baseGirl||baseCamera.sample(t).girl;if(t<timings.approachStart)return clone(baseGirl);
  const position=positionAt(t),ta=Math.max(0,t-dt),tb=Math.min(timings.duration,t+dt),delta=V.sub(positionAt(tb),positionAt(ta)),speed=t>=timings.walkStop?0:V.len(delta)/(tb-ta);
  let yaw=0;if(t<timings.approachEnd)yaw=baseGirl.yaw*(1-ease((t-timings.approachStart)/(timings.approachEnd-timings.approachStart)));else if(t>timings.release)yaw=(speed>1e-5?Math.atan2(delta[0],delta[2]):baseCamera.sample(sourceTime(t)).girl.yaw)*ease((t-timings.release)/.02);
  return{...baseGirl,position,yaw,speed,sit:0,doorInteractionNavigation:true};
 }
 const sample=t=>{const b=baseCamera.sample(t);return{...b,girl:sampleGirl(t,b.girl),doorAngle:doorAngleAt(t),doorInteraction:true};};
 let lo=timings.doorStart,hi=timings.release;for(let i=0;i<48;i++){const m=(lo+hi)/2;if(positionAt(m)[2]<0)lo=m;else hi=m;}
 return{...baseCamera,sample,sampleGirl,positionAt,doorAngleAt,handleAt,gaitConfig:clone(gaitConfig),timings:{...timings,thresholdCrossing:(lo+hi)/2},baseCamera};
}
const wrapped=create();
function fixedArm(shoulder,wrist,pole,side='L'){
 const {upperArm:a,forearm:b}=RIG.lengths[side],delta=V.sub(wrist,shoulder),d=V.len(delta);
 if(d>a+b+1e-8||d<Math.abs(a-b)+1e-8)throw RangeError('Door '+side+' wrist unreachable with frozen arm: '+d+' ref units; maximum '+(a+b)+'. Use the door navigation wrapper for gait footprints.');
 const axis=V.mul(delta,1/d),along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),raw=V.sub(pole,shoulder),bend=V.unit(V.sub(raw,V.mul(axis,V.dot(raw,axis))));
 return V.add(V.add(shoulder,V.mul(axis,along)),V.mul(bend,height));
}
function evaluate(t,basePose){
 t=assertTime(t);if(!basePose||!basePose.root||!basePose.joints)throw TypeError('Pass the gait pose built from Door.withCamera(camera)');
 if(t<timings.reachStart||t>timings.retractEnd)return basePose;
 const p=clone(basePose),handle=handleAt(t),phase=t<timings.contact?'reach':t<timings.doorStart?'hold':t<=timings.release?'push':'release';
 const amount=t<timings.contact?ease((t-timings.reachStart)/(timings.contact-timings.reachStart)):t<=timings.release?1:1-ease((t-timings.release)/(timings.retractEnd-timings.release));
 if(amount<=0)return basePose;
 p.retargetArm={shoulderL:basePose.joints.shoulderL.slice(),elbowL:basePose.joints.elbowL.slice(),wristL:basePose.joints.wristL.slice()};
 const worldToLocal=v=>yawRotate(V.sub(V.mul(v,1/SCALE),p.root.position),-p.root.yaw);
 // After release preserve the departing contact velocity briefly, then
 // withdraw along the inside normal as the door continues independently.
 const detachedTime=timings.release+.12*(1-Math.exp(-Math.max(0,t-timings.release)/.12)),targetHandle=t>timings.release?handleAt(detachedTime):handle;
 let wristWorld=targetHandle.wrist.slice();if(t>timings.release)wristWorld=V.sub(wristWorld,V.mul(targetHandle.normal,.09*ease((t-timings.release)/.18)));
 const shoulder=p.joints.shoulderL.slice(),desired=worldToLocal(wristWorld),wrist=V.mix(p.joints.wristL,desired,amount);
 const pole=V.mix(p.joints.elbowL,V.add(shoulder,[-.40,-.58,-.08]),amount);p.joints.elbowL=fixedArm(shoulder,wrist,pole);p.joints.wristL=wrist;
 // Keep the free arm beside the hip while the door is still close. Ordinary
 // locomotion's forward hand swing would intersect the physical closed leaf.
 const rs=p.joints.shoulderR,rw=V.mix(p.joints.wristR,V.add(rs,[.035,-.420,-.050]),amount);p.joints.wristR=rw;p.joints.elbowR=fixedArm(rs,rw,V.mix(p.joints.elbowR,V.add(rs,[.30,-.30,.08]),amount),'R');
 const desiredDirection=yawRotate(targetHandle.direction,-p.root.yaw),desiredNormal=yawRotate(targetHandle.normal,-p.root.yaw);
 p.doorInteraction={phase,amount,gripping:t>=timings.contact&&t<=timings.release,hand:'L',angle:handle.angle,handlePoint:handle.point,desiredPalm:handle.palm,desiredWrist:handle.wrist,handDirection:desiredDirection,handNormal:desiredNormal,contactMode:'existing-palm-surface-on-real-ring',scale:SCALE};
 return p;
}
function align(from,to){const a=V.unit(from),b=V.unit(to),c=Math.max(-1,Math.min(1,V.dot(a,b))),cr=V.cross(a,b),sn=V.len(cr);if(sn<1e-12)return v=>v.slice();const ax=V.mul(cr,1/sn);return v=>V.add(V.add(V.mul(v,c),V.mul(V.cross(ax,v),sn)),V.mul(ax,V.dot(ax,v)*(1-c)));}
function makeModel(pose,baseBuilder=Natural.makeModel){
 const model=baseBuilder(pose),d=pose.doorInteraction;if(!d||d.amount<=0)return model;
 const wrist=model.girlJoints.wristL,oldDirection=V.unit(V.sub(model.girlJoints.fingertipL,wrist)),newDirection=V.unit(V.mix(oldDirection,d.handDirection,d.amount));
 const restDirection=V.unit(V.sub(REST.fingertipL,REST.wristL)),restNormal=[0,restDirection[2],-restDirection[1]],oldNormal=align(restDirection,oldDirection)(restNormal);
 let newNormal=V.unit(V.mix(oldNormal,d.handNormal,d.amount));newNormal=V.unit(V.sub(newNormal,V.mul(newDirection,V.dot(newNormal,newDirection))));
 const oldX=V.unit(V.cross(oldNormal,oldDirection)),newX=V.unit(V.cross(newNormal,newDirection)),rot=v=>V.add(V.add(V.mul(newX,V.dot(v,oldX)),V.mul(newDirection,V.dot(v,oldDirection))),V.mul(newNormal,V.dot(v,oldNormal)));
 let faces=0;for(let i=0;i<model.triangles.length;i++)if(model.poseInfo.labels[i]==='handL'){const tr=model.triangles[i];tr.v=tr.v.map(v=>V.add(wrist,rot(V.sub(v,wrist))));tr.n=tr.n.map(rot);faces++;}
 // MeshBuilder removes pole degenerates: 48 palm + 24 thumb = 72 real faces.
 model.girlJoints.palmL=V.add(wrist,V.mul(newDirection,.027));model.girlJoints.fingertipL=V.add(wrist,V.mul(newDirection,.060));
 const world=v=>V.mul(V.add(yawRotate(v,pose.root.yaw),pose.root.position),SCALE),palmWorld=world(model.girlJoints.palmL);
 model.doorInteraction={...d,actualPalm:palmWorld,actualContact:V.add(palmWorld,V.mul(yawRotate(newNormal,pose.root.yaw),.015*SCALE)),handRigid:true,handSourceTriangles:faces};return model;
}
module.exports={evaluate,apply:evaluate,makeModel,withCamera:create,sampleGirl:wrapped.sampleGirl,positionAt:wrapped.positionAt,sample:wrapped.sample,doorAngleAt,doorTransform,handleAt,handleAtAngle,fixedArm,worldScale:SCALE,rig:clone(RIG),gaitConfig:clone(gaitConfig),timings:wrapped.timings,standWorld:standWorld.slice(),releaseWorld:releaseWorld.slice()};
