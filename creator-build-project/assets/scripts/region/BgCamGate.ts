/** p0drag5b/6: board-background cameras (priority 44, solid clear) vs. explore / the ground-tap walk cover / board warm-up.
 *  The owner's setVisible is the source of truth: it records what it wants (bgCamWant) and draws only while nobody holds the camera.
 *  Holds are per holder ('explore', 'cover', ...), so they can overlap: the camera may draw again only when the LAST hold is released,
 *  and then only if the owner still wants it (and it is alive and in the hierarchy). Nothing else may switch these cameras on. */
import {isValid} from 'cc';
type Cam={enabled:boolean;node?:{activeInHierarchy?:boolean}|null};
const W='__qfBgWant',HD='__qfBgHolds';
const holds=(c:Cam):Set<string>=>{const a=c as any;return a[HD]||(a[HD]=new Set<string>());};
/** What the owner wants right now; undefined if this camera's owner never went through the gate. */
export function bgCamWanted(c:Cam):boolean|undefined{const v=(c as any)[W];return typeof v==='boolean'?v:undefined;}
export function bgCamWant(c:Cam,v:boolean):void{(c as any)[W]=v;c.enabled=v&&!bgCamHeld(c);}
export function bgCamHeld(c:Cam):boolean{const h=(c as any)[HD] as Set<string>|undefined;return !!h&&h.size>0;}
export function bgCamHold(c:Cam,by='explore'):void{holds(c).add(by);c.enabled=false;}
/** Drop `by`'s hold. `restore` false (region changed / owner instance gone): never switch it on. While another holder still holds it
 *  it stays off. Otherwise on = owner's want (or `fallback` for a camera whose owner never recorded one). Returns whether it is on. */
export function bgCamRelease(c:Cam,restore:boolean,by='explore',fallback=false):boolean{
 holds(c).delete(by);if(bgCamHeld(c)){c.enabled=false;return false;}
 const want=bgCamWanted(c),on=restore&&isValid(c as any,true)&&(want===undefined?fallback:want)&&!!c.node?.activeInHierarchy;
 if(on)c.enabled=true;else if(want!==undefined)c.enabled=false;return on;
}
/** Board warm-up: a temporary draw, only while nobody holds the camera. Returns whether it is on. */
export function bgCamWarmOn(c:Cam):boolean{if(bgCamHeld(c))return false;c.enabled=true;return true;}
/** The enabled state the gate allows now (owner's want, no hold); `fallback` when the owner never recorded one. */
export function bgCamSettled(c:Cam,fallback:boolean):boolean{const w=bgCamWanted(c);return !bgCamHeld(c)&&(w===undefined?fallback:w);}
