import {Camera, Color, DirectionalLight, MeshRenderer, Node, SkeletalAnimation, Vec3} from 'cc';
import {debugSearch} from './DebugQuery';
import {transportQaEnabled} from './JourneyTransport';
import {beatAt, sailBeats, sailStillTimes, sailCamera, sailMeadowRoot, sailRoute, sailVehicle} from './TransportLeg';
import {mountSailArt, findNode, type SailArt} from './SailArt';
import {REGIONS, loadRegionPrefab, mountRegion} from './RegionLoader';
import {mountMeadowNightSky} from './RegionJourneyAdapter';
import {configureMeadowVertexColors} from './MeadowBoardBackground';
import {SAIL_VOYAGE, sailVoyageCamera} from './SailVoyage';
/** QA / web-test only. `?sailshot=1&k=1` frames a real K still. Release WeChat ignores it. No on-screen text. */
export function sailShotRequested(search?:string,host:any=(globalThis as any).wx):boolean{
 let q=search;if(q===undefined)q=debugSearch();
 if(!/[?&]sailshot=1(?:&|$)/.test(q||''))return false;
 return transportQaEnabled(host);
}
function qparam(name:string):string{
 try{const m=new RegExp('[?&]'+name+'=([^&]*)').exec(debugSearch());return m?decodeURIComponent(m[1]):'';}catch{return '';}
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
 const st=sailStillTimes(tl);
 if(k===1)return {t:st.k1,night:false};
 if(k===2)return {t:st.k2,night:false};
 if(k===4)return {t:st.k4,night:false};
 if(k===5)return {t:st.k5,night:false};
 if(k===6)return {t:at('S-g',0.85),night:false};
 return {t:st.k3,night:k===7||/^(1|night)$/i.test(qparam('night'))};
}
/**
 * One still of the real sail (GBT glbs, island, meadow, the bound stand-in). No proxy hull and no on-screen text.
 */
export async function startSailShot(scene:Node,rider?:Node|null):Promise<void>{
 const k=shotIndex();
 const shot=sailShotTime(k),night=shot.night;
 // sail-voyage capture (tools/sail-voyage/capture-spec.json): `&sailT=<Build05 s>` picks any frame, `&sailVoyage=1` the voyage lens,
 // `&w=&h=` the screen the lens is framed for (default 390×844, as before).
 const tq=Number(qparam('sailT')),t=qparam('sailT')!==''&&isFinite(tq)?tq:shot.t,scr={w:Number(qparam('w'))||390,h:Number(qparam('h'))||844};
 const route=sailRoute();
 const tl=sailBeats(route.length);
 const v=sailVehicle(tl,route.samples,t);
 const pose=SAIL_VOYAGE.enabled?sailVoyageCamera(tl,route.samples,t,scr):sailCamera(tl,route.samples,t,scr);
 const island=mountRegion(REGIONS.island,await loadRegionPrefab(REGIONS.island),scene);
 island.name='SailShotIsland';
 const meadow=mountRegion(REGIONS.meadow,await loadRegionPrefab(REGIONS.meadow),scene);
 meadow.name='SailShotMeadow';
 meadow.setRotationFromEuler(0,180,0);
 const root=sailMeadowRoot();
 meadow.setWorldPosition(root[0],root[1],root[2]);
 configureMeadowVertexColors(meadow);
 const sky=mountMeadowNightSky(meadow,night);
 if(sky)sky.setNightBlend(night?1:0);
 for(const name of ['meadow_far_hills']){const n=findNode(meadow,name);if(n)for(const r of n.getComponentsInChildren(MeshRenderer))r.enabled=false;}
 if(!night){const n=findNode(meadow,'meadow_sky_dome');if(n)for(const r of n.getComponentsInChildren(MeshRenderer))r.enabled=false;}
 let art:SailArt|null=null;
 try{art=await mountSailArt(scene,meadow);}catch(error){console.error('Sail art failed',error);}
 if(art){
  art.boat.setWorldPosition(v.pos[0],v.pos[1],v.pos[2]);
  art.boat.setRotationFromEuler(v.roll*180/Math.PI,v.yaw*180/Math.PI,0);
  art.sync(v,pose.position,0,night,pose.target,t);
 }
 const clip=k===1||k===6?'walk_loop':'sit_hold';
 let character=false;
 if(rider&&rider.isValid){
  if(k===1){
   const pier=findNode(scene,'transit_pier');
   if(pier){rider.setParent(pier);rider.setPosition(-0.2,0.42,1.8);rider.setRotationFromEuler(0,90,0);}
   else{rider.setParent(scene);rider.setWorldPosition(v.pos[0]-1.6,-0.18,v.pos[2]);rider.setRotationFromEuler(0,90,0);}
  }else if(k===6){
   // On the jetty shore end / path seam (landing_walk near land).
   const step=findNode(meadow,'landing_walk_02')||findNode(meadow,'landing_step')||findNode(scene,'landing_walk_02');
   if(step){rider.setParent(step);rider.setPosition(0,0,0);rider.setRotationFromEuler(0,180,0);}
   else{
    rider.setParent(scene);
    rider.setWorldPosition(v.pos[0]+1.35,v.pos[1]+0.84,v.pos[2]+7.1);
    rider.setRotationFromEuler(0,0,0);
   }
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
 cam.clearColor=night?new Color(32,48,92,255):new Color(120,196,235,255);
 cam.visibility=0xffffffff;
 const viewMode=qparam('view');
 const above=k===6&&viewMode==='above';
 const meadowView=viewMode==='meadow'||viewMode==='arrival';
 if(above){
  cam.fov=40;
  camNode.setWorldPosition(v.pos[0]+4.5,v.pos[1]+11,v.pos[2]+7);
  camNode.lookAt(new Vec3(v.pos[0]+0.8,v.pos[1]+0.2,v.pos[2]+4));
 }else if(meadowView){
  // Meadow play lens looking toward the shore seam (landing stays on meadow after sail dispose).
  cam.fov=46;
  camNode.setWorldPosition(-0.4,4.2,64.8);
  camNode.lookAt(new Vec3(-2.6,0.5,54.5));
  art?.dispose();
 }else{
  camNode.setWorldPosition(pose.position[0],pose.position[1],pose.position[2]);
  camNode.lookAt(new Vec3(pose.target[0],pose.target[1],pose.target[2]));
 }
 const sunNode=new Node('SailShotSun');scene.addChild(sunNode);
 const sun=sunNode.addComponent(DirectionalLight);
 sun.illuminance=night?20000:90000;
 if(night)sun.color=new Color(176,198,232,255);
 sunNode.setWorldPosition(pose.position[0]-8,pose.position[1]+12,pose.position[2]-6);
 sunNode.lookAt(new Vec3(v.pos[0],v.pos[1]+1,v.pos[2]));
 if(night)for(const light of scene.getComponentsInChildren(DirectionalLight))if(light!==sun)light.illuminance=Math.min(light.illuminance,4500);
 const globals=(scene as any).globals;
 if(globals?.ambient){
  globals.ambient.skyIllum=night?5200:28000;
  if(night&&globals.ambient.skyColor)globals.ambient.skyColor=new Color(58,82,140,255);
  if(night&&globals.ambient.groundLightingColor)globals.ambient.groundLightingColor=new Color(40,56,96,255);
 }
 (globalThis as any).__sailShot={ready:true,beat:beatAt(tl,t).id,k,t,night,character,clip:character?clip:'',art:!!art};
}
