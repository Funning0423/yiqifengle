import json
from PIL import Image,ImageDraw,ImageFont
import os
W=os.environ['OUT']+'/';O=json.load(open(W+'overlay.json'));R=W+'r/';OUT=os.environ.get('IMG',W+'../')+'/'
try:F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',16);f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
except:F=f=ImageFont.load_default()
def shot(k):
  im=Image.open(R+k+'.png').convert('RGB');d=ImageDraw.Draw(im,'RGBA');o=O[k]
  for q in o['ui']:d.rectangle([q['l'],q['t'],q['r'],q['b']],fill=(20,20,40,90),outline=(255,255,255,160))
  b=o['box']
  if b:
    ok=o['edge']>=8;d.rectangle([b['l'],b['t'],b['r'],b['b']],outline=(0,220,0,255) if ok else (255,0,0,255),width=2)
  return im
def label(im,t,sub):
  c=Image.new('RGB',(im.width,im.height+46),'white');c.paste(im,(0,46));d=ImageDraw.Draw(c);d.text((6,4),t,fill='black',font=F);d.text((6,25),sub,fill=(60,60,60),font=f);return c
def row(ims,gap=8):
  W=sum(i.width for i in ims)+gap*(len(ims)-1);H=max(i.height for i in ims);c=Image.new('RGB',(W,H),'white');x=0
  for i in ims:c.paste(i,(x,0));x+=i.width+gap
  return c
ed=lambda k:('%.1f pt'%O[k]['edge']) if O[k]['box'] else 'behind lens'
for st in ['05','06','07','08']:
  k0,k1=st+'_before_390x844',st+'_after_390x844'
  row([label(shot(k0),f'{st} BEFORE (3fb967af shared M1 lens)',f'390x844 · min edge {ed(k0)}'),label(shot(k1),f'{st} AFTER (own-node lens)',f'390x844 · min edge {ed(k1)}')]).save(OUT+f'compare_{st}_390x844.jpg',quality=85)
S=['390x844','414x896','360x780','375x667','320x568','390x520','768x1024']
for st in ['05','06','07','08']:
  for tag in ['before','after']:
    ims=[]
    for s in S:
      k=f'{st}_{tag}_{s}';im=label(shot(k),s,'edge '+ed(k));sc=844/im.height if im.height>844 else 1
      ims.append(im.resize((int(im.width*sc*0.6),int(im.height*sc*0.6))))
    row(ims).save(OUT+f'strip7_{st}_{tag}.jpg',quality=85)
all4=[Image.open(OUT+f'compare_{st}_390x844.jpg') for st in ['05','06','07','08']]
g=Image.new('RGB',(all4[0].width*2+16,all4[0].height*2+16),'white')
for i,im in enumerate(all4):g.paste(im,((i%2)*(im.width+16),(i//2)*(im.height+16)))
g.save(OUT+'compare_all_stages_390x844.jpg',quality=85)

fk=sorted([k for k in O if k.startswith('fold_')]);
if fk:row([label(shot(k),k,'t %.2f s · edge %s'%(O[k]['t'],ed(k))) for k in fk]).save(OUT+'fold_walk_M2M3_390x844.jpg',quality=85)
