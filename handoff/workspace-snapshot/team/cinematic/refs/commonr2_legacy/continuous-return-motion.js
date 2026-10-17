'use strict';
/* Positive-time return in the same registered world. Spatial outbound route is
 * read once; outbound camera/time is never reversed. Fixed map overview,
 * then a masked camera-only cut to the original fixed room. No mesh/world/seat relocation. */
const Out=require('./continuous-interaction-provider'),Seat=require('./continuous-seat-stand');
const Alignment=require('./original-room-alignment'),Height=require('./continuous-return-height');
const Cloth=require('./continuous-cloth-wrapper'),Door=require('./door-interaction'),Contact=require('./return-door-contact');
const R=Alignment.getRegistration(),SCALE=R.girlScale,DURATION=16.65;
const T={turnEnd:.9,approachJoin:4.994623655913978,catchEnd:6.5,reachStart:6.1,contact:6.6,closeStart:6.8,closeEnd:9.55,releaseEnd:9.9,inwardTurnEnd:10.55,walkEnd:15,seatTurnEnd:16,duration:DURATION};
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const mix=(a,b,u)=>a.map((x,i)=>x+(b[i]-x)*u),clone=x=>JSON.parse(JSON.stringify(x)),dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const endpoint=Out.camera.sample(18),poseEndpoint=Out.evaluate(18),seatStanding=Seat.evaluateRaw(.65);
const stand=seatStanding.root.position.map(x=>x*SCALE),raw=[endpoint.girl.position.slice()];
// Arc-length sampling means time changes do not accelerate one source segment.
for(let i=1;i<=2400;i++){const t=17.2-(17.2-1.1)*i/2400,p=Out.camera.sample(t).girl.position.slice(),correction=stand.map((v,k)=>v-Out.camera.sample(1.1).girl.position[k]);for(let k=0;k<3;k++)p[k]+=correction[k]*(1-ease((t-1.1)/.9));if(dist(p,raw.at(-1))>1e-8)raw.push(p);}
raw[raw.length-1]=stand.slice();const arc=[0];for(let i=1;i<raw.length;i++)arc.push(arc.at(-1)+dist(raw[i],raw[i-1]));const LENGTH=arc.at(-1);
function positionAt(d){d=Math.max(0,Math.min(LENGTH,d));let lo=0,hi=arc.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(arc[m]<d)lo=m;else hi=m;}return mix(raw[lo],raw[hi],(d-arc[lo])/(arc[hi]-arc[lo]));}
// Keep the established outside route until near the door; the new body path
// catches the ring while passing, steps inward while pulling, then goes to seat.
function oldDistanceAt(t){const D=9.5-.9,r=.45,x=Math.max(0,Math.min(D,t-.9)),I=u=>u*u*u*u*(2.5+u*(-3+u));let d;if(x<r)d=r*I(x/r);else if(x>D-r)d=D-r-r*I((D-x)/r);else d=x-r/2;return d/(D-r)*LENGTH;}
function approachTime(t){return .9+(t-.9)*4.65/(T.catchEnd-.9);}
function shortest(a,b){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a));}
function oldHeading(d){const a=positionAt(d-.045),b=positionAt(d+.045);return Math.atan2(b[0]-a[0],b[2]-a[2]);}
function angleAt(t){return 86.4*(1-travel(t,T.closeStart,T.closeEnd));}
function closeRoot(angle){const h=Door.handleAtAngle(angle),a=angle*Math.PI/180;return[h.point[0]-.46*Math.sin(a)+.30*Math.cos(a),0,h.point[2]-.46*Math.cos(a)-.30*Math.sin(a)];}
const catchRoot=closeRoot(86.4),insideRoot=closeRoot(0),joinRoot=positionAt(oldDistanceAt(approachTime(T.approachJoin))),joinVelocity=mix(positionAt(oldDistanceAt(approachTime(T.approachJoin-.001))),positionAt(oldDistanceAt(approachTime(T.approachJoin+.001))),0).map((_,i)=>(positionAt(oldDistanceAt(approachTime(T.approachJoin+.001)))[i]-positionAt(oldDistanceAt(approachTime(T.approachJoin-.001)))[i])/.002);
const inward=shortest(endpoint.girl.yaw,oldHeading(0)),catchYaw=shortest(inward,86.4*Math.PI/180),chairYaw=shortest(0,Math.atan2(stand[0]-insideRoot[0],stand[2]-insideRoot[2])),targetYaw=shortest(chairYaw,Seat.seatedYaw);
function hermite(a,b,va,vb,u,d){u=clamp(u);return a.map((v,i)=>(2*u*u*u-3*u*u+1)*v+(u*u*u-2*u*u+u)*d*va[i]+(-2*u*u*u+3*u*u)*b[i]+(u*u*u-u*u)*d*vb[i]);}
function travel(t,start,end){const D=end-start,r=start===T.inwardTurnEnd?.7:.3,x=Math.max(0,Math.min(D,t-start)),I=u=>u*u*u*u*(2.5+u*(-3+u));return(x<r?r*I(x/r):x>D-r?D-r-r*I((D-x)/r):x-r/2)/(D-r);}
function rootAt(t){if(t<T.approachJoin)return positionAt(oldDistanceAt(approachTime(t)));if(t<T.catchEnd)return hermite(joinRoot,catchRoot,joinVelocity,[0,0,0],(t-T.approachJoin)/(T.catchEnd-T.approachJoin),T.catchEnd-T.approachJoin);if(t<T.closeEnd)return closeRoot(angleAt(t));if(t<T.inwardTurnEnd)return insideRoot.slice();if(t<T.walkEnd)return mix(insideRoot,stand,travel(t,T.inwardTurnEnd,T.walkEnd));if(t<T.seatTurnEnd)return stand.slice();return Seat.evaluateRaw(Math.max(0,DURATION-t)).root.position.map(x=>x*SCALE);}
function yawAt(t){if(t<T.turnEnd)return endpoint.girl.yaw+(inward-endpoint.girl.yaw)*ease(t/T.turnEnd);if(t<T.approachJoin)return shortest(inward,oldHeading(oldDistanceAt(approachTime(t))));if(t<T.catchEnd){const a=shortest(inward,oldHeading(oldDistanceAt(approachTime(T.approachJoin))));return a+(shortest(a,catchYaw)-a)*ease((t-T.approachJoin)/(T.catchEnd-T.approachJoin));}if(t<T.closeEnd)return shortest(catchYaw,angleAt(t)*Math.PI/180);if(t<T.releaseEnd)return shortest(catchYaw,0);if(t<T.inwardTurnEnd){const a=shortest(catchYaw,0);return a+(shortest(a,chairYaw)-a)*ease((t-T.releaseEnd)/(T.inwardTurnEnd-T.releaseEnd));}if(t<T.walkEnd)return shortest(catchYaw,chairYaw);if(t<T.seatTurnEnd)return shortest(catchYaw,chairYaw)+(shortest(chairYaw,targetYaw)-chairYaw)*ease((t-T.walkEnd)/(T.seatTurnEnd-T.walkEnd));return shortest(catchYaw,targetYaw);}
const routeArc=[0],ARC_RATE=120;for(let i=1;i<=Math.ceil(DURATION*ARC_RATE);i++)routeArc.push(routeArc[i-1]+dist(rootAt(Math.min(DURATION,i/ARC_RATE)),rootAt((i-1)/ARC_RATE)));
function distanceAt(t){const u=Math.max(0,Math.min(DURATION,t))*ARC_RATE,i=Math.min(routeArc.length-2,Math.floor(u));return routeArc[i]+(routeArc[i+1]-routeArc[i])*(u-i);}
// Ordinary map travel uses one fixed overview. Once the full character has
// crossed the doorway, a 200 ms dip to dark changes only the camera to the
// original fixed interior. The body/world time never resets or crossfades.
const metadata={mapPhaseEnd:T.catchEnd,closePhaseDuration:DURATION-T.catchEnd,transition:{kind:'dip-to-dark',start:6.4,cutAt:6.5,blackoutStart:6.47,blackoutEnd:6.53,end:6.6,color:[0,0,0]}};
function transitionAt(t){const q=metadata.transition,active=t>=q.start&&t<=q.end,opacity=!active?0:t<q.blackoutStart?ease((t-q.start)/(q.blackoutStart-q.start)):t<=q.blackoutEnd?1:1-ease((t-q.blackoutEnd)/(q.end-q.blackoutEnd));return{...q,active,opacity};}
function cameraAt(t){return clone(t<metadata.transition.cutAt?endpoint.camera:R.camera);}
function sample(seconds){if(!Number.isFinite(seconds))throw TypeError('Finite return seconds required');const t=Math.max(0,Math.min(DURATION,seconds));return{time:t,returning:true,camera:cameraAt(t),transition:transitionAt(t),returnPhase:t<metadata.mapPhaseEnd?'map-walk':'close-entry',girl:{position:rootAt(t),yaw:yawAt(t),speed:dist(rootAt(Math.min(DURATION,t+.002)),rootAt(Math.max(0,t-.002)))/.004,distance:distanceAt(t),sit:t<=DURATION-.65?0:ease((t-(DURATION-.65))/.65)},doorAngle:angleAt(t),phase:t<T.turnEnd?'turn-home':t<T.catchEnd?'approach-door':t<T.closeStart?'hold-door':t<T.closeEnd?'pull-door':t<T.releaseEnd?'release-door':t<T.inwardTurnEnd?'turn-inward':t<T.walkEnd?'walk-home':t<T.seatTurnEnd?'turn-seat':'sit-home'};}
const route=Height.withCamera({sample},{initialTime:0,initialPose:poseEndpoint,terminalPose:seatStanding,footGeometry:require('./white-character').getFootGeometry(),windows:[
{name:'turn-home',start:0,end:T.turnEnd,steps:2},
{name:'approach-door',start:T.turnEnd,end:T.catchEnd,steps:18,lookahead:.5,launchWeights:[.35,.85],startupSteps:2,startupLead:.5,closingWeights:[.85,.25]},
{name:'pull-door',start:T.closeStart,end:T.closeEnd,steps:7,backward:true,lookahead:.5,launchWeights:[.65,.85],startupSteps:2,startupLead:.8,closingWeights:[.7,.7]},
{name:'turn-inward',start:T.releaseEnd,end:T.inwardTurnEnd,steps:2},
{name:'walk-home',start:T.inwardTurnEnd,end:T.walkEnd,steps:14,lookahead:.5,launchWeights:[.35,.85],startupSteps:2,startupLead:.5,closingWeights:[.85,.25]},
{name:'turn-seat',start:T.walkEnd,end:T.seatTurnEnd,steps:2}
]});
function evaluate(seconds){if(!Number.isFinite(seconds))throw TypeError('Finite return seconds required');const t=Math.max(0,Math.min(DURATION,seconds));if(t<T.seatTurnEnd){const p=Contact.apply(require('./chair-foot-clearance').apply(route.evaluate(t)),t,T,angleAt(t));p.duration=DURATION;p.returning=true;p.doorAngle=sample(t).doorAngle;return p;}
const seatTime=Math.max(0,DURATION-t),p=Seat.evaluate(seatTime);p.returnTime=t;p.time=t;p.seatTime=seatTime;p.duration=DURATION;p.returning=true;p.doorAngle=sample(t).doorAngle;return p;}
function journeyPose(t){t=Math.max(0,Math.min(DURATION,t));return{room:rootAt(t)[2]<0,open:angleAt(t)/86.4,roomSeat:ease((t-T.seatTurnEnd)/(DURATION-T.seatTurnEnd)),roomMove:1-travel(t,T.inwardTurnEnd,T.walkEnd)};}
function makeModel(p){return p.seatTime!==undefined?Seat.makeModel({...p,time:p.seatTime}):Cloth.makeModel(p);}
module.exports={duration:DURATION,DURATION,sample,evaluate,makeModel,camera:{sample},route,routeLength:LENGTH,distanceAt,positionAt,rootAt,yawAt,timings:T,angleAt,catchRoot,insideRoot,metadata,transition:metadata.transition,transitionAt,registration:R,scale:SCALE,journeyPose};
