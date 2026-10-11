import { Node, UITransform, Sprite, SpriteFrame, Texture2D, ImageAsset, isValid } from 'cc';
import { OriginalResultChestPainter } from './OriginalResultChestPainter';

/** Bounded result-only rendering contract. Never controls eligibility, grants, storage or world cameras.
 * A future verified model-3d adapter owns its isolated scene/camera/render target inside this lease.
 * Its pixels must remain within the 112x112 surface; dispose must release every owned resource.
 */
export interface ResultChestLease {
  setOpen(open:number):void;
  setVisible(visible:boolean):void;
  dispose():void;
  tick?(dt:number):void;
  diagnostics?():any;
}
export interface ResultChestResource {
  readonly id:string;
  readonly kind:'painted-2d'|'model-3d';
  readonly source:string;
  create(host:Node):ResultChestLease;
}
export const RESULT_CHEST_SIZE=112;

/** Prefer the offscreen factory; never resize the engine's own on-screen canvas. */
export function createChestCanvas(width:number,height:number):any {
  const wx=(globalThis as any).wx;let canvas:any;
  if(wx?.createOffscreenCanvas)canvas=wx.createOffscreenCanvas({type:'2d',width,height});
  else if(wx?.createCanvas)canvas=wx.createCanvas();
  else if(typeof document!=='undefined')canvas=document.createElement('canvas');
  else throw Error('No supported 2D canvas for the original result chest');
  canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
  if(!c)throw Error('Result chest requires a 2D canvas context');
  if(!c.ellipse)c.ellipse=function(x:number,y:number,rx:number,ry:number,a:number,start:number,end:number){this.save();this.translate(x,y);this.rotate(a);this.scale(rx,ry);this.arc(0,0,1,start,end);this.restore();};
  return canvas;
}

export const ORIGINAL_RESULT_CHEST_RESOURCE:ResultChestResource={
  id:'common-r2-original-painted-chest',kind:'painted-2d',
  source:'CommonR2/fixed/shared/treasure.js@132077f104e8c5c965f00ee42278cdb4a6aa96cd7f14a93efb1cb4d6e62645a6',
  create(host:Node):ResultChestLease {
    let surface:Node|null=null,canvas:any=null,painter:any=null,image:ImageAsset|null=null,texture:Texture2D|null=null,frame:SpriteFrame|null=null;
    let disposed=false,lastOpen=-1;
    const dispose=()=>{
      if(disposed)return;disposed=true;
      if(surface&&isValid(surface,true)){const sprite=surface.getComponent(Sprite);if(sprite)sprite.spriteFrame=null;surface.removeFromParent();surface.destroy();}surface=null;
      frame?.destroy();frame=null;texture?.destroy();texture=null;image?.destroy();image=null;
      painter?.dispose();painter=null;if(canvas){canvas.width=1;canvas.height=1;canvas=null;}
    };
    try {
      canvas=createChestCanvas(256,256);painter=new OriginalResultChestPainter({createCanvas:createChestCanvas});
      surface=new Node('OriginalPaintedChest');surface.layer=host.layer;host.addChild(surface);
      surface.addComponent(UITransform).setContentSize(RESULT_CHEST_SIZE,RESULT_CHEST_SIZE);
      const sprite=surface.addComponent(Sprite);sprite.sizeMode=Sprite.SizeMode.CUSTOM;
      return {
        setOpen(value:number){
          if(disposed||!surface||!isValid(surface,true))return;
          const open=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;if(open===lastOpen)return;
          const c=canvas.getContext('2d');c.clearRect(0,0,256,256);c.save();
          // State-aware, uniform framing fills the limited result slot without stretching the original art.
          // The chest itself stays in view; only peripheral glow/foliage is cropped by the UI surface.
          const extent=96+20*open,left=(128-extent)/2,top=18*(1-open);
          try{c.scale(256/extent,256/extent);c.translate(-left,-top);painter.drawChest(c,64,64,128,{open,timeMs:720,glow:false});}finally{c.restore();}
          let nextImage:ImageAsset|null=null,nextTexture:Texture2D|null=null,nextFrame:SpriteFrame|null=null;
          try{
            nextImage=new ImageAsset({_data:c.getImageData(0,0,256,256).data,_compressed:false,width:256,height:256,format:Texture2D.PixelFormat.RGBA8888});
            nextTexture=new Texture2D();nextTexture.image=nextImage;nextFrame=new SpriteFrame();nextFrame.texture=nextTexture;
            sprite.spriteFrame=nextFrame;
          }catch(error){nextFrame?.destroy();nextTexture?.destroy();nextImage?.destroy();throw error;}
          const oldFrame=frame,oldTexture=texture,oldImage=image;frame=nextFrame;texture=nextTexture;image=nextImage;
          oldFrame?.destroy();oldTexture?.destroy();oldImage?.destroy();lastOpen=open;
        },
        setVisible(visible:boolean){if(!disposed&&surface&&isValid(surface,true))surface.active=visible;},
        dispose,
      };
    }catch(error){dispose();throw error;}
  },
};

/** The sole resource selection seam. Replace only after the real 3D asset and adapter pass review. */
export { RESULT_CHEST_3D_RESOURCE as RESULT_CHEST_RESOURCE } from './ResultChest3D';
