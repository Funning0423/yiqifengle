/** fix-cloud-sit (GGbot): her pose is driven by the AnimRig's own clock (CHARACTER_POSE_BLEND). Any SkeletalAnimation state the
 *  ENGINE is still playing (sit_hold left by SailRide.drawSeated / skel.resume(), or auto-played on re-activation after setParent)
 *  overwrites the joints every frame, so stand_up / walk_loop never reach the screen ("sliding while seated").
 *  Same rule as the lakeside get-out (1033173f): stop every engine-played state. No 'cc' import, so node tests load it as is. */
export interface EngineAnimLike{clips:ReadonlyArray<{name:string}|null>;getState(name:string):{isPlaying:boolean;stop():void}|null|undefined;}
export function stopEngineStates(anim:EngineAnimLike|null|undefined,tag?:string):number{
 if(!anim||!anim.clips)return 0;let n=0;const names:string[]=[];
 for(const c of anim.clips){if(!c)continue;const st=anim.getState(c.name);if(st&&st.isPlaying){try{st.stop();n++;names.push(c.name);}catch{/* state gone */}}}
 if(n&&tag)console.warn('[QF_ANIM] '+tag+': stopped engine-played state '+names.join(','));
 return n;
}
