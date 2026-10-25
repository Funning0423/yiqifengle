/** r4.2 (GGbot): the sky-city board background = the Build05 lease (SkycityBoardBackground.ts, kept byte-for-byte: the 09 plaza
 *  composition is pinned by tools/journey-integration/test-journey-occlusion.cjs) plus what r4.2 needs around it. */
import {Camera,Color,DirectionalLight,Node,SphereLight,director,isValid} from 'cc';
import type {LevelBackgroundFactory} from '../world-r2/LevelBackground';
import {createSkycityBoardBackground as createBuild05SkycityBoard} from './SkycityBoardBackground';
import {onDayNightChange,type DayNightMode} from '../world-r1/DayNightContract';
import {REGION_BOARD_LIGHT_FADE_S,REGION_BOARD_TICK_EVENT,smoothRegionBoardLight,hexToRgb,regionBoardKeyLight,regionBoardSceneLightScale,writeRegionBoardClear} from './RegionBoardNight';
export const SKYCITY_BOARD_RIG='SkycityLiveBackground';
/** item 9: the Build05 board sky (camera clear colour) by day; at night the journey's night sky (the ground already matched). */
export const SKYCITY_BOARD_DAY_CLEAR=hexToRgb('#9ccadf');
/** r5 region nodes: the live board shows the bridge-after state only. Other state_* meshes stay off. */
function hideOtherBoardStates(root:Node|null){if(!root)return;const walk=(n:Node)=>{if(n.name.startsWith('state_')&&n.name!=='state_bridge_after')n.active=false;for(const c of n.children)walk(c);};walk(root);}
export const createSkycityBoardBackground:LevelBackgroundFactory=async ctx=>{
 const lease=await createBuild05SkycityBoard(ctx);if(!lease)return lease;
 const rig:Node|null=ctx.parent.getChildByName(SKYCITY_BOARD_RIG);
 hideOtherBoardStates(rig);
 // items 10/11: the scene stays active under the still-hidden board host, so it switches on during the hidden pre-activation and
 // the swap frame only turns its camera on. The Build05 lease toggles rig+camera in setVisible; the rig is put straight back (its
 // setVisible(false) calls come with the host hidden: binding load, lease hide), the camera keeps following visibility.
 const keepActive=()=>{if(rig&&isValid(rig,true)&&!rig.active)rig.active=true;};keepActive();
 // item 9 (Mac r4: daytime sky behind the night journey): the board sky follows the world day/night mode and its toggles.
 const camNode=rig?rig.getChildByName('SkycityBackgroundCamera'):null,camera:Camera|null=camNode?camNode.getComponent(Camera):null;let dead=false;
 // Read the live blend, not just a binary night flag. Day always restores the authored sky, including after a hidden prewarm.
 let skyMode:DayNightMode='day',skyNightBlend=0;
 // b16-fix P2: the Build05 lease's warm key light follows the night too (was day-bright under the night sky). Day values captured once.
 const keyNode=rig?rig.getChildByName('SkycityBackgroundKey'):null,key:SphereLight|null=keyNode?keyNode.getComponent(SphereLight):null;
 const keyDay=key?{color:[key.color.r,key.color.g,key.color.b] as number[],luminance:key.luminance}:null;let keyWritten=-1;
 const syncNight=(mode?:DayNightMode)=>{
  if(dead)return;
  let view:any;try{view=(globalThis as any).__worldDayNight?.snapshot?.();}catch{/* no world: authored day sky */}
  skyMode=mode??(view?.mode==='night'?'night':'day');
  skyNightBlend=skyMode==='night'?(Number.isFinite(view?.skyNightBlend)?Math.max(0,Math.min(1,view.skyNightBlend)):1):0;
  applyLights();
 };
 // b16 真机复核 ②：补光、环境光、主光共用一个渐变权重 lightW（REGION_BOARD_LIGHT_FADE_S 0.6 s），不再一帧跳变。
 // 环境光/主光只在棋盘显示期间写，隐藏/释放时还原；世界在显示期间改了主光（日夜切换）就以新值为基准重新记。
 let lightW=NaN,lastT=0,shown=false,snapNext=false,fade:{from:number;p:number}|null=null,fadeMode:DayNightMode='day',scene:{amb:any;ambBase:number;ambWritten:number;main:DirectionalLight|null;mainBase:number;mainWritten:number}|null=null;
 const sceneLights=()=>{const sc:any=director.getScene();const amb=sc?.globals?.ambient??null;const mn=sc?.getChildByName?.('Main Light')?.getComponent?.(DirectionalLight)??null;
  return {amb,ambBase:amb?amb.skyIllum:0,ambWritten:NaN,main:mn,mainBase:mn?mn.illuminance:0,mainWritten:NaN};};
 const restoreScene=()=>{if(!scene)return;const s0=scene;scene=null;
  if(s0.amb&&s0.amb.skyIllum===s0.ambWritten)s0.amb.skyIllum=s0.ambBase;if(s0.main&&isValid(s0.main,true)&&s0.main.illuminance===s0.mainWritten)s0.main.illuminance=s0.mainBase;};
 function applyLights(){
  const now=Date.now()/1000,dt=lastT?now-lastT:0;lastT=now;
  // b16 复核3 ②：隐藏/刚显示时直接取当前目标（夜间进场首帧即夜景）；显示期间换日夜时按真实 dt 走 0.6 s smoothstep，每帧由 director after-update 推进。
  if(!shown||snapNext||!Number.isFinite(lightW)){lightW=skyNightBlend;fade=null;fadeMode=skyMode;snapNext=false;}
  else{if(skyMode!==fadeMode){fade={from:lightW,p:0};fadeMode=skyMode;}
   if(fade){fade.p=Math.min(1,fade.p+Math.max(0,Math.min(dt,.1))/REGION_BOARD_LIGHT_FADE_S);lightW=smoothRegionBoardLight(fade.from,skyNightBlend,fade.p);if(fade.p>=1)fade=null;}else lightW=skyNightBlend;}
  // b16 复核2 ②：天空 clear 色也走 lightW（原来按 skyNightBlend 立即写，进棋盘第一帧掉了总降幅的大半）
  if(camera&&isValid(camera,true))writeRegionBoardClear(camera,SKYCITY_BOARD_DAY_CLEAR,lightW,(r,g,b)=>new Color(r,g,b,255));
  if(key&&keyDay&&isValid(key,true)&&keyWritten!==lightW){const k=regionBoardKeyLight(keyDay.color,keyDay.luminance,lightW);key.color=new Color(k.color[0],k.color[1],k.color[2],255);key.luminance=k.luminance;keyWritten=lightW;}
  if(!shown){restoreScene();return;}
  if(!scene)scene=sceneLights();const f=regionBoardSceneLightScale(lightW);
  if(scene.amb){if(Number.isFinite(scene.ambWritten)&&scene.amb.skyIllum!==scene.ambWritten)scene.ambBase=scene.amb.skyIllum;const v=scene.ambBase*f.ambient;if(scene.amb.skyIllum!==v)scene.amb.skyIllum=v;scene.ambWritten=v;}
  if(scene.main&&isValid(scene.main,true)){if(Number.isFinite(scene.mainWritten)&&scene.main.illuminance!==scene.mainWritten)scene.mainBase=scene.main.illuminance;const v=scene.mainBase*f.main;if(scene.main.illuminance!==v)scene.main.illuminance=v;scene.mainWritten=v;}
 }
 syncNight();const offNight=onDayNightChange(syncNight);
 // b16 复核3 ②：lease.frame 不是每帧都跑，显示期间由 director 每帧推进渐变（隐藏时不做事）。
 const tick=()=>{if(shown&&!dead)syncNight();};director.on(REGION_BOARD_TICK_EVENT,tick);
 return Object.assign({},lease,{
  frame:(...args:Parameters<typeof lease.frame>)=>{syncNight();lease.frame(...args);},
  setVisible:(v:boolean)=>{/* b16 复核3 ②：显示首帧按当前日夜直接推目标光照（夜间进场即夜景，不从白天渐变） */if(v&&!shown){snapNext=true;lastT=0;}shown=v;syncNight();lease.setVisible(v);keepActive();},
  diagnostics:()=>({...lease.diagnostics?.(),skyMode,skyNightBlend,skyClearColor:camera?[camera.clearColor.r,camera.clearColor.g,camera.clearColor.b]:null,keyLight:key?{color:[key.color.r,key.color.g,key.color.b],luminance:key.luminance}:null,lightW,sceneLight:scene?{skyIllum:scene.amb?.skyIllum??null,ambientBase:scene.ambBase,mainIlluminance:scene.main?.illuminance??null,mainBase:scene.mainBase}:null}),
  dispose:()=>{if(!dead){dead=true;offNight();director.off(REGION_BOARD_TICK_EVENT,tick);restoreScene();}lease.dispose();}});
};
