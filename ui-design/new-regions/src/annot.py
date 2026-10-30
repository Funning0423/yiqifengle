import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from screens import *
F=ImageFont.truetype(SERIF_B,22,index=2); RED=(214,52,52,255)
def mk(img,notes,boxes,name):
  W=img.width; o=Image.new('RGBA',(W+980,img.height),(250,244,232,255)); o.alpha_composite(img); d=ImageDraw.Draw(o)
  for (x,y,w,h) in boxes: d.rectangle([x*2,y*2,(x+w)*2,(y+h)*2],outline=RED,width=2)
  for y,t in notes: d.line([W-10,y*2,W+20,y*2],fill=RED,width=2); d.text((W+28,y*2),t,font=F,fill=(60,40,20),anchor='lm')
  o.convert('RGB').save(os.path.join(OUT,name)); print(name)
pw=330; ph=520; x=(390-pw)/2; y=(844-ph)/2-6; ix=x+24; iw=pw-48; fy=y+122; ry0=fy+128
mk(journey(K=4).out(2),[(y-12,f"面板 {pw}×{ph}pt（W−40 封顶 330）· 边距 {int(x)}pt · 高度固定，不随地区数增长"),(y+24,"关闭 Ø34 / 触控 44×44"),(y+36+8,"标题「旅程册」Bold 22pt 字距6 #5A3A1E"),
 (y+78,f"总进度「旅程 14 / 27」Bold 15pt · 分母=有关卡数据地区的关卡和（动态）"),(y+101,f"分段进度条 {iw}×10pt r5 · 段数/宽度按有数据地区动态算（现 5 段 4/4/4/6/9），代码绘制 · 段缝 2pt · 底 #E6D7B8"),
 (fy+56,f"焦点卡 {iw}×112pt r16 #FFF6E2 底 3pt #D9BF8C · 地区窗 120×78 · 印章 30pt"),(fy+38,"地区名 Bold 18pt · 「2 / 6 关」Regular 14pt · 「继续 ›」Bold 14pt #377F6C"),
 (ry0+25,"紧凑行 50pt（矮屏 44）· 印章 32pt · 名称 Bold 16pt · 整行可点 282×50"),(ry0+75,"完成：x/x + Ø18 青色勾"),(ry0+175,"海岸：主线 12 后与湖畔并行开启 → 湖畔 2/6 时已「可前往」· 红点代码绘制"),
 (ry0+225,"已知未开启：灰章 + 条件 Regular 13pt #7A5A3A（≥4.5:1）"),(y+ph-10,"未揭晓：空白章 +「远方」+「继续旅行后揭晓」，不可点")],
 [(ix-4,ry0+3*50,iw+8,50),(x+pw-46,y+2,44,44)],'annot_journey_390.png')
ph=430; y=(844-ph)/2-6; ww=pw-64; wh=ww*136/208
mk(chapter(K=4).out(2),[(y+36,"地区页标题 = 地区名 Bold 22pt"),(y+70+wh/2,f"地区窗 {int(ww)}×{int(wh)}pt · 左上印章 40pt"),(y+70+wh+26,"一句描述 Regular 15pt #6B4A2E"),(y+70+wh+56,"关数 / 状态 14pt #377F6C"),
 (y+ph-52,"唯一按钮 WarmButton primary 240×52（全游戏统一宽）· 距底 26pt"),(y+ph-20,"未开启：扁平禁用钮 #E6D7B8 文案「尚未开启」+ 上方条件")],[(195-120,y+ph-78,240,52)],'annot_chapter_390.png')
mk(ending(K=4).out(2),[(523,"6 枚印章 Ø40（原 44）间距 48 · 总宽 280pt · 两端轻垂 ≤7pt 成弧"),(560,"未得：空白章 α0.85（不剧透图案）· 已得：彩色"),(430,"其他元素不变（EndingScreen v2.1）")],[(195-140-20,500,320,50)],'annot_ending_390.png')
