import sys,json;sys.path.insert(0,'.')
from opt_land import *
from PIL import ImageDraw
import params
V=json.load(open('final_land.json'));x=json.load(open('final_water.json'))
WA2=dict(p33.W33,main=x[0],amb=x[1],sky_strength=x[2],floor=x[3])
xo=np.load('opt_w33.npy');WA1=dict(p33.W33,main=float(xo[0]),amb=float(xo[1]),sky_strength=float(xo[2]),floor=float(xo[3]))
v34=emu.shade(G,dict(T.P_light(0.5,0.4,True),water=WA1)); r2=emu.shade(G,P_of(V,WA2))
Image.fromarray(r2).save('emu_r2_day.png')
mac=Image.open('/workspace/wechat-game/ui-audit/2026-10-17/next-f60c8ec/v32/raw/lake_day_v32_layered_lake_bgonly_360x640.png').convert('RGB')
items=[('r5h3',ref),('Mac v3.2 (real)',mac),('emu v3.4 48e71ba',Image.fromarray(v34)),('emu r2 c60ac55',Image.fromarray(r2))]
print(regions.table(items))
W,H=360,640;S=Image.new('RGB',(W*4,H+28),(20,20,20));d=ImageDraw.Draw(S)
for i,(n,im) in enumerate(items):S.paste(im.resize((W,H)),(i*W,28));d.text((i*W+6,8),n+(' (emulator proxy)' if 'emu' in n else ''),fill=(255,255,255))
S.save('compare_r5h3_mac_v34_r2.png')
# night: island night base = 0.35 x day base
q=lambda c:params.l2s8(c)
NT=dict(sun=[0.36,0.46,0.78],sky=[0.012,0.03,0.09],gnd=[0.02,0.022,0.04])
fogN=dict(params.FOG,color=(44,54,84)); clrN=(0x1c,0x27,0x40)
WN=lambda base:dict(base,main=0.8,amb=0.6,sky_strength=0.12)
def night(old):
  P=dict(params.V32); b=125000*0.35
  if old: P.update(sun_illum=b*1.0,amb_illum=b*0.6,sun_color_byte=q(NT['sun']),sky_byte=q(NT['sky']),ground_byte=q(NT['gnd']),water=WN(p33.W33))
  else: P.update(sun_illum=b*0.864,amb_illum=b*1.76,sun_color_byte=lin255(NT['sun']),sky_byte=lin255(NT['sky']),ground_byte=lin255(NT['gnd']),water=WN(WA2))
  P.update(fog=fogN,clear_byte=clrN); return emu.shade(G,P)
nb,na=night(True),night(False)
print(regions.table([('night r2 228df2f (sRGB-as-linear)',Image.fromarray(nb)),('night after (one conversion)',Image.fromarray(na))]))
S=Image.new('RGB',(W*2,H+28),(20,20,20));d=ImageDraw.Draw(S)
for i,(n,im) in enumerate([('night 228df2f (emu)',nb),('night c60ac55 (emu)',na)]):S.paste(Image.fromarray(im).resize((W,H)),(i*W,28));d.text((i*W+6,8),n,fill=(255,255,255))
S.save('compare_night_before_after.png')
