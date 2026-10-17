// Full skycity geometry (model-local), from the Blender-decoded GLB (/workspace/wechat-game/work/b05an/dec/skycity.glb; same art as
// bundles/region_skycity/env_skycity.glb md5 1da0119…). The r4 occlusion fixture is clipped to a box around the old cloud-bridge end
// (local x ≲ 5), which hides everything on the court's right/front-right side, so plan B r2 uses this instead.
const {load}=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/occlusion/lib-glb.cjs');
const SKIP=/^chr_robot|cloudsea|cumulus|islets_far|cloud_small|env_sky_birds|greattree_canopy|starring|ring_|pennant|waterfall|state_.*before/;
const all=load('/workspace/wechat-game/work/b05an/dec/skycity.glb',{tris:true});
module.exports=all.filter(n=>n.tris&&n.tris.length&&!SKIP.test(n.name)).map(n=>({name:n.name,tris:Float64Array.from(n.tris)}));
