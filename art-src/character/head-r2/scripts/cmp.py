import os
# python3 cmp.py <rawdir> <out> : V12 head crops (front/side/back) vs render
import sys; from PIL import Image
R,O=sys.argv[1],sys.argv[2]
V=Image.open(os.environ.get('V12_REF') or os.path.join(os.path.join(os.path.dirname(os.path.abspath(__file__)),'../..'),'reference/character-ankle-balanced-v12.jpg')).convert('RGB')
# V12 head boxes in the 1536x1024 sheet (front, side, back): hat top to chin+collar
B=[(225,40,415,230),(665,40,855,230),(1125,40,1315,230)]
W=Image.new('RGB',(1800,1200),'white')
for i,(b,n) in enumerate(zip(B,['front','side','back'])):
    W.paste(V.crop(b).resize((600,600)),(600*i,0)); W.paste(Image.open(f'{R}/f_{n}.png').convert('RGB'),(600*i,600))
W.save(O)
