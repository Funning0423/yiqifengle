import type {Node} from 'cc';
import type {Cancellation, CharacterAdapter, Pose, Vec, WorldLease} from '../world-r1/WorldFlowCore';
import {emitTransit, setTransitHidden} from './TransitAudioHooks';
import {beatAt, sailCamera, sailPresentationT, sailVehicle, seatFromBench, type SailTimeline} from './TransportLeg';
import {attachRider, detachRider, placeBoat} from './TransportVehicle';
import type {SailArt} from './SailArt';
import {pushSailCue, pushSailFrame, sailQaEnabled} from './SailQaProbe';
function sailNight():boolean{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}}
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smoother=(u:number)=>{const t=Math.min(1,Math.max(0,u));return t*t*t*(t*(t*6-15)+10);};
const pathLen=(path:readonly Vec[])=>{let L=0;for(let i=1;i<path.length;i++)L+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1],path[i][2]-path[i-1][2]);return L;};
function followCam(path:readonly Vec[],u:number,from:Pose,to:Pose):Pose{
 const s=smoother(Math.min(1,Math.max(0,u)));
 const dist=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 let L=0;for(let i=1;i<path.length;i++)L+=dist(path[i-1],path[i]);
 let left=L*Math.min(1,Math.max(0,u)),at=path[0],yaw=0;
 for(let i=1;i<path.length;i++){
  const d=dist(path[i-1],path[i]);
  const seg=Math.atan2(path[i][0]-path[i-1][0],path[i][2]-path[i-1][2]);
  if(d>0&&left<=d){const k=left/d;at=[lerp(path[i-1][0],path[i][0],k),lerp(path[i-1][1],path[i][1],k),lerp(path[i-1][2],path[i][2],k)];yaw=seg;break;}
  left-=d;at=path[i];yaw=seg;
 }
 const back=4.8,side=-1.6,up=2.6;
 const fx=Math.sin(yaw),fz=Math.cos(yaw),rx=fz,rz=-fx;
 const follow:Pose={
  position:[at[0]-fx*back+rx*side,at[1]+up,at[2]-fz*back+rz*side],
  target:[at[0],at[1]+1.1,at[2]],
  fovVerticalDeg:lerp(from.fovVerticalDeg||48,to.fovVerticalDeg||48,s),
 };
 return {
  position:[lerp(from.position[0],follow.position[0],s),lerp(from.position[1],follow.position[1],s),lerp(from.position[2],follow.position[2],s)],
  target:[lerp(from.target[0],follow.target[0],s),lerp(from.target[1],follow.target[1],s),lerp(from.target[2],follow.target[2],s)],
  fovVerticalDeg:follow.fovVerticalDeg,
 };
}
/** Drives the sail from foreground frame steps. The journey controller calls `onFrame` while region-travel is active. */
export function createSailDriver(opts:{
 timeline:SailTimeline;route:readonly Vec[];shore:Vec[];boat:Node|null;sail:Node|null;seat:Node|null;rider:Node|null;riderHome:Node|null;
 art?:SailArt|null;
 screen:()=>{w:number;h:number};
 boardPose?:Pose|null;
}){
 let t=0,real=0,departAt:number|null=null,motionBudget=opts.timeline.speed.motionS,last=0,fade=0,attached=false;
 let phase:'sail'|'arrival'='sail';
 let arrivalPath:Vec[]=opts.shore,arrivalU=0,arrivalElapsed=0,arrivalDur=1,arrivalFrom:Pose|null=null;
 const fired=new Set<string>();
 const viewSize=opts.screen;
 const sc=opts.timeline.beats.find(b=>b.id==='S-c')!,se=opts.timeline.beats.find(b=>b.id==='S-e')!;
 const seated=()=>attached&&(beatAt(opts.timeline,t).id==='S-c'||beatAt(opts.timeline,t).id==='S-d'||beatAt(opts.timeline,t).id==='S-e');
 const emitCrossed=(prevT:number,nextT:number)=>{
  for(const b of opts.timeline.beats){
   if(!b.cue||fired.has(b.id))continue;
   if(b.t0>prevT+1e-4&&b.t0<=nextT+1e-4){fired.add(b.id);emitTransit(b.cue as any,{t:nextT,region:'meadow',id:b.id});pushSailCue(b.cue,nextT);}
  }
  const sd=opts.timeline.beats.find(b=>b.id==='S-d')!;
  if(!fired.has('sail-cruise-loop-stop')&&prevT<sd.t1-1e-4&&nextT>=sd.t1-1e-4){fired.add('sail-cruise-loop-stop');emitTransit('sail-cruise-loop-stop',{t:nextT,region:'meadow'});pushSailCue('sail-cruise-loop-stop',nextT);}
 };
 const step=(dt:number,hidden:boolean)=>{
  if(hidden){setTransitHidden(true);return;}
  setTransitHidden(false);
  if(fade>0)fade=Math.max(0,fade-dt);
  if(phase==='arrival'){arrivalElapsed+=Math.max(0,dt);arrivalU=Math.min(1,arrivalElapsed/Math.max(1e-3,arrivalDur));return;}
  const prevT=t;
  real+=Math.max(0,dt);
  t=sailPresentationT(real,departAt,sc.t0,se.t1,opts.timeline.build05S,motionBudget);
  emitCrossed(prevT,t);
  const v=sailVehicle(opts.timeline,opts.route,t);
  if(opts.boat)placeBoat(opts.boat,v.pos,v.yaw,v.roll);
  if(seated()&&opts.rider){opts.rider.setPosition(0,0.04,0);opts.rider.setRotationFromEuler(0,0,0);}
  const pose=sailCamera(opts.timeline,opts.route,t,viewSize());
  opts.art?.sync(v,pose.position,dt,sailNight(),pose.target);
 };
 return {
  get t(){return t;},
  get real(){return real;},
  get phase(){return phase;},
  get arrivalU(){return arrivalU;},
  get departed(){return departAt!=null;},
  bindRider(node:Node){opts.rider=node;opts.riderHome=node.parent;},
  /** Sit has finished. Attach her to the seat, then let the hull leave. `budget` is real seconds for S-c..S-e. */
  depart(budget:number){
   if(departAt!=null)return;
   motionBudget=budget;
   if(!opts.rider||!opts.seat){console.error('[QF_SAIL] cannot depart: rider or seat missing');throw Error('sail-rider-missing');}
   attachRider(opts.rider,opts.seat);opts.rider.setPosition(0,0.04,0);attached=true;
   departAt=real;
  },
  releaseRider(){if(attached&&opts.rider&&opts.riderHome){detachRider(opts.rider,opts.riderHome);attached=false;}},
  beginArrival(path:Vec[],dur:number){
   phase='arrival';arrivalPath=path;arrivalU=0;arrivalElapsed=0;arrivalDur=Math.max(0.5,dur);
   arrivalFrom=sailCamera(opts.timeline,opts.route,Math.min(t,opts.timeline.build05S),viewSize());
  },
  pose(screen:{w:number;h:number}):Pose{
   if(phase==='arrival'&&arrivalFrom){
    const board=opts.boardPose||arrivalFrom;
    return followCam(arrivalPath,arrivalU,arrivalFrom,board);
   }
   return sailCamera(opts.timeline,opts.route,t,screen);
  },
  onFrame(dt:number,hidden:boolean):Pose{
   const now=Date.now();if(last&&now-last>30000)fade=0.35;last=now;step(dt,hidden);
   const v=viewSize();
   if(phase==='arrival'&&arrivalFrom){
    const board=opts.boardPose||arrivalFrom;
    const pose=followCam(arrivalPath,arrivalU,arrivalFrom,board);
    const boat=sailVehicle(opts.timeline,opts.route,opts.timeline.build05S);
    opts.art?.sync(boat,pose.position,dt,sailNight(),pose.target);
    if(sailQaEnabled())pushSailFrame({t:arrivalElapsed,beat:'arrival',phase,yaw:boat.yaw,roll:boat.roll,boat:opts.boat,pose});
    return pose;
   }
   const pose=sailCamera(opts.timeline,opts.route,t,v);
   if(sailQaEnabled()){const sv=sailVehicle(opts.timeline,opts.route,t);pushSailFrame({t,beat:beatAt(opts.timeline,t).id,phase,yaw:sv.yaw,roll:sv.roll,boat:opts.boat,pose});}
   return pose;
  },
  get fade(){return fade;},
  seat(){const v=sailVehicle(opts.timeline,opts.route,t);return seatFromBench(v.pos,v.yaw);},
  shore(){return opts.shore;},
 };
}
export async function playSailBeats(driver:ReturnType<typeof createSailDriver>,actor:CharacterAdapter,world:WorldLease,token:Cancellation,plan:{
 total:number;approach:Vec[];deck:Vec[];disembark:Vec[];arrival:Vec[];sit:ReturnType<typeof seatFromBench>;stand:ReturnType<typeof seatFromBench>;
 boardS:number;arrivalS:number;boardPose?:Pose|null;
}):Promise<void>{
 const rider=(actor as {node?:Node}).node;
 if(!rider){console.error('[QF_SAIL] FlowReferenceStandin has no node; sail ride aborted');throw Error('sail-rider-missing');}
 driver.bindRider(rider);
 const wait=async()=>{token.check();if(world.wait)await world.wait(0.05,token);else driver.onFrame(1/60,!!world.isWorldVisible&&!world.isWorldVisible());};
 const until=async(time:number)=>{while(driver.t+1e-3<time)await wait();};
 const walk=(path:Vec[],stop:boolean)=>{const L=pathLen(path);const duration=Math.max(0.35,L/1.2);return actor.perform({kind:'walk',path,duration,stopAtEnd:stop} as any,token);};
 const board=[...plan.approach,plan.deck,plan.sit.position as unknown as Vec];
 await walk(board,true);
 await actor.perform({kind:'sit',seat:plan.sit},token);
 const standS=actor.actionSeconds?.('stand')||1.2;
 const offS=Math.max(0.35,pathLen(plan.disembark)/1.2);
 const sf=1;
 const used=driver.real;
 const motionBudget=Math.max(4,30.5-used-sf-standS-offS);
 driver.depart(motionBudget);
 await until(plan.total-plan.boardS);
 driver.releaseRider();
 await actor.perform({kind:'stand',seat:plan.stand},token);
 await walk(plan.disembark,true);
 await until(plan.total);
 if(plan.arrival.length>1){
  const dur=pathLen(plan.arrival)/1.2;
  driver.beginArrival(plan.arrival,dur);
  const walking=walk(plan.arrival,true);
  while(driver.arrivalU<1-1e-4)await wait();
  await walking;
 }
}
