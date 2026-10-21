'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {load}=require('./load.cjs');
const M=load('ui/NodeMarkers.ts');
const P=load('region/RegionNodeProgress.ts');
const {REGION_NODES}=load('region/RegionNodes.ts');
const times=[0,0.4,0.8,1.2,1.6,12.3];
for(const t of times){
 const mesh=M.gemLocal('passed',t);
 for(const field of ['positions','normals','colors','indices'])assert.equal(mesh[field].length,0,`passed ${field} at ${t}`);
}
// Completed progress, including the sky-city arrival, must reach the same no-flag path.
const states=P.derive({completed:P.MAINLINE_STAGE_IDS.slice()},null);
const s0=REGION_NODES.skycity.nodes.find(n=>n.key==='S0');
assert.ok(s0.at.every((v,i)=>Math.abs(v-[5.4,-0.11,43.8][i])<0.002),'S0 matches the rounded example position');
assert.equal(states.nodes.S0,'passed');
for(const [key,phase] of Object.entries(states.nodes)){
 if(phase==='passed')assert.equal(M.gemLocal(phase,0).indices.length,0,key);
}
// Captured from the unmodified gemLocal: all geometry, normals, colors and indices.
// Samples include the playable animation extrema and wrap, plus a later frame.
const baselines=[
 ['playable',false,'6097993fc1d1bf7788078984c5c60021f028b80b126f2918816bd73049e1980f'],
 ['locked',false,'8a726532a35d6715922e46f77367e0ad13ca3976b250dae5d3b5789e42aa6b30'],
 ['passed',true,'70693ca68c5c4eb5cecb10a94a20bf87ef2c6c796525c4b1ce773de22b6bafca'],
 ['playable',true,'c06f6182b48f87f59e9996128477642a11cecb4ddccc95c070eb286231b32182'],
 ['locked',true,'ca4aedc82ab9939f9ee1fa0d87741a68b31addd40baf671feaced45dca9428cb'],
];
for(const [phase,foot,expected] of baselines){
 const meshes=times.map(t=>M.gemLocal(phase,t,foot));
 assert.ok(meshes.every(mesh=>mesh.indices.length>0),`${phase} foot=${foot} stays visible`);
 const actual=createHash('sha256').update(JSON.stringify(meshes)).digest('hex');
 assert.equal(actual,expected,`${phase} foot=${foot} geometry unchanged`);
}
console.log('node-markers-no-passed-flag PASS');
