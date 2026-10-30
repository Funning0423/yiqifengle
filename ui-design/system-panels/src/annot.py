import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from render import *
F=ImageFont.truetype(SERIF_B,22,index=2); RED=(214,52,52,255)
def mk(img,notes,boxes,name):
  W=img.width; o=Image.new('RGBA',(W+960,img.height),(250,244,232,255)); o.alpha_composite(img); d=ImageDraw.Draw(o)
  for (x,y,w,h) in boxes: d.rectangle([x*2,y*2,(x+w)*2,(y+h)*2],outline=RED,width=2)
  for y,t in notes: d.line([W-10,y*2,W+20,y*2],fill=RED,width=2); d.text((W+28,y*2),t,font=F,fill=(60,40,20),anchor='lm')
  o.convert('RGB').save(os.path.join(OUT,name)); print(name)
A=SP['advisory']; ty=A['titleY']
mk(advisory(K=4).out(2),[(60,"背景 #FBF4E4→#F2E1C0 竖向渐变 + 顶部暖光 #FFF6DA"),(ty,f"标题 Noto Serif SC Bold {A['titleSize']}pt 字距{A['titleTracking']} #5A3A1E · 中心 y={ty}"),
 (ty+A['ruleGap'],f"分隔线 {A['ruleW']}×1.5pt #D9BF8C + Ø6 点 #C39A5E"),(ty+A['firstLineDy'],f"正文 Regular {A['bodySize']}pt 行距 {A['lineH']}pt 字距2 #6B4A2E（对比 7.3:1）"),
 (ty+A['firstLineDy']+3*A['lineH'],"四行居中，行宽 ≈252pt，左右余量 ≥69pt（320 宽 ≥34pt）"),
 (844-A['footBottom'],f"信息标识【占位】{A['footSize']}pt #6B4A2E（对比 ≥4.5:1）· 无版号时整块不显示"),
 (800,"低多边形远山两层 #E8D2A6 / #E1C797 / #DCC08E"),(844-A['hintBottom']+14,"「轻点继续」12pt α0.8，1.5 s 后淡入")],[],'annot_advisory_390.png')
S=SP['settings']; pw=S['w']; x=(390-pw)/2; y=(844-S['h'])/2+S['dy']; rows=[y+S['firstRowY']+i*S['rowH']+(S['groupGap'] if i>=3 else 0) for i in range(5)]
mk(settings(K=4).out(2),[(y-14,f"面板 {pw}×{S['h']}pt r26 · 左右边距 {int(x)}pt（窄屏 ≥{S['minMargin']}）"),(y+4,"框 #D9BF8C / 底厚 5pt #B8966A / 面 #F8EDD3 · 投影 #281A0E α35% 模糊14"),
 (y+S['closeInset'],f"关闭 Ø{S['closeD']} 视觉 / 44×44 触控 · 圆心距框角 {S['closeInset']}pt"),(y+S['titleY']+8,f"标题「设置」Bold {S['titleSize']}pt 字距6 #5A3A1E"),
 (rows[0],f"行高 {S['rowH']}pt · 图标 {S['iconH']}pt @x+{S['iconX']} · 文字 Bold {S['labelSize']}pt @x+{S['labelX']}"),
 (rows[1],"整行可点 %d×%dpt（≥44）· 开关右缘距面板 %dpt"%(pw-40,S['rowH'],S['toggleRight'])),(rows[2],"开关轨道 52×30 r15 · 旋钮 Ø24 · 开 #377F6C / 关 #DCCBA8"),
 (rows[2]+S['rowH']/2+S['groupGap']/2,f"虚线分组（6/6pt，1.5pt #D9BF8C），组间距 {S['groupGap']}pt"),(rows[4],"夜色 / 减少动态：沿用现有功能，统一成开关"),
 (y+S['h']-S['footBottom'],f"关于 · 版本 Regular {S['footSize']}pt #7A5A3A（整行 44pt 可点）")],
 [(x+20,rows[1]-S['rowH']/2,pw-40,S['rowH']),(x+pw-S['closeInset']-22,y+S['closeInset']-22,44,44)],'annot_settings_390.png')
U=SP['update']; pw=U['w']; x=(390-pw)/2; y=(844-U['h'])/2+U['dy']
mk(update(K=4).out(2),[(y,f"卡片 {pw}×{U['h']}pt（同设置面板材质）· 左右边距 {int(x)}pt"),(y+U['emblemY'],f"焦点：四叶低多边形风车 R{U['emblemR']} + 暖光 #FFDC8C R{U['emblemGlow']}"),
 (y+U['titleY'],f"标题 Bold {U['titleSize']}pt #5A3A1E「{U['title']}」"),(y+U['bodyY'],f"说明 Regular {U['bodySize']}pt #6B4A2E「{U['body']}」"),
 (y+U['btnY'],f"主按钮 WarmButton primary {U['btnW']}×{U['btnH']}pt · 文字 Bold 18pt #FFF0CB"),(y+U['laterY'],f"「稍后」{U['laterSize']}pt #7A5A3A · 触控 120×44pt")],
 [(195-60,y+U['laterY']-22,120,44),(195-U['btnW']/2,y+U['btnY']-U['btnH']/2,U['btnW'],U['btnH'])],'annot_update_390.png')
