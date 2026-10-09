import { Node, Label, Color, UITransform, Layers, Graphics } from 'cc';
/** Fixed-index mechanism footer; reserve space below art, never change rules or tile identity. */
export function paintRegionalOverlay(snapshot:any,cells:Node[]):void {
 const pieces=snapshot.active?.regionPieces||[],region=snapshot.active?.region,current=pieces.find((p:any)=>!p.done);
 for(let index=0;index<cells.length;index++){
  const cell=cells[index],size=cell.getComponent(UITransform)!.width,art=cell.getChildByName('ProjectPieceArt')!,p=pieces.find((p:any)=>p.index===index);
  art.setPosition(0,p?size*.13:0,0);art.getComponent(UITransform)!.setContentSize(size*(p ? .66 : .88),size*(p ? .66 : .88));
  let tag=cell.getChildByName('RegionalFixedCell');
  if(!tag){tag=new Node('RegionalFixedCell');tag.layer=Layers.Enum.UI_2D;cell.addChild(tag);tag.addComponent(UITransform);tag.addComponent(Graphics);const text=new Node('MechanismText');text.layer=Layers.Enum.UI_2D;tag.addChild(text);text.addComponent(UITransform);const l=text.addComponent(Label);l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.color=new Color('#243b43');}
  tag.active=!!p;if(!p)continue;
  const h=size*.27,w=size*.92;tag.setPosition(0,-size*.33,0);tag.getComponent(UITransform)!.setContentSize(w,h);const g=tag.getComponent(Graphics)!;g.clear();g.fillColor=new Color('#eff5e5');g.roundRect(-w/2,-h/2,w,h,3);g.fill();
  const text=tag.getChildByName('MechanismText')!,l=text.getComponent(Label)!;text.getComponent(UITransform)!.setContentSize(w,h);l.fontSize=Math.min(8,size*.15);l.lineHeight=h/2;l.color=new Color(region==='sky'&&p!==current?'#64736b':'#243b43');
  if(region==='tide')l.string=p.done?'珠 ✓':p.progress>=p.layers?'开壳\n待潮':`壳 ${p.progress}/${p.layers}`;
  if(region==='meadow')l.string=p.done?'花 ✓':`粉 ${p.progress}/${p.pollen?.length||0}\n→${p.pollen?.[p.progress]??'✓'}`;
  if(region==='sky')l.string=p.done?'光 ✓':`${p===current?'▶':'待'} ${p.progress}/${p.hits}\n色${p.type}${p.polarity}↔${p.partner}`;
 }
}
