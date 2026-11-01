import {LAKESIDE_DIR_LIGHT_PARAMS} from './LakesideSceneData';
/** r4 journey fix 2: ONE source for the lakeside main-light (sun) direction. LAKESIDE_DIR_LIGHT_PARAMS.sunForward is authored in the
 *  lakeside scene's own frame (r5h3 json Sun). The board rig is not turned (yaw 0), so its world direction is sunForward as-is; the
 *  journey mounts the same scene turned by lakesideJourney().yawDeg (180), so its sun must be turned with it, otherwise the light
 *  is mirrored relative to the lake at the landing swap. Same rotation as Cocos setRotationFromEuler(0,yawDeg,0) / LakesideCameraLayout
 *  rotY. Pure, no cc import; does not touch lakesideModeLighting. */
export const LAKESIDE_BOARD_YAW_DEG=0;
export function lakesideSunForward(yawDeg:number=LAKESIDE_BOARD_YAW_DEG):[number,number,number]{
 const f=LAKESIDE_DIR_LIGHT_PARAMS.sunForward,t=(Number.isFinite(yawDeg)?yawDeg:0)*Math.PI/180,c=Math.cos(t),s=Math.sin(t),z=(v:number)=>Math.abs(v)<1e-12?0:v;
 return [z(c*f[0]+s*f[2]),f[1],z(-s*f[0]+c*f[2])];}
