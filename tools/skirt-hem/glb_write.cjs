'use strict';
/** Replace animation sampler data in a GLB and repack the binary chunk (unused accessors / buffer views dropped, 4-byte aligned).
 *  Everything else (meshes, morph targets, skin, images, materials, extras) is carried over byte for byte. */
const H=require('./hem_lib.cjs');
/** edits: [{anim:name, node:index, path:'rotation', times:Float32Array, values:Float32Array}] (one sampler per edit, LINEAR). */
function rewrite(buf,edits,attrs){const {json,bin}=H.parseGlb(buf);const j=JSON.parse(JSON.stringify(json));
  const extra=[];// new raw blobs appended as new buffer views
  const addAcc=(arr,type,minmax)=>{const bv=j.bufferViews.length+extra.length;extra.push(Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength));
    const a={bufferView:bv,componentType:5126,count:arr.length/({SCALAR:1,VEC4:4,VEC3:3}[type]),type};if(minmax){a.min=[Math.min(...arr)];a.max=[Math.max(...arr)];}j.accessors.push(a);return j.accessors.length-1;};
  const timeCache=new Map();
  for(const e of edits){const an=j.animations.find(a=>a.name===e.anim);if(!an)throw Error('no anim '+e.anim);const ch=an.channels.find(c=>c.target.node===e.node&&c.target.path===e.path);if(!ch)throw Error('no channel '+e.anim+' '+e.node+' '+e.path);
    const tk=e.anim+'|'+e.times.length+'|'+e.times[e.times.length-1];let ti=timeCache.get(tk);if(ti===undefined){ti=addAcc(Float32Array.from(e.times),'SCALAR',true);timeCache.set(tk,ti);}
    const oi=addAcc(Float32Array.from(e.values),'VEC4');const s={input:ti,output:oi,interpolation:'LINEAR'};an.samplers.push(s);ch.sampler=an.samplers.length-1;}
  for(const a of attrs||[]){const m=j.meshes.find(x=>x.name===a.mesh);const p=m.primitives[0];const old=j.accessors[p.attributes[a.attr]];const bv=j.bufferViews.length+extra.length;
    extra.push(Buffer.from(a.data.buffer,a.data.byteOffset,a.data.byteLength));const n={...old,bufferView:bv,byteOffset:0};delete n.sparse;j.accessors.push(n);p.attributes[a.attr]=j.accessors.length-1;}
  // drop unreferenced samplers
  for(const an of j.animations){const used=[...new Set(an.channels.map(c=>c.sampler))].sort((a,b)=>a-b),map=new Map(used.map((s,k)=>[s,k]));an.samplers=used.map(s=>an.samplers[s]);an.channels.forEach(c=>c.sampler=map.get(c.sampler));}
  // referenced accessors
  const usedA=new Set();const ua=i=>{if(i!==undefined)usedA.add(i);};
  for(const m of j.meshes)for(const p of m.primitives){Object.values(p.attributes).forEach(ua);ua(p.indices);(p.targets||[]).forEach(t=>Object.values(t).forEach(ua));}
  for(const s of j.skins||[])ua(s.inverseBindMatrices);for(const an of j.animations)for(const s of an.samplers){ua(s.input);ua(s.output);}
  const accOrder=[...usedA].sort((a,b)=>a-b),accMap=new Map(accOrder.map((a,k)=>[a,k]));
  const usedV=new Set();for(const a of accOrder){const x=j.accessors[a];if(x.bufferView!==undefined)usedV.add(x.bufferView);if(x.sparse){usedV.add(x.sparse.indices.bufferView);usedV.add(x.sparse.values.bufferView);}}
  for(const im of j.images||[])if(im.bufferView!==undefined)usedV.add(im.bufferView);
  const nOld=json.bufferViews.length;const vOrder=[...usedV].sort((a,b)=>a-b),vMap=new Map(vOrder.map((v,k)=>[v,k]));const parts=[];let off=0;const views=[];
  for(const v of vOrder){const data=v<nOld?bin.subarray(json.bufferViews[v].byteOffset||0,(json.bufferViews[v].byteOffset||0)+json.bufferViews[v].byteLength):extra[v-nOld];
    const pad=(4-off%4)%4;if(pad){parts.push(Buffer.alloc(pad));off+=pad;}const nv=v<nOld?{...j.bufferViews[v]}:{buffer:0,byteLength:data.length};nv.byteOffset=off;nv.byteLength=data.length;views.push(nv);parts.push(data);off+=data.length;}
  const pad=(4-off%4)%4;if(pad){parts.push(Buffer.alloc(pad));off+=pad;}
  j.bufferViews=views;j.accessors=accOrder.map(a=>{const x={...j.accessors[a]};if(x.bufferView!==undefined)x.bufferView=vMap.get(x.bufferView);if(x.sparse){x.sparse=JSON.parse(JSON.stringify(x.sparse));x.sparse.indices.bufferView=vMap.get(x.sparse.indices.bufferView);x.sparse.values.bufferView=vMap.get(x.sparse.values.bufferView);}return x;});
  const ra=i=>i===undefined?i:accMap.get(i);
  for(const m of j.meshes)for(const p of m.primitives){for(const k in p.attributes)p.attributes[k]=ra(p.attributes[k]);if(p.indices!==undefined)p.indices=ra(p.indices);(p.targets||[]).forEach(t=>{for(const k in t)t[k]=ra(t[k]);});}
  for(const s of j.skins||[])s.inverseBindMatrices=ra(s.inverseBindMatrices);for(const an of j.animations)for(const s of an.samplers){s.input=ra(s.input);s.output=ra(s.output);}
  for(const im of j.images||[])if(im.bufferView!==undefined)im.bufferView=vMap.get(im.bufferView);
  j.buffers=[{byteLength:off}];const binB=Buffer.concat(parts);let js=Buffer.from(JSON.stringify(j),'utf8');const jp=(4-js.length%4)%4;js=Buffer.concat([js,Buffer.alloc(jp,0x20)]);
  const head=Buffer.alloc(12);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+js.length+8+binB.length,8);
  const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4e4f534a,4);const c2=Buffer.alloc(8);c2.writeUInt32LE(binB.length,0);c2.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([head,c1,js,c2,binB]);}
module.exports={rewrite};
