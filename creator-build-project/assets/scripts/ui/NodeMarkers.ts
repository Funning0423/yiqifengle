import {_decorator,Color,Component,Graphics,Node,UITransform} from 'cc';
import type {Vec} from '../region/RegionNodes';
import type {NodePhase} from '../region/RegionNodeProgress';
const {ccclass}=_decorator;

export const MARKER_PT=32;
export const MARKER_HIT_PT=48;
export const ROUTE_SPACING_M=0.8;
export const ROUTE_MAX=24;
/** One instanced footprint material. The markers themselves are screen-space UI. */
export const ROUTE_HINT_DC=1;
export type MarkerDraw=Readonly<{fill:string;scale:number;opacity:number;label:string}>;

export function markerDraw(phase:NodePhase,seconds:number,occluded=false):MarkerDraw{
 const opacity=occluded?0.4:1;
 if(phase==='passed')return {fill:'#e2b657',scale:1,opacity,label:'passed'};
 if(phase==='playable'){const wave=Math.sin((seconds%1.6)/1.6*Math.PI*2);return {fill:'#fffaf2',scale:1+0.04*wave,opacity,label:'playable'};}
 return {fill:'#9aa0a6',scale:1,opacity,label:'locked'};
}
export function footprints(from:Vec,to:Vec,spacing=ROUTE_SPACING_M,max=ROUTE_MAX):Vec[]{
 const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2],L=Math.hypot(dx,dy,dz);
 if(!(L>0.05))return [];
 const n=Math.min(max,Math.max(1,Math.floor(L/spacing)));
 const out:Vec[]=[];
 for(let i=1;i<=n;i++){const t=i/(n+1);out.push([from[0]+dx*t,from[1]+dy*t,from[2]+dz*t]);}
 return out;
}
export function routeHintVisible(state:'Board'|'FollowWalk'|'MapExplore',exploreUnlocked:boolean,lingering:boolean):boolean{
 if(state==='MapExplore')return true;
 return state==='FollowWalk'&&!exploreUnlocked&&lingering;
}
export function exploreHint(seen:boolean):string|null{return seen?null:'这里可以随意走走了';}
export function lockedHint(stageLabel:string):string{return '先完成'+stageLabel;}
export function recenterButton():{sizePt:number;corner:'bottom-right'}{return {sizePt:44,corner:'bottom-right'};}

@ccclass('NodeMarkers')
export class NodeMarkers extends Component{
 draw(phase:NodePhase,seconds:number){
  const g=this.getComponent(Graphics)||this.node.addComponent(Graphics);
  const ui=this.getComponent(UITransform)||this.node.addComponent(UITransform);
  ui.setContentSize(MARKER_HIT_PT,MARKER_HIT_PT);
  const look=markerDraw(phase,seconds,false);
  g.clear();g.fillColor=new Color(look.fill);const r=MARKER_PT*look.scale*0.5;g.circle(0,0,r);g.fill();
 }
}
export function markerRoot(parent:Node,name:string):Node{const n=new Node(name);parent.addChild(n);return n;}
