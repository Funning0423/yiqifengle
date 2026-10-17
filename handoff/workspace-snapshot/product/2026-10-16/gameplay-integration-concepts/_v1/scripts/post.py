import sys
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
src,dst=sys.argv[1:3]
im=Image.open(src).convert('RGB')
im=ImageEnhance.Color(im).enhance(1.15); im=ImageEnhance.Contrast(im).enhance(1.05)
w,h=im.size; m=Image.new('L',(w,h),0); ImageDraw.Draw(m).ellipse((-w*.25,-h*.15,w*1.25,h*1.15),fill=255)
m=m.filter(ImageFilter.GaussianBlur(120)); dark=ImageEnhance.Brightness(im).enhance(0.8)
Image.composite(im,dark,m).save(dst)
