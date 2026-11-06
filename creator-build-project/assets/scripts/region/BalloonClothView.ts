/** Puts the subdivided shell on the envelope renderer while it inflates, then gives the
 *  authored mesh back once the shell sits on that surface. No opacity, no second draw. */
import {MeshRenderer, Node, gfx, utils} from 'cc';
import {INFLATE} from './TransitionChain';
import {buildCloth, clothPositions, type ClothMesh} from './BalloonCloth';

type Cache={mesh:ClothMesh; authored:any; dyn:any|null; pos:Float32Array};
const caches=new WeakMap<object, Cache>();

function read(mesh:any, name:string):ArrayLike<number>|null{
  try{const a=mesh.readAttribute(0, name); return a||null;}catch{return null;}
}

export function syncBalloonCloth(envelope:Node, t:number):void{
  const r=envelope.getComponent(MeshRenderer);
  if(!r||!r.mesh||typeof r.mesh.readAttribute!=='function')return;
  let box=caches.get(r);
  if(!box){
    const mesh=r.mesh;
    const pos=read(mesh, gfx.AttributeName.ATTR_POSITION);
    const nrm=read(mesh, gfx.AttributeName.ATTR_NORMAL);
    const uv=read(mesh, gfx.AttributeName.ATTR_TEX_COORD);
    const idx=mesh.readIndices(0);
    if(!pos||!uv||!idx)return;
    const built=buildCloth(pos, uv, idx, 0);
    box={mesh:built, authored:mesh, dyn:null, pos:new Float32Array(built.cruise.length)};
    caches.set(r, box);
    void nrm;
  }
  if(t>=INFLATE.durationS){
    if(r.mesh!==box.authored)r.mesh=box.authored;
    return;
  }
  const p=clothPositions(box.mesh, t, box.pos);
  const geom={positions:p, uvs:box.mesh.uv, indices:box.mesh.idx, primitiveMode:gfx.PrimitiveMode.TRIANGLE_LIST};
  box.dyn=utils.createMesh(geom, box.dyn||undefined, {calculateBounds:true});
  if(r.mesh!==box.dyn)r.mesh=box.dyn;
}
