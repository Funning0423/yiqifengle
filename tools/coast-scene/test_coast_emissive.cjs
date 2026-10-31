'use strict';
// coast-emissive gate (GGbot, Grok Bot 2026-10-30): the coast palette copy keeps M_env_palette's emissive map (USE_EMISSIVE_MAP stays on).
// The effective emissive map = the island's env_palette_emissive_256 (embedded in static_seat_preview/room/room_no_original_chair.glb),
// unless region_coast ships textures/coast_palette_emissive.png (then that one). Every face of every NON-glow coast mesh
// (models/*.glb; glow = COAST_MESH_FLAGS emit) must sample only zero emissive texels: all texels in the face's UV bounding box
// (+1 px for bilinear / mip bleed) are checked. Glow meshes are reported only (emit -> unlit kind -> not on the palette material). Self-test: a face moved into
// band 13 must be caught. PNG decode: zlib + filters (8-bit RGB/RGBA, non-interlaced), no dependencies.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets'),B=path.join(A,'bundles/region_coast');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}return c;};
function png(buf){let o=8,w,h,ct,bd,il;const id=[];while(o<buf.length){const n=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),d=buf.subarray(o+8,o+8+n);
 if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];il=d[12];}else if(t==='IDAT')id.push(d);else if(t==='IEND')break;o+=12+n;}
 if(bd!==8||il!==0||![2,6].includes(ct))throw Error('unsupported png ct='+ct+' bd='+bd);const bpp=ct===6?4:3,st=w*bpp,raw=zlib.inflateSync(Buffer.concat(id)),px=Buffer.alloc(h*st);
 for(let y=0;y<h;y++){const f=raw[y*(st+1)],r=raw.subarray(y*(st+1)+1,(y+1)*(st+1)),pr=y?px.subarray((y-1)*st,y*st):null,cur=px.subarray(y*st,(y+1)*st);
  for(let x=0;x<st;x++){const a=x>=bpp?cur[x-bpp]:0,b=pr?pr[x]:0,c=pr&&x>=bpp?pr[x-bpp]:0;let v=r[x];
   if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}cur[x]=v&255;}}
 return {w,h,nz:(x,y)=>{const i=y*st+x*bpp;return px[i]|px[i+1]|px[i+2];}};}
function glb(p){const b=fs.readFileSync(p),l=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+l).toString()),bin=b.subarray(20+l+8);return {j,bin};}
function acc(g,i){const a=g.j.accessors[i],bv=g.j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],off=(bv.byteOffset||0)+(a.byteOffset||0);
 const C={5126:[Float32Array,4],5125:[Uint32Array,4],5123:[Uint16Array,2],5121:[Uint8Array,1]}[a.componentType],stride=bv.byteStride||C[1]*n,out=new Float64Array(a.count*n);
 for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const o=off+k*stride+c*C[1];out[k*n+c]=a.componentType===5126?g.bin.readFloatLE(o):a.componentType===5125?g.bin.readUInt32LE(o):a.componentType===5123?g.bin.readUInt16LE(o):g.bin[o];}
 if(a.normalized&&a.componentType!==5126){const s=a.componentType===5121?255:65535;for(let k=0;k<out.length;k++)out[k]/=s;}return out;}
// effective emissive map
let E,src;const own=path.join(B,'textures/coast_palette_emissive.png');
if(fs.existsSync(own)){E=png(fs.readFileSync(own));src='region_coast/textures/coast_palette_emissive.png';}
else{const g=glb(path.join(A,'bundles/static_seat_preview/room/room_no_original_chair.glb')),im=g.j.images.find(x=>x.name==='env_palette_emissive_256'),bv=g.j.bufferViews[im.bufferView];
 E=png(g.bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength));src='island env_palette_emissive_256 (shared)';
 const mat=g.j.materials.find(m=>m.name==='M_env_palette');ok(mat&&g.j.textures[mat.emissiveTexture.index].source===g.j.images.indexOf(im),'M_env_palette emissiveTexture is env_palette_emissive_256');}
const band=[];for(let r=0;r<16;r++){let n=0;for(let y=16*r;y<16*r+16;y++)for(let x=0;x<E.w;x++)if(E.nz(x,y))n++;band.push(n);}
console.log('info emissive map: '+src+' '+E.w+'x'+E.h+'; non-zero texels per 16-px band: '+JSON.stringify(band));
for(const r of [0,11,12])ok(band[r]===0,'band '+r+' (replaced by the coast palette) must be black in the emissive map: '+band[r]);
const LAY=fs.readFileSync(path.join(B,'scripts/CoastSceneLayout.ts'),'utf8'),FI=LAY.indexOf('export const COAST_MESH_FLAGS'),flags=LAY.slice(FI,LAY.indexOf('});',FI)),
 GLOW=new Set([...flags.matchAll(/([a-z_0-9]+):\{[^}]*emit:true/g)].map(m=>m[1]));console.log('info glow meshes (emit): '+[...GLOW].join(','));
function hits(uv,idx,shift){let bad=0,hit=0;const W=E.w,H=E.h;for(let f=0;f<idx.length;f+=3){let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(let k=0;k<3;k++){const v=idx[f+k];const u=uv[2*v],w=uv[2*v+1]+(shift||0);x0=Math.min(x0,u*W);x1=Math.max(x1,u*W);y0=Math.min(y0,w*H);y1=Math.max(y1,w*H);}
  let nz=false;for(let y=Math.max(0,Math.floor(y0)-1);y<=Math.min(H-1,Math.ceil(y1));y++)for(let x=Math.max(0,Math.floor(x0)-1);x<=Math.min(W-1,Math.ceil(x1));x++)if(E.nz(x,y)){nz=true;break;}
  if(nz)hit++;else bad++;}return {nz:hit,zero:bad};}
let faces=0,meshes=0,noUV=[];const out=[];let sample=null;
for(const f of fs.readdirSync(path.join(B,'models')).filter(x=>x.endsWith('.glb')).sort()){const g=glb(path.join(B,'models',f));
 for(const m of g.j.meshes){for(const p of m.primitives){if(p.attributes.TEXCOORD_0===undefined){noUV.push(f+':'+m.name);continue;}
  const uv=acc(g,p.attributes.TEXCOORD_0),idx=p.indices!==undefined?acc(g,p.indices):Float64Array.from({length:uv.length/2},(_,i)=>i),h=hits(uv,idx);faces+=idx.length/3;meshes++;
  if(GLOW.has(m.name)){/* glow meshes are emit -> kind unlit -> island shared glow/beam materials, not the palette copy: info only */}else{ok(h.nz===0,'non-glow '+f+':'+m.name+' has '+h.nz+' faces on non-zero emissive texels');if(!sample)sample={uv,idx};}
  out.push(m.name+(GLOW.has(m.name)?'*':'')+':'+h.nz);}}}
ok(noUV.length===0,'meshes without TEXCOORD_0: '+noUV.join(','));
console.log(`info ${meshes} primitives, ${faces} faces checked; per mesh non-zero-emissive faces (*=glow): ${out.join(' ')}`);
if(sample){const s=hits(sample.uv,sample.idx,13/16-(sample.uv[1]));ok(s.nz>0,'selftest: a face moved into band 13 must be caught');console.log('ok   selftest: face shifted into band 13 caught ('+s.nz+' faces)');}
if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-emissive');
