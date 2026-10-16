/** v3.3: one full-screen black cover shared by flow transitions (04→05 set-off fade; 主页 uses the same cover in 88506aa).
 * Pure registry (no cc imports): WorldIntegrationBoot registers its UI cover; WorldFlowComponent's WorldLease.fadeCover
 * forwards here. No cover registered = transitions run without a fade (old behaviour). */
export type ScreenCoverFn=(alpha:number,seconds:number)=>Promise<void>;
let cover:ScreenCoverFn|null=null;
export function setScreenCover(fn:ScreenCoverFn|null):void{cover=fn;}
export function hasScreenCover():boolean{return !!cover;}
export function screenCover(alpha:number,seconds:number):Promise<void>{return cover?cover(alpha,seconds):Promise.resolve();}
