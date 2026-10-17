import type {Vec} from '../world-r1/WorldFlowCore';
/** Art flight (r5-balloon-flightpath/2.1) sampled in meadow-local metres, then mapped into the live world.
 * Before the cloud seam the meadow frame is used. At sky-city-enable the same local samples are rigidly
 * mapped onto the game's existing env_skycity (the city node is not moved). */
export const FLIGHT_FORMAT='r5-balloon-flightpath/2.1';
export const M6_LOCAL:Vec=[0.2,6.5,-25.6];
export const S0_LOCAL:Vec=[5.4,-0.11,43.8];
/** Art city root in meadow-local. world = Ry(yaw) * local + origin. Not applied to the live city. */
export const ART_SKY={yawDeg:165.4181,origin:[-14.5938,68.11,167.8952] as Vec};
export const MEADOW_OFF_T=11.2;
export const CITY_ON_T=11.6;
export const SEAM_T=11.6;
export const GRASS_OFF_T=5.8;
export const ISLETS_ON_T=21.5;
export const LAND_T=35;
export const FLIGHT_DURATION=36;
export const CLOUD_WINDOW:[number,number]=[11,12];
export type Rigid={yawDeg:number;origin:Vec};
export type FlightKey={t:number;pos:Vec;yawDeg:number;rollDeg:number;cam:Vec;camLook:Vec};
export type FlightDoc={
 format:string;duration_s:number;sampleRate_hz:number;
 layout:{climbDeg:number;takeoff:Vec;liftoffTop:Vec;climbEnd:Vec;landing_S0:Vec;cloudDeckY:number[]};
 cues:Record<string,number>;
 visibilityRules:{skyCityAlwaysHidden:string[];skyIslets:{objects:string[];enableFrom_t:number}};
 keys:FlightKey[];
 balloonSkyOffset?:{yawDeg:number;translation:Vec};
};
export function rotY(deg:number,p:Vec):Vec{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];}
export function applyRigid(frame:Rigid,p:Vec):Vec{const r=rotY(frame.yawDeg,p);return [r[0]+frame.origin[0],r[1]+frame.origin[1],r[2]+frame.origin[2]];}
/** Inverse of applyRigid. */
export function unapplyRigid(frame:Rigid,p:Vec):Vec{return rotY(-frame.yawDeg,[p[0]-frame.origin[0],p[1]-frame.origin[1],p[2]-frame.origin[2]]);}
/** Meadow root frame that sends M6 local to the given world point (game meadow is Ry(180) + offset). */
export function meadowFrameFromM6(m6World:Vec):Rigid{
 const spun=rotY(180,M6_LOCAL);
 return {yawDeg:180,origin:[m6World[0]-spun[0],m6World[1]-spun[1],m6World[2]-spun[2]]};
}
/** Meadow-local art point → world position of the same city-local point on the live city. */
export function seamMap(p:Vec,game:Rigid,art:Rigid=ART_SKY):Vec{
 return applyRigid(game,unapplyRigid(art,p));
}
export function mapFlightPoint(p:Vec,t:number,meadow:Rigid,game:Rigid):Vec{
 return t+1e-6>=SEAM_T?seamMap(p,game):applyRigid(meadow,p);
}
export function artCityInMeadow(meadow:Rigid,art:Rigid=ART_SKY):Rigid{
 return {yawDeg:meadow.yawDeg+art.yawDeg,origin:applyRigid(meadow,art.origin)};
}
const lerp3=(a:Vec,b:Vec,u:number):Vec=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u];
export function sampleFlight(doc:FlightDoc,t:number):FlightKey{
 const keys=doc.keys,hz=doc.sampleRate_hz||10,dur=doc.duration_s;
 const time=Math.max(0,Math.min(dur,t)),x=time*hz,i=Math.min(keys.length-2,Math.floor(x)),u=x-i,A=keys[i],B=keys[i+1];
 return {t:time,pos:lerp3(A.pos,B.pos,u),yawDeg:A.yawDeg+(B.yawDeg-A.yawDeg)*u,rollDeg:A.rollDeg+(B.rollDeg-A.rollDeg)*u,cam:lerp3(A.cam,B.cam,u),camLook:lerp3(A.camLook,B.camLook,u)};
}
export function flightDocument():FlightDoc{
 const g=globalThis as {__QF_BALLOON_FLIGHT?:FlightDoc};
 if(!g.__QF_BALLOON_FLIGHT||g.__QF_BALLOON_FLIGHT.format!==FLIGHT_FORMAT)throw Error('balloon-flight-json-missing');
 return g.__QF_BALLOON_FLIGHT;
}
export const ALWAYS_HIDDEN=['env_sky_cloud_small','env_sky_cloudsea','env_sky_cumulus_far','Icosphere','state_bridge_after','state_court_after','state_court_after_flowers','state_gate_after','state_gate_after_flowers','state_ring_after_stars'];
export const ISLET_NODES=['env_sky_floatingrocks_1','env_sky_floatingrocks_2','env_sky_floatingrocks_3','env_sky_floatingrocks_cards_1','env_sky_floatingrocks_cards_2','env_sky_floatingrocks_cards_3','env_sky_islets_far'];
export const CITY_CLOUD=['clouds_city_sea','clouds_floor','clouds_floor_puff'];
export const ALWAYS_CLOUD=['clouds_deck','clouds_deck_loose','clouds_far','clouds_horizon'];
/** Ry(yaw) * Rz(roll), degrees. Returns xyzw. */
export function balloonQuat(yawDeg:number,rollDeg:number):[number,number,number,number]{
 const y=yawDeg*Math.PI/360,z=rollDeg*Math.PI/360,sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);
 // q = qy * qz (xyzw)
 return [sy*sz,sy*cz,cy*sz,cy*cz];
}
