import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import draco3d from 'draco3dgltf';import zlib from 'zlib';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
for(const f of process.argv.slice(2)){const doc=await io.read(f);const p=doc.getRoot().listMeshes().find(m=>m.getName()==='env_sky_static_palette').listPrimitives()[0];
const n=p.getAttribute('POSITION').getCount();const buf=new Float32Array(n*12);const A=['POSITION','NORMAL','TEXCOORD_0','COLOR_0'].map(s=>p.getAttribute(s));
for(let i=0;i<n;i++){let o=i*12;for(const a of A){for(const x of a.getElement(i,[]))buf[o++]=x;}buf[o]=1;}
const raw=Buffer.concat([Buffer.from(buf.buffer),Buffer.from(new Uint16Array(p.getIndices().getArray()).buffer)]);console.log(f,raw.length,zlib.deflateSync(raw,{level:9}).length);}
