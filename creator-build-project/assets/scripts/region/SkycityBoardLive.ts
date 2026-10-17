/** r4.2 (GGbot): the sky-city board background = the Build05 lease (SkycityBoardBackground.ts, kept byte-for-byte: the 09 plaza
 *  composition is pinned by tools/journey-integration/test-journey-occlusion.cjs) plus what r4.2 needs around it. */
import {Camera,Color,Node,isValid} from 'cc';
import type {LevelBackgroundFactory} from '../world-r2/LevelBackground';
import {createSkycityBoardBackground as createBuild05SkycityBoard} from './SkycityBoardBackground';
import {onDayNightChange} from '../world-r1/DayNightContract';
import {hexToRgb,regionNightNow,writeRegionBoardClear} from './RegionBoardNight';
export const SKYCITY_BOARD_RIG='SkycityLiveBackground';
/** item 9: the Build05 board sky (camera clear colour) by day; at night the journey's night sky (the ground already matched). */
export const SKYCITY_BOARD_DAY_CLEAR=hexToRgb('#9ccadf');
export const createSkycityBoardBackground:LevelBackgroundFactory=async ctx=>{
 const lease=await createBuild05SkycityBoard(ctx);if(!lease)return lease;
 const rig:Node|null=ctx.parent.getChildByName(SKYCITY_BOARD_RIG);
 // items 10/11: the scene stays active under the still-hidden board host, so it switches on during the hidden pre-activation and
 // the swap frame only turns its camera on. The Build05 lease toggles rig+camera in setVisible; the rig is put straight back (its
 // setVisible(false) calls come with the host hidden: binding load, lease hide), the camera keeps following visibility.
 const keepActive=()=>{if(rig&&isValid(rig,true)&&!rig.active)rig.active=true;};keepActive();
 // item 9 (Mac r4: daytime sky behind the night journey): the board sky follows the world day/night mode and its toggles.
 const camNode=rig?rig.getChildByName('SkycityBackgroundCamera'):null,camera:Camera|null=camNode?camNode.getComponent(Camera):null;let dead=false;
 const syncNight=()=>{if(!dead&&camera&&isValid(camera,true))writeRegionBoardClear(camera,SKYCITY_BOARD_DAY_CLEAR,regionNightNow()?1:0,(r,g,b)=>new Color(r,g,b,255));};
 syncNight();const offNight=onDayNightChange(syncNight);
 return Object.assign({},lease,{setVisible:(v:boolean)=>{lease.setVisible(v);keepActive();},dispose:()=>{if(!dead){dead=true;offNight();}lease.dispose();}});
};
