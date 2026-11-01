/** World gestures are off while a board, a blend, or a cut fade owns the screen. */
let enabled=false;
function publish(next:boolean){enabled=next;if(!next)swallowed=null;}
let swallowed:null|{kind:'skip'}=null;
export function setExploreEnabled(next:boolean):void{publish(next);}
/** Composition methods call this so a test that slices the class (and drops imports) still runs. */
try{(globalThis as any).__qfSetExplore=setExploreEnabled;}catch{}
export function exploreEnabled():boolean{return enabled;}
export function noteSwallowedSkip():void{if(!enabled)swallowed={kind:'skip'};}
export function takeSwallowedSkip():boolean{const had=!!swallowed;swallowed=null;return had;}
/** Screenshot / QA entry. Absent from the player UI; the query is the only switch. */
export function qaUnlocked(search:string):boolean{return /(?:^|[?&])qa=1(?:&|$)/.test(search||'');}
