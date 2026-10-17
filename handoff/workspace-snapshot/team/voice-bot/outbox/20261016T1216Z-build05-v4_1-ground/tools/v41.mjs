// Build05 v4 ground: (a) island-top green faces: strong per-vertex light/dark + warm/cool vertex colour (no new geometry);
// (b) deck slab tops: re-cut into planks (seam + 2 grain stripes per plank) with wood UV cell + per-plank/per-stripe tone.
// Surfaces stay coplanar (no geometry moved). Faces touching the 09 board frustum (2.0x margin) are left untouched. Deterministic.
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS,KHRDracoMeshCompression} from '@gltf-transform/extensions';import draco3d from 'draco3dgltf';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const [src,out]=process.argv.slice(2);const doc=await io.read(src);
const p=doc.getRoot().listMeshes().find(m=>m.getName()==='env_sky_static_palette').listPrimitives()[0];
const SEM=['POSITION','NORMAL','TEXCOORD_0','COLOR_0'],att=Object.fromEntries(SEM.map(k=>[k,Array.from(p.getAttribute(k).getArray())])),sz={POSITION:3,NORMAL:3,TEXCOORD_0:2,COLOR_0:3};
if(p.listSemantics().length!==4)throw Error('semantics');
let I0=Array.from(p.getIndices().getArray());const N0=att.POSITION.length/3;
const pv=i=>[att.POSITION[3*i],att.POSITION[3*i+1],att.POSITION[3*i+2]];
const cell=i=>[att.TEXCOORD_0[2*i],att.TEXCOORD_0[2*i+1]].map(x=>Math.floor(x*16)).join(',');
const isDeckCell=i=>cell(i)==='5,12'||cell(i)==='5,13';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)};
// 09 board-background frustum (same as v3 vcolor.mjs)
const A=[-1.4,-0.068,32.6],B=[0,-0.066,30.0];
const board=asp=>{const c=[(A[0]+B[0])/2,(A[1]+B[1])/2+1,(A[2]+B[2])/2],span=Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]),r=Math.max(6,span*.65+2),fov=55,half=Math.atan(Math.tan(fov*Math.PI/360)*Math.min(1,asp)),d=r/Math.sin(half)*1.12,n=Math.hypot(.3,.55,1.3);return {C:[c[0]+d*.3/n,c[1]+d*.55/n,c[2]+d*1.3/n],T:c,fov,asp};};
const boards=[9/19.5,9/16,3/4,1,16/9,2.2].map(board).map(b=>{const f=norm(b.T.map((x,i)=>x-b.C[i])),r=norm(cross(f,[0,1,0])),u=cross(r,f);return {...b,f,r,u,t:Math.tan(b.fov*Math.PI/360)};});
const inBoard=(v,m)=>boards.some(b=>{const d=v.map((x,i)=>x-b.C[i]),z=dot(d,b.f);if(z<=0.05)return false;return Math.abs(dot(d,b.r)/(z*b.t*b.asp))<m&&Math.abs(dot(d,b.u)/(z*b.t))<m;});
const hash=(x,y,z)=>{let h=(x*374761393+y*668265263+z*2147483647)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0)/4294967295;};
const sm=t=>t*t*(3-2*t);
const noise=(x,y,z)=>{const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=sm(x-X),fy=sm(y-Y),fz=sm(z-Z);let s=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)s+=hash(X+a,Y+b,Z+c)*(a?fx:1-fx)*(b?fy:1-fy)*(c?fz:1-fz);return s;};
const faceInfo=f=>{const v=f.map(pv),c=[0,1,2].map(k=>(v[0][k]+v[1][k]+v[2][k])/3),cr=cross(v[1].map((x,k)=>x-v[0][k]),v[2].map((x,k)=>x-v[0][k])),a=Math.hypot(...cr)/2;return {v,c,a,ny:cr[1]/(2*a||1)};};
// ---------- (a0) v4.1: coplanar midpoint split of long island-top edges (both neighbours on the island top), so patches hold
const ISLZ=c=>c[0]>-56&&c[0]<-38&&c[2]>58&&c[2]<76&&c[1]>-6&&c[1]<-4;
const isIslF=f=>{const F=faceInfo(f);const row=Math.floor(att.TEXCOORD_0[2*f[0]+1]*16);return F.ny>=0.5&&ISLZ(F.c)&&(row===12||row===13)&&!(f.every(isDeckCell)&&F.c[1]>-4.85&&F.c[0]>-45.5&&F.c[2]<63.5);};
const pk0=i=>[0,1,2].map(k=>Math.round(att.POSITION[3*i+k]*1000)).join(',');const ek=(a,b)=>{const x=pk0(a),y=pk0(b);return x<y?x+'|'+y:y+'|'+x;};
const SPLIT=+(process.env.VB_SPLIT||1.2);const eUse={};let splitF=0,splitE=0;
const islSet=new Set();for(let t=0;t<I0.length;t+=3){const f=I0.slice(t,t+3);if(isIslF(f)){islSet.add(t);for(let q=0;q<3;q++){const k=ek(f[q],f[(q+1)%3]);eUse[k]=(eUse[k]||0)+1;}}}
// count edge use by ALL faces (to never split an edge shared with a non-island face)
const eAll={};for(let t=0;t<I0.length;t+=3){const f=I0.slice(t,t+3);for(let q=0;q<3;q++){const k=ek(f[q],f[(q+1)%3]);eAll[k]=(eAll[k]||0)+1;}}
const mid={};const midV=(a,b)=>{const k=a<b?a+'_'+b:b+'_'+a;if(k in mid)return mid[k];const id=att.POSITION.length/3;for(const s of SEM)for(let q=0;q<sz[s];q++)att[s].push((att[s][sz[s]*a+q]+att[s][sz[s]*b+q])/2);return mid[k]=id;};
const len=(a,b)=>Math.hypot(...pv(a).map((x,k)=>x-pv(b)[k]));
const NI0=[];
for(let t=0;t<I0.length;t+=3){const f=I0.slice(t,t+3);if(!islSet.has(t)){NI0.push(...f);continue;}
 const sp=[0,1,2].map(q=>{const a=f[q],b=f[(q+1)%3],k=ek(a,b);return eUse[k]===2&&eAll[k]===2&&len(a,b)>SPLIT;});
 const n=sp.filter(Boolean).length;if(!n){NI0.push(...f);continue;}splitF++;
 // rotate so split edges come first
 let r=0;if(n===1)r=sp.indexOf(true);else if(n===2)r=(sp.indexOf(false)+1)%3;
 const [a,b,c]=[f[r],f[(r+1)%3],f[(r+2)%3]];
 if(n===1){const m=midV(a,b);NI0.push(a,m,c,m,b,c);}
 else if(n===2){const m1=midV(a,b),m2=midV(b,c);NI0.push(a,m1,c,m1,m2,c,m1,b,m2);}
 else{const m1=midV(a,b),m2=midV(b,c),m3=midV(c,a);NI0.push(a,m1,m3,m1,b,m2,m3,m2,c,m1,m2,m3);}}
for(const k in mid)splitE++;I0=NI0;
// ---------- (a) island top
const islandV=new Set();let islandF=0,lockedF=0;
const deckF=[];
// deck slab tops = small connected components of cell 5,12 (welded by position) inside the bridge zone
const pk=i=>[0,1,2].map(k=>Math.round(att.POSITION[3*i+k]*100)).join(',');const par={};const fd=x=>par[x]===x?x:(par[x]=fd(par[x]));
const c512=[];for(let t=0;t<I0.length;t+=3){const f=I0.slice(t,t+3);if(!f.every(isDeckCell))continue;const ks=f.map(pk);ks.forEach(k=>par[k]??=k);par[fd(ks[1])]=fd(ks[0]);par[fd(ks[2])]=fd(ks[0]);c512.push([t,ks[0]]);}
const cm={};for(const [t,k] of c512){const r=fd(k),c=cm[r]||(cm[r]={ts:[],mn:[1e9,1e9,1e9],mx:[-1e9,-1e9,-1e9]});c.ts.push(t);for(const i of I0.slice(t,t+3))for(let k=0;k<3;k++){c.mn[k]=Math.min(c.mn[k],att.POSITION[3*i+k]);c.mx[k]=Math.max(c.mx[k],att.POSITION[3*i+k]);}}
const deckT=new Set();for(const c of Object.values(cm))if(c.ts.length<=30&&c.mn[1]>-4.85&&c.mx[1]<0.5&&c.mn[0]>-45.5&&c.mx[0]<-22&&c.mx[2]<63.5&&c.mn[2]>25)c.ts.forEach(t=>deckT.add(t));
for(let t=0;t<I0.length;t+=3){const f=I0.slice(t,t+3),F=faceInfo(f);if(Math.abs(F.ny)<0.3)continue;
 const row=Math.floor(att.TEXCOORD_0[2*f[0]+1]*16);
 const isl=!deckT.has(t)&&isIslF(f);
 const gr=row===12||row===13,inDZ=F.c[0]>-45.5&&F.c[0]<-22&&F.c[2]>25&&F.c[2]<63.5&&F.c[1]>-4.85&&F.c[1]<0.5&&F.v.every(q=>q[1]>-4.86);
 const dk=(deckT.has(t)||(gr&&inDZ&&!isIslF(f)))&&Math.abs(F.ny)>0.3;
 if(!isl&&!dk)continue; if(deckT.has(t)&&!dk)continue; if(F.v.some(v=>inBoard(v,2.0))){lockedF++;console.error('lock',isl?'I':'D',F.v.some(v=>inBoard(v,1.0))?'IN':'margin',F.c.map(x=>x.toFixed(1)).join(','));continue;}
 if(isl&&F.ny<0.5)continue; if(dk&&F.v.some(v=>inBoard(v,2.0)))console.error('lock',F.c.map(x=>x.toFixed(1)).join(','));
 if(isl){islandF++;f.forEach(i=>islandV.add(i));} else deckF.push(t);}
// boundary of the island-top selection (edges used once by selected faces) -> darker rim band
const selE={};for(let t=0;t<I0.length;t+=3){const f=I0.slice(t,t+3);if(!f.every(i=>islandV.has(i)))continue;for(let q=0;q<3;q++){const k=ek(f[q],f[(q+1)%3]);selE[k]=(selE[k]||0)+1;}}
const steepE=new Set();for(let t=0;t<I0.length;t+=3){const f=I0.slice(t,t+3);if(faceInfo(f).ny<0.4)for(let q=0;q<3;q++)steepE.add(ek(f[q],f[(q+1)%3]));}
const rimP=[];for(const [k,n] of Object.entries(selE))if(n===1&&steepE.has(k))for(const s2 of k.split('|'))rimP.push(s2.split(',').map(x=>+x/1000));
const IV=[...islandV].map(pv);const IC=[IV.reduce((a,v)=>a+v[0],0)/IV.length,0,IV.reduce((a,v)=>a+v[2],0)/IV.length];
const NB=72,rmax=new Array(NB).fill(0),bin=v=>Math.floor((Math.atan2(v[2]-IC[2],v[0]-IC[0])+Math.PI)/(2*Math.PI)*NB)%NB,rad=v=>Math.hypot(v[0]-IC[0],v[2]-IC[2]);for(const v of IV){const b=bin(v);rmax[b]=Math.max(rmax[b],rad(v));}
const rmx=v=>{const b=bin(v);return Math.max(rmax[b],rmax[(b+1)%NB],rmax[(b+NB-1)%NB]);};console.log('IC',IC.map(x=>x.toFixed(1)),'rmax',Math.min(...rmax).toFixed(1),Math.max(...rmax).toFixed(1));const SUN=norm([-0.55,0,0.84]);   // sun side = toward the lens/bridge-left in the 93-95 s frames
for(const i of islandV){const v=pv(i);
 const dr=rmx(v)-rad(v);
 const side=((v[0]-IC[0])*SUN[0]+(v[2]-IC[2])*SUN[2])/Math.max(4,rmx(v));                  // ~-1 shaded .. +1 sun
 const big=noise(v[0]/4.2+3,0,v[2]/4.2-8),med=noise(v[0]/1.8+50,v[1]/1.8,v[2]/1.8);
 const t=Math.max(0,Math.min(1,0.5+0.55*side+0.9*(big-0.5)));           // 0 cool .. 1 warm
 const bright=Math.max(0.6,Math.min(1,0.88+0.22*(t-0.5)+0.28*(big-0.5)+0.10*(med-0.5)));
 const warm=[1.0,1.0,0.52],cool=[0.70,0.92,1.0];const tint=[0,1,2].map(k=>cool[k]+(warm[k]-cool[k])*t);
 const rim=dr<1.1?0.62+0.38*(dr/1.1):1;                                   // darker band along the edges
 (globalThis.H||(globalThis.H=[])).push([bright,t,rim]); for(let k=0;k<3;k++)att.COLOR_0[3*i+k]=Math.min(1,bright*tint[k]*rim);}
const q=(k,p)=>{const a=H.map(x=>x[k]).sort((x,y)=>x-y);return a[Math.floor(p*(a.length-1))].toFixed(2)};console.log("stats",[0,1,2].map(k=>[0,.1,.5,.9,1].map(p=>q(k,p)).join("/")).join(" | "),H.filter(x=>x[2]<1).length);
// ---------- (b) deck planks
const dir=norm([-29+43,0,42-61]);   // bridge travel direction (glb local, xz)
const WOOD=[0.3125,0.03125];        // palette cell b9946c (light wood)
const PL=0.62,SEAM=0.05;
const drop=new Set(deckF);const NI=[];let addV=0,addT=0;
const pushV=(pos,nrm,col)=>{const id=att.POSITION.length/3;att.POSITION.push(...pos);att.NORMAL.push(...nrm);att.TEXCOORD_0.push(...WOOD);att.COLOR_0.push(...col);addV++;return id;};
const clip=(poly,s,lo,hi)=>{const cut=(P,f)=>{const o=[];for(let k=0;k<P.length;k++){const a=P[k],b=P[(k+1)%P.length],fa=f(a),fb=f(b);if(fa>=0)o.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);o.push(a.map((x,q)=>x+(b[q]-x)*t));}}return o;};
 return cut(cut(poly,q=>s(q)-lo),q=>hi-s(q));};
const S=q=>q[0]*dir[0]+q[2]*dir[2],G=q=>q[0]*-dir[2]+q[2]*dir[0];
// group deck faces by component; planar component -> one convex outline polygon (fewer verts), else per-triangle
const byComp={};for(const t of deckF){const r=fd(pk(I0[t]));(byComp[r]||(byComp[r]=[])).push(t);}
const polys=[];let hullC=0;
for(const ts of Object.values(byComp)){const vs=[...new Set(ts.flatMap(t=>I0.slice(t,t+3)))].map(pv);
 // plane fit y=a x+b z+c from first face, check all
 const [p0,p1,p2]=I0.slice(ts[0],ts[0]+3).map(pv),n=norm(cross(p1.map((x,k)=>x-p0[k]),p2.map((x,k)=>x-p0[k])));
 const err=Math.max(...vs.map(v=>Math.abs(dot(v.map((x,k)=>x-p0[k]),n))));
 const nrm=[att.NORMAL[3*I0[ts[0]]],att.NORMAL[3*I0[ts[0]]+1],att.NORMAL[3*I0[ts[0]]+2]];
 const area=ts.reduce((s,t)=>s+faceInfo(I0.slice(t,t+3)).a,0);
 // convex hull in xz
 const pts=vs.map(v=>[v[0],v[2],v]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr2=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lo=[],up=[];for(const q of pts){while(lo.length>=2&&cr2(lo[lo.length-2],lo[lo.length-1],q)<=1e-9)lo.pop();lo.push(q);}for(const q of pts.slice().reverse()){while(up.length>=2&&cr2(up[up.length-2],up[up.length-1],q)<=1e-9)up.pop();up.push(q);}
 const hull=lo.slice(0,-1).concat(up.slice(0,-1)).map(q=>q[2]);let ha=0;for(let k=0;k<hull.length;k++){const a=hull[k],b=hull[(k+1)%hull.length];ha+=(a[0]*b[2]-b[0]*a[2])/2;}
 if(err<0.002&&Math.abs(Math.abs(ha)-area*Math.abs(n[1]))<0.01*area){hullC++;const h=ha*n[1]>0?hull:hull.slice().reverse();polys.push([h,nrm]);}
 else for(const t of ts)polys.push([I0.slice(t,t+3).map(pv),nrm]);}
for(const [v,nrm] of polys){
 const ss=v.map(S),lo=Math.floor(Math.min(...ss)/PL),hi=Math.ceil(Math.max(...ss)/PL);
 for(let k=lo;k<hi;k++){const plank=hash(k,7,3),base=0.80+0.20*plank,warmP=hash(k,11,5);
  const bands=[[k*PL,k*PL+SEAM,0.62],[k*PL+SEAM,k*PL+SEAM+(PL-SEAM)*0.5,1],[k*PL+SEAM+(PL-SEAM)*0.5,(k+1)*PL,0.9]];
  for(const [b0,b1,m] of bands){const poly=clip(v,S,b0,b1);if(poly.length<3)continue;
   const ids=poly.map(q=>{const g=G(q),along=0.92+0.08*Math.sin(g*1.9+k*2.3)+0.04*(hash(k,Math.round(g*3),1)-0.5);
    const br=Math.min(1,base*m*along);return pushV(q,nrm,[Math.min(1,br*(1.0+0.05*warmP)),br*(0.97+0.02*warmP),br*(0.92-0.05*warmP)]);});
   for(let q=1;q+1<ids.length;q++){NI.push(ids[0],ids[q],ids[q+1]);addT++;}}}}
console.log(JSON.stringify({deckComponents:Object.keys(byComp).length,hullComponents:hullC}));
// v4.1: olive raised colour patches (v2, +3 cm) lying on deck slabs -> wood colour (UV + tone only, no geometry)
let woodPatchF=0;const WP=[];for(let t=0;t<I0.length;t+=3){const f=I0.slice(t,t+3);if(drop.has(t))continue;const F=faceInfo(f);
 const cl=cell(f[0]);if(!(cl==='15,14'||cl==='15,15'))continue;if(!(F.c[0]>-45.5&&F.c[0]<-22&&F.c[2]>25&&F.c[2]<63.5&&F.c[1]>-4.85&&F.c[1]<0.5&&Math.abs(F.ny)>0.9))continue;
 if(F.v.some(v=>inBoard(v,2.0))){lockedF++;continue;}woodPatchF++;WP.push(f);}
for(const i of new Set(WP.flat())){const g=G(pv(i)),k=Math.floor(S(pv(i))/PL),br=Math.min(1,(0.80+0.20*hash(k,7,3))*(0.92+0.08*Math.sin(g*1.9+k*2.3)));att.TEXCOORD_0[2*i]=WOOD[0];att.TEXCOORD_0[2*i+1]=WOOD[1];att.COLOR_0.splice(3*i,3,br,br*0.97,br*0.92);}
console.log(JSON.stringify({woodPatchFaces:woodPatchF}));
const keep=[];for(let t=0;t<I0.length;t+=3)if(!drop.has(t))keep.push(...I0.slice(t,t+3));
// drop now-unused original deck verts? keep simple: compact unused vertices
const all=keep.concat(NI),used=new Int32Array(att.POSITION.length/3).fill(-1);let nv=0;const NA=Object.fromEntries(SEM.map(s=>[s,[]]));
for(const i of all)if(used[i]<0){used[i]=-2;}
for(let i=0;i<used.length;i++)if(used[i]===-2){used[i]=nv++;for(const s of SEM)for(let q=0;q<sz[s];q++)NA[s].push(att[s][sz[s]*i+q]);}
for(const s of SEM){const A0=p.getAttribute(s).getArray();p.getAttribute(s).setArray(new A0.constructor(NA[s]));}
const IDX=all.map(i=>used[i]);p.getIndices().setArray(nv>65535?new Uint32Array(IDX):new Uint16Array(IDX));
console.log(JSON.stringify({splitFaces:splitF,splitEdges:splitE,rimPts:rimP.length}));console.log(JSON.stringify({islandFaces:islandF,islandVertsRecoloured:islandV.size,lockedFaces:lockedF,deckFacesReplaced:deckF.length,deckVertsAdded:addV,deckTrisAdded:addT,vertsBefore:N0,vertsAfter:nv,trisBefore:I0.length/3,trisAfter:IDX.length/3}));
doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='KHR_draco_mesh_compression').setEncoderOptions({method:KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,encodeSpeed:0,decodeSpeed:5,quantizationBits:{POSITION:16,NORMAL:12,TEX_COORD:14,COLOR:10,GENERIC:12}});
await io.write(out,doc);
