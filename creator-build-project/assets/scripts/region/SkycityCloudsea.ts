import {_decorator,Camera,Color,Component,Director,Material,MeshRenderer,Node,Prefab,director,instantiate,isValid} from 'cc';
const {ccclass}=_decorator;
export const SKY_CLOUDSEA_HIDDEN=['env_sky_cloudsea','env_sky_cumulus_far'];
const seaOwners=new Set<SkycityCloudsea>();
const savedSeas=new Map<Node,boolean>();
const dayOwners=new Set<SkycityCloudsea>();
const savedDayNodes=new Map<Node,boolean>();
const savedDayCameras=new Map<Camera,{flags:number;color:Color}>();
function find(n:Node,name:string):Node|null{if(n.name===name)return n;for(const c of n.children){const hit=find(c,name);if(hit)return hit;}return null;}
/** Owns a sibling, never a child of skycity_float_root. Follows the placed prefab and its lease. */
@ccclass('SkycityCloudsea')
export class SkycityCloudsea extends Component{
  private soft:Node|null=null;
  private prefab:Prefab|null=null;
  private flightHidden=false;
  mount(prefab:Prefab){
    this.prefab=prefab;prefab.addRef();this.soft=instantiate(prefab);this.soft.name='SkycityCloudseaSoft';
    this.node.parent!.addChild(this.soft);
    let palette:Material|null=null;
    // The base env_skycity GLB uses M_sky_palette; M_env_palette belongs to the soft GLB.
    for(const r of this.node.getComponentsInChildren(MeshRenderer))for(const m of r.sharedMaterials)if(m?.name==='M_sky_palette')palette=m;
    if(!palette)throw Error('skycity-shared-palette-missing');
    for(const r of this.soft.getComponentsInChildren(MeshRenderer)){r.setSharedMaterial(palette,0);r.shadowCastingMode=0;r.receiveShadow=0;}
    this.sync();
  }
  setFlightHidden(value:boolean){this.flightHidden=value;this.sync();}
  private restoreDay(){
    dayOwners.delete(this);
    if(dayOwners.size)return;
    for(const [n,active] of savedDayNodes)if(isValid(n,true))n.active=active;
    savedDayNodes.clear();
    for(const [camera,home] of savedDayCameras)if(isValid(camera,true)){camera.clearFlags=home.flags;camera.clearColor=home.color;}
    savedDayCameras.clear();
  }
  private syncDay(scene:Node){
    // The soft sea is shown only after landing (also used by normal visits and qaShot).
    // Leave the existing flight/night backdrop untouched.
    if((globalThis as any).__worldDayNight?.snapshot?.()?.mode==='night'){this.restoreDay();return;}
    dayOwners.add(this);
    const hide=(n:Node)=>{if(!savedDayNodes.has(n))savedDayNodes.set(n,n.active);n.active=false;};
    const walk=(n:Node,inRoom=false)=>{
      inRoom=inRoom||n.name==='room_no_original_chair';
      if(inRoom&&['env_sky_dome','env_cloud_layer','balloon_basket','balloon_envelope'].includes(n.name))hide(n);
      for(const c of n.children)walk(c,inRoom);
    };
    walk(scene);
    // The arriving balloon belongs to the journey rig, outside the old room.
    const vehicle=this.node.parent?.getChildByName('transport_balloon');if(vehicle)hide(vehicle);
    for(const n of savedDayNodes.keys())if(isValid(n,true))n.active=false;
    for(const camera of scene.getComponentsInChildren(Camera))if(camera.enabled&&(camera.visibility&this.node.layer)!==0){
      if(!savedDayCameras.has(camera))savedDayCameras.set(camera,{flags:camera.clearFlags,color:new Color(camera.clearColor.r,camera.clearColor.g,camera.clearColor.b,camera.clearColor.a)});
      camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=new Color(156,202,223,255);
    }
  }
  private restoreSea(){
    this.restoreDay();
    seaOwners.delete(this);
    if(!seaOwners.size){for(const [n,active] of savedSeas)if(isValid(n,true))n.active=active;savedSeas.clear();}
  }
  private sync=()=>{
    if(!this.soft||!isValid(this.soft,true))return;
    if(this.soft.parent!==this.node.parent)this.soft.setParent(this.node.parent);
    this.soft.setPosition(this.node.position);this.soft.setRotation(this.node.rotation);this.soft.setScale(this.node.scale);
    this.soft.active=this.node.activeInHierarchy&&!this.flightHidden;
    const layer=(n:Node)=>{n.layer=this.node.layer;for(const c of n.children)layer(c);};layer(this.soft);
    for(const name of SKY_CLOUDSEA_HIDDEN){const n=find(this.node,name);if(n)n.active=false;}
    if(!this.soft.active){this.restoreSea();return;}
    for(const name of ['env_sky_cloud_small','env_sky_islets_far']){const n=find(this.node,name);if(n)n.active=true;}
    const scene=director.getScene();
    if(scene){
      this.syncDay(scene);
      seaOwners.add(this);
      if(!savedSeas.size){const sea=find(scene,'env_sea_surface');if(sea)savedSeas.set(sea,sea.active);}
      for(const sea of savedSeas.keys())if(isValid(sea,true))sea.active=false;
      for(const camera of scene.getComponentsInChildren(Camera))if(camera.enabled&&(camera.visibility&this.node.layer)!==0)camera.far=Math.max(1200,camera.far);
    }
  };
  onEnable(){director.on(Director.EVENT_BEFORE_DRAW,this.sync);}
  onDisable(){director.off(Director.EVENT_BEFORE_DRAW,this.sync);if(this.soft&&isValid(this.soft,true))this.soft.active=false;this.restoreSea();}
  onDestroy(){if(this.soft&&isValid(this.soft,true))this.soft.destroy();this.prefab?.decRef();this.restoreSea();}
}
