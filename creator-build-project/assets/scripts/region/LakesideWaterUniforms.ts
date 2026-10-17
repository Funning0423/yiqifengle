import {Vec4} from 'cc';
import {LAKESIDE_WATER_SKY,LAKESIDE_WATER_UNIFORM_NAMES,lakesideWaterUniforms,type LakesideDayNight} from './LakesideSceneData';
/** r4 (VB): the ONLY writer of lakeside-water.effect uniforms. The board background's lake (LakesideBoardBackground) and the
 *  journey's lake (RegionJourneyAdapter) both call this with the current day/night mode, so the journey end and the board show
 *  the same water and reflected sky (LAKESIDE_WATER_SKY). Values are linear and go to the shader unchanged. */
export function applyLakesideWaterUniforms(m:{setProperty(name:string,v:any):void},mode:LakesideDayNight):void{
 const u=lakesideWaterUniforms(mode);for(const k of LAKESIDE_WATER_UNIFORM_NAMES){const v=u[k];m.setProperty(k,new Vec4(v[0],v[1],v[2],v[3]));}}
/** Node-from-GLB test shared by board and journey: is this lakeside instance one of the water GLBs? */
export function isLakesideWaterGlb(glb:string):boolean{return LAKESIDE_WATER_SKY.shared.glbs.includes(glb);}
