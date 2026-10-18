'use strict';
// Sky-city broken bridge: both GLB nodes stay; only state_bridge_after is shown at each region entry.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const ROOT=path.resolve(__dirname,'../..');
const SCRIPTS=path.join(ROOT,'creator-build-project/assets/scripts');
const GLB=path.join(ROOT,'creator-build-project/assets/bundles/region_skycity/env_skycity.glb');
function loadTs(rel){
  const file=path.join(SCRIPTS,rel);
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const m={exports:{}};
  vm.runInNewContext(js,{module:m,exports:m.exports,require:()=>({}),console},{filename:file});
  return m.exports;
}
const B=loadTs('region/SkycityBridgeState.ts');
const F=loadTs('region/BalloonFlight.ts');
const read=(rel)=>fs.readFileSync(path.join(SCRIPTS,rel),'utf8');
function gltf(){
  const b=fs.readFileSync(GLB);let o=12,json=null;
  while(o<b.length){const len=b.readUInt32LE(o),type=b.readUInt32LE(o+4),chunk=b.subarray(o+8,o+8+len);if(type===0x4e4f534a)json=JSON.parse(chunk.toString('utf8'));o+=8+len;}
  return json;
}
const g=gltf();
function pathOf(i,seen=new Set()){
  if(seen.has(i))return g.nodes[i].name||('node'+i);seen.add(i);
  const parent=g.nodes.findIndex(n=>(n.children||[]).includes(i));
  const name=g.nodes[i].name||('node'+i);
  return parent<0?name:pathOf(parent,seen)+'/'+name;
}
const beforeIdx=g.nodes.findIndex(n=>n.name===B.SKYCITY_BRIDGE_BEFORE);
const afterIdx=g.nodes.findIndex(n=>n.name===B.SKYCITY_BRIDGE_AFTER);
assert.ok(beforeIdx>=0&&afterIdx>=0,'both bridge nodes exist in env_skycity.glb');
assert.equal(pathOf(beforeIdx),B.SKYCITY_BRIDGE_BEFORE_PATH);
assert.equal(pathOf(afterIdx),B.SKYCITY_BRIDGE_AFTER_PATH);
assert.equal((g.nodes[beforeIdx].children||[]).length,0);
assert.equal((g.nodes[afterIdx].children||[]).length,0);
assert.notEqual(beforeIdx,afterIdx);
const prims=name=>g.meshes[g.nodes.find(n=>n.name===name).mesh].primitives.length;
assert.equal(prims(B.SKYCITY_BRIDGE_BEFORE),1);
assert.equal(prims(B.SKYCITY_BRIDGE_AFTER),2);
const frozen=require(path.join(ROOT,'tools/journey-integration/frozen-production-inputs.json'));
const glbSha=crypto.createHash('sha256').update(fs.readFileSync(GLB)).digest('hex');
const pinned=frozen.files.find(f=>f.path==='creator-build-project/assets/bundles/region_skycity/env_skycity.glb');
assert.equal(glbSha,pinned.sha256,'glb bytes unchanged');
class N{
  constructor(name,meshPrims){this.name=name;this.active=true;this.children=[];this.parent=null;this.meshPrims=meshPrims||0;}
  get activeInHierarchy(){return this.active&&(!this.parent||this.parent.activeInHierarchy);}
}
function build(){
  const nodes=g.nodes.map(n=>new N(n.name||'',n.mesh==null?0:g.meshes[n.mesh].primitives.length));
  g.nodes.forEach((n,i)=>{for(const c of n.children||[]){nodes[c].parent=nodes[i];nodes[i].children.push(nodes[c]);}});
  const root=new N('env_skycity',0);
  for(const i of g.scenes[g.scene||0].nodes){nodes[i].parent=root;root.children.push(nodes[i]);}
  return root;
}
function find(n,name){if(n.name===name)return n;for(const c of n.children){const h=find(c,name);if(h)return h;}return null;}
function names(n,out=[]){out.push(n.name);for(const c of n.children)names(c,out);return out;}
function bridgePrims(n){let k=0;const w=x=>{if(x.name.startsWith('state_bridge_')&&x.activeInHierarchy)k+=x.meshPrims;for(const c of x.children)w(c);};w(n);return k;}
function activeState(n){const out={};const w=x=>{if(x.name.startsWith('state_'))out[x.name]=x.active;for(const c of x.children)w(c);};w(n);return out;}
function hideFlight(root){
  const set=new Set(F.ALWAYS_HIDDEN);
  const w=n=>{if(set.has(n.name))n.active=false;for(const c of n.children)w(c);};
  w(root);
}
function hideOtherBoardStates(root){
  const w=n=>{if(n.name.startsWith('state_')&&n.name!=='state_bridge_after')n.active=false;for(const c of n.children)w(c);};
  w(root);
}
const comp=read('world-r2/WorldNativeComposition.ts');
assert.match(comp,/n\.name\.startsWith\('state_'\)&&n\.name!=='state_bridge_after'\)n\.active=false/);
assert.match(comp,/hideOtherBoardStates\(ctx\.parent\?\.getChildByName\?\.\('SkycityLiveBackground'\)/);
const boardSrc=read('region/SkycityBoardBackground.ts');
assert.equal(crypto.createHash('sha256').update(boardSrc).digest('hex'),'39a44dc07fbf575d029c249a2745df24f21d403736cc254a911e2d531a068bd8','board background stays the Build05 plaza file');
assert.ok(F.ALWAYS_HIDDEN.includes('state_bridge_after'),'in-flight sky-arrival still hides the after mesh');
assert.ok(!F.ALWAYS_HIDDEN.includes('state_bridge_before'));
const visit=read('region/SkycityVisitAdapter.ts');
assert.equal((visit.match(/applySkycityBrokenBridge\(model\)/g)||[]).length,2,'first mount and show (return / resume)');
const journey=read('region/RegionJourneyAdapter.ts');
assert.match(journey,/journey-skycity-ambient-missing'\)[\s\S]{0,120}applySkycityBrokenBridge\(model\)/);
const transit=read('region/BalloonTransit.ts');
assert.match(transit,/showNamed\(model,ALWAYS_HIDDEN,false\);\s*applySkycityBridgeForBalloon\(model,handoff\);/);
assert.equal(B.applySkycityBrokenBridge(null),undefined);
assert.equal(B.applySkycityBridgeForBalloon(null,true),undefined);
function expectRegion(root,label){
  const before=find(root,B.SKYCITY_BRIDGE_BEFORE),after=find(root,B.SKYCITY_BRIDGE_AFTER);
  assert.ok(before&&after,label+' nodes kept');
  assert.equal(before.active,false,label+' before hidden');
  assert.equal(after.active,true,label+' after shown');
  assert.equal(before.activeInHierarchy,false,label+' before not drawn');
  assert.equal(after.activeInHierarchy,true,label+' after drawn');
  assert.equal(bridgePrims(root),prims(B.SKYCITY_BRIDGE_AFTER),label+' only after submeshes');
  assert.ok(before.parent.children.includes(before),label+' before not deleted');
  assert.ok(after.parent.children.includes(after),label+' after not deleted');
}
const freshNames=names(build()).sort();
const dayNight=[false,true];
for(const night of dayNight){
  const tag=night?'night':'day';
  const first=build();B.applySkycityBrokenBridge(first);expectRegion(first,'visit-first-'+tag);
  const back=build();B.applySkycityBrokenBridge(back);find(back,B.SKYCITY_BRIDGE_BEFORE).active=true;B.applySkycityBrokenBridge(back);expectRegion(back,'visit-return-'+tag);
  assert.deepEqual(activeState(first),activeState(back),'return matches first '+tag);
  const boardTree=build();
  const boardOnly=build();hideOtherBoardStates(boardOnly);
  B.applySkycityBrokenBridge(boardTree);hideOtherBoardStates(boardTree);
  expectRegion(boardTree,'board-'+tag);
  assert.deepEqual(activeState(boardTree),activeState(boardOnly),'board DC unchanged '+tag);
  const journeyTree=build();B.applySkycityBrokenBridge(journeyTree);expectRegion(journeyTree,'journey-'+tag);
  const flight=build();hideFlight(flight);B.applySkycityBridgeForBalloon(flight,false);
  assert.equal(find(flight,B.SKYCITY_BRIDGE_BEFORE).active,true,'sky-arrival in flight keeps before '+tag);
  assert.equal(find(flight,B.SKYCITY_BRIDGE_AFTER).active,false,'sky-arrival in flight hides after '+tag);
  assert.equal(find(flight,'state_court_after').active,false,'in-flight court after stays hidden');
  const landed=build();hideFlight(landed);B.applySkycityBridgeForBalloon(landed,true);
  expectRegion(landed,'balloon-arrival-'+tag);
  assert.equal(find(landed,'state_court_after').active,false,'arrival does not reveal other after states');
  assert.equal(find(landed,'state_gate_after').active,false);
  assert.equal(find(landed,'state_ring_after_stars').active,false);
  assert.deepEqual(names(landed).sort(),freshNames,'no nodes added at arrival');
  assert.equal(bridgePrims(landed),2);
  assert.ok(bridgePrims(flight)<bridgePrims(build()),'flight does not draw both bridge meshes');
}
const both=build();
assert.equal(bridgePrims(both),prims(B.SKYCITY_BRIDGE_BEFORE)+prims(B.SKYCITY_BRIDGE_AFTER));
B.applySkycityBrokenBridge(both);
assert.ok(bridgePrims(both)<prims(B.SKYCITY_BRIDGE_BEFORE)+prims(B.SKYCITY_BRIDGE_AFTER),'hiding before does not add DC');
assert.deepEqual(names(both).sort(),freshNames);
console.log(JSON.stringify({status:'PASS',before:B.SKYCITY_BRIDGE_BEFORE_PATH,after:B.SKYCITY_BRIDGE_AFTER_PATH,afterPrims:2,beforePrims:1,glbSha}));
