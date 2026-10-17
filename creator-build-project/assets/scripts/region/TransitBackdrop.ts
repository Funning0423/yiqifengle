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
export function boatMesh(pos:Vec,yaw:number):FrameMesh{
 const out:number[]=[],c=Math.cos(yaw),s=Math.sin(yaw);
 const p=(x:number,y:number,z:number):Vec=>[pos[0]+c*x+s*z,pos[1]+y,pos[2]-s*x+c*z];
 const h=(x:number,z:number,y0:number,y1:number)=>{
  const a=p(x,y0,z),b=p(x,y1,z);
  return [a,b] as const;
 };
 // 4.2 m hull, well under the camera's 6 m follow distance.
 const L=2.1,W=0.55,B=-0.2,T=0.45;
 quad(out,p(-W,B,-L),p(-W,B,L*0.7),p(W,B,L*0.7),p(W,B,-L));
 quad(out,p(-0.45,T,-0.3),p(-0.15,T+1.7,-0.3),p(0.15,T+1.7,-0.3),p(0.45,T,-0.3));
 return {name:'transport_sailboat',tag:'boat',tris:Float32Array.from(out),dc:2};
}
export function meadowSlab(center:Vec):FrameMesh{
 const out:number[]=[],y=center[1];
 quad(out,[center[0]-30,y,center[2]-20],[center[0]-30,y,center[2]+8],[center[0]+30,y,center[2]+8],[center[0]+30,y,center[2]-20]);
 return {name:'meadow_terrain',tag:'ground',tris:Float32Array.from(out),dc:4};
}
export function transitScene(camera:Vec,boat:Vec,yaw:number,estuary:Vec,night:boolean):FrameMesh[]{
 const follow:Vec=[camera[0],0,camera[2]];
 const dome=domeMesh([camera[0],camera[1]*0.2,camera[2]],320,night?'meadow_sky_dome':'env_sky_dome');
 const meshes=[seaMesh(follow),dome,cardMesh(follow,150,camera[1]-0.35),cloudMesh(follow,60,220),cloudMesh(follow,28,90,'transit_clouds_mid'),boatMesh(boat,yaw)];
 if(Math.hypot(camera[0]-estuary[0],camera[2]-estuary[2])<90)meshes.push(meadowSlab(estuary));
 return meshes;
}
/** Night grade for the vehicle (same ×0.6 weight as the meadow journey). */
export function vehicleNightScale(night:boolean):number{return night?0.6:1;}
export function countDc(meshes:readonly FrameMesh[]):number{let n=0;for(const m of meshes)n+=m.dc;return n;}
export function countTris(meshes:readonly FrameMesh[]):number{let n=0;for(const m of meshes)n+=m.tris.length/9;return n;}
