import {Animation, Camera, MeshRenderer, Node, Vec3, director} from 'cc';
/** Web/QA only (`?sailqa=1`). Release pages never set the flag, so this records nothing. */
const GIRL='FLOW_REFERENCE_PLACEHOLDER_NOT_B';
export type SailQaSnap={
 t:number;real:number;beat:string;phase:string;departed:boolean;
 girl:number[]|null;girlActive:boolean;girlRenderers:number;parent:string;
 boat:number[]|null;yaw:number;roll:number;
 cam:number[]|null;aim:number[]|null;fov:number;near:number;far:number;
 seas:Array<{name:string;y:number;active:boolean;enabled:boolean}>;
 clip:string;rate:number;
 cockpit:number[][];
 clear:number[];
};
function find(node:Node|null,name:string):Node|null{
 if(!node)return null;if(node.name===name)return node;
 for(const c of node.children){const h=find(c,name);if(h)return h;}return null;
}
function pathOf(n:Node|null):string{
 const parts:string[]=[];let c:Node|null=n;
 while(c){parts.push(c.name);c=c.parent;}return parts.reverse().join('/');
}
export function sailQaEnabled():boolean{
 try{return !!(globalThis as any).__sailQa;}catch{return false;}
}
export function armSailQa():void{
 const g=globalThis as any;if(g.__sailQa)return;
 g.__sailQa={frames:[] as SailQaSnap[],cues:[] as string[]};
}
export function pushSailCue(name:string,t:number):void{
 const g=(globalThis as any).__sailQa;if(!g)return;g.cues.push(name+'@'+t.toFixed(3));
}
export function pushSailFrame(partial:{t:number;real?:number;beat:string;phase:string;yaw:number;roll:number;boat:Node|null;pose:{position:readonly number[];target:readonly number[];fovVerticalDeg?:number};departed?:boolean}):void{
 const g=(globalThis as any).__sailQa;if(!g)return;
 const scene=director.getScene();
 const girl=find(scene,GIRL);
 let renderers=0;if(girl)for(const r of girl.getComponentsInChildren(MeshRenderer))if(r.enabled&&r.node.activeInHierarchy)renderers++;
 let clip='',rate=1;
 if(girl){const anim=girl.getComponent(Animation)||girl.getComponentInChildren(Animation);const st=anim?.getState(anim.defaultClip?.name||'')||null;
  const playing=anim?Object.keys((anim as any)._nameToState||{}):[];
  for(const name of playing){const s=anim!.getState(name);if(s&&s.isPlaying){clip=name;rate=s.speed;break;}}
  if(!clip&&st){clip=st.name||'';rate=st.speed;}}
 const cams=scene?scene.getComponentsInChildren(Camera):[];
 const cam=cams.find(c=>c.enabled&&c.node.name!=='WorldNavigationCamera'&&(c.visibility&1||c.priority<50))||cams.find(c=>c.node.name!=='WorldNavigationCamera')||null;
 const gp=girl?.worldPosition;
 const bp=partial.boat?.worldPosition;
 const seas:SailQaSnap['seas']=[];
 if(scene){
  const names=['sea_plane','landing_sea_tile','transit_river_mouth','meadow_river','env_sea_surface','env_sea_foam'];
  for(const name of names){const n=find(scene,name);if(!n)continue;const r=n.getComponent(MeshRenderer);seas.push({name,y:+n.worldPosition.y.toFixed(3),active:n.activeInHierarchy,enabled:!!r?.enabled});}
 }
 const cockpit:number[][]=[];
 if(partial.boat&&cam){
  const out=new Vec3();
  for(const p of [[0,0.2,-0.4],[0.35,0.2,-0.2],[-0.35,0.2,-0.2],[0,0.2,0.3]]){
   const w=new Vec3(p[0],p[1],p[2]);Vec3.transformMat4(w,w,partial.boat.worldMatrix);
   cam.worldToScreen(w,out);cockpit.push([+out.x.toFixed(1),+out.y.toFixed(1)]);
  }
 }
   let clear=[0,0,0];
   try{const col=cam?.clearColor;if(col)clear=[col.r,col.g,col.b];}catch{/* camera has no clearColor */}
   const snap:SailQaSnap={
  t:+partial.t.toFixed(4),real:+(partial.real??partial.t).toFixed(4),beat:partial.beat,phase:partial.phase,departed:!!partial.departed,
  girl:gp?[+gp.x.toFixed(3),+gp.y.toFixed(3),+gp.z.toFixed(3)]:null,
  girlActive:!!girl?.activeInHierarchy,girlRenderers:renderers,parent:pathOf(girl),
  boat:bp?[+bp.x.toFixed(3),+bp.y.toFixed(3),+bp.z.toFixed(3)]:null,
  yaw:+partial.yaw.toFixed(4),roll:+partial.roll.toFixed(4),
  cam:cam?[+cam.node.worldPosition.x.toFixed(3),+cam.node.worldPosition.y.toFixed(3),+cam.node.worldPosition.z.toFixed(3)]:null,
  aim:[+partial.pose.target[0].toFixed(3),+partial.pose.target[1].toFixed(3),+partial.pose.target[2].toFixed(3)],
  fov:partial.pose.fovVerticalDeg||cam?.fov||0,near:cam?.near||0,far:cam?.far||0,
  clear,
  seas,clip,rate,cockpit,
 };
 g.frames.push(snap);
}
