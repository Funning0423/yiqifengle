import sys,glob,os,numpy as np
from PIL import Image,ImageDraw,ImageFont
REF='/workspace/wechat-game/art/regions/lakeside/renders/lakeside_r5h3_demo_lastframe.png'
R={'sky':(0.0,0.0,1.0,0.04),'far_trees':(0.1,0.12,0.9,0.22),'mid_water':(0.1,0.30,0.9,0.38),'bridge':(0.25,0.40,0.75,0.50),'near_water_L':(0.02,0.93,0.10,0.99),'near_water_R':(0.88,0.60,0.98,0.66)}
def med(im,b):
  a=np.asarray(im.convert('RGB').resize((720,1280))).astype(float);H,W=a.shape[:2];x0,y0,x1,y1=b
  return tuple(int(v) for v in np.median(a[int(y0*H):int(y1*H),int(x0*W):int(x1*W)].reshape(-1,3),axis=0))
def table(items):
  out=['| 区域 | '+' | '.join(n for n,_ in items)+' |','|---|'+'---|'*len(items)]
  for k,b in R.items():out.append(f'| {k} | '+' | '.join('%d/%d/%d'%med(im,b) for _,im in items)+' |')
  return '\n'.join(out)
def sheet(items,path):
  ims=[im.convert('RGB').resize((360,640)) for _,im in items];W=len(ims)*370;c=Image.new('RGB',(W,680),'white');d=ImageDraw.Draw(c)
  try:f=ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',20)
  except:f=None
  for i,(n,_) in enumerate(items):
    c.paste(ims[i],(i*370,40));d.text((i*370+6,8),n,fill='black',font=f)
  c.save(path)
def flick(prefix):
  fs=sorted(glob.glob(prefix+'_flick_*.png'))
  if len(fs)<3:return None
  A=np.stack([np.asarray(Image.open(f).convert('L').resize((360,640))).astype(float) for f in fs])
  s=A.std(0);d=np.abs(np.diff(A,axis=0)).mean((1,2))
  def reg(b):x0,y0,x1,y1=b;return float(s[int(y0*640):int(y1*640),int(x0*360):int(x1*360)].mean())
  return {'n':len(fs),'std_mid_water':round(reg(R['mid_water']),2),'std_bridge':round(reg(R['bridge']),2),'std_whole':round(float(s.mean()),2),'frame_diff_max':round(float(d.max()),2),'at':int(d.argmax())}
if __name__=='__main__':
  out=sys.argv[1];pairs=sys.argv[2:]
  items=[('r5h3 参考',Image.open(REF))]+[(p.split('=')[0],Image.open(p.split('=')[1])) for p in pairs]
  sheet(items,out);print(table(items))
