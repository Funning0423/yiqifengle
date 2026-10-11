import { Node, UITransform, Sprite, SpriteFrame, RenderTexture, Camera, Color, Vec3, Vec4, Mesh, MeshRenderer, Material, EffectAsset, resources, utils, director, Director, isValid } from 'cc';
import { RESULT_CHEST_GEOMETRY as DATA } from './ResultChestGeometry';
import type { ResultChestResource, ResultChestLease } from './ResultChestResource';

const SIZE=112,LAYER=1<<19,PIXELS=256,ORIGIN=new Vec3(10000,10000,10000);
function hull(points:number[][]){
  const p=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const lower:number[][]=[],upper:number[][]=[];
  for(const v of p){while(lower.length>1&&cross(lower[lower.length-2],lower[lower.length-1],v)<=0)lower.pop();lower.push(v);}
  for(let i=p.length-1;i>=0;i--){const v=p[i];while(upper.length>1&&cross(upper[upper.length-2],upper[upper.length-1],v)<=0)upper.pop();upper.push(v);}
  lower.pop();upper.pop();return lower.concat(upper);
}
/** One analytic union fit for every angle in the complete 0..105 degree animation.
 * Extrema of A*cos(angle)+B*sin(angle) include both endpoints and all critical angles.
 * The camera never zooms/recentres while the lid is moving.
 */
const FULL_ANIMATION_FRAME=(()=>{
  const distance=Math.hypot(4.5,2.9,6),forward=[4.5/distance,2.9/distance,6/distance],right=[.8,0,-.6],up=[-forward[1]*.6,forward[2]*.8+forward[0]*.6,-forward[1]*.8],lo=DATA.openDegrees*Math.PI/180;
  const range=(axis:number[])=>{let min=Infinity,max=-Infinity;
    for(const g of DATA.boundsMeshes)for(let i=0;i<g.positions.length;i+=3){const x=g.positions[i],y=g.positions[i+1],z=g.positions[i+2];
      if(g.part==='body'){const v=x*axis[0]+y*axis[1]+z*axis[2];min=Math.min(min,v);max=Math.max(max,v);continue;}
      const fixed=x*axis[0]+DATA.hinge[1]*axis[1]+DATA.hinge[2]*axis[2],A=y*axis[1]+z*axis[2],B=y*axis[2]-z*axis[1],phase=Math.atan2(B,A),angles=[lo,0];
      for(let k=-2;k<=2;k++){const a=phase+k*Math.PI;if(a>lo&&a<0)angles.push(a);}for(const a of angles){const v=fixed+A*Math.cos(a)+B*Math.sin(a);min=Math.min(min,v);max=Math.max(max,v);}
    }return {min,max};};
  const x=range(right),y=range(up),minX=x.min,maxX=x.max,minY=y.min,maxY=y.max,cx=(minX+maxX)/2,cy=(minY+maxY)/2,focus=right.map((v,i)=>v*cx+up[i]*cy);
  return {focus,position:[focus[0]+4.5,focus[1]+2.9,focus[2]+6],halfHeight:Math.max(maxX-minX,maxY-minY)*.56,bounds:{minX,maxX,minY,maxY}};
})();
export function resultChestFrame(_open:number){return FULL_ANIMATION_FRAME;}

/** Actual light-direction projection of the opaque mesh silhouette onto the ground, with a soft edge.
 * No shared scene shadow settings/lights are touched. This is a projected shadow, not shadow-map self-shadowing.
 */
export function resultChestShadow(open:number){
  const a=DATA.openDegrees*Math.PI/180*open,c=Math.cos(a),s=Math.sin(a),points:number[][]=[];
  for(const g of DATA.boundsMeshes)for(let i=0;i<g.positions.length;i+=3){let x=g.positions[i],y=g.positions[i+1],z=g.positions[i+2];if(g.part==='lid'){const Y=y*c-z*s;z=y*s+z*c+DATA.hinge[2];y=Y+DATA.hinge[1];}points.push([x+y*.55/.82,z-y*.50/.82]);}
  let ring=hull(points);
  // Round the projected silhouette into a penumbra instead of displaying a rectangular floor card.
  for(let pass=0;pass<2;pass++)ring=ring.flatMap((p,i)=>{const q=ring[(i+1)%ring.length];return [[p[0]*.75+q[0]*.25,p[1]*.75+q[1]*.25],[p[0]*.25+q[0]*.75,p[1]*.25+q[1]*.75]];});
  const cx=ring.reduce((v,p)=>v+p[0],0)/ring.length,cz=ring.reduce((v,p)=>v+p[1],0)/ring.length;
  const positions=[cx,.002,cz],normals=[0,1,0],colors=[1,1,1,.70],indices:number[]=[];
  const rings=[[.72,.60],[.88,.40],[1.0,.15],[1.14,0]];
  for(const [scale,alpha] of rings)for(const p of ring){positions.push(cx+(p[0]-cx)*scale,.002,cz+(p[1]-cz)*scale);normals.push(0,1,0);colors.push(1,1,1,alpha);}
  const n=ring.length;for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(0,j+1,i+1);for(let r=0;r<rings.length-1;r++){const a=1+r*n+i,b=1+r*n+j,c=1+(r+1)*n+j,d=1+(r+1)*n+i;indices.push(a,b,c,a,c,d);}}

  return {positions,normals,colors,indices};
}

export const RESULT_CHEST_3D_RESOURCE:ResultChestResource={
  id:'woodland-thick-mesh-chest-v1',kind:'model-3d',source:'ResultChestGeometry.ts + chest-lit.effect; original CommonR2 woodland palette reference',
  create(host:Node):ResultChestLease{
    let rig:Node|null=null,surface:Node|null=null,lid:Node|null=null,camera:Camera|null=null,target:RenderTexture|null=null,frame:SpriteFrame|null=null,effect:EffectAsset|null=null,shadowRenderer:MeshRenderer|null=null,shadowMesh:Mesh|null=null;
    const meshes:Mesh[]=[],materials:Material[]=[];let disposed=false,visible=true,queued=false,current=0,goal=0,initialized=false,elapsed=0,start=0;
    const status={state:'loading',error:null as string|null,triangles:DATA.meshes.reduce((n,g)=>n+g.indices.length/3,0),drawGroups:DATA.meshes.length+1,pixels:PIXELS,open:0};
    const afterDraw=()=>{queued=false;if(disposed)return;if(!isValid(host,true)||!isValid(surface,true)||!isValid(rig,true)||!isValid(camera,true)||!isValid(camera.node,true)){dispose();return;}camera.enabled=false;if(!visible||status.state!=='awaiting-first-frame'||!target)return;try{const row=target.readPixels(0,PIXELS/2,PIXELS,1);if(!row||row.length<PIXELS*4)throw Error('Result chest target returned an incomplete pixel row');let opaque=0;for(let i=3;i<row.length;i+=4)if(row[i]>32)opaque++;if(opaque<16)throw Error('Result chest target is empty after its first draw');status.state='ready';}catch(e){const message=String(e);dispose();status.state='error';status.error=message;}};
    const dirty=()=>{if(!camera||disposed||!visible)return;if(!isValid(host,true)||!isValid(surface,true)||!isValid(rig,true)||!isValid(camera,true)||!isValid(camera.node,true)){dispose();return;}camera.enabled=true;if(!queued){queued=true;director.once(Director.EVENT_AFTER_DRAW,afterDraw);}};
    const dispose=()=>{
      if(disposed)return;disposed=true;director.off(Director.EVENT_AFTER_DRAW,afterDraw);queued=false;
      // UI descendants or the scene-owned rig may already be destructed before this lease.
      if(isValid(camera,true)&&isValid(camera.node,true)){camera.enabled=false;camera.targetTexture=null;}camera=null;
      if(surface&&isValid(surface,true)){const s=surface.getComponent(Sprite);if(isValid(s,true))s.spriteFrame=null;surface.removeFromParent();surface.destroy();}surface=null;
      if(rig&&isValid(rig,true)){rig.active=false;rig.removeFromParent();rig.destroy();}rig=null;lid=null;shadowRenderer=null;
      frame?.destroy();frame=null;target?.destroy();target=null;shadowMesh?.destroy();shadowMesh=null;
      for(const mesh of meshes)mesh.destroy();meshes.length=0;for(const mat of materials)mat.destroy();materials.length=0;
      effect?.decRef();effect=null;status.state='disposed';
    };
    const apply=()=>{
      if(disposed||!lid||!shadowRenderer)return;
      if(!isValid(host,true)||!isValid(surface,true)||!isValid(rig,true)||!isValid(lid,true)||!isValid(shadowRenderer,true)||!isValid(shadowRenderer.node,true)||!isValid(camera,true)||!isValid(camera.node,true)){dispose();return;}
      try{lid.setRotationFromEuler(DATA.openDegrees*current,0,0);status.open=current;if(camera){const f=resultChestFrame(current);camera.orthoHeight=f.halfHeight;camera.node.setPosition(f.position[0],f.position[1],f.position[2]);camera.node.lookAt(new Vec3(ORIGIN.x+f.focus[0],ORIGIN.y+f.focus[1],ORIGIN.z+f.focus[2]));}
      const next=utils.createMesh(resultChestShadow(current),undefined,{calculateBounds:true});
      // Publish ownership only after binding succeeds; the old mesh stays owned on setter failure.
      try{shadowRenderer.mesh=next;}catch(error){next.destroy();throw error;}
      const old=shadowMesh;shadowMesh=next;old?.destroy();dirty();
      }catch(error){const message=String(error);dispose();status.state='error';status.error=message;}
    };
    try{
      const scene=director.getScene();if(!scene)throw Error('Result chest requires an active scene');
      // Fail closed on a layer collision instead of silently changing existing camera masks.
      const checkLayer=()=>{for(const cam of scene.getComponentsInChildren(Camera))if((cam.visibility&LAYER)!==0)throw Error('Result chest layer 19 is visible to an existing camera');};checkLayer();
      surface=new Node('ResultChest3DSurface');surface.layer=host.layer;host.addChild(surface);surface.addComponent(UITransform).setContentSize(SIZE,SIZE);const sprite=surface.addComponent(Sprite);sprite.sizeMode=Sprite.SizeMode.CUSTOM;
      resources.load('result-chest/chest-lit',EffectAsset,(error,asset)=>{
        if(disposed)return;
        if(!isValid(host,true)||!isValid(surface,true)||!isValid(sprite,true)||!isValid(scene,true)){dispose();return;}
        if(error||!asset){status.state='error';status.error=String(error||'Missing result chest effect');return;}
        try{
          checkLayer();effect=asset;effect.addRef();rig=new Node('IsolatedResultChest3D');rig.layer=LAYER;scene.addChild(rig);rig.setPosition(ORIGIN);rig.active=visible;
          lid=new Node('IndependentLidHinge');lid.layer=LAYER;rig.addChild(lid);lid.setPosition(DATA.hinge[0],DATA.hinge[1],DATA.hinge[2]);
          const byMaterial=new Map<string,Material>();for(const [name,properties]of Object.entries(DATA.materials)){const mat=new Material();materials.push(mat);mat.initialize({effectAsset:effect});mat.setProperty('baseColor',new Color(Math.round(properties.color[0]*255),Math.round(properties.color[1]*255),Math.round(properties.color[2]*255),255));mat.setProperty('surfaceParams',new Vec4(properties.wood,properties.metal,0,0));byMaterial.set(name,mat);}
          for(const g of DATA.meshes){const n=new Node(g.part+'_'+g.material);n.layer=LAYER;(g.part==='lid'?lid:rig).addChild(n);const mesh=utils.createMesh({positions:g.positions,normals:g.normals,indices:g.indices},undefined,{calculateBounds:true});meshes.push(mesh);const renderer=n.addComponent(MeshRenderer);renderer.mesh=mesh;renderer.setMaterial(byMaterial.get(g.material)!,0);}
          const sn=new Node('ProjectedContactShadow');sn.layer=LAYER;rig.addChild(sn);shadowRenderer=sn.addComponent(MeshRenderer);const sm=new Material();materials.push(sm);sm.initialize({effectAsset:effect,technique:1,defines:{USE_SHADOW:true}});shadowRenderer.setMaterial(sm,0);
          const cn=new Node('ResultChestOnlyCamera');cn.layer=LAYER;rig.addChild(cn);cn.setPosition(4.5,4.2,6);cn.lookAt(new Vec3(ORIGIN.x,ORIGIN.y+1.30,ORIGIN.z));camera=cn.addComponent(Camera);camera.enabled=false;camera.projection=Camera.ProjectionType.ORTHO;camera.orthoHeight=1.85;camera.near=.1;camera.far=30;camera.priority=45;camera.visibility=LAYER;camera.usePostProcess=false;camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=new Color(0,0,0,0);
          target=new RenderTexture();target.reset({width:PIXELS,height:PIXELS});camera.targetTexture=target;frame=new SpriteFrame();frame.texture=target;sprite.spriteFrame=frame;status.state='awaiting-first-frame';apply();
        }catch(e){const message=String(e);dispose();status.state='error';status.error=message;}
      });
    }catch(e){dispose();throw e;}
    return {
      setOpen(value:number){if(disposed)return;const next=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;if(!initialized){initialized=true;current=goal=next;apply();return;}if(next===goal)return;start=current;goal=next;elapsed=0;},
      tick(dt:number){if(disposed||!visible||status.state!=='ready'||current===goal)return;elapsed=Math.min(.65,elapsed+Math.max(0,Math.min(dt,.1)));const t=elapsed/.65,e=1-Math.pow(1-t,3);current=start+(goal-start)*e;if(t===1)current=goal;apply();},
      setVisible(value:boolean){if(disposed)return;visible=value;if(isValid(surface,true))surface.active=value;if(isValid(rig,true))rig.active=value;if(!value){if(isValid(camera,true)&&isValid(camera.node,true))camera.enabled=false;}else dirty();},
      diagnostics(){return {...status};},dispose,
    };
  },
};
