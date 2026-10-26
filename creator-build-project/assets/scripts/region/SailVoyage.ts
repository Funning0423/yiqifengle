import type {Pose, Vec} from '../world-r1/WorldFlowCore';
import {debugSearch} from './DebugQuery';
import {sailBeats, sailCamera, sailM0World, sailSpeed, sailVehicle, type SailScreen, type SailTimeline} from './TransportLeg';
/**
 * 运镜bot sail-voyage, option E (场景设计部 sea-distance PROPOSAL 2026-10-26, Grok Bot approved for full8).
 * The real meadow stays hidden until an off-frame swap; a 0.7 stand-in sits ~480 m out on the same bearing.
 * Beats, in the boat→destination bearing frame (destination = sailM0World() from the node anchors, never a literal):
 *   dock (S-a end, S-b)  astern, low: horizon + stand-in with the windmill clear of the sail (2–4 % of frame height);
 *   sail-up swing        time-keyed over S-c (boat barely moving), dock → beam;
 *   open sea             beam lens on the destination-left side, looking across the boat away from both islands
 *                        (whole hull and rig in frame); the stand-in → real swap happens here, both off-frustum;
 *   approach             progress-keyed swing to an astern lens on the destination line, the meadow grows to ~35 %.
 * Boat clock unchanged (sailBeats, 3.6 m/s, cruise 8.22 s). OFF by default: flipped by the golden re-baseline commit
 * (tools/sail-voyage/rebaseline.cjs) once the Mac engine frames exist. First frame = live lens (sailCamera at S-a start).
 */
/** Web QA only: `?sailVoyage=1` turns the voyage lens on for the Mac capture (capture-spec.json). WeChat has no location → off. */
function voyageQuery():boolean{try{return /[?&]sailVoyage=1(?:&|$)/.test(debugSearch());}catch{return false;}}
export const SAIL_VOYAGE={enabled:voyageQuery(),extraCruiseS:0,dockBlendS:5,swing1S:4.0,destScale:1,
 dest:null as Vec|null/* override; default sailM0World() */};
/** back: along the bearing (− = ahead); side: + = right of the bearing (TransportLeg convention, +X port when heading +Z). */
type Off={back:number;side:number;up:number;fov:number;look:number;ls:number;ly:number};
const o=(p:Partial<Off>&{back:number;side:number;up:number;fov:number}):Off=>({look:0,ls:0,ly:1.05,...p});
/** Dock: astern and a little to the left of the line so the stand-in clears the main sail (scan 2026-10-26). */
const DOCK=o({back:10,side:-1.5,up:3.4,fov:44,look:6,ly:1.6});
/** Beam: 15 m off the destination-left side, looking across the hull to open water (prototype bearing kept, lens pulled out
 *  so the 4.2 m hull and the rig fit the ~22° portrait width). */
const SEA=o({back:-5.1,side:-14.1,up:3.2,fov:46,look:-10.3,ls:28.2,ly:1.6})/* lens 15 m out on a line 20° off the beam, looking back-across through the boat: the hull sits on the view axis */;
/** Approach: astern on the destination line (left quarter, same side as the beam → short swing). */
const APP=o({back:12,side:-2,up:3,fov:66,look:3.2});
export const SAIL_VOYAGE_P={sea1:0.70,app0:0.93} as const;
const clamp=(x:number)=>Math.min(1,Math.max(0,x));
const sm=(u:number)=>{const t=clamp(u);return t*t*t*(t*(t*6-15)+10);};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
function arc(a:Off,b:Off,u:number,fovLead=1,damp=0.6):Off{
 const s=sm(u);let ta=Math.atan2(a.side,a.back),tb=Math.atan2(b.side,b.back),d=tb-ta;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
 const th=ta+d*s,r=lerp(Math.hypot(a.back,a.side),Math.hypot(b.back,b.side),s),sf=sm(u/fovLead);
 // Mid-swing the look point pulls onto her seat, so the off-axis bearing cannot push her head past the frame edge (|ndc| ≤ 0.9).
 const w=damp*Math.sin(Math.PI*s)**2;
 return {back:Math.cos(th)*r,side:Math.sin(th)*r,up:lerp(a.up,b.up,s),fov:lerp(a.fov,b.fov,sf),look:lerp(a.look,b.look,s)*(1-w)-0.55*w,ls:lerp(a.ls,b.ls,s)*(1-w),ly:lerp(a.ly,b.ly,s)};
}
/** Offset at Build05 time t / route progress p. */
export function voyageOffset(tl:SailTimeline,t:number,p:number):Off{
 const sc=tl.beats.find(b=>b.id==='S-c')!,P=SAIL_VOYAGE_P;
 if(t<sc.t0)return DOCK;
 const u1=(t-sc.t0)/SAIL_VOYAGE.swing1S;
 if(u1<1)return arc(DOCK,SEA,u1,1,1);
 if(p<=P.sea1)return SEA;
 if(p<P.app0)return arc(SEA,APP,(p-P.sea1)/(P.app0-P.sea1),0.25);
 return APP;
}
/** Kept for the E-slow option (3.2 m/s); unused while the boat stays at 3.6 m/s. */
export function voyageBeats(routeM:number,extra:number=SAIL_VOYAGE.extraCruiseS):SailTimeline{
 const base=sailBeats(routeM),sp=sailSpeed(routeM,base.speed.cruiseS+Math.max(0,extra));
 const beats=base.beats.map(b=>({...b}));let t=beats[1].t1;
 const dur:Record<string,number>={'S-c':sp.accelS,'S-d':sp.cruiseS,'S-e':sp.decelS};
 for(let i=2;i<beats.length;i++){const d=dur[beats[i].id]??(beats[i].t1-beats[i].t0);beats[i].t0=t;beats[i].t1=t+d;t+=d;}
 return {...base,beats,speed:sp,build05S:t,totalS:sp.motionS+(beats[1].t1-beats[1].t0)+(beats[5].t1-beats[5].t0)};
}
function voyagePose(tl:SailTimeline,route:readonly Vec[],t:number,dest:Vec):Pose{
 const v=sailVehicle(tl,route,t),p=clamp(v.distance/Math.max(1e-3,tl.speed.length)),f=voyageOffset(tl,t,p);
 const bx=dest[0]-v.pos[0],bz=dest[2]-v.pos[2],yaw=Math.hypot(bx,bz)>1?Math.atan2(bx,bz):v.yaw;
 const fx=Math.sin(yaw),fz=Math.cos(yaw),rx=fz,rz=-fx;
 return {position:[v.pos[0]-fx*f.back+rx*f.side,v.pos[1]+f.up,v.pos[2]-fz*f.back+rz*f.side],
  target:[v.pos[0]+fx*f.look+rx*f.ls,v.pos[1]+f.ly,v.pos[2]+fz*f.look+rz*f.ls],fovVerticalDeg:f.fov};
}
/** Drop-in for sailCamera when SAIL_VOYAGE.enabled. S-a starts on the live sailCamera lens and eases onto the dock shot. */
export function sailVoyageCamera(tl:SailTimeline,route:readonly Vec[],t:number,screen:SailScreen={w:390,h:844}):Pose{
 const sa=tl.beats.find(b=>b.id==='S-a')!,dest=SAIL_VOYAGE.dest||sailM0World(),vp=voyagePose(tl,route,t,dest);
 if(t>=sa.t1)return vp;
 const u=(t-(sa.t1-SAIL_VOYAGE.dockBlendS))/SAIL_VOYAGE.dockBlendS,a=sailCamera(tl,route,t,screen);
 if(u<=0)return a;
 const s=sm(u),L3=(x:Vec,y:Vec):Vec=>[lerp(x[0],y[0],s),lerp(x[1],y[1],s),lerp(x[2],y[2],s)];
 return {position:L3(a.position,vp.position),target:L3(a.target,vp.target),fovVerticalDeg:lerp(a.fovVerticalDeg||48,vp.fovVerticalDeg||48,s)};
}
