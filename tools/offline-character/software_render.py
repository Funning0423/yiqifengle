"""Deterministic orthographic CPU z-buffer review, independent of engine/UI."""
from common import *
from PIL import Image
from io import BytesIO
import argparse
p=argparse.ArgumentParser();p.add_argument('asset');p.add_argument('out');args=p.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True);g,r,data=load(args.asset);meta=json.load(open(META));tex={}
for i,im in enumerate(g.j.get('images',[])):
 if 'bufferView' in im:tex[i]=np.asarray(Image.open(BytesIO(g.view(im['bufferView']))).convert('RGB'),float)/255

def render(world,wt,label,target,scale,eye):
 width,height=480,640;direction=np.array(eye,float);direction/=np.linalg.norm(direction);right=np.cross([0,1,0],direction);right/=np.linalg.norm(right);up=np.cross(direction,right);basis=np.array([right,up,direction]);target=np.array(target);zbuf=np.full((height,width),-np.inf);img=np.full((height,width,3),.86)
 for md in data:
  V=posed(md,r,world,wt);F=md['F'];pos=(V-target)@basis.T;assert np.isfinite(pos).all();xy=pos[:,:2]*height/scale+np.array([width/2,height/2]);xy[:,1]=height-xy[:,1]
  N=np.zeros_like(V);fn=np.cross(V[F[:,1]]-V[F[:,0]],V[F[:,2]]-V[F[:,0]]);np.add.at(N,F[:,0],fn);np.add.at(N,F[:,1],fn);np.add.at(N,F[:,2],fn);N/=np.maximum(np.linalg.norm(N,axis=1,keepdims=True),1e-10)
  mat=g.j['materials'][md['pr']['material']].get('pbrMetallicRoughness',{});base=np.array(mat.get('baseColorFactor',[1,1,1,1]))[:3];attrs=md['pr']['attributes'];colors=np.ones_like(V)
  if 'COLOR_0' in attrs:
   ac=g.j['accessors'][attrs['COLOR_0']];colors=g.accessor(attrs['COLOR_0'])[:,:3].astype(float)
   if ac.get('normalized'):colors/=255 if ac['componentType']==5121 else 65535
  uv=g.accessor(attrs['TEXCOORD_0']) if 'TEXCOORD_0' in attrs else None;texture=None
  if 'baseColorTexture' in mat:texture=tex.get(g.j['textures'][mat['baseColorTexture']['index']]['source'])
  light=np.array([-1,2,3.]);light/=np.linalg.norm(light)
  for tri in F:
   pts=xy[tri];lo=np.maximum(0,np.floor(pts.min(0)).astype(int));hi=np.minimum([width-1,height-1],np.ceil(pts.max(0)).astype(int))
   if np.any(hi<lo):continue
   a,b,c=pts;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
   if abs(den)<1e-8:continue
   xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5);w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w2=1-w0-w1;bc=np.stack([w0,w1,w2],-1);depth=bc@pos[tri,2];zs=zbuf[lo[1]:hi[1]+1,lo[0]:hi[0]+1];mask=(bc.min(-1)>=-1e-7)&(depth>zs)
   if not mask.any():continue
   normal=bc@N[tri];normal/=np.maximum(np.linalg.norm(normal,axis=-1,keepdims=True),1e-10);shade=.42+.58*np.abs(normal@light);color=(bc@colors[tri])*base
   if texture is not None and uv is not None:
    uvs=bc@uv[tri];h,w=texture.shape[:2];tx=np.clip((uvs[:,:,0]*w).astype(int),0,w-1);ty=np.clip((uvs[:,:,1]*h).astype(int),0,h-1);color*=texture[ty,tx]
   color*=shade[:,:,None];img[lo[1]:hi[1]+1,lo[0]:hi[0]+1][mask]=color[mask];zs[mask]=depth[mask]
 Image.fromarray(np.uint8(np.clip(img,0,1)*255)).save(out/(label+'.png'))
for label,clip,t in [('seated','sit_hold',0),('rise','stand_up',.601),('wrist','walk_start',.603)]:
 world,wt=sample(r,clip,t,meta)
 if label=='seated':world,wt=actual(r)
 for view,eye in [('side',[3,.3,.4]),('front',[-1,.3,3])]:
  target=world[r.idx['hand.L'],:3,3] if label=='wrist' else [0,.8,0];render(world,wt,label+'-'+view,target,.36 if label=='wrist' else 1.88,eye)
print('CPU renders complete',out)
# Exact offline driver short-stop fixture, including runtime relaxation and IK.
rep=replay('before' if 'baseline' in args.asset else 'after')
f=next(f for f in rep['frames'] if f['frame']==508);nd={n['name']:n for n in f['nodes']};world=r.fk(*[np.array([nd[n][k] for n in r.names])[None] for k in ['translation','rotation','scale']])[0]
for view,eye in [('side',[3,.35,.05]),('front',[.8,.35,3])]:render(world,f['morphWeights'],'short508-'+view,[0,.20,.02],.65,eye)
