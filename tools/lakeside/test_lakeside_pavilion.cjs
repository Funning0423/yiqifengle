// v3.4 "restore the pavilion on the bridge" (VB): finding = nothing to restore. The pavilion seen ON the bridge before 0932b6b was the
// r5h3 ASSETS-collection template LK_pavilion at the origin (hide_render in the .blend, never in the r5h3 render; the bridge centre is
// at the origin, so it stacked on the bridge). The only real placement, LK_pavilion_i at (13.6, 0.55, -4.6) on the right shore, is
// kept by the runtime filter (431 instances) and is outside both the r5h3 board camera and every in-game aligned board camera, exactly
// as in the r5h3 reference frame. Guard: one real pavilion, never a template, and no pavilion inside the board frame.
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createHarness}=require('../board-ui/harness.cjs');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/',B=ROOT+'/creator-build-project/assets/bundles/region_lakeside/';
const H=createHarness(),D=H.load(S+'region/LakesideSceneData.ts'),CP=H.load(S+'world-r1/CameraPose.ts'),LK=H.load(S+'region/LakesideCameraLayout.ts'),BL=H.load(S+'ui/BoardLayout.ts');
const all=JSON.parse(fs.readFileSync(B+'scene_r5h_slim_transforms.json','utf8')).instances,live=D.lakesideSceneInstances(all);
assert.equal(live.length,813,'runtime lakeside instances (431 r5h3 + 11 b16 boardwalk + 29 far-ring clusters + 275 near scatter + 67 seal bushes)');
const pav=live.filter(i=>i.glb==='LK_pavilion.glb');
assert.equal(pav.length,1,'exactly one pavilion (r5h3 COCOS_HANDOFF: LK_pavilion unique)');
assert.equal(pav[0].name,'LK_pavilion_i');assert.deepEqual([...pav[0].pos],[13.6,0.55,-4.6],'the real r5h3 placement (right shore)');
assert(!all.some(i=>i.name==='LK_pavilion'),'template not exported');assert.equal(D.isLakesideAssetTemplate({name:'LK_pavilion',glb:'LK_pavilion.glb'}),true,'a template would be filtered');
// every pavilion vertex (float32 POSITION, no node transform in the GLB) placed at its transform (identity rotation, unit scale)
const glb=fs.readFileSync(B+'models/LK_pavilion.glb'),jl=glb.readUInt32LE(12),j=JSON.parse(glb.slice(20,20+jl).toString()),acc=j.accessors[j.meshes[0].primitives[0].attributes.POSITION],bv=j.bufferViews[acc.bufferView];
assert.equal(acc.componentType,5126);assert(j.nodes.every(n=>!n.matrix&&!n.rotation&&!n.scale&&!n.translation),'GLB nodes carry no transform');
const bin=20+jl+8+(bv.byteOffset||0)+(acc.byteOffset||0),stride=bv.byteStride||12,corners=[];
for(let k=0;k<acc.count;k++){const o=bin+k*stride;corners.push([glb.readFloatLE(o)+13.6,glb.readFloatLE(o+4)+0.55,glb.readFloatLE(o+8)-4.6]);}
const inFrame=(pose,aspect)=>corners.some(c=>{const q=CP.projectPoint(pose,aspect,c);return q.depth>0&&Math.abs(q.x)<=1&&Math.abs(q.y)<=1;});
const C=D.LAKESIDE_BOARD_CAMERA,p=C.position,f=C.forward;
const r5h3=CP.fromLookAt({position:[...p],target:[p[0]+f[0]*20,p[1]+f[1]*20,p[2]+f[2]*20],fovVerticalDeg:C.fovVerticalDeg},C.fovVerticalDeg);
assert(!inFrame(r5h3,C.referenceAspect),'r5h3 board camera: pavilion off-frame (as in lakeside_r5h3_demo_lastframe.png)');
const q0=CP.projectPoint(r5h3,C.referenceAspect,[0,0,0]);assert(q0.depth>0&&Math.abs(q0.x)<0.1&&Math.abs(q0.y)<0.2,'origin (where the ghost stood) = bridge centre, mid-frame');
const layouts=[[360,780,{top:0,bottom:0,left:0,right:0,capsule:null}],[390,844,{top:47,bottom:34,left:0,right:0,capsule:{left:281,top:51,right:368,bottom:83}}],[375,667,{top:20,bottom:0,left:0,right:0,capsule:{left:278,top:26,right:365,bottom:58}}],[414,896,{top:44,bottom:34,left:0,right:0,capsule:{left:305,top:48,right:392,bottom:80}}],[768,1024,{top:20,bottom:0,left:0,right:0,capsule:null}]];
// b18b (Grok Bot decision): iPad portrait 768×1024 is exempt. The B″ board lens keeps the 390×844 framing; on the 0.75-aspect pad
// the wider horizontal view brings the pavilion's corner in at the right edge. Narrowing the FOV there would push the heroine
// off the bottom on 390×520 (same aspect), and the pad is not a WeChat phone target.
const EXEMPT=new Set(['768x1024']);
for(const [W,Hh,safe] of layouts){if(EXEMPT.has(W+'x'+Hh))continue;const g=BL.boardLayout(W,Hh,safe,2),frame={width:W,height:Hh,boardTop:g.tray.y-g.tray.height/2,board:{x:g.grid.x,y:g.grid.y,size:g.grid.size}};
 assert(!inFrame(LK.lakesideAlignedBoardPose(frame),W/Hh),W+'x'+Hh+' aligned board camera: pavilion off-frame');}
const minX=pose=>Math.min(...corners.map(c=>CP.projectPoint(pose,C.referenceAspect,c).x));
console.log('lakeside pavilion OK (r5h3 cam min NDC x '+minX(r5h3).toFixed(3)+'): 1 real placement (LK_pavilion_i, right shore), 0 templates, 813 instances, off-frame in r5h3 + '+layouts.length+' board layouts');
