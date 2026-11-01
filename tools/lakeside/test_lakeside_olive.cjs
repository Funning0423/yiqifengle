// Voice Bot (lakeside olive, r5h3 alignment): LK_far_hills / LK_terrain / LK_far_shore use their OWN palette cells in the free row
// 10 of T_LK_palette_256.png (tools/lakeside/olive_recolour.py); no other GLB samples row 10, grass tufts / bushes / trees keep the
// shared cells; same image + material (static merge and instancing unchanged, 0 added draws); vertex counts unchanged; PNG stays RGB
// with its sRGB/gAMA chunks.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert');
const M=path.join(__dirname,'../../creator-build-project/assets/bundles/region_lakeside/models');
function glb(f){const b=fs.readFileSync(path.join(M,f)),n=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+n).toString()),bo=20+n+8;return {j,b,bo};}
function cells(f){const {j,b,bo}=glb(f),out=new Map();let v=0;for(const m of j.meshes)for(const p of m.primitives){if(p.attributes.TEXCOORD_0===undefined)continue;
 const a=j.accessors[p.attributes.TEXCOORD_0],bv=j.bufferViews[a.bufferView],st=bv.byteStride||8,off=bo+(bv.byteOffset||0)+(a.byteOffset||0);assert.equal(a.componentType,5126);v+=a.count;
 for(let i=0;i<a.count;i++){const k=Math.floor(b.readFloatLE(off+i*st)*16)+','+Math.floor(b.readFloatLE(off+i*st+4)*16);out.set(k,(out.get(k)||0)+1);}}
 return {cells:out,verts:v,j};}
function png(file){const b=fs.readFileSync(file);let i=8;const ch=[],idat=[];let w,h,ct;while(i<b.length){const n=b.readUInt32BE(i),t=b.slice(i+4,i+8).toString();ch.push(t);
 if(t==='IHDR'){w=b.readUInt32BE(i+8);h=b.readUInt32BE(i+12);ct=b[i+17];}if(t==='IDAT')idat.push(b.slice(i+8,i+8+n));i+=12+n;}
 const raw=zlib.inflateSync(Buffer.concat(idat)),bpp=ct===2?3:4,stride=w*bpp,px=Buffer.alloc(h*stride);
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)],src=raw.slice(y*(stride+1)+1,(y+1)*(stride+1));for(let x=0;x<stride;x++){const a=x>=bpp?px[y*stride+x-bpp]:0,bb=y?px[(y-1)*stride+x]:0,c=x>=bpp&&y?px[(y-1)*stride+x-bpp]:0;
  let p=src[x];if(f===1)p+=a;else if(f===2)p+=bb;else if(f===3)p+=(a+bb)>>1;else if(f===4){const q=a+bb-c,pa=Math.abs(q-a),pb=Math.abs(q-bb),pc=Math.abs(q-c);p+=pa<=pb&&pa<=pc?a:pb<=pc?bb:c;}px[y*stride+x]=p&255;}}
 return {w,h,ct,ch,at:(cx,cy)=>{const o=(cy*16+8)*stride+(cx*16+8)*bpp;return [px[o],px[o+1],px[o+2]];}};}
const P=png(path.join(M,'T_LK_palette_256.png'));
assert.equal(P.w,256);assert.equal(P.h,256);assert.equal(P.ct,2,'RGB like the export');assert(P.ch.includes('sRGB')&&P.ch.includes('gAMA'),'colour chunks kept');
const NEW=[[147,167,124],[91,104,53],[119,133,62],[166,153,130],[57,143,18],[92,162,20]];NEW.forEach((c,i)=>assert.deepEqual(P.at(i,10),c,'olive cell '+i));
for(let c=6;c<16;c++)assert.deepEqual(P.at(c,10),[0,0,0],'rest of row 10 still free');
assert.deepEqual(P.at(9,15),[0x6d,0xbe,0x45],'shared grass cell unchanged');assert.deepEqual(P.at(10,15),[0xa8,0xd6,0x4a]);assert.deepEqual(P.at(14,15),[0x4f,0xa0,0xa0]);
const want={'LK_far_hills.glb':{cells:['0,10','1,10','2,10','3,10','6,13','15,12','7,13'],verts:3802},'LK_terrain.glb':{cells:['4,10','10,14','11,14','12,14','13,14','14,14'],verts:4134},'LK_far_shore.glb':{cells:['4,10','5,10','12,14'],verts:1036/* 984 + 52 seam-skirt bottom verts (b16 lakeside seam, same cells) */}};
for(const [f,w] of Object.entries(want)){const g=cells(f);assert.deepEqual(Array.from(g.cells.keys()).sort(),w.cells.slice().sort(),f+' cells');assert.equal(g.verts,w.verts,f+' vertex count');
 assert.equal(g.j.images.length,1);assert.equal(g.j.images[0].uri,'T_LK_palette_256.png','same shared image');assert.equal(g.j.materials.length,1);assert.equal(g.j.materials[0].name,'M_LK_palette');}
// 场景特效bot r5 S2 (r3): the 360° far ring (tools/scene-fx/lakeside_far_ring.py) is appended after the original vertices:
// LK_terrain gets the grass apron + near knolls (its own grass cell 4,10, sand rim on 12,14), LK_far_hills the mid / far
// layers (blue cells 7,13 / 6,13).
assert.equal(cells('LK_far_hills.glb').j.meshes[0].extras.qfFarRing.baseVerts,2466,'original hill vertices kept first');
assert.equal(cells('LK_terrain.glb').j.meshes[0].extras.qfFarRing.baseVerts,2890,'original island vertices kept first');
const others=fs.readdirSync(M).filter(f=>f.endsWith('.glb')&&!want[f]);let n=0;
for(const f of others){const g=cells(f);for(const k of g.cells.keys())assert(!k.endsWith(',10'),f+' must not sample the olive row ('+k+')');n++;}
for(const f of ['LK_grass_tuft.glb','LK_bush.glb','LK_tree_round.glb','LK_tree_conifer.glb'])assert(others.includes(f),f);
assert(cells('LK_grass_tuft.glb').cells.has('9,15'),'grass tufts keep the shared grass cell');
console.log('lakeside olive OK (3 GLBs on own cells, %d other GLBs untouched by row 10)',n);
