import {Director,director} from 'cc';
/** full7 (Grok Bot item 5): per-leg timing with wall-clock, game time (sum of the engine dt each frame, the dt the 0.1 s capped
 *  ride clocks consume) and average fps; acceptance uses game time. Sustained < LEG_LOW_FPS for ≥ LEG_LOW_FPS_SUSTAIN_S is flagged. */
export const LEG_LOW_FPS=15,LEG_LOW_FPS_SUSTAIN_S=2;
export type LegReport={leg:string;wallS:number;gameS:number;gameCappedS:number;frames:number;fps:number;lowFpsS:number;lowFpsFlag:boolean};
export function legStats(leg:string,wallMs:number,dts:readonly number[]):LegReport{
 let g=0,gc=0,low=0,run=0,flag=false;for(const d of dts){g+=d;gc+=Math.min(.1,d);if(d>1/LEG_LOW_FPS){run+=d;low+=d;if(run>=LEG_LOW_FPS_SUSTAIN_S)flag=true;}else run=0;}
 const wallS=wallMs/1000;return {leg,wallS:+wallS.toFixed(2),gameS:+g.toFixed(2),gameCappedS:+gc.toFixed(2),frames:dts.length,fps:+(dts.length/Math.max(1e-3,wallS)).toFixed(1),lowFpsS:+low.toFixed(2),lowFpsFlag:flag};}
export function startLegClock(leg:string):{stop:(extra?:Record<string,unknown>)=>LegReport}{
 const t0=Date.now(),dts:number[]=[];const on=()=>{dts.push(Math.max(0,director.getDeltaTime()||0));};
 try{director.on(Director.EVENT_AFTER_UPDATE,on);}catch{}
 let done:LegReport|null=null;
 return {stop:(extra)=>{if(done)return done;try{director.off(Director.EVENT_AFTER_UPDATE,on);}catch{}done=legStats(leg,Date.now()-t0,dts);
  try{console.info('[QF_LEG_TIME] '+JSON.stringify({...done,...(extra||{})}));}catch{}return done;}};}
