# soft warm sun-reflection sheen on upper-right water (no edges); mirrors Cocos additive water spec
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops
im=Image.open(sys.argv[1]).convert('RGB'); w,h=im.size
m=Image.new('L',(w,h),0); d=ImageDraw.Draw(m)
d.ellipse((int(w*.42),int(h*.30),int(w*.98),int(h*.47)),fill=110); m=m.filter(ImageFilter.GaussianBlur(60))
warm=Image.new('RGB',(w,h),(255,190,105))
im=ImageChops.add(im,Image.composite(warm,Image.new('RGB',(w,h)),m).point(lambda v:int(v*0.55)))
im.save(sys.argv[2])
