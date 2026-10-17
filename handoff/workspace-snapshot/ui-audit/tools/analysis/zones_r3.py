import numpy as np,json,sys
from PIL import Image,ImageDraw
B10={'far_water':(250,342,470,362),'mid_water':(260,400,460,450),'mid_water_R':(500,410,700,460),'under_bridge':(430,670,540,700),'near_mid_water':(322,788,450,810),'near_water_bottom':(160,1215,560,1270),'near_water_L':(14,1190,72,1267),'bridge_stone_deck':(335,563,385,588),'bridge_stone_left':(190,610,250,640)}
T10={'far_water':(92,90,84),'mid_water':(86,115,118),'mid_water_R':(113,142,135),'under_bridge':(52,92,106),'near_mid_water':(55,109,118),'near_water_bottom':(76,136,136),'near_water_L':(86,144,139),'bridge_stone_deck':(134,128,99),'bridge_stone_left':(135,115,88)}
BX={'bridge_rail':(357,522,362,538),'grass_L':(20,575,90,615),'grass_R':(610,545,700,585),'far_trees':(165,190,410,220),'far_hills':(100,90,600,140),'roof_L':(5,405,110,435)}
TX={'bridge_rail':(108,110,88),'grass_L':(81,107,24),'grass_R':(72,120,22),'far_trees':(51,94,28),'far_hills':(71,83,20),'roof_L':None}
def load(p):
  return np.asarray(Image.open(p).convert('RGB').resize((720,1280))).astype(float) if not p.endswith('.npy') else np.load(p).astype(float)
def med(a,b):x0,y0,x1,y1=b;return tuple(int(round(v)) for v in np.median(a[y0:y1,x0:x1].reshape(-1,3),0))
def stripe(a):return round(float(a[380:470,120:600].mean(1).std(0).mean()),1)
def annotate(p,out):
  im=Image.open(p).convert('RGB').resize((720,1280));d=ImageDraw.Draw(im)
  for i,(n,b) in enumerate(list(B10.items())+list(BX.items())):
    d.rectangle(b,outline=(255,0,0) if n in B10 else (255,255,0),width=2);d.text((b[0]+2,b[1]-11),str(i+1),fill=(255,255,255))
  d.rectangle((120,380,600,470),outline=(255,0,255),width=1);d.text((122,471),'stripe',fill=(255,0,255))
  im.save(out)
if __name__=='__main__':
  ref=load(__import__('os').environ.get('QF_R5H3_NPY','r5h3_pre_tmed.npy'))
  for p in sys.argv[1:]:
    a=load(p);print('==',p.split('/')[-1],'stripe std',stripe(a),'(r5h3',stripe(ref),')')
    for n,b in B10.items():
      m=med(a,b);t=T10[n];dm=max(abs(x-y) for x,y in zip(m,t));print('  %-18s 实测 %3d/%3d/%3d 目标 %3d/%3d/%3d 最大差 %3d %s'%(n,*m,*t,dm,'OK' if dm<=12 else 'FAIL'))
    for n,b in BX.items():
      m=med(a,b);r=med(ref,b);t=TX[n] or r;dm=max(abs(x-y) for x,y in zip(m,t));print('  +%-17s 实测 %3d/%3d/%3d r5h3同框 %3d/%3d/%3d 目标 %s 最大差 %3d'%(n,*m,*r,'/'.join(map(str,t)),dm))
