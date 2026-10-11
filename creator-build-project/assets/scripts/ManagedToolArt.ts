import { _decorator, Component, SpriteFrame, Texture2D, ImageAsset, Rect, resources, isValid } from 'cc';
const {ccclass}=_decorator;
/** Original Canvas art exported without redesign. This component owns only its atlas refs. */
@ccclass('ManagedToolArt')
export class ManagedToolArt extends Component {
  private frames=new Map<string,SpriteFrame>();private texture:Texture2D|null=null;private image:ImageAsset|null=null;private epoch=0;private started=false;
  private release(frames:SpriteFrame[],texture:Texture2D|null,image:ImageAsset|null){
    for(const frame of frames)try{frame.destroy();}catch(error){console.error('Tool frame cleanup failed',error);}
    try{texture?.destroy();}catch(error){console.error('Tool texture cleanup failed',error);}
    try{image?.decRef();}catch(error){console.error('Tool image cleanup failed',error);}
  }
  initialize(refresh:()=>void){
    if(this.started)throw Error('Tool art can only initialize once');this.started=true;
    const epoch=++this.epoch;let settled=false;
    resources.load('ui/tools-original',ImageAsset,(error,asset)=>{
      if(settled||epoch!==this.epoch||!isValid(this,true)||!isValid(this.node,true))return;settled=true;
      if(error||!asset){console.error('Original tool atlas failed',error);return;}
      const candidates:SpriteFrame[]=[];let texture:Texture2D|null=null,image:ImageAsset|null=null;
      try{
        asset.addRef();image=asset;texture=new Texture2D();texture.image=asset;
        for(let i=0;i<7;i++){const frame=new SpriteFrame();candidates.push(frame);frame.texture=texture;frame.rect=new Rect(i*128,0,128,128);}
      }catch(error){this.release(candidates,texture,image);console.error('Original tool atlas preparation failed',error);return;}
      this.image=image;this.texture=texture;
      ['bomb','windBell','tideBottle','pearl','tideNet','sunSeed','starShears'].forEach((kind,i)=>this.frames.set(kind,candidates[i]));
      refresh();
    });
  }
  frame(kind:string){return this.frames.get(kind)||null;}
  onDestroy(){this.epoch++;const frames=Array.from(this.frames.values()),texture=this.texture,image=this.image;this.frames.clear();this.texture=null;this.image=null;this.release(frames,texture,image);}
}
