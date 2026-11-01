'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,ROOT}=require('./load.cjs');
const B=load('region/NodeBoardPose.ts');
const C=load('region/ExploreCameraCore.ts');
const N=load('region/RegionNodes.ts');
const defaults=[];
for(const region of ['island','meadow','skycity']){
 for(const node of N.REGION_NODES[region].nodes){
  for(const [w,h] of C.SCREENS){
   const pose=B.nodeBoardPose(region,node.key,w,h);
   if(pose==='default'){defaults.push(region+':'+node.key);continue;}
   assert.ok(pose.position&&pose.fovVerticalDeg>1);
  }
 }
}
const meadow=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/MeadowBoardBackground.ts'),'utf8');
const sky=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/SkycityBoardBackground.ts'),'utf8');
assert.ok(meadow.includes('setAnchor'));
assert.ok(sky.includes('skycityVisitPose'));
assert.ok(!sky.includes('setAnchor'),'skycity board file stays SHA-pinned by journey-occlusion');
const report={defaults:[...new Set(defaults)].sort(),note:'F6 allows default. Island stays on the 2D board. Meadow and skycity mainline nodes stay on the regional camera until a per-node pose clears 99.5% coverage.'};
fs.writeFileSync(path.join(__dirname,'board-defaults.json'),JSON.stringify(report,null,1)+'\n');
assert.ok(defaults.length>0);
console.log('node-board-pose PASS defaults',new Set(defaults).size);
