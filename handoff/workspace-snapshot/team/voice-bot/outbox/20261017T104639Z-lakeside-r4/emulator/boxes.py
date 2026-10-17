import numpy as np
# 720x1280 frame of the 360x640 bg-only capture (engine board background camera, see pose_360x640.json)
B={'far_water':(330,505,520,528),'mid_water':(310,566,530,579),'mid_water_R':(480,579,620,591),'under_bridge':(400,548,470,562),
 'near_mid_water':(322,622,450,632),'near_water_bottom':(160,776,560,796),'near_water_L':(14,742,72,792),
 'bridge_stone_deck':(335,474,385,484),'bridge_stone_left':(176,538,236,548),'bridge_rail_top':(360,442,366,450)}
STRIPE=(120,715,600,790)
def smed(a,b): x0,y0,x1,y1=b; return np.median(a[y0:y1,x0:x1].reshape(-1,3),0)
def stripe(a): x0,y0,x1,y1=STRIPE; return float(a[y0:y1,x0:x1].mean(1).std(0).mean())
# land regression boxes (reported, not in the pass bar)
BX={'grass_near':(100,950,620,1100),'far_hills':(250,200,420,260),'mtn_snow':(300,110,380,160),'tree_crown':(330,320,360,345),'house_wall':(150,470,200,500),'far_shore':(560,560,620,575)}
