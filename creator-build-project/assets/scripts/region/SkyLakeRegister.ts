/** transitions-continuous: T-02 (sky finale, option C) → segment 6 continuous. The composition's continueFromSkyFinale()
 *  (auto-continue and 「继续旅程」) offers the end-of-shot camera to onSkyFinaleContinue handlers; this one takes over:
 *  it publishes the camera for the lakeside ride (SkyLakeContinuous start lens, also fired on TransitionCamera's
 *  fireShotContinue) and starts the region travel itself, whose ride has no WindWipe (fallback only per the logged 3 s rule).
 *  Pure (no cc). */
import {continuousTransitions} from './TransitionChain';
import {fireShotContinue} from './TransitionCamera';
export type SkyFinaleHost={onSkyFinaleContinue(h:(camera:any)=>boolean|void|PromiseLike<any>):()=>void;enterMainline():Promise<unknown>|unknown};
let finaleCam:any=null;
export function takeSkyFinaleCamera():any{const c=finaleCam;finaleCam=null;return c;}
export function registerSkyLakeContinuous(host:SkyFinaleHost):()=>void{
 return host.onSkyFinaleContinue(camera=>{
  if(!continuousTransitions())return false;
  finaleCam=camera||null;
  try{(globalThis as any).__QF_SKY_CONTINUE={at:Date.now(),camera:!!camera};}catch{}
  try{if(camera&&camera.position)fireShotContinue({pose:{position:camera.position,target:camera.target||camera.position,fovVerticalDeg:camera.fovVerticalDeg},vel:camera.velocity,yawRateDegS:camera.angularVelocityDegS?.[1]});}catch{}
  /* skyfix: hand the travel result back (a thenable) instead of a blind `true`, so a refused / null / thrown start reaches the
   * composition's bounded WindWipe fallback instead of silently leaving her in sky city. */
  return Promise.resolve().then(()=>host.enterMainline()).then(r=>r??{ok:false,reason:'continuous-null'});
 });
}
