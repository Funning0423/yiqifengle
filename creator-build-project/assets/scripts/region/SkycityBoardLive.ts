/** r4.2 (GGbot): the sky-city board background = the Build05 lease (SkycityBoardBackground.ts, kept byte-for-byte: the 09 plaza
 *  composition is pinned by tools/journey-integration/test-journey-occlusion.cjs) plus what r4.2 needs around it. */
import {Node,isValid} from 'cc';
import type {LevelBackgroundFactory} from '../world-r2/LevelBackground';
import {createSkycityBoardBackground as createBuild05SkycityBoard} from './SkycityBoardBackground';
export const SKYCITY_BOARD_RIG='SkycityLiveBackground';
export const createSkycityBoardBackground:LevelBackgroundFactory=async ctx=>{
 const lease=await createBuild05SkycityBoard(ctx);if(!lease)return lease;
 const rig:Node|null=ctx.parent.getChildByName(SKYCITY_BOARD_RIG);
 // items 10/11: the scene stays active under the still-hidden board host, so it switches on during the hidden pre-activation and
 // the swap frame only turns its camera on. The Build05 lease toggles rig+camera in setVisible; the rig is put straight back (its
 // setVisible(false) calls come with the host hidden: binding load, lease hide), the camera keeps following visibility.
 const keepActive=()=>{if(rig&&isValid(rig,true)&&!rig.active)rig.active=true;};keepActive();
 return Object.assign({},lease,{setVisible:(v:boolean)=>{lease.setVisible(v);keepActive();}});
};
