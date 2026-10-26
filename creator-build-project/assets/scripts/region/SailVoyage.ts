import type {Pose, Vec} from '../world-r1/WorldFlowCore';
import {sailBeats, sailCamera, sailM0World, sailSpeed, sailVehicle, type SailScreen, type SailTimeline} from './TransportLeg';
/**
 * 运镜bot sail-voyage (Funning 2026-10-26, via Grok Bot): the island→meadow sail must read as a real crossing.
 * Three beats keyed to the boat's route PROGRESS p = distance / route length (not to clock seconds), framed in the
 * boat→destination bearing frame, so any new distance / path / stand-in from 场景设计部 re-flows without new numbers:
 *   departure  lens between her and the destination, looking back at her and the home island (destination behind the lens
 *              or, once the scene makes it far/below the horizon, tiny over her shoulder);
 *   open sea   beam lens on the bearing's starboard side looking across her to open water and the horizon;
 *   approach   astern lens on the line destination→boat, so the meadow grows straight ahead as the boat closes in.
 * OFF by default (SAIL_VOYAGE.enabled): the approved sailCamera and its gold stills are untouched until Grok Bot signs off.
 * Continuity: S-a/S-b and the first `blendS` of S-c are blended from sailCamera (first frame = live K1 lens). No cuts.
 */
export const SAIL_VOYAGE={enabled:false,extraCruiseS:3.6/* 45 s cap − 41.4 s measured whole transition */,blendS:2.0,destScale:1/* 场景设计部: apparent scale of the destination (stand-in) vs the full meadow */,
 dest:null as Vec|null/* override; default sailM0World() = meadow mouth from the node anchors */} ;
type Off={back:number;side:number;up:number;fov:number;look:number};
// back: along boat→dest bearing (negative = between her and the destination); side: + = left of the bearing.
/** = K1 (live lens at S-c start), re-expressed in the destination-bearing frame: the blend in is only the frame change. */
const DEP:Off={back:6.15,side:-4.76,up:4.3,fov:48,look:0.8};
/** Port bow, low, looking back-starboard across her: open water + horizon, the destination behind the lens (scan 2026-10-26). */
const SEA:Off={back:-6,side:8.5,up:3.6,fov:52,look:0.2};
/** Port quarter astern on the destination line: the meadow grows ahead over her shoulder. */
const APP_FULL:Off={back:12,side:2,up:3,fov:66,look:3.2};
/** Small / scaled destination: higher, tighter, so it still lands ~30–40 % of frame height at the berth. */
const APP_SMALL:Off={back:9.2,side:2,up:7,fov:46,look:3.2};
/** Approach pose by destination scale k (SAIL_VOYAGE.destScale; 1 = the full-size meadow, 0.25 = scaled stand-in). */
function appOff(k:number=SAIL_VOYAGE.destScale):Off{const u=clamp((1-k)/0.75),f=(a:number,b:number)=>lerp(a,b,u);
 return {back:f(APP_FULL.back,APP_SMALL.back),side:2,up:f(APP_FULL.up,APP_SMALL.up),fov:f(APP_FULL.fov,APP_SMALL.fov),look:3.2};}
/** Progress windows (fraction of route length). Swings are long so the bearing turn stays ≤ 90°/s on short routes. */
export const SAIL_VOYAGE_P={dep1:0.06,sea0:0.30,sea1:0.70,app0:0.90} as const;
const clamp=(x:number)=>Math.min(1,Math.max(0,x));
const sm=(u:number)=>{const t=clamp(u);return t*t*t*(t*(t*6-15)+10);};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
function arc(a:Off,b:Off,u:number,fovLead=1):Off{
 const s=sm(u);let ta=Math.atan2(a.side,a.back),tb=Math.atan2(b.side,b.back),d=tb-ta;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
 const th=ta+d*s,r=lerp(Math.hypot(a.back,a.side),Math.hypot(b.back,b.side),s);
 // Mid-swing the look point pulls onto her seat (−0.55 m), so the off-axis bearing cannot push her head past the frame edge.
 const w=0.6*Math.sin(Math.PI*s)**2,sf=sm(u/fovLead);
 return {back:Math.cos(th)*r,side:Math.sin(th)*r,up:lerp(a.up,b.up,s),fov:lerp(a.fov,b.fov,sf),look:lerp(a.look,b.look,s)*(1-w)-0.55*w};
}
export function voyageOffset(p:number):Off{
 const P=SAIL_VOYAGE_P;
 if(p<=P.dep1)return DEP;
 if(p<P.sea0)return arc(DEP,SEA,(p-P.dep1)/(P.sea0-P.dep1));
 if(p<=P.sea1)return SEA;
 if(p<P.app0)return arc(SEA,appOff(),(p-P.sea1)/(P.app0-P.sea1),0.25)/* FOV settles before the meadow enters: widening on approach would shrink it */;
 return appOff();
}
/** Voyage timeline: same beats as sailBeats, S-d cruise longer by extraCruiseS (slower hull, never faster). */
export function voyageBeats(routeM:number,extra:number=SAIL_VOYAGE.extraCruiseS):SailTimeline{
 const base=sailBeats(routeM),sp=sailSpeed(routeM,base.speed.cruiseS+Math.max(0,extra));
 const beats=base.beats.map(b=>({...b}));let t=beats[0].t1+(beats[1].t1-beats[1].t0);beats[1].t0=beats[0].t1;beats[1].t1=t;
 const dur:Record<string,number>={'S-c':sp.accelS,'S-d':sp.cruiseS,'S-e':sp.decelS};
 for(let i=2;i<beats.length;i++){const d=dur[beats[i].id]??(beats[i].t1-beats[i].t0);beats[i].t0=t;beats[i].t1=t+d;t+=d;}
 return {...base,beats,speed:sp,build05S:t,totalS:sp.motionS+(beats[1].t1-beats[1].t0)+(beats[5].t1-beats[5].t0)};
}
function voyagePose(tl:SailTimeline,route:readonly Vec[],t:number,dest:Vec):Pose{
 const v=sailVehicle(tl,route,t),p=clamp(v.distance/Math.max(1e-3,tl.speed.length));
 const o=voyageOffset(p),bx=dest[0]-v.pos[0],bz=dest[2]-v.pos[2],yaw=Math.hypot(bx,bz)>1?Math.atan2(bx,bz):v.yaw;
 const fx=Math.sin(yaw),fz=Math.cos(yaw),rx=fz,rz=-fx;
 return {position:[v.pos[0]-fx*o.back+rx*o.side,v.pos[1]+o.up,v.pos[2]-fz*o.back+rz*o.side],target:[v.pos[0]+fx*o.look,v.pos[1]+1.05,v.pos[2]+fz*o.look],fovVerticalDeg:o.fov};
}
/** Drop-in for sailCamera when SAIL_VOYAGE.enabled. */
export function sailVoyageCamera(tl:SailTimeline,route:readonly Vec[],t:number,screen:SailScreen={w:390,h:844}):Pose{
 const sc=tl.beats.find(b=>b.id==='S-c')!;
 if(t<sc.t0)return sailCamera(tl,route,t,screen);
 const dest=SAIL_VOYAGE.dest||sailM0World(),vp=voyagePose(tl,route,t,dest),u=(t-sc.t0)/SAIL_VOYAGE.blendS;
 if(u>=1)return vp;
 const a=sailCamera(tl,route,sc.t0,screen),s=sm(u),L3=(x:Vec,y:Vec):Vec=>[lerp(x[0],y[0],s),lerp(x[1],y[1],s),lerp(x[2],y[2],s)];
 return {position:L3(a.position,vp.position),target:L3(a.target,vp.target),fovVerticalDeg:lerp(a.fovVerticalDeg||48,vp.fovVerticalDeg||48,s)};
}
