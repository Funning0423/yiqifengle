/** 运镜bot full2-cam E (d3fe578e P2: 进出篮镜头太远). Close lens for basket in / out: her whole body ≈ heightFrac of the frame
 *  height (vertical FOV, so the same share on every portrait screen; 390x844 target ≥ 25 %), from beside the door so the basket and
 *  the door action read, lens fixed for the beat and panning to her live chest (no orbit, no cut). Side picked from data: the first
 *  side angle whose lens clears every occluder box by clearM and sees her face + chest (HerShot.lensOk). Pure (no cc). */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {HER_SHOT,lensOk,type Box} from './HerShot';
export const BASKET_CLOSE=Object.freeze({heightFrac:.30,herM:1.7253,fovDeg:46,upM:1.55,lookUpM:.95,
 /** side angles (°) round her from the basket→her line (+ = her left); first clear wins */sideDeg:[50,-50,70,-70,35,-35,90,-90,110,-110] as readonly number[],
 clearM:1.1,blendS:1.2,blendOutS:1.8/* B5: ride last lens → close-up (p99 accel ≤200°/s²) */});
const R=Math.PI/180;
/** distance at which her height fills `frac` of the vertical frame */
export const closeDistM=(k=BASKET_CLOSE)=>k.herM/(2*Math.tan(k.fovDeg*R/2)*k.heightFrac);
/** Lens POSITION for the beat (her stand = door stand / seat, basket root). Null if no side is clear. */
/** `prefer` (optional): the lenses before / after the beat — sides are tried by the smallest total view-yaw change to them (fewer °/s). */
export function basketCloseSpot(her:Vec,basket:Vec,boxes:readonly Box[],k=BASKET_CLOSE,prefer?:readonly Pose[]):{position:Vec;sideDeg:number}|null{
 const dx=her[0]-basket[0],dz=her[2]-basket[2],a0=Math.atan2(dx,dz)||0,d=closeDistM(k);
 const vy=(p:Pose)=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2]),wr=(a:number)=>Math.abs(((a/R)%360+540)%360-180);
 const cost=(s:number)=>{if(!prefer||!prefer.length)return 0;const a=a0+s*R,view=Math.atan2(-Math.sin(a),-Math.cos(a));return prefer.reduce((m,p)=>m+wr(view-vy(p)),0);};
 const order=[...k.sideDeg].sort((x,y)=>cost(x)-cost(y));
 for(const s of order){const a=a0+s*R,p:Vec=[her[0]+Math.sin(a)*d,her[1]+k.upM,her[2]+Math.cos(a)*d];
  const pose={position:p,target:[her[0],her[1]+k.lookUpM,her[2]] as Vec,fovVerticalDeg:k.fovDeg};
  if(lensOk(pose,{feet:her,yawDeg:0,pose:'stand'},boxes,{...HER_SHOT,clearM:k.clearM}))return {position:p,sideDeg:s};}
 return null;}
/** The close pose with the lens at `spot`, aimed at her live feet. */
export function basketClosePose(spot:Vec,herFeet:Vec,k=BASKET_CLOSE):Pose{return {position:[spot[0],spot[1],spot[2]],target:[herFeet[0],herFeet[1]+k.lookUpM,herFeet[2]],fovVerticalDeg:k.fovDeg};}
/** Her height as a share of the frame height through a pose (vertical FOV; aspect-independent for a centred subject). */
export function herHeightFrac(p:Pose,feet:Vec,herM=BASKET_CLOSE.herM):number{
 const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(f[0],f[1],f[2])||1,u=[f[0]/l,f[1]/l,f[2]/l];
 const r0=[-u[2],0,u[0]],rl=Math.hypot(r0[0],r0[2])||1,r=[r0[0]/rl,0,r0[2]/rl],up=[r[1]*u[2]-r[2]*u[1],r[2]*u[0]-r[0]*u[2],r[0]*u[1]-r[1]*u[0]];
 const t=Math.tan((p.fovVerticalDeg??48)*R/2),ny=(q:readonly number[])=>{const v=[q[0]-p.position[0],q[1]-p.position[1],q[2]-p.position[2]],z=v[0]*u[0]+v[1]*u[1]+v[2]*u[2];return z>1e-6?(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/z/t:NaN;};
 const a=ny(feet),b=ny([feet[0],feet[1]+herM,feet[2]]);return Number.isFinite(a)&&Number.isFinite(b)?Math.abs(b-a)/2:0;}
/** Her feet through a board beat: at the door stand for doorS, then straight to the seat over stepS (the adapter's step-in walk). */
export function boardFeetAt(door:Vec,seat:Vec,t:number,doorS:number,stepS:number):Vec{const u=Math.max(0,Math.min(1,(t-doorS)/Math.max(1e-3,stepS)));return [door[0]+(seat[0]-door[0])*u,door[1]+(seat[1]-door[1])*u,door[2]+(seat[2]-door[2])*u];}

/** B1: the close-up is blended in from the ride's first lens while she walks to the basket (she starts behind the basket from the door side). */
export function b1InS(walkS:number):number{return Math.min(2.5,Math.max(.5,walkS*.6));}
/** full2-cam C2 (Grok Bot: option B → close-up): lakeside get-out on the touchdown clock s. Blend from the option-B lens (`orig`, the
 *  held wide then its board blend, unchanged) onto the door close-up over inS, hold it through stand-up, door reach and the step
 *  down, then pull back onto `orig` over pullS while she walks out — so the shot lands on the option-B path (no timing change:
 *  sign, board blend start and board takeover keep their LAKESIDE_TOUCHDOWN times). */
export const C2_CLOSE=Object.freeze({/** blend-in starts this long before touchdown (descent), so the ≈9 m wide → close move keeps ≤ blendLensMS */inAtS:-2.2,inS:3.4,pullAtS:4.4,pullS:3.4});
export function c2CloseWeight(s:number,k=C2_CLOSE):number{const mj=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(u*(u*6-15)+10);};return s<k.pullAtS?mj((s-k.inAtS)/k.inS):1-mj((s-k.pullAtS)/k.pullS);}
export function c2ClosePose(s:number,orig:Pose,close:Pose,k=C2_CLOSE):Pose{const w=c2CloseWeight(s,k);if(w<=0)return orig;
 const L=(a:readonly number[],b:readonly number[]):Vec=>[a[0]+(b[0]-a[0])*w,a[1]+(b[1]-a[1])*w,a[2]+(b[2]-a[2])*w];
 return {position:L(orig.position,close.position),target:L(orig.target,close.target),fovVerticalDeg:orig.fovVerticalDeg+(close.fovVerticalDeg-orig.fovVerticalDeg)*w};}
