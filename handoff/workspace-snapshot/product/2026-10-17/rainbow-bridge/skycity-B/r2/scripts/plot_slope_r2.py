import json, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
import os
for f in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc']:
    if os.path.exists(f): fm.fontManager.addfont(f); plt.rcParams['font.family']=fm.FontProperties(fname=f).get_name(); break
R='../skycity-B/r2/'; d=json.load(open(R+'slope_profile.json')); rows=d['rows']
s=[r['s'] for r in rows]; y=[r['y'] for r in rows]; th=[r['slopeDeg'] for r in rows]; pr=[r['pitchRateDegPerS'] for r in rows]; t=[r['t'] for r in rows]
fig,ax=plt.subplots(3,1,figsize=(11,9),sharex=True)
cols={'meadow_ramp':'#5aa646','bridge':'#d24bd2','walkway':'#2a8fd8'}
for seg,c in cols.items():
    idx=[i for i,r in enumerate(rows) if r['seg']==seg]
    if not idx: continue
    xs=[s[i] for i in idx]
    ax[0].plot(xs,[y[i] for i in idx],c=c,lw=2.5,label={'meadow_ramp':'草地出口缓坡（改地形 +1.5 m）','bridge':'彩虹桥爬坡','walkway':'桥头栈台（平）'}[seg])
    ax[1].plot(xs,[th[i] for i in idx],c=c,lw=2.5); ax[2].plot(xs,[pr[i] for i in idx],c=c,lw=2.5)
ax[0].set_ylabel('高度 y (m, 旅途世界)'); ax[0].legend(loc='upper left'); ax[0].grid(alpha=.3)
ax[1].axhline(35,c='r',ls='--',lw=1); ax[1].text(s[0],35.6,'上限 35°',color='r'); ax[1].set_ylabel('坡度 (°)'); ax[1].grid(alpha=.3)
ax[2].axhline(5,c='r',ls='--',lw=1); ax[2].axhline(-5,c='r',ls='--',lw=1); ax[2].text(s[0],5.3,'±5 °/s',color='r'); ax[2].set_ylabel('俯仰速度 (°/s @1.2 m/s)'); ax[2].grid(alpha=.3)
for scr,v in d['stopsS'].items():
    for a in ax: a.axvline(v,c='#999',lw=.6,ls=':')
    ax[0].text(v,y[0]+0.2,scr,rotation=90,fontsize=7,color='#555',va='bottom')
for a in ax: a.axvline(d['bridgeStartS'],c='k',lw=.8); a.axvline(d['bridgeEndS'],c='k',lw=.8)
ax[2].set_xlabel('沿路线弧长 s (m)，从 appr2[0] 起；竖虚线 = 各屏停点')
sec=ax[0].secondary_xaxis('top',functions=(lambda x:x/1.2,lambda x:x*1.2)); sec.set_xlabel('时间 t (s)')
fig.suptitle(f"天空之城 方案B r2 坡度剖面：最陡 {d['maxSlopeDeg']:.1f}°，最大俯仰速度 {d['maxPitchRateDegPerS']:.2f} °/s",fontsize=14)
fig.tight_layout(); fig.savefig(R+'slope_profile.png',dpi=110); print('ok')
