/* One visible-time owner for the real 3D journey. Endpoints must be presented
 * before a segment can finish; cancellation queues a forward, independent trip.
 * No timers, storage, board mutation, or reverse playback occur in this module. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./scene-timing'));else root.ForestV4Journey=factory(root.ForestSceneTiming);})(typeof globalThis!=='undefined'?globalThis:this,function(Timing){
'use strict';
const Clock=require('./map-travel-clock');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>t*t*(3-2*t),finite=(v,f=0)=>Number.isFinite(v)?v:f;
class V4Journey{
 constructor(o={}){
  this.level=clamp(Math.floor(finite(o.level)),0,11);this.inside=o.inside!==false;this.explore=!!o.explore;this.returning=!!o.returning;
  this.fromAvatar=clamp(finite(o.fromAvatar),0,11);this.fromCamera=clamp(finite(o.fromCamera),0,2);
  this.travelPoint=typeof o.travelPoint==='function'?o.travelPoint:null;this.doorWalkPoint=typeof o.doorWalkPoint==='function'?o.doorWalkPoint:null;this.paceAt=typeof o.paceAt==='function'?o.paceAt:null;this.walkRampMs=140;this.walkSpeed=Number.isFinite(o.walkSpeed)&&o.walkSpeed>0?o.walkSpeed:30.65;
  this.returnDuration=Number.isFinite(o.returnDuration)&&o.returnDuration>0?o.returnDuration:(6+(Timing?.extra||0));this.departDuration=Number.isFinite(o.departDuration)&&o.departDuration>0?o.departDuration:(Timing?.fixedDuration||6.4);
  this.returnState=typeof o.returnState==='function'?o.returnState:null;
  this.reversing=false;this.paused=false;this.done=false;this.elapsed=0;this.pendingMs=0;this.endpointPending=false;
  this.location=this.inside?'inside':'outside';this.avatar=this.inside?0:this.fromAvatar;this.camera=this.inside?0:this.fromCamera;
  this.queue=[];this.segment=null;this.segmentMs=0;this.presentedEndpoints=[];
  if(this.returning){this._mapTo(0);this.queue.push(this._doorway('doorway-in'),{kind:'return',duration:this.returnDuration*1000});}
  else{if(this.inside)this.queue.push({kind:'depart',duration:this.departDuration*1000},this._doorway('doorway-out'));if(!this.explore)this._mapTo(this.level,this.inside?0:this.fromAvatar,this.inside?0:this.fromCamera);}
  this.total=this.queue.reduce((sum,s)=>sum+s.duration,0);this._next();
 }
 _mapTo(target,from=this.avatar,camera=this.camera){
  const follow=clamp(from/4,0,2);if(Math.abs(camera-follow)>.001)this.queue.push({kind:'gather',duration:500,fromCamera:camera,toCamera:follow,avatar:from});
  if(Math.abs(target-from)>.000001){const path=this._path(from,target),ramp=Math.min(this.walkRampMs,path.travelMs);this.queue.push({kind:'walk',duration:path.travelMs+ramp,fromAvatar:from,toAvatar:target,path,ramp});}
 }
 // Measure motion relative to the land. Camera tracking is deliberately held
 // at each sample midpoint, otherwise its pan would cancel the travelled arc.
 // At most 1409 samples are created once per trip; pose() only binary-searches.
 _measure(from,to,count,point,pace){const distances=new Float64Array(count+1),times=new Float64Array(count+1);let total=0,travelMs=0;for(let i=1;i<=count;i++){const a=from+(to-from)*(i-1)/count,b=from+(to-from)*i/count,camera=clamp((a+b)/8,0,2),p=point(a,camera),q=point(b,camera),distance=Math.hypot(q.x-p.x,q.y-p.y),speed=pace((a+b)/2,camera);total+=distance;travelMs+=distance/Math.max(1,speed)*1000;distances[i]=total;times[i]=travelMs;}return{count,distances,times,length:Math.max(.001,total),travelMs:Math.max(.001,travelMs)};}
 _path(from,to){return this._measure(from,to,Math.max(1,Math.ceil(Math.abs(to-from)*128)),(a,c)=>this.travelPoint?this.travelPoint(a,c):{x:a*88,y:0},(a,c)=>this.paceAt?this.paceAt(a,c):this.walkSpeed);}
 _doorway(kind,start){const inward=kind==='doorway-in',from=Number.isFinite(start)?start:(inward?1:0),to=inward?0:1,path=this._measure(from,to,128,a=>this.doorWalkPoint?this.doorWalkPoint(a):{x:a*116,y:0},a=>this.paceAt?this.paceAt(0,0,a):this.walkSpeed),ramp=Math.min(this.walkRampMs,path.travelMs);return{kind,fromAvatar:from,toAvatar:to,path,ramp,duration:path.travelMs+ramp};}
 _walkFraction(s){return Clock.progressAt(this.motionDescriptor(),this.segmentMs/1000);}
 _walkAvatar(s){return Clock.positionParameter(this.motionDescriptor(),this.segmentMs/1000);}
 motionDescriptor(){const s=this.segment;if(!s?.path)return null;return s.motionDescriptor||(s.motionDescriptor={kind:s.kind,from:s.fromAvatar,to:s.toAvatar,count:s.path.count,times:Array.from(s.path.times),duration:s.duration/1000,ramp:s.ramp/1000,clockProfile:'smooth-v1',...(s.brake?{brake:s.brake,travelDuration:s.travelDuration/1000}: {})});}
 _attachBrake(brake){const s=this.queue[0];if(!brake||!s?.path)return;const oldRamp=s.ramp;s.ramp=Math.min(320,s.path.travelMs);s.duration+=s.ramp-oldRamp;s.travelDuration=s.duration;s.brake=brake;s.duration+=brake.duration*1000;}
 _reverseMap(s,p){const brake=Clock.makeBrake(this.motionDescriptor(),this.segmentMs/1000),stop=brake?Clock.brakeEnd(brake):(Number.isFinite(p.doorWalk)?p.doorWalk:p.avatar);
  if(s.kind==='walk'){this.avatar=stop;this.camera=clamp(stop/4,0,2);this._cancelRoute(this.location,this.avatar,this.camera);}
  else if(s.kind==='doorway-out'){this.queue=[this._doorway('doorway-in',stop),{kind:'return',duration:this.returnDuration*1000}];}
  else{this.queue=[this._doorway('doorway-out',stop)];this._mapTo(this.fromAvatar,0,0);}
  this._attachBrake(brake);this.pendingMs=0;if(!this.endpointPending)this._next();
 }
 _next(){this.segment=this.queue.shift()||null;this.segmentMs=0;this.endpointPending=false;if(!this.segment)this.done=true;}
 _cancelRoute(location,avatar,camera){
  this.queue=[];
  if(this.inside){if(location==='outside'){this._mapTo(0,avatar,camera);this.queue.push(this._doorway('doorway-in'),{kind:'return',duration:this.returnDuration*1000});}}
  else{if(location==='inside'){this.queue.push({kind:'depart',duration:this.departDuration*1000},this._doorway('doorway-out'));avatar=0;camera=0;}this._mapTo(this.fromAvatar,avatar,camera);const follow=clamp(this.fromAvatar/4,0,2);if(Math.abs(follow-this.fromCamera)>.001)this.queue.push({kind:'gather',duration:500,fromCamera:follow,toCamera:this.fromCamera,avatar:this.fromAvatar});}
 }
 reverse(){
  if(this.reversing||this.done)return false;this.reversing=true;
  const s=this.segment,p=this.pose();
  if(s?.path)this._reverseMap(s,p);
  else if(s&&(s.kind==='depart'||s.kind==='return'))this._cancelRoute(s.kind==='return'?'inside':'outside',0,0);
  else{this.avatar=p.avatar;this.camera=p.camera;this._cancelRoute(this.location,this.avatar,this.camera);this.pendingMs=0;this._next();}
  return true;
 }
 pause(){this.paused=true;return this.pose();}
 resume(){this.paused=false;return this.pose();}
 update(dt){
  if(this.paused||this.done||!Number.isFinite(dt)||dt<0)return this.pose();
  this.pendingMs+=dt;
  if(!this.segment||this.endpointPending)return this.pose();
  const take=Math.min(this.pendingMs,Math.max(0,this.segment.duration-this.segmentMs));
  this.segmentMs+=take;this.elapsed+=take;this.pendingMs-=take;
  if(this.segmentMs>=this.segment.duration-1e-7){this.segmentMs=this.segment.duration;this.endpointPending=true;}
  const p=this.pose();this.avatar=p.avatar;this.camera=p.camera;return p;
 }
 markRendered(){
  if(!this.endpointPending||!this.segment||this.paused)return false;
  const s=this.segment,p=this.pose();this.presentedEndpoints.push({kind:s.kind,seconds:this.segmentMs/1000});this.avatar=p.avatar;this.camera=p.camera;
  if(s.kind==='depart')this.location='outside';else if(s.kind==='return')this.location='inside';
  this._next();if(this.done)this.pendingMs=0;return true;
 }
 pose(){
  const s=this.segment;
  if(!s)return{stage:'complete',mapOnly:this.location==='outside',cinematic:this.location==='inside',v4Time:0,returning:false,room:this.location==='inside',avatar:this.avatar,camera:this.camera,reversing:this.reversing};
  const u=ease(clamp(this.segmentMs/Math.max(1,s.duration),0,1));
  if(s.kind==='doorway-in'||s.kind==='doorway-out'){const inward=s.kind==='doorway-in',progress=this._walkFraction(s),doorWalk=this._walkAvatar(s,progress);return{stage:s.kind,mapOnly:true,room:false,walkClock:this.segmentMs/1000,walkDuration:s.duration/1000,walkRamp:s.ramp/1000,doorWalk,walkAmount:Clock.speedAt(this.motionDescriptor(),this.segmentMs/1000),avatar:0,camera:0,facing:inward?1:-1,blackFade:inward?clamp((this.segmentMs-(s.duration-160))/160,0,1):1-clamp(this.segmentMs/160,0,1),reversing:this.reversing};}
  if(s.kind==='gather')return{stage:'camera-find',mapOnly:true,room:false,avatar:s.avatar,camera:s.fromCamera+(s.toCamera-s.fromCamera)*u,reversing:this.reversing};
  if(s.kind==='walk'){const progress=this._walkFraction(s),avatar=this._walkAvatar(s,progress);return{stage:s.toAvatar<s.fromAvatar?'return-walking':'walking',mapOnly:true,room:false,walkClock:this.segmentMs/1000,walkDuration:s.duration/1000,walkRamp:s.ramp/1000,avatar,camera:clamp(avatar/4,0,2),facing:s.toAvatar<s.fromAvatar?-1:1,progress,walkAmount:Clock.speedAt(this.motionDescriptor(),this.segmentMs/1000),reversing:this.reversing};}
  const returning=s.kind==='return',sec=this.segmentMs/1000,source=returning?(Timing?Timing.home(sec):sec):(Timing?Timing.out(sec):sec);
  return{stage:returning?'fixed-return':'fixed-exit',cinematic:true,v4Time:sec,returning,room:true,zoom:1,roomSeat:returning?ease(clamp((source-4.9)/1.1,0,1)):1-ease(clamp(source/1.1,0,1)),roomMove:returning?1-ease(clamp(source/3.9,0,1)):ease(clamp((source-1.1)/3.4,0,1)),open:returning?1:clamp((source-4.7)/1.2,0,1),lift:0,yaw:0,avatar:0,camera:0,blackFade:returning?1-clamp(sec/.16,0,1):clamp((sec-(this.departDuration-.16))/.16,0,1),reversing:this.reversing,...(returning&&this.returnState?this.returnState(sec):{})};
 }
}
return V4Journey;
});
