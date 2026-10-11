import json,sys
from PIL import Image,ImageDraw,ImageFont
src,shots,out,title,cols=sys.argv[1],json.load(open(sys.argv[2])),sys.argv[3],sys.argv[4],int(sys.argv[5])
try:F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15);FT=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
except Exception:F=FT=ImageFont.load_default()
W,H=293,633;rows=(len(shots)+cols-1)//cols;S=Image.new('RGB',(W*cols,H*rows+40),(20,20,20));d=ImageDraw.Draw(S);d.text((8,10),title,fill=(255,220,0),font=FT)
for i,s in enumerate(shots):
  im=Image.open(src+'/'+s['name']+'.png').convert('RGB').resize((W,H));x,y=(i%cols)*W,40+(i//cols)*H;S.paste(im,(x,y));dd=ImageDraw.Draw(S)
  dd.rectangle([x,y,x+W,y+44],fill=(0,0,0));words=s['label'];dd.text((x+4,y+3),words[:38],fill=(255,255,255),font=F);dd.text((x+4,y+22),words[38:80],fill=(200,200,200),font=F)
S.save(out,quality=88);print(out)
