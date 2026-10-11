#!/usr/bin/env node
'use strict';
/* Item-by-item check that <new.glb> equals <old.glb> except env_sky_static_rock_strata.COLOR_1.
 * JSON: every top-level array/object compared after mapping old accessor ids (> removed) down by one.
 * BIN: byte-identical. Draco: every primitive decoded (draco3d 1.5.7) with its extension attribute map,
 * all attributes + indices compared byte-for-byte; asserts COLOR_1 is gone and only COLOR_0 remains.
 * usage: node verify_color1.cjs old.glb new.glb [--json out.json] */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const [oldP,newP]=process.argv.slice(2),jsonOut=process.argv.includes('--json')?process.argv[process.argv.indexOf('--json')+1]:null;
function glb(p){const b=fs.readFileSync(p),jl=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+jl));const o=20+jl,bl=b.readUInt32LE(o);return {size:b.length,j,bin:b.subarray(o+8,o+8+bl),binType:b.readUInt32LE(o+4)};}
const A=glb(oldP),B=glb(newP),res=[];const check=(name,ok,detail='')=>{res.push({name,ok:!!ok,detail});console.log((ok?'SAME ':'DIFF ')+name+(detail?'  '+detail:''));};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sha=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,16);
// locate removed accessor
let dead=null;A.j.meshes.forEach(m=>m.primitives.forEach(p=>{if(p.attributes.COLOR_1!==undefined){if(m.name!=='env_sky_static_rock_strata')throw Error('COLOR_1 on '+m.name);dead=p.attributes.COLOR_1;}}));
if(dead===null)throw Error('old file has no COLOR_1');
const mapAcc=i=>i===dead?null:i>dead?i-1:i;
// expected new JSON = old JSON with the single edit applied
const exp=JSON.parse(JSON.stringify(A.j));
for(const m of exp.meshes)for(const p of m.primitives){if(m.name==='env_sky_static_rock_strata'&&p.attributes.COLOR_1!==undefined){delete p.attributes.COLOR_1;const d=p.extensions?.KHR_draco_mesh_compression;if(d)delete d.attributes.COLOR_1;}
  for(const k of Object.keys(p.attributes))p.attributes[k]=mapAcc(p.attributes[k]);if(p.indices!==undefined)p.indices=mapAcc(p.indices);(p.targets||[]).forEach(t=>{for(const k in t)t[k]=mapAcc(t[k]);});}
for(const a of exp.animations||[])for(const s of a.samplers){s.input=mapAcc(s.input);s.output=mapAcc(s.output);}
for(const s of exp.skins||[])if(s.inverseBindMatrices!==undefined)s.inverseBindMatrices=mapAcc(s.inverseBindMatrices);
exp.accessors.splice(dead,1);
const keys=[...new Set([...Object.keys(A.j),...Object.keys(B.j)])];
for(const k of ['asset','extensionsUsed','extensionsRequired','scene','scenes','nodes','materials','textures','images','samplers','animations','skins','cameras','buffers','bufferViews','extras','extensions'])
  check('json.'+k,eq(exp[k],B.j[k]),Array.isArray(B.j[k])?B.j[k].length+' items':(B.j[k]===undefined?'absent in both':''));
check('json.meshes (names, primitive count, materials, modes, extras; COLOR_1 removed only)',eq(exp.meshes,B.j.meshes),B.j.meshes.length+' meshes / '+B.j.meshes.reduce((n,m)=>n+m.primitives.length,0)+' primitives');
check('json.accessors (old minus #'+dead+', rest identical incl. min/max/count)',eq(exp.accessors,B.j.accessors),A.j.accessors.length+' -> '+B.j.accessors.length);
check('json: no other top-level keys',keys.every(k=>['asset','extensionsUsed','extensionsRequired','scene','scenes','nodes','materials','textures','images','samplers','animations','skins','cameras','buffers','bufferViews','extras','extensions','meshes','accessors'].includes(k)),keys.join(','));
check('BIN chunk byte-identical',A.bin.equals(B.bin)&&A.binType===B.binType,A.bin.length+' bytes sha256 '+sha(A.bin)+' / '+sha(B.bin));
const c1=B.j.meshes.flatMap(m=>m.primitives.map(p=>[m.name,Object.keys(p.attributes).filter(k=>k.startsWith('COLOR_'))])).filter(([,c])=>c.length);
check('no COLOR_1 anywhere; colour sets left = COLOR_0 only',c1.every(([,c])=>eq(c,['COLOR_0']))&&!JSON.stringify(B.j.meshes).includes('COLOR_1'),c1.length+' primitives with colour, all ['+[...new Set(c1.map(([,c])=>c.join('+')))].join('|')+']');
// Draco decode comparison
const ROOT=path.resolve(__dirname,'../..');const dd=[process.env.DRACO3D,path.join(ROOT,'tools/vendor-node/node_modules/draco3d'),path.resolve(ROOT,'../GGbot/tools/vendor-node/node_modules/draco3d')].filter(Boolean).find(d=>fs.existsSync(path.join(d,'draco3d.js')));
(async()=>{
  if(!dd){check('draco decode',false,'draco3d not found');}else{
  const draco=require(path.join(dd,'draco3d.js')),D=await draco.createDecoderModule({});
  const decode=(g,p)=>{const e=p.extensions.KHR_draco_mesh_compression,bv=g.j.bufferViews[e.bufferView],buf=g.bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
    const dec=new D.Decoder(),mesh=new D.Mesh(),st=dec.DecodeArrayToMesh(buf,buf.length,mesh);if(!st.ok())throw Error(st.error_msg());const out={};
    const nf=mesh.num_faces(),ia=new D.DracoUInt32Array();const idx=new Uint32Array(nf*3);for(let f=0;f<nf;f++){dec.GetFaceFromMesh(mesh,f,ia);for(let k=0;k<3;k++)idx[f*3+k]=ia.GetValue(k);}D.destroy(ia);out.indices=Buffer.from(idx.buffer);
    for(const [name,uid] of Object.entries(e.attributes)){const at=dec.GetAttributeByUniqueId(mesh,uid),n=mesh.num_points()*at.num_components(),arr=new D.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,at,arr);const f=new Float32Array(n);for(let i=0;i<n;i++)f[i]=arr.GetValue(i);D.destroy(arr);out[name]=Buffer.from(f.buffer);}
    D.destroy(mesh);D.destroy(dec);return out;};
  let prims=0,attrs=0,bad=[];
  A.j.meshes.forEach((m,mi)=>m.primitives.forEach((p,pi)=>{if(!p.extensions?.KHR_draco_mesh_compression)return;prims++;const a=decode(A,p),b=decode(B,B.j.meshes[mi].primitives[pi]);
    for(const k of Object.keys(a)){if(k==='COLOR_1'){if(b[k])bad.push(m.name+'.COLOR_1 still decodable');continue;}attrs++;if(!b[k]||!a[k].equals(b[k]))bad.push(m.name+'.'+k);}
    for(const k of Object.keys(b))if(!(k in a))bad.push(m.name+' new attr '+k);}));
  check('Draco decode: every primitive, POSITION/NORMAL/TEXCOORD/COLOR_0/indices byte-identical',bad.length===0,prims+' primitives, '+attrs+' attribute/index arrays compared'+(bad.length?' bad='+bad.slice(0,5):''));
  const sp=A.j.meshes.find(m=>m.name==='env_sky_static_rock_strata').primitives[0],sa=decode(A,sp);
  check('strata COLOR_1 in old file (info)',true,'old decoded '+Object.keys(sa).join(',')+'; COLOR_1 '+(sa.COLOR_1.length/4/ (A.j.accessors[dead].type==='VEC4'?4:3))+' x '+A.j.accessors[dead].type);}
  const ok=res.every(r=>r.ok);console.log(`sizes: old ${A.size} B, new ${B.size} B (delta ${B.size-A.size} B)`);console.log(ok?'RESULT IDENTICAL except env_sky_static_rock_strata.COLOR_1':'RESULT DIFFERENCES FOUND');
  if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify({ok,old:{path:oldP,size:A.size},new:{path:newP,size:B.size},removedAccessor:dead,checks:res},null,1));process.exit(ok?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
