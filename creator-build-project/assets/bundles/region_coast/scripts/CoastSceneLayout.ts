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
  kind:MatKind;alpha:number;/** opaque palette mesh: coast_palette clone of the island M_env_palette */palette:boolean;castShadow:boolean;receiveShadow:boolean;anim:string|null}>;

export const COAST_BUNDLE='region_coast';
export const COAST_LAYOUT_PATH='data/coast_layout';
/** coast palette (env_palette_256 layout; bands 0/11/12 coast swatches, band 13 = island emissive band unchanged). */
export const COAST_PALETTE_PATH='textures/coast_palette_256/texture';
/** same texture with every texel mixed 38% toward #E9D7B0 (sand): the sand-tinted reuse rocks (tint:'sand'). Same effect, no new shader. */
export const COAST_PALETTE_SAND_PATH='textures/coast_palette_sand_256/texture';
export const COAST_SAND_TINT=Object.freeze({srgb:'#E9D7B0',amount:0.38});
export const COAST_MODELS_DIR='models';
export const COAST_ROOT=Object.freeze({name:'region_coast_root',position:[-0.6,-0.845,21.5] as V3,yawDeg:180,scale:1});
/** Node names inside models/*.glb == layout mesh names (checked by tools/coast-scene/test_coast_scene_loader.cjs). */
/** From coast_meshes.json (build_coast.py): unlit / emit / alpha < 1. Everything else: std, alpha 1. */
export const COAST_MESH_FLAGS:Readonly<Record<string,{unlit?:boolean;emit?:boolean;alpha?:number}>>=Object.freeze({
  beacon_lamp:{emit:true},foam:{unlit:true,alpha:0.92},foam_inner:{unlit:true,alpha:0.55},beacon_line:{unlit:true,emit:true,alpha:0.9},
  tide_sheet:{alpha:0.6},sidepool:{alpha:0.7}});
/** r6 (coast-reuse-bake): net / crabtrap_mesh / seaglass / anemone are OPAQUE coast_palette meshes (no island translucent/emissive
 *  material fits them, MATERIAL_MAP.md NONE); contact / blob / footprints are removed (no instances, meshes dropped from models/*.glb). */
const CAST_RE=/^rock_|^reuse_rock|ebb_bell|crab|gull|hermit|headland|beacon_post|reuse_palm|reuse_bush/;

export function coastInstances(L:CoastLayout):CoastInstance[]{
  const out:CoastInstance[]=[];L.layout.forEach((e,index)=>{if(e.piece||/^piece_/.test(e.mesh))return;   // runtime layout has none; never mount board pieces here
    const f=COAST_MESH_FLAGS[e.mesh]||{},unlit=!!(f.unlit||f.emit);
    out.push({index,mesh:e.mesh,reuse:!!e.reuse,position:[e.p[0],e.p[1],e.p[2]],
      eulerDeg:[e.tilt?e.tilt[0]:0,e.rz*180/Math.PI,e.tilt?e.tilt[1]:0],scale:e.s,kind:unlit?'unlit':'std',alpha:f.alpha??1,palette:(f.alpha??1)>=1&&!f.unlit,
      castShadow:!!(e.cast_shadow||CAST_RE.test(e.mesh))&&!f.unlit,receiveShadow:!(e.receive_shadow===false||f.unlit),anim:e.anim??null});});
  return out;}
/** World point (island scene_root frame) of a coast-local point under COAST_ROOT (yaw about +Y). */
export function coastWorldOf(p:V3,root=COAST_ROOT):V3{const a=root.yawDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),k=root.scale;
  return [root.position[0]+k*(c*p[0]+s*p[2]),root.position[1]+k*p[1],root.position[2]+k*(-s*p[0]+c*p[2])];}
/** The 12 reuse:true names (91 instances).
 *  from:'island'      -> GGbot's resolveReuse clones node src(+'_rig') of the mounted island prefab (palms: skinned rigs, island materials).
 *  from:'region_coast'-> baked copy of the island source in models/coast_reuse.glb; the loader finds the node named src there
 *                        (node names == island art names, unique in region_coast/models) and gives it the coast_palette material
 *                        (tint 'sand' -> coast_palette_sand). Geometry: island art (tools/coast-scene/bake_reuse.py), poly-reduced, UVs
 *                        kept except faces on rewritten bands 0/11/12 (snapped, ΔE00 in product/2026-10-30/coast-reuse-bake).
 *  norm (DATA, applied by the loader on an inner child): child scale = norm.scale, child y = norm.offsetY (max horizontal half-size 1 m,
 *  base at -0.1 m). reuse_rock_s* share the reuse_rock_* mesh (same src node). */
export type CoastReuseSource=Readonly<{count:number;src:string;from:'island'|'region_coast';norm?:Readonly<{scale:number;offsetY:number}>;tint?:'sand';note?:string}>;
export const COAST_REUSE_SOURCES:Readonly<Record<string,CoastReuseSource>>=Object.freeze({
  reuse_grass_a:{count:25,src:'env_prop_grass_tuft_01',from:'region_coast'},reuse_grass_b:{count:19,src:'env_prop_grass_tuft_02',from:'region_coast'},
  reuse_flowers:{count:16,src:'env_prop_flowers_01',from:'region_coast'},
  reuse_rock_0:{count:3,src:'env_prop_rock_01',from:'region_coast',norm:{scale:1.84991,offsetY:-0.1777}},reuse_rock_1:{count:3,src:'env_prop_rock_02',from:'region_coast',norm:{scale:1.07753,offsetY:-0.15926}},
  reuse_rock_2:{count:1,src:'env_prop_rock_03',from:'region_coast',norm:{scale:0.56613,offsetY:-0.15944}},
  reuse_rock_s0:{count:5,src:'env_prop_rock_01',from:'region_coast',norm:{scale:1.84991,offsetY:-0.1777},tint:'sand'},reuse_rock_s1:{count:7,src:'env_prop_rock_02',from:'region_coast',norm:{scale:1.07753,offsetY:-0.15926},tint:'sand'},
  reuse_rock_s2:{count:6,src:'env_prop_rock_03',from:'region_coast',norm:{scale:0.56613,offsetY:-0.15944},tint:'sand'},
  reuse_bush:{count:3,src:'env_prop_hydrangea_bush_01',from:'region_coast'},
  reuse_palm_tall:{count:2,src:'env_prop_palm_tall_01',from:'island'},reuse_palm_lean:{count:1,src:'env_prop_palm_lean_01',from:'island'}});
/** names GGbot's resolveReuse is asked for (island only) */
export const COAST_ISLAND_REUSE=Object.freeze(Object.keys(COAST_REUSE_SOURCES).filter(k=>COAST_REUSE_SOURCES[k].from==='island'));
export const COAST_MATERIAL_KEYS=Object.freeze(Object.keys(COAST_MESH_FLAGS));
