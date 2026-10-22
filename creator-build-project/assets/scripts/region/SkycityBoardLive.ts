/** r4.2 (GGbot): the sky-city board background = the Build05 lease (SkycityBoardBackground.ts, kept byte-for-byte: the 09 plaza
 *  composition is pinned by tools/journey-integration/test-journey-occlusion.cjs) plus what r4.2 needs around it. */
import {Camera,Color,Node,SphereLight,isValid} from 'cc';
import type {LevelBackgroundFactory} from '../world-r2/LevelBackground';
import {createSkycityBoardBackground as createBuild05SkycityBoard} from './SkycityBoardBackground';
import {onDayNightChange,type DayNightMode} from '../world-r1/DayNightContract';
import {hexToRgb,writeRegionBoardClear} from './RegionBoardNight';
import {gradeSkycityCloudsea,gradeSkycityKeyLight,gradeSkycityNight} from './SkycityNightApply';
export const SKYCITY_BOARD_RIG='SkycityLiveBackground';
/** item 9: the Build05 board sky (camera clear colour) by day; at night the journey's night sky. b16: the city itself follows the
 *  island night too (key light x0.35 + moon colour, self-lit clouds / accents graded, SkycityNightGrade) - before b16 only the clear
 *  colour changed and the city stayed at day brightness. */
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
 const keyNode=rig?rig.getChildByName('SkycityBackgroundKey'):null,keyLight:SphereLight|null=keyNode?keyNode.getComponent(SphereLight):null;
 const syncNight=(mode?:DayNightMode)=>{
  if(dead)return;
  let view:any;try{view=(globalThis as any).__worldDayNight?.snapshot?.();}catch{/* no world: authored day sky */}
  skyMode=mode??(view?.mode==='night'?'night':'day');
  skyNightBlend=skyMode==='night'?(Number.isFinite(view?.skyNightBlend)?Math.max(0,Math.min(1,view.skyNightBlend)):1):0;
  if(camera&&isValid(camera,true))writeRegionBoardClear(camera,SKYCITY_BOARD_DAY_CLEAR,skyNightBlend,(r,g,b)=>new Color(r,g,b,255));
  gradeSkycityKeyLight(keyLight,skyNightBlend);gradeSkycityNight(rig,skyNightBlend);gradeSkycityCloudsea(rig,skyNightBlend);
 };
 syncNight();const offNight=onDayNightChange(syncNight);
 return Object.assign({},lease,{
  frame:(...args:Parameters<typeof lease.frame>)=>{syncNight();lease.frame(...args);},
  setVisible:(v:boolean)=>{syncNight();lease.setVisible(v);keepActive();},
  diagnostics:()=>({...lease.diagnostics?.(),skyMode,skyNightBlend,keyLuminance:keyLight?keyLight.luminance:null,skyClearColor:camera?[camera.clearColor.r,camera.clearColor.g,camera.clearColor.b]:null}),
  dispose:()=>{if(!dead){dead=true;offNight();}lease.dispose();}});
};
