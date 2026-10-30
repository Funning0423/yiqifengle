'use strict';
// b20 skin-bounds gate (场景设计部 report, Grok Bot → GGbot): skinned meshes are placed where Creator renders them.
// 1) synthetic skinned GLB through lib-glb load(): mesh node under an offset rig, one joint → bind pose, not node matrix.
// 2) real island palms (Draco) through the shared vertexMapper vs the live Creator worldBounds (rendered-palms.json): xz centre within
//    TOL_M; the old node-matrix path is ≥ 3 m off for the same palm, so this test fails on the old code.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),LG=require('../journey-integration/occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../..'),R=JSON.parse(fs.readFileSync(path.join(__dirname,'rendered-palms.json'),'utf8'));
const TOL_M=0.5; // live palms sway in the wind clip (lean palm 0.40 m at capture); the bug is 4–10 m
const checks=[];
{ // synthetic: rig at (10,0,0); mesh node child of rig (identity); joint J child of rig at (1,0,0); IBM = inverse(rig·J) ⇒ bind pose = authored world
  const f32=a=>Buffer.from(new Float32Array(a).buffer),u16=a=>Buffer.from(new Uint16Array(a).buffer);
  const pos=[11,0,0, 11,1,0, 12,0,0],jn=[0,0,0,0, 0,0,0,0, 0,0,0,0],wt=[1,0,0,0, 1,0,0,0, 1,0,0,0],ibm=[1,0,0,0,0,1,0,0,0,0,1,0,-11,0,0,1];
  const parts=[f32(pos),u16(jn),f32(wt),f32(ibm)];let off=0;const views=parts.map(p=>{const v={buffer:0,byteOffset:off,byteLength:p.length};off+=p.length;return v;});
  const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'rig',translation:[10,0,0],children:[1,2]},{name:'skinned',mesh:0,skin:0},{name:'J',translation:[1,0,0]}],
    meshes:[{primitives:[{attributes:{POSITION:0,JOINTS_0:1,WEIGHTS_0:2}}]}],skins:[{joints:[2],inverseBindMatrices:3}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'},{bufferView:1,componentType:5123,count:3,type:'VEC4'},{bufferView:2,componentType:5126,count:3,type:'VEC4'},{bufferView:3,componentType:5126,count:1,type:'MAT4'}],
    bufferViews:views,buffers:[{byteLength:off}]};
  const pad=(b,c)=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,c)]),J=pad(Buffer.from(JSON.stringify(json)),0x20),B=pad(Buffer.concat(parts),0);
  const hdr=Buffer.alloc(12);hdr.writeUInt32LE(0x46546c67,0);hdr.writeUInt32LE(2,4);hdr.writeUInt32LE(12+8+J.length+8+B.length,8);
  const ch=(buf,t)=>{const h=Buffer.alloc(8);h.writeUInt32LE(buf.length,0);h.writeUInt32LE(t,4);return Buffer.concat([h,buf]);};
  const dir=fs.mkdtempSync(path.join(path.resolve(ROOT,'..'),'.skin-selftest-')),file=path.join(dir,'s.glb');
  try{fs.writeFileSync(file,Buffer.concat([hdr,ch(J,0x4e4f534a),ch(B,0x004e4942)]));
    const n=LG.load(file).find(x=>x.name==='skinned'),xs=[n.tris[0],n.tris[3],n.tris[6]];
    assert.deepEqual(xs.map(x=>+x.toFixed(6)),[11,11,12],'skinned verts at bind pose (11..12), not rig·v (21..22): '+xs);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
  checks.push('lib-glb load(): skinned node uses joint world · inverseBind (synthetic rig offset 10 m ignored as Creator does)');
}
(async()=>{
  const dracoDir=[process.env.DRACO3D,path.join(ROOT,'tools/vendor-node/node_modules/draco3d')].filter(Boolean).find(d=>fs.existsSync(path.join(d,'draco3d.js')));
  if(!dracoDir){console.log('SKIP palms: no DRACO3D');console.log(JSON.stringify({status:'PASS',checks},null,1));return;}
  const crypto=require('crypto'),file=path.join(ROOT,R.glb);assert(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').startsWith(R.glbSha256Prefix),'room GLB changed: recapture rendered-palms.json');
  const boxes=await require('./skin-scan.cjs').skinnedBoxes(file,dracoDir),rows=[];
  for(const [name,r] of Object.entries(R.rendered)){const b=boxes.find(x=>x.name===name);assert(b,name);
    const dxz=c=>Math.hypot(c[0]-r.center[0],c[2]-r.center[2]),fixed=dxz(b.fixed.center),old=dxz(b.old.center);
    assert(fixed<=TOL_M,`${name}: corrected centre ${b.fixed.center.map(x=>x.toFixed(3))} is ${fixed.toFixed(3)} m from rendered ${r.center}`);
    if(/palm/.test(name))assert(old>=3,`${name}: old node-matrix path must be the ≥3 m bug (got ${old.toFixed(2)})`);
    rows.push([name,+old.toFixed(3),+fixed.toFixed(3)]);}
  console.log('SKIN_VS_RENDERED [name, old xz error m, fixed xz error m] '+JSON.stringify(rows));
  checks.push(`island skinned meshes (${rows.length}, 4 palms): corrected xz centre within ${TOL_M} m of the live Creator worldBounds; old path 4–10 m off`);
  for(const c of checks)console.log('PASS '+c);console.log(JSON.stringify({status:'PASS',checks},null,1));
})().catch(e=>{console.error(e);process.exit(1);});
