import {Node} from 'cc';
/** Journey shader prime is intentionally idle.
 *  1ecd8 compiled setCamera macros from WorldFlowComponent.update. The setCamera bag omits CC_SHADOW_TYPE,
 *  and the assign wrapper deletes that key from the live pipeline macros. Every later steady frame then misses
 *  the program cache (QF_SYNC localStorage.getItem; d5b5 was 0). A meadow material (mainline-06 windmill) can
 *  block on the broken key, which freezes console, state and QF_GPU together.
 *  TransitionShaderWarm's after_draw loop stays OFF (#66). Balloon takeoff keeps its own one-shot prime. */
export function noteJourneyMotion(_frames:number=8):void{/* no per-frame compile to pause */}
export function beginJourneyShaderPrime(_root:Node|null):void{/* do not walk or queue passes on the world update */}
/** Steady frames must not compile, read storage, or read back the GPU. Always 0. */
export function stepJourneyPrime():number{return 0;}
export function journeyPrimePending():number{return 0;}
export function resetJourneyShaderPrime():void{/* nothing queued */}
