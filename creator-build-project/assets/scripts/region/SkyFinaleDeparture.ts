/** T-02 finale → segment 5 departure (Grok Bot FINAL 2026-10-25). Pure (no cc).
 *  After the 1.4 s ease-in she stands gazing at the city for at least GAZE_MIN_S, then the auto-continue fires and she turns and
 *  walks to the basket (SkyLakeContinuous C1: its walk lens starts from the live finale camera, min-jerk handoff, no cut).
 *  · Input (drag / pinch / tap) BEFORE the walk starts cancels the auto-continue: she keeps gazing until 「继续旅程」, which starts
 *    the same turn + walk.
 *  · Once she walks, gestures are IGNORED (not even a camera nudge): the transition lens owns the camera, the walk is never
 *    interrupted, and tap no longer reaches skipWalk(). */
export const SKY_DEPARTURE=Object.freeze({gazeMinS:2.0,approachS:1.4,ignoreGesturesAfterWalk:true,departGuardMaxS:120});
/** Seconds from the arm (reward claim, when the ease-in starts) to the auto-continue. Was SKY_FINALE.holdS 5.5. */
export function finaleAutoContinueAtS(approachS:number=SKY_DEPARTURE.approachS):number{return Math.max(SKY_DEPARTURE.approachS,approachS||0)+SKY_DEPARTURE.gazeMinS;}
export type DepartureState='approach'|'gaze'|'held'|'walking';
/** State machine the stage drives; pure so the rules are unit-tested. */
export class FinaleDeparture{
 state:DepartureState='approach';private t=0;private go:()=>void;readonly autoAt:number;startedBy:'auto'|'button'|null=null;
 constructor(go:()=>void,approachS?:number){this.go=go;this.autoAt=finaleAutoContinueAtS(approachS??SKY_DEPARTURE.approachS);}
 step(dt:number){if(this.state==='walking')return;this.t+=Math.max(0,dt);if(this.state==='approach'&&this.t>=(this.autoAt-SKY_DEPARTURE.gazeMinS))this.state='gaze';
  if(this.state==='gaze'&&this.t>=this.autoAt)this.start('auto');}
 /** drag / pinch / tap: returns true when the gesture must be swallowed (she is walking). */
 gesture(_g:string):boolean{if(this.state==='walking')return SKY_DEPARTURE.ignoreGesturesAfterWalk;if(this.state==='approach'||this.state==='gaze')this.state='held';return false;}
 button(){if(this.state!=='walking')this.start('button');}
 gazedS(){return Math.max(0,Math.min(this.t,this.autoAt)-(this.autoAt-SKY_DEPARTURE.gazeMinS));}
 private start(by:'auto'|'button'){this.state='walking';this.startedBy=by;try{this.go();}catch(e){console.error('finale-departure',e);}}
}
