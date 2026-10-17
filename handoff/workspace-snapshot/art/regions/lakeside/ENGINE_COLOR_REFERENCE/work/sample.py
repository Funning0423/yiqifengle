import numpy as np, json, glob
from PIL import Image
R='/workspace/wechat-game/art/regions/lakeside/renders/'
E='/workspace/wechat-game/ui-audit/2026-10-17/next-f60c8ec/v32/raw/'
B={
 'far_water':(250,342,470,362),
 'mid_water':(260,400,460,450),
 'mid_water_R':(500,410,700,460),
 'under_bridge':(430,670,540,700),
 'near_mid_water':(322,788,450,810),
 'near_water_bottom':(160,1215,560,1270),
 'near_water_L':(14,1190,72,1267),
 'bridge_stone_deck':(335,563,385,588),
 'bridge_stone_left':(190,610,250,640),
 'bridge_rail_top':(300,512,420,522),
}
def load(p): return np.asarray(Image.open(p).convert('RGB').resize((720,1280))).astype(float)
def med(a,b): x0,y0,x1,y1=b; return [int(round(v)) for v in np.median(a[y0:y1,x0:x1].reshape(-1,3),0)]
def tmed(files):
  st=np.stack([load(f) for f in files[::4]]); return np.median(st,0)
imgs={
 'r5h3_pre_f61':load(R+'r5h3/f61.png'),
 'r5h3_graded_g61':load(R+'r5h3/g61.png'),
 'r5h3_pre_timemedian':tmed(sorted(glob.glob(R+'frames_lakeside_r5h3_demo_8s/f_*.png'))),
 'r5h3_graded_timemedian':tmed(sorted(glob.glob(R+'graded_lakeside_r5h3_demo_8s/g_*.png'))),
 'r5h3_lastframe(audit ref)':load(R+'lakeside_r5h3_demo_lastframe.png'),
 'engine_v32_layered':load(E+'lake_day_v32_layered_lake_bgonly_360x640.png'),
 'engine_v32_linear60':load(E+'lake_day_v32_linear60_lake_bgonly_360x640.png'),
 'engine_v32_off':load(E+'lake_day_v32_off_lake_bgonly_360x640.png'),
}
out={k:{n:med(a,b) for n,b in B.items()} for k,a in imgs.items()}
# band metric: vertical std of row-means in mid-lake
for k,a in imgs.items():
  rows=a[380:470,120:600].mean(1); out[k]['_midlake_rowmean_std']=round(float(rows.std(0).mean()),1)
json.dump({'frame_px':[720,1280],'boxes_x0y0x1y1':B,'values':out},open('samples.json','w'),indent=1)
ks=list(imgs)
print('zone'.ljust(20),' | '.join(k[:16].ljust(11) for k in ks))
for n in list(B)+['_midlake_rowmean_std']:
  print(n.ljust(20),' | '.join(('%d/%d/%d'%tuple(out[k][n]) if isinstance(out[k][n],list) else str(out[k][n])).ljust(11) for k in ks))
