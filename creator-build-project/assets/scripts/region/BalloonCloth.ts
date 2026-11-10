/** Deflated cloth as a subdivided shell, not a scale of the 490-vertex teardrop and not a
 *  morph that walks those 490 vertices off their surface. New vertices exist only while the
 *  envelope is inflating. At shape 1 every vertex lies on the authored cruise surface
 *  (original vertices exact, added vertices the midpoint of an authored edge).
 *  Pure: no cc import. */
import {INFLATE} from './TransitionChain';

const MOUTH_Y=3.05,CROWN_Y=10.4,SPAN=CROWN_Y-MOUTH_Y;

/** Cubic, so the first part of the 3 s inflate clock stays a mound while the boarding
 *  lens is still travelling, and the held close lens (about 1.2 s to 3 s on the recorded
 *  B1 trace) sees the unfold. Exact 0 at t<=0 and exact 1 at t>=duration. */
export function clothShape01(t:number):number{
  if(t>=INFLATE.durationS)return 1;
  if(!(t>0))return 0;
  const u=t/INFLATE.durationS;
  return u*u*u;
}

export type ClothMesh={
  cruise:Float32Array;mound:Float32Array;uv:Float32Array;idx:Uint32Array;
  /** weld id per vertex; shared-position copies share an id */
  weld:Uint32Array;
  originals:number;
  levels:number;
};

function weldOf(pos:ArrayLike<number>, n:number):Uint32Array{
  const map=new Map<string,number>(), out=new Uint32Array(n);
  let k=0;
  for(let i=0;i<n;i++){
    const key=(Math.round(pos[i*3]*1e5))+','+(Math.round(pos[i*3+1]*1e5))+','+(Math.round(pos[i*3+2]*1e5));
    let id=map.get(key);
    if(id===undefined){id=k++;map.set(key,id);}
    out[i]=id;
  }
  return out;
}

function lobe(theta:number):number{
  const a=Math.max(0,Math.cos(theta-0.4)), b=Math.max(0,Math.cos(theta-2.35)), c=Math.max(0,Math.cos(theta-4.15));
  return 0.62*a*a+0.40*b*b+0.28*c*c;
}

/** One authored shell. Star of the basket, upper sheet on three uneven crests, lower sheet
 *  kept under it. Blue (s≈0.45–0.56) sits on the crest, so the band bends with the lobes. */
export function moundPoint(x:number,y:number,z:number, out:Float32Array, i:number, _crown:boolean, _mouthCap:boolean):void{
  // Keep each vertex on its authored ray from the cruise interior. Only the radius changes,
  // so the spherical triangles stay the ones the cruise mesh already embeds. The ray origin
  // for the mound is inside the basket, which drops the whole shell into the lip.
  const ox=0, oy=6.55, oz=0;
  let dx=x-ox, dy=y-oy, dz=z-oz;
  const len=Math.hypot(dx,dy,dz)||1;
  dx/=len; dy/=len; dz/=len;
  const L=lobe(Math.atan2(dx,dz))/0.62;
  // 0.08 is the largest lobe gain measured to keep this mesh's triangles from crossing.
  const r=0.34+0.18*(dy+1)+0.08*L*Math.max(0,1-dy*dy);
  out[i]=dx*r;
  out[i+1]=0.62+dy*r;
  out[i+2]=dz*r;
}

function subdivide(cruise:Float32Array, mound:Float32Array, uv:Float32Array, idx:Uint32Array, weld:Uint32Array):ClothMesh{
  const n=cruise.length/3, edge=new Map<string,number>();
  const c2=Array.from(cruise), m2=Array.from(mound), u2=Array.from(uv);
  const w2=Array.from(weld);
  let nextWeld=0; for(const id of w2)if(id>=nextWeld)nextWeld=id+1;
  const mid=(a:number,b:number):number=>{
    const wa=weld[a], wb=weld[b];
    const key=wa<wb?wa+':'+wb:wb+':'+wa;
    const hit=edge.get(key);
    if(hit!==undefined){
      // Same geometric edge, possibly the other UV side. Position stays. A new vertex only if UV differs.
      const uu=(uv[a*2]+uv[b*2])*0.5, vv=(uv[a*2+1]+uv[b*2+1])*0.5;
      if(Math.abs(u2[hit*2]-uu)<1e-5&&Math.abs(u2[hit*2+1]-vv)<1e-5)return hit;
      const id=c2.length/3;
      for(let k=0;k<3;k++){c2.push(c2[hit*3+k]); m2.push(m2[hit*3+k]);}
      u2.push(uu,vv); w2.push(w2[hit]);
      return id;
    }
    const id=c2.length/3;
    const sx=(mound[a*3]+mound[b*3])*0.5, sy=(mound[a*3+1]+mound[b*3+1])*0.5, sz=(mound[a*3+2]+mound[b*3+2])*0.5;
    const sAvg=((cruise[a*3+1]+cruise[b*3+1])*0.5-MOUTH_Y)/SPAN;
    const band=Math.max(0,1-Math.abs(sAvg-0.50)/0.22);
    const horiz=Math.hypot(sx,sz)||1;
    const lift=0;
    c2.push((cruise[a*3]+cruise[b*3])*0.5,(cruise[a*3+1]+cruise[b*3+1])*0.5,(cruise[a*3+2]+cruise[b*3+2])*0.5);
    m2.push(sx+sx/horiz*lift, sy+lift*0.35, sz+sz/horiz*lift);
    u2.push((uv[a*2]+uv[b*2])*0.5,(uv[a*2+1]+uv[b*2+1])*0.5);
    const wid=nextWeld++;
    w2.push(wid);
    edge.set(key,id);
    w2[id]=wid;
    return id;
  };
  const faces:number[]=[];
  for(let i=0;i<idx.length;i+=3){
    const a=idx[i], b=idx[i+1], c=idx[i+2];
    const ab=mid(a,b), bc=mid(b,c), ca=mid(c,a);
    faces.push(a,ab,ca, ab,b,bc, ca,bc,c, ab,bc,ca);
  }
  // Fix weld ids: the push above used a placeholder then overwrote. Copies share w2[hit].
  return {cruise:Float32Array.from(c2), mound:Float32Array.from(m2), uv:Float32Array.from(u2), idx:Uint32Array.from(faces), weld:Uint32Array.from(w2), originals:n, levels:1};
}

export function buildCloth(pos:ArrayLike<number>, uvIn:ArrayLike<number>, indices:ArrayLike<number>, levels=2):ClothMesh{
  const n=pos.length/3;
  const cruise=new Float32Array(n*3), mound=new Float32Array(n*3), uv=new Float32Array(n*2);
  for(let i=0;i<n*3;i++)cruise[i]=pos[i];
  for(let i=0;i<n*2;i++)uv[i]=uvIn[i];
  const weld=weldOf(pos,n);
  for(let i=0;i<n;i++){
    const x=pos[i*3], y=pos[i*3+1], z=pos[i*3+2];
    const crown=y>10.2&&Math.hypot(x,z)<1e-3;
    const cap=y>3.7&&y<4.1&&Math.hypot(x,z)<1e-3;
    moundPoint(x,y,z,mound,i*3,crown,cap);
  }
  let mesh:ClothMesh={cruise,mound,uv,idx:Uint32Array.from(indices), weld, originals:n, levels:0};
  for(let L=0;L<levels;L++){
    const next=subdivide(mesh.cruise, mesh.mound, mesh.uv, mesh.idx, mesh.weld);
    next.levels=L+1; next.originals=n;
    mesh=next;
  }
  return mesh;
}

export function clothPositions(mesh:ClothMesh, t:number, out?:Float32Array):Float32Array{
  const u=clothShape01(t), dst=out&&out.length===mesh.cruise.length?out:new Float32Array(mesh.cruise.length);
  if(u<=0){dst.set(mesh.mound); return dst;}
  if(u>=1){dst.set(mesh.cruise); return dst;}
  const a=mesh.mound, b=mesh.cruise;
  for(let i=0;i<dst.length;i++)dst[i]=a[i]+(b[i]-a[i])*u;
  return dst;
}

/** Max distance between vertices that share a welded position. 0 means the UV seam did not open. */
export function seamGap(pos:ArrayLike<number>, weld:Uint32Array):number{
  const acc=new Map<number,{x:number;y:number;z:number;n:number;bad:number}>();
  let worst=0;
  const n=weld.length;
  for(let i=0;i<n;i++){
    const id=weld[i];
    const x=pos[i*3], y=pos[i*3+1], z=pos[i*3+2];
    const g=acc.get(id);
    if(!g){acc.set(id,{x,y,z,n:1,bad:0}); continue;}
    const d=Math.hypot(x-g.x,y-g.y,z-g.z);
    if(d>worst)worst=d;
    g.n++;
  }
  return worst;
}

export function cruiseError(mesh:ClothMesh):{originalMax:number;addedMax:number}{
  const p=clothPositions(mesh, INFLATE.durationS);
  let originalMax=0;
  for(let i=0;i<mesh.originals*3;i++){
    const d=Math.abs(p[i]-mesh.cruise[i]);
    if(d>originalMax)originalMax=d;
  }
  let addedMax=0;
  for(let i=mesh.originals*3;i<p.length;i++){
    const d=Math.abs(p[i]-mesh.cruise[i]);
    if(d>addedMax)addedMax=d;
  }
  return {originalMax, addedMax};
}

/** Non-adjacent triangle pairs whose edges stab the other triangle. Samples, not a continuous proof. */
export function crossingCount(pos:ArrayLike<number>, idx:Uint32Array, cell=0.35):number{
  // Weld coincident positions so a UV seam is one vertex. Otherwise the two sides of a
  // seam do not share indices and a T-junction reads as a stab.
  const map=new Map<string,number>(); const wmap=new Uint32Array(pos.length/3);
  for(let i=0;i<wmap.length;i++){
    const key=Math.round(pos[i*3]*1e4)+','+Math.round(pos[i*3+1]*1e4)+','+Math.round(pos[i*3+2]*1e4);
    let id=map.get(key); if(id===undefined){id=i; map.set(key,id);} wmap[i]=id;
  }
  const welded=new Uint32Array(idx.length);
  for(let i=0;i<idx.length;i++)welded[i]=wmap[idx[i]];
  idx=welded;
  const tris=idx.length/3;
  const lo=new Float32Array(tris*3), hi=new Float32Array(tris*3);
  const buckets=new Map<string,number[]>();
  const key=(ix:number,iy:number,iz:number)=>ix+','+iy+','+iz;
  for(let t=0;t<tris;t++){
    const a=idx[t*3], b=idx[t*3+1], c=idx[t*3+2];
    let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
    for(const v of [a,b,c]){
      const x=pos[v*3], y=pos[v*3+1], z=pos[v*3+2];
      if(x<x0)x0=x; if(y<y0)y0=y; if(z<z0)z0=z;
      if(x>x1)x1=x; if(y>y1)y1=y; if(z>z1)z1=z;
    }
    lo[t*3]=x0; lo[t*3+1]=y0; lo[t*3+2]=z0;
    hi[t*3]=x1; hi[t*3+1]=y1; hi[t*3+2]=z1;
    const ix0=Math.floor(x0/cell), iy0=Math.floor(y0/cell), iz0=Math.floor(z0/cell);
    const ix1=Math.floor(x1/cell), iy1=Math.floor(y1/cell), iz1=Math.floor(z1/cell);
    for(let ix=ix0;ix<=ix1;ix++)for(let iy=iy0;iy<=iy1;iy++)for(let iz=iz0;iz<=iz1;iz++){
      const k=key(ix,iy,iz); let list=buckets.get(k); if(!list){list=[]; buckets.set(k,list);} list.push(t);
    }
  }
  const seen=new Set<number>();
  let hits=0;
  const triHit=(ax:number,ay:number,az:number,bx:number,by:number,bz:number,cx:number,cy:number,cz:number, px:number,py:number,pz:number, qx:number,qy:number,qz:number):boolean=>{
    const abx=bx-ax, aby=by-ay, abz=bz-az, acx=cx-ax, acy=cy-ay, acz=cz-az;
    const nx=aby*acz-abz*acy, ny=abz*acx-abx*acz, nz=abx*acy-aby*acx;
    const qpx=px-qx, qpy=py-qy, qpz=pz-qz;
    const den=qpx*nx+qpy*ny+qpz*nz;
    if(Math.abs(den)<1e-8)return false;
    const t=((px-ax)*nx+(py-ay)*ny+(pz-az)*nz)/den;
    if(t<=0.02||t>=0.98)return false;
    const ix=px-t*qpx, iy=py-t*qpy, iz=pz-t*qpz;
    const pax=ax-ix, pay=ay-iy, paz=az-iz, pbx=bx-ix, pby=by-iy, pbz=bz-iz, pcx=cx-ix, pcy=cy-iy, pcz=cz-iz;
    const c1=pay*pbz-paz*pby, c1b=paz*pbx-pax*pbz, c1c=pax*pby-pay*pbx;
    const s1=c1*nx+c1b*ny+c1c*nz;
    const c2=pby*pcz-pbz*pcy, c2b=pbz*pcx-pbx*pcz, c2c=pbx*pcy-pby*pcx;
    const s2=c2*nx+c2b*ny+c2c*nz;
    const c3=pcy*paz-pcz*pay, c3b=pcz*pax-pcx*paz, c3c=pcx*pay-pcy*pax;
    const s3=c3*nx+c3b*ny+c3c*nz;
    return s1>1e-4&&s2>1e-4&&s3>1e-4;
  };
  for(const list of buckets.values()){
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const A=list[i], B=list[j];
      const loA=A<B?A:B, hiA=A<B?B:A, id=loA*tris+hiA;
      if(seen.has(id))continue; seen.add(id);
      const a=idx[A*3], b=idx[A*3+1], c=idx[A*3+2], d=idx[B*3], e=idx[B*3+1], f=idx[B*3+2];
      if(a===d||a===e||a===f||b===d||b===e||b===f||c===d||c===e||c===f)continue;
      if(hi[A*3]<lo[B*3]||hi[B*3]<lo[A*3]||hi[A*3+1]<lo[B*3+1]||hi[B*3+1]<lo[A*3+1]||hi[A*3+2]<lo[B*3+2]||hi[B*3+2]<lo[A*3+2])continue;
      const stab=triHit(pos[a*3],pos[a*3+1],pos[a*3+2], pos[b*3],pos[b*3+1],pos[b*3+2], pos[c*3],pos[c*3+1],pos[c*3+2], pos[d*3],pos[d*3+1],pos[d*3+2], pos[e*3],pos[e*3+1],pos[e*3+2])
        ||triHit(pos[a*3],pos[a*3+1],pos[a*3+2], pos[b*3],pos[b*3+1],pos[b*3+2], pos[c*3],pos[c*3+1],pos[c*3+2], pos[e*3],pos[e*3+1],pos[e*3+2], pos[f*3],pos[f*3+1],pos[f*3+2])
        ||triHit(pos[a*3],pos[a*3+1],pos[a*3+2], pos[b*3],pos[b*3+1],pos[b*3+2], pos[c*3],pos[c*3+1],pos[c*3+2], pos[f*3],pos[f*3+1],pos[f*3+2], pos[d*3],pos[d*3+1],pos[d*3+2])
        ||triHit(pos[d*3],pos[d*3+1],pos[d*3+2], pos[e*3],pos[e*3+1],pos[e*3+2], pos[f*3],pos[f*3+1],pos[f*3+2], pos[a*3],pos[a*3+1],pos[a*3+2], pos[b*3],pos[b*3+1],pos[b*3+2])
        ||triHit(pos[d*3],pos[d*3+1],pos[d*3+2], pos[e*3],pos[e*3+1],pos[e*3+2], pos[f*3],pos[f*3+1],pos[f*3+2], pos[b*3],pos[b*3+1],pos[b*3+2], pos[c*3],pos[c*3+1],pos[c*3+2])
        ||triHit(pos[d*3],pos[d*3+1],pos[d*3+2], pos[e*3],pos[e*3+1],pos[e*3+2], pos[f*3],pos[f*3+1],pos[f*3+2], pos[c*3],pos[c*3+1],pos[c*3+2], pos[a*3],pos[a*3+1],pos[a*3+2]);
      if(stab)hits++;
    }
  }
  return hits;
}

/** The eight cable ends at the mouth (y≈3.072, eight unique XZ around r≈0.59). */
export const MOUTH_CAP_CENTERS:ReadonlyArray<readonly [number,number,number]>=[
  [0.588,3.072,-0.007],[0.438,3.072,-0.428],[-0.007,3.072,-0.588],[-0.428,3.072,-0.438],
  [-0.588,3.072,0.007],[-0.438,3.072,0.428],[0.007,3.072,0.588],[0.428,3.072,0.438],
];
export function isMouthCap(x:number,y:number,z:number):boolean{
  for(const c of MOUTH_CAP_CENTERS){if(Math.hypot(x-c[0],y-c[1],z-c[2])<0.03)return true;}
  return false;
}
