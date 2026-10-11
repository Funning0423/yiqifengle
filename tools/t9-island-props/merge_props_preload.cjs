'use strict';
/* QA only: node -r merge_props_preload.cjs <camtest>/test_camera_frames.cjs — merges T9 world props into the decoded island geometry. */
const path=require('path'),camtest=process.env.T9_CAMTEST;
const G=require(path.join(camtest,'glb_geometry.cjs')),{load,ROOT}=require('./load_ts.cjs');
const P=load(['world-r1/CameraPose','world-r2/IslandPropsLayout']).IslandPropsLayout.ISLAND_PROPS,dir=path.join(ROOT,'creator-build-project/assets/bundles/region_island',P.dir);
const orig=G.decode;
G.decode=async(glbPath)=>{const base=await orig(glbPath);if(!base||glbPath)return base;const meshes={...base.meshes};
  for(const p of [P.signpost,...P.palms]){const g=await orig(path.join(dir,p.prefab+'.glb'));const a=p.yawDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    for(const [n,tris] of Object.entries(g.meshes))meshes['T9:'+n]=tris.map(t=>t.map(v=>[p.position[0]+p.scale*(v[0]*c+v[2]*s),p.position[1]+p.scale*v[1],p.position[2]+p.scale*(-v[0]*s+v[2]*c)]));}
  console.log('T9 preload merged',Object.keys(meshes).filter(k=>k.startsWith('T9:')).join(','));return {...base,meshes};};
