import {Color, Material, MeshRenderer, Node, PointLight, Prefab, Texture2D, Vec4, assetManager, director, gfx, instantiate} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
import {SAIL_BERTH_X, SAIL_I6, SAIL_SEA_Y, sailRoute, type SailPose} from './TransportLeg';
const SEA_SCALE=3.2;
const ISLAND_SEA=['env_sea_surface','env_sea_foam','env_sea_surf_foam_v22','env_sea_wave_line_01_v22','env_sea_wave_line_02_v22'];
export function findNode(node:Node|null,name:string):Node|null{if(!node)return null;if(node.name===name)return node;for(const c of node.children){const h=findNode(c,name);if(h)return h;}return null;}
function walk(node:Node,fn:(n:Node)=>void){fn(node);for(const c of node.children)walk(c,fn);}
function loadPrefab(name:string):Promise<Prefab>{
 return new Promise((ok,fail)=>assetManager.loadBundle('transport_sail',(e,b)=>{
  if(e||!b){fail(e||Error('transport_sail'));return;}
  b.load(name+'/'+name,Prefab,(e2,p)=>{if(e2||!p)fail(e2||Error(name));else ok(p as Prefab);});
 }));
}
function nearestPalette(tex:Texture2D|null){
 if(!tex||!/palette/i.test(tex.name||''))return;
 tex.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);
 if(typeof (tex as any).setMipFilter==='function')(tex as any).setMipFilter(Texture2D.Filter.NONE);
}
function copyMat(renderer:MeshRenderer,patch:{cull?:number;alphaTest?:number;blend?:boolean;vertex?:boolean}):Material|null{
 const shared=renderer.getSharedMaterial(0);if(!shared)return null;
 const defines={...(shared.passes[0]?.defines||{})} as Record<string,boolean|number|string>;
 if(patch.alphaTest!=null)defines.USE_ALPHA_TEST=true;
 if(patch.vertex)defines.USE_VERTEX_COLOR=true;
 const states:any={rasterizerState:{cullMode:patch.cull??gfx.CullMode.BACK}};
 if(patch.blend)states.depthStencilState={depthTest:true,depthWrite:false};
 if(patch.blend)states.blendState={targets:[{blend:true,blendSrc:gfx.BlendFactor.SRC_ALPHA,blendDst:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,blendSrcAlpha:gfx.BlendFactor.SRC_ALPHA,blendDstAlpha:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA}]};
 const mat=new Material();
 if(shared.effectAsset)mat.initialize({effectAsset:shared.effectAsset,defines,states});
 else mat.initialize({effectName:'builtin-standard',defines,states});
 for(const key of ['mainTexture','mainColor','roughness','metallic','emissive','emissiveScale']){
  const v=shared.getProperty(key);if(v!=null)mat.setProperty(key,v);
 }
 const tex=mat.getProperty('mainTexture') as Texture2D|null;
 nearestPalette(tex);
 if(patch.alphaTest!=null)mat.setProperty('alphaThreshold',patch.alphaTest);
 renderer.setSharedMaterial(mat,0);
 return mat;
}
function place(node:Node|null,x:number,y:number,z:number){if(node)node.setWorldPosition(x,y,z);}
export type SailArt={boat:Node;seat:Node|null;stand:Node|null;board:Node|null;sail:Node|null;sync:(v:SailPose,cam:Vec,dt:number,night:boolean)=>void;dispose:()=>void};
/** GBT sail bundle: hull, sea sheet, props, far cards, clouds, river mouth. The orange procedural boat is not loaded. */
export async function mountSailArt(parent:Node,meadow:Node|null):Promise<SailArt>{
 const [boatP,seaP,propsP,farP,cloudP,mouthP]=await Promise.all(['sailboat','transit_sea','transit_sea_props','transit_far_cards','transit_clouds','transit_river_mouth'].map(loadPrefab));
 const root=new Node('SailArt');parent.addChild(root);
 const boat=instantiate(boatP);boat.name='sailboat';root.addChild(boat);
 const sea=instantiate(seaP);sea.name='transit_sea';root.addChild(sea);
 const props=instantiate(propsP);props.name='transit_sea_props';root.addChild(props);
 const far=instantiate(farP);far.name='transit_far_cards';root.addChild(far);
 const clouds=instantiate(cloudP);clouds.name='transit_clouds';root.addChild(clouds);
 const mouth=instantiate(mouthP);mouth.name='transit_river_mouth';root.addChild(mouth);
 const seat=findNode(boat,'seated_root_anchor'),stand=findNode(boat,'stand_anchor'),board=findNode(boat,'board_step_anchor');
 const sailRoot=findNode(boat,'sail_root'),jib=findNode(boat,'jib_root'),furled=findNode(boat,'sail_furled'),boom=findNode(boat,'boom_pivot');
 const lamp=findNode(boat,'lantern_glow'),stars=findNode(clouds,'night_stars');
 const wake=findNode(props,'wake_strips'),foam=findNode(props,'hull_foam_ring'),wakeAnchor=findNode(boat,'wake_root');
 if(wake&&wakeAnchor){wake.setParent(wakeAnchor);wake.setPosition(0,0.03,0);wake.setRotationFromEuler(0,0,0);}
 if(foam){foam.setParent(boat);foam.setPosition(0,0.02,0);foam.setRotationFromEuler(0,0,0);}
 const tile=findNode(sea,'sea_tile_39m');if(tile)tile.active=false;
 const plane=findNode(sea,'sea_plane');if(plane)plane.setScale(SEA_SCALE,1,SEA_SCALE);
 const route=sailRoute().samples,end=route[route.length-1],start=route[0];
 const pier=findNode(props,'transit_pier');
 place(pier,SAIL_I6[0],-0.6,SAIL_I6[2]-0.7);
 if(pier){const land=instantiate(pier);land.name='transit_pier_land';props.addChild(land);place(land,end[0]+2.45,-0.6,end[2]-2.4);}
 place(mouth,end[0],SAIL_SEA_Y,end[2]-16);
 place(findNode(props,'buoy_red'),end[0]+5.3,SAIL_SEA_Y,end[2]-14);
 place(findNode(props,'buoy_green'),end[0]-5.4,SAIL_SEA_Y,end[2]-13.6);
 const rocks:[[number,number,number],[number,number,number],[number,number,number]]=[
  [start[0]-8.2,SAIL_SEA_Y,start[2]+4.2],[start[0]+7.4,SAIL_SEA_Y,start[2]+9.5],[end[0]+11.5,SAIL_SEA_Y,end[2]-13],
 ];
 place(findNode(props,'sea_rock_a'),...rocks[0]);
 place(findNode(props,'sea_rock_b'),...rocks[1]);
 place(findNode(props,'sea_rock_c'),...rocks[2]);
 const ring=findNode(props,'foam_ring');
 rocks.forEach((p,i)=>{const n=i===0?ring:ring?instantiate(ring):null;if(n&&i)props.addChild(n);place(n,p[0],SAIL_SEA_Y+0.02,p[2]);});
 place(findNode(props,'foam_strip_a'),start[0]-SAIL_BERTH_X,SAIL_SEA_Y,start[2]-1.2);
 place(findNode(props,'foam_strip_b'),end[0],SAIL_SEA_Y,end[2]-6);
 const lighthouseCard=findNode(far,'far_island_lighthouse');
 if(lighthouseCard)lighthouseCard.active=false;
 place(findNode(far,'far_islet_a'),start[0]+70,SAIL_SEA_Y,start[2]-120);
 place(findNode(far,'far_islet_b'),start[0]-90,SAIL_SEA_Y,start[2]+40);
 place(findNode(far,'far_islet_c'),end[0]+80,SAIL_SEA_Y,end[2]+30);
 const coast=findNode(far,'far_meadow_coast');
 if(coast)coast.active=!meadow?.active;
 const mid:Vec=[(start[0]+end[0])*0.5,0,(start[2]+end[2])*0.5];
 ['cloud_a','cloud_b','cloud_c','cloud_d','cloud_e','cloud_f'].forEach((name,i)=>{
  const a=i/6*Math.PI*2;place(findNode(clouds,name),mid[0]+Math.cos(a)*150,38+(i%3)*12,mid[2]+Math.sin(a)*150);
 });
 if(stars)stars.setWorldPosition(mid[0],0,mid[2]);
 let wakeMat:Material|null=null,foamMat:Material|null=null,seaMat:Material|null=null;
 const seaOff=new Vec4(SEA_SCALE,SEA_SCALE,0,0);
 walk(root,n=>{
  const r=n.getComponent(MeshRenderer);if(!r)return;
  if(n.name==='sail_main'||n.name==='sail_jib'||n.name==='sail_furled'||n.name==='pennant_flag')copyMat(r,{cull:gfx.CullMode.NONE});
  else if(n.name==='rm_reeds')copyMat(r,{cull:gfx.CullMode.NONE});
  else if(n.name==='wake_strips')wakeMat=copyMat(r,{cull:gfx.CullMode.NONE,blend:true});
  else if(n.name==='hull_foam_ring')foamMat=copyMat(r,{cull:gfx.CullMode.NONE,blend:true});
  else if(n.name==='foam_strip_a'||n.name==='foam_strip_b'||n.name==='foam_ring'||n.name.startsWith('foam_ring'))copyMat(r,{cull:gfx.CullMode.NONE,alphaTest:0.4});
  else if(n.name==='sea_plane'){
   seaMat=copyMat(r,{cull:gfx.CullMode.NONE});
   const tex=seaMat?.getProperty('mainTexture') as Texture2D|null;
   if(tex)tex.setWrapMode(Texture2D.WrapMode.REPEAT,Texture2D.WrapMode.REPEAT);
  }else{
   const tex=r.getSharedMaterial(0)?.getProperty('mainTexture') as Texture2D|null;
   nearestPalette(tex);
   if(/^cloud_/.test(n.name)||n.name==='night_stars')copyMat(r,{cull:gfx.CullMode.NONE,vertex:true});
   else if(n.name.startsWith('far_'))copyMat(r,{cull:gfx.CullMode.NONE});
  }
 });
 const hidden:MeshRenderer[]=[];
 const scene=director.getScene();
 if(scene)walk(scene,n=>{if(ISLAND_SEA.includes(n.name))for(const r of n.getComponents(MeshRenderer))if(r.enabled){r.enabled=false;hidden.push(r);}});
 const dome=scene?findNode(scene,'env_sky_dome'):null;
 const cloudLayer=scene?findNode(scene,'env_cloud_layer'):null;
 const domeHome=dome?[dome.worldPosition.x,dome.worldPosition.y,dome.worldPosition.z]:null;
 const layerHome=cloudLayer?[cloudLayer.worldPosition.x,cloudLayer.worldPosition.y,cloudLayer.worldPosition.z]:null;
 const matOf=(n:Node|null):Material|null=>{try{return n?.getComponent(MeshRenderer)?.getMaterialInstance(0)??null;}catch{return null;}};
 const domeMat=matOf(dome),layerMat=matOf(cloudLayer);
 let lampLight:PointLight|null=null;
 if(lamp){
  lampLight=lamp.getComponent(PointLight)||lamp.addComponent(PointLight);
  lampLight.color=new Color(255,186,96,255);
  lampLight.range=5;
  lampLight.luminance=50;
 }
 let time=0,cruise=4.4;
 const paint=(mat:Material|null,a:number)=>{if(!mat)return;mat.setProperty('mainColor',new Color(255,255,255,Math.round(255*Math.max(0,Math.min(1,a)))));};
 return {
  boat,seat,stand,board,sail:sailRoot,
  sync(v,cam,dt,night){
   time+=Math.max(0,dt);
   const open=v.sail;
   if(sailRoot)sailRoot.active=open>0.18;
   if(jib)jib.active=open>0.18;
   if(furled)furled.active=open<=0.18;
   if(boom)boom.setRotationFromEuler(0,25*(1-open),0);
   if(sailRoot&&open>0.18)sailRoot.setScale(1,Math.max(0.15,open),1);
   if(jib&&open>0.18)jib.setScale(1,Math.max(0.15,open),1);
   if(lamp)lamp.active=night;
   if(lampLight)lampLight.enabled=night;
   if(stars)stars.active=night;
   if(domeMat)domeMat.setProperty('mainColor',night?new Vec4(0.55,0.68,0.86,1):new Vec4(1,1,1,1));
   if(layerMat)layerMat.setProperty('mainColor',night?new Vec4(0.62,0.72,0.88,1):new Vec4(1,1,1,1));
   if(seaMat)seaMat.setProperty('mainColor',night?new Color(170,205,225,255):new Color(255,255,255,255));
   const alpha=cruise>0?Math.min(1,v.speed/cruise)*0.42:0;
   paint(wakeMat,alpha);paint(foamMat,alpha*0.85);
   if(plane)plane.setWorldPosition(cam[0],SAIL_SEA_Y,cam[2]);
   seaOff.z=cam[0]/13+time*0.018;seaOff.w=cam[2]/13+time*0.011;
   if(seaMat)seaMat.setProperty('tilingOffset',seaOff);
   if(dome&&dome.active)dome.setWorldPosition(cam[0],domeHome?domeHome[1]:dome.worldPosition.y,cam[2]);
   if(cloudLayer&&cloudLayer.active)cloudLayer.setWorldPosition(cam[0],layerHome?layerHome[1]:cloudLayer.worldPosition.y,cam[2]);
  },
  dispose(){
   for(const r of hidden)if(r.isValid)r.enabled=true;
   if(dome?.isValid&&domeHome)dome.setWorldPosition(domeHome[0],domeHome[1],domeHome[2]);
   if(cloudLayer?.isValid&&layerHome)cloudLayer.setWorldPosition(layerHome[0],layerHome[1],layerHome[2]);
   if(domeMat)domeMat.setProperty('mainColor',new Vec4(1,1,1,1));
   if(layerMat)layerMat.setProperty('mainColor',new Vec4(1,1,1,1));
   if(root.isValid)root.destroy();
  },
 };
}
