import { _decorator, Component, assetManager, AssetManager, ImageAsset, Texture2D, SpriteFrame, Sprite, Node, Layers, UITransform, Color, Rect, Size, Graphics, sys, isValid } from 'cc';
import { MAIN, createOceanSample, sampleOceanFrame, paintOceanBackdrop, paintOceanFish, paintOceanTail, paintOceanGull } from './OriginalLevelEnvironment';
import type { LevelBackgroundFactory, LevelBackgroundFrame } from './LevelBackground';
import type { Cancellation } from '../world-r1/WorldFlowCore';

const {ccclass}=_decorator;
/** Engine-owned update: disabled with its node, released with the background; no private timer/RAF. */
@ccclass('OriginalLevelBackgroundMotion')
class OriginalLevelBackgroundMotion extends Component {
  tick:((dt:number)=>void)|null=null;
  update(dt:number):void{this.tick?.(dt);}
  onDestroy():void{this.tick=null;}
}
/** Use the live island clock/override when present; otherwise the original localNight() rule. */
function currentNight():number {
  const mode=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;
  if(mode==='day'||mode==='night')return mode==='night'?1:0;
  const hour=new Date().getHours();return hour<6||hour>=18?1:0;
}
function currentReducedMotion():boolean {
  try{const value=sys.localStorage.getItem('forest-v33-reduced-motion');if(value==='true'||value==='1')return true;}catch{}
  try{return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}
}
/** Exact formal mainline mapping. R4/R5 are different catalogs and have no verified mapping in this handoff. */
export function originalMainlineLevel(provider:string,stageId:string):number|null {
  if(provider!=='mainline')return null;
  const match=/^mainline-(0[1-9]|1[0-2])$/.exec(stageId);
  if(!match)throw Error('Unknown original mainline background: '+stageId);
  return Number(match[1])-1;
}
export function createBackgroundCanvas(width:number,height:number):any {
  const wx=(globalThis as any).wx;let canvas:any;
  if(wx?.createCanvas)canvas=wx.createCanvas();
  else if(wx?.createOffscreenCanvas)canvas=wx.createOffscreenCanvas({type:'2d',width,height});
  else if(typeof document!=='undefined')canvas=document.createElement('canvas');
  else throw Error('No supported 2D canvas for original level background');
  canvas.width=width;canvas.height=height;
  const c=canvas.getContext('2d');if(!c)throw Error('Original background requires a 2D canvas context');
  // Older mini-game Canvas adapters omit ellipse; preserve the original geometry using the equivalent arc transform.
  if(!c.ellipse)c.ellipse=function(x:number,y:number,rx:number,ry:number,a:number,start:number,end:number){this.save();this.translate(x,y);this.rotate(a);this.scale(rx,ry);this.arc(0,0,1,start,end);this.restore();};
  return canvas;
}
function loadBundle(name:string,token:Cancellation):Promise<AssetManager.Bundle>{
  return token.wait(new Promise((resolve,reject)=>assetManager.loadBundle(name,(error,bundle)=>error||!bundle?reject(error||Error('Missing background bundle '+name)):resolve(bundle))));
}
function loadImage(bundle:AssetManager.Bundle,path:string,token:Cancellation,own:(asset:ImageAsset)=>void):Promise<ImageAsset>{
  return new Promise((resolve,reject)=>bundle.load(path,ImageAsset,(error,asset)=>{
    if(error||!asset){reject(error||Error('Missing original background image '+path));return;}
    try{token.check();const data:any=asset.data;if(!data?.width||!data?.height)throw Error('Background image is not Canvas-compatible: '+path);asset.addRef();own(asset);resolve(asset);}
    catch(error){reject(error);}
  }));
}
/** Uses the board's existing Canvas/camera, behind its HUD. No second UI camera, no world camera/layer mutations. */
export const createOriginalLevelBackground:LevelBackgroundFactory=async({parent,selection,token})=>{
  const level=originalMainlineLevel(selection.provider,selection.stageId);if(level===null)return null;
  const images:ImageAsset[]=[];let canvas:any=null,node:Node|null=null,texture:Texture2D|null=null,image:ImageAsset|null=null,frame:SpriteFrame|null=null;
  let disposed=false,visible=false,paused=true,lastKey='';let offCancel=()=>{};
  const family=String(MAIN[level][0]);
  type AtmosphereSprite={node:Node;sprite:Sprite;color:Color;alpha:number};
  let atmosphereImage:ImageAsset|null=null,atmosphereTexture:Texture2D|null=null;
  const atmosphereFrames:SpriteFrame[]=[];
  const oceanSample=createOceanSample(),oceanInput={width:390,height:0,waterTop:0,skyY:0,timeMs:0,nightBlend:0,reducedMotion:false};
  type FishSprite={root:Node;body:AtmosphereSprite;tail:AtmosphereSprite};
  const oceanFish:FishSprite[]=[];let leapFish:FishSprite|null=null,gull:AtmosphereSprite|null=null,waves:Graphics|null=null;
  let oceanDrawTime=-Infinity,oceanDrawNight=-1,waveBuilds=0,logicalWaterTop=0,logicalSkyY=0;
  let motionRoot:Node|null=null,clock:OriginalLevelBackgroundMotion|null=null,shade:AtmosphereSprite|null=null,moon:AtmosphereSprite|null=null;
  let logicalHeight=0,logicalBoardTop=0,boardTime=0,ticks=0,staticUploads=0;
  let reducedMotion=currentReducedMotion(),nightBlend=currentNight(),nightTarget=nightBlend,nightFrom=nightBlend,nightElapsed=1.1;
  let settingsElapsed=0,skipDelta=true;
  const refreshSettings=(snapNight=false)=>{
    reducedMotion=currentReducedMotion();const next=currentNight();
    if(next!==nightTarget){nightFrom=nightBlend;nightTarget=next;nightElapsed=0;}
    if(snapNight||reducedMotion){nightBlend=nightTarget;nightElapsed=1.1;}
  };
  // Graphics in Creator 3.8.8 uses model vertex colors and does not inherit UIOpacity.
  // Standard Sprite writes color.a through its assembler, without rebuilding a mesh/material/texture.
  const setAlpha=(item:AtmosphereSprite,value:number)=>{
    const alpha=Math.max(0,Math.min(255,Math.round(value*255)));
    if(item.alpha===alpha)return;item.alpha=alpha;item.color.a=alpha;item.sprite.color=item.color;
  };
  const presentMotion=()=>{
    if(!motionRoot)return;
    if(shade){shade.node.active=nightBlend>.001;setAlpha(shade,nightBlend*.42);}
    if(moon){moon.node.active=nightBlend>.001;setAlpha(moon,nightBlend);}
    if(waves){
      Object.assign(oceanInput,{height:logicalHeight,waterTop:logicalWaterTop,skyY:logicalSkyY,timeMs:boardTime,nightBlend,reducedMotion});sampleOceanFrame(oceanInput,oceanSample);
      const placeFish=(fish:FishSprite,pose:any,swimmer=false)=>{
        fish.root.active=pose.visible!==false&&oceanSample.waterHeight>0;if(!fish.root.active)return;
        fish.root.setPosition(pose.x,-pose.y,0);fish.root.angle=-(pose.angle||0)*180/Math.PI;
        fish.root.setScale((pose.direction||1)*pose.scale,swimmer?22/44:pose.scale,1);fish.tail.node.angle=-(pose.tailSwing||0)*180/Math.PI;
        const alpha=swimmer?pose.alpha:(pose.y>oceanSample.leap.surfaceY ? .36 : 1);setAlpha(fish.body,alpha);setAlpha(fish.tail,alpha);
      };
      for(let k=0;k<oceanFish.length;k++)placeFish(oceanFish[k],oceanSample.fish[k],true);
      if(leapFish)placeFish(leapFish,oceanSample.leap);
      if(gull){const bird=oceanSample.gull;gull.node.active=bird.visible;if(bird.visible){gull.node.setPosition(bird.x,-bird.y,0);gull.node.setScale(bird.scale,bird.scale,1);const phase=Math.max(0,Math.min(7,Math.round((bird.flap+7)/14*7)));gull.sprite.spriteFrame=atmosphereFrames[5+phase];setAlpha(gull,1-nightBlend*.16);}}
      // Five small 25-point strips at most 20Hz. No full-screen redraw or dynamic texture upload.
      if(oceanDrawTime<0||Math.abs(oceanSample.timeMs-oceanDrawTime)>=50||(nightBlend>.5)!==(oceanDrawNight>.5)){
        oceanDrawTime=oceanSample.timeMs;oceanDrawNight=nightBlend;waves.clear();waveBuilds++;
        for(let row=0;row<5;row++){const pts=oceanSample.waves[row];waves.fillColor=new Color(nightBlend>.5?'#367f9538':'#69d0cc38');waves.moveTo(pts[0].x,-pts[0].y);for(let k=1;k<pts.length;k++)waves.lineTo(pts[k].x,-pts[k].y);for(let k=pts.length-1;k>=0;k--)waves.lineTo(pts[k].x,-Math.min(logicalHeight,pts[k].y+7+row*2));waves.close();waves.fill();waves.strokeColor=new Color(nightBlend>.5?'#b0d5df38':'#edfff44f');waves.lineWidth=.8+row*.18;waves.moveTo(pts[0].x,-pts[0].y);for(let k=1;k<pts.length;k++)waves.lineTo(pts[k].x,-pts[k].y);waves.stroke();}
        const pose=oceanSample.leap;if(!reducedMotion&&pose.phase<2450)for(const event of [{at:pose.takeoffAt,x:pose.takeoffX},{at:pose.landingAt,x:pose.landingX}]){const age=pose.phase-event.at;if(age<0||age>720)continue;const q=age/720;waves.strokeColor=new Color(230,255,240,Math.round((1-q)*155));waves.lineWidth=1.2;for(let k=0;k<2;k++){waves.ellipse(event.x,-pose.surfaceY,7+q*24+k*5,2+q*5+k*1.3);waves.stroke();}}
      }
    }

  };
  const advance=(dt:number)=>{
    if(disposed||!visible||paused||!motionRoot||!Number.isFinite(dt)||dt<0)return;
    // Drop the first resumed delta and clamp subsequent stalls, as original boardTime did (50ms).
    const elapsed=skipDelta?0:Math.min(dt,.05);skipDelta=false;
    settingsElapsed+=elapsed;if(settingsElapsed>=.25){settingsElapsed=0;refreshSettings();}
    if(!reducedMotion)boardTime+=elapsed*1000;
    if(nightElapsed<1.1){nightElapsed=Math.min(1.1,nightElapsed+elapsed);const p=nightElapsed/1.1,e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;nightBlend=nightFrom+(nightTarget-nightFrom)*e;}
    presentMotion();ticks++;
  };
  const ensureAtmosphereFrames=()=>{
    if(atmosphereTexture)return;
    // 256x128 shared atlas (131,072 runtime bytes), generated once from original fish/gull primitives.
    // Transparent gutters prevent neighboring texels bleeding into the tiny ellipse or moon.
    const small=createBackgroundCanvas(256,128),c=small.getContext('2d');
    let nextImage:ImageAsset|null=null,nextTexture:Texture2D|null=null;const nextFrames:SpriteFrame[]=[];
    try{
      c.fillStyle='#ffffff';c.fillRect(0,0,8,8);c.beginPath();c.ellipse(34,18,16,16,0,0,Math.PI*2);c.fill();
      c.fillStyle='#eee8cc';c.beginPath();c.ellipse(32,72,24,24,0,0,Math.PI*2);c.fill();
      c.fillStyle='#c0ccbd66';c.beginPath();c.ellipse(24,66,4,3,0,0,Math.PI*2);c.fill();
      c.save();c.translate(80,0);paintOceanFish(c);c.restore();c.save();c.translate(160,0);paintOceanTail(c);c.restore();
      for(let k=0;k<8;k++){c.save();c.translate(100+(k%4)*40,80+Math.floor(k/4)*32);paintOceanGull(c,-7+k*2);c.restore();}
      nextImage=new ImageAsset({_data:c.getImageData(0,0,256,128).data,_compressed:false,width:256,height:128,format:Texture2D.PixelFormat.RGBA8888});
      nextTexture=new Texture2D();nextTexture.image=nextImage;
      for(const [x,y,w,h] of [[1,1,2,2],[16,0,36,36],[0,40,64,64],[80,0,76,44],[160,0,21,34],...Array.from({length:8},(_,k)=>[80+(k%4)*40,64+Math.floor(k/4)*32,40,32])]){
        // Memory-backed ImageAsset.data is not a TexImageSource for dynamic-atlas copyTexImagesToTexture.
        const f=new SpriteFrame();nextFrames.push(f);f.packable=false;f.texture=nextTexture;f.rect=new Rect(x,y,w,h);f.originalSize=new Size(w,h);
      }
      atmosphereImage=nextImage;atmosphereTexture=nextTexture;atmosphereFrames.push(...nextFrames);
    }catch(error){for(const f of nextFrames)f.destroy();nextTexture?.destroy();nextImage?.destroy();throw error;}
    finally{small.width=1;small.height=1;}
  };
  const motionSprite=(name:string,index:number,width:number,height:number,color:string):AtmosphereSprite=>{
    const n=new Node(name);n.layer=Layers.Enum.UI_2D;motionRoot!.addChild(n);n.addComponent(UITransform).setContentSize(width,height);
    const sprite=n.addComponent(Sprite);sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=atmosphereFrames[index];
    const tint=new Color(color);sprite.color=tint;return {node:n,sprite,color:tint,alpha:255};
  };
  const ensureMotion=()=>{
    if(motionRoot)return;ensureAtmosphereFrames();
    motionRoot=new Node('OriginalAtmosphere');motionRoot.layer=Layers.Enum.UI_2D;node!.addChild(motionRoot);motionRoot.addComponent(UITransform);
    shade=motionSprite('OriginalNightTint',0,390,logicalHeight,'#192c4b');
    moon=motionSprite('OriginalNightMoon',2,32,32,'#ffffff');moon.node.setPosition(272,-42,0);
    const water=new Node('OriginalOceanWaves');water.layer=Layers.Enum.UI_2D;motionRoot.addChild(water);water.addComponent(UITransform).setContentSize(390,logicalHeight);waves=water.addComponent(Graphics);
    const fishSprite=(name:string):FishSprite=>{const root=new Node(name);root.layer=Layers.Enum.UI_2D;motionRoot!.addChild(root);root.addComponent(UITransform).setContentSize(90,44);const body=motionSprite(name+'Body',3,76,44,'#ffffff'),tail=motionSprite(name+'Tail',4,21,34,'#ffffff');tail.node.setParent(root);body.node.setParent(root);tail.node.setPosition(-29.5,0,0);return {root,body,tail};};
    for(let k=0;k<3;k++)oceanFish.push(fishSprite('OriginalSwimmingFish-'+k));leapFish=fishSprite('OriginalLeapingFish');
    gull=motionSprite('OriginalFlyingGull',5,40,32,'#ffffff');
    clock=motionRoot.addComponent(OriginalLevelBackgroundMotion);clock.tick=advance;clock.enabled=visible&&!paused;
  };
  const dispose=()=>{
    if(disposed)return;disposed=true;offCancel();
    if(clock){clock.enabled=false;clock.tick=null;}clock=null;
    if(node&&isValid(node,true))node.destroy();node=null;motionRoot=null;shade=null;moon=null;oceanFish.length=0;leapFish=null;gull=null;waves=null;
    for(const f of atmosphereFrames)f.destroy();atmosphereFrames.length=0;atmosphereTexture?.destroy();atmosphereTexture=null;atmosphereImage?.destroy();atmosphereImage=null;
    frame?.destroy();frame=null;texture?.destroy();texture=null;image?.destroy();image=null;
    if(canvas){canvas.width=1;canvas.height=1;canvas=null;}
    for(const asset of images)asset.decRef();images.length=0;
  };
  offCancel=token.onCancel(dispose);
  const own=(asset:ImageAsset)=>{if(disposed){asset.decRef();throw Error('Background disposed during image load');}images.push(asset);};
  try{
    token.check();
    const foliage=await loadBundle('background_foliage',token);token.check();
    const cloud=await loadImage(foliage,'painted-cloud',token,own);token.check();

    return {
      frame:(_portrait:boolean,layout?:LevelBackgroundFrame)=>{
        if(disposed)return;token.check();if(!layout)throw Error('Original background requires actual board layout');
        const {width,height,boardTop}=layout;
        if(!(width>0&&height>0&&Number.isFinite(width)&&Number.isFinite(height)&&Number.isFinite(boardTop)))throw Error('Invalid original background layout');
        const canvasRoot=parent.getChildByName('NativeBoardCanvas');if(!canvasRoot)throw Error('Native board Canvas missing');
        const grid=canvasRoot.getChildByName('CenteredNativeGrid')?.getComponent(UITransform);if(!grid||!(grid.height>0))throw Error('Original ocean requires actual board grid size');
        const key=width+'/'+height+'/'+boardTop+'/'+grid.height;if(key===lastKey)return;
        if(!node){node=new Node('OriginalMainlineBackground');node.layer=Layers.Enum.UI_2D;canvasRoot.addChild(node);node.setSiblingIndex(0);node.addComponent(UITransform);node.addComponent(Sprite);node.active=visible;}
        // Match the source's 390-unit width without stretching x/y independently; cap generated surface pixels.
        const density=Math.min(1.5,width/390,Math.sqrt(1796000/(390*(height*390/width))));
        const pw=Math.max(1,Math.ceil(390*density)),ph=Math.max(1,Math.ceil(height*390/width*density));
        if(canvas){canvas.width=1;canvas.height=1;}canvas=createBackgroundCanvas(pw,ph);const ctx=canvas.getContext('2d'),nextLogicalHeight=height*390/width;ctx.scale(pw/390,ph/nextLogicalHeight);
        // Restore the reference sea/sky/cloud palette; no extra media assets or cached full-screen surface.
        paintOceanBackdrop(ctx,nextLogicalHeight,boardTop*390/width,cloud.data);
        token.check();
        // Static scenery uploads only on entry/size changes. Dynamic overlays share a prebuilt tiny Sprite atlas.
        let nextImage:ImageAsset|null=null,nextTexture:Texture2D|null=null,nextFrame:SpriteFrame|null=null;
        try{
          // Explicit IMemoryImageSource is supported by Creator 3.8.8. Avoid relying on wx OffscreenCanvas instanceof DOM types.
          const pixels=ctx.getImageData(0,0,pw,ph).data;
          nextImage=new ImageAsset({_data:pixels,_compressed:false,width:pw,height:ph,format:Texture2D.PixelFormat.RGBA8888});
          nextTexture=new Texture2D();nextTexture.image=nextImage;nextFrame=new SpriteFrame();nextFrame.texture=nextTexture;
          const sprite=node.getComponent(Sprite)!;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=nextFrame;node.getComponent(UITransform)!.setContentSize(width,height);
        }catch(error){nextFrame?.destroy();nextTexture?.destroy();nextImage?.destroy();throw error;}
        const oldFrame=frame,oldTexture=texture,oldImage=image;frame=nextFrame;texture=nextTexture;image=nextImage;oldFrame?.destroy();oldTexture?.destroy();oldImage?.destroy();staticUploads++;
        logicalHeight=nextLogicalHeight;logicalBoardTop=boardTop*390/width;
        logicalWaterTop=Math.min(logicalHeight-1,(boardTop+(_portrait?grid.height:0)+18)*390/width);logicalSkyY=Math.max(12,logicalBoardTop-44);oceanDrawTime=-Infinity;
        ensureMotion();motionRoot!.setPosition(-width/2,height/2,0);motionRoot!.setScale(width/390,width/390,1);
        motionRoot!.getComponent(UITransform)!.setContentSize(390,logicalHeight);waves!.node.getComponent(UITransform)!.setContentSize(390,logicalHeight);
        shade!.node.setPosition(195,-logicalHeight/2,0);shade!.node.getComponent(UITransform)!.setContentSize(390,logicalHeight);
        presentMotion();lastKey=key;
      },
      setVisible:(value:boolean)=>{if(disposed)return;visible=value;skipDelta=true;
        if(value){refreshSettings(paused);presentMotion();}
        if(node&&isValid(node,true))node.active=value;if(clock)clock.enabled=visible&&!paused;
      },
      setPaused:(value:boolean)=>{if(disposed||paused===value)return;paused=value;skipDelta=true;
        if(!value){refreshSettings();presentMotion();}if(clock)clock.enabled=visible&&!paused;
      },
      diagnostics:()=>({renderer:'original-ocean-visual-only+sprite-atlas',family,level:level+1,visible,paused,reducedMotion,boardTime,nightBlend,
        motionNodes:oceanFish.length+2,ticks,staticUploads,atmosphereAtlasPixels:atmosphereTexture?256*128:0,nightVertexAlpha:shade?.alpha??0,waveBuilds,waterTop:logicalWaterTop,skyY:logicalSkyY,fish:oceanSample.fish.map((f:any)=>({x:f.x,y:f.y})),gull:{...oceanSample.gull},leap:{...oceanSample.leap},dynamicTextureUploads:0,ownedPixels:canvas?canvas.width*canvas.height:0}),
      dispose,
    };
  }catch(error){dispose();throw error;}
};
