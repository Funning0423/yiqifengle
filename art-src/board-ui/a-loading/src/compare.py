from PIL import Image, ImageDraw, ImageFont, ImageFilter
O='/workspace/yiqifengle/previews/棋盘UI美术bot/a-loading'
P='/workspace/yiqifengle/previews/pm-audit/'
cw,ch=375,812
f=lambda s:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',s,index=2)
fr=lambda s:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',s,index=2)
def fit(im):
    im=im.convert('RGB'); r=max(cw/im.width,ch/im.height)
    im=im.resize((round(im.width*r),round(im.height*r)),Image.LANCZOS)
    x=(im.width-cw)//2;y=(im.height-ch)//2; return im.crop((x,y,x+cw,y+ch))
a2=fit(Image.open(P+'A2_native_cocos_splash.jpg'))
a1=Image.open(P+'A1_loading-reference_current.jpg').convert('RGB')
a1=a1.resize((a1.width//40,a1.height//40),Image.BILINEAR).resize(a1.size,Image.NEAREST).filter(ImageFilter.GaussianBlur(6))
a1=fit(a1); d=ImageDraw.Draw(a1)
d.rectangle((20,340,355,470),fill=(40,40,40))
for i,t in enumerate(['第三方电影截图（已打码）','版权素材 · 必须删除','此处不复制原图']): d.text((40,352+i*38),t,font=f(24),fill=(255,220,200))
new=[fit(Image.open(O+f'/loading_final_{p:03d}.png')) for p in (0,50,100)]
G=24; top=120; W=G+5*(cw+G); H=top+ch+150
c=Image.new('RGB',(W,H),(244,239,228)); d=ImageDraw.Draw(c)
d.text((G,24),'《咦，起风了》加载页 (a) 定稿预览 — 现状 vs 新版「窗前起风」',font=f(36),fill=(45,85,91))
d.text((G,74),'现状：标题(Songti 宋体图) → 遮罩 → 电影截图 → 硬切房间，停两次；新版：一个原创加载页，进度 0/50/100%，加载完淡出直接进房间',font=fr(20),fill=(80,90,90))
labels=['现状① Cocos 启动画面（宋体字图）','现状② 加载图（电影截图）','新版 · 0%','新版 · 50%','新版 · 100%（随后 0.7s 淡出进房间）']
ims=[a2,a1]+new
d.rectangle((G+2*(cw+G)-10,top-10,W-G+10,top+ch+10),outline=(47,167,176),width=4)
for i,(im,l) in enumerate(zip(ims,labels)):
    x=G+i*(cw+G); c.paste(im,(x,top)); d.text((x,top+ch+14),l,font=fr(19),fill=(45,85,91))
d.text((G,top+ch+56),'现状包体：电影截图 129,312 B（resources 分包，需等 1.57 MB 分包）+ 临时标题 13,167 B ＝ 142,479 B（且均有授权风险）',font=fr(19),fill=(120,60,40))
d.text((G,top+ch+88),'新版包体：实测见 README（底图占位 JPG + 5 张切图，主包内）· 标题字体 霞鹜文楷 Medium（SIL OFL 1.1）· 底图为 A4 概念图占位，待运镜bot 渲染',font=fr(19),fill=(45,85,91))
c.save(O+'/compare_current_vs_new.png'); 
c.convert('RGB').save(O+'/compare_current_vs_new.jpg',quality=85)
print(c.size)
