/** Transit cues only. No audio files. Voice Bot subscribes later. */
export type TransitCue='node-walk-start'|'node-arrive'|'node-locked-tap'|'scene-tap'|'explore-unlocked'
 |'sail-board'|'sail-unfurl'|'sail-cruise-loop-start'|'sail-cruise-loop-stop'|'sail-dock'
 |'balloon-burner'|'balloon-liftoff'|'balloon-cloud-enter'|'balloon-cloud-exit'|'balloon-land'|'transit-skip';
export type TransitInfo={t:number;region:string;node?:string;id?:string};
const listeners=new Set<(cue:TransitCue,info:TransitInfo)=>void>();
let hidden=false;
let pendingLoop:TransitCue|null=null;
export function onTransitCue(fn:(cue:TransitCue,info:TransitInfo)=>void):()=>void{
 listeners.add(fn);return ()=>{listeners.delete(fn);};
}
export function setTransitHidden(next:boolean):void{
 const resume=hidden&&!next?pendingLoop:null;
 hidden=next;pendingLoop=null;
 if(resume)emitTransit(resume,{t:0,region:'resume'});
}
export function emitTransit(cue:TransitCue,info:TransitInfo):void{
 if(hidden){if(cue.endsWith('loop-start'))pendingLoop=cue;return;}
 if(cue.endsWith('loop-stop'))pendingLoop=null;
 for(const fn of Array.from(listeners)){try{fn(cue,info);}catch{}}
}
export function resetTransitCues():void{listeners.clear();hidden=false;pendingLoop=null;}
