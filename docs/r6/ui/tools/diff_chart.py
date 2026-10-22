# 05–32 难度曲线示意（估算值，非实测）：柱=步数，线=难度估分 1–10，竖带=区域
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
fp=fm.FontProperties(fname='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc')
lv=list(range(5,33))
mv=[31,31,34,34,35,36,38,42, 33,36,38,43, 34,36,39,44, 35,37,36,45, 36,38,37,46, 38,40,42,48]
d=[3,3,3.5,4.5,5,5.5,6,7, 4,5,6,7, 5,6,7,8, 5.5,6.5,6,8.5, 6,7,6.5,8.5, 7,8,8.5,9.5]
reg=[(5,12,'草原/天空(现有)','#c9b185'),(13,16,'湖畔','#86c3bf'),(17,20,'雪山风铃','#c3d2ea'),(21,24,'灯塔海岸','#55668e'),(25,28,'林间小镇','#e6a08a'),(29,32,'风之庭院','#d8b25a')]
teach={13:'睡莲',17:'积雪风铃',21:'潮汐格',23:'星光块',25:'包裹箱',27:'铁轨',29:'四季风印'}
fig,ax=plt.subplots(figsize=(14,5.2),dpi=110); ax2=ax.twinx()
for a,b,n,c in reg: ax.axvspan(a-.5,b+.5,color=c,alpha=.28); ax.text((a+b)/2,51,n,ha='center',fontproperties=fp,fontsize=11)
ax.bar(lv,mv,color='#8a7a5a',alpha=.55,width=.6); ax.set_ylim(0,54); ax.set_ylabel('步数',fontproperties=fp)
ax2.plot(lv,d,'-o',color='#b2462a',lw=2.2); ax2.set_ylim(0,10.5); ax2.set_ylabel('难度估分 (1–10)',fontproperties=fp)
for k,v in teach.items(): ax2.annotate('教学:'+v,(k,d[lv.index(k)]),xytext=(0,14),textcoords='offset points',ha='center',fontproperties=fp,fontsize=9,color='#3b3220')
ax.set_xticks(lv); ax.set_xlabel('关卡',fontproperties=fp); ax.set_title('05–32 关难度曲线（建议值，未实测）：每区 4 关=教学→练习→组合→收尾，区首回落 1–2 档',fontproperties=fp)
plt.tight_layout(); plt.savefig('/workspace/r6/out/difficulty_13_32.png'); print('ok')
