import {_decorator,Component,EventTouch,input,Input,Node} from 'cc';
import {exploreEnabled,noteSwallowedSkip,setExploreEnabled,takeSwallowedSkip} from '../region/ExploreGate';
const {ccclass}=_decorator;
export {exploreEnabled,setExploreEnabled,takeSwallowedSkip} from '../region/ExploreGate';

export const TAP_MOVE_PT=10;
export const TAP_HOLD_S=0.25;
export const NODE_HIT_PT=48;
export const PROP_HIT_PT=44;
export const GROUND_REACH_M=3;
export const SCENE_PROPS:Readonly<Record<'island'|'meadow'|'skycity'|'lakeside',readonly string[]>>={
 island:['lighthouse-lamp','crab','palm','tide-pool'],
 meadow:['bell','windmill','fence','river'],
 skycity:['robot','star-ring','windchime','great-tree'],
 lakeside:[],
};
/** Where each region's free-explore walkable area comes from (b16 P1-3; b16 decision 2026-10-22: one grid source for all four).
 *  All four: region/RegionWalkableData.ts, baked by tools/region-walkable/bake-region-walkable.cjs from the shipped GLBs
 *  (lakeside: r5h3 transforms incl. the b16 boardwalk). Query API: region/RegionWalkable.ts (docs/b16/walkable/API.md). */
export const EXPLORE_WALKABLE:Readonly<Record<'island'|'meadow'|'skycity'|'lakeside','region-walkable'>>={
 island:'region-walkable',meadow:'region-walkable',skycity:'region-walkable',lakeside:'region-walkable',
};
/** Runtime node names. The meadow model has no sheep mesh; the fence is the fourth tappable. */
export const PROP_NODES:Readonly<Record<string,string>>={
 'lighthouse-lamp':'env_lighthouse_lamp_glow_v22',
 crab:'env_anim_crab_01',
 palm:'env_prop_palm_tall_01',
 'tide-pool':'env_prop_palm_lean_01',
 bell:'wind_bell_frame_root',
 windmill:'windmill_sail_hub',
 fence:'meadow_fence_merged',
 river:'meadow_river',
 robot:'chr_robot_gardener_mesh',
 'star-ring':'env_sky_starring',
 windchime:'env_sky_windchime_01',
 'great-tree':'env_sky_greattree_canopy',
};
/** Runtime-only motion. 0.45 s sits inside the 0.3–0.6 s feedback window. */
export function propFeedback(id:string):{id:string;seconds:number;motion:'sway'|'spin'|'pulse'}{
 const motion=id==='windmill'||id==='star-ring'?'spin':id==='crab'||id==='sheep'?'pulse':'sway';
 return {id,seconds:0.45,motion};
}
export type Gesture='ui'|'pinch'|'drag'|'tap'|'ignored'|'swallowed'|'release';
export type TapTarget=Readonly<{kind:'node'|'prop'|'ground'|'locked';id:string;walk:boolean;feedback?:'shake'}>;
type Down={x:number;y:number;t:number};

/** UI wins. Two fingers pinch. A move of 10 pt is a drag. A short still release is a tap. */
export function classifyPointers(opts:{uiHit:boolean;pointers:number;movedPt:number;heldS:number;boardOpen:boolean;blending:boolean;explore:boolean}):Gesture{
 if(opts.uiHit)return 'ui';
 if(opts.boardOpen)return 'ignored';
 if(opts.blending)return 'swallowed';
 if(opts.pointers>=2)return opts.explore?'pinch':'ignored';
 if(opts.movedPt>=TAP_MOVE_PT)return opts.explore?'drag':'ignored';
 if(opts.heldS<=TAP_HOLD_S&&opts.movedPt<TAP_MOVE_PT)return 'tap';
 return 'ignored';
}
export function resolveTap(opts:{nodeId:string|null;nodePhase:'locked'|'playable'|'passed'|null;propId:string|null;groundM:number|null;explore:boolean}):TapTarget|null{
 if(opts.nodeId){
  if(opts.nodePhase==='locked')return {kind:'locked',id:opts.nodeId,walk:false,feedback:'shake'};
  if(opts.nodePhase==='playable'||opts.nodePhase==='passed')return {kind:'node',id:opts.nodeId,walk:opts.explore||opts.nodePhase==='playable'};
 }
 if(opts.propId)return {kind:'prop',id:opts.propId,walk:false};
 if(opts.groundM!==null&&opts.groundM<=GROUND_REACH_M&&opts.explore)return {kind:'ground',id:'ground',walk:true};
 return null;
}
/** Two node markers closer than 56 pt: keep the one nearer to her. */
export function pickMarker(hits:readonly {id:string;distancePt:number;toGirl:number}[]):string|null{
 if(!hits.length)return null;
 const close=hits.filter(h=>h.distancePt<=NODE_HIT_PT);
 if(!close.length)return null;
 close.sort((a,b)=>a.toGirl-b.toGirl||a.distancePt-b.distancePt);
 if(close.length>1&&Math.abs(close[0].distancePt-close[1].distancePt)<56&&close[0].toGirl>close[1].toGirl)return close[1].id;
 return close[0].id;
}

@ccclass('ExploreInput')
export class ExploreInput extends Component{
 private down:Down|null=null;
 /** 'feed': the press came from IslandLighthouseTouch (node-claimed, so the global input never sees it); global handlers stand down. */
 private source:'global'|'feed'='global';
 private moved=0;
 private pointers=1;
 private lastX=0;
 private lastY=0;
 /** Distance between the two fingers on the previous move. 0 until a pinch has a baseline. */
 private span=0;
 /** World handler. Stays null while the board owns input (`exploreEnabled` is false). */
 sink:((gesture:Gesture,x:number,y:number,pointers:number)=>void)|null=null;
 onEnable(){input.on(Input.EventType.TOUCH_START,this.onStart,this);input.on(Input.EventType.TOUCH_MOVE,this.onMove,this);input.on(Input.EventType.TOUCH_END,this.onEnd,this);}
 onDisable(){input.off(Input.EventType.TOUCH_START,this.onStart,this);input.off(Input.EventType.TOUCH_MOVE,this.onMove,this);input.off(Input.EventType.TOUCH_END,this.onEnd,this);this.down=null;this.source='global';}
 private onStart(e:EventTouch){if(this.source==='feed'&&this.down)return;this.begin(e,'global');}
 private begin(e:EventTouch,source:'global'|'feed'){if(!exploreEnabled())return;this.source=source;const p=e.getUILocation();this.down={x:p.x,y:p.y,t:Date.now()};this.lastX=p.x;this.lastY=p.y;this.moved=0;this.span=0;const n=(e.getTouches?.()||[]).length;this.pointers=n>1?n:1;}
 private onMove(e:EventTouch){if(this.source==='feed')return;this.drive(e);}
 private drive(e:EventTouch){if(!this.down||!exploreEnabled())return;const touches=e.getTouches?.()||[];const n=touches.length;if(n>1)this.pointers=n;
  if(this.pointers>=2&&touches.length>=2){const a=touches[0].getUILocation(),b=touches[1].getUILocation();const d=Math.hypot(a.x-b.x,a.y-b.y);
   let scale=1;if(this.span>16&&d>16)scale=d/this.span;this.span=d;this.moved=Math.max(this.moved,TAP_MOVE_PT);
   if(Math.abs(scale-1)>0.002)this.sink?.('pinch',scale,0,this.pointers);return;}
  const p=e.getUILocation();const dx=p.x-this.down.x,dy=p.y-this.down.y;this.moved=Math.max(this.moved,Math.hypot(dx,dy));
  const sx=p.x-this.lastX,sy=p.y-this.lastY;this.lastX=p.x;this.lastY=p.y;
  if(this.moved>=TAP_MOVE_PT)this.sink?.('drag',sx,sy,1);}
 private onEnd(){if(this.source==='feed')return;this.finish();}
 private finish(){if(!this.down)return;this.source='global';const held=(Date.now()-this.down.t)/1000;const gesture=classifyPointers({uiHit:false,pointers:this.pointers,movedPt:this.moved,heldS:held,boardOpen:!exploreEnabled(),blending:false,explore:true});
  const x=this.down.x,y=this.down.y;this.down=null;this.span=0;
  if(gesture==='drag'||gesture==='pinch'){this.sink?.('release',0,0,this.pointers);this.pointers=1;return;}
  if(gesture==='swallowed')noteSwallowedSkip();this.sink?.(gesture,x,y,this.pointers);this.pointers=1;}
 /** The board calls this so a finger on a button never reaches the world. */
 acceptUi():void{this.down=null;this.source='global';}
 active():boolean{return this.enabledInHierarchy&&exploreEnabled();}
 feedStart(e:EventTouch):void{this.begin(e,'feed');}
 feedMove(e:EventTouch):void{if(this.source==='feed')this.drive(e);}
 feedEnd():void{if(this.source==='feed')this.finish();}
 feedCancel():void{if(this.source!=='feed')return;if(this.down)this.sink?.('release',0,0,this.pointers);this.down=null;this.span=0;this.pointers=1;this.source='global';}
}
export function worldClosed():boolean{return !exploreEnabled();}
void Node;
