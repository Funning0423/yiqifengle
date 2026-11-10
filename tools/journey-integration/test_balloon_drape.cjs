'use strict';
// P0 2026-11-05: deflated / mid-inflate envelope must not leave the load frame standing as scaffolding.
// Full inflate (t = 3) is the authored cruise pose: envelope mouth y 3.05, frame identity.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts/');
const H=require(path.join(ROOT,'tools/board-ui/harness.cjs')).createHarness();
const D=H.load(S+'region/BalloonDrape.ts');
const P=D.BALLOON_DRAPE;

function gltf(){
  const b=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb'));
  const n=b.readUInt32LE(12);return JSON.parse(b.slice(20,20+n).toString('utf8'));
}
const g=gltf();
const frame=g.nodes.find(n=>n.name==='balloon_load_frame');
assert.ok(frame&&frame.mesh===4,'load frame is its own node, mesh index 4 (appended)');
const root=g.nodes.find(n=>n.name==='transport_balloon');
assert.ok(root.children.includes(g.nodes.indexOf(frame)),'frame hangs off transport_balloon');
const prim=g.meshes[frame.mesh].primitives[0];
const ymin=g.accessors[prim.attributes.POSITION].min[1],ymax=g.accessors[prim.attributes.POSITION].max[1];
assert.ok(Math.abs(ymin-P.frameBaseY)<1e-3&&Math.abs(ymax-P.frameTopY)<1e-3,`frame bounds ${ymin}..${ymax} != drape constants`);
const basket=g.meshes[0];
const bmax=g.accessors[basket.primitives[0].attributes.POSITION].max[1];
assert.ok(bmax<1.20,`basket body must stop at the rim, got y ${bmax}`);
assert.equal(g.meshes[2].name,'balloon_envelope');

const samples=[];
for(let t=0;t<=3.0001;t+=1/30){
  const p=D.balloonDrapePose(t);
  const top=P.frameBaseY+(P.frameTopY-P.frameBaseY)*p.frameSy;
  if(p.frameVisible){
    assert.ok(top<=p.crownY+1e-3,`t ${t.toFixed(2)} frame top ${top.toFixed(2)} above crown ${p.crownY.toFixed(2)}`);
    assert.ok(top<=p.mouthY+(P.frameTopY-P.mouthFullY)+1e-3,`t ${t.toFixed(2)} cables reach above the mouth`);
  }
  assert.ok(p.crownY>p.mouthY,'crown above mouth');
  assert.ok(p.sy>0&&p.sxz>0);
  samples.push(p);
}
const z=D.balloonDrapePose(0),full=D.balloonDrapePose(3),mid=D.balloonDrapePose(0.9);
assert.ok(z.mouthY<0.5&&z.crownY>0.7&&z.crownY<1.05,'deflated cloth is a mound under the rim wood, not a disc at y 3');
assert.ok(z.sxz<0.45&&z.sy/z.sxz>0.35,'deflated aspect is a pile, not the old 0.12/0.55 disc');
assert.equal(z.frameVisible,false);
const home={p:{x:0,y:-3.05,z:0},s:{x:1,y:1,z:1}};
const y0=D.envelopeLocalY(z,home);
// world mouth = pivot 3.05 + localY + mouthMesh * sy
const mouthW=3.05+y0+P.mouthMeshY*z.sy;
assert.ok(Math.abs(mouthW-z.mouthY)<1e-6,'local Y puts the mouth on the drape target');
assert.ok(Math.abs(full.sy-1)<1e-9&&Math.abs(full.sxz-1)<1e-9&&Math.abs(full.mouthY-3.05)<1e-9,'t=3 is the authored envelope');
assert.ok(full.frameVisible&&Math.abs(full.frameSy-1)<1e-9&&Math.abs(full.frameLocalY)<1e-9&&Math.abs(full.frameSxz-1)<1e-9,'t=3 frame is identity');
assert.ok(Math.abs(D.envelopeLocalY(full,home)+3.05)<1e-9,'t=3 envelope local Y is the glTF rest -3.05');
assert.ok(mid.crownY>z.crownY+1.5&&mid.sxz>z.sxz,'mid-inflate has grown up and out');
assert.ok(mid.crownY> (mid.frameVisible?P.frameBaseY+(P.frameTopY-P.frameBaseY)*mid.frameSy:0),'mid crown covers the frame');
// node: deflated frame is off, full inflate restores the authored envelope + frame + flame
const cc=H.cc,vehicle=new cc.Node('transport_balloon'),sway=new cc.Node('envelope_sway_pivot'),env=new cc.Node('balloon_envelope');
const frameN=new cc.Node('balloon_load_frame'),flame=new cc.Node('burner_flame');
sway.setPosition(0,3.05,0);env.setPosition(0,-3.05,0);flame.setPosition(0,2.625,0);
vehicle.addChild(sway);sway.addChild(env);vehicle.addChild(frameN);vehicle.addChild(flame);
D.applyEnvelopeDrape(env,0,home);D.poseLoadFrameFromEnvelope(env,0);
assert.equal(frameN.active,true,'load frame stays authored while the shell drapes');
assert.ok(Math.abs(env.scale.x-1)<1e-9&&Math.abs(env.scale.y-1)<1e-9&&Math.abs(env.position.y+3.05)<1e-9,'deflated node is the glTF rest; the shell is vertex motion');
D.applyEnvelopeDrape(env,3,home);D.poseLoadFrameFromEnvelope(env,3);
assert.equal(frameN.active,true);
assert.ok(Math.abs(frameN.scale.x-1)<1e-6&&Math.abs(frameN.scale.y-1)<1e-6&&Math.abs(frameN.position.y)<1e-6,'full frame is identity');
assert.ok(Math.abs(env.position.y+3.05)<1e-6&&Math.abs(env.scale.x-1)<1e-6&&Math.abs(env.scale.y-1)<1e-6,'full envelope is the glTF rest pose');
assert.ok(Math.abs(flame.position.y-2.625)<1e-4,'flame returns to the authored burner');
const BT=H.load(S+'region/BalloonTransit.ts');
const o={p:{x:0,y:-3.05,z:0},s:{x:1,y:1,z:1}};
const stub={get position(){return {x:o.p.x,y:o.p.y,z:o.p.z,clone(){return {x:o.p.x,y:o.p.y,z:o.p.z};}};},get scale(){return {x:o.s.x,y:o.s.y,z:o.s.z,clone(){return {x:o.s.x,y:o.s.y,z:o.s.z};}};},setScale(x,y,z){o.s={x,y,z};},setPosition(x,y,z){o.p={x,y,z};}};
BT.yardEnvelope(stub,0);
assert.ok(Math.abs(o.s.y-1)<1e-9&&Math.abs(o.p.y+3.05)<1e-9,'yard stand-in keeps the authored node; cloth is test_balloon_cloth.cjs');
const adapter=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
assert.match(adapter,/applyEnvelopeDrape\(lenv,it,envHome\)/,'lakeside inflate drapes the same envelope');

console.log(JSON.stringify({node:'authored-rest',cloth:'test_balloon_cloth.cjs'}));
console.log('balloon-drape: PASS');
