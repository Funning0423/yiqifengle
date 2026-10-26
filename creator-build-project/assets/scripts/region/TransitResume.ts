import {FOREGROUND_MAX_STEP_S,ForegroundTimers} from '../world-r2/ForegroundClock';
import type {Vec} from './RegionNodes';
import {derive,type MainlineView} from './RegionNodeProgress';

export const BACKGROUND_FADE_S=0.35;
export const BACKGROUND_FADE_AFTER_S=30;
/** Coming back does not skip time or move her. A long hide fades in for 0.35 s first. */
export function resumeAfterBackground<T>(hiddenSeconds:number,pose:T):{pose:T;jumped:false;fadeInS:number;advancedS:0}{
 return {pose,jumped:false,fadeInS:hiddenSeconds>BACKGROUND_FADE_AFTER_S?BACKGROUND_FADE_S:0,advancedS:0};
}
/** The watchdog only counts foreground frames, capped like the flow. */
export function foregroundWatchdog(hiddenSeconds:number,frameDt:number):number{
 const clock=new ForegroundTimers();
 clock.tick(hiddenSeconds,true);
 clock.tick(frameDt,false);
 return clock.now();
}
export function watchdogCap():number{return FOREGROUND_MAX_STEP_S;}
/**
 * A kill mid-crossing never restores "at sea" or "in the air".
 * 04 cleared but 05 not: she is already at the meadow bank, and the board is 05.
 * 08 cleared but 09 not: she is on the sky lawn, and the board is 09.
 */
export function reopenAfterKill(view:MainlineView):{atSea:false;inAir:false;region:'island'|'meadow'|'skycity';node:string;board:string|null}{
 const done=new Set(view.completed||[]);
 if(done.has('mainline-04')&&!done.has('mainline-05'))return {atSea:false,inAir:false,region:'meadow',node:'M0',board:'mainline-05'};
 if(done.has('mainline-08')&&!done.has('mainline-09'))return {atSea:false,inAir:false,region:'skycity',node:'S0',board:'mainline-09'};
 const states=derive(view,null);
 if(states.lastPassed.skycity)return {atSea:false,inAir:false,region:'skycity',node:done.has('mainline-12')?'S6'/* full7 (a): L12 done → finale terrace S6 */:states.lastPassed.skycity,board:null};
 if(states.lastPassed.meadow)return {atSea:false,inAir:false,region:'meadow',node:states.lastPassed.meadow,board:null};
 if(states.lastPassed.island)return {atSea:false,inAir:false,region:'island',node:states.lastPassed.island,board:null};
 return {atSea:false,inAir:false,region:'island',node:'I1',board:'mainline-01'};
}
export function samePlace(a:Vec,b:Vec):boolean{return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<1e-6;}
