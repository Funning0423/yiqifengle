import {Camera,Color,DirectionalLight,Quat,Vec3,director,isValid} from 'cc';
import {lakesideFogModeFromEnv,type LakesideDayNight} from './LakesideSceneData';
import {LAKESIDE_BOARD_YAW_DEG,lakesideSunForward} from './LakesideSunDirection';
import {onDayNightChange} from '../world-r1/DayNightContract';
import {islandSkyFade,skyFollowTargetFromLinear} from '../world-r1/SkyFollowCore';
import {LAKESIDE_JOURNEY_ATMOSPHERE_ON,lakesideAtmosphereAt,lakesideSkyDomeTargetLinear,lakesideBoardHolding,lakesideDayNightMode,lakesideIslandBaseFor,lakesideIslandLightScale,setLakesideJourneyBaseIllum,setLakesideJourneyReapply,type LakesideAtmosphereBase,type Rgb} from './LakesideJourneyAtmosphere';
/** build05-next: island→lakeside journey lighting (LakesideJourneyAtmosphere). prime() runs when the journey scenes are
 *  shown (under the set-off fade's full black): it captures the island values and switches the fog to the board's mode at
 *  ~zero density, so the CC_USE_FOG shader-variant change happens under black (and the board entry later needs no switch).
 *  apply(w) writes the blended values every walked frame; restore() puts back exactly what it captured (dispose / 主页).
 *  r2 (lead): day/night. Every write uses the CURRENT mode: the island base for that mode (lakesideIslandBaseFor) and the
 *  lakeside look for that mode (lakesideModeLighting). A toggle once the blend has started (w > 0) re-writes at once (the
 *  world's own applyDayNight has just put the island light back); before the blend the island owns the light. While the board
 *  shows, the board owns it (its fog slab/water) and calls reapply() when it hides. On restore, if the mode changed since the
 *  capture, the island look is re-written for the current mode (__worldDayNight.reapply, no override lock). */
/** r4 journey fix 2: lakeYaw = the journey lake root's Y turn (lakesideJourney().yawDeg); the sun target is lakesideSunForward(lakeYaw), i.e.
 *  the board's sun in the lake's frame (it was the unturned sunForward = mirrored against the 180° lake). */
export function lakesideJourneyAtmosphere(camera:Camera|null,waterY:()=>number,lakeYaw:()=>number=()=>LAKESIDE_BOARD_YAW_DEG){
 type Saved={light:DirectionalLight|null;rot:Quat|null;wrot:Quat|null;color:Color|null;illum:number;sky:Color|null;ground:Color|null;skyIllum:number;clear:Color|null;
  fog:{enabled:boolean;type:number;color:Color;start:number;end:number;top:number;range:number;atten:number}|null;base:LakesideAtmosphereBase;mode:LakesideDayNight};
 let saved:Saved|null=null,lastW=0,offDayNight:(()=>void)|null=null,skyKey='';
 /** r4-prep: the island sky dome + clouds follow the blend (WorldFlowComponent skyFollow: mainColor only, no DC). w 0 = island look.
  *  r4-prep C/D: they (and the gulls) also fade out over ISLAND_SKY_FADE of w, so the journey end sky is the shared clear colour. */
 const sky=(target:readonly number[]|null,w:number)=>{const k=target&&w>0?target.join(',')+'@'+w.toFixed(4):'';if(k===skyKey)return;skyKey=k;try{(globalThis as any).__worldDayNight?.skyFollow?.(k?target:null,k?w:0,k?islandSkyFade(w):1);}catch{}};const fogMode=lakesideFogModeFromEnv(),target=new Quat(),q=new Quat();
 const rgb=(c:Color|null|undefined,f:Rgb):Rgb=>c?[c.r,c.g,c.b]:f,col=(c:Rgb)=>new Color(c[0],c[1],c[2],255);
 const mainLight=():DirectionalLight|null=>{const sc=director.getScene();const n=sc?.getChildByName('Main Light');return (n&&n.getComponent(DirectionalLight))||sc?.getComponentInChildren(DirectionalLight)||null;};
 const write=(w:number)=>{const s=saved;if(!s)return;lastW=w;const mode=lakesideDayNightMode(),base=lakesideIslandBaseFor(s.base,s.mode,mode);
  const f=lakesideAtmosphereAt(base,w,fogMode,waterY(),mode),g=(director.getScene() as any)?.globals;
  if(s.light&&isValid(s.light,true)&&s.wrot){const v=lakesideSunForward(lakeYaw());Quat.fromViewUp(target,new Vec3(-v[0],-v[1],-v[2]).normalize(),Vec3.UP);Quat.slerp(q,s.wrot,target,f.weight);s.light.node.setWorldRotation(q);
   s.light.color=col(f.color);s.light.illuminance=f.illum;}
  const amb=g?.ambient;if(amb){amb.skyLightingColor=col(f.sky);amb.groundLightingColor=col(f.ground);amb.skyIllum=f.skyIllum;}
  if(camera&&isValid(camera,true))camera.clearColor=col(f.clear);
  sky(skyFollowTargetFromLinear(lakesideSkyDomeTargetLinear(mode)),f.weight)/* r4 journey fix 4: zenith/low of the lakeside sky (linear), not the clear colour / horizon */;
  const fog=g?.fog;if(fog&&f.fog){if(fog.type!==f.fog.type)fog.type=f.fog.type;fog.fogColor=col(f.fog.color);fog.fogTop=f.fog.top;fog.fogRange=f.fog.range;fog.fogAtten=f.fog.atten;fog.fogStart=f.fog.start;fog.fogEnd=f.fog.end;if(!fog.enabled)fog.enabled=true;}};
 const onToggle=()=>{if(!saved||lakesideBoardHolding())return;if(lastW>0)write(lastW);};
 return {
  prime(){if(saved||!LAKESIDE_JOURNEY_ATMOSPHERE_ON)return;try{const l=mainLight(),g=(director.getScene() as any)?.globals,amb=g?.ambient,fog=g?.fog,lv=l&&isValid(l,true)?l:null;
   const illum=lv?lv.illuminance:0,skyIllum=amb?amb.skyIllum:0,mode=lakesideDayNightMode();
   saved={light:lv,rot:lv?lv.node.rotation.clone():null,wrot:lv?lv.node.worldRotation.clone():null,color:lv?lv.color.clone():null,illum,sky:amb?amb.skyLightingColor.clone():null,ground:amb?amb.groundLightingColor.clone():null,skyIllum,
    clear:camera&&isValid(camera,true)?camera.clearColor.clone():null,fog:fog?{enabled:fog.enabled,type:fog.type,color:fog.fogColor.clone(),start:fog.fogStart,end:fog.fogEnd,top:fog.fogTop,range:fog.fogRange,atten:fog.fogAtten}:null,
    base:{illum,color:rgb(lv?.color,[255,255,255]),sky:rgb(amb?.skyLightingColor,[255,255,255]),ground:rgb(amb?.groundLightingColor,[255,255,255]),skyIllum,clear:rgb(camera?.clearColor,[51,51,51])},mode};
   setLakesideJourneyBaseIllum(lv?illum/lakesideIslandLightScale(mode):null);setLakesideJourneyReapply(()=>write(lastW));offDayNight=onDayNightChange(onToggle);write(0);}
   catch(error){try{console.warn('[QF_LAKESIDE] '+JSON.stringify({event:'journey-atmosphere-skipped',error:String((error as any)?.message||error)}));}catch{}}},
  apply(w:number){try{write(w);}catch{}},
  restore(){const s=saved;saved=null;lastW=0;offDayNight?.();offDayNight=null;setLakesideJourneyBaseIllum(null);setLakesideJourneyReapply(null);if(!s)return;sky(null,0);try{const g=(director.getScene() as any)?.globals,amb=g?.ambient,fog=g?.fog;
   if(s.light&&isValid(s.light,true)){if(s.rot)s.light.node.setRotation(s.rot);if(s.color)s.light.color=s.color;s.light.illuminance=s.illum;}
   if(amb){if(s.sky)amb.skyLightingColor=s.sky;if(s.ground)amb.groundLightingColor=s.ground;amb.skyIllum=s.skyIllum;}
   if(s.clear&&camera&&isValid(camera,true))camera.clearColor=s.clear;
   if(fog&&s.fog){fog.type=s.fog.type;fog.fogColor=s.fog.color;fog.fogStart=s.fog.start;fog.fogEnd=s.fog.end;fog.fogTop=s.fog.top;fog.fogRange=s.fog.range;fog.fogAtten=s.fog.atten;fog.enabled=s.fog.enabled;}
   if(lakesideDayNightMode()!==s.mode)(globalThis as any).__worldDayNight?.reapply?.();}catch{}},
 };
}
