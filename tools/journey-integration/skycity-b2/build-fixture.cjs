#!/usr/bin/env node
'use strict';
/* 运镜bot: full sky-city geometry for the plan-B r2 camera test (test-skycity-bridge-b2-camera.cjs). The shared occlusion fixture
 * (../occlusion/fixture-occluders.*) keeps only a box round the old cloud-bridge end (model local x ≲ 5), which drops the star
 * court's right half, its front rocks and floatingrocks_1 — exactly where plan B lands. This keeps EVERY triangle of the
 * Blender-decoded skycity GLB (same art as bundles/region_skycity/env_skycity.glb; decode with ../occlusion/decode-draco-blender.py)
 * whose centroid falls, under the plan A or plan B placement (r2-layout.json), inside the journey-world box KEEP (the box spanned
 * by her route and every lens pose of both plans on the 7 portrait screens, +8 m). Model-local float32, gzip.
 * Usage: node build-fixture.cjs [decoded skycity.glb]   (default QF_SKYCITY_DECODED_GLB or /workspace/wechat-game/work/b05an/dec/skycity.glb) */
const fs=require('fs'),zlib=require('zlib'),crypto=require('crypto'),path=require('path');
const {load}=require('../occlusion/lib-glb.cjs');
const src=process.argv[2]||process.env.QF_SKYCITY_DECODED_GLB||'/workspace/wechat-game/work/b05an/dec/skycity.glb';
const KEEP={min:[-15,-10,20],max:[28,36,85]};
const lay=JSON.parse(fs.readFileSync(__dirname+'/r2-layout.json','utf8'));
const rotY=(deg,p)=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
const places=Object.values(lay.plans).map(p=>q=>{const r=rotY(p.city.yawDeg,q);return [r[0]+p.city.offsetWorld[0],r[1]+p.city.offsetWorld[1],r[2]+p.city.offsetWorld[2]];});
const inside=q=>q.every((v,a)=>v>=KEEP.min[a]&&v<=KEEP.max[a]);
const nodes=load(src,{tris:true}).filter(n=>n.tris&&n.tris.length),objects=[],chunks=[];let offset=0;
for(const n of nodes){const keep=[];for(let k=0;k<n.tris.length;k+=9){const c=[0,1,2].map(a=>(n.tris[k+a]+n.tris[k+3+a]+n.tris[k+6+a])/3);if(places.some(f=>inside(f(c))))for(let i=0;i<9;i++)keep.push(n.tris[k+i]);}
 if(!keep.length)continue;const f=Float32Array.from(keep);chunks.push(Buffer.from(f.buffer));objects.push({name:n.name,offset,count:keep.length/9});offset+=f.byteLength;}
const bin=Buffer.concat(chunks);fs.writeFileSync(__dirname+'/fixture-skycity-full.bin.gz',zlib.gzipSync(bin,{level:9}));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const meta={note:'model-local triangles (float32 xyz×3) of the decoded skycity GLB kept by build-fixture.cjs',source:{file:path.basename(src),sha256:sha(fs.readFileSync(src))},keepWorldBox:KEEP,bytes:bin.length,binSha256:sha(bin),triangles:offset/36,objects};
fs.writeFileSync(__dirname+'/fixture-skycity-full.json',JSON.stringify(meta,null,1)+'\n');console.log(JSON.stringify({triangles:meta.triangles,bytes:meta.bytes,objects:objects.length}));
