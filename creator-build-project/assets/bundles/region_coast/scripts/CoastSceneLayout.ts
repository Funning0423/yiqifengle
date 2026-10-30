/**
 * 海岸 A 潮池礁盘 runtime placement core (engine-free, node-testable). 场景设计部 2026-10-30.
 * Turns data/coast_layout.json (runtime copy, no piece_* entries) into per-instance TRS in the coast root's local frame,
 * using the SAME convention as tools/coast-scene/coastshot.js inst():
 *   position = p (Cocos metres, +Y up, z = -Blender y), euler = (tilt[0], rz*180/PI, tilt[1]) degrees (Node.setRotationFromEuler),
 *   uniform scale s.
 * The coast root sits in the island scene_root frame at COAST_ROOT.position with yaw COAST_ROOT.yawDeg (180), so
 *   world = (pos.x - x, pos.y + y, pos.z - z) for an un-rotated child (see coastWorldOf, tested).
 * Shadows / material kinds mirror coastshot.js (mesh flags from coast_meshes.json are baked into COAST_MESH_FLAGS below).
 */
export type V3=[number,number,number];
export type CoastLayoutEntry=Readonly<{mesh:string;p:V3;rz:number;s:number;tilt?:[number,number];reuse?:boolean;piece?:boolean;
  cast_shadow?:boolean;receive_shadow?:boolean;anim?:string;k?:number;board_cell?:unknown}>;
export type CoastLayout=Readonly<{placement?:{position:V3;yaw_deg:number;scale:number};layout:readonly CoastLayoutEntry[]}>;
export type MatKind='std'|'unlit';
export type CoastInstance=Readonly<{index:number;mesh:string;reuse:boolean;position:V3;eulerDeg:V3;scale:number;
  kind:MatKind;alpha:number;castShadow:boolean;receiveShadow:boolean;anim:string|null}>;

export const COAST_BUNDLE='region_coast';
export const COAST_LAYOUT_PATH='data/coast_layout';
export const COAST_MODELS_DIR='models';
export const COAST_ROOT=Object.freeze({name:'region_coast_root',position:[-0.6,-0.845,21.5] as V3,yawDeg:180,scale:1});
/** Node names inside models/*.glb == layout mesh names (checked by tools/coast-scene/test_coast_scene_loader.cjs). */
/** From coast_meshes.json (build_coast.py): unlit / emit / alpha < 1. Everything else: std, alpha 1. */
export const COAST_MESH_FLAGS:Readonly<Record<string,{unlit?:boolean;emit?:boolean;alpha?:number}>>=Object.freeze({
  net:{alpha:0.85},crabtrap_mesh:{alpha:0.6},footprints:{unlit:true,alpha:0.55},beacon_lamp:{emit:true},foam:{unlit:true,alpha:0.92},
  foam_inner:{unlit:true,alpha:0.55},contact:{unlit:true,alpha:0.42},seaglass:{emit:true},beacon_line:{unlit:true,emit:true,alpha:0.9},
  anemone:{emit:true},tide_sheet:{alpha:0.6},sidepool:{alpha:0.7},blob:{unlit:true,alpha:0.42}});
const CAST_RE=/^rock_|^reuse_rock|ebb_bell|crab|gull|hermit|headland|beacon_post|reuse_palm|reuse_bush/;

export function coastInstances(L:CoastLayout):CoastInstance[]{
  const out:CoastInstance[]=[];L.layout.forEach((e,index)=>{if(e.piece||/^piece_/.test(e.mesh))return;   // runtime layout has none; never mount board pieces here
    const f=COAST_MESH_FLAGS[e.mesh]||{},unlit=!!(f.unlit||f.emit||e.mesh==='reuse_cloud');
    out.push({index,mesh:e.mesh,reuse:!!e.reuse,position:[e.p[0],e.p[1],e.p[2]],
      eulerDeg:[e.tilt?e.tilt[0]:0,e.rz*180/Math.PI,e.tilt?e.tilt[1]:0],scale:e.s,kind:unlit?'unlit':'std',alpha:f.alpha??1,
      castShadow:!!(e.cast_shadow||CAST_RE.test(e.mesh))&&!f.unlit,receiveShadow:!(e.receive_shadow===false||f.unlit),anim:e.anim??null});});
  return out;}
/** World point (island scene_root frame) of a coast-local point under COAST_ROOT (yaw about +Y). */
export function coastWorldOf(p:V3,root=COAST_ROOT):V3{const a=root.yawDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),k=root.scale;
  return [root.position[0]+k*(c*p[0]+s*p[2]),root.position[1]+k*p[1],root.position[2]+k*(-s*p[0]+c*p[2])];}
/** The 13 reuse:true names (96 instances) GGbot's resolveReuse must resolve from already-loaded island resources.
 *  src = island art the preview baked them from (build_coast.py bake_glb); note = transform the bake applied that the template must match. */
export const COAST_REUSE_SOURCES:Readonly<Record<string,{count:number;src:string;note?:string}>>=Object.freeze({
  reuse_grass_a:{count:25,src:'env_prop_grass_tuft_01'},reuse_grass_b:{count:19,src:'env_prop_grass_tuft_02'},reuse_flowers:{count:16,src:'env_prop_flowers_01'},
  reuse_rock_0:{count:3,src:'env_prop_rock_01',note:'normalised: max |x|,|y| = 1 m, base at -0.1 m'},reuse_rock_1:{count:3,src:'env_prop_rock_02',note:'normalised as rock_0'},
  reuse_rock_2:{count:1,src:'env_prop_rock_03',note:'normalised as rock_0'},
  reuse_rock_s0:{count:5,src:'env_prop_rock_01',note:'normalised as rock_0; preview tinted 38% toward #E9D7B0 (sand) - no tint on the island palette'},
  reuse_rock_s1:{count:7,src:'env_prop_rock_02',note:'as rock_s0'},reuse_rock_s2:{count:6,src:'env_prop_rock_03',note:'as rock_s0'},
  reuse_bush:{count:3,src:'env_prop_hydrangea_bush_01'},reuse_palm_tall:{count:2,src:'env_prop_palm_tall_01'},reuse_palm_lean:{count:1,src:'env_prop_palm_lean_01'},
  reuse_cloud:{count:5,src:'env_cloud_01'}});
export const COAST_MATERIAL_KEYS=Object.freeze(Object.keys(COAST_MESH_FLAGS));
