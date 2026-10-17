import {Camera, Color, DirectionalLight, Node, SkeletalAnimation, Vec3, director} from 'cc';
import {transportQaEnabled} from './JourneyTransport';
import {beatAt, sailBeats, sailCamera, sailM0World, sailM1World, sailMeadowRoot, sailRoute, sailVehicle} from './TransportLeg';
import {mountSailArt, type SailArt} from './SailArt';
import {REGIONS, loadRegionPrefab, mountRegion} from './RegionLoader';
import {mountMeadowNightSky} from './RegionJourneyAdapter';
/** QA / web-test only. `?sailshot=1&k=1` frames a real K still. Release WeChat ignores it. No on-screen text. */
export function sailShotRequested(search?:string,host:any=(globalThis as any).wx):boolean{
 let q=search;if(q===undefined){try{q=String((globalThis as any).location?.search||'');}catch{q='';}}
 if(!/[?&]sailshot=1(?:&|$)/.test(q||''))return false;
 return transportQaEnabled(host);
}
function qparam(name:string):string{
 try{const m=new RegExp('[?&]'+name+'=([^&]*)').exec(String((globalThis as any).location?.search||''));return m?decodeURIComponent(m[1]):'';}catch{return '';}
}
function shotIndex():number{
 const k=Number(qparam('k')||qparam('frame')||'3');
 return k>=1&&k<=7?k:3;
}
/** Build05 time whose boat-relative lens matches K1–K7. */
export function sailShotTime(k:number):{t:number;night:boolean}{
 const route=sailRoute(),tl=sailBeats(route.length);
 const beat=(id:string)=>tl.beats.find(b=>b.id===id)!;
 const at=(id:string,u:number)=>beat(id).t0+(beat(id).t1-beat(id).t0)*u;
 if(k===1)return {t:at('S-b',0.55),night:false};
 if(k===2)return {t:at('S-c',0.98),night:false};
 if(k===4)return {t:at('S-d',0.9),night:false};
 if(k===5)return {t:at('S-e',0.82),night:false};
 if(k===6)return {t:at('S-g',0.35),night:false};
 return {t:at('S-d',0.4),night:k===7||/^(1|night)$/i.test(qparam('night'))};
}
/**
 * One still of the real sail (GBT glbs, island, meadow, the bound stand-in). No proxy hull and no on-screen text.
 */
export async function startSailShot(scene:Node,rider?:Node|null):Promise<void>{
 const k=shotIndex();
 const {t,night}=sailShotTime(k);
 const route=sailRoute();
 const tl=sailBeats(route.length);
 const v=sailVehicle(tl,route.samples,t);
 const pose=sailCamera(tl,route.samples,t,{w:390,h:844});
 const island=mountRegion(REGIONS.island,await loadRegionPrefab(REGIONS.island),scene);
 island.name='SailShotIsland';
 const meadow=mountRegion(REGIONS.meadow,await loadRegionPrefab(REGIONS.meadow),scene);
 meadow.name='SailShotMeadow';
 meadow.setRotationFromEuler(0,180,0);
 const root=sailMeadowRoot();
 meadow.setWorldPosition(root[0],root[1],root[2]);
 const sky=mountMeadowNightSky(meadow,night);
 if(sky)sky.setNightBlend(night?1:0);
 let art:SailArt|null=null;
 try{art=await mountSailArt(scene,meadow);}catch(error){console.error('Sail art failed',error);}
 if(art){
  art.boat.setWorldPosition(v.pos[0],v.pos[1],v.pos[2]);
  art.boat.setRotationFromEuler(v.roll*180/Math.PI,v.yaw*180/Math.PI,0);
  art.sync(v,pose.position,0,night);
 }
 const clip=k===1||k===6?'walk_loop':'sit_hold';
 let character=false;
 if(rider&&rider.isValid){
  if(k===1){
   rider.setParent(scene);
   rider.setWorldPosition(SAIL_PIER_X, -0.18, v.pos[2]-0.2);
   rider.setRotationFromEuler(0,0,0);
  }else if(k===6){
   const m0=sailM0World(),m1=sailM1World();
   rider.setParent(scene);
   rider.setWorldPosition(m0[0]*0.65+m1[0]*0.35,m0[1]*0.65+m1[1]*0.35,m0[2]*0.65+m1[2]*0.35);
   rider.setRotationFromEuler(0,Math.atan2(m1[0]-m0[0],m1[2]-m0[2])*180/Math.PI,0);
  }else if(art?.seat){
   rider.setParent(art.seat,false);
   rider.setPosition(0,0,0);
   rider.setRotationFromEuler(0,0,0);
  }
  rider.active=true;
  const anims=rider.getComponentsInChildren(SkeletalAnimation);
  for(const a of anims){const c=a.clips.find(x=>x?.name===clip);if(!c)continue;a.play(clip);const st=a.getState(clip);if(st){st.time=0.2;st.sample();}}
  character=true;
 }
 const cams=scene.getComponentsInChildren(Camera);
 for(const cam of cams)cam.enabled=false;
 const camNode=new Node('SailShotCamera');scene.addChild(camNode);
 const cam=camNode.addComponent(Camera);
 cam.priority=1000;cam.near=0.1;cam.far=900;cam.fov=pose.fovVerticalDeg||48;cam.clearFlags=Camera.ClearFlag.SOLID_COLOR;
 cam.clearColor=night?new Color(12,18,48,255):new Color(120,196,235,255);
 cam.visibility=0xffffffff;
 camNode.setWorldPosition(pose.position[0],pose.position[1],pose.position[2]);
 camNode.lookAt(new Vec3(pose.target[0],pose.target[1],pose.target[2]));
 const sunNode=new Node('SailShotSun');scene.addChild(sunNode);
 const sun=sunNode.addComponent(DirectionalLight);
 sun.illuminance=night?18000:90000;
 sunNode.setWorldPosition(pose.position[0]-8,pose.position[1]+12,pose.position[2]-6);
 sunNode.lookAt(new Vec3(v.pos[0],v.pos[1]+1,v.pos[2]));
 const globals=(scene as any).globals;
 if(globals?.ambient){globals.ambient.skyIllum=night?5000:28000;}
 (globalThis as any).__sailShot={ready:true,beat:beatAt(tl,t).id,k,t,night,character,clip:character?clip:'',art:!!art};
 void director;
}
const SAIL_PIER_X=-1.9+0.7;
