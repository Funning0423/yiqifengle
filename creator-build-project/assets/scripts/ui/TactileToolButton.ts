import { _decorator, Component, Node, UITransform, Graphics, Sprite, SpriteFrame, Texture2D, ImageAsset, Rect, Size, Color, isValid } from 'cc';
import { WarmButton } from '../WarmButton';
/** Small local skin for board tools. Hit testing, pointer ownership, successful activation,
 * hide/cancel and tool semantics stay entirely in the existing WarmButton / board. */
export function paintToolMaterial(c:any,part:'base'|'cap'):void {
 c.save();c.translate(32,32);const ellipse=(x:number,y:number,rx:number,ry:number,fill:any)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();};
 if(part==='base'){
  ellipse(0,7,23,20,'#163e3642');ellipse(0,4,23,21.3,'#3c4430');
  const wood=c.createLinearGradient(-20,-17,18,28);wood.addColorStop(0,'#b29b66');wood.addColorStop(.4,'#907648');wood.addColorStop(.7,'#726039');wood.addColorStop(1,'#4d4930');ellipse(0,2.3,23,21.8,wood);
  c.save();c.beginPath();c.ellipse(0,2.3,22.4,21.2,0,0,Math.PI*2);c.clip();
  for(let i=0;i<7;i++){c.strokeStyle=i%2?'#d5bb7b52':'#413f2c55';c.lineWidth=.6;c.beginPath();c.moveTo(-27,6+i*3);c.bezierCurveTo(-9,2+i*3,8,10+i*2.1,26,4+i*3);c.stroke();}c.restore();
  c.strokeStyle='#d6bd7c';c.lineWidth=.7;c.beginPath();c.ellipse(0,2,22.1,20.7,0,.1,2.9);c.stroke();
 }else{
  let metal=c.createLinearGradient(-22,-23,19,22);metal.addColorStop(0,'#fff1bc');metal.addColorStop(.19,'#d9bb77');metal.addColorStop(.45,'#a98b4d');metal.addColorStop(.67,'#ddc18a');metal.addColorStop(1,'#756641');ellipse(0,0,23,21.6,metal);
  c.strokeStyle='#5c5c3a';c.lineWidth=.7;c.beginPath();c.ellipse(0,0,22.8,21.4,0,0,7);c.stroke();
  const ivory=c.createRadialGradient(-7,-10,2,1,2,26);ivory.addColorStop(0,'#fffbe7');ivory.addColorStop(.45,'#eee7c8');ivory.addColorStop(.8,'#d0d2ad');ivory.addColorStop(1,'#a6b28d');ellipse(0,-.8,20.2,18.8,ivory);
  // Fine deterministic fibre and brass speckle, baked once rather than animated noise.
  c.save();c.beginPath();c.ellipse(0,-.8,20,18.6,0,0,7);c.clip();
  for(let i=0;i<30;i++){const x=((i*37)%41)-20,y=((i*17)%37)-19;c.strokeStyle=i%3?'#b0ae7922':'#fffef633';c.lineWidth=.45;c.beginPath();c.moveTo(x,y);c.lineTo(x+2.4,y-.4);c.stroke();}c.restore();
  c.strokeStyle='#fffced';c.lineWidth=1.1;c.beginPath();c.ellipse(0,-.8,19.4,18.2,0,-2.8,-.6);c.stroke();c.strokeStyle='#7c8b6366';c.lineWidth=.8;c.beginPath();c.ellipse(0,-.4,19.4,18.2,0,.3,2.6);c.stroke();
  for(let i=0;i<16;i++){const a=i*Math.PI/8,x=Math.cos(a)*21.7,y=Math.sin(a)*20.1;c.fillStyle=i%2?'#fff0bc55':'#7b673944';c.fillRect(x,y,.55,.7);}
 }
 c.restore();
}
type Atlas={image:ImageAsset;texture:Texture2D;frames:SpriteFrame[];refs:number};let cache:Atlas|null=null;
function acquire():Atlas {
 if(cache){cache.refs++;return cache;}
 const wx=(globalThis as any).wx,canvas:any=wx?.createCanvas?wx.createCanvas():wx?.createOffscreenCanvas?wx.createOffscreenCanvas({type:'2d',width:256,height:128}):typeof document!=='undefined'?document.createElement('canvas'):null;
 if(!canvas)throw Error('Tool material Canvas unavailable');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');if(!c)throw Error('Tool material 2D context unavailable');
 if(!c.ellipse)c.ellipse=function(x:number,y:number,rx:number,ry:number,a:number,start:number,end:number){this.save();this.translate(x,y);this.rotate(a);this.scale(rx,ry);this.arc(0,0,1,start,end);this.restore();};
 let image:ImageAsset|null=null,texture:Texture2D|null=null;const frames:SpriteFrame[]=[];
 try{for(const [i,part] of ['base','cap'].entries()){c.save();c.translate(i*128,0);c.scale(2,2);paintToolMaterial(c,part as 'base'|'cap');c.restore();}image=new ImageAsset({_data:c.getImageData(0,0,256,128).data,_compressed:false,width:256,height:128,format:Texture2D.PixelFormat.RGBA8888});texture=new Texture2D();texture.image=image;for(let i=0;i<2;i++){const f=new SpriteFrame();frames.push(f);f.packable=false;f.texture=texture;f.rect=new Rect(i*128,0,128,128);f.originalSize=new Size(128,128);}return cache={image,texture,frames,refs:1};}
 catch(error){for(const f of frames)f.destroy();texture?.destroy();image?.destroy();throw error;}finally{canvas.width=1;canvas.height=1;}
}
const {ccclass}=_decorator;
@ccclass('TactileToolButton')
export class TactileToolButton extends Component {
 private owned:Atlas|null=null;private face:Node|null=null;private ink:Graphics|null=null;
 initialize():Graphics {
  if(this.ink){this.ink.clear();return this.ink;}
  const surface=this.node.getComponent(WarmButton)||this.node.addComponent(WarmButton),make=(name:string)=>{const n=new Node(name);n.layer=this.node.layer;this.node.addChild(n);n.addComponent(UITransform).setContentSize(64,64);return n;};
  const base=make('ToolWoodBase'),face=make('ToolIvoryCap');this.face=face;
  try{this.owned=acquire();[base,face].forEach((n,i)=>{const s=n.addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;s.spriteFrame=this.owned!.frames[i];s.color=new Color('#ffffff');});}
  catch(error){const g=base.addComponent(Graphics);g.fillColor=new Color('#655539');g.ellipse(0,-4,23,22);g.fill();const cap=face.addComponent(Graphics);cap.fillColor=new Color('#e8dfba');cap.ellipse(0,0,22,21);cap.fill();cap.strokeColor=new Color('#c8a66a');cap.lineWidth=2;cap.ellipse(0,0,22,21);cap.stroke();console.warn('[TactileToolButton] Material bake unavailable; circular fallback retained.',error);}
  surface.addContent(face);const ink=make('ToolEmbossedIcon');this.ink=ink.addComponent(Graphics);surface.addContent(ink);return this.ink;
 }
 onDestroy(){const a=this.owned;this.owned=null;if(a&&--a.refs===0){for(const f of a.frames)f.destroy();a.texture.destroy();a.image.destroy();if(cache===a)cache=null;}this.face=null;this.ink=null;}
}
export function tactileToolButton(node:Node):WarmButton {const skin=node.getComponent(TactileToolButton)||node.addComponent(TactileToolButton);skin.initialize();return node.getComponent(WarmButton)!;}
export function tactileToolGraphics(node:Node):Graphics {const skin=node.getComponent(TactileToolButton)||node.addComponent(TactileToolButton);return skin.initialize();}
