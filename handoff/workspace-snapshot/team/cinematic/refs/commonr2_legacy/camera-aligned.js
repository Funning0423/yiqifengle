/* Original R10 room registration + selected continuous18s reveal.
 * The room/door/path are fixed. Timing is redistributed to avoid a sprint
 * from the original stool; no old-camera terrain deformation is used. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./camera-world'),require('./camera-v4'),require('./original-room-alignment'));else root.ForestCameraAligned=factory(root.ForestCameraWorld,root.CameraV4,root.ForestOriginalRoomAlignment);})(typeof globalThis!=='undefined'?globalThis:this,function(Base,V4,Alignment){
'use strict';const R=Alignment.getRegistration(),S=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));},mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),length=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const timing={standStart:0,standEnd:1.1,walkStart:1.1,walkEnd:4.5,doorStart:4.5,doorEnd:5.9,exitStart:5.9,walkStop:17.2,duration:18};
function shift(t){return .5*(S((t-.65)/.225)+S((t-.875)/.225));}
function roomMean(t){return mix(R.anchors.seatedFoot,R.anchors.standingFoot,shift(t));}
const p0=R.anchors.doorFloor,p3=Base.roadPoint(0),q=Base.roadPoint(.002),d=q.map((v,i)=>v-p3[i]),dl=Math.hypot(...d),p1=[0,0,p0[2]*.48],p2=p3.map((v,i)=>v-d[i]/dl*.22);
function connection(u){const v=1-u;return p0.map((_,i)=>v*v*v*p0[i]+3*v*v*u*p1[i]+3*v*u*u*p2[i]+u*u*u*p3[i]);}
const raw=[];for(let i=0;i<=128;i++)raw.push(connection(i/128));for(let i=1;i<=1024;i++)raw.push(Base.roadPoint(i/1024));const arc=[0];for(let i=1;i<raw.length;i++)arc.push(arc[i-1]+length(raw[i],raw[i-1]));const routeLength=arc.at(-1);
function pointAt(distance){distance=Math.max(0,Math.min(routeLength,distance));let lo=0,hi=arc.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(arc[m]<distance)lo=m;else hi=m;}return mix(raw[lo],raw[hi],(distance-arc[lo])/(arc[hi]-arc[lo]));}
function distanceAt(t){const x=Math.max(0,Math.min(11.3,t-5.9)),r=.45,a=2.2,b=3.2,e=10.65,D=11.3,fast=1.55,slow=(routeLength-fast*(r*.5+a-r+.5))/(.5+e-b+(D-e)*.5),I=u=>u*u*u*u*(2.5+u*(-3+u));if(x<r)return fast*r*I(x/r);if(x<a)return fast*(x-r/2);if(x<b)return fast*(a-r*.5)+fast*(x-a)+(slow-fast)*I(x-a);if(x<e)return fast*(a-r*.5)+(fast+slow)*.5+slow*(x-b);return routeLength-slow*(D-e)*I((D-x)/(D-e));}
function outdoor(t){const distance=distanceAt(t),position=pointAt(distance),a=pointAt(distance-.004),b=pointAt(distance+.004),yaw=Math.atan2(b[0]-a[0],b[2]-a[2]),ta=Math.max(5.9,t-.003),tb=Math.min(17.2,t+.003),speed=t>=17.2?0:(distanceAt(tb)-distanceAt(ta))/Math.max(.001,tb-ta);return{position,yaw,speed,distance:Alignment.pathLength()+distance,sit:0};}
const times=[0,1.1,2.6,4.5],cameraPositions=[R.camera.position,[0,2.18,-9.95],[.06,2.12,-7.10],V4.sample(3.05).camera.position],cameraLooks=[R.camera.lookat,[.08,.73,-.2],[.08,1.16,.5],V4.sample(3.05).camera.lookat];
function curve(points,t){let k=0;while(k<times.length-2&&t>times[k+1])k++;const dt=times[k+1]-times[k],u=Math.max(0,Math.min(1,(t-times[k])/dt)),a=points[k],b=points[k+1],before=Math.max(0,k-1),after=Math.min(points.length-1,k+2);return a.map((v,j)=>{const m0=k===0?0:(b[j]-points[before][j])/(times[k+1]-times[before]),m1=k+1===points.length-1?0:(points[after][j]-a[j])/(times[after]-times[k]);return(2*u*u*u-3*u*u+1)*v+(u*u*u-2*u*u+u)*dt*m0+(-2*u*u*u+3*u*u)*b[j]+(u*u*u-u*u)*dt*m1;});}
function sample(seconds){const t=Math.max(0,Math.min(18,seconds));let girl,camera,doorAngle=86.4*S((t-4.5)/1.4);if(t<1.1)girl={position:roomMean(t),yaw:0,speed:0,distance:0,sit:t<=.65?1-S(t/.65):0};else if(t<4.5){const w=Alignment.walkSample(t);girl={...w,yaw:w.yaw*S((t-1.1)/.28),sit:0};}else if(t<5.9)girl={position:R.anchors.doorFloor.slice(),yaw:0,speed:0,distance:Alignment.pathLength(),sit:0};else girl=outdoor(t);
 if(t<=4.5)camera={position:curve(cameraPositions,t),lookat:curve(cameraLooks,t),verticalFov:62};else if(t<5.9)camera=V4.sample(3.05+(t-4.5)/1.4*(5.2-3.05)).camera;else{const sourceTime=5.2+(t-5.9)*(18-5.2)/(18-5.9),old=Base.sample(sourceTime);camera=old.camera;const follow=S((t-5.9)/1.0)*(1-S((sourceTime-11.5)/2));camera.lookat=camera.lookat.map((v,i)=>v+(girl.position[i]-old.girl.position[i])*follow);}
 // The registered +X hinge puts the open leaf across the old side-orbit.
 // Keep the eye on the latch side until beyond the leaf's far edge, then
 // rejoin the original V4-derived orbit smoothly. No FOV/world changes.
 if(t>7.9&&t<11.45){
  const x=camera.position[0],limit=.50,band=.10;
  const capped=x<=limit-band?x:x>=limit+band?limit:x-Math.pow(x-limit+band,2)/(4*band);
  const release=S((t-9.65)/1.80);
  camera.position[0]=x+(capped-x)*(1-release);
 }
 return{time:t,girl,camera,doorAngle,alignedRoom:true,registration:R,phase:t<1.1?'seat-stand':t<4.5?'room-walk':t<5.9?'door-open':t<17.2?'walk-rise-lookback':'settled'};}
return{sample,timing,registration:R,routeLength,pointAt,distanceAt,roomMean};
});
