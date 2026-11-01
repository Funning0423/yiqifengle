import type {Vec} from '../world-r1/WorldFlowCore';
import {TRANSITION_RETIME} from './TransitionStaging';
/** GGbot flightpath 2.2: meadow keys until the seam, world keys after. City placement is untouched. */
export const FLIGHT_FORMAT='r5-balloon-flightpath/2.2';
/** Balloon/basket anchor M6 (meadow-local) — the ONE copy (BalloonTransit imports it). NOTE full8: the walk-graph M6 node moved to
 *  (0.2,6.493,−24.8) (场景设计部 e4ae91c1); this anchor stays pre-move because balloonBeats places the basket from it (moving it moves
 *  the basket: basket-close fails). Decision pending (Grok Bot / 场景设计部); m6-single-source reports the 0.80 m delta. */
export const M6_LOCAL:Vec=[0.2,6.5,-25.6];
export const S0_LOCAL:Vec=[5.4,-0.11,43.8];
export const S0_GAME:Vec=[18.09,18.7084,100.8184];
/** Art city root in meadow-local (design only; never applied to the live city). */
export const ART_SKY={yawDeg:165.4181,origin:[-14.5938,68.11,167.8952] as Vec};
/** JSON seam.meadowRootWorld (Mw). Live meadow may differ slightly; prefer the live node when available. */
export const MW_JSON:Rigid={yawDeg:180,origin:[-1.3135,-1.163494,52.4814]};
/** JSON seam.skycityRootWorld (Cw) — game city stays here. */
export const CW_JSON:Rigid={yawDeg:241.165081,origin:[59.06373,18.818369,117.212135]};
/** JSON seam.meadowToWorld_postSeam (P): transitFrame after the seam. */
export const P_SEAM:Rigid={yawDeg:75.747026,origin:[-100.070307,-49.291631,61.731203]};
/** JSON seam.worldJump (S): p_out = Ry(yaw)·p_in + t. Used when plan A teleports the game sea. */
export const S_JUMP:Rigid={yawDeg:255.747026,origin:[-49.527771,-48.128136,75.925381]};
export const MEADOW_OFF_T=11.2;
export const FAR_CARD_ON_T=11.2;
export const CITY_ON_T=11.6;
export const SEAM_T=11.4;
export const GRASS_OFF_T=5.8;
export const ISLETS_ON_T=21.5;
/** Island grass + rock stay up through the landing lens. Handoff fade (35.9) is what turns the body off. */
export const STRATA_OFF_T=36;
export const LAND_T=35;
export const FLIGHT_DURATION=36;
export const CLOUD_WINDOW:[number,number]=[11,12];
export const LIGHT_RAMP_T0=10.7;
export const LIGHT_RAMP_YAW=104.253;
/**
 * Sun yaw offset (deg, added to the board light's yaw) during the balloon leg.
 * The seam re-bases transit content by P−Mw = −104.253° in yaw, so to keep the sun fixed relative to what the
 * player sees the light must sit at −104.253° right after the seam. Previously the offset was ramped +104° in
 * 0.7 s *before* the seam (10.7–11.4 s, ~150°/s visible spin) and snapped back. Now: 0 before the seam, −104.253
 * at the seam (content-relative continuous), then smoothstep back to 0 by LAND_T so the arrival/board cut matches.
 */
export function balloonLightYawOffset(t:number):number{
 if(t+1e-9<SEAM_T)return 0;
 if(t>=LAND_T)return 0;
 const u=Math.max(0,Math.min(1,(t-SEAM_T)/(LAND_T-SEAM_T)));
 return -LIGHT_RAMP_YAW*(1-u*u*(3-2*u));
}
/**
 * b17r10: night look handoff at the city switch. Before CITY_ON_T the night clouds are lit by the full board light; at
 * CITY_ON_T the light dropped to x0.22 and the cloud sea swapped to unlit RGB(68,80,94) in one frame (whole-frame -16%,
 * white -> cyan-blue). Everything that changes there now follows this weight: 0 before CITY_ON_T, smoothstep to 1 over
 * NIGHT_BLEND_S (camera is still inside the cloud window), 1 afterwards.
 */
export const NIGHT_BLEND_S=1.2;
export const NIGHT_CITY_ILLUM=0.22;
export function nightCityBlend(t:number):number{
 const u=Math.max(0,Math.min(1,(t-CITY_ON_T)/NIGHT_BLEND_S));
 return u*u*(3-2*u);
}
/** Board-light illuminance factor during the ride (day: 1; night: 1 -> NIGHT_CITY_ILLUM across the blend). */
export function balloonIllumFactor(t:number,night:boolean):number{
 return night?1+(NIGHT_CITY_ILLUM-1)*nightCityBlend(t):1;
}
/** Night cloud-sea unlit colour (sRGB 0..255): lit-white look -> RGB(68,80,94) across the blend. */
export const NIGHT_CLOUD_FROM:[number,number,number]=[255,255,255];
export const NIGHT_CLOUD_TO:[number,number,number]=[68,80,94];
export function nightCloudColor(t:number):[number,number,number]{
 const w=nightCityBlend(t);return [0,1,2].map(i=>Math.round(NIGHT_CLOUD_FROM[i]+(NIGHT_CLOUD_TO[i]-NIGHT_CLOUD_FROM[i])*w)) as [number,number,number];
}
export type Rigid={yawDeg:number;origin:Vec};
export type FlightFrame='meadow'|'world';
export type FlightKey={t:number;frame?:FlightFrame;pos:Vec;yawDeg:number;rollDeg:number;cam:Vec;camLook:Vec};
export type SeamDoc={
 t:number;
 preKey:FlightKey;
 postKey:FlightKey;
 meadowRootWorld:{yawDeg:number;translation:Vec};
 skycityRootWorld:{yawDeg:number;translation:Vec};
 meadowToWorld_postSeam:{yawDeg:number;translation:Vec;quaternion_xyzw?:number[]};
 worldJump:{yawDeg:number;translation:Vec;quaternion_xyzw?:number[]};
 landing:{S0_game_world:Vec;S0_local:Vec};
 lighting?:{worldJump_yawDeg:number};
};
export type FlightDoc={
 format:string;duration_s:number;sampleRate_hz:number;
 layout:{climbDeg:number;takeoff:Vec;liftoffTop:Vec;climbEnd:Vec;landing_S0:Vec;cloudDeckY:number[]};
 beats:Array<{id:string;t0:number;t1:number}>;
 cues:Record<string,number>;
 seam?:SeamDoc;
 visibilityRules:{
  skyCityAlwaysHidden:string[];
  skyIslets:{objects:string[];enableFrom_t:number};
  farMeadowCard?:{on_t:number;off_t:number};
  worldBackdrops?:{hide_from_meadowOff_until_handoff:string[];night_hide_whole_transit:string[]};
 };
 keys:FlightKey[];
 balloonSkyOffset?:{yawDeg:number;translation:Vec};
};
export function rotY(deg:number,p:Vec):Vec{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];}
export function applyRigid(frame:Rigid,p:Vec):Vec{const r=rotY(frame.yawDeg,p);return [r[0]+frame.origin[0],r[1]+frame.origin[1],r[2]+frame.origin[2]];}
export function unapplyRigid(frame:Rigid,p:Vec):Vec{return rotY(-frame.yawDeg,[p[0]-frame.origin[0],p[1]-frame.origin[1],p[2]-frame.origin[2]]);}
export function meadowFrameFromM6(m6World:Vec):Rigid{
 const spun=rotY(180,M6_LOCAL);
 return {yawDeg:180,origin:[m6World[0]-spun[0],m6World[1]-spun[1],m6World[2]-spun[2]]};
}
/** Design meadow-local → live city (legacy 2.1 helper; cloud roots now use P_SEAM). */
export function seamMap(p:Vec,game:Rigid,art:Rigid=ART_SKY):Vec{
 return applyRigid(game,unapplyRigid(art,p));
}
export function rigidFromSeam(block:{yawDeg:number;translation:Vec}|undefined,fallback:Rigid):Rigid{
 if(!block)return fallback;
 return {yawDeg:block.yawDeg,origin:[block.translation[0],block.translation[1],block.translation[2]]};
}
/** full9c skyframe: THE skycity world placement (one source of truth, every chain): flightpath seam.skycityRootWorld. The post-seam
 *  flight keys, the touchdown, S0_GAME, skyMooring5a and every baked sky plan live in this frame. */
export function skycityRootWorldFrame(doc?:FlightDoc|null):Rigid{return rigidFromSeam(doc?.seam?.skycityRootWorld,CW_JSON);}
export function postSeamFrame(doc?:FlightDoc|null):Rigid{
 return rigidFromSeam(doc?.seam?.meadowToWorld_postSeam,P_SEAM);
}
export function worldJumpFrame(doc?:FlightDoc|null):Rigid{
 return rigidFromSeam(doc?.seam?.worldJump,S_JUMP);
}
/** Meadow key → world via Mw; world key → as-is. Never uses balloonSkyOffset on the city. */
export function mapFlightPoint(p:Vec,t:number,meadow:Rigid,_game?:Rigid,frame?:FlightFrame):Vec{
 if(frame==='world'||t+1e-9>=SEAM_T)return [p[0],p[1],p[2]];
 return applyRigid(meadow,p);
}
export function artCityInMeadow(meadow:Rigid,art:Rigid=ART_SKY):Rigid{
 return {yawDeg:meadow.yawDeg+art.yawDeg,origin:applyRigid(meadow,art.origin)};
}
const lerp3=(a:Vec,b:Vec,u:number):Vec=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u];
function lerpKey(A:FlightKey,B:FlightKey,u:number,time:number):FlightKey{
 return {t:time,frame:A.frame??B.frame,pos:lerp3(A.pos,B.pos,u),yawDeg:A.yawDeg+(B.yawDeg-A.yawDeg)*u,rollDeg:A.rollDeg+(B.rollDeg-A.rollDeg)*u,cam:lerp3(A.cam,B.cam,u),camLook:lerp3(A.camLook,B.camLook,u)};
}
/** b19 (场景设计部 transition-spaces 01975129): the parked basket moved from the flight file's take-off (12, 6.52, −23.8) to
 *  (3.6, 6.60, −23.4) meadow-local (windchime + windmill clearance), and the sky-city landing is raised 0.12 m onto the mooring
 *  deck. The flight file is unchanged; sampleFlight adds these offsets to pos / cam / camLook: the take-off shift at full weight
 *  through board + burner (t ≤ TAKEOFF_SHIFT_HOLD_T), smootherstep to 0 by TAKEOFF_SHIFT_END_T (well before meadow-unload/seam);
 *  the landing lift from LAND_LIFT_FROM_T to full at LAND_T. Meadow keys only for the shift, world keys only for the lift. */
export const TAKEOFF_SHIFT:Vec=[3.6-12,6.60-6.51934814453125,-23.4-(-23.8)];
export const TAKEOFF_SHIFT_HOLD_T=4.5/* basket floor ≥ 10.7 m local: 1.2 m over the wind_bell_frame top before any sideways drift */,TAKEOFF_SHIFT_END_T=9.0;
export const LAND_LIFT_M=.12,LAND_LIFT_FROM_T=31;
const s5=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*x*(x*(x*6-15)+10);};
/** sidestep away from the wind_bell_frame while rising vertically (frame is +x of the basket), eased in from lift-off */
export let TAKEOFF_SIDESTEP:Vec=[-0.8,0,0.6]/* check-meadow-lift: obstacle gap ≥ 0.534 m (= the parked gap to the blade sweep) */;
export function setTakeoffSidestep(v:Vec):void{TAKEOFF_SIDESTEP=v;}
export function takeoffShiftW(t:number):number{return 1-s5((t-TAKEOFF_SHIFT_HOLD_T)/(TAKEOFF_SHIFT_END_T-TAKEOFF_SHIFT_HOLD_T));}
export function landLiftW(t:number):number{return s5((t-LAND_LIFT_FROM_T)/(LAND_T-LAND_LIFT_FROM_T));}
function shiftKey(k:FlightKey,t:number):FlightKey{
 const meadow=(k.frame??'meadow')==='meadow'&&t+1e-9<SEAM_T;let d:Vec=[0,0,0];
 if(meadow){const w=takeoffShiftW(t),q=w*s5((t-1.8)/(TAKEOFF_SHIFT_HOLD_T-1.8));d=[TAKEOFF_SHIFT[0]*w+TAKEOFF_SIDESTEP[0]*q,TAKEOFF_SHIFT[1]*w+TAKEOFF_SIDESTEP[1]*q,TAKEOFF_SHIFT[2]*w+TAKEOFF_SIDESTEP[2]*q];}else{d=[0,LAND_LIFT_M*landLiftW(t),0];}
 const a=(v:Vec):Vec=>[v[0]+d[0],v[1]+d[1],v[2]+d[2]];
 // lens orbit about the basket while shifted: the file lens would look at the new point THROUGH the wind chime (bells back-faced)
 const yw=meadow?TAKEOFF_CAM_ORBIT_DEG*(1-s5((t-TAKEOFF_ORBIT_FROM_T)/(TAKEOFF_ORBIT_END_T-TAKEOFF_ORBIT_FROM_T)))*Math.PI/180:0,P=a(k.pos),orb=(v:Vec):Vec=>{const q=a(v),x=q[0]-P[0],z=q[2]-P[2],c=Math.cos(yw),s=Math.sin(yw);return [P[0]+c*x+s*z,q[1]+TAKEOFF_CAM_UP_M*takeoffShiftW(t)*(meadow?1:0),P[2]-s*x+c*z];};
 if(!d[0]&&!d[1]&&!d[2]&&!yw)return k;return {...k,pos:P,cam:orb(k.cam),camLook:orb(k.camLook)};}
/** the orbit unwinds inside the cloud bank (cloud-enter 4.3 → seam 11.4) */
export const TAKEOFF_ORBIT_FROM_T=2.0,TAKEOFF_ORBIT_END_T=11.3;
export let TAKEOFF_CAM_UP_M=0;export function setTakeoffCamUp(m:number):void{TAKEOFF_CAM_UP_M=m;}
export let TAKEOFF_CAM_ORBIT_DEG=0/* frame-background: the file lens would see the new point through the wind chime (bell interiors) */;export function setTakeoffCamOrbit(d:number):void{TAKEOFF_CAM_ORBIT_DEG=d;}
/** Same-frame neighbours only. [seam−0.1, seam) → keys[seam−0.1]…preKey; t≥seam → world keys. */
export function sampleFlight(doc:FlightDoc,t:number):FlightKey{return shiftKey(sampleFlightRaw(doc,t),Math.max(0,Math.min(doc.duration_s,t)));}
export function sampleFlightRaw(doc:FlightDoc,t:number):FlightKey{
 const keys=doc.keys,hz=doc.sampleRate_hz||10,dur=doc.duration_s;
 const time=Math.max(0,Math.min(dur,t));
 const seam=doc.seam?.t??SEAM_T;
 if(time+1e-9>=seam){
  const x=time*hz,i=Math.min(keys.length-2,Math.floor(x)),u=x-i;
  return lerpKey(keys[i],keys[i+1],u,time);
 }
 if(time+1e-9>=seam-0.1&&doc.seam?.preKey){
  const aT=seam-0.1,u=(time-aT)/0.1,A=keys[Math.round(aT*hz)]??keys[Math.floor(aT*hz)];
  return lerpKey(A,doc.seam.preKey,Math.max(0,Math.min(1,u)),time);
 }
 const x=time*hz,i=Math.min(keys.length-2,Math.floor(x)),u=x-i;
 const A=keys[i],B=keys[i+1];
 if((A.frame??'meadow')!==(B.frame??'meadow'))return {...A,t:time};
 return lerpKey(A,B,u,time);
}
export function flightDocument():FlightDoc{
 const g=globalThis as {__QF_BALLOON_FLIGHT?:FlightDoc};
 if(!g.__QF_BALLOON_FLIGHT||g.__QF_BALLOON_FLIGHT.format!==FLIGHT_FORMAT)throw Error('balloon-flight-json-missing');
 return g.__QF_BALLOON_FLIGHT;
}
export const ALWAYS_HIDDEN=['env_sky_cloud_small','Icosphere','state_bridge_after','state_court_after','state_court_after_flowers','state_gate_after','state_gate_after_flowers','state_ring_after_stars'];
/** Far sky clouds. The ride hides them: the cloud-sea wall occludes the flight lens. The soft sibling replaces them after arrival. */
export const FLIGHT_FAR_CLOUDS=['env_sky_cloudsea','env_sky_cumulus_far'] as const;
export const ISLET_NODES=['env_sky_floatingrocks_1','env_sky_floatingrocks_2','env_sky_floatingrocks_3','env_sky_floatingrocks_cards_1','env_sky_floatingrocks_cards_2','env_sky_floatingrocks_cards_3','env_sky_islets_far'];
export const CITY_CLOUD=['clouds_city_sea','clouds_floor','clouds_floor_puff'];
export const ALWAYS_CLOUD=['clouds_deck','clouds_deck_loose','clouds_far','clouds_horizon'];
/** Sky-city lawn the player stands on. The cruise may hide these; arrival must turn them back on. */
export const SKY_LAWN=['env_sky_static_palette','env_sky_static_rock_strata','env_sky_static_foliage_cards','env_sky_island_vines'] as const;
/** Transit dressing that must be inactive once the ride has handed the city to gameplay. */
export const TRANSIT_OFF_AFTER=['transit_clouds_merged','transit_sea_fallback','far_meadow_card','transit_night_dome','clouds_city_sea','clouds_floor','clouds_floor_puff','clouds_deck','clouds_deck_loose','clouds_far','clouds_horizon'] as const;
/** After the balloon clock ends: lawn on, transit backdrop off. null = leave the node as the scene authored it. */
export function skyNodeAfterArrival(name:string):'on'|'off'|null{
 if((SKY_LAWN as readonly string[]).includes(name))return 'on';
 if((FLIGHT_FAR_CLOUDS as readonly string[]).includes(name)||name==='env_sea_surface')return 'off';
 if(name==='env_sky_cloud_small'||name==='env_sky_islets_far')return 'on';
 if((TRANSIT_OFF_AFTER as readonly string[]).includes(name))return 'off';
 return null;
}
/** Island backdrop meshes hidden from meadow-unload until handoff (plan B also hides env_sea_surface). */
export const BACKDROP_HIDE=['env_cloud_layer','env_sea_foam','env_sea_surf_foam_v22','env_sea_wave_line_01_v22','env_sea_wave_line_02_v22','env_lighthouse_ext','env_lighthouse_door','env_island_main','env_island_props_merged','env_prop_palm_lean_01','env_prop_palm_tall_01','env_prop_palm_young_01','env_rear_window_palm'];
/** Island sea (env_sea_surface) world height; IslandAtmosphereFxCore: flat at y=-0.918. The post-seam flight climbs through it. */
export const ISLAND_SEA_Y=-0.918;
/** Island sea shown? Off from meadow-unload until handoff (plan B). Shared by BalloonTransit and test-route-occlusion O3. */
export function islandSeaShown(t:number,handoff:boolean):boolean{return !(t>=MEADOW_OFF_T&&!handoff);}
/** Sail leg leftover (RegionJourney-meadow/SailArt: transit_sea/sea_plane, y=SAIL_SEA_Y -0.91, 832 m half-extent). It lives
 * until the meadow lease is released, so the balloon drives it with the meadow: shown only while the meadow is (b17r7 B1). */
export const SAIL_LEFTOVER_SEA_Y=-0.91;
export function sailLeftoverShown(t:number,arrived:boolean):boolean{return !arrived&&t<MEADOW_OFF_T;}
export const NIGHT_MOON_HIDE=['env_sky_moon_night_v22','env_sky_moon_halo_night_v22'];
/** Ry(yaw) * Rz(roll), degrees. Returns xyzw. */
export function balloonQuat(yawDeg:number,rollDeg:number):[number,number,number,number]{
 const y=yawDeg*Math.PI/360,z=rollDeg*Math.PI/360,sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);
 return [sy*sz,sy*cz,cy*sz,cy*cz];
}
/** Transitions (Grok Bot / GGbot 2026-10-25): the meadow→skycity ride plays in RIDE_DURATION s of foreground time instead of
 *  FLIGHT_DURATION. The flight file is unchanged; the ride clock τ is warped to flight time t = rideToFlightT(τ):
 *  rate 1 through board / liftoff / cloud seam (t ≤ RIDE_KEEP_T, all seam & visibility cues keep their exact timing), then a
 *  smoothstep rise to RIDE_CRUISE_RATE, cruise, a smoothstep fall back to 1, and rate 1 for the last RIDE_TAIL_S of the
 *  approach + landing (touchdown and the basket-door beat play at real speed). C1 rate → no velocity step on the camera. */
/** b19 caps (Grok Bot): meadow→skycity ≤ 50 s, visible flight 28.5 s (Grok Bot). ONE data-driven parameter: TRANSITION_RETIME.meadowRideS.
 *  Re-blocked timing: rate 1 while she is seen boarding and lifting off (flight 0–RIDE_KEEP_T = end of B-c_liftoff), the speed-up is
 *  spent inside the cloud bank (4.3–15, 100% cloud at the seam) and the islets, and rate 1 again for approach + landing + exit
 *  (last RIDE_TAIL_S). */
export const RIDE_DURATION:number=TRANSITION_RETIME.meadowRideS;
/** the parked B-b_board beat (flight 0–1.8) is NOT replayed: she already boarded/sat and the burner lit during seg3 inflate
 *  (TRANSITION_DURATIONS.seg3.inflate). The ride opens on the B-c_liftoff key at rate 1 and eases up from there. */
export const RIDE_START_T=1.8;
export const RIDE_KEEP_T=0.8;
/** asymmetric: quick rise inside the cloud bank, long fall so the islets/approach (file already fast there) stay ≤ 0.6 m/frame */
export const RIDE_RAMP_S=3,RIDE_RAMP_DOWN_S=9;
export const RIDE_TAIL_S=3;
/** ∫ of the smoothstep rise over x s (full rise after RIDE_RAMP_S). 36 = 30 + (r−1)·(Rint(18) − Rint(7)) = 30 + 11(r−1) → r = 17/11. */
const rampInt=(x:number,R:number=RIDE_RAMP_S)=>{if(x<=0)return 0;if(x>=R)return R/2+(x-R);const u=x/R;return R*(u*u*u-u*u*u*u/2);};
export const RIDE_CRUISE_RATE=1+(FLIGHT_DURATION-RIDE_START_T-RIDE_DURATION)/(rampInt(RIDE_DURATION-RIDE_KEEP_T)-rampInt(RIDE_TAIL_S+RIDE_RAMP_DOWN_S,RIDE_RAMP_DOWN_S));
/** Flight-time rate dt/dτ at ride time τ. */
export function rideRate(tau:number):number{const r=RIDE_CRUISE_RATE,s=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*(3-2*x);};
 const downT0=RIDE_DURATION-RIDE_TAIL_S-RIDE_RAMP_DOWN_S;
 return 1+(r-1)*(s((tau-RIDE_KEEP_T)/RIDE_RAMP_S)-s((tau-downT0)/RIDE_RAMP_DOWN_S));}
/** Speed-adaptive ride clock (re-blocked, not a uniform time-scale): ride seconds per flight second
 *  g(t) = w(t)·1 + (1−w(t))·max(1/RIDE_MAX_RATE, λ·(v(t)+RIDE_V0)), v = lens speed of the authored flight camera (each side of the
 *  seam on its own), w = 1 on the first RIDE_KEEP_T s (lift-off) and the last RIDE_TAIL_S s (approach→landing→exit, real speed),
 *  smootherstep in between; λ solved so the ride lasts RIDE_DURATION. Fast-moving file stretches play near real speed, slow / cloud
 *  stretches are compressed (≤ RIDE_MAX_RATE). g is smoothed (C1 rate). Falls back to the analytic warp when no flight file is loaded. */
export const RIDE_MAX_RATE=2.5,RIDE_V0=2,RIDE_EASE_S=2.5,/** m per °/s: lens turning counts as motion, so turns are not sped up */RIDE_ANG_K=0.7;
let rideTab:{t:number[];tau:number[];g:number[]}|null=null;
function buildRideTab():{t:number[];tau:number[];g:number[]}|null{let doc:FlightDoc;try{doc=flightDocument();}catch{return null;}if(!doc||!doc.keys)return null;
 const h=0.05,t0=RIDE_START_T,t1=FLIGHT_DURATION,n=Math.round((t1-t0)/h),v:number[]=[],w:number[]=[];
 for(let i=0;i<=n;i++){const t=t0+i*h,a=sampleFlight(doc,Math.max(t0,t-h/2)),b=sampleFlight(doc,Math.min(t1,t+h/2));
  const cross=(t-h/2<SEAM_T)!==(t+h/2<SEAM_T);const yw=(k:FlightKey)=>Math.atan2(k.camLook[0]-k.cam[0],k.camLook[2]-k.cam[2])*180/Math.PI,dy=Math.abs(((yw(b)-yw(a))%360+540)%360-180)/h;
  v.push(cross?(v[i-1]??0):Math.hypot(b.cam[0]-a.cam[0],b.cam[1]-a.cam[1],b.cam[2]-a.cam[2])/h+RIDE_ANG_K*dy);
  const s5=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*x*(x*(x*6-15)+10);};
  w.push(Math.max(1-s5((t-t0-RIDE_KEEP_T)/RIDE_EASE_S),s5((t-(t1-RIDE_TAIL_S)+RIDE_EASE_S)/RIDE_EASE_S)));}
 const sm=(a:number[],m:number)=>a.map((_,i)=>{let s=0,W=0;for(let j=-m;j<=m;j++){const ww=m+1-Math.abs(j);s+=a[Math.max(0,Math.min(n,i+j))]*ww;W+=ww;}return s/W;});
 const vs=sm(v,10);const gOf=(lam:number)=>sm(vs.map((x,i)=>w[i]+(1-w[i])*Math.max(1/RIDE_MAX_RATE,lam*(x+RIDE_V0))),12);
 const tot=(g:number[])=>{let s=0;for(let i=1;i<=n;i++)s+=(g[i]+g[i-1])/2*h;return s;};
 let lo=0,hi=10;for(let k=0;k<60;k++){const m=(lo+hi)/2;if(tot(gOf(m))<RIDE_DURATION)lo=m;else hi=m;}
 const g=gOf(hi),T=[t0],U=[0];for(let i=1;i<=n;i++){T.push(t0+i*h);U.push(U[i-1]+(g[i]+g[i-1])/2*h);}const f=RIDE_DURATION/U[n];return {t:T,tau:U.map(x=>x*f),g:g.map(x=>x*f)};}
function tab(){if(!rideTab)rideTab=buildRideTab();return rideTab;}
/** test hook: rebuild after the flight file / durations change */
export function resetRideClock():void{rideTab=null;}
/** Ride clock τ ∈ [0, RIDE_DURATION] → flight time t ∈ [RIDE_START_T, FLIGHT_DURATION]; monotonic, C1. */
export function rideToFlightT(tau:number):number{const x=Math.max(0,Math.min(RIDE_DURATION,tau)),T=tab();
 if(T){let lo=0,hi=T.tau.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(T.tau[m]<=x)lo=m;else hi=m;}const d=(T.tau[hi]-T.tau[lo])||1,u=(x-T.tau[lo])/d,u2=u*u,u3=u2*u;/* cubic Hermite, slopes dt/dτ = 1/g: C1 rate */
  return (2*u3-3*u2+1)*T.t[lo]+(u3-2*u2+u)*d/T.g[lo]+(-2*u3+3*u2)*T.t[hi]+(u3-u2)*d/T.g[hi];}
 const r=RIDE_CRUISE_RATE,downT0=RIDE_DURATION-RIDE_TAIL_S-RIDE_RAMP_DOWN_S;
 return Math.min(FLIGHT_DURATION,RIDE_START_T+x+(r-1)*(rampInt(x-RIDE_KEEP_T)-rampInt(x-downT0,RIDE_RAMP_DOWN_S)));}
/** Inverse (bisection), for reporting cue times on the ride clock. */
export function flightToRideT(t:number):number{if(t<=RIDE_START_T)return 0;let lo=0,hi=RIDE_DURATION;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(rideToFlightT(m)<t)lo=m;else hi=m;}return hi;}
