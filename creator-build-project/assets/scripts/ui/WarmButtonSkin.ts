import { Camera, Color, director, Director, EffectAsset, isValid, Material, Mesh, MeshRenderer, Node, Rect, RenderTexture, resources, Size, Sprite, SpriteFrame, UITransform, utils } from 'cc';
import { warmButtonPairGeometry } from './WarmButtonGeometry';

const LAYER=1<<18;
const MAX_BYTES=8*1024*1024;
type Frames=[SpriteFrame,SpriteFrame];
type Entry={key:string,width:number,height:number,ivory:boolean,refs:number,texture:RenderTexture|null,frames:Frames|null,bytes:number,clients:Set<(f:Frames)=>void>};
const caches=new WeakMap<Node,SkinCache>();

/** One serial offscreen baker per scene, one paired RT per shared style. No update loop. */
class SkinCache {
  private entries=new Map<string,Entry>();private queue:Entry[]=[];private current:Entry|null=null;
  private rig:Node|null=null;private camera:Camera|null=null;private renderer:MeshRenderer|null=null;
  private mesh:Mesh|null=null;private material:Material|null=null;private effect:EffectAsset|null=null;
  private loading=false;private dead=false;private refs=0;private bytes=0;
  constructor(private scene:Node){}
  acquire(width:number,height:number,ivory:boolean,ready:(f:Frames)=>void){
    const key=`${width}:${height}:${ivory?1:0}`;let e=this.entries.get(key);
    if(!e){e={key,width,height,ivory,refs:0,texture:null,frames:null,bytes:0,clients:new Set()};this.entries.set(key,e);this.queue.push(e);}
    e.refs++;this.refs++;e.clients.add(ready);if(e.frames)ready(e.frames);else this.load();
    let released=false;return ()=>{if(released)return;released=true;e!.clients.delete(ready);e!.refs--;this.refs--;
      if(!this.refs)this.dispose();else if(!e!.refs&&this.current!==e){this.queue=this.queue.filter(v=>v!==e);this.drop(e!);}
    };
  }
  private load(){
    if(this.dead||this.loading)return;if(this.effect){this.pump();return;}
    this.loading=true;
    resources.load('ui/warm-button-lit',EffectAsset,(error,effect)=>{
      this.loading=false;if(this.dead||!isValid(this.scene,true))return;
      if(error||!effect){console.warn('[WarmButton] 3D material unavailable; neutral emergency surface retained.',error);return;}
      this.effect=effect;effect.addRef();this.pump();
    });
  }
  private isolated(){
    // Verified scene source masks exclude bit18; check again at runtime without mutating them.
    return this.scene.getComponentsInChildren(Camera).every(c=>c===this.camera||(c.visibility&LAYER)===0);
  }
  private ensureRig(){
    if(this.rig)return;
    if(!this.isolated())throw Error('Button offscreen layer 18 is visible to an existing camera');
    this.rig=new Node('WarmButtonOffscreenBake');this.rig.layer=LAYER;this.scene.addChild(this.rig);this.rig.setPosition(10000,10000,10000);
    const cameraNode=new Node('WarmButtonBakeCamera');cameraNode.layer=LAYER;this.rig.addChild(cameraNode);cameraNode.setPosition(0,0,1000);
    this.camera=cameraNode.addComponent(Camera);this.camera.enabled=false;this.camera.projection=Camera.ProjectionType.ORTHO;
    this.camera.visibility=LAYER;this.camera.priority=10;this.camera.near=.1;this.camera.far=2000;
    this.camera.usePostProcess=false;this.camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;this.camera.clearColor=new Color(0,0,0,0);
    const model=new Node('WarmButtonPairedSolids');model.layer=LAYER;this.rig.addChild(model);this.renderer=model.addComponent(MeshRenderer);
    this.material=new Material();this.material.initialize({effectAsset:this.effect!});if(!this.material.passes.length)throw Error('Button material has no compiled passes');this.renderer.setSharedMaterial(this.material,0);
  }
  private pump(){
    if(this.dead||this.current||!this.effect)return;
    let e:Entry|undefined;while((e=this.queue.shift())&&!e.refs)this.drop(e);if(!e)return;
    this.current=e;
    try{
      this.ensureRig();if(!this.isolated())throw Error('Button offscreen layer became visible to another camera');
      // 2x resolution, side-by-side states; clamp to documented mobile-safe RT dimensions.
      const scale=Math.min(2,1024/(e.width*2),512/e.height),w=Math.max(1,Math.ceil(e.width*scale)),h=Math.max(1,Math.ceil(e.height*scale));
      const bytes=w*2*h*8; // RGBA8 + depth/stencil, conservatively 8 bytes/pixel.
      if(this.bytes+bytes>MAX_BYTES)throw Error('Button skin cache exceeded its 8 MiB GPU budget');
      e.texture=new RenderTexture();e.texture.reset({name:'WarmButton:'+e.key,width:w*2,height:h});e.bytes=bytes;this.bytes+=bytes;
      this.mesh=utils.createMesh(warmButtonPairGeometry(e.width,e.height,e.ivory),undefined,{calculateBounds:true});this.renderer!.mesh=this.mesh;
      this.camera!.orthoHeight=e.height/2;this.camera!.targetTexture=e.texture;
      this.camera!.enabled=true;
      director.once(Director.EVENT_AFTER_DRAW,this.finish,this);
    }catch(error){console.warn('[WarmButton] 3D bake failed; neutral emergency surface retained.',error);this.stopDraw();this.drop(e);this.current=null;this.pump();}
  }
  private finish(){
    const e=this.current;if(this.dead||!e)return;
    this.stopDraw();this.current=null;
    if(e.refs&&isValid(this.scene,true)&&e.texture){
      try{
        const w=e.texture.width/2,h=e.texture.height;
        // One bounded GPU readback per style, never per press/frame. A shader that failed
        // silently must not clear the still-clickable fallback and leave an invisible button.
        const row=e.texture.readPixels(0,Math.floor(h/2),w*2,1);
        if(!row||row.length<w*2*4||row[Math.floor(w/2)*4+3]<250||row[Math.floor(w*1.5)*4+3]<250)throw Error('Button RT did not produce both opaque faces');
        const frames=[] as SpriteFrame[];
        // Assign early so partially failed frame allocation is also owned and released.
        e.frames=frames as Frames;
        for(let i=0;i<2;i++){
          const f=new SpriteFrame();frames.push(f);f.reset({texture:e.texture,rect:new Rect(i*w,0,w,h),originalSize:new Size(w,h)});f.packable=false;
        }
        // Creator's loose spread lowering treats Set as one concat element. Snapshot explicitly.
        const readyClients:Array<(f:Frames)=>void>=[];e.clients.forEach(ready=>readyClients.push(ready));
        for(let i=0;i<readyClients.length;i++){const ready=readyClients[i];ready(e.frames);}
      }catch(error){console.warn('[WarmButton] Frame creation failed.',error);this.drop(e);}
    }else this.drop(e);
    this.pump();
  }
  private stopDraw(){
    director.off(Director.EVENT_AFTER_DRAW,this.finish,this);
    if(isValid(this.camera,true)){this.camera.enabled=false;this.camera.targetTexture=null;}
    if(isValid(this.renderer,true))this.renderer.mesh=null;this.mesh?.destroy();this.mesh=null;
  }
  private drop(e:Entry){
    for(const f of e.frames||[])f.destroy();e.frames=null;e.texture?.destroy();e.texture=null;
    this.bytes-=e.bytes;e.bytes=0;if(this.entries.get(e.key)===e)this.entries.delete(e.key);
  }
  private dispose(){
    if(this.dead)return;this.dead=true;this.stopDraw();this.current=null;this.queue=[];
    // Keep a deletion-safe snapshot without spreading a Map iterator in the WeChat build.
    const entries:Entry[]=[];this.entries.forEach(e=>entries.push(e));
    for(let i=0;i<entries.length;i++)this.drop(entries[i]);
    if(isValid(this.rig,true))this.rig.destroy();this.rig=null;this.camera=null;this.renderer=null;
    this.material?.destroy();this.material=null;this.effect?.decRef();this.effect=null;caches.delete(this.scene);
  }
}

/** Visual lease only. Does not own hit testing, input listeners, labels, audio or gameplay. */
export class WarmButtonSkin {
  private node:Node;private sprite:Sprite;private release:(()=>void)|null=null;
  private frames:Frames|null=null;private key='';private generation=0;private pressed=false;private dead=false;
  constructor(parent:Node){
    this.node=new Node('WarmButton3DSurface');this.node.layer=parent.layer;parent.addChild(this.node);this.node.setSiblingIndex(0);
    this.node.addComponent(UITransform);this.sprite=this.node.addComponent(Sprite);this.sprite.sizeMode=Sprite.SizeMode.CUSTOM;
  }
  configure(width:number,height:number,ivory:boolean,ready:()=>void){
    if(this.dead||!isValid(this.node,true))return;
    const key=`${width}:${height}:${ivory?1:0}`;if(key===this.key){if(this.frames)ready();return;}
    this.key=key;const generation=++this.generation;this.sprite.spriteFrame=null;this.frames=null;this.release?.();this.release=null;
    this.node.getComponent(UITransform)!.setContentSize(width,height);
    const scene=director.getScene();if(!scene){this.key='';return;}
    let cache=caches.get(scene);if(!cache){cache=new SkinCache(scene);caches.set(scene,cache);}
    this.release=cache.acquire(width,height,ivory,frames=>{
      if(this.dead||generation!==this.generation||!isValid(this.node,true))return;
      this.frames=frames;this.setPressed(this.pressed);ready();
    });
  }
  setPressed(value:boolean){this.pressed=value;if(this.frames&&isValid(this.sprite,true))this.sprite.spriteFrame=this.frames[value?1:0];}
  destroy(){if(this.dead)return;this.dead=true;this.generation++;if(isValid(this.sprite,true))this.sprite.spriteFrame=null;this.frames=null;this.release?.();this.release=null;if(isValid(this.node,true))this.node.destroy();}
}
