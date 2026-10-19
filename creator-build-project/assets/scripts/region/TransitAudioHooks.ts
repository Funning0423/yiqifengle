/** Transit cues only. No audio files. Voice Bot subscribes later.
 * Sail uses hide/emitTransit. Region nodes use pause/emitTransitCue. Both share one listener set. */
export type TransitCue='node-walk-start'|'node-arrive'|'node-locked-tap'|'scene-tap'|'explore-unlocked'
 |'sail-board'|'sail-unfurl'|'sail-cruise-loop-start'|'sail-cruise-loop-stop'|'sail-dock'
 |'balloon-burner'|'balloon-liftoff'|'balloon-cloud-enter'|'balloon-cloud-exit'|'balloon-land'|'transit-skip';
export type TransitInfo={t:number;region:string;node?:string;id?:string;resumed?:boolean};
type Listener=(cue:TransitCue,info:TransitInfo)=>void;
const listeners=new Set<Listener>();
const loops=new Set<TransitCue>();
let hidden=false;
let paused=false;
let pendingLoop:TransitCue|null=null;
export function onTransitCue(fn:Listener):()=>void{
 listeners.add(fn);return ()=>{listeners.delete(fn);};
}
function track(cue:TransitCue):void{
 if(cue.endsWith('loop-start'))loops.add(cue);
 if(cue.endsWith('loop-stop')){
  pendingLoop=null;
  loops.delete(cue.replace('loop-stop','loop-start') as TransitCue);
 }
}
function deliver(cue:TransitCue,info:TransitInfo):void{
 track(cue);
 try{(globalThis as any).__sceneTransitCue={cue:cue,region:info&&info.region?info.region:'',t:info&&typeof info.t==='number'?info.t:0,id:info&&info.id?info.id:''};}catch(e){/* observation only */}
 for(const fn of Array.from(listeners)){try{fn(cue,info);}catch{}}
}
export function setTransitHidden(next:boolean):void{
 const resume=hidden&&!next?pendingLoop:null;
 hidden=next;pendingLoop=null;
 if(resume)emitTransit(resume,{t:0,region:'resume'});
}
export function emitTransit(cue:TransitCue,info:TransitInfo):void{
 if(hidden||paused){
  if(cue.endsWith('loop-stop'))pendingLoop=null;
  else if(hidden&&cue.endsWith('loop-start'))pendingLoop=cue;
  return;
 }
 deliver(cue,info);
}
export function emitTransitCue(cue:TransitCue,info:TransitInfo):void{
 if(paused||hidden)return;
 deliver(cue,info);
}
export function setTransitPaused(next:boolean):void{
 const was=paused;paused=next;
 if(was&&!next){const pending=Array.from(loops);for(let i=0;i<pending.length;i++){const cue=pending[i];for(const fn of Array.from(listeners))fn(cue,{t:0,region:'',resumed:true});}}
}
export function transitPaused():boolean{return paused;}
export function resetTransitCues():void{listeners.clear();hidden=false;paused=false;pendingLoop=null;loops.clear();}
export function resetTransitAudio():void{listeners.clear();loops.clear();paused=false;hidden=false;pendingLoop=null;}

/** Balloon: skip the cue while the caller says the transit is hidden. */
export function emitTransitCueGated(cue:TransitCue,info:TransitInfo,hiddenFlag:boolean):boolean{
 if(hiddenFlag)return false;emitTransitCue(cue,info);return true;
}
