import { Node, Label, Color, UITransform, Layers } from 'cc';
/** View-only labels anchored to grid index, never tile.id. No events mutate rules/rewards. */
export function paintRegionalOverlay(snapshot:any,cells:Node[]):void {
  const pieces=snapshot.active?.regionPieces||[],region=snapshot.active?.region,current=pieces.find((p:any)=>!p.done);
  for(let index=0;index<cells.length;index++){
    let tag=cells[index].getChildByName('RegionalFixedCell');
    if(!tag){tag=new Node('RegionalFixedCell');tag.layer=Layers.Enum.UI_2D;cells[index].addChild(tag);tag.setPosition(0,18,0);tag.addComponent(UITransform).setContentSize(52,18);const l=tag.addComponent(Label);l.fontSize=9;l.lineHeight=11;l.color=new Color('#243b43');}
    const p=pieces.find((p:any)=>p.index===index);tag.active=!!p;
    if(!p)continue;
    let text='';
    if(region==='tide')text=p.done?'珠 ✓':p.progress>=p.layers?'开壳 待潮':`壳 ${p.progress}/${p.layers}`;
    if(region==='meadow')text=p.done?'花 ✓':`粉 ${p.progress}/${p.pollen?.length||0} →${p.pollen?.[p.progress]??'✓'}`;
    if(region==='sky')text=p.done?'光 ✓':`${p===current?'▶':'待'}锁 ${p.progress}/${p.hits} 色${p.type} 相${p.polarity} ↔${p.partner}`;
    tag.getComponent(Label)!.color=new Color(region==='sky'&&p!==current?'#78847f':'#243b43');
    tag.getComponent(Label)!.string=text;
  }
}
