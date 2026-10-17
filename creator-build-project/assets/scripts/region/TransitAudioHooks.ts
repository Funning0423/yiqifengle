export type TransitCue='node-walk-start'|'node-arrive'|'node-locked-tap'|'scene-tap'|'explore-unlocked'
 |'sail-board'|'sail-unfurl'|'sail-cruise-loop-start'|'sail-cruise-loop-stop'|'sail-dock'
 |'balloon-burner'|'balloon-liftoff'|'balloon-cloud-enter'|'balloon-cloud-exit'|'balloon-land'|'transit-skip';
export type TransitInfo=Readonly<{t:number;region:string;node?:string;id?:string;resumed?:boolean}>;
type Listener=(cue:TransitCue,info:TransitInfo)=>void;
const listeners=new Set<Listener>();
const loops=new Set<TransitCue>();
let paused=false;
export function onTransitCue(fn:Listener):()=>void{listeners.add(fn);return ()=>{listeners.delete(fn);};}
export function emitTransitCue(cue:TransitCue,info:TransitInfo):void{
 if(paused)return;
 if(cue.endsWith('loop-start'))loops.add(cue);
 if(cue.endsWith('loop-stop'))loops.delete(cue.replace('loop-stop','loop-start') as TransitCue);
 for(const fn of Array.from(listeners))fn(cue,info);
}
export function setTransitPaused(next:boolean):void{
 const was=paused;paused=next;
 if(was&&!next){const pending=Array.from(loops);for(let i=0;i<pending.length;i++){const cue=pending[i];for(const fn of Array.from(listeners))fn(cue,{t:0,region:'',resumed:true});}}
}
export function transitPaused():boolean{return paused;}
export function resetTransitAudio():void{listeners.clear();loops.clear();paused=false;}
