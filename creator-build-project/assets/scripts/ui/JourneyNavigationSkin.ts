import { Node, Label, Color } from 'cc';
import { warmButtonGraphics } from '../WarmButton';

export type JourneyNavigationRole='primary'|'bag'|'journal'|'settings';
/** Visual-only skin based on the supplied original: one leaf-framed primary action and
 * three small illustrated utilities. No placement, hit-area, visibility or input changes.
 * For utility captions, the owner places its Label at y=-height/2+12 before addContent. */
export function applyJourneyNavigationSkin(node:Node,role:JourneyNavigationRole,width:number,height:number):void {
  const primary=role==='primary',g=warmButtonGraphics(node,width,height,!primary);
  for(const label of node.getComponentsInChildren(Label))label.color=new Color(primary?'#fff4d6':'#355f53');
  g.strokeColor=new Color(primary?'#b3c793':'#456b53');g.fillColor=new Color(primary?'#b3c793':'#6d9165');g.lineWidth=1.7;
  if(primary){
    for(const side of [-1,1]){const x=side*(width/2-18);g.moveTo(x-side*2,-11);g.lineTo(x+side*2,11);g.stroke();for(const k of [-1,0,1]){const y=k*7,dx=k%2?side*4:-side*3;g.moveTo(x,y-2);g.lineTo(x+dx,y+1);g.lineTo(x+dx,y+6);g.lineTo(x,y+3);g.close();g.fill();}}return;
  }
  const y=7;
  if(role==='bag'){
    g.roundRect(-12,y-13,24,24,5);g.fill();g.strokeColor=new Color('#315944');g.roundRect(-12,y-13,24,24,5);g.stroke();g.moveTo(-6,y+10);g.lineTo(-6,y+15);g.lineTo(6,y+15);g.lineTo(6,y+10);g.stroke();g.fillColor=new Color('#d6c999');g.roundRect(-13,y+2,26,6,2);g.fill();g.roundRect(-2,y-2,4,7,1);g.fill();
  }else if(role==='journal'){
    g.moveTo(-12,y+13);g.lineTo(10,y+15);g.lineTo(13,y-13);g.lineTo(-9,y-15);g.close();g.fill();g.strokeColor=new Color('#315944');g.moveTo(-9,y+11);g.lineTo(-6,y-11);g.lineTo(10,y-10);g.stroke();g.strokeColor=new Color('#f4e4af');g.circle(2,y,6);g.stroke();g.moveTo(2,y+9);g.lineTo(2,y-9);g.moveTo(-7,y);g.lineTo(11,y);g.stroke();
  }else{
    for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%3===1?14:11,x=Math.cos(a)*r,z=y+Math.sin(a)*r;i?g.lineTo(x,z):g.moveTo(x,z);}g.close();g.fill();g.strokeColor=new Color('#315944');g.stroke();g.fillColor=new Color('#f5ebce');g.circle(0,y,6);g.fill();g.strokeColor=new Color('#819064');g.circle(0,y,6);g.stroke();
  }
}
