import {Camera, Color, DirectionalLight, Material, MeshRenderer, Node, Vec3, director, gfx, utils} from 'cc';
import {transportQaEnabled} from './JourneyTransport';
import {beatAt, sailBeats, sailCamera, sailM0World, sailRoute, sailVehicle} from './TransportLeg';
import {boatPartMeshes, cardMesh, cloudMesh, countDc, domeMesh, meadowSlab, seaMesh, vehicleNightScale, type FrameMesh} from './TransitBackdrop';
/** QA / web-test only. `?sailshot=1` shows the sail. Release WeChat ignores it. No on-screen text. */
export function sailShotRequested(search?:string,host:any=(globalThis as any).wx):boolean{
 let q=search;if(q===undefined){try{q=String((globalThis as any).location?.search||'');}catch{q='';}}
 if(!/[?&]sailshot=1(?:&|$)/.test(q||''))return false;
 return transportQaEnabled(host);
}
function qparam(name:string):string{
 try{const m=new RegExp('[?&]'+name+'=([^&]*)').exec(String((globalThis as any).location?.search||''));return m?decodeURIComponent(m[1]):'';}catch{return '';}
}
function addMesh(parent:Node,mesh:FrameMesh,color:Color):MeshRenderer{
 const positions:number[]=[],normals:number[]=[],indices:number[]=[],t=mesh.tris;
 for(let i=0;i<t.length;i+=9){
  const base=positions.length/3;
  positions.push(t[i],t[i+1],t[i+2],t[i+3],t[i+4],t[i+5],t[i+6],t[i+7],t[i+8]);
  const nx=(t[i+4]-t[i+1])*(t[i+8]-t[i+2])-(t[i+5]-t[i+2])*(t[i+7]-t[i+1]);
  const ny=(t[i+5]-t[i+2])*(t[i+6]-t[i])-(t[i+3]-t[i])*(t[i+8]-t[i+2]);
  const nz=(t[i+3]-t[i])*(t[i+7]-t[i+1])-(t[i+4]-t[i+1])*(t[i+6]-t[i]);
  const l=Math.hypot(nx,ny,nz)||1;
  for(let k=0;k<3;k++)normals.push(nx/l,ny/l,nz/l);
  indices.push(base,base+1,base+2);
 }
 const geo=utils.createMesh({positions,normals,indices},undefined,{calculateBounds:true});
 const material=new Material();
 material.initialize({effectName:'builtin-unlit',defines:{USE_VERTEX_COLOR:false},states:{rasterizerState:{cullMode:gfx.CullMode.NONE}}});
 material.setProperty('mainColor',color);
 const node=new Node(mesh.name);parent.addChild(node);
 const r=node.addComponent(MeshRenderer);r.mesh=geo;r.setSharedMaterial(material,0);
 return r;
}
function partColor(name:string,tint:(r:number,g:number,b:number)=>Color,night:boolean):Color{
 if(name==='sail_root')return tint(255,102,0);
 if(name==='transport_sail_mast')return tint(48,26,14);
 if(name==='transport_sailboat_keel')return tint(72,36,18);
 if(name==='transport_sailboat')return tint(255,228,196);
 if(name==='env_sea_surface')return tint(16,128,198);
 if(name==='meadow_sky_dome')return tint(18,28,72);
 if(name==='env_sky_dome')return night?tint(18,28,72):tint(120,198,236);
 if(name==='transit_sea_cards')return tint(52,164,88);
 if(name==='transit_clouds'||name==='transit_clouds_mid')return tint(255,255,255);
 if(name==='meadow_terrain')return tint(78,186,64);
 return tint(255,246,230);
}
/**
 * One still of the requested beat. Pass the stand-in root after `sit_hold` is bound.
 * The page probe reads `__sailShot` for DC, fps and the board-slab time. No on-screen text.
 */
export function startSailShot(scene:Node,rider?:Node|null):void{
 const night=/^(1|night)$/i.test(qparam('night'));
 const want=(qparam('beat')||'S-d').toLowerCase();
 const route=sailRoute();
 const tl=sailBeats(route.length);
 const beat=tl.beats.find(b=>b.id.toLowerCase()===want)||tl.beats.find(b=>b.id.toLowerCase()==='s-'+want.replace(/^s-?/,''))||tl.beats[3];
 const t=(beat.t0+beat.t1)*0.5;
 const v=sailVehicle(tl,route.samples,t);
 const pose=sailCamera(tl,route.samples,t,{w:390,h:844});
 const scale=vehicleNightScale(night);
 const tint=(r:number,g:number,b:number)=>new Color(Math.round(r*scale),Math.round(g*scale),Math.round(b*scale),255);
 const root=new Node('SailShot');scene.addChild(root);
 const eye=pose.position;
 const meshes:FrameMesh[]=[
  seaMesh([eye[0],0,eye[2]]),
  domeMesh([eye[0],eye[1]*0.2,eye[2]],320,night?'meadow_sky_dome':'env_sky_dome'),
  cardMesh([eye[0],0,eye[2]]),
  cloudMesh([eye[0],0,eye[2]],60,220),
  cloudMesh([eye[0],0,eye[2]],28,90,'transit_clouds_mid'),
  ...boatPartMeshes(v.pos,v.yaw),
 ];
 const m0=sailM0World();
 let boardMs=0;
 if(Math.hypot(eye[0]-m0[0],eye[2]-m0[2])<140){
  const t0=typeof performance!=='undefined'?performance.now():Date.now();
  meshes.push(meadowSlab(m0));
  boardMs=(typeof performance!=='undefined'?performance.now():Date.now())-t0;
 }
 const renderers=meshes.map(m=>addMesh(root,m,partColor(m.name,tint,night)));
 const c=Math.cos(v.yaw),s=Math.sin(v.yaw),lx=0,ly=0.62,lz=-0.2;
 const seat=new Node('seat_bench');root.addChild(seat);
 seat.setWorldPosition(v.pos[0]+c*lx+s*lz,v.pos[1]+ly,v.pos[2]-s*lx+c*lz);
 seat.setRotationFromEuler(v.roll*180/Math.PI,v.yaw*180/Math.PI,0);
 let character=false;
 if(rider&&rider.isValid){
  rider.setParent(seat,false);
  rider.setPosition(0,0,0);
  rider.setRotationFromEuler(0,0,0);
  rider.active=true;
  character=true;
 }
 const cams=scene.getComponentsInChildren(Camera);
 for(const cam of cams)cam.enabled=false;
 const camNode=new Node('SailShotCamera');scene.addChild(camNode);
 const cam=camNode.addComponent(Camera);
 cam.priority=1000;
 cam.near=0.1;cam.far=900;cam.fov=pose.fovVerticalDeg||48;cam.clearFlags=Camera.ClearFlag.SOLID_COLOR;
 cam.clearColor=night?new Color(18,28,72,255):new Color(120,196,235,255);
 cam.visibility=0xffffffff;
 camNode.setWorldPosition(pose.position[0],pose.position[1],pose.position[2]);
 camNode.lookAt(new Vec3(pose.target[0],pose.target[1],pose.target[2]));
 const sunNode=new Node('SailShotSun');scene.addChild(sunNode);
 const sun=sunNode.addComponent(DirectionalLight);
 sun.illuminance=night?40000:120000;
 sunNode.setWorldPosition(pose.position[0],pose.position[1]+1,pose.position[2]);
 sunNode.lookAt(new Vec3(pose.target[0],pose.target[1],pose.target[2]));
 let frames=0,acc=0,fps=60,last=typeof performance!=='undefined'?performance.now():Date.now();
 const tick=()=>{
  const now=typeof performance!=='undefined'?performance.now():Date.now();
  const dt=Math.min(.1,(now-last)/1000);last=now;frames++;acc+=dt;
  if(acc>=0.5){fps=frames/acc;frames=0;acc=0;}
  (globalThis as any).__sailShot.fps=fps;
 };
 director.on?.('after-update' as any,tick);
 (globalThis as any).__sailShot={ready:true,beat:beatAt(tl,t).id,t,night,dc:countDc(meshes)+(character?1:0),renderers:renderers.length+(character?1:0),fps,boardMs,character,clip:character?'sit_hold':''};
}
