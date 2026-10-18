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
 riderPose:string;
 gsx:number|null;gsy:number|null;
 shoreNear:number;
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
 const groups=[[[0,0.22,-0.35],[0.22,0.22,-0.15],[-0.22,0.22,-0.15],[0,0.22,0.15]],[[0,0.25,-1.7],[0.16,0.25,-1.55],[-0.16,0.25,-1.55],[0,0.25,-1.4]],[[0,0.25,0.95],[0.14,0.25,0.8],[-0.14,0.25,0.8],[0,0.25,1.05]]];
 const cockpit:number[][]=[];
 let gsx:number|null=null,gsy:number|null=null;
 if(partial.boat&&cam){
  const out=new Vec3();
  for(const group of groups){
   if(cockpit.length)cockpit.push([Number.NaN,Number.NaN]);
   for(const p of group){
    const w=new Vec3(p[0],p[1],p[2]);Vec3.transformMat4(w,w,partial.boat.worldMatrix);
    cam.worldToScreen(w,out);cockpit.push([+out.x.toFixed(1),+out.y.toFixed(1)]);
   }
  }
 }
 const hip=findNamed(girl,/hips$/i);
 const feet:Node[]=[];collect(girl,/foot/i,feet);
 let footY:number|null=null;for(const f of feet)footY=footY==null?f.worldPosition.y:Math.min(footY,f.worldPosition.y);
 const riderPose=!hip||footY==null?'':(hip.worldPosition.y-footY<0.5?'sit':'stand');
 if(girl&&cam&&gp){
  const out=new Vec3();cam.worldToScreen(new Vec3(gp.x,gp.y+0.35,gp.z),out);
  gsx=+out.x.toFixed(1);gsy=+out.y.toFixed(1);
 }
   let clear=[0,0,0];
   try{const col=cam?.clearColor;if(col)clear=[col.r,col.g,col.b];}catch{/* camera has no clearColor */}
   const snap:SailQaSnap={
  t:+partial.t.toFixed(4),real:+(partial.real??partial.t).toFixed(4),beat:partial.beat,phase:partial.phase,departed:!!partial.departed,
  girl:gp?[+gp.x.toFixed(3),+gp.y.toFixed(3),+gp.z.toFixed(3)]:null,
  girlActive:!!girl?.activeInHierarchy,girlRenderers:renderers,parent:pathOf(girl),
  boat:bp?[+bp.x.toFixed(3),+bp.y.toFixed(3),+bp.z.toFixed(3)]:null,
  yaw:+partial.yaw.toFixed(4),roll:+partial.roll.toFixed(4),
  cam:[+partial.pose.position[0].toFixed(3),+partial.pose.position[1].toFixed(3),+partial.pose.position[2].toFixed(3)],
  aim:[+partial.pose.target[0].toFixed(3),+partial.pose.target[1].toFixed(3),+partial.pose.target[2].toFixed(3)],
  fov:partial.pose.fovVerticalDeg||cam?.fov||0,near:cam?.near||0,far:cam?.far||0,
  clear,
  seas,clip,rate,cockpit,riderPose,gsx,gsy,shoreNear:+((globalThis as any).__QF_SAIL_SHORE_NEAR||0),
 };
 g.frames.push(snap);
}
function findNamed(node:Node|null,re:RegExp):Node|null{
 if(!node)return null;if(re.test(node.name))return node;
 for(const c of node.children){const h=findNamed(c,re);if(h)return h;}
 return null;
}
function collect(node:Node|null,re:RegExp,out:Node[]):void{
 if(!node)return;if(re.test(node.name))out.push(node);
 for(const c of node.children)collect(c,re,out);
}
