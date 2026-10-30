import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from render import *
cv=Cv(330,120,4); l=cv.layer(); d=ImageDraw.Draw(l); cv.rr(d,0,0,330,120,18,hx(C['face'])); cv.comp(l)
for i,(n,t) in enumerate((('music','音乐'),('sfx','音效'),('vibrate','震动（新）'))):
  icon(cv,f'icon_{n}.png',55+i*110,48,56); l=cv.layer(); d=ImageDraw.Draw(l); cv.text(d,55+i*110,100,t,13,hx(C['brown'])); cv.comp(l)
cv.out(3).convert('RGB').save(os.path.join(OUT,'icons_compare.png')); print('icons_compare')
