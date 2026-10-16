import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import draco3d from 'draco3dgltf';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
const a=await io.read(process.argv[2]),b=await io.read(process.argv[3]);const mb=b.getRoot().listMeshes();let worst={};
a.getRoot().listMeshes().forEach((m,i)=>{m.listPrimitives().forEach((p,j)=>{const q=mb[i].listPrimitives()[j];for(const s of p.listSemantics()){const x=p.getAttribute(s).getArray(),y=q.getAttribute(s).getArray();let e=0;const n=Math.min(x.length,y.length);for(let k=0;k<n;k++)e=Math.max(e,Math.abs(x[k]-y[k]));if(!worst[s]||e>worst[s][0])worst[s]=[e,m.getName()];}
 const xi=p.getIndices()?.getArray(),yi=q.getIndices()?.getArray();if(xi&&yi){let d=0;for(let k=0;k<xi.length;k++)if(xi[k]!==yi[k])d++;if(d)console.log('idx diff',m.getName(),d);}})});
console.log(worst);console.log('anims',a.getRoot().listAnimations().length,b.getRoot().listAnimations().length,'nodes',a.getRoot().listNodes().length,b.getRoot().listNodes().length);
