'use strict';
// Camera-only framing over the authoritative hand/door navigation. Fixed world
// geometry and FOV remain unchanged. Root/footprint planning consumes identical
// Door.withCamera(CameraAligned) girl samples.
const Aligned=require('./camera-aligned'),Door=require('./door-interaction'),Seat=require('./continuous-seat-stand');
const S=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
// The old painted standing-foot marker sits among the registered stool legs.
// Keep the original seat fixed; two short forward-side steps clear that real
// geometry, then join the original walk path continuously in world space.
const delta=Seat.standingFoot.map((v,i)=>v-Seat.registration.anchors.standingFoot[i]);
const walkTimes=[1.1,1.9,3.4],walkPoints=[Seat.standingFoot,[-.10,0,-4.9],Aligned.sample(3.4).girl.position],endBefore=Aligned.sample(3.399).girl.position,endAfter=Aligned.sample(3.401).girl.position;
function approachPosition(t){let k=t<1.9?0:1;const d=walkTimes[k+1]-walkTimes[k],u=Math.max(0,Math.min(1,(t-walkTimes[k])/d));function slope(i,j){if(i===0)return j===2?.5*Seat.SCALE:0;if(i===2)return(endAfter[j]-endBefore[j])/.002;const a=(walkPoints[1][j]-walkPoints[0][j])/.8,b=(walkPoints[2][j]-walkPoints[1][j])/1.5;return a*b<=0?0:2*a*b/(a+b);}return walkPoints[k].map((a,j)=>(2*u*u*u-3*u*u+1)*a+(u*u*u-2*u*u+u)*d*slope(k,j)+(-2*u*u*u+3*u*u)*walkPoints[k+1][j]+(u*u*u-u*u)*d*slope(k+1,j));}
const SafeApproach={...Aligned,sample(t){const p=Aligned.sample(t);if(t<1.1)return p;if(t>=3.4)return p;
 const position=approachPosition(t),d=.0001,a=approachPosition(Math.max(1.1,t-d)),b=approachPosition(t+d),span=t+d-Math.max(1.1,t-d),vx=(b[0]-a[0])/span,vz=(b[2]-a[2])/span;
 return{...p,girl:{...p.girl,position,speed:Math.hypot(vx,vz),yaw:Math.atan2(vx,vz)*S((t-1.1)/.28)}};
}};
const Navigation=Door.withCamera(SafeApproach);
function sample(t){const p=Navigation.sample(t),base=Aligned.sample(t),camera={...p.camera,position:p.camera.position.slice(),lookat:p.camera.lookat.slice()};
 // The push already begins the forward journey. Rise gently with that first
 // real step, staying below the 3.4-unit lintel until the camera clears it.
 const lift=.50*S((t-Door.timings.doorStart)/1.2)*(1-S((t-8.5)/3.0));camera.position[1]+=lift;
 const follow=.62*S((t-3.7)/.7)*(1-S((t-10.0)/2.0));for(let i=0;i<3;i++)camera.lookat[i]+=(p.girl.position[i]-base.girl.position[i])*follow;
 return{...p,camera,doorSynchronizedCamera:true};}
module.exports={...Navigation,sample,geometryFixed:true,verticalFov:62,notes:'Gentle continuous rise starts with real pushing step; identical authoritative girl navigation; exact original endpoint camera at18s.'};
