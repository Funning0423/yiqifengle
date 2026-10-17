import type {Node} from 'cc';
import type {Cancellation, CharacterAdapter, Pose, Vec, WorldLease} from '../world-r1/WorldFlowCore';
import {emitTransit, setTransitHidden} from './TransitAudioHooks';
import {beatAt, sailCamera, sailVehicle, seatFromBench, type SailTimeline} from './TransportLeg';
import {applySailScale, attachRider, detachRider, placeBoat} from './TransportVehicle';
/** Drives the sail from foreground frame steps. The journey controller calls `onFrame` while region-travel is active. */
export function createSailDriver(opts:{
 timeline:SailTimeline;route:readonly Vec[];shore:Vec[];boat:Node|null;sail:Node|null;seat:Node|null;rider:Node|null;riderHome:Node|null;
 screen:()=>{w:number;h:number};
}){
 let t=0,last=0,fade=0,attached=false;
 const viewSize=opts.screen;
 const step=(dt:number,hidden:boolean)=>{
  if(hidden){setTransitHidden(true);return;}
  setTransitHidden(false);
  if(fade>0)fade=Math.max(0,fade-dt);
  const prev=beatAt(opts.timeline,t).id;
  t+=Math.max(0,dt);
  const beat=beatAt(opts.timeline,t);
  if(beat.id!==prev&&beat.cue)emitTransit(beat.cue as any,{t,region:'meadow',id:beat.id});
  if(prev==='S-d'&&beat.id!=='S-d')emitTransit('sail-cruise-loop-stop',{t,region:'meadow'});
  const v=sailVehicle(opts.timeline,opts.route,t);
  if(opts.boat)placeBoat(opts.boat,v.pos,v.yaw,v.roll);
  applySailScale(opts.sail,v.sail);
  if(beat.id==='S-c'&&!attached&&opts.rider&&opts.seat){attachRider(opts.rider,opts.seat);attached=true;}
  if(beat.id==='S-f'&&attached&&opts.rider&&opts.riderHome){detachRider(opts.rider,opts.riderHome);attached=false;}
 };
 return {
  get t(){return t;},
  pose(screen:{w:number;h:number}):Pose{return sailCamera(opts.timeline,opts.route,t,screen);},
  onFrame(dt:number,hidden:boolean):Pose{
   const now=Date.now();if(last&&now-last>30000)fade=0.35;last=now;step(dt,hidden);
   const v=viewSize();
   return sailCamera(opts.timeline,opts.route,t,v);
  },
  get fade(){return fade;},
  seat(){const v=sailVehicle(opts.timeline,opts.route,t);return seatFromBench(v.pos,v.yaw);},
  shore(){return opts.shore;},
 };
}
export async function playSailBeats(driver:ReturnType<typeof createSailDriver>,actor:CharacterAdapter,world:WorldLease,token:Cancellation,plan:{total:number;approach:Vec[];deck:Vec[];shore:Vec[];sit:ReturnType<typeof seatFromBench>;stand:ReturnType<typeof seatFromBench>;boardS:number;shoreS:number}):Promise<void>{
 const wait=async()=>{token.check();if(world.wait)await world.wait(0.05,token);else driver.onFrame(1/60,!!world.isWorldVisible&&!world.isWorldVisible());};
 const until=async(time:number)=>{while(driver.t+1e-3<time)await wait();};
 await actor.perform({kind:'walk',path:plan.approach,duration:7.6},token);
 await actor.perform({kind:'walk',path:[plan.approach[plan.approach.length-1],plan.deck],duration:1},token);
 await actor.perform({kind:'sit',seat:plan.sit},token);
 await until(plan.total-plan.shoreS-1.3-plan.boardS);
 await actor.perform({kind:'stand',seat:plan.stand},token);
 await actor.perform({kind:'walk',path:plan.shore,duration:plan.shoreS},token);
 await until(plan.total);
}
