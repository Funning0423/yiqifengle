import sys;sys.path.insert(0,'.')
import emu,regions,tune_light as T,tune_water as TW,p33,params,numpy as np
from PIL import Image,ImageDraw
x=np.load('opt_w33.npy'); print('water',x)
WA=dict(p33.W33,main=float(x[0]),amb=float(x[1]),sky_strength=float(x[2]),floor=float(x[3]))
Pb=dict(T.P_light(1.0,0.75,False),water=p33.W33)          # c2eaf64 as shipped
Pa=dict(T.P_light(0.5,0.4,True),water=WA)                 # after
b=emu.shade(T.G,Pb); a=emu.shade(T.G,Pa)
Image.fromarray(b).save('emu_before_c2eaf64.png'); Image.fromarray(a).save('emu_after_final.png')
ref=Image.open('/workspace/wechat-game/art/regions/lakeside/renders/lakeside_r5h3_demo_lastframe.png').convert('RGB')
mac=Image.open('/workspace/wechat-game/ui-audit/2026-10-17/next-f60c8ec/v32/raw/lake_day_v32_layered_lake_bgonly_360x640.png').convert('RGB')
items=[('r5h3',ref),('Mac v3.2 (real)',mac),('emu c2eaf64',Image.fromarray(b)),('emu after',Image.fromarray(a))]
print(regions.table(items))
print('mid std before',round(TW.midstd([TW.gray(f) for f in TW.frames(Pb)]),2),'after',round(TW.midstd([TW.gray(f) for f in TW.frames(Pa)]),2))
W,H=360,640;S=Image.new('RGB',(W*4,H+28),(20,20,20));d=ImageDraw.Draw(S)
for i,(n,im) in enumerate(items):S.paste(im.resize((W,H)),(i*W,28));d.text((i*W+6,8),n+(' - Blender emulator proxy, not Creator' if 'emu' in n else ''),fill=(255,255,255))
S.save('compare_r5h3_mac_before_after.png')
