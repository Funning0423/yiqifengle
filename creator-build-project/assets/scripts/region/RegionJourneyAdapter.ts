import {waitRegionAsset} from './RegionAssetDeadline';
import {Animation, Camera, Color, Material, Mesh, MeshRenderer, Node, gfx, isValid, utils} from 'cc';
import {REGIONS, loadRegionPrefab, mountRegion} from './RegionLoader';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {SkyNightTexture} from '../render/SkyNightTexture';
import {configureMeadowVertexColors, loadWindEffect, validateModel, MeadowSceneMotion, meadowCloudMaterials, meadowGroundMaterials, MEADOW_PROP_NIGHT} from './MeadowBoardBackground';
import {rotate} from '../world-r1/CameraPose';
import {RegionJourneyController, routeLength} from '../world-r1/RegionJourneyCore';
import {REGION_JOURNEY_LAYOUT,bridgePath,islandApproach,lensKeys,plus,skyDeckRoute,skycityYawDeg} from './RegionJourneyLayout';
import type {JourneyRegion, JourneyRoute, JourneySceneLease} from '../world-r1/RegionJourneyCore';
import type {Cancellation, Pose, Vec} from '../world-r1/WorldFlowCore';
import {mountLakesideScenery} from './LakesideBoardBackground';
import {lakesideJourney} from './LakesideCameraLayout';
import {lakesideAtmosphereWeight} from './LakesideJourneyAtmosphere';
import {lakesideJourneyAtmosphere} from './LakesideJourneyLighting';
function find(node:Node,name:string):Node|null {if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
function anchor(model:Node,name:string):Vec{const node=find(model,name);if(!node)throw Error('journey-anchor-missing:'+name);const p=node.worldPosition;if(![p.x,p.y,p.z].every(Number.isFinite))throw Error('journey-anchor-invalid:'+name);return [p.x,p.y,p.z];}
/** Placement numbers and pure route maths live in RegionJourneyLayout (tested against the real GLB geometry). */
export {REGION_JOURNEY_LAYOUT};
/** First-pass bridge surface, not replacement region art. Seven narrow mesh strips share the exact controller
 * centreline; no animated/scaled actor, imported model edits, alpha loading cover or scene replacement. */
function rainbowBridge(parent:Node,path:readonly Vec[],owned:Array<Mesh|Material>):void{
 const colors=['#e88c92','#efaf83','#f3d990','#a5d6ac','#8ccbd5','#9aaee0','#c3a4df'],width=REGION_JOURNEY_LAYOUT.bridgeWidthM;
 for(let band=0;band<colors.length;band++){
  const positions:number[]=[],normals:number[]=[],indices:number[]=[];
  path.forEach((p,i)=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz)||1;
   for(const side of [band/7-.5,(band+1)/7-.5]){positions.push(p[0]+dz/L*side*width,p[1]-.015,p[2]-dx/L*side*width);normals.push(0,1,0);}
   if(i){const j=i*2;indices.push(j-2,j,j-1,j-1,j,j+1);}});
  // Creator 3.8.8 accepts asset pipeline states at initialization; runtime overrides require MaterialInstance.
  const mesh=utils.createMesh({positions,normals,indices},undefined,{calculateBounds:true}),material=new Material();
  material.initialize({effectName:'builtin-standard',defines:{USE_VERTEX_COLOR:false},states:{rasterizerState:{cullMode:gfx.CullMode.NONE}}});material.setProperty('mainColor',new Color(colors[band]));material.setProperty('roughness',.9);
  const node=new Node('RainbowBridgeStrip'+band);parent.addChild(node);const renderer=node.addComponent(MeshRenderer);renderer.mesh=mesh;renderer.setSharedMaterial(material,0);owned.push(mesh,material);
 }
}
/** Real bundled GLBs and required anchors/materials are prepared before publishing ready. Rigid placement only,
 * at original metre scale. The original island remains alive; a second area never replaces the visible first area. */
export function createRegionJourney(options:{parent:Node;camera:Camera}):RegionJourneyController{
 const mounted=new Map<JourneyRegion,Node>();
 return new RegionJourneyController({
  readCamera():Pose{const c=options.camera,p=c.node.worldPosition,q=c.node.worldRotation,f=rotate([q.x,q.y,q.z,q.w],[0,0,-1]);return {position:[p.x,p.y,p.z],target:[p.x+f[0]*8,p.y+f[1]*8,p.z+f[2]*8],fovVerticalDeg:c.fov};},
  async prepare(from,to,start,token,progress){
   if(to==='lakeside')return prepareLakesideJourney(options.parent,options.camera,from,start,token,progress);
   const def=REGIONS[to];if(!def||to==='island')throw Error('journey-region-unavailable');
   const prefab=await waitRegionAsset(loadRegionPrefab(def,p=>progress(p*.72)),token);token.check();
   if(!isValid(options.parent,true)||!isValid(options.camera.node,true))throw Error('journey-owner-destroyed');
   prefab.addRef();const owned:Array<Mesh|Material>=[],rig=new Node('RegionJourney-'+to);rig.active=false;options.parent.addChild(rig);
   let effect:any=null,dead=false,model:Node|null=null,motion:MeadowSceneMotion|null=null;
   const release=()=>{if(dead)return;dead=true;if(mounted.get(to)===model)mounted.delete(to);rig.active=false;rig.destroy();for(const asset of owned)asset.destroy();effect?.decRef();prefab.decRef();};
   try{
    model=mountRegion(def,prefab,rig);for(const c of model.getComponentsInChildren(Camera))c.enabled=false;
    if(to==='meadow'){
     for(const a of model.getComponentsInChildren(Animation)){a.playOnLoad=false;a.enabled=false;}
     const grass=validateModel(model);configureMeadowVertexColors(model);
     // These local backdrops enclose the source island when both scenes coexist. Reuse the world's existing sky.
     for(const name of ['meadow_sky_dome','meadow_far_hills']){const backdrop=find(model,name);if(backdrop)for(const r of backdrop.getComponentsInChildren(MeshRenderer))r.enabled=false;}
     // N1 (e2a03ec audit): at night the reused island sky reads as day out here. Keep the meadow dome as a night-only sky
     // with SkyNightTexture (night picture on demand, gradient until it lands); WorldFlowComponent.applyDayNight drives
     // nightBlend and the dome's visibility on every day/night change. Day keeps the old path (dome off).
     mountMeadowNightSky(model);
     effect=await waitRegionAsset(loadWindEffect(),token);token.check();effect.addRef();
     const material=new Material();material.initialize({effectAsset:effect});if(!material.passes.length)throw Error('journey-meadow-wind-material-missing');owned.push(material);
     for(const r of grass)for(let i=0;i<r.sharedMaterials.length;i++)r.setSharedMaterial(material,i);
     motion=rig.addComponent(MeadowSceneMotion);motion.material=material;motion.sail=find(model,'windmill_sail_hub');
     // N2: grass + topmost cloud follow the journey's night grade.
     motion.journeyNight=true;motion.clouds=meadowCloudMaterials(find(model,'meadow_clouds_near'));
     motion.grounds=meadowGroundMaterials([find(model,'meadow_terrain'),find(model,'meadow_river_bank')]);
    }else{const ambient=model.getComponent(RegionAmbientAnimation);if(!ambient)throw Error('journey-skycity-ambient-missing');await waitRegionAsset(ambient.prepare(),token);token.check();}
    progress(.86);
    let approach:Vec[];
    if(from==='island')approach=islandApproach(start);
    else{const meadow=mounted.get('meadow');if(!meadow)throw Error('journey-meadow-lease-missing');approach=[start];for(let i=3;i<=REGION_JOURNEY_LAYOUT.meadowExitPathIndex;i++)approach.push(anchor(meadow,'walk_path_'+String(i).padStart(2,'0')));}
    const edge=approach[approach.length-1];let bridge:Vec[],arrival:Vec[],focus:Vec|undefined;
    if(to==='meadow'){
     model.setRotationFromEuler(0,180,0);
     const incoming=anchor(model,'player_spawn'),landing=plus(edge,REGION_JOURNEY_LAYOUT.meadowOffset);
     model.setWorldPosition(...plus([model.worldPosition.x,model.worldPosition.y,model.worldPosition.z],[landing[0]-incoming[0],landing[1]-incoming[1],landing[2]-incoming[2]]));
     bridge=bridgePath(edge,anchor(model,'player_spawn'),REGION_JOURNEY_LAYOUT.meadowBridgeArchM);arrival=[];
     for(let i=1;i<=2;i++)arrival.push(anchor(model,'walk_path_'+String(i).padStart(2,'0')));
    }else{
     // Turn the city so the rainbow bridge meets the terminus platform's SIDE rim radially, put that landing on the bridge,
     // then step onto the city's cloud bridge and arrive at the same real entrance (2.4 m in from anchor_cloudbridge_end).
     // The follow lens turns to the plaza (anchor_starcourt_center) over the last metres.
     model.setRotationFromEuler(0,0,0);
     model.setRotationFromEuler(0,skycityYawDeg(anchor(model,'anchor_cloudbridge_end'),anchor(model,'anchor_cloudbridge_start')),0);
     const placed=skyDeckRoute(anchor(model,'anchor_cloudbridge_end'),anchor(model,'anchor_cloudbridge_start')),landing=plus(edge,REGION_JOURNEY_LAYOUT.skycityOffset);
     model.setWorldPosition(...plus([model.worldPosition.x,model.worldPosition.y,model.worldPosition.z],[landing[0]-placed.rim[0],landing[1]-placed.rim[1],landing[2]-placed.rim[2]]));
     const deck=skyDeckRoute(anchor(model,'anchor_cloudbridge_end'),anchor(model,'anchor_cloudbridge_start'));
     bridge=bridgePath(edge,deck.rim,REGION_JOURNEY_LAYOUT.skyBridgeArchM);arrival=[...deck.deck,deck.arrival];focus=anchor(model,'anchor_starcourt_center');
    }
    const path=[...approach,...bridge.slice(1),...arrival],route:JourneyRoute={from,to,path,bridgeStart:routeLength(approach),bridgeEnd:routeLength([...approach,...bridge.slice(1)]),speed:REGION_JOURNEY_LAYOUT.speedMps,startBlendM:0,...(focus?{focus,lens:lensKeys(REGION_JOURNEY_LAYOUT.skyLens,routeLength(approach))}:{})};
    rainbowBridge(rig,bridge,owned);token.check();
    // N3: at night the path, windmill and the (journey-owned, shared) rainbow bridge strips dim to x0.6 with the same night weight.
    if(motion&&model)motion.grounds.push(...meadowGroundMaterials([find(model,'meadow_path'),find(model,'windmill_static_merged'),find(model,'windmill_sails')],MEADOW_PROP_NIGHT),
     ...meadowGroundMaterials(rig.children.filter(n=>n.name.startsWith('RainbowBridgeStrip')),MEADOW_PROP_NIGHT,true));mounted.set(to,model);progress(.98);
    const lease:JourneySceneLease={route,show(visible){if(dead)return;rig.active=visible;if(motion){motion.visible=visible;motion.hostPaused=!visible;}model?.getComponent(RegionAmbientAnimation)?.setHostPaused(!visible);},dispose:release};
    return lease;
   }catch(error){release();throw error;}
  }
 });
}
/** N1: meadow_sky_dome as a night-only sky (SkyNightTexture on its renderer). Returns the component, or null without a dome. */
export function mountMeadowNightSky(model:Node,night:boolean=meadowNightNow()):SkyNightTexture|null{
 const dome=find(model,'meadow_sky_dome');const r=dome?dome.getComponentsInChildren(MeshRenderer)[0]:null;if(!dome||!r)return null;
 const sky=dome.getComponent(SkyNightTexture)||dome.addComponent(SkyNightTexture);sky.skyRenderer=r;(sky as any).__qfNightOnly=true;
 r.enabled=night;sky.setNightBlend(night?1:0);
 try{if((globalThis as any).__worldFlowLog)console.info('[QF_SKY] '+JSON.stringify({event:'meadow-night-sky',night}));}catch{}
 return sky;
}
function meadowNightNow():boolean{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}}
/** 风铃湖畔: island → lakeside journey (运镜bot's LakesideCameraLayout.lakesideJourney). The real r5h3 scene (same instances as
 *  the board background, default world layer so the world camera sees it) is mounted rigidly at the layout's root/yaw; the
 *  route carries the Landing A focus/landing overrides. Same rainbow bridge strips as the other legs. */
async function prepareLakesideJourney(parent:Node,camera:Camera,from:JourneyRegion,start:Vec,token:Cancellation,progress:(n:number)=>void):Promise<JourneySceneLease>{
 if(from!=='island')throw Error('journey-region-order');
 const held:Array<{decRef():unknown}>=[],owned:Array<Mesh|Material>=[],rig=new Node('RegionJourney-lakeside');rig.active=false;parent.addChild(rig);let dead=false;
 let waterY=0;const atmosphere=lakesideJourneyAtmosphere(camera,()=>waterY);
 const release=()=>{if(dead)return;dead=true;atmosphere.restore();rig.active=false;if(isValid(rig,true))rig.destroy();for(const a of owned)a.destroy();for(const a of held.splice(0))a.decRef();};
 const take=<T extends {addRef():unknown;decRef():unknown}>(a:T):T=>{if(dead)throw Error('journey-lakeside-disposed');a.addRef();held.push(a);return a;};
 try{
  progress(.05);const model=new Node('LakesideJourneyScene');rig.addChild(model);
  await mountLakesideScenery(model,token,take);token.check();progress(.86);
  if(!isValid(parent,true))throw Error('journey-owner-destroyed');
  const L=lakesideJourney(start);model.setRotationFromEuler(0,L.yawDeg,0);model.setWorldPosition(L.root[0],L.root[1],L.root[2]);waterY=L.root[1];
  const path=[...L.approach,...L.bridge.slice(1),...L.arrival];
  const route:JourneyRoute={from,to:'lakeside',path,bridgeStart:routeLength(L.approach),bridgeEnd:routeLength([...L.approach,...L.bridge.slice(1)]),speed:L.speed,startBlendM:L.startBlendM,focus:L.focus,landing:L.landing,timing:L.timing/* build05-next: 运镜bot 0e39055/b0c21d2 17 s S-curve walk (lakesideJourney contract) */};const total=routeLength(path);
  rainbowBridge(rig,L.bridge,owned);token.check();progress(.98);
  return {route,show(visible){if(dead)return;rig.active=visible;if(visible)atmosphere.prime();},progress(d){if(!dead)atmosphere.apply(lakesideAtmosphereWeight(route,total,d));},dispose:release};
 }catch(error){try{console.error('[QF_LAKE] island→lakeside journey prepare failed: '+String((error as any)?.stack||error));}catch{}release();throw error;}
}
