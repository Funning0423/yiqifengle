# overlay safe areas + projected data onto renders. usage: python3 overlay.py raw.png check.json aspect out.png [edge_x0,edge_x1,edge_y]
import sys, json
from PIL import Image, ImageDraw
raw,cj,asp,out=sys.argv[1:5]; d=json.load(open(cj)); a=d['per_aspect'][asp]
im=Image.open(raw).convert('RGBA'); W,H=im.size; ov=Image.new('RGBA',im.size,(0,0,0,0)); g=ImageDraw.Draw(ov)
px=lambda x:(x+1)/2*W; py=lambda y:(1-y)/2*H
# UI band
g.rectangle([0,py(-0.5),W,H],fill=(20,20,40,110)); g.line([0,py(-0.5),W,py(-0.5)],fill=(255,220,60,255),width=3)
g.text((6,py(-0.5)+6),'NDC y=-0.5  nav buttons (bottom 25%)',fill=(255,240,200,255))
# |x|=0.7 and y=0.75 character limits (island rule)
for x in(-0.7,0.7): g.line([px(x),0,px(x),H],fill=(255,255,255,120),width=1)
g.line([0,py(0.75),W,py(0.75)],fill=(255,255,255,120),width=1); g.text((px(-0.7)+4,py(0.75)+2),'y=0.75',fill=(255,255,255,200))
# true horizon
hy=a['true_horizon_ndc_y']; g.line([0,py(hy),W,py(hy)],fill=(80,200,255,200),width=1); g.text((4,py(hy)-14),'true horizon y=%.3f'%hy,fill=(80,200,255,255))
# target crosshair
t=a['points_ndc']['target']; g.line([px(t[0])-10,py(t[1]),px(t[0])+10,py(t[1])],fill=(255,0,255,255),width=2); g.line([px(t[0]),py(t[1])-10,px(t[0]),py(t[1])+10],fill=(255,0,255,255),width=2)
# walk path anchors
for i in range(23):
    p=a['points_ndc']['walk_path_%02d'%i]; g.ellipse([px(p[0])-3,py(p[1])-3,px(p[0])+3,py(p[1])+3],outline=(255,120,0,255),width=2)
# girl bbox
b=a['characters']['girl_at_player_spawn_1.73m_hat']['bbox_ndc[xmin,xmax,ymin,ymax]']
g.rectangle([px(b[0]),py(b[3]),px(b[1]),py(b[2])],outline=(255,40,40,255),width=2); g.text((px(b[1])+4,py(b[3])),'girl 1.73m @player_spawn',fill=(255,60,60,255))
if len(sys.argv)>5:
    x0,x1,y=map(float,sys.argv[5].split(',')); g.ellipse([px(x0)-6,py(y)-14,px(x1)+6,py(y)+14],outline=(255,0,0,255),width=3); g.text((px(x0)-150,py(y)+16),'terrain edge (z=-80) visible',fill=(255,30,30,255))
p=d['input']['pose']['position']; g.text((6,6),'pos %s  target %s  vFOV 45  aspect %s  %dx%d'%(p,[round(v,3) for v in d['input']['pose']['target']],asp,W,H),fill=(255,255,255,255))
Image.alpha_composite(im,ov).convert('RGB').save(out); print(out)
