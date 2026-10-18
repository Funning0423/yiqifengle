import {_decorator,Color,Component,Graphics,Node,UITransform} from 'cc';
import type {Vec} from '../region/RegionNodes';
import type {NodePhase} from '../region/RegionNodeProgress';
const {ccclass}=_decorator;

export const MARKER_PT=32;
export const MARKER_HIT_PT=48;
export const ROUTE_SPACING_M=0.8;
export const ROUTE_MAX=24;
/** One shared unlit mesh for every gem and footprint. */
export const ROUTE_HINT_DC=1;
/** Gem height sits between 1/4 and 1/3 of the 1.725 m body. */
export const MARKER_GEM_H=0.5;
export const MARKER_GEM_R=0.15;
export const MARKER_LIFT_M=0.16;
/** Pushed beside her feet when she stands on the node, so the gem does not intersect her. */
export const MARKER_BESIDE_M=0.66;
export type MarkerDraw=Readonly<{fill:string;scale:number;opacity:number;label:string}>;

export function markerDraw(phase:NodePhase,seconds:number,occluded=false):MarkerDraw{
 const opacity=occluded?0.4:1;
 if(phase==='passed')return {fill:'#e2b657',scale:1,opacity,label:'passed'};
 if(phase==='playable'){const wave=Math.sin((seconds%1.6)/1.6*Math.PI*2);return {fill:'#f0d7a2',scale:1+0.04*wave,opacity,label:'playable'};}
 return {fill:'#9aa0a6',scale:1,opacity,label:'locked'};
}
/** Ground point for one gem. On the node when she is away; beside her feet when she is standing there. */
export function markerAnchor(at:Vec,girl:Vec):Vec{
 const dx=at[0]-girl[0],dz=at[2]-girl[2];
 if(Math.hypot(dx,dz)<0.85)return [girl[0]+MARKER_BESIDE_M,at[1],girl[2]+0.2];
 return [at[0],at[1],at[2]];
}
function shade(fill:string,k:number):[number,number,number,number]{
 const n=parseInt(fill.slice(1),16);
 return [((n>>16)&255)/255*k,((n>>8)&255)/255*k,(n&255)/255*k,1];
}
/**
 * Low-poly crystal in local space (apex up). Vertex colors carry the light so one unlit
 * material still reads as a volume. `foot` is a flat route hint, not a second gem.
 */
export function gemLocal(phase:NodePhase,seconds:number,foot=false):{positions:number[];normals:number[];colors:number[];indices:number[]}{
 const look=markerDraw(phase,seconds);
 const fill=look.fill;
 const positions:number[]=[],normals:number[]=[],colors:number[]=[],indices:number[]=[];
 const push=(x:number,y:number,z:number,ny:number,c:[number,number,number,number])=>{positions.push(x,y,z);normals.push(0,ny,0);colors.push(c[0],c[1],c[2],c[3]);};
 const tri=(a:number,b:number,c:number)=>{indices.push(a,b,c);};
 if(foot){
  const y=0.02,r=0.07,col=shade(fill,0.7),n=positions.length/3;
  push(0,y,0,1,col);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;push(Math.cos(a)*r,y,Math.sin(a)*r,1,shade(fill,0.45));}
  for(let i=0;i<6;i++)tri(n,n+1+i,n+1+(i+1)%6);
  return {positions,normals,colors,indices};
 }
 const h=MARKER_GEM_H*look.scale;
 const y0=MARKER_LIFT_M+(phase==='playable'?0.05*Math.sin((seconds%1.6)/1.6*Math.PI*2):0);
 const pole=shade(fill,0.48),front=shade(fill,1),back=shade(fill,0.58),base=shade(fill,0.35);
 const box=(x0:number,y0b:number,z0:number,x1:number,y1:number,z1:number,c:[number,number,number,number])=>{
  const n=positions.length/3;
  const v=[[x0,y0b,z0],[x1,y0b,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0b,z1],[x1,y0b,z1],[x1,y1,z1],[x0,y1,z1]];
  for(const p of v)push(p[0],p[1],p[2],1,c);
  const f=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
  for(const q of f){tri(n+q[0],n+q[1],n+q[2]);tri(n+q[0],n+q[2],n+q[3]);}
 };
 box(-0.015,y0,-0.015,0.015,y0+h,0.015,pole);
 const top=y0+h*0.92,bot=y0+h*0.52,tip=y0+h*0.72;
 const a=positions.length/3;push(0.02,top,0.012,0,front);push(0.02,bot,0.012,0,front);push(0.26*look.scale,tip,0.012,0,shade(fill,0.82));
 tri(a,a+1,a+2);
 const b=positions.length/3;push(0.02,top,-0.012,0,back);push(0.26*look.scale,tip,-0.012,0,back);push(0.02,bot,-0.012,0,back);
 tri(b,b+1,b+2);
 const disc=positions.length/3;push(0,y0,0,1,base);
 for(let i=0;i<6;i++){const t=i/6*Math.PI*2;push(Math.cos(t)*0.09,y0+0.01,Math.sin(t)*0.09,1,shade(fill,0.5));}
 for(let i=0;i<6;i++)tri(disc,disc+1+i,disc+1+(i+1)%6);
 return {positions,normals,colors,indices};
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
