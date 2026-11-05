import sys; from PIL import Image, ImageDraw
B,A,O=sys.argv[1:4]
sets={'face':['face_close','face_34'],'fullbody':['front','side','back34'],'seated':['seated_front','seated_side','seated_34']}
for k,names in sets.items():
    W,H=384,512; s=Image.new('RGB',(W*len(names),H*2+30),'white'); d=ImageDraw.Draw(s)
    for r,(lab,dd) in enumerate((('BEFORE e976a733',B),('AFTER char/polish-20261105',A))):
        for c,n in enumerate(names):
            s.paste(Image.open(f'{dd}/{n}.png').convert('RGB').resize((W,H)),(c*W,r*(H+30)+30)); d.text((c*W+6,r*(H+30)+34),n,fill='black')
        d.text((6,r*(H+30)+(8 if r==0 else -22+30)),lab,fill='black')
    s.save(f'{O}/{k}_before_after.jpg',quality=90)
