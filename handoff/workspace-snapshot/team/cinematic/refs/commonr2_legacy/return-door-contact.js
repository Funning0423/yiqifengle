'use strict';
// A positive-time, physically attached pull. Navigation owns the body's path;
// this adapter only targets the existing palm and the unchanged arm lengths.
const Door=require('./door-interaction'),SCALE=Door.worldScale;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),mix=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u);
const yaw=(v,a)=>[v[0]*Math.cos(a)+v[2]*Math.sin(a),v[1],-v[0]*Math.sin(a)+v[2]*Math.cos(a)];
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
function apply(p,t,T,angle){if(t<T.reachStart||t>T.releaseEnd)return p;const amount=t<T.contact?ease((t-T.reachStart)/(T.contact-T.reachStart)):t<=T.closeEnd?1:1-ease((t-T.closeEnd)/(T.releaseEnd-T.closeEnd));if(amount<=0)return p;
 const h=Door.handleAtAngle(angle),q=JSON.parse(JSON.stringify(p)),local=v=>yaw(sub(mul(v,1/SCALE),q.root.position),-q.root.yaw),withdraw=t>T.closeEnd?.08*ease((t-T.closeEnd)/(T.releaseEnd-T.closeEnd)):0;
 const wrist=local(sub(h.wrist,mul(h.normal,withdraw))),sh=q.joints.shoulderL,desired=mix(q.joints.wristL,wrist,amount),pole=mix(q.joints.elbowL,add(sh,[-.4,-.58,-.08]),amount);
 q.retargetArm={shoulderL:p.joints.shoulderL.slice(),elbowL:p.joints.elbowL.slice(),wristL:p.joints.wristL.slice()};
 q.joints.elbowL=Door.fixedArm(sh,desired,pole);q.joints.wristL=desired;
 const rs=q.joints.shoulderR,rw=mix(q.joints.wristR,add(rs,[.035,-.420,-.05]),amount);q.joints.wristR=rw;q.joints.elbowR=Door.fixedArm(rs,rw,mix(q.joints.elbowR,add(rs,[.3,-.3,.08]),amount),'R');
 q.doorInteraction={phase:t<T.contact?'return-reach':t<T.closeStart?'return-hold':t<=T.closeEnd?'return-pull':'return-release',amount,gripping:t>=T.contact&&t<=T.closeEnd,hand:'L',angle,handlePoint:h.point,desiredPalm:h.palm,desiredWrist:h.wrist,handDirection:yaw(h.direction,-q.root.yaw),handNormal:yaw(h.normal,-q.root.yaw),contactMode:'existing-palm-surface-on-real-ring',scale:SCALE};return q;
}
module.exports={apply};
