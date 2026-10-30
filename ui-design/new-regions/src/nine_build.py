import os,sys,shutil,subprocess; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from nine import *
from build import lab,row as hrow
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
st3=dict(ST,coast='done',snow='done'); p3=dict(EX,coast=9,snow=6); nine.FOCUS='snow'; c=planC(K=3,prog=p3,st=st3)[0].out(1.5); nine.FOCUS='coast'
save(hrow([lab(a,'早期：完成 / 进行中 / 未开启 / 远方',20),lab(b,'中期：「雪山山口」格按下（当帧底色变深）',20),lab(c,'后期：前 6 区完成，7–9 远方（条件待定）',20)],16),'states_C.png')
e=[]
for lay,t in (('one','单排 Ø28 间距 31'),('arc','大弧 Ø32'),('two','两排 5+4 Ø36（推荐）')):
  e.append(lab(ending9(K=3,layout=lay).out(1.5),t+' · 390',20)); e.append(lab(ending9(320,568,K=3,layout=lay).out(1.5),'320×568',20))
save(hrow(e,16),'ending9_options.png')
save(ending9(K=4).out(2),'ending9_390.png'); save(ending9(320,568,K=4).out(2),'ending9_320x568.png')
save(hrow([lab(ending9(K=1.5,t=t).out(1),f'{int(t*1000)} ms',16) for t in (0,0.15,0.3,0.5,0.75)],12),'ending9_keyframes.png')
print('minseg 320:',planC(320,568,K=1)[2],' 390:',planC(K=1)[2])
