// b15 handover: a "walk tail" is a scripted walk that keeps owning her after the flow already handed over (the lakeside
// door→shore exit walk continues under the board fade-in, board input enabled). While a tail owns her, nothing may cancel,
// reset or re-walk her: resets are skipped (the tail ends on the same stand point) and new walks/poses wait for the tail.
// Only the owner (journey release: leaving the region) cancels a tail. Pure: no cc imports (Node tests).
export type TailVec=[number,number,number];
export interface TailInfo{done:Promise<void>;end:TailVec;startedAt:number}
const tails=new WeakMap<object,TailInfo>();
/** a cancellation that only the tail owner fires (duck-compatible with WorldFlowCore Cancellation) */
export class TailToken{
 cancelled=false;private ls:Array<()=>void>=[];
 check():void{if(this.cancelled)throw Error('cancelled');}
 onCancel(fn:()=>void):()=>void{if(this.cancelled){fn();return ()=>{};}this.ls.push(fn);return ()=>{const i=this.ls.indexOf(fn);if(i>=0)this.ls.splice(i,1);};}
 cancel():void{if(this.cancelled)return;this.cancelled=true;const l=this.ls.slice();this.ls=[];for(let i=0;i<l.length;i++)l[i]();}
 wait<T>(p:Promise<T>):Promise<T>{return p;}
}
export function beginTail(actor:object|null|undefined,done:Promise<unknown>,end:TailVec):void{
 if(!actor)return;const d=done.then(()=>undefined,()=>undefined);const info:TailInfo={done:d,end:[end[0],end[1],end[2]],startedAt:Date.now()};
 tails.set(actor,info);d.then(()=>{if(tails.get(actor)===info)tails.delete(actor);});
}
export function tailOf(actor:object|null|undefined):TailInfo|null{return actor?tails.get(actor)||null:null;}
/** resolves when no tail owns her (immediately when none); a cap keeps a stuck tail from blocking a caller forever */
export function afterTail(actor:object|null|undefined,capMs=20000):Promise<void>{
 const t=tailOf(actor);if(!t)return Promise.resolve();
 return new Promise<void>(ok=>{let fired=false;const go=()=>{if(!fired){fired=true;ok();}};t.done.then(go);setTimeout(go,capMs);});
}
/** a reset while a tail owns her is dropped (the tail lands on its end itself); returns whether the reset ran */
export function resetUnlessTail(actor:{cancelAndReset(p:any):void}|null|undefined,pose:any):boolean{
 if(!actor||tailOf(actor))return false;actor.cancelAndReset(pose);return true;
}
