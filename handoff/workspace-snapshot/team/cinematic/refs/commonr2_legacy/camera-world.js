/* V4 timing retained. Fixed scene-space registration to the original R10 door,
 * road, and playable nodes; only the late camera framing adapts to the tall
 * original lighthouse. Geometry is never interpolated toward a flat map. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./camera-v4'),require('./gpu-scene'));else root.ForestCameraWorld=factory(root.CameraV4,root.ForestGPUScene);})(typeof globalThis!=='undefined'?globalThis:this,function(V4,GPU){
'use strict';
const {V,project,unprojectPlane}=GPU,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));},mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const W=390,H=844,END={position:[8,18,36],lookat:[2,-1.2,0],verticalFov:62};
// Two-variable Newton solve fixes the actual door threshold at the existing
// World.doorWalkPoint(0) = (160,400), not at an invented screenshot landmark.
for(let i=0;i<8;i++){const p=project([0,0,0],END,W,H),err=[160-p.x,400-p.y],h=1e-4,cx={...END,lookat:END.lookat.map((v,k)=>v+(k===0?h:0))},cy={...END,lookat:END.lookat.map((v,k)=>v+(k===1?h:0))},px=project([0,0,0],cx,W,H),py=project([0,0,0],cy,W,H),a=(px.x-p.x)/h,b=(py.x-p.x)/h,c=(px.y-p.y)/h,d=(py.y-p.y)/h,det=a*d-b*c;END.lookat[0]+=(d*err[0]-b*err[1])/det;END.lookat[1]+=(-c*err[0]+a*err[1])/det;}
const mapPoint=(x,y,height=0)=>unprojectPlane(x,y,END,W,H,1,height);
function doorWalkPoint(t){t=clamp(t);const v=1-t;return{x:195+v*v*v*(-35)+3*v*v*t*(-35)+3*v*t*t*(-139)+t*t*t*(-125),y:441+v*v*v*(-41)+3*v*v*t*(-19)+3*v*t*t*(-8)+t*t*t*20};}
function roadPoint(t){const p=doorWalkPoint(t);return mapPoint(p.x,p.y);}
// Static world path is parameterized by physical arc length, preventing a
// Bezier parameter-speed spike from being misread as a required sprint.
function curvePoint(u){const p=roadPoint(u);p[0]-=.42*Math.pow(1-u,3);return p;}
const arc=[{u:0,length:0,p:curvePoint(0)}];
for(let i=1;i<=1024;i++){const u=i/1024,p=curvePoint(u),prev=arc[i-1];arc.push({u,p,length:prev.length+Math.hypot(...V.sub(p,prev.p))});}
const routeLength=arc[arc.length-1].length;
function routePoint(distanceFraction){const goal=clamp(distanceFraction)*routeLength;let lo=0,hi=1024;while(hi-lo>1){const m=(lo+hi)>>1;if(arc[m].length<goal)lo=m;else hi=m;}const a=arc[lo],b=arc[hi],k=(goal-a.length)/(b.length-a.length);return curvePoint(a.u+(b.u-a.u)*k);}
function routeGirl(source){if(source.position[2]<0)return source.position.slice();return routePoint(source.position[2]/7.46);}
function routeYaw(source){if(source.position[2]<0)return source.yaw;const u=clamp(source.position[2]/7.46),a=routePoint(Math.max(0,u-.001)),b=routePoint(Math.min(1,u+.001));const yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);return source.yaw+(yaw-source.yaw)*smooth(u/.07);}
function exitProgress(t){const x=Math.max(0,Math.min(11.8,t-5.2)),R=.45,A=2.2,B=3.2,E=11.15,D=11.8,fast=1.55,total=routeLength+.58,slow=(total-fast*(R*.5+(A-R)+.5))/(.5+(E-B)+(D-E)*.5),I=u=>u*u*u*u*(2.5+u*(-3+u));let distance;if(x<R)distance=fast*R*I(x/R);else if(x<A)distance=fast*(R*.5+x-R);else if(x<B)distance=fast*(A-R*.5)+fast*(x-A)+(slow-fast)*I(x-A);else if(x<E)distance=fast*(A-R*.5)+(fast+slow)*.5+slow*(x-B);else distance=total-slow*(D-E)*I((D-x)/(D-E));return distance/total;}
function exitRoute(t){const total=routeLength+.58,d=exitProgress(t)*total;if(d<.58)return[-.42,0,-.58+d];return routePoint((d-.58)/routeLength);}
function exitHeading(t){const d=exitProgress(t)*(routeLength+.58);if(d<=.58)return 0;const u=clamp((d-.58)/routeLength),a=routePoint(Math.max(0,u-.001)),b=routePoint(Math.min(1,u+.001));return Math.atan2(b[0]-a[0],b[2]-a[2])*smooth(u/.06);}
function sample(seconds){const q=V4.sample(seconds),t=q.time,c=q.camera,tail=smooth((t-8.5)/(17.2-8.5)),rawEnd=V4.sample(18).camera;c.position=V.add(c.position,V.scale(V.sub(END.position,rawEnd.position),tail));c.lookat=V.add(c.lookat,V.scale(V.sub(END.lookat,rawEnd.lookat),tail));const rawGirl=q.girl.position.slice();q.girl.position=routeGirl(q.girl);q.girl.yaw=routeYaw({...q.girl,position:rawGirl});if(t>=5.2){q.girl.position=exitRoute(t);q.girl.yaw=exitHeading(t);const a=exitRoute(Math.max(5.2,t-.003)),b=exitRoute(Math.min(17,t+.003));q.girl.speed=t>=17?0:Math.hypot(...V.sub(b,a))/.006;q.girl.distance=1.44+exitProgress(t)*(routeLength+.58);}const follow=smooth((t-5.2)/1.0)*(1-smooth((t-11.5)/2.0));c.lookat=mix(c.lookat,V.add(q.girl.position,[0,1.12,0]),follow);q.mapRegistration={door:[160,400],firstNode:[70,461],lateFraming:tail};return q;}
const RETURN_DURATION=6.2;
// Independent return: wide view follows the girl along the path first, then
// enters at low height. This is not negative-time playback of the 18s lift.
function returning(seconds){const t=Math.max(0,Math.min(RETURN_DURATION,seconds)),q=sample(18),p=clamp(t/3.2);q.time=t;q.returning=true;q.doorAngle=86.4;q.girl.position=roadPoint(1-smooth(p));q.girl.yaw=routeYaw({position:[0,0,(1-p)*7.46]})+Math.PI;q.girl.speed=t<3.2?1:0;q.girl.sit=0;if(t>3.2){const u=smooth((t-3.2)/1.6);q.girl.position=mix([0,0,0],[.45,0,-2.02],u);q.girl.yaw=Math.PI;if(t>4.8){q.girl.sit=smooth((t-4.8)/1.4);q.girl.yaw=Math.PI*(1-smooth((t-4.8)/.6));}}
 const a=smooth((t-2.5)/1.7),b=smooth((t-4.2)/2);q.camera.position=t<4.2?mix(END.position,[0,2.1,1.3],a):mix([0,2.1,1.3],V4.sample(0).camera.position,b);q.camera.lookat=t<4.2?mix(END.lookat,[0,1.4,-1],a):mix([0,1.4,-1],V4.sample(0).camera.lookat,b);if(t>5.2)q.doorAngle=86.4*(1-smooth((t-5.2)/1));return q;}
return{sample,returning,returnDuration:RETURN_DURATION,endCamera:END,width:W,height:H,mapPoint,roadPoint,routePoint,routeLength,doorWalkPoint,project:p=>project(p,END,W,H),registration:{doorPixel:[160,400],firstNodePixel:[70,461],fixedGroundPlane:0,source:'R10 World.doorWalkPoint/travelPoint',cameraAdaptation:'actual V4 0–8.5s; C2-smooth late translation/lookat offset 8.5–17.2s to fit original tall lighthouse and existing map anchors; FOV62 unchanged'}};
});
