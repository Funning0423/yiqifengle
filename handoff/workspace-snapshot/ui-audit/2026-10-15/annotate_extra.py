exec(open('annotate.py').read().split('for m in')[0])
for m in ['day','night']:
  ann(f'p750-{m}-12-skycity.png',f'p750-{m}-12-skycity-annotated.png',[(12,95,351,40,4,'中','测试横幅压住天空城上部')])
  ann(f'p750-{m}-10-chest-reward.png',f'p750-{m}-10-chest-reward-annotated.png',[(119,319,138,138,0,'低','获得面板宝箱居中 OK')])
  ann(f'p750-{m}-04-island-bag.png',f'p750-{m}-04-island-bag-annotated.png',[(40,110,300,40,0,'低','行囊面板无越界 OK')])
  ann(f'iphone15pro-{m}-07-board-annotated.png'.replace('-annotated',''),f'iphone15pro-{m}-07-board-annotated.png',[(80,137,224,37,4,'中','测试横幅盖住关卡信息牌'),(165,706,64,64,8,'低','道具栏单个道具离棋盘远')])
  ann(f'iphone15pro-{m}-09-result.png',f'iphone15pro-{m}-09-result-annotated.png',[(32,484,72,65,1,'高','宝箱贴左x=32'),(20,671,354,48,2,'高','按钮距面板底8px')])
