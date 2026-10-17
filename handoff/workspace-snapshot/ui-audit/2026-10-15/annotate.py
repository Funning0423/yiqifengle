from PIL import Image,ImageDraw,ImageFont
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',26)
C={'高':(230,30,30),'中':(255,140,0),'低':(40,120,255)}
def ann(src,dst,items):
  im=Image.open('raw/'+src).convert('RGB');d=ImageDraw.Draw(im)
  for (x,y,w,h,no,sev,txt) in items:
    c=C[sev];X,Y,W,H=[v*2 for v in (x,y,w,h)]
    d.rectangle([X,Y,X+W,Y+H],outline=c,width=5)
    ty=Y-40 if Y>50 else Y+H+6;tx=max(4,min(X,im.width-560))
    t=f'#{no}[{sev}] {txt}';bb=d.textbbox((tx,ty),t,font=F);d.rectangle([bb[0]-6,bb[1]-4,bb[2]+6,bb[3]+4],fill=c);d.text((tx,ty),t,fill='white',font=F)
  im.save('annotated/'+dst)
for m in ['day','night']:
  ann(f'p750-{m}-09-result.png',f'p750-{m}-09-result-annotated.png',[
    (32,470,72,55,1,'高','宝箱贴左x=32'),(12,443,351,198,2,'高','奖励行x20–355压住面板描边'),(20,645,336,56,2,'高','按钮距面板底仅8px'),(194,647,160,44,9,'低','按钮立体厚度被缩到0.45')])
  ann(f'iphonese-{m}-09-result.png',f'iphonese-{m}-09-result-annotated.png',[
    (12,95,351,48,3,'高','标题牌被横幅遮挡+分页1/2'),(32,437,72,65,1,'高','宝箱贴左'),(20,520,336,40,3,'高','领取地区道具被挤到第2页')])
  ann(f'android360-{m}-09-result.png',f'android360-{m}-09-result-annotated.png',[(20,395,320,48,6,'中','提示折行孤字“旬”'),(32,466,72,65,1,'高','宝箱贴左')])
  for d,ip in [('p750',(71,95,224,67)),('iphonese',(71,95,224,67)),('android360',(63,95,224,67))]:
    sl={'p750':666,'iphonese':521,'android360':654}[d]
    ann(f'{d}-{m}-07-board.png',f'{d}-{m}-07-board-annotated.png',[(ip[0],ip[1]+30,ip[2],ip[3]-30,4,'中','测试横幅盖住关卡信息牌'),(140,sl,96,70,8,'低','道具栏单个道具孤立、离棋盘远')])
  ann(f'android360-{m}-03-island.png',f'android360-{m}-03-island-annotated.png',[(205,505,155,85,5,'低','路牌右缘距屏边仅约11px')])
  ann(f'p750-{m}-03-island.png',f'p750-{m}-03-island-annotated.png',[(215,505,160,85,5,'低','路牌右缘距屏边约15px')])
  ann(f'android360-{m}-05-settings.png',f'android360-{m}-05-settings-annotated.png',[(190,376,150,38,7,'中','分段钮图标小文字大,右钮贴框')])
  ann(f'p750-{m}-05-settings.png',f'p750-{m}-05-settings-annotated.png',[(194,376,150,38,7,'中','图标小文字大,右钮贴框')])
ann('iphonese-01-loading.png','iphonese-01-loading-annotated.png',[(110,240,160,30,10,'低','Cocos默认启动页,“Created with Cocos”叠在LOGO上')])
