'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const ts=require('../qf-env.cjs').typescript(),root=path.resolve(__dirname,'../..'),dir=path.join(root,'creator-build-project/assets/scripts');
function core(n){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(dir,'render/'+n+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:m.exports,module:m});return m.exports;}
const F=core('IslandAtmosphereFxCore'),S=core('ShoreBreakCore');
const cams=[[-12,15.5,48],[0,1.55,-1.65],[19,4,20],[50,8,120]],gs=[0,1,2].map(k=>F.bandGeometry(k));
let minGap=Infinity,maxGap=-Infinity,minSea=Infinity,maxSea=-Infinity,oldHiddenFrames=0,samples=0;
for(let i=0;i<=960;i++){
 const t=i*S.SHORE.loopS/960,sea=S.SHORE.seaBaseY+S.seaSheetLift(t);minSea=Math.min(minSea,sea);maxSea=Math.max(maxSea,sea);if(sea>F.ISLAND_FX.seaY)oldHiddenFrames++;
 for(const cam of cams){const m=F.moonState(t,cam,1,sea),day=F.moonState(t,cam,0,sea);assert.equal(day.bandAlpha,0);assert.equal(day.moonAlpha,0);assert.ok(m.bandLayerAlpha.every(a=>Number.isFinite(a)&&a>=0&&a<=1));
  // Every generated sparkle vertex has local Y=0; yaw rotation and XZ-only scale keep it on the live sheet.
  for(const g of gs)for(let j=1;j<g.positions.length;j+=3){assert.equal(g.positions[j],0);const gap=m.bandPos[1]+g.positions[j]-sea;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);assert.ok(Math.abs(gap-.04)<1e-12);samples++;}
 }
}
assert.ok(oldHiddenFrames>0);assert.ok(maxSea-minSea>.1,'wave motion must remain');
for(const y of [undefined,NaN,Infinity])assert.equal(F.moonState(0,cams[0],1,y).bandPos[1],F.ISLAND_FX.seaY);
const world=fs.readFileSync(path.join(dir,'world-r1/WorldFlowComponent.ts'),'utf8');assert.ok(world.includes('this.shore?.advance(dt);this.atmosphere?.advance(dt,this.worldCamera?.node??null,this.getWindStrength(),this.shore?.surfaceWorldY());'));
const wrapper=fs.readFileSync(path.join(dir,'render/IslandAtmosphereFx.ts'),'utf8');assert.ok(wrapper.includes('moonState(this.time, cam, this.lightShown, seaSurfaceY)'));assert.ok(!wrapper.includes('overridePipelineStates'));
const glb=fs.readFileSync(path.join(root,'creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb')),n=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+n));const seaNode=doc.nodes.find(n=>n.name==='env_sea_surface');assert.ok(seaNode);assert.ok(Math.abs(seaNode.translation[1]-S.SHORE.seaBaseY)<1e-7);const mat=doc.materials[doc.meshes[seaNode.mesh].primitives[0].material];assert.ok(!mat.alphaMode||mat.alphaMode==='OPAQUE');
const out={pass:true,scope:'CPU dynamic geometry, live-sheet source wiring, actual GLB opaque sea; no GPU claim',loopS:S.SHORE.loopS,steps:961,cameras:cams.length,verticesChecked:samples,seaRange:[minSea,maxSea],beforeOccludedSamples:oldHiddenFrames,afterClearanceRange:[minGap,maxGap],depthPolicy:'unchanged builtin-unlit add, depthTest=true depthWrite=false; opaque foreground still occludes'};console.log(JSON.stringify(out,null,2));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2));
