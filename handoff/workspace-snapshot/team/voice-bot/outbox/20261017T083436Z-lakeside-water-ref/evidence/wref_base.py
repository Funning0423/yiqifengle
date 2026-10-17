import sys,json,glob;sys.path.insert(0,'.')
from olive_fit import *
Rd='/workspace/wechat-game/art/regions/lakeside/renders/'
B={'far_water':(250,342,470,362),'mid_water':(260,400,460,450),'mid_water_R':(500,410,700,460),'under_bridge':(430,670,540,700),
 'near_mid_water':(322,788,450,810),'near_water_bottom':(160,1215,560,1270),'near_water_L':(14,1190,72,1267),
 'bridge_stone_deck':(335,563,385,588),'bridge_stone_left':(190,610,250,640),'bridge_rail_top':(300,512,420,522)}
def ld(p): return np.asarray(Image.open(p).convert('RGB').resize((720,1280))).astype(float)
def smed(a,b): x0,y0,x1,y1=b; return np.median(a[y0:y1,x0:x1].reshape(-1,3),0)
def stripe(a): return float(a[380:470,120:600].mean(1).std(0).mean())
nc=json.load(open('olive_cells.json'));G2=dict(G);alb=G['alb'].copy()
for k,b in nc.items(): g,c=k.split(':');alb[MS[g][c]]=s2l(b)
G2['alb']=alb   # = a6f39ed assets
