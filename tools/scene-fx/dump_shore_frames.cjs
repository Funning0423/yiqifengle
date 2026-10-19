'use strict';
/** QA preview helper (not shipped, 场景特效bot r5 S2 stage 2): bakes the REAL ShoreFoamCore.sampleShoreFoam per frame into an
 * RGBA atlas (x = u along the ribbon, y = v across) for blender_shore_preview.py, plus the ribbon geometry (island: islandShoreRibbon;
 * lake: LK_shore_foam.glb) and the old island lip (ShoreBreakCore.shoreWashGeometry + shorePhase) for the "before" frames.
 * Usage: node dump_shore_frames.cjs <out.json> island|lake <t0> <seconds> <fps> <night 0|1> <camPos x,y,z> <camTarget x,y,z> */
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const root=path.resolve(__dirname,'..','..');const {createHarness}=require(root+'/tools/board-ui/harness.cjs');const H=createHarness();
const S=root+'/creator-build-project/assets/scripts/render/';const F=H.load(S+'ShoreFoamCore.ts'),C=H.load(S+'ShoreBreakCore.ts');
const [out,kind,t0,secs,fps,nightS,cp,ct]=process.argv.slice(2);const night=+nightS,cam=cp.split(',').map(Number),tgt=ct.split(',').map(Number);
const dir=out.replace(/\.json$/,'')+'_tex';fs.mkdirSync(dir,{recursive:true});
function crc32(b){let c,crc=0xffffffff;for(let n=0;n<b.length;n++){c=(crc^b[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);}
function png(W,Hh,rgba){const raw=Buffer.alloc((W*4+1)*Hh);for(let y=0;y<Hh;y++){raw[y*(W*4+1)]=0;rgba.copy(raw,y*(W*4+1)+1,y*W*4,(y+1)*W*4);}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(Hh,4);ih[8]=8;ih[9]=6;ih[10]=0;ih[11]=0;ih[12]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:3})),chunk('IEND',Buffer.alloc(0))]);}
let geo,P;
if(kind==='island'){const r=F.islandShoreRibbon();geo={positions:r.positions,uvs:r.uvs,colors:r.colors,indices:r.indices};P=F.ISLAND_FOAM;}
else{const b=fs.readFileSync(root+'/creator-build-project/assets/bundles/region_lakeside/models/LK_shore_foam.glb');const l=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+l)),bin=b.slice(20+l+8);
  const acc=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],T={5126:Float32Array,5121:Uint8Array,5123:Uint16Array}[a.componentType];
    return Array.prototype.slice.call(new T(bin.buffer.slice(bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0)+a.count*n*T.BYTES_PER_ELEMENT)));};
  const pr=j.meshes[0].primitives[0];geo={positions:acc(pr.attributes.POSITION),uvs:acc(pr.attributes.TEXCOORD_0),colors:acc(pr.attributes.COLOR_0).map(x=>x/255),indices:acc(pr.indices)};P=F.LAKE_FOAM;}
let umin=1e9,umax=-1e9;for(let i=0;i<geo.uvs.length;i+=2){umin=Math.min(umin,geo.uvs[i]);umax=Math.max(umax,geo.uvs[i]);}
const W=Math.min(4096,Math.ceil((umax-umin)/0.08)),HH=64;
// per-u distance to the camera (waterline vertex nearest in u), for the shader's far fade
const du=new Float32Array(W).fill(60);{const best=new Float32Array(W).fill(1e9);for(let i=0;i<geo.uvs.length/2;i++){const x=Math.round((geo.uvs[2*i]-umin)/(umax-umin)*(W-1)),dv=Math.abs(geo.uvs[2*i+1]-0.5);
  if(dv<best[x]){best[x]=dv;const p=geo.positions;du[x]=Math.hypot(p[3*i]-cam[0],p[3*i+1]-cam[1],p[3*i+2]-cam[2]);}}
  let last=60;for(let x=0;x<W;x++){if(best[x]<1e8)last=du[x];else du[x]=last;}}
const tint=kind==='island'?F.islandFoamTint(night):[1,1,1,1];const Pt=Object.assign({},P,{tint});
const frames=[],n=Math.round(+secs*+fps);
for(let f=0;f<n;f++){const t=+t0+f/ +fps;const s=kind==='island'?F.islandSwash(t):F.lakeSwash(t);const buf=Buffer.alloc(W*HH*4);
  for(let y=0;y<HH;y++){const v=(y+0.5)/HH;for(let x=0;x<W;x++){const u=umin+(x+0.5)/W*(umax-umin);const c=F.sampleShoreFoam(Pt,s,u,v,du[x],1);const o=((HH-1-y)*W+x)*4;
    for(let k=0;k<3;k++)buf[o+k]=Math.round(255*Math.pow(Math.max(0,Math.min(1,c[k])),1/2.2));buf[o+3]=Math.round(255*Math.max(0,Math.min(1,c[3])));}}
  const tex=path.join(dir,'f'+String(f).padStart(5,'0')+'.png');fs.writeFileSync(tex,png(W,HH,buf));
  const fr={t,tex,swash:s,lift:kind==='island'?C.seaSheetLift(t,C.shorePhase(t)):0};
  if(kind==='island'){const ph=C.shorePhase(t),g=C.shoreWashGeometry(ph.foamU,t),m=C.foamMultiply(night);fr.before={positions:g.positions,colors:g.colors,indices:g.indices,alpha:ph.foamA*C.SHORE.shorePeak,rgb:C.SHORE.foamRgb.map((c,k)=>c*m[k])};}
  frames.push(fr);}
// uv -> atlas uv
const uvs=[];for(let i=0;i<geo.uvs.length;i+=2)uvs.push((geo.uvs[i]-umin)/(umax-umin),geo.uvs[i+1]);
fs.writeFileSync(out,JSON.stringify({kind,night,fps:+fps,camera:{pos:cam,target:tgt},atlas:[W,HH],geometry:{positions:geo.positions,uvs,colors:geo.colors,indices:geo.indices},frames}));
console.log('frames',n,'atlas',W,HH,'maxFront',Math.max.apply(null,frames.map(f=>f.swash.front)).toFixed(2));
