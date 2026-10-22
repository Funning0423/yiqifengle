from PIL import Image,ImageDraw
import os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','preview'))
vs=['front','side','back','34','top30'];rows=[]
for v in vs:
  a=Image.open(f'raw/before_{v}.png');b=Image.open(f'raw/after_{v}.png');W=Image.new('RGB',(a.width*2,a.height),'white');W.paste(a,(0,0));W.paste(b,(a.width,0))
  d=ImageDraw.Draw(W);d.text((8,8),f'cand3b (no accessory) - {v}',fill=(0,0,0));d.text((a.width+8,8),f'scarf_v1 + lantern_v1 - {v}',fill=(0,0,0));W.save(f'compare_{v}.png');rows.append(W)
S=Image.new('RGB',(rows[0].width,rows[0].height*5),'white')
for i,r in enumerate(rows): S.paste(r,(0,i*r.height))
S.resize((S.width//2,S.height//2)).save('compare_all_small.jpg',quality=85)
for n in ['scarf_close_front','scarf_close_side','scarf_close_back','lantern_close_front','lantern_close_side']: Image.open(f'raw/c_{n}.png').save(f'{n}.png')
