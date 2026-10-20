import {_decorator,Camera,Component,Director,Material,MeshRenderer,Node,Prefab,director,instantiate,isValid} from 'cc';
const {ccclass}=_decorator;
export const SKY_CLOUDSEA_HIDDEN=['env_sky_cloudsea','env_sky_cumulus_far'];
const seaOwners=new Set<SkycityCloudsea>();
const savedSeas=new Map<Node,boolean>();
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
    for(const r of this.node.getComponentsInChildren(MeshRenderer))for(const m of r.sharedMaterials)if(m?.name==='M_env_palette')palette=m;
    if(!palette)throw Error('skycity-shared-palette-missing');
    for(const r of this.soft.getComponentsInChildren(MeshRenderer)){r.setSharedMaterial(palette,0);r.shadowCastingMode=0;r.receiveShadow=0;}
    this.sync();
  }
  setFlightHidden(value:boolean){this.flightHidden=value;this.sync();}
  private restoreSea(){
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
