from PIL import Image,ImageDraw
import math
S=8;N=48*S;im=Image.new('RGBA',(N,N),(0,0,0,0));d=ImageDraw.Draw(im)
OUT=(40,82,30,255)
def hexc(h,k=1.0):return tuple(min(255,int(int(h[i:i+2],16)*k)) for i in (1,3,5))+(255,)
def leaf(bx,by,L,W,ang,col):
  ca,sa=math.cos(ang),math.sin(ang)
  P=lambda u,v:((bx+u*ca-v*sa)*S,(by+u*sa+v*ca)*S)   # u from base (0) to tip (L)
  prof=[(0,0),(L*.2,W*.36),(L*.45,W*.5),(L*.72,W*.38),(L,0)]
  out=[P(u,v) for u,v in prof]+[P(u,-v) for u,v in prof[::-1][1:-1]]
  d.polygon(out,fill=OUT)
  t=1.4 # outline px
  pin=[(u if i in(0,4) else u, max(0,v-t)) for i,(u,v) in enumerate(prof)];pin[0]=(t*1.2,0);pin[4]=(L-t*1.6,0)
  d.polygon([P(u,v) for u,v in pin],fill=hexc(col,1.07))
  d.polygon([P(u,-v) for u,v in pin],fill=hexc(col,.88))
  d.line([P(t,0),P(L*.86,0)],fill=OUT,width=int(1.0*S))
# stem (behind leaves)
d.line([(15*S,45*S),(22*S,34*S)],fill=OUT,width=int(3.4*S))
d.line([(15.4*S,44.3*S),(22*S,34*S)],fill=(92,150,56,255),width=int(1.5*S))
leaf(21,35,23,16,math.radians(-122),'#6DBA3C')   # darker leaf, up-left
leaf(21,34,27,17,math.radians(-62),'#A6DB6A')    # lighter leaf on top, up-right
from PIL import ImageChops
im=ImageChops.offset(im,3*S,-4*S)
im=im.resize((48,48),Image.LANCZOS)
im.save('glass-sign-leaf.png',optimize=True)
im.resize((384,384),Image.NEAREST).save('leaf_8x.png')
