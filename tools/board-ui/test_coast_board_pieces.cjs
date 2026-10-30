'use strict';
/* coast-board-pieces (P1, decision 1): the coast pieces are 2D sprites that read as scene objects.
 * On all 7 screens with the coast config ON: 49 sprites sit on the projected slab centres (≤ 0.01 pt), sized by perspective
 * (far row narrower than near row by the projection ratio, never a constant screen size), each with a contact shadow ellipse
 * foreshortened by the camera pitch (h < w) under every piece (all shadows drawn before any piece), tinted with the kit lighting.
 * OFF (default): layoutPieces draws nothing and returns false. The component never writes a camera. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {createHarness}=require('./harness.cjs');const H=createHarness();
const K=H.load('ui/BoardKit'),B=H.load('ui/BoardProjection'),P=H.load('ui/CoastBoardPieces'),E=require('./coast-board-eval.cjs'),cc=H.cc||H.load('cc');
const src=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/ui/CoastBoardPieces.ts'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
assert.ok(!/setCamera|applyCameraPose|setEnterLevelEnd\s*\(|worldCamera|\.fov\s*=|\.camera\s*=|Camera\b/.test(src),'CoastBoardPieces must never touch the camera');
const mk=()=>{const n=new cc.Node('coast-pieces');n.addComponent(cc.UITransform);return n.addComponent(P.CoastBoardPieces);};
const frames=[0,1,2,3,4,5].map(()=>new cc.SpriteFrame()),types=[...Array(49).keys()].map(i=>i===24?-1:i%6);
assert.equal(mk().layoutPieces(390,844,types,frames),false,'coast config is off by default: nothing drawn');
B.setCoastBoardKit(true);
for(const [w,h] of E.SCREENS){const c=mk();assert.equal(c.layoutPieces(w,h,types,frames),true,w+'x'+h);const b=B.projectBoard(K.COAST_KIT,w,h),kids=c.node.children;
 assert.deepEqual(kids.slice(0,49).map(n=>n.name.replace(/\d+/,'')),Array(49).fill('shadow'),'shadows first');
 for(let i=0;i<49;i++){const pc=c.node.getChildByName('piece'+i),sh=c.node.getChildByName('shadow'+i),ex=b.centers[i];
  assert.ok(Math.abs(pc.position.x-(ex.x-w/2))<0.01&&Math.abs(pc.position.y-(h/2-ex.y))<0.01,'piece on its slab');assert.equal(pc.active,types[i]>=0);
  const g=sh.getComponent(cc.Graphics),el=g.ops.find(o=>o[0]==='ellipse');assert.ok(el&&el[4]<el[3],'shadow foreshortened (h < w)');}
 const wd=i=>c.node.getChildByName('piece'+i).getComponent(cc.UITransform).width,far=wd(3),near=wd(45),pf=Math.hypot(b.quads[3][1].x-b.quads[3][0].x,b.quads[3][1].y-b.quads[3][0].y),pn=Math.hypot(b.quads[45][1].x-b.quads[45][0].x,b.quads[45][1].y-b.quads[45][0].y);
 assert.ok(far<near,'far piece must be smaller');assert.ok(Math.abs(far/near-pf/pn)<0.01,'perspective ratio = projected slab ratio');
 console.log(`     ${w}x${h}: far piece ${far.toFixed(1)} pt, near ${near.toFixed(1)} pt (ratio ${(far/near).toFixed(3)} = slab ${(pf/pn).toFixed(3)}), shadow ${c.node.getChildByName('shadow3').getComponent(cc.Graphics).ops.find(o=>o[0]==='ellipse').slice(3,5).map(v=>(2*v).toFixed(1)).join('×')} pt`);}
B.setCoastBoardKit(false);assert.equal(K.kitFallbackCount(),0);
console.log('coast-board-pieces: PASS (in-scene sprites: perspective size, contact shadow, slab lighting; off by default; no camera writes)');
