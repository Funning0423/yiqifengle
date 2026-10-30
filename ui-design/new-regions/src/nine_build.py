import os,sys,shutil,subprocess; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from nine import *
from PIL import ImageFont
def lab(img,txt,size=26):
  f=ImageFont.truetype(SERIF_B,size,index=2); w,h=img.size; o=Image.new('RGBA',(w,h+size+20),(250,244,232,255)); o.alpha_composite(img,(0,size+20)); ImageDraw.Draw(o).text((w//2,10),txt,font=f,fill=(60,40,20),anchor='mt'); return o
def hrow(imgs,gap=24):
  H=max(i.height for i in imgs); o=Image.new('RGBA',(sum(i.width for i in imgs)+gap*(len(imgs)+1),H+2*gap),(250,244,232,255)); x=gap
  for i in imgs: o.alpha_composite(i,(x,gap)); x+=i.width+gap
  return o
def save(img,name): img.convert('RGB').save(os.path.join(NOUT,name),optimize=True); print(name,img.size,flush=True)
SIZES=[(320,568),(360,780),(375,667),(390,844),(402,874),(414,896),(430,932)]
ims=[]
for nm,fn in (('A 全部列表（行高 44）',planA),('B 已完成收起 + 远方合并',planB),('C 焦点卡 + 3×3 印章格（推荐）',planC)):
  c,ph,_=fn(K=3); c2,ph2,_=fn(320,568,K=3)
  ims.append(lab(c.out(1.5),f'{nm} · 390 高 {ph}pt',20)); ims.append(lab(c2.out(1.5),f'320×568 高 {ph2}pt'+(' ✗超出' if ph2>548 else ' ✓'),20))
save(hrow(ims,16),'compare_plans.png')
save(planC(K=4)[0].out(2),'journey_C_390.png'); save(planC(320,568,K=4)[0].out(2),'journey_C_320x568.png')
save(hrow([lab(planC(W,H,K=2)[0].out(1),f'{W}×{H}',18) for W,H in SIZES],16),'sizes_7_C.png')
# 格子状态
st1={'tide':'done','meadow':'progress','sky':'locked','lake':'far','coast':'far','snow':'far','rail':'far','cloud':'far','spring':'far'}
p1={'tide':4,'meadow':2,'sky':0,'lake':0,'coast':0,'snow':0,'rail':0,'cloud':0,'spring':0}
import nine; nine.FOCUS='meadow'; a=planC(K=3,prog=p1,st=st1)[0].out(1.5)
nine.FOCUS='coast'; b=planC(K=3,pressed=5)[0].out(1.5)
st3=dict(ST,coast='done',snow='done',rail='open',cloud='open',spring='locked'); p3=dict(EX,coast=9,snow=6); nine.FOCUS='snow'; c=planC(K=3,prog=p3,st=st3)[0].out(1.5); nine.FOCUS='coast'
save(hrow([lab(a,'早期：完成 / 进行中 / 未开启 / 远方',20),lab(b,'中期：铁路/云海为灰章+条件，温泉谷为远方；雪山格按下',20),lab(c,'后期：铁路、云海可前往、温泉谷「铁路云海后」',20)],16),'states_C.png')
print('minseg 320:',planC(320,568,K=1)[2],' 390:',planC(K=1)[2])
