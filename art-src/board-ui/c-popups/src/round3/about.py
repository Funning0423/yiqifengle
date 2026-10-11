# 「关于」页（精简规则）：游戏名 + 版本号 + 开源许可。python3 about.py <c-popups>  → r3/about.png（+ 夜间 NIGHT=1 → r3/about_night.png）、r3/slices/
import sys, os, json, subprocess
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..')); sys.argv=[sys.argv[0],CP]
import compose as C
from ui_kit import *
OUT=os.path.join(CP,'r3'); SL=os.path.join(OUT,'slices'); os.makedirs(SL,exist_ok=True); C.OUT=OUT
# 许可清单：来自仓库实际用到的开源件（见 INTEGRATION.md §关于页）
LIC=[('霞鹜文楷 LXGW WenKai','SIL OFL 1.1'),('Fredoka','SIL OFL 1.1'),('Babel 辅助代码','MIT')]
WELL=(236,224,196) if not NIGHT else tuple(round(c*k) for c,k in zip((236,224,196),K_UI))
def about():
    RH=72; ph=104+128+32+len(LIC)*RH+32+40+72; top=round((H-ph)/2/8)*8
    bg=C.base('island'); ui=Image.new('RGBA',(W,H),(0,0,0,0))
    x0,y0,x1,y1=C.put_panel(ui,375,top,PW,ph,'关于'); d=ImageDraw.Draw(ui)
    cl=fitw(A('btn_close'),80); drop(ui,cl,x1-32,top+24,blur=4,alpha=0.30,dy=4)
    gn=baked_title('咦，起风了',56); paste_c(ui,gn,375,top+104+40)
    d.text((375,top+104+100),'v0.1 · 构建 '+C.GIT_SHA,font=font(26,False),fill=BROWN2,anchor='mm')
    y=top+104+128+32; wl=Image.new('RGBA',(528,len(LIC)*RH),(0,0,0,0)); ImageDraw.Draw(wl).rounded_rectangle((0,0,527,len(LIC)*RH-1),radius=24,fill=WELL+(255,)); ui.alpha_composite(wl,(375-264,y))
    for i,(n,l) in enumerate(LIC):
        cy=y+RH*i+RH/2
        d.text((375-264+32,cy),n,font=font(28),fill=BROWN,anchor='lm'); d.text((375+264-32,cy),l,font=font(24,False),fill=BROWN2,anchor='rm')
    y+=len(LIC)*RH+32
    d.text((375,y+20),'查看许可全文 ›',font=font(24,False),fill=TEAL,anchor='mm')
    return C.finish_frame('about_night' if NIGHT else 'about',bg,ui)
if __name__=='__main__':
    about()
    if not NIGHT:
        rows=[]
        def save(im,name,note):
            p=os.path.join(SL,name+'.png'); im.save(p); subprocess.run(['pngquant','--force','--skip-if-larger','--quality','70-92','--speed','1','--strip','--output',p,p])
            rows.append(dict(file=name+'.png',w=im.width,h=im.height,bytes=os.path.getsize(p),note=note))
        save(baked_title('关于'),'title_关于','标题木牌上的烘焙标题（霞鹜文楷 46 px）')
        save(baked_title('咦，起风了',56),'about_gamename','游戏名（霞鹜文楷 56 px）')
        old=json.load(open(os.path.join(SL,'cabin_hint.json'))) if os.path.exists(os.path.join(SL,'cabin_hint.json')) else {}
        json.dump(dict(rows=rows,version_label='v0.1 · 构建 <git 短 SHA>（BuildInfo.ts 注入）',licenses=LIC),open(os.path.join(SL,'about.json'),'w'),ensure_ascii=False,indent=1)
        print(rows)
