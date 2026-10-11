import json,sys,math,numpy as np
from PIL import Image,ImageDraw
import os
# 路径可用环境变量覆盖：SPILL_JSON / SPILL_SHOTS / SPILL_PREVIEW / SPILL_RENDER_DIR（默认值即原来的路径）
D=json.load(open(os.environ.get('SPILL_JSON','/tmp/spill.json')))['D'];shots={s['name']:s for s in json.load(open(os.environ.get('SPILL_SHOTS','/tmp/spill_shots.json')))}
mode,peak,outdir=sys.argv[1],float(sys.argv[2]),sys.argv[3]
P=os.environ.get('SPILL_PREVIEW','/workspace/yiqifengle/previews/运镜bot/room-camera/')
def rot(q,v):
  x,y,z,w=q;u=np.array([x,y,z]);return v*(w*w-u.dot(u))+2*np.outer(v@u,u)+2*w*np.cross(u,v)
rows=D['rows'];cols=D['columns'];col=np.array(D['color'],float)
def interp(xs,ys,x):return np.interp(x,xs,ys,left=0,right=0)
for name,tag in [('00_home_pose','home_pose'),('01_dragged_door_view','door_view')]:
  s=shots[name];base=np.asarray(Image.open(P+'spill_%s_%s_REF_nohint.png'%(mode,tag)).convert('RGB'),float);H,W=base.shape[:2]
  mask=np.asarray(Image.open(os.path.join(os.environ.get('SPILL_RENDER_DIR','/tmp/spillr'),'%s_mask.png'%name)).convert('L'),float)/255.
  th=math.tan(math.radians(s['fov'])/2);asp=W/H;py,px=np.mgrid[0:H,0:W]
  d=np.stack([((px+.5)/W*2-1)*th*asp,(1-(py+.5)/H*2)*th,-np.ones_like(px,float)],-1).reshape(-1,3);d=rot(s['rot'],d)
  o=np.array(s['pos']);t=(D['y']-o[1])/np.where(np.abs(d[:,1])<1e-9,-1e-9,d[:,1]);x=o[0]+d[:,0]*t;z=o[2]+d[:,2]*t
  zs=[r[0] for r in rows][::-1];hw=interp(zs,[r[1] for r in rows][::-1],z);ra=interp(zs,[r[2] for r in rows][::-1],z)
  ca=interp([c[0] for c in cols],[c[1] for c in cols],(x-D['centerX'])/np.maximum(hw,1e-6))
  a=(ra*ca*peak*(t>0)).reshape(H,W)*mask
  out=base*(1-a[...,None])+col*a[...,None];im=Image.fromarray(out.clip(0,255).astype(np.uint8))
  dr=ImageDraw.Draw(im);dr.rectangle([0,0,W,58],fill=(0,0,0));dr.text((10,8),'OFFLINE PREVIEW (Blender, not a native screenshot)',fill=(255,255,0));dr.text((10,30),'%s %s - door spill peakAlpha %.2f'%(mode.upper(),tag,peak),fill=(255,255,255))
  im.save(outdir+'/spill_%s_%s.png'%(mode,tag));print('saved',outdir,mode,tag,'maxA',a.max().round(3))
