/** Transit cues for a later voice pass. This round only emits events; no audio files. */
export type TransitCue='node-walk-start'|'node-arrive'|'node-locked-tap'|'scene-tap'|'explore-unlocked'
 |'sail-board'|'sail-unfurl'|'sail-cruise-loop-start'|'sail-cruise-loop-stop'|'sail-dock'
 |'balloon-burner'|'balloon-liftoff'|'balloon-cloud-enter'|'balloon-cloud-exit'|'balloon-land'|'transit-skip';
export type TransitInfo={t:number;region:string;node?:string;id?:string};
const listeners=new Set<(cue:TransitCue,info:TransitInfo)=>void>();
export function onTransitCue(fn:(cue:TransitCue,info:TransitInfo)=>void):()=>void{listeners.add(fn);return ()=>{listeners.delete(fn);};}
export function emitTransitCue(cue:TransitCue,info:TransitInfo):void{for(const fn of listeners){try{fn(cue,info);}catch{}}}
/** Loop cues are not emitted while `hidden` is true. The matching *-loop-start is repeated on resume. */
export function emitTransitCueGated(cue:TransitCue,info:TransitInfo,hidden:boolean):boolean{
 if(hidden)return false;emitTransitCue(cue,info);return true;
}
