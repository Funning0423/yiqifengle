'use strict';
/** Minimal glTF 2.0 (.glb) skeleton + animation evaluator for the walk-driver sim (engine-free, LINEAR/STEP, no skinning).
 * Builds node-like joints (position/rotation/scale + setters, children) that FlowReferenceStandin's AnimRig drives, and
 * world-space FK for foot-slide measurement. */
const fs=require('fs');
function parseGlb(file){const b=fs.readFileSync(file);if(b.readUInt32LE(0)!==0x46546c67)throw Error('not a glb: '+file);
  let off=12,json=null,bin=null;while(off<b.length){const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4),chunk=b.subarray(off+8,off+8+len);if(type===0x4e4f534a)json=JSON.parse(chunk.toString('utf8'));else if(type===0x004e4942)bin=chunk;off+=8+len;}
  const comps={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const kinds={5126:[4,o=>bin.readFloatLE(o),1],5121:[1,o=>bin.readUInt8(o),255],5123:[2,o=>bin.readUInt16LE(o),65535]};
  const acc=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],n=comps[a.type],out=new Float32Array(a.count*n),base=(v.byteOffset||0)+(a.byteOffset||0);
    const kind=kinds[a.componentType];if(!kind)throw Error('accessor componentType '+a.componentType+' not supported');const [size,read,max]=kind,stride=v.byteStride||n*size,div=a.normalized?max:1;
    for(let k=0;k<a.count;k++)for(let c=0;c<n;c++)out[k*n+c]=read(base+k*stride+c*size)/div;return {data:out,n};};
  return {json,acc};}
function makeNode(name){return {name,children:[],parent:null,position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1},
  setPosition(x,y,z){this.position={x,y,z};},setRotation(x,y,z,w){this.rotation={x,y,z,w};},setScale(x,y,z){this.scale={x,y,z};}};}
function loadRig(file){const {json,acc}=parseGlb(file);const nodes=json.nodes.map(n=>makeNode(n.name||''));
  json.nodes.forEach((n,i)=>{const nd=nodes[i];if(n.translation)nd.setPosition(...n.translation);if(n.rotation)nd.setRotation(...n.rotation);if(n.scale)nd.setScale(...n.scale);(n.children||[]).forEach(c=>{nodes[c].parent=nd;nd.children.push(nodes[c]);});});
  const rest=nodes.map(n=>({p:{...n.position},r:{...n.rotation},s:{...n.scale}}));
  const root=makeNode('SKELETON_CONTAINER');const scene=json.scenes[json.scene||0];scene.nodes.forEach(i=>{nodes[i].parent=root;root.children.push(nodes[i]);});
  const clips={};(json.animations||[]).forEach(a=>{let dur=0;const ch=a.channels.map(c=>{const s=a.samplers[c.sampler],inp=acc(s.input).data,out=acc(s.output);dur=Math.max(dur,inp[inp.length-1]);return {node:nodes[c.target.node],path:c.target.path,inp,out:out.data,n:out.n,step:s.interpolation==='STEP'};});clips[a.name]={name:a.name,duration:dur,channels:ch};});
  return {nodes,root,clips,rest,byName:name=>nodes.find(n=>n.name===name)};}
function sampleChannel(c,t){const i=c.inp,N=i.length;let k=0;if(t<=i[0])k=0;else if(t>=i[N-1])k=N-1;else{while(k<N-2&&i[k+1]<t)k++;}
  const n=c.n,v=c.out;if(t<=i[0]||t>=i[N-1]||c.step){const o=(t>=i[N-1]?N-1:k)*n;return Array.from(v.subarray(o,o+n));}
  const u=(t-i[k])/(i[k+1]-i[k]),a=k*n,b=(k+1)*n;
  if(c.path==='rotation'){let d=v[a]*v[b]+v[a+1]*v[b+1]+v[a+2]*v[b+2]+v[a+3]*v[b+3];const sg=d<0?-1:1;const r=[0,1,2,3].map(j=>v[a+j]*(1-u)+sg*v[b+j]*u);const l=Math.hypot(...r);return r.map(x=>x/l);}
  return [0,1,2].slice(0,n).map(j=>v[a+j]*(1-u)+v[b+j]*u);}
/** Evaluate a clip into the joint nodes (writes only animated channels, like the Cocos evaluator with enableTrsBlending=false). */
function applyClip(clip,t){for(const c of clip.channels){const v=sampleChannel(c,t);if(c.path==='translation')c.node.setPosition(...v);else if(c.path==='rotation')c.node.setRotation(...v);else if(c.path==='scale')c.node.setScale(...v);}}
const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qrot=(q,v)=>{const p=qmul(qmul(q,[v[0],v[1],v[2],0]),[-q[0],-q[1],-q[2],q[3]]);return [p[0],p[1],p[2]];};
/** World transform of a node: controller root (pos, yaw about +Y) * container * glTF chain. */
function worldOf(node,ctrlPos,yawRad){const chain=[];for(let n=node;n&&n.name!=='SKELETON_CONTAINER';n=n.parent)chain.unshift(n);
  let P=[0,0,0],R=[0,0,0,1],S=[1,1,1];for(const n of chain){const lp=[n.position.x*S[0],n.position.y*S[1],n.position.z*S[2]];const rp=qrot(R,lp);P=[P[0]+rp[0],P[1]+rp[1],P[2]+rp[2]];R=qmul(R,[n.rotation.x,n.rotation.y,n.rotation.z,n.rotation.w]);S=[S[0]*n.scale.x,S[1]*n.scale.y,S[2]*n.scale.z];}
  const yq=[0,Math.sin(yawRad/2),0,Math.cos(yawRad/2)],wp=qrot(yq,P);return {pos:[wp[0]+ctrlPos[0],wp[1]+ctrlPos[1],wp[2]+ctrlPos[2]],rot:qmul(yq,R),scale:S};}
/** Shoe soles: per foot bone, the vertices skinned only to it (weight > 0.999) within bandM of their lowest bind-pose
 *  height, in that bone's local space (inverse bind matrix x bind-pose position). The shoe is rigid on the foot bone. */
function solePoints(file,bones=['foot.L','foot.R'],bandM=0.012){const {json,acc}=parseGlb(file);const skin=json.skins[0],ibm=acc(skin.inverseBindMatrices).data,names=skin.joints.map(i=>json.nodes[i].name);const out={};
  for(const bone of bones){const j=names.indexOf(bone);if(j<0)throw Error('no joint '+bone);const m=ibm.subarray(j*16,j*16+16),pts=[];
    for(const mesh of json.meshes)for(const p of mesh.primitives){if(p.attributes.JOINTS_0===undefined)continue;const P=acc(p.attributes.POSITION).data,J=acc(p.attributes.JOINTS_0).data,W=acc(p.attributes.WEIGHTS_0).data;
      for(let k=0;k<P.length/3;k++){let w=0;for(let c=0;c<4;c++)if(J[k*4+c]===j)w+=W[k*4+c];if(w>0.999)pts.push([P[k*3],P[k*3+1],P[k*3+2]]);}}
    if(!pts.length)throw Error('no vertices skinned only to '+bone);const ymin=Math.min(...pts.map(p=>p[1]));
    out[bone]=pts.filter(p=>p[1]<ymin+bandM).map(p=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]);}
  return out;}
/** World positions of one foot's sole points (solePoints) under the current pose. */
function soleWorld(node,points,ctrlPos,yawRad){const w=worldOf(node,ctrlPos,yawRad),S=w.scale;return points.map(p=>{const r=qrot(w.rot,[p[0]*S[0],p[1]*S[1],p[2]*S[2]]);return [w.pos[0]+r[0],w.pos[1]+r[1],w.pos[2]+r[2]];});}
module.exports={loadRig,applyClip,worldOf,qmul,qrot,makeNode,solePoints,soleWorld};
