import { Node, Label, Color, UITransform, Layers, Graphics, Sprite } from 'cc';
/** Presentation only: progress comes from the existing regional snapshot. Frames are borrowed from the board art.
 * Plain cells keep the board's 1.21-cell piece size; fixed regional cells shrink the piece above their tag. */
export function paintRegionalOverlay(snapshot:any,cells:Node[]):void {
 const pieces=snapshot.active?.regionPieces||[],region=snapshot.active?.region,current=pieces.find((p:any)=>!p.done),settled=['run.ready','run.paused'].includes(snapshot.state)?snapshot.active?.guide:null;
 for(let index=0;index<cells.length;index++){
  const cell=cells[index],size=cell.getComponent(UITransform)!.width,art=cell.getChildByName('ProjectPieceArt')!,p=pieces.find((p:any)=>p.index===index);
  if(p){art.setPosition(0,size*.13,0);art.getComponent(UITransform)!.setContentSize(size*.74,size*.74);}
  let tag=cell.getChildByName('RegionalFixedCell');
  if(!tag){tag=new Node('RegionalFixedCell');tag.layer=Layers.Enum.UI_2D;cell.addChild(tag);tag.addComponent(UITransform);tag.addComponent(Graphics);
   const text=new Node('MechanismText');text.layer=tag.layer;tag.addChild(text);text.addComponent(UITransform);const l=text.addComponent(Label);l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;
   const icon=new Node('RequiredPiece');icon.layer=tag.layer;tag.addChild(icon);icon.addComponent(UITransform);icon.addComponent(Sprite);
  }
  tag.active=!!p;if(!p)continue;
  const target=settled?.targets?.find((t:any)=>t.cell.index===index),height=Math.max(13,Math.min(19,size*.34)),width=size*.9,active=target?target.current:region!=='sky'||p===current;
  tag.setPosition(0,-size*.31,0);tag.getComponent(UITransform)!.setContentSize(width,height);const g=tag.getComponent(Graphics)!;g.clear();
  g.fillColor=new Color(p.done?'#b3d5b3':active?'#fff2c9':'#d4ddcd');g.roundRect(-width/2,-height/2,width,height,4);g.fill();g.strokeColor=new Color(active?'#c5913d':'#8eaa99');g.lineWidth=1;g.roundRect(-width/2,-height/2,width,height,4);g.stroke();
  const text=tag.getChildByName('MechanismText')!,l=text.getComponent(Label)!;l.fontSize=10;l.lineHeight=12;l.color=new Color('#244e44');l.overflow=Label.Overflow.SHRINK;
  const desired=target?target.requiredType:region==='sky'?p.type:region==='meadow'?p.pollen?.[p.progress]:undefined,icon=tag.getChildByName('RequiredPiece')!,sprite=icon.getComponent(Sprite)!;
  const source=Number.isInteger(desired)?cells.find((_,i)=>snapshot.active.board[i]?.type===desired)?.getChildByName('ProjectPieceArt')?.getComponent(Sprite):null;
  icon.active=!p.done&&!!source?.spriteFrame;icon.setPosition(-width/2+8,1,0);icon.getComponent(UITransform)!.setContentSize(14,14);sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=source?.spriteFrame||null;
  text.setPosition(icon.active?6:0,1,0);text.getComponent(UITransform)!.setContentSize(width-(icon.active?16:4),12);
  if(p.done)l.string='✓';
  else if(region==='tide')l.string=p.progress>=p.layers?'待潮':'开壳';
  else if(region==='meadow')l.string=icon.active?'→':'花粉';
  else l.string=`${active?'':'待'}${p.polarity===0?'○':'●'}`;
  // A segmented progress strip replaces fractional counters at 6–8px. Current relay
  // is gold, completed segments teal; selected relay/partner is connected on the board.
  const total=Math.max(1,Math.min(8,region==='tide'?p.layers:region==='meadow'?p.pollen?.length:p.hits)),step=(width-8)/total;
  for(let k=0;k<total;k++){g.fillColor=new Color(p.done||k<p.progress?'#3b8a73':'#d5c49c');g.roundRect(-width/2+4+k*step,-height/2+1,Math.max(1,step-2),2,1);g.fill();}
 }
}
