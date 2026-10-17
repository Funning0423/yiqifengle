import type {Vec} from '../world-r1/WorldFlowCore';
/** One sky, a sea that follows the boat, far cards filling 0–6° under the horizon, mid clouds. No fog. */
export type FrameMesh={name:string;tag:string;tris:Float32Array;dc:number};
const push=(out:number[],a:Vec,b:Vec,c:Vec)=>{out.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);};
function quad(out:number[],a:Vec,b:Vec,c:Vec,d:Vec){push(out,a,b,c);push(out,a,c,d);}
/** Inward-facing dome so a camera inside it sees front faces. */
export function domeMesh(center:Vec,radius:number,name:string):FrameMesh{
 const lat=6,lon=10,out:number[]=[];
 const p=(i:number,j:number):Vec=>{
  const v=i/lat*Math.PI*0.5,u=j/lon*Math.PI*2;
  return [center[0]+radius*Math.cos(v)*Math.sin(u),center[1]+radius*Math.sin(v),center[2]+radius*Math.cos(v)*Math.cos(u)];
 };
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
  const a=p(i,j),b=p(i,j+1),c=p(i+1,j+1),d=p(i+1,j);
  push(out,a,c,b);push(out,a,d,c);
 }
 return {name,tag:'dome',tris:Float32Array.from(out),dc:1};
}
export function seaMesh(center:Vec,radius=400):FrameMesh{
 const out:number[]=[],n=12,y=0;
 for(let i=0;i<n;i++){
  const u0=i/n*Math.PI*2,u1=(i+1)/n*Math.PI*2;
  push(out,[center[0],y,center[2]],[center[0]+Math.sin(u0)*radius,y,center[2]+Math.cos(u0)*radius],[center[0]+Math.sin(u1)*radius,y,center[2]+Math.cos(u1)*radius]);
 }
 return {name:'env_sea_surface',tag:'sea',tris:Float32Array.from(out),dc:2};
}
/** A closed ring. The top sits just under the camera so 0–6° below the horizon is filled and the sky stays open. */
export function cardMesh(center:Vec,radius=150,top=2.5):FrameMesh{
 const out:number[]=[],n=16;
 for(let i=0;i<n;i++){
  const u0=i/n*Math.PI*2,u1=(i+1)/n*Math.PI*2;
  const a:Vec=[center[0]+Math.sin(u0)*radius,-18,center[2]+Math.cos(u0)*radius];
  const b:Vec=[center[0]+Math.sin(u1)*radius,-18,center[2]+Math.cos(u1)*radius];
  const c:Vec=[center[0]+Math.sin(u1)*radius,top,center[2]+Math.cos(u1)*radius];
  const d:Vec=[center[0]+Math.sin(u0)*radius,top,center[2]+Math.cos(u0)*radius];
  quad(out,a,d,c,b);
 }
 return {name:'transit_sea_cards',tag:'card',tris:Float32Array.from(out),dc:1};
}
export function cloudMesh(center:Vec,y=60,radius=220,name='transit_clouds'):FrameMesh{
 const out:number[]=[],n=8;
 for(let i=0;i<n;i++){
  const u=i/n*Math.PI*2,x=center[0]+Math.sin(u)*radius,z=center[2]+Math.cos(u)*radius;
  quad(out,[x-8,y,z-8],[x+8,y,z-8],[x+8,y+4,z+8],[x-8,y+4,z+8]);
 }
 return {name,tag:'cloud',tris:Float32Array.from(out),dc:1};
}
type V3=[number,number,number];
function addTri(out:number[],a:V3,b:V3,c:V3,outward:V3){
 const ab:V3=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac:V3=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 const n:V3=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
 const facing=n[0]*outward[0]+n[1]*outward[1]+n[2]*outward[2]>=0;
 const tri=facing?[a,b,c]:[a,c,b];
 for(const p of tri)out.push(p[0],p[1],p[2]);
}
function addQuad(out:number[],a:V3,b:V3,c:V3,d:V3,outward:V3){addTri(out,a,b,c,outward);addTri(out,a,c,d,outward);}
/** Local boat, +Z forward. Hull, mast and an orange mainsail that faces the starboard-quarter follow camera. */
function boatLocal():{hull:number[];keel:number[];mast:number[];sail:number[]}{
 const hull:number[]=[],keel:number[]=[],mast:number[]=[],sail:number[]=[];
 const stations:[number,number,number,number][]=[[-2.05,0.42,0.58,-0.02],[-1.1,0.78,0.7,-0.28],[0.15,0.84,0.74,-0.34],[1.2,0.58,0.62,-0.18],[2.2,0.08,0.46,0.08]];
 const ring=(z:number,w:number,deck:number,ky:number)=>({
  keel:[0,ky,z] as V3,pl:[-w*0.78,0.02,z] as V3,gl:[-w,deck,z] as V3,gr:[w,deck,z] as V3,pr:[w*0.78,0.02,z] as V3,
 });
 const rings=stations.map(s=>ring(s[0],s[1],s[2],s[3]));
 for(let i=0;i<rings.length-1;i++){
  const a=rings[i],b=rings[i+1];
  addQuad(hull,a.pl,b.pl,b.gl,a.gl,[-1,0.15,0]);
  addQuad(hull,a.pr,a.gr,b.gr,b.pr,[1,0.15,0]);
  addQuad(hull,a.gl,b.gl,b.gr,a.gr,[0,1,0]);
  addQuad(keel,a.keel,a.pl,b.pl,b.keel,[-0.2,-1,0]);
  addQuad(keel,a.keel,b.keel,b.pr,a.pr,[0.2,-1,0]);
 }
 const stern=rings[0],bow=rings[rings.length-1],cap=(r:ReturnType<typeof ring>,o:V3,order:V3[])=>{
  for(let i=1;i<order.length-1;i++)addTri(keel,order[0],order[i],order[i+1],o);
  void r;
 };
 cap(stern,[0,0,-1],[stern.keel,stern.pr,stern.gr,stern.gl,stern.pl]);
 cap(bow,[0,0,1],[bow.keel,bow.pl,bow.gl,bow.gr,bow.pr]);
 const box=(out:number[],cx:number,cy:number,cz:number,sx:number,sy:number,sz:number)=>{
  const x0=cx-sx,x1=cx+sx,y0=cy-sy,y1=cy+sy,z0=cz-sz,z1=cz+sz;
  const P=(x:number,y:number,z:number):V3=>[x,y,z];
  addQuad(out,P(x0,y0,z1),P(x1,y0,z1),P(x1,y1,z1),P(x0,y1,z1),[0,0,1]);
  addQuad(out,P(x1,y0,z0),P(x0,y0,z0),P(x0,y1,z0),P(x1,y1,z0),[0,0,-1]);
  addQuad(out,P(x0,y0,z0),P(x0,y0,z1),P(x0,y1,z1),P(x0,y1,z0),[-1,0,0]);
  addQuad(out,P(x1,y0,z1),P(x1,y0,z0),P(x1,y1,z0),P(x1,y1,z1),[1,0,0]);
  addQuad(out,P(x0,y1,z1),P(x1,y1,z1),P(x1,y1,z0),P(x0,y1,z0),[0,1,0]);
  addQuad(out,P(x0,y0,z0),P(x1,y0,z0),P(x1,y0,z1),P(x0,y0,z1),[0,-1,0]);
 };
 box(mast,0,1.85,-0.28,0.045,1.28,0.045);
 box(mast,0.7,0.78,-0.62,0.62,0.035,0.04);
 addQuad(sail,[0.08,0.9,-0.22],[0.08,3.15,-0.16],[1.55,2.45,-0.85],[1.7,0.92,-1.2],[0.28,0.05,-1]);
 return {hull,keel,mast,sail};
}
function placeLocal(pos:Vec,yaw:number,local:number[]):Float32Array{
 const c=Math.cos(yaw),s=Math.sin(yaw),out:number[]=[];
 for(let i=0;i<local.length;i+=3){
  const x=local[i],y=local[i+1],z=local[i+2];
  out.push(pos[0]+c*x+s*z,pos[1]+y,pos[2]-s*x+c*z);
 }
 return Float32Array.from(out);
}
/** Separate draw calls so a still can paint a cream hull, dark mast and orange sail. */
export function boatPartMeshes(pos:Vec,yaw:number):FrameMesh[]{
 const g=boatLocal();
 return [
  {name:'transport_sailboat',tag:'boat',tris:placeLocal(pos,yaw,g.hull),dc:1},
  {name:'transport_sailboat_keel',tag:'boat',tris:placeLocal(pos,yaw,g.keel),dc:1},
  {name:'transport_sail_mast',tag:'boat',tris:placeLocal(pos,yaw,g.mast),dc:1},
  {name:'sail_root',tag:'boat',tris:placeLocal(pos,yaw,g.sail),dc:1},
 ];
}
export function boatMesh(pos:Vec,yaw:number):FrameMesh{
 const parts=boatPartMeshes(pos,yaw),all:number[]=[];
 for(const p of parts)for(let i=0;i<p.tris.length;i++)all.push(p.tris[i]);
 return {name:'transport_sailboat',tag:'boat',tris:Float32Array.from(all),dc:parts.length};
}
export function meadowSlab(center:Vec):FrameMesh{
 const out:number[]=[],y=center[1];
 quad(out,[center[0]-30,y,center[2]-20],[center[0]-30,y,center[2]+8],[center[0]+30,y,center[2]+8],[center[0]+30,y,center[2]-20]);
 return {name:'meadow_terrain',tag:'ground',tris:Float32Array.from(out),dc:4};
}
export function transitScene(camera:Vec,boat:Vec,yaw:number,estuary:Vec,night:boolean):FrameMesh[]{
 const follow:Vec=[camera[0],0,camera[2]];
 const dome=domeMesh([camera[0],camera[1]*0.2,camera[2]],320,night?'meadow_sky_dome':'env_sky_dome');
 const meshes=[seaMesh(follow),dome,cardMesh(follow,150,camera[1]-0.35),cloudMesh(follow,60,220),cloudMesh(follow,28,90,'transit_clouds_mid'),...boatPartMeshes(boat,yaw)];
 if(Math.hypot(camera[0]-estuary[0],camera[2]-estuary[2])<90)meshes.push(meadowSlab(estuary));
 return meshes;
}
/** Night grade for the vehicle (same ×0.6 weight as the meadow journey). */
export function vehicleNightScale(night:boolean):number{return night?0.6:1;}
export function countDc(meshes:readonly FrameMesh[]):number{let n=0;for(const m of meshes)n+=m.dc;return n;}
export function countTris(meshes:readonly FrameMesh[]):number{let n=0;for(const m of meshes)n+=m.tris.length/9;return n;}
