import type {Node} from 'cc';
import type {Cancellation, CharacterAdapter, Pose, Vec, WorldLease} from '../world-r1/WorldFlowCore';
import {emitTransit, setTransitHidden} from './TransitAudioHooks';
import {beatAt, sailCamera, sailVehicle, seatFromBench, SAIL_LIMITS, type SailTimeline} from './TransportLeg';
import {attachRider, detachRider, placeBoat} from './TransportVehicle';
import type {SailArt} from './SailArt';
function sailNight():boolean{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}}
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smoother=(u:number)=>{const t=Math.min(1,Math.max(0,u));return t*t*t*(t*(t*6-15)+10);};
function followCam(path:readonly Vec[],u:number,from:Pose,to:Pose):Pose{
 const s=smoother(Math.min(1,Math.max(0,u)));
 const dist=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 let L=0;for(let i=1;i<path.length;i++)L+=dist(path[i-1],path[i]);
 let left=L*Math.min(1,Math.max(0,u)),at=path[0];
 for(let i=1;i<path.length;i++){
  const d=dist(path[i-1],path[i]);if(d>0&&left<=d){const t=left/d;at=[lerp(path[i-1][0],path[i][0],t),lerp(path[i-1][1],path[i][1],t),lerp(path[i-1][2],path[i][2],t)];break;}
  left-=d;at=path[i];
 }
 // Blend K6 → board pose while tracking her from behind-right (same family as region node walks).
 const back=4.8,side=-1.6,up=2.6;
 const yaw=path.length>1?Math.atan2(path[path.length-1][0]-path[0][0],path[path.length-1][2]-path[0][2]):0;
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
 let t=0,last=0,fade=0,attached=false;
 let phase:'sail'|'arrival'='sail';
 let arrivalPath:Vec[]=opts.shore,arrivalU=0,arrivalFrom:Pose|null=null;
 const viewSize=opts.screen;
 const seated=()=>beatAt(opts.timeline,t).id==='S-c'||beatAt(opts.timeline,t).id==='S-d'||beatAt(opts.timeline,t).id==='S-e';
 const step=(dt:number,hidden:boolean)=>{
  if(hidden){setTransitHidden(true);return;}
  setTransitHidden(false);
  if(fade>0)fade=Math.max(0,fade-dt);
  if(phase==='arrival')return;
  const prev=beatAt(opts.timeline,t).id;
  t+=Math.max(0,dt);
  const beat=beatAt(opts.timeline,t);
  if(beat.id!==prev&&beat.cue)emitTransit(beat.cue as any,{t,region:'meadow',id:beat.id});
  if(prev==='S-d'&&beat.id!=='S-d')emitTransit('sail-cruise-loop-stop',{t,region:'meadow'});
  const v=sailVehicle(opts.timeline,opts.route,t);
  if(opts.boat)placeBoat(opts.boat,v.pos,v.yaw,v.roll);
  if(seated()&&!attached&&opts.rider&&opts.seat){attachRider(opts.rider,opts.seat);attached=true;}
  if(attached&&opts.rider&&seated()){opts.rider.setPosition(0,0,0);opts.rider.setRotationFromEuler(0,0,0);}
  if(beat.id==='S-f'&&attached&&opts.rider&&opts.riderHome){detachRider(opts.rider,opts.riderHome);attached=false;}
  const pose=sailCamera(opts.timeline,opts.route,t,viewSize());
  opts.art?.sync(v,pose.position,dt,sailNight(),pose.target);
 };
 return {
  get t(){return t;},
  get phase(){return phase;},
  beginArrival(path:Vec[]){
   phase='arrival';arrivalPath=path;arrivalU=0;
   arrivalFrom=sailCamera(opts.timeline,opts.route,Math.min(t,opts.timeline.build05S),viewSize());
  },
  setArrivalU(u:number){arrivalU=Math.min(1,Math.max(0,u));},
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
    return pose;
   }
   return sailCamera(opts.timeline,opts.route,t,v);
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
 const wait=async()=>{token.check();if(world.wait)await world.wait(0.05,token);else driver.onFrame(1/60,!!world.isWorldVisible&&!world.isWorldVisible());};
 const until=async(time:number)=>{while(driver.t+1e-3<time)await wait();};
 await actor.perform({kind:'walk',path:plan.approach,duration:7.6},token);
 await actor.perform({kind:'walk',path:[plan.approach[plan.approach.length-1],plan.deck],duration:1},token);
 await actor.perform({kind:'sit',seat:plan.sit},token);
 // Sail clock ends when she steps onto the jetty (S-g).
 await until(plan.total-plan.boardS);
 await actor.perform({kind:'stand',seat:plan.stand},token);
 await actor.perform({kind:'walk',path:plan.disembark,duration:plan.boardS},token);
 await until(plan.total);
 // Arrival walk: jetty → path → M0 (region-style follow cam). Not part of the 30.5 s sail budget.
 if(plan.arrival.length>1){
  driver.beginArrival(plan.arrival);
  const dur=Math.min(Math.max(0.5,plan.arrivalS),12);
  const walking=actor.perform({kind:'walk',path:plan.arrival,duration:dur},token);
  const tick=async()=>{
   const t0=Date.now();
   while(true){
    token.check();
    const u=Math.min(1,(Date.now()-t0)/(dur*1000));
    driver.setArrivalU(u);
    if(u>=1)break;
    if(world.wait)await world.wait(0.05,token);else await new Promise(r=>setTimeout(r,50));
   }
  };
  await Promise.all([walking,tick()]);
  driver.setArrivalU(1);
 }
}
