#!/usr/bin/env node
'use strict';
/**
 * b20 (场景设计部): after move-island-prop.cjs edits env_island_props_merged in the island room GLB, carry the SAME vertex moves into
 * tools/journey-integration/occlusion/fixture-occluders.bin.gz (the model-space triangles every journey / camera gate reads) without a
 * Blender re-export of the other GLBs. Old vs new positions come from decoding the committed GLB (git HEAD, or --old <file>) and the
 * working-tree GLB; every fixture vertex of env_island_props_merged equal (float32) to a moved point is replaced; the island source
 * sha256 and binSha256 are refreshed. Refuses when a moved point is ambiguous or absent. Usage:
 *   node tools/region-nodes/sync-occlusion-fixture-props.cjs [--old old.glb]
 */
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),cp=require('child_process');
const D=require(process.env.DRACO3D||'/tmp/draco3d/node_modules/draco3d');
const ROOT=path.join(__dirname,'../..'),REL='creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb',OCC=path.join(ROOT,'tools/journey-integration/occlusion');
const i=process.argv.indexOf('--old'),oldBuf=i>0?fs.readFileSync(process.argv[i+1]):cp.execFileSync('git',['show','HEAD:'+REL],{cwd:ROOT,maxBuffer:64<<20}),newBuf=fs.readFileSync(path.join(ROOT,REL));
async function pos(f){const L=f.readUInt32LE(12),j=JSON.parse(f.slice(20,20+L).toString()),bo=20+L+8;const pr=j.meshes.find(m=>m.name==='env_island_props_merged').primitives[0],ext=pr.extensions.KHR_draco_mesh_compression,bv=j.bufferViews[ext.bufferView];
 const b=f.slice(bo+(bv.byteOffset||0),bo+(bv.byteOffset||0)+bv.byteLength);const M=await D.createDecoderModule({}),dec=new M.Decoder(),db=new M.DecoderBuffer();db.Init(new Int8Array(b),b.length);const m=new M.Mesh();if(!dec.DecodeBufferToMesh(db,m).ok())throw Error('decode');
 const a=dec.GetAttributeByUniqueId(m,ext.attributes.POSITION),arr=new M.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(m,a,arr);const v=new Float32Array(m.num_points()*3);for(let k=0;k<v.length;k++)v[k]=arr.GetValue(k);return v;}
(async()=>{const A=await pos(oldBuf),B=await pos(newBuf);if(A.length!==B.length)throw Error('point count changed');
 const key=(x,y,z)=>x+','+y+','+z,map=new Map();for(let k=0;k<A.length;k+=3)if(A[k]!==B[k]||A[k+1]!==B[k+1]||A[k+2]!==B[k+2]){const kk=key(A[k],A[k+1],A[k+2]),to=[B[k],B[k+1],B[k+2]];const was=map.get(kk);if(was&&was.join()!==to.join())throw Error('ambiguous move for '+kk);map.set(kk,to);}
 // an unmoved point must not share coordinates with a moved one
 for(let k=0;k<A.length;k+=3)if(A[k]===B[k]&&A[k+1]===B[k+1]&&A[k+2]===B[k+2]&&map.has(key(A[k],A[k+1],A[k+2])))throw Error('moved point coincides with a fixed point');
 const meta=JSON.parse(fs.readFileSync(path.join(OCC,'fixture-occluders.json'),'utf8')),bin=zlib.gunzipSync(fs.readFileSync(path.join(OCC,'fixture-occluders.bin.gz')));
 const f32=new Float32Array(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.length)),src=meta.sources.find(s=>s.id==='island'),o=src.objects.find(o=>o.name==='env_island_props_merged');
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');if(src.sha256!==sha(oldBuf))throw Error('fixture island sha does not match the old GLB');
 let n=0;const hit=new Set();for(let k=o.offset/4;k<o.offset/4+o.count*9;k+=3){const kk=key(f32[k],f32[k+1],f32[k+2]),to=map.get(kk);if(to){f32[k]=to[0];f32[k+1]=to[1];f32[k+2]=to[2];n++;hit.add(kk);}}
 if(hit.size!==map.size)throw Error('moved points missing from the fixture: '+(map.size-hit.size));
 const out=Buffer.from(f32.buffer);src.sha256=sha(newBuf);meta.binSha256=sha(out);
 fs.writeFileSync(path.join(OCC,'fixture-occluders.bin.gz'),zlib.gzipSync(out,{level:9}));fs.writeFileSync(path.join(OCC,'fixture-occluders.json'),JSON.stringify(meta,null,1)+'\n');
 console.log('moved points',map.size,'fixture vertices replaced',n,'island sha',src.sha256.slice(0,12));})().catch(e=>{console.error(e);process.exit(1);});
