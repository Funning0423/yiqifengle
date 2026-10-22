# r3 sheet + measurement: same frame files, same boxes/masks for every state. Masks come from the DAY frame
# (grass = green-dominant pixels, court stone = near-white pixels) inside fixed boxes, then applied to all three states.
import numpy as np,json,os,sys
from PIL import Image,ImageDraw,ImageFont
D='/workspace/b16night/';OUT=sys.argv[1]
def lin(a):a=a/255.;return np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
def Y(a):return .2126*a[...,0]+.7152*a[...,1]+.0722*a[...,2]
def srgb(y):return float(np.where(y<=.0031308,y*12.92,1.055*y**(1/2.4)-.055))
BOX={'board':{'grass':(30,590,370,830),'court':(110,405,300,490)},'arrival':{'lower':(0,470,390,840)}}
st=['night_before','night_after','day'];lab={'night_before':'修前 夜间','night_after':'修后 夜间','day':'白天'}
sh=['arrival','board'];shl={'arrival':'气球抵达(近似)','board':'棋盘 390x844'}
img={(s,t):np.asarray(Image.open(f'{D}r3_{s}_{t}.png').convert('RGB')).astype(float) for s in sh for t in st}
stats={}
for s in sh:
  day=img[(s,'day')]
  for reg,(x0,y0,x1,y1) in BOX[s].items():
    m=np.zeros(day.shape[:2],bool);m[y0:y1,x0:x1]=True
    if reg=='grass':m&=(day[...,1]>day[...,0]+20)&(day[...,1]>day[...,2]+20)
    if reg=='court':m&=(day.min(-1)>190)
    for t in st:
      a=img[(s,t)];y=Y(lin(a))[m];c=a[m].mean(0)
      stats[f'{s}/{reg}/{t}']={'pixels':int(m.sum()),'linear':round(float(y.mean()),4),'srgb_of_mean':round(srgb(y.mean()),3),'mean_sRGB_rgb':[int(round(v)) for v in c]}
  for t in st:a=img[(s,t)];y=Y(lin(a));stats[f'{s}/frame/{t}']={'linear':round(float(y.mean()),4),'srgb_of_mean':round(srgb(y.mean()),3)}
W,H=390,844;pad=70;F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',14)
sheet=Image.new('RGB',(W*3,(H+pad)*2+30),(20,20,24));d=ImageDraw.Draw(sheet)
col={'grass':(255,80,80),'court':(255,220,0),'lower':(255,80,80)}
for r,s in enumerate(sh):
  for c,t in enumerate(st):
    y=r*(H+pad);sheet.paste(Image.fromarray(img[(s,t)].astype('uint8')),(c*W,y+pad))
    for reg,(x0,y0,x1,y1) in BOX[s].items():d.rectangle((c*W+x0,y+pad+y0,c*W+x1-1,y+pad+y1-1),outline=col[reg],width=2)
    d.text((c*W+6,y+2),f'{shl[s]} · {lab[t]}',fill=(240,240,240),font=F)
    for i,reg in enumerate(BOX[s]):
      q=stats[f'{s}/{reg}/{t}'];d.text((c*W+6,y+20+i*17),f'{reg}: 线性{q["linear"]:.3f} sRGB{q["srgb_of_mean"]:.2f} rgb{tuple(q["mean_sRGB_rgb"])}',fill=col[reg],font=F)
d.text((6,sheet.height-24),'Blender 5.2.2 EEVEE 引擎等效渲染：场景主光125000lux(夜x0.35月光)+环境光20000(不随夜变)@EV15；框=测量区(草/石地按白天像素遮罩)',fill=(200,200,200),font=F)
sheet.save(OUT,quality=88,optimize=True);json.dump(stats,open(OUT.replace('.jpg','.json'),'w'),indent=1);print(os.path.getsize(OUT));print(json.dumps(stats))
