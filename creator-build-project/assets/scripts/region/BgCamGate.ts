/** p0drag5b: board-background cameras (priority 44, solid clear) vs. free explore. The owner's setVisible stays the source of truth:
 *  it records what it wants (bgCamWant) and only draws when explore is not holding the camera. Explore holds (bgCamHold) and on
 *  release (bgCamRelease) re-enables only if the owner still wants it visible and the camera is alive and in the hierarchy. */
import {isValid} from 'cc';
type Cam={enabled:boolean;node?:{activeInHierarchy?:boolean}|null};
const W='__qfBgWant',HD='__qfBgHeld';
export function bgCamWant(c:Cam,v:boolean):void{(c as any)[W]=v;c.enabled=v&&!(c as any)[HD];}
export function bgCamHeld(c:Cam):boolean{return !!(c as any)[HD];}
export function bgCamHold(c:Cam):void{(c as any)[HD]=true;c.enabled=false;}
/** `restore` false (region changed / owner instance gone): drop the hold, never switch it on. Returns whether it was re-enabled. */
export function bgCamRelease(c:Cam,restore:boolean):boolean{
 (c as any)[HD]=false;
 const on=restore&&isValid(c as any,true)&&(c as any)[W]===true&&!!c.node?.activeInHierarchy;
 if(on)c.enabled=true;return on;
}
