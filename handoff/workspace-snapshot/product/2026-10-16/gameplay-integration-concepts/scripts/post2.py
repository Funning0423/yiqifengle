import sys
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
src,dst=sys.argv[1:3]
im=Image.open(src).convert('RGB')
im=ImageEnhance.Color(im).enhance(1.22); im=ImageEnhance.Contrast(im).enhance(1.06)
w,h=im.size; m=Image.new('L',(w,h),0); ImageDraw.Draw(m).ellipse((-w*.3,-h*.15,w*1.3,h*1.15),fill=255)
m=m.filter(ImageFilter.GaussianBlur(140)); Image.composite(im,ImageEnhance.Brightness(im).enhance(0.82),m).save(dst)
