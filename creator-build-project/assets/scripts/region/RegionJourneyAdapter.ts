import {waitRegionAsset} from './RegionAssetDeadline';
import {Animation, Camera, Color, Material, Mesh, MeshRenderer, Node, gfx, isValid, utils} from 'cc';
import {REGIONS, loadRegionPrefab, mountRegion} from './RegionLoader';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {configureMeadowVertexColors, loadWindEffect, validateModel, MeadowSceneMotion} from './MeadowBoardBackground';
import {rotate} from '../world-r1/CameraPose';
import {RegionJourneyController, routeLength} from '../world-r1/RegionJourneyCore';
import type {JourneyRegion, JourneyRoute, JourneySceneLease} from '../world-r1/RegionJourneyCore';
import type {Pose, Vec} from '../world-r1/WorldFlowCore';
function find(node:Node,name:string):Node|null {if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
function anchor(model:Node,name:string):Vec{const node=find(model,name);if(!node)throw Error('journey-anchor-missing:'+name);const p=node.worldPosition;if(![p.x,p.y,p.z].every(Number.isFinite))throw Error('journey-anchor-invalid:'+name);return [p.x,p.y,p.z];}
/** Layout candidate, not visually approved. Keep metre scale. The meadow's low outer ground sits below the island sea;
 * source-mesh samples are recorded separately. Do not increase its Y offset without repeating that overlap audit. */
export const REGION_JOURNEY_LAYOUT={islandApproachM:3.2,meadowOffset:[0,0,24] as Vec,skycityOffset:[0,12,24] as Vec,bridgeWidthM:2.1,meadowBridgeArchM:2,skyBridgeArchM:2,speedMps:1.2,bridgeSamples:32,meadowExitPathIndex:8,skyEntryWalkM:2.4} as const;
const plus=(a:Vec,b:Vec):Vec=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
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
function bridgePath(a:Vec,b:Vec,arch:number):Vec[]{const out:Vec[]=[];for(let i=0;i<=REGION_JOURNEY_LAYOUT.bridgeSamples;i++){const t=i/REGION_JOURNEY_LAYOUT.bridgeSamples;out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+Math.sin(Math.PI*t)*arch,a[2]+(b[2]-a[2])*t]);}return out;}
/** Real bundled GLBs and required anchors/materials are prepared before publishing ready. Rigid placement only,
 * at original metre scale. The original island remains alive; a second area never replaces the visible first area. */
export function createRegionJourney(options:{parent:Node;camera:Camera}):RegionJourneyController{
 const mounted=new Map<JourneyRegion,Node>();
 return new RegionJourneyController({
  readCamera():Pose{const c=options.camera,p=c.node.worldPosition,q=c.node.worldRotation,f=rotate([q.x,q.y,q.z,q.w],[0,0,-1]);return {position:[p.x,p.y,p.z],target:[p.x+f[0]*8,p.y+f[1]*8,p.z+f[2]*8],fovVerticalDeg:c.fov};},
  async prepare(from,to,start,token,progress){
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
     effect=await waitRegionAsset(loadWindEffect(),token);token.check();effect.addRef();
     const material=new Material();material.initialize({effectAsset:effect});if(!material.passes.length)throw Error('journey-meadow-wind-material-missing');owned.push(material);
     for(const r of grass)for(let i=0;i<r.sharedMaterials.length;i++)r.setSharedMaterial(material,i);
     motion=rig.addComponent(MeadowSceneMotion);motion.material=material;motion.sail=find(model,'windmill_sail_hub');
    }else{const ambient=model.getComponent(RegionAmbientAnimation);if(!ambient)throw Error('journey-skycity-ambient-missing');await waitRegionAsset(ambient.prepare(),token);token.check();}
    progress(.86);
    let approach:Vec[]=[start];
    if(from==='island')approach.push(plus(start,[0,0,REGION_JOURNEY_LAYOUT.islandApproachM]));
    else{const meadow=mounted.get('meadow');if(!meadow)throw Error('journey-meadow-lease-missing');for(let i=3;i<=REGION_JOURNEY_LAYOUT.meadowExitPathIndex;i++)approach.push(anchor(meadow,'walk_path_'+String(i).padStart(2,'0')));}
    const edge=approach[approach.length-1],incomingName=to==='meadow'?'player_spawn':'anchor_cloudbridge_end';
    model.setRotationFromEuler(0,to==='meadow'?180:215,0);
    const incoming=anchor(model,incomingName),landing=plus(edge,to==='meadow'?REGION_JOURNEY_LAYOUT.meadowOffset:REGION_JOURNEY_LAYOUT.skycityOffset);
    model.setWorldPosition(...plus([model.worldPosition.x,model.worldPosition.y,model.worldPosition.z],[landing[0]-incoming[0],landing[1]-incoming[1],landing[2]-incoming[2]]));
    const end=anchor(model,incomingName),bridge=bridgePath(edge,end,to==='meadow'?REGION_JOURNEY_LAYOUT.meadowBridgeArchM:REGION_JOURNEY_LAYOUT.skyBridgeArchM),arrival:Vec[]=[];
    if(to==='meadow'){for(let i=1;i<=2;i++)arrival.push(anchor(model,'walk_path_'+String(i).padStart(2,'0')));}
    else{
     // Arrive at the city's real cloud-bridge entrance. The next board need not force a long commute to the court.
     const gate=anchor(model,'anchor_cloudbridge_start'),length=Math.hypot(gate[0]-end[0],gate[1]-end[1],gate[2]-end[2]),t=Math.min(1,REGION_JOURNEY_LAYOUT.skyEntryWalkM/length);
     arrival.push([end[0]+(gate[0]-end[0])*t,end[1]+(gate[1]-end[1])*t,end[2]+(gate[2]-end[2])*t]);
    }
    const path=[...approach,...bridge.slice(1),...arrival],route:JourneyRoute={from,to,path,bridgeStart:routeLength(approach),bridgeEnd:routeLength([...approach,...bridge.slice(1)]),speed:REGION_JOURNEY_LAYOUT.speedMps};
    rainbowBridge(rig,bridge,owned);token.check();mounted.set(to,model);progress(.98);
    const lease:JourneySceneLease={route,show(visible){if(dead)return;rig.active=visible;if(motion){motion.visible=visible;motion.hostPaused=!visible;}model?.getComponent(RegionAmbientAnimation)?.setHostPaused(!visible);},dispose:release};
    return lease;
   }catch(error){release();throw error;}
  }
 });
}
