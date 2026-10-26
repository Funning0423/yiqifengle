'use strict';
// meadow obstacle triangles (model-local), same set as 场景设计部's tools/meadow-walk/lib/meadow-geo.cjs (e4ae91c1)
const R=require('path').resolve(__dirname,'../..');const {load}=require(R+'/tools/journey-integration/occlusion/lib-glb.cjs');
const OBST=/meadow_fence|meadow_trees|wind_bell|windmill_static|^meadow_river$/;
module.exports={obs:load(R+'/creator-build-project/assets/bundles/region_meadow/env_meadow.glb').filter(n=>n.tris&&n.tris.length&&OBST.test(n.name))};
