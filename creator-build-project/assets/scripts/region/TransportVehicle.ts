import {Color, Layers, Material, MeshRenderer, Node, Prefab, Vec3, assetManager, gfx, instantiate, utils} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
/** Basket stand point. `basket_floor` is the controller root while she is idle in the balloon. */
export function seatWorld(floor:Vec,yawRad:number):{controllerRoot:Vec;yawRad:number}{
 return {controllerRoot:[floor[0],floor[1],floor[2]],yawRad};
}
function find(node:Node,name:string):Node|null{if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
export function basketFloor(root:Node):Node{return find(root,'basket_floor')??root;}
export function flameNode(root:Node):Node|null{return find(root,'burner_flame');}
const nightBase=new WeakMap<Material,Color>();
/** Night multiplies vehicle materials by 0.6 once from the authored color. The burner flame stays full brightness. */
export function applyVehicleNight(root:Node,night:boolean):void{
 const scale=night?0.6:1;
 const walk=(n:Node)=>{
  if(n.name!=='burner_flame')for(const r of n.getComponents(MeshRenderer)){const m=r.getMaterialInstance(0);if(!m)continue;const live=m.getProperty('mainColor') as Color|null;if(!live)continue;if(!nightBase.has(m))nightBase.set(m,new Color(live.r,live.g,live.b,live.a));const src=nightBase.get(m)!;m.setProperty('mainColor',new Color(Math.round(src.r*scale),Math.round(src.g*scale),Math.round(src.b*scale),src.a));}
  for(const child of n.children)walk(child);
 };
 walk(root);
}
/**
 * The glTF scene is a Prefab *sub-asset*. `bundle.load(fileName, Prefab)` misses it and the
 * previous ride kept an empty `basket_floor`, so she rose with no bag, basket or cloud.
 * `loadDir` finds the imported scene prefab by name. Visuals are drawn here either way:
 * imported materials drop COLOR_0, and a solid basket box cannot show her standing on the floor.
 */
export function loadBundlePrefab(name:string):Promise<Prefab|null>{
 return new Promise(ok=>{
  assetManager.loadBundle('transport_balloon',(err,bundle)=>{
   if(err||!bundle){ok(null);return;}
   const pick=(list:Prefab[]|null)=>{
    const hit=(list||[]).find(x=>x&&(x.name===name||x.name===name+'.prefab'));
    ok(hit||null);
   };
   bundle.load(name,Prefab,(e,prefab)=>{
    if(!e&&prefab){ok(prefab);return;}
    bundle.loadDir('',Prefab,(e2,list)=>pick(e2?null:list||[]));
   });
  });
 });
}
export function mountVehicle(prefab:Prefab|null,parent:Node):Node{
 if(!prefab){const empty=new Node('transport_balloon');parent.addChild(empty);const floor=new Node('basket_floor');empty.addChild(floor);const flame=new Node('burner_flame');empty.addChild(flame);return empty;}
 const node=instantiate(prefab);node.name='transport_balloon';parent.addChild(node);return node;
}
const TAU=Math.PI*2;
type Geom={positions:number[];normals:number[];colors:number[];indices:number[];min:Vec3;max:Vec3};
function geom():Geom{return {positions:[],normals:[],colors:[],indices:[],min:new Vec3(1e9,1e9,1e9),max:new Vec3(-1e9,-1e9,-1e9)};}
function vert(g:Geom,x:number,y:number,z:number,nx:number,ny:number,nz:number,c:number[]):number{
 const i=g.positions.length/3;g.positions.push(x,y,z);const l=Math.hypot(nx,ny,nz)||1;g.normals.push(nx/l,ny/l,nz/l);g.colors.push(c[0],c[1],c[2],c[3]??1);
 g.min.x=Math.min(g.min.x,x);g.min.y=Math.min(g.min.y,y);g.min.z=Math.min(g.min.z,z);g.max.x=Math.max(g.max.x,x);g.max.y=Math.max(g.max.y,y);g.max.z=Math.max(g.max.z,z);return i;
}
function tri(g:Geom,a:number,b:number,c:number){g.indices.push(a,b,c);}
function unlit(vertex:boolean):Material{
 const m=new Material();
 m.initialize({effectName:'builtin-unlit',technique:0,defines:{USE_VERTEX_COLOR:vertex},states:{rasterizerState:{cullMode:gfx.CullMode.NONE}}});
 m.setProperty('mainColor',new Color(255,255,255,255));return m;
}
function paint(parent:Node,name:string,g:Geom,material:Material,owned:Array<{destroy():void}>):Node{
 const node=new Node(name);parent.addChild(node);node.layer=Layers.Enum.DEFAULT;
 const mesh=utils.createMesh({positions:g.positions,normals:g.normals,colors:g.colors,indices:g.indices,minPos:g.min,maxPos:g.max});
 owned.push(mesh);const r=node.addComponent(MeshRenderer);r.mesh=mesh;r.setMaterial(material,0);r.shadowCastingMode=MeshRenderer.ShadowCastingMode.OFF;return node;
}
function hideImported(root:Node):void{
 const walk=(n:Node)=>{n.layer=Layers.Enum.DEFAULT;for(const r of n.getComponents(MeshRenderer))r.enabled=false;for(const c of n.children)walk(c);};
 walk(root);
}
/** Saturated envelope, hollow basket (floor at y=0.08, rim at 0.5 m), ropes, flame. She stands on `basket_floor`. */
export function attachBalloonVisuals(root:Node):{destroy():void}{
 hideImported(root);
 const owned:Array<{destroy():void}>=[];
 const body=unlit(true);owned.push(body);
 const g=geom();
 const gores=8,rings=6,radius=3,y0=4.85;
 const stripe=[[0.93,0.2,0.16],[0.98,0.78,0.12],[0.16,0.62,0.28],[0.97,0.94,0.82],[0.18,0.42,0.82],[0.93,0.45,0.18],[0.22,0.55,0.72],[0.85,0.22,0.38]];
 const env=(gi:number,ri:number)=>{const u=gi/gores,v=ri/rings,phi=(v-0.5)*Math.PI*0.9,theta=u*TAU,cp=Math.cos(phi),sp=Math.sin(phi);
  return vert(g,Math.cos(theta)*cp*radius,y0+sp*radius*1.2,Math.sin(theta)*cp*radius,Math.cos(theta)*cp,sp,Math.sin(theta)*cp,stripe[gi%stripe.length]);};
 const ring:number[][]=[];
 for(let gi=0;gi<=gores;gi++){ring[gi]=[];for(let ri=0;ri<=rings;ri++)ring[gi][ri]=env(gi%gores,ri);}
 for(let gi=0;gi<gores;gi++)for(let ri=0;ri<rings;ri++){const a=ring[gi][ri],b=ring[gi+1][ri],c=ring[gi][ri+1],d=ring[gi+1][ri+1];tri(g,a,c,b);tri(g,b,c,d);}
 const wood=[0.66,0.4,0.16],rim=[0.78,0.52,0.22],sides=8,rOut=0.82,rIn=0.64,yFloor=0.08,yRim=0.5;
 const center=vert(g,0,yFloor,0,0,1,0,rim);
 const inner:number[]=[];
 for(let i=0;i<sides;i++){const a=i/sides*TAU,c=Math.cos(a),s=Math.sin(a);inner.push(vert(g,c*rIn,yFloor,s*rIn,0,1,0,rim));}
 for(let i=0;i<sides;i++)tri(g,center,inner[i],inner[(i+1)%sides]);
 const wall=(y:number,rad:number,n:number)=>{const row:number[]=[];for(let i=0;i<sides;i++){const a=i/sides*TAU;row.push(vert(g,Math.cos(a)*rad,y,Math.sin(a)*rad,Math.cos(a)*n,0,Math.sin(a)*n,wood));}return row;};
 const o0=wall(0,rOut,1),o1=wall(yRim,rOut,1),i0=wall(0,rIn,-1),i1=wall(yRim,rIn,-1);
 for(let i=0;i<sides;i++){const j=(i+1)%sides;tri(g,o0[i],o0[j],o1[j]);tri(g,o0[i],o1[j],o1[i]);tri(g,i0[i],i1[j],i0[j]);tri(g,i0[i],i1[i],i1[j]);
  tri(g,o1[i],o1[j],i1[j]);tri(g,o1[i],i1[j],i1[i]);}
 const rope=[0.42,0.28,0.14];
 for(let i=0;i<sides;i++){const a=(i+0.5)/sides*TAU,c=Math.cos(a),s=Math.sin(a),x0=c*rOut,z0=s*rOut,x1=c*0.42,z1=s*0.42,y1=2.05;
  const w=0.035,px=-s*w,pz=c*w;
  const a0=vert(g,x0-px,yRim,z0-pz,px,0,pz,rope),b0=vert(g,x0+px,yRim,z0+pz,-px,0,-pz,rope),a1=vert(g,x1-px,y1,z1-pz,px,0,pz,rope),b1=vert(g,x1+px,y1,z1+pz,-px,0,-pz,rope);
  tri(g,a0,b0,b1);tri(g,a0,b1,a1);}
 paint(root,'balloon_body',g,body,owned);
 const flame=geom();const fy=0.62,hot=[1,0.92,0.35],tip=[1,0.42,0.08];
 const f0=vert(flame,0,fy,0,0,0,1,hot),f1=vert(flame,0.22,fy+0.85,0,0,0,1,tip),f2=vert(flame,-0.22,fy+0.85,0,0,0,1,tip),f3=vert(flame,0,fy+0.55,0.16,0,0,1,hot);
 tri(flame,f0,f1,f2);tri(flame,f0,f3,f1);tri(flame,f0,f2,f3);
 const flameMat=unlit(true);owned.push(flameMat);
 const flameNode=paint(root,'burner_flame',flame,flameMat,owned);
 const old=flameNode.parent&&find(root,'burner_flame');
 if(old&&old!==flameNode)old.active=false;
 const floor=basketFloor(root);floor.setPosition(0,yFloor,0);floor.layer=Layers.Enum.DEFAULT;
 const wisps=new Node('ride_wisps');root.addChild(wisps);wisps.layer=Layers.Enum.DEFAULT;wisps.active=false;
 const wg=geom();const cream=[0.98,0.99,1];
 const blob=(cx:number,cy:number,cz:number,rad:number)=>{const lat=3,lon=5,ids:number[][]=[];
  for(let j=0;j<=lat;j++){ids[j]=[];const v=j/lat,phi=v*Math.PI,sp=Math.sin(phi),cp=Math.cos(phi);
   for(let i=0;i<=lon;i++){const theta=i/lon*TAU;ids[j][i]=vert(wg,cx+Math.cos(theta)*sp*rad,cy+cp*rad*0.75,cz+Math.sin(theta)*sp*rad,Math.cos(theta)*sp,cp,Math.sin(theta)*sp,cream);}}
  for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){tri(wg,ids[j][i],ids[j+1][i],ids[j][i+1]);tri(wg,ids[j][i+1],ids[j+1][i],ids[j+1][i+1]);}};
 blob(-3.7,4.5,1.2,1.25);blob(3.7,4.7,1.2,1.25);blob(0.2,6.6,2.2,1.45);
 paint(wisps,'cloud_beside',wg,body,owned);
 return {wisps,destroy(){for(const a of owned)a.destroy();}};
}
/** Puffs around a hole wider than the B-d lens (inner edge ≥ 11 m, diameter ≥ 8 m). */
export function attachCloudVisuals(root:Node):{destroy():void}{
 hideImported(root);root.layer=Layers.Enum.DEFAULT;
 const owned:Array<{destroy():void}>=[];const mat=unlit(true);owned.push(mat);
 const g=geom();const puff=(cx:number,cy:number,cz:number,rad:number,tint:number[])=>{
  const lat=4,lon=6,ids:number[][]=[];
  for(let j=0;j<=lat;j++){ids[j]=[];const v=j/lat,phi=v*Math.PI,sp=Math.sin(phi),cp=Math.cos(phi);
   for(let i=0;i<=lon;i++){const theta=i/lon*TAU;ids[j][i]=vert(g,cx+Math.cos(theta)*sp*rad,cy+cp*rad*0.72,cz+Math.sin(theta)*sp*rad,Math.cos(theta)*sp,cp,Math.sin(theta)*sp,tint);}}
  for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){tri(g,ids[j][i],ids[j+1][i],ids[j][i+1]);tri(g,ids[j][i+1],ids[j+1][i],ids[j+1][i+1]);}
 };
 const cream=[0.97,0.98,1],shade=[0.74,0.84,0.96];
 for(let i=0;i<10;i++){const a=i/10*TAU;puff(Math.cos(a)*14,Math.sin(a*2)*1.1,Math.sin(a)*14,2.3,i%2?cream:shade);}
 paint(root,'cloud_ring',g,mat,owned);
 return {destroy(){for(const a of owned)a.destroy();}};
}
/** Distant meadow fill so a downward lens does not end on the sky-dome bowl. Sits under the terrain. */
export function attachHorizonDisc(parent:Node,at:Vec):{destroy():void}{
 const owned:Array<{destroy():void}>=[];const mat=unlit(true);owned.push(mat);const g=geom();
 const seg=28,r0=18,r1=240,green=[0.42,0.7,0.3],haze=[0.62,0.82,0.9];
 const inner:number[]=[],outer:number[]=[];
 for(let i=0;i<=seg;i++){const a=i/seg*TAU,c=Math.cos(a),s=Math.sin(a);
  inner.push(vert(g,c*r0,0,s*r0,0,1,0,green));outer.push(vert(g,c*r1,0,s*r1,0,1,0,haze));}
 for(let i=0;i<seg;i++){tri(g,inner[i],outer[i],outer[i+1]);tri(g,inner[i],outer[i+1],inner[i+1]);}
 const node=paint(parent,'transit_horizon',g,mat,owned);node.setWorldPosition(at[0],at[1],at[2]);
 return {destroy(){for(const a of owned)a.destroy();}};
}
/** Four far island cards around the pad, upright, so the horizon is land and not an empty bowl. */
export function attachSkyCards(root:Node):{destroy():void}{
 hideImported(root);root.layer=Layers.Enum.DEFAULT;
 const owned:Array<{destroy():void}>=[];const mat=unlit(true);owned.push(mat);const g=geom();
 const spots:[[number,number,number],[number,number,number]][]=[[[70,6,-24],[0,0,1]],[[-80,8,30],[0,0,-1]],[[24,7,-90],[1,0,0]],[[-20,9,80],[-1,0,0]]];
 const top=[0.78,0.9,0.98],bot=[0.5,0.72,0.55];
 for(const [p,n] of spots){const w=16,h=7,rx=n[2],rz=-n[0];
  const a=vert(g,p[0],p[1],p[2],n[0],0,n[2],bot),b=vert(g,p[0]+rx*w,p[1],p[2]+rz*w,n[0],0,n[2],bot);
  const c=vert(g,p[0]+rx*w,p[1]+h,p[2]+rz*w,n[0],0,n[2],top),d=vert(g,p[0],p[1]+h,p[2],n[0],0,n[2],top);
  tri(g,a,b,c);tri(g,a,c,d);}
 paint(root,'sky_card_visual',g,mat,owned);
 return {destroy(){for(const a of owned)a.destroy();}};
}
